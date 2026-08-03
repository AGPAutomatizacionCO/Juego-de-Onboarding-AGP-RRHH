const sql = require("mssql");
const { getPool } = require("../config/db");
const { findAdminByUser } = require("../models/admin.model");

// funciones utiles que se usan en varios lados
const toInt = (v, def = null) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : def;
};

function normStr(s) {
  return String(s ?? "").trim().toLowerCase();
}

// convierte una ruta de imagen para que la tablet pueda ver la foto
function makeUrlNormalizer(req) {
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  return (u) => {
    if (!u) return "";
    let s = String(u).trim();
    if (!s) return "";

    // si ya viene con http/https, ya esta bien
    if (s.startsWith("http://") || s.startsWith("https://")) return s;

    // cambia los backslashes a slashes normales
    s = s.replaceAll("\\", "/");

    // si no empieza con / le agrega /uploads/
    if (!s.startsWith("/")) s = `/uploads/${s}`;

    return `${baseUrl}${s}`;
  };
}

// guarda solo la ruta relativa en la base de datos, ej: /uploads/foto.png
function toRelUploadPath(u) {
  if (!u) return null;
  let s = String(u).trim();
  if (!s) return null;

  // si viene una url completa, solo nos quedamos con lo de /uploads/ para adelante
  const idx = s.indexOf("/uploads/");
  if (idx !== -1) return s.slice(idx);

  // cambia backslashes
  s = s.replaceAll("\\", "/");

  // si viene "uploads/xxx" lo convierte a "/uploads/xxx"
  if (s.startsWith("uploads/")) s = "/" + s;

  // si solo viene el nombre, le agrega /uploads/
  if (!s.startsWith("/")) s = `/uploads/${s}`;

  return s;
}

// limpia los items de lectura que vienen del front por si vienen incompletos
function normalizeLecturaItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((x) => {
    const respuestas = Array.isArray(x?.respuestas) ? x.respuestas : [];
    const fixed = [];
    for (let i = 0; i < 10; i++) fixed.push(String(respuestas[i] ?? "").trim());
    return {
      id: toInt(x?.id ?? x?.LECTURA_KEY ?? null),
      antes: String(x?.antes ?? x?.LECTURA_ANTES ?? "").trim(),
      despues: String(x?.despues ?? x?.LECTURA_DESPUES ?? "").trim(),
      respuestas: fixed,
      correcta: String(x?.correcta ?? x?.LECTURA_CORRECTA ?? "").trim(),
    };
  });
}

/** ISLA 2 = HSE: lectura es V/F + arrastre RIESGO/PELIGRO en tabla Onboarding_Lectura */
function computeEditorKind(islaKey, nombreNivel) {
  const n = normStr(nombreNivel);
  if (n.includes("visual")) return "visual";
  if (n.includes("lectura")) {
    if (Number(islaKey) === 2) return "lecturaHse";
    return "lectura";
  }
  if (n.includes("record")) return "recordemos";
  if (n.includes("social")) return "social";
  if (n.includes("evalu")) return "evaluacion";
  return "generico";
}

function lecturaRecordsetToHse(rows) {
  const vfChk = [];
  const arrastre = [];
  for (const r of rows || []) {
    const antes = String(r.LECTURA_ANTES ?? "").trim();
    const desp = String(r.LECTURA_DESPUES ?? "").trim();
    const c = normStr(String(r.LECTURA_CORRECTA ?? "").trim());
    if (!antes && !desp) continue;
    if (c === "riesgo" || c === "peligro") {
      arrastre.push({
        id: Number(r.LECTURA_KEY),
        texto: antes,
        correcta: c === "riesgo" ? "RIESGO" : "PELIGRO",
      });
      continue;
    }
    if (c === "true" || c === "false" || c === "1" || c === "0") {
      vfChk.push({
        id: Number(r.LECTURA_KEY),
        texto: antes,
        correcta: c === "true" || c === "1",
      });
      continue;
    }
    if (!desp && antes) {
      vfChk.push({
        id: Number(r.LECTURA_KEY),
        texto: antes,
        correcta: false,
      });
    }
  }
  return { lecturaHseVf: vfChk, lecturaHseArrastre: arrastre };
}

function normalizeRecordemosItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((x) => ({
    id: toInt(x?.id ?? x?.RECORDEMOS_KEY ?? null),
    concepto: String(x?.concepto ?? x?.palabra ?? "").trim(),
    descripcion: String(x?.descripcion ?? x?.conceptoLargo ?? "").trim(),
  }));
}

function normalizeSocialCasos(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((x) => {
    let cor = normStr(x?.correcta ?? x?.respuestaCorrecta ?? "a");
    if (cor === "0") cor = "a";
    if (cor === "1") cor = "b";
    if (cor === "2") cor = "c";
    if (!["a", "b", "c"].includes(cor)) cor = "a";
    return {
      id: toInt(x?.id ?? x?.SOCIAL_KEY ?? null),
      caso: String(x?.caso ?? x?.frase ?? x?.SOCIAL_PREGUNTA ?? "").trim(),
      opcionA: String(x?.opcionA ?? x?.SOCIAL_OPCION_A ?? "").trim(),
      opcionB: String(x?.opcionB ?? x?.SOCIAL_OPCION_B ?? "").trim(),
      opcionC: String(x?.opcionC ?? x?.SOCIAL_OPCION_C ?? "").trim(),
      correcta: cor,
      explicacion: String(x?.explicacion ?? x?.SOCIAL_EXPLICACION ?? "").trim(),
    };
  });
}

