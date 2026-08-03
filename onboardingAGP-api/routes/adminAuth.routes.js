const express = require("express");
const router = express.Router();

const adminAuthController = require("../controllers/adminAuth.controller");

// LOGIN (queda accesible por /admin/auth/login)
router.post("/login", adminAuthController.login);

// EDITOR (queda accesible por /api/admin/niveles/:nivelKey/editor)
router.get("/niveles/:nivelKey/editor", adminAuthController.getNivelEditor);
router.put("/niveles/:nivelKey/editor", adminAuthController.updateNivelEditor);

// RESULTADOS (queda accesible por /api/admin/resultados/detalle)
router.get("/resultados/detalle", adminAuthController.getResultadosDetalle);

// RESULTADOS RESUMEN (queda accesible por /api/admin/resultados/resumen)
router.get("/resultados/resumen", adminAuthController.getResultadosResumen);

// REPORTE COMPLETO (cohortes + participantes + islas/niveles)
router.get("/reportes/completo", adminAuthController.getReporteCompleto);

module.exports = router;
