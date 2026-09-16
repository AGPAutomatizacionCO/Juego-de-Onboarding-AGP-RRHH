import React from "react";
import { Animated, StyleSheet, Text } from "react-native";

// Alert.alert de React Native no se renderiza en react-native-web (confirmado
// varias veces en este proyecto: parecia que "no pasaba nada" al completar un
// nivel ya hecho, o al no haber imagenes en un nivel, cuando en realidad si
// se ejecutaba la logica mas solo faltaba el aviso visual). Este toast propio
// funciona igual en web, Android y iOS.
export function useToast() {
  const [msg, setMsg] = React.useState<string | null>(null);
  const opacity = React.useRef(new Animated.Value(0)).current;
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = React.useCallback(
    (text: string, durationMs: number = 3000) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setMsg(text);
      opacity.stopAnimation();
      opacity.setValue(1);
      timerRef.current = setTimeout(() => {
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => setMsg(null));
      }, durationMs);
    },
    [opacity]
  );

  const ToastView = React.useCallback(() => {
    if (!msg) return null;
    return (
      <Animated.View style={[styles.toast, { opacity }]} pointerEvents="none">
        <Text style={styles.toastText}>{msg}</Text>
      </Animated.View>
    );
  }, [msg, opacity]);

  return { showToast, ToastView };
}

const styles = StyleSheet.create({
  toast: {
    position: "absolute",
    bottom: 34,
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  toastText: {
    backgroundColor: "rgba(15,27,76,0.95)",
    color: "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    overflow: "hidden",
    maxWidth: "90%",
  },
});
