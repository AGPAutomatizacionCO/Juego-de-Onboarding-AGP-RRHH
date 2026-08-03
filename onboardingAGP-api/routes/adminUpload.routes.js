const express = require("express");
const multer = require("multer");
const path = require("path");

const router = express.Router();

/* =====================
   CONFIGURACIÓN MULTER
===================== */

// dónde se guarda el archivo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, "..", "uploads"));
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `visual_${Date.now()}${ext}`;
    cb(null, name);
  },
});

// solo imágenes
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Solo se permiten imágenes"), false);
  }
};

const upload = multer({ storage, fileFilter });

/* =====================
   RUTA UPLOAD
   POST /api/admin/uploads/image
===================== */

router.post("/image", upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No se recibió ninguna imagen",
      });
    }

    return res.json({
      success: true,
      filename: req.file.filename,
      url: `/uploads/${req.file.filename}`,
    });
  } catch (e) {
    console.error("upload image", e);
    return res.status(500).json({
      success: false,
      message: "Error subiendo la imagen",
    });
  }
});

module.exports = router;
