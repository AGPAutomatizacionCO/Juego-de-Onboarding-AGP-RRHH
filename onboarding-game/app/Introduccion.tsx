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

/**
 * ✅ Sesión “limpia”:
 * - usa SOLO USUARIO_KEY
 * - si viene por params, lo guarda en USUARIO_KEY
 * - NO crea/usa legacy 'usuarioKey'
 */
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

export default function IntroduccionAGP() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const { width, height } = Dimensions.get("window");
  const scrollX = useRef(new Animated.Value(0)).current;

  const fondo = require("../assets/fondofinal.png");
  const botonVolver = require("../assets/botonmapa.png");
  const imagenAnimada = require("../assets/LOGO.png");

  // ✅ URL API
  const API_URL = API_BASE_URL;

  // ✅ Progreso real (de BD)
  const [progresoNivelBD, setProgresoNivelBD] = useState<number>(1);
  const [loadingProgreso, setLoadingProgreso] = useState<boolean>(false);

  // ✅ Progreso local (AsyncStorage) — PER USER
  const [visualDoneLocal, setVisualDoneLocal] = useState<boolean>(false);
  const [visualScoreLocal, setVisualScoreLocal] = useState<number | null>(null);
  const [lecturaUnlockedLocal, setLecturaUnlockedLocal] = useState<boolean>(false);

  // ✅ Lectura
  const [lecturaDoneLocal, setLecturaDoneLocal] = useState<boolean>(false);
  const [lecturaScoreLocal, setLecturaScoreLocal] = useState<number | null>(null);

  // ✅ Recordemos
  const [recordemosDoneLocal, setRecordemosDoneLocal] = useState<boolean>(false);
  const [recordemosScoreLocal, setRecordemosScoreLocal] = useState<number | null>(null);

  // ✅ Social
  const [socialDoneLocal, setSocialDoneLocal] = useState<boolean>(false);
  const [socialScoreLocal, setSocialScoreLocal] = useState<number | null>(null);

  // ✅ Evaluación
  const [evaluacionDoneLocal, setEvaluacionDoneLocal] = useState<boolean>(false);
  const [evaluacionScoreLocal, setEvaluacionScoreLocal] = useState<number | null>(null);

  // ✅ usuarioKey (puede venir desde navegación)
  const usuarioKeyFromParams = useMemo(() => {
    const raw = params?.usuarioKey;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  // ✅ usuarioKey real
  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);
  const [checkingSession, setCheckingSession] = useState<boolean>(true);

  // ====== KEYS (IDs de subislas) ======
  const NIVEL_VISUAL_KEY = 1;
  const NIVEL_LECTURA_KEY = 2;
  const NIVEL_RECORDEMOS_KEY = 3;
  const NIVEL_SOCIAL_KEY = 4;
  const NIVEL_EVALUACION_KEY = 5;

  // ✅ Namespacing por usuario - useMemo para que se actualice cuando usuarioKey cambie
  const keyU = useCallback(
    (suffix: string) => `u:${usuarioKey ?? 0}:${suffix}`,
    [usuarioKey]
  );

  // ✅ KEYS LOCALES (por usuario) - recalculadas cuando usuarioKey cambia
  const PROG_VISUAL_DONE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_VISUAL_KEY}_visual_done`), [keyU]);
  const PROG_VISUAL_SCORE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_VISUAL_KEY}_visual_score`), [keyU]);
  const PROG_LECTURA_UNLOCK_KEY = useMemo(() => keyU(`isla1_nivel2_lectura_unlocked`), [keyU]);

  const PROG_LECTURA_DONE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_LECTURA_KEY}_lectura_done`), [keyU]);
  const PROG_LECTURA_SCORE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_LECTURA_KEY}_lectura_score`), [keyU]);

  const PROG_RECORDEMOS_DONE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_done`), [keyU]);
  const PROG_RECORDEMOS_SCORE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_score`), [keyU]);

  const PROG_SOCIAL_DONE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_SOCIAL_KEY}_social_done`), [keyU]);
  const PROG_SOCIAL_SCORE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_SOCIAL_KEY}_social_score`), [keyU]);

  const PROG_EVALUACION_DONE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_done`), [keyU]);
  const PROG_EVALUACION_SCORE_KEY = useMemo(() => keyU(`isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_score`), [keyU]);

  /**
   * ✅ Limpieza de llaves legacy (SIN u:usuario) — SOLO UNA VEZ por usuario
   */
  const cleanupLegacyOnce = useCallback(async () => {
    if (!usuarioKey) return;

    const flag = `u:${usuarioKey}:legacy_cleaned_v1`;
    const already = await AsyncStorage.getItem(flag);
    if (already === "true") return;

    await AsyncStorage.multiRemove([
      // legacy de sesión
      "usuarioKey",

      // progreso cache viejo
      "USUARIO_PROGRESO_ISLA",
      "USUARIO_PROGRESO_NIVEL",
      "progresoIsla",
      "progresoNivel",
      "progress",

      // visual/lectura legacy sin user
      "nivelVisualCompletado",
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_done`,
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_score`,
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_aprobado`,
      `isla1_nivel${NIVEL_VISUAL_KEY}_visual_mismatches`,
      "isla1_nivel2_lectura_unlocked",

      `isla1_nivel${NIVEL_LECTURA_KEY}_lectura_done`,
      `isla1_nivel${NIVEL_LECTURA_KEY}_lectura_score`,
      `isla1_nivel${NIVEL_LECTURA_KEY}_lectura_aprobado`,

      // recordemos legacy
      "isla1_nivel3_recordemos_unlocked",
      `isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_done`,
      `isla1_nivel${NIVEL_RECORDEMOS_KEY}_recordemos_score`,
      `nivelCompleted_1_${NIVEL_RECORDEMOS_KEY}`,

      // social legacy
      `isla1_nivel${NIVEL_SOCIAL_KEY}_social_done`,
      `isla1_nivel${NIVEL_SOCIAL_KEY}_social_score`,

      // evaluación legacy
      `isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_done`,
      `isla1_nivel${NIVEL_EVALUACION_KEY}_evaluacion_score`,
    ]);

    await AsyncStorage.setItem(flag, "true");
    console.log("🧹 Legacy keys limpiadas para usuario:", usuarioKey);
  }, [usuarioKey]);

  // ✅ Tus subislas
  const subislas = [
    {
      id: 1,
      img: require("../assets/islas/introduccion/visual1.png"),
      top: 0.3,
      left: 0.04,
      width: 450,
      height: 350,
      screen: "nivelvisual1",
    },
    {
      id: 2,
      img: require("../assets/islas/introduccion/lectura1.png"),
      top: 0.3,
      left: 0.23,
      width: 450,
      height: 350,
      screen: "/nivellectura1",
    },
    {
      id: 3,
      img: require("../assets/islas/introduccion/cerebro1.png"),
      top: 0.32,
      left: 0.42,
      width: 400,
      height: 300,
      screen: "/nivelcerebro1",
    },
    {
      id: 4,
      img: require("../assets/islas/introduccion/social1.png"),
      top: 0.3,
      left: 0.6,
      width: 450,
      height: 350,
      screen: "/nivelsocial1",
    },
    {
      id: 5,
      img: require("../assets/islas/introduccion/evaluacion1.png"),
      top: 0.3,
      left: 0.8,
      width: 450,
      height: 350,
      screen: "/evaluacionFinal1",
    },
  ];

  const scrollWidth = width * 2.2;

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
  });

  /* ============================
     ✅ VALIDAR SESIÓN
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

  // ✅ corre limpieza legacy apenas ya tengas usuarioKey
  useEffect(() => {
    if (!usuarioKey) return;
    cleanupLegacyOnce();
  }, [usuarioKey, cleanupLegacyOnce]);

  /* ============================
     ✅ LEER PROGRESO LOCAL (por usuario)
     ============================ */
  const loadLocalProgress = useCallback(async () => {
    if (!usuarioKey) return;

    try {
      console.log("📦 Loading progress for user:", usuarioKey);

      // Visual
      let done = await AsyncStorage.getItem(PROG_VISUAL_DONE_KEY);
      let score = await AsyncStorage.getItem(PROG_VISUAL_SCORE_KEY);

      const lecturaUnlock = await AsyncStorage.getItem(PROG_LECTURA_UNLOCK_KEY);

      console.log("📦 Visual progress:", { done, score });

      // Si no está en local pero el progresoNivelBD > 1, significa que ya se completó
      // progresoNivel = 2 significa que completó nivel 1 y está en el 2
      // progresoNivel = 3 significa que completó niveles 1 y 2, está en el 3
      if (done !== "true" && progresoNivelBD >= 2) {
        console.log("📦 Visual: marcado como completado por progresoNivelBD");
        done = "true";
      }

      setVisualDoneLocal(done === "true");

      const n = score ? Number(score) : null;
      setVisualScoreLocal(Number.isFinite(n as any) ? (n as number) : null);

      setLecturaUnlockedLocal(lecturaUnlock === "true" || progresoNivelBD >= 2);

      // Lectura
      let lecturaDone = await AsyncStorage.getItem(PROG_LECTURA_DONE_KEY);
      let lecturaScore = await AsyncStorage.getItem(PROG_LECTURA_SCORE_KEY);

      // progresoNivelBD >= 3 significa que completó lectura (nivel 2)
      if (lecturaDone !== "true" && progresoNivelBD >= 3) {
        console.log("📦 Lectura: marcada como completada por progresoNivelBD");
        lecturaDone = "true";
      }

      console.log("📦 Lectura progress:", { done: lecturaDone, score: lecturaScore });

      setLecturaDoneLocal(lecturaDone === "true");

      const ln = lecturaScore ? Number(lecturaScore) : null;
      setLecturaScoreLocal(Number.isFinite(ln as any) ? (ln as number) : null);

      // Recordemos
      let recDone = await AsyncStorage.getItem(PROG_RECORDEMOS_DONE_KEY);
      let recScore = await AsyncStorage.getItem(PROG_RECORDEMOS_SCORE_KEY);
      
      const fallbackDone = await AsyncStorage.getItem(
        `nivelCompleted_1_${NIVEL_RECORDEMOS_KEY}`
      );

      // progresoNivelBD >= 4 significa que completó recordemos (nivel 3)
      if (recDone !== "true" && fallbackDone !== "1" && progresoNivelBD >= 4) {
        console.log("📦 Recordemos: marcado como completado por progresoNivelBD");
        recDone = "true";
      }

      const isRecDone = recDone === "true" || fallbackDone === "1";
      setRecordemosDoneLocal(isRecDone);

      const rn = recScore ? Number(recScore) : null;
      setRecordemosScoreLocal(Number.isFinite(rn as any) ? (rn as number) : null);

      // Social
      let socDone = await AsyncStorage.getItem(PROG_SOCIAL_DONE_KEY);
      let socScore = await AsyncStorage.getItem(PROG_SOCIAL_SCORE_KEY);

      // progresoNivelBD >= 5 significa que completó social (nivel 4)
      if (socDone !== "true" && progresoNivelBD >= 5) {
        console.log("📦 Social: marcado como completado por progresoNivelBD");
        socDone = "true";
      }

      setSocialDoneLocal(socDone === "true");

      const sn = socScore ? Number(socScore) : null;
      setSocialScoreLocal(Number.isFinite(sn as any) ? (sn as number) : null);

      // Evaluación
      let evaDone = await AsyncStorage.getItem(PROG_EVALUACION_DONE_KEY);
      let evaScore = await AsyncStorage.getItem(PROG_EVALUACION_SCORE_KEY);

      // progresoNivelBD >= 6 significa que completó evaluación (nivel 5)
      if (evaDone !== "true" && progresoNivelBD >= 6) {
        console.log("📦 Evaluación: marcada como completada por progresoNivelBD");
        evaDone = "true";
      }

      setEvaluacionDoneLocal(evaDone === "true");

      const en = evaScore ? Number(evaScore) : null;
      setEvaluacionScoreLocal(Number.isFinite(en as any) ? (en as number) : null);
    } catch (e: any) {
      console.error("📦 Error leyendo progreso local:", e?.message || e);

      setVisualDoneLocal(false);
      setVisualScoreLocal(null);
      setLecturaUnlockedLocal(false);

      setLecturaDoneLocal(false);
      setLecturaScoreLocal(null);

      setRecordemosDoneLocal(false);
      setRecordemosScoreLocal(null);

      setSocialDoneLocal(false);
      setSocialScoreLocal(null);

      setEvaluacionDoneLocal(false);
      setEvaluacionScoreLocal(null);
    }
    
    console.log("📦✅ Estado final del progreso:", {
      visualDoneLocal,
      visualScoreLocal,
      lecturaDoneLocal,
      lecturaScoreLocal,
      recordemosDoneLocal,
      recordemosScoreLocal,
      socialDoneLocal,
      socialScoreLocal,
      evaluacionDoneLocal,
      evaluacionScoreLocal,
    });
  }, [
    usuarioKey,
    progresoNivelBD,
    PROG_VISUAL_DONE_KEY,
    PROG_VISUAL_SCORE_KEY,
    PROG_LECTURA_UNLOCK_KEY,
    PROG_LECTURA_DONE_KEY,
    PROG_LECTURA_SCORE_KEY,
    PROG_RECORDEMOS_DONE_KEY,
    PROG_RECORDEMOS_SCORE_KEY,
    PROG_SOCIAL_DONE_KEY,
    PROG_SOCIAL_SCORE_KEY,
    PROG_EVALUACION_DONE_KEY,
    PROG_EVALUACION_SCORE_KEY,
    NIVEL_RECORDEMOS_KEY,
  ]);

