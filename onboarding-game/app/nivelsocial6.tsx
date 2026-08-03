import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { scaleDP } from "./scale";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
========================================================= */
const fondo       = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/Metrologia";
const API_URL     = API_BASE_URL;
const ISLA_KEY        = 6;
const NIVEL_KEY_API   = 29;
const NIVEL_KEY_PROG  = 39;
const MAX_LIVES       = 3;

function scoreFromLives(lives: number): number {
  if (lives >= 3) return 100;
  if (lives === 2) return 90;
  if (lives === 1) return 80;
  return 70;
}

/* =========================================================
   TIPOS
========================================================= */
type CasoBase = {
  id: number;
  titulo: string;
  texto: string;
  opciones: string[];
  correcta: number;
};

type CasoMezclado = {
  id: number;
  titulo: string;
  texto: string;
  opciones: string[];
  correcta: number;
};

function mezclarOpciones(caso: CasoBase): CasoMezclado {
  const textoCorrect = caso.opciones[caso.correcta];
  const indices = [0, 1, 2];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  const opcionesMezcladas = indices.map((i) => caso.opciones[i]);
  return {
    id:       caso.id,
    titulo:   caso.titulo,
    texto:    caso.texto,
    opciones: opcionesMezcladas,
    correcta: opcionesMezcladas.indexOf(textoCorrect),
  };
}

