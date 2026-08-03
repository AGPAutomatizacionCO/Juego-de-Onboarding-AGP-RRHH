// =====================================================
// SISTEMA DE ESCALA UNIVERSAL - TABLETS
// Diseñado para consistencia visual entre tablets distintas
// =====================================================

import { Dimensions, PixelRatio, Platform } from "react-native";

// ─── Leer dimensiones de forma reactiva ─────────────────────────────────────
export const getWindow = () => Dimensions.get("window");

// ─── Detección de dispositivo ────────────────────────────────────────────────
// Usamos dp (density-independent pixels), que es lo que Dimensions.get devuelve.
// 600dp es el umbral estándar de Android/iOS para tablets.
export const getIsTablet = () => {
  const { width, height } = getWindow();
  return Math.min(width, height) >= 600;
};

// ─── DESIGN_WIDTH en dp, NO en píxeles físicos ───────────────────────────────
//
// ¡PROBLEMA ANTERIOR!
// DESIGN_WIDTH = 1280 asumía píxeles físicos.
// Pero Dimensions.get("window") devuelve SIEMPRE dp (density-independent pixels).
//
// Ejemplo del bug:
//   Tablet con 1280px físicos y densidad 2x → Dimensions reporta 640dp
//   → factor = 640 / 1280 = 0.50 → se clampea a 0.70 → todo se ve pequeño
//
//   Otra tablet con 1280px físicos y densidad 1x → Dimensions reporta 1280dp
//   → factor = 1280 / 1280 = 1.00 → se ve normal
//
//   Resultado: la misma pantalla física se ve diferente en ambas tablets.
//
// SOLUCIÓN:
// DESIGN_WIDTH debe ser el ancho en dp de la pantalla donde diseñaste tu UI.
// Para saberlo, loguea Dimensions.get("window").width en tu dispositivo base.
//
// Valores típicos de tablets en landscape (dp):
//   iPad 10.9"        → ~1194dp
//   iPad 12.9"        → ~1366dp
//   iPad mini         →  ~1024dp
//   Android 10"       →  ~1280dp (densidad 1x) o ~960dp (densidad 1.33x)
//   Samsung Tab S8    →  ~1280dp
//
// Ajusta este valor al dp real de TU pantalla de diseño.
// Si no sabes cuál es, loguea: console.log(Dimensions.get("window"))
export const DESIGN_WIDTH = 960; // ← dp reales de tu pantalla de diseño

// ─── Factor de escala reactivo ───────────────────────────────────────────────
// Siempre usa el lado largo (landscape) para tablets.
export const getScaleFactor = () => {
  const { width, height } = getWindow();
  const activeWidth = Math.max(width, height);
  return activeWidth / DESIGN_WIDTH;
};

// ─── Funciones de escala reactivas ──────────────────────────────────────────
// Calculan el valor CADA VEZ que se llaman con las dimensiones actuales.

/** Escala un tamaño en dp según el ancho actual de la pantalla */
export const scaleDP = (size: number): number => {
  const factor = getScaleFactor();
  // Rango ampliado: permite más variación para pantallas muy grandes/pequeñas
  const clampedFactor = Math.min(Math.max(factor, 0.6), 1.5);
  return Math.round(size * clampedFactor);
};

/** Escala texto con factor ligeramente comprimido para mejor legibilidad */
export const scaleText = (size: number): number => {
  const factor = getScaleFactor();
  const clampedFactor = Math.min(Math.max(factor, 0.65), 1.4);
  return Math.round(size * clampedFactor);
};

/** Escala iconos igual que dp */
export const scaleIcon = (size: number): number => scaleDP(size);

/** Escala espacios/padding */
export const scaleSpace = (size: number): number => scaleDP(size);

/** Escala bordes con mínimo de 1px */
export const scaleBorder = (size: number): number =>
  Math.max(scaleDP(size), 1);

// ─── Utilidades de layout ────────────────────────────────────────────────────

/** Porcentaje del ancho actual de pantalla */
export const widthPercent = (percent: number): number =>
  getWindow().width * (percent / 100);

/** Porcentaje del alto actual de pantalla */
export const heightPercent = (percent: number): number =>
  getWindow().height * (percent / 100);

// ─── Exports de compatibilidad ───────────────────────────────────────────────
// IMPORTANTE: estos son valores ESTÁTICOS del momento de importación.
// Dentro de componentes, usa siempre useResponsive() de useDevice.ts.

export const screenWidth = getWindow().width;
export const screenHeight = getWindow().height;
export const scale = getScaleFactor();
export const safeScale = scale;

export const isTablet = () => getIsTablet();
export const isLandscape = () => {
  const { width, height } = getWindow();
  return width > height;
};
export const isPortrait = () => !isLandscape();

export const getDeviceInfo = () => {
  const { width, height } = getWindow();
  return {
    width,
    height,
    scale: getScaleFactor(),
    isTablet: getIsTablet(),
    isLandscape: isLandscape(),
    pixelRatio: PixelRatio.get(),
    platform: Platform.OS,
    // Útil para debug: loguea esto en cada tablet para verificar dp reales
    physicalWidthPixels: Math.round(width * PixelRatio.get()),
    physicalHeightPixels: Math.round(height * PixelRatio.get()),
  };
};