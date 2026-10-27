"""
Auditoría del ejercicio 2 (solo lectura).

Prepara en la carpeta de trabajo una descarga de prueba: descargas/ con
ficheros de datos de tres estaciones repartidos en varias subcarpetas y
algunos ficheros que no son datos, de tamaños distintos.

Después llama a auditar(descargas, auditoria.txt), muestra lo que devuelve y
el informe escrito, y comprueba que la carpeta descargas/ ha quedado
exactamente igual que estaba.

Cada ejecución empieza desde cero: los ficheros de la ejecución anterior no
se conservan.
"""

import os
from pathlib import Path

from auditoria import auditar

DESCARGA = {
    "zona_norte/temp_ALCOBENDAS_20261026.csv": 6,
    "zona_norte/lluvia_ALCOBENDAS_20261026.csv": 3,
    "zona_norte/notas de campo.txt": 1,
    "zona_centro/temp_RETIRO_20261026.csv": 12,
    "zona_centro/reintento/temp_RETIRO_20261026.csv": 12,
    "zona_centro/temp_RETIRO_26-10-2026.csv": 12,
    "zona_sur/viento_M05_20261026.csv": 24,
    "zona_sur/viento_M05_20261026.csv.bak": 24,
    "Temp_M05_20261026.csv": 2,
    "leeme.txt": 1,
}


def crear(base, ruta, lineas):
    fichero = base / ruta
    fichero.parent.mkdir(parents=True, exist_ok=True)
    filas = ["%02d:00;%d.%d" % (h, 10 + h, h % 10) for h in range(lineas)]
    fichero.write_text("hora;valor\n" + "\n".join(filas) + "\n", encoding="utf-8")


def foto(carpeta):
    resultado = []
    for raiz, carpetas, nombres in os.walk(carpeta):
        for nombre in carpetas:
            resultado.append((Path(raiz, nombre).as_posix(), None))
        for nombre in nombres:
            resultado.append((Path(raiz, nombre).as_posix(), Path(raiz, nombre).read_bytes()))
    return sorted(resultado)


descargas = Path("descargas")
informe = Path("auditoria.txt")
for ruta, lineas in DESCARGA.items():
    crear(descargas, ruta, lineas)

antes = foto(descargas)
datos = auditar(descargas, informe)
print("auditar() ha devuelto:", datos)
print()

if informe.exists():
    print("Contenido de auditoria.txt:")
    print(informe.read_text(encoding="utf-8", errors="replace"))
else:
    print("No se ha creado auditoria.txt")
    print()

print("Descargas sin cambios:", "sí" if foto(descargas) == antes else "NO")
