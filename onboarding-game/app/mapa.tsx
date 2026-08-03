import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

// 🔗 API (Node + Express + SQL Server)
const API_URL = API_BASE_URL;

export default function MapaScreen() {
  const router = useRouter();
  const { width, height } = Dimensions.get("window");

  const fondoMapa = require("../assets/fondofinal.png");
  const imagenAnimada = require("../assets/LOGO.png");

  // 🔥 DISEÑO ORIGINAL (NO SE TOCA)
  const islas = [
    {
      id: 1,
      img: require("../assets/islas/introduccion.png"),
      top: 0.4,
      left: 0.01,
      width: 460,
      height: 360,
      screen: "/Introduccion",
    },
    {
      id: 2,
      img: require("../assets/islas/hse.png"),
      top: 0.08,
      left: 0.13,
      width: 450,
      height: 350,
      screen: "/HSE",
    },
    {
      id: 4,
      img: require("../assets/islas/conceptos.png"),
      top: 0.04,
      left: 0.34,
      width: 480,
      height: 380,
      screen: "/Conceptos",
    },
    {
      id: 3,
      img: require("../assets/islas/procesos.png"),
      top: 0.42,
      left: 0.24,
      width: 460,
      height: 360,
      screen: "/Procesos",
    },
    {
      id: 7,
      img: require("../assets/islas/lectura.png"),
      top: 0.36,
      left: 0.64,
      width: 500,
      height: 400,
      screen: "/LecturaOF",
    },
    {
      id: 6,
      img: require("../assets/islas/metrologia.png"),
      top: 0.001,
      left: 0.54,
      width: 550,
      height: 450,
      screen: "/Metrologia",
    },
    {
      id: 8,
      img: require("../assets/islas/calidad.png"),
      top: 0.06,
      left: 0.74,
      width: 480,
      height: 380,
      screen: "/Calidad",
    },
    {
      id: 5,
      img: require("../assets/islas/manipulacion.png"),
      top: 0.38,
      left: 0.44,
      width: 480,
      height: 380,
      screen: "/Manipulacion",
    },
    {
      id: 9,
      img: require("../assets/islas/evaluacion.png"),
      top: 0.41,
      left: 0.83,
      width: 450,
      height: 350,
      screen: "/EvaluacionF",
    },
  ];

  // 🗄️ ESTADO DESDE LA BD
  const [estadoIslas, setEstadoIslas] = useState<
    { id: number; activa: boolean }[]
  >([]);

  // ✅ Porcentajes de cada isla
  const [porcentajesIslas, setPorcentajesIslas] = useState<Record<number, number>>({});

  const cargarIslas = useCallback(async () => {
    try {
      const usuarioKeyStr = await AsyncStorage.getItem("USUARIO_KEY");
      const usuarioKey = Number(usuarioKeyStr);

      if (!usuarioKeyStr || !Number.isFinite(usuarioKey) || usuarioKey <= 0) {
        router.replace("/registration");
        return;
      }

      // Primero desbloquear todas las islas si el usuario tiene algún resultado de evaluación
      try {
        const unlockRes = await fetch(`${API_URL}/api/islas/${usuarioKey}/avanzar`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nuevaIsla: 9 }),
        });
        console.log("🔓 Desbloqueo de islas al cargar mapa:", unlockRes.ok);
      } catch (e) {
        console.log("⚠️ Error en desbloqueo:", e);
      }

      const res = await fetch(`${API_URL}/api/islas/${usuarioKey}`);
      const data = await res.json();
      console.log("🔓 Estado de islas desde BD:", data);

      if (Array.isArray(data?.islas)) {
        setEstadoIslas(data.islas);
      } else {
        setEstadoIslas([{ id: 1, activa: true }]);
      }

      // ✅ Cargar porcentajes — isla 4 (Procesos) usa nivelKey 20
      const newPorcentajes: Record<number, number> = {};
      const nivelesEvaluacion: Record<number, number> = {
        1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40, 9: 45,
      };

      for (let islaKey = 1; islaKey <= 9; islaKey++) {
        const nivelKey = nivelesEvaluacion[islaKey];

        // Intentar desde BD
        try {
          const pctRes = await fetch(
            `${API_URL}/api/niveles/evaluacionFinal/resultado/${usuarioKey}/${nivelKey}`
          );
          const pctData = await pctRes.json();
          if (pctData?.success && pctData?.data) {
            const pct = Number(pctData.data.puntaje ?? 0);
            if (pct > 0) {
              newPorcentajes[islaKey] = pct;
              console.log(`📊 Isla ${islaKey} desde BD (nivel ${nivelKey}):`, pct);
            }
          }
        } catch (e) {
          console.log(`⚠️ Error Isla ${islaKey} desde BD:`, e);
        }

        // Fallback AsyncStorage
        if (newPorcentajes[islaKey] == null) {
          const local = await AsyncStorage.getItem(
            `u:${usuarioKey}:isla${islaKey}_nivel${nivelKey}_evaluacion_score`
          );
          if (local) {
            newPorcentajes[islaKey] = Number(local);
            console.log(`📊 Isla ${islaKey} desde local (nivel ${nivelKey}):`, local);
          }
        }
      }

      setPorcentajesIslas(newPorcentajes);
    } catch (err) {
      console.log("Error cargando islas:", err);
      router.replace("/registration");
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      cargarIslas();
    }, [cargarIslas])
  );

  const islaActiva = (id: number) => {
    const isla = estadoIslas.find((i) => i.id === id);
    return isla ? isla.activa : false;
  };

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollWidth = width * 2.2;

  return (
    <Animated.ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      scrollEventThrottle={16}
      onScroll={Animated.event(
        [{ nativeEvent: { contentOffset: { x: scrollX } } }],
        { useNativeDriver: true }
      )}
      contentContainerStyle={{ width: scrollWidth }}
    >
      <ImageBackground
        source={fondoMapa}
        style={[styles.background, { width: scrollWidth, height }]}
        resizeMode="cover"
      >
        {/* LOGO ANIMADO */}
        <Animated.View
          style={[
            styles.imagenAnimada,
            { transform: [{ translateX: scrollX }] },
          ]}
        >
          <Image
            source={imagenAnimada}
            style={{ width: 180, height: 180, resizeMode: "contain" }}
          />
        </Animated.View>

        {/* ISLAS */}
        {islas.map((isla) => {
          const activa = islaActiva(isla.id);

          const inputRange = [
            isla.left * scrollWidth - width,
            isla.left * scrollWidth,
            isla.left * scrollWidth + width,
          ];

          const translateY = scrollX.interpolate({
            inputRange,
            outputRange: [30, 0, -30],
            extrapolate: "clamp",
          });

          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.8, 1, 0.8],
            extrapolate: "clamp",
          });

          return (
            <Animated.View
              key={isla.id}
              style={{
                position: "absolute",
                top: isla.top * height,
                left: isla.left * scrollWidth,
                transform: [{ translateY }, { scale }],
                opacity: activa ? 1 : 0.35,
              }}
            >
              <TouchableOpacity
                disabled={!activa}
                activeOpacity={0.8}
                onPress={() => router.push(isla.screen)}
              >
                <Image
                  source={isla.img}
                  style={{
                    width: isla.width,
                    height: isla.height,
                    resizeMode: "contain",
                  }}
                />
              </TouchableOpacity>

              {/* ✅ Porcentaje de la isla */}
              {porcentajesIslas[isla.id] != null ? (
                <View style={styles.pctBox}>
                  <Text style={styles.pctText}>{porcentajesIslas[isla.id]}%</Text>
                </View>
              ) : null}

              {/* ✅ Botón Ver Podio */}
              {porcentajesIslas[isla.id] != null ? (
                <TouchableOpacity
                  style={styles.podioBtn}
                  onPress={() => {
                    const nivelKeys: Record<number, number> = {
                      1: 5, 2: 10, 3: 15, 4: 20, 5: 25, 6: 30, 7: 35, 8: 40, 9: 45,
                    };
                    const nivelKey = nivelKeys[isla.id] ?? 5;
                    router.push(`/podio?nivelKey=${nivelKey}&islaKey=${isla.id}` as any);
                  }}
                >
                  <Text style={styles.podioBtnText}>Ver Podio</Text>
                </TouchableOpacity>
              ) : null}
            </Animated.View>
          );
        })}
      </ImageBackground>
    </Animated.ScrollView>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    justifyContent: "center",
  },
  imagenAnimada: {
    position: "absolute",
    top: 0.5,
    left: 1050,
    zIndex: 50,
  },
  pctBox: {
    position: "absolute",
    bottom: -15,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  pctText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 14,
    color: "#0F1B4C",
    textAlign: "center",
  },
  podioBtn: {
    position: "absolute",
    bottom: -45,
    alignSelf: "center",
    backgroundColor: "#a3ecf1",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 70,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 4,
  },
  podioBtnText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: "#0F1B4C",
    textAlign: "center",
  },
});