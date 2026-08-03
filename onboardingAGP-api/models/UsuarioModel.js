// models/UsuarioModel.js
const { connectDB, sql } = require("../config/db");

const TABLA = "dbo.Onboarding_Usuarios_NEW"; // tu tabla real

// Normaliza cédula como string (evita overflow y problemas de tipos)
const normCedula = (cedula) => String(cedula ?? "").trim();

exports.crearUsuario = async (nombre, cedula, nOnboarding) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const ced = normCedula(cedula);
  if (!ced) throw new Error("Cédula requerida");

  // 1) Si ya existe, devolvemos su KEY y no duplicamos
  const existing = await pool
    .request()
    .input("USUARIO_CEDULA", sql.NVarChar(30), ced)
    .query(`
      SELECT TOP 1
        USUARIO_KEY
      FROM ${TABLA}
      WHERE LTRIM(RTRIM(USUARIO_CEDULA)) = LTRIM(RTRIM(@USUARIO_CEDULA))
      ORDER BY USUARIO_KEY DESC
    `);

  const existKey = existing.recordset?.[0]?.USUARIO_KEY;
  if (existKey) return existKey;

  // 2) Insert si no existe
  const progresoIsla = 1;
  const progresoNivel = 1;

  const result = await pool
    .request()
    .input("USUARIO_NOMBRE", sql.NVarChar(200), String(nombre ?? "").trim())
    .input("USUARIO_CEDULA", sql.NVarChar(30), ced)
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

  return result.recordset?.[0]?.USUARIO_KEY ?? null;
};

exports.buscarPorCedula = async (cedula) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const ced = normCedula(cedula);
  if (!ced) return null;

  const result = await pool
    .request()
    .input("USUARIO_CEDULA", sql.NVarChar(30), ced)
    .query(`
      SELECT TOP 1
        USUARIO_KEY,
        USUARIO_NOMBRE,
        USUARIO_CEDULA,
        USUARIO_PROGRESO_ISLA,
        USUARIO_PROGRESO_NIVEL
      FROM ${TABLA}
      WHERE LTRIM(RTRIM(USUARIO_CEDULA)) = LTRIM(RTRIM(@USUARIO_CEDULA))
      ORDER BY USUARIO_KEY DESC
    `);

  return result.recordset?.[0] || null;
};

exports.buscarPorKey = async (usuarioKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, Number(usuarioKey))
    .query(`
      SELECT TOP 1
        USUARIO_KEY,
        USUARIO_NOMBRE,
        USUARIO_CEDULA,
        USUARIO_NUMERO_ONBOARDING,
        USUARIO_PROGRESO_ISLA,
        USUARIO_PROGRESO_NIVEL
      FROM ${TABLA}
      WHERE USUARIO_KEY = @USUARIO_KEY
    `);

  return result.recordset?.[0] || null;
};

exports.buscarPorKey = async (usuarioKey) => {
  const pool = await connectDB();
  if (!pool) throw new Error("No hay conexión con SQL Server");

  const result = await pool
    .request()
    .input("USUARIO_KEY", sql.Int, Number(usuarioKey))
    .query(`
      SELECT TOP 1
        USUARIO_KEY,
        USUARIO_NOMBRE,
        USUARIO_CEDULA,
        USUARIO_NUMERO_ONBOARDING,
        USUARIO_PROGRESO_ISLA,
        USUARIO_PROGRESO_NIVEL
      FROM ${TABLA}
      WHERE USUARIO_KEY = @USUARIO_KEY
    `);

  return result.recordset?.[0] || null;
};
