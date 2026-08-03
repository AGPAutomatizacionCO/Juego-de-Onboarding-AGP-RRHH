import { Video, ResizeMode } from "expo-av";
import { useRouter } from "expo-router";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";

export default function StartScreen() {
  const router = useRouter();

  useEffect(() => {
    ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.LANDSCAPE
    );

    return () => {
      ScreenOrientation.unlockAsync();
    };
  }, []);

  const handlePlaybackStatusUpdate = (status: any) => {
    if (status?.didJustFinish) {
      router.replace("/registration");
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
