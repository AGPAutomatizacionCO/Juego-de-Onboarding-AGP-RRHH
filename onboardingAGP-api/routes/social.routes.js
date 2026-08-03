const router = require("express").Router();
const ctrl = require("../../controllers/niveles/social.controller");

// POST /api/niveles/social/completar
router.post("/completar", ctrl.completar);

module.exports = router;
