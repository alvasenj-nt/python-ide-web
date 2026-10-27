'use strict';

// Pyodide (CPython en WebAssembly) desde jsDelivr, con la versión fijada:
// cambiarla solo tras pasar la regresión de todas las prácticas.
const URL_PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v0.28.3/full/';
const VERSION_INFORME = 'INFORME LABORATORIO PYTHON WEB v1';
const VERSION_ENTORNO = 'ENTORNO LABORATORIO PYTHON WEB v1';
const PARAMETROS = new URLSearchParams(location.search);
// El diagnóstico completo solo se muestra abriendo la página con ?diagnostico
const MODO_PROFESOR = PARAMETROS.has('diagnostico');
// La entrega por defecto es pegar el código en el cuestionario; la descarga
// en .zip (para una tarea sin SEB) solo se muestra con ?entrega=zip
const ENTREGA_ZIP = PARAMETROS.get('entrega') === 'zip';

// Cada práctica es una carpeta practicas/<id>/ con su manifiesto
// practica.json, y se elige con ?p=<id>. Sin parámetro no se carga ninguna:
// cada práctica solo aparece en su cuestionario. Con ?diagnostico y sin ?p=
// el laboratorio arranca solo para el diagnóstico.
const ID_PRACTICA = PARAMETROS.get('p');
const RE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RE_CARPETA = /^[a-z0-9_]+$/;
const RE_MODULO = /^[a-z_][a-z0-9_]*\.py$/;
const ESQUEMA_MAXIMO = 1;

const PYTHON = 'python';
// Se rellenan a partir del manifiesto. La clave de cada archivo incluye la
// carpeta de su ejercicio; cada ejercicio se ejecuta por separado.
let PRACTICA = null;
let CLAVE = 'diagnostico:';
let NOMBRE_ENTREGA = null;
const ARCHIVOS = {};
const esPython = (n) => ARCHIVOS[n] && ARCHIVOS[n].modo === PYTHON;
const carpetaDe = (n) => (n && n.includes('/') ? n.split('/')[0] : null);
const nombreCorto = (n) => n.split('/').pop();

const PRUEBAS = [
  ['carga', 'Carga del intérprete'],
  ['entorno', 'Versión de Python y núcleos del equipo'],
  ['primera', 'Primera ejecución'],
  ['siguientes', 'Siguientes ejecuciones'],
  ['sintaxis', 'Detecta un SyntaxError con su línea'],
  ['excepcion', 'Detecta una excepción en otro módulo con su línea'],
  ['recarga', 'Import carga la versión editada del módulo'],
  ['ficheros', 'pathlib, shutil, re y escritura UTF-8'],
  ['limpieza', 'Cada ejecución parte de una carpeta vacía'],
  ['rendimiento', 'Bucle de un millón de iteraciones'],
  ['terminar', 'Terminar un bucle infinito y reiniciar'],
  ['tareaMain', 'Tu proyecto: última ejecución de main.py'],
];

const estado = {
  plantillas: {},
  docs: {},
  activo: null,
  ocupado: false,
  listo: false,
  version: null,
  inicioPagina: performance.now(),
  marcasError: [],
  resultados: {},
  // Métricas que viajan en la entrega sin intervención del alumno
  metricas: { carga: null, ejecuciones: [], conErrores: 0, ultimaEjecucion: 'sin ejecutar' },
};

let editor;
let cronometro = null;
let trabajador = null;
let esperaListo = null;
let ejecucionActual = null;
let contadorEjecuciones = 0;

// ---------- utilidades ----------

const $ = (id) => document.getElementById(id);

function leerAlmacen(clave) {
  try { return localStorage.getItem(CLAVE + clave); } catch (e) { return null; }
}
function escribirAlmacen(clave, valor) {
  try { localStorage.setItem(CLAVE + clave, valor); } catch (e) { /* sin almacenamiento */ }
}

function setEstado(texto) { $('estado').textContent = texto; }

function iniciarCronometro() {
  const inicio = performance.now();
  $('cronometro').textContent = '';
  cronometro = setInterval(() => {
    $('cronometro').textContent = ((performance.now() - inicio) / 1000).toFixed(0) + ' s';
  }, 500);
}
function pararCronometro() {
  clearInterval(cronometro);
  $('cronometro').textContent = '';
}

function mostrarPanel(nombre) {
  document.querySelectorAll('.pestana').forEach((p) => p.classList.toggle('activa', p.dataset.panel === nombre));
  document.querySelectorAll('.contenido-panel').forEach((c) => c.classList.toggle('activo', c.id === 'panel-' + nombre));
}

