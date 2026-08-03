const IslandsModel = require("../models/IslasModel");
const VisualModel = require("../models/niveles/visual.model");

/* ==============================
   ESTADO DE LAS ISLAS POR CADA USUARIO
   ============================== */
exports.getEstadoIslasPorUsuario = async (req, res) => {
  try {
    const usuarioKey = Number(req.params.usuarioKey);

    if (!usuarioKey || Number.isNaN(usuarioKey)) {
      return res.status(400).json({ message: "usuarioKey inválido" });
    }

    // Desbloqueo progresivo de islas basado en el progreso del usuario
    const FORCE_UNLOCK_ALL_ISLANDS = false;

    // 1) sacamos el progreso que tiene el usuario
    const progreso = await IslandsModel.obtenerProgresoUsuario(usuarioKey);

    const progresoIsla = progreso?.USUARIO_PROGRESO_ISLA
      ? Number(progreso.USUARIO_PROGRESO_ISLA)
      : 1;

    // 2) islas que el admin tiene habilitadas
    const islasBD = await IslandsModel.obtenerIslasHabilitadas();

    // 3) armamos el estado final del mapa
    const totalIslas = 9;

    const estado = Array.from({ length: totalIslas }, (_, idx) => {
      const id = idx + 1;

      const islaDB = islasBD.find((x) => Number(x.ISLAS_KEY) === id);

      const est = islaDB ? String(islaDB.ISLAS_ESTATUS ?? "").toUpperCase() : "H";
      const habilitada = est === "H" || est === "1" || est === "TRUE";

      const desbloqueadaPorProgreso = FORCE_UNLOCK_ALL_ISLANDS
        ? true
        : id <= progresoIsla;

      return {
        id,
        activa: habilitada && desbloqueadaPorProgreso,
      };
    });

    return res.json({
      usuarioKey,
      progresoIsla: FORCE_UNLOCK_ALL_ISLANDS ? totalIslas : progresoIsla,
      progresoNivel: progreso?.USUARIO_PROGRESO_NIVEL ?? 1,
      forceUnlockAll: FORCE_UNLOCK_ALL_ISLANDS,
      islas: estado,
    });
  } catch (error) {
    console.error("ERROR getEstadoIslasPorUsuario:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

/* ==============================
   RESULTADOS DE NIVELES POR USUARIO
   ============================== */
exports.getResultadosPorUsuario = async (req, res) => {
  try {
    const usuarioKey = Number(req.params.usuarioKey);

    if (!usuarioKey || Number.isNaN(usuarioKey)) {
      return res.status(400).json({ message: "usuarioKey inválido" });
    }

    const { connectDB, sql } = require("../config/db");
    const pool = await connectDB();
    
    const result = await pool
      .request()
      .input("USUARIO_KEY", sql.Int, usuarioKey)
      .query(`
        SELECT 
          NIVELES_KEY,
          PUNTAJE,
          APROBADO,
          INTENTO,
          MISMATCHES,
          LIVES_LEFT,
          FECHA
        FROM dbo.Onboarding_Resultados_Nivel
        WHERE USUARIO_KEY = @USUARIO_KEY
        ORDER BY NIVELES_KEY ASC
      `);

    // Convertir a formato más usable
    const resultados = {};
    (result.recordset || []).forEach(row => {
      resultados[`nivel_${row.NIVELES_KEY}`] = {
        puntaje: row.PUNTAJE,
        aprobado: row.APROBADO === 1,
        intento: row.INTENTO,
        mismatches: row.MISMATCHES,
        livesLeft: row.LIVES_LEFT,
        fecha: row.FECHA,
      };
    });

    return res.json({
      success: true,
      usuarioKey,
      resultados,
    });
  } catch (error) {
    console.error("ERROR getResultadosPorUsuario:", error);
    return res.status(500).json({ message: "Error en el servidor" });
  }
};

/* ==============================
   CATÁLOGO DE ISLAS
   ============================== */
exports.getCatalogoIslas = async (req, res) => {
  try {
    const data = await IslandsModel.obtenerCatalogoIslas();
    return res.json({ success: true, data });
  } catch (error) {
    console.error("ERROR getCatalogoIslas:", error);
    return res
      .status(500)
      .json({ message: "Error cargando catálogo de islas" });
  }
};

/* ==============================
   NIVELES QUE TIENE CADA ISLA
   ============================== */
exports.getNivelesPorIsla = async (req, res) => {
  try {
    const islaKey = Number(req.params.islaKey);

    if (!islaKey || Number.isNaN(islaKey)) {
      return res.status(400).json({ message: "islaKey inválido" });
    }

    const data = await IslandsModel.obtenerNivelesPorIsla(islaKey);
    return res.json({ success: true, data });
  } catch (error) {
    console.error("ERROR getNivelesPorIsla:", error);
    return res
      .status(500)
      .json({ message: "Error cargando niveles de la isla" });
  }
};

/* ==============================
   AVANZAR ISLA DEL USUARIO
   ============================== */
exports.avanzarIsla = async (req, res) => {
  try {
    const usuarioKey = Number(req.params.usuarioKey);
    const nuevaIsla = Number(req.body.nuevaIsla);

    if (!usuarioKey || Number.isNaN(usuarioKey)) {
      return res.status(400).json({ success: false, message: "usuarioKey inválido" });
    }
    if (!nuevaIsla || Number.isNaN(nuevaIsla)) {
      return res.status(400).json({ success: false, message: "nuevaIsla inválida" });
    }

    const updated = await IslandsModel.actualizarProgresoIsla(usuarioKey, nuevaIsla);
    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error("ERROR avanzarIsla:", error);
    return res.status(500).json({ success: false, message: "Error en el servidor" });
  }
};
