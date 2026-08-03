const { connectDB, sql } = require("../../config/db");

const TABLA_NIVELES = "dbo.Onboarding_Niveles";
const TABLA_VISUAL = "dbo.Onboarding_Visual";
const TABLA_RESULTADOS_NIVEL = "dbo.Onboarding_Resultados_Nivel";

exports.getNivelInfo = async (nivelKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const r = await pool
    .request()
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .query(`
      SELECT TOP 1
        NIVELES_KEY,
        NIVELES_TITULO,
        NIVELES_DESCRIPCION,
        NIVELES_NOMBRE
      FROM ${TABLA_NIVELES}
      WHERE NIVELES_KEY = @NIVELES_KEY
    `);

  const row = r.recordset?.[0];
  if (!row) return null;

  return {
    nivelKey: row.NIVELES_KEY,
    titulo: row.NIVELES_TITULO || row.NIVELES_NOMBRE || "",
    descripcion: row.NIVELES_DESCRIPCION || "",
  };
};

exports.getVisualByNivelKey = async (nivelKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const r = await pool
    .request()
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .query(`
      SELECT
        VISUAL_KEY,
        NIVELES_KEY,
        VISUAL_IMAGEN_FOTO,
        VISUAL_IMAGEN_CONCEPTO
      FROM ${TABLA_VISUAL}
      WHERE NIVELES_KEY = @NIVELES_KEY
      ORDER BY VISUAL_KEY ASC
    `);

  // Convert to lowercase keys for frontend compatibility
  return (r.recordset || []).map(row => ({
    pairId: row.VISUAL_KEY,
    fotoUrl: row.VISUAL_IMAGEN_FOTO,
    conceptoUrl: row.VISUAL_IMAGEN_CONCEPTO,
  }));
};

exports.upsertResultadoNivel = async ({
  usuarioKey,
  nivelKey,
  puntaje,
  aprobado,
  mismatches,
  livesLeft,
}) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  await pool
    .request()
    .input("USUARIO_KEY", sql.Int, Number(usuarioKey))
    .input("NIVELES_KEY", sql.Int, Number(nivelKey))
    .input("PUNTAJE", sql.Int, Number(puntaje))
    .input("APROBADO", sql.Bit, aprobado ? 1 : 0)
    .input("MISMATCHES", sql.Int, Number(mismatches ?? 0))
    .input("LIVES_LEFT", sql.Int, Number(livesLeft ?? 0))
    .query(`
      IF EXISTS (
        SELECT 1 FROM ${TABLA_RESULTADOS_NIVEL}
        WHERE USUARIO_KEY=@USUARIO_KEY AND NIVELES_KEY=@NIVELES_KEY
      )
      BEGIN
        UPDATE ${TABLA_RESULTADOS_NIVEL}
        SET PUNTAJE=@PUNTAJE,
            APROBADO=@APROBADO,
            INTENTO = ISNULL(INTENTO, 0) + 1,
            MISMATCHES=@MISMATCHES,
            LIVES_LEFT=@LIVES_LEFT,
            FECHA=GETDATE()
        WHERE USUARIO_KEY=@USUARIO_KEY AND NIVELES_KEY=@NIVELES_KEY
      END
      ELSE
      BEGIN
        INSERT INTO ${TABLA_RESULTADOS_NIVEL}
          (USUARIO_KEY, NIVELES_KEY, PUNTAJE, APROBADO, INTENTO, MISMATCHES, LIVES_LEFT, FECHA)
        VALUES
          (@USUARIO_KEY, @NIVELES_KEY, @PUNTAJE, @APROBADO, 1, @MISMATCHES, @LIVES_LEFT, GETDATE())
      END
    `);
};