/* =========================================================
   5 CASOS — Metrología
========================================================= */
const casosDefault: CasoBase[] = [
  {
    id: 1,
    titulo: "Caso 1: Verificación de espesor",
    texto:
      "Eres operario en la línea de producción. Te llega un lite y en la orden de fabricación indica que debe tener un espesor de 8 mm. Tu supervisor te indica que debes realizar 3 mediciones en puntos diferentes del vidrio para validar que cumple con la especificación antes de continuar al siguiente proceso. ¿Cuál es el instrumento que debes utilizar?",
    opciones: [
      "Flexómetro, ya que es el instrumento estándar para medir en planta",
      "Micrómetro, porque es el instrumento diseñado para medir espesores con alta precisión",
      "Vacuómetro, porque permite validar dimensiones con presión",
    ],
    correcta: 1,
  },
  {
    id: 2,
    titulo: "Caso 2: Auditoría de instrumentos",
    texto:
      "Estás trabajando en tu puesto cuando el auditor de procesos se acerca y te solicita que le entregues el multímetro que estás utilizando. El auditor lo revisa detenidamente y te informa que el instrumento no puede seguir siendo utilizado. ¿Qué fue lo que le permitió al auditor identificar que el multímetro no estaba en condiciones de uso?",
    opciones: [
      "El instrumento estaba sucio y con la pantalla rayada",
      "El instrumento no tenía batería suficiente para operar",
      "El Control Metrológico, que es el sistema que certifica que los instrumentos están calibrados y aptos para medir",
    ],
    correcta: 2,
  },
  {
    id: 3,
    titulo: "Caso 3: Control de vacío en embolsado",
    texto:
      "Te encuentras en el proceso de embolsado y tu responsabilidad es garantizar que cada pieza tenga el nivel de vacío correcto antes de que avance al siguiente proceso. La ficha técnica especifica que el nivel debe estar aproximadamente en -20 InHg. ¿Qué instrumento utilizas para verificar esta medición?",
    opciones: [
      "Calibrador digital, porque mide la presión interna del embolsado",
      "Vacuómetro, porque es el instrumento específico para medir niveles de vacío",
      "Micrómetro, porque permite medir variaciones en capas delgadas",
    ],
    correcta: 1,
  },
  {
    id: 4,
    titulo: "Caso 4: Medición de pieza de gran tamaño",
    texto:
      "Recibes en tu puesto un parabrisas que según la ficha técnica debe medir 1.450 mm de ancho. Antes de que la pieza avance en el proceso, debes confirmar que cumple con esa dimensión. Un compañero te sugiere usar el calibrador digital porque es el más preciso. ¿Qué haces?",
    opciones: [
      "Usas el calibrador digital porque tu compañero tiene razón",
      "Usas el micrómetro porque tiene mayor rango de medición",
      "Usas el Flexómetro, porque es el instrumento adecuado para mediciones superiores a 300 mm",
    ],
    correcta: 2,
  },
  {
    id: 5,
    titulo: "Caso 5: Medición de profundidad en molde",
    texto:
      "Durante tu turno, el supervisor te pide que verifiques la profundidad de un canal en un molde de curvado. Los planos indican que debe tener exactamente 12 mm de profundidad. Tienes a la mano varios instrumentos. ¿Cuál es el correcto para esta tarea?",
    opciones: [
      "Flexómetro, porque es el más utilizado para todo tipo de mediciones",
      "Micrómetro, porque es el más preciso del área",
      "Profundímetro, porque es el instrumento diseñado específicamente para medir profundidades",
    ],
    correcta: 2,
  },
];

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function NivelSocialMetrologia() {
  const router = useRouter();

  /* ── Usuario ── */
  const [usuarioKey,    setUsuarioKey]    = useState<number | null>(null);
  const [savedScore,    setSavedScore]    = useState<number | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem("USUARIO_KEY");
      const uk     = stored ? Number(stored) : null;
      if (uk && uk > 0) {
        setUsuarioKey(uk);
        const doneKey  = `u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_done`;
        const scoreKey = `u:${uk}:isla${NIVEL_KEY_PROG}_social_score`;
        const done  = await AsyncStorage.getItem(doneKey);
        const score = await AsyncStorage.getItem(scoreKey);
        if (done === "true" && score) {
          setAlreadyPlayed(true);
          setSavedScore(Number(score));
        }
      }
    };
    init();
  }, []);

  /* ── Casos ── */
  const [casos, setCasos] = useState<CasoMezclado[]>([]);

  /* ── Vidas ── */
  const [lives,            setLives]            = useState(MAX_LIVES);
  const [showGameOver,     setShowGameOver]     = useState(false);
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
    minusScale.setValue(0.6); minusOpacity.setValue(0); minusShake.setValue(0);
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
        Animated.timing(minusShake, { toValue: 1,  duration: 70,  useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: -1, duration: 70,  useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: 1,  duration: 70,  useNativeDriver: true }),
        Animated.timing(minusShake, { toValue: 0,  duration: 70,  useNativeDriver: true }),
      ]),
    ]).start();
  };

  const shakeX = minusShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  /* ── Pantallas ── */
  const [showIntro,        setShowIntro]        = useState(true);
  const [showGame,         setShowGame]         = useState(false);
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* ── Respuestas ── */
  const [respuestasUsuario, setRespuestasUsuario] = useState<Record<number, number | null>>({});
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [errores,           setErrores]           = useState(0);

  /* ── Iniciar juego ── */
  const startGame = () => {
    const mezclados = casosDefault.map((c) => mezclarOpciones(c));
    setCasos(mezclados);
    const init: Record<number, number | null> = {};
    mezclados.forEach((c) => { init[c.id] = null; });
    setRespuestasUsuario(init);
    setShowIntro(false);
    setShowGame(true);
  };

  const seleccionarRespuesta = (casoId: number, opcionIndex: number) => {
    const caso = casos.find((c) => c.id === casoId);
    if (!caso) return;
    if (mostrarResultados && respuestasUsuario[casoId] === caso.correcta) return;
    setMostrarResultados(false);
    setRespuestasUsuario((prev) => ({ ...prev, [casoId]: opcionIndex }));
  };

  const respuestasCompletas = useMemo(
    () => casos.every((c) => respuestasUsuario[c.id] !== null && respuestasUsuario[c.id] !== undefined),
    [respuestasUsuario, casos]
  );

  const correctas = useMemo(
    () => casos.reduce((acc, c) => acc + (respuestasUsuario[c.id] === c.correcta ? 1 : 0), 0),
    [respuestasUsuario, casos]
  );

  /* ── Validar ── */
  const validar = () => {
    const hayIncorrectas = casos.some((c) => respuestasUsuario[c.id] !== c.correcta);
    setMostrarResultados(true);

    if (!hayIncorrectas) {
      const score = scoreFromLives(lives);
      guardarProgreso(score);
      setShowFinalSuccess(true);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      return;
    }

    const nuevasVidas = Math.max(0, lives - 1);
    setLives(nuevasVidas);
    setErrores((prev) => prev + 1);
    animateHeart();
    playMinusAnim();

    if (nuevasVidas <= 0) {
      setShowGameOver(true);
    } else {
      setShowMinusOverlay(true);
    }
  };

  /* ── Guardar progreso ── */
  const guardarProgreso = async (score: number) => {
    try {
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const uk    = Number(ukStr);
      if (!uk || !Number.isFinite(uk)) return;
      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel40_evaluacion_unlocked`,         "true"],
      ]);
      await fetch(`${API_URL}/api/niveles/social/${NIVEL_KEY_API}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey: uk, puntaje: score,
          aprobado: score >= 70 ? 1 : 0,
          islaKey: ISLA_KEY, nivelKey: NIVEL_KEY_PROG,
        }),
      });
    } catch (e) { console.error("Error guardando social metrologia:", e); }
  };

  /* ── Reset ── */
  const resetGame = () => {
    const mezclados = casosDefault.map((c) => mezclarOpciones(c));
    setCasos(mezclados);
    const init: Record<number, number | null> = {};
    mezclados.forEach((c) => { init[c.id] = null; });
    setRespuestasUsuario(init);
    setErrores(0); setLives(MAX_LIVES);
    setMostrarResultados(false); setShowFinalSuccess(false);
    setShowGameOver(false); setShowMinusOverlay(false);
    fadeAnim.setValue(0);
  };

  /* ── Scrollbar ── */
  const scrollY   = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [contentH, setContentH] = useState(1);
  const [scrollH,  setScrollH]  = useState(1);
  const TRACK_H = scaleDP(500);
  const thumbH  = Math.max(scaleDP(40), scrollH > 0 ? (scrollH / Math.max(contentH, 1)) * TRACK_H : TRACK_H);
  const thumbTop = scrollH > 0
    ? scrollY.interpolate({ inputRange: [0, Math.max(contentH - scrollH, 1)], outputRange: [0, TRACK_H - thumbH], extrapolate: "clamp" })
    : new Animated.Value(0);

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* ── Ya jugado ── */}
      {alreadyPlayed && savedScore !== null && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Social – Metrología</Text>
            <Text style={styles.alertText}>¡Ya has completado este nivel!</Text>
            <Text style={styles.scoreBig}>{savedScore}%</Text>
            <TouchableOpacity style={[styles.playButton, { backgroundColor: "#10B981" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
              <Text style={styles.playButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── INTRO ── */}
      {!alreadyPlayed && showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Social – Metrología</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás analizar 5 situaciones reales del proceso de metrología en planta.{"\n\n"}
              Cada caso describe una situación específica y deberás seleccionar el instrumento o la acción correcta según los conceptos aprendidos.{"\n\n"}
              Lee cuidadosamente cada caso y valida tus respuestas al final. Tienes{" "}
              <Text style={{ fontWeight: "900" }}>3 vidas ❤️</Text>.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── JUEGO ── */}
      {!alreadyPlayed && showGame && (
        <View style={styles.gameContainer}>

          {/* Vidas */}
          <Animated.View style={[styles.livesContainer, { transform: [{ scale: heartScale }] }]}>
            <Text style={styles.livesHeart}>❤️</Text>
            <Text style={styles.livesNumber}>{lives}</Text>
          </Animated.View>

          <View style={styles.boardArea}>
            <View style={styles.board}>
              <View style={styles.contentRow}>
                <ScrollView
                  ref={scrollRef}
                  style={styles.scrollArea}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  scrollEventThrottle={16}
                  onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
                    { useNativeDriver: false }
                  )}
                  onContentSizeChange={(_, h) => setContentH(h)}
                  onLayout={(e) => setScrollH(e.nativeEvent.layout.height)}
                >
                  {casos.map((caso) => {
                    const respuestaUsuario = respuestasUsuario[caso.id];
                    const yaCorrecta = mostrarResultados && respuestaUsuario === caso.correcta;

                    return (
                      <View key={caso.id} style={styles.caseCard}>
                        <Text style={styles.caseTitle}>{caso.titulo}</Text>
                        <Text style={styles.caseText}>{caso.texto}</Text>

                        <View style={styles.optionsContainer}>
                          {caso.opciones.map((opcion, index) => {
                            const seleccionada = respuestaUsuario === index;
                            let opcionStyle: any = styles.optionButton;
                            let textoStyle: any  = styles.optionText;

                            if (mostrarResultados) {
                              if (seleccionada && index === caso.correcta) {
                                opcionStyle = [styles.optionButton, styles.optionCorrect];
                                textoStyle  = [styles.optionText, styles.optionTextSelected];
                              } else if (seleccionada && index !== caso.correcta) {
                                opcionStyle = [styles.optionButton, styles.optionIncorrect];
                                textoStyle  = [styles.optionText, styles.optionTextSelected];
                              }
                            } else if (seleccionada) {
                              opcionStyle = [styles.optionButton, styles.optionSelected];
                              textoStyle  = [styles.optionText, styles.optionTextSelected];
                            }

                            return (
                              <TouchableOpacity
                                key={index}
                                style={opcionStyle}
                                onPress={() => seleccionarRespuesta(caso.id, index)}
                                activeOpacity={0.85}
                                disabled={yaCorrecta}
                              >
                                <Text style={textoStyle}>{opcion}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>

                        {mostrarResultados && (
                          <Text style={[styles.caseFeedback, respuestaUsuario === caso.correcta ? styles.feedbackCorrecto : styles.feedbackIncorrecto]}>
                            {respuestaUsuario === caso.correcta ? "✓ Correcto" : "✗ Incorrecto"}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                {contentH > scrollH && (
                  <View style={[styles.scrollTrack, { height: TRACK_H }]}>
                    <Animated.View style={[styles.scrollThumb, { height: thumbH, top: thumbTop }]} />
                  </View>
                )}
              </View>
            </View>
          </View>

          {/* Barra inferior */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={[styles.bottomSideButton, { backgroundColor: "#B2B2B2" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomSideButton, { backgroundColor: "#4C92E4" }, !respuestasCompletas && styles.disabledButton]}
              onPress={validar}
              disabled={!respuestasCompletas}
            >
              <Text style={styles.buttonText}>Validar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Overlay vida perdida ── */}
      {showMinusOverlay && !showGameOver && !showFinalSuccess && (
        <View style={styles.overlay}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>Respuesta(s) incorrecta(s)</Text>
            <Text style={styles.modalDescSmall}>Perdiste una vida. Corrige los errores e intenta de nuevo.</Text>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]} onPress={() => setShowMinusOverlay(false)}>
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
            <Text style={styles.modalDesc}>Te quedaste sin vidas.{"\n"}Puedes intentarlo de nuevo.</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]} onPress={resetGame}>
                <Text style={styles.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#B2B2B2" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                <Text style={styles.modalBtnText}>Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ── FINAL ÉXITO ── */}
      {showFinalSuccess && (
        <View style={styles.overlayTop}>
          <Animated.View style={[styles.alertBox, {
            opacity: fadeAnim,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }]}>
            <Text style={styles.scoreBig}>{scoreFromLives(lives)}%</Text>
            <Text style={styles.alertText}>¡Excelente! Has completado el nivel social 🎉</Text>
            <View style={styles.finalInfoBox}>
              <Text style={styles.finalInfoText}>Respuestas correctas: {correctas}/{casos.length}</Text>
              <Text style={styles.finalInfoText}>Errores cometidos: {errores}</Text>
            </View>
            <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS — idénticos al código guía
========================================================= */
const styles = StyleSheet.create({
  background: { flex: 1 },

  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(22),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  titulo:         { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion:    { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton:     { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  livesContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: scaleDP(8), marginTop: scaleDP(6), gap: scaleDP(6) },
  livesHeart:     { fontSize: scaleDP(26) },
  livesNumber:    { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(26), color: "#0F1B4C" },

  gameContainer: { flex: 1, justifyContent: "flex-start", alignItems: "center", paddingHorizontal: scaleDP(18), paddingTop: scaleDP(10), paddingBottom: scaleDP(16) },
  boardArea:     { width: "100%", alignItems: "center" },
  board: {
    width: "100%", maxWidth: scaleDP(1260), height: scaleDP(430),
    backgroundColor: "rgba(255,255,255,0.90)", borderRadius: scaleDP(24),
    paddingTop: scaleDP(14), paddingBottom: scaleDP(12), paddingHorizontal: scaleDP(18),
    borderWidth: scaleDP(2), borderColor: "#D1D5DB", overflow: "hidden",
  },
  contentRow: { flex: 1, flexDirection: "row", gap: scaleDP(6) },

  scrollTrack: { width: scaleDP(6), backgroundColor: "rgba(0,0,0,0.08)", borderRadius: scaleDP(3), overflow: "hidden", alignSelf: "flex-start" },
  scrollThumb: { position: "absolute", left: 0, right: 0, backgroundColor: "#4C92E4", borderRadius: scaleDP(3), opacity: 0.7 },
  scrollArea:    { flex: 1 },
  scrollContent: { paddingBottom: scaleDP(8) },

  caseCard: {
    width: "100%", backgroundColor: "#EAF5F7",
    borderWidth: scaleDP(2), borderColor: "#0F1B4C",
    borderRadius: scaleDP(12), paddingVertical: scaleDP(14),
    paddingHorizontal: scaleDP(16), marginBottom: scaleDP(12),
  },
  caseTitle: { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(15), color: "#111827", marginBottom: scaleDP(1) },
  caseText:  { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(14), color: "#111827", lineHeight: scaleDP(17), textAlign: "justify", marginBottom: scaleDP(12) },

  optionsContainer: { gap: scaleDP(2) },
  optionButton: { backgroundColor: "#F3F4F6", borderWidth: scaleDP(2), borderColor: "#9CA3AF", borderRadius: scaleDP(10), paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(12) },
  optionSelected:  { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },
  optionCorrect:   { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  optionIncorrect: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  optionText:         { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(14), color: "#111827", lineHeight: scaleDP(20) },
  optionTextSelected: { color: "#fff", fontFamily: "PlusJakartaSans-Bold" },

  caseFeedback:       { marginTop: scaleDP(10), fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },
  feedbackCorrecto:   { color: "#16A34A" },
  feedbackIncorrecto: { color: "#DC2626" },
  disabledButton:     { opacity: 0.5 },

  bottomBar: { marginTop: scaleDP(5), width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scaleDP(14) },
  bottomSideButton: { minWidth: scaleDP(200), minHeight: scaleDP(60), paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(12), alignItems: "center", justifyContent: "center" },
  buttonText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(18), textAlign: "center" },

  overlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(24) },
  overlayTop: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 9999, elevation: 9999 },

  modalBoxSmall: { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(16), paddingHorizontal: scaleDP(20), alignItems: "center", elevation: 8, maxWidth: "80%" },
  bigHeart:       { fontSize: scaleDP(50) },
  minusOneText:   { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#DC2626", marginBottom: scaleDP(6) },
  modalDescSmall: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(18), color: "#111827", textAlign: "center" },

  modalBox: { width: "92%", backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(18), alignItems: "center", elevation: 8 },
  modalTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(46), color: "#0F1B4C", textAlign: "center" },
  modalDesc:  { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(24), color: "#111827", textAlign: "center" },
  modalRow:   { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn:   { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10), minWidth: scaleDP(200), alignItems: "center" },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(28) },

  alertBox: { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 20, maxWidth: "85%", alignItems: "center" },
  scoreBig:  { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(100), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(34), textAlign: "center" },
  finalInfoBox:  { marginTop: scaleDP(14), alignItems: "center" },
  finalInfoText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(18), textAlign: "center", marginTop: scaleDP(4) },
});