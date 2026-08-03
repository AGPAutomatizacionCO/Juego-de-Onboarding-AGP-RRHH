import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated as RNAnimated,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
========================================================= */
const fondo = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/Manipulacion"; // ⚠️ ajusta al nombre real de tu archivo del mapa

const API_URL   = API_BASE_URL;
const ISLA_KEY  = 5;   // ← Manipulación del Vidrio
const NIVEL_KEY = 21;  // ← Nivel Visual

const VIDAS_POR_SUBMODULO = 3;

/* =========================================================
   MÓDULO 1 — SECUENCIAS DE MANIPULACIÓN
   Guarda las fotos con estos nombres en assets/manipulacion/
   El número final indica el ORDEN CORRECTO del paso:
   mono_peq_1.png = paso 1, mono_peq_2.png = paso 2, etc.
   Las imágenes aparecen BARAJADAS aleatoriamente en cada
   submódulo y se ARRASTRAN hasta el cuadro correspondiente.
========================================================= */
type SecuenciaSub = {
  id: string;
  titulo: string;
  imagenes: any[]; // en orden correcto (índice 0 = paso 1)
};

const SUBMODULOS_SECUENCIA: SecuenciaSub[] = [
  {
    id: "mono_peq",
    titulo: "Manipulación Vidrio Monolítico – Piezas pequeñas",
    imagenes: [
      require("../assets/manipulacion/mono_peq_1.png"),
      require("../assets/manipulacion/mono_peq_2.png"),
      require("../assets/manipulacion/mono_peq_3.png"),
      require("../assets/manipulacion/mono_peq_4.png"),
    ],
  },
  {
    id: "mono_gra",
    titulo: "Manipulación Vidrio Monolítico – Piezas Grandes",
    imagenes: [
      require("../assets/manipulacion/mono_gra_1.png"),
      require("../assets/manipulacion/mono_gra_2.png"),
      require("../assets/manipulacion/mono_gra_3.png"),
      require("../assets/manipulacion/mono_gra_4.png"),
      require("../assets/manipulacion/mono_gra_5.png"),
    ],
  },
  {
    id: "blin_gra",
    titulo: "Manipulación Vidrio Blindado – Piezas Grandes",
    imagenes: [
      require("../assets/manipulacion/blin_gra_1.jpg"),
      require("../assets/manipulacion/blin_gra_2.jpg"),
      require("../assets/manipulacion/blin_gra_3.jpg"),
      require("../assets/manipulacion/blin_gra_4.jpg"),
      require("../assets/manipulacion/blin_gra_5.jpg"),
    ],
  },
  {
    id: "blin_peq",
    titulo: "Manipulación Vidrio Blindado – Piezas Pequeñas",
    imagenes: [
      require("../assets/manipulacion/blin_peq_1.jpg"),
      require("../assets/manipulacion/blin_peq_2.jpg"),
      require("../assets/manipulacion/blin_peq_3.jpg"),
      require("../assets/manipulacion/blin_peq_4.jpg"),
      require("../assets/manipulacion/blin_peq_5.jpg"),
    ],
  },
];

/* =========================================================
   MÓDULO 2 — UBICACIÓN DE LAS MANOS
   Contenido según las 3 diapositivas de manipulacionv:
   1) 1 persona · Lateral delantero (menos de 25 kg)
   2) 2 personas · Parabrisas (posición tipo espejo)
   3) 4 personas · Vidrio Nivel 7 (más de 50 kg)
========================================================= */
type PuntoMano = { id: string; x: number; y: number; correcta: boolean };
type ManosSub = {
  id: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  nota: string;
  etiquetaVidrio: string;
  personasCorrectas: number;
  opcionesPersonas: number[];
  vidrio: { widthPct: number; heightPct: number; borderRadius: number };
  puntos: PuntoMano[];
};

