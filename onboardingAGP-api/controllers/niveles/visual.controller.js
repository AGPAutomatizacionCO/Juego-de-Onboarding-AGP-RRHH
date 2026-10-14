const VisualModel = require("../../models/niveles/visual.model");
const IslasModel = require("../../models/IslasModel"); // ✅ RUTA CORRECTA
const { APROBADO_MIN } = require("../../config/aprobado");

// GET /api/niveles/visual/:nivelKey
exports.getVisualByNivelKey = async (req, res) => {
  try {
    const nivelKey = Number(req.params.nivelKey);

    if (!Number.isFinite(nivelKey) || nivelKey <= 0) {
      return res.status(400).json({ message: "nivelKey inválido" });
    }

    const nivelInfo = await VisualModel.getNivelInfo(nivelKey); // título/descr
    const imagenes = await VisualModel.getVisualByNivelKey(nivelKey); // pares

    return res.json({
      success: true,
      data: {
        nivel: nivelInfo,
        imagenes,
      },
    });
  } catch (error) {
    console.error("🔥 getVisualByNivelKey:", error);
    return res.status(500).json({ message: "Error cargando nivel visual" });
  }
};

// POST /api/niveles/visual/:nivelKey/resultado
exports.guardarResultadoVisual = async (req, res) => {
  try {
    const nivelKey = Number(req.params.nivelKey);
    const { usuarioKey, puntaje, aprobado, mismatches, livesLeft } = req.body || {};

    if (!Number.isFinite(nivelKey) || nivelKey <= 0) {
      return res.status(400).json({ message: "nivelKey inválido" });
    }

    const uk = Number(usuarioKey);
    if (!Number.isFinite(uk) || uk <= 0) {
      return res.status(400).json({ message: "usuarioKey inválido" });
    }

    const p = Number(puntaje);
    if (!Number.isFinite(p) || p < 0) {
      return res.status(400).json({ message: "puntaje inválido" });
    }

    // Si el nivel no reporta errores/vidas se guarda NULL (no 0): el panel admin
    // no debe mostrar como real un dato que el jugador nunca envió.
    const mm = mismatches == null ? null : Number(mismatches);
    const ll = livesLeft == null ? null : Number(livesLeft);

    const aprobadoBool = Boolean(aprobado);

    // 1) Guarda resultado del nivel
    await VisualModel.upsertResultadoNivel({
      usuarioKey: uk,
      nivelKey,
      puntaje: p,
      aprobado: p >= APROBADO_MIN,   // criterio unico: 70 % o mas
      mismatches: Number.isFinite(mm) ? mm : null,
      livesLeft: Number.isFinite(ll) ? ll : null,
    });

    // 2) ✅ Si aprobó, sube progreso de nivel del usuario (sin bajar nunca)
    let progresoActualizado = null;
    if (aprobadoBool) {
      const nextNivel = nivelKey + 1; // Visual 1 -> Lectura 2
      try {
        progresoActualizado = await IslasModel.actualizarProgresoNivelSiMayor(uk, nextNivel);
      } catch (e) {
        console.error("🔥 Error actualizando progreso nivel:", e);
      }
    }

    return res.json({
      success: true,
      aprobado: aprobadoBool,
      nextNivel: aprobadoBool ? nivelKey + 1 : null,
      progresoActualizado,
    });
  } catch (error) {
    console.error("🔥 guardarResultadoVisual:", error);
    return res.status(500).json({ message: "Error guardando resultado del visual" });
  }
};
