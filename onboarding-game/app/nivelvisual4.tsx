import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  Modal,
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
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const API_URL = API_BASE_URL;
const ISLA_KEY       = 4;
const NIVEL_KEY_PROG = 16;
const TOTAL_LIVES    = 5;

function scoreFromLives(lives: number): number {
  if (lives >= 5) return 100;
  if (lives === 4) return 95;
  if (lives === 3) return 90;
  if (lives === 2) return 85;
  if (lives === 1) return 80;
  return 75;
}
function shuffleArr<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* =========================================================
   TIPOS MÓDULO 1 — SIN TOCAR
   ========================================================= */
type HotspotOption = { label: string; siglas: string };
type Hotspot = {
  id: string; number: number;
  xRatio: number; yRatio: number;
  correct: HotspotOption; options: HotspotOption[];
  labelLeft?: boolean;
};
type SubImage = { id: number; image: any; hotspots: Hotspot[] };

const ALL_OPTIONS: HotspotOption[] = [
  { label:"Parabrisas",                   siglas:"PBS" },
  { label:"Ventilete Delantero Derecho",  siglas:"VDD" },
  { label:"Ventilete Delantero Izquierdo",siglas:"VDI" },
  { label:"Lateral Delantero Izquierdo",  siglas:"LDI" },
  { label:"Lateral Delantero Derecho",    siglas:"LDD" },
  { label:"Lateral Trasero Izquierdo",    siglas:"LTI" },
  { label:"Lateral Trasero Derecho",      siglas:"LTD" },
  { label:"Ventilete Izquierdo",          siglas:"VTI" },
  { label:"Ventilete Derecho",            siglas:"VTD" },
  { label:"Cabina Trasera Izquierda",     siglas:"QTI" },
  { label:"Cabina Trasera Derecha",       siglas:"QTD" },
  { label:"Posterior",                    siglas:"POS" },
  { label:"Sun Roof",                     siglas:"SRF" },
  { label:"Sun Roof Panorámico",          siglas:"SRP" },
  { label:"Parabrisas Izquierdo",         siglas:"PBI" },
  { label:"Parabrisas Derecho",           siglas:"PBD" },
  { label:"Posterior Izquierdo",          siglas:"POI" },
  { label:"Posterior Derecho",            siglas:"POD" },
  { label:"Sunroof Secundario",           siglas:"SRB" },
  { label:"Sunroof Terciario",            siglas:"SRC" },
  { label:"Lateral Extendido Izquierdo",  siglas:"LEI" },
  { label:"Partición",                    siglas:"PI"  },
  { label:"Fragette",                     siglas:"--"  },
];

function buildOptions(correct: HotspotOption): HotspotOption[] {
  const pool = ALL_OPTIONS.filter(o => o.siglas !== correct.siglas);
  return shuffleArr([...shuffleArr(pool).slice(0,2), correct]);
}
function prepareHotspots(hs: Hotspot[]): Hotspot[] {
  return hs.map(h => ({ ...h, options: buildOptions(h.correct) }));
}