const SUBMODULOS_MANOS: ManosSub[] = [
  {
    id: "una_persona",
    titulo: "Manipulación — 1 persona",
    subtitulo: "Lateral delantero — menos de 25 kg",
    descripcion:
      "Un operario manipula individualmente un lateral delantero (menos de 25 kg). Toca los puntos del vidrio donde deben ubicarse las manos y selecciona cuántas personas manipulan la pieza.",
    nota: "Tomar de los lados laterales · apoyo base en la pelvis",
    etiquetaVidrio: "Lateral delantero\nvidrio individual",
    personasCorrectas: 1,
    opcionesPersonas: [1, 2, 4],
    vidrio: { widthPct: 62, heightPct: 72, borderRadius: 16 },
    puntos: [
      { id: "izq_medio",  x: 2,  y: 50, correcta: true  },
      { id: "der_medio",  x: 98, y: 50, correcta: true  },
      { id: "sup_centro", x: 50, y: 4,  correcta: false },
      { id: "inf_centro", x: 50, y: 96, correcta: false },
    ],
  },
  {
    id: "dos_personas",
    titulo: "Manipulación — 2 personas",
    subtitulo: "Parabrisas — posición tipo espejo",
    descripcion:
      "Dos operarios manipulan un parabrisas en posición tipo espejo, uno a cada lado. Toca los puntos donde van las manos (cada operario: una mano arriba y una mano abajo) y selecciona cuántas personas manipulan la pieza.",
    nota: "Posición tipo espejo · mano arriba y mano abajo · precaución con el antebrazo",
    etiquetaVidrio: "Parabrisas\nentre dos personas",
    personasCorrectas: 2,
    opcionesPersonas: [1, 2, 4],
    vidrio: { widthPct: 84, heightPct: 68, borderRadius: 18 },
    puntos: [
      { id: "izq_arriba", x: 3,  y: 18, correcta: true  },
      { id: "izq_abajo",  x: 3,  y: 82, correcta: true  },
      { id: "der_arriba", x: 97, y: 18, correcta: true  },
      { id: "der_abajo",  x: 97, y: 82, correcta: true  },
      { id: "sup_centro", x: 50, y: 4,  correcta: false },
      { id: "inf_centro", x: 50, y: 96, correcta: false },
    ],
  },
  {
    id: "cuatro_personas",
    titulo: "Manipulación — 4 personas",
    subtitulo: "Vidrio Nivel 7 — más de 50 kg — mínimo 4 personas",
    descripcion:
      "Un vidrio grande Nivel 7 (más de 50 kg) debe manipularse mínimo entre 4 personas: un operario en cada extremo de la pieza, con el antebrazo en la vista inferior. Toca todos los puntos donde van las manos y selecciona cuántas personas manipulan la pieza.",
    nota: "Antebrazo en vista inferior · un operario en cada extremo",
    etiquetaVidrio: "Vidrio grande — Nivel 7\n4 operarios · antebrazo en vista inferior",
    personasCorrectas: 4,
    opcionesPersonas: [2, 4, 6],
    vidrio: { widthPct: 90, heightPct: 66, borderRadius: 18 },
    puntos: [
      { id: "izq_arr",  x: 2,  y: 20, correcta: true  },
      { id: "izq_abj",  x: 2,  y: 78, correcta: true  },
      { id: "der_arr",  x: 98, y: 20, correcta: true  },
      { id: "der_abj",  x: 98, y: 78, correcta: true  },
      { id: "sup_izq",  x: 30, y: 3,  correcta: true  },
      { id: "base_izq", x: 30, y: 97, correcta: true  },
      { id: "sup_der",  x: 70, y: 3,  correcta: true  },
      { id: "base_der", x: 70, y: 97, correcta: true  },
      { id: "centro",   x: 50, y: 50, correcta: false },
    ],
  },
];

const TOTAL_VIDAS =
  (SUBMODULOS_SECUENCIA.length + SUBMODULOS_MANOS.length) * VIDAS_POR_SUBMODULO; // 4×3 + 3×3 = 21

function shuffleIdx(n: number): number[] {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  // Evitar que salga ya ordenada de casualidad
  if (a.every((v, i) => v === i)) return shuffleIdx(n);
  return a;
}

/* =========================================================
   IMAGEN ARRASTRABLE (patrón del nivel Lectura)
========================================================= */
function DraggableImagen({
  imgIdx,
  source,
  onDrop,
  small,
}: {
  imgIdx: number;
  source: any;
  onDrop: (imgIdx: number, dropX: number, dropY: number) => void;
  small: boolean;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  const astyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging ? 50 : 1,
  }));

  const onGestureEvent = (e: any) => {
    tx.value = e.nativeEvent.translationX;
    ty.value = e.nativeEvent.translationY;
  };

  const onHandlerStateChange = (e: any) => {
    const { absoluteX, absoluteY, state } = e.nativeEvent || {};
    if (state === State.END) {
      if (absoluteX && absoluteY) onDrop(imgIdx, absoluteX, absoluteY);
      setDragging(false);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
    }
  };

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      onBegan={() => setDragging(true)}
      onEnded={() => setDragging(false)}
      onCancelled={() => setDragging(false)}
      onFailed={() => setDragging(false)}
    >
      <Animated.View style={[st.trayCard, astyle, dragging && st.trayCardDragging]}>
        <Image
  source={source}
  style={[
    st.trayImg,
    small && {
      width: scaleDP(130),
      height: scaleDP(82),
    },
  ]}
  resizeMode="cover"
