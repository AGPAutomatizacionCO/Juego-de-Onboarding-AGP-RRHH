const sql = require("mssql");
const { getPool } = require("../config/db");

const TABLA_INTENTOS = "dbo.Onboarding_Intentos_Nivel";

// Conteo de intentos por usuario+nivel, guardado aparte de
// Onboarding_Resultados_Nivel para que sobreviva al borrado de esa fila
// cuando el admin habilita un reintento (ver evaluacionFinal.controller.js /
// consumirReintento). Incrementa y devuelve el total actualizado en una
// sola operación atómica (MERGE + OUTPUT).
async function incrementarIntento(usuarioKey, nivelKey) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a la base de datos (pool null).");

  const r = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, Number(usuarioKey))
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .query(`
      MERGE ${TABLA_INTENTOS} AS T
      USING (SELECT @USUARIO_KEY AS USUARIO_KEY, @NIVELES_KEY AS NIVELES_KEY) AS S
        ON T.USUARIO_KEY = S.USUARIO_KEY AND T.NIVELES_KEY = S.NIVELES_KEY
      WHEN MATCHED THEN
        UPDATE SET TOTAL_INTENTOS = T.TOTAL_INTENTOS + 1
      WHEN NOT MATCHED THEN
        INSERT (USUARIO_KEY, NIVELES_KEY, TOTAL_INTENTOS)
        VALUES (S.USUARIO_KEY, S.NIVELES_KEY, 1)
      OUTPUT inserted.TOTAL_INTENTOS;
    `);

  return r.recordset?.[0]?.TOTAL_INTENTOS ?? 1;
}

module.exports = { incrementarIntento };
