// controllers/UsuarioController.js
const UsuarioModel = require("../models/UsuarioModel");

const assertModel = () => {
  if (!UsuarioModel) throw new Error("UsuarioModel no se pudo cargar");
  if (typeof UsuarioModel.crearUsuario !== "function") throw new Error("UsuarioModel.crearUsuario no existe");
  if (typeof UsuarioModel.buscarPorCedula !== "function") throw new Error("UsuarioModel.buscarPorCedula no existe");
};

exports.register = async (req, res) => {
  try {
    assertModel();

    const { nombre, cedula, nOnboarding, numeroOnboarding } = req.body;
    const onboarding = nOnboarding ?? numeroOnboarding;

    if (!nombre || !cedula || onboarding == null) {
      return res.status(400).json({ success: false, message: "Datos incompletos" });
    }

    const usuarioKey = await UsuarioModel.crearUsuario(
      String(nombre).trim(),
      String(cedula).trim(),
      Number(onboarding)
    );

    if (!usuarioKey) throw new Error("crearUsuario no devolvió USUARIO_KEY");

    return res.status(201).json({ success: true, usuarioKey });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || "Error en el servidor" });
  }
};

exports.login = async (req, res) => {
  try {
    assertModel();

    const { cedula } = req.body;
    if (!cedula) return res.status(400).json({ success: false, message: "Ingresa tu cédula" });

    const user = await UsuarioModel.buscarPorCedula(String(cedula).trim());
    if (!user) return res.status(404).json({ success: false, message: "Cédula no encontrada" });
    if (!user.USUARIO_KEY) throw new Error("Usuario encontrado pero sin USUARIO_KEY");

    return res.status(200).json({
      success: true,
      usuarioKey: user.USUARIO_KEY,
      nombre: user.USUARIO_NOMBRE,
      progresoIsla: user.USUARIO_PROGRESO_ISLA,
      progresoNivel: user.USUARIO_PROGRESO_NIVEL,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || "Error en el servidor" });
  }
};

exports.getById = async (req, res) => {
  try {
    assertModel();

    const { usuarioKey } = req.params;
    if (!usuarioKey) return res.status(400).json({ success: false, message: "usuarioKey requerido" });

    const user = await UsuarioModel.buscarPorKey(Number(usuarioKey));
    if (!user) return res.status(404).json({ success: false, message: "Usuario no encontrado" });

    return res.status(200).json({
      success: true,
      data: {
        USUARIO_KEY: user.USUARIO_KEY,
        USUARIO_NOMBRE: user.USUARIO_NOMBRE,
        USUARIO_CEDULA: user.USUARIO_CEDULA,
        USUARIO_NUMERO_ONBOARDING: user.USUARIO_NUMERO_ONBOARDING,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message || "Error en el servidor" });
  }
};