const SUB1: Hotspot[] = [
  { id:"h0",  number:0,  xRatio:0.502, yRatio:0.100, correct:{label:"Parabrisas",                   siglas:"PBS"}, options:[] },
  { id:"h19", number:19, xRatio:0.337, yRatio:0.224, correct:{label:"Ventilete Delantero Izquierdo", siglas:"VDI"}, options:[], labelLeft:true },
  { id:"h20", number:20, xRatio:0.660, yRatio:0.234, correct:{label:"Ventilete Delantero Derecho",   siglas:"VDD"}, options:[] },
  { id:"h1",  number:1,  xRatio:0.361, yRatio:0.360, correct:{label:"Lateral Delantero Izquierdo",   siglas:"LDI"}, options:[], labelLeft:true },
  { id:"h2",  number:2,  xRatio:0.640, yRatio:0.358, correct:{label:"Lateral Delantero Derecho",     siglas:"LDD"}, options:[] },
  { id:"h3",  number:3,  xRatio:0.313, yRatio:0.581, correct:{label:"Lateral Trasero Izquierdo",     siglas:"LTI"}, options:[], labelLeft:true },
  { id:"h4",  number:4,  xRatio:0.678, yRatio:0.567, correct:{label:"Lateral Trasero Derecho",       siglas:"LTD"}, options:[] },
  { id:"h5",  number:5,  xRatio:0.313, yRatio:0.644, correct:{label:"Ventilete Izquierdo",           siglas:"VTI"}, options:[], labelLeft:true },
  { id:"h6",  number:6,  xRatio:0.687, yRatio:0.643, correct:{label:"Ventilete Derecho",             siglas:"VTD"}, options:[] },
  { id:"h7",  number:7,  xRatio:0.336, yRatio:0.769, correct:{label:"Cabina Trasera Izquierda",      siglas:"QTI"}, options:[], labelLeft:true },
  { id:"h8",  number:8,  xRatio:0.664, yRatio:0.766, correct:{label:"Cabina Trasera Derecha",        siglas:"QTD"}, options:[] },
  { id:"h9",  number:9,  xRatio:0.496, yRatio:0.900, correct:{label:"Posterior",                     siglas:"POS"}, options:[] },
  { id:"h10", number:10, xRatio:0.502, yRatio:0.474, correct:{label:"Sun Roof",                      siglas:"SRF"}, options:[] },
];
const SUB2: Hotspot[] = [
  { id:"h90", number:90, xRatio:0.485, yRatio:0.186, correct:{label:"Sun Roof Panorámico", siglas:"SRP"}, options:[] },
];
const SUB3: Hotspot[] = [
  { id:"h27", number:27, xRatio:0.411, yRatio:0.255, correct:{label:"Parabrisas Derecho",   siglas:"PBD"}, options:[], labelLeft:true },
  { id:"h26", number:26, xRatio:0.500, yRatio:0.318, correct:{label:"Parabrisas Izquierdo", siglas:"PBI"}, options:[] },
];
const SUB4: Hotspot[] = [
  // Vista "Posterior": lo que se ve a la izquierda en la foto es el lado
  // derecho real del vehículo (efecto espejo al mirar desde atrás).
  { id:"h13", number:13, xRatio:0.203, yRatio:0.230, correct:{label:"Posterior Derecho",   siglas:"POD"}, options:[] },
  { id:"h14", number:14, xRatio:0.324, yRatio:0.330, correct:{label:"Posterior Izquierdo", siglas:"POI"}, options:[] },
];
const SUB5: Hotspot[] = [
  { id:"h25", number:25, xRatio:0.536, yRatio:0.256, correct:{label:"Sunroof Secundario",         siglas:"SRB"}, options:[], labelLeft:true },
  { id:"h87", number:87, xRatio:0.726, yRatio:0.250, correct:{label:"Sunroof Terciario",           siglas:"SRC"}, options:[] },
  { id:"h11", number:11, xRatio:0.537, yRatio:0.430, correct:{label:"Lateral Extendido Izquierdo", siglas:"LEI"}, options:[] },
];
const SUB6: Hotspot[] = [
  { id:"h30", number:30, xRatio:0.544, yRatio:0.351, correct:{label:"Partición", siglas:"PI"}, options:[] },
];
const SUB7: Hotspot[] = [
  { id:"h42", number:42, xRatio:0.355, yRatio:0.364, correct:{label:"Fragette", siglas:"--"}, options:[] },
];

const SUB_IMAGES: SubImage[] = [
  { id:1, image:require("../assets/conceptos1.png"), hotspots:prepareHotspots(SUB1) },
  { id:2, image:require("../assets/conceptos2.png"), hotspots:prepareHotspots(SUB2) },
  { id:3, image:require("../assets/conceptos3.png"), hotspots:prepareHotspots(SUB3) },
  { id:4, image:require("../assets/conceptos4.png"), hotspots:prepareHotspots(SUB4) },
  { id:5, image:require("../assets/conceptos5.png"), hotspots:prepareHotspots(SUB5) },
  { id:6, image:require("../assets/conceptos6.png"), hotspots:prepareHotspots(SUB6) },
  { id:7, image:require("../assets/conceptos7.png"), hotspots:prepareHotspots(SUB7) },
];

/* =========================================================
   MÓDULO 2 — tipos de vidrio
   ========================================================= */
type GlassCard = {
  id: string; image: any;
  correctNombre: string;
  correctEspesor: string;
  nombreOptions: string[];
  espesorOptions: string[];
};

const ESPESORES: Record<string, string> = {
  "Sodalime":         "3 mm, 4 mm, 5 mm, 6 mm, 8 mm, 9 mm, 10 mm, 12 mm, 15 mm, 19 mm",
  "White":            "6 mm, 8 mm, 10 mm, 12 mm",
  "Alluminum (Boro)": "5 mm, 6,5 mm, 8 mm, 10 m",
  "Gris Dark":        "5 mm, 6 mm, 8 mm",
  "Gris Light":       "6 mm, 8 mm, 10 mm, 12 mm",
};

const ALL_NOMBRES = Object.keys(ESPESORES);

function buildNombreOptions(correct: string): string[] {
  const others = ALL_NOMBRES.filter(n => n !== correct);
  return shuffleArr([correct, ...shuffleArr(others).slice(0,2)]);
}
function buildEspesorOptions(correct: string): string[] {
  const others = Object.values(ESPESORES).filter(e => e !== correct);
  return shuffleArr([correct, ...shuffleArr(others).slice(0,2)]);
}

