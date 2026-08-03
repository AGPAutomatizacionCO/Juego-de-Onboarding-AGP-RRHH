const sql = require("mssql");

// Antes aquí se imprimían usuario, servidor, base y puerto en cada arranque.
// Se quitó porque en un servicio administrado esos registros quedan
// persistidos y consultables por cualquiera con acceso a los logs. Para
// diagnosticar la conexión basta el endpoint /api/health, que informa si el
// pool está activo sin revelar la configuración.

// ===============================
// CONFIGURACIÓN SQL SERVER
// ===============================
const dbConfig = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
  port: Number(process.env.DB_PORT),
  options: {
    encrypt: true,               // Azure SQL
    trustServerCertificate: true // Evita errores de certificado
  },

  // Pool de conexiones (estabilidad)
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },

  connectionTimeout: 30000,
  requestTimeout: 30000,
};

let pool = null;

// ===============================
// CONECTAR A LA BD
// ===============================
const connectDB = async () => {
  try {
    // Reutiliza conexión si ya existe
    if (pool && pool.connected) {
      return pool;
    }

    pool = await sql.connect(dbConfig);
    console.log("Conectado a SQL Server");

    // Escuchar errores del pool
    pool.on("error", (err) => {
      console.error("Error en el pool SQL:", err);
    });

    return pool;
  } catch (error) {
    console.error("Error conectando a SQL:", error);
    return null;
  }
};

// ===============================
// OBTENER POOL (SEGURO)
// ===============================
const getPool = async () => {
  if (pool && pool.connected) {
    return pool;
  }
  return await connectDB();
};

// ===============================
// EXPORTS
// ===============================
module.exports = {
  sql,
  connectDB,
  getPool,
  dbConfig, // opcional, por si luego lo necesitas
};
