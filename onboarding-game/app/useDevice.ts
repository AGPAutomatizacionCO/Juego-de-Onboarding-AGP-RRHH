import { useEffect, useState, useCallback } from "react";
import { Dimensions, Platform } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { getScaleFactor, getIsTablet, DESIGN_WIDTH } from "./scale";

// ─── Valores estáticos para uso fuera de componentes ────────────────────────
// (usar con cuidado — no se actualizan al rotar)
const initial = Dimensions.get("window");
export const screenWidth = initial.width;
export const screenHeight = initial.height;
export const isPhone = !getIsTablet();
export const isTablet = getIsTablet();
export const isLandscape = initial.width > initial.height;

// scaleDP estático — usa el factor calculado con dp reales (corregido)
export const scale = getScaleFactor();
export const scaleDP = (size: number) => {
  // CORREGIDO: ya no hardcodea clamp de 0.7–1.3.
  // Usa el mismo rango que scale.ts para consistencia.
  const f = Math.min(Math.max(scale, 0.6), 1.5);
  return Math.round(size * f);
};

// ─── Hook de orientación ─────────────────────────────────────────────────────
export function useDeviceOrientation() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function setup() {
      if (getIsTablet()) {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.LANDSCAPE
        );
      } else {
        await ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.ALL
        );
      }
      setIsReady(true);
    }
    setup();
    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  return isReady;
}

// ─── Hook de escala reactiva ─────────────────────────────────────────────────
// Se actualiza automáticamente en rotación o cambio de ventana.
export function useResponsive() {
  const [dims, setDims] = useState(() => Dimensions.get("window"));

  useEffect(() => {
    const sub = Dimensions.addEventListener("change", ({ window }) => {
      setDims(window);
    });
    return () => sub.remove();
  }, []);

  // Lado largo para tablets en landscape
  const activeWidth = Math.max(dims.width, dims.height);
  const currentScale = activeWidth / DESIGN_WIDTH;
  const clampedScale = Math.min(Math.max(currentScale, 0.6), 1.5);

  const sp = useCallback(
    (size: number) => Math.round(size * clampedScale),
    [clampedScale]
  );

  return {
    width: dims.width,
    height: dims.height,
    scale: clampedScale,
    sp,
    isTablet: Math.min(dims.width, dims.height) >= 600,
    isLandscape: dims.width > dims.height,
  };
}

// ─── Hook de layout por onLayout ─────────────────────────────────────────────
// Útil cuando necesitas escalar relativo al tamaño REAL del contenedor,
// no de toda la pantalla. Ideal para componentes que pueden aparecer
// en panel dividido o en ventanas flotantes.
//
// Uso:
//   const { containerWidth, sp } = useLayout();
//   <View onLayout={onLayout}>
//     <Text style={{ fontSize: sp(16) }}>Hola</Text>
//   </View>
export function useLayout(referenceWidth = DESIGN_WIDTH) {
  const [containerWidth, setContainerWidth] = useState(
    Dimensions.get("window").width
  );

  const onLayout = useCallback(
    (event: { nativeEvent: { layout: { width: number } } }) => {
      const { width } = event.nativeEvent.layout;
      if (width > 0) setContainerWidth(width);
    },
    []
  );

  const containerScale = containerWidth / referenceWidth;
  const clampedScale = Math.min(Math.max(containerScale, 0.6), 1.5);

  const sp = useCallback(
    (size: number) => Math.round(size * clampedScale),
    [clampedScale]
  );

  return { containerWidth, scale: clampedScale, sp, onLayout };
}

export default {
  isPhone,
  isTablet,
  isLandscape,
  screenWidth,
  screenHeight,
  scale,
  scaleDP,
  useDeviceOrientation,
  useResponsive,
  useLayout,
};