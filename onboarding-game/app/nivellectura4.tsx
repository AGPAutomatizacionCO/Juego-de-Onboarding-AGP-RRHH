import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import * as Speech from "expo-speech";
import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  ImageBackground,
  Animated as RNAnimated,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from "react-native";
import { PanGestureHandler, State } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { API_BASE_URL } from "./config";

/* ---------- Constantes ---------- */
const { width } = Dimensions.get("window");
const CARD_W = Math.min(width * 0.92, 920);

const shuffle = (arr: string[]) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const MAX_LIVES = 3;

function scoreFromLives(lives: number) {
  if (lives >= 3) return 100;
  if (lives === 2) return 90;
  if (lives === 1) return 80;
  return 75;
}

/* ---------- Tipos ---------- */
type Frase = {
  id: number;
  antes: string;
  despues: string;
  respuesta: string;
};

/* ---------- Contenido fijo isla 4 ---------- */
const FRASES_FIJAS: Frase[] = [
  {
    id: 1,
    antes: "Se reconoce como",
    despues: "cuando el lite lleva banda negra y/o degradé",
    respuesta: "Vidrio pintura",
  },
  {
    id: 2,
    antes: "Se utiliza un",
    despues: "cuando la orden de fabricación lo identifica con la letra M y la pieza necesita una doble curvatura esférica.",
    respuesta: "Molde Anillo",
  },
  {
    id: 3,
    antes: "Se entiende como",
    despues: "al conjunto de todas las piezas blindadas que pertenecen a un mismo vehículo",
    respuesta: "Set",
  },
  {
    id: 4,
    antes: "Se usa una",
    despues: "para revisar si el vidrio quedó con la misma forma de la pieza original.",
    respuesta: "Galga de verificación",
  },
  {
    id: 5,
    antes: "La pieza lleva un",
    despues: "cuando necesita una protección y soporte alrededor del vidrio",
    respuesta: "Marco de acero",
  },
  {
    id: 6,
    antes: "Se identifica como",
    despues: "la pieza que divide y protege la parte entre el baúl y los pasajeros.",
    respuesta: "Partición",
  },
];

// Correctas + incorrectas mezcladas
const OPCIONES_BANCO: string[] = shuffle([
  "Vidrio pintura",
  "Molde Anillo",
  "Set",
  "Galga de verificación",
  "Marco de acero",
  "Partición",
  "Galgas de control",
  "Marco superior",
  "Cara interna",
  "Molde Simple",
  "Fragatta",
  "Detalle geométrico",
]);

/* ---------- Constantes isla ---------- */
const ISLA_KEY       = 4;
const NIVEL_KEY      = 17;
const API_URL_DEFAULT = API_BASE_URL;