function normalizeEvaluacionItems(items) {
  const arr = Array.isArray(items) ? items : [];
  return arr.map((x) => {
    let cor = normStr(x?.correcta ?? x?.respuestaCorrecta ?? "a");
    if (!["a", "b", "c", "d"].includes(cor)) cor = "a";
    return {
      id: toInt(x?.id ?? x?.EVALUACION_KEY ?? null),
      pregunta: String(x?.pregunta ?? x?.EVALUACION_PREGUNTA ?? "").trim(),
      opcionA: String(x?.opcionA ?? x?.EVALUACION_OPCION_A ?? "").trim(),
      opcionB: String(x?.opcionB ?? x?.EVALUACION_OPCION_B ?? "").trim(),
      opcionC: String(x?.opcionC ?? x?.EVALUACION_OPCION_C ?? "").trim(),
      opcionD: String(x?.opcionD ?? x?.EVALUACION_OPCION_D ?? "").trim(),
      correcta: cor,
    };
  });
}

// LOGIN DEL ADMIN
exports.login = async (req, res) => {
  try {
    const body = req.body || {};
    // No se registra el cuerpo de la petición: contiene la contraseña en claro.

    const user = String(body.user ?? body.username ?? body.ADMIN_USER ?? "").trim();
    const pass = String(body.pass ?? body.password ?? body.ADMIN_PASS ?? "").trim();

    if (!user || !pass) {
      console.log("[ADMIN LOGIN] FALLO: user o pass vacíos");
      return res.status(400).json({
        success: false,
        message: "Usuario y contraseña requeridos",
      });
    }

    const admin = await findAdminByUser(user);
    console.log("[ADMIN LOGIN] admin encontrado en DB:", admin ? "SI" : "NO", admin ? `(key=${admin.ADMINISTRADOR_KEY}, user=${admin.ADMINISTRADOR_USUARIO}, estatus=${admin.ADMINISTRADOR_ESTATUS})` : "");

    if (!admin) {
      console.log("[ADMIN LOGIN] FALLO: usuario no existe en tabla Onboarding_Administrador");
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas - usuario no encontrado",
      });
    }

    if (admin.ADMINISTRADOR_ESTATUS !== undefined && admin.ADMINISTRADOR_ESTATUS !== null && Number(admin.ADMINISTRADOR_ESTATUS) !== 1) {
      console.log("[ADMIN LOGIN] FALLO: estatus no es 1, es:", admin.ADMINISTRADOR_ESTATUS);
      return res.status(401).json({
        success: false,
        message: "Acceso denegado - cuenta inactiva",
      });
    }

    const passDB = String(admin.ADMINISTRADOR_PASSWORD ?? "").trim();
    // Antes se imprimían aquí AMBAS contraseñas en claro — la de la base y la
    // recibida. Se quitó: bastaba con acceso a los logs para obtenerlas.

    if (passDB !== pass) {
      console.log("[ADMIN LOGIN] FALLO: password no coincide");
      return res.status(401).json({
        success: false,
        message: "Credenciales inválidas - contraseña incorrecta",
      });
    }

    console.log("[ADMIN LOGIN] EXITO - admin_key:", admin.ADMINISTRADOR_KEY);
    return res.json({
      success: true,
      admin_key: admin.ADMINISTRADOR_KEY,
      admin_user: admin.ADMINISTRADOR_USUARIO,
    });
  } catch (e) {
    console.error("[ADMIN LOGIN] ERROR:", e);
    return res.status(500).json({
      success: false,
      message: "Error en login administrador: " + String(e?.message || e),
    });
  }
};

