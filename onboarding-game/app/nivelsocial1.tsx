import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Alert,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

const fondo = require("../assets/FONDOREG.png");

const API_BASE = API_BASE_URL;
const API_URL = `${API_BASE}/api`;
const ISLA_KEY = 1;
const NIVEL_KEY_RECORDEMOS = 3;
const NIVEL_KEY_SOCIAL = 4;
const COMPLETE_ENDPOINT = `/niveles/social/${NIVEL_KEY_SOCIAL}/resultado`;

type Option   = { text: string; correct: boolean };
type Question = { id: string; phrase: string; options: Option[] };

const QUESTIONS_FALLBACK: Question[] = [
  {
    id: "q1",
    phrase: "Al inicio de la jornada tu gestor te indica que debes pulir 20 vidrios, te preocupas y empiezas a realizar el pulido de los 20 vidrios rápidamente, sin embargo, al revisar, el gestor encuentra varios errores en el pulido y debes repetir el trabajo. En este caso, ¿realmente estarías cumpliendo la meta propuesta?",
    options: [
      { text: "Si estaría cumpliendo, porque cumplí con rapidez.", correct: false },
      { text: "No estaría cumpliendo, porque no estaría garantizando la calidad del proceso.", correct: true },
      { text: "Si estaría cumpliendo, porque completé con los 20 vidrios que me asignaron.", correct: false },
    ],
  },
  {
    id: "q2",
    phrase: "En tu jornada cumpliste con la meta correspondiente, sin embargo, ves que tus compañeros no lo hicieron, en ese momento empiezas a aplicar la mentalidad de fundador. ¿De que manera estaría reflejando este valor?",
    options: [
      { text: "Evitando hablar del tema para no generar conflictos.", correct: false },
      { text: "Lo reflejaría pensando que es más conveniente centrarme en mi cumplimiento, dejando que sea mi líder quien defina que acciones se debe realizar.", correct: false },
      { text: "Hacer una reunión con mis compañeros y empezar a entender cuales son los aspectos que podemos mejorar para llegar a la meta y armar un plan para así poder hacerlo.", correct: true },
    ],
  },
  {
    id: "q3",
    phrase: "Te dieron un vidrio que tiene una raya y la debes pulir, sin embargo, ves que la raya es muy profunda y por mas que lo pulas, no ves la posibilidad de mejorarlo. En este caso ¿qué podrías hacer con el vidrio?",
    options: [
      { text: "Insisto en hacer un mejor pulido.", correct: false },
      { text: "Llamo al capitán y él decide que debemos rechazar el vidrio.", correct: true },
      { text: "Yo decido hacer un reproceso.", correct: false },
    ],
  },
  {
    id: "q4",
    phrase: "Te dieron un vidrio que tienes que inspeccionar, durante el proceso ves que el vidrio tiene una raya que esta de manera superficial y es muy pequeña. En este caso ¿qué debes hacer con el vidrio?",
    options: [
      { text: "Informarle a mi capitán, quien decide llevar el vidrio al área de pulido para poder mejorar la raya que tenia el vidrio.", correct: true },
      { text: "Yo decido rechazar el vidrio.", correct: false },
      { text: "Decido seguir con el proceso porque no afecta el acabado del vidrio.", correct: false },
    ],
  },
  {
    id: "q5",
    phrase: "Entregamos el vidrio blindado a un cliente, sin embargo, el cliente no quedo satisfecho y nos comenta que el vidrio tiene el logo mal ubicado y estéticamente no es adecuado. En este caso ¿qué debemos hacer?",
    options: [
      { text: "Decirle que el logo no interfiere con la seguridad del vidrio, por lo que tendríamos que dejarlo de la misma manera.", correct: false },
      { text: "Sugerirle al cliente que utilise el vidrio tal como está mientras evaluamos como podríamos gestionar.", correct: false },
      { text: "Informarle al cliente que para nosotros es importante mantener la calidad en la entrega del vidrio, por lo tanto le estaremos reponiendo el vidrio y así poder cubrir sus necesidades.", correct: true },
    ],
  },
];