const MOD2_CARDS: GlassCard[] = [
  { id:"g1", image:require("../assets/conceptos_vidrio1.jpg"), correctNombre:"Sodalime",
    correctEspesor: ESPESORES["Sodalime"],
    nombreOptions:  buildNombreOptions("Sodalime"),
    espesorOptions: buildEspesorOptions(ESPESORES["Sodalime"]) },
  { id:"g2", image:require("../assets/conceptos_vidrio2.jpg"), correctNombre:"White",
    correctEspesor: ESPESORES["White"],
    nombreOptions:  buildNombreOptions("White"),
    espesorOptions: buildEspesorOptions(ESPESORES["White"]) },
  { id:"g3", image:require("../assets/conceptos_vidrio3.jpg"), correctNombre:"Alluminum (Boro)",
    correctEspesor: ESPESORES["Alluminum (Boro)"],
    nombreOptions:  buildNombreOptions("Alluminum (Boro)"),
    espesorOptions: buildEspesorOptions(ESPESORES["Alluminum (Boro)"]) },
  { id:"g4", image:require("../assets/conceptos_vidrio4.jpg"), correctNombre:"Gris Dark",
    correctEspesor: ESPESORES["Gris Dark"],
    nombreOptions:  buildNombreOptions("Gris Dark"),
    espesorOptions: buildEspesorOptions(ESPESORES["Gris Dark"]) },
  { id:"g5", image:require("../assets/conceptos_vidrio5.png"), correctNombre:"Gris Light",
    correctEspesor: ESPESORES["Gris Light"],
    nombreOptions:  buildNombreOptions("Gris Light"),
    espesorOptions: buildEspesorOptions(ESPESORES["Gris Light"]) },
];

const MOD2_GROUPS = [
  [MOD2_CARDS[0], MOD2_CARDS[1], MOD2_CARDS[2]],
  [MOD2_CARDS[3], MOD2_CARDS[4]],
];

