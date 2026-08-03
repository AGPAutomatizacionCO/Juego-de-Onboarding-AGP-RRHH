import { useFonts } from "expo-font";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
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

/* ===== helper ===== */
async function apiJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;

  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg =
      data?.message ||
      data?.error ||
      `Error HTTP ${res.status} en ${url.replace(/^https?:\/\//, "")}`;
    throw new Error(msg);
  }

  return data;
}

async function ensureUsuarioKeyOrNull(fromParams: number | null) {
  if (fromParams && fromParams > 0) {
    await AsyncStorage.setItem("USUARIO_KEY", String(fromParams));
    return fromParams;
  }

  const kMain = await AsyncStorage.getItem("USUARIO_KEY");
  const n1 = Number(kMain);
  if (Number.isFinite(n1) && n1 > 0) return n1;

  return null;
}

export default function ProcesosDeProduccion() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { width, height } = Dimensions.get("window");
  const scrollX = useRef(new Animated.Value(0)).current;

  const fondo        = require("../assets/fondofinal.png");
  const botonVolver  = require("../assets/botonmapa.png");
  const imagenAnimada = require("../assets/LOGO.png");

  const API_URL = API_BASE_URL;

  const [loadingProgreso, setLoadingProgreso] = useState<boolean>(false);

  // ── Progreso local ──
  const [visualDoneLocal,      setVisualDoneLocal]      = useState<boolean>(false);
  const [visualScoreLocal,     setVisualScoreLocal]     = useState<number | null>(null);
  const [lecturaUnlockedLocal, setLecturaUnlockedLocal] = useState<boolean>(false);

  const [lecturaDoneLocal,     setLecturaDoneLocal]     = useState<boolean>(false);
  const [lecturaScoreLocal,    setLecturaScoreLocal]    = useState<number | null>(null);

  const [recordemosDoneLocal,  setRecordemosDoneLocal]  = useState<boolean>(false);
  const [recordemosScoreLocal, setRecordemosScoreLocal] = useState<number | null>(null);

  const [socialDoneLocal,      setSocialDoneLocal]      = useState<boolean>(false);
  const [socialScoreLocal,     setSocialScoreLocal]     = useState<number | null>(null);

  const [evaluacionDoneLocal,  setEvaluacionDoneLocal]  = useState<boolean>(false);
  const [evaluacionScoreLocal, setEvaluacionScoreLocal] = useState<number | null>(null);

  // ── Session ──
  const usuarioKeyFromParams = useMemo(() => {
    const raw = params?.usuarioKey;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const [usuarioKey,      setUsuarioKey]      = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);

  // ── Constantes isla ──
  const ISLA_KEY             = 3;
  const NIVEL_VISUAL_KEY     = 11;
  const NIVEL_LECTURA_KEY    = 12;
  const NIVEL_RECORDEMOS_KEY = 13;
  const NIVEL_SOCIAL_KEY     = 14;
  const NIVEL_EVALUACION_KEY = 15;

  // ── Subislas ──
  const subislas = [
    { id: 1, img: require("../assets/islas/introduccion/visual1.png"),     top: 0.3,  left: 0.04, width: 450, height: 350, screen: "nivelvisual3" },
    { id: 2, img: require("../assets/islas/introduccion/lectura1.png"),    top: 0.3,  left: 0.23, width: 450, height: 350, screen: "/nivellectura3" },
    { id: 3, img: require("../assets/islas/introduccion/cerebro1.png"),    top: 0.32, left: 0.42, width: 400, height: 300, screen: "/nivelcerebro3" },
    { id: 4, img: require("../assets/islas/introduccion/social1.png"),     top: 0.3,  left: 0.6,  width: 450, height: 350, screen: "/nivelsocial3" },
    { id: 5, img: require("../assets/islas/introduccion/evaluacion1.png"), top: 0.3,  left: 0.8,  width: 450, height: 350, screen: "/evaluacionFinal3" },
  ];

  const scrollWidth = width * 2.2;

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":    require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
  });

  /* ============================
     VALIDAR SESIÓN
     ============================ */
  useEffect(() => {
    const run = async () => {
      try {
        setCheckingSession(true);
        const uk = await ensureUsuarioKeyOrNull(usuarioKeyFromParams);

        if (!uk) {
          Alert.alert(
            "Falta sesión",
            "No se encontró usuarioKey. Vuelve a iniciar sesión.",
            [{ text: "OK", onPress: () => router.replace("/registration") }]
          );
          return;
        }

        setUsuarioKey(uk);
      } finally {
        setCheckingSession(false);
      }
    };

    run();
  }, [router, usuarioKeyFromParams]);

  /* ============================
     LIMPIEZA LEGACY
     ============================ */
  const cleanupLegacyOnce = useCallback(async () => {
    if (!usuarioKey) return;

    const flag = `u:${usuarioKey}:legacy_cleaned_isla3_v1`;
    const already = await AsyncStorage.getItem(flag);
    if (already === "true") return;

    await AsyncStorage.multiRemove([
      "usuarioKey",
      "USUARIO_PROGRESO_ISLA",
      "USUARIO_PROGRESO_NIVEL",
      "progresoIsla",
      "progresoNivel",
      "progress",
      "nivelVisualCompletado",
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_done`,
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_score`,
      "isla1_nivel2_lectura_unlocked",
      `isla1_nivel${NIVEL_LECTURA_KEY}_lectura_done`,
      `isla1_nivel${NIVEL_LECTURA_KEY}_lectura_score`,
      "isla1_nivel3_recordemos_unlocked",
      `isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_done`,
      `isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_score`,
      `nivelCompleted_1_${NIVEL_RECORDEMOS_KEY}`,
      `isla1_nivel${NIVEL_SOCIAL_KEY}_social_done`,
      `isla1_nivel${NIVEL_SOCIAL_KEY}_social_score`,
      `isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_done`,
      `isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_score`,
    ]);

    await AsyncStorage.setItem(flag, "true");
    console.log("🧹 Legacy keys isla3 limpiadas para usuario:", usuarioKey);
  }, [usuarioKey]);

  useEffect(() => {
    if (!usuarioKey) return;
    cleanupLegacyOnce();
  }, [usuarioKey, cleanupLegacyOnce]);

  /* ============================
     LEER PROGRESO LOCAL
     ============================ */
  const loadLocalProgress = useCallback(async () => {
    if (!usuarioKey) return;

    try {
      console.log("📦 Isla3: Loading progress for user:", usuarioKey);

      const vDone   = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_VISUAL_KEY}_visual_done`);
      const vScore  = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_VISUAL_KEY}_visual_score`);
      const lUnlock = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel2_lectura_unlocked`);

      setVisualDoneLocal(vDone === "true");
      setVisualScoreLocal(vScore ? Number(vScore) : null);
      setLecturaUnlockedLocal(lUnlock === "true");

      const lDone  = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_LECTURA_KEY}_lectura_done`);
      const lScore = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_LECTURA_KEY}_lectura_score`);

      setLecturaDoneLocal(lDone === "true");
      setLecturaScoreLocal(lScore ? Number(lScore) : null);

      const rDone      = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_done`);
      const rScore     = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_score`);
      const fallbackRec = await AsyncStorage.getItem(`nivelCompleted_1_${NIVEL_RECORDEMOS_KEY}`);

      setRecordemosDoneLocal(rDone === "true" || fallbackRec === "1");
      setRecordemosScoreLocal(rScore ? Number(rScore) : null);

      const sDone  = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_SOCIAL_KEY}_social_done`);
      const sScore = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_SOCIAL_KEY}_social_score`);

      setSocialDoneLocal(sDone === "true");
      setSocialScoreLocal(sScore ? Number(sScore) : null);

      const eDone  = await AsyncStorage.getItem(`u:${usuarioKey}:isla4_nivel20_evaluacion_done`);
      const eScore = await AsyncStorage.getItem(`u:${usuarioKey}:isla4_nivel20_evaluacion_score`);

      // ✅ FIX: keys corregidas para coincidir con evaluacionFinal3 (ISLA_KEY=4, NIVEL_KEY=20)
      console.log("🎯 Evaluacion keys:", {
        key_done:  `u:${usuarioKey}:isla4_nivel20_evaluacion_done`,
        key_score: `u:${usuarioKey}:isla4_nivel20_evaluacion_score`,
        eDone,
        eScore,
      });

      setEvaluacionDoneLocal(eDone === "true");
      setEvaluacionScoreLocal(eScore ? Number(eScore) : null);

      console.log("📦 Isla3: Progreso cargado", { vDone, lDone, rDone, sDone, eDone });
    } catch (e) {
      console.error("📦 Isla3: Error leyendo progreso local:", e);

      setVisualDoneLocal(false);      setVisualScoreLocal(null);
      setLecturaUnlockedLocal(false);
      setLecturaDoneLocal(false);     setLecturaScoreLocal(null);
      setRecordemosDoneLocal(false);  setRecordemosScoreLocal(null);
      setSocialDoneLocal(false);      setSocialScoreLocal(null);
      setEvaluacionDoneLocal(false);  setEvaluacionScoreLocal(null);
    }
  }, [usuarioKey]);

  const loadBDProgress = useCallback(async () => {
    if (!usuarioKey) return;
    setLoadingProgreso(true);
    try {
      await loadLocalProgress();
    } catch (e: any) {
      console.error("⚠️ Isla3: Error cargando progreso:", e?.message || e);
    } finally {
      setLoadingProgreso(false);
    }
  }, [usuarioKey, loadLocalProgress]);

  useFocusEffect(
    useCallback(() => {
      loadBDProgress();
    }, [loadBDProgress])
  );

  /* ============================
     PROGRESO EFECTIVO
     ✅ FIX: incluye evaluacionDoneLocal
     ============================ */
  const progresoNivelEfectivo = useMemo(() => {
    const localByDone =
      evaluacionDoneLocal   ? 6
      : socialDoneLocal     ? 5
      : recordemosDoneLocal ? 4
      : lecturaDoneLocal    ? 3
      : visualDoneLocal     ? 2
      : 1;

    const localUnlock = lecturaUnlockedLocal ? 2 : 1;
    const effective   = Math.max(localByDone, localUnlock);

    console.log("🎯 Isla3: Progreso efectivo:", { localByDone, localUnlock, effective });
    return effective;
  }, [
    visualDoneLocal,
    lecturaDoneLocal,
    recordemosDoneLocal,
    socialDoneLocal,
    evaluacionDoneLocal,
    lecturaUnlockedLocal,
  ]);

  /* ============================
     ON PRESS NIVEL
     ============================ */
  const onPressNivel = (nivelId: number, screen: string) => {
    if (!usuarioKey) {
      Alert.alert(
        "Falta sesión",
        "No se encontró usuarioKey. Vuelve a iniciar sesión.",
        [{ text: "OK", onPress: () => router.replace("/registration") }]
      );
      return;
    }

    let alreadyDone = false;
    let scoreText   = "";

    if      (nivelId === 1 && visualDoneLocal)     { alreadyDone = true; scoreText = visualScoreLocal      != null ? `${visualScoreLocal}%`      : "100%"; }
    else if (nivelId === 2 && lecturaDoneLocal)    { alreadyDone = true; scoreText = lecturaScoreLocal     != null ? `${lecturaScoreLocal}%`     : "100%"; }
    else if (nivelId === 3 && recordemosDoneLocal) { alreadyDone = true; scoreText = recordemosScoreLocal  != null ? `${recordemosScoreLocal}%`  : "100%"; }
    else if (nivelId === 4 && socialDoneLocal)     { alreadyDone = true; scoreText = socialScoreLocal      != null ? `${socialScoreLocal}%`      : "100%"; }
    else if (nivelId === 5 && evaluacionDoneLocal) { alreadyDone = true; scoreText = evaluacionScoreLocal  != null ? `${evaluacionScoreLocal}%`  : "100%"; }

    if (alreadyDone) {
      const levelNames: Record<number, string> = {
        1: "Visual", 2: "Lectura", 3: "Recordemos", 4: "Social", 5: "Evaluación Final",
      };
      Alert.alert(
        `${levelNames[nivelId] || `Nivel ${nivelId}`} completado`,
        `Ya has completado este nivel.\nTu resultado: ${scoreText}`,
        [{ text: "OK" }]
      );
      return;
    }

    if (nivelId > progresoNivelEfectivo) {
      Alert.alert("Nivel bloqueado", `Completa primero el nivel ${progresoNivelEfectivo}.`);
      return;
    }

    router.push({ pathname: screen as any, params: { usuarioKey } });
  };

  /* ============================
     RENDER
     ============================ */
  if (!loaded) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Cargando fuentes...</Text>
      </View>
    );
  }

  if (checkingSession) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text>Validando sesión…</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, overflow: "hidden" }}>
      <TouchableOpacity
        style={styles.botonVolver}
        onPress={() => router.push("/mapa")}
        activeOpacity={0.8}
      >
        <Image source={botonVolver} style={{ width: 90, height: 90, resizeMode: "contain" }} />
      </TouchableOpacity>

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
          source={fondo}
          style={[styles.background, { width: scrollWidth }]}
          resizeMode="cover"
        >
          <Animated.View style={[styles.imagenAnimada, { transform: [{ translateX: scrollX }] }]}>
            <Image source={imagenAnimada} style={{ width: 180, height: 180, resizeMode: "contain" }} />
          </Animated.View>

          {subislas.map((isla) => {
            const bloqueado = isla.id > progresoNivelEfectivo;

            return (
              <View
                key={isla.id}
                style={{
                  position: "absolute",
                  top: isla.top * height,
                  left: isla.left * scrollWidth,
                }}
              >
                <TouchableOpacity onPress={() => onPressNivel(isla.id, isla.screen)} activeOpacity={0.8}>
                  <Image
                    source={isla.img}
                    style={{
                      width: isla.width,
                      height: isla.height,
                      resizeMode: "contain",
                      opacity: bloqueado ? 0.5 : 1,
                    }}
                  />
                </TouchableOpacity>

                {/* ✅ Visual */}
                {isla.id === 1 && visualDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof visualScoreLocal === "number" ? `${visualScoreLocal}%` : "✓"}
                    </Text>
                  </View>
                ) : null}

                {/* ✅ Lectura */}
                {isla.id === 2 && lecturaDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof lecturaScoreLocal === "number" ? `${lecturaScoreLocal}%` : "✓"}
                    </Text>
                  </View>
                ) : null}

                {/* ✅ Recordemos */}
                {isla.id === 3 && recordemosDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof recordemosScoreLocal === "number" ? `${recordemosScoreLocal}%` : "✓"}
                    </Text>
                  </View>
                ) : null}

                {/* ✅ Social */}
                {isla.id === 4 && socialDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof socialScoreLocal === "number" ? `${socialScoreLocal}%` : "✓"}
                    </Text>
                  </View>
                ) : null}

                {/* ✅ FIX: Evaluación — mismo patrón que los demás niveles, sin pctBoxEvaluacion */}
                {isla.id === 5 && evaluacionDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof evaluacionScoreLocal === "number" ? `${evaluacionScoreLocal}%` : "✓"}
                    </Text>
                  </View>
                ) : null}
              </View>
            );
          })}

          <Animated.View
            style={[styles.header, { width, transform: [{ translateX: scrollX }] }]}
          >
            <Text style={styles.titulo}>PROCESOS DE PRODUCCIÓN</Text>
            {loadingProgreso ? (
              <Text style={styles.loadingText}>Cargando progreso…</Text>
            ) : null}
          </Animated.View>
        </ImageBackground>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    height: "100%",
  },
  header: {
    position: "absolute",
    top: 65,
    left: 0,
    zIndex: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  titulo: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 50,
    color: "#000000",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 5,
    letterSpacing: 1,
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: "#000000",
  },
  imagenAnimada: {
    position: "absolute",
    top: 0.5,
    left: 1050,
    zIndex: 50,
  },
  botonVolver: {
    position: "absolute",
    top: 600,
    left: 30,
    zIndex: 20,
  },
  pctBox: {
    position: "absolute",
    bottom: -18,
    alignSelf: "center",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 58,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
    borderWidth: 2,
    borderColor: "#4CAF50",
  },
  pctBoxCompleted: {
    backgroundColor: "#E8F5E9",
    borderColor: "#4CAF50",
    shadowColor: "#4CAF50",
    shadowOpacity: 0.3,
  },
  pctText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#2E7D32",
    textAlign: "center",
    fontWeight: "bold",
  },
});