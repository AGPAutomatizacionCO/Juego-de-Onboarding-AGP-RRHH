const {
  completarSocial,
  estadoSocial,
  obtenerCasosSocial,
} = require("../../models/niveles/social.model");
const { sql, getPool } = require("../../config/db");

const TABLA_USUARIOS = "dbo.Onboarding_Usuarios_NEW";

const toInt = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// ✅ GET para obtener casos desde la BD
exports.getCasosSocial = async (req, res) => {
  try {
    const nivelKey = toInt(req.params.nivelKey);

    if (!nivelKey) {
      return res.status(400).json({
        success: false,
        message: "nivelKey inválido",
      });
    }

    const casos = await obtenerCasosSocial(nivelKey);

    if (!casos || casos.length === 0) {
      return res.json({
        success: true,
        data: {
          nivelKey,
          casos: [],
          message: "No hay casos en la base de datos para este nivel",
        },
      });
    }

    return res.json({
      success: true,
      data: {
        nivelKey,
        casos: casos,
      },
    });
  } catch (e) {
    console.error("getCasosSocial", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo casos de Social",
    });
  }
};

exports.completar = async (req, res) => {
  try {
    const { usuarioKey, puntaje, aprobado, mismatches, livesLeft } = req.body;
    const nivelKey = req.params.nivelKey;

    if (usuarioKey == null || nivelKey == null) {
      return res.status(400).json({
        success: false,
        message: "Faltan datos: usuarioKey, nivelKey",
      });
    }

    const uk = Number(usuarioKey);
    const nk = Number(nivelKey);
    const p = Number(puntaje ?? 0);
    const aprobadoBool = Boolean(aprobado);
    const ll = Number(livesLeft ?? 0);

    const pool = await getPool();

    // 1) Obtener siguiente intento
    const intentoRes = await pool
      .request()
      .input("USUARIO_KEY", sql.Int, uk)
      .input("NIVELES_KEY", sql.Int, nk)
      .query(`
        SELECT ISNULL(MAX(INTENTO), 0) + 1 AS NEXT_INTENTO
        FROM dbo.Onboarding_Resultados_Nivel
        WHERE USUARIO_KEY = @USUARIO_KEY
          AND NIVELES_KEY = @NIVELES_KEY;
      `);

    const intento = intentoRes.recordset?.[0]?.NEXT_INTENTO ?? 1;

    // 2) Insertar resultado
    await pool
      .request()
      .input("USUARIO_KEY", sql.Int, uk)
      .input("NIVELES_KEY", sql.Int, nk)
      .input("PUNTAJE", sql.Int, p)
      .input("APROBADO", sql.Bit, aprobadoBool ? 1 : 0)
      .input("INTENTO", sql.Int, intento)
      .input("MISMATCHES", sql.Int, Number(mismatches ?? 0))
      .input("LIVES_LEFT", sql.Int, ll)
      .query(`
        INSERT INTO dbo.Onboarding_Resultados_Nivel
          (USUARIO_KEY, NIVELES_KEY, PUNTAJE, APROBADO, INTENTO, FECHA, MISMATCHES, LIVES_LEFT)
        VALUES
          (@USUARIO_KEY, @NIVELES_KEY, @PUNTAJE, @APROBADO, @INTENTO, GETDATE(), @MISMATCHES, @LIVES_LEFT);
      `);

    // 3) Si aprobó, actualizar progreso del usuario
    if (aprobadoBool) {
      const nextNivel = nk + 1;
      await pool
        .request()
        .input("usuarioKey", sql.Int, uk)
        .input("nuevoNivel", sql.Int, nextNivel)
        .query(`
          UPDATE ${TABLA_USUARIOS}
          SET USUARIO_PROGRESO_NIVEL =
            CASE
              WHEN ISNULL(USUARIO_PROGRESO_NIVEL, 1) < @nuevoNivel THEN @nuevoNivel
              ELSE ISNULL(USUARIO_PROGRESO_NIVEL, 1)
            END
          WHERE USUARIO_KEY = @usuarioKey
        `);
    }

    return res.json({
      success: true,
      aprobado: aprobadoBool,
      puntaje: p,
      intento,
    });
  } catch (e) {
    console.error("social.controller error:", e);
    return res.status(500).json({
      success: false,
      message: "Error completando Social",
    });
  }
};

exports.estado = async (req, res) => {
  try {
    const { usuarioKey, nivelKey } = req.query;

    if (usuarioKey == null || nivelKey == null) {
      return res.status(400).json({
        success: false,
        message: "Faltan query params: usuarioKey, nivelKey",
      });
    }

    const data = await estadoSocial({
      usuarioKey: Number(usuarioKey),
      nivelKey: Number(nivelKey),
    });

    return res.json({ success: true, data });
  } catch (e) {
    console.error("social.estado error:", e);
    return res.status(500).json({
      success: false,
      message: "Error consultando estado Social",
    });
  }
};