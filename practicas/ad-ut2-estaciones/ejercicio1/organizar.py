"""
Ejercicio 1: el histórico de las estaciones meteorológicas.

La red de estaciones meteorológicas descarga cada noche los datos del día en
la carpeta descargas/. Cada estación deja un fichero CSV por magnitud medida,
pero los ficheros llegan repartidos en subcarpetas (por zona, por reintentos
de la descarga, por copias manuales...) y mezclados con ficheros que no son
datos. El equipo de sistemas necesita un histórico ordenado por estación y
fecha, y no puede permitirse perder ninguna medición.

Un fichero de datos válido es aquel cuyo nombre (solo el nombre, sin las
carpetas) cumple el patrón PATRON definido más abajo:
<magnitud>_<estación>_<AAAAMMDD>.csv
  - magnitud: letras minúsculas (temp, lluvia, viento...)
  - estación: letras mayúsculas o dígitos (RETIRO, M05...)
  - fecha: año, mes y día, ocho dígitos seguidos
Válidos: temp_RETIRO_20260915.csv, lluvia_M05_20261002.csv
No válidos: temp_retiro_20260915.csv, temp_RETIRO_2026-09-15.csv,
temp_RETIRO_20260915.csv.bak, leeme.txt

Tarea: implementa organizar(entrada, salida). Recibe dos rutas (objetos Path)
y debe:
1. Localizar los ficheros de datos válidos que haya en entrada y en todas sus
   subcarpetas, a cualquier profundidad.
2. Mover cada uno a salida/<estación>/<AAAA>/<MM>/ con el nombre
   <DD>_<magnitud>.csv, creando las carpetas que falten. Por ejemplo,
   descargas/zona_centro/temp_RETIRO_20260915.csv pasa a ser
   historico/RETIRO/2026/09/15_temp.csv.
3. No perder nunca un dato: si en el destino ya existe un fichero con ese
   nombre, el nuevo se guarda como <DD>_<magnitud>_v1.csv; si también
   existe, como _v2, y así sucesivamente. Lo que ya hubiera en salida no se
   modifica.
4. Dejar en su sitio todo lo demás.
5. Devolver el número de ficheros movidos.

No cambies el nombre, los parámetros ni el tipo de retorno de organizar(),
ni lo que hace. Puedes añadir las funciones auxiliares que necesites.
"""

PATRON = r"^(?P<magnitud>[a-z]+)_(?P<estacion>[A-Z0-9]+)_(?P<ano>\d{4})(?P<mes>\d{2})(?P<dia>\d{2})\.csv$"


def organizar(entrada, salida):
    """Mueve los ficheros de datos válidos de entrada al histórico de salida
    y devuelve cuántos ha movido."""
    return 0
