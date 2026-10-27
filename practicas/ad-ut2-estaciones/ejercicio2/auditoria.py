"""
Ejercicio 2: la auditoría de las descargas.

Antes de organizar las descargas de cada noche, el equipo de sistemas quiere
un informe de auditoría que diga cuántos datos han llegado y qué ficheros no
cumplen el formato. La auditoría solo observa: si moviera o tocara algo, la
organización posterior ya no partiría de lo que llegó de verdad.

Un fichero de datos válido sigue las mismas reglas que en el ejercicio 1: su
nombre (solo el nombre, sin las carpetas) cumple el patrón PATRON definido
más abajo, <magnitud>_<estación>_<AAAAMMDD>.csv.
Válidos: temp_RETIRO_20260915.csv, lluvia_M05_20261002.csv
No válidos: temp_retiro_20260915.csv, temp_RETIRO_2026-09-15.csv,
temp_RETIRO_20260915.csv.bak, leeme.txt

Tarea: implementa auditar(entrada, informe). Recibe dos rutas (objetos Path)
y debe:
1. Revisar todos los ficheros de entrada y de sus subcarpetas, a cualquier
   profundidad, sin mover, renombrar ni modificar ninguno.
2. Contar los ficheros de datos válidos y sumar su tamaño en bytes.
3. Reunir los nombres (solo el nombre, sin las carpetas) de los demás
   ficheros, los descartados, ordenados alfabéticamente.
4. Escribir el informe en la ruta informe, como fichero de texto en UTF-8,
   con este formato exacto (ejemplo con 4 ficheros válidos que suman 1536
   bytes y 2 descartados):

AUDITORÍA DE DESCARGAS
Ficheros válidos: 4
Volumen válido: 1536 bytes (1.50 KB)
Ficheros descartados: 2
- leeme.txt
- temp_RETIRO_2026-09-15.csv

   Los kilobytes son los bytes divididos entre 1024, con dos decimales y
   punto decimal. Si no hay descartados, el informe termina en la línea
   "Ficheros descartados: 0".
5. Devolver un diccionario con tres claves: "validos" (número de ficheros
   válidos), "bytes" (suma de sus tamaños) y "descartados" (la lista
   ordenada de nombres).

No cambies el nombre, los parámetros ni el tipo de retorno de auditar(), ni
lo que hace. Puedes añadir las funciones auxiliares que necesites.
"""

PATRON = r"^(?P<magnitud>[a-z]+)_(?P<estacion>[A-Z0-9]+)_(?P<ano>\d{4})(?P<mes>\d{2})(?P<dia>\d{2})\.csv$"


def auditar(entrada, informe):
    """Escribe el informe de auditoría de entrada y devuelve sus datos."""
    return {"validos": 0, "bytes": 0, "descartados": []}
