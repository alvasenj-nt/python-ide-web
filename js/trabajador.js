'use strict';
// Intérprete de Python (Pyodide) en un Web Worker. A diferencia de una JVM
// en el hilo principal, un worker se puede terminar sin recargar la página:
// "Terminar" detiene un bucle infinito y el laboratorio arranca otro.
//
// Mensajes recibidos:
//   { tipo: 'iniciar', url }                 carga Pyodide desde url
//   { tipo: 'ejecutar', id, carpeta, archivos, principal }
// Mensajes enviados:
//   { tipo: 'listo', version, segundos } | { tipo: 'error-carga', mensaje }
//   { tipo: 'salida', id, flujo: 'out' | 'err', texto }
//   { tipo: 'fin', id, segundos, error: null | { tipo, mensaje, archivo, linea } }

let pyodide = null;
let ejecucion = null;

// Cada ejecución parte de una carpeta vacía /lab/<ejercicio>/ con los
// archivos del editor: lo que escribió la anterior no se arrastra. Los
// módulos del ejercicio se olvidan para que import cargue la versión nueva.
// La traza solo muestra los marcos de los archivos del ejercicio.
const EJECUTOR = `
import os, runpy, shutil, sys, traceback

def _lab_ejecutar(carpeta, archivos, principal):
    raiz = '/lab'
    if os.path.isdir(raiz):
        os.chdir('/')
        shutil.rmtree(raiz)
    trabajo = os.path.join(raiz, carpeta)
    os.makedirs(trabajo)
    for nombre, texto in archivos.items():
        with open(os.path.join(trabajo, nombre), 'w', encoding='utf-8') as f:
            f.write(texto)
        sys.modules.pop(nombre[:-3], None)
    os.chdir(trabajo)
    sys.path.insert(0, trabajo)
    try:
        runpy.run_path(os.path.join(trabajo, principal), run_name='__main__')
        return None
    except SystemExit as e:
        if e.code in (None, 0):
            return None
        return {'tipo': 'SystemExit', 'mensaje': 'SystemExit: ' + str(e.code), 'archivo': None, 'linea': None}
    except BaseException as e:
        return _lab_error(e, raiz, trabajo)
    finally:
        sys.stdout.flush()
        sys.path.remove(trabajo)

def _lab_error(e, raiz, trabajo):
    corto = lambda ruta: os.path.relpath(ruta, raiz) if ruta and ruta.startswith(trabajo) else ruta
    te = traceback.TracebackException.from_exception(e)
    propios = [m for m in te.stack if m.filename.startswith(trabajo)]
    lineas = []
    if propios:
        lineas.append('Traceback (most recent call last):')
        for m in propios:
            lineas.append('  File "%s", line %d, in %s' % (corto(m.filename), m.lineno, m.name))
            if m.line:
                lineas.append('    ' + m.line.strip())
    solo = ''.join(te.format_exception_only()).rstrip('\\n')
    if isinstance(e, SyntaxError) and e.filename:
        solo = solo.replace(e.filename, corto(e.filename))
    lineas.append(solo)
    sys.stderr.write('\\n'.join(lineas) + '\\n')
    sys.stderr.flush()
    if isinstance(e, SyntaxError) and e.filename and e.filename.startswith(trabajo):
        archivo, linea = corto(e.filename), e.lineno
    elif propios:
        archivo, linea = corto(propios[-1].filename), propios[-1].lineno
    else:
        archivo, linea = None, None
    return {'tipo': type(e).__name__, 'mensaje': solo.strip().split('\\n')[-1], 'archivo': archivo, 'linea': linea}
`;

function flujo(nombre) {
  const decodificador = new TextDecoder();
  return {
    write(bytes) {
      const texto = decodificador.decode(bytes, { stream: true });
      if (texto) self.postMessage({ tipo: 'salida', id: ejecucion, flujo: nombre, texto });
      return bytes.length;
    },
  };
}

async function iniciar(url) {
  const t0 = performance.now();
  try {
    importScripts(url + 'pyodide.js');
    pyodide = await loadPyodide({ indexURL: url });
    pyodide.setStdout(flujo('out'));
    pyodide.setStderr(flujo('err'));
    pyodide.setStdin({ error: true });
    pyodide.runPython(EJECUTOR);
    const version = pyodide.runPython('import sys; sys.version.split()[0]');
    self.postMessage({ tipo: 'listo', version, segundos: (performance.now() - t0) / 1000 });
  } catch (e) {
    self.postMessage({ tipo: 'error-carga', mensaje: String(e && e.message || e) });
  }
}

function ejecutar({ id, carpeta, archivos, principal }) {
  ejecucion = id;
  const t0 = performance.now();
  let error = null;
  const args = pyodide.toPy(archivos);
  try {
    const r = pyodide.globals.get('_lab_ejecutar')(carpeta, args, principal);
    error = r ? r.toJs({ dict_converter: Object.fromEntries }) : null;
    if (r && r.destroy) r.destroy();
  } catch (e) {
    error = { tipo: 'Interno', mensaje: String(e && e.message || e), archivo: null, linea: null };
  } finally {
    args.destroy();
  }
  self.postMessage({ tipo: 'fin', id, segundos: (performance.now() - t0) / 1000, error });
}

self.onmessage = (ev) => {
  const m = ev.data;
  if (m.tipo === 'iniciar') iniciar(m.url);
  else if (m.tipo === 'ejecutar') ejecutar(m);
};
