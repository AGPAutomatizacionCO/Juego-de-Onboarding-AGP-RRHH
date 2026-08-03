import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
   ========================================================= */
const fondo = require("../assets/islas/fondogeneral.png");
const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_URL = API_BASE_URL;
const ISLA_KEY = 3;
const NIVEL_KEY_PROG = 11;
const MOD1_LIVES = 5;
const MOD2_LIVES = 4;

/* =========================================================
   SCORE SEGÚN VIDAS RESTANTES
   5→100  4→95  3→90  2→85  1→80  0→75
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
   TIPOS
   ========================================================= */
type ItemType = "uma" | "process";

type Item = {
  id: string;
  label: string;
  type: ItemType;
  correctZone: string;
};

type ZoneLayout = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type ToolMatchItem = {
  id: string;
  label: string;
  cardImage: any;
  toolImage: any;
};

type ToolScreen = {
  id: string;
  items: ToolMatchItem[];
};

/* =========================================================
   MÓDULO 1 - ITEMS
   ========================================================= */
const ITEMS: Item[] = [
  { id: "u1", label: "UMA 1", type: "uma", correctZone: "uma1" },
  { id: "u2", label: "UMA 2", type: "uma", correctZone: "uma2" },
  { id: "u3", label: "UMA 3", type: "uma", correctZone: "uma3" },
  { id: "u4", label: "UMA 4", type: "uma", correctZone: "uma4" },
  { id: "u5", label: "UMA 5", type: "uma", correctZone: "uma5" },
  { id: "u6", label: "UMA 6", type: "uma", correctZone: "uma6" },
  { id: "uc", label: "CALIDAD", type: "uma", correctZone: "calidad" },

  { id: "p1",  label: "CORTE",             type: "process", correctZone: "uma1" },
  { id: "p2",  label: "MECANIZADO",        type: "process", correctZone: "uma1" },
  { id: "p3",  label: "SERIGRAFIA",        type: "process", correctZone: "uma2" },
  { id: "p4",  label: "VITRIFICADO",       type: "process", correctZone: "uma2" },
  { id: "p5",  label: "EMPALME",           type: "process", correctZone: "uma2" },
  { id: "p6",  label: "CURVADO",           type: "process", correctZone: "uma3" },
  { id: "p7",  label: "RECORTE",           type: "process", correctZone: "uma4" },
  { id: "p8",  label: "SENTADO DE ACEROS", type: "process", correctZone: "uma4" },
  { id: "p9",  label: "PULIDO OFFSET",     type: "process", correctZone: "uma4" },
  { id: "p10", label: "PULIDO MANUAL",     type: "process", correctZone: "uma4" },
  { id: "p11", label: "PREENSAMBLE",       type: "process", correctZone: "uma4" },
  { id: "p12", label: "TEMPLADO QUIMICO",  type: "process", correctZone: "uma4" },
  { id: "p13", label: "RUCO",              type: "process", correctZone: "uma4" },
  { id: "p14", label: "CORTE PC",          type: "process", correctZone: "uma5" },
  { id: "p15", label: "ZUND",              type: "process", correctZone: "uma5" },
  { id: "p16", label: "ENSAMBLE",          type: "process", correctZone: "uma5" },
  { id: "p17", label: "EMBOLSADO",         type: "process", correctZone: "uma6" },
  { id: "p18", label: "AUTOCLAVE",         type: "process", correctZone: "uma6" },
  { id: "p19", label: "ACABADO",           type: "process", correctZone: "calidad" },
  { id: "p20", label: "CONTROL FINAL",     type: "process", correctZone: "calidad" },
  { id: "p21", label: "REPROCESOS",        type: "process", correctZone: "uma6" },
];

const UMA_ITEMS    = ITEMS.filter((i) => i.type === "uma");
const PROCESS_ITEMS = ITEMS.filter((i) => i.type === "process");

/* =========================================================
   MÓDULO 2 - IMÁGENES
   ========================================================= */