// Se puede ejecutar desde cualquier archivo de un ejercicio (el módulo o main.py)
function actualizarEjecutar() {
  const carpeta = carpetaDe(estado.activo);
  $('btn-ejecutar').disabled = estado.ocupado || !estado.listo || !carpeta;
  $('btn-ejecutar').title = carpeta
    ? 'Ejecutar el ' + principalDe(carpeta) + ' de ' + carpeta + ' (F5 o Ctrl+F11)'
    : 'Abre un archivo de un ejercicio para ejecutarlo';
  $('btn-copiar-codigo').disabled = !carpeta;
  $('btn-copiar-codigo').title = carpeta
    ? 'Copiar el código de ' + carpeta + ' para pegarlo en el cuestionario'
    : 'Abre un archivo de un ejercicio para copiar su código';
}

function bloquearBotones(bloquear) {
  $('btn-diagnostico').disabled = bloquear || !estado.listo;
  actualizarEjecutar();
}

async function conBloqueo(fn) {
  if (estado.ocupado) return;
  estado.ocupado = true;
  bloquearBotones(true);
  iniciarCronometro();
  try {
    await fn();
  } catch (e) {
    setEstado('Error inesperado: ' + e);
    console.error(e);
  } finally {
    pararCronometro();
    estado.ocupado = false;
    bloquearBotones(false);
  }
}

// ---------- intérprete ----------

// Arranca un worker nuevo con Pyodide. Se llama al cargar la página y
// después de terminar una ejecución que no acababa.
function arrancarInterprete() {
  if (trabajador) trabajador.terminate();
  estado.listo = false;
  const t0 = performance.now();
  trabajador = new Worker('js/trabajador.js?v=1');
  trabajador.onmessage = (ev) => recibir(ev.data);
  trabajador.onerror = (ev) => recibir({ tipo: 'error-carga', mensaje: ev.message || 'el worker no arrancó' });
  return new Promise((resolve) => {
    esperaListo = (m) => resolve(Object.assign(m, { total: (performance.now() - t0) / 1000 }));
    trabajador.postMessage({ tipo: 'iniciar', url: URL_PYODIDE });
  });
}

function recibir(m) {
  if (m.tipo === 'listo' || m.tipo === 'error-carga') {
    if (esperaListo) { const f = esperaListo; esperaListo = null; f(m); }
    return;
  }
  if (!ejecucionActual || m.id !== ejecucionActual.id) return;
  if (m.tipo === 'salida') {
    ejecucionActual.salida[m.flujo] += m.texto;
    ejecucionActual.alEscribir(m.flujo, m.texto);
  } else if (m.tipo === 'fin') {
    const e = ejecucionActual;
    ejecucionActual = null;
    e.resolver({ salida: e.salida.out, errores: e.salida.err, segundos: m.segundos, error: m.error, terminada: false });
  }
}

// Ejecuta principal dentro de la carpeta con los archivos dados. Devuelve
// { salida, errores, segundos, error, terminada }.
function ejecutar(carpeta, archivos, principal, alEscribir = () => {}) {
  contadorEjecuciones++;
  return new Promise((resolver) => {
    ejecucionActual = { id: contadorEjecuciones, salida: { out: '', err: '' }, alEscribir, resolver };
    trabajador.postMessage({ tipo: 'ejecutar', id: contadorEjecuciones, carpeta, archivos, principal });
  });
}

// Detiene la ejecución en curso (bucle infinito, espera sin fin) terminando el
// worker y arranca otro intérprete. El código del editor no se toca.
async function terminarEjecucion() {
  if (!ejecucionActual) return;
  const e = ejecucionActual;
  ejecucionActual = null;
  setEstado('Deteniendo la ejecución y reiniciando el intérprete...');
  const reinicio = arrancarInterprete();
  e.resolver({ salida: e.salida.out, errores: e.salida.err, segundos: 0, error: null, terminada: true });
  const m = await reinicio;
  estado.listo = m.tipo === 'listo';
  bloquearBotones(estado.ocupado);
  setEstado(estado.listo ? 'Ejecución terminada. Intérprete listo de nuevo.' : 'No se pudo reiniciar el intérprete: ' + m.mensaje);
  return m;
}

// ---------- práctica ----------

