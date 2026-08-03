const { sql, getPool } = require("../config/db");

/**
 * Busca admin por usuario (para luego validar password)
 */
async function findAdminByUser(user) {
  const pool = await getPool();
  if (!pool) throw new Error("Sin conexión a la base de datos.");

  const result = await pool
    .request()
    .input("user", sql.NVarChar(100), String(user ?? "").trim())
    .query(`
      SELECT TOP (1)
        ADMINISTRADOR_KEY,
        ADMINISTRADOR_USUARIO,
        ADMINISTRADOR_PASSWORD,
        ADMINISTRADOR_ESTATUS,
        ADMINISTRADOR_CREACION,
        ADMINISTRADOR_MODIFICACION
      FROM dbo.Onboarding_Administrador
      WHERE LOWER(LTRIM(RTRIM(ADMINISTRADOR_USUARIO))) =
            LOWER(LTRIM(RTRIM(@user)))
    `);

  return result.recordset?.[0] ?? null;
}

module.exports = {
  findAdminByUser,
};
