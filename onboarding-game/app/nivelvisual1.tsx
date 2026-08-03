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

// ====== CONSTANTES PARA VIDAS / NOTA ======
const MAX_LIVES = 5;
const FREE_MISSES = 5;
const ERRORS_PER_LIFE = 2;

function computeLives(mismatches: number) {
  const paidErrors = Math.max(0, mismatches - FREE_MISSES);
  const livesLost = Math.floor(paidErrors / ERRORS_PER_LIFE);
  return Math.max(0, MAX_LIVES - livesLost);
}

function computeScore(mismatches: number) {
  const effMiss = Math.max(0, mismatches - FREE_MISSES);
  const base = 60;
  const bonus = 40 * Math.pow(8 / (8 + effMiss), 0.8);
  return Math.round(base + bonus);
}

type PairPreview = { img1: string; img2: string } | null;
type Card = { id: number; pairId: number; uri: string };

async function apiJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options?.headers || {}) },
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const msg = data?.message || data?.error || `Error HTTP ${res.status} en ${url.replace(/^https?:\/\//, "")}`;
    throw new Error(msg);
  }
  return data;
}

function extractUsuarioKey(data: any): number | null {
  const candidates = [
    data?.usuarioKey, data?.USUARIO_KEY,
    data?.data?.usuarioKey, data?.data?.USUARIO_KEY,
    data?.usuario?.usuarioKey, data?.usuario?.USUARIO_KEY,
    data?.data?.usuario?.usuarioKey, data?.data?.usuario?.USUARIO_KEY,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

async function readUsuarioKeyFromStorage(): Promise<number | null> {
  const k = await AsyncStorage.getItem("USUARIO_KEY");
  const n = Number(k);
  if (k && Number.isFinite(n) && n > 0) return n;
  return null;
}

async function ensureUsuarioKey(API_URL: string): Promise<number | null> {
  const direct = await readUsuarioKeyFromStorage();
  if (direct) return direct;
  const cedula = await AsyncStorage.getItem("USUARIO_CEDULA");
  if (!cedula) return null;
  const res = await fetch(`${API_URL}/api/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cedula }),
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) return null;
  const usuarioKey = extractUsuarioKey(data);
  if (usuarioKey && usuarioKey > 0) {
    await AsyncStorage.setItem("USUARIO_KEY", String(usuarioKey));
    return usuarioKey;
  }
  return null;
}

function safeUri(uri: string) {
  const u = String(uri || "").trim();
  if (!u) return "";
  if (u.includes("sacorrhh") || u.includes("blob.core.windows.net")) {
    let azureUrl = u;
    if (u.includes("/uploads/") || u.includes("/api/")) {
      const idx = u.indexOf("https://");
      if (idx !== -1) {
        azureUrl = u.substring(idx);
      } else if (u.includes("sacorrhh")) {
        const match = u.match(/sacorrhh/);
        if (match) {
          const sacIdx = u.indexOf("sacorrhh") - 8;
          if (sacIdx > 0 && u.substring(sacIdx).startsWith("https://")) {
            azureUrl = u.substring(sacIdx);
          } else {
            azureUrl = "https://" + u.substring(u.indexOf("sacorrhh"));
          }
        }
      }
    }
    let cleaned = azureUrl
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace("https:/sacorrhh", "https://sacorrhh")
      .replace("http:/sacorrhh", "http://sacorrhh");
    if (!cleaned.startsWith("https://")) {
      if (cleaned.startsWith("http://")) {
        cleaned = cleaned;
      } else if (cleaned.includes("https://")) {
        cleaned = cleaned.substring(cleaned.indexOf("https://"));
      } else {
        cleaned = "https://" + cleaned.replace(/^https?:\/\//, "");
      }
    }
    return cleaned;
  }
  const API_URL = API_BASE_URL;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("/")) return `${API_URL}${u}`;
  return u;
}

export default function NivelVisual1() {
  const router = useRouter();
  const fondo = require("../assets/islas/fondogeneral.png");

  const API_URL = API_BASE_URL;
  const NIVEL_KEY = 1;

  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);

  const keyU = (suffix: string) => `u:${usuarioKey ?? 0}:${suffix}`;

  const PROG_VISUAL_DONE_KEY    = keyU(`isla1_nivel${NIVEL_KEY}_visual_done`);
  const PROG_VISUAL_SCORE_KEY   = keyU(`isla1_nivel${NIVEL_KEY}_visual_score`);
  const PROG_VISUAL_APROBADO_KEY = keyU(`isla1_nivel${NIVEL_KEY}_visual_aprobado`);
  const PROG_VISUAL_MISMATCH_KEY = keyU(`isla1_nivel${NIVEL_KEY}_visual_mismatches`);
  const PROG_LECTURA_UNLOCK_KEY = keyU(`isla1_nivel2_lectura_unlocked`);
  const NIVEL_VISUAL_COMPLETADO_KEY = keyU(`nivelVisualCompletado`);

  const [showIntro, setShowIntro]   = useState(true);
  const [showGame, setShowGame]     = useState(false);
  const [imagesReady, setImagesReady] = useState(false);
  const [pairPreview, setPairPreview] = useState<PairPreview>(null);

  const [successVisible, setSuccessVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const [savedFinalScore, setSavedFinalScore] = useState<number | null>(null);
  const [savedAprobado, setSavedAprobado]     = useState<boolean | null>(null);

  const showSuccessAlert = () => {
    setSuccessVisible(true);
    Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    Speech.speak("Excelente, has encontrado todas las parejas.", { language: "es-ES", rate: 1 });
  };

  const [progressVisible, setProgressVisible] = useState(false);
  const progressFade = useRef(new Animated.Value(0)).current;

  const [mismatches, setMismatches] = useState(0);
  const [lives, setLives]           = useState(MAX_LIVES);
  const [showTryAgain, setShowTryAgain] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
  // ✅ NUEVO: score guardado al hacer game over
  const [gameOverScore, setGameOverScore] = useState<number | null>(null);

  const score = computeScore(mismatches);

  const saveResultadoVisual = async (puntajeOverride?: number) => {
    if (!usuarioKey) return;
    const puntajeFinal = puntajeOverride ?? score;
    const aprobado = puntajeFinal >= 70;
    await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY}/resultado`, {
      method: "POST",
      body: JSON.stringify({
        usuarioKey,
        puntaje: puntajeFinal,
        aprobado,
        mismatches,
        livesLeft: lives,
      }),
    });
  };

  const heartScale = useRef(new Animated.Value(1)).current;
  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

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
      Speech.speak("Perdiste una vida, sigue intentando.", { language: "es-ES", rate: 1 });
      const t = setTimeout(() => setShowTryAgain(false), 2000);
      return () => clearTimeout(t);
    }
  }, [showTryAgain]);

  useEffect(() => {
    (async () => {
      const kMain = await AsyncStorage.getItem("USUARIO_KEY");
      const ced   = await AsyncStorage.getItem("USUARIO_CEDULA");
      console.log("🧪 STORAGE EN NIVEL:", { USUARIO_KEY: kMain, USUARIO_CEDULA: ced });
      const uk = await ensureUsuarioKey(API_URL);
      console.log("🧪 ensureUsuarioKey ->", uk);
      if (!uk) {
        Alert.alert(
          "Falta sesión",
          `No se encontró usuarioKey.\n\nUSUARIO_KEY=${kMain}\nCEDULA=${ced}\n\nAPI=${API_URL}`,
          [{ text: "OK", onPress: () => router.replace("/registration") }]
        );
        return;
      }
      setUsuarioKey(uk);
    })();
  }, []);

  useEffect(() => {
    if (!usuarioKey) return;
    (async () => {
      const doneKey     = `u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_done`;
      const scoreKey    = `u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_score`;
      const aprobadoKey = `u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_aprobado`;
      const done  = await AsyncStorage.getItem(doneKey);
      const s     = await AsyncStorage.getItem(scoreKey);
      const a     = await AsyncStorage.getItem(aprobadoKey);
      console.log("🧪 Verificando nivel visual completado (AsyncStorage):", { doneKey, done, score: s });
      if (done !== "true") {
        try {
          const respuesta = await fetch(`${API_URL}/niveles/visual/${NIVEL_KEY}/estado?usuarioKey=${usuarioKey}&islaKey=1`);
          const data = await respuesta.json();
          console.log("🧪 Verificando nivel visual completado (BD):", data);
          if (data?.done || data?.completed || data?.data?.done) {
            const scoreFromBD = data?.score ?? data?.data?.score ?? data?.porcentaje ?? 100;
            setSavedFinalScore(scoreFromBD);
            setSavedAprobado(true);
            setShowIntro(false);
            setShowGame(false);
            setSuccessVisible(true);
            fadeAnim.setValue(1);
            return;
          }
        } catch (e) {
          console.log("🧪 Error verificando en BD:", e);
        }
      }
      if (done === "true") {
        const scoreNum    = s ? Number(s) : 0;
        const aprobadoBool = a === "true";
        console.log("🧪 Nivel ya completado en local, mostrando resultado:", { scoreNum, aprobadoBool });
        setSavedFinalScore(Number.isFinite(scoreNum) ? scoreNum : 0);
        setSavedAprobado(aprobadoBool);
        setShowIntro(false);
        setShowGame(false);
        setSuccessVisible(true);
        fadeAnim.setValue(1);
      } else {
        console.log("🧪 Nivel NO completado, permitiendo jugar");
      }
    })();
  }, [usuarioKey]);

  const [cards, setCards]   = useState<Card[]>([]);
  const animations = useRef<Animated.Value[]>([]).current;

  useEffect(() => {
    const load = async () => {
      try {
        setImagesReady(false);
        const r = await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY}`);
        const pairs = Array.isArray(r?.data?.imagenes) ? r.data.imagenes : [];
        if (pairs.length < 1) throw new Error("No hay imágenes en BD para este nivel.");

        const built: Card[] = [];
        let idCounter = 1;
        for (const p of pairs) {
          const fotoUrlRaw     = String(p.fotoUrl || p.VISUAL_IMAGEN_FOTO || p.VISUAL_IMAGEN_FOTO_URL || "").trim();
          const conceptoUrlRaw = String(p.conceptoUrl || p.VISUAL_IMAGEN_CONCEPTO || p.VISUAL_IMAGEN_CONCEPTO_URL || "").trim();
          const pairId = Number(p.pairId ?? p.VISUAL_KEY ?? p.VISUAL_ID ?? 0);
          const fotoUrl    = safeUri(fotoUrlRaw);
          const conceptoUrl = safeUri(conceptoUrlRaw);
          if (!fotoUrl || !conceptoUrl || !pairId) { console.warn("⚠️ Missing image data:", { fotoUrl, conceptoUrl, pairId }); continue; }
          built.push({ id: idCounter++, pairId, uri: fotoUrl });
          built.push({ id: idCounter++, pairId, uri: conceptoUrl });
        }

        if (built.length < 2) throw new Error("No se pudieron cargar suficientes imágenes del nivel.");

        const shuffled = [...built].sort(() => Math.random() - 0.5);
        setCards(shuffled);
        animations.splice(0, animations.length);
        shuffled.forEach(() => animations.push(new Animated.Value(0)));

        const uniqueUris = [...new Set(shuffled.map(c => c.uri))];
        const prefetchWithRetry = async (uri: string, retries = 3): Promise<boolean> => {
          for (let i = 0; i < retries; i++) {
            try {
              const success = await Image.prefetch(uri);
              if (success) return true;
            } catch {}
          }
          return false;
        };
        const results = await Promise.all(uniqueUris.map(uri => prefetchWithRetry(uri)));
        const successCount = results.filter(Boolean).length;
        if (successCount === 0) {
          Alert.alert("Error de conexión", "No se pudieron cargar las imágenes.", [
            { text: "Reintentar", onPress: () => load() }, { text: "Cancelar" }
          ]);
        }
        setImagesReady(true);
      } catch (e: any) {
        console.error("🔥 Error loading visual level:", e);
        setImagesReady(false);
        Speech.speak("Error cargando el nivel.", { language: "es-ES", rate: 1 });
      }
    };
    load();
  }, []);

  const baseCount = cards.length;
  const [flipped, setFlipped]     = useState<number[]>([]);
  const [matchedIds, setMatchedIds] = useState<number[]>([]);

  const interactionLocked = !!pairPreview || showTryAgain || showGameOver || lives <= 0;
  const remainingPairs    = Math.max(0, (baseCount - matchedIds.length) / 2);

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

  useEffect(() => {
    if (flipped.length === 2) {
      const [i1, i2] = flipped;
      const c1 = cards[i1];
      const c2 = cards[i2];
      if (!c1 || !c2) return;
      const isMatch = c1.pairId === c2.pairId;

      if (isMatch) {
        (async () => {
          try { await Promise.allSettled([Image.prefetch(c1.uri), Image.prefetch(c2.uri)]); } catch {}
          setPairPreview({ img1: c1.uri, img2: c2.uri });
          setTimeout(() => {
            setPairPreview(null);
            setMatchedIds((prev) => [...prev, c1.id, c2.id]);
            setFlipped([]);
          }, 2000);
        })();
      } else {
        setTimeout(() => {
          [i1, i2].forEach((i) =>
            Animated.spring(animations[i], { toValue: 0, friction: 8, tension: 10, useNativeDriver: true }).start()
          );
          setFlipped([]);
        }, 700);

        setMismatches((prev) => {
          const next = prev + 1;
          const prevLives = computeLives(prev);
          const newLives  = computeLives(next);

          if (newLives < prevLives) {
            animateHeart();
            if (newLives <= 0) {
              // ✅ GAME OVER: guardar 75% fijo, no se puede reintentar
              setShowTryAgain(false);
              const SCORE_GAME_OVER = 75;
              setGameOverScore(SCORE_GAME_OVER);
              setShowGameOver(true);
              Speech.speak("Se acabaron las vidas.", { language: "es-ES", rate: 1 });

              // Guardar async sin bloquear
              (async () => {
                if (!usuarioKey) return;
                const aprobado = SCORE_GAME_OVER >= 70;
                await AsyncStorage.multiSet([
                  [`u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_done`,      "true"],
                  [`u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_score`,     String(SCORE_GAME_OVER)],
                  [`u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_aprobado`,  String(aprobado)],
                  [`u:${usuarioKey}:isla1_nivel${NIVEL_KEY}_visual_mismatches`, String(next)],
                  [`u:${usuarioKey}:isla1_nivel2_lectura_unlocked`,            "true"],
                  [`u:${usuarioKey}:nivelVisualCompletado`,                    "true"],
                ]);
                setSavedFinalScore(SCORE_GAME_OVER);
                setSavedAprobado(aprobado);
                try { await saveResultadoVisual(SCORE_GAME_OVER); } catch (e) { console.log("Error guardando game over:", e); }
              })();
            } else {
              setShowTryAgain(true);
            }
          }

          setLives(newLives);
          return next;
        });
      }
    }
  }, [flipped]);

  useEffect(() => {
    if (!usuarioKey) return;
    if (baseCount > 0 && matchedIds.length === baseCount) {
      setTimeout(async () => {
        try { await saveResultadoVisual(); } catch (e) { console.error("Error guardando resultado visual:", e); }
        const aprobado = score >= 70;
        await AsyncStorage.multiSet([
          [PROG_VISUAL_DONE_KEY,        "true"],
          [PROG_VISUAL_SCORE_KEY,       String(score)],
          [PROG_VISUAL_APROBADO_KEY,    String(aprobado)],
          [PROG_VISUAL_MISMATCH_KEY,    String(mismatches)],
          [PROG_LECTURA_UNLOCK_KEY,     "true"],
          [NIVEL_VISUAL_COMPLETADO_KEY, "true"],
        ]);
        setSavedFinalScore(score);
        setSavedAprobado(aprobado);
        showSuccessAlert();
      }, 400);
    }
  }, [matchedIds, baseCount, usuarioKey]);

  const resetAll = () => {
    animations.forEach((a) => a?.setValue(0));
    setFlipped([]);
    setMatchedIds([]);
    setPairPreview(null);
    setMismatches(0);
    setLives(MAX_LIVES);
    setShowTryAgain(false);
    setShowGameOver(false);
    setProgressVisible(false);
    setGameOverScore(null);
    const reshuffled = [...cards].sort(() => Math.random() - 0.5);
    setCards(reshuffled);
    animations.splice(0, animations.length);
    reshuffled.forEach(() => animations.push(new Animated.Value(0)));
  };

  const { width } = Dimensions.get("window");
  const COLS = 4;
  const ROWS = 4;
  const GRID_WIDTH = width * 0.53;
  const CARD_GAP  = scaleDP(5);
  const CARD_SIZE = Math.floor((GRID_WIDTH - CARD_GAP * (COLS - 1)) / COLS);

  const renderCard = (card: Card, index: number) => {
    const rotateFront = animations[index].interpolate({ inputRange: [0, 1], outputRange: ["0deg", "180deg"] });
    const rotateBack  = animations[index].interpolate({ inputRange: [0, 1], outputRange: ["180deg", "360deg"] });
    const isLastInRow = (index + 1) % COLS === 0;

    return (
      <TouchableOpacity
        key={card.id}
        activeOpacity={0.9}
        onPress={() => flipCard(index)}
        style={[styles.cardWrapper, { width: CARD_SIZE, height: CARD_SIZE, marginRight: isLastInRow ? 0 : CARD_GAP, marginBottom: CARD_GAP }]}
      >
        <View style={{ flex: 1, borderRadius: scaleDP(12), overflow: "hidden" }}>
          <Animated.View style={[styles.card, styles.front, { position: "absolute", inset: 0 as any, transform: [{ perspective: 1000 }, { rotateY: rotateFront }], backfaceVisibility: "hidden" }]}>
            <Text style={styles.cardText}>?</Text>
          </Animated.View>
          <Animated.View style={[styles.card, { position: "absolute", inset: 0 as any, transform: [{ perspective: 1000 }, { rotateY: rotateBack }], backfaceVisibility: "hidden" }]}>
            <Image
              source={{ uri: card.uri }}
              style={{ width: "100%", height: "100%", resizeMode: "cover" }}
              resizeMethod="resize"
              onError={(e) => console.log("❌ Image load error:", card.uri, e.nativeEvent.error)}
              onLoadStart={() => console.log("📥 Loading image:", card.uri)}
              onLoad={() => console.log("✅ Image loaded:", card.uri)}
            />
          </Animated.View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!imagesReady) {
    return (
      <View style={[styles.background, { justifyContent: "center" }]}>
        <Text style={{ fontSize: scaleDP(50), color: "#fff", fontFamily: "PlusJakartaSans-Bold" }}>
          Cargando imágenes...
        </Text>
      </View>
    );
  }

  const shakeX = breakShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  const openProgressOverlay = () => {
    setProgressVisible(true);
    progressFade.setValue(0);
    Animated.timing(progressFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    const msg = remainingPairs > 0
      ? `Te faltan ${remainingPairs} pareja${remainingPairs === 1 ? "" : "s"} por encontrar.`
      : "Ya has encontrado todas las parejas.";
    Speech.speak(msg, { language: "es-ES", rate: 1 });
  };

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">

      {/* INTRO */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Visual – Memoria y Asociación</Text>
            <Text style={styles.descripcion}>
              En este nivel entrenarás tu memoria visual y tu capacidad de asociación. Cada tarjeta oculta una imagen o
              un concepto, y tu misión es encontrar las parejas correctas.{"\n\n"}
              Observa bien, memoriza las posiciones y realiza las combinaciones exactas. Tienes un número limitado de
              vidas, así que usa tu memoria con estrategia.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={() => { setShowIntro(false); setShowGame(true); }}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* JUEGO */}
      {showGame && (
        <View style={styles.gameContainer}>
          <Animated.Text style={[styles.lives, { transform: [{ scale: heartScale }] }]}>
            <Text style={{ color: "red", fontSize: scaleDP(25) }}>❤️ </Text>
            {lives}
          </Animated.Text>
          <View style={styles.rowContainer}>
            <TouchableOpacity style={[styles.sideButton, { backgroundColor: "#B2B2B2" }]} onPress={() => router.push("Introduccion")}>
              <Text style={styles.buttonText}>Volver</Text>
            </TouchableOpacity>
            <View style={[styles.grid, { width: GRID_WIDTH, height: CARD_SIZE * ROWS + CARD_GAP * (ROWS - 1), marginHorizontal: scaleDP(10) }]}>
              {cards.map((c, i) => renderCard(c, i))}
            </View>
            <TouchableOpacity style={[styles.sideButton, { backgroundColor: "#4C92E4" }]} onPress={openProgressOverlay}>
              <Text style={styles.buttonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* PAIR PREVIEW */}
      {pairPreview && (
        <View style={styles.overlay}>
          <View style={styles.pairContainer}>
            <Image source={{ uri: pairPreview.img1 }} style={styles.pairImage} resizeMethod="resize" onError={(e) => console.log("❌ pair img1 error:", pairPreview.img1, e.nativeEvent)} />
            <Image source={{ uri: pairPreview.img2 }} style={styles.pairImage} resizeMethod="resize" onError={(e) => console.log("❌ pair img2 error:", pairPreview.img2, e.nativeEvent)} />
          </View>
        </View>
      )}

      {/* -1 VIDA */}
      {showTryAgain && (
        <View style={[styles.overlay, { zIndex: 999 }]}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: breakOpacity, transform: [{ scale: breakScale }, { translateX: shakeX }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
          </View>
        </View>
      )}

      {/* ✅ GAME OVER — mismo diseño que éxito, verde con score grande, sin reintentar */}
      {showGameOver && (
        <View style={styles.overlay}>
          <Animated.View style={[styles.alertBox, { opacity: 1 }]}>
            <Text style={styles.scoreBig}>75%</Text>
            <Text style={styles.alertText}>Se han acabado las vidas 💔</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.push("Introduccion")}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* ÉXITO */}
      {successVisible && (
        <View style={styles.overlay}>
          <Animated.View
            style={[styles.alertBox, { opacity: fadeAnim, transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
          >
            <Text style={styles.scoreBig}>{(savedFinalScore ?? score)}%</Text>
            <Text style={styles.alertText}>¡Excelente! Has encontrado todas las parejas 🎉</Text>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => { setSuccessVisible(false); router.push("Introduccion"); }}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}

      {/* PROGRESO */}
      {progressVisible && (
        <View style={styles.overlay}>
          <Animated.View
            style={[styles.alertBox, { opacity: progressFade, transform: [{ scale: progressFade.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }] }]}
          >
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

const styles = StyleSheet.create({
  background: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(20),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  titulo: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(20) },
  descripcion: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton: { marginTop: scaleDP(40), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  lives: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C", fontSize: scaleDP(25), marginTop: scaleDP(-50), marginBottom: scaleDP(10) },
  rowContainer: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: scaleDP(20) },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "center" },
  cardWrapper: { borderRadius: scaleDP(12) },
  card: { flex: 1, borderRadius: scaleDP(12), justifyContent: "center", alignItems: "center", borderWidth: scaleDP(2), borderColor: "#4C92E4" },
  front: { backgroundColor: "#8FC5CF" },
  cardText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#fff" },
  sideButton: { paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(20), borderRadius: scaleDP(10) },
  buttonText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(25) },

  overlay: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  pairContainer: { flexDirection: "row", backgroundColor: "#fff", padding: scaleDP(20), borderRadius: scaleDP(20), elevation: 10, shadowColor: "#000" },
  pairImage: { width: scaleDP(400), height: scaleDP(400), marginHorizontal: scaleDP(15), resizeMode: "contain" },

  alertBox: { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "85%", alignItems: "center" },
  scoreBig: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(80), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(40), textAlign: "center" },
  progressTitle: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(50), marginBottom: scaleDP(10), textAlign: "center" },

  modalBoxSmall: { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(20), alignItems: "center", elevation: 8 },
  bigHeart: { fontSize: scaleDP(100), color: "red" },
  minusOneText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#DC2626", marginTop: scaleDP(-10) },

  modalBox: { width: "92%", backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(18), alignItems: "center", elevation: 8 },
  modalTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(70), color: "#0F1B4C", textAlign: "center" },
  modalDesc: { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(45), color: "#111827", textAlign: "center" },
  modalRow: { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn: { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(50) },
});