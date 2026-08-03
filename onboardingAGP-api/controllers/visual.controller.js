const { getVisualPairsByNivelKey } = require("../models/visual.model");

// GET /api/niveles/:nivelKey/visual
async function getVisualNivel(req, res) {
  try {
    const nivelKey = Number(req.params.nivelKey);
    if (!nivelKey || Number.isNaN(nivelKey)) {
      return res.status(400).json({ message: "nivelKey inválido" });
    }

    const rows = await getVisualPairsByNivelKey(nivelKey);

    // Normalizamos para el front: 8 pares => [{ pairId, fotoUrl, conceptoUrl }]
    const data = rows.map((r, idx) => ({
      pairId: idx + 1,
      fotoUrl: String(r.VISUAL_IMAGEN_FOTO || "").trim(),
      conceptoUrl: String(r.VISUAL_IMAGEN_CONCEPTO || "").trim(),
    }));

    return res.json({ success: true, data });
  } catch (err) {
    console.error("Error getVisualNivel:", err);
    return res.status(500).json({ message: "Error cargando nivel visual" });
  }
}

module.exports = { getVisualNivel };