const MAX_LIVES      = 5;
const MIN_PASS_SCORE = 80;
const SCORE_GAME_OVER = 75;

async function safeJson(res: Response) {
  const text = await res.text();
  try { return text ? JSON.parse(text) : null; }
  catch { return { raw: text }; }
}

const clean = (v: any) => {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  return s.toLowerCase() === "null" ? "" : s;
};

export default function NivelSocial1() {
  const router = useRouter();

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const [usuarioKey,       setUsuarioKey]       = useState<number | null>(null);
  const [guardando,        setGuardando]        = useState(false);
  const [progresoGuardado, setProgresoGuardado] = useState(false);
  const [yaCompletado,     setYaCompletado]     = useState(false);
  const [scoreGuardado,    setScoreGuardado]    = useState<number | null>(null);

  const ensureUsuarioKey = async () => {
    if (usuarioKey != null) return usuarioKey;
    const raw    = await AsyncStorage.getItem("USUARIO_KEY");
    const parsed = raw ? Number(raw) : NaN;
    if (!raw || Number.isNaN(parsed) || parsed <= 0) return null;
    setUsuarioKey(parsed);
    return parsed;
  };

  const keyU = (uk: number, suffix: string) => `u:${uk}:${suffix}`;

  const [showIntro,        setShowIntro]        = useState(true);
  const [showGame,         setShowGame]         = useState(false);
  const [questions,        setQuestions]        = useState<Question[]>(QUESTIONS_FALLBACK);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [currentIndex,     setCurrentIndex]     = useState(0);
  const [selectedIndex,    setSelectedIndex]    = useState<number | null>(null);
  const [lives,            setLives]            = useState<number>(MAX_LIVES);
  const [questionLostLife, setQuestionLostLife] = useState<Record<string, boolean>>({});
  const [showMinusOverlay, setShowMinusOverlay] = useState(false);
  const [showGameOver,     setShowGameOver]     = useState(false);
  const [showSuccess,      setShowSuccess]      = useState(false);
  const [score,            setScore]            = useState<number | null>(null);

  const heartScale   = useRef(new Animated.Value(1)).current;
  const minusScale   = useRef(new Animated.Value(0.6)).current;
  const minusOpacity = useRef(new Animated.Value(0)).current;
  const minusShake   = useRef(new Animated.Value(0)).current;
  const fadeSuccess  = useRef(new Animated.Value(0)).current;

  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const playMinusAnim = () => {
    minusScale.setValue(0.6);
    minusOpacity.setValue(0);
    minusShake.setValue(0);
    Vibration.vibrate(120);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(minusOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(minusOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(minusScale, { toValue: 1.25, duration: 220, useNativeDriver: true }),
        Animated.timing(minusScale, { toValue: 1,    duration: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: 0,  duration: 70, useNativeDriver: true }),
      ]),
    ]).start();
  };

  const shakeX = minusShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  const currentQuestion = questions[currentIndex];
  const isLast          = currentIndex === questions.length - 1;
  const passed          = score !== null && score >= MIN_PASS_SCORE;

  const cargarPreguntasDesdeBD = useCallback(async () => {
    try {
      setLoadingQuestions(true);
      const response = await fetch(`${API_URL}/niveles/social/${NIVEL_KEY_SOCIAL}/casos?islaKey=${ISLA_KEY}`);
      const data = await response.json();
      console.log("📦 Respuesta BD social:", JSON.stringify(data));

      if (data?.success && Array.isArray(data?.data?.casos) && data.data.casos.length > 0) {
        const casosMapeados: Question[] = data.data.casos.map((c: any, idx: number) => {
          const correctaRaw = clean(c.respuestaCorrecta ?? c.SOCIAL_CORRECTA ?? "");
          const correctaNum = Number(correctaRaw);
          let correctIdx = -1;
          if (correctaRaw === "a" || correctaRaw === "1" || correctaNum === 1) correctIdx = 0;
          else if (correctaRaw === "b" || correctaRaw === "2" || correctaNum === 2) correctIdx = 1;
          else if (correctaRaw === "c" || correctaRaw === "3" || correctaNum === 3) correctIdx = 2;
          const opts = [
            clean(c.respuesta1 ?? c.SOCIAL_RESPUESTA_1 ?? ""),
            clean(c.respuesta2 ?? c.SOCIAL_RESPUESTA_2 ?? ""),
            clean(c.respuesta3 ?? c.SOCIAL_RESPUESTA_3 ?? ""),
          ];
          return {
            id:     String(c.id ?? c.SOCIAL_KEY ?? idx + 1),
            phrase: clean(c.caso ?? c.SOCIAL_CASO ?? c.frase ?? c.SOCIAL_PREGUNTA ?? ""),
            options: opts.map((text, i) => ({ text, correct: i === correctIdx })),
          };
        });
        setQuestions(casosMapeados);
      } else {
        setQuestions(QUESTIONS_FALLBACK);
      }
    } catch (e) {
      console.error("❌ Error cargando casos:", e);
      setQuestions(QUESTIONS_FALLBACK);
    } finally {
      setLoadingQuestions(false);
    }
  }, []);

  useEffect(() => { cargarPreguntasDesdeBD(); }, [cargarPreguntasDesdeBD]);

  useEffect(() => {
    const run = async () => {
      const uk = await ensureUsuarioKey();
      if (!uk) return;

      const recDone     = await AsyncStorage.getItem(keyU(uk, `isla1_nivel${NIVEL_KEY_RECORDEMOS}_recordemos_done`));
      const recFallback = await AsyncStorage.getItem(`nivelCompleted_1_${NIVEL_KEY_RECORDEMOS}`);
      const recordemosCompleto = recDone === "true" || recFallback === "1";

      if (!recordemosCompleto) {
        Alert.alert("Nivel bloqueado", "Primero debes completar Recordemos.", [
          { text: "OK", onPress: () => router.push("/Introduccion") },
        ]);
        return;
      }

      const socialDone  = await AsyncStorage.getItem(keyU(uk, `isla1_nivel${NIVEL_KEY_SOCIAL}_social_done`));
      const socialScore = await AsyncStorage.getItem(keyU(uk, `isla1_nivel${NIVEL_KEY_SOCIAL}_social_score`));

      if (socialDone === "true") {
        const n = socialScore ? Number(socialScore) : NaN;
        setYaCompletado(true);
        setScoreGuardado(Number.isFinite(n) ? n : 100);
        setShowIntro(false);
        setShowGame(false);
        setScore(Number.isFinite(n) ? n : 100);
        setShowSuccess(true);
        fadeSuccess.setValue(1);
      }
    };
    run();
  }, []);

  const guardarSocial = async (scorePct: number) => {
    if (progresoGuardado || guardando) return;
    const uk = await ensureUsuarioKey();
    if (uk == null) { Alert.alert("No se pudo guardar", "No encontré USUARIO_KEY."); return; }
    try {
      setGuardando(true);
      const aprobado = scorePct >= MIN_PASS_SCORE;
      await AsyncStorage.multiSet([
        [keyU(uk, `isla1_nivel${NIVEL_KEY_SOCIAL}_social_done`),  "true"],
        [keyU(uk, `isla1_nivel${NIVEL_KEY_SOCIAL}_social_score`), String(scorePct)],
      ]);
      const res = await fetch(`${API_URL}${COMPLETE_ENDPOINT}`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey: uk, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY_SOCIAL, puntaje: scorePct, aprobado, mismatches: MAX_LIVES - lives, livesLeft: lives }),
      });
      const j = await safeJson(res);
      console.log("📦 Respuesta guardar social:", JSON.stringify(j));
      if (!res.ok || !j?.success) throw new Error(j?.message || `Error HTTP ${res.status}`);
      setProgresoGuardado(true);
      setYaCompletado(true);
      setScoreGuardado(scorePct);
    } catch (e: any) {
      Alert.alert("Ups… no se guardó el progreso", e?.message || "Error de red/servidor");
    } finally {
      setGuardando(false);
    }
  };

  const startGame = () => {
    if (yaCompletado) { setShowIntro(false); setShowGame(false); setShowSuccess(true); return; }
    setShowIntro(false);
    setShowGame(true);
  };

  const handleOptionPress = (idx: number) => setSelectedIndex(idx);

  const handleNext = async () => {
    if (selectedIndex === null) return;
    const selectedOption = currentQuestion.options[selectedIndex];

    if (!selectedOption.correct) {
      const qid = currentQuestion.id;
      if (!questionLostLife[qid]) {
        const newLives = Math.max(0, lives - 1);
        setLives(newLives);
        setQuestionLostLife((prev) => ({ ...prev, [qid]: true }));
        animateHeart();

        if (newLives <= 0) {
          // ✅ Game Over: guardar 75% y mostrar modal verde
          setScore(SCORE_GAME_OVER);
          await guardarSocial(SCORE_GAME_OVER);
          setShowGameOver(true);
        } else {
          setShowMinusOverlay(true);
          playMinusAnim();
        }
      } else {
        setShowMinusOverlay(true);
        playMinusAnim();
      }
      return;
    }

    if (!isLast) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedIndex(null);
    } else {
      // ✅ Distribuir entre 75% (0 vidas) y 100% (5 vidas)
      const finalScore = Math.round(75 + (lives / MAX_LIVES) * 25);
      setScore(finalScore);
      setShowSuccess(true);
      fadeSuccess.setValue(0);
      Animated.timing(fadeSuccess, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  };

  const resetAll = () => {
    setCurrentIndex(0);
    setSelectedIndex(null);
    setLives(MAX_LIVES);
    setQuestionLostLife({});
    setShowMinusOverlay(false);
    setShowGameOver(false);
    setShowSuccess(false);
    setScore(null);
    setGuardando(false);
    setProgresoGuardado(false);
  };

  if (!loaded) return <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><Text>Cargando fuentes...</Text></View>;

  if (loadingQuestions) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Nivel Aprendizaje Social</Text>
            <Text style={styles.descripcionIntro}>Cargando contenido desde la base de datos...</Text>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* INTRO */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Nivel Aprendizaje Social</Text>
            <Text style={styles.descripcionIntro}>
              En este nivel verás situaciones que pueden ocurrir en tu día a día en planta.{"\n\n"}
              Lee cada caso con calma y elige la opción que mejor refleje los valores de AGP,
              el trabajo en equipo y el cuidado por la calidad del vidrio y del cliente.{"\n\n"}
              Avanza frase por frase tomando decisiones conscientes sobre qué harías en cada situación.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* JUEGO */}
      {showGame && (
        <View style={styles.gameContainer}>
          <Animated.Text style={[styles.lives, { transform: [{ scale: heartScale }] }]}>
            <Text style={{ color: "red", fontSize: scaleDP(30) }}>❤️ </Text>
            {lives}
          </Animated.Text>
          <View style={styles.card}>
            <Text style={styles.phrase}>{currentQuestion.phrase}</Text>
            <View style={styles.optionsContainer}>
              {currentQuestion.options.map((opt, idx) => {
                const selected = selectedIndex === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    style={[styles.optionBtn, selected && styles.optionBtnSelected]}
                    onPress={() => handleOptionPress(idx)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.optionText, selected && styles.optionTextSelected]}>{opt.text}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.bottomRow}>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: "#B2B2B2" }]} onPress={() => router.push("/Introduccion")}>
                <Text style={styles.navBtnText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.navBtn, { backgroundColor: "#4C92E4" }]} onPress={handleNext}>
                <Text style={styles.navBtnText}>{isLast ? "Finalizar" : "Siguiente ➜"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Overlay incorrecta */}
      {showMinusOverlay && !showGameOver && (
        <View style={styles.overlay}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>Respuesta incorrecta</Text>
            <Text style={styles.modalDescSmall}>
              Has cometido un error en esta situación. Solo puedes perder una vida por frase, revisa bien y vuelve a intentarlo.
            </Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]} onPress={() => setShowMinusOverlay(false)}>
              <Text style={styles.modalBtnText}>Reintentar esta frase</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ✅ Game Over — modal verde con 75% igual que éxito, sin reintentar */}
      {showGameOver && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertBox, { opacity: 1 }]}>
            <Text style={styles.scoreBig}>75%</Text>
            <Text style={styles.alertText}>Se han acabado las vidas 💔</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.push("/Introduccion")}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* Éxito */}
      {showSuccess && score !== null && (
        <View style={styles.overlay}>
          <Animated.View
            style={[styles.alertBox, { opacity: fadeSuccess, transform: [{ scale: fadeSuccess.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
          >
            <Text style={styles.scoreBig}>
              {yaCompletado && scoreGuardado != null ? scoreGuardado : score}%
            </Text>
            <Text style={styles.alertText}>
              {(yaCompletado && (scoreGuardado ?? score) >= MIN_PASS_SCORE) || passed
                ? "¡Excelente! Has aprobado el nivel de aprendizaje social 🎉"
                : "Has completado el nivel, pero no alcanzaste el 80% mínimo. Puedes reintentar para mejorar tu resultado."}
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
                onPress={async () => {
                  if (!yaCompletado && score !== null) await guardarSocial(score);
                  setShowSuccess(false);
                  router.push("/Introduccion");
                }}
                disabled={guardando}
              >
                <Text style={styles.modalBtnText}>{guardando ? "Guardando..." : "Volver al mapa"}</Text>
              </TouchableOpacity>
              {!passed && !yaCompletado && (
                <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#10B981", marginTop: scaleDP(20) }]} onPress={resetAll}>
                  <Text style={styles.modalBtnText}>Reintentar</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        </View>
      )}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.35)" },
  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: { backgroundColor: "rgba(143, 197, 207, 0.85)", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(10), borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  tituloIntro: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(16) },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton: { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },
  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(30) },
  lives: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C", fontSize: scaleDP(30), marginBottom: scaleDP(20), marginTop: scaleDP(-20) },
  card: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: scaleDP(20), paddingVertical: scaleDP(14), paddingHorizontal: scaleDP(14), borderWidth: scaleDP(2), borderColor: "#E5E7EB", maxWidth: 1200 },
  phrase: { fontFamily: "PlusJakartaSans-Regular", color: "#111827", fontSize: scaleDP(20), lineHeight: scaleDP(30), marginBottom: scaleDP(18), textAlign: "left" },
  optionsContainer: { gap: scaleDP(10), marginBottom: scaleDP(22) },
  optionBtn: { borderRadius: scaleDP(14), borderWidth: scaleDP(2), borderColor: "#D1D5DB", paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(14), backgroundColor: "#F9FAFB" },
  optionBtnSelected: { borderColor: "#4C92E4", backgroundColor: "#E0EDFF" },
  optionText: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827" },
  optionTextSelected: { fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C" },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", gap: scaleDP(500), marginTop: scaleDP(10) },
  navBtn: { flex: 1, paddingVertical: scaleDP(10), borderRadius: scaleDP(14), alignItems: "center" },
  navBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20) },
  overlay: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(24) },
  modalBoxSmall: { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(16), paddingHorizontal: scaleDP(20), alignItems: "center", elevation: 8 },
  bigHeart: { fontSize: scaleDP(50), color: "red" },
  minusOneText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#DC2626", marginTop: scaleDP(-4), marginBottom: scaleDP(6) },
  modalDescSmall: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(20), color: "#111827", textAlign: "center" },
  modalBox: { width: "92%", backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(18), alignItems: "center", elevation: 8 },
  modalTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(46), color: "#0F1B4C", textAlign: "center" },
  modalDesc: { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(26), color: "#111827", textAlign: "center" },
  modalRow: { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn: { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },
  alertBox: { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "75%", alignItems: "center" },
  scoreBig: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(100), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(35), textAlign: "center" },
});