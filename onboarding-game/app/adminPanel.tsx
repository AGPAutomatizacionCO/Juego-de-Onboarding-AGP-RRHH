import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import {
  Alert,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* ===== RESPONSIVE HELPER ===== */
const { width: SW, height: SH, width: screenWidth } = Dimensions.get("window");
const isPhone = Math.min(SW, SH) < 600;
const BASE_W = isPhone ? 375 : 1280;
const BASE_H = isPhone ? 667 : 800;
const RS = Math.max(Math.min(SW / BASE_W, SH / BASE_H), isPhone ? 0.85 : 0.55);
const sp = (v: number) => RS * v; // scale points - responsive

/* ===== TIPOS ===== */

type MenuOption = "panel" | "edicion" | "reporte";

interface Nivel {
  id: string;
  nombre: string;
  porcentaje?: number;
}

interface Isla {
  id: string;
  nombre: string;
  niveles: Nivel[];
}

type VisualPair = {
  id?: number | string;
  imagen: string;
  imagenRespuesta: string;
};

type LecturaItem = {
  id?: number | string;
  antes: string;
  despues: string;
  respuestas: string[];
  correcta: string;
};

type LecturaHseVfItem = {
  id?: number | string;
  texto: string;
  correcta: boolean;
};

type LecturaHseArrItem = {
  id?: number | string;
  texto: string;
  correcta: "RIESGO" | "PELIGRO";
};

type RecordemosEditItem = {
  id?: number | string;
  concepto: string;
  descripcion: string;
};

type SocialCasoEdit = {
  id?: number | string;
  caso: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  correcta: "a" | "b" | "c";
  explicacion: string;
};

type EvaluacionEditItem = {
  id?: number | string;
  pregunta: string;
  opcionA: string;
  opcionB: string;
  opcionC: string;
  opcionD: string;
  correcta: "a" | "b" | "c" | "d";
};

type EditorKind =
  | "visual"
  | "lectura"
  | "lecturaHse"
  | "recordemos"
  | "social"
  | "evaluacion"
  | "generico";

interface EditorData {
  titulo: string;
  descripcion: string;
  preguntas: string[];
  respuestas: string[];
  imagenes: string[];
  visualPairs?: VisualPair[];
  lecturaItems?: LecturaItem[];
  lecturaHseVf?: LecturaHseVfItem[];
  lecturaHseArrastre?: LecturaHseArrItem[];
  recordemosItems?: RecordemosEditItem[];
  socialCasos?: SocialCasoEdit[];
  evaluacionItems?: EvaluacionEditItem[];
}

function emptyEditorData(): EditorData {
  return {
    titulo: "",
    descripcion: "",
    preguntas: [],
    respuestas: [],
    imagenes: [],
    visualPairs: [],
    lecturaItems: [],
    lecturaHseVf: [],
    lecturaHseArrastre: [],
    recordemosItems: [],
    socialCasos: [],
    evaluacionItems: [],
  };
}

function lecturaPayloadFromHse(
  vf: LecturaHseVfItem[] | undefined,
  arr: LecturaHseArrItem[] | undefined
): LecturaItem[] {
  const rows: LecturaItem[] = [];
  for (const x of vf || []) {
    rows.push({
      antes: String(x?.texto ?? ""),
      despues: "",
      respuestas: Array(10).fill(""),
      correcta: x?.correcta ? "true" : "false",
    });
  }
  for (const x of arr || []) {
    rows.push({
      antes: String(x?.texto ?? ""),
      despues: "",
      respuestas: Array(10).fill(""),
      correcta: x?.correcta === "PELIGRO" ? "PELIGRO" : "RIESGO",
    });
  }
  return rows;
}

interface ReporteCohorte {
  numeroOnboarding: number;
  participantes: number;
  promedioAvance: number | null;
}

interface ReporteNivelCell {
  nivelKey: number;
  nivelNombre: string;
  puntaje: number | null;
}

interface ReporteIslaDetalle {
  islaKey: number;
  islaNombre: string;
  promedio: number | null;
  niveles: ReporteNivelCell[];
}

interface ReporteParticipanteFila {
  usuarioKey: number;
  nombre: string;
  cedula: string;
  numeroOnboarding: number;
  promedioGeneral: number | null;
  porIsla: ReporteIslaDetalle[];
}

interface ReporteIslaCatalogo {
  islaKey: number;
  islaNombre: string;
  niveles: { nivelKey: number; nivelNombre: string }[];
}

interface ReporteCompletoData {
  generado: string;
  cohortes: ReporteCohorte[];
  participantes: ReporteParticipanteFila[];
  islas: ReporteIslaCatalogo[];
}

function htmlEsc(s: string) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildReportPdfHtml(data: ReporteCompletoData) {
  const cohortRows = (data.cohortes || [])
    .map(
      (c) =>
        `<tr><td>${c.numeroOnboarding}</td><td>${c.participantes}</td><td>${c.promedioAvance != null ? `${c.promedioAvance}%` : "\u2014"}</td></tr>`
    )
    .join("");

  let thead =
    "<tr><th>Participante</th><th>C\u00e9dula</th><th># Onb.</th><th>Prom.</th>";
  for (const isla of data.islas || []) {
    for (const nv of isla.niveles || []) {
      thead += `<th>${htmlEsc(`I${isla.islaKey} ${nv.nivelNombre}`)}</th>`;
    }
  }
  thead += "</tr>";

  let body = "";
  for (const p of data.participantes || []) {
    body += "<tr>";
    body += `<td>${htmlEsc(p.nombre)}</td><td>${htmlEsc(p.cedula)}</td><td>${p.numeroOnboarding}</td><td style="text-align:center;font-weight:bold">${p.promedioGeneral != null ? `${p.promedioGeneral}%` : "\u2014"}</td>`;
    for (const isla of data.islas || []) {
      const bloque = p.porIsla?.find((x) => x.islaKey === isla.islaKey);
      for (const nv of isla.niveles || []) {
        const cell = bloque?.niveles?.find((n) => n.nivelKey === nv.nivelKey);
        const v = cell?.puntaje;
        const color = v != null ? (v >= 70 ? "#16A34A" : v >= 40 ? "#D97706" : "#DC2626") : "#999";
        body += `<td style="text-align:center;color:${color};font-weight:bold">${v != null ? `${v}%` : "\u2014"}</td>`;
      }
    }
    body += "</tr>";
  }

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><style>
body{font-family:system-ui,sans-serif;font-size:9px;color:#111;margin:12px;}
table{border-collapse:collapse;width:100%;margin-bottom:14px;}
th,td{border:1px solid #333;padding:4px 5px;}
th{background:#0F1B4C;color:#fff;font-size:8px;}
td{font-size:8px;}
h1{font-size:16px;color:#0F1B4C;margin-bottom:4px;}
h2{font-size:12px;color:#0F1B4C;margin-top:14px;margin-bottom:6px;}
p{color:#444;font-size:10px;}
.summary-card{background:#F0F4FF;border:1px solid #C7D2FE;border-radius:6px;padding:8px;margin-bottom:6px;}
</style></head><body>
<h1>Reporte Onboarding AGP</h1>
<p>Generado: ${htmlEsc(data.generado)}</p>
<h2>Resumen por numero de onboarding</h2>
<table><thead><tr><th># Onboarding</th><th>Participantes</th><th>Promedio avance (%)</th></tr></thead><tbody>${cohortRows}</tbody></table>
<h2>Detalle por participante y nivel (%)</h2>
<table><thead>${thead}</thead><tbody>${body}</tbody></table>
</body></html>`;
}

interface Pregunta {
  id: number;
  pregunta: string;
  respuesta: string;
  correcta: boolean;
}

type UsuarioEncontrado = {
  usuarioKey: number;
  nombre: string;
  cedula: string;
};

type ResultadoNivelMeta = {
  puntaje: number;
  mismatches: number | null;
  livesLeft: number | null;
  aprobado: boolean;
  intento: number | null;
  fecha: string | null;
  reintentoHabilitado: boolean;
};

function filasResumenResultadoNivel(meta: ResultadoNivelMeta | null) {
  if (!meta) return [] as { k: string; label: string; value: string }[];
  const rows: { k: string; label: string; value: string }[] = [];
  if (meta.mismatches != null && !Number.isNaN(meta.mismatches)) {
    rows.push({ k: "mm", label: "Errores / intentos fallidos", value: String(meta.mismatches) });
  }
  if (meta.livesLeft != null && !Number.isNaN(meta.livesLeft)) {
    rows.push({ k: "lv", label: "Vidas restantes", value: String(meta.livesLeft) });
  }
  rows.push({ k: "ap", label: "Aprobo", value: meta.aprobado ? "Si" : "No" });
  if (meta.intento != null && !Number.isNaN(meta.intento)) {
    rows.push({ k: "in", label: "Intento N.", value: String(meta.intento) });
  }
  if (meta.fecha) {
    rows.push({ k: "fe", label: "Fecha", value: meta.fecha });
  }
  return rows;
}

/* ===== HELPERS API ===== */

function normalizeBaseUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  return u.endsWith("/") ? u.slice(0, -1) : u;
}

async function apiJson(
  url: string,
  options?: RequestInit & { timeoutMs?: number }
) {
  const controller = new AbortController();
  const timeoutMs = options?.timeoutMs ?? 30000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(options?.headers || {}),
      },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) {
      const msg = data?.message || data?.error || `Error HTTP ${res.status}`;
      throw new Error(msg);
    }
    return data;
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Tiempo de espera agotado. Verifica que la API este encendida y que estes en la misma red WiFi.");
    }
    if (String(err?.message || "").toLowerCase().includes("network request failed")) {
      throw new Error("No se pudo conectar al API. Revisa: 1) API encendida, 2) IP correcta, 3) mismo WiFi, 4) puerto permitido.");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

/* ===== FALLBACK NIVELES ===== */
const NIVELES_FIJOS: Nivel[] = [
  { id: "1", nombre: "NIVEL 1 - Visual" },
  { id: "2", nombre: "NIVEL 2 - Lectura" },
  { id: "3", nombre: "NIVEL 3 - Recordemos" },
  { id: "4", nombre: "NIVEL 4 - Social" },
  { id: "5", nombre: "EVALUACION FINAL" },
];

function completarNiveles(nivelesBD: Nivel[], islaKey: number): Nivel[] {
  const mapa = new Map<string, Nivel>();
  for (const n of nivelesBD) {
    mapa.set(String(n.id), { id: String(n.id), nombre: String(n.nombre || ""), porcentaje: n.porcentaje });
  }

  // Calcular offset de niveles por isla (isla 1 = keys 1-5, isla 2 = keys 6-10, isla 3 = keys 11-15)
  const offset = (islaKey - 1) * 5;

  const resultado = NIVELES_FIJOS.map((base, idx) => {
    const expectedKey = String(offset + idx + 1);
    const desdeBD = mapa.get(expectedKey) || mapa.get(base.id);
    return {
      id: desdeBD?.id || expectedKey,
      nombre: desdeBD?.nombre?.trim() ? desdeBD.nombre : base.nombre,
      porcentaje: desdeBD?.porcentaje,
    };
  });

  // Si la BD tiene mas niveles mapeados que no estan en NIVELES_FIJOS, agregarlos
  if (nivelesBD.length > 0 && nivelesBD.length <= 5) {
    return nivelesBD.map((n, idx) => ({
      id: String(n.id),
      nombre: n.nombre?.trim() ? n.nombre : NIVELES_FIJOS[idx]?.nombre || `NIVEL ${idx + 1}`,
      porcentaje: n.porcentaje,
    }));
  }

  return resultado;
}

/* ===== COMPONENTE PRINCIPAL ===== */

export default function AdminPanel() {
  const router = useRouter();

  const API_URL = useMemo(() => {
    const raw = API_BASE_URL;
    return normalizeBaseUrl(raw);
  }, []);

  const [showLogin, setShowLogin] = useState<boolean>(true);
  const [adminUser, setAdminUser] = useState<string>("");
  const [adminPass, setAdminPass] = useState<string>("");

  const [menu, setMenu] = useState<MenuOption>("panel");

  const [islas, setIslas] = useState<Isla[]>([]);
  const [loadingIslas, setLoadingIslas] = useState<boolean>(false);

  // PANEL state
  const [selectedIslaPanel, setSelectedIslaPanel] = useState<Isla | null>(null);
  const [selectedNivelPanel, setSelectedNivelPanel] = useState<Nivel | null>(null);
  const [searchCC, setSearchCC] = useState<string>("");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [selectedUserObj, setSelectedUserObj] = useState<UsuarioEncontrado | null>(null);
  const [expandedNiveles, setExpandedNiveles] = useState<Set<string>>(new Set());

  const [detalleNivel, setDetalleNivel] = useState<Pregunta[] | null>(null);
  const [puntajeNivel, setPuntajeNivel] = useState<number | null>(null);
  const [resultadoNivelMeta, setResultadoNivelMeta] = useState<ResultadoNivelMeta | null>(null);
  const [loadingDetalle, setLoadingDetalle] = useState<boolean>(false);
  const [detalleCache, setDetalleCache] = useState<Map<string, { preguntas: Pregunta[]; puntaje: number | null; meta: ResultadoNivelMeta | null }>>(new Map());

  // EDICION state
  const [selectedIslaEdit, setSelectedIslaEdit] = useState<Isla | null>(null);
  const [selectedNivelEdit, setSelectedNivelEdit] = useState<Nivel | null>(null);
  const [editorData, setEditorData] = useState<EditorData>(emptyEditorData);
  const [editorKind, setEditorKind] = useState<EditorKind>("generico");
  const [loadingEditor, setLoadingEditor] = useState<boolean>(false);

  // REPORTE state
  const [reporteCompleto, setReporteCompleto] = useState<ReporteCompletoData | null>(null);
  const [loadingReporte, setLoadingReporte] = useState<boolean>(false);
  const [exportandoPdf, setExportandoPdf] = useState<boolean>(false);

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
  });

  const fondo = require("../assets/islas/fondogeneral.png");

  if (!loaded) {
    return (
      <View style={styles.cargando}>
        <Text>Cargando fuentes...</Text>
      </View>
    );
  }

  /* ========================= PICK + UPLOAD ========================= */

  const pickImageFromDevice = useCallback(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permiso requerido", "Necesito permiso para acceder a tus fotos.");
      return null;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (res.canceled) return null;
    return res.assets?.[0]?.uri ?? null;
  }, []);

  const uploadImageToServer = useCallback(
    async (localUri: string) => {
      const filename = localUri.split("/").pop() || `img_${Date.now()}.jpg`;
      const ext = filename.split(".").pop()?.toLowerCase();
      const type = ext === "png" ? "image/png" : "image/jpeg";
      const form = new FormData();
      form.append("image", { uri: localUri, name: filename, type } as any);
      const res = await fetch(`${API_URL}/api/admin/uploads/image`, { method: "POST", body: form });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) throw new Error(json?.message || `Error subiendo imagen (HTTP ${res.status})`);
      const rel = String(json.url || "");
      return rel.startsWith("http") ? rel : `${API_URL}${rel}`;
    },
    [API_URL]
  );

  const reemplazarImagenVisual = useCallback(
    async (pairIdx: number, side: "imagen" | "imagenRespuesta") => {
      try {
        const uri = await pickImageFromDevice();
        if (!uri) return;
        const url = await uploadImageToServer(uri);
        setEditorData((prev) => {
          const visualPairs = [...(prev.visualPairs || [])];
          const current = visualPairs[pairIdx] || { imagen: "", imagenRespuesta: "" };
          visualPairs[pairIdx] = { ...current, [side]: url } as VisualPair;
          return { ...prev, visualPairs };
        });
        Alert.alert("Imagen actualizada", "Recuerda pulsar Guardar cambios para persistir en la base de datos.");
      } catch (e: any) {
        Alert.alert("Error", e?.message || "No se pudo subir/reemplazar la imagen.");
      }
    },
    [pickImageFromDevice, uploadImageToServer]
  );

  /* ========================= LABEL DE NIVEL ========================= */

  const labelNivel = useCallback((n: any) => {
    const nombre = String(n?.NIVELES_NOMBRE || n?.nombre || "").toLowerCase();
    if (nombre.includes("visual")) return "NIVEL 1 - Visual";
    if (nombre.includes("lectura")) return "NIVEL 2 - Lectura";
    if (nombre.includes("record")) return "NIVEL 3 - Recordemos";
    if (nombre.includes("social")) return "NIVEL 4 - Social";
    if (nombre.includes("evalu")) return "EVALUACION FINAL";
    return String(n?.NIVELES_TITULO || n?.NIVELES_NOMBRE || "NIVEL");
  }, []);

  /* ========================= CARGA ISLAS ========================= */

  const cargarTodasLasIslas = useCallback(async () => {
    if (!API_URL) {
      Alert.alert("Error", "API_URL esta vacio. Revisa EXPO_PUBLIC_API_URL.");
      return;
    }
    setLoadingIslas(true);
    try {
      const cat = await apiJson(`${API_URL}/api/islas/catalogo`, { method: "GET", timeoutMs: 30000 });
      const lista = Array.isArray(cat?.data) ? cat.data : Array.isArray(cat) ? cat : [];
      const islasCargadas: Isla[] = [];

      for (const islaBD of lista) {
        const islaKey = Number(islaBD?.ISLAS_KEY);
        if (!islaKey || Number.isNaN(islaKey)) continue;
        const nombreIsla = String(islaBD?.ISLAS_NOMBRE ?? `Isla ${islaKey}`);
        try {
          const niv = await apiJson(`${API_URL}/api/islas/${islaKey}/niveles`, { method: "GET", timeoutMs: 30000 });
          const nivelesBD = Array.isArray(niv?.data) ? niv.data : Array.isArray(niv) ? niv : [];
          const nivelesMapeados = nivelesBD.map((n: any) => ({
            id: String(n?.NIVELES_KEY),
            nombre: labelNivel(n),
          }));
          islasCargadas.push({
            id: String(islaKey),
            nombre: `ISLA ${islaKey} - ${nombreIsla}`,
            niveles: nivelesMapeados.length >= 5 ? nivelesMapeados : completarNiveles(nivelesMapeados, islaKey),
          });
        } catch (e) {
          console.warn(`Error cargando niveles de Isla ${islaKey}:`, e);
        }
      }
      setIslas(islasCargadas.length > 0 ? islasCargadas : []);
    } catch (e: any) {
      console.error(e);
      Alert.alert("Error", e?.message || "No se pudieron cargar las islas");
      setIslas([]);
    } finally {
      setLoadingIslas(false);
    }
  }, [API_URL, labelNivel]);

  useEffect(() => {
    if (!showLogin) cargarTodasLasIslas();
  }, [showLogin, cargarTodasLasIslas]);

  /* ========================= REPORTE ========================= */

  const cargarReporteCompleto = useCallback(async () => {
    setLoadingReporte(true);
    try {
      const r = await apiJson(`${API_URL}/api/admin/reportes/completo`, { method: "GET", timeoutMs: 60000 });
      const d = r?.data;
      setReporteCompleto(d && typeof d === "object" ? (d as ReporteCompletoData) : null);
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo cargar el reporte.");
      setReporteCompleto(null);
    } finally {
      setLoadingReporte(false);
    }
  }, [API_URL]);

  useEffect(() => {
    if (!showLogin && menu === "reporte") cargarReporteCompleto();
  }, [showLogin, menu, cargarReporteCompleto]);

  const exportarReportePdf = useCallback(async () => {
    if (!reporteCompleto) {
      Alert.alert("Sin datos", "Actualiza el reporte antes de exportar.");
      return;
    }
    setExportandoPdf(true);
    try {
      const html = buildReportPdfHtml(reporteCompleto);
      const { uri } = await Print.printToFileAsync({ html, width: 842, height: 595 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Compartir o guardar reporte PDF" });
      } else {
        Alert.alert("PDF generado", `Archivo en:\n${uri}`);
      }
    } catch (e: any) {
      Alert.alert("PDF", e?.message || "No se pudo generar el PDF.");
    } finally {
      setExportandoPdf(false);
    }
  }, [reporteCompleto]);

  /* ========================= LOGIN ========================= */

  const validarAdmin = useCallback(async () => {
     // 👇 PONLO AQUÍ
  await AsyncStorage.clear();
  console.log("🧹 STORAGE LIMPIADO");
  
    if (!adminUser.trim() || !adminPass.trim()) {
      Alert.alert("Dato faltante", "Ingresa usuario y contrasena.");
      return;
    }
    const url = `${API_URL}/admin/auth/login`;
    console.log("[ADMIN] Intentando login en:", url, "user:", adminUser.trim());
    try {
      const resp = await apiJson(url, {
        method: "POST",
        body: JSON.stringify({ user: adminUser.trim(), pass: adminPass.trim() }),
        timeoutMs: 30000,
      });
      console.log("[ADMIN] Respuesta:", JSON.stringify(resp));
      if (resp?.success) { setShowLogin(false); return; }
      Alert.alert("Acceso denegado", resp?.message || "Usuario o contrasena incorrectos.");
    } catch (e: any) {
      console.log("[ADMIN] Error login:", e?.message || e);
      Alert.alert("Error de conexion", `URL: ${url}\n\nError: ${e?.message || "Desconocido"}\n\nVerifica que:\n1. El backend este corriendo\n2. La IP sea correcta\n3. Estes en la misma red WiFi`);
    }
  }, [API_URL, adminUser, adminPass]);

  /* ========================= PORCENTAJES ========================= */

  const cargarPorcentajesUsuario = useCallback(
    async (usuarioKey: number, islaId?: string) => {
      try {
        const targetIsla = islaId || selectedIslaPanel?.id || "1";
        const r = await apiJson(
          `${API_URL}/api/admin/resultados/resumen?usuarioKey=${usuarioKey}&islaKey=${targetIsla}`,
          { method: "GET", timeoutMs: 30000 }
        );
        const arr = Array.isArray(r?.data) ? r.data : Array.isArray(r) ? r : [];
        const map = new Map<string, number>();
        arr.forEach((x: any) => {
          const k = String(x?.nivelKey ?? x?.NIVELES_KEY ?? x?.nivel ?? "");
          const p = Number(x?.porcentaje ?? x?.PORCENTAJE ?? x?.puntaje ?? NaN);
          if (k && !Number.isNaN(p)) map.set(k, Math.max(0, Math.min(100, Math.round(p))));
        });
        setIslas((prev) =>
          prev.map((isla) =>
            isla.id !== targetIsla
              ? isla
              : { ...isla, niveles: isla.niveles.map((n) => ({ ...n, porcentaje: map.has(n.id) ? map.get(n.id) : n.porcentaje })) }
          )
        );
      } catch {}
    },
    [API_URL, selectedIslaPanel]
  );

  /* ========================= BUSCAR USUARIO ========================= */

  const buscarUsuarioPorCC = useCallback(async () => {
    try {
      const cc = searchCC.trim();
      if (!cc) { Alert.alert("Dato faltante", "Ingresa una cedula."); return; }
      let r: any = null;
      try {
        r = await apiJson(`${API_URL}/api/usuarios/buscar?cedula=${encodeURIComponent(cc)}`, { method: "GET", timeoutMs: 30000 });
      } catch {
        r = await apiJson(`${API_URL}/api/usuarios/login`, { method: "POST", body: JSON.stringify({ cedula: cc }), timeoutMs: 30000 });
      }
      const u = r?.data || r?.usuario || r;
      if (!u) { setSelectedUser("No encontrado"); setSelectedUserObj(null); return; }
      const usuarioKey = Number(u.USUARIO_KEY ?? u.usuarioKey ?? u.id);
      if (!usuarioKey || Number.isNaN(usuarioKey)) { setSelectedUser("No encontrado"); setSelectedUserObj(null); return; }
      const nombre = String(u.USUARIO_NOMBRE ?? u.nombre ?? "");
      const cedula = String(u.USUARIO_CEDULA ?? u.cedula ?? cc);
      setSelectedUserObj({ usuarioKey, nombre, cedula });
      setSelectedUser(`${nombre} - CC ${cedula}`);
      setExpandedNiveles(new Set());
      setDetalleCache(new Map());
      await cargarPorcentajesUsuario(usuarioKey, selectedIslaPanel?.id);
    } catch (e: any) {
      setSelectedUserObj(null);
      setSelectedUser(null);
      Alert.alert("Error", e?.message || "No se pudo buscar el usuario.");
    }
  }, [API_URL, searchCC, cargarPorcentajesUsuario, selectedIslaPanel?.id]);

  /* ========================= DETALLE DEL NIVEL (para panel inline) ========================= */

  const cargarDetalleNivelInline = useCallback(
    async (nivel: Nivel) => {
      if (!selectedUserObj) {
        Alert.alert("Primero busca un usuario", "Ingresa la cedula y busca.");
        return;
      }
      // Toggle expand
      setExpandedNiveles((prev) => {
        const next = new Set(prev);
        if (next.has(nivel.id)) { next.delete(nivel.id); } else { next.add(nivel.id); }
        return next;
      });
      // Load if not cached
      if (detalleCache.has(nivel.id)) return;
      try {
        const r = await apiJson(
          `${API_URL}/api/admin/resultados/detalle?usuarioKey=${selectedUserObj.usuarioKey}&nivelKey=${nivel.id}`,
          { method: "GET", timeoutMs: 30000 }
        );
        const data: Pregunta[] = Array.isArray(r?.data) ? r.data : [];
        const rawMeta = r?.resultadoNivel;
        const meta: ResultadoNivelMeta | null = rawMeta
          ? {
              puntaje: Number(rawMeta.puntaje ?? 0),
              mismatches: rawMeta.mismatches != null ? Number(rawMeta.mismatches) : null,
              livesLeft: rawMeta.livesLeft != null ? Number(rawMeta.livesLeft) : null,
              aprobado: Boolean(rawMeta.aprobado),
              intento: rawMeta.intento != null ? Number(rawMeta.intento) : null,
              fecha: rawMeta.fecha != null ? String(rawMeta.fecha) : null,
              reintentoHabilitado: Boolean(rawMeta.reintentoHabilitado),
            }
          : null;
        const p = r?.puntajeFinal;
        let puntaje: number | null = null;
        if (typeof p === "number" && !Number.isNaN(p)) puntaje = Math.round(p);
        else if (rawMeta?.puntaje != null) puntaje = Math.round(Number(rawMeta.puntaje));
        else if (data.length > 0) {
          const ok = data.filter((x) => x.correcta).length;
          puntaje = Math.round((ok / data.length) * 100);
        }
        setDetalleCache((prev) => {
          const next = new Map(prev);
          next.set(nivel.id, { preguntas: data, puntaje, meta });
          return next;
        });
      } catch (e: any) {
        // Silently fail - the expand will show "sin datos"
      }
    },
    [API_URL, selectedUserObj, detalleCache]
  );

  /* ========================= REINTENTO ========================= */

  const [reintentoLoading, setReintentoLoading] = useState<string | null>(null);

  const toggleReintento = useCallback(
    async (nivel: Nivel, habilitar: boolean) => {
      if (!selectedUserObj) return;
      setReintentoLoading(nivel.id);
      try {
        await apiJson(`${API_URL}/api/admin/resultados/reintento`, {
          method: "POST",
          body: JSON.stringify({
            usuarioKey: selectedUserObj.usuarioKey,
            nivelKey: Number(nivel.id),
            habilitar,
          }),
          timeoutMs: 30000,
        });
        setDetalleCache((prev) => {
          const next = new Map(prev);
          const cur = next.get(nivel.id);
          if (cur?.meta) {
            next.set(nivel.id, { ...cur, meta: { ...cur.meta, reintentoHabilitado: habilitar } });
          }
          return next;
        });
      } catch (e: any) {
        Alert.alert("Error", e?.message || "No se pudo actualizar el permiso de reintento.");
      } finally {
        setReintentoLoading(null);
      }
    },
    [API_URL, selectedUserObj]
  );

  /* ========================= EDITOR ========================= */

  const normalizeLecturaItems = (raw: any): LecturaItem[] => {
    const arr = Array.isArray(raw) ? raw : [];
    return arr.map((x: any) => {
      const respuestas: string[] = [];
      if (Array.isArray(x?.respuestas)) {
        for (let i = 0; i < 10; i++) respuestas.push(String(x.respuestas?.[i] ?? ""));
      } else {
        for (let i = 1; i <= 10; i++) respuestas.push(String(x?.[`LECTURA_RESPUESTA_${i}`] ?? x?.[`respuesta_${i}`] ?? ""));
      }
      return {
        id: x?.id ?? x?.LECTURA_KEY ?? undefined,
        antes: String(x?.antes ?? x?.LECTURA_ANTES ?? ""),
        despues: String(x?.despues ?? x?.LECTURA_DESPUES ?? ""),
        respuestas,
        correcta: String(x?.correcta ?? x?.LECTURA_CORRECTA ?? ""),
      };
    });
  };

  const cargarEditorNivel = useCallback(
    async (nivel: Nivel) => {
      setLoadingEditor(true);
      try {
        const url = `${API_URL}/api/admin/niveles/${nivel.id}/editor`;
        console.log("[DEBUG] Cargando editor:", url);
        const r = await apiJson(url, { method: "GET", timeoutMs: 30000 });
        console.log("[DEBUG] Respuesta editor:", JSON.stringify(r).substring(0, 500));
        
        const d = r?.data || r;
        const kind = String(d?.editorKind || "") as EditorKind;
        console.log("[DEBUG] editorKind:", kind, "data keys:", Object.keys(d || {}));
        setEditorKind(
          ["visual", "lectura", "lecturaHse", "recordemos", "social", "evaluacion"].includes(kind)
            ? (kind as EditorKind)
            : "generico"
        );

        const mapVisual = () =>
          Array.isArray(d?.visualPairs)
            ? d.visualPairs.map((x: any) => ({
                id: x?.id ?? x?.VISUAL_KEY ?? undefined,
                imagen: String(x?.imagen ?? x?.IMAGEN ?? x?.foto ?? ""),
                imagenRespuesta: String(x?.imagenRespuesta ?? x?.IMAGEN_RESPUESTA ?? x?.concepto ?? ""),
              }))
            : [];

        const mapLectura = () => (kind === "lectura" ? normalizeLecturaItems(d?.lecturaItems ?? d?.lecturas ?? d?.items ?? []) : []);

        const mapHseVf = (): LecturaHseVfItem[] =>
          Array.isArray(d?.lecturaHseVf)
            ? d.lecturaHseVf.map((x: any) => ({ id: x?.id, texto: String(x?.texto ?? ""), correcta: Boolean(x?.correcta) }))
            : [];

        const mapHseArr = (): LecturaHseArrItem[] =>
          Array.isArray(d?.lecturaHseArrastre)
            ? d.lecturaHseArrastre.map((x: any) => ({
                id: x?.id,
                texto: String(x?.texto ?? ""),
                correcta: String(x?.correcta ?? "RIESGO").toUpperCase() === "PELIGRO" ? "PELIGRO" : "RIESGO",
              }))
            : [];

        const mapRecordemos = (): RecordemosEditItem[] => {
          const items = Array.isArray(d?.recordemosItems) ? d.recordemosItems : [];
          console.log("[DEBUG] recordemosItems:", JSON.stringify(items).substring(0, 300));
          return items.map((x: any) => ({ id: x?.id, concepto: String(x?.concepto ?? ""), descripcion: String(x?.descripcion ?? "") }));
        };

        const mapSocial = (): SocialCasoEdit[] => {
          const items = Array.isArray(d?.socialCasos) ? d.socialCasos : [];
          console.log("[DEBUG] socialCasos:", JSON.stringify(items).substring(0, 300));
          return items.map((x: any) => {
            let c = String(x?.correcta ?? "a").toLowerCase().charAt(0);
            if (c !== "a" && c !== "b" && c !== "c") c = "a";
            return {
              id: x?.id, caso: String(x?.caso ?? ""), opcionA: String(x?.opcionA ?? ""),
              opcionB: String(x?.opcionB ?? ""), opcionC: String(x?.opcionC ?? ""),
              correcta: c as "a" | "b" | "c", explicacion: String(x?.explicacion ?? ""),
            };
          });
        };

        const mapEval = (): EvaluacionEditItem[] => {
          const items = Array.isArray(d?.evaluacionItems) ? d.evaluacionItems : [];
          console.log("[DEBUG] evaluacionItems:", JSON.stringify(items).substring(0, 300));
          return items.map((x: any) => {
            let c = String(x?.correcta ?? "a").toLowerCase().charAt(0);
            if (!["a", "b", "c", "d"].includes(c)) c = "a";
            return {
              id: x?.id, pregunta: String(x?.pregunta ?? ""), opcionA: String(x?.opcionA ?? ""),
              opcionB: String(x?.opcionB ?? ""), opcionC: String(x?.opcionC ?? ""),
              opcionD: String(x?.opcionD ?? ""), correcta: c as "a" | "b" | "c" | "d",
            };
          });
        };

        setEditorData({
          titulo: String(d?.titulo ?? ""),
          descripcion: String(d?.descripcion ?? ""),
          preguntas: Array.isArray(d?.preguntas) ? d.preguntas : [],
          respuestas: Array.isArray(d?.respuestas) ? d.respuestas : [],
          imagenes: Array.isArray(d?.imagenes) ? d.imagenes : [],
          visualPairs: kind === "visual" ? mapVisual() : [],
          lecturaItems: mapLectura(),
          lecturaHseVf: kind === "lecturaHse" ? mapHseVf() : [],
          lecturaHseArrastre: kind === "lecturaHse" ? mapHseArr() : [],
          recordemosItems: kind === "recordemos" ? mapRecordemos() : [],
          socialCasos: kind === "social" ? mapSocial() : [],
          evaluacionItems: kind === "evaluacion" ? mapEval() : [],
        });
      } catch (e: any) {
        Alert.alert("Error cargando editor", e?.message || `No se pudo cargar el editor del nivel ${nivel.id}`);
        setEditorKind("generico");
        setEditorData(emptyEditorData());
      } finally {
        setLoadingEditor(false);
      }
    },
    [API_URL]
  );

  const guardarEditorNivel = useCallback(async () => {
    if (!selectedNivelEdit) return;
    try {
      const lecturaOut =
        editorKind === "lecturaHse"
          ? lecturaPayloadFromHse(editorData.lecturaHseVf, editorData.lecturaHseArrastre)
          : editorData.lecturaItems;

      const payload: Record<string, unknown> = { titulo: editorData.titulo, descripcion: editorData.descripcion, editorKind };
      if (editorKind === "visual") payload.visualPairs = editorData.visualPairs;
      if (editorKind === "lectura" || editorKind === "lecturaHse") payload.lecturaItems = lecturaOut ?? [];
      if (editorKind === "recordemos") payload.recordemosItems = editorData.recordemosItems ?? [];
      if (editorKind === "social") payload.socialCasos = editorData.socialCasos ?? [];
      if (editorKind === "evaluacion") payload.evaluacionItems = editorData.evaluacionItems ?? [];

      await apiJson(`${API_URL}/api/admin/niveles/${selectedNivelEdit.id}/editor`, {
        method: "PUT",
        body: JSON.stringify(payload),
        timeoutMs: 30000,
      });
      Alert.alert("Guardado", "Cambios guardados en la base de datos.");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "No se pudo guardar en BD.");
    }
  }, [API_URL, selectedNivelEdit, editorData, editorKind]);

  const restaurarEditorNivel = useCallback(async () => {
    if (!selectedNivelEdit) return;
    await cargarEditorNivel(selectedNivelEdit);
  }, [selectedNivelEdit, cargarEditorNivel]);

  /* ========================= EDITOR HELPERS ========================= */

  const updateLecturaItem = (idx: number, patch: Partial<LecturaItem>) => {
    setEditorData((prev) => {
      const items = [...(prev.lecturaItems || [])];
      items[idx] = { ...(items[idx] || { antes: "", despues: "", respuestas: Array(10).fill(""), correcta: "" }), ...patch };
      return { ...prev, lecturaItems: items };
    });
  };
  const updateLecturaRespuesta = (idx: number, rIdx: number, value: string) => {
    setEditorData((prev) => {
      const items = [...(prev.lecturaItems || [])];
      const cur = items[idx] || { antes: "", despues: "", respuestas: Array(10).fill(""), correcta: "" };
      const respuestas = [...(cur.respuestas || Array(10).fill(""))];
      while (respuestas.length < 10) respuestas.push("");
      respuestas[rIdx] = value;
      items[idx] = { ...cur, respuestas };
      return { ...prev, lecturaItems: items };
    });
  };
  const addLecturaItem = () => setEditorData((prev) => ({ ...prev, lecturaItems: [...(prev.lecturaItems || []), { antes: "", despues: "", respuestas: Array(10).fill(""), correcta: "" }] }));
  const removeLecturaItem = (idx: number) => setEditorData((prev) => { const items = [...(prev.lecturaItems || [])]; items.splice(idx, 1); return { ...prev, lecturaItems: items }; });

  const addHseVf = () => setEditorData((prev) => ({ ...prev, lecturaHseVf: [...(prev.lecturaHseVf || []), { texto: "", correcta: true }] }));
  const removeHseVf = (idx: number) => setEditorData((prev) => { const rows = [...(prev.lecturaHseVf || [])]; rows.splice(idx, 1); return { ...prev, lecturaHseVf: rows }; });
  const addHseArr = () => setEditorData((prev) => ({ ...prev, lecturaHseArrastre: [...(prev.lecturaHseArrastre || []), { texto: "", correcta: "RIESGO" }] }));
  const removeHseArr = (idx: number) => setEditorData((prev) => { const rows = [...(prev.lecturaHseArrastre || [])]; rows.splice(idx, 1); return { ...prev, lecturaHseArrastre: rows }; });

  const addRecordemos = () => setEditorData((prev) => ({ ...prev, recordemosItems: [...(prev.recordemosItems || []), { concepto: "", descripcion: "" }] }));
  const removeRecordemos = (idx: number) => setEditorData((prev) => { const rows = [...(prev.recordemosItems || [])]; rows.splice(idx, 1); return { ...prev, recordemosItems: rows }; });

  const addSocialCaso = () => setEditorData((prev) => ({ ...prev, socialCasos: [...(prev.socialCasos || []), { caso: "", opcionA: "", opcionB: "", opcionC: "", correcta: "a", explicacion: "" }] }));
  const removeSocialCaso = (idx: number) => setEditorData((prev) => { const rows = [...(prev.socialCasos || [])]; rows.splice(idx, 1); return { ...prev, socialCasos: rows }; });

  const addEvalPregunta = () => setEditorData((prev) => ({ ...prev, evaluacionItems: [...(prev.evaluacionItems || []), { pregunta: "", opcionA: "", opcionB: "", opcionC: "", opcionD: "", correcta: "a" }] }));
  const removeEvalPregunta = (idx: number) => setEditorData((prev) => { const rows = [...(prev.evaluacionItems || [])]; rows.splice(idx, 1); return { ...prev, evaluacionItems: rows }; });

  /* ===== MENU ===== */

  const renderMenu = () => (
    <View style={styles.menuBox}>
      {(["panel", "edicion", "reporte"] as MenuOption[]).map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.menuBtn, menu === opt && styles.menuBtnActive]}
          onPress={() => {
            setMenu(opt);
            if (opt === "panel") { setSelectedIslaPanel(null); setSelectedNivelPanel(null); setDetalleNivel(null); setExpandedNiveles(new Set()); setDetalleCache(new Map()); }
            if (opt === "edicion") { setSelectedIslaEdit(null); setSelectedNivelEdit(null); }
          }}
        >
          <Text style={[styles.menuText, menu === opt && styles.menuTextActive]}>
            {opt === "panel" ? "PANEL" : opt === "edicion" ? "EDICION" : "REPORTE"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  /* ===== VISTA PANEL ===== */

  const renderPanel = () => {
    if (!selectedIslaPanel) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Islas - Panel de resultados</Text>
          <ScrollView style={{ marginTop: sp(8) }}>
            {loadingIslas ? (
              <Text style={styles.loadingText}>Cargando islas...</Text>
            ) : (
              islas.map((isla) => (
                <TouchableOpacity
                  key={isla.id}
                  style={styles.islaRow}
                  onPress={() => {
                    setSelectedIslaPanel(isla);
                    setSelectedNivelPanel(null);
                    setSearchCC("");
                    setSelectedUser(null);
                    setSelectedUserObj(null);
                    setExpandedNiveles(new Set());
                    setDetalleCache(new Map());
                  }}
                >
                  <Text style={styles.islaRowText}>{isla.nombre}</Text>
                  <View style={styles.islaRowPlusBox}>
                    <Text style={styles.islaRowPlus}>+</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      );
    }

    // Vista con niveles expandibles inline
    const isla = selectedIslaPanel;

    return (
      <View style={styles.box}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { setSelectedIslaPanel(null); setExpandedNiveles(new Set()); setDetalleCache(new Map()); setSelectedUser(null); setSelectedUserObj(null); }}
        >
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>{isla?.nombre}</Text>

        {/* Buscador de CC */}
        <View style={styles.searchRow}>
          <Text style={styles.ccLabel}>CC:</Text>
          <TextInput
            style={styles.ccInput}
            placeholder="Numero de cedula"
            placeholderTextColor="#9CA3AF"
            value={searchCC}
            onChangeText={setSearchCC}
            keyboardType="numeric"
          />
          <TouchableOpacity style={styles.searchBtn} onPress={buscarUsuarioPorCC}>
            <Text style={styles.searchBtnText}>Buscar</Text>
          </TouchableOpacity>
        </View>

        {selectedUser && (
          <View style={styles.userFoundBanner}>
            <Text style={styles.userFoundText}>{selectedUser}</Text>
          </View>
        )}

        {/* Lista de niveles con expand inline */}
        <ScrollView style={{ marginTop: sp(8), flex: 1 }} contentContainerStyle={{ paddingBottom: sp(20) }}>
          {isla?.niveles.map((nivel) => {
            const isExpanded = expandedNiveles.has(nivel.id);
            const cached = detalleCache.get(nivel.id);

            return (
              <View key={nivel.id}>
                <TouchableOpacity
                  style={styles.nivelRow}
                  onPress={() => cargarDetalleNivelInline(nivel)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.nivelRowText}>{nivel.nombre}</Text>
                  <View style={styles.nivelExpandArea}>
                    <Text style={styles.nivelPercentText}>
                      {nivel.porcentaje != null ? `${nivel.porcentaje}%` : "--"}
                    </Text>
                    <View style={styles.nivelPlusBox}>
                      <Text style={styles.nivelPlusText}>{isExpanded ? "-" : "+"}</Text>
                    </View>
                  </View>
                </TouchableOpacity>

                {/* Expanded detail inline */}
                {isExpanded && (
                  <View style={styles.expandedBox}>
                    {!selectedUserObj ? (
                      <Text style={styles.expandedMuted}>Busca un usuario primero</Text>
                    ) : !cached ? (
                      <Text style={styles.expandedMuted}>Cargando...</Text>
                    ) : (
                      <>
                        {/* Porcentaje banner */}
                        <View style={styles.expandedPctBanner}>
                          <Text style={styles.expandedPctLabel}>Porcentaje</Text>
                          <Text style={styles.expandedPctValue}>
                            {cached.puntaje != null ? `${cached.puntaje}%` : "Sin registro"}
                          </Text>
                        </View>

                        {/* Meta info */}
                        {cached.meta && filasResumenResultadoNivel(cached.meta).map((row) => (
                          <View key={row.k} style={styles.expandedMetaRow}>
                            <Text style={styles.expandedMetaLabel}>{row.label}</Text>
                            <Text style={styles.expandedMetaValue}>{row.value}</Text>
                          </View>
                        ))}

                        {/* Reintento: solo tiene sentido si ya hay un resultado guardado */}
                        {cached.meta && (
                          <TouchableOpacity
                            style={[
                              styles.reintentoBtn,
                              cached.meta.reintentoHabilitado && styles.reintentoBtnOn,
                            ]}
                            disabled={reintentoLoading === nivel.id}
                            onPress={() =>
                              toggleReintento(nivel, !cached.meta!.reintentoHabilitado)
                            }
                          >
                            <Text style={styles.reintentoBtnText}>
                              {reintentoLoading === nivel.id
                                ? "Actualizando..."
                                : cached.meta.reintentoHabilitado
                                ? "Reintento habilitado (tocar para cancelar)"
                                : "Habilitar reintento"}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Respuestas */}
                        {cached.preguntas.length > 0 ? (
                          <>
                            <Text style={styles.expandedSectionTitle}>Respuestas del participante</Text>
                            {cached.preguntas.map((p) => (
                              <View key={p.id} style={styles.expandedPreguntaRow}>
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.expandedPreguntaQ}>{p.id}. {p.pregunta || "--"}</Text>
                                  <Text style={styles.expandedPreguntaA}>Resp: {p.respuesta || "--"}</Text>
                                </View>
                                <Text style={[styles.expandedCheckIcon, { color: p.correcta ? "#16A34A" : "#DC2626" }]}>
                                  {p.correcta ? "OK" : "X"}
                                </Text>
                              </View>
                            ))}
                          </>
                        ) : (
                          <Text style={styles.expandedMuted}>
                            No hay respuestas individuales registradas para este nivel.
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  /* ===== VISTA EDICION ===== */

  const renderEdicion = () => {
    if (!selectedIslaEdit) {
      return (
        <View style={styles.box}>
          <Text style={styles.title}>Islas - Edicion de contenido</Text>
          <ScrollView style={{ marginTop: sp(8) }}>
            {loadingIslas ? (
              <Text style={styles.loadingText}>Cargando islas...</Text>
            ) : (
              islas.map((isla) => (
                <TouchableOpacity
                  key={isla.id}
                  style={styles.islaRow}
                  onPress={() => { setSelectedIslaEdit(isla); setSelectedNivelEdit(null); }}
                >
                  <Text style={styles.islaRowText}>{isla.nombre}</Text>
                  <View style={styles.islaRowPlusBox}>
                    <Text style={styles.islaRowPlus}>+</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      );
    }

    if (!selectedNivelEdit) {
      const isla = selectedIslaEdit;
      return (
        <View style={styles.box}>
          <TouchableOpacity style={styles.backButton} onPress={() => setSelectedIslaEdit(null)}>
            <Text style={styles.backText}>Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{isla?.nombre}</Text>
          <ScrollView style={{ marginTop: sp(8) }}>
            {isla?.niveles.map((nivel) => (
              <TouchableOpacity
                key={nivel.id}
                style={styles.nivelRow}
                onPress={async () => { setSelectedNivelEdit(nivel); await cargarEditorNivel(nivel); }}
              >
                <Text style={styles.nivelRowText}>{nivel.nombre}</Text>
                <Text style={styles.editIconText}>Editar</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      );
    }

    // Editor del nivel
    const nivel = selectedNivelEdit;

    return (
      <View style={styles.box}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => { setSelectedNivelEdit(null); setEditorKind("generico"); setEditorData(emptyEditorData()); }}
        >
          <Text style={styles.backText}>Volver</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Editar: {nivel?.nombre}</Text>
        {editorKind !== "generico" && <Text style={styles.editorKindTag}>Tipo: {editorKind}</Text>}

        <ScrollView
          style={{ marginTop: sp(8), alignSelf: "stretch", flex: 1 }}
          contentContainerStyle={{ paddingBottom: sp(160) }}
          showsVerticalScrollIndicator
        >
          {loadingEditor && <Text style={styles.loadingText}>Cargando contenido...</Text>}

          {/* Titulo y descripcion siempre visibles */}
          <Text style={styles.editLabel}>TITULO</Text>
          <TextInput style={styles.editInput} value={editorData.titulo} onChangeText={(txt) => setEditorData((prev) => ({ ...prev, titulo: txt }))} />

          <Text style={styles.editLabel}>DESCRIPCION</Text>
          <TextInput style={[styles.editInput, { height: sp(80) }]} multiline value={editorData.descripcion} onChangeText={(txt) => setEditorData((prev) => ({ ...prev, descripcion: txt }))} />

          {/* ===== VISUAL ===== */}
          {editorKind === "visual" && (
            <>
              <Text style={styles.editLabel}>PARES DE IMAGENES (Imagen + Respuesta)</Text>
              {(editorData.visualPairs || []).length === 0 ? (
                <Text style={styles.loadingText}>No hay pares cargados en la BD.</Text>
              ) : (
                (editorData.visualPairs || []).map((pair, idx) => (
                  <View key={String(pair.id ?? idx)} style={styles.visualRow}>
                    <View style={styles.visualCol}>
                      <Text style={styles.visualLabel}>Imagen</Text>
                      <TouchableOpacity style={styles.visualImgBox} onPress={() => reemplazarImagenVisual(idx, "imagen")}>
                        {pair.imagen ? <Image source={{ uri: pair.imagen }} style={styles.visualPreview} resizeMode="cover" /> : <Text style={styles.visualPlaceholder}>Toca para agregar</Text>}
                      </TouchableOpacity>
                    </View>
                    <View style={styles.visualCol}>
                      <Text style={styles.visualLabel}>Respuesta</Text>
                      <TouchableOpacity style={styles.visualImgBox} onPress={() => reemplazarImagenVisual(idx, "imagenRespuesta")}>
                        {pair.imagenRespuesta ? <Image source={{ uri: pair.imagenRespuesta }} style={styles.visualPreview} resizeMode="cover" /> : <Text style={styles.visualPlaceholder}>Toca para agregar</Text>}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </>
          )}

          {/* ===== LECTURA (completar parrafo - isla 1 y 3) ===== */}
          {editorKind === "lectura" && (
            <>
              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabel}>LECTURA - Completar parrafo</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addLecturaItem}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.lecturaItems || []).length === 0 ? (
                <Text style={styles.loadingText}>No hay items de lectura.</Text>
              ) : (
                (editorData.lecturaItems || []).map((it, idx) => (
                  <View key={String(it.id ?? idx)} style={styles.editorCard}>
                    <View style={styles.editorCardHeader}>
                      <Text style={styles.editorCardTitle}>Item #{idx + 1}</Text>
                      <TouchableOpacity onPress={() => removeLecturaItem(idx)}>
                        <Text style={styles.linkDanger}>Eliminar</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.editLabelSm}>ANTES</Text>
                    <TextInput style={[styles.editInput, { height: sp(70) }]} multiline value={it.antes} onChangeText={(txt) => updateLecturaItem(idx, { antes: txt })} />
                    <Text style={styles.editLabelSm}>DESPUES</Text>
                    <TextInput style={[styles.editInput, { height: sp(70) }]} multiline value={it.despues} onChangeText={(txt) => updateLecturaItem(idx, { despues: txt })} />
                    <Text style={styles.editLabelSm}>RESPUESTAS (1-10)</Text>
                    {(it.respuestas || Array(10).fill("")).slice(0, 10).map((r, rIdx) => (
                      <TextInput key={rIdx} style={styles.editInput} value={String(r ?? "")} onChangeText={(txt) => updateLecturaRespuesta(idx, rIdx, txt)} placeholder={`Respuesta ${rIdx + 1}`} placeholderTextColor="#9CA3AF" />
                    ))}
                    <Text style={styles.editLabelSm}>CORRECTA</Text>
                    <TextInput style={styles.editInput} value={it.correcta} onChangeText={(txt) => updateLecturaItem(idx, { correcta: txt })} placeholder="Texto correcto" placeholderTextColor="#9CA3AF" />
                    <Text style={styles.previewText}>Vista: {it.antes || "..."} [{it.correcta || "____"}] {it.despues || "..."}</Text>
                  </View>
                ))
              )}
            </>
          )}

          {/* ===== LECTURA HSE (V/F + Riesgo/Peligro - isla 2) ===== */}
          {editorKind === "lecturaHse" && (
            <>
              <Text style={styles.editLabel}>LECTURA HSE - Verdadero/Falso y Riesgo/Peligro</Text>

              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabelSm}>Enunciados V/F</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addHseVf}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.lecturaHseVf || []).map((row, idx) => (
                <View key={`vf-${idx}`} style={styles.editorCard}>
                  <View style={styles.editorCardHeader}>
                    <Text style={styles.editorCardTitle}>V/F #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeHseVf(idx)}>
                      <Text style={styles.linkDanger}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.editInput, { height: sp(72) }]} multiline placeholder="Enunciado" placeholderTextColor="#9CA3AF"
                    value={row.texto}
                    onChangeText={(txt) => { const rows = [...(editorData.lecturaHseVf || [])]; rows[idx] = { ...rows[idx], texto: txt }; setEditorData((p) => ({ ...p, lecturaHseVf: rows })); }}
                  />
                  <Text style={styles.editLabelSm}>Respuesta correcta</Text>
                  <View style={styles.choiceRow}>
                    {(["Verdadero", "Falso"] as const).map((label, i) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.choiceChip, row.correcta === (i === 0) && styles.choiceChipOn]}
                        onPress={() => { const rows = [...(editorData.lecturaHseVf || [])]; rows[idx] = { ...rows[idx], correcta: i === 0 }; setEditorData((p) => ({ ...p, lecturaHseVf: rows })); }}
                      >
                        <Text style={[styles.choiceChipText, row.correcta === (i === 0) && styles.choiceChipTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}

              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabelSm}>Frases (RIESGO / PELIGRO)</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addHseArr}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.lecturaHseArrastre || []).map((row, idx) => (
                <View key={`arr-${idx}`} style={styles.editorCard}>
                  <View style={styles.editorCardHeader}>
                    <Text style={styles.editorCardTitle}>Frase #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeHseArr(idx)}>
                      <Text style={styles.linkDanger}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <TextInput
                    style={[styles.editInput, { height: sp(72) }]} multiline placeholder="Texto de la frase" placeholderTextColor="#9CA3AF"
                    value={row.texto}
                    onChangeText={(txt) => { const rows = [...(editorData.lecturaHseArrastre || [])]; rows[idx] = { ...rows[idx], texto: txt }; setEditorData((p) => ({ ...p, lecturaHseArrastre: rows })); }}
                  />
                  <Text style={styles.editLabelSm}>Concepto correcto</Text>
                  <View style={styles.choiceRow}>
                    {(["RIESGO", "PELIGRO"] as const).map((label) => (
                      <TouchableOpacity
                        key={label}
                        style={[styles.choiceChip, row.correcta === label && styles.choiceChipOn]}
                        onPress={() => { const rows = [...(editorData.lecturaHseArrastre || [])]; rows[idx] = { ...rows[idx], correcta: label }; setEditorData((p) => ({ ...p, lecturaHseArrastre: rows })); }}
                      >
                        <Text style={[styles.choiceChipText, row.correcta === label && styles.choiceChipTextOn]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ===== RECORDEMOS (concepto + descripcion) ===== */}
          {editorKind === "recordemos" && (
            <>
              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabel}>RECORDEMOS - Concepto y Descripcion</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addRecordemos}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.recordemosItems || []).map((it, idx) => (
                <View key={`rec-${idx}`} style={styles.editorCard}>
                  <View style={styles.editorCardHeader}>
                    <Text style={styles.editorCardTitle}>Termino #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeRecordemos(idx)}>
                      <Text style={styles.linkDanger}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.editLabelSm}>CONCEPTO</Text>
                  <TextInput style={styles.editInput} value={it.concepto} onChangeText={(txt) => { const rows = [...(editorData.recordemosItems || [])]; rows[idx] = { ...rows[idx], concepto: txt }; setEditorData((p) => ({ ...p, recordemosItems: rows })); }} />
                  <Text style={styles.editLabelSm}>DESCRIPCION</Text>
                  <TextInput style={[styles.editInput, { height: sp(80) }]} multiline value={it.descripcion} onChangeText={(txt) => { const rows = [...(editorData.recordemosItems || [])]; rows[idx] = { ...rows[idx], descripcion: txt }; setEditorData((p) => ({ ...p, recordemosItems: rows })); }} />
                </View>
              ))}
            </>
          )}

          {/* ===== SOCIAL (caso + 3 opciones + correcta) ===== */}
          {editorKind === "social" && (
            <>
              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabel}>SOCIAL - Casos y opciones A/B/C</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addSocialCaso}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.socialCasos || []).map((c, idx) => (
                <View key={`soc-${idx}`} style={styles.editorCard}>
                  <View style={styles.editorCardHeader}>
                    <Text style={styles.editorCardTitle}>Caso #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeSocialCaso(idx)}>
                      <Text style={styles.linkDanger}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.editLabelSm}>CASO / SITUACION</Text>
                  <TextInput style={[styles.editInput, { height: sp(72) }]} multiline value={c.caso} onChangeText={(txt) => { const rows = [...(editorData.socialCasos || [])]; rows[idx] = { ...rows[idx], caso: txt }; setEditorData((p) => ({ ...p, socialCasos: rows })); }} />
                  {(["opcionA", "opcionB", "opcionC"] as const).map((campo, j) => (
                    <React.Fragment key={campo}>
                      <Text style={styles.editLabelSm}>OPCION {String.fromCharCode(65 + j)}</Text>
                      <TextInput style={styles.editInput} value={c[campo]} onChangeText={(txt) => { const rows = [...(editorData.socialCasos || [])]; rows[idx] = { ...rows[idx], [campo]: txt }; setEditorData((p) => ({ ...p, socialCasos: rows })); }} />
                    </React.Fragment>
                  ))}
                  <Text style={styles.editLabelSm}>CORRECTA</Text>
                  <View style={styles.choiceRow}>
                    {(["a", "b", "c"] as const).map((letter) => (
                      <TouchableOpacity key={letter} style={[styles.choiceChip, c.correcta === letter && styles.choiceChipOn]} onPress={() => { const rows = [...(editorData.socialCasos || [])]; rows[idx] = { ...rows[idx], correcta: letter }; setEditorData((p) => ({ ...p, socialCasos: rows })); }}>
                        <Text style={[styles.choiceChipText, c.correcta === letter && styles.choiceChipTextOn]}>{letter.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.editLabelSm}>EXPLICACION (opcional)</Text>
                  <TextInput style={[styles.editInput, { height: sp(64) }]} multiline value={c.explicacion} onChangeText={(txt) => { const rows = [...(editorData.socialCasos || [])]; rows[idx] = { ...rows[idx], explicacion: txt }; setEditorData((p) => ({ ...p, socialCasos: rows })); }} />
                </View>
              ))}
            </>
          )}

          {/* ===== EVALUACION FINAL (pregunta + 4 opciones + correcta) ===== */}
          {editorKind === "evaluacion" && (
            <>
              <View style={styles.editorSectionHeader}>
                <Text style={styles.editLabel}>EVALUACION FINAL - Preguntas A/B/C/D</Text>
                <TouchableOpacity style={styles.addBtn} onPress={addEvalPregunta}>
                  <Text style={styles.addBtnText}>+ Anadir</Text>
                </TouchableOpacity>
              </View>
              {(editorData.evaluacionItems || []).map((q, idx) => (
                <View key={`ev-${idx}`} style={styles.editorCard}>
                  <View style={styles.editorCardHeader}>
                    <Text style={styles.editorCardTitle}>Pregunta #{idx + 1}</Text>
                    <TouchableOpacity onPress={() => removeEvalPregunta(idx)}>
                      <Text style={styles.linkDanger}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={styles.editLabelSm}>PREGUNTA</Text>
                  <TextInput style={[styles.editInput, { height: sp(72) }]} multiline value={q.pregunta} onChangeText={(txt) => { const rows = [...(editorData.evaluacionItems || [])]; rows[idx] = { ...rows[idx], pregunta: txt }; setEditorData((p) => ({ ...p, evaluacionItems: rows })); }} />
                  {(["opcionA", "opcionB", "opcionC", "opcionD"] as const).map((campo, j) => (
                    <React.Fragment key={campo}>
                      <Text style={styles.editLabelSm}>OPCION {String.fromCharCode(65 + j)}</Text>
                      <TextInput style={styles.editInput} value={q[campo]} onChangeText={(txt) => { const rows = [...(editorData.evaluacionItems || [])]; rows[idx] = { ...rows[idx], [campo]: txt }; setEditorData((p) => ({ ...p, evaluacionItems: rows })); }} />
                    </React.Fragment>
                  ))}
                  <Text style={styles.editLabelSm}>CORRECTA</Text>
                  <View style={styles.choiceRow}>
                    {(["a", "b", "c", "d"] as const).map((letter) => (
                      <TouchableOpacity key={letter} style={[styles.choiceChip, q.correcta === letter && styles.choiceChipOn]} onPress={() => { const rows = [...(editorData.evaluacionItems || [])]; rows[idx] = { ...rows[idx], correcta: letter }; setEditorData((p) => ({ ...p, evaluacionItems: rows })); }}>
                        <Text style={[styles.choiceChipText, q.correcta === letter && styles.choiceChipTextOn]}>{letter.toUpperCase()}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </>
          )}

          {/* ===== GENERICO ===== */}
          {editorKind === "generico" && !loadingEditor && (
            <View style={styles.editorCard}>
              <Text style={styles.expandedMuted}>
                Este nivel no tiene un tipo reconocido (visual, lectura, recordemos, social o evaluacion).{"\n"}
                Verifica que en la base de datos el campo NIVELES_NOMBRE contenga alguna de esas palabras clave.
              </Text>
            </View>
          )}

          {/* Botones guardar / restaurar */}
          <View style={styles.editButtonsRow}>
            <TouchableOpacity style={styles.restoreButton} onPress={restaurarEditorNivel}>
              <Text style={styles.restoreText}>Restaurar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.saveButton} onPress={guardarEditorNivel}>
              <Text style={styles.saveText}>Guardar cambios</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    );
  };

  /* ===== VISTA REPORTE ===== */

  const renderReporte = () => {
    const d = reporteCompleto;

    return (
      <View style={[styles.box, { maxHeight: "94%" }]}>
        <Text style={styles.title}>Reportes</Text>
        <Text style={styles.reporteSub}>
          Avance global por cohorte y detalle personal. Los porcentajes usan el ultimo intento registrado por nivel.
        </Text>

        <View style={styles.reporteActionsRow}>
          <TouchableOpacity style={styles.reporteBtnSecondary} onPress={cargarReporteCompleto} disabled={loadingReporte}>
            <Text style={styles.reporteBtnSecondaryText}>{loadingReporte ? "Actualizando..." : "Actualizar datos"}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.reporteBtnPrimary, (!reporteCompleto || exportandoPdf) && { opacity: 0.45 }]}
            onPress={exportarReportePdf}
            disabled={!reporteCompleto || exportandoPdf}
          >
            <Text style={styles.reporteBtnPrimaryText}>{exportandoPdf ? "Generando PDF..." : "Descargar PDF"}</Text>
          </TouchableOpacity>
        </View>

        {loadingReporte && !d ? (
          <Text style={styles.loadingText}>Cargando reporte...</Text>
        ) : !d ? (
          <Text style={styles.loadingText}>No hay datos. Comprueba la API y la base de datos.</Text>
        ) : (
          <ScrollView style={{ flex: 1, marginTop: sp(4) }} contentContainerStyle={{ paddingBottom: sp(24) }} showsVerticalScrollIndicator>
            {/* General por cohorte */}
            <Text style={styles.reporteSectionTitle}>General - por numero de onboarding</Text>
            {(d.cohortes || []).length === 0 ? (
              <Text style={styles.loadingText}>Sin cohortes con usuarios.</Text>
            ) : (
              (d.cohortes || []).map((c) => (
                <View key={`co-${c.numeroOnboarding}`} style={styles.reporteCard}>
                  <Text style={styles.reporteCardStrong}>Onboarding #{c.numeroOnboarding}</Text>
                  <Text style={styles.reporteCardLine}>Participantes: {c.participantes}</Text>
                  <Text style={styles.reporteCardLine}>Promedio avance: {c.promedioAvance != null ? `${c.promedioAvance}%` : "--"}</Text>
                </View>
              ))
            )}

            {/* Personal */}
            <Text style={styles.reporteSectionTitle}>Personal - participantes</Text>
            {(d.participantes || []).length === 0 ? (
              <Text style={styles.loadingText}>No hay usuarios registrados.</Text>
            ) : (
              (d.participantes || []).map((p) => (
                <View key={`u-${p.usuarioKey}`} style={styles.reporteCard}>
                  <Text style={styles.reporteCardStrong}>{p.nombre}</Text>
                  <Text style={styles.reporteCardLine}>Cedula: {p.cedula} | Onboarding #{p.numeroOnboarding}</Text>
                  <View style={styles.reporteProgressBar}>
                    <View style={[styles.reporteProgressFill, { width: `${Math.min(p.promedioGeneral ?? 0, 100)}%` }]} />
                    <Text style={styles.reporteProgressText}>
                      {p.promedioGeneral != null ? `${p.promedioGeneral}%` : "--"}
                    </Text>
                  </View>
                  {(p.porIsla || []).map((isla) => (
                    <View key={`ui-${p.usuarioKey}-${isla.islaKey}`} style={styles.reporteIslaBlock}>
                      <Text style={styles.reporteIslaTitle}>{isla.islaNombre} (prom. {isla.promedio != null ? `${isla.promedio}%` : "--"})</Text>
                      {(isla.niveles || []).map((nv) => (
                        <Text key={`n-${nv.nivelKey}`} style={styles.reporteNivelLine}>
                          {nv.nivelNombre}: {nv.puntaje != null ? `${nv.puntaje}%` : "--"}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              ))
            )}

            {d.generado && (
              <Text style={styles.reporteFoot}>Datos al {new Date(d.generado).toLocaleString("es-CO")}</Text>
            )}
          </ScrollView>
        )}
      </View>
    );
  };

  /* ===== RENDER PRINCIPAL ===== */

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={[styles.overlay, !showLogin && { justifyContent: "flex-start", paddingTop: sp(20) }]}>
        {showLogin ? (
          <View style={styles.loginBox}>
            <Text style={styles.loginTitle}>Panel Administrador</Text>
            <Text style={styles.loginLabel}>Usuario</Text>
            <TextInput style={styles.loginInput} value={adminUser} onChangeText={setAdminUser} placeholder="Ingresa el usuario" placeholderTextColor="#9CA3AF" />
            <Text style={styles.loginLabel}>Contrasena</Text>
            <TextInput style={styles.loginInput} secureTextEntry value={adminPass} onChangeText={setAdminPass} placeholder="Ingresa la contrasena" placeholderTextColor="#9CA3AF" />
            <TouchableOpacity style={styles.loginButton} onPress={validarAdmin}>
              <Text style={styles.loginButtonText}>Ingresar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.volver} onPress={() => router.back()}>
              <Text style={styles.volverText}>Volver</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {renderMenu()}
            {menu === "panel" && renderPanel()}
            {menu === "edicion" && renderEdicion()}
            {menu === "reporte" && renderReporte()}
          </>
        )}
      </View>
    </ImageBackground>
  );
}

/* ===== ESTILOS (todos escalados con sp() para consistencia en tablets) ===== */

const styles = StyleSheet.create({
  cargando: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" },
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    padding: isPhone ? sp(12) : sp(16),
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.80)",
  },

  /* LOGIN */
  loginBox: {
    width: isPhone ? "95%" : "92%",
    maxWidth: isPhone ? screenWidth * 0.9 : sp(420),
    backgroundColor: "white",
    padding: isPhone ? sp(20) : sp(28),
    borderRadius: isPhone ? sp(12) : sp(16),
    borderWidth: 2,
    borderColor: "#0F1B4C",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  loginTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: isPhone ? sp(22) : sp(24), textAlign: "center", marginBottom: sp(14), color: "#0F1B4C" },
  loginLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: isPhone ? sp(14) : sp(16), marginTop: sp(10), color: "#0F1B4C" },
  loginInput: { fontFamily: "PlusJakartaSans-Regular", fontSize: isPhone ? sp(15) : sp(16), borderBottomWidth: 2, borderBottomColor: "#0F1B4C", paddingVertical: sp(8), color: "#111" },
  loginButton: { marginTop: sp(18), backgroundColor: "#0F1B4C", paddingVertical: isPhone ? sp(12) : sp(14), borderRadius: sp(10) },
  loginButtonText: { color: "white", fontFamily: "PlusJakartaSans-Bold", fontSize: isPhone ? sp(16) : sp(18), textAlign: "center" },
  volver: { marginTop: sp(12), alignSelf: "center", paddingVertical: sp(8), paddingHorizontal: sp(20), borderRadius: sp(8), borderWidth: 1, borderColor: "#0F1B4C" },
  volverText: { fontFamily: "PlusJakartaSans-Regular", fontSize: isPhone ? sp(13) : sp(15), color: "#0F1B4C" },

  /* MENU */
  menuBox: { flexDirection: "row", justifyContent: "center", marginBottom: sp(14) },
  menuBtn: {
    paddingVertical: sp(10),
    paddingHorizontal: sp(22),
    borderWidth: 2,
    borderColor: "#0F1B4C",
    borderRadius: sp(999),
    marginHorizontal: sp(6),
    backgroundColor: "white",
  },
  menuBtnActive: { backgroundColor: "#0F1B4C" },
  menuText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(15), color: "#0F1B4C" },
  menuTextActive: { color: "white" },

  /* BOX PRINCIPAL */
  box: {
    width: isPhone ? "98%" : "96%",
    maxWidth: isPhone ? screenWidth * 0.95 : sp(620),
    backgroundColor: "white",
    padding: isPhone ? sp(14) : sp(18),
    borderRadius: isPhone ? sp(12) : sp(16),
    borderWidth: 2,
    borderColor: "#0F1B4C",
    maxHeight: "92%",
    flex: 1,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
  },
  title: { fontFamily: "PlusJakartaSans-Bold", fontSize: isPhone ? sp(18) : sp(20), color: "#0F1B4C", marginBottom: sp(6), textAlign: "center" },
  loadingText: { textAlign: "center", fontFamily: "PlusJakartaSans-Regular", fontSize: isPhone ? sp(13) : sp(14), color: "#6B7280", marginTop: sp(6) },

  /* BACK */
  backButton: { marginBottom: sp(8), paddingVertical: sp(6), paddingHorizontal: sp(12), backgroundColor: "#EEF2FF", borderRadius: sp(8), alignSelf: "flex-start" },
  backText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#0F1B4C" },

  /* ISLA ROWS */
  islaRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#0F1B4C",
    paddingHorizontal: sp(14),
    paddingVertical: sp(14),
    borderRadius: sp(12),
    marginBottom: sp(8),
    backgroundColor: "white",
  },
  islaRowText: { flex: 1, fontFamily: "PlusJakartaSans-Bold", fontSize: sp(16), color: "#111827" },
  islaRowPlusBox: {
    width: sp(44),
    height: sp(44),
    borderRadius: sp(22),
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  islaRowPlus: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(28), color: "white", lineHeight: sp(32) },

  /* SEARCH */
  searchRow: { flexDirection: "row", alignItems: "center", marginTop: sp(8), marginBottom: sp(4) },
  ccLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(15), color: "#111827", marginRight: sp(8) },
  ccInput: {
    flex: 1,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: sp(15),
    paddingVertical: sp(8),
    paddingHorizontal: sp(10),
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: sp(8),
    color: "#111",
  },
  searchBtn: {
    marginLeft: sp(8),
    backgroundColor: "#0F1B4C",
    paddingVertical: sp(10),
    paddingHorizontal: sp(18),
    borderRadius: sp(8),
  },
  searchBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "white" },
  userFoundBanner: {
    marginTop: sp(8),
    backgroundColor: "#EEF2FF",
    paddingVertical: sp(8),
    paddingHorizontal: sp(12),
    borderRadius: sp(8),
    borderWidth: 1,
    borderColor: "#C7D2FE",
  },
  userFoundText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#1E3A8A", textAlign: "center" },

  /* NIVEL ROWS (panel) */
  nivelRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    paddingHorizontal: sp(12),
    paddingVertical: sp(12),
    borderRadius: sp(10),
    marginBottom: sp(6),
    backgroundColor: "#FAFAFA",
  },
  nivelRowText: { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: sp(15), color: "#111827" },
  nivelExpandArea: { flexDirection: "row", alignItems: "center" },
  nivelPercentText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: sp(22),
    color: "#0F1B4C",
    marginRight: sp(10),
    minWidth: sp(60),
    textAlign: "right",
  },
  nivelPlusBox: {
    width: sp(52),
    height: sp(52),
    borderRadius: sp(26),
    backgroundColor: "#16A34A",
    alignItems: "center",
    justifyContent: "center",
  },
  nivelPlusText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(32), color: "white", lineHeight: sp(36) },

  /* EXPANDED DETAIL */
  expandedBox: {
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: sp(10),
    padding: sp(12),
    marginBottom: sp(8),
    marginTop: sp(-4),
  },
  expandedMuted: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(13), color: "#6B7280", textAlign: "center", marginVertical: sp(8) },
  expandedPctBanner: {
    backgroundColor: "#EEF2FF",
    borderRadius: sp(10),
    paddingVertical: sp(10),
    paddingHorizontal: sp(12),
    borderWidth: 1,
    borderColor: "#C7D2FE",
    marginBottom: sp(10),
  },
  expandedPctLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), color: "#3730A3", textAlign: "center" },
  expandedPctValue: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(22), color: "#0F1B4C", textAlign: "center", marginTop: sp(2) },
  expandedMetaRow: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: sp(8),
    paddingHorizontal: sp(10),
    paddingVertical: sp(6),
    marginBottom: sp(4),
    backgroundColor: "white",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expandedMetaLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(12), color: "#374151" },
  expandedMetaValue: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(13), color: "#111827" },
  reintentoBtn: {
    backgroundColor: "#0F1B4C",
    borderRadius: sp(8),
    paddingVertical: sp(10),
    alignItems: "center",
    marginTop: sp(6),
    marginBottom: sp(4),
  },
  reintentoBtnOn: { backgroundColor: "#16A34A" },
  reintentoBtnText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(12), color: "#FFFFFF" },
  expandedSectionTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#0F1B4C", marginTop: sp(10), marginBottom: sp(6) },
  expandedPreguntaRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: sp(6),
    paddingHorizontal: sp(10),
    paddingVertical: sp(6),
    marginBottom: sp(4),
    backgroundColor: "white",
  },
  expandedPreguntaQ: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(12), color: "#111827" },
  expandedPreguntaA: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(12), color: "#4B5563", marginTop: sp(2) },
  expandedCheckIcon: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(16), marginLeft: sp(8), minWidth: sp(24), textAlign: "center" },

  /* EDITOR */
  editLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(15), marginTop: sp(12), color: "#111827" },
  editLabelSm: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), marginTop: sp(10), color: "#374151" },
  editInput: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: sp(8),
    paddingHorizontal: sp(10),
    paddingVertical: sp(8),
    marginTop: sp(4),
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: sp(14),
    color: "#111",
    backgroundColor: "white",
  },
  editIconText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#4338CA" },
  editorKindTag: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), color: "#4338CA", marginBottom: sp(6) },

  editorSectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: sp(10) },
  editorCard: {
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
    borderRadius: sp(12),
    padding: sp(12),
    marginTop: sp(10),
    backgroundColor: "#FAFAFA",
  },
  editorCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: sp(6) },
  editorCardTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(15), color: "#0F1B4C" },
  linkDanger: { color: "#DC2626", fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14) },

  previewText: { marginTop: sp(10), fontFamily: "PlusJakartaSans-Regular", fontSize: sp(13), color: "#6B7280", fontStyle: "italic" },

  addBtn: { backgroundColor: "#16A34A", paddingVertical: sp(8), paddingHorizontal: sp(14), borderRadius: sp(10) },
  addBtnText: { color: "white", fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13) },

  editButtonsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: sp(20) },
  restoreButton: { flex: 1, marginRight: sp(8), paddingVertical: sp(12), borderRadius: sp(10), backgroundColor: "#E5E7EB" },
  saveButton: { flex: 1, marginLeft: sp(8), paddingVertical: sp(12), borderRadius: sp(10), backgroundColor: "#0F1B4C" },
  restoreText: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "#111827", fontSize: sp(15) },
  saveText: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "white", fontSize: sp(15) },

  /* VISUAL */
  visualRow: { flexDirection: "row", justifyContent: "space-between", marginTop: sp(10), borderWidth: 1.5, borderColor: "#D1D5DB", borderRadius: sp(12), padding: sp(12), backgroundColor: "#FAFAFA" },
  visualCol: { width: "47%", alignItems: "center" },
  visualLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), color: "#111827", marginBottom: sp(6) },
  visualImgBox: { width: "100%", height: sp(100), borderWidth: 1, borderColor: "#9CA3AF", borderRadius: sp(10), alignItems: "center", justifyContent: "center", backgroundColor: "#F9FAFB", overflow: "hidden" },
  visualPreview: { width: "100%", height: "100%", borderRadius: sp(10) },
  visualPlaceholder: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(12), color: "#9CA3AF" },

  /* CHOICE CHIPS */
  choiceRow: { flexDirection: "row", flexWrap: "wrap", marginTop: sp(6) },
  choiceChip: { paddingVertical: sp(10), paddingHorizontal: sp(18), borderRadius: sp(10), borderWidth: 2, borderColor: "#0F1B4C", marginRight: sp(8), marginBottom: sp(8), backgroundColor: "white" },
  choiceChipOn: { backgroundColor: "#0F1B4C" },
  choiceChipText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#0F1B4C" },
  choiceChipTextOn: { color: "white" },

  /* REPORTE */
  reporteSub: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(13), color: "#4B5563", textAlign: "center", marginBottom: sp(10), lineHeight: sp(19) },
  reporteActionsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", marginBottom: sp(10) },
  reporteBtnSecondary: {
    marginRight: sp(10), marginBottom: sp(8), paddingVertical: sp(12), paddingHorizontal: sp(18),
    borderRadius: sp(10), borderWidth: 2, borderColor: "#0F1B4C", backgroundColor: "white",
  },
  reporteBtnSecondaryText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "#0F1B4C", textAlign: "center" },
  reporteBtnPrimary: { marginBottom: sp(8), paddingVertical: sp(12), paddingHorizontal: sp(18), borderRadius: sp(10), backgroundColor: "#0F1B4C" },
  reporteBtnPrimaryText: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(14), color: "white", textAlign: "center" },
  reporteSectionTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(16), color: "#0F1B4C", marginTop: sp(14), marginBottom: sp(8) },
  reporteCard: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: sp(12), padding: sp(12), marginBottom: sp(10), backgroundColor: "#FAFAFA",
  },
  reporteCardStrong: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(15), color: "#111827" },
  reporteCardLine: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(14), color: "#374151", marginTop: sp(4) },
  reporteProgressBar: {
    marginTop: sp(8), height: sp(28), backgroundColor: "#E5E7EB", borderRadius: sp(14), overflow: "hidden", position: "relative", justifyContent: "center",
  },
  reporteProgressFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#16A34A", borderRadius: sp(14) },
  reporteProgressText: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), color: "#111827", textAlign: "center", zIndex: 1,
  },
  reporteIslaBlock: { marginTop: sp(8), paddingTop: sp(6), borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  reporteIslaTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: sp(13), color: "#1E3A8A", marginBottom: sp(4) },
  reporteNivelLine: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(12), color: "#4B5563", marginLeft: sp(8), marginBottom: sp(2) },
  reporteFoot: { fontFamily: "PlusJakartaSans-Regular", fontSize: sp(12), color: "#9CA3AF", textAlign: "center", marginTop: sp(14) },
});
