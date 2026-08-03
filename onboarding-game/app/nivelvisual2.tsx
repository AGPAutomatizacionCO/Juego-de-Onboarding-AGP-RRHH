import { useRouter } from "expo-router";
import React, { useEffect, useState, useRef, useCallback } from "react";
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
  ScrollView,
  Dimensions,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Svg, { Line } from "react-native-svg";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* =========================================================
   ✅ CONFIG GENERAL
   ========================================================= */
const fondo = require("../assets/islas/fondogeneral.png");
const RUTA_VOLVER = "/HSE";
const API_URL = API_BASE_URL;
const NIVEL_KEY = 6;
const ISLA_KEY = 2;
const NUM_MODULES = 5;

const MAX_LIVES = 5;
const FREE_ERRORS = 5;

// Obtener dimensiones de pantalla
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const IS_TABLET = SCREEN_WIDTH > 600;

function computeLives(mistakes: number) {
  const paidErrors = Math.max(0, mistakes - FREE_ERRORS);
  return Math.max(0, MAX_LIVES - paidErrors);
}

function computeScore(mistakes: number) {
  const effMiss = Math.max(0, mistakes - FREE_ERRORS);
  const base = 60;
  const bonus = 40 * Math.pow(8 / (8 + effMiss), 0.8);
  return Math.round(base + bonus);
}

/* =========================================================
   ✅ TIPOS
   ========================================================= */
type PairItem = {
  id: number;
  pairId: number;
  leftImage: string;
  rightImage: string;
};

type Module = {
  index: number;
  leftItems: PairItem[];
  rightItems: PairItem[];
  matchedPairs: number[];
  mistakesInModule: number;
};

type BoxPosition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type Connection = {
  leftId: number;
  rightId: number;
  color: string;
};

/* =========================================================
   ✅ HELPERS
   ========================================================= */
async function apiJson(url: string, options?: RequestInit) {
  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });

  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || `Error HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
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
  
  if (u.startsWith("http://") || u.startsWith("https://")) {
    return u;
  }
  
  if (u.startsWith("/")) {
    return `${API_URL}${u}`;
  }
  
  return u;
}

function shuffleArray<T>(arr: T[]) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function getCenter(pos?: BoxPosition) {
  if (!pos) return { x: 0, y: 0 };
  return {
    x: pos.x + pos.width / 2,
    y: pos.y + pos.height / 2,
  };
}

async function ensureUsuarioKey(API_URL: string): Promise<number | null> {
  const k = await AsyncStorage.getItem("USUARIO_KEY");
  const n = Number(k);
  if (k && Number.isFinite(n) && n > 0) return n;

  const cedula = await AsyncStorage.getItem("USUARIO_CEDULA");
  if (!cedula) return null;

  const res = await fetch(`${API_URL}/api/usuarios/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cedula }),
  });

  if (!res.ok) return null;

  const data = await res.json();
  const usuarioKey = data?.usuarioKey ?? data?.USUARIO_KEY ?? data?.data?.usuarioKey;
  if (usuarioKey && usuarioKey > 0) {
    await AsyncStorage.setItem("USUARIO_KEY", String(usuarioKey));
    return usuarioKey;
  }

  return null;
}

/* =========================================================
   ✅ COMPONENTE PRINCIPAL
   ========================================================= */