// OBTENER DATOS PARA EDITAR UN NIVEL
// GET /api/admin/niveles/:nivelKey/editor
exports.getNivelEditor = async (req, res) => {
  console.log("[getNivelEditor] nivelKey:", req.params.nivelKey);
  try {
    const nivelKey = toInt(req.params.nivelKey);
    if (!nivelKey) {
      return res.status(400).json({ success: false, message: "nivelKey inválido" });
    }

    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: "Sin conexión a la base de datos" });
    }

    const normUrl = makeUrlNormalizer(req);

    const nivelQ = await pool
      .request()
      .input("nivelKey", sql.Int, nivelKey)
      .query(`
        SELECT TOP 1
          NIVELES_TITULO,
          NIVELES_DESCRIPCION,
          NIVELES_NOMBRE,
          ISLAS_KEY
        FROM dbo.Onboarding_Niveles
        WHERE NIVELES_KEY = @nivelKey
      `);

    const nivel = nivelQ.recordset?.[0];
    if (!nivel) {
      return res.status(404).json({ success: false, message: "Nivel no encontrado" });
    }

    const islaKey = toInt(nivel.ISLAS_KEY);
    const nombreNivel = String(nivel.NIVELES_NOMBRE ?? "");
    const editorKind = computeEditorKind(islaKey, nombreNivel);
    
    console.log("[getNivelEditor] islaKey:", islaKey, "nombreNivel:", nombreNivel, "editorKind:", editorKind);

    // ahora las imagenes del nivel visual
    let visualPairs = [];
    if (editorKind === "visual") {
      console.log("[getNivelEditor] Cargando visual para nivelKey:", nivelKey);
      try {
        const visualQ = await pool
          .request()
          .input("nivelKey", sql.Int, nivelKey)
          .query(`
            SELECT
              VISUAL_KEY,
              VISUAL_IMAGEN_FOTO,
              VISUAL_IMAGEN_CONCEPTO
            FROM dbo.Onboarding_Visual
            WHERE NIVELES_KEY = @nivelKey
            ORDER BY VISUAL_KEY ASC
          `);
        const rows = visualQ.recordset || [];
        console.log("[getNivelEditor] Visual rows:", rows.length);
        console.log("[getNivelEditor] Visual columns:", Object.keys(rows[0] || {}).join(", "));
        visualPairs = rows.map((r) => ({
          id: Number(r.VISUAL_KEY),
          imagen: normUrl(r.VISUAL_IMAGEN_FOTO),
          imagenRespuesta: normUrl(r.VISUAL_IMAGEN_CONCEPTO),
        }));
        console.log("[getNivelEditor] visualPairs:", visualPairs.length);
      } catch (e) {
        console.warn("[getNivelEditor] Error query visual:", e.message);
      }
    }

    // y los items de lectura
    let lecturaItems = [];
    let lecturaHseVf = [];
    let lecturaHseArrastre = [];
    if (editorKind === "lectura" || editorKind === "lecturaHse") {
      try {
        const lecturaQ = await pool
          .request()
          .input("nivelKey", sql.Int, nivelKey)
          .query(`
            SELECT
              LECTURA_KEY,
              LECTURA_ANTES,
              LECTURA_DESPUES,
              LECTURA_RESPUESTA_1,
              LECTURA_RESPUESTA_2,
              LECTURA_RESPUESTA_3,
              LECTURA_RESPUESTA_4,
              LECTURA_RESPUESTA_5,
              LECTURA_RESPUESTA_6,
              LECTURA_RESPUESTA_7,
              LECTURA_RESPUESTA_8,
              LECTURA_RESPUESTA_9,
              LECTURA_RESPUESTA_10,
              LECTURA_CORRECTA
            FROM dbo.Onboarding_Lectura
            WHERE NIVELES_KEY = @nivelKey
            ORDER BY LECTURA_KEY ASC
          `);

        const lecturaRows = lecturaQ.recordset || [];
        lecturaItems = lecturaRows.map((r) => ({
          id: Number(r.LECTURA_KEY),
          antes: String(r.LECTURA_ANTES ?? ""),
          despues: String(r.LECTURA_DESPUES ?? ""),
          respuestas: [
            String(r.LECTURA_RESPUESTA_1 ?? ""),
            String(r.LECTURA_RESPUESTA_2 ?? ""),
            String(r.LECTURA_RESPUESTA_3 ?? ""),
            String(r.LECTURA_RESPUESTA_4 ?? ""),
            String(r.LECTURA_RESPUESTA_5 ?? ""),
            String(r.LECTURA_RESPUESTA_6 ?? ""),
            String(r.LECTURA_RESPUESTA_7 ?? ""),
            String(r.LECTURA_RESPUESTA_8 ?? ""),
            String(r.LECTURA_RESPUESTA_9 ?? ""),
            String(r.LECTURA_RESPUESTA_10 ?? ""),
          ],
          correcta: String(r.LECTURA_CORRECTA ?? ""),
        }));

        if (editorKind === "lecturaHse") {
          const hse = lecturaRecordsetToHse(lecturaRows);
          lecturaHseVf = hse.lecturaHseVf;
          lecturaHseArrastre = hse.lecturaHseArrastre;
        }
      } catch (e) {
        console.warn("[getNivelEditor] Error query lectura:", e.message);
      }
    }

    // Recordemos - solo por NIVELES_KEY
    let recordemosItems = [];
    if (editorKind === "recordemos" && islaKey) {
      console.log("[getNivelEditor] Cargando recordemos para nivelKey:", nivelKey);
      try {
        const recQ = await pool
          .request()
          .input("nivelKey", sql.Int, nivelKey)
          .query(`
            SELECT RECORDEMOS_KEY, RECORDEMOS_PALABRA, RECORDEMOS_CONCEPTO
            FROM dbo.Onboarding_Recordemos
            WHERE NIVELES_KEY = @nivelKey
            ORDER BY RECORDEMOS_KEY ASC
          `);
        recordemosItems = (recQ.recordset || []).map((r) => ({
          id: Number(r.RECORDEMOS_KEY),
          concepto: String(r.RECORDEMOS_PALABRA ?? ""),
          descripcion: String(r.RECORDEMOS_CONCEPTO ?? ""),
        }));
        console.log("[getNivelEditor] recordemosItems cargados:", recordemosItems.length);
      } catch (e) {
        console.warn("[getNivelEditor] Error query recordemos:", e.message);
      }
    }

    // Social - filtrar por NIVELES_KEY
    let socialCasos = [];
    if (editorKind === "social" && islaKey) {
      console.log("[getNivelEditor] Cargando social para nivelKey:", nivelKey);
      try {
        const socQ = await pool
          .request()
          .input("nivelKey", sql.Int, nivelKey)
          .query(`SELECT * FROM dbo.Onboarding_Social WHERE NIVELES_KEY = @nivelKey ORDER BY SOCIAL_KEY ASC`);
        const rows = socQ.recordset || [];
        console.log("[getNivelEditor] Social columns:", Object.keys(rows[0] || {}).join(", "));
        console.log("[getNivelEditor] Social rows:", rows.length);
        socialCasos = rows.map((r) => {
          const correctaNum = Number(r.SOCIAL_CORRECTA);
          let correcta = "a";
          if (correctaNum === 1) correcta = "a";
          else if (correctaNum === 2) correcta = "b";
          else if (correctaNum === 3) correcta = "c";
          return {
            id: Number(r.SOCIAL_KEY),
            caso: String(r.SOCIAL_CASO ?? ""),
            opcionA: String(r.SOCIAL_RESPUESTA_1 ?? ""),
            opcionB: String(r.SOCIAL_RESPUESTA_2 ?? ""),
            opcionC: String(r.SOCIAL_RESPUESTA_3 ?? ""),
            correcta: correcta,
            explicacion: "",
          };
        });
        console.log("[getNivelEditor] socialCasos cargados:", socialCasos.length);
      } catch (e) {
        console.warn("[getNivelEditor] Error query social:", e.message);
      }
    }

    // Evaluacion Final - filtrar por EVALUACION_COD (que corresponde al nivel)
    let evaluacionItems = [];
    if (editorKind === "evaluacion" && islaKey) {
      console.log("[getNivelEditor] Cargando evaluacion para nivelKey:", nivelKey);
      try {
        const evQ = await pool
          .request()
          .input("nivelKey", sql.Int, nivelKey)
          .query(`SELECT * FROM dbo.Onboarding_Evaluacion WHERE EVALUACION_COD = @nivelKey ORDER BY EVALUACION_KEY ASC`);
        const rows = evQ.recordset || [];
        console.log("[getNivelEditor] Evaluacion columns:", Object.keys(rows[0] || {}).join(", "));
        console.log("[getNivelEditor] Evaluacion filtered rows:", rows.length);
        
        evaluacionItems = rows.map((r) => {
          const cols = Object.keys(r);
          console.log("[getNivelEditor] Row keys:", cols.join(", "));
          
          // Buscar las columnas de respuestas
          const respuesta1 = cols.find(c => c.includes("RESPUESTA_1") && !c.includes("2")) || "EVALUACION_RESPUESTA_1";
          const respuesta2 = cols.find(c => c.includes("RESPUESTA_2") && !c.includes("RESPUESTA_2EVALUACION")) || cols.find(c => c.includes("2") && !c.includes("1")) || "EVALUACION_RESPUESTA_2";
          const respuesta3 = cols.find(c => c.includes("RESPUESTA_3")) || "EVALUACION_RESPUESTA_3";
          const respuesta4 = cols.find(c => c.includes("RESPUESTA_4")) || "EVALUACION_RESPUESTA_4";
          
          console.log("[getNivelEditor] Using cols:", respuesta1, respuesta2, respuesta3, respuesta4);
          
          const correctaNum = Number(r.EVALUACION_CORRECTA);
          let correcta = "a";
          if (correctaNum === 1) correcta = "a";
          else if (correctaNum === 2) correcta = "b";
          else if (correctaNum === 3) correcta = "c";
          else if (correctaNum === 4) correcta = "d";
          return {
            id: Number(r.EVALUACION_KEY),
            pregunta: String(r.EVALUACION_PREGUNTA ?? ""),
            opcionA: String(r[respuesta1] ?? ""),
            opcionB: String(r[respuesta2] ?? ""),
            opcionC: String(r[respuesta3] ?? ""),
            opcionD: String(r[respuesta4] ?? ""),
            correcta: correcta,
          };
        });
        console.log("[getNivelEditor] evaluacionItems cargados:", evaluacionItems.length);
      } catch (e) {
        console.warn("[getNivelEditor] Error query evaluacion:", e.message);
      }
    }

    return res.json({
      success: true,
      data: {
        titulo: String(nivel.NIVELES_TITULO ?? ""),
        descripcion: String(nivel.NIVELES_DESCRIPCION ?? ""),
        islaKey,
        editorKind,
        preguntas: [],
        respuestas: [],
        imagenes: [],
        visualPairs,
        lecturaItems: editorKind === "lecturaHse" ? [] : lecturaItems,
        lecturaHseVf,
        lecturaHseArrastre,
        recordemosItems,
        socialCasos,
        evaluacionItems,
      },
    });
  } catch (e) {
    console.error("getNivelEditor", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo editor del nivel",
    });
  }
};

