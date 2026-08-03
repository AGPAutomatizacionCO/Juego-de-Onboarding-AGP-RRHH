import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  PanResponder,
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
const API_URL        = API_BASE_URL;
const ISLA_KEY       = 8;
const NIVEL_KEY_PROG = 36;
const TOTAL_LIVES    = 3;
const LUPA_SIZE      = 130;
const ZOOM_FACTOR    = 2.8;

function scoreFromLives(livesLeft: number, totalLives: number): number {
  const ratio = livesLeft / totalLives;
  if (ratio >= 1)   return 100;
  if (ratio >= 0.8) return 90;
  if (ratio >= 0.6) return 80;
  if (ratio >= 0.4) return 70;
  if (ratio >= 0.2) return 60;
  return 50;
}

function shuffleArr<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

/* =========================================================
   TIPOS
   ========================================================= */
type DefectType = "quiñe" | "raya" | "burbuja" | "arrugas en tecoflex" | "manchas";
type ZoneType   = "A" | "B" | "C";

type DefectCard = {
  id: number;
  image: any;
  defectType: DefectType;
  defectXRatio: number;
  defectYRatio: number;
  hint: string;
};

type ZoneCard = {
  id: number;
  image: any;
  vidrio: string;
  question: string;
  correctZone: ZoneType;
  hint: string;
};

/* =========================================================
   DATOS MÓDULO 1 — DEFECTOS
   ========================================================= */
const ALL_DEFECT_TYPES: DefectType[] = ["quiñe", "raya", "burbuja", "arrugas en tecoflex", "manchas"];

function buildDefectOptions(correct: DefectType): DefectType[] {
  const others = ALL_DEFECT_TYPES.filter(d => d !== correct);
  return shuffleArr([correct, ...shuffleArr(others).slice(0, 2)]) as DefectType[];
}

const DEFECT_CARDS: DefectCard[] = [
  {
    id: 1,
    image: require("../assets/quine.jpg"),
    defectType: "quiñe",
    defectXRatio: 0.55,
    defectYRatio: 0.40,
    hint: "Busca una astilla o impacto en el borde del vidrio",
  },
  {
    id: 2,
    image: require("../assets/raya.jpg"),
    defectType: "raya",
    defectXRatio: 0.50,
    defectYRatio: 0.45,
    hint: "Busca una línea fina sobre la superficie",
  },
  {
    id: 3,
    image: require("../assets/burbujas.jpg"),
    defectType: "burbuja",
    defectXRatio: 0.48,
    defectYRatio: 0.50,
    hint: "Busca una esfera atrapada entre las capas",
  },
  {
    id: 4,
    image: require("../assets/arrugastecoflex.jpg"),
    defectType: "arrugas en tecoflex",
    defectXRatio: 0.52,
    defectYRatio: 0.42,
    hint: "Busca ondulaciones o arrugas en la capa de tecoflex",
  },
  {
    id: 5,
    image: require("../assets/manchas.jpg"),
    defectType: "manchas",
    defectXRatio: 0.50,
    defectYRatio: 0.48,
    hint: "Busca áreas con manchas o decoloración sobre el vidrio",
  },
];

/* =========================================================
   DATOS MÓDULO 2 — ZONAS
   ========================================================= */
const ZONE_DESCRIPTIONS: Record<ZoneType, { color: string; criticidad: string; desc: string }> = {
  A: { color: "azul",   criticidad: "ALTA",  desc: "Criticidad alta — visibilidad directa del conductor o cámara/sensor" },
  B: { color: "verde",  criticidad: "MEDIA", desc: "Criticidad media — área central visible del vidrio" },
  C: { color: "fucsia", criticidad: "BAJA",  desc: "Criticidad baja — bordes y zonas externas" },
};

function buildZoneOptions(correct: ZoneType): ZoneType[] {
  const others: ZoneType[] = (["A", "B", "C"] as ZoneType[]).filter(z => z !== correct);
  return shuffleArr([correct, ...others]) as ZoneType[];
}

