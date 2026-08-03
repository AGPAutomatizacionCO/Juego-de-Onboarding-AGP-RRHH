// controllers/niveles/lectura.controller.js
const LecturaModel = require("../../models/niveles/lectura.model");
const VisualModel  = require("../../models/niveles/visual.model");
const IslasModel   = require("../../models/IslasModel");

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ✅ Limpia un valor de BD: null / undefined / "NULL" / "" → ""
const clean = (v) => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.toLowerCase() === "null" ? "" : s;
};

exports.getLecturaByNivel = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);

    if (!nivelKey) {
      return res.status(400).json({ success: false, message: "nivelKey inválido" });
    }

    const rows = await LecturaModel.getLecturasByNivel(nivelKey);
    console.log(`📦 rows recibidas del model: ${rows.length}`);

    const items = (rows || []).map((r) => {
      // ── Recopilar opciones (respuesta1..10), ignorando nulos y "NULL" ──
      const respuestas = [
        r.respuesta1,  r.respuesta2,  r.respuesta3,
        r.respuesta4,  r.respuesta5,  r.respuesta6,
        r.respuesta7,  r.respuesta8,  r.respuesta9,
        r.respuesta10,
      ]
        .map(clean)
        .filter(Boolean);

      // ── LECTURA_CORRECTA viene como TEXTO ("Reproceso"), NO como índice ──
      // Si fuera índice numérico (ej: "3") también lo manejamos como fallback
      let correctaTexto = clean(r.respuestaCorrecta);

      const idx = toInt(correctaTexto);
      if (idx && idx >= 1 && idx <= 10) {
        // Era un índice numérico → buscar el texto en las respuestas
        correctaTexto = clean(r[`respuesta${idx}`]);
      }
      // Si ya era texto directo (ej: "Reproceso"), correctaTexto ya está bien

      // Asegurarse de que la correcta esté en el banco de opciones
      if (correctaTexto && !respuestas.includes(correctaTexto)) {
        respuestas.push(correctaTexto);
      }

      return {
        id:         Number(r.id),
        antes:      clean(r.pregunta),
        despues:    clean(r.despues),
        correcta:   correctaTexto,
        respuestas,
      };
    });

    console.log("📦 items mapeados:", JSON.stringify(items));

    return res.json({
      success: true,
      data: { nivelKey, items },
    });
  } catch (e) {
    console.error("getLecturaByNivel error:", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo lecturas del nivel",
    });
  }
};

// ✅ POST /api/niveles/lectura/:nivelKey/resultado
exports.guardarResultadoLectura = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);
    const { usuarioKey, puntaje, aprobado, livesLeft, correctas, total } = req.body || {};

    if (!nivelKey) return res.status(400).json({ message: "nivelKey inválido" });

    const uk = toInt(usuarioKey);
    if (!uk) return res.status(400).json({ message: "usuarioKey inválido" });

    const p = toInt(puntaje);
    if (p === null || p < 0) return res.status(400).json({ message: "puntaje inválido" });

    const aprobadoBool = Boolean(aprobado);

    await VisualModel.upsertResultadoNivel({
      usuarioKey:  uk,
      nivelKey,
      puntaje:     p,
      aprobado:    aprobadoBool,
      mismatches:  0,
      livesLeft:   toInt(livesLeft) ?? 0,
      correctas:   toInt(correctas) ?? null,
      total:       toInt(total) ?? null,
    });

    let progresoActualizado = null;
    if (aprobadoBool) {
      try {
        progresoActualizado = await IslasModel.actualizarProgresoNivelSiMayor(uk, nivelKey + 1);
      } catch (e) {
        console.error("🔥 Error actualizando progreso nivel lectura:", e);
      }
    }

    return res.json({
      success: true,
      aprobado: aprobadoBool,
      nextNivel: aprobadoBool ? nivelKey + 1 : null,
      progresoActualizado,
    });
  } catch (e) {
    console.error("guardarResultadoLectura error:", e);
    return res.status(500).json({ message: "Error guardando resultado de lectura" });
  }
};