// El motor acepta todos los esquemas hasta ESQUEMA_MAXIMO: una práctica ya
// publicada no se modifica, así que su manifiesto tiene que seguir siendo
// válido con las versiones posteriores del motor.
function validarManifiesto(m) {
  const fallo = (motivo) => { throw new Error('manifiesto no válido: ' + motivo); };
  if (!m || !Number.isInteger(m.esquema)) fallo('falta el número de esquema');
  if (m.esquema > ESQUEMA_MAXIMO) fallo('el esquema ' + m.esquema + ' necesita una versión más reciente del laboratorio');
  if (m.id !== ID_PRACTICA) fallo('el identificador no coincide con la carpeta');
  if (!Number.isInteger(m.version) || m.version < 1) fallo('versión no válida');
  if (!Array.isArray(m.ejercicios) || !m.ejercicios.length) fallo('no hay ejercicios');
  m.ejercicios.forEach((ej) => {
    if (!RE_CARPETA.test(ej.carpeta) || !RE_MODULO.test(ej.principal)) fallo('carpeta o programa principal no válidos');
    if (!ej.archivos.some((a) => a.nombre === ej.principal)) fallo(ej.carpeta + ' no contiene su programa principal');
    ej.archivos.forEach((a) => { if (!RE_MODULO.test(a.nombre)) fallo('archivo no válido: ' + a.nombre); });
  });
  return m;
}

async function cargarPractica() {
  if (!RE_ID.test(ID_PRACTICA)) throw new Error('identificador de práctica no válido');
  const base = 'practicas/' + ID_PRACTICA + '/';
  const r = await fetch(base + 'practica.json', { cache: 'no-cache' });
  // Un 404 es lo normal si el cuestionario se abre antes de publicar la
  // práctica: el iframe ya apunta a su URL definitiva
  if (r.status === 404) throw Object.assign(new Error('práctica no publicada'), { noPublicada: true });
  if (!r.ok) throw new Error('el servidor respondió ' + r.status);
  PRACTICA = validarManifiesto(await r.json());
  // Prefijo propio por práctica y versión: dos prácticas nunca comparten
  // el código guardado, y una versión nueva no muestra el esqueleto antiguo
  CLAVE = PRACTICA.id + ':v' + PRACTICA.version + ':';
  NOMBRE_ENTREGA = 'entrega_' + PRACTICA.proyecto.replace(/-/g, '_') + '.zip';
  PRACTICA.ejercicios.forEach((ej) => ej.archivos.forEach((a) => {
    ARCHIVOS[ej.carpeta + '/' + a.nombre] = { ruta: base + ej.carpeta + '/' + a.nombre, soloLectura: !a.editable, modo: PYTHON };
  }));
  if (PRACTICA.readme) {
    ARCHIVOS[PRACTICA.readme] = { ruta: base + PRACTICA.readme, soloLectura: true, modo: 'text/plain' };
  }
  estado.activo = PRACTICA.readme || Object.keys(ARCHIVOS)[0];
  document.title = 'Laboratorio Python AD · ' + PRACTICA.titulo;
  document.querySelector('.subtitulo').textContent = PRACTICA.titulo;
}

const principalDe = (carpeta) => PRACTICA.ejercicios.find((ej) => ej.carpeta === carpeta).principal;

function construirExplorador() {
  const arbol = document.querySelector('.arbol');
  arbol.innerHTML = '';
  const nodo = (clase, texto) => {
    const li = document.createElement('li');
    li.className = clase;
    li.textContent = texto;
    arbol.appendChild(li);
  };
  const archivo = (clave, clase) => {
    const boton = document.createElement('button');
    boton.className = 'archivo ' + clase;
    boton.dataset.archivo = clave;
    boton.textContent = nombreCorto(clave);
    if (esPython(clave) && ARCHIVOS[clave].soloLectura) {
      const marca = document.createElement('span');
      marca.className = 'solo-lectura';
      marca.textContent = '(solo lectura)';
      boton.append(' ', marca);
    }
    boton.addEventListener('click', () => abrirArchivo(clave));
    const li = document.createElement('li');
    li.appendChild(boton);
    arbol.appendChild(li);
  };
  nodo('nodo-proyecto', PRACTICA.proyecto);
  PRACTICA.ejercicios.forEach((ej) => {
    nodo('nodo-carpeta', ej.carpeta);
    ej.archivos.forEach((a) => archivo(ej.carpeta + '/' + a.nombre, 'archivo-ejercicio'));
  });
  if (PRACTICA.readme) archivo(PRACTICA.readme, 'archivo-raiz');
}

// Resumen de la última ejecución para el informe del entorno. Los patrones
// del manifiesto son opcionales: sin ellos solo consta que main.py terminó.
function resumenEjecucion(carpeta, e) {
  if (e.terminada) return { texto: carpeta + ': detenida con Terminar', valor: 'aviso' };
  if (e.error) return { texto: carpeta + ': ' + e.error.tipo + (e.error.linea ? ' en ' + e.error.archivo + ':' + e.error.linea : ''), valor: 'aviso' };
  const extraer = (regla) => {
    const m = regla && e.salida.match(new RegExp(regla.patron));
    return m ? regla.texto.replace(/\$(\d)/g, (_, i) => m[Number(i)]) : null;
  };
  const resultado = extraer(PRACTICA.resultado);
  if (PRACTICA.resultado && !resultado) return { texto: carpeta + ': main.py no mostró el resultado', valor: 'aviso' };
  return {
    texto: carpeta + (resultado ? ', ' + resultado : ', main.py terminado') + ', ' + e.segundos.toFixed(1) + ' s',
    valor: 'ok',
  };
}

