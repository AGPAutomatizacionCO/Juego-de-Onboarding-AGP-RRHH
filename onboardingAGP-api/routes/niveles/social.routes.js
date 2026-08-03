const router = require("express").Router();
const ctrl = require("../../controllers/niveles/social.controller");

// ✅ Obtener casos desde la BD
router.get("/:nivelKey/casos", ctrl.getCasosSocial);

// ✅ Guardar resultado - ruta nueva (sigue el mismo patrón)
router.post("/:nivelKey/resultado", ctrl.completar);

module.exports = router;
