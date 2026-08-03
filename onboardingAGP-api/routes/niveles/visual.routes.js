const express = require("express");
const router = express.Router();

const {
  getVisualByNivelKey,
  guardarResultadoVisual,
} = require("../../controllers/niveles/visual.controller");

// ✅ Traer data del nivel visual por nivelKey (imágenes/pares)
router.get("/:nivelKey", getVisualByNivelKey);

// ✅ Guardar resultado del visual (puntaje, aprobado, mismatches, livesLeft)
router.post("/:nivelKey/resultado", guardarResultadoVisual);

module.exports = router;
