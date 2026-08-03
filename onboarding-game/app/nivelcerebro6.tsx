import { useFonts } from "expo-font";
import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  ImageBackground,
  Keyboard,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  TextInput,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

/* =========================================================
   CONFIG
========================================================= */
const fondo       = require("../assets/islas/fondogeneral.png");
const RUTA_VOLVER = "/Metrologia";
const API_URL     = API_BASE_URL;
const ISLA_KEY    = 6;
const NIVEL_KEY   = 28;
const MAX_HINTS   = 4;
const FIXED_SCORE = 100;

/*
  CRUCES VERIFICADOS:
  H1. MICROMETRO  fila=0, col=0  → M(0)I(1)C(2)R(3)O(4)M(5)E(6)T(7)R(8)O(9)
  H2. FLEXOMETRO  fila=4, col=1  → F(0)L(1)E(2)X(3)O(4)M(5)E(6)T(7)R(8)O(9)
  H3. VACUOMETRO  fila=6, col=1  → V(0)A(1)C(2)U(3)O(4)M(5)E(6)T(7)R(8)O(9)

  V1. METROLOGIA  fila=0, col=5  → M(0)E(1)T(2)R(3)O(4)L(5)O(6)G(7)I(8)A(9)
      cruce H1 fila0,col5: MICROMETRO[5]='M' = METROLOGIA[0]='M' ✓
      cruce H2 fila4,col5: FLEXOMETRO[4]='O' = METROLOGIA[4]='O' ✓
      cruce H3 fila6,col5: VACUOMETRO[4]='O' = METROLOGIA[6]='O' ✓

  V2. CONTROL     fila=0, col=2  → C(0)O(1)N(2)T(3)R(4)O(5)L(6)
      cruce H1 fila0,col2: MICROMETRO[2]='C' = CONTROL[0]='C' ✓

  V3. ESPESOR     fila=0, col=6  → E(0)S(1)P(2)E(3)S(4)O(5)R(6)
      cruce H1 fila0,col6: MICROMETRO[6]='E' = ESPESOR[0]='E' ✓
========================================================= */

const ROWS = 12;
const COLS = 14;
const CELL = 50;

type Direction = "across" | "down";
type Placement = { number: number; word: string; clue: string; direction: Direction; row: number; col: number };
type CellData  = { isBlock: boolean; solution?: string; number?: number };
type Coord     = { row: number; col: number };

const PLACEMENTS: Placement[] = [
  {
    number: 1,
    word: "MICROMETRO",
    clue: "Instrumento que mide espesores con alta precisión. Se usa para verificar el espesor de los lites.",
    direction: "across",
    row: 1,
    col: 1,
  },

  {
    number: 2,
    word: "FLEXOMETRO",
    clue: "Instrumento adecuado para realizar mediciones superiores a 300 mm en planta.",
    direction: "down",
    row: 0,
    col: 7,
  },

  {
    number: 3,
    word: "VACUOMETRO",
    clue: "Instrumento que mide el nivel de vacío en una pieza. En embolsado debe marcar aprox. -20 InHg.",
    direction: "across",
    row: 10,
    col: 0,
  },

  {
    number: 4,
    word: "METROLOGIA",
    clue: "Ciencia que estudia las mediciones, sus métodos y la exactitud de los instrumentos utilizados en planta.",
    direction: "down",
    row: 1,
    col: 1,
  },

  {
    number: 5,
    word: "CONTROL",
    clue: "Sistema que certifica que los instrumentos de medición están calibrados y aptos para ser usados.",
    direction: "down",
    row: 0,
    col: 11,
  },

  {
    number: 6,
    word: "ESPESOR",
    clue: "Dimensión de un material medida de una cara a otra. Se verifica con el micrómetro en los lites.",
    direction: "down",
    row: 5,
    col: 6,
  },
];
/* =========================================================
   HELPERS
========================================================= */
const normalizeWord = (s: string): string =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/Ñ/g, "N").toUpperCase();

