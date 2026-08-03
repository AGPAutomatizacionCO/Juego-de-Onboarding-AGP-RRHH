// ==========================================
// CONFIGURACIÓN CENTRALIZADA DEL JUEGO
// ==========================================

import { Dimensions } from "react-native";

// ================================
// CONFIGURACIÓN API
// ================================
// ÚNICA fuente de verdad de la dirección del backend.
//
// Se define en tiempo de compilación mediante EXPO_PUBLIC_API_URL (ver .env).
// OJO: las variables EXPO_PUBLIC_* se incrustan AL COMPILAR. Editar el .env
// no modifica un APK ya generado: hay que volver a compilar siempre.
//
// Antes esta dirección estaba repetida 64 veces en 46 archivos. Cuando el
// equipo que hospedaba la API se dio de baja y su IP fue reasignada, toda la
// aplicación quedó apuntando a una máquina ajena. Por eso ahora vive aquí y
// solo aquí.
const RAW_API_URL = process.env.EXPO_PUBLIC_API_URL ?? "";

if (!RAW_API_URL) {
  console.warn(
    "[config] EXPO_PUBLIC_API_URL no está definida. Las peticiones al " +
      "backend fallarán. Definirla en .env y recompilar la aplicación."
  );
}

// Sin barra final: el resto del código concatena `${API_BASE_URL}/api/...`
export const API_BASE_URL = RAW_API_URL.replace(/\/+$/, "");

// Alias retrocompatible para el código que ya importaba API_URL.
export const API_URL = API_BASE_URL;

// ================================
// CONFIGURACIÓN DE ESCALA (TABLET)
// ================================
const BASE_WIDTH = 1280;
const BASE_HEIGHT = 800;

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export const scaleX = screenWidth / BASE_WIDTH;
export const scaleY = screenHeight / BASE_HEIGHT;
export const scale = Math.min(scaleX, scaleY);

export const scaleDP = (size: number) => scale * size;

// ================================
// KEYS DE ISLAS Y NIVELES
// ================================
export const ISLAS = {
  INTRODUCCION: 1,
  HSE: 2,
  PROCESOS: 3,
  // Agrega más según necesites
};

export const NIVELES = {
  VISUAL: 1,
  LECTURA: 2,
  RECORDEMOS: 3,
  SOCIAL: 4,
  EVALUACION: 5,
};

// ================================
// CONFIGURACIÓN DE VIDAS (COMÚN A TODOS LOS NIVELES)
// ================================
export const MAX_LIVES = 5;
export const FREE_MISSES = 5;
export const ERRORS_PER_LIFE = 2;
export const MIN_PASS_SCORE = 70;

// ================================
// FUNCIONES AUXILIARES (SHARED)
// ================================

// Función helper para hacer requests al API
export async function apiJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Error HTTP ${res.status} en ${url.replace(/^https?:\/\//, "")}`;
    throw new Error(msg);
  }

  return data;
}

// Extraer usuarioKey de cualquier respuesta
export function extractUsuarioKey(data: any): number | null {
  const candidates = [
    data?.usuarioKey,
    data?.USUARIO_KEY,
    data?.data?.usuarioKey,
    data?.data?.USUARIO_KEY,
    data?.usuario?.usuarioKey,
    data?.usuario?.USUARIO_KEY,
    data?.data?.usuario?.usuarioKey,
    data?.data?.usuario?.USUARIO_KEY,
  ];

  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

// Leer usuarioKey desde AsyncStorage
export async function readUsuarioKeyFromStorage(): Promise<number | null> {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  const k = await AsyncStorage.getItem("USUARIO_KEY");
  const n = Number(k);
  if (k && Number.isFinite(n) && n > 0) return n;
  return null;
}

// Obtener usuarioKey (con fallback por cédula)
export async function ensureUsuarioKey(API_URL: string): Promise<number | null> {
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  
  const direct = await readUsuarioKeyFromStorage();
  if (direct) return direct;

  const cedula = await AsyncStorage.getItem("USUARIO_CEDULA");
  if (!cedula) return null;

  const res = await fetch(`${API_URL}/api/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cedula }),
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  if (!res.ok) return null;

  const usuarioKey = extractUsuarioKey(data);
  if (usuarioKey && usuarioKey > 0) {
    await AsyncStorage.setItem("USUARIO_KEY", String(usuarioKey));
    return usuarioKey;
  }

  return null;
}

// Generar key namespaced por usuario
export const keyU = (usuarioKey: number | null, suffix: string) => 
  `u:${usuarioKey ?? 0}:${suffix}`;

// Safe JSON parse
export async function safeJson(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { raw: text };
  }
}