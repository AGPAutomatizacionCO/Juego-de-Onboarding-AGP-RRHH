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
import { API_BASE_URL } from "./config";

/* =========================
   ✅ CONFIG
   ========================= */
const fondo = require("../assets/islas/fondogeneral.png");
const RUTA_VOLVER = "/Conceptos"; // ← ruta de la isla Conceptos Generales
const API_URL = API_BASE_URL;
const NIVEL_KEY_API = 18;   // nivel 3 = Recordemos dentro de la isla 4
const ISLA_KEY_STORAGE = 4; // isla 4 = Conceptos Generales
const MAX_HINTS = 4;
const FIXED_SCORE = 100;

/*
  ═══════════════════════════════════════════════════
  LAYOUT VERIFICADO — 0 CONFLICTOS — 5 CRUCES
  ═══════════════════════════════════════════════════

  Grid: 14 filas × 13 columnas

       0  1  2  3  4  5  6  7  8  9  10 11 12
  r0:  .  S  .  .  .  .  .  .  .  .  .  .  .
  r1:  M  E  C  A  N  I  Z  A  D  O  .  .  .   ← 1.MECANIZADO →
  r2:  .  R  .  .  .  .  U  .  .  .  .  .  .
  r3:  .  I  .  .  .  .  N  .  .  .  .  .  .
  r4:  .  G  .  .  .  .  D  .  .  .  .  .  .
  r5:  .  R  .  .  .  .  .  .  .  .  .  .  .
  r6:  .  A  .  .  .  .  .  E  .  .  .  .  .
  r7:  .  F  .  .  .  .  .  N  .  .  .  .  .
  r8:  .  I  .  .  .  .  .  S  .  .  .  .  .
  r9:  .  A  U  T  O  C  L  A  V  E  .  .  .   ← 4.AUTOCLAVE →
  r10: .  .  .  .  .  .  E  M  P  A  L  M  E   ← 6.EMPALME →
  r11: .  .  .  .  .  .  .  B  .  .  .  .  .
  r12: .  .  .  .  .  .  .  L  .  .  .  .  .
  r13: .  .  .  .  .  .  .  E  .  .  .  .  .

  PALABRAS:
    1. MECANIZADO  horizontal  r1  c0
    2. SERIGRAFIA  vertical    r0  c1
    3. ZUND        vertical    r1  c6
    4. AUTOCLAVE   horizontal  r9  c1
    5. ENSAMBLE    vertical    r6  c7
    6. EMPALME     horizontal  r10 c6

  CRUCES (letra compartida en misma celda):
    r1 c1  → MECANIZADO[1]=E  ↔  SERIGRAFIA[1]=E  ✓
    r1 c6  → MECANIZADO[6]=Z  ↔  ZUND[0]=Z         ✓
    r9 c1  → SERIGRAFIA[9]=A  ↔  AUTOCLAVE[0]=A    ✓
    r9 c7  → AUTOCLAVE[6]=A   ↔  ENSAMBLE[3]=A     ✓
    r10 c7 → ENSAMBLE[4]=M    ↔  EMPALME[1]=M      ✓

  GRAFO DE CONECTIVIDAD (todas unidas):
    MECANIZADO ─ SERIGRAFIA ─ AUTOCLAVE ─ ENSAMBLE ─ EMPALME
    MECANIZADO ─ ZUND
*/

const ROWS = 14;
const COLS = 13;
const CELL = 50;

/* =========================
   ✅ TIPOS
   ========================= */
type Direction = "across" | "down";

type Placement = {
  number: number;
  word: string;
  clue: string;
  direction: Direction;
  row: number;
  col: number;
};

type CellData = {
  isBlock: boolean;
  solution?: string;
  number?: number;
};

type Coord = { row: number; col: number };

/* =========================
   ✅ PALABRAS Y PISTAS
   ========================= */