// ---------- editor ----------

async function cargarFuentes() {
  const nombres = Object.keys(ARCHIVOS);
  const textos = await Promise.all(nombres.map((n) => fetch(ARCHIVOS[n].ruta, { cache: 'no-cache' }).then((r) => {
    if (!r.ok) throw new Error(n + ': ' + r.status);
    return r.text();
  })));
  nombres.forEach((n, i) => { estado.plantillas[n] = textos[i]; });
}

function crearEditor() {
  Object.keys(ARCHIVOS).forEach((n) => {
    const guardado = ARCHIVOS[n].soloLectura ? null : leerAlmacen('archivo:' + n);
    estado.docs[n] = CodeMirror.Doc(guardado !== null ? guardado : estado.plantillas[n], ARCHIVOS[n].modo);
  });
  const ultimo = leerAlmacen('activo');
  if (ultimo && ARCHIVOS[ultimo]) estado.activo = ultimo;
  editor = CodeMirror($('contenedor-editor'), {
    value: estado.docs[estado.activo],
    mode: ARCHIVOS[estado.activo].modo,
    theme: 'eclipse',
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    matchBrackets: true,
    autoCloseBrackets: true,
    styleActiveLine: true,
    highlightSelectionMatches: { showToken: /\w/, minChars: 2 },
    gutters: ['marcas-error', 'CodeMirror-linenumbers'],
    extraKeys: {
      Tab: (cm) => (cm.somethingSelected() ? cm.indentSelection('add') : cm.replaceSelection('    ')),
      'Shift-Tab': 'indentLess',
    },
  });
  abrirArchivo(estado.activo);
  editor.on('change', () => {
    if (!ARCHIVOS[estado.activo].soloLectura) {
      escribirAlmacen('archivo:' + estado.activo, editor.getValue());
    }
  });
}

function abrirArchivo(nombre) {
  if (!ARCHIVOS[nombre]) return;
  estado.activo = nombre;
  escribirAlmacen('activo', nombre);
  editor.swapDoc(estado.docs[nombre]);
  editor.setOption('mode', ARCHIVOS[nombre].modo);
  editor.setOption('readOnly', ARCHIVOS[nombre].soloLectura);
  $('pestana-editor').textContent = nombre + (ARCHIVOS[nombre].soloLectura ? ' (solo lectura)' : '');
  document.querySelectorAll('.archivo').forEach((b) => b.classList.toggle('activo', b.dataset.archivo === nombre));
  actualizarEjecutar();
  editor.focus();
}

// Archivos .py del ejercicio con el contenido actual del editor
function archivosEjercicio(carpeta) {
  const archivos = {};
  Object.keys(ARCHIVOS)
    .filter((n) => esPython(n) && carpetaDe(n) === carpeta)
    .forEach((n) => { archivos[nombreCorto(n)] = estado.docs[n].getValue(); });
  return archivos;
}

function limpiarMarcas() {
  estado.marcasError.forEach(({ doc, linea }) => {
    doc.removeLineClass(linea, 'background', 'linea-error');
    doc.setGutterMarker(linea, 'marcas-error', null);
  });
  estado.marcasError = [];
}

// Python solo informa del primer error: la vista Problems tiene como mucho
// una fila, con el archivo y la línea del ejercicio donde se produjo.
function mostrarProblemas(error) {
  limpiarMarcas();
  const cuerpo = $('lista-problemas');
  cuerpo.innerHTML = '';
  $('contador-problemas').textContent = error ? '(1)' : '';
  if (!error) return;
  const fila = document.createElement('tr');
  const desc = document.createElement('td');
  desc.className = 'tipo-error';
  desc.textContent = error.mensaje;
  const rec = document.createElement('td');
  rec.textContent = error.archivo || '';
  const lin = document.createElement('td');
  lin.textContent = error.linea ? 'línea ' + error.linea : '';
  fila.append(desc, rec, lin);
  cuerpo.appendChild(fila);
  if (!error.archivo || !error.linea) return;
  fila.addEventListener('click', () => irALinea(error.archivo, error.linea));
  const doc = estado.docs[error.archivo];
  if (doc) {
    const linea = Math.min(error.linea, doc.lineCount()) - 1;
    doc.addLineClass(linea, 'background', 'linea-error');
    const marca = document.createElement('span');
    marca.className = 'marca-error';
    marca.textContent = 'x';
    marca.title = error.mensaje;
    doc.setGutterMarker(linea, 'marcas-error', marca);
    estado.marcasError.push({ doc, linea });
  }
}

