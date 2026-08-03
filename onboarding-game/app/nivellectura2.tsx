import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
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
const NIVEL_KEY_API = 7;
const ISLA_KEY = 2;

/* =========================================================
   ✅ CONFIGURACIÓN DE VIDAS
   5 vidas → 100%
   4 vidas → 95%
   3 vidas → 90%
   2 vidas → 85%
   1 vida  → 80%
   0 vidas → 75% (game over, no aprobado)
   ========================================================= */
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
   ✅ TIPOS
   ========================================================= */
type Concepto = "RIESGO" | "PELIGRO";
type DropRect = { x: number; y: number; width: number; height: number };
type RespuestaVF = { [id: number]: boolean | null };

/* =========================================================
   ✅ DATA
   ========================================================= */
const preguntasModulo1 = [
  { id: 1, texto: "Los pictogramas de seguridad son símbolos visuales estandarizados que permiten identificar rápidamente el tipo de peligro que puede presentar una sustancia química, ayudando a prevenir accidentes y daños a la salud.", respuesta: true },
  { id: 2, texto: "Los productos químicos pueden utilizarse sin etiqueta de seguridad siempre y cuando el trabajador tenga experiencia y conozca el proceso, ya que los pictogramas no son obligatorios.", respuesta: false },
  { id: 3, texto: "El pictograma que muestra una silueta humana con una estrella en el pecho advierte sobre riesgos graves para la salud a largo plazo, como enfermedades respiratorias, daños a órganos o incluso cáncer.", respuesta: true },
  { id: 4, texto: "Una condición insegura depende únicamente del comportamiento del trabajador, mientras que un acto inseguro está relacionado con el estado de las máquinas, herramientas o el entorno físico.", respuesta: false },
];

const frasesModulo2 = [
  { id: 1, texto: "Se relaciona con la probabilidad de que ocurra un evento no deseado, en el cual una persona, proceso o equipo pueda sufrir pérdida u otras consecuencias negativas.", respuesta: "RIESGO" as Concepto },
  { id: 2, texto: "Se reconoce como cualquier fuente, condición o situación con capacidad de generar daño, expresado como lesión, enfermedad, afectación a la propiedad, impacto ambiental o una combinación de estos.", respuesta: "PELIGRO" as Concepto },
];

const TOTAL_MODULOS = 2;

/* =========================================================
   ✅ COMPONENTE
   ========================================================= */
