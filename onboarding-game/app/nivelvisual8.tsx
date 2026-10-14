import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  ImageBackground,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Vibration,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import ReAnimated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

const fondo   = require("../assets/islas/fondogeneral.png");
const API_URL = API_BASE_URL;

// ── Config ──────────────────────────────────────────────────────────────────
const NIVEL_KEY_API = 31;
const ISLA_KEY      = 7;
const RUTA_VOLVER   = "/LecturaOF";

// Reglas de vidas (mismas que Manipulación del Vidrio): 3 vidas por módulo y
// el puntaje final sale de cuántas vidas se gastaron en total.
const VIDAS_POR_MODULO = 3;
// Memoria (mismas que los otros niveles de memoria): los primeros errores no
// cuestan vida (el jugador aún no sabe qué hay debajo de cada carta); después,
// cada ERRORES_POR_VIDA errores se pierde una vida.
const ERRORES_POR_VIDA = 2;

// ── Contenido (PowerPoint de Lectura OF, sección "Visual") ──────────────────
// Un nivel = varios módulos seguidos. Para sumar actividades de otras
// diapositivas, agregar otro objeto a MODULOS.
//  · "clasificar": los términos salen revueltos en la bandeja; se arrastran
//    TODOS a los paneles de la orden de fabricación y luego se pulsa "Validar":
//    los correctos quedan en verde y los incorrectos en rojo.
//  · "ubicar": la imagen de una OF real sin los nombres de sus campos; cada
//    nombre se arrastra a su casilla y luego se valida igual que "clasificar".
//  · "memoria": cartas boca abajo; se busca la pareja color + descripción.
type Panel    = { id: string; titulo: string };
type Ficha    = { id: string; texto: string; panel: string };
type ParColor = { id: string; color: string; descripcion: string };

type ModuloClasificar = { tipo: "clasificar"; titulo: string; paneles: Panel[]; fichas: Ficha[] };
type ModuloMemoria    = { tipo: "memoria";    titulo: string; libres: number; pares: ParColor[] };   // libres = errores que no cuestan vida
// Zona = casilla de la imagen donde va un campo, en % del ancho/alto de la imagen.
type Zona          = { id: string; texto: string; x: number; y: number; w: number; h: number };
type ModuloUbicar  = { tipo: "ubicar"; titulo: string; imagen: any; aspecto: number; zonas: Zona[] };
type Modulo = ModuloClasificar | ModuloUbicar | ModuloMemoria;

const f = (panel: string, texto: string): Ficha => ({ id: `${panel}-${texto}`, texto, panel });

