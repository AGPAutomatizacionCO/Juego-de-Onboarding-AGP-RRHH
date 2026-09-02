const express = require("express");
const router = express.Router();

const {
  getPreguntasEvaluacion,
  upsertResultado,
  getResultado,
  getPodio,
  getPodioIsla,
  getResultadoIsla,
  consumirReintento,
} = require("../../controllers/niveles/evaluacionFinal.controller");

// ✅ Rutas específicas PRIMERO (antes de las dinámicas)
router.post("/resultado", upsertResultado);
router.post("/reintento/consumir", consumirReintento);
router.get("/podio", getPodio);
router.get("/podio-isla", getPodioIsla);
router.get("/resultado/:usuarioKey/:nivelKey", getResultado);
router.get("/resultado/isla/:usuarioKey/:islaKey", getResultadoIsla);

// ✅ Rutas dinámicas AL FINAL
router.get("/:nivelKey/preguntas", getPreguntasEvaluacion);

module.exports = router;