// GUARDAR LOS CAMBIOS DEL EDITOR DE UN NIVEL
// PUT /api/admin/niveles/:nivelKey/editor
exports.updateNivelEditor = async (req, res) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    const nivelKey = toInt(req.params.nivelKey);
    if (!nivelKey) {
      return res.status(400).json({ success: false, message: "nivelKey inválido" });
    }

    if (!pool) {
      return res.status(500).json({ success: false, message: "Sin conexión a la base de datos" });
    }

    const metaRow = await pool
      .request()
      .input("nivelKey", sql.Int, nivelKey)
      .query(`
        SELECT TOP 1 ISLAS_KEY, NIVELES_NOMBRE
        FROM dbo.Onboarding_Niveles
        WHERE NIVELES_KEY = @nivelKey
      `);

    const islaKeyDb = toInt(metaRow.recordset?.[0]?.ISLAS_KEY);
    const nombreNivelDb = String(metaRow.recordset?.[0]?.NIVELES_NOMBRE ?? "");

    const body = req.body || {};
    const titulo = String(body.titulo ?? "");
    const descripcion = String(body.descripcion ?? "");

    let editorKind = String(body.editorKind || "").trim();
    if (!editorKind) editorKind = computeEditorKind(islaKeyDb, nombreNivelDb);

    const visualPairs = Array.isArray(body.visualPairs) ? body.visualPairs : null;
    const lecturaItems =
      Array.isArray(body.lecturaItems) ? normalizeLecturaItems(body.lecturaItems) : null;
    const recordemosItems = Array.isArray(body.recordemosItems)
      ? normalizeRecordemosItems(body.recordemosItems)
      : null;
    const socialCasos = Array.isArray(body.socialCasos)
      ? normalizeSocialCasos(body.socialCasos)
      : null;
    const evaluacionItems = Array.isArray(body.evaluacionItems)
      ? normalizeEvaluacionItems(body.evaluacionItems)
      : null;

    await tx.begin();

    await new sql.Request(tx)
      .input("nivelKey", sql.Int, nivelKey)
      .input("titulo", sql.NVarChar, titulo)
      .input("descripcion", sql.NVarChar, descripcion)
      .query(`
        UPDATE dbo.Onboarding_Niveles
        SET
          NIVELES_TITULO = @titulo,
          NIVELES_DESCRIPCION = @descripcion,
          NIVELES_MODIFICACION = GETDATE()
        WHERE NIVELES_KEY = @nivelKey
      `);

    if (editorKind === "visual" && visualPairs) {
      for (const p of visualPairs) {
        const visualKey = toInt(p?.id ?? p?.VISUAL_KEY ?? null);
        if (!visualKey) continue;

        const foto = toRelUploadPath(p?.imagen);
        const concepto = toRelUploadPath(p?.imagenRespuesta);

        await new sql.Request(tx)
          .input("nivelKey", sql.Int, nivelKey)
          .input("visualKey", sql.Int, visualKey)
          .input("foto", sql.NVarChar(500), foto)
          .input("concepto", sql.NVarChar(500), concepto)
          .query(`
            UPDATE dbo.Onboarding_Visual
            SET
              VISUAL_IMAGEN_FOTO = COALESCE(@foto, VISUAL_IMAGEN_FOTO),
              VISUAL_IMAGEN_CONCEPTO = COALESCE(@concepto, VISUAL_IMAGEN_CONCEPTO),
              VISUAL_MODIFICACION = GETDATE()
            WHERE NIVELES_KEY = @nivelKey
              AND VISUAL_KEY = @visualKey
          `);
      }
    }

    if (
      (editorKind === "lectura" || editorKind === "lecturaHse") &&
      lecturaItems != null
    ) {
      await new sql.Request(tx)
        .input("nivelKey", sql.Int, nivelKey)
        .query(`DELETE FROM dbo.Onboarding_Lectura WHERE NIVELES_KEY = @nivelKey`);

      const maxIdQ = await new sql.Request(tx).query(`SELECT ISNULL(MAX(LECTURA_KEY), 0) + 1 as NEXT_ID FROM dbo.Onboarding_Lectura`);
      let nextId = maxIdQ.recordset[0].NEXT_ID;

      for (const it of lecturaItems) {
        const r = it.respuestas || Array(10).fill("");

        await new sql.Request(tx)
          .input("id", sql.Int, nextId)
          .input("nivelKey", sql.Int, nivelKey)
          .input("antes", sql.NVarChar(sql.MAX), it.antes)
          .input("despues", sql.NVarChar(sql.MAX), it.despues)
          .input("r1", sql.NVarChar(255), r[0] ?? "")
          .input("r2", sql.NVarChar(255), r[1] ?? "")
          .input("r3", sql.NVarChar(255), r[2] ?? "")
          .input("r4", sql.NVarChar(255), r[3] ?? "")
          .input("r5", sql.NVarChar(255), r[4] ?? "")
          .input("r6", sql.NVarChar(255), r[5] ?? "")
          .input("r7", sql.NVarChar(255), r[6] ?? "")
          .input("r8", sql.NVarChar(255), r[7] ?? "")
          .input("r9", sql.NVarChar(255), r[8] ?? "")
          .input("r10", sql.NVarChar(255), r[9] ?? "")
          .input("correcta", sql.NVarChar(10), String(it.correcta))
          .query(`
            INSERT INTO dbo.Onboarding_Lectura
              (LECTURA_KEY, NIVELES_KEY, LECTURA_ANTES, LECTURA_DESPUES,
               LECTURA_RESPUESTA_1, LECTURA_RESPUESTA_2, LECTURA_RESPUESTA_3, LECTURA_RESPUESTA_4, LECTURA_RESPUESTA_5,
               LECTURA_RESPUESTA_6, LECTURA_RESPUESTA_7, LECTURA_RESPUESTA_8, LECTURA_RESPUESTA_9, LECTURA_RESPUESTA_10,
               LECTURA_CORRECTA, LECTURA_ESTATUS, LECTURA_CREACION, LECTURA_MODIFICACION)
            VALUES
              (@id, @nivelKey, @antes, @despues,
               @r1, @r2, @r3, @r4, @r5,
               @r6, @r7, @r8, @r9, @r10,
               @correcta, 1, GETDATE(), GETDATE())
          `);
        nextId++;
      }
    }

    // Guardar Recordemos - usando IDENTITY_INSERT
    if (editorKind === "recordemos" && recordemosItems != null) {
      await new sql.Request(tx)
        .input("nivelKey", sql.Int, nivelKey)
        .query(`DELETE FROM dbo.Onboarding_Recordemos WHERE NIVELES_KEY = @nivelKey`);

      const maxIdQ = await new sql.Request(tx).query(`SELECT ISNULL(MAX(RECORDEMOS_KEY), 0) + 1 as NEXT_ID FROM dbo.Onboarding_Recordemos`);
      let nextId = maxIdQ.recordset[0].NEXT_ID;

      for (const it of recordemosItems) {
        await new sql.Request(tx)
          .input("id", sql.Int, nextId)
          .input("nivelKey", sql.Int, nivelKey)
          .input("palabra", sql.NVarChar(sql.MAX), it.concepto)
          .input("concepto", sql.NVarChar(sql.MAX), it.descripcion)
          .query(`
            INSERT INTO dbo.Onboarding_Recordemos (RECORDEMOS_KEY, NIVELES_KEY, RECORDEMOS_PALABRA, RECORDEMOS_CONCEPTO)
            VALUES (@id, @nivelKey, @palabra, @concepto)
          `);
        nextId++;
      }
    }

    // Guardar Social - usando IDENTITY_INSERT
    if (editorKind === "social" && socialCasos != null) {
      await new sql.Request(tx)
        .input("nivelKey", sql.Int, nivelKey)
        .query(`DELETE FROM dbo.Onboarding_Social WHERE NIVELES_KEY = @nivelKey`);

      // Obtener el max ID actual
      const maxIdQ = await new sql.Request(tx).query(`SELECT ISNULL(MAX(SOCIAL_KEY), 0) + 1 as NEXT_ID FROM dbo.Onboarding_Social`);
      let nextId = maxIdQ.recordset[0].NEXT_ID;

      for (const it of socialCasos) {
        const corrNum = it.correcta === "a" ? 1 : it.correcta === "b" ? 2 : it.correcta === "c" ? 3 : 1;
        await new sql.Request(tx)
          .input("id", sql.Int, nextId)
          .input("nivelKey", sql.Int, nivelKey)
          .input("caso", sql.NVarChar(sql.MAX), it.caso)
          .input("r1", sql.NVarChar(sql.MAX), it.opcionA)
          .input("r2", sql.NVarChar(sql.MAX), it.opcionB)
          .input("r3", sql.NVarChar(sql.MAX), it.opcionC)
          .input("corr", sql.Int, corrNum)
          .query(`
            INSERT INTO dbo.Onboarding_Social (SOCIAL_KEY, NIVELES_KEY, SOCIAL_CASO, SOCIAL_RESPUESTA_1, SOCIAL_RESPUESTA_2, SOCIAL_RESPUESTA_3, SOCIAL_CORRECTA, SOCIAL_ESTATUS)
            VALUES (@id, @nivelKey, @caso, @r1, @r2, @r3, @corr, 1)
          `);
        nextId++;
      }
    }

    // Guardar Evaluacion - filtrar por EVALUACION_COD
    if (editorKind === "evaluacion" && evaluacionItems != null) {
      await new sql.Request(tx)
        .input("nivelKey", sql.Int, nivelKey)
        .query(`DELETE FROM dbo.Onboarding_Evaluacion WHERE EVALUACION_COD = @nivelKey`);

      // EVALUACION_KEY es columna IDENTITY en la base (verificado contra
      // AGP_RRHH). Por eso NO se envía: la asigna SQL Server. Antes se
      // calculaba con MAX(EVALUACION_KEY)+1 y se insertaba explícita, lo que
      // hacía fallar siempre este guardado con "Cannot insert explicit value
      // for identity column ... when IDENTITY_INSERT is set to OFF".
      // Dejar que la asigne la base elimina además la condición de carrera
      // que tenía el MAX+1 con dos administradores guardando a la vez.
      for (const it of evaluacionItems) {
        const corrNum = it.correcta === "a" ? 1 : it.correcta === "b" ? 2 : it.correcta === "c" ? 3 : it.correcta === "d" ? 4 : 1;
        await new sql.Request(tx)
          .input("cod", sql.Int, nivelKey)
          .input("pregunta", sql.NVarChar(sql.MAX), it.pregunta)
          .input("a", sql.NVarChar(sql.MAX), it.opcionA)
          .input("b", sql.NVarChar(sql.MAX), it.opcionB)
          .input("c", sql.NVarChar(sql.MAX), it.opcionC)
          .input("d", sql.NVarChar(sql.MAX), it.opcionD)
          .input("corr", sql.Int, corrNum)
          .query(`
            INSERT INTO dbo.Onboarding_Evaluacion (EVALUACION_COD, EVALUACION_PREGUNTA, EVALUACION_RESPUESTA_1, EVALUACION_RESPUESTA_2, EVALUACION_RESPUESTA_3, EVALUACION_RESPUESTA_4, EVALUACION_CORRECTA, EVALUACION_ESTATUS)
            VALUES (@cod, @pregunta, @a, @b, @c, @d, @corr, 1)
          `);
      }
    }

    await tx.commit();
    return res.json({ success: true });
  } catch (e) {
    try {
      if (tx._aborted !== true) await tx.rollback();
    } catch {}
    console.error("updateNivelEditor", e);
    return res.status(500).json({
      success: false,
      message: e?.message || "Error actualizando el editor del nivel",
    });
  }
};

