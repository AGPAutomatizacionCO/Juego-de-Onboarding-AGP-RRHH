const sql = require("mssql");
const { getPool } = require("../../config/db");

/**
 * Obtiene las preguntas de evaluación desde la tabla dbo.Onboarding_Evaluacion
 * EVALUACION_COD parece ser el código que relaciona con el nivel
 */
async function obtenerPreguntasEvaluacion(nivelKey) {
  const pool = await getPool();

  const result = await pool
    .request()
    .input("nivelCod", sql.Int, nivelKey)
    .query(`
      SELECT 
        EVALUACION_KEY as id,
        EVALUACION_COD as codigo,
        EVALUACION_PREGUNTA as pregunta,
        EVALUACION_RESPUESTA_1 as respuesta1,
        [EVALUACION_RESPUESTA_1EVALUACION_RESPUESTA_2] as respuesta2,
        EVALUACION_RESPUESTA_3 as respuesta3,
        EVALUACION_RESPUESTA_4 as respuesta4,
        EVALUACION_CORRECTA as respuestaCorrecta
      FROM dbo.Onboarding_Evaluacion
      WHERE EVALUACION_COD = @nivelCod
        AND EVALUACION_ESTATUS = 'H'
      ORDER BY EVALUACION_KEY;
    `);

  return result.recordset;
}

async function getPodioAllUsers({ nivelKey, numeroOnboarding }) {
  const pool = await getPool();
  const res = await pool.request()
    .input("nivelKey", sql.Int, nivelKey)
    .input("numeroOnboarding", sql.Int, numeroOnboarding)  // ← AGREGAR
    .query(`
      SELECT
        u.USUARIO_KEY as usuarioKey,
        u.USUARIO_NOMBRE as nombre,
        r.PUNTAJE as puntaje
      FROM dbo.Onboarding_Usuarios_NEW u
      LEFT JOIN (
        SELECT USUARIO_KEY, NIVELES_KEY, PUNTAJE, FECHA,
               ROW_NUMBER() OVER (PARTITION BY USUARIO_KEY, NIVELES_KEY ORDER BY FECHA DESC) AS rn
        FROM dbo.Onboarding_Resultados_Nivel
        WHERE NIVELES_KEY = @nivelKey
      ) r ON r.USUARIO_KEY = u.USUARIO_KEY AND r.rn = 1
      WHERE u.USUARIO_NUMERO_ONBOARDING = @numeroOnboarding  -- ← AGREGAR
      ORDER BY
        CASE WHEN r.PUNTAJE IS NULL THEN 1 ELSE 0 END ASC,
        r.PUNTAJE DESC
    `);
  return res.recordset || [];
}
module.exports = {
  obtenerPreguntasEvaluacion,
  getPodioAllUsers,
};