/* ============================
     ✅ CARGAR PROGRESO BD
     ============================ */
  
  const loadBDProgress = useCallback(async () => {
    if (!usuarioKey) return;
    setLoadingProgreso(true);

    // Helper para obtener el prefijo correcto según el nivel
    const getNivelPrefix = (nivelNum: number): string => {
      switch (nivelNum) {
        case 1: return 'visual';
        case 2: return 'lectura';
        case 3: return 'recordemos';
        case 4: return 'social';
        case 5: return 'evaluacion';
        default: return 'visual';
      }
    };

    try {
      console.log("📡 Cargando progreso BD para usuario:", usuarioKey);
      const response = await fetch(`${API_URL}/api/islas/${usuarioKey}`);
      
      // Verificar si es JSON válido
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        console.warn("⚠️ BD no devolvió JSON, usando progreso local");
        setProgresoNivelBD(1);
        return;
      }
      
      const r = await response.json();
      const pn = Number(r?.progresoNivel ?? 1);
      console.log("📡 Progreso nivel desde BD:", pn, "| Respuesta:", r);
      setProgresoNivelBD(Number.isFinite(pn) && pn > 0 ? pn : 1);
      
      // CARGAR RESULTADOS DE NIVELES
      try {
        const respResultados = await fetch(`${API_URL}/api/islas/${usuarioKey}/resultados`);
        if (respResultados.ok) {
          const dataResultados = await respResultados.json();
          console.log("📊 Resultados desde BD:", dataResultados);
          
          // Guardar scores en AsyncStorage para uso local
          const resultados = dataResultados.resultados || {};
          for (const [nivelId, resultado] of Object.entries(resultados)) {
            const nivelNum = parseInt(nivelId.replace('nivel_', ''));
            const prefix = getNivelPrefix(nivelNum);
            const scoreKey = `u:${usuarioKey}:isla1_nivel${nivelNum}_${prefix}_score`;
            const doneKey = `u:${usuarioKey}:isla1_nivel${nivelNum}_${prefix}_done`;
            
            const puntaje = (resultado as any).puntaje ?? 0;
            await AsyncStorage.setItem(scoreKey, String(puntaje));
            await AsyncStorage.setItem(doneKey, "true");
            console.log(`📊 Guardado local: ${scoreKey} = ${puntaje}`);
          }
        }
      } catch (e) {
        console.warn("⚠️ Error cargando resultados:", e);
      }
      
      // CARGAR PROGRESO LOCAL INMEDIATAMENTE DESPUÉS
      await new Promise(resolve => setTimeout(resolve, 150));
      await loadLocalProgress();
    } catch (e: any) {
      console.error("⚠️ Error cargando progreso BD:", e?.message || e);
      setProgresoNivelBD(1);
    } finally {
      setLoadingProgreso(false);
    }
  }, [API_URL, usuarioKey, loadLocalProgress]);

  useFocusEffect(
    useCallback(() => {
      loadBDProgress();
    }, [loadBDProgress])
  );

  // ✅ Progreso efectivo (BD + Local)
  const progresoNivelEfectivo = useMemo(() => {
    // visualDone -> desbloquea 2
    // lecturaDone -> desbloquea 3
    // recordemosDone -> desbloquea 4
    // socialDone -> desbloquea 5
    const localByDone =
      socialDoneLocal
        ? 5
        : recordemosDoneLocal
        ? 4
        : lecturaDoneLocal
        ? 3
        : visualDoneLocal
        ? 2
        : 1;

    const localUnlock = lecturaUnlockedLocal ? 2 : 1;

    const effective = Math.max(progresoNivelBD, localByDone, localUnlock);
    console.log("🎯 Progreso efectivo:", { progresoNivelBD, localByDone, localUnlock, effective });
    return effective;
  }, [
    progresoNivelBD,
    visualDoneLocal,
    lecturaDoneLocal,
    recordemosDoneLocal,
    socialDoneLocal,
    lecturaUnlockedLocal,
  ]);

