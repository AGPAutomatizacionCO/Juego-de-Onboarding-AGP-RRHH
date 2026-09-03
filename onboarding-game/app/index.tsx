import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";

// Si el video falla o tarda demasiado (archivo faltante, error de códec,
// etc.), no debe dejar a la app varada en pantalla negra sin salida.
const FALLBACK_TIMEOUT_MS = 8000;

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

    const fallback = setTimeout(goNext, FALLBACK_TIMEOUT_MS);

    return () => {
      clearTimeout(fallback);
      ScreenOrientation.unlockAsync().catch(() => {});
    };
  }, []);

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status?.didJustFinish) {
      goNext();
    }
  };

  return (
    <View style={styles.container}>
      <Video
        source={require("../assets/INTROYES.mp4")}
        style={styles.background}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackStatusUpdate}
        onError={(error) => {
          console.log("Error reproduciendo video de intro:", error);
          goNext();
        }}
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
