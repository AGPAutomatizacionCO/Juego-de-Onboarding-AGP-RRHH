const { completarRecordemos, obtenerPalabrasRecordemos } = require("../../models/niveles/recordemos.model");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// 🔥 GET para obtener las palabras/conceptos desde la BD
exports.getPalabrasRecordemos = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);
    const islaKey = toInt(req.query.islaKey) || 1;

    if (!nivelKey) {
      return res.status(400).json({
        success: false,
        message: "nivelKey inválido",
      });
    }

    // Obtener palabras desde la BD
    const palabras = await obtenerPalabrasRecordemos(nivelKey);

    // Si no hay datos en BD, devolver fallback vacío para que el frontend muestre mensaje
    if (!palabras || palabras.length === 0) {
      return res.json({
        success: true,
        data: {
          nivelKey,
          palabras: [],
          message: "No hay palabras en la base de datos para este nivel",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        nivelKey,
        palabras: palabras,
      },
    });
  } catch (e) {
    console.error("getPalabrasRecordemos", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo palabras de Recordemos",
    });
  }
};

// 🔥 GET (aunque uses palabras locales, mantenemos estructura)
exports.getRecordemosByNivel = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);

    if (!nivelKey) {
      return res.status(400).json({
        success: false,
        message: "nivelKey inválido",
      });
    }

    // 👉 Puedes luego traer esto de BD si quieres
    return res.json({
      success: true,
      data: {
        nivelKey,
        message: "Nivel recordemos listo",
      },
    });
  } catch (e) {
    console.error("getRecordemosByNivel", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo nivel recordemos",
    });
  }
};

// 🔥 POST estándar (igual que lectura)
exports.guardarResultado = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);
    const { usuarioKey, islaKey, livesLeft } = req.body || {};

    if (!nivelKey) return res.status(400).json({ message: "nivelKey inválido" });

    const uk = toInt(usuarioKey);
    if (!uk) return res.status(400).json({ message: "usuarioKey inválido" });

    const isla = toInt(islaKey) || 1;

    const data = await completarRecordemos({
      usuarioKey: uk,
      islaKey: isla,
      nivelKey,
      livesLeft: toInt(livesLeft),
    });

    return res.json({
      success: true,
      aprobado: true,
      nextNivel: nivelKey + 1,
      data,
    });
  } catch (e) {
    console.error("guardarResultado Recordemos", e);
    return res.status(500).json({
      success: false,
      message: "Error guardando resultado Recordemos",
    });
  }
};