/>
      </Animated.View>
    </PanGestureHandler>
  );
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function NivelVisualManipulacion() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  /* ── Sesión / ya jugado ── */
  const [usuarioKey,   setUsuarioKey]   = useState<number | null>(null);
  const [checking,     setChecking]     = useState(true);
  const [alreadyPlayed,setAlreadyPlayed]= useState(false);
  const [savedScore,   setSavedScore]   = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      const raw = params?.usuarioKey;
      const fromParams = Number(Array.isArray(raw) ? raw[0] : raw);
      let uk = Number.isFinite(fromParams) && fromParams > 0 ? fromParams : null;
      if (!uk) {
        const stored = await AsyncStorage.getItem("USUARIO_KEY");
        uk = stored ? Number(stored) : null;
      }
      if (uk && uk > 0) {
        setUsuarioKey(uk);
        await AsyncStorage.setItem("USUARIO_KEY", String(uk));
        const done  = await AsyncStorage.getItem(`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`);
        const score = await AsyncStorage.getItem(`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`);
        if (done === "true" && score) { setAlreadyPlayed(true); setSavedScore(Number(score)); }
      }
      setChecking(false);
    })();
  }, [params]);

  /* ── Fases ── */
  const [fase, setFase] = useState<"intro" | "modulo1" | "modulo2" | "final">("intro");

  /* ── Vidas / puntaje global ── */
  const [vidas, setVidas]                           = useState(VIDAS_POR_SUBMODULO);
  const [vidasGastadasTotal, setVidasGastadasTotal] = useState(0);
  const vidasGastadasRef = useRef(0);

  const gastarVida = () => {
    vidasGastadasRef.current += 1;
    setVidasGastadasTotal(vidasGastadasRef.current);
    setVidas((v) => Math.max(0, v - 1));
  };

  const renovarVidas = () => setVidas(VIDAS_POR_SUBMODULO);

  const finalScore = useMemo(
    () => Math.round(((TOTAL_VIDAS - vidasGastadasTotal) / TOTAL_VIDAS) * 100),
    [vidasGastadasTotal]
  );

  /* ── Animaciones de vidas (estándar) ── */
  const heartScale   = useRef(new RNAnimated.Value(1)).current;
  const minusScale   = useRef(new RNAnimated.Value(0.6)).current;
  const minusOpacity = useRef(new RNAnimated.Value(0)).current;
  const minusShake   = useRef(new RNAnimated.Value(0)).current;
  const fadeAnim     = useRef(new RNAnimated.Value(0)).current;

  const [showMinusOverlay, setShowMinusOverlay] = useState(false);
  const [showSinVidas,     setShowSinVidas]     = useState(false);
  const [showOkOverlay,    setShowOkOverlay]    = useState(false);

  const animateHeart = () => {
    Vibration.vibrate(100);
    RNAnimated.sequence([
      RNAnimated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      RNAnimated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
      RNAnimated.timing(heartScale, { toValue: 1.2, duration: 120, useNativeDriver: true }),
      RNAnimated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const playMinusAnim = () => {
    minusScale.setValue(0.6); minusOpacity.setValue(0); minusShake.setValue(0);
    Vibration.vibrate(120);
    RNAnimated.parallel([
      RNAnimated.timing(minusOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      RNAnimated.sequence([
        RNAnimated.timing(minusScale, { toValue: 1.25, duration: 220, useNativeDriver: true }),
        RNAnimated.timing(minusScale, { toValue: 1,    duration: 160, useNativeDriver: true }),
      ]),
      RNAnimated.sequence([
        RNAnimated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: -1, duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: 1,  duration: 70, useNativeDriver: true }),
        RNAnimated.timing(minusShake, { toValue: 0,  duration: 70, useNativeDriver: true }),
      ]),
    ]).start();
  };

  useEffect(() => { if (showMinusOverlay) playMinusAnim(); }, [showMinusOverlay]);

  const shakeX = minusShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  /* =========================================================
     MÓDULO 1 — estado + drag & drop
  ========================================================= */
  const [sub1Index, setSub1Index] = useState(0);
  const sub1 = SUBMODULOS_SECUENCIA[sub1Index];

  const [bandeja, setBandeja] = useState<number[]>([]);
  const [slots, setSlots]     = useState<(number | null)[]>([]);
  const [slotFeedback, setSlotFeedback] = useState<("ok" | "bad" | null)[]>([]);

  // Refs para evitar closures viejos dentro de los gestos
  const slotsRef = useRef<(number | null)[]>([]);
  useEffect(() => { slotsRef.current = slots; }, [slots]);

  // ✅ FIX drag: rects por slot (patrón slotRects del nivel Lectura)
  const slotViewRefs = useRef<Record<number, View | null>>({});
  const slotRects    = useRef<Record<number, { x: number; y: number; width: number; height: number }>>({});

  const medirSlots = () => {
    Object.entries(slotViewRefs.current).forEach(([pos, ref]) => {
      if (!ref) return;
      ref.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) slotRects.current[Number(pos)] = { x, y, width: w, height: h };
      });
    });
  };

  const iniciarSub1 = (idx: number) => {
    const n = SUBMODULOS_SECUENCIA[idx].imagenes.length;
    setBandeja(shuffleIdx(n));           // ← orden ALEATORIO en cada submódulo
    setSlots(Array(n).fill(null));
    setSlotFeedback(Array(n).fill(null));
    slotRects.current = {};
    renovarVidas();
    setTimeout(() => medirSlots(), 300); // medir cuadros tras el render
  };

  /* Soltar imagen: se coloca en el cuadro donde cayó (si está vacío) */
  const handleDropImagen = (imgIdx: number, dropX: number, dropY: number) => {
    medirSlots(); // re-medir para la siguiente vez (fix conocido)
    const current = slotsRef.current;
    for (const [pos, r] of Object.entries(slotRects.current)) {
      if (dropX > r.x && dropX < r.x + r.width && dropY > r.y && dropY < r.y + r.height) {
        const posNum = Number(pos);
        if (current[posNum] !== null) return; // cuadro ocupado → regresa a la bandeja
        setSlots((p) => { const u = [...p]; u[posNum] = imgIdx; return u; });
        setBandeja((p) => p.filter((i) => i !== imgIdx));
        setSlotFeedback((p) => { const u = [...p]; u[posNum] = null; return u; });
        return;
      }
    }
    // Si no cayó sobre ningún cuadro, la animación la regresa sola a la bandeja
  };

  /* Tocar un cuadro con imagen → la devuelve a la bandeja (para corregir) */
  const quitarDeSlot = (slotIdx: number) => {
    const imgIdx = slots[slotIdx];
    if (imgIdx === null) return;
    setSlots((p) => { const u = [...p]; u[slotIdx] = null; return u; });
    setBandeja((p) => [...p, imgIdx]);
    setSlotFeedback((p) => { const u = [...p]; u[slotIdx] = null; return u; });
  };

  const sub1Completo = slots.length > 0 && slots.every((s) => s !== null);

  const validarSub1 = () => {
    if (!sub1Completo) return;
    // La imagen N debe quedar en el cuadro N (índice 0 = paso 1)
    const fb: ("ok" | "bad")[] = slots.map((imgIdx, pos) => (imgIdx === pos ? "ok" : "bad"));
    setSlotFeedback(fb);
    const todoOk = fb.every((f) => f === "ok");

    if (todoOk) { setShowOkOverlay(true); return; }

    animateHeart();
    gastarVida();
    if (vidas - 1 <= 0) setShowSinVidas(true);
    else setShowMinusOverlay(true);
  };

  const avanzarDesdeSub1 = () => {
    setShowOkOverlay(false);
    setShowSinVidas(false);
    if (sub1Index < SUBMODULOS_SECUENCIA.length - 1) {
      const next = sub1Index + 1;
      setSub1Index(next);
      iniciarSub1(next);
    } else {
      setSub2Index(0);
      iniciarSub2(0);
      setFase("modulo2");
    }
  };

  /* =========================================================
     MÓDULO 2 — estado
  ========================================================= */
  const [sub2Index, setSub2Index] = useState(0);
  const sub2 = SUBMODULOS_MANOS[sub2Index];

  const [puntosSel,   setPuntosSel]   = useState<string[]>([]);
  const [personasSel, setPersonasSel] = useState<number | null>(null);
  const [manosFeedback, setManosFeedback] = useState<"ok" | "bad" | null>(null);

  const iniciarSub2 = (_idx: number) => {
    setPuntosSel([]);
    setPersonasSel(null);
    setManosFeedback(null);
    renovarVidas();
  };

  const togglePunto = (id: string) => {
    setManosFeedback(null);
    setPuntosSel((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  };

  const sub2Completo = puntosSel.length > 0 && personasSel !== null;

  const validarSub2 = () => {
    if (!sub2Completo) return;
    const correctas = sub2.puntos.filter((p) => p.correcta).map((p) => p.id).sort();
    const sel       = [...puntosSel].sort();
    const puntosOk  = correctas.length === sel.length && correctas.every((c, i) => c === sel[i]);
    const personasOk = personasSel === sub2.personasCorrectas;

    if (puntosOk && personasOk) {
      setManosFeedback("ok");
      setShowOkOverlay(true);
      return;
    }

    setManosFeedback("bad");
    animateHeart();
    gastarVida();
    if (vidas - 1 <= 0) setShowSinVidas(true);
    else setShowMinusOverlay(true);
  };

  const avanzarDesdeSub2 = () => {
    setShowOkOverlay(false);
    setShowSinVidas(false);
    if (sub2Index < SUBMODULOS_MANOS.length - 1) {
      const next = sub2Index + 1;
      setSub2Index(next);
      iniciarSub2(next);
    } else {
      terminarNivel();
    }
  };

  /* ── FINAL ── */
  const terminarNivel = async () => {
    setFase("final");
    fadeAnim.setValue(0);
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();

    try {
      const uk = usuarioKey;
      if (!uk) return;
      const score = Math.round(((TOTAL_VIDAS - vidasGastadasRef.current) / TOTAL_VIDAS) * 100);
      await AsyncStorage.multiSet([
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_done`,  "true"],
        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_visual_score`, String(score)],
        [`u:${uk}:isla${ISLA_KEY}_nivel22_lectura_unlocked`,       "true"],
      ]);
      await fetch(`${API_URL}/api/niveles/visual/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey: uk, puntaje: score, aprobado: score >= 70 ? 1 : 0, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY }),
      });
    } catch (e) {
      console.log("Error guardando visual Manipulación:", e);
    }
  };

  const empezar = () => {
    vidasGastadasRef.current = 0;
    setVidasGastadasTotal(0);
    setSub1Index(0);
    iniciarSub1(0);
    setFase("modulo1");
  };

  /* =========================================================
     RENDER
  ========================================================= */
  if (!loaded || checking) return <View style={{ flex: 1, backgroundColor: "#fff" }} />;

  const avanzarActual = fase === "modulo1" ? avanzarDesdeSub1 : avanzarDesdeSub2;

  return (
    <ImageBackground source={fondo} style={st.bg} resizeMode="cover">
      <View style={st.overlayBg}>

        {/* ── YA JUGADO ── */}
        {alreadyPlayed && savedScore !== null && (
          <View style={st.centered}>
            <View style={st.introBox}>
              <Text style={st.introTitle}>Nivel Visual – Manipulación del Vidrio</Text>
              <Text style={st.alertText}>¡Ya has completado este nivel!</Text>
              <Text style={st.scoreBig}>{savedScore}%</Text>
              <TouchableOpacity style={[st.playBtn, { backgroundColor: "#10B981" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                <Text style={st.playBtnTxt}>Volver</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── INTRO ── */}
        {!alreadyPlayed && fase === "intro" && (
          <View style={st.centered}>
            <View style={st.introBox}>
              <Text style={st.introTitle}>Nivel Visual – Manipulación del Vidrio</Text>
              <Text style={st.introDesc}>
                Este nivel tiene 2 módulos.{"\n\n"}
                En el primero deberás arrastrar las imágenes de cada procedimiento de manipulación al cuadro de la secuencia correcta.{"\n\n"}
                En el segundo deberás identificar dónde van las manos sobre el vidrio y cuántas personas lo manipulan según su tamaño y peso.{"\n\n"}
                Tienes <Text style={{ fontFamily: "PlusJakartaSans-Bold" }}>{VIDAS_POR_SUBMODULO} vidas por sección</Text>; tu puntaje final depende de cuántas vidas uses en total.
              </Text>
              <TouchableOpacity style={st.playBtn} onPress={empezar}>
                <Text style={st.playBtnTxt}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════
            MÓDULO 1 — ARRASTRAR SECUENCIAS
        ══════════════════════════════════════ */}
        {!alreadyPlayed && fase === "modulo1" && (
          <View style={st.gameRoot}>
            <View style={st.headerBar}>
              <Text style={st.headerBarTxt}>{sub1.titulo}</Text>
            </View>

            <View style={st.statusRow}>
              <Text style={st.statusTxt}>Módulo 1 · Sección {sub1Index + 1} / {SUBMODULOS_SECUENCIA.length}</Text>
              <RNAnimated.View style={[st.livesBox, { transform: [{ scale: heartScale }] }]}>
                <Text style={st.livesHeart}>❤️</Text>
                <Text style={st.livesNum}>{vidas}</Text>
              </RNAnimated.View>
            </View>

            {/* ⚠️ Sin ScrollView aquí: el scroll interfiere con el arrastre.
                Bandeja y secuencia caben en pantalla (layout horizontal de tablet). */}
            <View style={st.mod1Body}>
              {/* Bandeja de imágenes desordenadas (arrastrables) */}
              <View style={st.tray} onLayout={() => setTimeout(() => medirSlots(), 200)}>
                {bandeja.map((imgIdx) => (
                  <DraggableImagen
  key={`${sub1.id}-${imgIdx}`}
  imgIdx={imgIdx}
  source={sub1.imagenes[imgIdx]}
  onDrop={handleDropImagen}
  small={sub1.imagenes.length === 5}
/>
                ))}
                {bandeja.length === 0 && (
                  <Text style={st.trayEmptyTxt}>Toca una imagen de abajo para devolverla aquí</Text>
                )}
              </View>

              {/* Secuencia correcta (cuadros destino) */}
              <View style={st.sequencePanel}>
                <Text style={st.sequenceTitle}>SECUENCIA CORRECTA</Text>
                <View style={st.slotsRow}>
                  {slots.map((imgIdx, pos) => {
                    const fb = slotFeedback[pos];
                    return (
                      <View key={pos} style={st.slotCol}>
                        <View style={st.slotNumCircle}>
                          <Text style={st.slotNumTxt}>{pos + 1}</Text>
                        </View>
                        <TouchableOpacity
                          activeOpacity={0.85}
                          onPress={() => quitarDeSlot(pos)}
                          style={[
  st.slotBox,

  sub1.imagenes.length === 5 && {
    width: scaleDP(130),
    height: scaleDP(82),
  },

  fb === "ok" && st.slotBoxOk,
  fb === "bad" && st.slotBoxBad,
]}
                        >
                          {/* View interno medible para el drop */}
                          <View
                            ref={(ref) => { slotViewRefs.current[pos] = ref; }}
                            style={st.slotInner}
                            onLayout={() => setTimeout(() => medirSlots(), 120)}
                          >
                            {imgIdx !== null ? (
                              <Image source={sub1.imagenes[imgIdx]} style={st.slotImg} resizeMode="cover" />
                            ) : (
                              <Text style={st.slotPlaceholder}>?</Text>
                            )}
                          </View>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
              </View>
            </View>

            <View style={st.bottomRow}>
              <TouchableOpacity style={[st.bottomBtn, { backgroundColor: "#B2B2B2" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                <Text style={st.bottomBtnTxt}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.bottomBtn, { backgroundColor: sub1Completo ? "#4C92E4" : "#A0AEC0" }]}
                disabled={!sub1Completo}
                onPress={validarSub1}
              >
                <Text style={st.bottomBtnTxt}>Validar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════
            MÓDULO 2 — UBICACIÓN DE LAS MANOS
        ══════════════════════════════════════ */}
        {!alreadyPlayed && fase === "modulo2" && (
          <View style={st.gameRoot}>
            <View style={st.headerBar}>
              <Text style={st.headerBarTxt}>{sub2.titulo}</Text>
              <Text style={st.headerBarSub}>{sub2.subtitulo}</Text>
            </View>

            <View style={st.statusRow}>
              <Text style={st.statusTxt}>Módulo 2 · Sección {sub2Index + 1} / {SUBMODULOS_MANOS.length}</Text>
              <RNAnimated.View style={[st.livesBox, { transform: [{ scale: heartScale }] }]}>
                <Text style={st.livesHeart}>❤️</Text>
                <Text style={st.livesNum}>{vidas}</Text>
              </RNAnimated.View>
            </View>

            <ScrollView contentContainerStyle={{ alignItems: "center", paddingBottom: scaleDP(14) }} showsVerticalScrollIndicator={false}>
              <Text style={st.manosDesc}>{sub2.descripcion}</Text>

              <View style={st.vidrioArea}>
                <View
                  style={[
                    st.vidrio,
                    {
                      width:  `${sub2.vidrio.widthPct}%`,
                      height: `${sub2.vidrio.heightPct}%`,
                      borderRadius: scaleDP(sub2.vidrio.borderRadius),
                    },
                    manosFeedback === "bad" && { borderColor: "#DC2626" },
                    manosFeedback === "ok"  && { borderColor: "#16A34A" },
                  ]}
                >
                  <View style={st.vidrioShine} />
                  <View style={st.vidrioShine2} />
                  <View style={st.vidrioInner} pointerEvents="none" />

                  <View style={st.vidrioLabelWrap} pointerEvents="none">
                    <Text style={st.vidrioLabel}>{sub2.etiquetaVidrio}</Text>
                  </View>

                  {sub2.puntos.map((p) => {
                    const sel = puntosSel.includes(p.id);
                    return (
                      <TouchableOpacity
                        key={p.id}
                        activeOpacity={0.8}
                        onPress={() => togglePunto(p.id)}
                        style={[
                          st.punto,
                          { left: `${p.x}%`, top: `${p.y}%` },
                          sel && st.puntoSel,
                        ]}
                      >
                        <Text style={st.puntoTxt}>{sel ? "🖐️" : "+"}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <Text style={st.personasLabel}>¿Cuántas personas manipulan esta pieza?</Text>
              <View style={st.personasRow}>
                {sub2.opcionesPersonas.map((n) => {
                  const sel = personasSel === n;
                  return (
                    <TouchableOpacity
                      key={n}
                      style={[st.personaChip, sel && st.personaChipSel]}
                      activeOpacity={0.85}
                      onPress={() => { setManosFeedback(null); setPersonasSel(n); }}
                    >
                      <Text style={[st.personaChipTxt, sel && { color: "#fff" }]}>
                        {n} {n === 1 ? "persona" : "personas"}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={st.bottomRow}>
              <TouchableOpacity style={[st.bottomBtn, { backgroundColor: "#B2B2B2" }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                <Text style={st.bottomBtnTxt}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[st.bottomBtn, { backgroundColor: sub2Completo ? "#4C92E4" : "#A0AEC0" }]}
                disabled={!sub2Completo}
                onPress={validarSub2}
              >
                <Text style={st.bottomBtnTxt}>Validar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════════════════════════════
            OVERLAYS
        ══════════════════════════════════════ */}

        {showOkOverlay && (
          <View style={st.modalOverlay}>
            <View style={st.okBox}>
              <Text style={st.okEmoji}>✅</Text>
              <Text style={st.okTitle}>
                {fase === "modulo1" ? "¡Secuencia correcta!" : "¡Posición correcta!"}
              </Text>
              {fase === "modulo2" && <Text style={st.okNota}>{sub2.nota}</Text>}
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(12) }]} onPress={avanzarActual}>
                <Text style={st.modalBtnTxt}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showMinusOverlay && (
          <View style={st.modalOverlay}>
            <View style={st.modalBoxSmall}>
              <RNAnimated.Text style={[st.bigHeart, { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] }]}>
                💔
              </RNAnimated.Text>
              <Text style={st.minusOneText}>-1 vida</Text>
              <Text style={st.modalDescSmall}>
                {fase === "modulo1"
                  ? "Hay imágenes en el lugar equivocado.\nToca un cuadro para devolver su imagen y arrástrala al correcto."
                  : "La ubicación de las manos o el número de personas no es correcto.\nCorrige e intenta de nuevo."}
              </Text>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]} onPress={() => setShowMinusOverlay(false)}>
                <Text style={st.modalBtnTxt}>Corregir</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showSinVidas && (
          <View style={st.modalOverlay}>
            <View style={st.modalBoxSmall}>
              <Text style={st.bigHeart}>💔</Text>
              <Text style={st.minusOneText}>Sin vidas en esta sección</Text>
              <Text style={st.modalDescSmall}>
                Se gastaron las {VIDAS_POR_SUBMODULO} vidas de esta sección.{"\n"}Continuemos con la siguiente.
              </Text>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(10) }]} onPress={avanzarActual}>
                <Text style={st.modalBtnTxt}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {fase === "final" && (
          <View style={st.modalOverlay}>
            <RNAnimated.View style={[st.finalBox, {
              opacity: fadeAnim,
              transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
            }]}>
              <Text style={st.scoreBig}>{finalScore}%</Text>
              <Text style={st.alertText}>
                {finalScore >= 90
                  ? "¡Excelente! Dominas la manipulación del vidrio 🎉"
                  : finalScore >= 70
                  ? "¡Muy bien! Has completado el nivel visual 👍"
                  : "Nivel completado. ¡Sigue practicando la manipulación segura!"}
              </Text>
              <Text style={st.finalDetalle}>
                Vidas usadas: {vidasGastadasTotal} / {TOTAL_VIDAS}
              </Text>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(16) }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                <Text style={st.modalBtnTxt}>Continuar</Text>
              </TouchableOpacity>
            </RNAnimated.View>
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS — colores estándar de la app
========================================================= */
const CELESTE = "#A8D3DA";

const st = StyleSheet.create({
  bg:        { flex: 1 },
  overlayBg: { flex: 1, backgroundColor: "rgba(255,255,255,0.82)" },

  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },

  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: scaleDP(28), paddingHorizontal: scaleDP(28),
    borderRadius: scaleDP(25), alignItems: "center", maxWidth: "88%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  introTitle: { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(44), color: "#fff", textAlign: "center", marginBottom: scaleDP(16) },
  introDesc:  { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(22), color: "#fff", textAlign: "center", lineHeight: scaleDP(26) },
  playBtn:    { marginTop: scaleDP(24), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playBtnTxt: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(28) },

  gameRoot: { flex: 1, paddingBottom: scaleDP(10) },

  headerBar: {
    width: "100%",
    backgroundColor: CELESTE,
    paddingVertical: scaleDP(10),
    paddingHorizontal: scaleDP(20),
  },
  headerBarTxt: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(22), color: "#fff" },
  headerBarSub: { fontFamily: "PlusJakartaSans-Regular",   fontSize: scaleDP(13), color: "rgba(255,255,255,0.95)", marginTop: scaleDP(2) },

  statusRow: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: scaleDP(20),
    paddingVertical: scaleDP(8),
  },
  statusTxt: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14), color: "#0F1B4C" },
  livesBox:  { flexDirection: "row", alignItems: "center", gap: scaleDP(4) },
  livesHeart:{ fontSize: scaleDP(20) },
  livesNum:  { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), color: "#0F1B4C" },

  /* ── Módulo 1 ── */
  mod1Body: { flex: 0.88, alignItems: "center", justifyContent: "center" },

  tray: {
    width: "92%",
    backgroundColor: CELESTE,
    borderRadius: scaleDP(20),
    padding: scaleDP(12),
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: scaleDP(12),
    minHeight: scaleDP(120),
    alignItems: "center",
    marginBottom: scaleDP(10),
  },
  trayCard: {
    backgroundColor: "#fff",
    borderRadius: scaleDP(14),
    padding: scaleDP(7),
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  trayCardDragging: {
    shadowOpacity: 0.35, shadowRadius: 12,
    elevation: 12,
    transform: [{ scale: 1.05 }],
  },
  trayImg: { width: scaleDP(148), height: scaleDP(92), borderRadius: scaleDP(8) },
  trayEmptyTxt: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(13), color: "#fff", textAlign: "center" },

  sequencePanel: {
    width: "92%",
    backgroundColor: CELESTE,
    borderRadius: scaleDP(20),
    padding: scaleDP(12),
    alignItems: "center",
  },
  sequenceTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(13), color: "#fff", letterSpacing: 1, marginBottom: scaleDP(8) },
  slotsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: scaleDP(12) },
  slotCol:  { alignItems: "center", gap: scaleDP(6) },
  slotNumCircle: {
    width: scaleDP(30), height: scaleDP(30), borderRadius: scaleDP(15),
    backgroundColor: "#fff", alignItems: "center", justifyContent: "center",
    elevation: 2,
  },
  slotNumTxt: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(14), color: "#0F1B4C" },
  slotBox: {
    width: scaleDP(164), height: scaleDP(104),
    backgroundColor: "#fff",
    borderRadius: scaleDP(14),
    borderWidth: scaleDP(2), borderColor: "transparent",
    overflow: "hidden",
  },
  slotInner: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  slotBoxOk:  { borderColor: "#16A34A", borderWidth: scaleDP(3) },
  slotBoxBad: { borderColor: "#DC2626", borderWidth: scaleDP(3) },
  slotImg: { width: "100%", height: "100%" },
  slotPlaceholder: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(34), color: "#BFE0E6" },

  /* ── Módulo 2 ── */
  manosDesc: {
    width: "88%",
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(15),
    color: "#0F1B4C",
    textAlign: "center",
    marginTop: scaleDP(4),
    marginBottom: scaleDP(8),
    lineHeight: scaleDP(19),
  },
  vidrioArea: {
    width: "92%",
    height: scaleDP(300),
    backgroundColor: "#E8F2F8",
    borderRadius: scaleDP(20),
    alignItems: "center",
    justifyContent: "center",
  },
  vidrio: {
    backgroundColor: "rgba(173, 216, 235, 0.60)",
    borderWidth: scaleDP(4),
    borderColor: "#1E3A5F",
    overflow: "visible",
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  vidrioInner: {
    position: "absolute",
    top: "8%", left: "5%", right: "5%", bottom: "8%",
    borderWidth: scaleDP(1.5),
    borderColor: "rgba(93, 143, 179, 0.6)",
    borderStyle: "dashed",
    borderRadius: scaleDP(10),
  },
  vidrioShine: {
    position: "absolute",
    top: "-30%", left: "10%",
    width: "16%", height: "160%",
    backgroundColor: "rgba(255,255,255,0.30)",
    transform: [{ rotate: "20deg" }],
  },
  vidrioShine2: {
    position: "absolute",
    top: "-30%", left: "32%",
    width: "6%", height: "160%",
    backgroundColor: "rgba(255,255,255,0.22)",
    transform: [{ rotate: "20deg" }],
  },
  vidrioLabelWrap: { alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(20) },
  vidrioLabel: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(13),
    color: "#5B7A99",
    textAlign: "center",
    lineHeight: scaleDP(18),
  },
  punto: {
    position: "absolute",
    width: scaleDP(42), height: scaleDP(42),
    marginLeft: scaleDP(-21), marginTop: scaleDP(-21),
    borderRadius: scaleDP(21),
    backgroundColor: "rgba(255, 243, 205, 0.95)",
    borderWidth: scaleDP(2), borderColor: "#E8A33D",
    borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    zIndex: 10,
  },
  puntoSel: { backgroundColor: "#4C92E4", borderColor: "#1D4ED8", borderStyle: "solid" },
  puntoTxt: { fontSize: scaleDP(16), color: "#B4770A", fontFamily: "PlusJakartaSans-Bold" },

  personasLabel: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(15),
    color: "#0F1B4C",
    marginTop: scaleDP(12),
    marginBottom: scaleDP(6),
  },
  personasRow: { flexDirection: "row", gap: scaleDP(10), flexWrap: "wrap", justifyContent: "center" },
  personaChip: {
    borderWidth: scaleDP(2), borderColor: "#4C92E4",
    borderRadius: scaleDP(20),
    paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(18),
    backgroundColor: "#fff",
  },
  personaChipSel: { backgroundColor: "#4C92E4" },
  personaChipTxt: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14), color: "#0F1B4C" },

  /* ── Botones inferiores ── */
  bottomRow: { flexDirection: "row", justifyContent: "center", gap: scaleDP(12), paddingTop: scaleDP(50) },
  bottomBtn: { minWidth: scaleDP(150), paddingVertical: scaleDP(11), borderRadius: scaleDP(12), alignItems: "center" },
  bottomBtnTxt: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(15) },

  /* ── Overlays / modales ── */
  modalOverlay: {
    position: "absolute", top: 0, bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: scaleDP(24),
    zIndex: 999,
  },
  okBox: {
    backgroundColor: "#fff", borderRadius: scaleDP(18),
    paddingVertical: scaleDP(20), paddingHorizontal: scaleDP(30),
    alignItems: "center", elevation: 10, maxWidth: "80%",
  },
  okEmoji: { fontSize: scaleDP(46), marginBottom: scaleDP(4) },
  okTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(22), color: "#16A34A", textAlign: "center" },
  okNota: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: scaleDP(14),
    color: "#1D4ED8",
    textAlign: "center",
    marginTop: scaleDP(8),
    backgroundColor: "#EFF6FF",
    borderWidth: scaleDP(1),
    borderColor: "#BFDBFE",
    borderRadius: scaleDP(12),
    paddingVertical: scaleDP(6),
    paddingHorizontal: scaleDP(12),
    overflow: "hidden",
  },

  modalBoxSmall: {
    backgroundColor: "#fff", borderRadius: scaleDP(16),
    paddingVertical: scaleDP(16), paddingHorizontal: scaleDP(22),
    alignItems: "center", elevation: 8, maxWidth: "80%",
  },
  bigHeart:      { fontSize: scaleDP(56), textAlign: "center" },
  minusOneText:  { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(22), color: "#DC2626", marginTop: scaleDP(-2) },
  modalDescSmall:{ fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827", textAlign: "center", marginTop: scaleDP(6) },

  modalBtn:    { paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(26), borderRadius: scaleDP(10), minWidth: scaleDP(170), alignItems: "center" },
  modalBtnTxt: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(18) },

  finalBox: {
    backgroundColor: "#77b479",
    paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35),
    borderRadius: scaleDP(20), elevation: 10,
    alignItems: "center", maxWidth: "85%",
  },
  scoreBig:     { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(90), marginBottom: scaleDP(10) },
  alertText:    { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(28), textAlign: "center" },
  finalDetalle: { fontFamily: "PlusJakartaSans-Regular", color: "rgba(255,255,255,0.9)", fontSize: scaleDP(15), marginTop: scaleDP(8) },
});