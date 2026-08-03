import { useRouter } from "expo-router";
import React, { useEffect, useState, useRef, useMemo } from "react";
import {
  Alert,
  Animated,
  Image,
  ImageBackground,
  LayoutChangeEvent,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Line } from "react-native-svg";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

const fondo   = require("../assets/islas/fondogeneral.png");
const API_URL = API_BASE_URL;

// ── Config ──────────────────────────────────────────────────────────────────
const NIVEL_KEY_API      = 6;
const NIVEL_KEY_PROGRESO = 1;
const ISLA_KEY           = 2;
const NUM_MODULES        = 4;

// Vidas por módulo según cantidad de pares
const PAIRS_PER_MODULE = [5, 4, 4, 3];

// ── Helpers matemáticos ─────────────────────────────────────────────────────
function computeScore(mistakes: number, totalPairs: number) {
  const effMiss = Math.max(0, mistakes);
  return Math.round(60 + 40 * Math.pow(totalPairs / (totalPairs + effMiss), 0.8));
}

// ── Tipos ───────────────────────────────────────────────────────────────────
type PairItem   = { id: number; pairId: number; leftImage: string; rightImage: string };
type Module     = { index: number; leftItems: PairItem[]; rightItems: PairItem[]; matchedPairs: number[]; mistakesInModule: number };
type BoxPos     = { x: number; y: number; width: number; height: number };
type Connection = { leftId: number; rightId: number; color: string };

// ── Helpers generales ───────────────────────────────────────────────────────
async function apiJson(url: string, options?: RequestInit) {
  const res  = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || data?.error || `Error ${res.status}`);
  return data;
}

