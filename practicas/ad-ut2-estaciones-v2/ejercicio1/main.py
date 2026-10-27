"""
Práctica: el histórico de las estaciones meteorológicas.

La red de estaciones meteorológicas descarga cada noche los datos del día en
la carpeta descargas/. Cada estación deja un fichero CSV por magnitud medida,
pero los ficheros llegan repartidos en subcarpetas (por zona, por reintentos
de la descarga, por copias manuales...) y mezclados con ficheros que no son
datos. El equipo de sistemas necesita un histórico ordenado por estación y
fecha, y no puede permitirse perder ninguna medición.

Un fichero de datos válido es aquel cuyo nombre (solo el nombre, sin las
carpetas) cumple el patrón PATRON: <magnitud>_<estación>_<AAAAMMDD>.csv
  - magnitud: letras minúsculas (temp, lluvia, viento...)
  - estación: letras mayúsculas o dígitos (RETIRO, M05...)
  - fecha: año, mes y día, ocho dígitos seguidos
Válidos: temp_RETIRO_20260915.csv, lluvia_M05_20261002.csv
No válidos: temp_retiro_20260915.csv, temp_RETIRO_2026-09-15.csv,
temp_RETIRO_20260915.csv.bak, leeme.txt

Cada fichero válido se mueve al histórico, a la ruta
<histórico>/<estación>/<AAAA>/<MM>/<DD>_<magnitud>.csv. Por ejemplo,
descargas/zona_centro/temp_RETIRO_20260915.csv pasa a ser
historico/RETIRO/2026/09/15_temp.csv.

Qué tienes que hacer
--------------------
Escribe el cuerpo de las cinco funciones de este archivo: analizar_nombre(),
buscar_ficheros(), ruta_destino(), ruta_libre() y organizar(). El comentario
de cada una explica qué recibe, qué devuelve y qué pasos debe seguir.

- No cambies el nombre ni los parámetros de las funciones, ni lo que devuelve
  cada una. Puedes añadir las funciones auxiliares que necesites.
- No modifiques PATRON, los datos de prueba ni el bloque final
  if __name__ == "__main__": es el programa que prepara una descarga de
  prueba y llama a tus funciones cuando pulsas Ejecutar.
- Pulsa Comprobar para ver qué requisitos cumplen ya tus funciones.
"""

import os
import re
import shutil
from pathlib import Path

# Patrón de un nombre de fichero de datos válido, con un grupo por cada parte
PATRON = r"^(?P<magnitud>[a-z]+)_(?P<estacion>[A-Z0-9]+)_(?P<ano>\d{4})(?P<mes>\d{2})(?P<dia>\d{2})\.csv$"

# Descarga de prueba que prepara el programa principal (no la modifiques):
# rutas de los ficheros dentro de descargas/ y de los que ya había en
# historico/ de una noche anterior
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
HISTORICO_PREVIO = [
    "RETIRO/2026/09/15_lluvia.csv",
]


def analizar_nombre(nombre):
    """Comprueba si un nombre de fichero es de datos y extrae sus partes.

    Parámetros:
        nombre (str): solo el nombre del fichero, sin las carpetas.
            Por ejemplo, "temp_RETIRO_20260915.csv".

    Devuelve:
        dict: si el nombre cumple PATRON, un diccionario con las claves
            "magnitud", "estacion", "ano", "mes" y "dia", todas con cadenas.
            Para el ejemplo: {"magnitud": "temp", "estacion": "RETIRO",
            "ano": "2026", "mes": "09", "dia": "15"}.
        None: si el nombre no cumple PATRON.

    Lógica:
        1. Compara el nombre con PATRON.
        2. Si no coincide, devuelve None.
        3. Si coincide, devuelve el diccionario con las partes del nombre.
    """
    return None


def buscar_ficheros(entrada):
    """Localiza todos los ficheros de una carpeta y de sus subcarpetas.

    Parámetros:
        entrada (Path): carpeta donde buscar.

    Devuelve:
        list: lista de objetos Path con todos los ficheros que hay en entrada
            y en sus subcarpetas, a cualquier profundidad. Las carpetas no se
            incluyen. El orden no importa.

    Lógica:
        1. Recorre entrada y todas sus subcarpetas.
        2. Quédate solo con lo que sea un fichero.
        3. Devuelve una lista completa: organizar() va a mover ficheros
           mientras la recorre, así que la búsqueda tiene que haber
           terminado antes de empezar a moverlos.
    """
    return []


