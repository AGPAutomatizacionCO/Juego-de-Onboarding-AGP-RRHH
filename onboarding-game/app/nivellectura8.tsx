import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
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
const fondo = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/LecturaOF"; // ⚠️ ajusta al nombre real de tu archivo del mapa
const API_URL = API_BASE_URL;
const ISLA_KEY  = 7;   // ← Lectura OF
const NIVEL_KEY = 32;  // ← Nivel Lectura
const MAX_LIVES = 3;

function scoreFromLives(lives: number): number {
  if (lives >= 3) return 100;
  if (lives === 2) return 90;
  if (lives === 1) return 80;
  return 75;
}

type OpcionRespuesta = string;
type EstadoFeedback = Record<number, "correcto" | "incorrecto" | null>;

/* =========================================================
   CONTENIDO FIJO — Lectura de Orden de Fabricación
========================================================= */
const opcionesRespuestaDefault: OpcionRespuesta[] = [
  "Chaflanes",
  "Espesor nominal",
  "Cuerdas",
  "Bombas",
  "Opal acido",
  "Clave modelo",
  "Offset",
];

const preguntasDefault = [
  { id: 1, texto: "Son cortes realizados en ángulo sobre los bordes del vidrio para eliminar filos y facilitar su instalación.", respuesta: "Chaflanes" as OpcionRespuesta },
  { id: 2, texto: "Indica el grosor total que debe tener la pieza terminada.", respuesta: "Espesor nominal" as OpcionRespuesta },
  { id: 3, texto: "Son las medidas del ancho y del largo máximo de la pieza.", respuesta: "Cuerdas" as OpcionRespuesta },
  { id: 4, texto: "Indican la forma o curvatura que debe tener la pieza.", respuesta: "Bombas" as OpcionRespuesta },
  { id: 5, texto: "Calidad coloca el logo y la trazabilidad en la cara externa del vidrio.", respuesta: "Opal acido" as OpcionRespuesta },
  { id: 6, texto: "Identifica el tipo de lite que pasa por cada proceso de fabricación.", respuesta: "Clave modelo" as OpcionRespuesta },
  { id: 7, texto: "Es la distancia entre el vidrio paquete y el vidrio pintura.", respuesta: "Offset" as OpcionRespuesta },
];

function LivesDisplay({ lives, heartScale }: { lives: number; heartScale: Animated.Value }) {
  return (
    <Animated.View style={[styles.livesDisplay, { transform: [{ scale: heartScale }] }]}>
      <Text style={styles.livesHeart}>❤️</Text>
      <Text style={styles.livesNumber}>{lives}</Text>
    </Animated.View>
  );
}