function safeUri(uri: string) {
  const u = String(uri || "").trim();
  if (!u) return "";
  if (u.includes("sacorrhh") || u.includes("blob.core.windows.net")) {
    let az = u;
    const idx = u.indexOf("https://");
    if (idx !== -1) az = u.substring(idx);
    let cl = az.replace(/\\/g, "/").replace(/\/+/g, "/").replace("https:/sacorrhh", "https://sacorrhh");
    if (!cl.startsWith("https://")) cl = "https://" + cl.replace(/^https?:\/\//, "");
    return cl;
  }
  return u.startsWith("http") ? u : u.startsWith("/") ? `${API_URL}${u}` : u;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCenter(pos?: BoxPos) {
  if (!pos) return { x: 0, y: 0 };
  return { x: pos.x + pos.width / 2, y: pos.y + pos.height / 2 };
}

async function ensureUsuarioKey(): Promise<number | null> {
  const k = await AsyncStorage.getItem("USUARIO_KEY");
  const n = Number(k);
  if (k && Number.isFinite(n) && n > 0) return n;
  const cedula = await AsyncStorage.getItem("USUARIO_CEDULA");
  if (!cedula) return null;
  const res  = await fetch(`${API_URL}/api/usuarios/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cedula }) });
  if (!res.ok) return null;
  const data = await res.json();
  const uk   = data?.usuarioKey ?? data?.USUARIO_KEY ?? data?.data?.usuarioKey;
  if (uk && uk > 0) { await AsyncStorage.setItem("USUARIO_KEY", String(uk)); return uk; }
  return null;
}

// ── Componente principal ────────────────────────────────────────────────────
export default function NivelVisualHSE() {
  const router = useRouter();

  const [usuarioKey,    setUsuarioKey]    = useState<number | null>(null);
  const [allPairs,      setAllPairs]      = useState<PairItem[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [savedScore,    setSavedScore]    = useState<number | null>(null);

  const [showIntro,          setShowIntro]          = useState(true);
  const [showGame,           setShowGame]           = useState(false);
  const [showSuccess,        setShowSuccess]        = useState(false);
  const [showModuleComplete, setShowModuleComplete] = useState(false);

  const [currentModule, setCurrentModule] = useState(0);
  const [modules,       setModules]       = useState<Module[]>([]);
  const [selectedLeft,  setSelectedLeft]  = useState<number | null>(null);
  const [matchedPairs,  setMatchedPairs]  = useState<Connection[]>([]);
  const [wrongFlash,    setWrongFlash]    = useState<{ leftId: number; rightId: number } | null>(null);

  const [leftPositions,  setLeftPositions]  = useState<Record<number, BoxPos>>({});
  const [rightPositions, setRightPositions] = useState<Record<number, BoxPos>>({});
  const [leftColLayout,  setLeftColLayout]  = useState<BoxPos | null>(null);
  const [rightColLayout, setRightColLayout] = useState<BoxPos | null>(null);

  const [totalMistakes, setTotalMistakes] = useState(0);

  // ── Vidas por módulo ─────────────────────────────────────────────────────
  const [moduleLives, setModuleLives] = useState<number[]>([...PAIRS_PER_MODULE]);

  // ── Overlay -1 vida ──────────────────────────────────────────────────────
  const [showTryAgain, setShowTryAgain] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);
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

  const shakeX = breakShake.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-6, 0, 6],
  });

  // ── Animación corazón ────────────────────────────────────────────────────
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

  const [zoomVisible, setZoomVisible] = useState(false);
  const [zoomUri,     setZoomUri]     = useState("");

  const [boardHeight, setBoardHeight] = useState(0);

  const successAnim = useRef(new Animated.Value(0)).current;

  const mod                = modules[currentModule];
  const totalModules       = modules.length;
  const matchedCount       = mod?.matchedPairs.length || 0;
  const totalPairsInModule = mod?.leftItems.length || 0;
  const currentLives       = moduleLives[currentModule] ?? PAIRS_PER_MODULE[currentModule] ?? 5;
  const totalPairs         = PAIRS_PER_MODULE.reduce((a, b) => a + b, 0);
  const score              = computeScore(totalMistakes, totalPairs);

  const cellSize = useMemo(() => {
    const pairs = totalPairsInModule || PAIRS_PER_MODULE[currentModule] || 5;
    if (boardHeight <= 0) {
      if (pairs <= 3) return scaleDP(110);
      if (pairs <= 4) return scaleDP(95);
      return scaleDP(78);
    }
    const boardPadding = scaleDP(10) * 2;
    const gapBetween   = scaleDP(6) * (pairs - 1);
    const available    = boardHeight - boardPadding - gapBetween;
    const computed     = Math.floor(available / pairs);
    return Math.max(scaleDP(60), Math.min(scaleDP(150), computed));
  }, [totalPairsInModule, currentModule, boardHeight]);

  // Keys de progreso
  const doneKey   = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROGRESO}_visual_done`;
  const scoreKey  = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROGRESO}_visual_score`;
  const unlockKey = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel2_lectura_unlocked`;

  // ── Sesión ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const uk = await ensureUsuarioKey();
      if (!uk) {
        Alert.alert("Falta sesión", "No se encontró usuario.", [{ text: "OK", onPress: () => router.replace("/registration") }]);
        return;
      }
      setUsuarioKey(uk);
    })();
  }, []);

  // ── Verificar si ya jugó ────────────────────────────────────────────────
  useEffect(() => {
    if (!usuarioKey) return;
    (async () => {
      const done = await AsyncStorage.getItem(doneKey);
      const s    = await AsyncStorage.getItem(scoreKey);
      if (done === "true") {
        setSavedScore(s ? Number(s) : 0);
        setAlreadyPlayed(true);
        setShowIntro(false);
        setShowSuccess(true);
        successAnim.setValue(1);
      }
    })();
  }, [usuarioKey]);

  // ── Cargar pares desde BD ───────────────────────────────────────────────
  useEffect(() => {
    if (!usuarioKey || alreadyPlayed) return;
    loadPairs();
  }, [usuarioKey, alreadyPlayed]);

  const loadPairs = async () => {
    try {
      setLoading(true);
      const r        = await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY_API}`);
      const imagenes = Array.isArray(r?.data?.imagenes) ? r.data.imagenes : [];
      if (!imagenes.length) { Alert.alert("Error", "No hay imágenes en BD para este nivel."); return; }

      const items: PairItem[] = imagenes.map((p: any, idx: number) => ({
        id:         idx + 1,
        pairId:     p.pairId || p.VISUAL_KEY || idx + 1,
        leftImage:  safeUri(p.fotoUrl || p.VISUAL_IMAGEN_FOTO || ""),
        rightImage: safeUri(p.conceptoUrl || p.VISUAL_IMAGEN_CONCEPTO || ""),
      }));

      console.log("📦 Pares cargados:", items.length);
      setAllPairs(items);
      initModules(items);
    } catch (e) {
      console.error("Error cargando pares:", e);
      Alert.alert("Error", "No se pudieron cargar las imágenes.");
    } finally {
      setLoading(false);
    }
  };

  // ── Inicializar módulos ──────────────────────────────────────────────────
  const initModules = (items: PairItem[]) => {
    if (!items?.length) return;
    const newMods: Module[] = [];
    let offset = 0;

    for (let i = 0; i < NUM_MODULES; i++) {
      const count = PAIRS_PER_MODULE[i] ?? Math.ceil(items.length / NUM_MODULES);
      const slice = items.slice(offset, offset + count);
      offset += count;
      if (!slice.length) continue;
      newMods.push({
        index:            newMods.length,
        leftItems:        shuffleArray([...slice]),
        rightItems:       shuffleArray([...slice]),
        matchedPairs:     [],
        mistakesInModule: 0,
      });
    }

    setModules(newMods);
    setModuleLives([...PAIRS_PER_MODULE]);
    console.log("📦 Módulos:", newMods.map((m, i) => `M${i + 1}: ${m.leftItems.length} pares`).join(", "));
  };

  // ── Iniciar juego ───────────────────────────────────────────────────────
  const startGame = () => {
    setShowIntro(false);
    setShowGame(true);
    setCurrentModule(0);
    setTotalMistakes(0);
    setMatchedPairs([]);
    setSelectedLeft(null);
    setWrongFlash(null);
    setShowTryAgain(false);
    setShowGameOver(false);
    setBoardHeight(0);
    initModules(allPairs);
  };

  // ── Layouts ─────────────────────────────────────────────────────────────
  const onLayoutLeft  = (id: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setLeftPositions(p => ({ ...p, [id]: { x, y, width, height } }));
  };
  const onLayoutRight = (id: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setRightPositions(p => ({ ...p, [id]: { x, y, width, height } }));
  };
  const onLayoutLeftCol  = (e: LayoutChangeEvent) => setLeftColLayout(e.nativeEvent.layout);
  const onLayoutRightCol = (e: LayoutChangeEvent) => setRightColLayout(e.nativeEvent.layout);
  const onLayoutBoard    = (e: LayoutChangeEvent) => {
    const { height } = e.nativeEvent.layout;
    if (height > 0) setBoardHeight(height);
  };

  // ── Match logic ─────────────────────────────────────────────────────────
  const isMatchedLeft  = (id: number) => matchedPairs.some(m => m.leftId === id);
  const isMatchedRight = (id: number) => matchedPairs.some(m => m.rightId === id);

  const handleLeft = (id: number) => {
    if (isMatchedLeft(id)) return;
    setSelectedLeft(selectedLeft === id ? null : id);
  };

  const handleRight = (rightId: number) => {
    if (!selectedLeft) {
      Alert.alert("Selecciona primero", "Toca una imagen de la columna izquierda.");
      return;
    }
    if (isMatchedRight(rightId)) return;

    const leftItem  = mod?.leftItems.find(i => i.id === selectedLeft);
    const rightItem = mod?.rightItems.find(i => i.id === rightId);
    if (!leftItem || !rightItem) return;

    const correct = leftItem.pairId === rightItem.pairId;

    if (correct) {
      setMatchedPairs(prev => [...prev, { leftId: selectedLeft, rightId, color: "#16A34A" }]);
      const updated = [...modules];
      updated[currentModule].matchedPairs = [...updated[currentModule].matchedPairs, leftItem.pairId];
      setModules(updated);
      setSelectedLeft(null);
      if (matchedCount + 1 >= totalPairsInModule) handleModuleComplete();
    } else {
      setWrongFlash({ leftId: selectedLeft, rightId });

      const nm = totalMistakes + 1;
      setTotalMistakes(nm);

      const updated = [...modules];
      updated[currentModule].mistakesInModule += 1;
      setModules(updated);

      const newLives = [...moduleLives];
      newLives[currentModule] = Math.max(0, newLives[currentModule] - 1);
      setModuleLives(newLives);

      animateHeart();

      if (newLives[currentModule] <= 0) {
        setWrongFlash(null);
        setSelectedLeft(null);
        setShowGameOver(true);
      } else {
        setShowTryAgain(true);
        setTimeout(() => {
          setWrongFlash(null);
          setSelectedLeft(null);
        }, 450);
      }
    }
  };

  const handleModuleComplete = () => {
    if (currentModule < totalModules - 1) {
      setShowModuleComplete(true);
    } else {
      finishLevel();
    }
  };

  const goNextModule = () => {
    setShowModuleComplete(false);
    setCurrentModule(c => c + 1);
    setMatchedPairs([]);
    setSelectedLeft(null);
    setWrongFlash(null);
    setShowTryAgain(false);
    setShowGameOver(false);
    setLeftPositions({});
    setRightPositions({});
    setBoardHeight(0);
  };

  const restartModule = () => {
    const offset = PAIRS_PER_MODULE.slice(0, currentModule).reduce((a, b) => a + b, 0);
    const count  = PAIRS_PER_MODULE[currentModule] ?? 0;
    const slice  = allPairs.slice(offset, offset + count);

    const updated = [...modules];
    updated[currentModule] = {
      ...updated[currentModule],
      leftItems:        shuffleArray([...slice]),
      rightItems:       shuffleArray([...slice]),
      matchedPairs:     [],
      mistakesInModule: 0,
    };
    setModules(updated);

    const newLives = [...moduleLives];
    newLives[currentModule] = PAIRS_PER_MODULE[currentModule];
    setModuleLives(newLives);

    setMatchedPairs([]);
    setSelectedLeft(null);
    setWrongFlash(null);
    setShowTryAgain(false);
    setShowGameOver(false);
  };

  // ── Guardar resultado ───────────────────────────────────────────────────
  const finishLevel = async () => {
    const finalScore = score;
    const aprobado   = finalScore >= 70;

    try {
      await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY_API}/resultado`, {
        method: "POST",
        body: JSON.stringify({ usuarioKey, puntaje: finalScore, aprobado, mismatches: totalMistakes, livesLeft: currentLives }),
      });
      await AsyncStorage.multiSet([
        [doneKey,   "true"],
        [scoreKey,  String(finalScore)],
        [unlockKey, "true"],
      ]);
      setSavedScore(finalScore);
      console.log("✅ Guardado:", finalScore);
    } catch (e) {
      console.error("❌ Error guardando:", e);
    }

    setShowGame(false);
    setShowSuccess(true);
    successAnim.setValue(0);
    Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  // ── Líneas de conexión ───────────────────────────────────────────────────
  const renderLines = () => {
    if (!leftColLayout || !rightColLayout) return null;
    return matchedPairs.map((line, i) => {
      const l = leftPositions[line.leftId];
      const r = rightPositions[line.rightId];
      if (!l || !r) return null;
      const p1 = getCenter({ x: leftColLayout.x + l.x,  y: leftColLayout.y + l.y,  width: l.width, height: l.height });
      const p2 = getCenter({ x: rightColLayout.x + r.x, y: rightColLayout.y + r.y, width: r.width, height: r.height });
      return (
        <Line
          key={`${line.leftId}-${line.rightId}-${i}`}
          x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke={line.color}
          strokeWidth={scaleDP(4)}
          strokeLinecap="round"
        />
      );
    });
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4C92E4" />
          <Text style={styles.loadingText}>Cargando imágenes...</Text>
        </View>
      </ImageBackground>
    );
  }

  // ── Ya jugó ─────────────────────────────────────────────────────────────
  if (alreadyPlayed && savedScore !== null && showSuccess) {
    return (
      <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.center}>
          <View style={styles.alertBox}>
            <Text style={styles.scoreBig}>{savedScore}%</Text>
            <Text style={styles.alertText}>
              {savedScore >= 70 ? "¡Ya completaste este nivel! 🎉" : "Completaste el nivel."}
            </Text>
            <TouchableOpacity style={[styles.btn, { marginTop: scaleDP(20) }]} onPress={() => router.replace("/HSE")}>
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  // ── Módulo completado ────────────────────────────────────────────────────
  if (showModuleComplete) {
    return (
      <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.center}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>🎉 ¡Módulo {currentModule + 1} completado!</Text>
            <Text style={styles.descripcionIntro}>
              Muy bien, sigue así.{"\n"}Continúa con el siguiente módulo.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={goNextModule}>
              <Text style={styles.playButtonText}>Siguiente módulo</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* Zoom overlay */}
      {zoomVisible && (
        <View style={styles.zoomOverlay}>
          <TouchableOpacity style={styles.zoomContainer} onPress={() => setZoomVisible(false)} activeOpacity={1}>
            <Image source={{ uri: zoomUri }} style={styles.zoomImage} resizeMode="contain" />
            <Text style={styles.zoomHint}>Toca para cerrar</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ══════════ INTRO ══════════ */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Nivel Visual – HSE</Text>
            <Text style={styles.descripcionIntro}>
              En este nivel deberás observar cada imagen de seguridad y relacionarla con su concepto correcto.{"\n\n"}
              Selecciona una imagen de la columna izquierda y luego su par en la columna derecha.
              Si es correcto aparecerá una línea verde uniéndolas.{"\n\n"}
              Tienes vidas por módulo. Mantén presionada una imagen para verla más grande.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════ JUEGO ══════════ */}
      {showGame && mod && (
        <View style={styles.gameContent}>

          {/* Vidas y progreso */}
          <View style={styles.topBar}>
            <Animated.Text style={[styles.topBarText, { transform: [{ scale: heartScale }] }]}>
              ❤️ {currentLives}
            </Animated.Text>
            <Text style={styles.topBarText}>Módulo {currentModule + 1} / {totalModules}</Text>
            <Text style={styles.topBarText}>{matchedCount} / {totalPairsInModule} pares</Text>
          </View>

          {/* Indicador de módulos */}
          <View style={styles.dotsRow}>
            {[...Array(totalModules)].map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i < currentModule   && styles.dotDone,
                  i === currentModule && styles.dotNow,
                ]}
              />
            ))}
          </View>

          {/* Board con botones a los lados */}
          <View style={styles.boardRow}>

            <TouchableOpacity style={[styles.sideBtn, styles.btnGhost]} onPress={() => router.push("/HSE")}>
              <Text style={[styles.sideBtnText, { color: "#0F1B4C" }]}>Volver</Text>
            </TouchableOpacity>

            <View style={styles.board} onLayout={onLayoutBoard}>

              <View pointerEvents="none" style={StyleSheet.absoluteFillObject}>
                <Svg width="100%" height="100%">
                  {renderLines()}
                </Svg>
              </View>

              {/* Columna izquierda */}
              <View style={styles.col} onLayout={onLayoutLeftCol}>
                {mod.leftItems.map(item => {
                  const sel     = selectedLeft === item.id;
                  const matched = isMatchedLeft(item.id);
                  const wrong   = wrongFlash?.leftId === item.id;
                  return (
                    <TouchableOpacity
                      key={`L-${currentModule}-${item.id}`}
                      onPress={() => handleLeft(item.id)}
                      onLongPress={() => { setZoomUri(item.leftImage); setZoomVisible(true); }}
                      onLayout={onLayoutLeft(item.id)}
                      style={[
                        styles.imgBox,
                        { width: cellSize, height: cellSize },
                        sel     && styles.sel,
                        matched && styles.match,
                        wrong   && styles.wrong,
                      ]}
                      disabled={matched}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: item.leftImage }} style={styles.img} resizeMode="contain" />
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.lineSpace} />

              {/* Columna derecha */}
              <View style={styles.col} onLayout={onLayoutRightCol}>
                {mod.rightItems.map(item => {
                  const matched = isMatchedRight(item.id);
                  const wrong   = wrongFlash?.rightId === item.id;
                  return (
                    <TouchableOpacity
                      key={`R-${currentModule}-${item.id}`}
                      onPress={() => handleRight(item.id)}
                      onLongPress={() => { setZoomUri(item.rightImage); setZoomVisible(true); }}
                      onLayout={onLayoutRight(item.id)}
                      style={[
                        styles.imgBox,
                        { width: cellSize, height: cellSize },
                        matched && styles.match,
                        wrong   && styles.wrong,
                      ]}
                      disabled={matched}
                      activeOpacity={0.85}
                    >
                      <Image source={{ uri: item.rightImage }} style={styles.img} resizeMode="contain" />
                    </TouchableOpacity>
                  );
                })}
              </View>

            </View>

            <TouchableOpacity style={styles.sideBtn} onPress={restartModule}>
              <Text style={styles.sideBtnText}>Reiniciar{"\n"}módulo</Text>
            </TouchableOpacity>

          </View>

        </View>
      )}

      {/* ══════════ OVERLAY -1 VIDA ══════════ */}
      {showTryAgain && (
        <View style={[styles.overlay, { zIndex: 999, elevation: 999 }]}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text
              style={[
                styles.bigHeart,
                { opacity: breakOpacity, transform: [{ scale: breakScale }, { translateX: shakeX }] },
              ]}
            >
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
          </View>
        </View>
      )}

      {/* ══════════ GAME OVER del módulo ══════════ */}
      {/* ✅ FIX: zIndex 9999 para que quede por encima de las imágenes (col tiene zIndex 10) */}
      {showGameOver && (
        <View style={[styles.overlay, { zIndex: 9999, elevation: 9999 }]}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sin vidas</Text>
            <Text style={styles.modalDesc}>
              Se agotaron las vidas del módulo {currentModule + 1}.{"\n"}
              Puedes reintentar este módulo sin perder el progreso de los demás.
            </Text>
            {/* ✅ FIX: un solo botón — reintentar módulo */}
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]}
                onPress={restartModule}
              >
                <Text style={styles.modalBtnText}>Reintentar módulo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ══════════ ÉXITO ══════════ */}
      {showSuccess && !alreadyPlayed && (
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.alertBox,
              {
                opacity:   successAnim,
                transform: [{ scale: successAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
              },
            ]}
          >
            <Text style={styles.scoreBig}>{savedScore ?? score}%</Text>
            <Text style={styles.alertText}>
              {(savedScore ?? score) >= 70
                ? "¡Aprobado! Has completado el nivel visual 🎉"
                : "Completaste el nivel. Puedes intentarlo de nuevo para mejorar."}
            </Text>
            <TouchableOpacity
              style={[styles.btn, { marginTop: scaleDP(20) }]}
              onPress={() => router.replace("/HSE")}
            >
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
            {(savedScore ?? score) < 70 && (
              <TouchableOpacity
                style={[styles.btn, styles.btnSecondary, { marginTop: scaleDP(12) }]}
                onPress={() => {
                  setShowSuccess(false);
                  setCurrentModule(0);
                  setTotalMistakes(0);
                  setBoardHeight(0);
                  initModules(allPairs);
                  setShowGame(true);
                }}
              >
                <Text style={styles.btnText}>Jugar otra vez</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        </View>
      )}

    </ImageBackground>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  bg:      { flex: 1, width: "100%", height: "100%" },
  backdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.2)" },
  center:  { flex: 1, justifyContent: "center", alignItems: "center", padding: scaleDP(20) },

  loadingText: { color: "#0F1B4C", fontSize: scaleDP(20), marginTop: scaleDP(12), fontFamily: "PlusJakartaSans-Bold" },

  header: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox: {
    backgroundColor:   "rgba(143, 197, 207, 0.85)",
    paddingVertical:   scaleDP(40),
    paddingHorizontal: scaleDP(40),
    borderRadius:      scaleDP(25),
    alignItems:        "center",
    maxWidth:          "80%",
    shadowColor:       "#000",
    shadowOpacity:     0.25,
    shadowRadius:      15,
    shadowOffset:      { width: 0, height: 4 },
  },
  tituloIntro: {
    fontFamily:   "PlusJakartaSans-Bold",
    fontSize:     scaleDP(40),
    color:        "#fff",
    textAlign:    "center",
    marginBottom: scaleDP(16),
  },
  descripcionIntro: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize:   scaleDP(20),
    color:      "#fff",
    textAlign:  "center",
    lineHeight: scaleDP(25),
  },
  playButton: {
    marginTop:         scaleDP(25),
    backgroundColor:   "#4C92E4",
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(50),
    borderRadius:      scaleDP(16),
  },
  playButtonText: {
    color:      "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize:   scaleDP(25),
  },

  gameContent: {
    flex:              1,
    paddingTop:        scaleDP(10),
    paddingBottom:     scaleDP(10),
    paddingHorizontal: scaleDP(10),
    alignItems:        "center",
  },

  topBar: {
    flexDirection:     "row",
    justifyContent:    "space-between",
    width:             "98%",
    backgroundColor:   "transparent",
    paddingVertical:   scaleDP(6),
    paddingHorizontal: scaleDP(14),
    borderRadius:      scaleDP(10),
    marginBottom:      scaleDP(6),
  },
  topBarText: { color: "#070000", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14) },

  dotsRow: { flexDirection: "row", gap: scaleDP(10), marginBottom: scaleDP(6) },
  dot:     { width: scaleDP(18), height: scaleDP(18), borderRadius: scaleDP(9), backgroundColor: "rgba(15,27,76,0.25)", borderWidth: 2, borderColor: "#0F1B4C" },
  dotDone: { backgroundColor: "#1EA97C", borderColor: "#1EA97C" },
  dotNow:  { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },

  boardRow: {
    flexDirection:  "row",
    flex:           1,
    width:          "100%",
    alignItems:     "center",
    justifyContent: "center",
    marginBottom:   scaleDP(8),
  },
  sideBtn: {
    backgroundColor:   "#0F1B4C",
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(10),
    borderRadius:      scaleDP(12),
    alignItems:        "center",
    justifyContent:    "center",
    marginHorizontal:  scaleDP(30),
    minWidth:          scaleDP(70),
  },
  sideBtnText: {
    color:      "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize:   scaleDP(13),
    textAlign:  "center",
  },

  board: {
    flexDirection:   "row",
    width:           "70%",
    alignSelf:       "stretch",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderRadius:    scaleDP(16),
    padding:         scaleDP(10),
    position:        "relative",
  },

  col: {
    flex:           1,
    zIndex:         10,
    alignItems:     "center",
    justifyContent: "space-evenly",
  },

  lineSpace: { width: "14%" },

  imgBox: {
    borderWidth:     scaleDP(2),
    borderColor:     "#9DB5E4",
    backgroundColor: "#EFF6FF",
    borderRadius:    scaleDP(10),
    alignItems:      "center",
    justifyContent:  "center",
    padding:         scaleDP(4),
  },
  sel:   { borderColor: "#4C92E4", backgroundColor: "#DBEAFE" },
  match: { borderColor: "#1EA97C", backgroundColor: "#DCFCE7" },
  wrong: { borderColor: "#DC2626", backgroundColor: "#FEE2E2" },
  img:   { width: "95%", height: "95%" },

  btnGhost: {
    backgroundColor: "transparent",
    borderWidth:     2,
    borderColor:     "#0F1B4C",
  },
  btn: {
    backgroundColor:   "#0F1B4C",
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(22),
    borderRadius:      scaleDP(12),
    alignItems:        "center",
  },
  btnText:      { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },
  btnSecondary: { backgroundColor: "#1EA97C" },

  // ── Overlay general ──────────────────────────────────────────────────────
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:   "rgba(0,0,0,0.45)",
    justifyContent:    "center",
    alignItems:        "center",
    paddingHorizontal: scaleDP(24),
  },

  // ── -1 vida ───────────────────────────────────────────────────────────────
  modalBoxSmall: {
    backgroundColor:   "#fff",
    borderRadius:      scaleDP(16),
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(20),
    alignItems:        "center",
    elevation:         8,
  },
  bigHeart:    { fontSize: scaleDP(100), color: "red" },
  minusOneText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize:   scaleDP(60),
    color:      "#DC2626",
    marginTop:  scaleDP(-10),
  },

  // ── Game Over ────────────────────────────────────────────────────────────
  modalBox: {
    width:             "92%",
    backgroundColor:   "#fff",
    borderRadius:      scaleDP(16),
    paddingVertical:   scaleDP(20),
    paddingHorizontal: scaleDP(18),
    alignItems:        "center",
    elevation:         8,
  },
  modalTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize:   scaleDP(50),
    color:      "#0F1B4C",
    textAlign:  "center",
  },
  modalDesc: {
    marginTop:  scaleDP(8),
    fontFamily: "PlusJakartaSans-Regular",
    fontSize:   scaleDP(30),
    color:      "#111827",
    textAlign:  "center",
  },
  modalRow: {
    marginTop:     scaleDP(14),
    flexDirection: "row",
    gap:           scaleDP(10),
  },
  modalBtn: {
    paddingVertical:   scaleDP(12),
    paddingHorizontal: scaleDP(18),
    borderRadius:      scaleDP(10),
  },
  modalBtnText: {
    color:      "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize:   scaleDP(30),
  },

  // ── Éxito ────────────────────────────────────────────────────────────────
  alertBox: {
    backgroundColor:   "#77b479",
    paddingVertical:   scaleDP(22),
    paddingHorizontal: scaleDP(35),
    borderRadius:      scaleDP(20),
    elevation:         10,
    maxWidth:          "85%",
    alignItems:        "center",
  },
  scoreBig:  { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(100), marginBottom: scaleDP(12) },
  alertText: { fontFamily: "PlusJakartaSans-Bold",      color: "#fff", fontSize: scaleDP(35),  textAlign: "center" },

  // ── Zoom ─────────────────────────────────────────────────────────────────
  zoomOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center", zIndex: 10000 },
  zoomContainer: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  zoomImage:     { width: "90%", height: "80%" },
  zoomHint:      { color: "#aaa", fontSize: scaleDP(18), marginTop: scaleDP(15) },
});