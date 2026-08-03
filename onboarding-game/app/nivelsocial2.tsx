import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
  Modal,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* =========================================================
   ✅ CONFIG GENERAL
   ========================================================= */
const fondo = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/HSE";
const API_URL = API_BASE_URL;
const ISLA_KEY = 2;
const NIVEL_KEY_API = 9;
const MAX_LIVES = 5;

/* =========================================================
   ✅ SCORE SEGÚN VIDAS USADAS
   Vidas restantes → puntaje:
     5 → 100,  4 → 95,  3 → 90,  2 → 85,  1 → 80,  0 → 75
   ========================================================= */
function scoreFromLives(lives: number): number {
  if (lives >= 5) return 100;
  if (lives === 4) return 95;
  if (lives === 3) return 90;
  if (lives === 2) return 85;
  if (lives === 1) return 80;
  return 75;
}

/* =========================================================
   ✅ DATA
   ========================================================= */
const CASOS = [
  {
    id: 1,
    titulo: "Caso 1",
    texto:
      "Un trabajador opera una máquina sin usar guantes ni gafas de seguridad, aun cuando estos elementos son obligatorios. Decide hacerlo así para terminar la tarea más rápido.",
    respuesta: "3",
  },
  {
    id: 2,
    titulo: "Caso 2",
    texto:
      "Durante un recorrido por la planta se identifica un envase con una sustancia líquida sin ningún tipo de etiqueta que indique su contenido, peligros o medidas de seguridad.",
    respuesta: "1",
  },
  {
    id: 3,
    titulo: "Caso 3",
    texto:
      "Una máquina se encuentra en funcionamiento con sus partes móviles expuestas debido a que la guarda de seguridad fue retirada para facilitar el trabajo.",
    respuesta: "5",
  },
  {
    id: 4,
    titulo: "Caso 4",
    texto:
      "Un trabajador realiza una actividad que genera chispas y altas temperaturas, utilizando herramientas especiales y siguiendo un procedimiento específico de seguridad.",
    respuesta: "4",
  },
  {
    id: 5,
    titulo: "Caso 5",
    texto:
      "En el área de trabajo se identifican herramientas mal ubicadas y comportamientos que no cumplen los procedimientos, los cuales son reportados como parte de la cultura de seguridad de la empresa.",
    respuesta: "7",
  },
];

const SOLUCIONES = [
  "1. Reportar la situación y evitar manipular el envase hasta que sea identificado correctamente.",
  "2. Riesgo químico por posible contacto con sustancias peligrosas.",
  "3. Acto inseguro originado por el comportamiento del trabajador al no usar el EPP.",
  "4. Actividad de soldadura o trabajo en caliente.",
  "5. Riesgo mecánico por exposición a partes móviles de una máquina.",
  "6. Condición insegura causada por el entorno físico del área.",
  "7. Acción que permite prevenir accidentes al identificar riesgos y aplicar controles.",
  "8. Manipular el envase con precaución y continuar el trabajo.",
];

const NUMEROS_DISPONIBLES = ["1", "2", "3", "4", "5", "6", "7", "8"];

/* =========================================================
   ✅ COMPONENTE SELECTOR NUMÉRICO
   ========================================================= */