function irALinea(archivo, linea) {
  if (!estado.docs[archivo]) return;
  abrirArchivo(archivo);
  editor.setCursor({ line: linea - 1, ch: 0 });
  editor.scrollIntoView({ line: linea - 1, ch: 0 }, 80);
}

// ---------- consola ----------

const hora = (d) => d.toLocaleString('es-ES', {
  day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
});
const lanzador = (carpeta) => principalDe(carpeta) + ' (' + carpeta + ') [Python ' + (estado.version || '3') + ' en el navegador]';

function escribirConsola(flujo, texto) {
  const destino = $('consola-visible');
  if (flujo === 'err') {
    const span = document.createElement('span');
    span.className = 'salida-error';
    span.textContent = texto;
    destino.appendChild(span);
  } else {
    destino.appendChild(document.createTextNode(texto));
  }
  destino.scrollTop = destino.scrollHeight;
}

// ---------- acciones ----------

async function accionEjecutar() {
  const carpeta = carpetaDe(estado.activo);
  if (!carpeta) return;
  await conBloqueo(async () => {
    mostrarPanel('consola');
    mostrarProblemas(null);
    setEstado('Ejecutando ' + carpeta + '/' + principalDe(carpeta) + '...');
    const inicio = new Date();
    $('consola-titulo').textContent = lanzador(carpeta) + ' (' + hora(inicio) + ')';
    $('consola-visible').textContent = '';
    $('btn-terminar').disabled = false;
    const aviso = setTimeout(() => setEstado('La ejecución lleva más de 20 s. Si no avanza, pulsa Terminar en la vista Console.'), 20000);
    let e;
    try {
      e = await ejecutar(carpeta, archivosEjercicio(carpeta), principalDe(carpeta), escribirConsola);
    } finally {
      clearTimeout(aviso);
      $('btn-terminar').disabled = true;
      $('consola-titulo').textContent = '<terminated> ' + lanzador(carpeta) + ' (' + hora(inicio) + ' – '
        + hora(new Date()).split(', ').pop() + ')';
    }
    estado.metricas.ejecuciones.push(e.segundos);
    if (e.error) estado.metricas.conErrores++;
    estado.resultados.tareaMain = resumenEjecucion(carpeta, e);
    estado.metricas.ultimaEjecucion = estado.resultados.tareaMain.texto;
    pintarDiagnostico();
    if (e.terminada) {
      escribirConsola('err', '\n[Ejecución detenida con Terminar]\n');
      return;
    }
    if (e.error) {
      mostrarProblemas(e.error);
      setEstado('La ejecución terminó con ' + e.error.tipo
        + (e.error.linea ? ' en ' + e.error.archivo + ', línea ' + e.error.linea : '') + '. Revisa la vista Console y Problems.');
      return;
    }
    setEstado(principalDe(carpeta) + ' terminado en ' + e.segundos.toFixed(1) + ' s');
  });
}

// ---------- diagnóstico ----------

// Programas pequeños que comprueban lo que el alumnado necesita del
// intérprete: errores con su línea, módulos propios, ficheros y rendimiento.
const DIAG = {
  entorno: { 'main.py': 'import sys, os\nprint("## version=" + sys.version.split()[0])\nprint("## cwd=" + os.getcwd())\nprint("## acentos=ñáéíóú")\n' },
  sintaxis: { 'main.py': 'def f():\n    return 1\nif f() == 1\n    print("no")\n' },
  excepcion: { 'main.py': 'import calculo\n\nprint(calculo.dividir(1, 0))\n', 'calculo.py': 'def dividir(a, b):\n    return a / b\n' },
  recarga1: { 'main.py': 'import modulo\nprint("## valor=" + modulo.VALOR)\n', 'modulo.py': 'VALOR = "uno"\n' },
  recarga2: { 'main.py': 'import modulo\nprint("## valor=" + modulo.VALOR)\n', 'modulo.py': 'VALOR = "dos"\n' },
  ficheros: { 'main.py': [
    'import re, shutil',
    'from pathlib import Path',
    'origen = Path("entrada") / "sub" / "temp_A1_20260915.csv"',
    'origen.parent.mkdir(parents=True)',
    'origen.write_text("hora;valor\\n00:00;14,2\\n", encoding="utf-8")',
    'm = re.match(r"^([a-z]+)_([A-Z0-9]+)_(\\d{8})\\.csv$", origen.name)',
    'destino = Path("salida") / m.group(2) / "15.csv"',
    'destino.parent.mkdir(parents=True, exist_ok=True)',
    'tam = origen.stat().st_size',
    'shutil.move(origen, destino)',
    'Path("informe.txt").write_text("AUDITORÍA\\n", encoding="utf-8")',
    'ok = destino.is_file() and not origen.exists() and tam == 22 and len(list(Path(".").rglob("*.csv"))) == 1',
    'ok = ok and Path("informe.txt").read_bytes() == "AUDITORÍA\\n".encode("utf-8")',
    'print("## ficheros=" + ("ok" if ok else "mal"))',
  ].join('\n') + '\n' },
  limpieza: { 'main.py': 'from pathlib import Path\nprint("## restos=" + str(sum(1 for p in Path(".").rglob("*") if p.name != "main.py")))\n' },
  rendimiento: { 'main.py': 'import time\nt = time.perf_counter()\ns = 0\nfor i in range(1_000_000):\n    s += i % 7\nprint("## ms=" + str(round((time.perf_counter() - t) * 1000)))\n' },
  bucle: { 'main.py': 'while True:\n    pass\n' },
};

