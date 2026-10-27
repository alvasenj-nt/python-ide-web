// Regresión del laboratorio: abre cada práctica publicada en Chrome sin
// interfaz y comprueba, para cada ejercicio, que el esqueleto se ejecuta sin
// errores, que main.py termina (y muestra su resultado, si el manifiesto lo
// define) y que "Copiar código" genera la entrega con sus marcas de archivo y
// el informe del entorno. Comprueba además la raíz sin parámetro, el aviso de
// una práctica sin publicar, el diagnóstico completo (?diagnostico) y el
// laboratorio incrustado en una página de otro origen, como en Moodle.
//
// Uso: node pruebas/regresion.js [id...]   (por defecto, todas las prácticas)
// Requisitos: puppeteer-core y Google Chrome (variable CHROME si no está en
// la ruta habitual). Lo ejecuta GitHub Actions en cada push.
'use strict';
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const RAIZ = path.resolve(__dirname, '..');
const PUERTO = 8766;
const PUERTO_EXTERNO = 8767;
const PREFIJO = '/python-ide-web/';
const BASE = 'http://localhost:' + PUERTO + PREFIJO;
const CHROME = process.env.CHROME || (process.platform === 'win32'
  ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome');

const practicas = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(path.join(RAIZ, 'practicas')).filter((d) => fs.existsSync(path.join(RAIZ, 'practicas', d, 'practica.json')));

const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.py': 'text/plain; charset=utf-8' };
function servidor() {
  return http.createServer((req, res) => {
    let url = decodeURIComponent(req.url.split('?')[0]);
    if (!url.startsWith(PREFIJO) || url.includes('..')) { res.writeHead(404); return res.end(); }
    url = url.slice(PREFIJO.length - 1);
    if (url.endsWith('/')) url += 'index.html';
    const fichero = path.join(RAIZ, url);
    fs.stat(fichero, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': TIPOS[path.extname(fichero)] || 'application/octet-stream' });
      fs.createReadStream(fichero).pipe(res);
    });
  }).listen(PUERTO);
}

// Página de otro origen (otro puerto) que incrusta el laboratorio como el
// cuestionario de Moodle
function servidorExterno(id) {
  return http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><title>Cuestionario</title><iframe src="' + BASE + '?p=' + id
      + '" style="width:100%;height:85vh;min-height:720px" allowfullscreen></iframe><textarea id="respuesta"></textarea>');
  }).listen(PUERTO_EXTERNO);
}

const fallos = [];
const comprobar = (id, prueba, ok, detalle) => {
  console.log((ok ? '  ok    ' : '  FALLO ') + prueba + (detalle ? ' | ' + detalle : ''));
  if (!ok) fallos.push(id + ': ' + prueba + (detalle ? ' (' + detalle + ')' : ''));
};

const LISTO = /^(Entorno listo|No se pudo|Esta práctica|Abre la práctica|Diagnóstico del laboratorio)/;

async function abrir(navegador, url, esperarInterprete = true) {
  const p = await navegador.newPage();
  p.on('pageerror', (e) => console.log('  error de la página: ' + e.message));
  await p.goto(url);
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) { /* sin almacenamiento */ } });
  await p.reload();
  await p.waitForFunction((re) => new RegExp(re).test(document.getElementById('estado').textContent),
    { timeout: 240000 }, LISTO.source);
  if (esperarInterprete && /Diagnóstico del laboratorio/.test(await p.$eval('#estado', (e) => e.textContent))) {
    await p.waitForFunction(() => /^(Entorno listo|No se pudo)/.test(document.getElementById('estado').textContent),
      { timeout: 240000 });
  }
  return p;
}

async function esperarFin(p, timeout = 120000) {
  try {
    await p.waitForFunction(() => !document.getElementById('btn-ejecutar').disabled, { timeout, polling: 250 });
    return true;
  } catch (e) {
    return false;
  }
}

