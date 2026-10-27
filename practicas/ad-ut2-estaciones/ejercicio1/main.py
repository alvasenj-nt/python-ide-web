"""
Noche de descargas del ejercicio 1 (solo lectura).

Prepara en la carpeta de trabajo una descarga de prueba: descargas/ con
ficheros de datos de tres estaciones repartidos en varias subcarpetas (dos de
ellos con el mismo nombre en carpetas distintas) y algunos ficheros que no
son datos. Además, historico/ ya contiene un fichero de una noche anterior.
Cada fichero tiene un contenido distinto.

Después llama a organizar(descargas, historico), muestra lo que devuelve y
el contenido final de las dos carpetas, y comprueba que ningún contenido se
ha perdido ni duplicado.

Cada ejecución empieza desde cero: los ficheros de la ejecución anterior no
se conservan.
"""

import os
from pathlib import Path

from organizar import organizar

DESCARGA = [
    "zona_centro/temp_RETIRO_20260915.csv",
    "zona_centro/lluvia_RETIRO_20260915.csv",
    "zona_centro/reintento/temp_RETIRO_20260915.csv",
    "zona_sur/temp_M05_20261002.csv",
    "zona_sur/viento_M05_20261002.csv",
    "zona_sur/manual/2026/octubre/temp_GETAFE3_20261031.csv",
    "zona_sur/viento_M05_20261002.csv.bak",
    "zona_centro/temp_RETIRO_2026-09-15.csv",
    "temp_retiro_20260915.csv",
    "leeme.txt",
]
HISTORICO_PREVIO = ["RETIRO/2026/09/15_lluvia.csv"]


def crear(base, ruta):
    fichero = base / ruta
    fichero.parent.mkdir(parents=True, exist_ok=True)
    fichero.write_text("hora;valor;origen\n00:00;14.2;" + base.name + "/" + ruta + "\n", encoding="utf-8")


def listar(carpeta):
    rutas = []
    for raiz, _, nombres in os.walk(carpeta):
        for nombre in nombres:
            rutas.append(Path(raiz, nombre).as_posix())
    return sorted(rutas)


def contenidos(*carpetas):
    return sorted(Path(r).read_text(encoding="utf-8") for c in carpetas for r in listar(c))


descargas = Path("descargas")
historico = Path("historico")
for ruta in DESCARGA:
    crear(descargas, ruta)
for ruta in HISTORICO_PREVIO:
    crear(historico, ruta)

antes = contenidos(descargas, historico)
print("Ficheros en descargas/:", len(listar(descargas)))
print("Ficheros en historico/:", len(listar(historico)))
print()

movidos = organizar(descargas, historico)
print("organizar() ha devuelto:", movidos)
print()

print("Contenido de historico/:")
for ruta in listar(historico):
    print("  " + ruta)
print("Quedan en descargas/:")
for ruta in listar(descargas):
    print("  " + ruta)
print()

despues = contenidos(descargas, historico)
print("Ficheros antes:", len(antes), "| después:", len(despues))
print("Datos conservados:", "sí" if antes == despues else "NO")
