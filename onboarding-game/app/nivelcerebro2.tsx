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

/* =========================
   ✅ CONFIG VISUAL
   ========================= */
const fondo = require("../assets/islas/fondogeneral.png");
const RUTA_VOLVER = "/HSE";
const API_URL = API_BASE_URL;
const NIVEL_KEY_API = 8; // Recordemos HSE en BD
const ISLA_KEY = 2;
const MAX_HINTS = 4;
const ROWS = 10;
const COLS = 11;
const CELL = 50;
const FIXED_SCORE = 100;

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

type Coord = {
  row: number;
  col: number;
};

/* =========================
   ✅ PALABRAS DEL CRUCIGRAMA
   3 HORIZONTALES + 3 VERTICALES
   ========================= */
const PLACEMENTS: Placement[] = [
  {
    number: 1,
    word: "RETROFIT",
    clue: "Línea de fabricación donde el blindaje se instala después de que el vehículo sale del concesionario.",
    direction: "down",
    row: 0,
    col: 9,
  },
  {
    number: 2,
    word: "DEFENSE",
    clue: "Línea de negocio de piezas planas enfocada soluciones militares y navales.",
    direction: "across",
    row: 1,
    col: 3,
  },
  {
    number: 3,
    word: "CALIDAD",
    clue: "Cumplimiento de los requisitos y estándares del producto.",
    direction: "down",
    row: 2,
    col: 5,
  },
  {
    number: 4,
    word: "SECURITY",
    clue: "Línea de negocio enfocada en la seguridad y protección de automóviles.",
    direction: "across",
    row: 5,
    col: 0,
  },
  {
    number: 5,
    word: "YIELD",
    clue: "Cantidad de materia prima que sí termina convertida en producto vendido al cliente.",
    direction: "across",
    row: 7,
    col: 0,
  },
  {
    number: 6,
    word: "OEM",
    clue: "Línea de fabricación donde el vehículo ya sale con el vidrio blindado incluido desde su producción.",
    direction: "down",
    row: 6,
    col: 2,
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

      if (existing.isBlock) {
        grid[r][c] = {
          isBlock: false,
          solution: letter,
        };
      } else {
        grid[r][c] = {
          ...existing,
          isBlock: false,
          solution: letter,
        };
      }

      coords.push({ row: r, col: c });

      const key = `${r}-${c}`;
      if (!cellToPlacements[key]) cellToPlacements[key] = [];
      cellToPlacements[key].push(item.number);
    }

    const startCell = grid[item.row][item.col];
    grid[item.row][item.col] = {
      ...startCell,
      isBlock: false,
      number: item.number,
      solution: startCell.solution,
    };

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
   ✅ COMPONENTE
   ========================= */
export default function NivelRecordemosCrucigramaAGP() {
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

    Animated.timing(conceptAnim, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        Animated.timing(conceptAnim, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          setShowConcept(false);
          setConceptData(null);
        });
      }, 1800);
    });
  };

  const conceptScale = conceptAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const startGame = () => {
    setShowIntro(false);
    setShowContent(true);
    setShowFinal(false);

    contentOpacity.setValue(0);
    Animated.timing(contentOpacity, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  };

  const isWordSolved = (placement: Placement, currentInputs = inputs) => {
    const coords = WORD_COORDS[placement.number];
    if (!coords) return false;

    return coords.every((coord, index) => {
      const val = currentInputs[keyCell(coord.row, coord.col)] || "";
      return val === normalizeWord(placement.word)[index];
    });
  };

  const isWordFullyFilled = (wordNumber: number, currentInputs = inputs) => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return false;

    return coords.every((coord) => {
      const val = currentInputs[keyCell(coord.row, coord.col)] || "";
      return val.trim() !== "";
    });
  };

  const checkSolvedWords = (currentInputs: Record<string, string>) => {
    const newlySolved: number[] = [];

    for (const placement of PLACEMENTS) {
      const alreadySolved = !!solvedWords[placement.number];
      const nowSolved = isWordSolved(placement, currentInputs);

      if (!alreadySolved && nowSolved) {
        newlySolved.push(placement.number);
      }
    }

    if (newlySolved.length > 0) {
      setSolvedWords((prev) => {
        const next = { ...prev };
        for (const num of newlySolved) next[num] = true;
        return next;
      });

      const firstSolved = PLACEMENTS.find((p) => p.number === newlySolved[0]);
      if (firstSolved) {
        Keyboard.dismiss();
        setActiveWordNumber(null);
        showConceptPopup(firstSolved.word, firstSolved.clue);
        setLastHint(`¡Encontraste ${firstSolved.word}!`);
      }
    }
  };

  const getNextAvailableCoordInWord = (
    wordNumber: number,
    row: number,
    col: number,
    currentInputs: Record<string, string>
  ): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;

    const idx = coords.findIndex((c) => c.row === row && c.col === col);
    if (idx === -1) return null;

    for (let i = idx + 1; i < coords.length; i++) {
      const val = currentInputs[keyCell(coords[i].row, coords[i].col)] || "";
      if (!val.trim()) return coords[i];
    }

    for (let i = 0; i < idx; i++) {
      const val = currentInputs[keyCell(coords[i].row, coords[i].col)] || "";
      if (!val.trim()) return coords[i];
    }

    return null;
  };

  // ✅ NUEVO: obtiene el cuadro anterior en la palabra activa
  const getPrevCoordInWord = (
    wordNumber: number,
    row: number,
    col: number
  ): Coord | null => {
    const coords = WORD_COORDS[wordNumber];
    if (!coords) return null;

    const idx = coords.findIndex((c) => c.row === row && c.col === col);
    if (idx <= 0) return null;

    return coords[idx - 1];
  };

  const focusCell = (row: number, col: number) => {
    const ref = inputRefs.current[keyCell(row, col)];
    ref?.focus();
  };

  const handleSelectCell = (r: number, c: number) => {
    const linked = CELL_TO_PLACEMENTS[keyCell(r, c)] || [];
    if (linked.length === 0) return;

    if (linked.length === 1) {
      setActiveWordNumber(linked[0]);
      return;
    }

    if (!activeWordNumber || !linked.includes(activeWordNumber)) {
      setActiveWordNumber(linked[0]);
      return;
    }

    const nextIndex = (linked.indexOf(activeWordNumber) + 1) % linked.length;
    setActiveWordNumber(linked[nextIndex]);
  };

  const handleChangeCell = (r: number, c: number, value: string) => {
    const normalized = normalizeWord(value).slice(-1);
    const cellKey = keyCell(r, c);

    const nextInputs = {
      ...inputs,
      [cellKey]: normalized,
    };

    setInputs(nextInputs);

    if (normalized) {
      let wordToUse = activeWordNumber;

      if (!wordToUse) {
        const linked = CELL_TO_PLACEMENTS[cellKey] || [];
        wordToUse = linked[0] ?? null;
        if (wordToUse) setActiveWordNumber(wordToUse);
      }

      if (wordToUse) {
        const nextCoord = getNextAvailableCoordInWord(wordToUse, r, c, nextInputs);

        if (nextCoord) {
          setTimeout(() => focusCell(nextCoord.row, nextCoord.col), 40);
        } else {
          setActiveWordNumber(null);
          Keyboard.dismiss();
        }
      }
    }

    checkSolvedWords(nextInputs);
  };

  // ✅ NUEVO: maneja la tecla Backspace para retroceder al cuadro anterior y borrarlo
  const handleKeyPress = (r: number, c: number, key: string) => {
    if (key !== "Backspace") return;

    const cellKey = keyCell(r, c);
    const currentVal = inputs[cellKey] || "";

    // Si la celda actual tiene letra, solo se borra (el TextInput lo hace solo),
    // pero también retrocedemos el foco al cuadro anterior.
    // Si la celda ya está vacía, retrocedemos Y borramos la celda anterior.

    let wordToUse = activeWordNumber;
    if (!wordToUse) {
      const linked = CELL_TO_PLACEMENTS[cellKey] || [];
      wordToUse = linked[0] ?? null;
    }

    if (!wordToUse) return;

    if (currentVal === "") {
      // Celda vacía: ir al anterior y borrarlo
      const prevCoord = getPrevCoordInWord(wordToUse, r, c);
      if (prevCoord) {
        const prevKey = keyCell(prevCoord.row, prevCoord.col);
        const nextInputs = { ...inputs, [prevKey]: "" };
        setInputs(nextInputs);
        setTimeout(() => focusCell(prevCoord.row, prevCoord.col), 40);
        checkSolvedWords(nextInputs);
      }
    } else {
      // Celda con letra: el TextInput la borra solo; solo movemos el foco atrás
      const prevCoord = getPrevCoordInWord(wordToUse, r, c);
      if (prevCoord) {
        setTimeout(() => focusCell(prevCoord.row, prevCoord.col), 40);
      }
    }
  };

  const solvedCount = useMemo(() => {
    return PLACEMENTS.filter((p) => isWordSolved(p)).length;
  }, [inputs, solvedWords]);

  const getCellSolvedWordNumbers = (r: number, c: number) => {
    const linked = CELL_TO_PLACEMENTS[keyCell(r, c)] || [];
    return linked.filter((num) => solvedWords[num]);
  };

  const isCellCorrect = (r: number, c: number) => {
    const cell = CROSSWORD_GRID[r][c];
    if (cell.isBlock || !cell.solution) return false;
    return (inputs[keyCell(r, c)] || "") === cell.solution;
  };

  const validarCrucigrama = () => {
    setChecked(true);

    const totalCells = CROSSWORD_GRID.flat().filter((c) => !c.isBlock).length;
    const correctCells = CROSSWORD_GRID.flat().reduce((acc, cell, index) => {
      if (cell.isBlock) return acc;
      const r = Math.floor(index / COLS);
      const c = index % COLS;
      return acc + (isCellCorrect(r, c) ? 1 : 0);
    }, 0);

    if (correctCells === totalCells) {
      setTimeout(() => {
        setShowFinal(true);
      }, 500);
    } else {
      Alert.alert(
        "Sigue intentando",
        `Llevas ${solvedCount}/${PLACEMENTS.length} conceptos completos.`
      );
    }
  };

  const handleHint = () => {
    if (hintsLeft <= 0) {
      setLastHint("Ya no te quedan pistas.");
      return;
    }

    const pendingWords = PLACEMENTS.filter((p) => !isWordSolved(p));
    if (pendingWords.length === 0) {
      setLastHint("Ya resolviste todo el crucigrama.");
      return;
    }

    const randomWord =
      pendingWords[Math.floor(Math.random() * pendingWords.length)];
    const coords = WORD_COORDS[randomWord.number];
    const normalized = normalizeWord(randomWord.word);

    const firstEmptyIndex = coords.findIndex((coord, idx) => {
      const val = inputs[keyCell(coord.row, coord.col)] || "";
      return val !== normalized[idx];
    });

    if (firstEmptyIndex === -1) {
      setLastHint(`La palabra ${randomWord.number} ya está lista.`);
      return;
    }

    const targetCoord = coords[firstEmptyIndex];
    const targetLetter = normalized[firstEmptyIndex];

    const nextInputs = {
      ...inputs,
      [keyCell(targetCoord.row, targetCoord.col)]: targetLetter,
    };

    setInputs(nextInputs);
    setActiveWordNumber(randomWord.number);
    setHintsLeft((prev) => prev - 1);
    setLastHint(
      `Pista: se reveló una letra de la palabra ${randomWord.number} (${randomWord.direction === "across" ? "horizontal" : "vertical"}).`
    );

    checkSolvedWords(nextInputs);
  };

  const resetGame = () => {
    setInputs({});
    setChecked(false);
    setHintsLeft(MAX_HINTS);
    setLastHint(null);
    setShowFinal(false);
    setActiveWordNumber(null);
    setSolvedWords({});
    setShowConcept(false);
    setConceptData(null);
    Keyboard.dismiss();
  };

  const resetAll = () => {
    resetGame();
    setShowIntro(true);
    setShowContent(false);
  };

  if (!loaded) {
    return (
      <View style={styles.cargando}>
        <Text>Cargando fuentes...</Text>
      </View>
    );
  }

  return (
    <ImageBackground source={fondo} style={styles.bg} resizeMode="cover">
      <View style={styles.overlay}>
        {showIntro && (
          <View style={styles.header}>
            <View style={styles.introBox}>
              <Text style={styles.tituloIntro}>Nivel Recordemos – Crucigrama AGP</Text>

              <Text style={styles.descripcionIntro}>
                En este nivel recordarás conceptos clave de la isla anterior: Introducción AGP.{"\n\n"}
                Completa el crucigrama usando las definiciones que aparecen al costado.{"\n\n"}
                Encontrarás palabras relacionadas con las líneas de negocio, las líneas de
                fabricación y los estándares de calidad de AGP.{"\n\n"}
                Usa tu memoria y tus pistas para completar todos los términos.
              </Text>

              <TouchableOpacity style={styles.playButton} onPress={startGame}>
                <Text style={styles.playButtonText}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {showContent && !showFinal && (
          <Animated.View style={[styles.contentWrap, { opacity: contentOpacity }]}>
            <View style={styles.boardAndPanel}>
              <View style={styles.crucigramaContainer}>
                {CROSSWORD_GRID.map((row, r) => (
                  <View key={r} style={styles.fila}>
                    {row.map((cell, c) => {
                      const cellKey = keyCell(r, c);
                      const val = inputs[cellKey] || "";

                      if (cell.isBlock) {
                        return <View key={c} style={[styles.blockCell, { width: CELL, height: CELL }]} />;
                      }

                      const linkedSolvedWords = getCellSolvedWordNumbers(r, c);
                      const solvedBorder = linkedSolvedWords.length > 0;
                      const activeCell =
                        activeWordNumber != null &&
                        (CELL_TO_PLACEMENTS[cellKey] || []).includes(activeWordNumber);

                      const correct = checked && isCellCorrect(r, c) && !solvedBorder;
                      const wrong = checked && val && !isCellCorrect(r, c);

                      return (
                        <TouchableOpacity
                          key={c}
                          activeOpacity={1}
                          onPress={() => {
                            handleSelectCell(r, c);
                            focusCell(r, c);
                          }}
                        >
                          <View
                            style={[
                              styles.cellWrapper,
                              {
                                width: CELL,
                                height: CELL,
                                backgroundColor: solvedBorder
                                  ? "#DCFCE7"
                                  : correct
                                  ? "#DCFCE7"
                                  : wrong
                                  ? "#FEE2E2"
                                  : activeCell
                                  ? "#EFF6FF"
                                  : "#FFFFFF",
                                borderColor: solvedBorder
                                  ? "#16A34A"
                                  : correct
                                  ? "#16A34A"
                                  : wrong
                                  ? "#DC2626"
                                  : activeCell
                                  ? "#2563EB"
                                  : "#0F1B4C",
                                borderWidth: solvedBorder ? 2.5 : 1.5,
                              },
                            ]}
                          >
                            {cell.number ? (
                              <Text style={styles.cellNumber}>{cell.number}</Text>
                            ) : null}

                            <TextInput
                              ref={(ref) => {
                                inputRefs.current[cellKey] = ref;
                              }}
                              value={val}
                              onChangeText={(text) => handleChangeCell(r, c, text)}
                              // ✅ ÚNICO CAMBIO: se agrega onKeyPress para manejar Backspace
                              onKeyPress={({ nativeEvent }) =>
                                handleKeyPress(r, c, nativeEvent.key)
                              }
                              maxLength={1}
                              style={styles.cellInput}
                              textAlign="center"
                              autoCapitalize="characters"
                              placeholder=""
                              placeholderTextColor="#94A3B8"
                            />
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
              </View>

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
                <Text style={styles.progressText}>
                  Completadas: {solvedCount}/{PLACEMENTS.length}
                </Text>
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => router.push(RUTA_VOLVER)}
                >
                  <Text style={[styles.btnText, styles.btnGhostText]}>Volver</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#4C92E4" }]}
                  onPress={resetGame}
                >
                  <Text style={styles.btnText}>Reiniciar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btn, { backgroundColor: "#0F1B4C" }]}
                  onPress={validarCrucigrama}
                >
                  <Text style={styles.btnText}>Validar</Text>
                </TouchableOpacity>
              </View>
            </View>

            {lastHint && <Text style={styles.hintMessage}>{lastHint}</Text>}

            {showConcept && conceptData && (
              <View style={styles.conceptOverlayContainer}>
                <Animated.View
                  style={[
                    styles.conceptBox,
                    {
                      opacity: conceptAnim,
                      transform: [{ scale: conceptScale }],
                    },
                  ]}
                >
                  <Text style={styles.conceptWord}>{conceptData.palabra}</Text>
                  <Text style={styles.conceptDesc}>{conceptData.concepto}</Text>
                </Animated.View>
              </View>
            )}
          </Animated.View>
        )}

        {showFinal && (
          <View style={styles.finalOverlay}>
            <View style={styles.finalBox}>
              <Text style={styles.finalTitle}>¡Nivel completado! 🎉</Text>
              <Text style={styles.finalText}>
                Completaste correctamente el crucigrama de recordación de AGP.
              </Text>

              <TouchableOpacity
                style={styles.playButton}
                onPress={async () => {
                  try {
                    const ukStr = await AsyncStorage.getItem("USUARIO_KEY");
                    const usuarioKey = ukStr ? Number(ukStr) : null;

                    if (usuarioKey) {
                      await fetch(`${API_URL}/api/niveles/recordemos/${NIVEL_KEY_API}/resultado`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          usuarioKey,
                          islaKey: ISLA_KEY,
                          puntaje: FIXED_SCORE,
                          aprobado: true,
                        }),
                      });

                      await AsyncStorage.multiSet([
                        [`u:${usuarioKey}:isla2_nivel3_recordemos_done`, "true"],
                        [`u:${usuarioKey}:isla2_nivel3_recordemos_score`, String(FIXED_SCORE)],
                        [`u:${usuarioKey}:isla2_nivel4_social_unlocked`, "true"],
                      ]);
                      console.log("✅ Recordemos HSE guardado:", FIXED_SCORE);
                    }
                  } catch (e) {
                    console.error("❌ Error guardando:", e);
                  }
                  router.push(RUTA_VOLVER);
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
  cargando: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "white",
  },
  bg: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.78)",
  },

  header: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 30,
  },
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
  tituloIntro: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 50,
    color: "#fff",
    textAlign: "center",
    marginBottom: 16,
  },
  descripcionIntro: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 30,
    color: "#fff",
    textAlign: "center",
    lineHeight: 33,
  },
  playButton: {
    marginTop: 40,
    backgroundColor: "#4C92E4",
    paddingVertical: 10,
    paddingHorizontal: 50,
    borderRadius: 16,
  },
  playButtonText: {
    color: "#fff",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 40,
  },

  contentWrap: {
    width: "100%",
    alignItems: "center",
  },

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
    borderWidth: 3,
    borderColor: "#0F1B4C",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.94)",
    marginTop: 10,
  },
  fila: {
    flexDirection: "row",
  },
  blockCell: {
    margin: 1,
    backgroundColor: "transparent",
  },
  cellWrapper: {
    margin: 1,
    borderRadius: 6,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  cellNumber: {
    position: "absolute",
    top: 1,
    left: 3,
    fontSize: 9,
    color: "#0F1B4C",
    fontFamily: "PlusJakartaSans-Bold",
    zIndex: 5,
  },
  cellInput: {
    width: "100%",
    height: "100%",
    textAlign: "center",
    fontSize: 18,
    color: "#0F1B4C",
    fontFamily: "PlusJakartaSans-Bold",
  },

  panel: {
    flex: 1,
    minWidth: 470,
    maxWidth: 560,
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 18,
    padding: 20,
    borderWidth: 2.5,
    borderColor: "#E5EAF5",
    marginTop: 10,
  },
  panelTitle: {
    fontSize: 20,
    color: "#0F1B4C",
    fontFamily: "PlusJakartaSans-Bold",
    marginBottom: 10,
    textAlign: "center",
  },
  subTitle: {
    fontSize: 16,
    color: "#0F1B4C",
    fontFamily: "PlusJakartaSans-Bold",
    marginBottom: 8,
  },
  clueRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  clueNumber: {
    width: 22,
    fontSize: 15,
    color: "#0F1B4C",
    fontFamily: "PlusJakartaSans-Bold",
  },
  clueText: {
    flex: 1,
    fontSize: 15,
    color: "#1f2937",
    fontFamily: "PlusJakartaSans-Regular",
    marginRight: 8,
  },
  clueStatus: {
    fontSize: 15,
    fontFamily: "PlusJakartaSans-Bold",
    color: "#9AA3B2",
  },
  clueStatusOk: {
    color: "#16A34A",
  },

  bottomBar: {
    width: "100%",
    maxWidth: 1100,
    marginTop: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  hintInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  hintButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#FACC15",
    backgroundColor: "rgba(250, 204, 21, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
  hintIcon: {
    fontSize: 22,
  },
  hintCounter: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 18,
    color: "#0F1B4C",
  },
  progressBox: {
    backgroundColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderWidth: 2,
    borderColor: "#E5EAF5",
  },
  progressText: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 16,
    color: "#0F1B4C",
  },
  buttonRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  btn: {
    backgroundColor: "#0F1B4C",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginLeft: 10,
  },
  btnText: {
    color: "white",
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 15,
  },
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 2,
    borderColor: "#0F1B4C",
  },
  btnGhostText: {
    color: "#0F1B4C",
  },

  hintMessage: {
    marginTop: 10,
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: "#0F1B4C",
    textAlign: "center",
    maxWidth: "80%",
  },

  conceptOverlayContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  conceptBox: {
    backgroundColor: "rgba(15,27,76,0.95)",
    paddingVertical: 20,
    paddingHorizontal: 26,
    borderRadius: 18,
    maxWidth: "75%",
    borderWidth: 2,
    borderColor: "#4C92E4",
  },
  conceptWord: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: 22,
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  conceptDesc: {
    fontFamily: "PlusJakartaSans-Regular",
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    lineHeight: 22,
  },

  finalOverlay: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  finalBox: {
    backgroundColor: "rgba(143, 197, 207, 0.95)",
    paddingVertical: 30,
    paddingHorizontal: 40,
    borderRadius: 24,
    alignItems: "center",
    maxWidth: "100%",
  },
  finalTitle: {
    fontSize: 60,
    fontFamily: "PlusJakartaSans-Bold",
    color: "#fff",
    marginBottom: 10,
    textAlign: "center",
  },
  finalText: {
    fontSize: 35,
    
    
    textAlign: "center",
    marginBottom: 18,
  },
});