async function probarPractica(navegador, id) {
  console.log('\n=== ' + id + ' ===');
  const manifiesto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'practicas', id, 'practica.json'), 'utf8'));
  const p = await abrir(navegador, BASE + '?p=' + id);
  const estado = await p.$eval('#estado', (e) => e.textContent);
  comprobar(id, 'carga', estado.startsWith('Entorno listo'), estado);
  if (!estado.startsWith('Entorno listo')) { await p.close(); return; }

  for (const ej of manifiesto.ejercicios) {
    await p.click(`.archivo[data-archivo="${ej.carpeta}/${ej.principal}"]`);
    await p.click('#btn-ejecutar');
    const termina = await esperarFin(p);
    const errores = await p.$$eval('#lista-problemas td.tipo-error', (tds) => tds.map((t) => t.textContent));
    comprobar(id, ej.carpeta + ': el esqueleto se ejecuta sin errores', errores.length === 0, errores.join(' / '));
    const titulo = await p.$eval('#consola-titulo', (e) => e.textContent);
    comprobar(id, ej.carpeta + ': ' + ej.principal + ' termina', termina && titulo.startsWith('<terminated>'), titulo);
    if (!termina) {
      await p.click('#btn-terminar');
      await esperarFin(p);
      continue;
    }
    const salida = await p.$eval('#consola-visible', (e) => e.textContent);
    if (manifiesto.resultado) {
      comprobar(id, ej.carpeta + ': muestra el resultado', new RegExp(manifiesto.resultado.patron).test(salida),
        salida.trim().split('\n').pop());
    }
    await p.click('#btn-copiar-codigo');
    await new Promise((r) => setTimeout(r, 300));
    const copiado = await p.evaluate(() => navigator.clipboard.readText());
    const editables = ej.archivos.filter((a) => a.editable).map((a) => '# ===== Archivo: ' + ej.carpeta + '/' + a.nombre + ' =====');
    comprobar(id, ej.carpeta + ': Copiar código genera la entrega',
      editables.every((m) => copiado.includes(m)) && /\n# Informe del entorno \(no borrar\): .*ultima_ejecucion=[^\n]*\n$/.test(copiado),
      (copiado.match(/ultima_ejecucion=([^\n]*)/) || ['', 'sin informe'])[1].trim());
  }
  await p.close();
}

async function probarIncrustado(navegador, id) {
  console.log('\n=== ' + id + ' incrustado en otro origen ===');
  const externo = servidorExterno(id);
  const p = await navegador.newPage();
  try {
    await p.goto('http://127.0.0.1:' + PUERTO_EXTERNO + '/');
    const marco = await (await p.$('iframe')).contentFrame();
    await marco.waitForFunction(() => /^(Entorno listo|No se pudo)/.test(document.getElementById('estado').textContent),
      { timeout: 240000 });
    const manifiesto = JSON.parse(fs.readFileSync(path.join(RAIZ, 'practicas', id, 'practica.json'), 'utf8'));
    const ej = manifiesto.ejercicios[0];
    await marco.click(`.archivo[data-archivo="${ej.carpeta}/${ej.principal}"]`);
    await marco.click('#btn-ejecutar');
    await marco.waitForFunction(() => !document.getElementById('btn-ejecutar').disabled, { timeout: 120000 });
    const salida = await marco.$eval('#consola-visible', (e) => e.textContent);
    comprobar(id, 'incrustado: ejecuta ' + ej.carpeta, salida.length > 0 && !(await marco.$('#lista-problemas td.tipo-error')),
      salida.trim().split('\n').pop());
    const pantalla = await marco.$eval('#btn-pantalla-completa', (b) => !b.hidden);
    comprobar(id, 'incrustado: botón Pantalla completa visible', pantalla);
  } finally {
    await p.close();
    externo.close();
  }
}

async function probarDiagnostico(navegador) {
  console.log('\n=== diagnóstico (?diagnostico, sin práctica) ===');
  const p = await abrir(navegador, BASE + '?diagnostico');
  await p.click('#btn-diagnostico');
  await p.waitForFunction(() => /^Diagnóstico terminado/.test(document.getElementById('estado').textContent),
    { timeout: 300000, polling: 500 });
  const filas = await p.$$eval('#lista-diag tr', (trs) => trs.map((tr) => [...tr.children].map((td) => td.textContent)));
  filas.filter(([, , v]) => v !== 'Pendiente').forEach(([nombre, texto, valor]) =>
    comprobar('diagnóstico', nombre, valor !== 'Fallo', valor + ': ' + texto));
  await p.close();
}

(async () => {
  const srv = servidor();
  const navegador = await puppeteer.launch({ executablePath: CHROME, headless: 'new', protocolTimeout: 600000,
    args: process.platform === 'linux' ? ['--no-sandbox'] : [] });
  await navegador.defaultBrowserContext().overridePermissions('http://localhost:' + PUERTO,
    ['clipboard-read', 'clipboard-write']);
  try {
    console.log('=== raíz sin parámetro ===');
    const p = await abrir(navegador, BASE, false);
    const aviso = await p.$eval('#estado', (e) => e.textContent);
    comprobar('raíz', 'remite al cuestionario', aviso.includes('desde su cuestionario'), aviso);
    await p.close();
    // Cuestionario importado antes de publicar su práctica
    const q = await abrir(navegador, BASE + '?p=zz-practica-no-publicada', false);
    const aviso2 = await q.$eval('#estado', (e) => e.textContent);
    comprobar('raíz', 'avisa de una práctica sin publicar', aviso2.includes('todavía no está disponible'), aviso2);
    await q.close();
    await probarDiagnostico(navegador);
    for (const id of practicas) await probarPractica(navegador, id);
    if (practicas.length) await probarIncrustado(navegador, practicas[0]);
  } finally {
    await navegador.close();
    srv.close();
  }
  console.log('\n' + (fallos.length ? fallos.length + ' fallos:\n- ' + fallos.join('\n- ') : 'Regresión superada: '
    + practicas.length + ' práctica(s).'));
  process.exit(fallos.length ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