function claves(salida) {
  const datos = {};
  salida.split('\n').forEach((l) => {
    const m = l.match(/^## ([^=]+)=(.*)$/);
    if (m) datos[m[1].trim()] = m[2].trim();
  });
  return datos;
}

function registrar(id, texto, valor) {
  estado.resultados[id] = { texto, valor };
  pintarDiagnostico();
}

function pintarDiagnostico() {
  const cuerpo = $('lista-diag');
  cuerpo.innerHTML = '';
  const etiquetas = { ok: 'Correcto', aviso: 'Revisar', fallo: 'Fallo', pendiente: 'Pendiente' };
  PRUEBAS.forEach(([id, nombre]) => {
    const r = estado.resultados[id] || { texto: '', valor: 'pendiente' };
    const fila = document.createElement('tr');
    const a = document.createElement('td'); a.textContent = nombre;
    const b = document.createElement('td'); b.textContent = r.texto;
    const c = document.createElement('td'); c.textContent = etiquetas[r.valor]; c.className = 'val-' + r.valor;
    fila.append(a, b, c);
    cuerpo.appendChild(fila);
  });
}

const umbral = (s, ok, aviso) => (s <= ok ? 'ok' : s <= aviso ? 'aviso' : 'fallo');
const diag = (nombre) => ejecutar('diag', DIAG[nombre], 'main.py');

async function accionDiagnostico() {
  await conBloqueo(async () => {
    mostrarPanel('diagnostico');
    PRUEBAS.forEach(([id]) => { if (!id.startsWith('tarea') && id !== 'carga') delete estado.resultados[id]; });
    pintarDiagnostico();

    setEstado('Diagnóstico 1/6: entorno');
    const e1 = await diag('entorno');
    const k = claves(e1.salida);
    registrar('entorno', 'Python ' + (k.version || '?') + ', ' + (navigator.hardwareConcurrency || '?') + ' núcleos, acentos '
      + (k.acentos === 'ñáéíóú' ? 'bien' : 'mal'), k.version ? (k.acentos === 'ñáéíóú' ? 'ok' : 'aviso') : 'fallo');
    const sinPrimera = estado.metricas.ejecuciones.length === 0;
    registrar('primera', (sinPrimera ? e1.segundos : estado.metricas.ejecuciones[0]).toFixed(2) + ' s', umbral(e1.segundos, 2, 6));
    const e2 = await diag('entorno');
    registrar('siguientes', e2.segundos.toFixed(2) + ' s', umbral(e2.segundos, 1, 3));

    setEstado('Diagnóstico 2/6: errores');
    const s = await diag('sintaxis');
    registrar('sintaxis', s.error ? s.error.mensaje + ' (' + s.error.archivo + ':' + s.error.linea + ')' : 'sin error',
      s.error && s.error.tipo === 'SyntaxError' && s.error.archivo === 'diag/main.py' && s.error.linea === 3 ? 'ok' : 'fallo');
    const x = await diag('excepcion');
    registrar('excepcion', x.error ? x.error.mensaje + ' (' + x.error.archivo + ':' + x.error.linea + ')' : 'sin error',
      x.error && x.error.tipo === 'ZeroDivisionError' && x.error.archivo === 'diag/calculo.py' && x.error.linea === 2
        && /File "diag\/main\.py", line 3/.test(x.errores) ? 'ok' : 'fallo');

    setEstado('Diagnóstico 3/6: módulos propios');
    const r1 = claves((await diag('recarga1')).salida).valor;
    const r2 = claves((await diag('recarga2')).salida).valor;
    registrar('recarga', 'primera ' + r1 + ', segunda ' + r2, r1 === 'uno' && r2 === 'dos' ? 'ok' : 'fallo');

    setEstado('Diagnóstico 4/6: ficheros');
    const f = await diag('ficheros');
    const fk = claves(f.salida).ficheros;
    registrar('ficheros', fk || (f.error ? f.error.mensaje : 'sin resultado'), fk === 'ok' ? 'ok' : 'fallo');
    const l = claves((await diag('limpieza')).salida).restos;
    registrar('limpieza', (l || '?') + ' archivos de la ejecución anterior', l === '0' ? 'ok' : 'fallo');

    setEstado('Diagnóstico 5/6: rendimiento');
    const ms = Number(claves((await diag('rendimiento')).salida).ms || -1);
    registrar('rendimiento', ms + ' ms', ms < 0 ? 'fallo' : ms <= 1500 ? 'ok' : 'aviso');

    setEstado('Diagnóstico 6/6: terminar un bucle infinito');
    const bucle = diag('bucle');
    await new Promise((r) => setTimeout(r, 1000));
    const t0 = performance.now();
    const m = await terminarEjecucion();
    const b = await bucle;
    const segundos = (performance.now() - t0) / 1000;
    const vuelve = m && m.tipo === 'listo' && b.terminada;
    registrar('terminar', vuelve ? 'intérprete listo de nuevo en ' + segundos.toFixed(1) + ' s' : 'no se recuperó',
      vuelve ? umbral(segundos, 8, 20) : 'fallo');

    setEstado('Diagnóstico terminado.');
  });
}

function textoInforme() {
  const lineas = [VERSION_INFORME];
  lineas.push('navegador=' + navigator.userAgent);
  PRUEBAS.forEach(([id]) => {
    const r = estado.resultados[id];
    lineas.push(id + '=' + (r ? r.valor + ' | ' + r.texto : 'pendiente'));
  });
  return lineas.join('\n');
}

// Incrustado en otro sitio (Moodle), navigator.clipboard puede no responder
// nunca: se recurre a execCommand si no termina en un segundo y medio.
async function copiarTexto(texto) {
  const respaldo = () => {
    const area = document.createElement('textarea');
    area.value = texto;
    document.body.appendChild(area);
    area.select();
    document.execCommand('copy');
    area.remove();
  };
  try {
    await Promise.race([
      navigator.clipboard.writeText(texto),
      new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('sin respuesta')), 1500)),
    ]);
  } catch (e) {
    respaldo();
  }
}

