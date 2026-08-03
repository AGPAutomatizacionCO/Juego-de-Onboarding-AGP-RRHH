import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
========================================================= */
const ISLA_KEY  = 6;
const NIVEL_KEY = 26;
const RUTA_VOLVER = "/Metrologia";

const MAX_LIVES    = 5;
const FREE_MISSES  = 5;
const ERRORS_PER_LIFE = 2;

const API_URL = API_BASE_URL;

/* =========================================================
   SCORE / VIDAS
========================================================= */
function computeLives(mismatches: number) {
  const paidErrors = Math.max(0, mismatches - FREE_MISSES);
  const livesLost  = Math.floor(paidErrors / ERRORS_PER_LIFE);
  return Math.max(0, MAX_LIVES - livesLost);
}

function computeScore(mismatches: number) {
  const effMiss = Math.max(0, mismatches - FREE_MISSES);
  const base    = 60;
  const bonus   = 40 * Math.pow(8 / (8 + effMiss), 0.8);
  return Math.round(base + bonus);
}

/* =========================================================
   TIPOS
========================================================= */
type PairPreview = { img1: any; img2: any } | null;
type Card        = { id: number; pairId: number; source: any; label: string };

/* =========================================================
   DATOS — 7 PAREJAS (assets locales)
   Nombra tus imágenes así en /assets/:
     metrologia_par1_foto.png    → foto del Flexómetro
     metrologia_par1_concepto.png → concepto del Flexómetro
     metrologia_par2_foto.png    → foto del Multímetro
     metrologia_par2_concepto.png → concepto del Multímetro
     metrologia_par3_foto.png    → foto del Calibrador Digital
     metrologia_par3_concepto.png → concepto del Calibrador Digital
     metrologia_par4_foto.png    → foto del Vacuómetro
     metrologia_par4_concepto.png → concepto del Vacuómetro
     metrologia_par5_foto.png    → foto del Micrómetro
     metrologia_par5_concepto.png → concepto del Micrómetro
     metrologia_par6_foto.png    → foto del Profundímetro
     metrologia_par6_concepto.png → concepto del Profundímetro
     metrologia_par7_foto.png    → foto del Control Metrológico
     metrologia_par7_concepto.png → concepto del Control Metrológico
========================================================= */
const PAIRS_BASE: { pairId: number; label: string; foto: any; concepto: any }[] = [
  {
    pairId: 1, label: "Flexómetro",
    foto:     require("../assets/metrologia_par1_foto.png"),
    concepto: require("../assets/metrologia_par1_concepto.png"),
  },
  {
    pairId: 2, label: "Multímetro",
    foto:     require("../assets/metrologia_par2_foto.png"),
    concepto: require("../assets/metrologia_par2_concepto.png"),
  },
  {
    pairId: 3, label: "Calibrador Digital",
    foto:     require("../assets/metrologia_par3_foto.png"),
    concepto: require("../assets/metrologia_par3_concepto.png"),
  },
  {
    pairId: 4, label: "Vacuómetro",
    foto:     require("../assets/metrologia_par4_foto.png"),
    concepto: require("../assets/metrologia_par4_concepto.png"),
  },
  {
    pairId: 5, label: "Micrómetro",
    foto:     require("../assets/metrologia_par5_foto.png"),
    concepto: require("../assets/metrologia_par5_concepto.png"),
  },
  {
    pairId: 6, label: "Profundímetro",
    foto:     require("../assets/metrologia_par6_foto.png"),
    concepto: require("../assets/metrologia_par6_concepto.png"),
  },
  {
    pairId: 7, label: "Control Metrológico",
    foto:     require("../assets/metrologia_par7_foto.png"),
    concepto: require("../assets/metrologia_par7_concepto.png"),
  },
];

