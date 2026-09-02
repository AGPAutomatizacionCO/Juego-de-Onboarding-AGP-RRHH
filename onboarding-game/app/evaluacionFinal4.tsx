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
const RUTA_VOLVER = "/Conceptos";

const API_BASE     = `${API_BASE_URL}/api/niveles`;
const API_USUARIOS = `${API_BASE_URL}/api/usuarios`;
const ISLA_KEY  = 4;
const NIVEL_KEY = 20;

type KeyOpt       = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";
type MatrixColumn = "col_a" | "col_b" | "col_c" | "col_d";

type SingleQuestion = { id: number; type: "single"; text: string; options: { key: KeyOpt; label: string }[]; correct: KeyOpt };
type MultiQuestion  = { id: number; type: "multi";  text: string; options: { key: KeyOpt; label: string }[]; correct: KeyOpt[] };
type MatrixRow      = { id: string; label: string; correct: MatrixColumn };
type MatrixQuestion = { id: number; type: "matrix"; text: string; rows: MatrixRow[]; columns: { key: MatrixColumn; label: string }[] };
type Question       = SingleQuestion | MultiQuestion | MatrixQuestion;
type Player         = { id: string; nombre: string; puntaje: number | null };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function shuffleSingle(q: SingleQuestion): SingleQuestion {
  const shuffled = shuffle(q.options);
  const correct  = shuffled.find((o) => o.key === q.correct)!.key;
  return { ...q, options: shuffled, correct };
}
function shuffleMulti(q: MultiQuestion): MultiQuestion { return { ...q, options: shuffle(q.options) }; }
function shuffleMatrix(q: MatrixQuestion): MatrixQuestion { return { ...q, rows: shuffle(q.rows), columns: shuffle(q.columns) }; }
function shuffleQuestion(q: Question): Question {
  if (q.type === "single") return shuffleSingle(q);
  if (q.type === "multi")  return shuffleMulti(q);
  if (q.type === "matrix") return shuffleMatrix(q);
  return q;
}

const QUESTIONS_BASE: Question[] = [
  // Pregunta 1 — Matriz
  {
    id: 1,
    type: "matrix",
    text: "Relacione las filas y las columnas según corresponda",
    columns: [
      { key: "col_a", label: "Es un vidrio individual de la fórmula que conforma el vidrio blindado." },
      { key: "col_b", label: "Es la unión de polímeros y de varios vidrios individuales los cuales forman el vidrio blindado. (la receta)" },
      { key: "col_c", label: "Es la unión de varios lites, compactados uno al otro formando el vidrio blindado." },
      { key: "col_d", label: "Son todas las piezas blindadas que pertenecen a un vehículo." },
    ],
    rows: [
      { id: "r1", label: "Lite",    correct: "col_a" },
      { id: "r2", label: "Formula", correct: "col_b" },
      { id: "r3", label: "Pieza",   correct: "col_c" },
      { id: "r4", label: "Set",     correct: "col_d" },
    ],
  },
  // Pregunta 2 — Single
  {
    id: 2,
    type: "single",
    text: "¿Qué conforma mínimo un vidrio blindado?",
    options: [
      { key: "a", label: "Vidrios y aceros" },
      { key: "b", label: "Vidrios y plásticos" },
      { key: "c", label: "Vidrios, aceros y polarizados" },
      { key: "d", label: "Todas las anteriores" },
    ],
    correct: "b",
  },
  // Pregunta 3 — Multi
  {
    id: 3,
    type: "multi",
    text: "¿Cómo se llaman los tipos de cristales que encontramos en planta?",
    options: [
      { key: "a", label: "Sodalime" },
      { key: "b", label: "White" },
      { key: "c", label: "Alluminum" },
      { key: "d", label: "Gris Dark" },
      { key: "e", label: "Gris Light" },
      { key: "f", label: "Cristal Verde esmeralda" },
      { key: "g", label: "Cristal azul celeste" },
      { key: "h", label: "Cristal amarillo opaco" },
    ],
    correct: ["a", "b", "c", "d", "e"],
  },
  // Pregunta 4 — Single
  {
    id: 4,
    type: "single",
    text: "¿Qué es el vidrio paquete?",
    options: [
      { key: "a", label: "Es el vidrio que lleva pintura y degradé (banda negra y degradé)." },
      { key: "b", label: "Es el conjunto de lites que conforman el paquete de la formulación del producto final." },
      { key: "c", label: "Es un vidrio individual de la fórmula que conforma el vidrio blindado." },
      { key: "d", label: "Todas las anteriores" },
    ],
    correct: "b",
  },
  // Pregunta 5 — Multi
  {
    id: 5,
    type: "multi",
    text: "¿Cuáles son los tipos de molde que hay en AGP?",
    options: [
      { key: "a", label: "Molde lleno" },
      { key: "b", label: "Molde anillo" },
      { key: "c", label: "Galgas de verificación" },
      { key: "d", label: "Todas las anteriores" },
    ],
    correct: ["a", "b"],
  },
];