async function copiarInforme() {
  await copiarTexto(textoInforme());
  setEstado('Informe copiado.');
}

// Entrega por cuestionario: copia los archivos editables del ejercicio abierto
// para pegarlos en su pregunta de ensayo, cada uno tras su marca de archivo.
// El informe del entorno viaja al final como comentario de una línea, y
// corregir.sh lo separa del código.
const MARCA_ARCHIVO = '# ===== Archivo: ';
const MARCA_INFORME = '# Informe del entorno (no borrar):';

function textoEntrega(carpeta) {
  const editables = Object.keys(ARCHIVOS).filter((n) => carpetaDe(n) === carpeta && !ARCHIVOS[n].soloLectura);
  const codigo = editables.map((n) => MARCA_ARCHIVO + n + ' =====\n' + estado.docs[n].getValue().replace(/\s*$/, '\n')).join('\n');
  // Separador ' | ': el identificador del navegador contiene ';'
  const informe = informeEntorno().trim().split('\n').slice(1).join(' | ');
  return codigo + '\n' + MARCA_INFORME + ' ' + informe + '\n';
}

async function copiarCodigo() {
  const carpeta = carpetaDe(estado.activo);
  if (!carpeta) return;
  await copiarTexto(textoEntrega(carpeta));
  setEstado('Código de ' + carpeta + ' copiado. Pégalo en su pregunta del cuestionario.');
}

function informeEntorno() {
  const m = estado.metricas;
  const siguientes = m.ejecuciones.slice(1);
  const media = siguientes.length ? siguientes.reduce((a, b) => a + b, 0) / siguientes.length : null;
  return [
    VERSION_ENTORNO,
    'fecha=' + new Date().toISOString(),
    'navegador=' + navigator.userAgent,
    'nucleos=' + (navigator.hardwareConcurrency || '?'),
    'python=' + (estado.version || '?'),
    'carga_s=' + (m.carga === null ? '?' : m.carga.toFixed(1)),
    'primera_ejecucion_s=' + (m.ejecuciones.length ? m.ejecuciones[0].toFixed(2) : '?'),
    'ejecucion_media_s=' + (media === null ? '?' : media.toFixed(2)),
    'ejecuciones=' + m.ejecuciones.length,
    'ejecuciones_con_error=' + m.conErrores,
    'ultima_ejecucion=' + m.ultimaEjecucion,
  ].join('\n') + '\n';
}

