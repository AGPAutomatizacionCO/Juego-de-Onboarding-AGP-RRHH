import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Alert,
  Animated,
  Easing,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

const fondo = require("../assets/FONDOREG.png");

const API_BASE = `${API_BASE_URL}/api/niveles`;
const API_USUARIOS = `${API_BASE_URL}/api/usuarios`;
const ISLA_KEY = 1;
const NIVEL_KEY = 5;

type KeyOpt = "a" | "b" | "c" | "d";

type Question = {
  id: number;
  text: string;
  options: { key: KeyOpt; label: string }[];
  correct: KeyOpt;
};

type Player = {
  id: string;
  nombre: string;
  puntaje: number | null;
};

const QUESTIONS_FALLBACK: Question[] = [
  {
    id: 1,
    text: "¿Cuál es la misión de AGP?",
    options: [
      { key: "a", label: "Salvar vidas" },
      { key: "b", label: "Proporciona a nivel mundial vidrios de seguridad" },
      { key: "c", label: "Transferencia de conocimiento y desarrollo de habilidades y destrezas al personal nuevo" },
      { key: "d", label: "Todas las anteriores" },
    ],
    correct: "a",
  },
  {
    id: 2,
    text: "¿Cuál es el propósito del Centro Técnico?",
    options: [
      { key: "a", label: "Garantizar el desarrollo continuo de nuestro talento humano" },
      { key: "b", label: "Controlar la información del personal entrenado y calificado" },
      { key: "c", label: "Transferencia de conocimiento y desarrollo de habilidades y destrezas al personal nuevo" },
      { key: "d", label: "Todas las anteriores" },
    ],
    correct: "d",
  },
  {
    id: 3,
    text: "¿Cuáles son las líneas de negocio de AGP?",
    options: [
      { key: "a", label: "Security Glass" },
      { key: "b", label: "Defense y Security" },
      { key: "c", label: "OEM y Retrofit" },
      { key: "d", label: "Ninguna de las anteriores" },
    ],
    correct: "b",
  },
  {
    id: 4,
    text: "¿Cuáles son las dos líneas de fabricación que maneja AGP?",
    options: [
      { key: "a", label: "OEM y Retrofit" },
      { key: "b", label: "eGlass y Security Glass" },
      { key: "c", label: "Defense y Security" },
      { key: "d", label: "Ninguna de las anteriores" },
    ],
    correct: "a",
  },
  {
    id: 5,
    text: "¿Qué significa OEM?",
    options: [
      { key: "a", label: "Son piezas que se fabrican para vehículos que son ensamblados con estas piezas como originales" },
      { key: "b", label: "Son piezas que se fabrican para entregar a un tercero que ensambla (blindadora)" },
      { key: "c", label: "Son piezas que se fabrican para la línea Defense" },
      { key: "d", label: "Ninguna de las anteriores" },
    ],
    correct: "a",
  },
  {
    id: 6,
    text: "¿Qué significa Retrofit?",
    options: [
      { key: "a", label: "Son piezas que se fabrican para vehículos que son ensamblados con estas piezas como originales" },
      { key: "b", label: "Son piezas que se fabrican para entregar a un tercero que ensambla (blindadora)" },
      { key: "c", label: "Son piezas que se fabrican para la línea Defense" },
      { key: "d", label: "Ninguna de las anteriores" },
    ],
    correct: "b",
  },
];

const MIN_PASS_SCORE = 80;