const MODULOS: Modulo[] = [
  {
    tipo:   "clasificar",
    titulo: "HOJA DE RUTA",
    paneles: [
      { id: "encabezado", titulo: "ENCABEZADO" },
      { id: "plano",      titulo: "PLANO" },
      { id: "tabla",      titulo: "TABLA" },
    ],
    fichas: [
      f("encabezado", "Cliente"), f("encabezado", "Color"), f("encabezado", "Lote"),
      f("encabezado", "Pieza"), f("encabezado", "Versión"), f("encabezado", "Norma"),
      f("encabezado", "Producto"), f("encabezado", "Pedido"),
      f("plano", "Offset"), f("plano", "Radios"), f("plano", "Vin"), f("plano", "Cuerdas"),
      f("tabla", "Operación"), f("tabla", "Característica"), f("tabla", "Componente"),
      f("tabla", "Descripción Material"), f("tabla", "N° Archivo"), f("tabla", "Clave Modelo"),
      f("tabla", "Pos. Lista"),
    ],
  },
  {
    // Visual 2: encabezado de una OF real (Chevrolet Suburban) sin los nombres de
    // sus campos. Imagen y casillas salen del PDF "Ejemplo OP con caja".
    tipo:    "ubicar",
    titulo:  "ENCABEZADO DE LA OF",
    imagen:  require("../assets/islas/lectura/of_encabezado.png"),
    aspecto: 1680 / 381,
    zonas: [
      { id: "cliente", texto: "CLIENTE", x: 0.54, y: 3.41, w: 12.02, h: 21.52 },
      { id: "color", texto: "COLOR", x: 31.9, y: 3.41, w: 7.5, h: 21.52 },
      { id: "trazabilidad", texto: "TRAZABILIDAD", x: 54.76, y: 3.67, w: 10.0, h: 21.26 },
      { id: "lote", texto: "LOTE", x: 75.0, y: 3.41, w: 12.56, h: 21.52 },
      { id: "pedido", texto: "PEDIDO", x: 0.54, y: 25.2, w: 12.02, h: 14.7 },
      { id: "pieza", texto: "PIEZA", x: 31.9, y: 25.2, w: 7.5, h: 14.7 },
      { id: "nivel", texto: "NIVEL", x: 54.76, y: 25.2, w: 10.0, h: 14.7 },
      { id: "fert", texto: "FERT", x: 75.0, y: 25.2, w: 12.56, h: 14.7 },
      { id: "partnumber", texto: "PARTNUMBER", x: 0.54, y: 40.16, w: 12.02, h: 14.7 },
      { id: "version", texto: "VERSION", x: 31.9, y: 40.16, w: 7.5, h: 14.7 },
      { id: "espnom", texto: "ESP_NOM", x: 54.76, y: 40.16, w: 10.0, h: 14.7 },
      { id: "producto", texto: "PRODUCTO", x: 75.0, y: 40.16, w: 12.56, h: 14.7 },
      { id: "codplano", texto: "COD.PLANO", x: 0.54, y: 55.12, w: 12.02, h: 14.96 },
      { id: "fecha", texto: "FECHA", x: 31.9, y: 55.12, w: 7.5, h: 14.96 },
      { id: "angulo", texto: "ÁNGULO", x: 54.76, y: 55.12, w: 10.0, h: 14.96 },
      { id: "acabado", texto: "ACABADO PAQUETE", x: 75.0, y: 55.12, w: 12.56, h: 14.96 },
      { id: "norma", texto: "NORMA", x: 0.54, y: 70.08, w: 12.02, h: 8.14 },
      { id: "peso", texto: "PESO LITE MANIPULACIÓN", x: 0.54, y: 78.48, w: 12.02, h: 19.16 },
    ],
  },
  {
    // Visual 2: tabla de operaciones de la misma OF, sin los titulos de columna.
    tipo:    "ubicar",
    titulo:  "TABLA DE LA OF",
    imagen:  require("../assets/islas/lectura/of_tabla.png"),
    aspecto: 2418 / 737,
    zonas: [
      { id: "operacion", texto: "Operación", x: 0.17, y: 1.9, w: 6.24, h: 11.95 },
      { id: "caracteristica", texto: "Característica", x: 6.49, y: 1.9, w: 25.52, h: 11.95 },
      { id: "poslista", texto: "Pos.Lista", x: 32.09, y: 1.9, w: 5.87, h: 11.95 },
      { id: "componente", texto: "Componente", x: 38.05, y: 1.9, w: 10.42, h: 11.95 },
      { id: "descripcion", texto: "Descripción del material", x: 48.55, y: 1.9, w: 22.66, h: 11.95 },
      { id: "clave", texto: "Clave Modelo", x: 71.3, y: 1.9, w: 6.24, h: 11.95 },
      { id: "numoperacion", texto: "N° Operación", x: 77.63, y: 1.9, w: 6.24, h: 11.95 },
      { id: "archivo", texto: "N.Archivo", x: 83.95, y: 1.9, w: 12.57, h: 11.95 },
      { id: "tq", texto: "TQ", x: 96.61, y: 1.9, w: 3.35, h: 11.95 },
    ],
  },
  {
    // Diapositiva 8 del PowerPoint
    tipo:   "memoria",
    titulo: "COLORES DE LA OF",
    libres: 2,
    pares: [
      { id: "bn-externa", color: "#FFFFFF", descripcion: "Pintura BN Externa" },
      { id: "paquetes",   color: "#C1E5F5", descripcion: "Lite de Paquetes Nuevos" },
      { id: "bn-interna", color: "#DAF6DD", descripcion: "Pintura BN Interna" },
    ],
  },
  {
    // Diapositiva 9 del PowerPoint
    tipo:   "memoria",
    titulo: "COLORES DE LA OF",
    libres: 3,
    pares: [
      { id: "rechazos", color: "#E13A3A", descripcion: "Piezas incompletas / Rechazos" },
      { id: "aluminio", color: "#F6E13A", descripcion: "Pieza más costosa - Aluminio" },
      { id: "antilac",  color: "#4FA84B", descripcion: "Antilacerativo" },
      { id: "vpam",     color: "#F6C2DA", descripcion: "VPAM" },
    ],
  },
];

const TOTAL_VIDAS = MODULOS.length * VIDAS_POR_MODULO;

// ── Helpers ─────────────────────────────────────────────────────────────────
async function apiJson(url: string, options?: RequestInit) {
  const res  = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) throw new Error(data?.message || data?.error || `Error ${res.status}`);
  return data;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
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

type Rect  = { x: number; y: number; width: number; height: number };
type Carta = { key: string; tipo: "color" | "desc"; parId: string };