const onPressNivel = (nivelId: number, screen: string) => {
    if (!usuarioKey) {
      Alert.alert(
        "Falta sesión",
        "No se encontró usuarioKey. Vuelve a iniciar sesión.",
        [{ text: "OK", onPress: () => router.replace("/registration") }]
      );
      return;
    }

    console.log("🎯 onPressNivel:", { 
      nivelId, 
      screen, 
      visualDoneLocal, 
      lecturaDoneLocal, 
      recordemosDoneLocal, 
      socialDoneLocal, 
      evaluacionDoneLocal,
      progresoNivelEfectivo 
    });
    console.log("🎯 Scores:", { 
      visualScoreLocal, 
      lecturaScoreLocal, 
      recordemosScoreLocal, 
      socialScoreLocal, 
      evaluacionScoreLocal 
    });

    // Check if level is already completed - don't allow to play again
    let alreadyDone = false;
    let scoreText = "";
    
    if (nivelId === 1 && visualDoneLocal) {
      alreadyDone = true;
      scoreText = visualScoreLocal != null ? `${visualScoreLocal}%` : "100%";
    } else if (nivelId === 2 && lecturaDoneLocal) {
      alreadyDone = true;
      scoreText = lecturaScoreLocal != null ? `${lecturaScoreLocal}%` : "100%";
    } else if (nivelId === 3 && recordemosDoneLocal) {
      alreadyDone = true;
      scoreText = recordemosScoreLocal != null ? `${recordemosScoreLocal}%` : "100%";
    } else if (nivelId === 4 && socialDoneLocal) {
      alreadyDone = true;
      scoreText = socialScoreLocal != null ? `${socialScoreLocal}%` : "100%";
    } else if (nivelId === 5 && evaluacionDoneLocal) {
      alreadyDone = true;
      scoreText = evaluacionScoreLocal != null ? `${evaluacionScoreLocal}%` : "100%";
    }

    if (alreadyDone) {
      const levelNames: Record<number, string> = {
        1: "Visual",
        2: "Lectura",
        3: "Recordemos",
        4: "Social",
        5: "Evaluación Final"
      };
      const nombreNivel = levelNames[nivelId] || `Nivel ${nivelId}`;
      Alert.alert(
        `${nombreNivel} completado`,
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
        <Image
          source={botonVolver}
          style={{ width: 90, height: 90, resizeMode: "contain" }}
        />
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
            <Animated.View
            style={[
              styles.header,
              {
                width,
                transform: [{ translateX: scrollX }],
              },
            ]}
          >
            <Text style={styles.titulo}>INTRODUCCIÓN AGP</Text>
            {loadingProgreso ? (
              <Text style={styles.loadingText}>Cargando progreso…</Text>
            ) : null}
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
                <TouchableOpacity
                  onPress={() => onPressNivel(isla.id, isla.screen)}
                  activeOpacity={0.8}
                >
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

                {/* ✅ Evaluación */}
                {isla.id === 5 && evaluacionDoneLocal ? (
                  <View style={[styles.pctBox, styles.pctBoxCompleted]}>
                    <Text style={styles.pctText}>
                      {typeof evaluacionScoreLocal === "number" ? `${evaluacionScoreLocal}%` : "✓"}
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

                {/* ✅ Evaluación */}
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
    fontSize: 52,
    color: "#000000",
    textAlign: "center",
    textShadowColor: "rgba(0,0,0,0.25)",
    textShadowRadius: 5,
    letterSpacing: 1,
  },
  loadingText: {
    marginTop: 6,
    textAlign: "center",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 14,
    color: "#000",
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