function SelectorNumerico({
  value,
  onChange,
  disabled,
  esCorrecta,
  esIncorrecta,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  esCorrecta?: boolean;
  esIncorrecta?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const borderColor = esCorrecta
    ? "#16A34A"
    : esIncorrecta
    ? "#DC2626"
    : value
    ? "#4C92E4"
    : "#0F1B4C";

  const bgColor = esCorrecta
    ? "#DCFCE7"
    : esIncorrecta
    ? "#FEE2E2"
    : value
    ? "#EEF5FF"
    : "#FFFFFF";

  return (
    <>
      <TouchableOpacity
        onPress={() => { if (!disabled) setOpen(true); }}
        activeOpacity={0.75}
        style={[
          styles.selectorBox,
          { borderColor, backgroundColor: bgColor },
        ]}
      >
        {value ? (
          <Text style={[styles.selectorValue, { color: borderColor }]}>{value}</Text>
        ) : (
          <View style={styles.selectorEmptyContent}>
            <Text style={styles.selectorPlaceholder}>#</Text>
            <Text style={styles.selectorArrow}>▼</Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setOpen(false)}
        >
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Selecciona el número</Text>
            <View style={styles.pickerGrid}>
              {NUMEROS_DISPONIBLES.map((num) => (
                <TouchableOpacity
                  key={num}
                  style={[
                    styles.pickerOption,
                    value === num && styles.pickerOptionSelected,
                  ]}
                  onPress={() => {
                    onChange(num);
                    setOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      value === num && styles.pickerOptionTextSelected,
                    ]}
                  >
                    {num}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* =========================================================
   ✅ COMPONENTE PRINCIPAL
   ========================================================= */
export default function NivelSocialHSE() {
  const router = useRouter();

  /* ── Vidas ── */
  const [lives, setLives] = useState<number>(MAX_LIVES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showMinusOverlay, setShowMinusOverlay] = useState(false);

  const heartScale   = useRef(new Animated.Value(1)).current;
  const minusScale   = useRef(new Animated.Value(0.6)).current;
  const minusOpacity = useRef(new Animated.Value(0)).current;
  const minusShake   = useRef(new Animated.Value(0)).current;

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

  /* ── Pantallas ── */
  const [showIntro, setShowIntro]               = useState(true);
  const [showGame, setShowGame]                 = useState(false);
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* ── Respuestas ── */
  const [respuestasUsuario, setRespuestasUsuario] = useState<Record<number, string>>({
    1: "", 2: "", 3: "", 4: "", 5: "",
  });
  const [mostrarResultados, setMostrarResultados] = useState(false);

  const startGame = () => {
    setShowIntro(false);
    setShowGame(true);
  };

  const handleSelect = (id: number, value: string) => {
    setRespuestasUsuario((prev) => ({ ...prev, [id]: value }));
  };

  const respuestasCompletas = useMemo(
    () => CASOS.every((c) => respuestasUsuario[c.id]?.trim() !== ""),
    [respuestasUsuario]
  );

  const correctas = useMemo(
    () => CASOS.reduce((acc, c) => acc + (respuestasUsuario[c.id] === c.respuesta ? 1 : 0), 0),
    [respuestasUsuario]
  );

  const finalScore = useMemo(() => scoreFromLives(lives), [lives]);

  /* ─────────────────────────────────────────────────────────
     ✅ VALIDAR — descuenta SOLO 1 vida por clic si hay
        al menos una respuesta incorrecta entre los casos
        que aún no han sido resueltos correctamente.
     ───────────────────────────────────────────────────────── */
  const validar = () => {
    const hayIncorrectas = CASOS.some(
      (caso) => respuestasUsuario[caso.id] !== caso.respuesta
    );

    setMostrarResultados(true);

    if (hayIncorrectas) {
      const nuevasVidas = Math.max(0, lives - 1);
      setLives(nuevasVidas);
      animateHeart();
      playMinusAnim();

      if (nuevasVidas <= 0) {
        setShowGameOver(true);
      } else {
        setShowMinusOverlay(true);
      }
      return; // no mostrar éxito si hay errores
    }

    // Todo correcto → pantalla de éxito
    setShowFinalSuccess(true);
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  };

  const resetGame = () => {
    setRespuestasUsuario({ 1: "", 2: "", 3: "", 4: "", 5: "" });
    setLives(MAX_LIVES);
    setMostrarResultados(false);
    setShowFinalSuccess(false);
    setShowGameOver(false);
    setShowMinusOverlay(false);
    fadeAnim.setValue(0);
  };

  const resetAll = () => {
    resetGame();
    setShowIntro(true);
    setShowGame(false);
  };

  /* ── Scrollbars custom ── */
  const scrollY = useRef(new Animated.Value(0)).current;
  const leftScrollRef  = useRef<ScrollView>(null);
  const rightScrollRef = useRef<ScrollView>(null);

  const [leftContentHeight,  setLeftContentHeight]  = useState(1);
  const [leftScrollHeight,   setLeftScrollHeight]   = useState(1);
  const [rightContentHeight, setRightContentHeight] = useState(1);
  const [rightScrollHeight,  setRightScrollHeight]  = useState(1);

  const TRACK_H = scaleDP(420);

  const leftThumbH = Math.max(
    scaleDP(30),
    leftScrollHeight > 0 ? (leftScrollHeight / Math.max(leftContentHeight, 1)) * TRACK_H : TRACK_H
  );
  const leftThumbTop = leftScrollHeight > 0
    ? scrollY.interpolate({
        inputRange: [0, Math.max(leftContentHeight - leftScrollHeight, 1)],
        outputRange: [0, TRACK_H - leftThumbH],
        extrapolate: "clamp",
      })
    : new Animated.Value(0);

  const [rightScrollY, setRightScrollY] = useState(0);
  const rightThumbH = Math.max(
    scaleDP(30),
    rightScrollHeight > 0 ? (rightScrollHeight / Math.max(rightContentHeight, 1)) * TRACK_H : TRACK_H
  );
  const rightThumbTop = rightContentHeight > rightScrollHeight
    ? (rightScrollY / Math.max(rightContentHeight - rightScrollHeight, 1)) * (TRACK_H - rightThumbH)
    : 0;

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* ── INTRO ── */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Social – HSE</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás analizar casos reales relacionados con seguridad y salud en el trabajo.{"\n\n"}
              Toca el cuadro de número de cada caso para desplegar las opciones y selecciona el número que corresponde a la solución correcta.{"\n\n"}
              Lee cuidadosamente y relaciona cada caso con la opción que corresponda.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── JUEGO ── */}
      {showGame && (
        <View style={styles.gameContainer}>

          {/* ── Vidas ── */}
          <Animated.View style={[styles.livesContainer, { transform: [{ scale: heartScale }] }]}>
            <Text style={styles.livesHeart}>❤️</Text>
            <Text style={styles.livesNumber}>{lives}</Text>
          </Animated.View>

          <View style={styles.boardArea}>
            <View style={styles.board}>

              {/* Cabecera */}
              <View style={styles.boardHeaderRow}>
                <Text style={[styles.boardHeaderText, { width: "10%" }]}>N°</Text>
                <Text style={[styles.boardHeaderText, { width: "50%" }]}>Casos reales</Text>
                <Text style={[styles.boardHeaderText, { width: "40%" }]}>Posibles soluciones</Text>
              </View>

              <View style={styles.contentRow}>

                {/* Columna izquierda */}
                <View style={styles.leftWrapper}>
                  <ScrollView
                    ref={leftScrollRef}
                    style={styles.leftSide}
                    contentContainerStyle={styles.leftSideContent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={Animated.event(
                      [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                      { useNativeDriver: false }
                    )}
                    onContentSizeChange={(_, h) => setLeftContentHeight(h)}
                    onLayout={(e) => setLeftScrollHeight(e.nativeEvent.layout.height)}
                  >
                    {CASOS.map((caso) => {
                      const respuestaUsuario = respuestasUsuario[caso.id];
                      const esCorrecta  = respuestaUsuario === caso.respuesta;
                      const esIncorrecta = mostrarResultados && respuestaUsuario !== "" && !esCorrecta;
                      const mostrarOk   = mostrarResultados && esCorrecta;

                      return (
                        <View key={caso.id} style={styles.caseRow}>
                          <SelectorNumerico
                            value={respuestaUsuario}
                            onChange={(v) => handleSelect(caso.id, v)}
                            disabled={mostrarResultados && esCorrecta}
                            esCorrecta={mostrarOk}
                            esIncorrecta={esIncorrecta}
                          />
                          <View style={styles.caseCard}>
                            <Text style={styles.caseTitle}>{caso.titulo}</Text>
                            <Text style={styles.caseText}>{caso.texto}</Text>
                            {mostrarResultados && (
                              <Text style={[styles.caseFeedback, esCorrecta ? styles.feedbackCorrecto : styles.feedbackIncorrecto]}>
                                {esCorrecta ? "✓ Correcto" : "✗ Incorrecto"}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>

                  {leftContentHeight > leftScrollHeight && (
                    <View style={[styles.scrollTrack, { height: TRACK_H }]}>
                      <Animated.View
                        style={[styles.scrollThumb, { height: leftThumbH, top: leftThumbTop }]}
                      />
                    </View>
                  )}
                </View>

                {/* Columna derecha */}
                <View style={styles.rightWrapper}>
                  <ScrollView
                    ref={rightScrollRef}
                    style={styles.rightSide}
                    contentContainerStyle={styles.rightSideContent}
                    showsVerticalScrollIndicator={false}
                    scrollEventThrottle={16}
                    onScroll={(e) => setRightScrollY(e.nativeEvent.contentOffset.y)}
                    onContentSizeChange={(_, h) => setRightContentHeight(h)}
                    onLayout={(e) => setRightScrollHeight(e.nativeEvent.layout.height)}
                  >
                    {SOLUCIONES.map((solucion, index) => (
                      <View key={index} style={styles.solutionCard}>
                        <Text style={styles.solutionText}>{solucion}</Text>
                      </View>
                    ))}
                  </ScrollView>

                  {rightContentHeight > rightScrollHeight && (
                    <View style={[styles.scrollTrack, { height: TRACK_H }]}>
                      <View
                        style={[
                          styles.scrollThumb,
                          { height: rightThumbH, top: rightThumbTop },
                        ]}
                      />
                    </View>
                  )}
                </View>
              </View>

              {/* Botón Validar dentro del board */}
              <TouchableOpacity
                style={[styles.validateButton, !respuestasCompletas && styles.disabledButton]}
                onPress={validar}
                disabled={!respuestasCompletas}
              >
                <Text style={styles.validateButtonText}>Validar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── Overlay vida perdida ── */}
      {showMinusOverlay && !showGameOver && !showFinalSuccess && (
        <View style={styles.overlay}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text
              style={[
                styles.bigHeart,
                { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] },
              ]}
            >
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>Respuesta(s) incorrecta(s)</Text>
            <Text style={styles.modalDescSmall}>
              Perdiste una vida. Corrige los errores e intenta de nuevo.
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]}
              onPress={() => setShowMinusOverlay(false)}
            >
              <Text style={styles.modalBtnText}>Corregir</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Game Over ── */}
      {showGameOver && (
        <View style={styles.overlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Game Over</Text>
            <Text style={styles.modalDesc}>
              Te quedaste sin vidas.{"\n"}Puedes intentarlo de nuevo.
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]} onPress={resetGame}>
                <Text style={styles.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#B2B2B2" }]}
                onPress={() => router.replace(RUTA_VOLVER as any)}
              >
                <Text style={styles.modalBtnText}>Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── FINAL ÉXITO ── */}
      {showFinalSuccess && (
        <View style={styles.overlayTop}>
          <Animated.View
            style={[
              styles.alertBox,
              {
                opacity: fadeAnim,
                transform: [{
                  scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }),
                }],
              },
            ]}
          >
            <Text style={styles.scoreBig}>{finalScore}%</Text>
            <Text style={styles.alertText}>¡Excelente! Has completado el nivel social HSE 🎉</Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={async () => {
                const aprobado = finalScore >= 70;
                try {
                  const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
                  const usuarioKey = ukStr ? Number(ukStr) : null;
                  if (usuarioKey) {
                    await fetch(`${API_URL}/api/niveles/social/${NIVEL_KEY_API}/resultado`, {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ usuarioKey, puntaje: finalScore, aprobado }),
                    });
                    await AsyncStorage.multiSet([
                      [`u:${usuarioKey}:isla2_nivel4_social_done`,  "true"],
                      [`u:${usuarioKey}:isla2_nivel4_social_score`, String(finalScore)],
                      [`u:${usuarioKey}:isla2_nivel5_evaluacion_unlocked`, "true"],
                    ]);
                  }
                } catch (e) {
                  console.error("❌ Error guardando:", e);
                }
                router.replace("/HSE" as any);
              }}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>

          </Animated.View>
        </View>
      )}
    </ImageBackground>
  );
}

/* =========================================================
   ✅ ESTILOS
   ========================================================= */
const styles = StyleSheet.create({
  background: { flex: 1 },

  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: scaleDP(22),
    paddingHorizontal: scaleDP(22),
    borderRadius: scaleDP(25),
    alignItems: "center",
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 },
  },
  titulo: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(20), color: "#fff", textAlign: "center", lineHeight: scaleDP(22) },
  playButton: { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  /* Vidas */
  livesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaleDP(8),
    marginTop: scaleDP(6),
    gap: scaleDP(6),
  },
  livesHeart: { fontSize: scaleDP(26) },
  livesNumber: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(26), color: "#0F1B4C" },

  gameContainer: {
    flex: 1,
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: scaleDP(18),
    paddingTop: scaleDP(10),
    paddingBottom: scaleDP(16),
  },
  boardArea: { width: "100%", alignItems: "center" },
  board: {
    width: "100%",
    maxWidth: scaleDP(1260),
    height: scaleDP(515),
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: scaleDP(24),
    paddingVertical: scaleDP(18),
    paddingHorizontal: scaleDP(18),
    borderWidth: scaleDP(2),
    borderColor: "#D1D5DB",
    overflow: "hidden",
  },
  boardHeaderRow: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    marginBottom: scaleDP(10),
    paddingBottom: scaleDP(8),
    borderBottomWidth: scaleDP(2),
    borderBottomColor: "#D1D5DB",
  },
  boardHeaderText: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(16), color: "#0F1B4C", textAlign: "center" },

  contentRow: { flex: 1, flexDirection: "row", gap: scaleDP(12) },

  leftWrapper:  { width: "60%", flexDirection: "row", gap: scaleDP(4) },
  rightWrapper: { width: "40%", flexDirection: "row", gap: scaleDP(4) },
  leftSide:  { flex: 1 },
  rightSide: { flex: 1 },
  leftSideContent:  { paddingBottom: scaleDP(8) },
  rightSideContent: { paddingBottom: scaleDP(8) },

  scrollTrack: {
    width: scaleDP(6),
    backgroundColor: "rgba(0,0,0,0.08)",
    borderRadius: scaleDP(3),
    overflow: "hidden",
    alignSelf: "flex-start",
  },
  scrollThumb: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: "#4C92E4",
    borderRadius: scaleDP(3),
    opacity: 0.7,
  },

  caseRow: { flexDirection: "row", alignItems: "stretch", marginBottom: scaleDP(10), gap: scaleDP(8) },

  selectorBox: {
    width: scaleDP(68),
    minHeight: scaleDP(86),
    borderWidth: scaleDP(2),
    borderRadius: scaleDP(10),
    alignItems: "center",
    justifyContent: "center",
  },
  selectorValue: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(30) },
  selectorEmptyContent: { alignItems: "center", gap: scaleDP(2) },
  selectorPlaceholder: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(22), color: "#9CA3AF" },
  selectorArrow: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(10), color: "#9CA3AF" },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  pickerContainer: {
    backgroundColor: "#fff",
    borderRadius: scaleDP(20),
    paddingVertical: scaleDP(20),
    paddingHorizontal: scaleDP(24),
    minWidth: scaleDP(320),
    alignItems: "center",
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  pickerTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#0F1B4C", marginBottom: scaleDP(16) },
  pickerGrid: { flexDirection: "row", flexWrap: "wrap", gap: scaleDP(10), justifyContent: "center" },
  pickerOption: {
    width: scaleDP(64),
    height: scaleDP(64),
    borderRadius: scaleDP(12),
    borderWidth: scaleDP(2),
    borderColor: "#D1D5DB",
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  pickerOptionSelected: { borderColor: "#4C92E4", backgroundColor: "#E0EDFF" },
  pickerOptionText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(26), color: "#374151" },
  pickerOptionTextSelected: { color: "#1D4ED8" },

  caseCard: {
    flex: 1,
    backgroundColor: "#EAF5F7",
    borderWidth: scaleDP(2),
    borderColor: "#0F1B4C",
    borderRadius: scaleDP(12),
    paddingVertical: scaleDP(12),
    paddingHorizontal: scaleDP(14),
    justifyContent: "center",
  },
  caseTitle: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(13), color: "#111827", marginBottom: scaleDP(6) },
  caseText: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(13), color: "#111827", lineHeight: scaleDP(15), textAlign: "justify" },
  caseFeedback: { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14) },
  feedbackCorrecto: { color: "#16A34A" },
  feedbackIncorrecto: { color: "#DC2626" },

  solutionCard: {
    width: "100%",
    backgroundColor: "#F3F4F6",
    borderWidth: scaleDP(2),
    borderColor: "#9CA3AF",
    borderRadius: scaleDP(10),
    paddingVertical: scaleDP(10),
    paddingHorizontal: scaleDP(12),
    marginBottom: scaleDP(8),
  },
  solutionText: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(13), color: "#111827", lineHeight: scaleDP(15) },

  validateButton: {
    marginTop: scaleDP(10),
    alignSelf: "center",
    backgroundColor: "#4C92E4",
    paddingVertical: scaleDP(12),
    paddingHorizontal: scaleDP(30),
    borderRadius: scaleDP(12),
  },
  validateButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },
  disabledButton: { opacity: 0.5 },

  /* ── Bottom bar: solo dos botones ── */
  bottomBar: {
    marginTop: scaleDP(16),
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: scaleDP(14),
  },
  bottomSideButton: {
    flex: 1,
    minHeight: scaleDP(72),
    paddingVertical: scaleDP(12),
    paddingHorizontal: scaleDP(18),
    borderRadius: scaleDP(12),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(28), textAlign: "center" },

  /* Overlays */
  overlay: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: scaleDP(24),
  },
  overlayTop: {
    position: "absolute",
    top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    elevation: 9999,
  },

  modalBoxSmall: {
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    paddingVertical: scaleDP(16),
    paddingHorizontal: scaleDP(20),
    alignItems: "center",
    elevation: 8,
    maxWidth: "80%",
  },
  bigHeart: { fontSize: scaleDP(50) },
  minusOneText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#DC2626", marginBottom: scaleDP(6) },
  modalDescSmall: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(18), color: "#111827", textAlign: "center" },

  modalBox: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    paddingVertical: scaleDP(20),
    paddingHorizontal: scaleDP(18),
    alignItems: "center",
    elevation: 8,
  },
  modalTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(46), color: "#0F1B4C", textAlign: "center" },
  modalDesc: { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(24), color: "#111827", textAlign: "center" },
  modalRow: { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn: { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10), minWidth: scaleDP(200), alignItems: "center" },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(28) },

  alertBox: {
    backgroundColor: "#77b479",
    paddingVertical: scaleDP(22),
    paddingHorizontal: scaleDP(35),
    borderRadius: scaleDP(20),
    elevation: 20,
    maxWidth: "85%",
    alignItems: "center",
  },
  scoreBig: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(100), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(34), textAlign: "center" },
  finalInfoBox: { marginTop: scaleDP(18), alignItems: "center" },
  finalInfoText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(18), textAlign: "center", marginTop: scaleDP(4) },
});