const express = require("express");
const router = express.Router();
const IslasController = require("../controllers/IslasController");

// ✅ primero rutas específicas
router.get("/catalogo", IslasController.getCatalogoIslas);
router.get("/:islaKey/niveles", IslasController.getNivelesPorIsla);
router.get("/:usuarioKey/resultados", IslasController.getResultadosPorUsuario);

// ✅ Avanzar isla del usuario
router.post("/:usuarioKey/avanzar", IslasController.avanzarIsla);

// ✅ después la ruta dinámica del usuario
router.get("/:usuarioKey", IslasController.getEstadoIslasPorUsuario);

module.exports = router;