/* ---------- Pantalla principal ---------- */
export default function NivelLectura4() {
  const router  = useRouter();
  const API_URL = API_URL_DEFAULT;

  const [usuarioKey, setUsuarioKey] = useState<number | null>(null);

  const keyU = (suffix: string) => `u:${usuarioKey ?? 0}:${suffix}`;
  const PROG_LECTURA_DONE_KEY      = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_done`);
  const PROG_LECTURA_SCORE_KEY     = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_score`);
  const PROG_LECTURA_APROBADO_KEY  = keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_lectura_aprobado`);
  const PROG_RECORDEMOS_UNLOCK_KEY = keyU(`isla${ISLA_KEY}_nivel3_recordemos_unlocked`);

  const [frases,   setFrases]   = useState<Frase[]>(FRASES_FIJAS);
  const [opciones, setOpciones] = useState<string[]>(OPCIONES_BANCO);

  const [colocadas,   setColocadas]   = useState<Record<number, string>>({});
  const [finalizado,  setFinalizado]  = useState(false);
  const [showIntro,   setShowIntro]   = useState(false);
  const [checkingDone,setCheckingDone]= useState(true);
  const [showContent, setShowContent] = useState(false);
  const [dirtySlots,  setDirtySlots]  = useState<Record<number, boolean>>({});

  const [lives, setLives] = useState<number>(MAX_LIVES);

  const [successVisible,  setSuccessVisible]  = useState(false);
  const fadeAnim = useRef(new RNAnimated.Value(0)).current;

  const [savedFinalScore, setSavedFinalScore] = useState<number | null>(null);
  const [savedAprobado,   setSavedAprobado]   = useState<boolean | null>(null);

  const [showMinusOverlay, setShowMinusOverlay] = useState(false);
  const [showGameOver,     setShowGameOver]     = useState(false);

  const heartScale   = useRef(new RNAnimated.Value(1)).current;
  const minusScale   = useRef(new RNAnimated.Value(0.6)).current;
  const minusOpacity = useRef(new RNAnimated.Value(0)).current;
  const minusShake   = useRef(new RNAnimated.Value(0)).current;

  const slotRects = useRef<Record<number, { x: number; y: number; width: number; height: number }>>({});

  const contentOpacity = useSharedValue(1);
  const contentStyle   = useAnimatedStyle(() => ({ opacity: contentOpacity.value }));

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  /* ── Guardar resultado en BD ── */
  const saveResultadoLectura = async (puntaje: number, aprobado: boolean, correctas: number, total: number) => {
    if (!usuarioKey) return;
    try {
      await fetch(`${API_URL}/api/niveles/lectura/${NIVEL_KEY}/resultado`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioKey, puntaje, aprobado, livesLeft: lives, correctas, total, islaKey: ISLA_KEY }),
      });
    } catch (e) { console.log("Error guardando lectura4:", e); }
  };

  const speak = (text: string) => {
    try { Speech.stop(); Speech.speak(text, { language: "es-ES", rate: 1.0, pitch: 1.0, volume: 1.0 }); } catch {}
  };

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
    minusScale.setValue(0.6);
    minusOpacity.setValue(0);
    minusShake.setValue(0);
    Vibration.vibrate(120);
    RNAnimated.parallel([
      RNAnimated.sequence([
        RNAnimated.timing(minusOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        RNAnimated.timing(minusOpacity, { toValue: 1, duration: 160, useNativeDriver: true }),
      ]),
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

  useEffect(() => {
    if (showMinusOverlay) playMinusAnim();
  }, [showMinusOverlay]);

  const showSuccessOverlay = () => {
    setSuccessVisible(true);
    fadeAnim.setValue(0);
    RNAnimated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }).start();
  };

  /* ── Cargar usuario ── */
  useEffect(() => {
    (async () => {
      const k = await AsyncStorage.getItem("USUARIO_KEY");
      const n = Number(k);
      if (!k || !Number.isFinite(n) || n <= 0) {
        setCheckingDone(false);
        Alert.alert("Falta sesión", "No se encontró usuarioKey.", [
          { text: "OK", onPress: () => router.replace("/registration") },
        ]);
        return;
      }
      setUsuarioKey(n);
    })();
  }, []);

  /* ── Verificar si ya completó ── */
  useEffect(() => {
    if (!usuarioKey) return;
    (async () => {
      try {
        const done = await AsyncStorage.getItem(PROG_LECTURA_DONE_KEY);
        if (done === "true") {
          const s = await AsyncStorage.getItem(PROG_LECTURA_SCORE_KEY);
          const a = await AsyncStorage.getItem(PROG_LECTURA_APROBADO_KEY);
          setSavedFinalScore(s ? Number(s) : 0);
          setSavedAprobado(a === "true");
          setShowIntro(false);
          setShowContent(false);
          setSuccessVisible(true);
          fadeAnim.setValue(1);
        } else {
          setShowIntro(true);
        }
      } catch (e) {
        setShowIntro(true);
      } finally {
        setCheckingDone(false);
      }
    })();
  }, [usuarioKey]);

  const medirSlot = (id: number, ref: View) => {
    if (!ref) return;
    ref.measureInWindow((x, y, w, h) => {
      slotRects.current[id] = { x, y, width: w, height: h };
    });
  };

  const handleDrop = (palabra: string, dropX: number, dropY: number) => {
    for (const [id, r] of Object.entries(slotRects.current)) {
      if (dropX > r.x && dropX < r.x + r.width && dropY > r.y && dropY < r.y + r.height) {
        const numId = Number(id);
        setColocadas((prev) => ({ ...prev, [numId]: palabra }));
        if (finalizado) setDirtySlots((prev) => ({ ...prev, [numId]: true }));
        return;
      }
    }
  };

  const getIsCorrect = (id: number) =>
    String(colocadas[id] ?? "").trim() ===
    String(frases.find((f) => f.id === id)?.respuesta ?? "").trim();

  const colorSlot = (id: number) => {
    if (!colocadas[id]) return "#6B7AA6";
    if (!finalizado)    return "#6B7AA6";
    if (dirtySlots[id]) return "#6B7AA6";
    return getIsCorrect(id) ? "#1EA97C" : "#D64545";
  };

  const colorBordeSlot = (id: number) => {
    if (!colocadas[id]) return "#9DB5E4";
    if (!finalizado)    return "#6B7AA6";
    if (dirtySlots[id]) return "#9DB5E4";
    return getIsCorrect(id) ? "#1EA97C" : "#D64545";
  };

  const resetAll = () => {
    Speech.stop();
    setColocadas({});
    setOpciones(shuffle(OPCIONES_BANCO));
    setFinalizado(false);
    setDirtySlots({});
    setLives(MAX_LIVES);
    setSuccessVisible(false);
    setShowMinusOverlay(false);
    setShowGameOver(false);
  };

  const onContinuar = async () => {
    if (successVisible || showGameOver || showMinusOverlay) return;
    if (lives <= 0) return;

    setDirtySlots({});
    setFinalizado(true);

    let correctas = 0;
    for (const f of frases) {
      if (String(colocadas[f.id] ?? "").trim() === String(f.respuesta ?? "").trim()) correctas++;
    }

    const allCorrect = frases.length > 0 && correctas === frases.length;

    if (allCorrect) {
      const s        = scoreFromLives(lives);
      const aprobado = s >= 70;

      await AsyncStorage.multiSet([
        [PROG_LECTURA_DONE_KEY,      "true"],
        [PROG_LECTURA_SCORE_KEY,     String(s)],
        [PROG_LECTURA_APROBADO_KEY,  String(aprobado)],
        [PROG_RECORDEMOS_UNLOCK_KEY, "true"],
      ]);

      setSavedFinalScore(s);
      setSavedAprobado(aprobado);

      try { await saveResultadoLectura(s, aprobado, correctas, frases.length); } catch {}

      showSuccessOverlay();
      speak(`Has respondido correctamente. Tu puntaje es ${s} sobre 100.`);
      return;
    }

    const newLives = lives - 1;
    animateHeart();

    if (newLives <= 0) {
      setLives(0);
      const s = 75;
      await AsyncStorage.multiSet([
        [PROG_LECTURA_DONE_KEY,      "true"],
        [PROG_LECTURA_SCORE_KEY,     String(s)],
        [PROG_LECTURA_APROBADO_KEY,  "false"],
        [PROG_RECORDEMOS_UNLOCK_KEY, "true"],
      ]);
      setSavedFinalScore(s);
      setSavedAprobado(false);
      try { await saveResultadoLectura(s, false, correctas, frases.length); } catch {}
      setShowGameOver(true);
      speak("Se acabaron las vidas. Tu puntaje es 75.");
    } else {
      setLives(newLives);
      setShowMinusOverlay(true);
      speak("Perdiste una vida. Revisa tus respuestas.");
    }
  };

  if (!loaded || checkingDone) return <View style={{ flex: 1, backgroundColor: "white" }} />;

  const fondo  = require("../assets/FONDOREG.png");
  const shakeX = minusShake.interpolate({ inputRange: [-1, 0, 1], outputRange: [-6, 0, 6] });

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>

        {/* ===== INTRO ===== */}
        {showIntro && !showContent && (
          <View style={styles.header}>
            <View style={styles.introBox}>
              <Text style={styles.tituloIntro}>Nivel de Lectura – Conceptos Generales</Text>
              <Text style={styles.descripcionIntro}>
                En este nivel pondrás a prueba tu comprensión lectora aplicada a los conceptos de AGP.{"\n\n"}
                Lee con atención cada frase y arrastra la palabra correcta al espacio vacío
                para completar el significado.{"\n\n"}
                Concéntrate en el contexto, relaciona los términos con su uso real en planta
                y valida que cada decisión tenga sentido técnico.
              </Text>
              <TouchableOpacity
                style={styles.playButton}
                onPress={() => {
                  setShowIntro(false);
                  setShowContent(true);
                  contentOpacity.value = 0;
                  contentOpacity.value = withTiming(1, { duration: 600 });
                }}
              >
                <Text style={styles.playButtonText}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== CONTENIDO DEL JUEGO ===== */}
        {showContent && (
          <Animated.View style={[{ width: "100%", alignItems: "center" }, contentStyle]}>
            <RNAnimated.Text style={[styles.lives, { transform: [{ scale: heartScale }] }]}>
              <Text style={{ color: "red", fontSize: 32 }}>❤️ </Text>
              {lives}
            </RNAnimated.Text>

            <View style={styles.cardsRowContainer}>
              <View style={styles.column}>
                {frases.slice(0, 3).map((f) => (
                  <View key={f.id} style={styles.card}>
                    <Text style={styles.fraseRow as any}>
                      <Text style={styles.fraseText}>{f.antes} </Text>
                      <View
                        ref={(ref: View | null) => { if (ref) medirSlot(f.id, ref); }}
                        style={styles.slotInline}
                      >
                        <Text style={[styles.slotText, { color: colorSlot(f.id) }]}>
                          {colocadas[f.id] ? colocadas[f.id] : "______"}
                        </Text>
                        <View style={{ height: 3, width: "100%", backgroundColor: colorBordeSlot(f.id) }} />
                      </View>
                      <Text style={styles.fraseText}> {f.despues}</Text>
                    </Text>
                  </View>
                ))}
              </View>

              <View style={styles.column}>
                {frases.slice(3, 6).map((f) => (
                  <View key={f.id} style={styles.card}>
                    <Text style={styles.fraseRow as any}>
                      <Text style={styles.fraseText}>{f.antes} </Text>
                      <View
                        ref={(ref: View | null) => { if (ref) medirSlot(f.id, ref); }}
                        style={styles.slotInline}
                      >
                        <Text style={[styles.slotText, { color: colorSlot(f.id) }]}>
                          {colocadas[f.id] ? colocadas[f.id] : "______"}
                        </Text>
                        <View style={{ height: 3, width: "100%", backgroundColor: colorBordeSlot(f.id) }} />
                      </View>
                      <Text style={styles.fraseText}> {f.despues}</Text>
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.subtitulo}>Palabras</Text>
            <View style={styles.wordBank}>
              {opciones.map((p) => (
                <DraggableWord key={p} palabra={p} onDrop={handleDrop} />
              ))}
            </View>

            <View style={styles.buttons}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => router.back()}
              >
                <Text style={[styles.btnText, styles.btnGhostText]}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.btn} onPress={onContinuar}>
                <Text style={styles.btnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ===== ÉXITO ===== */}
        {successVisible && (
          <View style={styles.modalOverlay}>
            <RNAnimated.View
              style={[
                styles.alertBox,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                },
              ]}
            >
              <Text style={styles.scoreBig}>{`${savedFinalScore ?? scoreFromLives(lives)}%`}</Text>
              <Text style={styles.alertText}>✅ ¡Has respondido correctamente todas las frases!</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: 16 }]}
                onPress={() => {
                  setSuccessVisible(false);
                  router.back();
                }}
              >
                <Text style={styles.modalBtnText}>Continuar</Text>
              </TouchableOpacity>
            </RNAnimated.View>
          </View>
        )}

        {/* ===== -1 VIDA ===== */}
        {showMinusOverlay && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalBoxSmall}>
              <RNAnimated.Text
                style={[
                  styles.bigHeart,
                  { opacity: minusOpacity, transform: [{ scale: minusScale }, { translateX: shakeX }] },
                ]}
              >
                💔
              </RNAnimated.Text>
              <Text style={styles.minusOneText}>-1 vida</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: 10 }]}
                onPress={() => setShowMinusOverlay(false)}
              >
                <Text style={styles.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ===== GAME OVER ===== */}
        {showGameOver && (
          <View style={styles.modalOverlay}>
            <View style={styles.alertBox}>
              <Text style={styles.scoreBig}>75%</Text>
              <Text style={styles.alertText}>Se han acabado las vidas 💔</Text>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: "#4C92E4", marginTop: 16 }]}
                onPress={() => router.back()}
              >
                <Text style={styles.modalBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

/* ---------- Palabra arrastrable ---------- */
function DraggableWord({ palabra, onDrop }: { palabra: string; onDrop: (palabra: string, dropX: number, dropY: number) => void }) {
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const [dragging, setDragging] = useState(false);

  const astyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
    zIndex: dragging ? 10 : 1,
  }));

  const onGestureEvent = (e: any) => {
    tx.value = e.nativeEvent.translationX;
    ty.value = e.nativeEvent.translationY;
  };

  const onHandlerStateChange = (e: any) => {
    const { absoluteX, absoluteY, state } = e.nativeEvent || {};
    if (state === State.END) {
      if (absoluteX && absoluteY) onDrop(palabra, absoluteX, absoluteY);
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
      <Animated.View style={[styles.wordChip, astyle]}>
        <Text style={styles.wordText}>{palabra}</Text>
      </Animated.View>
    </PanGestureHandler>
  );
}

/* ---------- Estilos — idénticos al código guía ---------- */
const styles = StyleSheet.create({
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    alignItems: "center",
    paddingTop: 36,
    paddingBottom: 26,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
  },
  header: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: 40, paddingHorizontal: 40, borderRadius: 25,
    alignItems: "center", maxWidth: "80%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  tituloIntro: { fontFamily: "PlusJakartaSans-Bold", fontSize: 50, color: "#fff", textAlign: "center", marginBottom: 16 },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 33 },
  playButton: { marginTop: 40, backgroundColor: "#4C92E4", paddingVertical: 10, paddingHorizontal: 50, borderRadius: 16 },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 40 },

  lives: { textAlign: "center", fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C", fontSize: 24, marginBottom: 10 },

  cardsRowContainer: {
    width: "96%", flexDirection: "row", justifyContent: "center",
    alignItems: "flex-start", marginTop: 6, marginBottom: 10, gap: 20,
  },
  column: { flex: 1, gap: 14 },
  card: {
    width: "100%", backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 18,
    paddingVertical: 20, paddingHorizontal: 16,
    shadowColor: "#0f1b4c", shadowOpacity: 0.05, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 4,
  },
  fraseRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center" },
  fraseText: { fontSize: 18, lineHeight: 25, color: "#1f2937", fontFamily: "PlusJakartaSans-Regular" },
  slotInline: {
    marginHorizontal: 4, minWidth: 180, paddingHorizontal: 6, paddingVertical: 2,
    alignItems: "center", justifyContent: "center",
  },
  slotText: { fontSize: 18, lineHeight: 24, fontFamily: "PlusJakartaSans-Bold", textAlign: "center" },

  subtitulo: { width: "96%", fontSize: 16, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", marginTop: 6, marginBottom: 8, textAlign: "left" },
  wordBank: { width: "96%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  wordChip: {
    backgroundColor: "#EEF3FF", borderWidth: 1, borderColor: "#CAD7FF",
    paddingVertical: 10, paddingHorizontal: 14, borderRadius: 22, margin: 6,
  },
  wordText: { color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", fontSize: 13 },

  buttons: { width: "96%", flexDirection: "row", justifyContent: "center", gap: 14, marginTop: 18 },
  btn: { backgroundColor: "#0F1B4C", paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14 },
  btnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 16 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#0F1B4C" },
  btnGhostText: { color: "#0F1B4C" },

  modalOverlay: {
    position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 16,
  },
  alertBox: {
    backgroundColor: "#77b479ff", paddingVertical: 22, paddingHorizontal: 35,
    borderRadius: 20, elevation: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    alignItems: "center", maxWidth: "85%",
  },
  scoreBig: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: 120, textAlign: "center", marginBottom: 12 },
  alertText: { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: 35, textAlign: "center" },

  modalBoxSmall: { backgroundColor: "#fff", borderRadius: 16, paddingVertical: 14, paddingHorizontal: 26, alignItems: "center", elevation: 8 },
  bigHeart: { fontSize: 100, color: "red", textAlign: "center", marginBottom: 0 },
  minusOneText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 35, color: "#DC2626", marginTop: -4 },

  modalBox: { width: "92%", backgroundColor: "#fff", borderRadius: 16, paddingVertical: 20, paddingHorizontal: 18, alignItems: "center", elevation: 8 },
  modalTitle: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 50, color: "#0F1B4C", textAlign: "center" },
  modalDesc: { marginTop: 8, fontFamily: "PlusJakartaSans-Regular", fontSize: 30, color: "#111827", textAlign: "center" },
  modalRow: { marginTop: 14, flexDirection: "row", gap: 10 },
  modalBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 10 },
  modalBtnText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 35 },
});