const PLACEMENTS: Placement[] = [
  {
    number: 1,
    word: "MECANIZADO",
    clue: "Proceso donde se realiza matado de filo, perforaciones, cantos y chaflanes.",
    direction: "across",
    row: 1,
    col: 0,
  },
  {
    number: 2,
    word: "SERIGRAFIA",
    clue: "Proceso en el que se estampan logos, bandas negras y degradé.",
    direction: "down",
    row: 0,
    col: 1,
  },
  {
    number: 3,
    word: "ZUND",
    clue: "Proceso en el que se cortan diferentes plásticos, como polivinil y poliuretano.",
    direction: "down",
    row: 1,
    col: 6,
  },
  {
    number: 4,
    word: "AUTOCLAVE",
    clue: "Proceso en el que, mediante presión y temperatura, se compactan los materiales para formar un solo conjunto.",
    direction: "across",
    row: 9,
    col: 1,
  },
  {
    number: 5,
    word: "ENSAMBLE",
    clue: "Proceso donde se inspeccionan y se unen los vidrios y plásticos para formar el conjunto final.",
    direction: "down",
    row: 6,
    col: 7,
  },
  {
    number: 6,
    word: "EMPALME",
    clue: "Proceso donde se aplica talco de bebé para evitar que los vidrios y la pintura se adhieran entre sí.",
    direction: "across",
    row: 10,
    col: 6,
  },
];

/* =========================
   ✅ HELPERS
   ========================= */
const normalizeWord = (s: string): string =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/Ñ/g, "N")
    .toUpperCase();

function buildCrossword() {
  const grid: CellData[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ({ isBlock: true }))
  );
  const wordCoords: Record<number, Coord[]> = {};
  const cellToPlacements: Record<string, number[]> = {};

  for (const item of PLACEMENTS) {
    const normalized = normalizeWord(item.word);
    const coords: Coord[] = [];

    for (let i = 0; i < normalized.length; i++) {
      const r = item.direction === "across" ? item.row : item.row + i;
      const c = item.direction === "across" ? item.col + i : item.col;
      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;

      const existing = grid[r][c];
      const letter = normalized[i];

      grid[r][c] = existing.isBlock
        ? { isBlock: false, solution: letter }
        : { ...existing, isBlock: false, solution: letter };

      coords.push({ row: r, col: c });

      const key = `${r}-${c}`;
      if (!cellToPlacements[key]) cellToPlacements[key] = [];
      cellToPlacements[key].push(item.number);
    }

    const start = grid[item.row][item.col];
    grid[item.row][item.col] = { ...start, number: item.number };
    wordCoords[item.number] = coords;
  }

  return { grid, wordCoords, cellToPlacements };
}

const {
  grid: CROSSWORD_GRID,
  wordCoords: WORD_COORDS,
  cellToPlacements: CELL_TO_PLACEMENTS,
} = buildCrossword();

const acrossClues = PLACEMENTS.filter((p) => p.direction === "across");
const downClues = PLACEMENTS.filter((p) => p.direction === "down");

/* =========================
   ✅ COMPONENTE PRINCIPAL
   ========================= */