// ── Ficha arrastrable (en la bandeja o dentro de un panel) ──────────────────
function FichaArrastrable({ texto, estado, compacta, onStart, onDrop, onEnd }: {
  texto:   string;
  compacta?: boolean;                            // dentro de una casilla de la imagen: llena la casilla
  estado:  boolean | null;                       // true = acierto, false = error, null = sin validar
  onStart: () => void;
  onDrop:  (absX: number, absY: number) => void;
  onEnd:   () => void;
}) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  const astyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const onGestureEvent = (e: any) => {
    tx.value = e.nativeEvent.translationX;
    ty.value = e.nativeEvent.translationY;
  };

  const onHandlerStateChange = (e: any) => {
    const { absoluteX, absoluteY, state } = e.nativeEvent || {};
    if (state === State.BEGAN) { setDragging(true); onStart(); }
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      if (state === State.END && absoluteX && absoluteY) onDrop(absoluteX, absoluteY);
      setDragging(false);
      tx.value = withTiming(0);
      ty.value = withTiming(0);
      onEnd();
    }
  };

  return (
    <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <ReAnimated.View
        style={[
          styles.ficha,
          compacta && styles.fichaCompacta,
          estado === true  && styles.fichaOk,
          estado === false && styles.fichaBad,
          astyle,
          dragging && styles.fichaDragging,
        ]}
      >
        <Text style={[styles.fichaText, compacta && styles.fichaTextCompacta]} numberOfLines={compacta ? 2 : 1}>{texto}</Text>
      </ReAnimated.View>
    </PanGestureHandler>
  );
}

