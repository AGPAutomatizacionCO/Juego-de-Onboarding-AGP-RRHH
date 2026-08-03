import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated as RNAnimated,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
   ========================================================= */
const ISLA_KEY  = 8;
const NIVEL_KEY = 37;
const API_URL   = API_BASE_URL;
const MAX_LIVES = 5;

function scoreFromLives(lives: number): number {
  if (lives >= 5) return 100;
  if (lives === 4) return 95;
  if (lives === 3) return 90;
  if (lives === 2) return 85;
  if (lives === 1) return 80;
  return 75;
}

/* =========================================================
   TIPOS
   ========================================================= */
type OpcionKey = "A" | "B" | "C";
type TipoEj    = "tolerancia" | "verdadero_falso" | "signos";

type Ejercicio = {
  id: number;
  tipo: TipoEj;
  enunciado: string;
  opciones: { key: OpcionKey; label: string }[];
  correcta: OpcionKey;
};

/* =========================================================
   DATOS
   ========================================================= */

// ── Submodulo 1: Tolerancias ──────────────────────────────
const SUB1: Ejercicio[] = [
  {
    id: 1, tipo: "tolerancia",
    enunciado: "¿Cuál es la opción correcta para  1,20 ± 0,15 mm?",
    opciones: [
      { key: "A", label: "1,15 mm  y  1,45 mm" },
      { key: "B", label: "1,35 mm  y  1,05 mm" },
      { key: "C", label: "1,25 mm  y  1,15 mm" },
    ],
    correcta: "B",
  },
  {
    id: 2, tipo: "tolerancia",
    enunciado: "¿Cuál es la opción correcta para  3,25 ± 0,5 mm?",
    opciones: [
      { key: "A", label: "3,30 mm  y  3,20 mm" },
      { key: "B", label: "3,55 mm  y  2,85 mm" },
      { key: "C", label: "3,75 mm  y  2,75 mm" },
    ],
    correcta: "C",
  },
  {
    id: 3, tipo: "tolerancia",
    enunciado: "¿Cuál es la opción correcta para  8 ± 1,05 mm?",
    opciones: [
      { key: "A", label: "9,05 mm  y  6,95 mm" },
      { key: "B", label: "9,5 mm   y  6,5 mm" },
      { key: "C", label: "9,05 mm  y  7,95 mm" },
    ],
    correcta: "A",
  },
];

// ── Submodulo 2: Verdadero / Falso ────────────────────────
const SUB2: Ejercicio[] = [
  {
    id: 4, tipo: "verdadero_falso",
    enunciado: "La siguiente afirmación es:  ( 110 mm  >  90 mm )",
    opciones: [
      { key: "A", label: "VERDADERA" },
      { key: "B", label: "FALSA" },
      { key: "C", label: "No se puede determinar" },
    ],
    correcta: "A",
  },
  {
    id: 5, tipo: "verdadero_falso",
    enunciado: "La siguiente afirmación es:  ( 1,2 mm  >  0,8 mm )",
    opciones: [
      { key: "A", label: "FALSA" },
      { key: "B", label: "VERDADERA" },
      { key: "C", label: "Depende del contexto" },
    ],
    correcta: "B",
  },
  {
    id: 6, tipo: "verdadero_falso",
    enunciado: "La siguiente afirmación es:  ( 225 mm  <  115 mm )",
    opciones: [
      { key: "A", label: "VERDADERA" },
      { key: "B", label: "No se puede determinar" },
      { key: "C", label: "FALSA" },
    ],
    correcta: "C",
  },
];

// ── Submodulo 3: Signos con múltiples valores ─────────────
const SUB3: Ejercicio[] = [
  {
    id: 7, tipo: "signos",
    enunciado: "¿Cuál es la opción correcta para  >= 1,5 mm?",
    opciones: [
      { key: "A", label: "1,5 mm / 1,8 mm / 1,49 mm" },
      { key: "B", label: "1,34 mm / 1,55 mm / 1,49 mm" },
      { key: "C", label: "1,5 mm / 1,8 mm / 1,9 mm" },
    ],
    correcta: "C",
  },
  {
    id: 8, tipo: "signos",
    enunciado: "¿Cuál es la opción correcta para  <= 2,3 mm?",
    opciones: [
      { key: "A", label: "2,3 mm / 1,5 mm / 2,35 mm" },
      { key: "B", label: "2,28 mm / 1,55 mm / 2,3 mm" },
      { key: "C", label: "2,34 mm / 2,45 mm / 1,34 mm" },
    ],
    correcta: "B",
  },
  {
    id: 9, tipo: "signos",
    enunciado: "¿Cuál es la opción correcta para  >= 3,15 mm?",
    opciones: [
      { key: "A", label: "3,15 mm / 2,18 mm / 1,9 mm" },
      { key: "B", label: "2,14 mm / 1,67 mm / 2,05 mm" },
      { key: "C", label: "3,29 mm / 4,25 mm / 3,15 mm" },
    ],
    correcta: "C",
  },
];

