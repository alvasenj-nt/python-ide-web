"""Comprobaciones visibles: el laboratorio muestra la primera línea del
docstring de cada test y, si no se cumple, el mensaje de la aserción."""

import tempfile
import unittest
from pathlib import Path

import main


def crear(base, ruta, contenido=None):
    fichero = base / ruta
    fichero.parent.mkdir(parents=True, exist_ok=True)
    fichero.write_text(ruta if contenido is None else contenido, encoding="utf-8")
    return fichero


def relativas(rutas, base):
    return sorted(Path(r).relative_to(base).as_posix() for r in rutas)


def ficheros(carpeta):
    return sorted(p.relative_to(carpeta).as_posix() for p in carpeta.rglob("*") if p.is_file())


class Comprobaciones(unittest.TestCase):
    longMessage = False

    def setUp(self):
        self._tmp = tempfile.TemporaryDirectory()
        self.base = Path(self._tmp.name)
        self.entrada = self.base / "descargas"
        self.salida = self.base / "historico"
        self.entrada.mkdir()

    def tearDown(self):
        self._tmp.cleanup()

    def corta(self, ruta):
        """Ruta relativa a la carpeta de la prueba, para los mensajes."""
        try:
            return Path(ruta).relative_to(self.base).as_posix()
        except (TypeError, ValueError):
            return repr(ruta)

    def test_01_analiza_un_nombre_valido(self):
        """analizar_nombre() extrae magnitud, estación, año, mes y día de un nombre válido"""
        r = main.analizar_nombre("temp_RETIRO_20260915.csv")
        esperado = {"magnitud": "temp", "estacion": "RETIRO", "ano": "2026", "mes": "09", "dia": "15"}
        self.assertEqual(r, esperado, 'analizar_nombre("temp_RETIRO_20260915.csv") ha devuelto %r' % (r,))

    def test_02_rechaza_nombres_no_validos(self):
        """analizar_nombre() devuelve None con los nombres que no cumplen el formato"""
        self.assertIsNotNone(main.analizar_nombre("lluvia_M05_20261002.csv"),
                             'analizar_nombre() aún no reconoce los nombres válidos, como "lluvia_M05_20261002.csv"')
        for nombre in ("temp_retiro_20260915.csv", "temp_RETIRO_2026-09-15.csv", "temp_RETIRO_20260915.csv.bak",
                       "leeme.txt"):
            r = main.analizar_nombre(nombre)
            self.assertIsNone(r, 'analizar_nombre("%s") ha devuelto %r' % (nombre, r))

    def test_03_busca_en_todas_las_subcarpetas(self):
        """buscar_ficheros() devuelve una lista con los ficheros de la carpeta y de todas sus subcarpetas"""
        for ruta in ("a.csv", "zona/b.csv", "zona/manual/2026/c.txt"):
            crear(self.entrada, ruta)
        r = main.buscar_ficheros(self.entrada)
        self.assertIsInstance(r, list, "buscar_ficheros() no devuelve una lista, sino %s" % type(r).__name__)
        self.assertEqual(relativas(r, self.entrada), ["a.csv", "zona/b.csv", "zona/manual/2026/c.txt"],
                         "buscar_ficheros() ha encontrado %s" % relativas(r, self.entrada))

    def test_04_busca_sin_incluir_carpetas(self):
        """buscar_ficheros() no incluye las carpetas"""
        crear(self.entrada, "zona/b.csv")
        (self.entrada / "zona" / "vacia").mkdir()
        r = relativas(main.buscar_ficheros(self.entrada), self.entrada)
        self.assertEqual(r, ["zona/b.csv"], "buscar_ficheros() ha devuelto %s" % self.corta(r))

    def test_05_ruta_destino(self):
        """ruta_destino() construye salida/<estación>/<AAAA>/<MM>/<DD>_<magnitud>.csv"""
        datos = {"magnitud": "lluvia", "estacion": "M05", "ano": "2026", "mes": "10", "dia": "02"}
        r = main.ruta_destino(self.salida, datos)
        esperado = self.salida / "M05" / "2026" / "10" / "02_lluvia.csv"
        self.assertEqual(Path(r), esperado, "ruta_destino() ha devuelto %s" % self.corta(r))

    def test_06_ruta_libre_sin_ocupar(self):
        """ruta_libre() devuelve la misma ruta si no existe ningún fichero en ella"""
        destino = self.salida / "RETIRO" / "2026" / "09" / "15_temp.csv"
        r = main.ruta_libre(destino)
        self.assertIsNotNone(r, "ruta_libre() ha devuelto None")
        self.assertEqual(Path(r), destino, "ruta_libre() ha devuelto %s" % self.corta(r))

    def test_07_ruta_libre_con_versiones(self):
        """ruta_libre() añade _v1, _v2... antes de la extensión si el nombre está ocupado"""
        destino = crear(self.salida, "RETIRO/2026/09/15_temp.csv")
        r = main.ruta_libre(destino)
        self.assertIsNotNone(r, "ruta_libre() ha devuelto None")
        self.assertEqual(Path(r), destino.with_name("15_temp_v1.csv"),
                         "con 15_temp.csv ocupado, ruta_libre() ha devuelto %s" % self.corta(r))
        crear(self.salida, "RETIRO/2026/09/15_temp_v1.csv")
        r = main.ruta_libre(destino)
        self.assertIsNotNone(r, "ruta_libre() ha devuelto None")
        self.assertEqual(Path(r), destino.with_name("15_temp_v2.csv"),
                         "con 15_temp.csv y 15_temp_v1.csv ocupados, ruta_libre() ha devuelto %s" % self.corta(r))

    def test_08_organizar_mueve_los_validos(self):
        """organizar() mueve cada fichero válido a su sitio en el histórico, creando las carpetas"""
        crear(self.entrada, "zona_centro/temp_RETIRO_20260915.csv")
        crear(self.entrada, "zona_sur/manual/lluvia_M05_20261002.csv")
        main.organizar(self.entrada, self.salida)
        self.assertEqual(ficheros(self.salida), ["M05/2026/10/02_lluvia.csv", "RETIRO/2026/09/15_temp.csv"],
                         "en el histórico hay: %s" % ficheros(self.salida))
        self.assertEqual(ficheros(self.entrada), [], "en la descarga quedan: %s" % ficheros(self.entrada))

    def test_09_organizar_deja_los_no_validos(self):
        """organizar() mueve solo los ficheros de datos y deja los demás en su sitio"""
        no_validos = ["leeme.txt", "zona/temp_retiro_20260915.csv", "zona/temp_RETIRO_20260915.csv.bak"]
        for ruta in no_validos:
            crear(self.entrada, ruta)
        crear(self.entrada, "zona/lluvia_M05_20261002.csv")
        main.organizar(self.entrada, self.salida)
        self.assertEqual(ficheros(self.entrada), sorted(no_validos), "en la descarga quedan: %s" % ficheros(self.entrada))

    def test_10_organizar_no_pierde_datos(self):
        """organizar() no pierde datos cuando un nombre coincide con otro de la descarga o del histórico"""
        crear(self.salida, "RETIRO/2026/09/15_temp.csv", "noche anterior")
        crear(self.entrada, "a/temp_RETIRO_20260915.csv", "copia a")
        crear(self.entrada, "b/temp_RETIRO_20260915.csv", "copia b")
        main.organizar(self.entrada, self.salida)
        mes = self.salida / "RETIRO" / "2026" / "09"
        contenidos = sorted(p.read_text(encoding="utf-8") for p in mes.iterdir()) if mes.is_dir() else []
        self.assertEqual(contenidos, ["copia a", "copia b", "noche anterior"],
                         "en RETIRO/2026/09/ hay: %s" % ficheros(self.salida))
        self.assertEqual((mes / "15_temp.csv").read_text(encoding="utf-8"), "noche anterior",
                         "se ha sobrescrito el fichero que ya estaba en el histórico")

    def test_11_organizar_devuelve_los_movidos(self):
        """organizar() devuelve el número de ficheros movidos"""
        for ruta in ("temp_RETIRO_20260915.csv", "x/temp_RETIRO_20260915.csv", "x/leeme.txt"):
            crear(self.entrada, ruta)
        r = main.organizar(self.entrada, self.salida)
        self.assertEqual(r, 2, "con 2 ficheros válidos y 1 no válido, organizar() ha devuelto %r" % (r,))
