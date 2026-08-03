const sql = require("mssql");
const { getPool } = require("../../config/db");

async function completarSocial({
  usuarioKey,
  nivelKey,
  puntaje = 0,
  aprobado = true,
  mismatches = 0,
  livesLeft = null,
}) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a BD (pool null).");

  const intentoRes = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("NIVELES_KEY", sql.Int, nivelKey)
    .query(`
      SELECT ISNULL(MAX(INTENTO), 0) + 1 AS NEXT_INTENTO
      FROM dbo.Onboarding_Resultados_Nivel
      WHERE USUARIO_KEY = @USUARIO_KEY
        AND NIVELES_KEY = @NIVELES_KEY;
    `);

  const intento = intentoRes.recordset?.[0]?.NEXT_INTENTO ?? 1;

  await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("NIVELES_KEY", sql.Int, nivelKey)
    .input("PUNTAJE",     sql.Int, puntaje)
    .input("APROBADO",    sql.Bit, aprobado ? 1 : 0)
    .input("INTENTO",     sql.Int, intento)
    .input("MISMATCHES",  sql.Int, mismatches)
    .input("LIVES_LEFT",  sql.Int, livesLeft)
    .query(`
      INSERT INTO dbo.Onboarding_Resultados_Nivel
        (USUARIO_KEY, NIVELES_KEY, PUNTAJE, APROBADO, INTENTO, FECHA, MISMATCHES, LIVES_LEFT)
      VALUES
        (@USUARIO_KEY, @NIVELES_KEY, @PUNTAJE, @APROBADO, @INTENTO, GETDATE(), @MISMATCHES, @LIVES_LEFT);
    `);

  return { usuarioKey, nivelKey, puntajeNivel: puntaje, intento };
}

async function estadoSocial({ usuarioKey, nivelKey }) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a BD (pool null).");

  const r = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("NIVELES_KEY", sql.Int, nivelKey)
    .query(`
      SELECT TOP 1
        APROBADO,
        PUNTAJE,
        FECHA
      FROM dbo.Onboarding_Resultados_Nivel
      WHERE USUARIO_KEY = @USUARIO_KEY
        AND NIVELES_KEY = @NIVELES_KEY
      ORDER BY FECHA DESC, INTENTO DESC;
    `);

  const row = r.recordset?.[0];
  if (!row) return { completado: false, puntaje: null };

  return {
    completado: row.APROBADO === true || row.APROBADO === 1,
    puntaje:    row.PUNTAJE ?? null,
  };
}

// ✅ Sin filtro SOCIAL_ESTATUS para no bloquear registros
async function obtenerCasosSocial(nivelKey) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a BD (pool null).");

  const result = await pool
    .request()
    .input("nivelKey", sql.Int, nivelKey)
    .query(`
      SELECT
        SOCIAL_KEY          AS id,
        SOCIAL_CASO         AS caso,
        SOCIAL_RESPUESTA_1  AS respuesta1,
        SOCIAL_RESPUESTA_2  AS respuesta2,
        SOCIAL_RESPUESTA_3  AS respuesta3,
        SOCIAL_CORRECTA     AS respuestaCorrecta
      FROM dbo.Onboarding_Social
      WHERE NIVELES_KEY = @nivelKey
      ORDER BY SOCIAL_KEY;
    `);

  console.log(`📦 obtenerCasosSocial(${nivelKey}) → ${result.recordset?.length ?? 0} filas`);
  return result.recordset;
}

module.exports = { completarSocial, estadoSocial, obtenerCasosSocial };