// OBTENER DETALLE DE RESULTADOS DE UN NIVEL ESPECIFICO
exports.getResultadosDetalle = async (req, res) => {
  try {
    const usuarioKey = toInt(req.query.usuarioKey);
    const nivelKey = toInt(req.query.nivelKey);

    if (!usuarioKey || !nivelKey) {
      return res.status(400).json({
        success: false,
        message: "usuarioKey y nivelKey son requeridos",
      });
    }

    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: "Sin conexión a la base de datos" });
    }

    const detQ = await pool
      .request()
      .input("usuarioKey", sql.Int, usuarioKey)
      .input("nivelKey", sql.Int, nivelKey)
      .query(`
        SELECT
          RESPUESTA_PREGUNTA,
          RESPUESTA_USUARIO
        FROM dbo.Onboarding_Respuestas
        WHERE USUARIO_KEY = @usuarioKey
          AND NIVELES_KEY = @nivelKey
        ORDER BY RESPUESTA_KEY ASC
      `);

    const data = (detQ.recordset || []).map((r, idx) => {
      const correcta = normStr(r.RESPUESTA_USUARIO) === normStr(r.RESPUESTA_PREGUNTA);

      return {
        id: idx + 1,
        pregunta: String(r.RESPUESTA_PREGUNTA ?? ""),
        respuesta: String(r.RESPUESTA_USUARIO ?? ""),
        correcta,
      };
    });

    const puntQ = await pool
      .request()
      .input("usuarioKey", sql.Int, usuarioKey)
      .input("nivelKey", sql.Int, nivelKey)
      .query(`
        SELECT TOP 1
          PUNTAJE,
          MISMATCHES,
          LIVES_LEFT,
          APROBADO,
          INTENTO,
          FECHA
        FROM dbo.Onboarding_Resultados_Nivel
        WHERE USUARIO_KEY = @usuarioKey
          AND NIVELES_KEY = @nivelKey
        ORDER BY FECHA DESC, INTENTO DESC
      `);

    const rowRN = puntQ.recordset?.[0];
    const puntajeFinal =
      rowRN?.PUNTAJE != null && rowRN?.PUNTAJE !== undefined
        ? Number(rowRN.PUNTAJE)
        : null;

    const resultadoNivel = rowRN
      ? {
          puntaje: Number(rowRN.PUNTAJE ?? 0),
          mismatches: rowRN.MISMATCHES != null ? Number(rowRN.MISMATCHES) : null,
          livesLeft: rowRN.LIVES_LEFT != null ? Number(rowRN.LIVES_LEFT) : null,
          aprobado:
            rowRN.APROBADO === true ||
            rowRN.APROBADO === 1 ||
            rowRN.APROBADO === "1",
          intento:
            rowRN.INTENTO != null && rowRN.INTENTO !== undefined
              ? Number(rowRN.INTENTO)
              : null,
          fecha: rowRN.FECHA ? String(rowRN.FECHA) : null,
        }
      : null;

    return res.json({ success: true, data, puntajeFinal, resultadoNivel });
  } catch (e) {
    console.error("getResultadosDetalle", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo detalle de resultados",
    });
  }
};

