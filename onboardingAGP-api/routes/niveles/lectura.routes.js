const express = require("express");
const router = express.Router();

const {
  getLecturaByNivel,
  guardarResultadoLectura,
} = require("../../controllers/niveles/lectura.controller");

router.get("/:nivelKey", getLecturaByNivel);
router.post("/:nivelKey/resultado", guardarResultadoLectura); // ✅ NUEVO

module.exports = router;
