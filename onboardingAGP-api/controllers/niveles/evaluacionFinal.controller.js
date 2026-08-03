const { sql, getPool } = require("../../config/db");
const { obtenerPreguntasEvaluacion } = require("../../models/niveles/evaluacionFinal.model");

const TABLA_RESULTADOS = "dbo.Onboarding_Resultados_Nivel";
const TABLA_USUARIOS = "dbo.Onboarding_Usuarios_NEW";

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ✅ GET para obtener las preguntas de evaluación desde la BD
async function getPreguntasEvaluacion(req, res) {
  try {
    const nivelKey = toInt(req.params.nivelKey);

    if (!nivelKey) {
      return res.status(400).json({
        success: false,
        message: "nivelKey inválido",
      });
    }

    const preguntas = await obtenerPreguntasEvaluacion(nivelKey);

    if (!preguntas || preguntas.length === 0) {
      return res.json({
        success: true,
        data: {
          nivelKey,
          preguntas: [],
          message: "No hay preguntas en la base de datos para este nivel",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        nivelKey,
        preguntas: preguntas,
      },
    });
  } catch (e) {
    console.error("getPreguntasEvaluacion", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo preguntas de Evaluación",
    });
  }
};

exports.upsertResultado = async function upsertResultado(req, res) {
  try {
    const { usuarioKey, nivelKey, puntaje } = req.body;

    const uk = Number(usuarioKey);
    const nk = Number(nivelKey);
    const pct = Number(puntaje);

    if (!Number.isFinite(uk) || uk <= 0) {
      return res.status(400).json({ success: false, message: "usuarioKey inválido" });
    }
    if (!Number.isFinite(nk) || nk <= 0) {
      return res.status(400).json({ success: false, message: "nivelKey inválido" });
    }
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      return res.status(400).json({ success: false, message: "puntaje inválido" });
    }

    const pool = await getPool();

    const check = await pool
      .request()
      .input("usuarioKey", sql.Int, uk)
      .input("nivelKey", sql.Int, nk)
      .query(`
        SELECT TOP 1 1 AS ok
        FROM ${TABLA_RESULTADOS}
        WHERE USUARIO_KEY = @usuarioKey
          AND NIVELES_KEY = @nivelKey
      `);

    if (check.recordset?.length) {
      await pool
        .request()
        .input("usuarioKey", sql.Int, uk)
        .input("nivelKey", sql.Int, nk)
        .input("puntaje", sql.Int, pct)
        .query(`
          UPDATE ${TABLA_RESULTADOS}
          SET PUNTAJE = @puntaje,
              FECHA = GETDATE(),
              APROBADO = CASE WHEN @puntaje >= 80 THEN 1 ELSE 0 END
          WHERE USUARIO_KEY = @usuarioKey
            AND NIVELES_KEY = @nivelKey
        `);
    } else {
      await pool
        .request()
        .input("usuarioKey", sql.Int, uk)
        .input("nivelKey", sql.Int, nk)
        .input("puntaje", sql.Int, pct)
        .input("aprobado", sql.Bit, pct >= 80 ? 1 : 0)
        .query(`
          INSERT INTO ${TABLA_RESULTADOS}
            (USUARIO_KEY, NIVELES_KEY, PUNTAJE, APROBADO, FECHA)
          VALUES
            (@usuarioKey, @nivelKey, @puntaje, @aprobado, GETDATE())
        `);
    }

    // ✅ Si terminó la evaluación final del nivel 5, desbloquear siguiente isla
    if (nk >= 5) {
      // Actualizar progreso del usuario
      await pool
        .request()
        .input("usuarioKey", sql.Int, uk)
        .input("nuevoNivel", sql.Int, nk)
        .query(`
          UPDATE ${TABLA_USUARIOS}
          SET USUARIO_PROGRESO_NIVEL =
            CASE
              WHEN ISNULL(USUARIO_PROGRESO_NIVEL, 1) < @nuevoNivel THEN @nuevoNivel
              ELSE ISNULL(USUARIO_PROGRESO_NIVEL, 1)
            END
          WHERE USUARIO_KEY = @usuarioKey
        `);

      // Calcular siguiente isla (isla 1 = niveles 1-5, isla 2 = niveles 6-10, etc.)
      const siguienteIsla = Math.floor((nk - 1) / 5) + 1;
      
      await pool
        .request()
        .input("usuarioKey", sql.Int, uk)
        .input("siguienteIsla", sql.Int, siguienteIsla + 1)
        .query(`
          UPDATE ${TABLA_USUARIOS}
          SET USUARIO_PROGRESO_ISLA =
            CASE
              WHEN ISNULL(USUARIO_PROGRESO_ISLA, 1) < @siguienteIsla THEN @siguienteIsla
              ELSE ISNULL(USUARIO_PROGRESO_ISLA, 1)
            END
          WHERE USUARIO_KEY = @usuarioKey
        `);
    }

    return res.json({
      success: true,
      message: "Resultado guardado",
      data: {
        usuarioKey: uk,
        nivelKey: nk,
        puntaje: pct,
      },
    });
  } catch (e) {
    console.error("upsertResultado:", e);
    return res.status(500).json({
      success: false,
      message: "Error guardando resultado",
    });
  }
}