export default function NivelVisualHSE() {
  const router = useRouter();

  const PROG_VISUAL_DONE_KEY = `u:0:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`;
  const PROG_VISUAL_SCORE_KEY = `u:0:0:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`;
  const PROG_LECTURA_UNLOCK_KEY = `u:0:isla${ISLA_KEY}_nivel2_lectura_unlocked`;

  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);
  const [allPairs, setAllPairs] = useState<PairItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [showIntro, setShowIntro] = useState(true);
  const [showGame, setShowGame] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showModuleComplete, setShowModuleComplete] = useState(false);

  // Estado del módulo actual
  const [currentModule, setCurrentModule] = useState(0);
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedLeftId, setSelectedLeftId] = useState<number | null>(null);
  const [matchedPairs, setMatchedPairs] = useState<Connection[]>([]);
  const [wrongFlash, setWrongFlash] = useState<{ leftId: number; rightId: number } | null>(null);
  
  const [leftPositions, setLeftPositions] = useState<Record<number, BoxPosition>>({});
  const [rightPositions, setRightPositions] = useState<Record<number, BoxPosition>>({});
  const [leftColumnLayout, setLeftColumnLayout] = useState<BoxPosition | null>(null);
  const [rightColumnLayout, setRightColumnLayout] = useState<BoxPosition | null>(null);
  
  const [totalMistakes, setTotalMistakes] = useState(0);

  // Variables derivadas
  const lives = computeLives(totalMistakes);
  const score = computeScore(totalMistakes);
  const currentModuleData = modules[currentModule];
  const totalModules = modules.length;
  const matchedCount = currentModuleData?.matchedPairs.length || 0;
  const totalPairsInModule = currentModuleData?.leftItems.length || 0;

  const [zoomImage, setZoomImage] = useState<{ uri: string; visible: boolean }>({ uri: "", visible: false });
  const zoomFadeAnim = useRef(new Animated.Value(0)).current;
  const zoomScaleAnim = useRef(new Animated.Value(0.5)).current;

  // Animaciones separadas para pantalla de éxito
  const successFadeAnim = useRef(new Animated.Value(0)).current;

  const handleLongPressStart = (uri: string) => {
    setZoomImage({ uri, visible: true });
    Animated.parallel([
      Animated.timing(zoomFadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(zoomScaleAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 6,
      }),
    ]).start();
  };

  const handleLongPressEnd = () => {
    Animated.parallel([
      Animated.timing(zoomFadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(zoomScaleAnim, {
        toValue: 0.5,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setZoomImage({ uri: "", visible: false });
      zoomFadeAnim.setValue(0);
      zoomScaleAnim.setValue(0.5);
    });
  };

  /* ============================
     ✅ CARGAR PARES DESDE BD
     ============================ */
  const loadPairsFromBD = async () => {
    try {
      setLoading(true);
      const r = await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY}`);
      const imagenes = Array.isArray(r?.data?.imagenes) ? r.data.imagenes : [];
      
      if (imagenes.length === 0) {
        Alert.alert("Error", "No hay imágenes en BD para este nivel.");
        return;
      }

      const items: PairItem[] = imagenes.map((p: any, idx: number) => ({
        id: idx + 1,
        pairId: p.pairId || p.VISUAL_KEY || idx + 1,
        leftImage: safeUri(p.fotoUrl || p.VISUAL_IMAGEN_FOTO || p.VISUAL_IMAGEN_FOTO_URL || ""),
        rightImage: safeUri(p.conceptoUrl || p.VISUAL_IMAGEN_CONCEPTO || p.VISUAL_IMAGEN_CONCEPTO_URL || ""),
      }));

      console.log("📦 HSE Visual: Cargados", items.length, "pares");
      setAllPairs(items);
      
      // Dividir en módulos
      initializeModules(items);
    } catch (e) {
      console.error("Error loading pairs:", e);
      Alert.alert("Error", "No se pudieron cargar los datos del nivel.");
    } finally {
      setLoading(false);
    }
  };

  const initializeModules = (items: PairItem[]) => {
    if (!items || items.length === 0) return;
    
    const totalItems = items.length;
    const pairsPerModule = Math.ceil(totalItems / NUM_MODULES);
    const newModules: Module[] = [];

    for (let i = 0; i < NUM_MODULES; i++) {
      const startIdx = i * pairsPerModule;
      const endIdx = Math.min(startIdx + pairsPerModule, totalItems);
      const modulePairs = items.slice(startIdx, endIdx);
      
      if (modulePairs.length === 0) continue;
      
      const leftItems = shuffleArray([...modulePairs]);
      const rightItems = shuffleArray([...modulePairs]);

      newModules.push({
        index: newModules.length,
        leftItems,
        rightItems,
        matchedPairs: [],
        mistakesInModule: 0,
      });
    }

    setModules(newModules);
    console.log("📦 Módulos inicializados:", newModules.length, "pares por módulo:", newModules.map(m => m.leftItems.length));
  };

  useEffect(() => {
    loadPairsFromBD();
  }, []);

  /* ============================
     ✅ PREPARAR JUEGO
     ============================ */
  const startGame = () => {
    setShowIntro(false);
    setShowGame(true);
    setCurrentModule(0);
    setTotalMistakes(0);
    setMatchedPairs([]);
    setSelectedLeftId(null);
    setWrongFlash(null);
    initializeModules(allPairs);
  };

  /* ============================
     ✅ HANDLERS DE JUEGO
     ============================ */
  const onLayoutLeft = (id: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setLeftPositions((prev) => ({ ...prev, [id]: { x, y, width, height } }));
  };

  const onLayoutRight = (id: number) => (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setRightPositions((prev) => ({ ...prev, [id]: { x, y, width, height } }));
  };

  const onLayoutLeftColumn = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setLeftColumnLayout({ x, y, width, height });
  };

  const onLayoutRightColumn = (e: LayoutChangeEvent) => {
    const { x, y, width, height } = e.nativeEvent.layout;
    setRightColumnLayout({ x, y, width, height });
  };

  const isMatchedLeft = (leftId: number) => matchedPairs.some((m) => m.leftId === leftId);
  const isMatchedRight = (rightId: number) => matchedPairs.some((m) => m.rightId === rightId);

  const handleSelectLeft = (leftId: number) => {
    if (isMatchedLeft(leftId)) return;
    if (selectedLeftId === leftId) {
      setSelectedLeftId(null);
      return;
    }
    setSelectedLeftId(leftId);
  };

  const handleSelectRight = (rightId: number) => {
    if (selectedLeftId === null) {
      Alert.alert("Selecciona primero", "Toca una imagen de la columna izquierda primero.");
      return;
    }
    if (isMatchedRight(rightId)) return;

    const leftItem = currentModuleData?.leftItems.find(item => item.id === selectedLeftId);
    const rightItem = currentModuleData?.rightItems.find(item => item.id === rightId);
    
    if (!leftItem || !rightItem) return;

    const isCorrect = leftItem.pairId === rightItem.pairId;

    if (isCorrect) {
      const newConnection: Connection = {
        leftId: selectedLeftId,
        rightId,
        color: "#16A34A",
      };
      setMatchedPairs([...matchedPairs, newConnection]);
      
      // Actualizar matchedPairs del módulo
      const updatedModules = [...modules];
      updatedModules[currentModule].matchedPairs = [
        ...updatedModules[currentModule].matchedPairs,
        leftItem.pairId
      ];
      setModules(updatedModules);
      
      setSelectedLeftId(null);

      // Verificar si completó el módulo
      const newMatchedCount = matchedCount + 1;
      if (newMatchedCount >= totalPairsInModule) {
        handleModuleComplete();
      }
    } else {
      setWrongFlash({ leftId: selectedLeftId, rightId });
      const newMistakes = totalMistakes + 1;
      setTotalMistakes(newMistakes);
      
      const updatedModules = [...modules];
      updatedModules[currentModule].mistakesInModule += 1;
      setModules(updatedModules);

      if (computeLives(newMistakes) <= 0) {
        Alert.alert(
          "Vidas agotadas",
          "Has perdido todas tus vidas. Inténtalo de nuevo.",
          [{ text: "Reiniciar", onPress: restartCurrentModule }]
        );
        return;
      }

      setTimeout(() => {
        setWrongFlash(null);
        setSelectedLeftId(null);
      }, 450);
    }
  };

  const handleModuleComplete = () => {
    if (currentModule < totalModules - 1) {
      // Ir al siguiente módulo
      setShowModuleComplete(true);
    } else {
      // Completó todos los módulos
      handleLevelComplete();
    }
  };

  const goToNextModule = () => {
    setShowModuleComplete(false);
    setCurrentModule(currentModule + 1);
    setMatchedPairs([]);
    setSelectedLeftId(null);
    setWrongFlash(null);
    setLeftPositions({});
    setRightPositions({});
  };

  const restartCurrentModule = () => {
    const updatedModules = [...modules];
    const modulePairs = allPairs.slice(
      currentModule * Math.ceil(allPairs.length / NUM_MODULES),
      (currentModule + 1) * Math.ceil(allPairs.length / NUM_MODULES)
    );
    
    updatedModules[currentModule] = {
      ...updatedModules[currentModule],
      leftItems: shuffleArray([...modulePairs]),
      rightItems: shuffleArray([...modulePairs]),
      matchedPairs: [],
      mistakesInModule: 0,
    };
    
    setModules(updatedModules);
    setMatchedPairs([]);
    setSelectedLeftId(null);
    setWrongFlash(null);
  };

  const handleLevelComplete = async () => {
    const finalScore = score;
    const aprobado = finalScore >= 70;

    try {
      await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY}/resultado`, {
        method: "POST",
        body: JSON.stringify({
          usuarioKey,
          puntaje: finalScore,
          aprobado,
          mismatches: totalMistakes,
          livesLeft: lives,
        }),
      });

      await AsyncStorage.multiSet([
        [PROG_VISUAL_DONE_KEY, "true"],
        [PROG_VISUAL_SCORE_KEY, String(finalScore)],
        [PROG_LECTURA_UNLOCK_KEY, "true"],
      ]);
    } catch (e) {
      console.error("Error guardando resultado:", e);
    }

    setShowSuccess(true);
    successFadeAnim.setValue(1);
  };

  /* ============================
     ✅ RENDER LÍNEAS
     ============================ */
  const renderLines = () => {
    if (!leftColumnLayout || !rightColumnLayout) return null;

    return matchedPairs.map((line, index) => {
      const leftLocal = leftPositions[line.leftId];
      const rightLocal = rightPositions[line.rightId];

      if (!leftLocal || !rightLocal) return null;

      const leftAbsolute: BoxPosition = {
        x: leftColumnLayout.x + leftLocal.x,
        y: leftColumnLayout.y + leftLocal.y,
        width: leftLocal.width,
        height: leftLocal.height,
      };

      const rightAbsolute: BoxPosition = {
        x: rightColumnLayout.x + rightLocal.x,
        y: rightColumnLayout.y + rightLocal.y,
        width: rightLocal.width,
        height: rightLocal.height,
      };

      const left = getCenter(leftAbsolute);
      const right = getCenter(rightAbsolute);

      return (
        <Line
          key={`${line.leftId}-${line.rightId}-${index}`}
          x1={left.x}
          y1={left.y}
          x2={right.x}
          y2={right.y}
          stroke={line.color}
          strokeWidth={scaleDP(5)}
          strokeLinecap="round"
        />
      );
    });
  };

  /* ============================
     ✅ RENDER COMPONENTES
     ============================ */
  if (loading) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FFD700" />
          <Text style={styles.loadingText}>Cargando imágenes...</Text>
        </View>
      </ImageBackground>
    );
  }

  // Pantalla de completar módulo
  if (showModuleComplete) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.moduleCompleteContainer}>
          <Text style={styles.moduleCompleteTitle}>¡Módulo {currentModule + 1} completado!</Text>
          <Text style={styles.moduleCompleteText}>
            Muy bien, continue al siguiente módulo
          </Text>
          <TouchableOpacity style={styles.playButton} onPress={goToNextModule}>
            <Text style={styles.playButtonText}>Siguiente Módulo</Text>
          </TouchableOpacity>
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* ZOOM IMAGE OVERLAY */}
      {zoomImage.visible && (
        <Animated.View 
          style={[
            styles.zoomOverlay,
            { 
              opacity: zoomFadeAnim,
              transform: [{ scale: zoomScaleAnim }]
            }
          ]}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={handleLongPressEnd}
            style={styles.zoomContainer}
          >
            <Image
              source={{ uri: zoomImage.uri }}
              style={styles.zoomImage}
              resizeMode="contain"
            />
            <Text style={styles.zoomHint}>Toca para cerrar</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* INTRO */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Visual - HSE</Text>
            <Text style={styles.descripcion}>
              Relaciona cada imagen de seguridad con su concepto correcto.
              {"\n\n"}
              Tienes {MAX_LIVES} vidas.
              {"\n"}
              Mantén presionada una imagen para verla más grande.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Comenzar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.playButton, styles.playButtonSecondary]}
              onPress={() => router.replace(RUTA_VOLVER as any)}
            >
              <Text style={styles.playButtonText}>Volver</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* JUEGO */}
      {showGame && !showSuccess && currentModuleData && (
        <ScrollView 
          style={styles.gameScroll}
          contentContainerStyle={styles.gameContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header con vidas y progreso */}
          <View style={styles.livesContainer}>
            <Text style={styles.livesText}>❤️ Vidas: {lives}</Text>
            <Text style={styles.infoText}>Módulo: {currentModule + 1}/{totalModules}</Text>
          </View>

          {/* Progress bar */}
          <View style={styles.progressContainer}>
            {[...Array(totalModules)].map((_, idx) => (
              <View 
                key={idx} 
                style={[
                  styles.progressDot,
                  idx < currentModule && styles.progressDotCompleted,
                  idx === currentModule && styles.progressDotCurrent,
                ]} 
              />
            ))}
          </View>

          {/* Parejas del módulo actual */}
          <Text style={styles.moduleProgressText}>
            Módulo {currentModule + 1}/{totalModules} | Parejas: {matchedCount}/{totalPairsInModule}
          </Text>

          {/* Board con columnas */}
          <View style={styles.boardContainer}>
            <View style={styles.board}>
              <View pointerEvents="none" style={styles.svgOverlay}>
                <Svg width="100%" height="100%">
                  {renderLines()}
                </Svg>
              </View>

              {/* Columna izquierda */}
              <View style={styles.column} onLayout={onLayoutLeftColumn}>
                {currentModuleData.leftItems.map((item) => {
                  const selected = selectedLeftId === item.id;
                  const matched = isMatchedLeft(item.id);
                  const wrong = wrongFlash?.leftId === item.id;

                  return (
                    <TouchableOpacity
                      key={`left-${currentModule}-${item.id}`}
                      activeOpacity={0.9}
                      disabled={matched}
                      onPress={() => handleSelectLeft(item.id)}
                      onLongPress={() => handleLongPressStart(item.leftImage)}
                      onPressOut={handleLongPressEnd}
                      onLayout={onLayoutLeft(item.id)}
                      style={[
                        styles.imageBox,
                        selected && styles.selectedBox,
                        matched && styles.matchedBox,
                        wrong && styles.wrongBox,
                      ]}
                    >
                      <Image
                        source={{ uri: item.leftImage }}
                        style={styles.gameImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Columna derecha */}
              <View style={styles.column} onLayout={onLayoutRightColumn}>
                {currentModuleData.rightItems.map((item) => {
                  const matched = isMatchedRight(item.id);
                  const wrong = wrongFlash?.rightId === item.id;

                  return (
                    <TouchableOpacity
                      key={`right-${currentModule}-${item.id}`}
                      activeOpacity={0.9}
                      disabled={matched}
                      onPress={() => handleSelectRight(item.id)}
                      onLongPress={() => handleLongPressStart(item.rightImage)}
                      onPressOut={handleLongPressEnd}
                      onLayout={onLayoutRight(item.id)}
                      style={[
                        styles.imageBox,
                        matched && styles.matchedBox,
                        wrong && styles.wrongBox,
                      ]}
                    >
                      <Image
                        source={{ uri: item.rightImage }}
                        style={styles.gameImage}
                        resizeMode="contain"
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </View>

          {/* Botón reiniciar */}
          <TouchableOpacity
            style={[styles.playButton, { marginTop: scaleDP(20), marginBottom: scaleDP(30) }]}
            onPress={restartCurrentModule}
          >
            <Text style={styles.playButtonText}>Reiniciar</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* SUCCESS */}
      {showSuccess && (
        <View style={styles.overlay}>
          <Animated.View
            style={[
              styles.alertBox,
              {
                opacity: successFadeAnim,
                transform: [
                  {
                    scale: successFadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.8, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={styles.scoreBig}>{score}/100</Text>
            <Text style={styles.alertText}>
              {score >= 70 ? "¡Aprobado! 🎉" : "Intenta de nuevo"}
            </Text>
            <Text style={styles.subText}>
              Completaste los {NUM_MODULES} módulos
            </Text>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(20) }]}
              onPress={() => router.replace("/HSE" as any)}
            >
              <Text style={styles.modalBtnText}>Continuar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#10B981", marginTop: scaleDP(12) }]}
              onPress={() => {
                successFadeAnim.setValue(0);
                setShowSuccess(false);
                setCurrentModule(0);
                setTotalMistakes(0);
                initializeModules(allPairs);
                setShowGame(true);
              }}
            >
              <Text style={styles.modalBtnText}>Jugar otra vez</Text>
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
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: scaleDP(24),
    marginTop: scaleDP(10),
  },
  header: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: scaleDP(IS_TABLET ? 40 : 20),
  },
  introBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingVertical: scaleDP(IS_TABLET ? 50 : 30),
    paddingHorizontal: scaleDP(IS_TABLET ? 40 : 24),
    borderRadius: scaleDP(IS_TABLET ? 30 : 20),
    alignItems: "center",
    maxWidth: scaleDP(IS_TABLET ? 700 : 500),
    width: "100%",
  },
  titulo: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDP(IS_TABLET ? 60 : 40),
    color: "#0F1B4C",
    textAlign: "center",
    marginBottom: scaleDP(IS_TABLET ? 24 : 16),
  },
  descripcion: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(IS_TABLET ? 32 : 22),
    color: "#4B5563",
    textAlign: "center",
    marginBottom: scaleDP(IS_TABLET ? 36 : 24),
    lineHeight: scaleDP(IS_TABLET ? 44 : 32),
  },
  playButton: {
    backgroundColor: "#10B981",
    paddingVertical: scaleDP(IS_TABLET ? 22 : 16),
    paddingHorizontal: scaleDP(IS_TABLET ? 60 : 40),
    borderRadius: scaleDP(IS_TABLET ? 18 : 12),
    marginVertical: scaleDP(IS_TABLET ? 12 : 8),
    minWidth: scaleDP(IS_TABLET ? 300 : 200),
    alignItems: "center",
  },
  playButtonSecondary: {
    backgroundColor: "#6B7280",
  },
  playButtonText: {
    color: "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(IS_TABLET ? 34 : 24),
  },
  gameScroll: {
    flex: 1,
  },
  gameContent: {
    paddingTop: scaleDP(20),
    paddingBottom: scaleDP(40),
    alignItems: "center",
  },
  livesContainer: {
    backgroundColor: "rgba(0,0,0,0.7)",
    paddingVertical: scaleDP(IS_TABLET ? 20 : 16),
    paddingHorizontal: scaleDP(IS_TABLET ? 40 : 30),
    borderRadius: scaleDP(IS_TABLET ? 30 : 25),
    marginBottom: scaleDP(IS_TABLET ? 24 : 20),
    flexDirection: "row",
    gap: scaleDP(IS_TABLET ? 40 : 30),
  },
  livesText: {
    color: "#fff",
    fontSize: scaleDP(IS_TABLET ? 40 : 32),
    fontFamily: "PlusJakartaSans-Bold",
  },
  infoText: {
    color: "#fff",
    fontSize: scaleDP(IS_TABLET ? 40 : 32),
    fontFamily: "PlusJakartaSans-Bold",
  },
  progressContainer: {
    flexDirection: "row",
    gap: scaleDP(IS_TABLET ? 20 : 15),
    marginBottom: scaleDP(IS_TABLET ? 24 : 20),
  },
  progressDot: {
    width: scaleDP(IS_TABLET ? 36 : 28),
    height: scaleDP(IS_TABLET ? 36 : 28),
    borderRadius: scaleDP(IS_TABLET ? 18 : 14),
    backgroundColor: "rgba(255,255,255,0.3)",
    borderWidth: scaleDP(IS_TABLET ? 3 : 2),
    borderColor: "#fff",
  },
  progressDotCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  progressDotCurrent: {
    backgroundColor: "#FFD700",
    borderColor: "#FFD700",
  },
  moduleProgressText: {
    color: "#fff",
    fontSize: scaleDP(IS_TABLET ? 34 : 28),
    fontFamily: "PlusJakartaSans-Bold",
    marginBottom: scaleDP(IS_TABLET ? 24 : 20),
  },
  boardContainer: {
    width: "100%",
    maxWidth: scaleDP(IS_TABLET ? 1200 : 1000),
    paddingHorizontal: scaleDP(IS_TABLET ? 20 : 10),
  },
  board: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: scaleDP(IS_TABLET ? 30 : 24),
    padding: scaleDP(IS_TABLET ? 24 : 20),
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: scaleDP(IS_TABLET ? 600 : 500),
  },
  svgOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 6,
    elevation: 6,
  },
  column: {
    width: "48%",
    zIndex: 10,
  },
  imageBox: {
    width: "100%",
    height: scaleDP(IS_TABLET ? 140 : 110),
    borderWidth: scaleDP(IS_TABLET ? 3 : 2),
    borderColor: "#0F1B4C",
    backgroundColor: "#EAF5F7",
    borderRadius: scaleDP(IS_TABLET ? 16 : 12),
    alignItems: "center",
    justifyContent: "center",
    marginBottom: scaleDP(IS_TABLET ? 14 : 10),
    padding: scaleDP(IS_TABLET ? 10 : 8),
  },
  selectedBox: {
    borderColor: "#2563EB",
    backgroundColor: "#DBEAFE",
  },
  matchedBox: {
    borderColor: "#16A34A",
    backgroundColor: "#DCFCE7",
  },
  wrongBox: {
    borderColor: "#DC2626",
    backgroundColor: "#FEE2E2",
  },
  gameImage: {
    width: "95%",
    height: "95%",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
  },
  alertBox: {
    backgroundColor: "#fff",
    paddingVertical: scaleDP(30),
    paddingHorizontal: scaleDP(30),
    borderRadius: scaleDP(20),
    alignItems: "center",
    width: "80%",
  },
  scoreBig: {
    fontSize: scaleDP(80),
    fontFamily: "PlusJakartaSans-ExtraBold",
    color: "#10B981",
    marginBottom: scaleDP(10),
  },
  alertText: {
    fontSize: scaleDP(32),
    fontFamily: "PlusJakartaSans-Bold",
    color: "#0F1B4C",
    textAlign: "center",
    marginBottom: scaleDP(8),
  },
  subText: {
    fontSize: scaleDP(20),
    color: "#6B7280",
    textAlign: "center",
    marginBottom: scaleDP(10),
  },
  modalBtn: {
    paddingVertical: scaleDP(14),
    paddingHorizontal: scaleDP(24),
    borderRadius: scaleDP(10),
    width: "100%",
    alignItems: "center",
  },
  modalBtnText: {
    color: "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(24),
  },
  moduleCompleteContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: scaleDP(20),
  },
  moduleCompleteTitle: {
    fontFamily: "PlusJakartaSans-ExtraBold",
    fontSize: scaleDP(48),
    color: "#FFD700",
    textAlign: "center",
    marginBottom: scaleDP(20),
  },
  moduleCompleteText: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(28),
    color: "#fff",
    textAlign: "center",
    marginBottom: scaleDP(30),
  },
  zoomOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10000,
    padding: scaleDP(IS_TABLET ? 40 : 20),
  },
  zoomContainer: {
    flex: 1,
    maxWidth: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: scaleDP(IS_TABLET ? 30 : 20),
    overflow: "hidden",
    backgroundColor: "#000",
  },
  zoomImage: {
    width: IS_TABLET ? "80%" : "100%",
    height: IS_TABLET ? "80%" : "90%",
    resizeMode: "contain",
  },
  zoomHint: {
    color: "#aaa",
    fontSize: scaleDP(IS_TABLET ? 26 : 18),
    marginTop: scaleDP(IS_TABLET ? 25 : 15),
  },
});