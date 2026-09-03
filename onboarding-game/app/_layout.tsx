import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Stack } from "expo-router";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import * as ScreenOrientation from "expo-screen-orientation";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");
const isPhone = Math.min(width, height) < 600;

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Medium": require("../assets/fonts/PlusJakartaSans-Medium.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const [orientationLocked, setOrientationLocked] = useState(false);

  useEffect(() => {
    async function lockOrientation() {
      if (!isPhone) {
        try {
          await ScreenOrientation.lockAsync(
            ScreenOrientation.OrientationLock.LANDSCAPE
          );
        } catch (error) {
          // No soportado (ej. navegador de escritorio) — seguimos sin forzar orientación.
          console.log("No se pudo bloquear la orientación:", error);
        }
      }
      setOrientationLocked(true);
    }
    lockOrientation();

    return () => {
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  useEffect(() => {
    // Deshabilitado temporalmente: en la tablet real (Bridgeless/New Architecture)
    // esta llamada se quedaba esperando indefinidamente y congelaba el hilo de JS
    // por completo (pantalla negra, sin error, sin crash). Pendiente investigar
    // con calma antes de reactivar — por ahora priorizamos que la app funcione.
    if (true) return;

    async function checkForUpdate() {
      if (__DEV__) return;
      try {
        const timeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout revisando actualización")), 5000)
        );
        const result: any = await Promise.race([Updates.checkForUpdateAsync(), timeout]);
        if (result?.isAvailable) {
          await Promise.race([Updates.fetchUpdateAsync(), timeout]);
          await Updates.reloadAsync();
        }
      } catch (error) {
        console.log("Update check failed:", error);
      }
    }
    checkForUpdate();
  }, []);

  if (!fontsLoaded || !orientationLocked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0F1B4C" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <Stack
        screenOptions={{
          headerShown: false,
          animation: "fade",
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F1B4C",
  },
});