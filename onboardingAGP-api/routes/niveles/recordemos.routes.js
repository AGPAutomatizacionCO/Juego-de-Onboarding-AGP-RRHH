const router = require("express").Router();
const ctrl = require("../../controllers/niveles/recordemos.controller");

// ✅ Obtener palabras/conceptos desde BD
router.get("/:nivelKey/palabras", ctrl.getPalabrasRecordemos);
// ✅ estándar
router.get("/:nivelKey", ctrl.getRecordemosByNivel);
router.post("/:nivelKey/resultado", ctrl.guardarResultado);

module.exports = router;