async function descargarEntrega() {
  const zip = new JSZip();
  Object.keys(ARCHIVOS).filter(esPython).forEach((n) => zip.file(n, estado.docs[n].getValue()));
  zip.file('informe_entorno.txt', informeEntorno());
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = NOMBRE_ENTREGA;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  setEstado('Entrega descargada: ' + NOMBRE_ENTREGA + '. Súbela a la tarea del Aula Virtual.');
}

function restaurarPlantilla() {
  if (!ARCHIVOS[estado.activo] || ARCHIVOS[estado.activo].soloLectura) return;
  if (!confirm('Se perderán los cambios de ' + estado.activo + '. ¿Continuar?')) return;
  editor.setValue(estado.plantillas[estado.activo]);
}

// ---------- arranque ----------

function enlazarUI() {
  document.querySelectorAll('.pestana').forEach((p) => p.addEventListener('click', () => mostrarPanel(p.dataset.panel)));
  $('btn-ejecutar').addEventListener('click', accionEjecutar);
  $('btn-diagnostico').addEventListener('click', accionDiagnostico);
  $('btn-copiar').addEventListener('click', copiarInforme);
  $('btn-descargar').addEventListener('click', descargarEntrega);
  $('btn-copiar-codigo').addEventListener('click', copiarCodigo);
  $('btn-plantilla').addEventListener('click', restaurarPlantilla);
  $('btn-reiniciar').addEventListener('click', () => location.reload());
  $('btn-terminar').addEventListener('click', terminarEjecucion);
  // Incrustado en el cuestionario (iframe), el laboratorio puede ocupar toda
  // la pantalla si el iframe lo permite (atributo allowfullscreen)
  if (window.self !== window.top && document.fullscreenEnabled) {
    $('btn-pantalla-completa').hidden = false;
    $('btn-pantalla-completa').addEventListener('click', () => {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen().catch(() => setEstado('El navegador no permite la pantalla completa.'));
    });
    document.addEventListener('fullscreenchange', () => {
      $('btn-pantalla-completa').textContent = document.fullscreenElement ? 'Salir de pantalla completa' : 'Pantalla completa';
    });
  }
  document.addEventListener('keydown', (ev) => {
    // F5 ejecuta, como en VS Code, en lugar de recargar la página
    if (ev.key === 'F5' || (ev.ctrlKey && ev.key === 'F11')) {
      ev.preventDefault();
      if (!$('btn-ejecutar').disabled) accionEjecutar();
    }
    if (ev.ctrlKey && (ev.key === 's' || ev.key === 'S')) { ev.preventDefault(); setEstado('Guardado automático activo.'); }
  });
}

function avisar(aviso) {
  setEstado(aviso);
  $('contenedor-editor').innerHTML = '<p class="aviso-practica"></p>';
  document.querySelector('.aviso-practica').textContent = aviso;
}

async function iniciar() {
  document.body.classList.toggle('modo-profesor', MODO_PROFESOR);
  document.body.classList.toggle('entrega-zip', ENTREGA_ZIP);
  enlazarUI();
  mostrarPanel('consola');
  pintarDiagnostico();
  if (ID_PRACTICA) {
    try {
      await cargarPractica();
      construirExplorador();
      await cargarFuentes();
    } catch (e) {
      avisar(e.noPublicada
        ? 'Esta práctica todavía no está disponible. Espera a que el profesor la abra y pulsa "Reiniciar entorno".'
        : 'No se pudo cargar la práctica (' + e.message + '). Pulsa "Reiniciar entorno" y, si sigue igual, avisa al profesor.');
      return;
    }
    crearEditor();
  } else if (MODO_PROFESOR) {
    avisar('Diagnóstico del laboratorio: cuando el intérprete esté listo, pulsa "Diagnóstico automático".');
  } else {
    avisar('Abre la práctica desde su cuestionario del Aula Virtual.');
    return;
  }
  const m = await arrancarInterprete();
  if (m.tipo !== 'listo') {
    setEstado('No se pudo iniciar el intérprete de Python: ' + m.mensaje);
    registrar('carga', 'error: ' + m.mensaje, 'fallo');
    return;
  }
  const segundos = (performance.now() - estado.inicioPagina) / 1000;
  estado.version = m.version;
  estado.metricas.carga = segundos;
  registrar('carga', segundos.toFixed(1) + ' s (Pyodide ' + m.segundos.toFixed(1) + ' s)', umbral(segundos, 15, 45));
  estado.listo = true;
  bloquearBotones(false);
  setEstado('Entorno listo. Python ' + m.version + '.');
}

iniciar();
