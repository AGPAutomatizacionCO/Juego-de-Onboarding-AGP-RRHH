const { connectDB, sql } = require("../config/db");

const TABLA = "dbo.Onboarding_Usuarios_NEW";
const TABLA_ISLAS = "dbo.Onboarding_Islas";
const TABLA_NIVELES = "dbo.Onboarding_Niveles";

/* ==========================================================
   ✅ USUARIOS
   ========================================================== */

exports.crearUsuario = async (nombre, cedula, nOnboarding) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const progresoIsla = 1;
  const progresoNivel = 1;

  const result = await pool
    .request()
    .input("USUARIO_NOMBRE", sql.VarChar(200), nombre)
    .input("USUARIO_CEDULA", sql.Int, Number(cedula))
    .input("USUARIO_NUMERO_ONBOARDING", sql.Int, Number(nOnboarding))
    .input("USUARIO_PROGRESO_ISLA", sql.Int, progresoIsla)
    .input("USUARIO_PROGRESO_NIVEL", sql.Int, progresoNivel)
    .query(`
      INSERT INTO ${TABLA}
        (USUARIO_NOMBRE, USUARIO_CEDULA, USUARIO_NUMERO_ONBOARDING, USUARIO_PROGRESO_ISLA, USUARIO_PROGRESO_NIVEL)
      OUTPUT INSERTED.USUARIO_KEY
      VALUES
        (@USUARIO_NOMBRE, @USUARIO_CEDULA, @USUARIO_NUMERO_ONBOARDING, @USUARIO_PROGRESO_ISLA, @USUARIO_PROGRESO_NIVEL)
    `);

  return result.recordset?.[0]?.USUARIO_KEY;
};

exports.buscarPorCedula = async (cedula) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("USUARIO_CEDULA", sql.Int, Number(cedula))
    .query(`
      SELECT TOP 1
        USUARIO_KEY,
        USUARIO_NOMBRE,
        USUARIO_CEDULA,
        USUARIO_PROGRESO_ISLA,
        USUARIO_PROGRESO_NIVEL
      FROM ${TABLA}
      WHERE USUARIO_CEDULA = @USUARIO_CEDULA
    `);

  return result.recordset?.[0] || null;
};

exports.obtenerProgresoUsuario = async (usuarioKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, Number(usuarioKey))
    .query(`
      SELECT TOP 1
        USUARIO_KEY,
        USUARIO_PROGRESO_ISLA,
        USUARIO_PROGRESO_NIVEL
      FROM ${TABLA}
      WHERE USUARIO_KEY = @USUARIO_KEY
    `);

  return result.recordset?.[0] || null;
};

exports.obtenerIslasHabilitadas = async () => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool.request().query(`
    SELECT
      ISLAS_KEY,
      ISLAS_ESTATUS
    FROM ${TABLA_ISLAS}
    ORDER BY ISLAS_KEY ASC
  `);

  return result.recordset || [];
};

/* ==========================================================
   ✅ CATÁLOGO DE ISLAS
   ========================================================== */

exports.obtenerCatalogoIslas = async () => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool.request().query(`
    SELECT
      ISLAS_KEY,
      ISLAS_NOMBRE,
      ISLAS_ESTATUS
    FROM ${TABLA_ISLAS}
    ORDER BY ISLAS_KEY ASC
  `);

  return result.recordset || [];
};

exports.obtenerNivelesPorIsla = async (islaKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("ISLAS_KEY", sql.Int, Number(islaKey))
    .query(`
      SELECT
        NIVELES_KEY,
        ISLAS_KEY,
        NIVELES_NOMBRE,
        NIVELES_TITULO,
        NIVELES_DESCRIPCION,
        NIVELES_ESTATUS
      FROM ${TABLA_NIVELES}
      WHERE ISLAS_KEY = @ISLAS_KEY
      ORDER BY NIVELES_KEY ASC
    `);

  return result.recordset || [];
};

/* ==========================================================
   ✅ ACTUALIZAR PROGRESO DE NIVEL
   ========================================================== */

exports.actualizarProgresoNivelSiMayor = async (usuarioKey, nuevoNivel) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const uk = Number(usuarioKey);
  const nn = Number(nuevoNivel);

  if (!Number.isFinite(uk) || uk <= 0) throw new Error("usuarioKey inválido");
  if (!Number.isFinite(nn) || nn <= 0) throw new Error("nuevoNivel inválido");

  const result = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, uk)
    .input("NUEVO_NIVEL", sql.Int, nn)
    .query(`
      UPDATE ${TABLA}
      SET USUARIO_PROGRESO_NIVEL =
        CASE
          WHEN ISNULL(USUARIO_PROGRESO_NIVEL, 1) < @NUEVO_NIVEL THEN @NUEVO_NIVEL
          ELSE ISNULL(USUARIO_PROGRESO_NIVEL, 1)
        END
      OUTPUT
        INSERTED.USUARIO_KEY,
        INSERTED.USUARIO_PROGRESO_ISLA,
        INSERTED.USUARIO_PROGRESO_NIVEL
      WHERE USUARIO_KEY = @USUARIO_KEY
    `);

  const updated = result.recordset?.[0] || null;

  if (!updated) {
    return await exports.obtenerProgresoUsuario(uk);
  }

  return updated;
};

// ✅ Avanzar isla del usuario (solo si el nuevo valor es mayor)
exports.actualizarProgresoIsla = async (usuarioKey, nuevaIsla) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const uk = Number(usuarioKey);
  const ni = Number(nuevaIsla);

  if (!Number.isFinite(uk) || uk <= 0) throw new Error("usuarioKey inválido");
  if (!Number.isFinite(ni) || ni <= 0) throw new Error("nuevaIsla inválido");

  const result = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, uk)
    .input("NUEVA_ISLA", sql.Int, ni)
    .query(`
      UPDATE ${TABLA}
      SET USUARIO_PROGRESO_ISLA =
        CASE
          WHEN ISNULL(USUARIO_PROGRESO_ISLA, 1) < @NUEVA_ISLA THEN @NUEVA_ISLA
          ELSE ISNULL(USUARIO_PROGRESO_ISLA, 1)
        END
      OUTPUT
        INSERTED.USUARIO_KEY,
        INSERTED.USUARIO_PROGRESO_ISLA,
        INSERTED.USUARIO_PROGRESO_NIVEL
      WHERE USUARIO_KEY = @USUARIO_KEY
    `);

  return result.recordset?.[0] || null;
};