import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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

// ── Contenido: "Hoja de ruta" (Visual 1 del PowerPoint de Lectura OF) ───────
// Cada término sale revuelto en la bandeja y el jugador lo arrastra al panel
// de la orden de fabricación al que pertenece. Para sumar más actividades de
// otras diapositivas, agregar otro objeto a MODULOS.
type Panel  = { id: string; titulo: string };
type Ficha  = { id: string; texto: string; panel: string };
type Modulo = { titulo: string; paneles: Panel[]; fichas: Ficha[]; vidas: number };

const f = (panel: string, texto: string): Ficha => ({ id: `${panel}-${texto}`, texto, panel });

const MODULOS: Modulo[] = [
  {
    titulo: "HOJA DE RUTA",
    vidas:  8,
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
];
const MODULO = MODULOS[0];

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

function computeScore(mistakes: number, total: number) {
  const effMiss = Math.max(0, mistakes);
  return Math.round(60 + 40 * Math.pow(total / (total + effMiss), 0.8));
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

type Rect = { x: number; y: number; width: number; height: number };

// ── Ficha arrastrable ───────────────────────────────────────────────────────
function FichaArrastrable({ texto, onStart, onDrop }: {
  texto:   string;
  onStart: () => void;
  onDrop:  (absX: number, absY: number) => void;
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
    }
  };

  return (
    <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
      <ReAnimated.View style={[styles.ficha, astyle, dragging && styles.fichaDragging]}>
        <Text style={styles.fichaText} numberOfLines={1}>{texto}</Text>
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

  const [showIntro,   setShowIntro]   = useState(true);
  const [showGame,    setShowGame]    = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const [bandeja,    setBandeja]    = useState<string[]>([]);   // ids de fichas aún sin colocar
  const [colocadas,  setColocadas]  = useState<string[]>([]);   // ids ya colocadas bien
  const [vidas,      setVidas]      = useState(MODULO.vidas);
  const [errores,    setErrores]    = useState(0);
  const [wrongPanel, setWrongPanel] = useState<string | null>(null);

  const [showTryAgain, setShowTryAgain] = useState(false);
  const [showGameOver, setShowGameOver] = useState(false);

  const total = MODULO.fichas.length;

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
    if (!showTryAgain) return;
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
    const t = setTimeout(() => setShowTryAgain(false), 1500);
    return () => clearTimeout(t);
  }, [showTryAgain]);

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

  // ── Juego ───────────────────────────────────────────────────────────────
  const iniciar = () => {
    setBandeja(shuffleArray(MODULO.fichas.map(x => x.id)));
    setColocadas([]);
    setVidas(MODULO.vidas);
    setErrores(0);
    setWrongPanel(null);
    setShowTryAgain(false);
    setShowGameOver(false);
    setShowIntro(false);
    setShowSuccess(false);
    setShowGame(true);
    setTimeout(medirPaneles, 400);
  };

  const soltarFicha = (fichaId: string, absX: number, absY: number) => {
    const ficha = MODULO.fichas.find(x => x.id === fichaId);
    if (!ficha) return;

    const destino = Object.entries(panelRects.current).find(([, r]) =>
      absX > r.x && absX < r.x + r.width && absY > r.y && absY < r.y + r.height
    )?.[0];
    if (!destino) return; // soltó fuera de los paneles: vuelve a la bandeja sin penalizar

    if (destino === ficha.panel) {
      setBandeja(b => b.filter(id => id !== fichaId));
      const nuevas = [...colocadas, fichaId];
      setColocadas(nuevas);
      if (nuevas.length >= total) finalizar(errores, vidas);
      return;
    }

    // Panel incorrecto: -1 vida, la ficha vuelve a la bandeja
    const nuevosErrores = errores + 1;
    const nuevasVidas   = Math.max(0, vidas - 1);
    setErrores(nuevosErrores);
    setVidas(nuevasVidas);
    animateHeart();
    setWrongPanel(destino);
    setTimeout(() => setWrongPanel(null), 450);
    if (nuevasVidas <= 0) setShowGameOver(true);
    else setShowTryAgain(true);
  };

  const finalizar = async (erroresFinal: number, vidasFinal: number) => {
    const score    = computeScore(erroresFinal, total);
    const aprobado = score >= 70;
    try {
      await apiJson(`${API_URL}/api/niveles/visual/${NIVEL_KEY_API}/resultado`, {
        method: "POST",
        body: JSON.stringify({ usuarioKey, puntaje: score, aprobado, mismatches: erroresFinal, livesLeft: vidasFinal }),
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

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.backdrop} />

      {/* ══════════ INTRO ══════════ */}
      {showIntro && (
        <View style={styles.header}>
          <View style={styles.introBox}>
            <Text style={styles.tituloIntro}>Nivel Visual – Lectura OF</Text>
            <Text style={styles.descripcionIntro}>
              Cada término de la orden de fabricación pertenece a una parte de la hoja de ruta:
              el encabezado, el plano o la tabla.{"\n\n"}
              Arrastra cada término desde la parte de abajo hasta el panel que le corresponde.
              Si te equivocas pierdes una vida.
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
              <Text style={styles.titleBarText}>{MODULO.titulo}</Text>
            </View>
            <Text style={styles.topBarText}>{colocadas.length} / {total} términos</Text>
          </View>

          <View style={styles.panelsRow}>
            {MODULO.paneles.map(p => (
              <View
                key={p.id}
                ref={(r) => { panelRefs.current[p.id] = r; }}
                collapsable={false}
                onLayout={medirPaneles}
                style={[styles.panel, wrongPanel === p.id && styles.panelWrong]}
              >
                <View style={styles.panelHeader}>
                  <Text style={styles.panelHeaderText}>{p.titulo}</Text>
                </View>
                <View style={styles.panelBody}>
                  {MODULO.fichas
                    .filter(x => x.panel === p.id && colocadas.includes(x.id))
                    .map(x => (
                      <View key={x.id} style={[styles.ficha, styles.fichaOk]}>
                        <Text style={styles.fichaText} numberOfLines={1}>{x.texto}</Text>
                      </View>
                    ))}
                </View>
              </View>
            ))}
          </View>

          <View style={styles.tray}>
            {bandeja.map(id => {
              const ficha = MODULO.fichas.find(x => x.id === id)!;
              return (
                <FichaArrastrable
                  key={id}
                  texto={ficha.texto}
                  onStart={medirPaneles}
                  onDrop={(x, y) => soltarFicha(id, x, y)}
                />
              );
            })}
          </View>
        </View>
      )}

      {/* ══════════ -1 VIDA ══════════ */}
      {showTryAgain && (
        <View pointerEvents="none" style={[styles.overlay, { zIndex: 999, elevation: 999 }]}>
          <View style={styles.modalBoxSmall}>
            <Animated.Text style={[styles.bigHeart, { opacity: breakOpacity, transform: [{ scale: breakScale }] }]}>
              💔
            </Animated.Text>
            <Text style={styles.minusOneText}>-1 vida</Text>
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
  panel: {
    flex:            1,
    backgroundColor: "#FFFFFF",
    borderRadius:    scaleDP(16),
    borderWidth:     scaleDP(3),
    borderColor:     TEAL,
    overflow:        "hidden",
  },
  panelWrong:      { borderColor: "#DC2626", backgroundColor: "#FEE2E2" },
  panelHeader:     { backgroundColor: TEAL, paddingVertical: scaleDP(8), alignItems: "center" },
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
    minHeight:       scaleDP(150),
    padding:         scaleDP(10),
    backgroundColor: TEAL,
    borderRadius:    scaleDP(16),
    zIndex:          10,
  },

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
  fichaOk:       { borderColor: "#1EA97C", backgroundColor: "#DCFCE7" },
  fichaText:     { color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(15) },

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