const MODULE2_SCREENS: ToolScreen[] = [
  {
    id: "screen1",
    items: [
      { id: "herr1",  label: "PINZAS PARA SOSTENER EL VIDRIO", cardImage: require("../assets/visual3/pinzaspara1.png"),    toolImage: require("../assets/visual3/pinzaspara2.png") },
      { id: "herr2",  label: "TOYO",                           cardImage: require("../assets/visual3/toyo1.png"),          toolImage: require("../assets/visual3/toyo2.png") },
      { id: "herr3",  label: "PINZAS",                         cardImage: require("../assets/visual3/pinzas1.png"),        toolImage: require("../assets/visual3/pinzas2.png") },
      { id: "herr4",  label: "VACUÓMETRO",                     cardImage: require("../assets/visual3/vacuometro1.png"),    toolImage: require("../assets/visual3/vacuometro2.png") },
    ],
  },
  {
    id: "screen2",
    items: [
      { id: "herr5",  label: "VÁLVULAS",       cardImage: require("../assets/visual3/valvulas1.png"),  toolImage: require("../assets/visual3/valvulas2.png") },
      { id: "herr6",  label: "PISTOLA DE CALOR", cardImage: require("../assets/visual3/pistola1.png"), toolImage: require("../assets/visual3/pistola2.png") },
      { id: "herr7",  label: "CAUTINES",        cardImage: require("../assets/visual3/cautin1.png"),   toolImage: require("../assets/visual3/cautin2.png") },
      { id: "herr8",  label: "VENTOSA",         cardImage: require("../assets/visual3/ventosa1.png"),  toolImage: require("../assets/visual3/ventosa2.png") },
    ],
  },
  {
    id: "screen3",
    items: [
      { id: "herr9",  label: "ATOMIZADOR",           cardImage: require("../assets/visual3/atomizador1.png"), toolImage: require("../assets/visual3/atomizador2.png") },
      { id: "herr10", label: "PAÑITOS ANTIESTÁTICOS", cardImage: require("../assets/visual3/panitos1.png"),    toolImage: require("../assets/visual3/panitos2.png") },
      { id: "herr11", label: "DILUYENTE",             cardImage: require("../assets/visual3/diluyente1.png"),  toolImage: require("../assets/visual3/diluyente2.png") },
      { id: "herr12", label: "PRENSA DE BANCO",       cardImage: require("../assets/visual3/prensa1.png"),     toolImage: require("../assets/visual3/prensa2.png") },
    ],
  },
  {
    id: "screen4",
    items: [
      { id: "herr13", label: "PIEDRA DIAMANTADA PARA CANTO",    cardImage: require("../assets/visual3/piedracanto1.png"),   toolImage: require("../assets/visual3/piedracanto2.png") },
      { id: "herr14", label: "RASQUETA",                        cardImage: require("../assets/visual3/rasqueta1.png"),      toolImage: require("../assets/visual3/rasqueta2.png") },
      { id: "herr15", label: "FRESA PARA CAJA Y PERFORACIONES", cardImage: require("../assets/visual3/fresa1.png"),         toolImage: require("../assets/visual3/fresa2.png") },
      { id: "herr16", label: "PIEDRA DIAMANTADA PARA CHAFLAN",  cardImage: require("../assets/visual3/piedrachaflan1.png"), toolImage: require("../assets/visual3/piedrachaflan2.png") },
    ],
  },
  {
    id: "screen5",
    items: [
      { id: "herr17", label: "BOTTERO",               cardImage: require("../assets/visual3/bottero1.png"),       toolImage: require("../assets/visual3/bottero2.png") },
      { id: "herr18", label: "PULIDORA DE BANDA GRYPHON", cardImage: require("../assets/visual3/pulidorabanda1.png"), toolImage: require("../assets/visual3/pulidorabanda2.png") },
      { id: "herr19", label: "AUTOCLAVE",              cardImage: require("../assets/visual3/autoclave1.png"),     toolImage: require("../assets/visual3/autoclave2.png") },
      { id: "herr20", label: "MASTER",                 cardImage: require("../assets/visual3/master1.png"),        toolImage: require("../assets/visual3/master2.png") },
    ],
  },
  {
    id: "screen6",
    items: [
      { id: "herr21", label: "VITROJET", cardImage: require("../assets/visual3/vitrojet1.png"), toolImage: require("../assets/visual3/vitrojet2.png") },
      { id: "herr22", label: "GENIUS",   cardImage: require("../assets/visual3/genius1.png"),   toolImage: require("../assets/visual3/genius2.png") },
      { id: "herr23", label: "ZUND",     cardImage: require("../assets/visual3/zund1.png"),      toolImage: require("../assets/visual3/zund2.png") },
      { id: "herr24", label: "TAMGLASS", cardImage: require("../assets/visual3/tamglass1.png"),  toolImage: require("../assets/visual3/tamglass2.png") },
    ],
  },
];

/* =========================================================
   COLORES
   ========================================================= */
const COLORS = {
  uma:         "#D9D9D9",
  process:     "#8FC5CF",
  success:     "#BFE7C6",
  error:       "#F3B6B6",
  zoneBg:      "#F3F3F3",
  zoneBorder:  "#D5D5D5",
  boardBorder: "#C9E3E9",
  boardBg:     "rgba(255,255,255,0.94)",
  cardBoard:   "#8EBBC6",
  lifeOn:      "#EF4444",
  lifeOff:     "#D1D5DB",
};

/* =========================================================
   HELPERS
   ========================================================= */
function getItemBaseColor(type: ItemType) {
  return type === "uma" ? COLORS.uma : COLORS.process;
}

function getItemColor(type: ItemType, result: boolean | null) {
  if (result === true)  return COLORS.success;
  if (result === false) return COLORS.error;
  return getItemBaseColor(type);
}

function isInside(box: ZoneLayout, x: number, y: number) {
  return x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height;
}

function shuffleArray<T>(array: T[]) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function average(nums: number[]) {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/* =========================================================
   DRAG CARD - MÓDULO 1
   ========================================================= */
type DraggableProps = {
  item: Item;
  onDrop: (itemId: string, zoneId: string | null) => void;
  zoneLayouts: Record<string, ZoneLayout>;
  result: boolean | null;
  resetSignal: number;
};

function DraggableCard({ item, onDrop, zoneLayouts, result, resetSignal }: DraggableProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => { pan.setValue({ x: 0, y: 0 }); }, [resetSignal]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (evt) => {
          pan.flattenOffset();
          const dropX = evt.nativeEvent.pageX;
          const dropY = evt.nativeEvent.pageY;
          let matchedZone: string | null = null;
          Object.entries(zoneLayouts).forEach(([zoneId, box]) => {
            if (isInside(box, dropX, dropY)) matchedZone = zoneId;
          });
          onDrop(item.id, matchedZone);
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 8, tension: 70 }).start();
        },
      }),
    [item.id, onDrop, pan, zoneLayouts]
  );

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[styles.card, { backgroundColor: getItemColor(item.type, result), transform: pan.getTranslateTransform() }]}
    >
      <Text style={styles.cardText}>{item.label}</Text>
    </Animated.View>
  );
}

/* =========================================================
   DRAG IMAGE - MÓDULO 2
   ========================================================= */
type ToolDraggableProps = {
  item: ToolMatchItem;
  onDrop: (itemId: string, zoneId: string | null) => void;
  zoneLayouts: Record<string, ZoneLayout>;
  result: boolean | null;
  resetSignal: number;
  mode?: "viewer" | "slot";
};