const MIN_PASS_SCORE  = 80;
const MATRIX_LABEL_W  = scaleDP(100);
const MATRIX_COL_W    = scaleDP(110);
const MATRIX_ROW_H    = scaleDP(44);
const MATRIX_FONT     = scaleDP(11);
const MATRIX_HEADER_F = scaleDP(10);
const MATRIX_RADIO    = scaleDP(16);
const MATRIX_RADIO_IN = scaleDP(8);

export default function NivelEvaluacionFinalConceptos() {
  const router = useRouter();

  const [usuarioKey,       setUsuarioKey]       = useState<number | null>(null);
  const [numeroOnboarding, setNumeroOnboarding] = useState<number | null>(null);
  const [savedPct,         setSavedPct]         = useState<number>(0);
  const [reintentoPendiente, setReintentoPendiente] = useState(false);
  const [showIntro,        setShowIntro]        = useState(true);
  const [showGame,         setShowGame]         = useState(false);
  const [qIndex,           setQIndex]           = useState(0);
  const [questions,        setQuestions]        = useState<Question[]>([]);
  const [answersSingle,    setAnswersSingle]    = useState<Record<number, KeyOpt | undefined>>({});
  const [answersMulti,     setAnswersMulti]     = useState<Record<number, KeyOpt[]>>({});
  const [answersMatrix,    setAnswersMatrix]    = useState<Record<number, Record<string, MatrixColumn | undefined>>>({});
  const [showResult,       setShowResult]       = useState(false);
  const [score,            setScore]            = useState(0);
  const [showPodio,        setShowPodio]        = useState(false);
  const [players,          setPlayers]          = useState<Player[]>([]);
  const [podioLoading,     setPodioLoading]     = useState(false);
  const [showIncomplete,   setShowIncomplete]   = useState(false);
  const [missingCount,     setMissingCount]     = useState(0);

  const transOpacity = useRef(new Animated.Value(1)).current;
  const transX       = useRef(new Animated.Value(0)).current;
  const transScale   = useRef(new Animated.Value(1)).current;
  const [transitioning, setTransitioning] = useState(false);

  const current = useMemo(() => questions[qIndex], [questions, qIndex]);
  const isLast  = qIndex === questions.length - 1;
  const passed  = score >= MIN_PASS_SCORE;

  useEffect(() => {
    (async () => {
      const ukMain  = await AsyncStorage.getItem("USUARIO_KEY");
      const ukLeg   = await AsyncStorage.getItem("usuarioKey");
      const no      = await AsyncStorage.getItem("numeroOnboarding");
      const uKey    = Number(ukMain || ukLeg || 0);
      const nOn     = Number(no || 0);
      const finalUk = Number.isFinite(uKey) && uKey > 0 ? uKey : null;
      setUsuarioKey(finalUk);
      setNumeroOnboarding(Number.isFinite(nOn) && nOn > 0 ? nOn : null);
      if (finalUk) {
        const evaDone  = await AsyncStorage.getItem(`u:${finalUk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`);
        const evaScore = await AsyncStorage.getItem(`u:${finalUk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`);
        if (evaDone === "true") {
          const pct = evaScore ? Number(evaScore) : 0;
          setSavedPct(Number.isFinite(pct) ? pct : 0);
          setScore(pct);
          setShowIntro(false);
          setShowResult(true);
        }
        try {
          const r = await apiJson(`${API_BASE}/evaluacionFinal/resultado/${finalUk}/${NIVEL_KEY}`);
          const pct = Number(r?.data?.puntaje ?? 0);
          if (pct > 0) setSavedPct(Number.isFinite(pct) ? pct : 0);
          if (r?.data?.reintentoHabilitado) {
            setReintentoPendiente(true);
            setShowResult(false);
            setShowIntro(true);
          }
        } catch { setSavedPct(0); }
      }
    })();
  }, []);

  async function apiJson(url: string, options?: RequestInit) {
    const res  = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
    return data;
  }

  const startGame = () => {
    if (reintentoPendiente && usuarioKey) {
      AsyncStorage.multiRemove([
        `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`,
        `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`,
      ]);
      apiJson(`${API_BASE}/evaluacionFinal/reintento/consumir`, {
        method: "POST",
        body: JSON.stringify({ usuarioKey, nivelKey: NIVEL_KEY }),
      }).catch(() => {});
      setReintentoPendiente(false);
    }
    const shuffled = QUESTIONS_BASE.map((q) => shuffleQuestion(q));
    setQuestions(shuffled);
    setAnswersSingle({});
    setAnswersMulti({});
    setAnswersMatrix({});
    setQIndex(0);
    setShowIntro(false);
    setShowGame(true);
  };

  const selectSingle = (qId: number, opt: KeyOpt) =>
    setAnswersSingle((p) => ({ ...p, [qId]: opt }));

  const toggleMulti = (qId: number, opt: KeyOpt) =>
    setAnswersMulti((p) => {
      const cur = p[qId] || [];
      return { ...p, [qId]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    });

  const selectMatrix = (qId: number, rowId: string, col: MatrixColumn) =>
    setAnswersMatrix((p) => ({ ...p, [qId]: { ...(p[qId] || {}), [rowId]: col } }));

  const animateChange = (dir: "next" | "prev", onMid: () => void) => {
    if (transitioning) return;
    setTransitioning(true);
    const sign = dir === "next" ? -1 : 1;
    Animated.parallel([
      Animated.timing(transOpacity, { toValue: 0,    duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(transX,       { toValue: sign * 48, duration: 160, useNativeDriver: true }),
      Animated.timing(transScale,   { toValue: 0.97, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      onMid();
      transOpacity.setValue(0);
      transX.setValue(-sign * 48);
      transScale.setValue(0.97);
      Animated.parallel([
        Animated.timing(transOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(transX,       { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.spring(transScale,   { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      ]).start(() => setTransitioning(false));
    });
  };

  const goNext = () => { if (qIndex < questions.length - 1 && !transitioning) animateChange("next", () => setQIndex((i) => i + 1)); };
  const goPrev = () => { if (qIndex > 0 && !transitioning) animateChange("prev",  () => setQIndex((i) => i - 1)); };

  const isQuestionAnswered = (q: Question): boolean => {
    if (q.type === "single") return !!answersSingle[q.id];
    if (q.type === "multi")  return (answersMulti[q.id] || []).length > 0;
    if (q.type === "matrix") {
      const ans = answersMatrix[q.id] || {};
      return q.rows.every((r) => !!ans[r.id]);
    }
    return false;
  };

  const isMultiCorrect  = (sel: KeyOpt[], cor: KeyOpt[]) =>
    sel.length === cor.length && [...sel].sort().every((x, i) => x === [...cor].sort()[i]);

  const isMatrixCorrect = (qId: number, rows: MatrixRow[]) => {
    const ans = answersMatrix[qId] || {};
    return rows.every((r) => ans[r.id] === r.correct);
  };

  const saveScoreToDB = async (pct: number) => {
    if (!usuarioKey) throw new Error("No se encontró USUARIO_KEY en la sesión.");
    await apiJson(`${API_BASE}/evaluacionFinal/resultado`, {
      method: "POST",
      body: JSON.stringify({ usuarioKey, nivelKey: NIVEL_KEY, islaKey: ISLA_KEY, puntaje: pct }),
    });
    await AsyncStorage.multiSet([
      [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`,  "true"],
      [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`, String(pct)],
    ]);
    setSavedPct(pct);
  };

  const calcularScore = async () => {
    let aciertos = 0;
    questions.forEach((q) => {
      if (q.type === "single" && answersSingle[q.id] === q.correct) aciertos++;
      if (q.type === "multi"  && isMultiCorrect(answersMulti[q.id] || [], q.correct)) aciertos++;
      if (q.type === "matrix" && isMatrixCorrect(q.id, q.rows)) aciertos++;
    });
    const pct = Math.round((aciertos / questions.length) * 100);
    setScore(pct);
    setShowGame(false);
    setShowResult(true);
    try { await saveScoreToDB(pct); } catch (e: any) { Alert.alert("Ups", e?.message || "No se pudo guardar tu puntaje."); }
  };

  const handleFinish = () => {
    const unanswered = questions.filter((q) => !isQuestionAnswered(q)).length;
    if (unanswered > 0) { setMissingCount(unanswered); setShowIncomplete(true); return; }
    calcularScore();
  };

  const resetAll = () => {
    setQIndex(0);
    setAnswersSingle({});
    setAnswersMulti({});
    setAnswersMatrix({});
    setScore(0);
    setShowResult(false);
    setShowIncomplete(false);
    setMissingCount(0);
    setShowPodio(false);
    setShowIntro(true);
    setShowGame(false);
    setPlayers([]);
    setQuestions([]);
    transOpacity.setValue(1);
    transX.setValue(0);
    transScale.setValue(1);
  };

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
      const r = await apiJson(`${API_BASE}/evaluacionFinal/podio-isla?islaKey=${ISLA_KEY}&numeroOnboarding=${nOn}`);
      setPlayers((r?.data || []).map((row: any, idx: number) => ({
        id:      String(row.usuarioKey ?? idx),
        nombre:  row.nombre ?? "Sin nombre",
        puntaje: row.puntaje != null ? Number(row.puntaje) : null,
      })));
    } catch (e: any) {
      Alert.alert("Error al cargar podio", e?.message || "No se pudo cargar.");
      setPlayers([]);
    } finally { setPodioLoading(false); }
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => {
    if (a.puntaje == null && b.puntaje == null) return 0;
    if (a.puntaje == null) return 1;
    if (b.puntaje == null) return -1;
    return b.puntaje - a.puntaje;
  }), [players]);

  const top3 = sortedPlayers.filter((p) => p.puntaje != null).slice(0, 3);

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  // ─── Renderers ────────────────────────────────────────────────────────────

  const renderSingle = (q: SingleQuestion) => (
    <>
      <Text style={st.question}>{q.text}</Text>
      {q.options.map((op) => {
        const sel = answersSingle[q.id] === op.key;
        return (
          <TouchableOpacity key={op.key} onPress={() => selectSingle(q.id, op.key)} activeOpacity={0.9}
            style={[st.optionRow, sel && st.optionRowSelected]}>
            <Text style={[st.optionLabel, sel && st.optionLabelSelected]}>{op.label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  const renderMulti = (q: MultiQuestion) => {
    const selList = answersMulti[q.id] || [];
    return (
      <>
        <Text style={st.question}>{q.text}</Text>
        <Text style={st.helperText}>Selecciona una o varias opciones</Text>
        <View style={st.multiGrid}>
          {q.options.map((op) => {
            const sel = selList.includes(op.key);
            return (
              <TouchableOpacity key={op.key} onPress={() => toggleMulti(q.id, op.key)} activeOpacity={0.9}
                style={[st.multiOption, sel && st.optionRowSelected]}>
                <View style={[st.checkboxFake, sel && st.checkboxFakeSelected]}>
                  {sel && <Text style={st.checkboxTick}>✓</Text>}
                </View>
                <Text style={[st.multiOptionLabel, sel && st.optionLabelSelected]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  const renderMatrix = (q: MatrixQuestion) => {
    const matAns = answersMatrix[q.id] || {};
    return (
      <>
        <Text style={st.question}>{q.text}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          style={{ marginTop: scaleDP(6), width: "100%" }}
          contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center" }}
        >
          <View>
            {/* Header */}
            <View style={st.mxHeaderRow}>
              <View style={{ width: MATRIX_LABEL_W }} />
              {q.columns.map((col) => (
                <View key={col.key} style={st.mxColHeader}>
                  <Text style={st.mxHeaderText}>{col.label}</Text>
                </View>
              ))}
            </View>
            {/* Rows */}
            {q.rows.map((row, i) => {
              const answered = !!matAns[row.id];
              return (
                <View key={row.id} style={[st.mxRow, i % 2 === 0 && st.mxRowAlt]}>
                  <View style={[st.mxLabelCell, answered && st.mxLabelAnswered]}>
                    <Text style={st.mxLabelText}>{row.label}</Text>
                  </View>
                  {q.columns.map((col) => {
                    const sel = matAns[row.id] === col.key;
                    return (
                      <TouchableOpacity key={col.key} style={st.mxOptionCell} activeOpacity={0.75}
                        onPress={() => selectMatrix(q.id, row.id, col.key)}>
                        <View style={[st.mxRadioOuter, sel && st.mxRadioOuterSel]}>
                          {sel && <View style={st.mxRadioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  };

  const renderQuestion = () => {
    if (!current) return null;
    if (current.type === "single") return renderSingle(current);
    if (current.type === "multi")  return renderMulti(current);
    if (current.type === "matrix") return renderMatrix(current);
    return null;
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <ImageBackground source={fondo} style={st.background} resizeMode="cover">
      <View style={st.backdrop} />

      {/* ── INTRO ─────────────────────────────────────────────────────────── */}
      {showIntro && (
        <View style={st.header}>
          <View style={st.introBox}>
            <Text style={st.tituloIntro}>Evaluación Final</Text>
            <Text style={st.descripcionIntro}>
              Llegaste al cierre del recorrido de Conceptos Generales.{"\n\n"}
              Responde las preguntas sobre lites, fórmulas, piezas, tipos de cristal, vidrio paquete y moldes.{"\n\n"}
              Puedes moverte entre las preguntas con los botones de navegación y revisar tus respuestas antes de finalizar.
            </Text>
            <TouchableOpacity style={st.playButton} onPress={startGame}>
              <Text style={st.playButtonText}>Comenzar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── JUEGO ─────────────────────────────────────────────────────────── */}
      {showGame && current && (
        <View style={st.gameContainer}>
          <Text style={st.progress}>Pregunta {qIndex + 1} / {questions.length}</Text>
          <View style={st.cardWrap}>
            <Animated.View style={[st.card, { opacity: transOpacity, transform: [{ translateX: transX }, { scale: transScale }] }]}>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.cardInner} showsVerticalScrollIndicator={false}>
                {renderQuestion()}
              </ScrollView>
            </Animated.View>
          </View>
          <View style={st.navRow}>
            <TouchableOpacity onPress={goPrev} disabled={qIndex === 0 || transitioning}
              style={[st.navBtn, { backgroundColor: "#B2B2B2" }, (qIndex === 0 || transitioning) && st.navBtnDisabled]}
              activeOpacity={0.8}>
              <Text style={st.navBtnText}>Anterior</Text>
            </TouchableOpacity>
            {!isLast && (
              <TouchableOpacity onPress={goNext} disabled={transitioning}
                style={[st.navBtn, { backgroundColor: "#4C92E4" }, transitioning && st.navBtnDisabled]}
                activeOpacity={0.8}>
                <Text style={st.navBtnText}>Siguiente</Text>
              </TouchableOpacity>
            )}
            {isLast && (
              <TouchableOpacity onPress={handleFinish} style={[st.navBtn, { backgroundColor: "#4C92E4" }]} activeOpacity={0.9}>
                <Text style={st.navBtnText}>Continuar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── MODAL: preguntas incompletas ───────────────────────────────────── */}
      {showIncomplete && (
        <View style={st.overlay}>
          <View style={st.modalBoxSmall}>
            <Text style={st.modalTitleSmall}>Te faltan respuestas</Text>
            <Text style={st.modalDescSmall}>
              Aún tienes {missingCount} pregunta{missingCount === 1 ? "" : "s"} sin responder.{"\n"}
              Revisa y completa todas antes de finalizar.
            </Text>
            <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(14) }]}
              onPress={() => setShowIncomplete(false)}>
              <Text style={st.modalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── RESULTADO ─────────────────────────────────────────────────────── */}
      {showResult && (
        <View style={st.overlay}>
          <View style={st.resultAlertBox}>
            <Text style={st.scoreBig}>{savedPct > 0 ? savedPct : score}%</Text>
            <Text style={st.resultMainText}>
              {passed
                ? "¡Excelente! Has aprobado la evaluación final 🎉"
                : score >= 60
                  ? "Vas por buen camino, pero aún puedes mejorar tu resultado."
                  : "Tu resultado está por debajo de lo esperado. Puedes repetir la evaluación para reforzar los conceptos."}
            </Text>
            <View style={st.resultRow}>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#10B981", marginTop: scaleDP(18) }]} onPress={resetAll}>
                <Text style={st.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(18) }]}
                onPress={() => router.push(RUTA_VOLVER as any)}>
                <Text style={st.modalBtnText}>Volver al mapa</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={[st.modalBtn, { backgroundColor: "#FACC15", marginTop: scaleDP(18), alignSelf: "stretch" }]}
              disabled={podioLoading}
              onPress={async () => { setShowResult(false); setShowPodio(true); await loadPodio(); }}>
              <Text style={[st.modalBtnText, { color: "#78350F" }]}>
                {podioLoading ? "Cargando podio..." : "Ver podio 🏆"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PODIO ─────────────────────────────────────────────────────────── */}
      {showPodio && (
        <View style={st.overlay}>
          <View style={st.podioBox}>
            <View style={st.podioHeader}>
              <Text style={st.podioTitle}>🏆 Podio Conceptos Generales</Text>
              <Text style={st.podioSubtitle}>
                {numeroOnboarding ? `Grupo onboarding #${numeroOnboarding}` : "Clasificación del grupo"}
              </Text>
            </View>

            {top3.length > 0 && (
              <View style={st.top3Container}>
                {top3[1] && (
                  <View style={[st.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(40) }]}>🥈</Text>
                    <Text style={st.medalName} numberOfLines={1}>{top3[1].nombre}</Text>
                    <Text style={st.medalScore}>{top3[1].puntaje}%</Text>
                  </View>
                )}
                {top3[0] && (
                  <View style={[st.medalBox, { marginTop: 0 }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(50) }]}>🥇</Text>
                    <Text style={[st.medalName, { fontSize: scaleDP(18) }]} numberOfLines={1}>{top3[0].nombre}</Text>
                    <Text style={[st.medalScore, { fontSize: scaleDP(24) }]}>{top3[0].puntaje}%</Text>
                  </View>
                )}
                {top3[2] && (
                  <View style={[st.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(34) }]}>🥉</Text>
                    <Text style={st.medalName} numberOfLines={1}>{top3[2].nombre}</Text>
                    <Text style={st.medalScore}>{top3[2].puntaje}%</Text>
                  </View>
                )}
              </View>
            )}

            <Text style={st.podioListTitle}>Todos los participantes</Text>
            <ScrollView
              style={st.podioList}
              contentContainerStyle={{ paddingBottom: scaleDP(10) }}
              showsVerticalScrollIndicator={false}
            >
              {podioLoading ? (
                <Text style={st.podioEmpty}>Cargando...</Text>
              ) : sortedPlayers.length === 0 ? (
                <Text style={st.podioEmpty}>Aún no hay resultados en tu grupo.</Text>
              ) : (
                sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={st.playerRow}>
                    <Text style={st.playerRank}>{getMedal(idx)}</Text>
                    <Text style={st.playerName} numberOfLines={1}>{p.nombre}</Text>
                    {p.puntaje != null
                      ? <Text style={st.playerScore}>{p.puntaje}%</Text>
                      : <Text style={st.playerNoResponse}>Aún no responde</Text>}
                  </View>
                ))
              )}
            </ScrollView>

            <View style={{ flexDirection: "row", gap: scaleDP(10), marginTop: scaleDP(14) }}>
              <TouchableOpacity
                style={[st.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]}
                onPress={() => { setShowPodio(false); setShowResult(true); }}>
                <Text style={st.podioBtnText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]}
                onPress={() => router.push("/mapa" as any)}>
                <Text style={st.podioBtnText}>Continuar Isla</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

// ─── Styles ─────────────────────────────────────────────────────────────────

const st = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.35)" },
  header:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },

  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.85)",
    paddingVertical: scaleDP(40), paddingHorizontal: scaleDP(40),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  tituloIntro:      { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(16) },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton:       { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(30), paddingVertical: scaleDP(16) },
  progress:      { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14), color: "#0F1B4C", marginBottom: scaleDP(8) },
  cardWrap:      { width: "90%", maxWidth: 1200, maxHeight: "78%" },
  card:          { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: scaleDP(16), borderWidth: scaleDP(2), borderColor: "#E5E7EB", elevation: 8, overflow: "hidden" },
  cardInner:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(14), gap: scaleDP(6) },

  question:            { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(20), color: "#0F1B4C", textAlign: "center", marginBottom: scaleDP(6) },
  optionRow:           { borderWidth: scaleDP(2), borderColor: "#D1D5DB", backgroundColor: "#F9FAFB", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(14), borderRadius: scaleDP(12) },
  optionRowSelected:   { borderColor: "#4C92E4", backgroundColor: "#E0EDFF" },
  optionLabel:         { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827", textAlign: "center" },
  optionLabelSelected: { fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C" },

  helperText:  { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(16), color: "#4B5563", textAlign: "center", marginBottom: scaleDP(4) },
  multiGrid:   { flexDirection: "row", flexWrap: "wrap", gap: scaleDP(8) },
  multiOption: { flexDirection: "row", alignItems: "center", gap: scaleDP(8), width: "48%", borderWidth: scaleDP(2), borderColor: "#D1D5DB", backgroundColor: "#F9FAFB", paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(10), borderRadius: scaleDP(12) },
  multiOptionLabel:     { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(14), color: "#111827" },
  checkboxFake:         { width: scaleDP(26), height: scaleDP(26), borderRadius: scaleDP(8), borderWidth: scaleDP(2), borderColor: "#9CA3AF", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxFakeSelected: { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },
  checkboxTick:         { color: "#fff", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(16), lineHeight: scaleDP(18) },

  mxHeaderRow:     { flexDirection: "row", backgroundColor: "#EFF6FF", borderBottomWidth: scaleDP(1.5), borderBottomColor: "#BFDBFE" },
  mxColHeader:     { width: MATRIX_COL_W, paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(4), alignItems: "center", justifyContent: "flex-end", borderLeftWidth: scaleDP(1), borderLeftColor: "#DBEAFE" },
  mxHeaderText:    { fontFamily: "PlusJakartaSans-Bold", fontSize: MATRIX_HEADER_F, color: "#1E40AF", textAlign: "center" },
  mxRow:           { flexDirection: "row", minHeight: MATRIX_ROW_H, borderBottomWidth: scaleDP(1), borderBottomColor: "#E5E7EB", backgroundColor: "#fff" },
  mxRowAlt:        { backgroundColor: "#F9FAFB" },
  mxLabelCell:     { width: MATRIX_LABEL_W, paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(10), justifyContent: "center", borderRightWidth: scaleDP(1.5), borderRightColor: "#BFDBFE" },
  mxLabelAnswered: { borderRightColor: "#4C92E4" },
  mxLabelText:     { fontFamily: "PlusJakartaSans-Regular", fontSize: MATRIX_FONT, color: "#111827" },
  mxOptionCell:    { width: MATRIX_COL_W, alignItems: "center", justifyContent: "center", borderLeftWidth: scaleDP(1), borderLeftColor: "#E5E7EB" },
  mxRadioOuter:    { width: MATRIX_RADIO, height: MATRIX_RADIO, borderRadius: MATRIX_RADIO / 2, borderWidth: scaleDP(1.5), borderColor: "#9CA3AF", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  mxRadioOuterSel: { borderColor: "#4C92E4", backgroundColor: "#EFF6FF" },
  mxRadioInner:    { width: MATRIX_RADIO_IN, height: MATRIX_RADIO_IN, borderRadius: MATRIX_RADIO_IN / 2, backgroundColor: "#4C92E4" },

  navRow:         { flexDirection: "row", justifyContent: "center", gap: scaleDP(16), marginTop: scaleDP(18), width: "60%" },
  navBtn:         { flex: 1, paddingVertical: scaleDP(10), borderRadius: scaleDP(12), alignItems: "center" },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText:     { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },

  overlay:        { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(24) },
  modalBoxSmall:  { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(18), paddingHorizontal: scaleDP(22), alignItems: "center", elevation: 8, maxWidth: "80%" },
  modalTitleSmall:{ fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(60), color: "#0F1B4C", marginBottom: scaleDP(8), textAlign: "center" },
  modalDescSmall: { fontFamily: "PlusJakartaSans-Regular",   fontSize: scaleDP(40), color: "#111827", textAlign: "center" },

  resultAlertBox: { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "80%", alignItems: "center" },
  scoreBig:       { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(80), marginBottom: scaleDP(12) },
  resultMainText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(40), textAlign: "center" },
  resultRow:      { marginTop: scaleDP(16), flexDirection: "row", gap: scaleDP(10) },
  modalBtn:       { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30), textAlign: "center" },

  podioBox:      { backgroundColor: "#1a1a2e", padding: scaleDP(20), borderRadius: scaleDP(20), maxWidth: "90%", width: "90%", elevation: 10 },
  podioHeader:   { alignItems: "center", marginBottom: scaleDP(16) },
  podioTitle:    { fontSize: scaleDP(24), fontWeight: "bold", color: "#a3ecf1", textAlign: "center" },
  podioSubtitle: { fontSize: scaleDP(14), color: "#AAAAAA", marginTop: scaleDP(4) },
  top3Container: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginBottom: scaleDP(16) },
  medalBox:      { alignItems: "center", marginHorizontal: scaleDP(10), padding: scaleDP(14), borderRadius: scaleDP(14), backgroundColor: "rgba(255,255,255,0.1)", minWidth: scaleDP(90) },
  medalEmoji:    { marginBottom: scaleDP(4) },
  medalName:     { color: "#FFFFFF", fontSize: scaleDP(13), fontWeight: "bold", textAlign: "center" },
  medalScore:    { color: "#a3ecf1", fontSize: scaleDP(16), fontWeight: "bold", marginTop: scaleDP(4) },
  podioListTitle:   { color: "#AAAAAA", fontSize: scaleDP(12), fontWeight: "bold", marginBottom: scaleDP(6), textTransform: "uppercase", letterSpacing: 1 },
  podioList:        { maxHeight: scaleDP(180), marginBottom: scaleDP(8) },
  podioEmpty:       { color: "#9CA3AF", fontSize: scaleDP(12), textAlign: "center", paddingVertical: scaleDP(14) },
  playerRow:        { flexDirection: "row", alignItems: "center", padding: scaleDP(10), backgroundColor: "rgba(255,255,255,0.05)", borderRadius: scaleDP(10), marginBottom: scaleDP(6) },
  playerRank:       { color: "#FFFFFF", fontSize: scaleDP(14), fontWeight: "bold", width: scaleDP(36) },
  playerName:       { color: "#FFFFFF", fontSize: scaleDP(14), flex: 1 },
  playerScore:      { color: "#a3ecf1", fontSize: scaleDP(14), fontWeight: "bold" },
  playerNoResponse: { color: "#6B7280", fontSize: scaleDP(11), fontStyle: "italic" },
  podioBtn:         { paddingVertical: scaleDP(10), borderRadius: scaleDP(10), alignItems: "center" },
  podioBtnText:     { color: "#1a1a2e", fontWeight: "bold", fontSize: scaleDP(14) },
});