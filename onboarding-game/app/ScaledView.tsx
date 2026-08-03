import React, { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";

// ScaledView es intencionalmente simple: flex: 1 para ocupar el espacio disponible.
// La escala se maneja en cada componente hijo con scaleDP/scaleText/etc.
// NO aplicar transform: scale aquí — eso escala todo el árbol incluyendo
// textos y bordes, produciendo resultados distintos en tablets con diferente
// densidad de píxeles (PixelRatio).

export default function ScaledView({
  children,
  style,
}: PropsWithChildren<{ style?: any }>) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
});
