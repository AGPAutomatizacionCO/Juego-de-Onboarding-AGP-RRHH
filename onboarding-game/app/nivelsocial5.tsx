import { useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Easing,
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
const fondo = require("../assets/fondofinal.png");

const API_URL   = API_BASE_URL;
const ISLA_KEY  = 8;
const NIVEL_KEY = 39;
const RUTA_VOLVER = "/Calidad";

const VIDAS_POR_CASO = 3;
const TOTAL_VIDAS    = VIDAS_POR_CASO * 6; // 18

/* =========================================================
   TIPOS
========================================================= */
type Letra   = "A" | "B" | "C";
type CasoBase = {
  id: number;
  pregunta: string;
  opciones: [string, string, string];
  correctaIdx: number;
  explicacion: string;
};
type Caso = {
  id: number;
  pregunta: string;
  opciones: Record<Letra, string>;
  correcta: Letra;
  explicacion: string;
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
    id:          base.id,
    pregunta:    base.pregunta,
    opciones:    { A: mezcladas[0], B: mezcladas[1], C: mezcladas[2] },
    correcta:    LETRAS[mezcladas.indexOf(textoCorrect)],
    explicacion: base.explicacion,
  };
}

/* =========================================================
   CASOS
========================================================= */
const casosBase: CasoBase[] = [
  {
    id: 1,
    pregunta:
      "Eres inspector de calidad en el turno de la mañana. Te llega un parabrisas del proceso de serigrafía. Al revisarlo con luz de día, notas una mancha blanca visible en la banda negra. Tu supervisor te pregunta qué haces con esa pieza. ¿Qué decides?",
    opciones: [
      "La apruebo, la mancha está en la banda negra y no afecta la visibilidad del conductor.",
      "La rechazo: en Zona 3 no se aceptan manchas visibles a la luz del día en la banda negra.",
      "La dejo pasar y lo reporto al final del turno.",
    ],
    correctaIdx: 1,
    explicacion:
      "La norma es clara: en Zona 3 (Banda Negra) NO SE ACEPTAN manchas visibles a la luz del día. No importa dónde esté ubicada, si es visible debe rechazarse. Nunca se deja pasar un defecto para reportarlo después.",
  },
  {
    id: 2,
    pregunta:
      "Estás en línea de inspección final. Recibes un lateral delantero y al pasarle la uña encuentras una raya que se siente claramente. Está ubicada en la Zona 1. ¿Qué haces?",
    opciones: [
      "La apruebo si mide menos de 40 mm.",
      "La reproceso y vuelvo a inspeccionar.",
      "La rechazo: las rayas sensibles a la uña no se permiten en ninguna zona.",
    ],
    correctaIdx: 2,
    explicacion:
      "Las Rayas Sensibles a la Uña NO SE PERMITEN en ninguna zona del vidrio, sin importar su tamaño ni ubicación. La única acción correcta es rechazar la pieza inmediatamente.",
  },
  {
    id: 3,
    pregunta:
      "Eres inspector y recibes un posterior del proceso de autoclave. Al medirlo encuentras 3 burbujas de 0,6 mm en Zona 2, cada una separada más de 100 mm entre sí. ¿Qué decides?",
    opciones: [
      "La rechazo porque hay más de 2 defectos en la misma pieza.",
      "La apruebo: cada burbuja cumple tamaño <= 0,8 mm y distancia > 100 mm entre sí.",
      "Consulto al Jefe de Calidad sin medir nada más.",
    ],
    correctaIdx: 1,
    explicacion:
      "En Zona 2 las burbujas se aceptan si miden <= 0,8 mm y están separadas > 100 mm. Cada burbuja de 0,6 mm cumple el tamaño y la distancia entre ellas supera los 100 mm, por lo tanto la pieza es aceptable.",
  },
  {
    id: 4,
    pregunta:
      "En tu turno recibes una cabina trasera. Al inspeccionarla encuentras un quiñe de 2 mm de largo y 0,8 mm de ancho justo en la Zona 3 (Banda Negra). ¿Qué haces?",
    opciones: [
      "La rechazo automáticamente, los quiñes nunca se aceptan en ninguna zona.",
      "La apruebo: en Zona 3 los quiñes se aceptan si Long <= 10 mm y Ancho <= 1,5 mm.",
      "La reproceso sin registrar el defecto para no generar reprocesos.",
    ],
    correctaIdx: 1,
    explicacion:
      "En Zona 3 (Banda Negra +10%) los quiñes SÍ se aceptan siempre que Longitud <= 10 mm y Ancho <= 1,5 mm. Este quiñe de 2 mm x 0,8 mm cumple ambos criterios, así que la pieza es aprobada. Además, todo defecto debe registrarse.",
  },
  {
    id: 5,
    pregunta:
      "Estás inspeccionando un parabrisas y encuentras un punto de color de 0,7 mm en plena Zona A, donde va la cámara. Tu compañero te dice que lo dejes pasar porque es muy pequeño. ¿Qué haces?",
    opciones: [
      "Le hago caso a mi compañero y la apruebo sin registrar nada.",
      "La rechazo porque cualquier defecto en Zona A debe rechazarse sin excepción.",
      "La apruebo: mide 0,7 mm, cumple el criterio de Zona A (<= 0,8 mm), y lo registro correctamente.",
    ],
    correctaIdx: 2,
    explicacion:
      "En Zona A el tamaño máximo para puntos de color es <= 0,8 mm. Como mide 0,7 mm, la pieza SÍ cumple y se aprueba. Lo importante es no dejarse llevar por la opinión del compañero sin verificar, y siempre registrar el hallazgo.",
  },
  {
    id: 6,
    pregunta:
      "Al final de tu turno encuentras una pieza con un defecto que claramente supera los criterios de Zona 1. No estás seguro si reprocesarla o derogarla y tu turno está por terminar. ¿Qué haces?",
    opciones: [
      "La apruebo para no retrasar la producción y lo reporto en el turno siguiente.",
      "La derego directamente sin consultar a nadie para no perder más tiempo.",
      "Consulto con el Jefe de Calidad antes de tomar cualquier decisión, sin importar la hora.",
    ],
    correctaIdx: 2,
    explicacion:
      "Cuando un defecto supera los criterios y hay duda entre reprocesar o derogar, SIEMPRE se debe consultar al Jefe de Calidad. Nunca se aprueba una pieza fuera de tolerancia para no parar producción, y no se toman decisiones de derogación sin autorización.",
  },
];

