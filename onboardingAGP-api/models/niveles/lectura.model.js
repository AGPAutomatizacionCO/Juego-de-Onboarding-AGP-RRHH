// models/niveles/lectura.model.js
const { sql, getPool } = require("../../config/db");

const TABLA = "dbo.Onboarding_Lectura";

exports.getLecturasByNivel = async (nivelKey) => {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .query(`
      SELECT
        LECTURA_KEY          AS id,
        LECTURA_ANTES        AS pregunta,
        LECTURA_DESPUES      AS despues,
        LECTURA_RESPUESTA_1  AS respuesta1,
        LECTURA_RESPUESTA_2  AS respuesta2,
        LECTURA_RESPUESTA_3  AS respuesta3,
        LECTURA_RESPUESTA_4  AS respuesta4,
        LECTURA_RESPUESTA_5  AS respuesta5,
        LECTURA_RESPUESTA_6  AS respuesta6,
        LECTURA_RESPUESTA_7  AS respuesta7,
        LECTURA_RESPUESTA_8  AS respuesta8,
        LECTURA_RESPUESTA_9  AS respuesta9,
        LECTURA_RESPUESTA_10 AS respuesta10,
        LECTURA_CORRECTA     AS respuestaCorrecta
      FROM ${TABLA}
      WHERE NIVELES_KEY = @NIVELES_KEY
      ORDER BY LECTURA_KEY ASC
    `);

  console.log(
    `📦 getLecturasByNivel(${nivelKey}) → ${result.recordset?.length ?? 0} filas`
  );

  return result.recordset || [];
};