export default function NivelLecturaOF() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const usuarioKeyFromParams = useMemo(() => {
    const raw = params?.usuarioKey;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);
  const [savedScore, setSavedScore] = useState<number | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);

  useEffect(() => {
    const init = async () => {
      let uk = usuarioKeyFromParams;
      if (!uk) {
        const stored = await AsyncStorage.getItem("USUARIO_KEY");
        uk = stored ? Number(stored) : null;
      }
      if (uk && uk > 0) {
        setUsuarioKey(uk);
        await AsyncStorage.setItem("USUARIO_KEY", String(uk));

        const doneKey  = `u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_done`;
        const scoreKey = `u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_score`;
        const done  = await AsyncStorage.getItem(doneKey);
        const score = await AsyncStorage.getItem(scoreKey);
        if (done === "true" && score) {
          setAlreadyPlayed(true);
          setSavedScore(Number(score));
        }
      }
    };
    init();
  }, [usuarioKeyFromParams]);

  // ── Contenido fijo (sin BD por ahora) ──
  const [preguntas]          = useState(preguntasDefault);
  const [opcionesRespuesta]  = useState<string[]>(opcionesRespuestaDefault);
  const [opcionesPorPregunta, setOpcionesPorPregunta] = useState<Record<number, string[]>>({});

  const generarOpcionesAleatorias = (pgs: typeof preguntasDefault, opts: string[]) => {
    const map: Record<number, string[]> = {};
    pgs.forEach((p) => {
      const shuffled = [...opts].sort(() => Math.random() - 0.5);
      map[p.id] = shuffled;
    });
    setOpcionesPorPregunta(map);
  };

  const [showIntro, setShowIntro] = useState(true);
  const [showGame,  setShowGame]  = useState(false);
  const [showFinal, setShowFinal] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  const [respuestas, setRespuestas] = useState<Record<number, string | null>>({});
  const [feedback,   setFeedback]   = useState<EstadoFeedback>({});
  const [lives,      setLives]      = useState(MAX_LIVES);

  // ── Animaciones de vidas (del código guía) ──
  const heartScale   = useRef(new Animated.Value(1)).current;
  const minusScale   = useRef(new Animated.Value(0.6)).current;
  const minusOpacity = useRef(new Animated.Value(0)).current;
  const minusShake   = useRef(new Animated.Value(0)).current;

  const [showMinusOverlay, setShowMinusOverlay] = useState(false);
  const [showGameOver,     setShowGameOver]     = useState(false);

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

  useEffect(() => {
    if (showMinusOverlay) playMinusAnim();
  }, [showMinusOverlay]);

  const shakeX = minusShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  const completas = useMemo(
    () => preguntas.every((p) => respuestas[p.id] !== null && respuestas[p.id] !== undefined),
    [respuestas, preguntas]
  );

  const startGame = () => {
    const initResp: Record<number, string | null> = {};
    preguntas.forEach((p) => { initResp[p.id] = null; });
    setRespuestas(initResp);
    setFeedback({});
    setLives(MAX_LIVES);
    setShowMinusOverlay(false);
    setShowGameOver(false);
    generarOpcionesAleatorias(preguntas, opcionesRespuesta);
    setShowIntro(false);
    setShowGame(true);
  };

  const mover = (id: number, dir: "left" | "right") => {
    const opts = opcionesPorPregunta[id] ?? opcionesRespuesta;
    const actual = respuestas[id];

    if (actual === null || actual === undefined) {
      setRespuestas((p) => ({
        ...p,
        [id]: dir === "right" ? opts[0] : opts[opts.length - 1],
      }));
      setFeedback((p) => ({ ...p, [id]: null }));
      return;
    }

    const i = opts.findIndex((op) => op === actual);
    if (i === -1) {
      setRespuestas((p) => ({ ...p, [id]: opts[0] }));
      return;
    }

    let nuevoIndex = i;
    if (dir === "right") nuevoIndex = i === opts.length - 1 ? 0 : i + 1;
    else                 nuevoIndex = i === 0 ? opts.length - 1 : i - 1;

    setRespuestas((p) => ({ ...p, [id]: opts[nuevoIndex] }));
    // Al cambiar la respuesta, limpiar feedback de esa fila
    setFeedback((p) => ({ ...p, [id]: null }));
  };

  const validar = () => {
    if (!completas || lives <= 0) return;

    let mal = 0;
    const nuevo: EstadoFeedback = {};

    preguntas.forEach((p) => {
      const ok = respuestas[p.id] === p.respuesta;
      nuevo[p.id] = ok ? "correcto" : "incorrecto";
      if (!ok) mal++;
    });

    setFeedback(nuevo);

    if (mal === 0) {
      const score = scoreFromLives(lives);
      guardarProgreso(score);
      showFinalScreen();
    } else {
      const newLives = Math.max(0, lives - 1);
      animateHeart();

      if (newLives <= 0) {
        setLives(0);
        guardarProgreso(scoreFromLives(0));
        setShowGameOver(true);
      } else {
        setLives(newLives);
        setShowMinusOverlay(true);
      }
    }
  };

  const showFinalScreen = () => {
    setShowFinal(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  const guardarProgreso = async (score: number) => {
    try {
      const uk = usuarioKey;
      if (!uk) return;

      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel33_recordemos_unlocked`,     "true"],
      ]);

      await fetch(`${API_URL}/api/niveles/lectura/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey: uk, puntaje: score, aprobado: score >= 70 ? 1 : 0, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY }),
      });
    } catch (e) {
      console.error("Error guardando progreso lectura OF:", e);
    }
  };

  const resetAll = () => {
    const initResp: Record<number, string | null> = {};
    preguntas.forEach((p) => { initResp[p.id] = null; });
    setRespuestas(initResp);
    setFeedback({});
    setLives(MAX_LIVES);
    setShowMinusOverlay(false);
    setShowGameOver(false);
    generarOpcionesAleatorias(preguntas, opcionesRespuesta);
  };

  const finalScoreToShow = useMemo(() => {
    return lives <= 0 ? scoreFromLives(0) : scoreFromLives(lives);
  }, [lives]);

  // Color del slider según feedback (sin chulito ni X, solo color)
  const sliderBgColor = (id: number) => {
    if (!feedback[id]) return "#fff";
    return feedback[id] === "correcto" ? "#D1FAE5" : "#FEE2E2";
  };

  const sliderBorderColor = (id: number) => {
    if (!feedback[id]) return "#94A3B8";
    return feedback[id] === "correcto" ? "#16A34A" : "#DC2626";
  };

  const arrowBgColor = (id: number) => {
    if (!feedback[id]) return "#4C92E4";
    return feedback[id] === "correcto" ? "#16A34A" : "#DC2626";
  };

  const valueTextColor = (id: number) => {
    if (!feedback[id]) return "#1E3A5F";
    return feedback[id] === "correcto" ? "#15803D" : "#B91C1C";
  };

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* ── Ya jugado ── */}
      {alreadyPlayed && savedScore !== null && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Lectura – Lectura de Orden de Fabricación</Text>
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

      {/* ── Intro ── */}
      {!alreadyPlayed && showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Lectura – Lectura de Orden de Fabricación</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás leer atentamente cada definición y seleccionar el término correcto de la orden de fabricación.{"\n\n"}
              Completa todas las filas y luego presiona validar.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Juego ── */}
      {!alreadyPlayed && showGame && !showFinal && (
        <View style={styles.gameContainer}>

          <LivesDisplay lives={lives} heartScale={heartScale} />

          <View style={styles.boardArea}>
            <View style={styles.board}>
              {preguntas.map((p) => (
                <View
                  key={p.id}
                  style={[
                    styles.row,
                    feedback[p.id] === "correcto"   && styles.ok,
                    feedback[p.id] === "incorrecto" && styles.bad,
                  ]}
                >
                  <View style={styles.left}>
                    <Text style={styles.text}>{p.texto}</Text>
                  </View>

                  <View style={styles.right}>
                    <View style={[styles.slider, {
                      borderColor: sliderBorderColor(p.id),
                      backgroundColor: sliderBgColor(p.id),
                    }]}>
                      <TouchableOpacity
                        style={[styles.arrow, { backgroundColor: arrowBgColor(p.id) }]}
                        activeOpacity={0.7}
                        onPress={() => mover(p.id, "left")}
                      >
                        <Text style={styles.arrowText}>◀</Text>
                      </TouchableOpacity>
                      <Text style={[styles.value, { color: valueTextColor(p.id) }]}>
                        {respuestas[p.id] || "Elegir"}
                      </Text>
                      <TouchableOpacity
                        style={[styles.arrow, { backgroundColor: arrowBgColor(p.id) }]}
                        activeOpacity={0.7}
                        onPress={() => mover(p.id, "right")}
                      >
                        <Text style={styles.arrowText}>▶</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Botones Volver / Validar */}
          <View style={styles.bottomBar}>
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: "#B2B2B2" }]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
            >
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bottomBtn, { backgroundColor: !completas || lives <= 0 ? "#A0AEC0" : "#4C92E4" }]}
              disabled={!completas || lives <= 0}
              onPress={validar}
            >
              <Text style={styles.buttonText}>Validar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Modal final (éxito) ── */}
      {showFinal && (
        <View style={styles.overlayTop}>
          <Animated.View
            style={[
              styles.alertBox,
              {
                opacity: fadeAnim,
                transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <Text style={styles.scoreBig}>{finalScoreToShow}%</Text>
            <Text style={styles.alertText}>
              {finalScoreToShow >= 90
                ? "¡Excelente! Has completado el nivel lectura 🎉"
                : finalScoreToShow >= 70
                ? "¡Muy bien! Has completado el nivel lectura 👍"
                : "Nivel completado. ¡Sigue practicando!"}
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── -1 Vida overlay (del código guía) ── */}
      {showMinusOverlay && !showFinal && (
        <View style={styles.overlayTop}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text
              style={[
                styles.bigHeart,
                {
                  opacity: minusOpacity,
                  transform: [{ scale: minusScale }, { translateX: shakeX }],
                },
              ]}
            >
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]}
              onPress={() => setShowMinusOverlay(false)}
            >
              <Text style={styles.modalBtnText}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── Game Over ── */}
      {showGameOver && !showFinal && (
        <View style={styles.overlayTop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Game Over</Text>
            <Text style={styles.modalDesc}>Se acabaron las vidas.</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]}
                onPress={resetAll}
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

    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS
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
  titulo:        { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion:   { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(28) },
  playButton:    { marginTop: scaleDP(10), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText:{ color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  livesDisplay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: scaleDP(10), marginBottom: scaleDP(6) },
  livesHeart:   { fontSize: scaleDP(22) },
  livesNumber:  { fontSize: scaleDP(22), fontWeight: "900", color: "#0F1B4C" },

  gameContainer: { flex: 1, alignItems: "center", paddingHorizontal: scaleDP(10), paddingBottom: scaleDP(10) },

  boardArea: {
    width: "100%",
    alignItems: "center",
    marginTop: scaleDP(50),
  },
  board: {
    width: "97%",
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    padding: scaleDP(5),
  },

  row: {
    flexDirection: "row",
    marginBottom: scaleDP(3),
    paddingVertical: scaleDP(10),
    paddingHorizontal: scaleDP(10),
    borderRadius: scaleDP(8),
    backgroundColor: "#f1f5f9",
    alignItems: "center",
  },
  ok:  { borderColor: "#16A34A", borderWidth: scaleDP(3) },
  bad: { borderColor: "#DC2626", borderWidth: scaleDP(2) },

  left:  { flex: 2, justifyContent: "center", paddingRight: scaleDP(6) },
  right: { flex: 1, justifyContent: "center", alignItems: "center" },

  text: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(13), color: "#111827", lineHeight: scaleDP(14) },

  slider: {
    flexDirection: "row", alignItems: "center",
    borderWidth: scaleDP(1),
    borderRadius: scaleDP(8), overflow: "hidden",
    minHeight: scaleDP(34),
    width: "100%",
  },
  arrow:     { backgroundColor: "#4C92E4", paddingHorizontal: scaleDP(8), justifyContent: "center", alignItems: "center", minHeight: scaleDP(34) },
  arrowText: { color: "#fff", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(8) },
  value:     { flex: 1, textAlign: "center", paddingHorizontal: scaleDP(4), fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(12), color: "#1E3A5F" },

  validateButton: { marginTop: scaleDP(12), alignSelf: "center", backgroundColor: "#4C92E4", paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(34), borderRadius: scaleDP(12) },
  validateText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(10) },
  disabledButton: { opacity: 0.5 },

  bottomBar: { flexDirection: "row", gap: scaleDP(-10), marginTop: scaleDP(5) },
  bottomBtn: { flex: 1, paddingVertical: scaleDP(12), borderRadius: scaleDP(12), alignItems: "center", minWidth: scaleDP(140) },
  buttonText:{ fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(15), textAlign: "center" },

  overlayTop: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 9999, elevation: 9999 },
  alertBox:   { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 20, maxWidth: "85%", alignItems: "center" },
  scoreBig:   { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(100), marginBottom: scaleDP(12) },
  alertText:  { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(38), textAlign: "center" },

  modalBtn:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10), minWidth: scaleDP(300), alignItems: "center" },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(40) },

  // Estilos para -1 vida (del código guía)
  modalBoxSmall: {
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    paddingVertical: scaleDP(14),
    paddingHorizontal: scaleDP(26),
    alignItems: "center",
    elevation: 8,
  },
  bigHeart: {
    fontSize: scaleDP(100),
    color: "red",
    textAlign: "center",
    marginBottom: 0,
  },
  minusOneText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(35),
    color: "#DC2626",
    marginTop: scaleDP(-4),
  },

  // Estilos para Game Over
  modalBox: {
    width: "92%",
    backgroundColor: "#fff",
    borderRadius: scaleDP(16),
    paddingVertical: scaleDP(20),
    paddingHorizontal: scaleDP(18),
    alignItems: "center",
    elevation: 8,
  },
  modalTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDP(50),
    color: "#0F1B4C",
    textAlign: "center",
  },
  modalDesc: {
    marginTop: scaleDP(8),
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(30),
    color: "#111827",
    textAlign: "center",
  },
  modalRow: { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
});