const SUBMODULOS = [SUB1, SUB2, SUB3];

const SUBMODULO_TITULOS = [
  "Tolerancias",
  "Signos: Verdadero o Falso",
  "Signos: Valores múltiples",
];

const SUBMODULO_ICONOS = ["📐", "✅", "🔢"];

/* =========================================================
   COMPONENTE VIDAS — número + un corazón
   ========================================================= */
function LivesBar({ lives }: { lives: number }) {
  return (
    <View style={st.livesRow}>
      <Text style={st.livesNum}>{lives}</Text>
      <Text style={st.heartIcon}>❤️</Text>
    </View>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function NivelLecturaCalidad() {
  const router = useRouter();

  const [usuarioKey,   setUsuarioKey]   = useState<number | null>(null);
  const [checkingDone, setCheckingDone] = useState(true);
  const [showIntro,    setShowIntro]    = useState(false);

  const [subIdx,    setSubIdx]    = useState(0);
  const [lives,     setLives]     = useState(MAX_LIVES);
  const [subScores, setSubScores] = useState<number[]>([]);

  const [selected, setSelected] = useState<Record<number, OpcionKey | null>>({});
  const [locked,   setLocked]   = useState<Record<number, boolean>>({});

  const [showMinus,   setShowMinus]   = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFinal,   setShowFinal]   = useState(false);
  const [finalScore,  setFinalScore]  = useState(0);
  const [savedScore,  setSavedScore]  = useState<number | null>(null);

  const minusScale   = useRef(new RNAnimated.Value(0.6)).current;
  const minusOpacity = useRef(new RNAnimated.Value(0)).current;
  const minusShake   = useRef(new RNAnimated.Value(0)).current;
  const successScale = useRef(new RNAnimated.Value(0.8)).current;
  const successOpac  = useRef(new RNAnimated.Value(0)).current;

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  useEffect(() => {
    (async () => {
      const k = await AsyncStorage.getItem("USUARIO_KEY");
      const n = Number(k);
      if (!k || !Number.isFinite(n) || n <= 0) {
        setCheckingDone(false);
        Alert.alert("Falta sesión", "No se encontró usuarioKey.", [
          { text: "OK", onPress: () => router.replace("/registration") },
        ]);
        return;
      }
      setUsuarioKey(n);
    })();
  }, []);

  useEffect(() => {
    if (!usuarioKey) return;
    (async () => {
      try {
        const done  = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_done`);
        const score = await AsyncStorage.getItem(`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_score`);
        if (done === "true") {
          setSavedScore(score ? Number(score) : 0);
          setShowFinal(true);
        } else {
          setShowIntro(true);
        }
      } catch {
        setShowIntro(true);
      } finally {
        setCheckingDone(false);
      }
    })();
  }, [usuarioKey]);

  const resetSub = (idx: number) => {
    setSubIdx(idx);
    setLives(MAX_LIVES);
    setSelected({});
    setLocked({});
  };

  const playMinusAnim = () => {
    minusScale.setValue(0.6);
    minusOpacity.setValue(0);
    minusShake.setValue(0);
    Vibration.vibrate(120);
    RNAnimated.parallel([
      RNAnimated.sequence([
        RNAnimated.timing(minusOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        RNAnimated.timing(minusOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      RNAnimated.sequence([
        RNAnimated.timing(minusScale, { toValue: 1.3, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(minusScale, { toValue: 1,   duration: 160, useNativeDriver: true }),
      ]),
      RNAnimated.sequence([
        RNAnimated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: -1, duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: 0,  duration: 70, useNativeDriver: true }),
      ]),
    ]).start(() => setTimeout(() => setShowMinus(false), 500));
  };

  const handleSelect = (ej: Ejercicio, key: OpcionKey) => {
    if (locked[ej.id]) return;
    setSelected(prev => ({ ...prev, [ej.id]: key }));
    if (key === ej.correcta) {
      setLocked(prev => ({ ...prev, [ej.id]: true }));
    } else {
      const newLives = Math.max(0, lives - 1);
      setLives(newLives);
      setShowMinus(true);
      playMinusAnim();
    }
  };

  const subActual = SUBMODULOS[subIdx];
  const allLocked = subActual.every(ej => locked[ej.id]);

  const handleAdvance = async () => {
    const score     = scoreFromLives(lives);
    const newScores = [...subScores, score];
    setSubScores(newScores);

    if (subIdx < SUBMODULOS.length - 1) {
      setShowSuccess(true);
      successScale.setValue(0.8);
      successOpac.setValue(0);
      RNAnimated.parallel([
        RNAnimated.timing(successOpac,  { toValue: 1, duration: 250, useNativeDriver: true }),
        RNAnimated.timing(successScale, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
      setTimeout(() => {
        setShowSuccess(false);
        resetSub(subIdx + 1);
      }, 1400);
    } else {
      const avg = Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length);
      setFinalScore(avg);
      await saveProgreso(avg);
      setShowFinal(true);
    }
  };

  const saveProgreso = async (score: number) => {
    if (!usuarioKey) return;
    try {
      await AsyncStorage.multiSet([
        [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_done`,     "true"],
        [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_score`,    String(score)],
        [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_aprobado`, String(score >= 70)],
        [`u:${usuarioKey}:isla${ISLA_KEY}_nivel33_recordemos_unlocked`,        "true"],
      ]);
      await fetch(`${API_URL}/api/niveles/lectura/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey, puntaje: score,
          aprobado: score >= 70 ? 1 : 0,
          islaKey: ISLA_KEY, nivelKey: NIVEL_KEY,
        }),
      });
    } catch (e) { console.error("Error guardando lectura calidad:", e); }
  };

  const getOptionStyle = (ej: Ejercicio, key: OpcionKey) => {
    const sel = selected[ej.id];
    if (!sel) return st.optionDefault;
    if (locked[ej.id] && sel === key) return st.optionCorrect;
    if (sel === key && key !== ej.correcta) return st.optionWrong;
    return st.optionDefault;
  };

  const getOptionTextStyle = (ej: Ejercicio, key: OpcionKey) => {
    const sel = selected[ej.id];
    if (!sel) return st.optionTextDefault;
    if (locked[ej.id] && sel === key) return st.optionTextCorrect;
    if (sel === key && key !== ej.correcta) return st.optionTextWrong;
    return st.optionTextDefault;
  };

  if (!loaded || checkingDone) return <View style={{ flex: 1, backgroundColor: "#fff" }} />;

  const fondo  = require("../assets/FONDOREG.png");
  const shakeX = minusShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  return (
    <ImageBackground source={fondo} style={st.bg} resizeMode="cover">
      <View style={st.overlay}>

        {/* ── INTRO ── */}
        {showIntro && (
          <View style={st.centeredFull}>
            <View style={st.introBox}>
              <Text style={st.introTitle}>Nivel de Lectura – Calidad</Text>
              <Text style={st.introDesc}>
                Pon a prueba tu manejo de tolerancias y signos de comparación aplicados en planta.{"\n\n"}
                <Text style={{ fontWeight: "900" }}>Módulo 1:</Text> Tolerancias — calcula los rangos correctos.{"\n"}
                <Text style={{ fontWeight: "900" }}>Módulo 2:</Text> Verdadero o Falso — evalúa si la comparación es correcta.{"\n"}
                <Text style={{ fontWeight: "900" }}>Módulo 3:</Text> Signos — elige el grupo de valores que cumple la condición.{"\n\n"}
                Tienes <Text style={{ fontWeight: "900" }}>5 ❤️</Text> por módulo. Si fallas puedes corregir, pero perderás una vida.
              </Text>
              <TouchableOpacity style={st.playButton} onPress={() => setShowIntro(false)}>
                <Text style={st.playButtonText}>Comenzar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── JUEGO ── */}
        {!showIntro && !showFinal && (
          <View style={st.gameContainer}>

            {/* Header */}
            <View style={st.topBar}>
              <LivesBar lives={lives} />
              <View style={st.subTitleBox}>
                <Text style={st.subIcon}>{SUBMODULO_ICONOS[subIdx]}</Text>
                <Text style={st.subTitle}>{SUBMODULO_TITULOS[subIdx]}</Text>
              </View>
              <Text style={st.subProgress}>{subIdx + 1} / {SUBMODULOS.length}</Text>
            </View>

            {/* Ejercicios — 3 en pantalla, altura reducida 30% */}
            <View style={st.ejRow}>
              {subActual.map((ej) => {
                const isAnswered = locked[ej.id];
                return (
                  <View key={ej.id} style={[st.ejCard, isAnswered && st.ejCardDone]}>

                    {isAnswered && (
                      <View style={st.correctBadge}>
                        <Text style={st.correctBadgeText}>✓</Text>
                      </View>
                    )}

                    <Text style={st.ejEnunciado}>{ej.enunciado}</Text>

                    <View style={st.optionsCol}>
                      {ej.opciones.map(op => (
                        <TouchableOpacity
                          key={op.key}
                          style={[st.optionBtn, getOptionStyle(ej, op.key)]}
                          onPress={() => handleSelect(ej, op.key)}
                          activeOpacity={0.8}
                          disabled={isAnswered}
                        >
                          <View style={st.optionKeyBox}>
                            <Text style={[st.optionKey, getOptionTextStyle(ej, op.key)]}>{op.key}</Text>
                          </View>
                          <Text style={[st.optionLabel, getOptionTextStyle(ej, op.key)]}>{op.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Botón avanzar */}
            {allLocked && (
              <TouchableOpacity style={st.advanceBtn} onPress={handleAdvance} activeOpacity={0.85}>
                <Text style={st.advanceBtnText}>
                  {subIdx < SUBMODULOS.length - 1 ? `Siguiente módulo →` : "Ver resultado 🏁"}
                </Text>
              </TouchableOpacity>
            )}

            {!allLocked && (
              <View style={st.hintBox}>
                <Text style={st.hintText}>
                  {subActual.filter(e => !locked[e.id]).length} pregunta{subActual.filter(e => !locked[e.id]).length !== 1 ? "s" : ""} por responder
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── RESULTADO FINAL ── */}
        {showFinal && (
          <View style={st.centeredFull}>
            <View style={st.finalBox}>
              <Text style={st.finalScore}>{savedScore ?? finalScore}%</Text>
              <Text style={st.finalText}>
                {(savedScore ?? finalScore) >= 90
                  ? "¡Excelente! Dominas los signos y tolerancias 🎉"
                  : (savedScore ?? finalScore) >= 70
                    ? "¡Muy bien! Nivel completado 👍"
                    : "Nivel completado. Sigue repasando 💪"}
              </Text>
              <TouchableOpacity style={st.finalBtn} onPress={() => router.back()}>
                <Text style={st.finalBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── OVERLAY: vida perdida ── */}
        {showMinus && (
          <View style={st.modalOverlay}>
            <View style={st.minusBox}>
              <RNAnimated.Text style={[
                st.bigHeart,
                {
                  opacity: minusOpacity,
                  transform: [{ scale: minusScale }, { translateX: shakeX }],
                },
              ]}>
                💔
              </RNAnimated.Text>
              <Text style={st.minusText}>-1 vida</Text>
              <Text style={st.minusSubText}>Intenta de nuevo</Text>
            </View>
          </View>
        )}

        {/* ── OVERLAY: transición de submodulo ── */}
        {showSuccess && (
          <View style={st.modalOverlay}>
            <RNAnimated.View style={[
              st.successBox,
              { opacity: successOpac, transform: [{ scale: successScale }] },
            ]}>
              <Text style={st.successEmoji}>✅</Text>
              <Text style={st.successTitle}>¡Módulo {subIdx + 1} completado!</Text>
              <Text style={st.successSub}>
                {scoreFromLives(lives)}% en este módulo
              </Text>
            </RNAnimated.View>
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS
   ========================================================= */
const st = StyleSheet.create({
  bg:      { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.78)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 20, paddingVertical: 20,
  },

  /* INTRO */
  centeredFull: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
  introBox: {
    backgroundColor: "rgba(143,197,207,0.88)",
    paddingVertical: 40, paddingHorizontal: 40,
    borderRadius: 25, alignItems: "center", maxWidth: "85%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  introTitle:     { fontFamily: "PlusJakartaSans-Bold", fontSize: 46, color: "#fff", textAlign: "center", marginBottom: 16 },
  introDesc:      { fontFamily: "PlusJakartaSans-Regular", fontSize: 26, color: "#fff", textAlign: "center", lineHeight: 34 },
  playButton:     { marginTop: 32, backgroundColor: "#4C92E4", paddingVertical: 12, paddingHorizontal: 50, borderRadius: 16 },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 34 },

  /* JUEGO */
  gameContainer: { flex: 1, width: "100%", gap: 10, paddingTop: "15%" },

  topBar: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: 4,
  },
  /* Vidas: número + corazón */
  livesRow:  { flexDirection: "row", alignItems: "center", gap: 4 },
  livesNum:  { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: "#0F1B4C" },
  heartIcon: { fontSize: 22 },

  subTitleBox: { flexDirection: "row", alignItems: "center", gap: 6 },
  subIcon:     { fontSize: 22 },
  subTitle:    { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#0F1B4C" },
  subProgress: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#0F1B4C" },

  /* Fila de tarjetas — flex: 0.7 reduce el alto un 30% respecto al flex: 1 original */
  ejRow: { flex: 0.7, flexDirection: "row", gap: 12 },

  ejCard: {
    flex: 1, backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18, padding: 12,
    shadowColor: "#0F1B4C", shadowOpacity: 0.06, shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }, elevation: 4,
    borderWidth: 2, borderColor: "transparent",
    position: "relative",
  },
  ejCardDone: {
    borderColor: "#1EA97C",
    backgroundColor: "rgba(240,255,247,0.97)",
  },

  correctBadge: {
    position: "absolute", top: 8, right: 8,
    backgroundColor: "#1EA97C", borderRadius: 20,
    width: 26, height: 26, alignItems: "center", justifyContent: "center",
  },
  correctBadgeText: { color: "#fff", fontSize: 14, fontWeight: "900" },

  ejEnunciado: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 14,
    color: "#0F1B4C", textAlign: "center",
    marginBottom: 10, lineHeight: 20,
  },

  optionsCol: { gap: 6 },
  optionBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    borderRadius: 10, paddingVertical: 8, paddingHorizontal: 10,
    borderWidth: 2,
  },
  optionDefault: { backgroundColor: "#F0F4FF", borderColor: "#CAD7FF" },
  optionCorrect: { backgroundColor: "#D4EDDA", borderColor: "#1EA97C" },
  optionWrong:   { backgroundColor: "#FFE5E5", borderColor: "#D64545" },

  optionKeyBox: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "rgba(0,0,0,0.08)",
    alignItems: "center", justifyContent: "center",
  },
  optionKey:         { fontFamily: "PlusJakartaSans-Bold", fontSize: 13 },
  optionLabel:       { fontFamily: "PlusJakartaSans-Regular", fontSize: 13, flex: 1 },
  optionTextDefault: { color: "#0F1B4C" },
  optionTextCorrect: { color: "#145A32" },
  optionTextWrong:   { color: "#922B21" },

  advanceBtn: {
    backgroundColor: "#4C92E4", borderRadius: 14,
    paddingVertical: 14, alignItems: "center",
  },
  advanceBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 18 },

  hintBox: {
    backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 10,
    paddingVertical: 8, alignItems: "center",
  },
  hintText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 14, color: "#6B7280" },

  /* FINAL */
  finalBox: {
    backgroundColor: "#77b479", paddingVertical: 30, paddingHorizontal: 40,
    borderRadius: 22, alignItems: "center", maxWidth: "80%",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  finalScore:   { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: 110, marginBottom: 8 },
  finalText:    { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: 36, textAlign: "center", marginBottom: 20 },
  finalBtn:     { backgroundColor: "#4C92E4", paddingVertical: 14, paddingHorizontal: 44, borderRadius: 14 },
  finalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 30 },

  /* OVERLAYS */
  modalOverlay: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center",
    zIndex: 9999, elevation: 9999,
  },
  minusBox: {
    backgroundColor: "#fff", borderRadius: 20,
    paddingVertical: 24, paddingHorizontal: 40,
    alignItems: "center", elevation: 12,
  },
  bigHeart:     { fontSize: 90, textAlign: "center" },
  minusText:    { fontFamily: "PlusJakartaSans-Bold", fontSize: 42, color: "#DC2626", marginTop: -6 },
  minusSubText: { fontFamily: "PlusJakartaSans-Regular", fontSize: 18, color: "#6B7280", marginTop: 4 },

  successBox: {
    backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 24,
    paddingVertical: 30, paddingHorizontal: 50,
    alignItems: "center", elevation: 12,
  },
  successEmoji: { fontSize: 60, marginBottom: 10 },
  successTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: 32, color: "#0F1B4C", textAlign: "center" },
  successSub:   { fontFamily: "PlusJakartaSans-Regular", fontSize: 20, color: "#4B5563", marginTop: 6 },
});