/* =========================================================
   SEMÁFORO — estado
========================================================= */
type SemaforoState = "idle" | "correcto" | "incorrecto";

/* =========================================================
   COMPONENTE
========================================================= */
export default function NivelSocialCalidad() {
  const router = useRouter();

  /* ── PANTALLAS ── */
  const [showIntro, setShowIntro] = useState(true);
  const [showGame,  setShowGame]  = useState(false);

  /* ── Casos ── */
  const [casosData, setCasosData] = useState<Caso[]>(() => casosBase.map(mezclarCaso));

  /* ── JUEGO ── */
  const [casoActual,     setCasoActual]     = useState(0);
  const [vidas,          setVidas]          = useState(VIDAS_POR_CASO);
  const [bloqueado,      setBloqueado]      = useState(false);
  const [vidasUsadas,    setVidasUsadas]    = useState(0);
  const [semaforoState,  setSemaforoState]  = useState<SemaforoState>("idle");
  const [letraSeleccionada, setLetraSeleccionada] = useState<Letra | null>(null);

  /* ── OVERLAYS ── */
  const [showCorrect,       setShowCorrect]       = useState(false);
  const [showWrong,         setShowWrong]         = useState(false);
  const [showGameOver,      setShowGameOver]      = useState(false);
  const [showFinal,         setShowFinal]         = useState(false);
  const [explicacionActual, setExplicacionActual] = useState("");

  /* ── ANIMACIONES ── */
  const fadeAnim      = useRef(new Animated.Value(0)).current;
  const heartScale    = useRef(new Animated.Value(1)).current;
  const semaforoScale = useRef(new Animated.Value(1)).current;
  const cardAnim      = useRef(new Animated.Value(0)).current;
  const shakeAnim     = useRef(new Animated.Value(0)).current;
  const pulseGreen    = useRef(new Animated.Value(0)).current;
  const pulseRed      = useRef(new Animated.Value(0)).current;

  /* ── Refs para evitar stale closures ── */
  const casoActualRef  = useRef(0);
  const vidasUsadasRef = useRef(0);

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
        body: JSON.stringify({
          usuarioKey: Number(uk), puntaje: score,
          aprobado: 1, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY,
        }),
      });
    } catch (e) { console.log(e); }
  };

  /* ── ANIMACIÓN CORAZÓN ── */
  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.5, duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 120, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1.3, duration: 100, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 100, useNativeDriver: true }),
    ]).start();
  };

  /* ── ANIMACIÓN SEMÁFORO VERDE ── */
  const animarVerde = (onDone: () => void) => {
    pulseGreen.setValue(0);
    Animated.sequence([
      Animated.timing(semaforoScale, { toValue: 1.15, duration: 180, useNativeDriver: true }),
      Animated.timing(semaforoScale, { toValue: 1,    duration: 180, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseGreen, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(pulseGreen, { toValue: 0.4, duration: 300, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start();
    setTimeout(onDone, 900);
  };

  /* ── ANIMACIÓN SEMÁFORO ROJO ── */
  const animarRojo = (onDone: () => void) => {
    pulseRed.setValue(0);
    shakeAnim.setValue(0);
    Vibration.vibrate([0, 80, 60, 80]);
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 8,   duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -8,  duration: 60, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0,   duration: 60, useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseRed, { toValue: 1,   duration: 250, useNativeDriver: true }),
        Animated.timing(pulseRed, { toValue: 0.3, duration: 250, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start();
    setTimeout(onDone, 900);
  };

  /* ── ENTRADA DE TARJETA ── */
  const animarEntradaTarjeta = () => {
    cardAnim.setValue(0);
    Animated.spring(cardAnim, {
      toValue: 1, useNativeDriver: true,
      tension: 60, friction: 8,
    }).start();
  };

  /* ── RESPONDER ── */
  const responder = (letra: Letra) => {
    if (bloqueado) return;
    setBloqueado(true);
    setLetraSeleccionada(letra);

    if (letra === casosData[casoActual].correcta) {
      setSemaforoState("correcto");
      animarVerde(() => {
        setExplicacionActual(casosData[casoActualRef.current].explicacion);
        setShowCorrect(true);
      });
    } else {
      setSemaforoState("incorrecto");
      const nuevas = vidas - 1;
      setVidasUsadas((p) => { vidasUsadasRef.current = p + 1; return p + 1; });
      setVidas(nuevas);
      animateHeart();
      animarRojo(() => {
        if (nuevas <= 0) {
          setShowGameOver(true);
        } else {
          setShowWrong(true);
        }
      });
    }
  };

  /* ── CONTINUAR DESDE CORRECTO ── */
  const continueFromCorrect = () => {
    setShowCorrect(false);
    setSemaforoState("idle");
    setLetraSeleccionada(null);
    avanzar();
  };

  /* ── REINTENTAR ── */
  const reintentar = () => {
    setShowWrong(false);
    setSemaforoState("idle");
    setLetraSeleccionada(null);
    setBloqueado(false);
  };

  /* ── AVANZAR ── */
  const avanzar = () => {
    const siguiente = casoActualRef.current + 1;
    if (casoActualRef.current >= casosData.length - 1) {
      guardarResultado(vidasUsadasRef.current);
      setShowFinal(true);
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
      return;
    }
    casoActualRef.current = siguiente;
    setCasoActual(siguiente);
    setVidas(VIDAS_POR_CASO);
    setBloqueado(false);
    setTimeout(animarEntradaTarjeta, 100);
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
    setShowWrong(false);
    setShowCorrect(false);
    setSemaforoState("idle");
    setLetraSeleccionada(null);
    setBloqueado(false);
    animarEntradaTarjeta();
  };

  const iniciarJuego = () => {
    setCasosData(casosBase.map(mezclarCaso));
    setShowIntro(false);
    setShowGame(true);
    setTimeout(animarEntradaTarjeta, 200);
  };

  const caso = casosData[casoActual];

  /* ── COLORES SEMÁFORO ── */
  const lucesSemaforo = {
    roja:     semaforoState === "incorrecto",
    amarilla: semaforoState === "idle",
    verde:    semaforoState === "correcto",
  };

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={styles.fullBg} resizeMode="cover">
      <View style={styles.overlay} />

      {/* ══ INTRO ══════════════════════════════════════════ */}
      {showIntro && (
        <View style={styles.centeredFull}>
          <View style={styles.introBox}>
            {/* Header tipo planta */}
            <View style={styles.introHeaderStrip}>
              <Text style={styles.introHeaderLabel}>ÁREA DE CALIDAD · AGP</Text>
            </View>

            <Text style={styles.introTitle}>Tablero de{"\n"}Decisiones</Text>

            <View style={styles.introSemaforo}>
              <View style={[styles.introLuz, { backgroundColor: "#DC2626", opacity: 0.35 }]} />
              <View style={[styles.introLuz, { backgroundColor: "#F59E0B", opacity: 1 }]} />
              <View style={[styles.introLuz, { backgroundColor: "#16A34A", opacity: 0.35 }]} />
            </View>

            <Text style={styles.introDesc}>
              Analiza <Text style={styles.introBold}>6 situaciones reales</Text> de inspección en planta y toma la decisión correcta según las normas de calidad de AGP.{"\n\n"}
              El semáforo te indica si apruebas o rechazas.{"\n"}Tienes <Text style={styles.introBold}>{VIDAS_POR_CASO} vidas por caso</Text> ({TOTAL_VIDAS} en total).
            </Text>

            <TouchableOpacity style={styles.playBtn} onPress={iniciarJuego}>
              <Text style={styles.playBtnTxt}>INICIAR INSPECCIÓN</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══ JUEGO ══════════════════════════════════════════ */}
      {showGame && (
        <View style={styles.gameContainer}>

          {/* ── BARRA SUPERIOR ── */}
          <View style={styles.topBar}>
            <View style={styles.topBarLeft}>
              <Text style={styles.topBarLabel}>CASO</Text>
              <Text style={styles.topBarValue}>{casoActual + 1}/{casosData.length}</Text>
            </View>
            <View style={styles.topBarCenter}>
              <Text style={styles.topBarTitle}>INSPECTOR DE CALIDAD</Text>
            </View>
            <Animated.View style={[styles.topBarRight, { transform: [{ scale: heartScale }] }]}>
              <Text style={styles.topBarLabel}>VIDAS</Text>
              <View style={styles.vidasRow}>
                {Array.from({ length: VIDAS_POR_CASO }).map((_, i) => (
                  <Text key={i} style={[styles.heartIcon, i < vidas ? {} : styles.heartLost]}>❤️</Text>
                ))}
              </View>
            </Animated.View>
          </View>

          {/* ── CONTENIDO PRINCIPAL ── */}
          <View style={styles.mainContent}>

            {/* ── SEMÁFORO ── */}
            <Animated.View
              style={[
                styles.semaforoContainer,
                { transform: [{ scale: semaforoScale }, { translateX: shakeAnim }] },
              ]}
            >
              {/* Poste */}
              <View style={styles.semaforoCaja}>
                <View style={styles.semaforoHeader}>
                  <Text style={styles.semaforoHeaderTxt}>RESULTADO</Text>
                </View>

                {/* Luz ROJA */}
                <Animated.View
                  style={[
                    styles.luz,
                    lucesSemaforo.roja
                      ? { backgroundColor: "#EF4444", opacity: pulseRed.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), shadowColor: "#EF4444", shadowRadius: 18, shadowOpacity: 1, elevation: 12 }
                      : { backgroundColor: "#3B0000", opacity: 0.4 },
                  ]}
                />

                {/* Luz AMARILLA */}
                <View
                  style={[
                    styles.luz,
                    lucesSemaforo.amarilla
                      ? { backgroundColor: "#F59E0B", shadowColor: "#F59E0B", shadowRadius: 14, shadowOpacity: 0.9, elevation: 10 }
                      : { backgroundColor: "#3B2E00", opacity: 0.4 },
                  ]}
                />

                {/* Luz VERDE */}
                <Animated.View
                  style={[
                    styles.luz,
                    lucesSemaforo.verde
                      ? { backgroundColor: "#22C55E", opacity: pulseGreen.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }), shadowColor: "#22C55E", shadowRadius: 18, shadowOpacity: 1, elevation: 12 }
                      : { backgroundColor: "#002B00", opacity: 0.4 },
                  ]}
                />

                <View style={styles.semaforoFooter}>
                  <Text style={styles.semaforoStatusTxt}>
                    {semaforoState === "idle"      && "EN ESPERA"}
                    {semaforoState === "correcto"  && "✔ APROBADO"}
                    {semaforoState === "incorrecto"&& "✖ RECHAZADO"}
                  </Text>
                </View>
              </View>
              <View style={styles.semaforoPoste} />
            </Animated.View>

            {/* ── TARJETA DEL CASO ── */}
            <Animated.View
              style={[
                styles.caseCard,
                {
                  opacity: cardAnim,
                  transform: [
                    {
                      translateY: cardAnim.interpolate({
                        inputRange: [0, 1], outputRange: [40, 0],
                      }),
                    },
                  ],
                },
              ]}
            >
              {/* Badge caso */}
              <View style={styles.casoBadge}>
                <View style={styles.casoBadgeDot} />
                <Text style={styles.casoBadgeTxt}>SITUACIÓN #{caso.id}</Text>
              </View>

              {/* Pregunta */}
              <Text style={styles.pregunta}>{caso.pregunta}</Text>

              {/* Divisor */}
              <View style={styles.divisor} />

              {/* Opciones */}
              <View style={styles.opcionesWrapper}>
                {(["A", "B", "C"] as Letra[]).map((letra) => {
                  const seleccionada = letraSeleccionada === letra;
                  const esCorrecta   = caso.correcta === letra;
                  let btnStyle = styles.opcionBtn;
                  let txtStyle = styles.opcionTxt;

                  if (seleccionada && semaforoState === "correcto") {
                    btnStyle = { ...btnStyle, ...styles.opcionCorrecta } as any;
                  } else if (seleccionada && semaforoState === "incorrecto") {
                    btnStyle = { ...btnStyle, ...styles.opcionIncorrecta } as any;
                  }

                  return (
                    <TouchableOpacity
                      key={letra}
                      activeOpacity={0.75}
                      style={btnStyle}
                      onPress={() => responder(letra)}
                      disabled={bloqueado}
                    >
                      <View style={styles.letraBadge}>
                        <Text style={styles.letraTxt}>{letra}</Text>
                      </View>
                      <Text style={txtStyle} numberOfLines={3}>{caso.opciones[letra]}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

            </Animated.View>

          </View>

          {/* ── CORRECTO ── */}
          {showCorrect && (
            <View style={styles.feedbackOverlay}>
              <View style={styles.correctCard}>
                <View style={styles.feedbackSemaforoMini}>
                  <View style={[styles.luzMini, { backgroundColor: "#3B0000", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#3B2E00", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#22C55E" }]} />
                </View>
                <Text style={styles.feedbackTitle}>¡Decisión Correcta!</Text>
                <View style={styles.explicacionBox}>
                  <Text style={styles.explicacionLabel}>📋 CRITERIO APLICADO</Text>
                  <Text style={styles.feedbackExplicacion}>{explicacionActual}</Text>
                </View>
                <TouchableOpacity style={styles.continueBtn} onPress={continueFromCorrect}>
                  <Text style={styles.continueBtnTxt}>SIGUIENTE CASO →</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── VIDA PERDIDA ── */}
          {showWrong && !showGameOver && !showFinal && (
            <View style={styles.feedbackOverlay}>
              <View style={styles.wrongCard}>
                <View style={styles.feedbackSemaforoMini}>
                  <View style={[styles.luzMini, { backgroundColor: "#EF4444" }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#3B2E00", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#002B00", opacity: 0.3 }]} />
                </View>
                <Text style={styles.wrongTitle}>Decisión Incorrecta</Text>
                <Text style={styles.wrongDesc}>
                  Esa decisión no cumple con las normas de calidad.{"\n"}Revisa los criterios e intenta de nuevo.
                </Text>
                <View style={styles.vidasRestantesRow}>
                  {Array.from({ length: VIDAS_POR_CASO }).map((_, i) => (
                    <Text key={i} style={[styles.heartIcon, i < vidas ? {} : styles.heartLost]}>❤️</Text>
                  ))}
                </View>
                <TouchableOpacity style={styles.retryBtn} onPress={reintentar}>
                  <Text style={styles.retryTxt}>REINTENTAR</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* ── GAME OVER ── */}
          {showGameOver && (
            <View style={styles.feedbackOverlay}>
              <View style={styles.gameCard}>
                <View style={styles.feedbackSemaforoMini}>
                  <View style={[styles.luzMini, { backgroundColor: "#EF4444" }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#3B2E00", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#002B00", opacity: 0.3 }]} />
                </View>
                <Text style={styles.gameTitle}>LÍNEA DETENIDA</Text>
                <Text style={styles.gameDesc}>
                  Agotaste todas tus vidas en este caso.{"\n"}Reinicia y vuelve a intentarlo.
                </Text>
                <View style={styles.gameRow}>
                  <TouchableOpacity style={styles.gameBtn} onPress={reiniciar}>
                    <Text style={styles.gameBtnTxt}>REINICIAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.gameBtn, styles.gameBtnGray]} onPress={() => router.replace(RUTA_VOLVER as any)}>
                    <Text style={styles.gameBtnTxt}>SALIR</Text>
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
                    transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                  },
                ]}
              >
                <View style={styles.feedbackSemaforoMini}>
                  <View style={[styles.luzMini, { backgroundColor: "#3B0000", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#3B2E00", opacity: 0.3 }]} />
                  <View style={[styles.luzMini, { backgroundColor: "#22C55E" }]} />
                </View>
                <Text style={styles.finalEmoji}>🏭</Text>
                <Text style={styles.finalTitle}>INSPECCIÓN COMPLETADA</Text>
                <View style={styles.scoreBox}>
                  <Text style={styles.scoreLabel}>PUNTUACIÓN FINAL</Text>
                  <Text style={styles.finalScore}>{calcScore(vidasUsadas)}%</Text>
                </View>
                <Text style={styles.finalInfo}>
                  Errores: {vidasUsadas} / {TOTAL_VIDAS}
                </Text>
                <TouchableOpacity
                  style={styles.finishBtn}
                  onPress={() => router.replace(RUTA_VOLVER as any)}
                >
                  <Text style={styles.finishTxt}>CONTINUAR</Text>
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
   ESTILOS
========================================================= */
const styles = StyleSheet.create({
  fullBg: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,10,20,0.55)",
  },

  /* ── INTRO ── */
  centeredFull: { flex: 1, justifyContent: "center", alignItems: "center", padding: 30 },
  introBox: {
    backgroundColor: "rgba(143,197,207,0.88)",
    borderRadius: 24,
    overflow: "hidden",
    maxWidth: 600,
    width: "90%",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 30, elevation: 20,
  },
  introHeaderStrip: {
    backgroundColor: "#64758b",
    paddingVertical: 10,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "#030200",
  },
  introHeaderLabel: { color: "#000000", fontSize: 12, fontWeight: "900", letterSpacing: 3 },
  introTitle: {
    color: "#000000", fontSize: 36, fontWeight: "900",
    textAlign: "center", marginTop: 24, marginHorizontal: 30, lineHeight: 42,
  },
  introSemaforo: {
    flexDirection: "row", justifyContent: "center",
    gap: 16, marginVertical: 20,
  },
  introLuz: {
    width: 36, height: 36, borderRadius: 18,
    shadowColor: "#000000", shadowOpacity: 0.9, shadowRadius: 10, elevation: 8,
  },
  introDesc: {
    fontSize: 16, color: "rgba(0, 0, 0, 0.8)",
    textAlign: "center", lineHeight: 26,
    marginHorizontal: 30, marginBottom: 28,
  },
  introBold: { fontWeight: "900", color: "#020100" },
  playBtn: {
    marginHorizontal: 30, marginBottom: 30,
    backgroundColor: "#64758b",
    paddingVertical: 18, borderRadius: 12,
    alignItems: "center", borderWidth: 2, borderColor: "#000000",
  },
  playBtnTxt: { color: "#000000", fontSize: 18, fontWeight: "900", letterSpacing: 2 },

  /* ── JUEGO ── */
  gameContainer: { flex: 1 },

  /* BARRA SUPERIOR */
  topBar: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(143,197,207,0.88)",
    paddingHorizontal: 20, paddingTop: 40, paddingBottom: 14,
    borderBottomWidth: 2, borderBottomColor: "#000000",
  },
  topBarLeft:   { flex: 1, alignItems: "flex-start" },
  topBarCenter: { flex: 2, alignItems: "center" },
  topBarRight:  { flex: 1, alignItems: "flex-end" },
  topBarLabel:  { color: "#000000", fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  topBarValue:  { color: "#fff", fontSize: 22, fontWeight: "900" },
  topBarTitle:  { color: "#fff", fontSize: 13, fontWeight: "900", letterSpacing: 1 },
  vidasRow:     { flexDirection: "row", gap: 4, marginTop: 2 },
  heartIcon:    { fontSize: 18 },
  heartLost:    { opacity: 0.2 },

  /* CONTENIDO PRINCIPAL */
  mainContent: {
    flex: 1, flexDirection: "row",
    alignItems: "center", paddingHorizontal: 24,
    gap: 20, paddingVertical: 16,
  },

  /* SEMÁFORO */
  semaforoContainer: {
    alignItems: "center",
    width: 110,
  },
  semaforoCaja: {
    backgroundColor: "rgba(143,197,207,0.88)",
    borderRadius: 18,
    padding: 12,
    gap: 10,
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.12)",
    width: 90,
    shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 12, elevation: 14,
  },
  semaforoHeader: {
    backgroundColor: "#64758b",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    width: "100%",
    alignItems: "center",
  },
  semaforoHeaderTxt: { color: "#000000", fontSize: 8, fontWeight: "900", letterSpacing: 1 },
  luz: {
    width: 52, height: 52, borderRadius: 26,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.1)",
  },
  semaforoFooter: {
    backgroundColor: "rgba(255,255,255,0.07)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    width: "100%",
    alignItems: "center",
  },
  semaforoStatusTxt: { color: "#fff", fontSize: 7.5, fontWeight: "900", letterSpacing: 0.5 },
  semaforoPoste: {
    width: 10, height: 30,
    backgroundColor: "#374151",
    borderRadius: 4,
  },

  /* TARJETA CASO */
  caseCard: {
    flex: 1,
    backgroundColor: "rgba(143,197,207,0.88)",
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    shadowColor: "#000", shadowOpacity: 0.5, shadowRadius: 16, elevation: 12,
    height: height * 0.78,
    justifyContent: "space-between",
  },
  casoBadge: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#54606e", borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 7, alignSelf: "flex-start",
    borderLeftWidth: 3, borderLeftColor: "#000000",
  },
  casoBadgeDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#000000" },
  casoBadgeTxt: { color: "#ffffff", fontSize: 11, fontWeight: "900", letterSpacing: 2 },
  pregunta: {
    fontSize: 17, color: "#000000", fontWeight: "700",
    lineHeight: 26, marginTop: 12,
  },
  divisor: {
    height: 1.5, backgroundColor: "rgba(245,158,11,0.25)",
    marginVertical: 14,
  },
  opcionesWrapper: { gap: 12, flex: 1, justifyContent: "center" },
  opcionBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 14,
    borderWidth: 1.5, borderColor: "rgba(255,255,255,0.1)",
    minHeight: 64,
  },
  opcionCorrecta: {
    backgroundColor: "rgba(34,197,94,0.18)",
    borderColor: "#22a5c5",
  },
  opcionIncorrecta: {
    backgroundColor: "rgba(239,68,68,0.18)",
    borderColor: "#EF4444",
  },
  letraBadge: {
    width: 38, height: 38, borderRadius: 10,
    backgroundColor: "#1E3A5F",
    borderWidth: 2, borderColor: "#ffffff",
    justifyContent: "center", alignItems: "center",
  },
  letraTxt: { color: "#ffffff", fontSize: 16, fontWeight: "900" },
  opcionTxt: { flex: 1, fontSize: 15, color: "#000000", fontWeight: "600", lineHeight: 21 },

  /* ── OVERLAYS ── */
  feedbackOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,5,15,0.75)",
    justifyContent: "center", alignItems: "center", zIndex: 999,
    padding: 24,
  },
  feedbackSemaforoMini: {
    flexDirection: "row", gap: 10, marginBottom: 16,
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 30,
  },
  luzMini: { width: 26, height: 26, borderRadius: 13 },

  /* CORRECTO */
  correctCard: {
    backgroundColor: "rgba(5,30,15,0.97)",
    paddingVertical: 36, paddingHorizontal: 32,
    borderRadius: 24, alignItems: "center",
    maxWidth: 560, width: "95%",
    borderWidth: 2, borderColor: "#22a5c5",
    shadowColor: "#22a5c5", shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
  },
  feedbackTitle: { color: "#22a5c5", fontSize: 26, fontWeight: "900", marginBottom: 16, letterSpacing: 1 },
  explicacionBox: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14, padding: 16,
    borderLeftWidth: 3, borderLeftColor: "#22a5c5s",
    marginBottom: 22, width: "100%",
  },
  explicacionLabel: { color: "#6B7280", fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 8 },
  feedbackExplicacion: { color: "rgba(255,255,255,0.88)", fontSize: 15, lineHeight: 22 },
  continueBtn: {
    backgroundColor: "#22a5c5", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 36,
  },
  continueBtnTxt: { color: "#fff", fontSize: 16, fontWeight: "900", letterSpacing: 1 },

  /* INCORRECTO */
  wrongCard: {
    backgroundColor: "rgba(30,5,5,0.97)",
    paddingVertical: 36, paddingHorizontal: 32,
    borderRadius: 24, alignItems: "center",
    maxWidth: 500, width: "90%",
    borderWidth: 2, borderColor: "#EF4444",
    shadowColor: "#EF4444", shadowOpacity: 0.4, shadowRadius: 20, elevation: 16,
  },
  wrongTitle: { color: "#EF4444", fontSize: 24, fontWeight: "900", marginBottom: 12, letterSpacing: 1 },
  wrongDesc:  { color: "rgba(255,255,255,0.75)", fontSize: 15, textAlign: "center", lineHeight: 22, marginBottom: 18 },
  vidasRestantesRow: { flexDirection: "row", gap: 8, marginBottom: 20 },
  retryBtn: {
    backgroundColor: "#1E3A5F",
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
    borderWidth: 2, borderColor: "#F59E0B",
  },
  retryTxt: { color: "#F59E0B", fontSize: 16, fontWeight: "900", letterSpacing: 1 },

  /* GAME OVER */
  gameCard: {
    backgroundColor: "rgba(10,10,10,0.98)",
    paddingVertical: 44, paddingHorizontal: 40,
    borderRadius: 24, alignItems: "center",
    maxWidth: 500, width: "90%",
    borderWidth: 2, borderColor: "#EF4444",
  },
  gameTitle: { color: "#EF4444", fontSize: 28, fontWeight: "900", letterSpacing: 2, marginBottom: 10 },
  gameDesc:  { color: "#9CA3AF", fontSize: 16, textAlign: "center", lineHeight: 24, marginBottom: 28 },
  gameRow:   { flexDirection: "row", gap: 14 },
  gameBtn:   {
    backgroundColor: "#1E3A5F", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 32,
    borderWidth: 2, borderColor: "#F59E0B",
  },
  gameBtnGray: { backgroundColor: "#374151", borderColor: "#6B7280" },
  gameBtnTxt: { color: "#fff", fontSize: 15, fontWeight: "900", letterSpacing: 1 },

  /* FINAL */
  finalCard: {
    backgroundColor: "rgba(5,20,10,0.97)",
    paddingVertical: 44, paddingHorizontal: 40,
    borderRadius: 24, alignItems: "center",
    maxWidth: 520, width: "90%",
    borderWidth: 2, borderColor: "#22a5c5",
    shadowColor: "#22a5c5", shadowOpacity: 0.35, shadowRadius: 24, elevation: 18,
  },
  finalEmoji: { fontSize: 56, marginBottom: 8 },
  finalTitle: { color: "#22a5c5", fontSize: 20, fontWeight: "900", letterSpacing: 2, marginBottom: 18 },
  scoreBox: {
    backgroundColor: "rgba(34,197,94,0.12)",
    borderRadius: 16, padding: 20, alignItems: "center",
    borderWidth: 1.5, borderColor: "#22a5c5",
    marginBottom: 14, width: "100%",
  },
  scoreLabel: { color: "#6B7280", fontSize: 10, fontWeight: "900", letterSpacing: 3, marginBottom: 4 },
  finalScore: { color: "#fff", fontSize: 72, fontWeight: "900" },
  finalInfo:  { color: "rgba(255,255,255,0.6)", fontSize: 14, marginBottom: 24 },
  finishBtn: {
    backgroundColor: "#22a5c5", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 50,
  },
  finishTxt: { color: "#fff", fontSize: 18, fontWeight: "900", letterSpacing: 1 },
});