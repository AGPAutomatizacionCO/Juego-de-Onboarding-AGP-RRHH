const sql = require("mssql");
const { getPool } = require("../../config/db");

/**
 * Obtiene las palabras y conceptos desde la tabla dbo.Onboarding_Recordemos
 */
async function obtenerPalabrasRecordemos(nivelKey) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a la base de datos (pool null).");

  const result = await pool
    .request()
    .input("NIVELES_KEY", sql.Int, nivelKey)
    .query(`
      SELECT 
        RECORDEMOS_KEY as id,
        RECORDEMOS_PALABRA as palabra,
        RECORDEMOS_CONCEPTO as concepto
      FROM dbo.Onboarding_Recordemos
      WHERE NIVELES_KEY = @NIVELES_KEY
        AND RECORDEMOS_ESTATUS = 'H'
      ORDER BY RECORDEMOS_KEY;
    `);

  return result.recordset;
}

/**
 * - Inserta resultado nivel en dbo.Onboarding_Resultados_Nivel (PUNTAJE=100)
 * - Recalcula porcentaje isla (promedio del último intento por nivel)
 * - UPSERT en dbo.Onboarding_Resultados_Isla
 */
async function completarRecordemos({
  usuarioKey,
  islaKey,
  nivelKey,
  livesLeft = null,
}) {
  const pool = await getPool();
  if (!pool) throw new Error("No hay conexión a la base de datos (pool null).");

  // 1) siguiente intento del nivel
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

  // 2) insertar resultado del nivel (100)
  await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("NIVELES_KEY", sql.Int, nivelKey)
    .input("PUNTAJE", sql.Int, 100)
    .input("APROBADO", sql.Bit, 1)
    .input("INTENTO", sql.Int, intento)
    .input("MISMATCHES", sql.Int, 0)
    .input("LIVES_LEFT", sql.Int, livesLeft)
    .query(`
      INSERT INTO dbo.Onboarding_Resultados_Nivel
        (USUARIO_KEY, NIVELES_KEY, PUNTAJE, APROBADO, INTENTO, FECHA, MISMATCHES, LIVES_LEFT)
      VALUES
        (@USUARIO_KEY, @NIVELES_KEY, @PUNTAJE, @APROBADO, @INTENTO, GETDATE(), @MISMATCHES, @LIVES_LEFT);
    `);

  // 3) recalcular porcentaje isla con último intento por nivel
  const pctRes = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("ISLAS_KEY", sql.Int, islaKey)
    .query(`
      ;WITH UltimoIntento AS (
        SELECT
          rn.USUARIO_KEY,
          rn.NIVELES_KEY,
          rn.PUNTAJE,
          ROW_NUMBER() OVER (
            PARTITION BY rn.USUARIO_KEY, rn.NIVELES_KEY
            ORDER BY rn.FECHA DESC, rn.INTENTO DESC
          ) AS RN
        FROM dbo.Onboarding_Resultados_Nivel rn
      ),
      NivelesIsla AS (
        SELECT NIVELES_KEY
        FROM dbo.Onboarding_Niveles
        WHERE ISLAS_KEY = @ISLAS_KEY
      )
      SELECT
        CAST(ROUND(AVG(CAST(ui.PUNTAJE AS FLOAT)), 0) AS INT) AS PORCENTAJE
      FROM NivelesIsla ni
      LEFT JOIN UltimoIntento ui
        ON ui.NIVELES_KEY = ni.NIVELES_KEY
       AND ui.USUARIO_KEY = @USUARIO_KEY
       AND ui.RN = 1;
    `);

  const porcentajeIsla = pctRes.recordset?.[0]?.PORCENTAJE ?? 0;
  const aprobadoIsla = porcentajeIsla >= 100 ? 1 : 0;

  // 4) upsert en resultados isla
  await pool
    .request()
    .input("USUARIO_KEY", sql.Int, usuarioKey)
    .input("ISLAS_KEY", sql.Int, islaKey)
    .input("PORCENTAJE", sql.Int, porcentajeIsla)
    .input("APROBADO", sql.Bit, aprobadoIsla)
    .query(`
      MERGE dbo.Onboarding_Resultados_Isla AS T
      USING (
        SELECT @USUARIO_KEY AS USUARIO_KEY, @ISLAS_KEY AS ISLAS_KEY
      ) AS S
      ON T.USUARIO_KEY = S.USUARIO_KEY
     AND T.ISLAS_KEY = S.ISLAS_KEY
      WHEN MATCHED THEN
        UPDATE SET
          PORCENTAJE = @PORCENTAJE,
          APROBADO = @APROBADO,
          FECHA = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (USUARIO_KEY, ISLAS_KEY, PORCENTAJE, APROBADO, FECHA)
        VALUES (@USUARIO_KEY, @ISLAS_KEY, @PORCENTAJE, @APROBADO, GETDATE());
    `);

  return {
    usuarioKey,
    islaKey,
    nivelKey,
    puntajeNivel: 100,
    intento,
    porcentajeIsla,
  };
}

module.exports = { completarRecordemos, obtenerPalabrasRecordemos };