function buildCrossword() {
  const grid: CellData[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ isBlock: true }))
  );
  const wordCoords: Record<number, Coord[]>       = {};
  const cellToPlacements: Record<string, number[]> = {};

  for (const item of PLACEMENTS) {
    const normalized = normalizeWord(item.word);
    const coords: Coord[] = [];
    for (let i = 0; i < normalized.length; i++) {
      const r = item.direction === "across" ? item.row     : item.row + i;
      const c = item.direction === "across" ? item.col + i : item.col;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      grid[r][c] = { ...grid[r][c], isBlock: false, solution: normalized[i] };
      coords.push({ row: r, col: c });
      const key = `${r}-${c}`;
      if (!cellToPlacements[key]) cellToPlacements[key] = [];
      cellToPlacements[key].push(item.number);
    }
    grid[item.row][item.col] = { ...grid[item.row][item.col], isBlock: false, number: item.number };
    wordCoords[item.number] = coords;
  }
  return { grid, wordCoords, cellToPlacements };
}

const { grid: CROSSWORD_GRID, wordCoords: WORD_COORDS, cellToPlacements: CELL_TO_PLACEMENTS } = buildCrossword();
const acrossClues = PLACEMENTS.filter(p => p.direction === "across");
const downClues   = PLACEMENTS.filter(p => p.direction === "down");

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function NivelRecordemosMetrologia() {
  const router = useRouter();

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const [showIntro,        setShowIntro]        = useState(true);
  const [showContent,      setShowContent]      = useState(false);
  const [showFinal,        setShowFinal]        = useState(false);
  const [inputs,           setInputs]           = useState<Record<string, string>>({});
  const [checked,          setChecked]          = useState(false);
  const [hintsLeft,        setHintsLeft]        = useState(MAX_HINTS);
  const [lastHint,         setLastHint]         = useState<string | null>(null);
  const [activeWordNumber, setActiveWordNumber] = useState<number | null>(null);
  const [solvedWords,      setSolvedWords]      = useState<Record<number, boolean>>({});
  const [conceptData,      setConceptData]      = useState<{ palabra: string; concepto: string } | null>(null);
  const [showConcept,      setShowConcept]      = useState(false);

  const conceptAnim    = useRef(new Animated.Value(0)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const inputRefs      = useRef<Record<string, TextInput | null>>({});

  const keyCell = (r: number, c: number) => `${r}-${c}`;

  const showConceptPopup = (palabra: string, concepto: string) => {
    setConceptData({ palabra, concepto }); setShowConcept(true); conceptAnim.setValue(0);
    Animated.timing(conceptAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(conceptAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setShowConcept(false); setConceptData(null);
        });
      }, 1800);
    });
  };

  const conceptScale = conceptAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  const startGame = () => {
    setShowIntro(false); setShowContent(true); setShowFinal(false);
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  };

  const isWordSolved = (placement: Placement, currentInputs = inputs) => {
    const coords = WORD_COORDS[placement.number];
    if (!coords) return false;
    return coords.every((coord, index) => (currentInputs[keyCell(coord.row, coord.col)] || "") === normalizeWord(placement.word)[index]);
  };

  const checkSolvedWords = (currentInputs: Record<string, string>) => {
    const newlySolved: number[] = [];
    for (const p of PLACEMENTS) {
      if (!solvedWords[p.number] && isWordSolved(p, currentInputs)) newlySolved.push(p.number);
    }
    if (newlySolved.length > 0) {
      setSolvedWords(prev => { const n = { ...prev }; newlySolved.forEach(num => { n[num] = true; }); return n; });
      const first = PLACEMENTS.find(p => p.number === newlySolved[0]);
      if (first) { Keyboard.dismiss(); setActiveWordNumber(null); showConceptPopup(first.word, first.clue); setLastHint(`¡Encontraste ${first.word}!`); }
    }
  };

  const getNextAvailableCoordInWord = (wordNumber: number, row: number, col: number, currentInputs: Record<string, string>): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;
    const idx = coords.findIndex(c => c.row === row && c.col === col);
    if (idx === -1) return null;
    for (let i = idx + 1; i < coords.length; i++) { if (!(currentInputs[keyCell(coords[i].row, coords[i].col)] || "").trim()) return coords[i]; }
    for (let i = 0; i < idx; i++)                  { if (!(currentInputs[keyCell(coords[i].row, coords[i].col)] || "").trim()) return coords[i]; }
    return null;
  };

  const getPrevCoordInWord = (wordNumber: number, row: number, col: number): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;
    const idx = coords.findIndex(c => c.row === row && c.col === col);
    if (idx <= 0) return null;
    return coords[idx - 1];
  };

  const focusCell = (row: number, col: number) => { inputRefs.current[keyCell(row, col)]?.focus(); };

  const handleSelectCell = (r: number, c: number) => {
    const linked = CELL_TO_PLACEMENTS[keyCell(r, c)] || [];
    if (linked.length === 0) return;
    if (linked.length === 1) { setActiveWordNumber(linked[0]); return; }
    if (!activeWordNumber || !linked.includes(activeWordNumber)) { setActiveWordNumber(linked[0]); return; }
    setActiveWordNumber(linked[(linked.indexOf(activeWordNumber) + 1) % linked.length]);
  };

  const handleChangeCell = (r: number, c: number, value: string) => {
    const normalized = normalizeWord(value).slice(-1);
    const cellKey    = keyCell(r, c);
    const nextInputs = { ...inputs, [cellKey]: normalized };
    setInputs(nextInputs);
    if (normalized) {
      let wordToUse = activeWordNumber;
      if (!wordToUse) { const linked = CELL_TO_PLACEMENTS[cellKey] || []; wordToUse = linked[0] ?? null; if (wordToUse) setActiveWordNumber(wordToUse); }
      if (wordToUse) {
        const nextCoord = getNextAvailableCoordInWord(wordToUse, r, c, nextInputs);
        if (nextCoord) setTimeout(() => focusCell(nextCoord.row, nextCoord.col), 40);
        else { setActiveWordNumber(null); Keyboard.dismiss(); }
      }
    }
    checkSolvedWords(nextInputs);
  };

  const handleKeyPress = (r: number, c: number, key: string) => {
    if (key !== "Backspace") return;
    const cellKey    = keyCell(r, c);
    const currentVal = inputs[cellKey] || "";
    let wordToUse    = activeWordNumber;
    if (!wordToUse) { const linked = CELL_TO_PLACEMENTS[cellKey] || []; wordToUse = linked[0] ?? null; }
    if (!wordToUse) return;
    if (currentVal === "") {
      const prevCoord = getPrevCoordInWord(wordToUse, r, c);
      if (prevCoord) {
        const nextInputs = { ...inputs, [keyCell(prevCoord.row, prevCoord.col)]: "" };
        setInputs(nextInputs); setTimeout(() => focusCell(prevCoord.row, prevCoord.col), 40); checkSolvedWords(nextInputs);
      }
    } else {
      const prevCoord = getPrevCoordInWord(wordToUse, r, c);
      if (prevCoord) setTimeout(() => focusCell(prevCoord.row, prevCoord.col), 40);
    }
  };

  const solvedCount = useMemo(() => PLACEMENTS.filter(p => isWordSolved(p)).length, [inputs, solvedWords]);

  const getCellSolvedWordNumbers = (r: number, c: number) => (CELL_TO_PLACEMENTS[keyCell(r, c)] || []).filter(num => solvedWords[num]);

  const isCellCorrect = (r: number, c: number) => {
    const cell = CROSSWORD_GRID[r][c];
    if (cell.isBlock || !cell.solution) return false;
    return (inputs[keyCell(r, c)] || "") === cell.solution;
  };

  const validarCrucigrama = () => {
    setChecked(true);
    const totalCells   = CROSSWORD_GRID.flat().filter(c => !c.isBlock).length;
    const correctCells = CROSSWORD_GRID.flat().reduce((acc, cell, index) => {
      if (cell.isBlock) return acc;
      return acc + (isCellCorrect(Math.floor(index / COLS), index % COLS) ? 1 : 0);
    }, 0);
    if (correctCells === totalCells) setTimeout(() => setShowFinal(true), 500);
    else Alert.alert("Sigue intentando", `Llevas ${solvedCount}/${PLACEMENTS.length} palabras completas.`);
  };

  const handleHint = () => {
    if (hintsLeft <= 0) { setLastHint("Ya no te quedan pistas."); return; }
    const pendingWords = PLACEMENTS.filter(p => !isWordSolved(p));
    if (pendingWords.length === 0) { setLastHint("Ya resolviste todo el crucigrama."); return; }
    const randomWord       = pendingWords[Math.floor(Math.random() * pendingWords.length)];
    const coords           = WORD_COORDS[randomWord.number];
    const normalized       = normalizeWord(randomWord.word);
    const firstEmptyIndex  = coords.findIndex((coord, idx) => (inputs[keyCell(coord.row, coord.col)] || "") !== normalized[idx]);
    if (firstEmptyIndex === -1) { setLastHint(`La palabra ${randomWord.number} ya está lista.`); return; }
    const targetCoord  = coords[firstEmptyIndex];
    const nextInputs   = { ...inputs, [keyCell(targetCoord.row, targetCoord.col)]: normalized[firstEmptyIndex] };
    setInputs(nextInputs); setActiveWordNumber(randomWord.number); setHintsLeft(prev => prev - 1);
    setLastHint(`Pista: se reveló una letra de la palabra ${randomWord.number} (${randomWord.direction === "across" ? "horizontal" : "vertical"}).`);
    checkSolvedWords(nextInputs);
  };

  const resetGame = () => {
    setInputs({}); setChecked(false); setHintsLeft(MAX_HINTS); setLastHint(null);
    setShowFinal(false); setActiveWordNumber(null); setSolvedWords({}); setShowConcept(false); setConceptData(null);
    Keyboard.dismiss();
  };

  const resetAll = () => { resetGame(); setShowIntro(true); setShowContent(false); };

  if (!loaded) return <View style={st.cargando}><Text>Cargando fuentes...</Text></View>;

  return (
    <ImageBackground source={fondo} style={st.bg} resizeMode="cover">
      <View style={st.overlay}>

        {/* ── INTRO ── */}
        {showIntro && (
          <View style={st.header}>
            <View style={st.introBox}>
              <Text style={st.tituloIntro}>Nivel Recordemos – Metrología</Text>
              <Text style={st.descripcionIntro}>
                En este nivel recordarás los conceptos clave de los instrumentos de medición de AGP.{"\n\n"}
                Completa el crucigrama usando las definiciones del panel lateral.{"\n\n"}
                Encontrarás palabras relacionadas con instrumentos, dimensiones y el sistema de control de medición en planta.{"\n\n"}
                Usa tu memoria y tus pistas 💡 para completar todos los términos.
              </Text>
              <TouchableOpacity style={st.playButton} onPress={startGame}>
                <Text style={st.playButtonText}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── JUEGO ── */}
        {showContent && !showFinal && (
          <Animated.View style={[st.contentWrap, { opacity: contentOpacity }]}>
            <View style={st.boardAndPanel}>
              <View style={st.crucigramaContainer}>
                {CROSSWORD_GRID.map((row, r) => (
                  <View key={r} style={st.fila}>
                    {row.map((cell, c) => {
                      const cellKey           = keyCell(r, c);
                      const val               = inputs[cellKey] || "";
                      if (cell.isBlock) return <View key={c} style={[st.blockCell, { width: CELL, height: CELL }]} />;
                      const solvedBorder = getCellSolvedWordNumbers(r, c).length > 0;
                      const activeCell   = activeWordNumber != null && (CELL_TO_PLACEMENTS[cellKey] || []).includes(activeWordNumber);
                      const correct      = checked && isCellCorrect(r, c) && !solvedBorder;
                      const wrong        = checked && !!val && !isCellCorrect(r, c);
                      return (
                        <TouchableOpacity key={c} activeOpacity={1} onPress={() => { handleSelectCell(r, c); focusCell(r, c); }}>
                          <View style={[st.cellWrapper, {
                            width: CELL, height: CELL,
                            backgroundColor: solvedBorder ? "#DCFCE7" : correct ? "#DCFCE7" : wrong ? "#FEE2E2" : activeCell ? "#EFF6FF" : "#FFFFFF",
                            borderColor:     solvedBorder ? "#16A34A" : correct ? "#16A34A" : wrong ? "#DC2626" : activeCell ? "#2563EB" : "#0F1B4C",
                            borderWidth:     solvedBorder ? 2.5 : 1.5,
                          }]}>
                            {cell.number ? <Text style={st.cellNumber}>{cell.number}</Text> : null}
                            <TextInput
                              ref={ref => { inputRefs.current[cellKey] = ref; }}
                              value={val}
                              onChangeText={text => handleChangeCell(r, c, text)}
                              onKeyPress={({ nativeEvent }) => handleKeyPress(r, c, nativeEvent.key)}
                              maxLength={1}
                              style={st.cellInput}
                              textAlign="center"
                              autoCapitalize="characters"
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

              <View style={st.panel}>
                <Text style={st.panelTitle}>Pistas</Text>
                <Text style={st.subTitle}>Horizontales</Text>
                {acrossClues.map(item => {
                  const ok = isWordSolved(item);
                  return (
                    <View key={`a-${item.number}`} style={st.clueRow}>
                      <Text style={st.clueNumber}>{item.number}.</Text>
                      <Text style={st.clueText}>{item.clue}</Text>
                      <Text style={[st.clueStatus, ok && st.clueStatusOk]}>{ok ? item.word : "—"}</Text>
                    </View>
                  );
                })}
                <Text style={[st.subTitle, { marginTop: 14 }]}>Verticales</Text>
                {downClues.map(item => {
                  const ok = isWordSolved(item);
                  return (
                    <View key={`d-${item.number}`} style={st.clueRow}>
                      <Text style={st.clueNumber}>{item.number}.</Text>
                      <Text style={st.clueText}>{item.clue}</Text>
                      <Text style={[st.clueStatus, ok && st.clueStatusOk]}>{ok ? item.word : "—"}</Text>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={st.bottomBar}>
              <View style={st.hintInline}>
                <TouchableOpacity style={[st.hintButton, hintsLeft <= 0 && { opacity: 0.4 }]} onPress={handleHint} disabled={hintsLeft <= 0}>
                  <Text style={st.hintIcon}>💡</Text>
                </TouchableOpacity>
                <Text style={st.hintCounter}>x{hintsLeft}</Text>
              </View>
              <View style={st.progressBox}>
                <Text style={st.progressText}>Completadas: {solvedCount}/{PLACEMENTS.length}</Text>
              </View>
              <View style={st.buttonRow}>
                <TouchableOpacity style={[st.btn, st.btnGhost]} onPress={() => router.push(RUTA_VOLVER as any)}>
                  <Text style={[st.btnText, st.btnGhostText]}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btn, { backgroundColor: "#4C92E4" }]} onPress={resetGame}>
                  <Text style={st.btnText}>Reiniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[st.btn, { backgroundColor: "#0F1B4C" }]} onPress={validarCrucigrama}>
                  <Text style={st.btnText}>Validar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lastHint && <Text style={st.hintMessage}>{lastHint}</Text>}

            {showConcept && conceptData && (
              <View style={st.conceptOverlayContainer}>
                <Animated.View style={[st.conceptBox, { opacity: conceptAnim, transform: [{ scale: conceptScale }] }]}>
                  <Text style={st.conceptWord}>{conceptData.palabra}</Text>
                  <Text style={st.conceptDesc}>{conceptData.concepto}</Text>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ── FINAL ── */}
        {showFinal && (
          <View style={st.finalOverlay}>
            <View style={st.finalBox}>
              <Text style={st.finalTitle}>¡Nivel completado! 🎉</Text>
              <Text style={st.finalText}>Completaste correctamente el crucigrama de Metrología.</Text>
              <TouchableOpacity
                style={st.playButton}
                onPress={async () => {
                  try {
                    const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
                    const uk    = ukStr ? Number(ukStr) : null;
                    if (uk) {
                      await fetch(`${API_URL}/api/niveles/recordemos/${NIVEL_KEY}/resultado`, {
                        method: "POST", headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ usuarioKey: uk, puntaje: FIXED_SCORE, aprobado: true, islaKey: ISLA_KEY, nivelKey: NIVEL_KEY }),
                      });
                      await AsyncStorage.multiSet([
                        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_recordemos_done`,  "true"],
                        [`u:${uk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_recordemos_score`, String(FIXED_SCORE)],
                        [`u:${uk}:isla${ISLA_KEY}_nivel39_social_unlocked`,            "true"],
                      ]);
                    }
                  } catch (e) { console.error("Error guardando recordemos metrologia:", e); }
                  router.push(RUTA_VOLVER as any);
                }}
              >
                <Text style={st.playButtonText}>Continuar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.playButton, { backgroundColor: "#10B981", marginTop: 14 }]} onPress={resetAll}>
                <Text style={st.playButtonText}>Jugar otra vez</Text>
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
const st = StyleSheet.create({
  cargando:     { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" },
  bg:           { flex: 1, width: "100%", height: "100%" },
  overlay:      { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "rgba(255,255,255,0.78)" },
  header:       { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143,197,207,0.8)", paddingVertical: 40, paddingHorizontal: 40,
    borderRadius: 25, alignItems: "center", maxWidth: "90%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  tituloIntro:      { fontFamily: "PlusJakartaSans-Bold",    fontSize: 50, color: "#fff", textAlign: "center", marginBottom: 16 },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 33 },
  playButton:       { marginTop: 40, backgroundColor: "#4C92E4", paddingVertical: 10, paddingHorizontal: 50, borderRadius: 16 },
  playButtonText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 40 },
  contentWrap:      { width: "100%", alignItems: "center" },
  boardAndPanel:    { width: "100%", maxWidth: 1200, flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 18, paddingHorizontal: 6 },
  crucigramaContainer: { borderWidth: 3, borderColor: "#0F1B4C", borderRadius: 12, padding: 10, backgroundColor: "rgba(255,255,255,0.94)", marginTop: 10 },
  fila:        { flexDirection: "row" },
  blockCell:   { margin: 1, backgroundColor: "transparent" },
  cellWrapper: { margin: 1, borderRadius: 6, position: "relative", alignItems: "center", justifyContent: "center" },
  cellNumber:  { position: "absolute", top: 1, left: 3, fontSize: 9, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", zIndex: 5 },
  cellInput:   { width: "100%", height: "100%", textAlign: "center", fontSize: 18, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold" },
  panel:       { flex: 1, minWidth: 470, maxWidth: 560, backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 18, padding: 20, borderWidth: 2.5, borderColor: "#E5EAF5", marginTop: 10 },
  panelTitle:  { fontSize: 20, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", marginBottom: 10, textAlign: "center" },
  subTitle:    { fontSize: 16, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", marginBottom: 8 },
  clueRow:     { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  clueNumber:  { width: 22, fontSize: 15, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold" },
  clueText:    { flex: 1, fontSize: 15, color: "#1f2937", fontFamily: "PlusJakartaSans-Regular", marginRight: 8 },
  clueStatus:  { fontSize: 15, fontFamily: "PlusJakartaSans-Bold", color: "#9AA3B2" },
  clueStatusOk:{ color: "#16A34A" },
  bottomBar:   { width: "100%", maxWidth: 1100, marginTop: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hintInline:  { flexDirection: "row", alignItems: "center" },
  hintButton:  { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: "#FACC15", backgroundColor: "rgba(250,204,21,0.2)", alignItems: "center", justifyContent: "center", marginRight: 6 },
  hintIcon:    { fontSize: 22 },
  hintCounter: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#0F1B4C" },
  progressBox: { backgroundColor: "rgba(255,255,255,0.95)", borderRadius: 14, paddingVertical: 10, paddingHorizontal: 18, borderWidth: 2, borderColor: "#E5EAF5" },
  progressText:{ fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#0F1B4C" },
  buttonRow:   { flexDirection: "row", alignItems: "center" },
  btn:         { backgroundColor: "#0F1B4C", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginLeft: 10 },
  btnText:     { color: "white", fontFamily: "PlusJakartaSans-Bold", fontSize: 15 },
  btnGhost:    { backgroundColor: "transparent", borderWidth: 2, borderColor: "#0F1B4C" },
  btnGhostText:{ color: "#0F1B4C" },
  hintMessage: { marginTop: 10, fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: "#0F1B4C", textAlign: "center", maxWidth: "80%" },
  conceptOverlayContainer: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  conceptBox:  { backgroundColor: "rgba(15,27,76,0.95)", paddingVertical: 20, paddingHorizontal: 26, borderRadius: 18, maxWidth: "75%", borderWidth: 2, borderColor: "#4C92E4" },
  conceptWord: { fontFamily: "PlusJakartaSans-Bold",    fontSize: 22, color: "#fff", textAlign: "center", marginBottom: 8 },
  conceptDesc: { fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: "#E5E7EB", textAlign: "center", lineHeight: 22 },
  finalOverlay:{ position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  finalBox:    { backgroundColor: "rgba(143,197,207,0.95)", paddingVertical: 30, paddingHorizontal: 40, borderRadius: 24, alignItems: "center", maxWidth: "100%" },
  finalTitle:  { fontSize: 60, fontFamily: "PlusJakartaSans-Bold", color: "#fff", marginBottom: 10, textAlign: "center" },
  finalText:   { fontSize: 35, textAlign: "center", marginBottom: 18 },
});