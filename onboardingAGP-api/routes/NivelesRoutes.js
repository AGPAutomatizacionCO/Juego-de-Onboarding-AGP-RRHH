const express = require("express");
const router = express.Router();

const lecturaRoutes = require("./niveles/lectura.routes");
const visualRoutes = require("./niveles/visual.routes");
const recordemosRoutes = require("./niveles/recordemos.routes");
const socialRoutes = require("./niveles/social.routes");
const evaluacionRoutes = require("./niveles/evaluacionFinal.routes");

router.use("/lectura", lecturaRoutes);
router.use("/visual", visualRoutes);
router.use("/recordemos", recordemosRoutes);
router.use("/social", socialRoutes);
router.use("/evaluacionFinal", evaluacionRoutes);

module.exports = router;
