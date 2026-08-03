const express = require("express");
const router = express.Router();
const UsuarioController = require("../controllers/UsuarioController");

// Registro
router.post("/register", UsuarioController.register);

// Login (por cédula)
router.post("/login", UsuarioController.login);

// Obtener usuario por key
router.get("/:usuarioKey", UsuarioController.getById);

module.exports = router;