export default function NivelEvaluacionFinal() {
  const router = useRouter();

  const [usuarioKey,       setUsuarioKey]       = useState<number | null>(null);
  const [numeroOnboarding, setNumeroOnboarding] = useState<number | null>(null);
  const [savedPct,         setSavedPct]         = useState<number>(0);

  const [showIntro,  setShowIntro]  = useState(true);
  const [showGame,   setShowGame]   = useState(false);

  const [qIndex,     setQIndex]     = useState(0);
  const [answers,    setAnswers]    = useState<Record<number, KeyOpt | undefined>>({});
  const [showResult, setShowResult] = useState(false);
  const [score,      setScore]      = useState(0);

  const [showPodio,    setShowPodio]    = useState(false);
  const [players,      setPlayers]      = useState<Player[]>([]);
  const [podioLoading, setPodioLoading] = useState(false);

  const [showIncomplete, setShowIncomplete] = useState(false);
  const [missingCount,   setMissingCount]   = useState(0);

  const [questions,        setQuestions]        = useState<Question[]>(QUESTIONS_FALLBACK);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

  const transOpacity = useRef(new Animated.Value(1)).current;
  const transX       = useRef(new Animated.Value(0)).current;
  const transScale   = useRef(new Animated.Value(1)).current;
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => { cargarPreguntasDesdeBD(); }, []);

  async function apiJson(url: string, options?: RequestInit) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
    });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
    return data;
  }

  async function cargarPreguntasDesdeBD() {
    try {
      setLoadingQuestions(true);
      const r = await apiJson(`${API_BASE}/evaluacionFinal/${NIVEL_KEY}/preguntas`);
      const preguntas = r?.data?.preguntas || [];
      if (preguntas.length > 0) {
        const transformed: Question[] = preguntas.map((p: any) => ({
          id: p.id,
          text: p.pregunta,
          options: [
            { key: "a" as KeyOpt, label: p.respuesta1 || "" },
            { key: "b" as KeyOpt, label: p.respuesta2 || "" },
            { key: "c" as KeyOpt, label: p.respuesta3 || "" },
            { key: "d" as KeyOpt, label: p.respuesta4 || "" },
          ],
          correct: (p.respuestaCorrecta || "a").toLowerCase() as KeyOpt,
        }));
        setQuestions(transformed);
      }
    } catch {
    } finally {
      setLoadingQuestions(false);
    }
  }

  const current  = useMemo(() => questions[qIndex], [questions, qIndex]);
  const startGame = () => { setShowIntro(false); setShowGame(true); };

  useEffect(() => {
    (async () => {
      const ukMain   = await AsyncStorage.getItem("USUARIO_KEY");
      const ukLegacy = await AsyncStorage.getItem("usuarioKey");
      const no       = await AsyncStorage.getItem("numeroOnboarding");
      const uKey     = Number(ukMain || ukLegacy || 0);
      const nOn      = Number(no || 0);
      const finalUk  = Number.isFinite(uKey) && uKey > 0 ? uKey : null;
      setUsuarioKey(finalUk);
      setNumeroOnboarding(Number.isFinite(nOn) && nOn > 0 ? nOn : null);
      if (finalUk) {
        const evaDone  = await AsyncStorage.getItem(`u:${finalUk}:isla1_nivel5_evaluacion_done`);
        const evaScore = await AsyncStorage.getItem(`u:${finalUk}:isla1_nivel5_evaluacion_score`);
        if (evaDone === "true") {
          const pct = evaScore ? Number(evaScore) : 0;
          const n   = Number.isFinite(pct) ? pct : 0;
          setSavedPct(n); setScore(n); setShowIntro(false); setShowResult(true);
        }
        try {
          const r = await apiJson(`${API_BASE}/evaluacionFinal/resultado/${finalUk}/${NIVEL_KEY}`);
          const pct = Number(r?.data?.puntaje ?? 0);
          if (pct > 0) setSavedPct(Number.isFinite(pct) ? pct : 0);
        } catch { setSavedPct(0); }
      }
    })();
  }, []);

  const selectOption = (opt: KeyOpt) => setAnswers((prev) => ({ ...prev, [current.id]: opt }));

  const animateChange = (dir: "next" | "prev", onMid: () => void) => {
    if (transitioning) return;
    setTransitioning(true);
    const sign = dir === "next" ? -1 : 1;
    Animated.parallel([
      Animated.timing(transOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(transX,       { toValue: sign * 48, duration: 160, useNativeDriver: true }),
      Animated.timing(transScale,   { toValue: 0.97, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      onMid();
      transOpacity.setValue(0); transX.setValue(-sign * 48); transScale.setValue(0.97);
      Animated.parallel([
        Animated.timing(transOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(transX,       { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.spring(transScale,   { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      ]).start(() => setTransitioning(false));
    });
  };

  const goNext = () => { if (qIndex >= questions.length - 1 || transitioning) return; animateChange("next", () => setQIndex((i) => i + 1)); };
  const goPrev = () => { if (qIndex <= 0 || transitioning) return; animateChange("prev", () => setQIndex((i) => i - 1)); };

  const saveScoreToDB = async (pct: number) => {
    if (!usuarioKey) throw new Error("No se encontró USUARIO_KEY en la sesión.");
    await apiJson(`${API_BASE}/evaluacionFinal/resultado`, {
      method: "POST",
      body: JSON.stringify({ usuarioKey, nivelKey: NIVEL_KEY, puntaje: pct }),
    });
    await AsyncStorage.setItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`,  "true");
    await AsyncStorage.setItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`, String(pct));
    setSavedPct(pct);
  };

  const calcularScore = async () => {
    let aciertos = 0;
    questions.forEach((q) => { if (answers[q.id] && answers[q.id] === q.correct) aciertos++; });
    const pct = Math.round((aciertos / questions.length) * 100);
    setScore(pct); setShowResult(true);
    try { await saveScoreToDB(pct); }
    catch (e: any) { Alert.alert("Ups", e?.message || "No se pudo guardar tu puntaje."); }
  };

  const handleFinish = () => {
    const unanswered = questions.filter((q) => !answers[q.id]).length;
    if (unanswered > 0) { setMissingCount(unanswered); setShowIncomplete(true); return; }
    calcularScore();
  };

  const resetAll = () => {
    setQIndex(0); setAnswers({}); setScore(0);
    setShowResult(false); setShowIncomplete(false); setMissingCount(0);
    setShowPodio(false); setShowIntro(true); setShowGame(false); setPlayers([]);
    transOpacity.setValue(1); transX.setValue(0); transScale.setValue(1);
  };

  const passed = score >= MIN_PASS_SCORE;
  const isLast  = qIndex === questions.length - 1;

  const loadPodio = async () => {
    let nOn = numeroOnboarding;
    if (!nOn) {
      const raw = await AsyncStorage.getItem("numeroOnboarding");
      nOn = raw ? Number(raw) : null;
      if (nOn && nOn > 0) setNumeroOnboarding(nOn);
    }
    if ((!nOn || nOn <= 0) && usuarioKey) {
      try {
        const res  = await fetch(`${API_USUARIOS}/${usuarioKey}`);
        const data = await res.json();
        nOn = Number(data?.data?.USUARIO_NUMERO_ONBOARDING ?? 0);
        if (nOn > 0) { setNumeroOnboarding(nOn); await AsyncStorage.setItem("numeroOnboarding", String(nOn)); }
      } catch { nOn = null; }
    }
    if (!nOn || nOn <= 0) { Alert.alert("Sin grupo", "No se encontró el número de onboarding."); return; }
    try {
      setPodioLoading(true);
      const r = await apiJson(`${API_BASE}/evaluacionFinal/podio?nivelKey=${NIVEL_KEY}&numeroOnboarding=${nOn}`);
      setPlayers((r?.data || []).map((row: any, idx: number) => ({
        id: String(row.usuarioKey ?? idx),
        nombre: row.nombre ?? "Sin nombre",
        puntaje: row.puntaje != null ? Number(row.puntaje) : null,
      })));
    } catch (e: any) {
      Alert.alert("Error al cargar podio", e?.message || "No se pudo cargar.");
      setPlayers([]);
    } finally { setPodioLoading(false); }
  };

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => {
      if (a.puntaje == null && b.puntaje == null) return 0;
      if (a.puntaje == null) return 1;
      if (b.puntaje == null) return -1;
      return b.puntaje - a.puntaje;
    }),
    [players]
  );

  const top3 = sortedPlayers.filter(p => p.puntaje != null).slice(0, 3);

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* Cargando */}
      {loadingQuestions && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Evaluación Final</Text>
            <Text style={styles.descripcionIntro}>Cargando contenido desde la base de datos...</Text>
          </View>
        </View>
      )}

      {/* INTRO */}
      {showIntro && !loadingQuestions && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Evaluación Final</Text>
            <Text style={styles.descripcionIntro}>
              Llegaste al cierre del recorrido.
              Responde las preguntas sobre AGP, sus procesos y conceptos clave.{"\n\n"}
              Puedes moverte entre las preguntas con los botones de navegación,
              revisar y ajustar tus respuestas antes de finalizar. Al terminar,
              verás tu resultado en porcentaje.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Comenzar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* JUEGO */}
      {showGame && (
        <View style={styles.gameContainer}>
          <Text style={styles.progress}>Pregunta {qIndex + 1} / {questions.length}</Text>
          <View style={styles.cardWrap}>
            <Animated.View style={[styles.card, { opacity: transOpacity, transform: [{ translateX: transX }, { scale: transScale }] }]}>
              <ScrollView contentContainerStyle={{ paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(20), gap: scaleDP(5) }}>
                <Text style={styles.question}>{current.text}</Text>
                {current.options.map((op) => {
                  const selected = answers[current.id] === op.key;
                  return (
                    <TouchableOpacity key={op.key} onPress={() => selectOption(op.key)} activeOpacity={0.9}
                      style={[styles.optionRow, selected && styles.optionRowSelected]}>
                      <Text style={[styles.optionLabel, selected && styles.optionLabelSelected]}>{op.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </Animated.View>
          </View>
          <View style={styles.navRow}>
            <TouchableOpacity onPress={goPrev} disabled={qIndex === 0 || transitioning}
              style={[styles.navBtn, { backgroundColor: "#B2B2B2" }, (qIndex === 0 || transitioning) && styles.navBtnDisabled]} activeOpacity={0.8}>
              <Text style={styles.navBtnText}>Anterior</Text>
            </TouchableOpacity>
            {!isLast && (
              <TouchableOpacity onPress={goNext} disabled={transitioning}
                style={[styles.navBtn, { backgroundColor: "#4C92E4" }, transitioning && styles.navBtnDisabled]} activeOpacity={0.8}>
                <Text style={styles.navBtnText}>Siguiente</Text>
              </TouchableOpacity>
            )}
            {isLast && (
              <TouchableOpacity onPress={handleFinish} style={[styles.navBtn, { backgroundColor: "#4C92E4" }]} activeOpacity={0.9}>
                <Text style={styles.navBtnText}>Continuar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Incompletas */}
      {showIncomplete && (
        <View style={styles.overlay}>
          <View style={styles.modalBoxSmall}>
            <Text style={styles.modalTitleSmall}>Te faltan respuestas</Text>
            <Text style={styles.modalDescSmall}>
              Aún tienes {missingCount} pregunta{missingCount === 1 ? "" : "s"} sin responder.{"\n"}
              Revisa las preguntas y completa todas antes de finalizar.
            </Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(14) }]} onPress={() => setShowIncomplete(false)}>
              <Text style={styles.modalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Resultado */}
      {showResult && (
        <View style={styles.overlay}>
          <View style={styles.resultAlertBox}>
            <Text style={styles.scoreBig}>{savedPct > 0 ? savedPct : score}%</Text>
            <Text style={styles.resultMainText}>
              {passed
                ? "¡Excelente! Has aprobado la evaluación final 🎉"
                : score >= 60
                ? "Vas por buen camino, pero aún puedes mejorar tu resultado."
                : "Tu resultado está por debajo de lo esperado. Puedes repetir la evaluación para reforzar los conceptos."}
            </Text>
            <View style={styles.resultRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#10B981", marginTop: scaleDP(18) }]} onPress={resetAll}>
                <Text style={styles.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(18) }]} onPress={() => router.push("/Introduccion")}>
                <Text style={styles.modalBtnText}>Volver al mapa</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#FACC15", marginTop: scaleDP(18), alignSelf: "stretch" }]}
              disabled={podioLoading}
              onPress={async () => { setShowResult(false); setShowPodio(true); await loadPodio(); }}
            >
              <Text style={[styles.modalBtnText, { color: "#78350F" }]}>
                {podioLoading ? "Cargando podio..." : "Ver podio 🏆"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ✅ PODIO — diseño oscuro igual a PodioScreen */}
      {showPodio && (
        <View style={styles.overlay}>
          <View style={styles.podioBox}>
            {/* Header */}
            <View style={styles.podioHeader}>
              <Text style={styles.podioTitle}>🏆 Podio - Evaluación Final</Text>
              <Text style={styles.podioSubtitle}>
                {numeroOnboarding ? `Grupo onboarding #${numeroOnboarding}` : "Clasificación del grupo"}
              </Text>
            </View>

            {/* TOP 3 */}
            {top3.length > 0 && (
              <View style={styles.top3Container}>
                {top3[1] && (
                  <View style={[styles.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[styles.medalEmoji, { fontSize: scaleDP(40) }]}>🥈</Text>
                    <Text style={styles.medalName} numberOfLines={1}>{top3[1].nombre}</Text>
                    <Text style={styles.medalScore}>{top3[1].puntaje}%</Text>
                  </View>
                )}
                {top3[0] && (
                  <View style={[styles.medalBox, { marginTop: 0 }]}>
                    <Text style={[styles.medalEmoji, { fontSize: scaleDP(50) }]}>🥇</Text>
                    <Text style={[styles.medalName, { fontSize: scaleDP(18) }]} numberOfLines={1}>{top3[0].nombre}</Text>
                    <Text style={[styles.medalScore, { fontSize: scaleDP(24) }]}>{top3[0].puntaje}%</Text>
                  </View>
                )}
                {top3[2] && (
                  <View style={[styles.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[styles.medalEmoji, { fontSize: scaleDP(34) }]}>🥉</Text>
                    <Text style={styles.medalName} numberOfLines={1}>{top3[2].nombre}</Text>
                    <Text style={styles.medalScore}>{top3[2].puntaje}%</Text>
                  </View>
                )}
              </View>
            )}

            {/* Lista completa */}
            <Text style={styles.podioListTitle}>Todos los participantes</Text>
            <ScrollView style={styles.podioList} contentContainerStyle={{ paddingBottom: scaleDP(10) }} showsVerticalScrollIndicator={false}>
              {podioLoading ? (
                <Text style={styles.podioEmpty}>Cargando...</Text>
              ) : sortedPlayers.length === 0 ? (
                <Text style={styles.podioEmpty}>Aún no hay resultados en tu grupo.</Text>
              ) : (
                sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={styles.playerRow}>
                    <Text style={styles.playerRank}>{getMedal(idx)}</Text>
                    <Text style={styles.playerName} numberOfLines={1}>{p.nombre}</Text>
                    {p.puntaje != null
                      ? <Text style={styles.playerScore}>{p.puntaje}%</Text>
                      : <Text style={styles.playerNoResponse}>Aún no responde</Text>}
                  </View>
                ))
              )}
            </ScrollView>

            {/* Botones */}
            <View style={{ flexDirection: "row", gap: scaleDP(10), marginTop: scaleDP(14) }}>
              <TouchableOpacity
                style={[styles.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]}
                onPress={() => { setShowPodio(false); setShowResult(true); }}
              >
                <Text style={styles.podioBtnText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]}
                onPress={() => router.push("/mapa")}
              >
                <Text style={styles.podioBtnText}>Continuar Isla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.35)" },

  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: { backgroundColor: "rgba(143, 197, 207, 0.85)", paddingVertical: scaleDP(40), paddingHorizontal: scaleDP(40), borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  tituloIntro:      { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(16) },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton:       { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "flex-start", alignItems: "center", paddingHorizontal: scaleDP(30), paddingTop: scaleDP(65) },
  progress:  { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16), color: "#0F1B4C", marginBottom: scaleDP(12) },
  cardWrap:  { width: "90%", maxWidth: 1200 },
  card:      { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: scaleDP(20), borderWidth: scaleDP(2), borderColor: "#E5E7EB", elevation: 8, minHeight: scaleDP(380) },
  question:  { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(30), color: "#0F1B4C", textAlign: "center", marginBottom: scaleDP(10) },
  optionRow:           { borderWidth: scaleDP(2), borderColor: "#D1D5DB", backgroundColor: "#F9FAFB", paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(14), borderRadius: scaleDP(12) },
  optionRowSelected:   { borderColor: "#4C92E4", backgroundColor: "#E0EDFF" },
  optionLabel:         { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827", textAlign: "center" },
  optionLabelSelected: { fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C" },

  navRow:         { flexDirection: "row", justifyContent: "space-between", gap: scaleDP(16), marginTop: scaleDP(14), width: "60%" },
  navBtn:         { flex: 1, paddingVertical: scaleDP(10), borderRadius: scaleDP(12), alignItems: "center" },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText:     { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },

  overlay: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(24) },

  modalBoxSmall:   { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(18), paddingHorizontal: scaleDP(22), alignItems: "center", elevation: 8, maxWidth: "80%" },
  modalTitleSmall: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(60), color: "#0F1B4C", marginBottom: scaleDP(8), textAlign: "center" },
  modalDescSmall:  { fontFamily: "PlusJakartaSans-Regular",   fontSize: scaleDP(40), color: "#111827", textAlign: "center" },

  resultAlertBox: { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "80%", alignItems: "center" },
  scoreBig:       { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(60), marginBottom: scaleDP(12) },
  resultMainText: { fontFamily: "PlusJakartaSans-Bold",      color: "#fff", fontSize: scaleDP(40), textAlign: "center" },
  resultRow:      { marginTop: scaleDP(16), flexDirection: "row", gap: scaleDP(10) },
  modalBtn:       { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30), textAlign: "center" },

  // ✅ Podio oscuro — igual a PodioScreen
  podioBox: { backgroundColor: "#1a1a2e", padding: scaleDP(20), borderRadius: scaleDP(20), maxWidth: "90%", width: "90%", elevation: 10 },
  podioHeader: { alignItems: "center", marginBottom: scaleDP(16) },
  podioTitle:  { fontSize: scaleDP(24), fontWeight: "bold", color: "#a3ecf1", textAlign: "center" },
  podioSubtitle: { fontSize: scaleDP(14), color: "#AAAAAA", marginTop: scaleDP(4) },

  top3Container: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginBottom: scaleDP(16) },
  medalBox:  { alignItems: "center", marginHorizontal: scaleDP(10), padding: scaleDP(14), borderRadius: scaleDP(14), backgroundColor: "rgba(255,255,255,0.1)", minWidth: scaleDP(90) },
  medalEmoji: { marginBottom: scaleDP(4) },
  medalName:  { color: "#FFFFFF", fontSize: scaleDP(13), fontWeight: "bold", textAlign: "center" },
  medalScore: { color: "#a3ecf1", fontSize: scaleDP(16), fontWeight: "bold", marginTop: scaleDP(4) },

  podioListTitle: { color: "#AAAAAA", fontSize: scaleDP(12), fontWeight: "bold", marginBottom: scaleDP(6), textTransform: "uppercase", letterSpacing: 1 },
  podioList:      { maxHeight: scaleDP(180), marginBottom: scaleDP(8) },
  podioEmpty:     { color: "#9CA3AF", fontSize: scaleDP(12), textAlign: "center", paddingVertical: scaleDP(14) },

  playerRow:       { flexDirection: "row", alignItems: "center", padding: scaleDP(10), backgroundColor: "rgba(255,255,255,0.05)", borderRadius: scaleDP(10), marginBottom: scaleDP(6) },
  playerRank:      { color: "#FFFFFF", fontSize: scaleDP(14), fontWeight: "bold", width: scaleDP(36) },
  playerName:      { color: "#FFFFFF", fontSize: scaleDP(14), flex: 1 },
  playerScore:     { color: "#a3ecf1", fontSize: scaleDP(14), fontWeight: "bold" },
  playerNoResponse:{ color: "#6B7280", fontSize: scaleDP(11), fontStyle: "italic" },

  podioBtn:    { paddingVertical: scaleDP(10), borderRadius: scaleDP(10), alignItems: "center" },
  podioBtnText:{ color: "#1a1a2e", fontWeight: "bold", fontSize: scaleDP(14) },
});