/* =========================================================
   HELPERS
========================================================= */
function buildCards(): Card[] {
  let id = 1;
  const cards: Card[] = [];
  for (const p of PAIRS_BASE) {
    cards.push({ id: id++, pairId: p.pairId, source: p.foto,     label: p.label });
    cards.push({ id: id++, pairId: p.pairId, source: p.concepto, label: p.label });
  }
  return cards.sort(() => Math.random() - 0.5);
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function NivelVisualMetrologia() {
  const router = useRouter();

  const fondo = require("../assets/islas/fondogeneral.png");

  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);

  const keyU = (suffix: string) => `u:${usuarioKey ?? 0}:${suffix}`;
  const PROG_VISUAL_DONE_KEY     = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`);
  const PROG_VISUAL_SCORE_KEY    = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`);
  const PROG_VISUAL_APROBADO_KEY = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_aprobado`);
  const PROG_LECTURA_UNLOCK_KEY  = keyU(`isla${ISLA_KEY}_nivel27_lectura_unlocked`);

  /* ── Estado de flujo ── */
  const [showIntro,   setShowIntro]   = useState(true);
  const [showGame,    setShowGame]    = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [pairPreview,    setPairPreview]    = useState<PairPreview>(null);

  const [savedFinalScore, setSavedFinalScore] = useState<number | null>(null);
  const [savedAprobado,   setSavedAprobado]   = useState<boolean | null>(null);

  /* ── Vidas / errores ── */
  const [mismatches,   setMismatches]   = useState(0);
  const [lives,        setLives]        = useState(MAX_LIVES);
  const [showTryAgain, setShowTryAgain] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  const [gameOverScore, setGameOverScore] = useState<number | null>(null);
  const score = computeScore(mismatches);

  /* ── Progreso ── */
  const [progressVisible, setProgressVisible] = useState(false);

  /* ── Cartas ── */
  const [cards,      setCards]      = useState<Card[]>(() => buildCards());
  const [flipped,    setFlipped]    = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);
  const animations = useRef<Animated.Value[]>(cards.map(() => new Animated.Value(0))).current;

  /* ── Animaciones ── */
  const fadeAnim     = useRef(new Animated.Value(0)).current;
  const progressFade = useRef(new Animated.Value(0)).current;
  const heartScale   = useRef(new Animated.Value(1)).current;
  const breakScale   = useRef(new Animated.Value(0.6)).current;
  const breakOpacity = useRef(new Animated.Value(0)).current;
  const breakShake   = useRef(new Animated.Value(0)).current;

  const baseCount         = cards.length;
  const remainingPairs    = Math.max(0, (baseCount - matchedIds.length) / 2);
  const interactionLocked = !!pairPreview || showTryAgain || showGameOver || lives <= 0;

  /* ── Cargar usuario ── */
  useEffect(() => {
    (async () => {
      const k  = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(k);
      if (!k || !Number.isFinite(uk) || uk <= 0) {
        Alert.alert("Falta sesión", "No se encontró usuarioKey.", [
          { text: "OK", onPress: () => router.replace("/registration") },
        ]);
        return;
      }
      setUsuarioKey(uk);
    })();
  }, []);

  /* ── Verificar si ya completó ── */
  useEffect(() => {
    if (!usuarioKey) return;
    (async () => {
      const doneKey  = `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`;
      const scoreKey = `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`;
      const aprobKey = `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_aprobado`;
      const done  = await AsyncStorage.getItem(doneKey);
      const s     = await AsyncStorage.getItem(scoreKey);
      const a     = await AsyncStorage.getItem(aprobKey);
      if (done === "true") {
        setSavedFinalScore(s ? Number(s) : 0);
        setSavedAprobado(a === "true");
        setShowIntro(false);
        setShowGame(false);
        setSuccessVisible(true);
        fadeAnim.setValue(1);
      }
    })();
  }, [usuarioKey]);

  /* ── Guardar resultado en BD ── */
  const saveResultadoVisual = async (puntajeOverride?: number) => {
    if (!usuarioKey) return;
    const puntajeFinal = puntajeOverride ?? score;
    try {
      await fetch(`${API_URL}/api/niveles/visual/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey, puntaje: puntajeFinal,
          aprobado: puntajeFinal >= 70,
          mismatches, livesLeft: lives,
          islaKey: ISLA_KEY, nivelKey: NIVEL_KEY,
        }),
      });
    } catch (e) { console.log("Error guardando visual metrologia:", e); }
  };

  /* ── Animaciones ── */
  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const playRetryAnim = () => {
    breakScale.setValue(0.6); breakOpacity.setValue(0); breakShake.setValue(0);
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
      Speech.speak("Perdiste una vida, sigue intentando.", { language: "es-ES", rate: 1 });
      const t = setTimeout(() => setShowTryAgain(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showTryAgain]);

  /* ── Lógica de voltear carta ── */
  const flipCard = (index: number) => {
    if (interactionLocked) return;
    const cardId = cards[index]?.id;
    if (!cardId) return;
    if (matchedIds.includes(cardId)) return;
    if (flipped.includes(index)) {
      Animated.spring(animations[index], { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }).start();
      setFlipped((prev) => prev.filter((i) => i !== index));
      return;
    }
    if (flipped.length === 2) return;
    Animated.spring(animations[index], { toValue: 1, friction: 8, tension: 10, useNativeDriver: true }).start();
    setFlipped((prev) => [...prev, index]);
  };

  /* ── Verificar pareja ── */
  useEffect(() => {
    if (flipped.length !== 2) return;
    const [i1, i2] = flipped;
    const c1 = cards[i1];
    const c2 = cards[i2];
    if (!c1 || !c2) return;

    if (c1.pairId === c2.pairId) {
      setPairPreview({ img1: c1.source, img2: c2.source });
      setTimeout(() => {
        setPairPreview(null);
        setMatchedIds((prev) => [...prev, c1.id, c2.id]);
        setFlipped([]);
      }, 2000);
    } else {
      setTimeout(() => {
        [i1, i2].forEach((i) =>
          Animated.spring(animations[i], { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }).start()
        );
        setFlipped([]);
      }, 700);

      setMismatches((prev) => {
        const next      = prev + 1;
        const prevLives = computeLives(prev);
        const newLives  = computeLives(next);

        if (newLives < prevLives) {
          animateHeart();
          if (newLives <= 0) {
            const SCORE_GAME_OVER = 75;
            setGameOverScore(SCORE_GAME_OVER);
            setShowGameOver(true);
            Speech.speak("Se acabaron las vidas.", { language: "es-ES", rate: 1 });
            (async () => {
              if (!usuarioKey) return;
              const aprobado = SCORE_GAME_OVER >= 70;
              await AsyncStorage.multiSet([
                [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`,     "true"],
                [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`,    String(SCORE_GAME_OVER)],
                [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_aprobado`, String(aprobado)],
                [`u:${usuarioKey}:isla${ISLA_KEY}_nivel37_lectura_unlocked`,          "true"],
              ]);
              setSavedFinalScore(SCORE_GAME_OVER);
              setSavedAprobado(aprobado);
              try { await saveResultadoVisual(SCORE_GAME_OVER); } catch {}
            })();
          } else {
            setShowTryAgain(true);
          }
        }
        setLives(newLives);
        return next;
      });
    }
  }, [flipped]);

  /* ── Todas las parejas encontradas ── */
  useEffect(() => {
    if (!usuarioKey) return;
    if (baseCount > 0 && matchedIds.length === baseCount) {
      setTimeout(async () => {
        const aprobado = score >= 70;
        await AsyncStorage.multiSet([
          [PROG_VISUAL_DONE_KEY,    "true"],
          [PROG_VISUAL_SCORE_KEY,   String(score)],
          [PROG_VISUAL_APROBADO_KEY, String(aprobado)],
          [PROG_LECTURA_UNLOCK_KEY, "true"],
        ]);
        setSavedFinalScore(score);
        setSavedAprobado(aprobado);
        try { await saveResultadoVisual(); } catch {}
        setSuccessVisible(true);
        fadeAnim.setValue(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
        Speech.speak("Excelente, has encontrado todas las parejas.", { language: "es-ES", rate: 1 });
      }, 400);
    }
  }, [matchedIds, baseCount, usuarioKey]);

  /* ── Reset ── */
  const resetAll = () => {
    const newCards = buildCards();
    setCards(newCards);
    animations.splice(0, animations.length);
    newCards.forEach(() => animations.push(new Animated.Value(0)));
    setFlipped([]); setMatchedIds([]);
    setPairPreview(null);
    setMismatches(0); setLives(MAX_LIVES);
    setShowTryAgain(false); setShowGameOver(false);
    setProgressVisible(false); setGameOverScore(null);
  };

  const openProgressOverlay = () => {
    setProgressVisible(true);
    progressFade.setValue(0);
    Animated.timing(progressFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const msg = remainingPairs > 0
      ? `Te faltan ${remainingPairs} pareja${remainingPairs === 1 ? "" : "s"} por encontrar.`
      : "Ya has encontrado todas las parejas.";
    Speech.speak(msg, { language: "es-ES", rate: 1 });
  };

  /* =========================================================
     GRID — 7 parejas = 14 cartas → 4 columnas x 4 filas
     (la fila extra tiene 2 cartas centradas)
  ========================================================= */
  const { width } = Dimensions.get("window");
  const COLS       = 4;
  const GRID_WIDTH = width * 0.53;
  const CARD_GAP   = scaleDP(5);
  const CARD_SIZE  = Math.floor((GRID_WIDTH - CARD_GAP * (COLS - 1)) / COLS);

  const shakeX = breakShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  /* ── Render carta ── */
  const renderCard = (card: Card, index: number) => {
    const rotateFront = animations[index].interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
    const rotateBack  = animations[index].interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
    const isLastInRow = (index + 1) % COLS === 0;

    return (
      <TouchableOpacity
        key={card.id}
        activeOpacity={0.9}
        onPress={() => flipCard(index)}
        style={[
          styles.cardWrapper,
          { width: CARD_SIZE, height: CARD_SIZE, marginRight: isLastInRow ? 0 : CARD_GAP, marginBottom: CARD_GAP },
        ]}
      >
        <View style={{ flex: 1, borderRadius: scaleDP(12), overflow: "hidden" }}>
          {/* Cara oculta */}
          <Animated.View style={[
            styles.card, styles.front,
            { position: "absolute", inset: 0 as any, transform: [{ perspective: 1000 }, { rotateY: rotateFront }], backfaceVisibility: "hidden" },
          ]}>
            <Text style={styles.cardText}>?</Text>
          </Animated.View>
          {/* Cara imagen */}
          <Animated.View style={[
            styles.card,
            { position: "absolute", inset: 0 as any, transform: [{ perspective: 1000 }, { rotateY: rotateBack }], backfaceVisibility: "hidden" },
          ]}>
            <Image source={card.source} style={{ width: "100%", height: "100%", resizeMode: "cover" }} />
          </Animated.View>
        </View>
      </TouchableOpacity>
    );
  };

  /* =========================================================
     RENDER PRINCIPAL
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* ── INTRO ── */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Visual – Metrología</Text>
            <Text style={styles.descripcion}>
              En este nivel pondrás a prueba tu memoria visual con los instrumentos de medición de AGP.{"\n\n"}
              Encuentra las 7 parejas: cada instrumento tiene su imagen y su concepto correspondiente.{"\n\n"}
              Tienes <Text style={{ fontWeight: "900" }}>5 vidas</Text>. Usa tu memoria con estrategia y asocia cada herramienta con su definición.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={() => { setShowIntro(false); setShowGame(true); }}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── JUEGO ── */}
      {showGame && (
        <View style={styles.gameContainer}>
          <Animated.Text style={[styles.lives, { transform: [{ scale: heartScale }] }]}>
            <Text style={{ color: "red", fontSize: scaleDP(25) }}>❤️ </Text>
            {lives}
          </Animated.Text>
          <View style={styles.rowContainer}>
            <TouchableOpacity
              style={[styles.sideButton, { backgroundColor: "#B2B2B2" }]}
              onPress={() => router.push(RUTA_VOLVER as any)}
            >
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>

            {/* Grid 4 columnas, 4 filas (14 cartas) */}
            <View style={[
              styles.grid,
              {
                width:          GRID_WIDTH,
                height:         CARD_SIZE * 4 + CARD_GAP * 3,
                marginHorizontal: scaleDP(10),
              },
            ]}>
              {cards.map((c, i) => renderCard(c, i))}
            </View>

            <TouchableOpacity
              style={[styles.sideButton, { backgroundColor: "#4C92E4" }]}
              onPress={openProgressOverlay}
            >
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PREVIEW PAREJA ENCONTRADA ── */}
      {pairPreview && (
        <View style={styles.overlay}>
          <View style={styles.pairContainer}>
            <Image source={pairPreview.img1} style={styles.pairImage} resizeMode="contain" />
            <Image source={pairPreview.img2} style={styles.pairImage} resizeMode="contain" />
          </View>
        </View>
      )}

      {/* ── -1 VIDA ── */}
      {showTryAgain && (
        <View style={[styles.overlay, { zIndex: 999 }]}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, {
              opacity: breakOpacity,
              transform: [{ scale: breakScale }, { translateX: shakeX }],
            }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
          </View>
        </View>
      )}

      {/* ── GAME OVER ── */}
      {showGameOver && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertBox, { opacity: 1 }]}>
            <Text style={styles.scoreBig}>75%</Text>
            <Text style={styles.alertText}>Se han acabado las vidas 💔</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.push(RUTA_VOLVER as any)}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── ÉXITO ── */}
      {successVisible && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertBox, {
            opacity: fadeAnim,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }]}>
            <Text style={styles.scoreBig}>{(savedFinalScore ?? score)}%</Text>
            <Text style={styles.alertText}>¡Excelente! Has encontrado todas las parejas 🎉</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => { setSuccessVisible(false); router.push(RUTA_VOLVER as any); }}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ── PROGRESO ── */}
      {progressVisible && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertBox, {
            opacity: progressFade,
            transform: [{ scale: progressFade.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }]}>
            <Text style={styles.progressTitle}>Progreso del nivel</Text>
            <Text style={styles.alertText}>
              {remainingPairs > 0
                ? `Te faltan ${remainingPairs} pareja${remainingPairs === 1 ? "" : "s"} por encontrar.`
                : "Ya has encontrado todas las parejas."}
            </Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => setProgressVisible(false)}
            >
              <Text style={styles.modalBtnText}>Seguir jugando</Text>
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
  background:    { flex: 1, alignItems: "center", justifyContent: "center" },
  header:        { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(20),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  titulo:         { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion:    { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton:     { marginTop: scaleDP(40), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  lives:         { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C", fontSize: scaleDP(25), marginTop: scaleDP(-50), marginBottom: scaleDP(10) },
  rowContainer:  { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scaleDP(20) },
  grid:          { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "center" },
  cardWrapper:   { borderRadius: scaleDP(12) },
  card:          { flex: 1, borderRadius: scaleDP(12), justifyContent: "center", alignItems: "center", borderWidth: scaleDP(2), borderColor: "#4C92E4" },
  front:         { backgroundColor: "#8FC5CF" },
  cardText:      { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#fff" },
  sideButton:    { paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(20), borderRadius: scaleDP(10) },
  buttonText:    { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(25) },

  overlay:       { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  pairContainer: { flexDirection: "row", backgroundColor: "#fff", padding: scaleDP(20), borderRadius: scaleDP(20), elevation: 10 },
  pairImage:     { width: scaleDP(400), height: scaleDP(400), marginHorizontal: scaleDP(15) },

  alertBox:      { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "85%", alignItems: "center" },
  scoreBig:      { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(80), marginBottom: scaleDP(12) },
  alertText:     { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(40), textAlign: "center" },
  progressTitle: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(50), marginBottom: scaleDP(10), textAlign: "center" },

  modalBoxSmall: { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(20), alignItems: "center", elevation: 8 },
  bigHeart:      { fontSize: scaleDP(100), color: "red" },
  minusOneText:  { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#DC2626", marginTop: scaleDP(-10) },

  modalBtn:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(50) },
});