const ZONE_CARDS: ZoneCard[] = [
  {
    id: 1,
    image: require("../assets/parabrisaszona.png"),
    vidrio: "Parabrisas",
    question: "El defecto está donde va la cámara y el sensor. ¿En qué zona se ubica y qué criticidad tiene?",
    correctZone: "A",
    hint: "Zona superior central del parabrisas",
  },
  {
    id: 2,
    image: require("../assets/Lateraleszona.png"),
    vidrio: "Laterales Delanteros",
    question: "El defecto está en la zona visible desde el espejo retrovisor del conductor. ¿A qué zona corresponde?",
    correctZone: "A",
    hint: "Zona 1 del lateral delantero — vista del conductor con retrovisores",
  },
  {
    id: 3,
    image: require("../assets/Posteriorzona.png"),
    vidrio: "Posterior / Partición",
    question: "El defecto está en el área central del vidrio posterior. ¿Qué zona es y qué criticidad tiene?",
    correctZone: "B",
    hint: "Área verde central del posterior",
  },
  {
    id: 4,
    image: require("../assets/Cabinaszona.png"),
    vidrio: "Cabinas, Ventiletes y Lat. Traseros",
    question: "El defecto se encuentra en el borde externo del lateral trasero. ¿En qué zona cae y qué criticidad implica?",
    correctZone: "C",
    hint: "Borde fucsia — zona de baja criticidad",
  },
  {
    id: 5,
    image: require("../assets/Otroszona.png"),
    vidrio: "Otros (PBS Defense)",
    question: "El defecto está en el área central del PBS Defense. ¿Qué zona es?",
    correctZone: "B",
    hint: "Zona B — criticidad media en PBS Defense",
  },
];

/* =========================================================
   COMPONENTE VIDAS — solo corazones, sin número
   ========================================================= */
function LivesDisplay({ lives }: { lives: number }) {
  return (
    <View style={styles.livesDisplay}>
      <Text style={styles.livesNum}>{lives}</Text>
      <Text style={styles.livesHeart}>❤️</Text>
    </View>
  );
}

/* =========================================================
   OVERLAY VIDA PERDIDA
   ========================================================= */
function LostLifeOverlay({
  breakOpacity, breakScale, breakShake,
}: {
  breakOpacity: Animated.Value;
  breakScale:   Animated.Value;
  breakShake:   Animated.Value;
}) {
  return (
    <View style={styles.overlayTop}>
      <View style={styles.lostLifeBox}>
        <Animated.Text
          style={[
            styles.bigHeart,
            {
              opacity: breakOpacity,
              transform: [
                { scale: breakScale },
                { translateX: breakShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] }) },
              ],
            },
          ]}
        >
          💔
        </Animated.Text>
        <Text style={styles.minusOneText}>-1 vida</Text>
      </View>
    </View>
  );
}

/* =========================================================
   MAIN
   ========================================================= */
