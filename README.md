# Laboratorio Python AD

Entorno de programación Python que funciona en el navegador, sin servidor, para prácticas y exámenes de Acceso a datos (2º DAM, IES Pío Baroja).

- Ejecuta CPython 3.13 compilado a WebAssembly ([Pyodide](https://pyodide.org) 0.28.3, cargado desde jsDelivr) dentro de un Web Worker. "Terminar" detiene un bucle infinito terminando el worker y arranca otro intérprete en un par de segundos, sin recargar la página.
- Cada ejecución parte de una carpeta vacía con los archivos del ejercicio: `pathlib`, `shutil`, `open`, `csv` y `json` trabajan sobre el sistema de ficheros virtual del navegador.
- Los errores muestran la traza (`Traceback`) en la vista Console, limitada a los archivos del ejercicio, y la vista Problems indica el archivo y la línea.
- No muestra tests: la corrección se hace fuera, con tests ocultos en un Python real.
- Entrega por cuestionario: el botón "Copiar código" copia los archivos editables del ejercicio abierto, cada uno tras su marca `# ===== Archivo: <carpeta>/<archivo> =====`, y añade al final una línea `# Informe del entorno (no borrar): ...` con métricas del entorno. Para una tarea sin SEB, abrir el laboratorio con `?entrega=zip` muestra además "Descargar entrega" (`.zip` del proyecto).
- Pensado para incrustarse en un cuestionario de Moodle con un `iframe` (`allowfullscreen` activa el botón "Pantalla completa").
- Abriendo la página con `?diagnostico` (con o sin `?p=`) aparece un diagnóstico para el profesor: carga del intérprete, errores con su línea, recarga de módulos propios, ficheros, rendimiento y recuperación tras un bucle infinito.

## Prácticas

Cada práctica es una carpeta `practicas/<id>/` con un manifiesto `practica.json`, y se abre con `?p=<id>`. Sin parámetro no se carga ninguna: cada práctica solo aparece en su cuestionario.

```json
{
  "esquema": 1,
  "id": "ad-ut2-estaciones",
  "version": 1,
  "titulo": "UT2 · Estaciones meteorológicas",
  "proyecto": "estaciones",
  "readme": "README.txt",
  "resultado": { "patron": "(Datos conservados|Descargas sin cambios): ([^ \n]+)", "texto": "$1: $2" },
  "ejercicios": [
    { "carpeta": "ejercicio1", "principal": "main.py",
      "archivos": [ { "nombre": "organizar.py", "editable": true },
                    { "nombre": "main.py", "editable": false } ] }
  ]
}
```

| Campo | Uso |
|---|---|
| `esquema` | Versión del formato del manifiesto. El motor admite todos los esquemas anteriores al suyo |
| `id` | Igual que el nombre de la carpeta: `<módulo>-ut<n>-<tema>` |
| `version` | Forma parte del prefijo del almacenamiento local (`<id>:v<version>:`) |
| `titulo`, `proyecto` | Subtítulo de la barra superior y nombre del proyecto en el explorador |
| `readme` | Archivo de texto de solo lectura en la raíz, abierto al entrar (opcional) |
| `resultado` | Patrón opcional sobre la salida del programa principal para el informe del entorno |
| `ejercicios` | Una carpeta por ejercicio, su programa principal y sus módulos `.py`, editables o de solo lectura |

Una práctica usada con alumnado no se modifica: un cambio posterior se publica como práctica nueva (`<id>-v2`). Cada publicación lleva la etiqueta Git `practica/<id>`.

## Publicación en GitHub Pages

Settings > Pages > Source: Deploy from a branch, rama `main`, carpeta `/ (root)`. Las rutas son relativas, así que funciona en cualquier subdirectorio.

## Estructura

| Ruta | Contenido |
|---|---|
| `index.html`, `css/`, `js/app.js` | Interfaz y lógica |
| `js/trabajador.js` | Web Worker con Pyodide: ejecución, salida en directo y traducción de errores |
| `practicas/<id>/` | Una práctica: manifiesto, `README.txt` y una carpeta por ejercicio |
| `pruebas/regresion.js`, `.github/workflows/` | Regresión de todas las prácticas, del diagnóstico y del laboratorio incrustado en otro origen, en Chrome sin interfaz, en cada push |

## Licencias de terceros

| Componente | Origen | Licencia |
|---|---|---|
| Pyodide 0.28.3 (cargado desde cdn.jsdelivr.net) | Pyodide | Mozilla Public License 2.0 |
| CodeMirror 5.65.16 (cargado desde cdnjs) | CodeMirror | MIT |
| JSZip 3.10.1 (cargado desde cdnjs) | Stuart Knightley | MIT o GPLv3 |