// OBTENER RESUMEN DE RESULTADOS DE TODOS LOS NIVELES DE UNA ISLA
exports.getResultadosResumen = async (req, res) => {
  try {
    const usuarioKey = toInt(req.query.usuarioKey);
    const islaKey = toInt(req.query.islaKey);

    if (!usuarioKey || !islaKey) {
      return res.status(400).json({
        success: false,
        message: "usuarioKey y islaKey son requeridos",
      });
    }

    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: "Sin conexión a la base de datos" });
    }

    // busca todos los niveles que pertenecen a esa isla
    const nivQ = await pool
      .request()
      .input("islaKey", sql.Int, islaKey)
      .query(`
        SELECT NIVELES_KEY
        FROM dbo.Onboarding_Niveles
        WHERE ISLAS_KEY = @islaKey
        ORDER BY NIVELES_KEY ASC
      `);

    const niveles = nivQ.recordset || [];
    const data = [];

    // para cada nivel, busca el ultimo puntaje que obtuvo el usuario
    for (const n of niveles) {
      const nivelKey = Number(n.NIVELES_KEY);

      const resQ = await pool
        .request()
        .input("usuarioKey", sql.Int, usuarioKey)
        .input("nivelKey", sql.Int, nivelKey)
        .query(`
          SELECT TOP 1 PUNTAJE
          FROM dbo.Onboarding_Resultados_Nivel
          WHERE USUARIO_KEY = @usuarioKey
            AND NIVELES_KEY = @nivelKey
          ORDER BY FECHA DESC
        `);

      const puntaje = resQ.recordset?.[0]?.PUNTAJE ?? null;

      data.push({
        nivelKey: String(nivelKey),
        porcentaje: puntaje,
      });
    }

    return res.json({ success: true, data });
  } catch (e) {
    console.error("getResultadosResumen", e);
    return res.status(500).json({
      success: false,
      message: "Error obteniendo resumen de resultados",
    });
  }
};