export default function NivelVisualCalidad() {
  const router = useRouter();

  /* ── Flujo global ── */
  const [showIntro,        setShowIntro]        = useState(true);
  const [currentModule,    setCurrentModule]    = useState<1 | 2>(1);
  const [showModuleSplash, setShowModuleSplash] = useState(false);
  const [moduleTitle,      setModuleTitle]      = useState("Módulo 1");
  const [showFinalResult,  setShowFinalResult]  = useState(false);
  const [finalScore,       setFinalScore]       = useState(0);

  /* ── Módulo 1 ── */
  const [mod1Index,  setMod1Index]  = useState(0);
  const [mod1Lives,  setMod1Lives]  = useState(TOTAL_LIVES);
  // "lupa" → explorando con lupa; "question" → modal de pregunta; "result" → resultado
  const [mod1Phase,  setMod1Phase]  = useState<"lupa" | "question" | "result">("lupa");
  const [mod1Answer, setMod1Answer] = useState<DefectType | null>(null);
  const [mod1Scores, setMod1Scores] = useState<number[]>([]);
  const [showHint,   setShowHint]   = useState(false);

  // Layout del contenedor de imagen (para calcular zoom de lupa)
  const [imgLayout, setImgLayout] = useState({ width: 0, height: 0, x: 0, y: 0 });

  // Posición de la lupa (esquina superior-izquierda del círculo)
  const lupaPosRef = useRef({ x: 80, y: 80 });
  const [lupaPos,  setLupaPos]  = useState({ x: 80, y: 80 });

  /* ── Módulo 2 ── */
  const [mod2Index,  setMod2Index]  = useState(0);
  const [mod2Lives,  setMod2Lives]  = useState(TOTAL_LIVES);
  const [mod2Phase,  setMod2Phase]  = useState<"question" | "result">("question");
  const [mod2Answer, setMod2Answer] = useState<ZoneType | null>(null);
  const [mod2Scores, setMod2Scores] = useState<number[]>([]);

  /* ── Animación vida perdida ── */
  const [showLostLife,   setShowLostLife]   = useState(false);
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
        Animated.timing(breakOpacity, { toValue: 1, duration: 300, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(breakScale, { toValue: 1.3, duration: 220, useNativeDriver: true }),
        Animated.timing(breakScale, { toValue: 1,   duration: 160, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(breakShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        Animated.timing(breakShake, { toValue: 0,  duration: 70, useNativeDriver: true }),
      ]),
    ]).start(() => setTimeout(() => setShowLostLife(false), 500));
  };

  const lostLife = (setLives: React.Dispatch<React.SetStateAction<number>>) => {
    setLives(prev => Math.max(0, prev - 1));
    setShowLostLife(true);
    playLostLifeAnim();
  };

  /* ── PanResponder para la lupa ── */
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: () => {
        // nada — lupaPosRef ya tiene la posición actual
      },
      onPanResponderMove: (_, gs) => {
        const newX = lupaPosRef.current.x + gs.dx;
        const newY = lupaPosRef.current.y + gs.dy;
        setLupaPos({ x: newX, y: newY });
      },
      onPanResponderRelease: (_, gs) => {
        lupaPosRef.current = {
          x: lupaPosRef.current.x + gs.dx,
          y: lupaPosRef.current.y + gs.dy,
        };
      },
    })
  ).current;

  // Reset lupa y fase al cambiar imagen
  useEffect(() => {
    lupaPosRef.current = { x: 80, y: 80 };
    setLupaPos({ x: 80, y: 80 });
    setMod1Phase("lupa");
    setMod1Answer(null);
    setShowHint(false);
  }, [mod1Index]);

  useEffect(() => {
    setMod2Phase("question");
    setMod2Answer(null);
  }, [mod2Index]);

  /* =========================================================
     LÓGICA MÓDULO 1
     ========================================================= */
  const currentDefect = DEFECT_CARDS[mod1Index];
  const defOptions    = buildDefectOptions(currentDefect.defectType);

  const handleDefectAnswer = (answer: DefectType) => {
    if (mod1Answer === currentDefect.defectType) return; // ya acertó
    setMod1Answer(answer);
    const isCorrect = answer === currentDefect.defectType;
    if (isCorrect) {
      // Pequeña pausa antes de mostrar resultado
      setTimeout(() => setMod1Phase("result"), 600);
    } else {
      lostLife(setMod1Lives);
      if (mod1Lives <= 1) {
        setTimeout(() => setMod1Phase("result"), 700);
      }
    }
  };

  const advanceMod1 = () => {
    const score    = scoreFromLives(mod1Lives, TOTAL_LIVES);
    const newScores = [...mod1Scores, score];
    setMod1Scores(newScores);
    if (mod1Index < DEFECT_CARDS.length - 1) {
      setMod1Index(prev => prev + 1);
      setMod1Lives(TOTAL_LIVES);
    } else {
      setModuleTitle("Módulo 2");
      setShowModuleSplash(true);
      setTimeout(() => {
        setShowModuleSplash(false);
        setCurrentModule(2);
      }, 1600);
    }
  };

  /* =========================================================
     LÓGICA MÓDULO 2
     ========================================================= */
  const currentZone = ZONE_CARDS[mod2Index];
  const zInfo       = ZONE_DESCRIPTIONS[currentZone.correctZone];
  const zOptions    = buildZoneOptions(currentZone.correctZone);

  const handleZoneAnswer = (answer: ZoneType) => {
    setMod2Answer(answer);
    const isCorrect = answer === currentZone.correctZone;
    if (isCorrect) {
      setMod2Phase("result");
    } else {
      lostLife(setMod2Lives);
      if (mod2Lives <= 1) {
        setTimeout(() => setMod2Phase("result"), 700);
      }
    }
  };

  const advanceMod2 = () => {
    const score    = scoreFromLives(mod2Lives, TOTAL_LIVES);
    const newScores = [...mod2Scores, score];
    setMod2Scores(newScores);
    if (mod2Index < ZONE_CARDS.length - 1) {
      setMod2Index(prev => prev + 1);
      setMod2Lives(TOTAL_LIVES);
    } else {
      const mod1Avg = mod1Scores.length
        ? Math.round(mod1Scores.reduce((a, b) => a + b, 0) / mod1Scores.length)
        : 100;
      const mod2Avg = newScores.length
        ? Math.round(newScores.reduce((a, b) => a + b, 0) / newScores.length)
        : 100;
      const total = Math.round((mod1Avg + mod2Avg) / 2);
      setFinalScore(total);
      guardarProgreso(total);
      setShowFinalResult(true);
    }
  };

  const guardarProgreso = async (score: number) => {
    try {
      const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(ukStr);
      if (!uk || !Number.isFinite(uk)) return;
      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_PROG}_visual_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel32_lectura_unlocked`,            "true"],
      ]);
      await fetch(`${API_URL}/api/niveles/visual/${NIVEL_KEY_PROG}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey: uk, puntaje: score,
          aprobado: score >= 70 ? 1 : 0,
          islaKey: ISLA_KEY, nivelKey: NIVEL_KEY_PROG,
        }),
      });
    } catch (e) { console.error("Error guardando visual calidad:", e); }
  };

  /* =========================================================
     INTRO
     ========================================================= */
  if (showIntro) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.introCenter}>
          <View style={styles.introBox}>
            <Text style={styles.introTitle}>Nivel Visual – Calidad</Text>
            <Text style={styles.introDesc}>
              Este nivel tiene <Text style={{ fontWeight: "900" }}>dos módulos</Text>.{"\n\n"}
              <Text style={{ fontWeight: "900" }}>Módulo 1:</Text> Usa la lupa 🔍 para encontrar el defecto en el vidrio e identifica qué tipo es.{"\n\n"}
              <Text style={{ fontWeight: "900" }}>Módulo 2:</Text> Observa el vidrio y determina en qué zona se ubica el defecto según su criticidad.{"\n\n"}
              Tienes <Text style={{ fontWeight: "900" }}>3 vidas ❤️❤️❤️</Text> por imagen. ¡Buena suerte!
            </Text>
            <TouchableOpacity
              style={styles.playButton}
              onPress={() => {
                setShowIntro(false);
                setModuleTitle("Módulo 1");
                setShowModuleSplash(true);
                setTimeout(() => setShowModuleSplash(false), 1600);
              }}
            >
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
     MÓDULO 2 — ZONAS
     ========================================================= */
  if (currentModule === 2) {
    return (
      <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
        <View style={styles.gameContainer}>

          {/* Top bar */}
          <View style={styles.topBar}>
            <LivesDisplay lives={mod2Lives} />
            <Text style={styles.moduleLabel}>Módulo 2 — Zonas</Text>
            <Text style={styles.progressText}>{mod2Index + 1} / {ZONE_CARDS.length}</Text>
          </View>

          {/* Referencia de zonas compacta */}
          <View style={styles.zoneLegendRow}>
            {(["A", "B", "C"] as ZoneType[]).map(z => (
              <View key={z} style={[styles.zoneBadge, { backgroundColor: z === "A" ? "#3B9FE8" : z === "B" ? "#4CAF50" : "#E040FB" }]}>
                <Text style={styles.zoneBadgeText}>
                  Zona {z} — {ZONE_DESCRIPTIONS[z].criticidad}
                </Text>
              </View>
            ))}
          </View>

          {/* Imagen del vidrio */}
          <View style={styles.zoneImageWrapper}>
            <Image
              source={currentZone.image}
              style={styles.zoneImage}
              resizeMode="contain"
            />
            <View style={styles.vidrioLabel}>
              <Text style={styles.vidrioLabelText}>{currentZone.vidrio}</Text>
            </View>
          </View>

          {/* Pregunta */}
          <View style={styles.questionBox}>
            <Text style={styles.questionText}>{currentZone.question}</Text>
          </View>

          {/* Opciones de zona */}
          {mod2Phase === "question" && (
            <View style={styles.zoneOptionsRow}>
              {zOptions.map(z => {
                const bg = z === "A" ? "#3B9FE8" : z === "B" ? "#4CAF50" : "#E040FB";
                return (
                  <TouchableOpacity
                    key={z}
                    style={[styles.zoneOptionBtn, { backgroundColor: bg }]}
                    onPress={() => handleZoneAnswer(z)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.zoneOptionZone}>Zona {z}</Text>
                    <Text style={styles.zoneOptionCrit}>{ZONE_DESCRIPTIONS[z].criticidad}</Text>
                    <Text style={styles.zoneOptionDesc} numberOfLines={2}>
                      {ZONE_DESCRIPTIONS[z].desc}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Resultado */}
          {mod2Phase === "result" && (
            <View style={[styles.resultBanner,
              { backgroundColor: mod2Answer === currentZone.correctZone ? "#4CAF50" : "#E53935" }]}>
              <Text style={styles.resultBannerTitle}>
                {mod2Answer === currentZone.correctZone ? "✅ ¡Correcto!" : "❌ Incorrecto"}
              </Text>
              <Text style={styles.resultBannerDesc}>
                La respuesta correcta es{" "}
                <Text style={{ fontWeight: "900" }}>Zona {currentZone.correctZone}</Text>
                {" — "}{zInfo.criticidad}.{"\n"}{zInfo.desc}
              </Text>
              <TouchableOpacity style={styles.nextBtn} onPress={advanceMod2}>
                <Text style={styles.nextBtnText}>
                  {mod2Index < ZONE_CARDS.length - 1 ? "Siguiente →" : "Ver resultado 🏁"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {showLostLife && <LostLifeOverlay breakOpacity={breakOpacity} breakScale={breakScale} breakShake={breakShake} />}
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
     MÓDULO 1 — LUPA + DEFECTOS
     ========================================================= */

  // Centro de la lupa en coordenadas del contenedor de imagen
  const lupaCenterX = lupaPos.x + LUPA_SIZE / 2;
  const lupaCenterY = lupaPos.y + LUPA_SIZE / 2;

  return (
    <ImageBackground source={fondo} style={styles.background} resizeMode="cover">
      <View style={styles.gameContainer}>

        {/* Top bar */}
        <View style={styles.topBar}>
          <LivesDisplay lives={mod1Lives} />
          <Text style={styles.moduleLabel}>Módulo 1 — Defectos</Text>
          <Text style={styles.progressText}>{mod1Index + 1} / {DEFECT_CARDS.length}</Text>
        </View>

        {/* Instrucción + pista */}
        {mod1Phase === "lupa" && (
          <>
            <View style={styles.instruccionRow}>
              <Text style={styles.instruccionText}>
                🔍 Arrastra la lupa para encontrar el defecto
              </Text>
              <TouchableOpacity onPress={() => setShowHint(!showHint)} style={styles.hintBtn}>
                <Text style={styles.hintBtnText}>{showHint ? "Ocultar pista" : "💡 Pista"}</Text>
              </TouchableOpacity>
            </View>
            {showHint && (
              <View style={styles.hintBox}>
                <Text style={styles.hintText}>{currentDefect.hint}</Text>
              </View>
            )}
          </>
        )}

        {/* ── FASE LUPA ── */}
        {mod1Phase === "lupa" && (
          <>
            {/* Imagen base a tamaño natural (contain) con lupa encima */}
            <View
              style={styles.defectImageWrapper}
              onLayout={e => {
                const { width, height, x, y } = e.nativeEvent.layout;
                setImgLayout({ width, height, x, y });
              }}
            >
              {/* Imagen base — resizeMode="contain" para que se vea completa */}
              <Image
                source={currentDefect.image}
                style={styles.defectImage}
                resizeMode="contain"
              />

              {/* Lupa arrastreable */}
              {imgLayout.width > 0 && (
                <View
                  style={[
                    styles.lupaContainer,
                    { left: lupaPos.x, top: lupaPos.y },
                  ]}
                  {...panResponder.panHandlers}
                >
                  {/* Círculo de zoom: la imagen está desplazada para mostrar
                      la zona centrada bajo la lupa */}
                  <View style={styles.lupaCircle}>
                    <Image
                      source={currentDefect.image}
                      style={[
                        styles.lupaZoomImage,
                        {
                          width:  imgLayout.width  * ZOOM_FACTOR,
                          height: imgLayout.height * ZOOM_FACTOR,
                          // Desplazamos la imagen ampliada para que el punto
                          // bajo el centro de la lupa quede centrado en el círculo
                          left: -(lupaCenterX * ZOOM_FACTOR) + LUPA_SIZE / 2,
                          top:  -(lupaCenterY * ZOOM_FACTOR) + LUPA_SIZE / 2,
                        },
                      ]}
                      resizeMode="contain"
                    />
                  </View>
                  {/* Asa de la lupa */}
                  <Text style={styles.lupaHandle}>🔍</Text>
                </View>
              )}
            </View>

            <TouchableOpacity
              style={styles.foundButton}
              onPress={() => setMod1Phase("question")}
            >
              <Text style={styles.foundButtonText}>¡Encontré el defecto!</Text>
            </TouchableOpacity>
          </>
        )}

        {/* ── FASE PREGUNTA (modal-like overlay sobre la imagen) ── */}
        {(mod1Phase === "question" || mod1Phase === "result") && (
          <View style={styles.questionPhaseContainer}>

            {/* Thumbnail de la imagen para referencia */}
            <View style={styles.defectThumbWrapper}>
              <Image source={currentDefect.image} style={styles.defectThumb} resizeMode="contain" />
            </View>

            {/* Caja de pregunta */}
            <View style={styles.questionBox}>
              <Text style={styles.questionText}>¿Qué tipo de defecto encontraste?</Text>
            </View>

            {/* Opciones — solo visibles en fase "question" */}
            {mod1Phase === "question" && (
              <View style={styles.defectOptionsCol}>
                {defOptions.map((opt, i) => {
                  const isSelected = mod1Answer === opt;
                  const isWrong    = isSelected && opt !== currentDefect.defectType;
                  const isCorrect  = isSelected && opt === currentDefect.defectType;
                  return (
                    <TouchableOpacity
                      key={i}
                      style={[
                        styles.defectOptionBtn,
                        isWrong   && styles.defectOptionWrong,
                        isCorrect && styles.defectOptionCorrect,
                      ]}
                      onPress={() => handleDefectAnswer(opt)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.defectOptionText}>
                        {opt.charAt(0).toUpperCase() + opt.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Resultado al acertar o quedarse sin vidas */}
            {mod1Phase === "result" && (
              <View style={[styles.resultBanner,
                { backgroundColor: mod1Answer === currentDefect.defectType ? "#4CAF50" : "#E53935" }]}>
                <Text style={styles.resultBannerTitle}>
                  {mod1Answer === currentDefect.defectType ? "✅ ¡Correcto!" : "❌ Sin vidas"}
                </Text>
                <Text style={styles.resultBannerDesc}>
                  El defecto es:{" "}
                  <Text style={{ fontWeight: "900" }}>
                    {currentDefect.defectType.charAt(0).toUpperCase() + currentDefect.defectType.slice(1)}
                  </Text>
                  {"\n"}{currentDefect.hint}
                </Text>
                <TouchableOpacity style={styles.nextBtn} onPress={advanceMod1}>
                  <Text style={styles.nextBtnText}>
                    {mod1Index < DEFECT_CARDS.length - 1 ? "Siguiente imagen →" : "Módulo 2 →"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>

      {showLostLife && <LostLifeOverlay breakOpacity={breakOpacity} breakScale={breakScale} breakShake={breakShake} />}

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
  background:  { flex: 1 },
  introCenter: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143,197,207,0.88)",
    paddingVertical: 28, paddingHorizontal: 28, borderRadius: 25,
    alignItems: "center", maxWidth: "88%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  introTitle:     { fontSize: 52, color: "#fff", textAlign: "center", marginBottom: 18, fontWeight: "800" },
  introDesc:      { fontSize: 26, color: "#fff", textAlign: "center", lineHeight: 36 },
  playButton:     { marginTop: 28, backgroundColor: "#4C92E4", paddingVertical: 14, paddingHorizontal: 44, borderRadius: 16 },
  playButtonText: { color: "#fff", fontSize: 30, fontWeight: "800" },

  gameContainer: { flex: 1, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 16 },
  topBar:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },

  /* Vidas — solo corazones */
  livesDisplay: { flexDirection: "row", alignItems: "center", gap: 4 },
  livesNum:     { fontSize: 26, fontWeight: "900", color: "#0F1B4C" },
  livesHeart:   { fontSize: 26 },

  moduleLabel:  { fontSize: 18, fontWeight: "900", color: "#0F1B4C", textAlign: "center", flex: 1 },
  progressText: { fontSize: 18, fontWeight: "800", color: "#0F1B4C" },

  instruccionRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  instruccionText: { fontSize: 16, fontWeight: "700", color: "#0F1B4C", flex: 1 },
  hintBtn:         { backgroundColor: "#FACC15", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12 },
  hintBtnText:     { fontSize: 14, fontWeight: "800", color: "#78350F" },
  hintBox:         { backgroundColor: "rgba(255,255,255,0.9)", borderRadius: 10, padding: 10, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: "#FACC15" },
  hintText:        { fontSize: 14, color: "#333", fontStyle: "italic" },

  /* Imagen base con lupa — altura fija para dejar espacio al botón */
  defectImageWrapper: {
    height: SCREEN_HEIGHT * 0.72,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5,
    borderColor: "#C9E3E9",
    marginBottom: 10,
    position: "relative",
  },
  // La imagen ocupa todo el contenedor pero en "contain" → se ve completa
  defectImage: {
    width: "100%",
    height: "100%",
  },

  /* Lupa: posicionada absolutamente dentro del contenedor de imagen */
  lupaContainer: {
    position: "absolute",
    width:  LUPA_SIZE,
    height: LUPA_SIZE,
    zIndex: 20,
  },
  lupaCircle: {
    width:  LUPA_SIZE,
    height: LUPA_SIZE,
    borderRadius: LUPA_SIZE / 2,
    overflow: "hidden",
    borderWidth: 3,
    borderColor: "#4C92E4",
    backgroundColor: "#111",
  },
  lupaZoomImage: {
    position: "absolute",
  },
  // Pequeño ícono de asa en la esquina inferior derecha
  lupaHandle: {
    position: "absolute",
    bottom: -10,
    right:  -10,
    fontSize: 28,
  },

  foundButton: {
    backgroundColor: "#4C92E4", borderRadius: 14,
    paddingVertical: 14, alignItems: "center", marginBottom: 4,
  },
  foundButtonText: { color: "#fff", fontSize: 20, fontWeight: "900" },

  /* Fase pregunta / resultado */
  questionPhaseContainer: { flex: 1, gap: 12 },
  defectThumbWrapper: {
    height: SCREEN_HEIGHT * 0.28,
    borderRadius: 16, overflow: "hidden",
    borderWidth: 1.5, borderColor: "#C9E3E9",
    backgroundColor: "#fff",
  },
  defectThumb: { width: "100%", height: "100%" },

  questionBox: {
    backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14,
    padding: 14, borderLeftWidth: 4, borderLeftColor: "#4C92E4",
  },
  questionText: { fontSize: 18, fontWeight: "800", color: "#0F1B4C", textAlign: "center" },

  defectOptionsCol: { gap: 10 },
  defectOptionBtn: {
    backgroundColor: "rgba(76,146,228,0.85)",
    borderRadius: 14, paddingVertical: 16,
    alignItems: "center",
    borderWidth: 1.5, borderColor: "#4C92E4",
  },
  defectOptionWrong:   { backgroundColor: "#E53935", borderColor: "#B71C1C" },
  defectOptionCorrect: { backgroundColor: "#4CAF50", borderColor: "#2E7D32" },
  defectOptionText:    { color: "#fff", fontSize: 20, fontWeight: "900" },

  resultBanner: {
    borderRadius: 16, padding: 18, gap: 10, alignItems: "center",
  },
  resultBannerTitle: { fontSize: 26, fontWeight: "900", color: "#fff" },
  resultBannerDesc:  { fontSize: 16, color: "#fff", textAlign: "center", lineHeight: 22 },
  nextBtn: {
    backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 12,
    paddingVertical: 12, paddingHorizontal: 28, marginTop: 6,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.6)",
  },
  nextBtnText: { color: "#fff", fontSize: 18, fontWeight: "900" },

  /* Módulo 2 */
  zoneLegendRow: { flexDirection: "row", gap: 6, marginBottom: 8, justifyContent: "center" },
  zoneBadge:     { borderRadius: 8, paddingVertical: 5, paddingHorizontal: 10 },
  zoneBadgeText: { color: "#fff", fontSize: 12, fontWeight: "800" },

  zoneImageWrapper: {
    flex: 0.9, borderRadius: 18, overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.92)",
    borderWidth: 1.5, borderColor: "#C9E3E9",
    marginBottom: 8, position: "relative",
  },
  zoneImage: { width: "100%", height: "100%" },
  vidrioLabel: {
    position: "absolute", bottom: 10, left: 10,
    backgroundColor: "rgba(0,0,0,0.55)", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  vidrioLabelText: { color: "#fff", fontSize: 14, fontWeight: "800" },

  zoneOptionsRow: { flexDirection: "row", gap: 8 },
  zoneOptionBtn: {
    flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.5)",
  },
  zoneOptionZone: { color: "#fff", fontSize: 22, fontWeight: "900" },
  zoneOptionCrit: { color: "#fff", fontSize: 13, fontWeight: "800", opacity: 0.9 },
  zoneOptionDesc: { color: "#fff", fontSize: 11, textAlign: "center", opacity: 0.85, lineHeight: 14 },

  /* Overlays */
  overlayCenter: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  overlayTop: {
    position: "absolute", top: 0, right: 0, bottom: 0, left: 0,
    backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center",
    alignItems: "center", zIndex: 9999, elevation: 9999,
  },
  moduleSplashBox:  { backgroundColor: "rgba(255,255,255,0.88)", paddingVertical: 20, paddingHorizontal: 40, borderRadius: 20 },
  moduleSplashText: { fontSize: 44, color: "#0F1B4C", fontWeight: "900", textAlign: "center" },
  lostLifeBox: {
    backgroundColor: "#fff", borderRadius: 16,
    paddingVertical: 16, paddingHorizontal: 24,
    alignItems: "center", elevation: 12,
  },
  bigHeart:     { fontSize: 80 },
  minusOneText: { fontSize: 48, color: "#DC2626", marginTop: -8, fontWeight: "900" },

  finalBox: {
    width: "80%", backgroundColor: "#77b479", borderRadius: 22,
    paddingVertical: 30, paddingHorizontal: 24, alignItems: "center",
    shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 },
  },
  finalScore:      { color: "#fff", fontSize: 110, fontWeight: "900", marginBottom: 8 },
  finalTitle:      { color: "#fff", fontSize: 50,  fontWeight: "900", textAlign: "center", marginBottom: 20 },
  finalButton:     { backgroundColor: "#4C92E4", paddingVertical: 14, paddingHorizontal: 44, borderRadius: 14 },
  finalButtonText: { color: "#fff", fontSize: 36, fontWeight: "900" },
});