// ── Componente principal ────────────────────────────────────────────────────
export default function NivelVisualLecturaOF() {
  const router = useRouter();

  const [usuarioKey,    setUsuarioKey]    = useState<number | null>(null);
  const [alreadyPlayed, setAlreadyPlayed] = useState(false);
  const [savedScore,    setSavedScore]    = useState<number | null>(null);
  const [checking,      setChecking]      = useState(true);

  const [showIntro,          setShowIntro]          = useState(true);
  const [showGame,           setShowGame]           = useState(false);
  const [showSuccess,        setShowSuccess]        = useState(false);
  const [showModuleComplete, setShowModuleComplete] = useState(false);

  const [moduloIdx, setModuloIdx] = useState(0);
  const mod = MODULOS[moduloIdx];

  const [vidas, setVidas] = useState(VIDAS_POR_MODULO);
  const vidasGastadas     = useRef(0);   // acumulado de todo el nivel

  // módulo "clasificar"
  const [asignacion,  setAsignacion]  = useState<Record<string, string | null>>({});   // ficha -> panel (null = en la bandeja)
  const [resultados,  setResultados]  = useState<Record<string, boolean | null>>({});  // ficha -> acierto tras validar
  const [panelAlto,   setPanelAlto]   = useState<string | null>(null);
  const [orden,       setOrden]       = useState<string[]>([]);   // fichas de la bandeja en orden revuelto                 // panel de origen de la ficha que se arrastra

  // módulo "memoria"
  const [cartas,      setCartas]      = useState<Carta[]>([]);   // colores y descripciones revueltos
  const [volteadas,   setVolteadas]   = useState<string[]>([]);  // cartas boca arriba aún sin pareja
  const [emparejadas, setEmparejadas] = useState<string[]>([]);  // ids de pares resueltos
  const [fallos,      setFallos]      = useState(0);             // intentos fallidos del módulo
  const bloqueo = useRef(false);

  const [showTryAgain, setShowTryAgain] = useState(false);
  const [tryAgainTick, setTryAgainTick] = useState(0);   // cambia en cada vida perdida, para repetir la animación
  const [showGameOver, setShowGameOver] = useState(false);
  const mostrarMenosUno = () => { setShowTryAgain(true); setTryAgainTick(t => t + 1); };

  // Posición de cada panel en pantalla, para saber dónde se soltó la ficha
  const panelRefs  = useRef<Record<string, View | null>>({});
  const panelRects = useRef<Record<string, Rect>>({});
  const medirPaneles = () => {
    Object.entries(panelRefs.current).forEach(([id, ref]) => {
      ref?.measureInWindow((x, y, width, height) => {
        if (width > 0 && height > 0) panelRects.current[id] = { x, y, width, height };
      });
    });
  };

  // ── Animaciones ─────────────────────────────────────────────────────────
  const breakScale   = useRef(new Animated.Value(0.6)).current;
  const breakOpacity = useRef(new Animated.Value(0)).current;
  const heartScale   = useRef(new Animated.Value(1)).current;
  const successAnim  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tryAgainTick === 0) return;
    breakScale.setValue(0.6);
    breakOpacity.setValue(0);
    Vibration.vibrate(120);
    Animated.parallel([
      Animated.timing(breakOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(breakScale, { toValue: 1.25, duration: 220, useNativeDriver: true }),
        Animated.timing(breakScale, { toValue: 1,    duration: 160, useNativeDriver: true }),
      ]),
    ]).start();
    const t = setTimeout(() => setShowTryAgain(false), 1200);
    return () => clearTimeout(t);
  }, [tryAgainTick]);

  const animateHeart = () => {
    Vibration.vibrate(100);
    Animated.sequence([
      Animated.timing(heartScale, { toValue: 1.4, duration: 150, useNativeDriver: true }),
      Animated.timing(heartScale, { toValue: 1,   duration: 150, useNativeDriver: true }),
    ]).start();
  };

  // Keys de progreso
  const doneKey   = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel${NIVEL_KEY_API}_visual_done`;
  const scoreKey  = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel${NIVEL_KEY_API}_visual_score`;
  const unlockKey = `u:${usuarioKey ?? 0}:isla${ISLA_KEY}_nivel32_lectura_unlocked`;

  // ── Sesión y verificación de si ya jugó ──────────────────────────────────
  useEffect(() => {
    (async () => {
      const uk = await ensureUsuarioKey();
      if (!uk) { router.replace("/registration"); return; }
      setUsuarioKey(uk);
      const done = await AsyncStorage.getItem(`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_API}_visual_done`);
      const s    = await AsyncStorage.getItem(`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY_API}_visual_score`);
      if (done === "true") {
        setSavedScore(s ? Number(s) : 0);
        setAlreadyPlayed(true);
        setShowIntro(false);
        setShowSuccess(true);
        successAnim.setValue(1);
      }
      setChecking(false);
    })();
  }, []);

  // ── Flujo de módulos ────────────────────────────────────────────────────
  const prepararModulo = (i: number) => {
    const m = MODULOS[i];
    setModuloIdx(i);
    setVidas(VIDAS_POR_MODULO);
    setShowTryAgain(false);
    setShowGameOver(false);
    setShowModuleComplete(false);
    bloqueo.current = false;
    if (m.tipo === "clasificar" || m.tipo === "ubicar") {
      const ids = m.tipo === "clasificar" ? m.fichas.map(x => x.id) : m.zonas.map(x => x.id);
      setAsignacion(Object.fromEntries(ids.map(id => [id, null])));
      setOrden(shuffleArray(ids));
      setResultados({});
      setPanelAlto(null);
      panelRects.current = {};   // las casillas del modulo anterior ya no existen
      setTimeout(medirPaneles, 400);
    } else {
      setCartas(shuffleArray<Carta>([
        ...m.pares.map(p => ({ key: `c-${p.id}`, tipo: "color" as const, parId: p.id })),
        ...m.pares.map(p => ({ key: `d-${p.id}`, tipo: "desc" as const,  parId: p.id })),
      ]));
      setVolteadas([]);
      setEmparejadas([]);
      setFallos(0);
    }
  };

  const iniciar = () => {
    vidasGastadas.current = 0;
    prepararModulo(0);
    setShowIntro(false);
    setShowSuccess(false);
    setShowGame(true);
  };

  const completarModulo = (vidasFinal: number) => {
    if (moduloIdx < MODULOS.length - 1) setShowModuleComplete(true);
    else finalizar(vidasFinal);
  };

  const finalizar = async (vidasFinal: number) => {
    const gastadas = vidasGastadas.current;
    const score    = Math.round(((TOTAL_VIDAS - gastadas) / TOTAL_VIDAS) * 100);
    const aprobado = score >= 70;
    try {
      await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY_API}/resultado`, {
        method: "POST",
        body: JSON.stringify({ usuarioKey, puntaje: score, aprobado, mismatches: gastadas, livesLeft: vidasFinal }),
      });
      await AsyncStorage.multiSet([
        [doneKey,   "true"],
        [scoreKey,  String(score)],
        [unlockKey, "true"],
      ]);
    } catch (e) {
      console.error("❌ Error guardando visual Lectura OF:", e);
    }
    setSavedScore(score);
    setShowGame(false);
    setShowSuccess(true);
    successAnim.setValue(0);
    Animated.timing(successAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  };

  // Se pierde una vida: contador, animación y, si era la última, fin de juego
  const perderVida = (alTerminar?: () => void) => {
    const nuevas = Math.max(0, vidas - 1);
    vidasGastadas.current += 1;
    setVidas(nuevas);
    animateHeart();
    if (nuevas <= 0) {
      if (alTerminar) alTerminar(); else setShowGameOver(true);
    } else {
      mostrarMenosUno();
    }
  };

  // ── Módulo "clasificar": colocar fichas y validar ───────────────────────
  const soltarFicha = (fichaId: string, absX: number, absY: number) => {
    const destino = Object.entries(panelRects.current).find(([, r]) =>
      absX > r.x && absX < r.x + r.width && absY > r.y && absY < r.y + r.height
    )?.[0] ?? null;

    // Soltó sobre un panel o casilla: queda ahí. Soltó fuera: vuelve a la bandeja.
    // En la imagen cada casilla admite una sola ficha: la que estaba vuelve a la bandeja.
    setAsignacion(a => {
      const n = { ...a, [fichaId]: destino };
      if (destino && mod.tipo === "ubicar") {
        for (const k of Object.keys(n)) if (k !== fichaId && n[k] === destino) n[k] = null;
      }
      return n;
    });
    setResultados(r => ({ ...r, [fichaId]: null }));
  };

  const validar = () => {
    if (mod.tipo === "memoria") return;
    // destino correcto de cada ficha: su panel (clasificar) o su propia casilla (ubicar)
    const metas = mod.tipo === "clasificar"
      ? mod.fichas.map(x => [x.id, x.panel])
      : mod.zonas.map(x => [x.id, x.id]);
    const nuevos: Record<string, boolean> = {};
    metas.forEach(([id, meta]) => { nuevos[id] = asignacion[id] === meta; });
    setResultados(nuevos);

    if (metas.every(([id]) => nuevos[id])) {
      setTimeout(() => completarModulo(vidas), 700);   // deja ver todo en verde un momento
      return;
    }
    // Hay errores: exactamente 1 vida por validación, sin importar cuántas fichas estén mal
    perderVida();
  };

  // ── Módulo "memoria": voltear cartas ────────────────────────────────────
  const tocarCarta = (c: Carta) => {
    if (mod.tipo !== "memoria") return;
    if (bloqueo.current || volteadas.includes(c.key) || emparejadas.includes(c.parId)) return;

    const nuevas = [...volteadas, c.key];
    setVolteadas(nuevas);
    if (nuevas.length < 2) return;

    const [a, b] = nuevas.map(k => cartas.find(x => x.key === k)!);

    if (a.tipo !== b.tipo && a.parId === b.parId) {
      const nuevasEmp = [...emparejadas, a.parId];
      setEmparejadas(nuevasEmp);
      setVolteadas([]);
      if (nuevasEmp.length >= mod.pares.length) completarModulo(vidas);
      return;
    }

    // No coinciden: las cartas se vuelven a tapar. Solo cuesta vida pasados los errores libres.
    bloqueo.current = true;
    const nuevosFallos = fallos + 1;
    setFallos(nuevosFallos);
    const pagados = nuevosFallos - mod.libres;
    const cuestaVida = pagados > 0 && pagados % ERRORES_POR_VIDA === 0;

    let terminaElJuego = false;
    if (cuestaVida) perderVida(() => { terminaElJuego = true; });
    setTimeout(() => {
      setVolteadas([]);
      bloqueo.current = false;
      if (terminaElJuego) setShowGameOver(true);
    }, 900);
  };

  const idsColocables =
    mod.tipo === "clasificar" ? mod.fichas.map(x => x.id) : mod.tipo === "ubicar" ? mod.zonas.map(x => x.id) : [];
  const todasColocadas = idsColocables.length > 0 && idsColocables.every(id => asignacion[id]);
  const contador =
    mod.tipo === "memoria"
      ? `${emparejadas.length} / ${mod.pares.length} parejas`
      : `${idsColocables.filter(id => asignacion[id]).length} / ${idsColocables.length} colocados`;

  // ── Render ──────────────────────────────────────────────────────────────
  if (checking) {
    return (
      <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
        <View style={styles.backdrop} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#4C92E4" />
        </View>
      </ImageBackground>
    );
  }

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
            <TouchableOpacity style={[styles.btn, { marginTop: scaleDP(20) }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ImageBackground>
    );
  }

  const renderCartaMemoria = (c: Carta) => {
    if (mod.tipo !== "memoria") return null;
    const par      = mod.pares.find(p => p.id === c.parId)!;
    const resuelta = emparejadas.includes(c.parId);
    const abierta  = resuelta || volteadas.includes(c.key);
    const esColor  = c.tipo === "color";
    const { w, h } = dimsCartas(mod.pares.length);
    const circulo  = Math.floor(h * 0.62);
    return (
      <TouchableOpacity
        key={c.key}
        activeOpacity={0.8}
        onPress={() => tocarCarta(c)}
        style={[
          styles.carta,
          { width: w, height: h, backgroundColor: abierta ? "#FFFFFF" : TEAL },   // boca abajo todas iguales: no delata color o descripción
          resuelta && styles.cartaOk,
        ]}
      >
        {!abierta ? (
          <Text style={styles.cartaInterrogacion}>?</Text>
        ) : esColor ? (
          <View style={[styles.cartaColor, { width: circulo, height: circulo, borderRadius: circulo / 2, backgroundColor: par.color }]} />
        ) : (
          <Text style={styles.cartaTexto}>{par.descripcion}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* ══════════ INTRO ══════════ */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Nivel Visual – Lectura OF</Text>
            <Text style={styles.descripcionIntro}>
              Este nivel tiene {MODULOS.length} módulos sobre la orden de fabricación y {VIDAS_POR_MODULO} vidas en cada uno.{"\n\n"}
              Primero arrastra todos los términos al panel de la hoja de ruta al que pertenecen (encabezado, plano o tabla)
              y pulsa Validar: los correctos se marcan en verde y los incorrectos en rojo.{"\n\n"}
              Luego ubica cada campo en su casilla del encabezado y de la tabla de una orden de fabricación real.{"\n\n"}
              Después, voltea las cartas para encontrar cada color con su descripción.
            </Text>
            <TouchableOpacity style={styles.playButton} onPress={iniciar}>
              <Text style={styles.playButtonText}>Jugar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ══════════ JUEGO ══════════ */}
      {showGame && (
        <View style={styles.gameContent}>
          <View style={styles.topBar}>
            <Animated.Text style={[styles.topBarText, { transform: [{ scale: heartScale }] }]}>
              ❤️ {vidas}
            </Animated.Text>
            <View style={styles.titleBar}>
              <Text style={styles.titleBarText}>{mod.titulo}</Text>
            </View>
            <Text style={styles.topBarText}>
              Módulo {moduloIdx + 1}/{MODULOS.length} · {contador}
            </Text>
          </View>

          {mod.tipo === "clasificar" && (
            <>
              <View style={[styles.panelsRow, panelAlto !== null && { zIndex: 20 }]}>
                {mod.paneles.map(p => (
                  <View
                    key={p.id}
                    ref={(r) => { panelRefs.current[p.id] = r; }}
                    collapsable={false}
                    onLayout={medirPaneles}
                    style={[styles.panel, panelAlto === p.id && { zIndex: 30 }]}
                  >
                    <View style={styles.panelHeader}>
                      <Text style={styles.panelHeaderText}>{p.titulo}</Text>
                    </View>
                    <View style={styles.panelBody}>
                      {mod.fichas.filter(x => asignacion[x.id] === p.id).map(x => (
                        <FichaArrastrable
                          key={x.id}
                          texto={x.texto}
                          estado={resultados[x.id] ?? null}
                          onStart={() => { medirPaneles(); setPanelAlto(p.id); }}
                          onDrop={(ax, ay) => soltarFicha(x.id, ax, ay)}
                          onEnd={() => setPanelAlto(null)}
                        />
                      ))}
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.tray}>
                {orden.filter(id => !asignacion[id]).map(id => mod.fichas.find(x => x.id === id)).filter((x): x is Ficha => !!x).map(x => (
                  <FichaArrastrable
                    key={x.id}
                    texto={x.texto}
                    estado={null}
                    onStart={medirPaneles}
                    onDrop={(ax, ay) => soltarFicha(x.id, ax, ay)}
                    onEnd={() => {}}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.validarBtn, !todasColocadas && styles.validarBtnOff]}
                disabled={!todasColocadas}
                onPress={validar}
              >
                <Text style={styles.btnText}>Validar</Text>
              </TouchableOpacity>
            </>
          )}

          {mod.tipo === "ubicar" && (
            <>
              <View style={[styles.ubicarImagen, { aspectRatio: mod.aspecto }, panelAlto !== null && { zIndex: 20 }]}>
                <Image source={mod.imagen} style={styles.ubicarImg} resizeMode="stretch" />
                {mod.zonas.map(zn => {
                  const ficha = mod.zonas.find(x => asignacion[x.id] === zn.id);
                  return (
                    <View
                      key={zn.id}
                      ref={(r) => { panelRefs.current[zn.id] = r; }}
                      collapsable={false}
                      onLayout={medirPaneles}
                      style={[styles.zona, { left: `${zn.x}%`, top: `${zn.y}%`, width: `${zn.w}%`, height: `${zn.h}%` }, panelAlto === zn.id && { zIndex: 30 }]}
                    >
                      {ficha && (
                        <FichaArrastrable
                          key={ficha.id}
                          texto={ficha.texto}
                          compacta
                          estado={resultados[ficha.id] ?? null}
                          onStart={() => { medirPaneles(); setPanelAlto(zn.id); }}
                          onDrop={(ax, ay) => soltarFicha(ficha.id, ax, ay)}
                          onEnd={() => setPanelAlto(null)}
                        />
                      )}
                    </View>
                  );
                })}
              </View>

              <View style={styles.tray}>
                {orden.filter(id => !asignacion[id]).map(id => mod.zonas.find(x => x.id === id)).filter((x): x is Zona => !!x).map(x => (
                  <FichaArrastrable
                    key={x.id}
                    texto={x.texto}
                    estado={null}
                    onStart={medirPaneles}
                    onDrop={(ax, ay) => soltarFicha(x.id, ax, ay)}
                    onEnd={() => {}}
                  />
                ))}
              </View>

              <TouchableOpacity
                style={[styles.validarBtn, !todasColocadas && styles.validarBtnOff]}
                disabled={!todasColocadas}
                onPress={validar}
              >
                <Text style={styles.btnText}>Validar</Text>
              </TouchableOpacity>
            </>
          )}

          {mod.tipo === "memoria" && (
            <View style={styles.memoriaBoard}>
              <Text style={styles.memoriaHint}>Encuentra cada color con su descripción.</Text>
              <View style={[styles.memoriaGrid, { width: dimsCartas(mod.pares.length).grid }]}>{cartas.map(renderCartaMemoria)}</View>
            </View>
          )}
        </View>
      )}

      {/* ══════════ -1 VIDA ══════════ */}
      {showTryAgain && (
        <View
          pointerEvents="none"
          // en la memoria el fondo no se oscurece, para no tapar las cartas que hay que recordar
          style={[styles.overlay, mod.tipo === "memoria" && { backgroundColor: "transparent" }, { zIndex: 999, elevation: 999 }]}
        >
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: breakOpacity, transform: [{ scale: breakScale }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
          </View>
        </View>
      )}

      {/* ══════════ MÓDULO COMPLETADO ══════════ */}
      {showModuleComplete && (
        <View style={[styles.overlay, { zIndex: 9000, elevation: 9000 }]}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🎉 ¡Módulo {moduloIdx + 1} completado!</Text>
            <Text style={styles.modalDesc}>Muy bien, sigue así.</Text>
            <View style={styles.modalRow}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#1EA97C" }]}
                onPress={() => prepararModulo(moduloIdx + 1)}
              >
                <Text style={styles.modalBtnText}>Siguiente módulo</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* ══════════ SIN VIDAS ══════════ */}
      {showGameOver && (
        <View style={[styles.overlay, { zIndex: 9999, elevation: 9999 }]}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Sin vidas</Text>
            <Text style={styles.modalDesc}>
              Se agotaron las vidas.{"\n"}El nivel se reinicia desde el inicio.
            </Text>
            <View style={styles.modalRow}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: "#4C92E4" }]} onPress={iniciar}>
                <Text style={styles.modalBtnText}>Reiniciar nivel</Text>
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
            <Text style={styles.scoreBig}>{savedScore}%</Text>
            <Text style={styles.alertText}>
              {(savedScore ?? 0) >= 70
                ? "¡Aprobado! Has completado el nivel visual 🎉"
                : "Completaste el nivel."}
            </Text>
            <TouchableOpacity style={[styles.btn, { marginTop: scaleDP(20) }]} onPress={() => router.replace(RUTA_VOLVER as any)}>
              <Text style={styles.btnText}>Continuar</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </ImageBackground>
  );
}

// ── Estilos ──────────────────────────────────────────────────────────────────
const TEAL = "#8FC5CF";

// Tablero de memoria: cada módulo es una cuadrícula con una columna por pareja
// (3 parejas = 6 cartas en 2 filas de 3; 4 parejas = 8 cartas en 2 filas de 4)
const MEMORIA_GAP = 14;
const GRID_MAX    = Math.floor(Dimensions.get("window").width * 0.94);
const dimsCartas = (cols: number) => {
  const w = Math.min(scaleDP(230), Math.floor((GRID_MAX - MEMORIA_GAP * (cols - 1)) / cols));
  return { w, h: Math.floor(w * 0.72), grid: w * cols + MEMORIA_GAP * (cols - 1) };
};

const styles = StyleSheet.create({
  bg:      { flex: 1, width: "100%", height: "100%" },
  backdrop:{ ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.2)" },
  center:  { flex: 1, justifyContent: "center", alignItems: "center", padding: scaleDP(20) },

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
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(25) },

  gameContent: {
    flex:              1,
    paddingTop:        scaleDP(10),
    paddingBottom:     scaleDP(10),
    paddingHorizontal: scaleDP(14),
  },
  topBar: {
    flexDirection:  "row",
    alignItems:     "center",
    justifyContent: "space-between",
    paddingHorizontal: scaleDP(10),
    marginBottom:   scaleDP(8),
  },
  topBarText: { color: "#070000", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },
  titleBar: {
    backgroundColor:   TEAL,
    borderRadius:      scaleDP(14),
    paddingVertical:   scaleDP(6),
    paddingHorizontal: scaleDP(60),
  },
  titleBarText: { color: "#0F1B4C", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(20) },

  panelsRow: {
    flex:          1,
    flexDirection: "row",
    gap:           scaleDP(14),
    zIndex:        1,
  },
  // Sin overflow:"hidden": la ficha que se arrastra desde un panel no debe recortarse
  panel: {
    flex:            1,
    backgroundColor: "#FFFFFF",
    borderRadius:    scaleDP(16),
    borderWidth:     scaleDP(3),
    borderColor:     TEAL,
  },
  panelHeader: {
    backgroundColor:      TEAL,
    paddingVertical:      scaleDP(8),
    alignItems:           "center",
    borderTopLeftRadius:  scaleDP(12),
    borderTopRightRadius: scaleDP(12),
  },
  panelHeaderText: { color: "#0F1B4C", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(20) },
  panelBody: {
    flex:           1,
    flexDirection:  "row",
    flexWrap:       "wrap",
    alignContent:   "flex-start",
    gap:            scaleDP(8),
    padding:        scaleDP(10),
  },

  tray: {
    flexDirection:   "row",
    flexWrap:        "wrap",
    justifyContent:  "center",
    alignContent:    "flex-start",
    gap:             scaleDP(8),
    marginTop:       scaleDP(10),
    minHeight:       scaleDP(110),
    padding:         scaleDP(10),
    backgroundColor: TEAL,
    borderRadius:    scaleDP(16),
    zIndex:          10,
  },

  validarBtn: {
    alignSelf:         "center",
    marginTop:         scaleDP(10),
    backgroundColor:   "#58AE73",
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(70),
    borderRadius:      scaleDP(14),
    zIndex:            5,
  },
  validarBtnOff: { opacity: 0.4 },

  ficha: {
    backgroundColor:   "#FFFFFF",
    borderWidth:       scaleDP(2),
    borderColor:       "#9DB5E4",
    borderRadius:      scaleDP(10),
    paddingVertical:   scaleDP(6),
    paddingHorizontal: scaleDP(14),
    minWidth:          scaleDP(105),
    alignItems:        "center",
  },
  fichaDragging: { zIndex: 50, elevation: 12, borderColor: "#4C92E4", backgroundColor: "#DBEAFE" },
  fichaOk:       { borderColor: "#58AE73", backgroundColor: "#DCFCE7" },
  fichaBad:      { borderColor: "#D87E7E", backgroundColor: "#FEE2E2" },
  fichaText:     { color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },
  fichaCompacta: { width: "100%", height: "100%", minWidth: 0, paddingVertical: 0, paddingHorizontal: scaleDP(2), borderRadius: scaleDP(4), justifyContent: "center" },
  fichaTextCompacta: { fontSize: scaleDP(10), textAlign: "center" },

  // ── Ubicar sobre la imagen de la OF ──────────────────────────────────────
  ubicarImagen: { width: "100%", alignSelf: "center", position: "relative", backgroundColor: "#ffffff", borderRadius: scaleDP(6) },
  ubicarImg:    { width: "100%", height: "100%" },
  zona: {
    position:        "absolute",
    borderWidth:     scaleDP(2),
    borderStyle:     "dashed",
    borderColor:     "#4E9FB0",
    backgroundColor: "rgba(143, 197, 207, 0.18)",
    borderRadius:    scaleDP(4),
    padding:         scaleDP(1),
  },

  // ── Memoria ──────────────────────────────────────────────────────────────
  memoriaBoard: { flex: 1, justifyContent: "center", alignItems: "center", gap: scaleDP(20) },
  memoriaHint:  { color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },
  memoriaGrid:  { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: MEMORIA_GAP },
  carta: {
    borderRadius:   scaleDP(16),
    borderWidth:    scaleDP(3),
    borderColor:    TEAL,
    alignItems:     "center",
    justifyContent: "center",
    padding:        scaleDP(10),
  },
  cartaOk:            { borderColor: "#1EA97C" },
  cartaInterrogacion: { color: "#0F1B4C", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(60) },
  cartaColor:         { borderWidth: scaleDP(2), borderColor: "#A6A6A6" },
  cartaTexto:         { color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(20), textAlign: "center" },

  btn: {
    backgroundColor:   "#0F1B4C",
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(22),
    borderRadius:      scaleDP(12),
    alignItems:        "center",
  },
  btnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:   "rgba(0,0,0,0.45)",
    justifyContent:    "center",
    alignItems:        "center",
    paddingHorizontal: scaleDP(24),
  },
  modalBoxSmall: {
    backgroundColor:   "#fff",
    borderRadius:      scaleDP(16),
    paddingVertical:   scaleDP(10),
    paddingHorizontal: scaleDP(20),
    alignItems:        "center",
    elevation:         8,
  },
  bigHeart:     { fontSize: scaleDP(100), color: "red" },
  minusOneText: { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(60), color: "#DC2626", marginTop: scaleDP(-10) },

  modalBox: {
    width:             "92%",
    backgroundColor:   "#fff",
    borderRadius:      scaleDP(16),
    paddingVertical:   scaleDP(20),
    paddingHorizontal: scaleDP(18),
    alignItems:        "center",
    elevation:         8,
  },
  modalTitle:   { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(50), color: "#0F1B4C", textAlign: "center" },
  modalDesc:    { marginTop: scaleDP(8), fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(30), color: "#111827", textAlign: "center" },
  modalRow:     { marginTop: scaleDP(14), flexDirection: "row", gap: scaleDP(10) },
  modalBtn:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

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
});
