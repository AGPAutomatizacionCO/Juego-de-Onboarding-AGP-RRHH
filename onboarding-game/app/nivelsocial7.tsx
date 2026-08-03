import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE_URL } from "./config";

const { width, height } = Dimensions.get("window");

/* =========================================================
   CONFIG
========================================================= */
const fondo        = require("../assets/fondofinal.png");
const avatarQuieto = require("../assets/operario_quieto.gif");
const avatarSalto  = require("../assets/salto_der.gif");

const API_URL       = API_BASE_URL;
const ISLA_KEY      = 5;   // ← Manipulación del Vidrio
const NIVEL_KEY     = 24;  // ← Nivel Social
const RUTA_VOLVER   = "/Manipulacion"; // ⚠️ ajusta al nombre real de tu archivo del mapa

const VIDAS_POR_CASO = 3;
const TOTAL_VIDAS    = VIDAS_POR_CASO * 5; // 15

// Cuánto tiempo (ms) se queda el operario parado sobre el vidrio antes de volver
const PAUSA_SOBRE_VIDRIO_CORRECTO   = 1200;
const PAUSA_SOBRE_VIDRIO_INCORRECTO = 900;

/* =========================================================
   TIPOS
========================================================= */
type Letra = "A" | "B" | "C";
type Caso  = { id: number; pregunta: string; opciones: Record<Letra, string>; correcta: Letra };

type CasoBase = {
  id: number;
  pregunta: string;
  opciones: [string, string, string];
  correctaIdx: number;
};

const LETRAS: Letra[] = ["A", "B", "C"];

