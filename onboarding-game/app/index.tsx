import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef } from "react";
import { Image, StyleSheet, View } from "react-native";

// El video de intro (expo-av/ExoPlayer) se quitó: en la tablet real el
// hilo de JS quedaba congelado indefinidamente al montar ese componente
// (sin error, sin crash), y ni el onError ni un timeout en JS lograban
// recuperar la app. Se reemplazó por una imagen estática para eliminar
// esa dependencia por completo.
const SPLASH_DURATION_MS = 3000;

export default function StartScreen() {
  const router = useRouter();
  const navigatedRef = useRef(false);

  const goNext = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace("/registration");
  };

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    ).catch(() => {});

    const timer = setTimeout(goNext, SPLASH_DURATION_MS);

    return () => {
      clearTimeout(timer);
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/introfinal.png")}
        style={styles.background}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  background: {
    width: "100%",
    height: "100%",
  },
});