export default function NivelLecturaHSE() {
  const router = useRouter();

  const [showIntro,          setShowIntro]          = useState(true);
  const [showGame,           setShowGame]            = useState(false);
  const [showModuleSplash,   setShowModuleSplash]    = useState(false);
  const [showBoard,          setShowBoard]           = useState(false);
  const [currentModuleIndex, setCurrentModuleIndex]  = useState(0);
  const [showModuleComplete, setShowModuleComplete]  = useState(false);
  const [showFinalSuccess,   setShowFinalSuccess]    = useState(false);

  const fadeAnim = useState(new Animated.Value(0))[0];

  const [respuestasVF, setRespuestasVF] = useState<RespuestaVF>({ 1: null, 2: null, 3: null, 4: null });
  const [feedbackVF,   setFeedbackVF]   = useState<Record<number, "correcto" | "incorrecto" | null>>({ 1: null, 2: null, 3: null, 4: null });
  const [respuestas,   setRespuestas]   = useState<Record<number, Concepto | null>>({ 1: null, 2: null });

  const riesgoPan    = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const peligroPan   = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const dropRefs     = useRef<Record<number, View | null>>({});
  const dropRectsRef = useRef<Record<number, DropRect>>({});

  const [mistakes,     setMistakes]     = useState(0);
  const [lives,        setLives]        = useState<number>(MAX_LIVES);
  const [showGameOver, setShowGameOver] = useState(false);
  const [showTryAgain, setShowTryAgain] = useState(false);

  // ── Animación -1 vida ────────────────────────────────────────────────────
  const breakScale   = useRef(new Animated.Value(0.6)).current;
  const breakOpacity = useRef(new Animated.Value(0)).current;
  const breakShake   = useRef(new Animated.Value(0)).current;

  const playRetryAnim = () => {
    breakScale.setValue(0.6);
    breakOpacity.setValue(0);
    breakShake.setValue(0);
    Vibration.vibrate(120);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(breakOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(breakOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(breakScale, { toValue: 1.25, duration: 220, useNativeDriver: true }),
        Animated.timing(breakScale, { toValue: 1,    duration: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(breakShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: 0,  duration: 70, useNativeDriver: true }),
      ]),
    ]).start();
  };

  useEffect(() => {
    if (showTryAgain) {
      playRetryAnim();
      const t = setTimeout(() => setShowTryAgain(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showTryAgain]);

  const shakeX = breakShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  const loseLife = () => {
    const newLives = Math.max(0, lives - 1);
    setLives(newLives);
    if (newLives <= 0) {
      setShowGameOver(true);
    } else {
      setShowTryAgain(true);
    }
  };

  const resetGame = () => {
    setLives(MAX_LIVES);
    setMistakes(0);
    setShowGameOver(false);
    setShowTryAgain(false);
    setRespuestasVF({ 1: null, 2: null, 3: null, 4: null });
    setFeedbackVF({ 1: null, 2: null, 3: null, 4: null });
    setRespuestas({ 1: null, 2: null });
    riesgoPan.setValue({ x: 0, y: 0 });
    peligroPan.setValue({ x: 0, y: 0 });
  };

  const respuestasCompletasModulo1 = useMemo(
    () => preguntasModulo1.every((p) => respuestasVF[p.id] !== null),
    [respuestasVF]
  );

  /* =========================================================
     ✅ PREPARAR MÓDULO
     ========================================================= */
  useEffect(() => {
    if (!showGame) return;
    setShowBoard(false);
    setShowModuleSplash(true);
    const timer = setTimeout(() => { setShowModuleSplash(false); setShowBoard(true); }, 1400);
    return () => clearTimeout(timer);
  }, [currentModuleIndex, showGame]);

  useEffect(() => {
    if (showBoard && currentModuleIndex === 1) {
      const t = setTimeout(() => { medirTodasLasDropZones(); }, 350);
      return () => clearTimeout(t);
    }
  }, [showBoard, currentModuleIndex]);

  useEffect(() => {
    if (currentModuleIndex === 0 && respuestasCompletasModulo1) {
      const t = setTimeout(() => {
        setShowModuleComplete(true);
        setTimeout(() => { setShowModuleComplete(false); setCurrentModuleIndex(1); }, 1200);
      }, 500);
      return () => clearTimeout(t);
    }
  }, [respuestasCompletasModulo1, currentModuleIndex]);

  const startGame = () => {
    setShowIntro(false);
    setShowGame(true);
    setShowBoard(false);
    setShowModuleSplash(true);
    setTimeout(() => { setShowModuleSplash(false); setShowBoard(true); }, 1400);
  };

  const tituloModuloActual = currentModuleIndex === 0 ? "Módulo 1" : "Módulo 2";

  /* =========================================================
     ✅ MÓDULO 1 LOGIC
     ========================================================= */
  const responderVF = (preguntaId: number, valor: boolean) => {
    if (currentModuleIndex !== 0 || respuestasVF[preguntaId] !== null) return;
    const pregunta = preguntasModulo1.find((p) => p.id === preguntaId);
    if (!pregunta) return;
    const esCorrecta = valor === pregunta.respuesta;
    setRespuestasVF((prev) => ({ ...prev, [preguntaId]: valor }));
    setFeedbackVF((prev)   => ({ ...prev, [preguntaId]: esCorrecta ? "correcto" : "incorrecto" }));
    if (!esCorrecta) { setMistakes((prev) => prev + 1); loseLife(); }
  };

  /* =========================================================
     ✅ MÓDULO 2 LOGIC
     ========================================================= */
  const setDropRef = (id: number, ref: View | null) => { dropRefs.current[id] = ref; };

  const medirDropZone = (id: number) => {
    const ref = dropRefs.current[id];
    if (!ref || typeof ref.measureInWindow !== "function") return;
    ref.measureInWindow((x, y, width, height) => { dropRectsRef.current[id] = { x, y, width, height }; });
  };

  const medirTodasLasDropZones = () => { frasesModulo2.forEach((frase) => medirDropZone(frase.id)); };

  const conceptoUsado = (concepto: Concepto) => respuestas[1] === concepto || respuestas[2] === concepto;

  const resetConceptPosition = (concepto: Concepto) => {
    const pan = concepto === "RIESGO" ? riesgoPan : peligroPan;
    Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
  };

  const detectarDrop = (moveX: number, moveY: number): number | null => {
    for (const key of Object.keys(dropRectsRef.current)) {
      const id   = Number(key);
      const zone = dropRectsRef.current[id];
      if (!zone) continue;
      if (moveX >= zone.x && moveX <= zone.x + zone.width && moveY >= zone.y && moveY <= zone.y + zone.height) return id;
    }
    return null;
  };

  const soltarConcepto = (concepto: Concepto, moveX: number, moveY: number) => {
    const zona = detectarDrop(moveX, moveY);
    if (!zona) { resetConceptPosition(concepto); return; }
    const yaEstaba = respuestas[zona];
    const nuevas   = { ...respuestas };
    Object.keys(nuevas).forEach((k) => { const id = Number(k); if (nuevas[id] === concepto) nuevas[id] = null; });
    if (yaEstaba && yaEstaba !== concepto) { setMistakes((prev) => prev + 1); loseLife(); }
    nuevas[zona] = concepto;
    setRespuestas(nuevas);
    resetConceptPosition(concepto);
  };

  const quitarAsignacion = (fraseId: number) => {
    if (!respuestas[fraseId]) return;
    setRespuestas((prev) => ({ ...prev, [fraseId]: null }));
  };

  const crearResponder = (concepto: Concepto, pan: Animated.ValueXY) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => currentModuleIndex === 1 && !conceptoUsado(concepto),
      onMoveShouldSetPanResponder:  () => currentModuleIndex === 1 && !conceptoUsado(concepto),
      onPanResponderGrant:          () => { medirTodasLasDropZones(); },
      onPanResponderMove:    Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
      onPanResponderRelease: (_, gesture) => { soltarConcepto(concepto, gesture.moveX, gesture.moveY); },
      onPanResponderTerminate: () => { resetConceptPosition(concepto); },
    });

  const riesgoResponder  = useMemo(() => crearResponder("RIESGO",  riesgoPan),  [respuestas, currentModuleIndex]);
  const peligroResponder = useMemo(() => crearResponder("PELIGRO", peligroPan), [respuestas, currentModuleIndex]);

  const modulo2Completo = respuestas[1] !== null && respuestas[2] !== null;

  const validarModulo2 = () => {
    if (respuestas[1] === frasesModulo2[0].respuesta && respuestas[2] === frasesModulo2[1].respuesta) {
      setShowFinalSuccess(true);
      Animated.timing(fadeAnim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
    } else {
      setMistakes((prev) => prev + 1);
      loseLife();
    }
  };

  /* =========================================================
     ✅ RESETS
     ========================================================= */
  const resetCurrentModule = () => {
    if (currentModuleIndex === 0) {
      setRespuestasVF({ 1: null, 2: null, 3: null, 4: null });
      setFeedbackVF({ 1: null, 2: null, 3: null, 4: null });
    } else {
      setRespuestas({ 1: null, 2: null });
      riesgoPan.setValue({ x: 0, y: 0 });
      peligroPan.setValue({ x: 0, y: 0 });
      dropRectsRef.current = {};
      setTimeout(() => { medirTodasLasDropZones(); }, 250);
    }
  };

  const resetAll = () => {
    setCurrentModuleIndex(0);
    setRespuestasVF({ 1: null, 2: null, 3: null, 4: null });
    setFeedbackVF({ 1: null, 2: null, 3: null, 4: null });
    setRespuestas({ 1: null, 2: null });
    riesgoPan.setValue({ x: 0, y: 0 });
    peligroPan.setValue({ x: 0, y: 0 });
    dropRectsRef.current = {};
    setMistakes(0);
    setLives(MAX_LIVES);
    setShowTryAgain(false);
    setShowModuleComplete(false);
    setShowFinalSuccess(false);
    fadeAnim.setValue(0);
    setShowIntro(true);
    setShowGame(false);
    setShowModuleSplash(false);
    setShowBoard(false);
  };

  /* =========================================================
     ✅ GUARDAR RESULTADO
     ========================================================= */
  const guardarYContinuar = async (livesLeft: number) => {
    const finalScore = scoreFromLives(livesLeft);
    const aprobado   = finalScore >= 80;
    try {
      const ukStr      = await AsyncStorage.getItem("USUARIO_KEY");
      const usuarioKey = ukStr ? Number(ukStr) : null;
      if (usuarioKey) {
        await fetch(`${API_URL}/api/niveles/lectura/${NIVEL_KEY_API}/resultado`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ usuarioKey, puntaje: finalScore, aprobado, mismatches: mistakes, livesLeft }),
        });
        await AsyncStorage.multiSet([
          [`u:${usuarioKey}:isla2_nivel2_lectura_done`,        "true"],
          [`u:${usuarioKey}:isla2_nivel2_lectura_score`,       String(finalScore)],
          [`u:${usuarioKey}:isla2_nivel3_recordemos_unlocked`, "true"],
        ]);
        console.log("✅ Lectura HSE guardado:", finalScore);
      }
    } catch (e) {
      console.error("❌ Error guardando:", e);
    }
    router.replace("/HSE" as any);
  };

  /* =========================================================
     ✅ RENDER
     ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* ══════════ INTRO ══════════ */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Lectura – HSE</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás leer atentamente la información de seguridad y responder correctamente cada actividad.{"\n\n"}
              En el módulo 1 seleccionarás verdadero o falso según cada afirmación.{"\n\n"}
              En el módulo 2 deberás arrastrar cada concepto al cuadro correspondiente.{"\n\n"}
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════ JUEGO ══════════ */}
      {showGame && (
        <View style={styles.gameContainer}>
          {showModuleSplash && (
            <View style={styles.moduleSplashBox}>
              <Text style={styles.moduleSplashText}>{tituloModuloActual}</Text>
            </View>
          )}

          {showBoard && (
            <>
              {/* ══ VIDAS EN ESQUINA ══ */}
              <View style={styles.livesCorner}>
                <Text style={styles.heartIcon2}>❤️</Text>
                <Text style={styles.livesCountText}>{lives}</Text>
              </View>

              <View style={styles.boardArea}>
                <TouchableOpacity
                  style={[styles.sideButton, styles.sideButtonCompact, { backgroundColor: "#B2B2B2" }]}
                  onPress={() => router.replace(RUTA_VOLVER as any)}
                >
                  <Text style={styles.buttonText}>Volver</Text>
                </TouchableOpacity>

                <View style={styles.board}>
                  {/* ── Módulo 1 ── */}
                  {currentModuleIndex === 0 && (
                    <View style={styles.modulo1Container}>
                      <ScrollView style={styles.scrollModulo1} contentContainerStyle={styles.scrollModulo1Content} showsVerticalScrollIndicator={false}>
                        {preguntasModulo1.map((pregunta, index) => {
                          const respuestaUsuario = respuestasVF[pregunta.id];
                          const feedback         = feedbackVF[pregunta.id];
                          return (
                            <View key={pregunta.id} style={styles.questionCard}>
                              <Text style={styles.questionTitle}>Frase {index + 1}</Text>
                              <Text style={styles.statementText}>{pregunta.texto}</Text>
                              <View style={styles.vfButtonsContainer}>
                                <TouchableOpacity
                                  style={[styles.answerButton, styles.trueButton, respuestaUsuario !== null && styles.disabledAnswerButton, respuestaUsuario === true && (pregunta.respuesta ? styles.correctAnswerSelected : styles.incorrectAnswerSelected)]}
                                  onPress={() => responderVF(pregunta.id, true)}
                                  disabled={respuestaUsuario !== null}
                                  activeOpacity={0.9}
                                >
                                  <Text style={styles.answerButtonText}>VERDADERO</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[styles.answerButton, styles.falseButton, respuestaUsuario !== null && styles.disabledAnswerButton, respuestaUsuario === false && (!pregunta.respuesta ? styles.correctAnswerSelected : styles.incorrectAnswerSelected)]}
                                  onPress={() => responderVF(pregunta.id, false)}
                                  disabled={respuestaUsuario !== null}
                                  activeOpacity={0.9}
                                >
                                  <Text style={styles.answerButtonText}>FALSO</Text>
                                </TouchableOpacity>
                              </View>
                              {feedback === "correcto"   && <Text style={styles.feedbackOk}>¡Correcto!</Text>}
                              {feedback === "incorrecto" && <Text style={styles.feedbackBad}>Incorrecto</Text>}
                            </View>
                          );
                        })}
                      </ScrollView>
                    </View>
                  )}

                  {/* ── Módulo 2 ── */}
                  {currentModuleIndex === 1 && (
                    <View style={styles.modulo2Container}>
                      <View style={styles.columnsContainer}>
                        {frasesModulo2.map((frase) => (
                          <View key={frase.id} style={styles.columnCard}>
                            <Text style={styles.columnText}>{frase.texto}</Text>
                            <TouchableOpacity activeOpacity={0.9} onPress={() => quitarAsignacion(frase.id)}>
                              <View
                                ref={(ref) => setDropRef(frase.id, ref)}
                                collapsable={false}
                                onLayout={() => { setTimeout(() => medirDropZone(frase.id), 60); }}
                                style={[styles.dropZone, respuestas[frase.id] && styles.dropZoneFilled]}
                              >
                                <Text style={styles.dropZoneText}>{respuestas[frase.id] || "Arrastra aquí"}</Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                      <View style={styles.bottomConceptsRow}>
                        {!conceptoUsado("RIESGO") && (
                          <Animated.View style={[styles.draggableConcept, { transform: riesgoPan.getTranslateTransform() }]} {...riesgoResponder.panHandlers}>
                            <Text style={styles.draggableConceptText}>RIESGO</Text>
                          </Animated.View>
                        )}
                        {!conceptoUsado("PELIGRO") && (
                          <Animated.View style={[styles.draggableConcept, { transform: peligroPan.getTranslateTransform() }]} {...peligroResponder.panHandlers}>
                            <Text style={styles.draggableConceptText}>PELIGRO</Text>
                          </Animated.View>
                        )}
                      </View>
                      <TouchableOpacity style={[styles.validateButton, !modulo2Completo && styles.disabledButton]} onPress={validarModulo2} disabled={!modulo2Completo}>
                        <Text style={styles.validateButtonText}>Validar</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <TouchableOpacity style={[styles.sideButton, styles.sideButtonCompact, { backgroundColor: "#4C92E4" }]} onPress={resetCurrentModule}>
                  <Text style={styles.buttonText}>Reiniciar</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      )}

      {/* ══════════ MÓDULO COMPLETADO ══════════ */}
      {showModuleComplete && (
        <View style={styles.overlayTop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>¡Muy bien!</Text>
            <Text style={styles.modalDesc}>Módulo completado. Pasando al siguiente…</Text>
          </View>
        </View>
      )}

      {/* ══════════ OVERLAY -1 VIDA ══════════ */}
      {showTryAgain && (
        <View style={[styles.overlayTop, { zIndex: 99999 }]}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: breakOpacity, transform: [{ scale: breakScale }, { translateX: shakeX }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
          </View>
        </View>
      )}

      {/* ══════════ GAME OVER ══════════ */}
      {showGameOver && (
        <View style={styles.overlayTop}>
          <View style={styles.alertBox}>
            <Text style={styles.scoreBig}>{scoreFromLives(0)}%</Text>
            <Text style={styles.alertText}>Se agotaron tus vidas 😢</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => { setShowGameOver(false); resetGame(); }}
            >
              <Text style={styles.modalBtnText}>Reintentar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#B2B2B2", marginTop: scaleDP(12) }]}
              onPress={() => router.replace("/HSE" as any)}
            >
              <Text style={styles.modalBtnText}>Volver al mapa</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════ ÉXITO FINAL ══════════ */}
      {showFinalSuccess && (
        <View style={styles.overlayTop}>
          <Animated.View
            style={[
              styles.alertBox,
              {
                opacity:   fadeAnim,
                transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <Text style={styles.scoreBig}>{scoreFromLives(lives)}%</Text>
            <Text style={styles.alertText}>
              {scoreFromLives(lives) >= 80
                ? "¡Excelente! Has completado el nivel lectura HSE 🎉"
                : "Completaste el nivel. Sigue practicando para mejorar."}
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => guardarYContinuar(lives)}
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
    paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(22),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  titulo:         { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion:    { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(23), color: "#fff", textAlign: "center", lineHeight: scaleDP(22) },
  playButton:     { marginTop: scaleDP(-20), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(18), paddingVertical: scaleDP(16) },

  livesCorner: {
    position: "absolute", top: scaleDP(20), left: scaleDP(20),
    flexDirection: "row", alignItems: "center", backgroundColor: "transparent",
    paddingVertical: scaleDP(6), paddingHorizontal: scaleDP(10),
    borderRadius: scaleDP(12), gap: scaleDP(4), zIndex: 100, elevation: 10,
  },
  heartIcon2:     { fontSize: scaleDP(28) },
  livesCountText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(28), color: "#000000" },

  moduleSplashBox:  { flex: 1, justifyContent: "center", alignItems: "center" },
  moduleSplashText: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(90), color: "#0F1B4C", textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.78)", paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(40), borderRadius: scaleDP(20),
  },

  boardArea: { width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scaleDP(14) },

  sideButton:        { borderRadius: scaleDP(12), alignItems: "center", justifyContent: "center" },
  sideButtonCompact: { width: scaleDP(100), minHeight: scaleDP(80), paddingVertical: scaleDP(15), paddingHorizontal: scaleDP(8) },
  buttonText:        { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(18), textAlign: "center" },

  board: {
    flex: 1, maxWidth: scaleDP(900), minHeight: scaleDP(550),
    backgroundColor: "rgba(255,255,255,0.90)", borderRadius: scaleDP(24),
    paddingVertical: scaleDP(24), paddingHorizontal: scaleDP(26),
    position: "relative", borderWidth: scaleDP(2), borderColor: "#D1D5DB", overflow: "hidden", justifyContent: "center",
  },

  modulo1Container:     { width: "100%", flex: 1 },
  scrollModulo1:        { width: "100%" },
  scrollModulo1Content: { paddingBottom: scaleDP(10) },

  questionCard: {
    width: "100%", backgroundColor: "#F8FAFC", borderRadius: scaleDP(18),
    padding: scaleDP(18), borderWidth: scaleDP(2), borderColor: "#D9E2EC", marginBottom: scaleDP(18),
  },
  questionTitle:  { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(15), color: "#0F1B4C",  marginBottom: scaleDP(10) },
  statementText:  { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827",  textAlign: "justify", lineHeight: scaleDP(20), marginBottom: scaleDP(16) },

  vfButtonsContainer: { width: "100%", flexDirection: "row", justifyContent: "space-between", gap: scaleDP(12) },
  answerButton:        { flex: 1, paddingVertical: scaleDP(10), borderRadius: scaleDP(10), alignItems: "center" },
  trueButton:          { backgroundColor: "#16A34A" },
  falseButton:         { backgroundColor: "#DC2626" },
  answerButtonText:    { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },
  disabledAnswerButton:    { opacity: 0.9 },
  correctAnswerSelected:   { borderWidth: scaleDP(3), borderColor: "#14532D" },
  incorrectAnswerSelected: { borderWidth: scaleDP(3), borderColor: "#7F1D1D" },
  feedbackOk:  { marginTop: scaleDP(12), fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(24), color: "#16A34A", textAlign: "center" },
  feedbackBad: { marginTop: scaleDP(12), fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(24), color: "#DC2626", textAlign: "center" },

  modulo2Container: { width: "100%", alignItems: "center" },
  columnsContainer: { width: "100%", flexDirection: "row", gap: scaleDP(1), justifyContent: "space-between", alignItems: "stretch", marginBottom: scaleDP(20) },
  columnCard:       { flex: 1, backgroundColor: "#F8FAFC", borderRadius: scaleDP(16), borderWidth: scaleDP(2), borderColor: "#D9E2EC", padding: scaleDP(14), minHeight: scaleDP(150), justifyContent: "space-between" },
  columnText:       { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(18), color: "#111827", lineHeight: scaleDP(25), textAlign: "justify", marginBottom: scaleDP(14) },

  dropZone:       { minHeight: scaleDP(70), borderWidth: scaleDP(2), borderStyle: "dashed", borderColor: "#94A3B8", borderRadius: scaleDP(14), justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(10), paddingVertical: scaleDP(10), backgroundColor: "#FFFFFF" },
  dropZoneFilled: { borderStyle: "solid", borderColor: "#2563EB", backgroundColor: "#EFF6FF" },
  dropZoneText:   { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15), color: "#1E3A5F", textAlign: "center" },

  bottomConceptsRow: { width: "100%", flexDirection: "row", justifyContent: "center", alignItems: "center", gap: scaleDP(18), minHeight: scaleDP(110), marginTop: scaleDP(-40) },
  draggableConcept:  { backgroundColor: "#1D4ED8", paddingVertical: scaleDP(14), paddingHorizontal: scaleDP(24), borderRadius: scaleDP(16), elevation: 4, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 3 } },
  draggableConceptText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },

  validateButton:     { marginTop: scaleDP(-20), backgroundColor: "#4C92E4", paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(30), borderRadius: scaleDP(12) },
  validateButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(22) },
  disabledButton:     { opacity: 0.5 },

  overlayTop: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 9999, elevation: 9999 },

  modalBox:  { width: "80%", backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(18), alignItems: "center", elevation: 20 },
  modalTitle:{ fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(70), color: "#0F1B4C", textAlign: "center" },
  modalDesc: { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(38), color: "#111827", textAlign: "center" },

  modalBoxSmall: { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(20), alignItems: "center", elevation: 8 },
  bigHeart:      { fontSize: scaleDP(100), color: "red" },
  minusOneText:  { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#DC2626", marginTop: scaleDP(-10) },

  alertBox:  { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 20, maxWidth: "85%", alignItems: "center" },
  scoreBig:  { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(80), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(30), textAlign: "center" },

  modalBtn:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10), minWidth: scaleDP(300), alignItems: "center" },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },
});