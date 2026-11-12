import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef } from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";

// Intro animada (logo -> "ONBOARDING GAME" -> lema), igual que el antiguo
// INTROYES.mp4 pero hecha con Animated. NO volver a usar un <Video>
// (expo-av): en la tablet real dejaba el hilo de JS congelado en pantalla
// negra y ni onError ni un timeout lo recuperaban (specs/009, 2026-09-03).
const INTRO_MS = 11500;

export default function StartScreen() {
  const router = useRouter();
  const navigatedRef = useRef(false);
  const logo = useRef(new Animated.Value(0)).current;
  const titulo = useRef(new Animated.Value(0)).current;
  const lema = useRef(new Animated.Value(0)).current;
  const logoChico = useRef(new Animated.Value(0)).current;

  const goNext = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    router.replace("/registration");
  };

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    ).catch(() => {});

    const fade = (v: Animated.Value, to: number, ms = 700) =>
      Animated.timing(v, { toValue: to, duration: ms, useNativeDriver: true });

    Animated.sequence([
      fade(logo, 1, 900),
      Animated.delay(1800),
      Animated.parallel([fade(logo, 0), fade(logoChico, 1)]),
      fade(titulo, 1),
      Animated.delay(2000),
      fade(titulo, 0),
      fade(lema, 1),
    ]).start();

    // El avance no depende de la animación: siempre navega al cumplirse el tiempo.
    const timer = setTimeout(goNext, INTRO_MS);

    return () => {
      clearTimeout(timer);
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  const escala = logo.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  return (
    <Pressable style={styles.container} onPress={goNext}>
      <Animated.Image
        source={require("../assets/introfondo.jpg")}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
      />
      <Animated.Image
        source={require("../assets/LOGO.png")}
        style={[styles.logoChico, { opacity: logoChico }]}
        resizeMode="contain"
      />
      <View style={styles.centro}>
        <Animated.Image
          source={require("../assets/LOGO.png")}
          style={[styles.logo, { opacity: logo, transform: [{ scale: escala }] }]}
          resizeMode="contain"
        />
      </View>
      <View style={styles.centro}>
        <Animated.Text style={[styles.titulo, { opacity: titulo }]}>
          ONBOARDING{"\n"}GAME
        </Animated.Text>
      </View>
      <View style={styles.centro}>
        <Animated.Text style={[styles.lema, { opacity: lema }]}>
          Entrenamiento interactivo para AGP{"\n"}
          Innovación en el proceso de Integración y{"\n"}
          capacitación de nuevos colaboradores
        </Animated.Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#CFE8F0" },
  centro: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  logo: { width: "55%", height: "35%" },
  logoChico: { position: "absolute", top: 24, right: 32, width: 120, height: 45, zIndex: 1 },
  titulo: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: 84,
    lineHeight: 92,
    color: "#4C4C4C",
    textAlign: "center",
  },
  lema: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 40,
    lineHeight: 50,
    color: "#FFFFFF",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
