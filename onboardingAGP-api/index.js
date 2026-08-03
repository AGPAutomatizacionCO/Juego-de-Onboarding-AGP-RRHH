require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const { connectDB } = require("./config/db");

const usuarioRoutes = require("./routes/UsuarioRoutes");
const islasRoutes = require("./routes/IslasRoutes");
const nivelesRoutes = require("./routes/NivelesRoutes");
const adminRoutes = require("./routes/adminAuth.routes");
const adminUploadRoutes = require("./routes/adminUpload.routes");

const app = express();
app.use(cors());
app.use(express.json());

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.use("/api/usuarios", usuarioRoutes);
app.use("/api/islas", islasRoutes);
app.use("/api/niveles", nivelesRoutes);

app.use("/admin/auth", adminRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/admin/uploads", adminUploadRoutes);

// health check
app.get("/api/health", async (_, res) => {
  try {
    const pool = await connectDB();
    return res.json({ ok: true, db: !!pool });
  } catch (e) {
    return res.status(500).json({ ok: false, db: false, error: String(e) });
  }
});

// NO ARRANCAMOS SI NO HAY CONEXIÓN A LA BASE DE DATOS
(async () => {
  const pool = await connectDB();
  if (!pool) {
    console.error("No se pudo conectar a la DB. No se levanta el servidor.");
    process.exit(1);
  }

  const PORT = process.env.PORT || 3001;
  // Escuchar en 0.0.0.0 para que tablets y otros dispositivos en la misma red puedan conectarse
  app.listen(PORT, "0.0.0.0", () => console.log(`API encendida en 0.0.0.0:${PORT} (accesible desde la red local)`));
})();