/* =========================================================
   VIDAS
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
export default function NivelVisual4() {
  const router = useRouter();

  /* ── Flujo ── */
  const [showIntro,        setShowIntro]        = useState(true);
  const [currentModule,    setCurrentModule]    = useState<1|2>(1);
  const [showModuleSplash, setShowModuleSplash] = useState(false);
  const [moduleTitle,      setModuleTitle]      = useState("Módulo 1");
  const [showFinalResult,  setShowFinalResult]  = useState(false);
  const [finalScore,       setFinalScore]       = useState(0);

  /* ── Módulo 1 ── */
  const [subIndex,      setSubIndex]      = useState(0);
  const currentSub = SUB_IMAGES[subIndex];
  const [answered,      setAnswered]      = useState<Record<string,HotspotOption|null>>({});
  const [correct,       setCorrect]       = useState<Record<string,boolean|null>>({});
  const [activeHotspot, setActiveHotspot] = useState<Hotspot|null>(null);
  const [modalVisible,  setModalVisible]  = useState(false);
  const [lives,         setLives]         = useState(TOTAL_LIVES);
  const [mod1Scores,    setMod1Scores]    = useState<number[]>([]);
  const [imgLayout,     setImgLayout]     = useState({ width:0, height:0, x:0, y:0 });
  const [naturalSize,   setNaturalSize]   = useState({ width:0, height:0 });

  /* ── Módulo 2 ── */
  const [mod2Screen,       setMod2Screen]       = useState<0|1>(0);
  const [mod2Lives,        setMod2Lives]        = useState(TOTAL_LIVES);
  const [mod2Nombre,       setMod2Nombre]       = useState<Record<string,string>>({});
  const [mod2Espesor,      setMod2Espesor]      = useState<Record<string,string>>({});
  const [mod2NombreRes,    setMod2NombreRes]    = useState<Record<string,boolean|null>>({});
  const [mod2EspesorRes,   setMod2EspesorRes]   = useState<Record<string,boolean|null>>({});
  const [mod2Reviewed,     setMod2Reviewed]     = useState(false);
  const [mod2Screen0Score, setMod2Screen0Score] = useState<number|null>(null);
  const [mod2NombreModal,  setMod2NombreModal]  = useState<GlassCard|null>(null);
  const [mod2EspesorModal, setMod2EspesorModal] = useState<GlassCard|null>(null);
  const currentMod2Group = MOD2_GROUPS[mod2Screen];

  /* ── Animación vida perdida ── */
  const [showLostLife,  setShowLostLife]  = useState(false);
  const breakScale   = useRef(new Animated.Value(0.6)).current;
  const breakOpacity = useRef(new Animated.Value(0)).current;
  const breakShake   = useRef(new Animated.Value(0)).current;

  const playLostLifeAnim = () => {
    breakScale.setValue(0.6); breakOpacity.setValue(0); breakShake.setValue(0);
    Vibration.vibrate(120);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(breakOpacity, { toValue:1, duration:180, useNativeDriver:true }),
        Animated.timing(breakOpacity, { toValue:1, duration:160, useNativeDriver:true }),
      ]),
      Animated.sequence([
        Animated.timing(breakScale, { toValue:1.25, duration:220, useNativeDriver:true }),
        Animated.timing(breakScale, { toValue:1,    duration:160, useNativeDriver:true }),
      ]),
      Animated.sequence([
        Animated.timing(breakShake, { toValue:1,  duration:70, useNativeDriver:true }),
        Animated.timing(breakShake, { toValue:-1, duration:70, useNativeDriver:true }),
        Animated.timing(breakShake, { toValue:1,  duration:70, useNativeDriver:true }),
        Animated.timing(breakShake, { toValue:0,  duration:70, useNativeDriver:true }),
      ]),
    ]).start(() => setTimeout(() => setShowLostLife(false), 600));
  };

  /* ── Init subimagen ── */
  useEffect(() => {
    const init: Record<string,HotspotOption|null> = {};
    const initC: Record<string,boolean|null> = {};
    currentSub.hotspots.forEach(h => { init[h.id]=null; initC[h.id]=null; });
    setAnswered(init); setCorrect(initC);
    setActiveHotspot(null); setModalVisible(false);
    setNaturalSize({ width:0, height:0 });
  }, [subIndex]);

  /* ── Init mod2 pantalla ── */
  useEffect(() => {
    if (currentModule !== 2) return;
    setMod2Nombre({}); setMod2Espesor({});
    setMod2NombreRes({}); setMod2EspesorRes({});
    setMod2Reviewed(false); setMod2Lives(TOTAL_LIVES);
  }, [mod2Screen, currentModule]);

  /* ── Offset real de imagen con resizeMode contain ── */
  const imageOffset = useMemo(() => {
    if (!naturalSize.width || !naturalSize.height || !imgLayout.width || !imgLayout.height) {
      return { offX:0, offY:0, rendW:imgLayout.width, rendH:imgLayout.height };
    }
    const scale = Math.min(imgLayout.width / naturalSize.width, imgLayout.height / naturalSize.height);
    const rendW = naturalSize.width  * scale;
    const rendH = naturalSize.height * scale;
    const offX  = (imgLayout.width  - rendW) / 2;
    const offY  = (imgLayout.height - rendH) / 2;
    return { offX, offY, rendW, rendH };
  }, [naturalSize, imgLayout]);

  /* ── Módulo 1 lógica ── */
  const openHotspot = (h: Hotspot) => {
    if (correct[h.id] === true) return;
    setActiveHotspot(h); setModalVisible(true);
  };
  const selectOption = (option: HotspotOption) => {
    if (!activeHotspot) return;
    const isOk = option.siglas === activeHotspot.correct.siglas;
    setAnswered(prev => ({ ...prev, [activeHotspot.id]: option }));
    setCorrect(prev  => ({ ...prev, [activeHotspot.id]: isOk }));
    setModalVisible(false);
    if (!isOk) { setLives(prev => prev-1); setShowLostLife(true); playLostLifeAnim(); }
  };
  const allCorrectCurrent = useMemo(() =>
    currentSub.hotspots.every(h => correct[h.id] === true),
  [correct, currentSub]);

  const advanceSub = () => {
    const score = scoreFromLives(lives);
    const newScores = [...mod1Scores, score];
    setMod1Scores(newScores);
    if (subIndex < SUB_IMAGES.length - 1) {
      setSubIndex(prev => prev+1);
      setLives(TOTAL_LIVES);
    } else {
      setModuleTitle("Módulo 2");
      setShowModuleSplash(true);
      setTimeout(() => { setShowModuleSplash(false); setCurrentModule(2); }, 1400);
    }
  };
  const retrySub = () => {
    const init: Record<string,HotspotOption|null> = {};
    const initC: Record<string,boolean|null> = {};
    currentSub.hotspots.forEach(h => { init[h.id]=null; initC[h.id]=null; });
    setAnswered(init); setCorrect(initC); setLives(TOTAL_LIVES);
  };

  /* ── Módulo 2 lógica ── */
  const allMod2Filled = useMemo(() =>
    currentMod2Group.every(c => mod2Nombre[c.id] && mod2Espesor[c.id]),
  [mod2Nombre, mod2Espesor, currentMod2Group]);

  const reviewMod2 = () => {
    const newNRes: Record<string,boolean|null> = {};
    const newERes: Record<string,boolean|null> = {};
    let hasError = false;
    currentMod2Group.forEach(card => {
      const nOk = mod2Nombre[card.id] === card.correctNombre;
      const eOk = mod2Espesor[card.id] === card.correctEspesor;
      newNRes[card.id] = nOk;
      newERes[card.id] = eOk;
      if (!nOk || !eOk) hasError = true;
    });
    setMod2NombreRes(newNRes);
    setMod2EspesorRes(newERes);
    setMod2Reviewed(true);
    if (!hasError) {
      setTimeout(() => advanceMod2(scoreFromLives(mod2Lives)), 400);
      return;
    }
    if (mod2Lives > 1) {
      setMod2Lives(prev => prev-1);
      setShowLostLife(true); playLostLifeAnim();
    } else {
      setMod2Lives(0);
      setTimeout(() => advanceMod2(scoreFromLives(0)), 600);
    }
  };

  const advanceMod2 = (score: number) => {
    if (mod2Screen === 0) {
      setMod2Screen0Score(score);
      setMod2Screen(1);
    } else {
      const s0 = mod2Screen0Score ?? score;
      const mod2Avg = Math.round((s0 + score) / 2);
      const mod1Avg = mod1Scores.length
        ? Math.round(mod1Scores.reduce((a,b)=>a+b,0)/mod1Scores.length) : 100;
      const total = Math.round((mod1Avg + mod2Avg) / 2);
      setFinalScore(total);
      guardarProgreso(total);
      setShowFinalResult(true);
    }
  };

  const retryMod2 = () => {
    setMod2Nombre({}); setMod2Espesor({});
    setMod2NombreRes({}); setMod2EspesorRes({});
    setMod2Reviewed(false); setMod2Lives(TOTAL_LIVES);
  };

  const guardarProgreso = async (score: number) => {
    try {
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(ukStr);
      if (!uk || !Number.isFinite(uk)) return;
      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel2_lectura_unlocked`,             "true"],
      ]);
      await fetch(`${API_URL}/api/niveles/visual/${NIVEL_KEY_PROG}/resultado`, {
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({ usuarioKey:uk, puntaje:score, aprobado:score>=70?1:0, islaKey:ISLA_KEY, nivelKey:NIVEL_KEY_PROG }),
      });
    } catch(e) { console.error("Error guardando visual4:", e); }
  };

  /* =========================================================
     INTRO
     ========================================================= */
  if (showIntro) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.introCenter}>
          <View style={styles.introBox}>
            <Text style={styles.introTitle}>Nivel Visual – Conceptos Generales</Text>
            <Text style={styles.introDesc}>
              Este nivel tiene <Text style={{fontWeight:"900"}}>dos módulos</Text>.{"\n\n"}
              <Text style={{fontWeight:"900"}}>Módulo 1:</Text> Identifica partes de vehículos tocando los números en cada imagen.{"\n\n"}
              <Text style={{fontWeight:"900"}}>Módulo 2:</Text> Identifica tipos de vidrio seleccionando su nombre y espesor correcto.{"\n\n"}
              Tienes <Text style={{fontWeight:"900"}}>5 vidas</Text> por sección.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={() => {
              setShowIntro(false);
              setModuleTitle("Módulo 1");
              setShowModuleSplash(true);
              setTimeout(() => setShowModuleSplash(false), 1400);
            }}>
              <Text style={styles.playButtonText}>Jugar</Text>
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
      </ImageBackground>
    );
  }

  /* =========================================================
     RESULTADO FINAL
     ========================================================= */
  if (showFinalResult) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.overlayCenter}>
          <View style={styles.finalBox}>
            <Text style={styles.finalScore}>{finalScore}%</Text>
            <Text style={styles.finalTitle}>
              {finalScore >= 90 ? "¡Excelente! Nivel completado 🎉"
               : finalScore >= 70 ? "¡Muy bien! Nivel completado 👍"
               : "Nivel completado. ¡Sigue practicando!"}
            </Text>
            <TouchableOpacity style={styles.finalButton} onPress={() => router.back()}>
              <Text style={styles.finalButtonText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  /* =========================================================
     MÓDULO 2
     ========================================================= */
  if (currentModule === 2) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.gameContainer}>

          <View style={styles.topBar}>
            <LivesDisplay lives={mod2Lives} />
            <Text style={styles.mod2Title}>Tipos de cristales</Text>
            <Text style={styles.progressText}>{mod2Screen+1} / 2</Text>
          </View>

          <View style={styles.mod2Row}>
            {currentMod2Group.map((card) => {
              const nRes = mod2NombreRes[card.id];
              const eRes = mod2EspesorRes[card.id];
              const nombreBg  = nRes===true ? "#BFE7C6" : nRes===false ? "#F3B6B6" : "#8FC5CF";
              const espesorBg = eRes===true ? "#BFE7C6" : eRes===false ? "#F3B6B6" : "#F0F0F0";
              const espesorColor = eRes===true ? "#2E7D32" : eRes===false ? "#B71C1C" : "#333";

              return (
                <View key={card.id} style={styles.glassCard}>
                  <TouchableOpacity
                    style={[styles.nombreBtn, { backgroundColor: nombreBg }]}
                    onPress={() => { if (!mod2Reviewed || nRes !== true) setMod2NombreModal(card); }}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.nombreBtnText} numberOfLines={2}>
                      {mod2Nombre[card.id] || "Selecciona"}
                    </Text>
                  </TouchableOpacity>

                  <Text style={styles.espesorLabel}>Espesores:</Text>
                  <TouchableOpacity
                    style={[styles.espesorBtn, { backgroundColor: espesorBg }]}
                    onPress={() => { if (!mod2Reviewed || eRes !== true) setMod2EspesorModal(card); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.espesorBtnText, { color: espesorColor }]} numberOfLines={3}>
                      {mod2Espesor[card.id] || "Selecciona"}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.glassImageWrapper}>
                    <Image source={card.image} style={styles.glassImage} resizeMode="contain" />
                  </View>
                </View>
              );
            })}
          </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.reviewButton, !allMod2Filled && { opacity:0.5 }]}
              onPress={reviewMod2} disabled={!allMod2Filled}
            >
              <Text style={styles.actionText}>Revisar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.retryButton} onPress={retryMod2}>
              <Text style={styles.actionText}>Reiniciar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <Modal visible={!!mod2NombreModal} transparent animationType="fade"
          onRequestClose={() => setMod2NombreModal(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
            onPress={() => setMod2NombreModal(null)}>
            <View style={styles.modalBox}>
              <Text style={styles.modalTitle}>¿Qué tipo de vidrio es?</Text>
              {mod2NombreModal?.nombreOptions.map((opt,i) => (
                <TouchableOpacity key={i} style={styles.optionBtn} activeOpacity={0.8}
                  onPress={() => {
                    setMod2Nombre(prev => ({...prev,[mod2NombreModal!.id]:opt}));
                    setMod2NombreModal(null);
                  }}>
                  <Text style={styles.optionLabel}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        <Modal visible={!!mod2EspesorModal} transparent animationType="fade"
          onRequestClose={() => setMod2EspesorModal(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
            onPress={() => setMod2EspesorModal(null)}>
            <View style={[styles.modalBox, { width:"75%" }]}>
              <Text style={styles.modalTitle}>¿Cuáles son los espesores?</Text>
              {mod2EspesorModal?.espesorOptions.map((opt,i) => (
                <TouchableOpacity key={i} style={styles.optionBtn} activeOpacity={0.8}
                  onPress={() => {
                    setMod2Espesor(prev => ({...prev,[mod2EspesorModal!.id]:opt}));
                    setMod2EspesorModal(null);
                  }}>
                  <Text style={styles.optionLabel}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>

        {showLostLife && (
          <View style={styles.overlayTop}>
            <View style={styles.lostLifeBox}>
              <Animated.Text style={[styles.bigHeart,{ opacity:breakOpacity,
                transform:[{scale:breakScale},{translateX:breakShake.interpolate({inputRange:[-1,0,1],outputRange:[-6,0,6]})}]}]}>
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
      </ImageBackground>
    );
  }

  /* =========================================================
     MÓDULO 1
     ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.gameContainer}>

        <View style={styles.topBar}>
          <LivesDisplay lives={lives} />
          <Text style={styles.progressText}>{subIndex+1} / {SUB_IMAGES.length}</Text>
        </View>

        <View style={styles.imageWrapper}>
          <Image
            source={currentSub.image}
            style={styles.subImage}
            resizeMode="contain"
            onLoad={(e) => {
              setNaturalSize({
                width:  e.nativeEvent.source.width,
                height: e.nativeEvent.source.height,
              });
            }}
            onLayout={(e) => {
              const { width, height, x, y } = e.nativeEvent.layout;
              setImgLayout({ width, height, x, y });
            }}
          />


          {imageOffset.rendW > 0 && currentSub.hotspots.map((hotspot) => {
            const px = imageOffset.offX + hotspot.xRatio * imageOffset.rendW;
            const py = imageOffset.offY + hotspot.yRatio * imageOffset.rendH;
            return (
              <TouchableOpacity key={hotspot.id}
                style={[styles.hotspotBtn, {
                  left: px - 18,
                  top:  py - 18,
                  backgroundColor: correct[hotspot.id]===true ? "rgba(88,174,115,0.55)" : "rgba(78,159,176,0.55)",
                }]}
                onPress={() => openHotspot(hotspot)} activeOpacity={0.8}
              >
                <Text style={styles.hotspotNumber}>{hotspot.number}</Text>
              </TouchableOpacity>
            );
          })}

          {imageOffset.rendW > 0 && currentSub.hotspots.map((hotspot) => {
            if (correct[hotspot.id] !== true) return null;
            const px = imageOffset.offX + hotspot.xRatio * imageOffset.rendW;
            const py = imageOffset.offY + hotspot.yRatio * imageOffset.rendH;
            const rightFromEdge = imageOffset.rendW - (px - imageOffset.offX) + 18 + 8;
            const labelStyle = hotspot.labelLeft
              ? { right: rightFromEdge, top: py - 14 }
              : { left: px + 18 + 8,   top: py - 14 };
            return (
              <View key={`label-${hotspot.id}`} style={[styles.answerLabel, labelStyle]}>
                <Text style={styles.answerLabelText}>{hotspot.correct.label}</Text>
                <View style={styles.siglasBox}>
                  <Text style={styles.siglasText}>{hotspot.correct.siglas}</Text>
                </View>
              </View>
            );
          })}
        </View>

        <View style={styles.actionsRow}>
          {allCorrectCurrent ? (
            <TouchableOpacity style={styles.nextButton} onPress={advanceSub}>
              <Text style={styles.actionText}>
                {subIndex < SUB_IMAGES.length-1 ? "Siguiente →" : "Módulo 2 →"}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.retryButton} onPress={retrySub}>
              <Text style={styles.actionText}>Reiniciar imagen</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <Modal visible={modalVisible} transparent animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Punto {activeHotspot?.number} — ¿Qué parte es?</Text>
            {activeHotspot?.options.map((opt,i) => (
              <TouchableOpacity key={i} style={styles.optionBtn}
                onPress={() => selectOption(opt)} activeOpacity={0.8}>
                <Text style={styles.optionLabel}>{opt.label}</Text>
                <View style={styles.optionSiglasBox}>
                  <Text style={styles.optionSiglas}>{opt.siglas}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {showLostLife && (
        <View style={styles.overlayTop}>
          <View style={styles.lostLifeBox}>
            <Animated.Text style={[styles.bigHeart,{ opacity:breakOpacity,
              transform:[{scale:breakScale},{translateX:breakShake.interpolate({inputRange:[-1,0,1],outputRange:[-6,0,6]})}]}]}>
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
    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS
   ========================================================= */
const styles = StyleSheet.create({
  background:  { flex:1 },
  introCenter: { flex:1, justifyContent:"center", alignItems:"center", paddingHorizontal:30 },
  introBox: {
    backgroundColor:"rgba(143,197,207,0.88)",
    paddingVertical:28, paddingHorizontal:28, borderRadius:25,
    alignItems:"center", maxWidth:"88%",
    shadowColor:"#000", shadowOpacity:0.25, shadowRadius:15, shadowOffset:{width:0,height:4},
  },
  introTitle: { fontSize:52, color:"#fff", textAlign:"center", marginBottom:18, fontWeight:"800" },
  introDesc:  { fontSize:28, color:"#fff", textAlign:"center", lineHeight:38 },
  playButton: { marginTop:28, backgroundColor:"#4C92E4", paddingVertical:14, paddingHorizontal:44, borderRadius:16 },
  playButtonText: { color:"#fff", fontSize:30, fontWeight:"800" },

  gameContainer: { flex:1, paddingTop:16, paddingBottom:16, paddingHorizontal:16 },
  topBar: { flexDirection:"row", alignItems:"center", justifyContent:"space-between", marginBottom:12 },
  livesDisplay: { flexDirection:"row", alignItems:"center", gap:6 },
  livesHeart:   { fontSize:26 },
  livesNumber:  { fontSize:26, fontWeight:"900", color:"#0F1B4C" },
  progressText: { fontSize:20, fontWeight:"800", color:"#0F1B4C" },

  /* MÓDULO 1 */
  imageWrapper: {
    flex: 0.95,                              // ← ocupa todo el espacio disponible
    backgroundColor:"rgba(255,255,255,0.92)",
    borderRadius:20, borderWidth:1.5, borderColor:"#C9E3E9",
    overflow:"visible", position:"relative",
    marginBottom: 12,
  },
  subImage: { width:"100%", height:"100%", borderRadius:18 },
  hotspotBtn: {
    position:"absolute", width:36, height:36, borderRadius:18,
    justifyContent:"center", alignItems:"center",
    borderWidth:2.5, borderColor:"#fff",
    shadowColor:"#000", shadowOpacity:0.3, shadowRadius:4, shadowOffset:{width:0,height:2},
    elevation:6, zIndex:10,
  },
  hotspotNumber: { color:"#fff", fontSize:14, fontWeight:"900" },
  answerLabel: {
    position:"absolute", flexDirection:"row", alignItems:"center",
    backgroundColor:"rgba(255,255,255,0.95)", borderRadius:10,
    paddingHorizontal:8, paddingVertical:4, borderWidth:1.5, borderColor:"#58AE73",
    zIndex:11, shadowColor:"#000", shadowOpacity:0.15, shadowRadius:3,
    shadowOffset:{width:0,height:1}, elevation:4, gap:6,
  },
  answerLabelText: { fontSize:13, fontWeight:"700", color:"#1a3a2a" },
  siglasBox:  { backgroundColor:"#4E9FB0", borderRadius:6, paddingHorizontal:6, paddingVertical:2 },
  siglasText: { color:"#fff", fontSize:12, fontWeight:"800" },

  /* MÓDULO 2 */
  mod2Title: { fontSize:26, fontWeight:"900", color:"#0F1B4C", textAlign:"center" },
  mod2Row: { flex:1, flexDirection:"row", gap:12, marginBottom:12 },
  glassCard: {
    flex:1, backgroundColor:"#fff", borderRadius:16,
    borderWidth:1.5, borderColor:"#C9E3E9", padding:10,
    shadowColor:"#000", shadowOpacity:0.1, shadowRadius:6,
    shadowOffset:{width:0,height:2}, elevation:3,
  },
  nombreBtn: {
    borderRadius:10, paddingVertical:10, paddingHorizontal:8,
    alignItems:"center", justifyContent:"center",
    marginBottom:8, minHeight:44,
  },
  nombreBtnText: { color:"#fff", fontSize:15, fontWeight:"900", textAlign:"center" },
  espesorLabel:  { fontSize:12, fontWeight:"700", color:"#555", marginBottom:4 },
  espesorBtn: {
    borderRadius:8, paddingVertical:8, paddingHorizontal:8,
    alignItems:"center", justifyContent:"center",
    borderWidth:1.2, borderColor:"#C9C9C9",
    marginBottom:8, minHeight:44,
  },
  espesorBtnText: { fontSize:11, fontWeight:"700", textAlign:"center" },
  glassImageWrapper: {
    flex:1, borderRadius:10, overflow:"hidden",
    backgroundColor:"#f5f5f5", minHeight:80,
  },
  glassImage: { width:"100%", height:"100%" },

  /* Acciones */
  actionsRow:   { flexDirection:"row", gap:12, justifyContent:"space-between" },
  nextButton:   { flex:1, backgroundColor:"#58AE73", borderRadius:14, paddingVertical:14, alignItems:"center" },
  retryButton:  { flex:1, backgroundColor:"#D87E7E", borderRadius:14, paddingVertical:14, alignItems:"center" },
  reviewButton: { flex:1, backgroundColor:"#4C92E4", borderRadius:14, paddingVertical:14, alignItems:"center" },
  actionText:   { color:"#fff", fontSize:18, fontWeight:"900" },

  /* Modal */
  modalBackdrop: { flex:1, backgroundColor:"rgba(0,0,0,0.5)", justifyContent:"center", alignItems:"center" },
  modalBox: {
    width:"60%", backgroundColor:"#fff", borderRadius:20,
    paddingVertical:24, paddingHorizontal:20, alignItems:"stretch",
    shadowColor:"#000", shadowOpacity:0.3, shadowRadius:12, shadowOffset:{width:0,height:4},
  },
  modalTitle: { fontSize:22, fontWeight:"900", color:"#0F1B4C", textAlign:"center", marginBottom:18 },
  optionBtn: {
    backgroundColor:"#EEF8FA", borderRadius:12,
    paddingVertical:12, paddingHorizontal:16,
    marginBottom:10, borderWidth:1.5, borderColor:"#C9E3E9",
    flexDirection:"row", alignItems:"center", justifyContent:"space-between",
  },
  optionLabel:     { fontSize:16, fontWeight:"700", color:"#1a3a4a", flex:1, flexWrap:"wrap" },
  optionSiglasBox: { backgroundColor:"#4E9FB0", borderRadius:8, paddingHorizontal:10, paddingVertical:4, marginLeft:10 },
  optionSiglas:    { color:"#fff", fontSize:16, fontWeight:"900" },

  /* Overlays */
  overlayCenter: { flex:1, backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center", alignItems:"center" },
  overlayTop: {
    position:"absolute", top:0, right:0, bottom:0, left:0,
    backgroundColor:"rgba(0,0,0,0.4)", justifyContent:"center",
    alignItems:"center", zIndex:9999, elevation:9999,
  },
  moduleSplashBox:  { backgroundColor:"rgba(255,255,255,0.88)", paddingVertical:20, paddingHorizontal:40, borderRadius:20 },
  moduleSplashText: { fontSize:44, color:"#0F1B4C", fontWeight:"900", textAlign:"center" },
  lostLifeBox: { backgroundColor:"#fff", borderRadius:16, paddingVertical:16, paddingHorizontal:24, alignItems:"center", elevation:12 },
  bigHeart:    { fontSize:80, color:"red" },
  minusOneText:{ fontSize:48, color:"#DC2626", marginTop:-8, fontWeight:"900" },

  finalBox: {
    width:"80%", backgroundColor:"#77b479", borderRadius:22,
    paddingVertical:30, paddingHorizontal:24, alignItems:"center",
    shadowColor:"#000", shadowOpacity:0.3, shadowRadius:12, shadowOffset:{width:0,height:4},
  },
  finalScore:     { color:"#fff", fontSize:110, fontWeight:"900", marginBottom:8 },
  finalTitle:     { color:"#fff", fontSize:50,  fontWeight:"900", textAlign:"center", marginBottom:20 },
  finalButton:    { backgroundColor:"#4C92E4", paddingVertical:14, paddingHorizontal:44, borderRadius:14 },
  finalButtonText:{ color:"#fff", fontSize:36, fontWeight:"900" },
});