exports.getResultado = async function getResultado(req, res) {
  try {
    const { usuarioKey, nivelKey } = req.params;

    const pool = await getPool();

    const r = await pool
      .request()
      .input("usuarioKey", sql.Int, Number(usuarioKey))
      .input("nivelKey", sql.Int, Number(nivelKey))
      .query(`
        SELECT TOP 1 PUNTAJE, APROBADO, FECHA
        FROM ${TABLA_RESULTADOS}
        WHERE USUARIO_KEY = @usuarioKey
          AND NIVELES_KEY = @nivelKey
        ORDER BY FECHA DESC
      `);

    const row = r.recordset?.[0];

    return res.json({
      success: true,
      data: row ? {
        puntaje: row.PUNTAJE,
        aprobado: row.APROBADO === 1,
        fecha: row.FECHA,
      } : null,
    });
  } catch (e) {
    console.error("getResultado:", e);
    return res.status(500).json({
      success: false,
      message: "Error consultando resultado",
    });
  }
}

exports.getPodio = async function getPodio(req, res) {
  try {
    const { nivelKey, numeroOnboarding } = req.query; // ← AGREGAR numeroOnboarding
    if (!nivelKey) {
      return res.status(400).json({ success: false, message: "Falta nivelKey" });
    }
    if (!numeroOnboarding) {
      return res.status(400).json({ success: false, message: "Falta numeroOnboarding" });
    }
    const { getPodioAllUsers } = require("../../models/niveles/evaluacionFinal.model");
    const rows = await getPodioAllUsers({
      nivelKey: Number(nivelKey),
      numeroOnboarding: Number(numeroOnboarding), // ← AGREGAR
    });
    return res.json({ success: true, data: rows });
  } catch (e) {
    console.error("getPodio:", e);
    return res.status(500).json({ success: false, message: "Error consultando podio" });
  }
}


exports.getResultadoIsla = async function getResultadoIsla(req, res) {
  try {
    const { usuarioKey, islaKey } = req.params;

    const pool = await getPool();

    // Calcular rango de niveles para la isla
    const nivelMin = (islaKey - 1) * 5 + 1;
    const nivelMax = islaKey * 5;

    // Obtener promedio de los últimos intentos de cada nivel de la isla
    const r = await pool
      .request()
      .input("usuarioKey", sql.Int, Number(usuarioKey))
      .input("nivelMin", sql.Int, nivelMin)
      .input("nivelMax", sql.Int, nivelMax)
      .query(`
        SELECT AVG(CAST(PUNTAJE AS FLOAT)) as promedio
        FROM ${TABLA_RESULTADOS} r1
        WHERE r1.USUARIO_KEY = @usuarioKey
          AND r1.NIVELES_KEY BETWEEN @nivelMin AND @nivelMax
          AND r1.FECHA = (
            SELECT MAX(r2.FECHA)
            FROM ${TABLA_RESULTADOS} r2
            WHERE r2.USUARIO_KEY = r1.USUARIO_KEY
              AND r2.NIVELES_KEY = r1.NIVELES_KEY
          )
      `);

    const promedio = r.recordset?.[0]?.promedio;

    return res.json({
      success: true,
      data: promedio != null ? {
        porcentaje: Math.round(promedio),
        aprobado: promedio >= 80,
      } : null,
    });
  } catch (e) {
    console.error("getResultadoIsla:", e);
    return res.status(500).json({
      success: false,
      message: "Error consultando resultado de isla",
    });
  }
}

module.exports = {
  getPreguntasEvaluacion,
  upsertResultado: exports.upsertResultado,
  getResultado: exports.getResultado,
  getResultadoIsla: exports.getResultadoIsla,
  getPodio: exports.getPodio,
};