const { sql, getPool } = require("../config/db");

async function getVisualPairsByNivelKey(nivelKey) {
  const pool = await getPool();
  if (!pool) throw new Error("Sin conexión a la base de datos.");

  const result = await pool
    .request()
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .query(`
      SELECT
        VISUAL_KEY,
        NIVELES_KEY,
        VISUAL_IMAGEN_FOTO,
        VISUAL_IMAGEN_CONCEPTO,
        VISUAL_ESTATUS
      FROM dbo.Onboarding_Visual
      WHERE NIVELES_KEY = @NIVELES_KEY
        AND (VISUAL_ESTATUS = 'H' OR VISUAL_ESTATUS = 'h' OR VISUAL_ESTATUS IS NULL)
      ORDER BY VISUAL_KEY ASC
    `);

  return result.recordset || [];
}

module.exports = { getVisualPairsByNivelKey };