function mezclarCaso(base: CasoBase): Caso {
  const textoCorrect = base.opciones[base.correctaIdx];
  const idx: [number, number, number] = [0, 1, 2];
  for (let i = 2; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const mezcladas = idx.map((i) => base.opciones[i]);
  return {
    id:       base.id,
    pregunta: base.pregunta,
    opciones: { A: mezcladas[0], B: mezcladas[1], C: mezcladas[2] },
    correcta: LETRAS[mezcladas.indexOf(textoCorrect)],
  };
}

/* =========================================================
   DATOS — Manipulación del Vidrio
========================================================= */
const casosBase: CasoBase[] = [
  {
    id: 1,
    pregunta: "¿Cuáles son las piezas que siempre deben manipularse colectivamente, sin excepción?",
    opciones: [
      "Parabrisas y Posteriores",
      "Laterales únicamente",
      "Piezas menores de 50 kg",
    ],
    correctaIdx: 0,
  },
  {
    id: 2,
    pregunta: "Durante una inspección un operario identifica un defecto, ¿dónde debe realizar la marcación?",
    opciones: [
      "En la cara contraria donde se encuentra el defecto",
      "Sobre el defecto",
      "Ambas caras",
    ],
    correctaIdx: 0,
  },
  {
    id: 3,
    pregunta: "¿Cuál de los siguientes es un defecto común relacionado al vidrio?",
    opciones: [
      "Quiñes",
      "Pérdida de brillo",
      "Empañamiento",
    ],
    correctaIdx: 0,
  },
  {
    id: 4,
    pregunta: "¿Cómo deben ubicarse las manos durante la manipulación de una pieza tipo espejo entre dos operarios?",
    opciones: [
      "Cada operario debe sujetar la pieza en la parte superior e inferior del lado que le corresponde",
      "Un operario toma la parte superior y el otro la parte inferior",
      "Ambos operarios deben sujetar la pieza únicamente en los puntos de mayor curvatura",
    ],
    correctaIdx: 0,
  },
  {
    id: 5,
    pregunta: "Cuando el offset de una pieza es muy grande, ¿qué precaución debe tomarse?",
    opciones: [
      "Tomar el vidrio con el antebrazo para evitar la ruptura de la pintura",
      "Sujetar el vidrio únicamente por las esquinas para evitar deformaciones",
      "Apoyar el vidrio sobre el suelo antes de transportarlo",
    ],
    correctaIdx: 0,
  },
];

/* =========================================================
   POSICIONES DE SALTO
========================================================= */
const OPTION_Y: Record<Letra, number> = { A: -148, B: 0, C: 148 };
const OPTION_X = 115;
const ARC_LIFT = 80;
const HALF_DUR = 300;

/* =========================================================
   COMPONENTE
========================================================= */
export default function NivelSaltoVidriosManipulacion() {
  const router = useRouter();

  /* ── PANTALLAS ── */
  const [showIntro, setShowIntro] = useState(true);
  const [showGame,  setShowGame]  = useState(false);

  /* ── Casos mezclados ── */
  const [casosData, setCasosData] = useState<Caso[]>(() => casosBase.map(mezclarCaso));

  /* ── JUEGO ── */
  const [casoActual,  setCasoActual]  = useState(0);
  const [vidas,       setVidas]       = useState(VIDAS_POR_CASO);
  const [avatarSrc,   setAvatarSrc]   = useState(avatarQuieto);
  const [bloqueado,   setBloqueado]   = useState(false);
  const [vidasUsadas, setVidasUsadas] = useState(0);

  // Color del vidrio seleccionado: null = normal, "green" = correcto, "red" = incorrecto
  const [vidrioColor,    setVidrioColor]    = useState<Record<Letra, "green" | "red" | null>>({ A: null, B: null, C: null });
  const [letraSeleccionada, setLetraSeleccionada] = useState<Letra | null>(null);

  /* ── OVERLAYS / MODALES ── */
  const [showMinusOverlay, setShowMinusOverlay] = useState(false);
  const [showGameOver,     setShowGameOver]     = useState(false);
  const [showFinal,        setShowFinal]        = useState(false);

  /* ── ANIMACIONES ── */
  const scrollX    = useRef(new Animated.Value(0)).current;
  const avatarX    = useRef(new Animated.Value(0)).current;
  const avatarY    = useRef(new Animated.Value(0)).current;
  const avatarSc   = useRef(new Animated.Value(1)).current;
  const pulseAnim  = useRef(new Animated.Value(1)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;
  const heartScale = useRef(new Animated.Value(1)).current;
  const minusScale   = useRef(new Animated.Value(0.6)).current;
  const minusOpacity = useRef(new Animated.Value(0)).current;
  const minusShake   = useRef(new Animated.Value(0)).current;

  const shakeX = minusShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  /* ── SCORE ── */
  const calcScore = (usadas: number) =>
    Math.max(70, 100 - Math.round((usadas / TOTAL_VIDAS) * 30));

  /* ── GUARDAR ── */
  const guardarResultado = async (usadas: number) => {
    try {
      const uk = await AsyncStorage.getItem("USUARIO_KEY");
      if (!uk) return;
      const score = calcScore(usadas);
      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_social_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_social_score`, String(score)],
      ]);
      await fetch(`${API_URL}/api/niveles/social/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey: Number(uk), puntaje: score, aprobado: 1 }),
      });
    } catch (e) { console.log(e); }
  };

  /* ── ANIMACIÓN CORAZÓN ── */
  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

  /* ── ANIMACIÓN -1 VIDA ── */
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

  /* ── RESET AVATAR ── */
  const resetAvatar = () => {
    avatarX.setValue(0);
    avatarY.setValue(0);
    avatarSc.setValue(1);
    setAvatarSrc(avatarQuieto);
  };

  /* ── RESET COLOR VIDRIOS ── */
  const resetVidrioColor = () => {
    setVidrioColor({ A: null, B: null, C: null });
    setLetraSeleccionada(null);
  };

  /* ── SALTO HACIA EL VIDRIO ── */
  const saltarHacia = (letra: Letra, onLanding: () => void) => {
    setAvatarSrc(avatarSalto);
    const destY = OPTION_Y[letra];
    const arcY  = destY - ARC_LIFT;

    Animated.parallel([
      Animated.timing(avatarX, {
        toValue: OPTION_X, duration: HALF_DUR * 2,
        easing: Easing.linear, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(avatarY, { toValue: arcY,  duration: HALF_DUR, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(avatarY, { toValue: destY, duration: HALF_DUR, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(avatarSc, { toValue: 1.28, duration: HALF_DUR, easing: Easing.out(Easing.ease), useNativeDriver: true }),
        Animated.timing(avatarSc, { toValue: 1.12, duration: HALF_DUR, easing: Easing.in(Easing.ease),  useNativeDriver: true }),
      ]),
    ]).start(() => {
      // El operario llegó: cambiar a quieto y llamar callback
      setAvatarSrc(avatarQuieto);
      onLanding();
    });
  };

  /* ── SALTO DE REGRESO ── */
  const saltarDeVuelta = (onDone: () => void) => {
    setAvatarSrc(avatarSalto);
    const fromY = (avatarY as any)._value as number;
    const arcY  = fromY - ARC_LIFT;

    Animated.parallel([
      Animated.timing(avatarX, {
        toValue: 0, duration: HALF_DUR * 2,
        easing: Easing.linear, useNativeDriver: true,
      }),
      Animated.sequence([
        Animated.timing(avatarY, { toValue: arcY, duration: HALF_DUR, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(avatarY, { toValue: 0,    duration: HALF_DUR, easing: Easing.in(Easing.quad),  useNativeDriver: true }),
      ]),
      Animated.timing(avatarSc, {
        toValue: 1, duration: HALF_DUR * 2,
        easing: Easing.inOut(Easing.ease), useNativeDriver: true,
      }),
    ]).start(() => {
      setAvatarSrc(avatarQuieto);
      onDone();
    });
  };

  /* ── RESPONDER ── */
  const responder = (letra: Letra) => {
    if (bloqueado) return;
    setBloqueado(true);
    setLetraSeleccionada(letra);

    saltarHacia(letra, () => {
      // Operario está parado sobre el vidrio → pintar color
      const esCorrecta = letra === casosData[casoActual].correcta;
      setVidrioColor((prev) => ({ ...prev, [letra]: esCorrecta ? "green" : "red" }));

      if (esCorrecta) {
        onCorrecto(letra);
      } else {
        onIncorrecto(letra);
      }
    });
  };

  // Ref para leer casoActual sin closure stale
  const casoActualRef  = useRef(0);
  const vidasUsadasRef = useRef(0);

  /* ── CORRECTO ──
     Flujo: aterrizó → vidrio verde → pausa PAUSA_SOBRE_VIDRIO_CORRECTO ms
            → salta de vuelta → avanza pregunta
  */
  const onCorrecto = (_letra: Letra) => {
    Animated.sequence([
      Animated.timing(pulseAnim, { toValue: 1.2, duration: 180, useNativeDriver: true }),
      Animated.timing(pulseAnim, { toValue: 1,   duration: 180, useNativeDriver: true }),
    ]).start();

    // Esperar parado sobre el vidrio verde
    setTimeout(() => {
      resetVidrioColor();
      saltarDeVuelta(() => avanzar());
    }, PAUSA_SOBRE_VIDRIO_CORRECTO);
  };

  /* ── INCORRECTO ──
     Flujo: aterrizó → vidrio rojo → pausa PAUSA_SOBRE_VIDRIO_INCORRECTO ms
            → salta de vuelta → mostrar modal de vida perdida / game over
  */
  const onIncorrecto = (_letra: Letra) => {
    const nuevas = vidas - 1;
    setVidasUsadas((p) => { vidasUsadasRef.current = p + 1; return p + 1; });
    setVidas(nuevas);
    animateHeart();
    playMinusAnim();

    // Esperar parado sobre el vidrio rojo
    setTimeout(() => {
      resetVidrioColor();
      saltarDeVuelta(() => {
        if (nuevas <= 0) {
          setShowGameOver(true);
        } else {
          setShowMinusOverlay(true);
        }
      });
    }, PAUSA_SOBRE_VIDRIO_INCORRECTO);
  };

  /* ── AVANZAR ── */
  const avanzar = () => {
    const siguiente = casoActualRef.current + 1;
    Animated.timing(scrollX, {
      toValue: -siguiente * width,
      duration: 1200,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      if (casoActualRef.current >= casosData.length - 1) {
        guardarResultado(vidasUsadasRef.current);
        setShowFinal(true);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
        return;
      }
      casoActualRef.current = siguiente;
      setCasoActual(siguiente);
      setVidas(VIDAS_POR_CASO);
      resetAvatar();
      resetVidrioColor();
      setBloqueado(false);
    });
  };

  /* ── REINICIAR ── */
  const reiniciar = () => {
    setCasosData(casosBase.map(mezclarCaso));
    casoActualRef.current = 0;
    setCasoActual(0);
    setVidas(VIDAS_POR_CASO);
    vidasUsadasRef.current = 0;
    setVidasUsadas(0);
    setShowGameOver(false);
    setShowMinusOverlay(false);
    scrollX.setValue(0);
    resetAvatar();
    resetVidrioColor();
    setBloqueado(false);
  };

  /* ── INICIAR JUEGO ── */
  const iniciarJuego = () => {
    setCasosData(casosBase.map(mezclarCaso));
    setShowIntro(false);
    setShowGame(true);
  };

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.fullBg} resizeMode="cover">

      {/* ══════════════════════════════════════
          INTRO
      ══════════════════════════════════════ */}
      {showIntro && (
        <View style={styles.centeredFull}>
          <View style={styles.introBox}>
            <Text style={styles.introTitle}>Nivel Social – Manipulación del Vidrio</Text>
            <Text style={styles.introDesc}>
              En este nivel deberás responder {casosData.length} preguntas sobre la manipulación segura del vidrio.{"\n\n"}
              El avatar saltará hacia la opción que elijas. Si es correcta, avanza al siguiente caso.{"\n\n"}
              Tienes <Text style={styles.introBold}>{VIDAS_POR_CASO} vidas por caso</Text> ({TOTAL_VIDAS} en total). Tu puntaje final depende de cuántas vidas uses.
            </Text>
            <TouchableOpacity style={styles.playBtn} onPress={iniciarJuego}>
              <Text style={styles.playBtnTxt}>¡Jugar!</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════
          JUEGO
      ══════════════════════════════════════ */}
      {showGame && (
        <View style={styles.container}>

          {/* VIDAS */}
          <Animated.View style={[styles.vidasContainer, { transform: [{ scale: heartScale }] }]}>
            <Animated.Text style={[styles.vidasNum, { transform: [{ scale: pulseAnim }] }]}>
              {vidas}
            </Animated.Text>
            <Animated.Text style={[styles.heart, { transform: [{ scale: pulseAnim }] }]}>❤️</Animated.Text>
          </Animated.View>

          {/* PANTALLAS DESLIZANTES */}
          <Animated.View
            style={[styles.scrollContainer, { width: width * casosData.length, transform: [{ translateX: scrollX }] }]}
          >
            {casosData.map((caso, index) => (
              <ImageBackground key={index} source={fondo} resizeMode="cover" style={styles.screen}>
                <View style={styles.screenOverlay} />

                {/* PREGUNTA */}
                <View style={styles.topContainer}>
                  <Text style={styles.pregunta}>{caso.pregunta}</Text>
                </View>

                {/* ESCENA */}
                <View style={styles.scene}>

                  {/* AVATAR */}
                  <Animated.View
                    style={[
                      styles.avatarContainer,
                      { transform: [{ translateX: avatarX }, { translateY: avatarY }, { scale: avatarSc }] },
                    ]}
                  >
                    <Image source={avatarSrc} resizeMode="contain" style={styles.avatar} />
                  </Animated.View>

                  {/* OPCIONES VIDRIO */}
                  <View style={styles.optionsContainer}>
                    {(["A", "B", "C"] as Letra[]).map((letra) => {
                      const color = index === casoActual ? vidrioColor[letra] : null;
                      return (
                        <TouchableOpacity
                          key={letra}
                          activeOpacity={0.78}
                          style={[
                            styles.optionBtn,
                            color === "green" && styles.optionBtnCorrect,
                            color === "red"   && styles.optionBtnWrong,
                          ]}
                          onPress={() => responder(letra)}
                        >
                          <View style={styles.glassShine} />
                          <View style={styles.optionInner}>
                            <View style={[
                              styles.letterBadge,
                              color === "green" && styles.letterBadgeCorrect,
                              color === "red"   && styles.letterBadgeWrong,
                            ]}>
                              <Text style={[
                                styles.optionLetter,
                                color === "green" && { color: "#fff" },
                                color === "red"   && { color: "#fff" },
                              ]}>
                                {color === "green" ? "✓" : color === "red" ? "✗" : letra}
                              </Text>
                            </View>
                            <Text style={styles.optionText}>{caso.opciones[letra]}</Text>
                          </View>
                          <View style={styles.glassBorderBottom} />
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                </View>
              </ImageBackground>
            ))}
          </Animated.View>

          {/* ── OVERLAY VIDA PERDIDA ── */}
          {showMinusOverlay && !showGameOver && !showFinal && (
            <View style={styles.feedbackOverlay}>
              <View style={styles.modalBoxSmall}>
                <Animated.Text
                  style={[
                    styles.bigHeart,
                    { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] },
                  ]}
                >
                  💔
                </Animated.Text>
                <Text style={styles.minusOneText}>¡Respuesta incorrecta!</Text>
                <Text style={styles.modalDescSmall}>
                  Perdiste una vida. Intenta de nuevo.
                </Text>
                <TouchableOpacity
                  style={styles.corregirBtn}
                  onPress={() => { setShowMinusOverlay(false); setBloqueado(false); }}
                >
                  <Text style={styles.corregirBtnTxt}>Continuar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── GAME OVER ── */}
          {showGameOver && (
            <View style={styles.feedbackOverlay}>
              <View style={styles.gameCard}>
                <Text style={styles.gameEmoji}>💀</Text>
                <Text style={styles.gameTitle}>Game Over</Text>
                <Text style={styles.gameDesc}>
                  Te quedaste sin vidas.{"\n"}Puedes intentarlo de nuevo.
                </Text>
                <View style={styles.gameRow}>
                  <TouchableOpacity style={styles.retryBtn} onPress={reiniciar}>
                    <Text style={styles.retryTxt}>Reintentar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.volverBtn} onPress={() => router.replace(RUTA_VOLVER as any)}>
                    <Text style={styles.retryTxt}>Volver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}

          {/* ── FINAL ── */}
          {showFinal && (
            <View style={styles.feedbackOverlay}>
              <Animated.View
                style={[
                  styles.finalCard,
                  {
                    opacity: fadeAnim,
                    transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
                  },
                ]}
              >
                <Text style={styles.finalEmoji}>🎉</Text>
                <Text style={styles.finalTitle}>¡Nivel completado!</Text>
                <Text style={styles.finalScore}>{calcScore(vidasUsadas)}%</Text>
                <Text style={styles.finalInfo}>
                  Vidas usadas: {vidasUsadas} / {TOTAL_VIDAS}
                </Text>
                <TouchableOpacity style={styles.finishBtn} onPress={() => router.replace(RUTA_VOLVER as any)}>
                  <Text style={styles.finishTxt}>Continuar</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          )}

        </View>
      )}

    </ImageBackground>
  );
}

/* =========================================================
   STYLES
========================================================= */
const styles = StyleSheet.create({

  fullBg: { flex: 1 },

  /* ── INTRO ── */
  centeredFull: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.88)",
    paddingVertical: 32, paddingHorizontal: 36,
    borderRadius: 28, alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 20,
    shadowOffset: { width: 0, height: 6 }, elevation: 12,
  },
  introTitle: { fontSize: 38, fontWeight: "900", color: "#fff", textAlign: "center", marginBottom: 18 },
  introDesc:  { fontSize: 22, color: "#fff", textAlign: "center", lineHeight: 32 },
  introBold:  { fontWeight: "900", color: "#fff" },
  playBtn:    { marginTop: 28, backgroundColor: "#4C92E4", paddingVertical: 14, paddingHorizontal: 60, borderRadius: 18 },
  playBtnTxt: { color: "#fff", fontSize: 26, fontWeight: "900" },

  /* ── CONTENEDOR JUEGO ── */
  container:       { flex: 1, backgroundColor: "transparent" },
  scrollContainer: { flexDirection: "row", height: "100%" },
  screen:          { width, height, justifyContent: "space-between" },
  screenOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.18)" },

  /* ── VIDAS ── */
  vidasContainer: {
    position: "absolute", top: 35, right: 28, zIndex: 999,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 16, paddingVertical: 8,
    borderRadius: 50, borderWidth: 1.5, borderColor: "rgba(255,255,255,0.2)",
  },
  vidasNum: { fontSize: 30, fontWeight: "900", color: "#fff", lineHeight: 34 },
  heart:    { fontSize: 28 },

  /* ── PREGUNTA ── */
  topContainer: { width: "100%", paddingTop: 52, alignItems: "center", paddingHorizontal: 36 },
  pregunta: {
    fontSize: 27, color: "#0a1628", fontWeight: "800", textAlign: "center",
    backgroundColor: "rgba(255,255,255,0.88)",
    paddingVertical: 22, paddingHorizontal: 36, borderRadius: 28, maxWidth: 1100,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12, elevation: 8,
  },

  /* ── ESCENA ── */
  scene: {
    flex: 1, flexDirection: "row", justifyContent: "center",
    alignItems: "center", paddingHorizontal: 50, gap: 30,
  },

  /* ── AVATAR ── */
  avatarContainer: { width: 340, height: 420, justifyContent: "center", alignItems: "center" },
  avatar:          { width: 340, height: 340, transform: [{ rotate: "-90deg" }] },

  /* ── OPCIONES VIDRIO ── */
  optionsContainer: { justifyContent: "center", gap: 28 },
  optionBtn: {
    width: 430, minHeight: 108,
    borderRadius: 26, overflow: "hidden",
    borderWidth: 1.5, borderColor: "rgba(200, 235, 255, 0.6)",
    shadowColor: "#60b8ff", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4, shadowRadius: 18, elevation: 12,
    backgroundColor: "transparent",
  },
  // Estado correcto: borde verde y fondo verde translúcido
  optionBtnCorrect: {
    borderColor: "#16A34A",
    borderWidth: 3,
    shadowColor: "#16A34A",
    shadowOpacity: 0.7,
    backgroundColor: "rgba(22,163,74,0.18)",
  },
  // Estado incorrecto: borde rojo y fondo rojo translúcido
  optionBtnWrong: {
    borderColor: "#DC2626",
    borderWidth: 3,
    shadowColor: "#DC2626",
    shadowOpacity: 0.7,
    backgroundColor: "rgba(220,38,38,0.18)",
  },
  glassShine: {
    height: 14, backgroundColor: "rgba(255,255,255,0.30)",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
  },
  optionInner: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 18, paddingHorizontal: 20, gap: 16,
    backgroundColor: "rgba(100,170,255,0.15)",
  },
  glassBorderBottom: {
    height: 5, backgroundColor: "rgba(160,225,255,0.55)",
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  letterBadge: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 2, borderColor: "rgba(100,170,255,0.7)",
    justifyContent: "center", alignItems: "center", elevation: 3,
  },
  letterBadgeCorrect: { backgroundColor: "#16A34A", borderColor: "#16A34A" },
  letterBadgeWrong:   { backgroundColor: "#DC2626", borderColor: "#DC2626" },
  optionLetter: { fontSize: 24, fontWeight: "900", color: "#1255a0" },
  optionText: {
    flex: 1, fontSize: 18, color: "#ffffff", fontWeight: "700",
    textShadowColor: "rgba(0,0,30,0.75)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 5,
  },

  /* ── OVERLAYS GENERALES ── */
  feedbackOverlay: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center", alignItems: "center",
    zIndex: 999,
  },

  /* ── VIDA PERDIDA ── */
  modalBoxSmall: {
    backgroundColor: "#fff", borderRadius: 24,
    paddingVertical: 32, paddingHorizontal: 40,
    alignItems: "center", elevation: 12, maxWidth: "80%",
  },
  bigHeart:       { fontSize: 58, marginBottom: 8 },
  minusOneText:   { fontSize: 26, fontWeight: "900", color: "#DC2626", marginBottom: 8 },
  modalDescSmall: { fontSize: 20, color: "#111827", textAlign: "center", lineHeight: 28 },
  corregirBtn: {
    marginTop: 20, backgroundColor: "#4C92E4",
    paddingVertical: 14, paddingHorizontal: 40, borderRadius: 14,
  },
  corregirBtnTxt: { color: "#fff", fontSize: 22, fontWeight: "900" },

  /* ── GAME OVER ── */
  gameCard: {
    backgroundColor: "#111827", paddingVertical: 48, paddingHorizontal: 50,
    borderRadius: 35, alignItems: "center", maxWidth: "85%",
  },
  gameEmoji: { fontSize: 65, marginBottom: 10 },
  gameTitle: { color: "#fff", fontSize: 40, fontWeight: "900", marginBottom: 8 },
  gameDesc:  { color: "#9CA3AF", fontSize: 20, textAlign: "center", lineHeight: 28, marginBottom: 24 },
  gameRow:   { flexDirection: "row", gap: 16 },
  retryBtn:  { backgroundColor: "#2563EB", paddingVertical: 16, paddingHorizontal: 36, borderRadius: 16 },
  volverBtn: { backgroundColor: "#6B7280", paddingVertical: 16, paddingHorizontal: 36, borderRadius: 16 },
  retryTxt:  { color: "#fff", fontSize: 22, fontWeight: "bold" },

  /* ── FINAL ── */
  finalCard: {
    backgroundColor: "#77b479", paddingVertical: 48, paddingHorizontal: 60,
    borderRadius: 35, alignItems: "center", maxWidth: "85%",
  },
  finalEmoji: { fontSize: 70, marginBottom: 8 },
  finalTitle: { color: "#fff", fontSize: 36, fontWeight: "900" },
  finalScore: { color: "#fff", fontSize: 80, fontWeight: "900", marginVertical: 16 },
  finalInfo:  { color: "rgba(255,255,255,0.85)", fontSize: 18, marginBottom: 20 },
  finishBtn:  { backgroundColor: "#fff", paddingVertical: 16, paddingHorizontal: 50, borderRadius: 20 },
  finishTxt:  { color: "#16803C", fontSize: 24, fontWeight: "900" },
});