export default function NivelRecordemosConcepto() {
  const router = useRouter();

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular": require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold": require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const [showIntro, setShowIntro] = useState(true);
  const [showContent, setShowContent] = useState(false);
  const [showFinal, setShowFinal] = useState(false);

  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [hintsLeft, setHintsLeft] = useState(MAX_HINTS);
  const [lastHint, setLastHint] = useState<string | null>(null);
  const [activeWordNumber, setActiveWordNumber] = useState<number | null>(null);
  const [solvedWords, setSolvedWords] = useState<Record<number, boolean>>({});

  const [conceptData, setConceptData] = useState<{ palabra: string; concepto: string } | null>(null);
  const [showConcept, setShowConcept] = useState(false);
  const conceptAnim = useRef(new Animated.Value(0)).current;
  const inputRefs = useRef<Record<string, TextInput | null>>({});
  const contentOpacity = useRef(new Animated.Value(0)).current;

  const keyCell = (r: number, c: number) => `${r}-${c}`;

  const showConceptPopup = (palabra: string, concepto: string) => {
    setConceptData({ palabra, concepto });
    setShowConcept(true);
    conceptAnim.setValue(0);
    Animated.timing(conceptAnim, { toValue: 1, duration: 220, useNativeDriver: true }).start(() => {
      setTimeout(() => {
        Animated.timing(conceptAnim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => {
          setShowConcept(false);
          setConceptData(null);
        });
      }, 2200);
    });
  };

  const conceptScale = conceptAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] });

  const startGame = () => {
    setShowIntro(false);
    setShowContent(true);
    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  };

  const isWordSolved = (placement: Placement, currentInputs = inputs) => {
    const coords = WORD_COORDS[placement.number];
    if (!coords) return false;
    return coords.every((coord, index) => {
      const val = currentInputs[keyCell(coord.row, coord.col)] || "";
      return val === normalizeWord(placement.word)[index];
    });
  };

  const checkSolvedWords = (currentInputs: Record<string, string>) => {
    const newlySolved: number[] = [];
    for (const p of PLACEMENTS) {
      if (!solvedWords[p.number] && isWordSolved(p, currentInputs)) newlySolved.push(p.number);
    }
    if (newlySolved.length > 0) {
      setSolvedWords((prev) => {
        const next = { ...prev };
        for (const num of newlySolved) next[num] = true;
        return next;
      });
      const first = PLACEMENTS.find((p) => p.number === newlySolved[0]);
      if (first) {
        Keyboard.dismiss();
        setActiveWordNumber(null);
        showConceptPopup(first.word, first.clue);
        setLastHint(`¡Encontraste "${first.word}"!`);
      }
    }
  };

  const getNextCoord = (wordNumber: number, row: number, col: number, currentInputs: Record<string, string>): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;
    const idx = coords.findIndex((c) => c.row === row && c.col === col);
    if (idx === -1) return null;
    for (let i = idx + 1; i < coords.length; i++) {
      if (!(currentInputs[keyCell(coords[i].row, coords[i].col)] || "").trim()) return coords[i];
    }
    for (let i = 0; i < idx; i++) {
      if (!(currentInputs[keyCell(coords[i].row, coords[i].col)] || "").trim()) return coords[i];
    }
    return null;
  };

  const getPrevCoord = (wordNumber: number, row: number, col: number): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;
    const idx = coords.findIndex((c) => c.row === row && c.col === col);
    return idx <= 0 ? null : coords[idx - 1];
  };

  const focusCell = (row: number, col: number) => {
    inputRefs.current[keyCell(row, col)]?.focus();
  };

  const handleSelectCell = (r: number, c: number) => {
    const linked = CELL_TO_PLACEMENTS[keyCell(r, c)] || [];
    if (linked.length === 0) return;
    if (linked.length === 1 || !activeWordNumber || !linked.includes(activeWordNumber)) {
      setActiveWordNumber(linked[0]);
      return;
    }
    setActiveWordNumber(linked[(linked.indexOf(activeWordNumber) + 1) % linked.length]);
  };

  const handleChangeCell = (r: number, c: number, value: string) => {
    const normalized = normalizeWord(value).slice(-1);
    const cellKey = keyCell(r, c);
    const nextInputs = { ...inputs, [cellKey]: normalized };
    setInputs(nextInputs);

    if (normalized) {
      let wordToUse = activeWordNumber;
      if (!wordToUse) {
        const linked = CELL_TO_PLACEMENTS[cellKey] || [];
        wordToUse = linked[0] ?? null;
        if (wordToUse) setActiveWordNumber(wordToUse);
      }
      if (wordToUse) {
        const next = getNextCoord(wordToUse, r, c, nextInputs);
        if (next) setTimeout(() => focusCell(next.row, next.col), 40);
        else { setActiveWordNumber(null); Keyboard.dismiss(); }
      }
    }
    checkSolvedWords(nextInputs);
  };

  const handleKeyPress = (r: number, c: number, key: string) => {
    if (key !== "Backspace") return;
    const cellKey = keyCell(r, c);
    const currentVal = inputs[cellKey] || "";
    const wordToUse = activeWordNumber ?? (CELL_TO_PLACEMENTS[cellKey] || [])[0] ?? null;
    if (!wordToUse) return;

    if (currentVal === "") {
      const prev = getPrevCoord(wordToUse, r, c);
      if (prev) {
        const prevKey = keyCell(prev.row, prev.col);
        const nextInputs = { ...inputs, [prevKey]: "" };
        setInputs(nextInputs);
        setTimeout(() => focusCell(prev.row, prev.col), 40);
        checkSolvedWords(nextInputs);
      }
    } else {
      const prev = getPrevCoord(wordToUse, r, c);
      if (prev) setTimeout(() => focusCell(prev.row, prev.col), 40);
    }
  };

  const solvedCount = useMemo(
    () => PLACEMENTS.filter((p) => isWordSolved(p)).length,
    [inputs, solvedWords]
  );

  const isCellCorrect = (r: number, c: number) => {
    const cell = CROSSWORD_GRID[r][c];
    if (cell.isBlock || !cell.solution) return false;
    return (inputs[keyCell(r, c)] || "") === cell.solution;
  };

  const getCellSolvedWords = (r: number, c: number) =>
    (CELL_TO_PLACEMENTS[keyCell(r, c)] || []).filter((num) => solvedWords[num]);

  const validarCrucigrama = () => {
    setChecked(true);
    const allCells = CROSSWORD_GRID.flat();
    const total = allCells.filter((c) => !c.isBlock).length;
    const correct = allCells.reduce((acc, cell, idx) => {
      if (cell.isBlock) return acc;
      const r = Math.floor(idx / COLS);
      const c = idx % COLS;
      return acc + (isCellCorrect(r, c) ? 1 : 0);
    }, 0);
    if (correct === total) setTimeout(() => setShowFinal(true), 500);
    else Alert.alert("Sigue intentando", `Llevas ${solvedCount}/${PLACEMENTS.length} palabras completas.`);
  };

  const handleHint = () => {
    if (hintsLeft <= 0) { setLastHint("Ya no te quedan pistas."); return; }
    const pending = PLACEMENTS.filter((p) => !isWordSolved(p));
    if (pending.length === 0) { setLastHint("Ya resolviste todo el crucigrama."); return; }

    const target = pending[Math.floor(Math.random() * pending.length)];
    const coords = WORD_COORDS[target.number];
    const normalized = normalizeWord(target.word);
    const emptyIdx = coords.findIndex((coord, idx) => (inputs[keyCell(coord.row, coord.col)] || "") !== normalized[idx]);
    if (emptyIdx === -1) { setLastHint(`La palabra ${target.number} ya está lista.`); return; }

    const coord = coords[emptyIdx];
    const nextInputs = { ...inputs, [keyCell(coord.row, coord.col)]: normalized[emptyIdx] };
    setInputs(nextInputs);
    setActiveWordNumber(target.number);
    setHintsLeft((prev) => prev - 1);
    setLastHint(`Pista: letra revelada en la palabra ${target.number} (${target.direction === "across" ? "horizontal" : "vertical"}).`);
    checkSolvedWords(nextInputs);
  };

  const resetGame = () => {
    setInputs({}); setChecked(false); setHintsLeft(MAX_HINTS);
    setLastHint(null); setShowFinal(false); setActiveWordNumber(null);
    setSolvedWords({}); setShowConcept(false); setConceptData(null);
    Keyboard.dismiss();
  };

  const resetAll = () => { resetGame(); setShowIntro(true); setShowContent(false); };

  if (!loaded) return <View style={styles.cargando}><Text>Cargando...</Text></View>;

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>

        {/* ══════════════ INTRO ══════════════ */}
        {showIntro && (
          <View style={styles.header}>
            <View style={styles.introBox}>
              <Text style={styles.tituloIntro}>Nivel Recordemos{"\n"}Crucigrama Concepto</Text>
              <Text style={styles.descripcionIntro}>
                En este nivel recordarás los procesos de fabricación de la isla Concepto.{"\n\n"}
                Completa el crucigrama con las palabras:{"\n"}
                Mecanizado, Serigrafía, Zund, Autoclave, Ensamble y Empalme.{"\n\n"}
                Usa las pistas del panel y tus recuerdos para encontrar cada término.
              </Text>
              <TouchableOpacity style={styles.playButton} onPress={startGame}>
                <Text style={styles.playButtonText}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ══════════════ JUEGO ══════════════ */}
        {showContent && !showFinal && (
          <Animated.View
  style={[
    styles.contentWrap,
    {
      opacity: contentOpacity,
      transform: [{ scale: 0.9 }],
    },
  ]}
>
            <View style={styles.boardAndPanel}>

              {/* GRID DEL CRUCIGRAMA */}
              <View style={styles.crucigramaContainer}>
                {CROSSWORD_GRID.map((row, r) => (
                  <View key={r} style={styles.fila}>
                    {row.map((cell, c) => {
                      const cellKey = keyCell(r, c);
                      const val = inputs[cellKey] || "";

                      if (cell.isBlock) {
                        return <View key={c} style={[styles.blockCell, { width: CELL, height: CELL }]} />;
                      }

                      const solvedBorder = getCellSolvedWords(r, c).length > 0;
                      const activeCell =
                        activeWordNumber != null &&
                        (CELL_TO_PLACEMENTS[cellKey] || []).includes(activeWordNumber);
                      const correct = checked && isCellCorrect(r, c) && !solvedBorder;
                      const wrong = checked && !!val && !isCellCorrect(r, c);

                      return (
                        <TouchableOpacity
                          key={c}
                          activeOpacity={1}
                          onPress={() => { handleSelectCell(r, c); focusCell(r, c); }}
                        >
                          <View
                            style={[
                              styles.cellWrapper,
                              {
                                width: CELL,
                                height: CELL,
                                backgroundColor:
                                  solvedBorder ? "#DCFCE7"
                                  : correct     ? "#DCFCE7"
                                  : wrong       ? "#FEE2E2"
                                  : activeCell  ? "#EFF6FF"
                                  :               "#FFFFFF",
                                borderColor:
                                  solvedBorder ? "#16A34A"
                                  : correct     ? "#16A34A"
                                  : wrong       ? "#DC2626"
                                  : activeCell  ? "#2563EB"
                                  :               "#0F1B4C",
                                borderWidth: solvedBorder ? 2.5 : 1.5,
                              },
                            ]}
                          >
                            {cell.number ? <Text style={styles.cellNumber}>{cell.number}</Text> : null}
                            <TextInput
                              ref={(ref) => { inputRefs.current[cellKey] = ref; }}
                              value={val}
                              onChangeText={(text) => handleChangeCell(r, c, text)}
                              onKeyPress={({ nativeEvent }) => handleKeyPress(r, c, nativeEvent.key)}
                              maxLength={1}
                              style={styles.cellInput}
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

              {/* PANEL DE PISTAS */}
              <View style={styles.panel}>
                <Text style={styles.panelTitle}>Pistas</Text>

                <Text style={styles.subTitle}>Horizontales</Text>
                {acrossClues.map((item) => {
                  const ok = isWordSolved(item);
                  return (
                    <View key={`a-${item.number}`} style={styles.clueRow}>
                      <Text style={styles.clueNumber}>{item.number}.</Text>
                      <Text style={styles.clueText}>{item.clue}</Text>
                      <Text style={[styles.clueStatus, ok && styles.clueStatusOk]}>
                        {ok ? item.word : "—"}
                      </Text>
                    </View>
                  );
                })}

                <Text style={[styles.subTitle, { marginTop: 14 }]}>Verticales</Text>
                {downClues.map((item) => {
                  const ok = isWordSolved(item);
                  return (
                    <View key={`d-${item.number}`} style={styles.clueRow}>
                      <Text style={styles.clueNumber}>{item.number}.</Text>
                      <Text style={styles.clueText}>{item.clue}</Text>
                      <Text style={[styles.clueStatus, ok && styles.clueStatusOk]}>
                        {ok ? item.word : "—"}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {/* BARRA INFERIOR */}
            <View style={styles.bottomBar}>
              <View style={styles.hintInline}>
                <TouchableOpacity
                  style={[styles.hintButton, hintsLeft <= 0 && { opacity: 0.4 }]}
                  onPress={handleHint}
                  disabled={hintsLeft <= 0}
                >
                  <Text style={styles.hintIcon}>💡</Text>
                </TouchableOpacity>
                <Text style={styles.hintCounter}>x{hintsLeft}</Text>
              </View>

              <View style={styles.progressBox}>
                <Text style={styles.progressText}>Completadas: {solvedCount}/{PLACEMENTS.length}</Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => router.push(RUTA_VOLVER as any)}
                >
                  <Text style={[styles.btnText, styles.btnGhostText]}>Volver</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#4C92E4" }]} onPress={resetGame}>
                  <Text style={styles.btnText}>Reiniciar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, { backgroundColor: "#0F1B4C" }]} onPress={validarCrucigrama}>
                  <Text style={styles.btnText}>Validar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lastHint && <Text style={styles.hintMessage}>{lastHint}</Text>}

            {/* POPUP CONCEPTO AL RESOLVER */}
            {showConcept && conceptData && (
              <View style={styles.conceptOverlayContainer}>
                <Animated.View
                  style={[
                    styles.conceptBox,
                    { opacity: conceptAnim, transform: [{ scale: conceptScale }] },
                  ]}
                >
                  <Text style={styles.conceptWord}>{conceptData.palabra}</Text>
                  <Text style={styles.conceptDesc}>{conceptData.concepto}</Text>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        )}

        {/* ══════════════ PANTALLA FINAL ══════════════ */}
        {showFinal && (
          <View style={styles.finalOverlay}>
            <View style={styles.finalBox}>
              <Text style={styles.finalTitle}>¡Nivel completado! 🎉</Text>
              <Text style={styles.finalText}>
                Completaste el crucigrama de la isla Concepto.{"\n"}¡Excelente memoria!
              </Text>

              <TouchableOpacity
                style={styles.playButton}
                onPress={async () => {
                  try {
                    const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
                    const usuarioKey = ukStr ? Number(ukStr) : null;
                    if (usuarioKey) {
                      // ── Guardar en BD ──
                      await fetch(
                        `${API_URL}/api/niveles/recordemos/${NIVEL_KEY_API}/resultado`,
                        {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            usuarioKey,
                            puntaje: FIXED_SCORE,
                            aprobado: true,
                          }),
                        }
                      );

                      // ── Guardar en AsyncStorage con las claves exactas que lee la isla ──
                      // La isla ConceptosGenerales (isla4) lee:
                      //   u:{uk}:isla4_nivel3_recordemos_done
                      //   u:{uk}:isla4_nivel3_recordemos_score
                      // y el siguiente nivel (Social) se desbloquea con el progreso efectivo
                      // que se calcula automáticamente cuando recordemosDone === true.
                      await AsyncStorage.multiSet([
                        [
                          `u:${usuarioKey}:isla${ISLA_KEY_STORAGE}_nivel${NIVEL_KEY_API}_recordemos_done`,
                          "true",
                        ],
                        [
                          `u:${usuarioKey}:isla${ISLA_KEY_STORAGE}_nivel${NIVEL_KEY_API}_recordemos_score`,
                          String(FIXED_SCORE),
                        ],
                      ]);

                      console.log(
                        "✅ Recordemos Conceptos Generales guardado:",
                        `u:${usuarioKey}:isla${ISLA_KEY_STORAGE}_nivel${NIVEL_KEY_API}_recordemos_done = true`,
                        `| score = ${FIXED_SCORE}`
                      );
                    }
                  } catch (e) {
                    console.error("❌ Error guardando:", e);
                  }
                  router.push(RUTA_VOLVER as any);
                }}
              >
                <Text style={styles.playButtonText}>Continuar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.playButton, { backgroundColor: "#10B981", marginTop: 14 }]}
                onPress={resetAll}
              >
                <Text style={styles.playButtonText}>Jugar otra vez</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

      </View>
    </ImageBackground>
  );
}

/* =========================
   ✅ ESTILOS
   ========================= */
const styles = StyleSheet.create({
  cargando: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "white" },
  bg: { flex: 1, width: "100%", height: "100%" },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
  },

  /* ── INTRO ── */
  header: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  introBox: {
    backgroundColor: "rgba(143, 197, 207, 0.8)",
    paddingVertical: 40,
    paddingHorizontal: 40,
    borderRadius: 25,
    alignItems: "center",
    maxWidth: "90%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 4 },
  },
  tituloIntro: { fontFamily: "PlusJakartaSans-Bold", fontSize: 50, color: "#fff", textAlign: "center", marginBottom: 16 },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 33 },
  playButton: { marginTop: 40, backgroundColor: "#4C92E4", paddingVertical: 10, paddingHorizontal: 50, borderRadius: 16 },
  playButtonText: { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: 40 },

  /* ── JUEGO ── */
  contentWrap: { width: "100%", alignItems: "center" },
  boardAndPanel: {
    width: "100%",
    maxWidth: 1200,
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "center",
    gap: 18,
    paddingHorizontal: 6,
  },
  crucigramaContainer: {
    flex: 1,
    borderWidth: 3,
    borderColor: "#0F1B4C",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.94)",
    marginTop: 10,
  },
  fila: { flexDirection: "row" },
  blockCell: { margin: 1, backgroundColor: "transparent" },
  cellWrapper: { margin: 1, borderRadius: 6, position: "relative", alignItems: "center", justifyContent: "center" },
  cellNumber: { position: "absolute", top: 1, left: 3, fontSize: 9, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", zIndex: 5 },
  cellInput: { width: "100%", height: "100%", textAlign: "center", fontSize: 18, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold" },

  /* ── PANEL PISTAS ── */
  panel: {
  flex: 0.9,
  minWidth: 380,
  maxWidth: 460,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 2.5,
    borderColor: "#E5EAF5",
    marginTop: 10,
  },
  panelTitle: { fontSize: 20, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", marginBottom: 10, textAlign: "center" },
  subTitle: { fontSize: 16, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold", marginBottom: 8 },
  clueRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  clueNumber: { width: 22, fontSize: 15, color: "#0F1B4C", fontFamily: "PlusJakartaSans-Bold" },
  clueText: { flex: 1, fontSize: 15, color: "#1f2937", fontFamily: "PlusJakartaSans-Regular", marginRight: 8 },
  clueStatus: { fontSize: 15, fontFamily: "PlusJakartaSans-Bold", color: "#9AA3B2" },
  clueStatusOk: { color: "#16A34A" },

  /* ── BARRA INFERIOR ── */
  bottomBar: {
    width: "100%",
    maxWidth: 1100,
    marginTop: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hintInline: { flexDirection: "row", alignItems: "center" },
  hintButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FACC15",
    backgroundColor: "rgba(250,204,21,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  hintIcon: { fontSize: 22 },
  hintCounter: { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#0F1B4C" },
  progressBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "#E5EAF5",
  },
  progressText: { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, color: "#0F1B4C" },
  buttonRow: { flexDirection: "row", alignItems: "center" },
  btn: { backgroundColor: "#0F1B4C", paddingVertical: 10, paddingHorizontal: 20, borderRadius: 12, marginLeft: 10 },
  btnText: { color: "white", fontFamily: "PlusJakartaSans-Bold", fontSize: 15 },
  btnGhost: { backgroundColor: "transparent", borderWidth: 2, borderColor: "#0F1B4C" },
  btnGhostText: { color: "#0F1B4C" },
  hintMessage: { marginTop: 10, fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: "#0F1B4C", textAlign: "center", maxWidth: "80%" },

  /* ── POPUP CONCEPTO ── */
  conceptOverlayContainer: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  conceptBox: {
    backgroundColor: "rgba(15,27,76,0.95)",
    paddingVertical: 20,
    paddingHorizontal: 26,
    borderRadius: 18,
    maxWidth: "75%",
    borderWidth: 2,
    borderColor: "#4C92E4",
  },
  conceptWord: { fontFamily: "PlusJakartaSans-Bold", fontSize: 22, color: "#fff", textAlign: "center", marginBottom: 8 },
  conceptDesc: { fontFamily: "PlusJakartaSans-Regular", fontSize: 16, color: "#E5E7EB", textAlign: "center", lineHeight: 22 },

  /* ── FINAL ── */
  finalOverlay: { position: "absolute", top: 0, bottom: 0, left: 0, right: 0, alignItems: "center", justifyContent: "center" },
  finalBox: {
    backgroundColor: "rgba(143,197,207,0.95)",
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 24,
    alignItems: "center",
    maxWidth: "100%",
  },
  finalTitle: { fontSize: 60, fontFamily: "PlusJakartaSans-Bold", color: "#fff", marginBottom: 10, textAlign: "center" },
  finalText: { fontSize: 35, color: "#fff", fontFamily: "PlusJakartaSans-Regular", textAlign: "center", marginBottom: 18 },
});