function ToolDraggable({ item, onDrop, zoneLayouts, result, resetSignal, mode = "viewer" }: ToolDraggableProps) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;

  useEffect(() => { pan.setValue({ x: 0, y: 0 }); }, [resetSignal]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
          pan.setValue({ x: 0, y: 0 });
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (evt) => {
          pan.flattenOffset();
          const dropX = evt.nativeEvent.pageX;
          const dropY = evt.nativeEvent.pageY;
          let matchedZone: string | null = null;
          Object.entries(zoneLayouts).forEach(([zoneId, box]) => {
            if (isInside(box, dropX, dropY)) matchedZone = zoneId;
          });
          onDrop(item.id, matchedZone);
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false, friction: 8, tension: 70 }).start();
        },
      }),
    [item.id, onDrop, pan, zoneLayouts]
  );

  const borderColor = result === true ? "#58AE73" : result === false ? "#D87E7E" : "transparent";
  const wrapStyle  = mode === "slot" ? styles.toolImageWrapSlot   : styles.toolImageWrapViewer;
  const imageStyle = mode === "slot" ? styles.toolImageSlot       : styles.toolImageViewer;

  return (
    <Animated.View
      {...responder.panHandlers}
      style={[wrapStyle, { transform: pan.getTranslateTransform(), borderColor, borderWidth: result == null ? 0 : 3 }]}
    >
      <Image source={item.toolImage} style={imageStyle} resizeMode="contain" />
    </Animated.View>
  );
}

/* =========================================================
   COMPONENTE VIDAS — corazón único + número
   ========================================================= */
