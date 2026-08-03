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
   ✅ CONFIG GENERAL
   ========================================================= */
const fondo = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/Procesos";
const API_URL = API_BASE_URL;
const ISLA_KEY = 3;
const NIVEL_KEY_API = 14;
const NIVEL_KEY_PROG = 4;
const MAX_LIVES = 3;

/* =========================================================
   ✅ SCORE SEGÚN VIDAS RESTANTES
   3→100  2→90  1→80  0→70
   ========================================================= */
function scoreFromLives(lives: number): number {
  if (lives >= 3) return 100;
  if (lives === 2) return 90;
  if (lives === 1) return 80;
  return 70;
}

/* =========================================================
   ✅ TIPOS
   ========================================================= */
type CasoBase = {
  id: number;
  titulo: string;
  texto: string;
  opciones: string[];
  correcta: number;
};

// CasoMezclado tiene las opciones ya shuffleadas y el nuevo índice correcto
type CasoMezclado = {
  id: number;
  titulo: string;
  texto: string;
  opciones: string[];
  correcta: number; // índice correcto DESPUÉS de mezclar
};

/* =========================================================
   ✅ FUNCIÓN: mezcla las opciones y recalcula el índice correcto
   ========================================================= */
function mezclarOpciones(caso: CasoBase): CasoMezclado {
  const textoCorrect = caso.opciones[caso.correcta];

  // Crear array de índices y mezclarlos
  const indices = [0, 1, 2];
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }

  const opcionesMezcladas = indices.map((i) => caso.opciones[i]);
  const nuevaCorrecta = opcionesMezcladas.indexOf(textoCorrect);

  return {
    id:       caso.id,
    titulo:   caso.titulo,
    texto:    caso.texto,
    opciones: opcionesMezcladas,
    correcta: nuevaCorrecta,
  };
}

/* =========================================================
   ✅ DATA - Fallback si BD no tiene contenido
   ========================================================= */
const casosDefault: CasoBase[] = [
  {
    id: 1,
    titulo: "Caso 1: Retraso en producción",
    texto: "Un proveedor no ha entregado a tiempo las materias primas necesarias para la línea de producción. El jefe de planta te pide una solución inmediata. ¿Qué haces?",
    opciones: [
      "Detener la producción y esperar a que llegue el material",
      "Ordenar a los trabajadores que comiencen con lo que tienen disponible, priorizando productos que no requieran el material faltante",
      "Reportar al área de compras y solicitar pedido urgentes a otro proveedor",
    ],
    correcta: 1,
  },
  {
    id: 2,
    titulo: "Caso 2: Auditoría de calidad",
    texto: "Durante una auditoría interna, se detecta que un lote de productos no cumple con los estándares de calidad establecidos. El lote ya está empacado y listo para envío. ¿Qué acción tomar?",
    opciones: [
      "Enviar el lote de todas formas ya que el cliente no notará la diferencia",
      "Detener el envío, separar el lote y reportar a calidad para análisis",
      "Vender el lote con descuento para evitar pérdidas",
    ],
    correcta: 1,
  },
  {
    id: 3,
    titulo: "Caso 3: Mantenimiento de equipos",
    texto: "Una máquina crítica presenta un ruido extraño durante su operación. El operador sugiere continuar trabajando ya que la máquina aún funciona. ¿Qué haces?",
    opciones: [
      "Hacer caso omiso y continuar la producción",
      "Detener la máquina inmediatamente y reportar al departamento de mantenimiento",
      "Esperar a que falle completamente para justificar el mantenimiento",
    ],
    correcta: 1,
  },
  {
    id: 4,
    titulo: "Caso 4: Capacitación de nuevos empleados",
    texto: "Un nuevo empleado no está siguiendo los procedimientos de seguridad establecidos. Al corregirlo, responde que 'así le enseñaron' y se niega a cambiar. ¿Cómo procedes?",
    opciones: [
      "Ignorarlo para evitar conflictos",
      "Reportar inmediatamente a recursos humanos",
      "Explicar nuevamente la importancia de seguir los procedimientos y revisar el manual de capacitación. Si persiste, reportar al supervisor",
    ],
    correcta: 2,
  },
  {
    id: 5,
    titulo: "Caso 5: Control de inventario",
    texto: "Al realizar el inventario, descubres que hay materiales extras que no aparecen en el sistema. El responsable anterior ya no trabaja aquí. ¿Qué haces?",
    opciones: [
      "Quedártelos para uso personal",
      "Reportar la diferencia al supervisor y verificar si fueron comprados pero no registrados",
      "Tirar los materiales extras para evitar problemas",
    ],
    correcta: 1,
  },
];