// REPORTE ADMIN: cohortes (# onboarding), participantes y matriz isla/nivel
// GET /api/admin/reportes/completo
exports.getReporteCompleto = async (req, res) => {
  try {
    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({ success: false, message: "Sin conexión a la base de datos" });
    }

    const usersQ = await pool.request().query(`
      SELECT
        USUARIO_KEY,
        USUARIO_NOMBRE,
        USUARIO_CEDULA,
        USUARIO_NUMERO_ONBOARDING
      FROM dbo.Onboarding_Usuarios_NEW
      ORDER BY USUARIO_NOMBRE ASC
    `);

    const nivelesQ = await pool.request().query(`
      SELECT
        n.NIVELES_KEY,
        n.ISLAS_KEY,
        n.NIVELES_NOMBRE,
        i.ISLAS_NOMBRE
      FROM dbo.Onboarding_Niveles n
      INNER JOIN dbo.Onboarding_Islas i ON i.ISLAS_KEY = n.ISLAS_KEY
      ORDER BY n.ISLAS_KEY ASC, n.NIVELES_KEY ASC
    `);

    const ultQ = await pool.request().query(`
      ;WITH UltimoNivel AS (
        SELECT
          USUARIO_KEY,
          NIVELES_KEY,
          PUNTAJE,
          ROW_NUMBER() OVER (
            PARTITION BY USUARIO_KEY, NIVELES_KEY
            ORDER BY FECHA DESC, INTENTO DESC
          ) AS rn
        FROM dbo.Onboarding_Resultados_Nivel
      )
      SELECT USUARIO_KEY, NIVELES_KEY, PUNTAJE
      FROM UltimoNivel
      WHERE rn = 1
    `);

    const scoreMap = new Map();
    for (const r of ultQ.recordset || []) {
      const uk = Number(r.USUARIO_KEY);
      const nk = Number(r.NIVELES_KEY);
      const p = r.PUNTAJE != null ? Number(r.PUNTAJE) : null;
      if (Number.isFinite(uk) && Number.isFinite(nk) && p != null && !Number.isNaN(p)) {
        scoreMap.set(`${uk}_${nk}`, Math.max(0, Math.min(100, Math.round(p))));
      }
    }

    const islasMap = new Map();
    for (const n of nivelesQ.recordset || []) {
      const ik = Number(n.ISLAS_KEY);
      if (!Number.isFinite(ik)) continue;
      if (!islasMap.has(ik)) {
        islasMap.set(ik, {
          islaKey: ik,
          islaNombre: String(n.ISLAS_NOMBRE ?? `Isla ${ik}`),
          niveles: [],
        });
      }
      islasMap.get(ik).niveles.push({
        nivelKey: Number(n.NIVELES_KEY),
        nivelNombre: String(n.NIVELES_NOMBRE ?? ""),
      });
    }

    const islasOrdenadas = [...islasMap.values()].sort((a, b) => a.islaKey - b.islaKey);

    const participantes = [];
    for (const u of usersQ.recordset || []) {
      const uk = Number(u.USUARIO_KEY);
      if (!Number.isFinite(uk)) continue;

      let sumGlobal = 0;
      let nGlobal = 0;
      const porIsla = [];

      for (const isla of islasOrdenadas) {
        let sumIsla = 0;
        let nIsla = 0;
        const nivelesDet = [];

        for (const nv of isla.niveles) {
          const raw = scoreMap.get(`${uk}_${nv.nivelKey}`);
          const val = raw != null ? raw : null;
          if (val != null) {
            sumGlobal += val;
            nGlobal += 1;
            sumIsla += val;
            nIsla += 1;
          }
          nivelesDet.push({
            nivelKey: nv.nivelKey,
            nivelNombre: nv.nivelNombre,
            puntaje: val,
          });
        }

        porIsla.push({
          islaKey: isla.islaKey,
          islaNombre: isla.islaNombre,
          promedio: nIsla > 0 ? Math.round(sumIsla / nIsla) : null,
          niveles: nivelesDet,
        });
      }

      participantes.push({
        usuarioKey: uk,
        nombre: String(u.USUARIO_NOMBRE ?? ""),
        cedula: String(u.USUARIO_CEDULA ?? ""),
        numeroOnboarding: Number(u.USUARIO_NUMERO_ONBOARDING ?? 0) || 0,
        promedioGeneral: nGlobal > 0 ? Math.round(sumGlobal / nGlobal) : null,
        porIsla,
      });
    }

    const cohortMap = new Map();
    for (const p of participantes) {
      const num = p.numeroOnboarding;
      if (!cohortMap.has(num)) {
        cohortMap.set(num, { participantes: 0, sumaProm: 0, nProm: 0 });
      }
      const c = cohortMap.get(num);
      c.participantes += 1;
      if (p.promedioGeneral != null) {
        c.sumaProm += p.promedioGeneral;
        c.nProm += 1;
      }
    }

    const cohortes = [...cohortMap.entries()]
      .map(([numeroOnboarding, v]) => ({
        numeroOnboarding,
        participantes: v.participantes,
        promedioAvance: v.nProm > 0 ? Math.round(v.sumaProm / v.nProm) : null,
      }))
      .sort((a, b) => a.numeroOnboarding - b.numeroOnboarding);

    return res.json({
      success: true,
      data: {
        generado: new Date().toISOString(),
        cohortes,
        participantes,
        islas: islasOrdenadas,
      },
    });
  } catch (e) {
    console.error("getReporteCompleto", e);
    return res.status(500).json({
      success: false,
      message: e?.message || "Error generando reporte",
    });
  }
};
