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

import re
import shutil
from pathlib import Path

# Patrón de un nombre de fichero de datos válido, con un grupo por cada parte
PATRON = r"^(?P<magnitud>[a-z]+)_(?P<estacion>[A-Z0-9]+)_(?P<ano>\d{4})(?P<mes>\d{2})(?P<dia>\d{2})\.csv$"

# Descarga de prueba que prepara el programa principal (no la modifiques).
# CARPETAS son las carpetas que se crean, en orden; DESCARGA, los ficheros
# que han llegado esta noche, y HISTORICO_PREVIO, los que ya había en el
# histórico de una noche anterior.
CARPETAS = [
    "descargas",
    "descargas/zona_centro",
    "descargas/zona_centro/reintento",
    "descargas/zona_sur",
    "descargas/zona_sur/manual",
    "descargas/zona_sur/manual/2026",
    "descargas/zona_sur/manual/2026/octubre",
    "historico",
    "historico/RETIRO",
    "historico/RETIRO/2026",
    "historico/RETIRO/2026/09",
]
DESCARGA = [
    "descargas/zona_centro/temp_RETIRO_20260915.csv",
    "descargas/zona_centro/lluvia_RETIRO_20260915.csv",
    "descargas/zona_centro/reintento/temp_RETIRO_20260915.csv",
    "descargas/zona_sur/temp_M05_20261002.csv",
    "descargas/zona_sur/viento_M05_20261002.csv",
    "descargas/zona_sur/manual/2026/octubre/temp_GETAFE3_20261031.csv",
    "descargas/zona_sur/viento_M05_20261002.csv.bak",
    "descargas/zona_centro/temp_RETIRO_2026-09-15.csv",
    "descargas/temp_retiro_20260915.csv",
    "descargas/leeme.txt",
]
HISTORICO_PREVIO = [
    "historico/RETIRO/2026/09/15_lluvia.csv",
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
    return None


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
# Crea las carpetas y los ficheros de la descarga de prueba (cada ejecución
# del laboratorio empieza con la carpeta de trabajo vacía) y después:
# 1. Muestra qué devuelven analizar_nombre() y ruta_destino() con cada
#    fichero que ha llegado.
# 2. Llama a organizar() y muestra cuántos ficheros ha movido.
# 3. y 4. Muestra lo que hay en historico/ y en descargas/, buscándolo con
#    tu función buscar_ficheros().
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    descargas = Path("descargas")
    historico = Path("historico")

    for carpeta in CARPETAS:
        Path(carpeta).mkdir()
    for ruta in DESCARGA + HISTORICO_PREVIO:
        with open(ruta, "w", encoding="utf-8") as f:
            f.write("hora;valor\n00:00;14.2\n")
            f.write(f"origen;{ruta}\n")

    print("1. Destino de cada fichero que ha llegado")
    for ruta in DESCARGA:
        nombre = ruta.split("/")[-1]
        datos = analizar_nombre(nombre)
        if datos is None:
            print(f"   {nombre} -> no es un fichero de datos")
        else:
            print(f"   {nombre} -> {ruta_destino(historico, datos)}")

    print()
    print("2. Organización del histórico")
    movidos = organizar(descargas, historico)
    print(f"   organizar() ha movido {movidos} ficheros")

    print()
    print("3. Contenido de historico/ después de organizar")
    for fichero in buscar_ficheros(historico):
        print(f"   {fichero}")

    print()
    print("4. Ficheros que quedan en descargas/")
    for fichero in buscar_ficheros(descargas):
        print(f"   {fichero}")