/* =========================================================
   ✅ COMPONENTE PRINCIPAL
   ========================================================= */
export default function NivelSocialCasos() {
  const router = useRouter();

  /* ── Usuario ── */
  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  useEffect(() => {
    const init = async () => {
      const stored = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = stored ? Number(stored) : null;
      if (uk && uk > 0) {
        setUsuarioKey(uk);
        const doneKey  = `u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_done`;
        const scoreKey = `u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_score`;
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

  /* ── Casos base (sin mezclar) ── */
  const [casosBase, setCasosBase] = useState<CasoBase[]>(casosDefault);

  useEffect(() => {
    const loadCasos = async () => {
      try {
        const resp = await fetch(`${API_URL}/api/niveles/social/${NIVEL_KEY_API}/casos`);
        const data = await resp.json();
        const items: any[] = data?.data || data || [];
        if (Array.isArray(items) && items.length > 0) {
          const parsed: CasoBase[] = items.map((item: any, idx: number) => ({
            id: idx + 1,
            titulo: item.SOCIAL_TITULO || item.titulo || `Caso ${idx + 1}`,
            texto:  item.SOCIAL_TEXTO  || item.texto  || "",
            opciones: [
              item.SOCIAL_OPCION_A || item.opcionA || "",
              item.SOCIAL_OPCION_B || item.opcionB || "",
              item.SOCIAL_OPCION_C || item.opcionC || "",
            ],
            correcta: Number(item.SOCIAL_CORRECTA ?? item.correcta ?? 0),
          }));
          setCasosBase(parsed);
        }
      } catch (e) {
        console.log("Usando casos por defecto:", e);
      }
    };
    loadCasos();
  }, []);

  /* ── Casos mezclados (los que se muestran al jugar) ── */
  const [casos, setCasos] = useState<CasoMezclado[]>([]);

  /* ── Vidas ── */
  const [lives, setLives]                       = useState(MAX_LIVES);
  const [showGameOver, setShowGameOver]         = useState(false);
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
  const [showIntro,        setShowIntro]        = useState(true);
  const [showGame,         setShowGame]         = useState(false);
  const [showFinalSuccess, setShowFinalSuccess] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  /* ── Respuestas ── */
  const [respuestasUsuario, setRespuestasUsuario] = useState<Record<number, number | null>>({});
  const [mostrarResultados, setMostrarResultados] = useState(false);
  const [errores,           setErrores]           = useState(0);

  /* ── Iniciar juego: mezcla opciones de cada caso ── */
  const startGame = () => {
    // Mezclar opciones de cada caso aleatoriamente
    const mezclados = casosBase.map((c) => mezclarOpciones(c));
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
    // Si ya respondió correctamente este caso, no permitir cambio
    if (mostrarResultados && respuestasUsuario[casoId] === caso.correcta) return;
    
    // ✅ Al cambiar cualquier respuesta, ocultar resultados
    // para que vuelva al estado azul (seleccionado) sin mostrar correcto/incorrecto
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
    const hayIncorrectas = casos.some(
      (c) => respuestasUsuario[c.id] !== c.correcta
    );

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

  const guardarProgreso = async (score: number) => {
    try {
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(ukStr);
      if (!uk || !Number.isFinite(uk)) return;

      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_social_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel5_evaluacion_unlocked`,          "true"],
      ]);

      await fetch(`${API_URL}/api/niveles/social/${NIVEL_KEY_API}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey: uk,
          puntaje:    score,
          aprobado:   score >= 70 ? 1 : 0,
          islaKey:    ISLA_KEY,
          nivelKey:   NIVEL_KEY_PROG,
        }),
      });
    } catch (e) {
      console.error("Error guardando social:", e);
    }
  };

  const resetGame = () => {
    // Al reiniciar también se vuelven a mezclar las opciones
    const mezclados = casosBase.map((c) => mezclarOpciones(c));
    setCasos(mezclados);

    const init: Record<number, number | null> = {};
    mezclados.forEach((c) => { init[c.id] = null; });
    setRespuestasUsuario(init);
    setErrores(0);
    setLives(MAX_LIVES);
    setMostrarResultados(false);
    setShowFinalSuccess(false);
    setShowGameOver(false);
    setShowMinusOverlay(false);
    fadeAnim.setValue(0);
  };

  /* ── Scrollbar custom ── */
  const scrollY   = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const [contentH, setContentH] = useState(1);
  const [scrollH,  setScrollH]  = useState(1);

  const TRACK_H = scaleDP(500);
  const thumbH  = Math.max(
    scaleDP(40),
    scrollH > 0 ? (scrollH / Math.max(contentH, 1)) * TRACK_H : TRACK_H
  );
  const thumbTop = scrollH > 0
    ? scrollY.interpolate({
        inputRange:  [0, Math.max(contentH - scrollH, 1)],
        outputRange: [0, TRACK_H - thumbH],
        extrapolate: "clamp",
      })
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
            <Text style={styles.titulo}>Nivel Social – Casos</Text>
            <Text style={styles.alertText}>¡Ya has completado este nivel!</Text>
            <Text style={styles.scoreBig}>{savedScore}%</Text>
            <TouchableOpacity
              style={[styles.playButton, { backgroundColor: "#10B981" }]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
            >
              <Text style={styles.playButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── INTRO ── */}
      {!alreadyPlayed && showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Social – Casos</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás analizar 5 situaciones relacionadas con la toma de decisiones en el proceso.{"\n\n"}
              Cada caso tiene 3 posibles respuestas y deberás seleccionar la opción que consideres correcta.{"\n\n"}
              Lee cuidadosamente cada situación antes de responder y luego valida tus respuestas al final.
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

          {/* ── Vidas ── */}
          <Animated.View style={[styles.livesContainer, { transform: [{ scale: heartScale }] }]}>
            <Text style={styles.livesHeart}>❤️</Text>
            <Text style={styles.livesNumber}>{lives}</Text>
          </Animated.View>

          <View style={styles.boardArea}>
            <View style={styles.board}>

              {/* ── Contenido: scroll + scrollbar ── */}
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
                                // Seleccionó la correcta → verde
                                opcionStyle = [styles.optionButton, styles.optionCorrect];
                                textoStyle  = [styles.optionText, styles.optionTextSelected];
                              } else if (seleccionada && index !== caso.correcta) {
                                // Seleccionó una incorrecta → rojo
                                opcionStyle = [styles.optionButton, styles.optionIncorrect];
                                textoStyle  = [styles.optionText, styles.optionTextSelected];
                              }
                              // Las no seleccionadas quedan neutras — no revela la correcta
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
                          <Text style={[
                            styles.caseFeedback,
                            respuestaUsuario === caso.correcta
                              ? styles.feedbackCorrecto
                              : styles.feedbackIncorrecto,
                          ]}>
                            {respuestaUsuario === caso.correcta ? "✓ Correcto" : "✗ Incorrecto"}
                          </Text>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>

                {/* Scrollbar custom */}
                {contentH > scrollH && (
                  <View style={[styles.scrollTrack, { height: TRACK_H }]}>
                    <Animated.View
                      style={[styles.scrollThumb, { height: thumbH, top: thumbTop }]}
                    />
                  </View>
                )}
              </View>

            </View>
          </View>

          {/* ── Barra inferior ── */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomSideButton, { backgroundColor: "#B2B2B2" }]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
            >
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.bottomSideButton,
                { backgroundColor: "#4C92E4" },
                !respuestasCompletas && styles.disabledButton,
              ]}
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
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]}
                onPress={resetGame}
              >
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
            <Text style={styles.scoreBig}>{scoreFromLives(lives)}%</Text>
            <Text style={styles.alertText}>¡Excelente! Has completado el nivel social 🎉</Text>

            <View style={styles.finalInfoBox}>
              <Text style={styles.finalInfoText}>
                Respuestas correctas: {correctas}/{casos.length}
              </Text>
              <Text style={styles.finalInfoText}>Errores cometidos: {errores}</Text>
            </View>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
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

  /* ── Intro ── */
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
  titulo: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(50),
    color: "#fff",
    textAlign: "center",
    marginBottom: scaleDP(20),
  },
  descripcion: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(25),
    color: "#fff",
    textAlign: "center",
    lineHeight: scaleDP(25),
  },
  playButton: {
    marginTop: scaleDP(30),
    backgroundColor: "#4C92E4",
    paddingVertical: scaleDP(10),
    paddingHorizontal: scaleDP(50),
    borderRadius: scaleDP(16),
  },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  /* ── Vidas ── */
  livesContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaleDP(8),
    marginTop: scaleDP(6),
    gap: scaleDP(6),
  },
  livesHeart:  { fontSize: scaleDP(26) },
  livesNumber: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(26), color: "#0F1B4C" },

  /* ── Juego ── */
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
    height: scaleDP(430),
    backgroundColor: "rgba(255,255,255,0.90)",
    borderRadius: scaleDP(24),
    paddingTop: scaleDP(14),
    paddingBottom: scaleDP(12),
    paddingHorizontal: scaleDP(18),
    borderWidth: scaleDP(2),
    borderColor: "#D1D5DB",
    overflow: "hidden",
  },

  contentRow: {
    flex: 1,
    flexDirection: "row",
    gap: scaleDP(6),
  },

  /* Scrollbar custom */
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

  scrollArea:    { flex: 1 },
  scrollContent: { paddingBottom: scaleDP(8) },

  /* Casos */
  caseCard: {
    width: "100%",
    backgroundColor: "#EAF5F7",
    borderWidth: scaleDP(2),
    borderColor: "#0F1B4C",
    borderRadius: scaleDP(12),
    paddingVertical: scaleDP(14),
    paddingHorizontal: scaleDP(16),
    marginBottom: scaleDP(12),
  },
  caseTitle: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(15),
    color: "#111827",
    marginBottom: scaleDP(1),
  },
  caseText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(14),
    color: "#111827",
    lineHeight: scaleDP(17),
    textAlign: "justify",
    marginBottom: scaleDP(12),
  },

  optionsContainer: { gap: scaleDP(2) },
  optionButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: scaleDP(2),
    borderColor: "#9CA3AF",
    borderRadius: scaleDP(10),
    paddingVertical: scaleDP(10),
    paddingHorizontal: scaleDP(12),
  },
  optionSelected:  { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },
  optionCorrect:   { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  optionIncorrect: { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  optionText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(14),
    color: "#111827",
    lineHeight: scaleDP(20),
  },
  optionTextSelected: { color: "#fff", fontFamily: "PlusJakartaSans-Bold" },

  caseFeedback:       { marginTop: scaleDP(10), fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },
  feedbackCorrecto:   { color: "#16A34A" },
  feedbackIncorrecto: { color: "#DC2626" },

  disabledButton: { opacity: 0.5 },

  /* Barra inferior */
  bottomBar: {
    marginTop: scaleDP(5),
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: scaleDP(14),
  },
  bottomSideButton: {
    minWidth: scaleDP(200),
    minHeight: scaleDP(60),
    paddingVertical: scaleDP(12),
    paddingHorizontal: scaleDP(18),
    borderRadius: scaleDP(12),
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(18), textAlign: "center" },

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

  /* Modal vida perdida */
  modalBoxSmall: {
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    paddingVertical: scaleDP(16),
    paddingHorizontal: scaleDP(20),
    alignItems: "center",
    elevation: 8,
    maxWidth: "80%",
  },
  bigHeart:       { fontSize: scaleDP(50) },
  minusOneText:   { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#DC2626", marginBottom: scaleDP(6) },
  modalDescSmall: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(18), color: "#111827", textAlign: "center" },

  /* Modal game over */
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
  modalDesc:  { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(24), color: "#111827", textAlign: "center" },
  modalRow:   { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn: {
    paddingVertical: scaleDP(12),
    paddingHorizontal: scaleDP(18),
    borderRadius: scaleDP(10),
    minWidth: scaleDP(200),
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(28) },

  /* Final éxito */
  alertBox: {
    backgroundColor: "#77b479",
    paddingVertical: scaleDP(22),
    paddingHorizontal: scaleDP(35),
    borderRadius: scaleDP(20),
    elevation: 20,
    maxWidth: "85%",
    alignItems: "center",
  },
  scoreBig: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: "#fff",
    fontSize: scaleDP(100),
    marginBottom: scaleDP(12),
  },
  alertText: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: "#fff",
    fontSize: scaleDP(34),
    textAlign: "center",
  },
  finalInfoBox: { marginTop: scaleDP(14), alignItems: "center" },
  finalInfoText: {
    fontFamily: "PlusJakartaSans-Bold",
    color: "#fff",
    fontSize: scaleDP(18),
    textAlign: "center",
    marginTop: scaleDP(4),
  },

  // Legacy — mantenidos por compatibilidad
  bottomInfoBox: {},
  bottomInfoText: {},
  validateButton: {},
  validateButtonText: {},
});