function LivesDisplay({ lives }: { lives: number }) {
  return (
    <View style={styles.livesDisplay}>
      <Text style={styles.livesHeart}>❤️</Text>
      <Text style={styles.livesNumber}>{lives}</Text>
    </View>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function ProcesosProduccionNivel1() {
  const router = useRouter();

  const [showIntro,        setShowIntro]        = useState(true);
  const [currentStage,     setCurrentStage]     = useState<"module1" | "module2">("module1");
  const [showModuleSplash, setShowModuleSplash] = useState(false);
  const [moduleTitle,      setModuleTitle]      = useState("Módulo 1");
  const [showFinalResult,  setShowFinalResult]  = useState(false);

  /* =======================
     OVERLAY VIDA PERDIDA
     ======================= */
  const [showLostLife,  setShowLostLife]  = useState(false);

  const breakScale   = useRef(new Animated.Value(0.6)).current;
  const breakOpacity = useRef(new Animated.Value(0)).current;
  const breakShake   = useRef(new Animated.Value(0)).current;

  const playLostLifeAnim = () => {
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
    ]).start(() => {
      setTimeout(() => setShowLostLife(false), 600);
    });
  };

  /* =======================
     MÓDULO 1 — FASE
     "uma"     → ubicar las UMAS en su bloque
     "process" → ubicar los procesos en su UMA
     ======================= */
  const [mod1Phase, setMod1Phase] = useState<"uma" | "process">("uma");

  // Estado compartido para ambas fases del módulo 1
  const [placed,      setPlaced]      = useState<Record<string, string | null>>({});
  const [results,     setResults]     = useState<Record<string, boolean | null>>({});
  const [zoneLayouts, setZoneLayouts] = useState<Record<string, ZoneLayout>>({});
  const [resetSignal, setResetSignal] = useState(0);
  const [module1Lives, setModule1Lives] = useState(MOD1_LIVES);
  const [module1Score, setModule1Score] = useState<number | null>(null);
  const [bankOrder,    setBankOrder]    = useState<string[]>([]);

  const zoneRefs = {
    uma1:    useRef<View>(null),
    uma2:    useRef<View>(null),
    uma3:    useRef<View>(null),
    uma4:    useRef<View>(null),
    uma5:    useRef<View>(null),
    uma6:    useRef<View>(null),
    calidad: useRef<View>(null),
  };

  /* =======================
     MÓDULO 2 STATES
     ======================= */
  const [toolScreenIndex,    setToolScreenIndex]    = useState(0);
  const [toolPlaced,         setToolPlaced]         = useState<Record<string, string | null>>({});
  const [toolResults,        setToolResults]        = useState<Record<string, boolean | null>>({});
  const [toolZoneLayouts,    setToolZoneLayouts]    = useState<Record<string, ZoneLayout>>({});
  const [toolResetSignal,    setToolResetSignal]    = useState(0);
  const [toolOrder,          setToolOrder]          = useState<ToolMatchItem[]>([]);
  const [toolLives,          setToolLives]          = useState(MOD2_LIVES);
  const [module2CardScores,  setModule2CardScores]  = useState<number[]>(Array(MODULE2_SCREENS.length).fill(0));
  const [module2Score,       setModule2Score]       = useState<number | null>(null);
  const [currentToolIndex,   setCurrentToolIndex]   = useState(0);

  const currentToolScreen = MODULE2_SCREENS[toolScreenIndex];

  const toolZoneRefs = {
    slot0: useRef<View>(null),
    slot1: useRef<View>(null),
    slot2: useRef<View>(null),
    slot3: useRef<View>(null),
  };

  const totalIslandScore = useMemo(() => {
    if (module1Score == null || module2Score == null) return 0;
    return Math.round((module1Score + module2Score) / 2);
  }, [module1Score, module2Score]);

  /* =========================================================
     INIT MÓDULO 1 — según la fase activa
     ========================================================= */
  const initMod1Phase = (phase: "uma" | "process", currentPlaced?: Record<string, string | null>) => {
    const activeItems = phase === "uma" ? UMA_ITEMS : PROCESS_ITEMS;

    if (phase === "process" && currentPlaced) {
      const merged: Record<string, string | null> = { ...currentPlaced };
      PROCESS_ITEMS.forEach((item) => { merged[item.id] = null; });
      setPlaced(merged);
    } else {
      const initialPlaced: Record<string, string | null> = {};
      activeItems.forEach((item) => { initialPlaced[item.id] = null; });
      setPlaced(initialPlaced);
    }

    setResults((prev) => {
      const next = { ...prev };
      activeItems.forEach((item) => { next[item.id] = null; });
      return next;
    });

    setBankOrder(shuffleArray(activeItems.map((i) => i.id)));
    setResetSignal((prev) => prev + 1);
    setMod1Phase(phase);

    setTimeout(() => measureZones(), 350);
  };

  useEffect(() => {
    initMod1Phase("uma");
  }, []);

  /* =========================================================
     INIT MÓDULO 2 SCREEN
     ========================================================= */
  useEffect(() => {
    if (currentStage !== "module2" || !currentToolScreen) return;

    const newPlaced:  Record<string, string | null>  = {};
    const newResults: Record<string, boolean | null> = {};

    currentToolScreen.items.forEach((item) => {
      newPlaced[item.id]  = null;
      newResults[item.id] = null;
    });

    setToolPlaced(newPlaced);
    setToolResults(newResults);
    setToolOrder(shuffleArray(currentToolScreen.items));
    setToolZoneLayouts({});
    setToolResetSignal((prev) => prev + 1);
    setToolLives(MOD2_LIVES);
    setCurrentToolIndex(0);

    const t = setTimeout(() => { measureToolZones(); }, 350);
    return () => clearTimeout(t);
  }, [toolScreenIndex, currentStage]);

  /* =========================================================
     MEDIR ZONAS MÓDULO 1
     ========================================================= */
  const measureZones = () => {
    Object.entries(zoneRefs).forEach(([zoneId, ref]) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        setZoneLayouts((prev) => ({ ...prev, [zoneId]: { x, y, width, height } }));
      });
    });
  };

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!showIntro && currentStage === "module1" && !showModuleSplash) measureZones();
    }, 400);
    return () => clearTimeout(timeout);
  }, [showIntro, currentStage, showModuleSplash, mod1Phase]);

  /* =========================================================
     MEDIR ZONAS MÓDULO 2
     ========================================================= */
  const measureToolZones = () => {
    Object.entries(toolZoneRefs).forEach(([zoneId, ref]) => {
      ref.current?.measureInWindow((x, y, width, height) => {
        setToolZoneLayouts((prev) => ({ ...prev, [zoneId]: { x, y, width, height } }));
      });
    });
  };

  /* =========================================================
     TRANSICIONES
     ========================================================= */
  const startGame = () => {
    setModuleTitle("Módulo 1");
    setShowIntro(false);
    setShowModuleSplash(true);
    setTimeout(() => { setShowModuleSplash(false); setCurrentStage("module1"); }, 1400);
  };

  const goToModule2 = () => {
    setModuleTitle("Módulo 2");
    setShowModuleSplash(true);
    setTimeout(() => { setShowModuleSplash(false); setCurrentStage("module2"); }, 1400);
  };

  const finishIsland = (finalModule2Score: number) => {
    setModule2Score(finalModule2Score);
    setShowFinalResult(true);
    guardarProgreso(finalModule2Score);
  };

  const guardarProgreso = async (mod2Score: number) => {
    try {
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(ukStr);
      if (!uk || !Number.isFinite(uk)) return;

      const m1    = module1Score ?? 0;
      const final = Math.round((m1 + mod2Score) / 2);

      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_score`, String(final)],
        [`u:${uk}:isla${ISLA_KEY}_nivel2_lectura_unlocked`,             "true"],
      ]);

      await fetch(`${API_URL}/api/niveles/visual/${NIVEL_KEY_PROG}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey: uk, puntaje: final, aprobado: final >= 70 ? 1 : 0, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY_PROG }),
      });
    } catch (e) {
      console.error("Error guardando visual3:", e);
    }
  };

  /* =========================================================
     MÓDULO 1 — DROP
     ========================================================= */
  const onDrop = (itemId: string, zoneId: string | null) => {
    setPlaced((prev)  => ({ ...prev,  [itemId]: zoneId }));
    setResults((prev) => ({ ...prev,  [itemId]: null   }));
  };

  /* =========================================================
     MÓDULO 1 — REVISAR
     ✅ Descuenta exactamente 1 vida por clic si hay errores,
        sin importar cuántos ítems estén mal.
     ========================================================= */
  const review = () => {
    const activeItems = mod1Phase === "uma" ? UMA_ITEMS : PROCESS_ITEMS;
    const newResults: Record<string, boolean | null> = {};
    let correct = 0;

    activeItems.forEach((item) => {
      const ok = placed[item.id] === item.correctZone;
      newResults[item.id] = ok;
      if (ok) correct++;
    });

    setResults(newResults);

    const allCorrect = correct === activeItems.length;

    if (allCorrect) {
      if (mod1Phase === "uma") {
        // ✅ Fase UMAS completada → pasar a fase procesos
        // Guardamos posición de las UMAS para que se vean en el board
        Alert.alert(
          "¡Muy bien!",
          "Ahora ubica los procesos en su UMA correspondiente.",
          [{ text: "Continuar", onPress: () => initMod1Phase("process", placed) }]
        );
      } else {
        // ✅ Ambas fases completadas — puntaje según vidas restantes
        setModule1Score(scoreFromLives(module1Lives));
        setTimeout(() => { goToModule2(); }, 500);
      }
      return;
    }

    // Hay al menos un error → descontar 1 sola vida
    if (module1Lives > 1) {
      setModule1Lives((prev) => prev - 1);
      setShowLostLife(true);
      playLostLifeAnim();
      return;
    }

    // Sin vidas
    const total = activeItems.length;
    const score80 = Math.round((correct / total) * 80);
    setModule1Lives(0);

    if (mod1Phase === "uma") {
      // Aún sin vidas en fase UMAS→ pasar a procesos con penalización
      setModule1Score(score80)
      Alert.alert(
        "Módulo 1 — Fase UMAS finalizada",
        `Se acabaron tus vidas. Puntaje parcial: ${score80}%.\nAhora ubica los procesos.`,
        [{ text: "Continuar", onPress: () => { setModule1Lives(MOD1_LIVES); initMod1Phase("process", placed); } }]
      );
    } else {
      const previous = module1Score ?? 100;
      const combined = Math.round((previous + score80) / 2);
      setModule1Score(combined);
      Alert.alert(
        "Módulo 1 finalizado",
        `Se acabaron tus vidas. Puntaje del módulo 1: ${combined}%.`,
        [{ text: "Continuar", onPress: () => setTimeout(() => goToModule2(), 200) }]
      );
    }
  };

  /* =========================================================
     MÓDULO 1 — REINICIAR FASE ACTUAL
     ========================================================= */
  const retry = () => {
    initMod1Phase(mod1Phase);
    setModule1Lives(MOD1_LIVES);
  };

  /* =========================================================
     RENDER ZONAS MÓDULO 1
     ========================================================= */
  const renderZoneItems = (zoneId: string) => {
    if (mod1Phase === "uma") {
      // Fase UMA: solo muestra las UMAS arrastrables
      return UMA_ITEMS
        .filter((item) => placed[item.id] === zoneId)
        .map((item) => (
          <DraggableCard
            key={`${item.id}-${zoneId}-${resetSignal}`}
            item={item}
            onDrop={onDrop}
            zoneLayouts={zoneLayouts}
            result={results[item.id]}
            resetSignal={resetSignal}
          />
        ));
    }

    // Fase PROCESS: muestra UMAS fijas (no arrastrables) + procesos arrastrables
    const umasEnZona = UMA_ITEMS.filter((item) => placed[item.id] === zoneId);
    const procesosEnZona = PROCESS_ITEMS.filter((item) => placed[item.id] === zoneId);

    return [
      // UMAS fijas — solo texto, sin drag
      ...umasEnZona.map((item) => (
        <View
          key={`${item.id}-fixed-${zoneId}`}
          style={[styles.card, { backgroundColor: "#A8D0DA", opacity: 1 }]}
          pointerEvents="none"
        >
          <Text style={styles.cardText}>{item.label}</Text>
        </View>
      )),
      // Procesos arrastrables
      ...procesosEnZona.map((item) => (
        <DraggableCard
          key={`${item.id}-${zoneId}-${resetSignal}`}
          item={item}
          onDrop={onDrop}
          zoneLayouts={zoneLayouts}
          result={results[item.id]}
          resetSignal={resetSignal}
        />
      )),
    ];
  };

  const renderBankItems = () => {
    const activeItems = mod1Phase === "uma" ? UMA_ITEMS : PROCESS_ITEMS;
    return bankOrder
      .map((id) => activeItems.find((item) => item.id === id)!)
      .filter((item) => item && placed[item.id] === null)
      .map((item) => (
        <DraggableCard
          key={`${item.id}-bank-${resetSignal}`}
          item={item}
          onDrop={onDrop}
          zoneLayouts={zoneLayouts}
          result={results[item.id]}
          resetSignal={resetSignal}
        />
      ));
  };

  /* =========================================================
     MÓDULO 2 FUNCIONES
     ========================================================= */
  const onDropTool = (itemId: string, zoneId: string | null) => {
    setToolPlaced((prev)  => ({ ...prev, [itemId]: zoneId }));
    setToolResults((prev) => ({ ...prev, [itemId]: null   }));
  };

  const saveModule2CardScore = (score: number) => {
    setModule2CardScores((prev) => {
      const next = [...prev];
      next[toolScreenIndex] = score;
      return next;
    });
  };

  const advanceToolCard = (score: number) => {
    saveModule2CardScore(score);

    if (toolScreenIndex < MODULE2_SCREENS.length - 1) {
      setToolScreenIndex((prev) => prev + 1);
    } else {
      const finalScores = [...module2CardScores];
      finalScores[toolScreenIndex] = score;
      const finalModule2Score = average(finalScores);
      finishIsland(finalModule2Score);
    }
  };

  const reviewToolScreen = () => {
    const newResults: Record<string, boolean | null> = {};
    let correct = 0;

    currentToolScreen.items.forEach((item, index) => {
      const ok = toolPlaced[item.id] === `slot${index}`;
      newResults[item.id] = ok;
      if (ok) correct++;
    });

    setToolResults(newResults);

    if (correct === 4) {
      setTimeout(() => { advanceToolCard(scoreFromLives(toolLives)); }, 450);
      return;
    }

    if (toolLives > 1) {
      setToolLives((prev) => prev - 1);
      setShowLostLife(true);
      playLostLifeAnim();
      return;
    }

    setToolLives(0);
    setTimeout(() => { advanceToolCard(scoreFromLives(0)); }, 450);
  };

  const retryToolScreen = () => {
    const newPlaced:  Record<string, string | null>  = {};
    const newResults: Record<string, boolean | null> = {};

    currentToolScreen.items.forEach((item) => {
      newPlaced[item.id]  = null;
      newResults[item.id] = null;
    });

    setToolPlaced(newPlaced);
    setToolResults(newResults);
    setToolOrder(shuffleArray(currentToolScreen.items));
    setToolResetSignal((prev) => prev + 1);
    setToolLives(MOD2_LIVES);
    setCurrentToolIndex(0);

    setTimeout(() => { measureToolZones(); }, 300);
  };

  const availableTools = toolOrder.filter((item) => toolPlaced[item.id] === null);

  const visibleTool =
    availableTools.length > 0
      ? availableTools[Math.min(currentToolIndex, availableTools.length - 1)]
      : null;

  useEffect(() => {
    if (currentToolIndex > availableTools.length - 1) {
      setCurrentToolIndex(Math.max(0, availableTools.length - 1));
    }
  }, [availableTools.length, currentToolIndex]);

  const renderToolZoneItem = (zoneId: string) => {
    const itemInZone = currentToolScreen.items.find((item) => toolPlaced[item.id] === zoneId);
    if (!itemInZone) return null;
    return (
      <ToolDraggable
        key={`${itemInZone.id}-${zoneId}-${toolResetSignal}`}
        item={itemInZone}
        onDrop={onDropTool}
        zoneLayouts={toolZoneLayouts}
        result={toolResults[itemInZone.id]}
        resetSignal={toolResetSignal}
        mode="slot"
      />
    );
  };

  const renderVisibleTool = () => {
    if (!visibleTool) return null;
    return (
      <ToolDraggable
        key={`${visibleTool.id}-toolviewer-${toolResetSignal}`}
        item={visibleTool}
        onDrop={onDropTool}
        zoneLayouts={toolZoneLayouts}
        result={toolResults[visibleTool.id]}
        resetSignal={toolResetSignal}
        mode="viewer"
      />
    );
  };

  /* =========================================================
     REINICIO TOTAL
     ========================================================= */
  const resetAll = () => {
    setModule1Lives(MOD1_LIVES);
    setModule1Score(null);
    setMod1Phase("uma");

    setToolScreenIndex(0);
    setToolPlaced({});
    setToolResults({});
    setToolZoneLayouts({});
    setToolResetSignal((prev) => prev + 1);
    setToolOrder([]);
    setToolLives(MOD2_LIVES);
    setModule2CardScores(Array(MODULE2_SCREENS.length).fill(0));
    setModule2Score(null);
    setCurrentToolIndex(0);

    setCurrentStage("module1");
    setShowModuleSplash(false);
    setModuleTitle("Módulo 1");
    setShowFinalResult(false);
    setShowIntro(true);

    initMod1Phase("uma");
  };

  /* =========================================================
     INTRO
     ========================================================= */
  if (showIntro) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.titulo}>Nivel Visual – Procesos de Producción</Text>
            <Text style={styles.descripcion}>
              En este nivel deberás completar dos módulos.{"\n\n"}
              En el módulo 1 primero ubicarás las UMAS en su bloque correspondiente y luego
              ubicarás los procesos en su UMA correcta.{"\n\n"}
              En el módulo 2 deberás relacionar cada herramienta con su nombre correcto,
              arrastrando la imagen hasta el cuadro indicado.{"\n\n"}
              Cada módulo cuenta con 5 vidas.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={startGame}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  /* =========================================================
     MÓDULO 1
     ========================================================= */
  if (currentStage === "module1") {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.overlay}>
          <View
            style={styles.noScrollContent}
            onLayout={() => { setTimeout(() => { measureZones(); }, 250); }}
          >
            {/* ── Vidas centradas ── */}
            <LivesDisplay lives={module1Lives} />

            {/* ── Tablero ── */}
            <View style={styles.board}>
              <View style={[styles.mainColumn, { flex: 1 }]}>
                <View style={styles.blockTitleBox}>
                  <Text style={styles.blockTitle}>BLOQUE PLANO</Text>
                </View>
                <View style={styles.innerRow}>
                  <View ref={zoneRefs.uma1} style={styles.subColumn}>{renderZoneItems("uma1")}</View>
                  <View ref={zoneRefs.uma2} style={styles.subColumn}>{renderZoneItems("uma2")}</View>
                </View>
              </View>

              <View style={[styles.mainColumn, { flex: 0.6 }]}>
                <View style={styles.blockTitleBox}>
                  <Text style={styles.blockTitle}>BLOQUE CURVO</Text>
                </View>
                <View ref={zoneRefs.uma3} style={styles.subColumnSingle}>{renderZoneItems("uma3")}</View>
              </View>

              <View style={[styles.mainColumn, { flex: 1.8 }]}>
                <View style={styles.blockTitleBox}>
                  <Text style={styles.blockTitle}>BLOQUE BLINDADO</Text>
                </View>
                <View style={styles.innerRow}>
                  <View ref={zoneRefs.uma4} style={styles.subColumn}>{renderZoneItems("uma4")}</View>
                  <View ref={zoneRefs.uma5} style={styles.subColumn}>{renderZoneItems("uma5")}</View>
                  <View ref={zoneRefs.uma6} style={styles.subColumn}>{renderZoneItems("uma6")}</View>
                </View>
              </View>

              <View style={[styles.mainColumn, { flex: 0.6 }]}>
                <View style={styles.blockTitleBox}>
                  <Text style={styles.blockTitle}>CALIDAD</Text>
                </View>
                <View ref={zoneRefs.calidad} style={styles.subColumnSingle}>{renderZoneItems("calidad")}</View>
              </View>
            </View>

            {/* ── Banco ── */}
            <View style={styles.bankContainer}>
              <Text style={styles.bankTitle}>
                {mod1Phase === "uma"
                  ? "ARRASTRA LAS UMAS A SU BLOQUE CORRECTO"
                  : "ARRASTRA LOS PROCESOS A SU UMA CORRECTA"}
              </Text>
              <View style={styles.bankGrid}>{renderBankItems()}</View>
            </View>

            {/* ── Acciones ── */}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.reviewButton} onPress={review}>
                <Text style={styles.actionText}>Revisar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryButton} onPress={retry}>
                <Text style={styles.actionText}>Reiniciar fase</Text>
              </TouchableOpacity>
            </View>
          </View>

          {showModuleSplash && (
            <View style={styles.overlayTop}>
              <View style={styles.moduleSplashBox}>
                <Text style={styles.moduleSplashText}>{moduleTitle}</Text>
              </View>
            </View>
          )}

          {/* ── Overlay vida perdida módulo 1 ── */}
          {showLostLife && (
            <View style={styles.overlayTop}>
              <View style={styles.lostLifeBox}>
                <Animated.Text
                  style={[
                    styles.bigHeart,
                    { opacity: breakOpacity, transform: [{ scale: breakScale }, { translateX: breakShake.interpolate({ inputRange: [-1,0,1], outputRange: [-6,0,6] }) }] },
                  ]}
                >
                  💔
                </Animated.Text>
                <Text style={styles.minusOneText}>-1 vida</Text>
              </View>
            </View>
          )}
        </View>
      </ImageBackground>
    );
  }

  /* =========================================================
     MÓDULO 2
     ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.overlay}>
        <View
          style={styles.noScrollContent}
          onLayout={() => { setTimeout(() => { measureToolZones(); }, 250); }}
        >
          {/* ── Vidas centradas ── */}
          <LivesDisplay lives={toolLives} />

          <View style={styles.module2Container}>
            <View style={styles.module2Board}>
              <View style={styles.cardsGrid}>
                {currentToolScreen.items.map((item, index) => {
                  const zoneId = `slot${index}`;
                  return (
                    <View
                      key={zoneId}
                      ref={toolZoneRefs[zoneId as keyof typeof toolZoneRefs]}
                      style={styles.nameCard}
                    >
                      <Text style={styles.nameCardText}>{item.label}</Text>
                      <View style={styles.dropImageArea}>{renderToolZoneItem(zoneId)}</View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.toolViewer}>
                <Text style={styles.toolViewerTitle}>PIEZA</Text>
                <View style={styles.toolViewerImageBox}>{renderVisibleTool()}</View>
                <View style={styles.toolViewerControls}>
                  <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => setCurrentToolIndex((prev) =>
                      availableTools.length === 0 ? 0 : prev === 0 ? availableTools.length - 1 : prev - 1
                    )}
                    disabled={availableTools.length === 0}
                  >
                    <Text style={styles.arrowButtonText}>◀</Text>
                  </TouchableOpacity>
                  <Text style={styles.toolViewerCounter}>
                    {availableTools.length === 0 ? "0/0" : `${currentToolIndex + 1}/${availableTools.length}`}
                  </Text>
                  <TouchableOpacity
                    style={styles.arrowButton}
                    onPress={() => setCurrentToolIndex((prev) =>
                      availableTools.length === 0 ? 0 : prev === availableTools.length - 1 ? 0 : prev + 1
                    )}
                    disabled={availableTools.length === 0}
                  >
                    <Text style={styles.arrowButtonText}>▶</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.actions}>
              <TouchableOpacity style={styles.reviewButton} onPress={reviewToolScreen}>
                <Text style={styles.actionText}>Revisar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.retryButton} onPress={retryToolScreen}>
                <Text style={styles.actionText}>Reiniciar tarjeta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* ── Overlay vida perdida módulo 2 ── */}
        {showLostLife && (
          <View style={styles.overlayTop}>
            <View style={styles.lostLifeBox}>
              <Animated.Text
                style={[
                  styles.bigHeart,
                  { opacity: breakOpacity, transform: [{ scale: breakScale }, { translateX: breakShake.interpolate({ inputRange: [-1,0,1], outputRange: [-6,0,6] }) }] },
                ]}
              >
                💔
              </Animated.Text>
              <Text style={styles.minusOneText}>-1 vida</Text>
            </View>
          </View>
        )}

        {showModuleSplash && (
          <View style={styles.overlayTop}>
            <View style={styles.moduleSplashBox}>
              <Text style={styles.moduleSplashText}>{moduleTitle}</Text>
            </View>
          </View>
        )}

        {showFinalResult && (
          <View style={styles.overlayTop}>
            <View style={styles.finalBox}>
              <Text style={styles.finalBigScore}>{totalIslandScore}%</Text>
              <Text style={styles.finalTitle}>
                {totalIslandScore >= 90
                  ? "¡Excelente! Has completado el nivel visual 🎉"
                  : totalIslandScore >= 70
                  ? "¡Muy bien! Has completado el nivel visual 👍"
                  : "Nivel completado. ¡Sigue practicando!"}
              </Text>
              <TouchableOpacity style={[styles.finalButton, { backgroundColor: "#4C92E4", marginTop: 20 }]} onPress={() => router.back()}>
                <Text style={styles.finalButtonText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS
   ========================================================= */
const styles = StyleSheet.create({
  background: { flex: 1 },
  overlay:    { flex: 1, backgroundColor: "rgba(255,255,255,0.08)" },

  header:   { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: 22, paddingHorizontal: 22, borderRadius: 25,
    alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  titulo:        { fontSize: 60, color: "#fff", textAlign: "center", marginBottom: 20, fontWeight: "800" },
  descripcion:   { fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 30 },
  playButton:    { marginTop: 30, backgroundColor: "#4C92E4", paddingVertical: 12, paddingHorizontal: 40, borderRadius: 16 },
  playButtonText:{ color: "#fff", fontSize: 30, fontWeight: "800" },

  scrollContent: { paddingTop: 22, paddingBottom: 30, paddingHorizontal: 12 },

  topCompactBar: { marginBottom: 10, alignItems: "center", justifyContent: "center" },
  infoChip:      { backgroundColor: "rgba(255,255,255,0.92)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: "#D7E8EC" },
  infoChipText:  { color: "#294851", fontSize: 14, fontWeight: "900" },

  /* Vidas: corazón + número — centrado, sin recuadro */
  livesDisplay: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  livesHeart:   { fontSize: 26 },
  livesNumber:  { fontSize: 26, fontWeight: "900", color: "#0F1B4C" },

  board: { backgroundColor: COLORS.boardBg, borderRadius: 20, borderWidth: 1.5, borderColor: COLORS.boardBorder, padding: 5, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },

  mainColumn:   { marginHorizontal: 1, backgroundColor: "#FAFCFD", borderRadius: 14, borderWidth: 1.2, borderColor: "#D7E8EC", padding: 1 },
  blockTitleBox:{ alignSelf: "center", width: "96%", backgroundColor: "#FFFFFF", borderRadius: 10, borderWidth: 2, borderColor: "#A8D0DA", paddingVertical: 9, paddingHorizontal: 6, marginBottom: 10 },
  blockTitle:   { textAlign: "center", fontSize: 14, fontWeight: "900", color: "#4A5B61" },

  innerRow:       { flexDirection: "row", gap: 6, justifyContent: "space-between", alignItems: "flex-start" },
  subColumn:      { flex: 5, minHeight: 300, backgroundColor: COLORS.zoneBg, borderColor: COLORS.zoneBorder, borderWidth: 1.2, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 3, alignItems: "stretch" },
  subColumnSingle:{ minHeight: 300, backgroundColor: COLORS.zoneBg, borderColor: COLORS.zoneBorder, borderWidth: 0.5, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 3, alignItems: "stretch" },

  card:     { minHeight: 46, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, paddingVertical: 10, marginBottom: 8 },
  cardText: { fontSize: 13, color: "#FFFFFF", textAlign: "center", fontWeight: "800", lineHeight: 16 },

  bankContainer: { marginTop: 16, backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 18, borderWidth: 1.3, borderColor: "#DCECEF", padding: 14 },
  bankTitle:     { textAlign: "center", fontSize: 17, fontWeight: "900", color: "#31525B", marginBottom: 14 },
  bankGrid:      { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },

  actions:      { marginTop: 18, flexDirection: "row", gap: 12, justifyContent: "space-between" },
  reviewButton: { flex: 1, backgroundColor: "#58AE73", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  retryButton:  { flex: 1, backgroundColor: "#D87E7E", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  actionText:   { color: "#fff", fontSize: 16, fontWeight: "900" },

  overlayTop:       { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", zIndex: 9999, elevation: 9999 },
  moduleSplashBox:  { backgroundColor: "rgba(255,255,255,0.78)", paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  moduleSplashText: { fontSize: 38, color: "#0F1B4C", textAlign: "center", fontWeight: "900" },

  /* Módulo 2 */
  module2Container: { flex: 1, justifyContent: "center", alignItems: "center" },
  module2Board:     { backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 20, borderWidth: 1.2, borderColor: "#D7E8EC", padding: 12, flexDirection: "row", gap: 12 },
  cardsGrid:        { flex: 4, flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  nameCard:         { width: "48.5%", height: 180, marginBottom: 10, borderRadius: 12, backgroundColor: COLORS.cardBoard, justifyContent: "space-between", alignItems: "center", paddingTop: 8, paddingBottom: 8, paddingHorizontal: 8 },
  nameCardText:     { color: "#fff", fontSize: 16, fontWeight: "900", textAlign: "center" },
  dropImageArea:    { width: "100%", height: 130, justifyContent: "center", alignItems: "center", overflow: "hidden" },

  toolViewer:         { flex: 1.4, backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 10, alignItems: "center", justifyContent: "space-between" },
  toolViewerTitle:    { fontSize: 16, fontWeight: "900", color: "#294851", marginBottom: 8 },
  toolViewerImageBox: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 250 },
  toolViewerControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 5 },
  arrowButton:        { backgroundColor: "#4E9FB0", width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginHorizontal: 10 },
  arrowButtonText:    { color: "#fff", fontSize: 20, fontWeight: "900" },
  toolViewerCounter:  { fontSize: 15, fontWeight: "800", color: "#294851", minWidth: 52, textAlign: "center" },

  toolImageWrapViewer: { width: 250, height: 250, justifyContent: "center", alignItems: "center", borderRadius: 18, backgroundColor: "rgba(255,255,255,0.35)" },
  toolImageViewer:     { width: 300, height: 300 },
  toolImageWrapSlot:   { width: "100%", height: "100%", justifyContent: "center", alignItems: "center", borderRadius: 14, backgroundColor: "transparent", overflow: "hidden" },
  toolImageSlot:       { width: "88%", height: "88%" },

  /* Sin scroll — ocupa toda la pantalla disponible */
  noScrollContent: {
    flex: 1,
    paddingTop: 16,
    paddingBottom: 12,
    paddingHorizontal: 12,
  },

  /* Overlay vida perdida */
  lostLifeBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 24,
    alignItems: "center",
    elevation: 12,
  },
  bigHeart:    { fontSize: 80, color: "red" },
  minusOneText:{ fontFamily: "PlusJakartaSans-Bold", fontSize: 48, color: "#DC2626", marginTop: -8 },

  /* Final */
  finalBox:      { width: "84%", backgroundColor: "#77b479", borderRadius: 22, paddingVertical: 26, paddingHorizontal: 22, alignItems: "center" },
  finalBigScore: { color: "#fff", fontSize: 120, fontWeight: "900", marginBottom: 10 },
  finalTitle:    { color: "#fff", fontSize: 60, fontWeight: "900", textAlign: "center" },
  finalInfoBox:  { marginTop: 18, marginBottom: 14, alignItems: "center" },
  finalInfoText: { color: "#fff", fontSize: 16, fontWeight: "700", textAlign: "center", marginTop: 6 },
  finalButton:   { marginTop: 10, minWidth: 220, paddingVertical: 12, paddingHorizontal: 18, borderRadius: 12, alignItems: "center" },
  finalButtonText:{ color: "#fff", fontSize: 40, fontWeight: "900" },
});