def ruta_destino(salida, datos):
    """Calcula dónde debe guardarse un fichero de datos en el histórico.

    Parámetros:
        salida (Path): carpeta raíz del histórico.
        datos (dict): el diccionario que devuelve analizar_nombre().

    Devuelve:
        Path: salida/<estación>/<AAAA>/<MM>/<DD>_<magnitud>.csv. Para el
            ejemplo de analizar_nombre(), salida/RETIRO/2026/09/15_temp.csv.

    Lógica:
        Construye la ruta a partir de salida y de las partes de datos. No
        crea carpetas ni comprueba si el fichero existe: de eso se ocupan
        ruta_libre() y organizar().
    """
    return salida


def ruta_libre(destino):
    """Evita sobrescribir un fichero que ya existe en el histórico.

    Parámetros:
        destino (Path): la ruta que devuelve ruta_destino().

    Devuelve:
        Path: destino, si no existe ningún fichero en esa ruta. Si existe, la
            misma ruta con _v1 antes de la extensión (15_temp.csv pasa a
            15_temp_v1.csv); si esa también existe, con _v2, y así
            sucesivamente hasta encontrar un nombre libre.

    Lógica:
        1. Si destino no existe, devuélvelo tal cual.
        2. Si existe, prueba en la misma carpeta con _v1, _v2... mientras el
           nombre esté ocupado.
        No crea ni mueve nada: solo calcula la ruta.
    """
    return destino


def organizar(entrada, salida):
    """Mueve los ficheros de datos de la descarga al histórico.

    Parámetros:
        entrada (Path): carpeta de descargas.
        salida (Path): carpeta raíz del histórico. Puede no existir todavía.

    Devuelve:
        int: número de ficheros movidos.

    Lógica:
        Para cada fichero que devuelve buscar_ficheros(entrada):
        1. Analiza su nombre (solo el nombre, sin las carpetas) con
           analizar_nombre(). Si no es válido, se queda donde está.
        2. Calcula su destino con ruta_destino() y ruta_libre().
        3. Crea la carpeta del destino y todas las que falten por encima.
        4. Mueve el fichero a su destino y cuéntalo.
        Lo que ya hubiera en salida no se modifica.
    """
    return 0


# ---------------------------------------------------------------------------
# Programa principal: no modifiques nada a partir de aquí.
#
# Prepara la descarga de prueba en la carpeta de trabajo (cada ejecución del
# laboratorio empieza con la carpeta vacía), prueba analizar_nombre() y
# ruta_destino() con cada nombre de la descarga, llama a organizar() y
# muestra el contenido final de las dos carpetas con buscar_ficheros().
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    descargas = Path("descargas")
    historico = Path("historico")
    for carpeta, rutas in ((descargas, DESCARGA), (historico, HISTORICO_PREVIO)):
        for ruta in rutas:
            fichero = os.path.join(carpeta, ruta)
            os.makedirs(os.path.dirname(fichero), exist_ok=True)
            with open(fichero, "w", encoding="utf-8") as f:
                f.write("hora;valor;origen\n00:00;14.2;" + carpeta.name + "/" + ruta + "\n")

    print("Destino de cada fichero de la descarga:")
    for ruta in DESCARGA:
        nombre = ruta.split("/")[-1]
        datos = analizar_nombre(nombre)
        destino = "no válido" if datos is None else Path(ruta_destino(historico, datos)).as_posix()
        print("  %-40s -> %s" % (nombre, destino))
    print()

    print("buscar_ficheros(descargas) encuentra %d ficheros" % len(buscar_ficheros(descargas)))
    print("organizar(descargas, historico) ha devuelto:", organizar(descargas, historico))
    for carpeta in (historico, descargas):
        print()
        print("Contenido de %s/:" % carpeta.name)
        for fichero in sorted(Path(f).as_posix() for f in buscar_ficheros(carpeta)):
            print("  " + fichero)
