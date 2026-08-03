/**
 * Nivel Recordemos — Sopa de letras (Calidad - Isla 7)
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFonts } from "expo-font";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  ImageBackground,
  Modal,
  PanResponder,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { API_BASE_URL } from "./config";

const API_BASE = API_BASE_URL;
const API_URL  = `${API_BASE}/api`;
const ISLA_KEY  = 8;
const NIVEL_KEY = 38;
const COMPLETE_ENDPOINT = `/niveles/recordemos/${NIVEL_KEY}/resultado`;
const RUTA_VOLVER = "/Calidad";

type Dir      = { dx: number; dy: number };
type Coord    = { r: number; c: number };
type WordInfo = { palabra: string; concepto: string };

const GRID_N    = 14;
const MAX_HINTS = 5;

/* =========================================================
   PALABRAS — Conceptos clave de Calidad AGP
========================================================= */
const WORDS_DEFAULT: WordInfo[] = [
  {
    palabra:  "DEFECTO",
    concepto: "Imperfección en el vidrio que puede afectar su calidad visual o estructural según criterios de aceptación.",
  },
  {
    palabra:  "ZONA",
    concepto: "Área del vidrio que determina la criticidad de un defecto: A (alta), B (media) o C (baja).",
  },
  {
    palabra:  "TOLERANCIA",
    concepto: "Rango de valores aceptables dentro del cual una medida cumple con los estándares de calidad.",
  },
  {
    palabra:  "BURBUJA",
    concepto: "Inclusión de aire o gas atrapada entre las capas del vidrio laminado.",
  },
  {
    palabra:  "RASPON",
    concepto: "Marca superficial extensa y difusa sobre la superficie del vidrio.",
  },
  {
    palabra:  "QUINE",
    concepto: "Astilla o impacto en el borde del vidrio producto de una mala manipulación u operación.",
  },
  {
    palabra:  "DEROGAR",
    concepto: "Decisión de rechazar una pieza que no cumple con los criterios de calidad establecidos.",
  },
  {
    palabra:  "REPROCESAR",
    concepto: "Volver a trabajar una pieza para corregir un defecto antes de inspeccionarla nuevamente.",
  },
];

/* =========================================================
   ALGORITMO SOPA DE LETRAS (idéntico al código guía)
========================================================= */
const DIRS: Dir[] = [
  { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
  { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
  { dx: 1, dy: 1 }, { dx: -1, dy: -1 },
  { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
];

const PALETTE = [
  "#A0C4E8", "#ebf5b3", "#d0f7c6", "#dfd2f7",
  "#f8dab0", "#b9f5f5", "#f8cad2", "#fcc3fc", "#f5d1b9",
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();

const ck = (r: number, c: number) => `${r},${c}`;

function lineCoords(a: Coord, b: Coord): Coord[] {
  const dr = b.r - a.r, dc = b.c - a.c;
  if (dr === 0 && dc === 0) return [a];
  if (dr !== 0 && dc !== 0 && Math.abs(dr) !== Math.abs(dc)) return [];
  const steps = Math.max(Math.abs(dr), Math.abs(dc));
  const sr = dr === 0 ? 0 : dr > 0 ? 1 : -1;
  const sc = dc === 0 ? 0 : dc > 0 ? 1 : -1;
  return Array.from({ length: steps + 1 }, (_, i) => ({ r: a.r + i * sr, c: a.c + i * sc }));
}

const WORD_PATHS: Record<string, Coord[]> = {};

function buildGrid(words: WordInfo[]): string[][] {
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let grid: string[][] = [];

  outer: for (let attempt = 0; attempt < 200; attempt++) {
    grid = Array.from({ length: GRID_N }, () => Array(GRID_N).fill(""));
    Object.keys(WORD_PATHS).forEach((k) => delete WORD_PATHS[k]);
    const sorted = [...words].sort((a, b) => b.palabra.length - a.palabra.length);
    const dirs   = [...DIRS].sort(() => Math.random() - 0.5);
    for (let i = 0; i < sorted.length; i++) {
      const base     = sorted[i].palabra;
      const reversed = Math.random() > 0.5;
      const word     = reversed ? base.split("").reverse().join("") : base;
      if (!placeWord(grid, word, dirs[i % dirs.length], base, reversed)) continue outer;
    }
    break;
  }

  for (let r = 0; r < GRID_N; r++)
    for (let c = 0; c < GRID_N; c++)
      if (!grid[r][c]) grid[r][c] = abc[Math.floor(Math.random() * abc.length)];

  return grid;
}

function placeWord(
  grid: string[][], word: string, dir: Dir,
  originalKey: string, reversed: boolean
): boolean {
  for (let t = 0; t < 500; t++) {
    const sR = Math.floor(Math.random() * GRID_N);
    const sC = Math.floor(Math.random() * GRID_N);
    const eR = sR + dir.dy * (word.length - 1);
    const eC = sC + dir.dx * (word.length - 1);
    if (eR < 0 || eR >= GRID_N || eC < 0 || eC >= GRID_N) continue;
    let ok = true;
    for (let i = 0; i < word.length; i++) {
      const r = sR + dir.dy * i, c = sC + dir.dx * i;
      if (grid[r][c] && grid[r][c] !== word[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const path: Coord[] = [];
    for (let i = 0; i < word.length; i++) {
      const r = sR + dir.dy * i, c = sC + dir.dx * i;
      grid[r][c] = word[i];
      path.push({ r, c });
    }
    WORD_PATHS[originalKey] = reversed ? [...path].reverse() : path;
    return true;
  }
  return false;
}

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function NivelRecordemosCalidad() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const usuarioKeyFromParams = useMemo(() => {
    const raw = params?.usuarioKey;
    const n = Number(Array.isArray(raw) ? raw[0] : raw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [params]);

  const [loaded] = useFonts({
    "PlusJakartaSans-Regular":   require("../assets/fonts/PlusJakartaSans-Regular.ttf"),
    "PlusJakartaSans-Bold":      require("../assets/fonts/PlusJakartaSans-Bold.ttf"),
    "PlusJakartaSans-ExtraBold": require("../assets/fonts/PlusJakartaSans-ExtraBold.ttf"),
  });

  const [phase,    setPhase]    = useState<"intro" | "game" | "final">("intro");
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [words,  setWords]  = useState<WordInfo[]>(WORDS_DEFAULT);
  const [grid,   setGrid]   = useState<string[][] | null>(null);
  const gridDataRef = useRef<string[][] | null>(null);
  useEffect(() => { gridDataRef.current = grid; }, [grid]);

  const [cellSize,     setCellSize]     = useState(0);
  const cellSizeRef                     = useRef(0);
  const cellSizeLocked                  = useRef(false);
  useEffect(() => { cellSizeRef.current = cellSize; }, [cellSize]);

  const gridViewRef = useRef<View>(null);
  const gridOrigin  = useRef<{ x: number; y: number } | null>(null);

  const [selCells,   setSelCells]   = useState<Coord[]>([]);
  const [curWord,    setCurWord]    = useState("");
  const [foundCells, setFoundCells] = useState<Record<string, boolean>>({});
  const [cellClrs,   setCellClrs]   = useState<Record<string, string>>({});
  const [foundWords, setFoundWords] = useState<Record<string, boolean>>({});
  const [wordClrs,   setWordClrs]   = useState<Record<string, string>>({});
  const [colorIdx,   setColorIdx]   = useState(0);
  const [hintsLeft,  setHintsLeft]  = useState(MAX_HINTS);
  const [hintCell,   setHintCell]   = useState<Coord | null>(null);
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [checkResult, setCheckResult] = useState<"ok" | "fail" | null>(null);
  const [guardando,   setGuardando]   = useState(false);

  const [popupVisible, setPopupVisible] = useState(false);
  const [popupInfo,    setPopupInfo]    = useState<WordInfo | null>(null);
  const popupAnim = useRef(new Animated.Value(0)).current;

  const selRef      = useRef<Coord[]>([]);
  const curWordRef  = useRef<string>("");
  const foundRef    = useRef<Record<string, boolean>>({});
  const colorIdxRef = useRef<number>(0);
  const wordClrsRef = useRef<Record<string, string>>({});

  useEffect(() => { selRef.current      = selCells;   }, [selCells]);
  useEffect(() => { curWordRef.current  = curWord;    }, [curWord]);
  useEffect(() => { foundRef.current    = foundWords; }, [foundWords]);
  useEffect(() => { colorIdxRef.current = colorIdx;   }, [colorIdx]);
  useEffect(() => { wordClrsRef.current = wordClrs;   }, [wordClrs]);

  /* ── Cargar usuario ── */
  useEffect(() => {
    const init = async () => {
      let uk = usuarioKeyFromParams;
      if (!uk) {
        const stored = await AsyncStorage.getItem("USUARIO_KEY");
        uk = stored ? Number(stored) : null;
      }
      if (uk && uk > 0) await AsyncStorage.setItem("USUARIO_KEY", String(uk));
    };
    init();
  }, [usuarioKeyFromParams]);

  /* ── Intentar cargar palabras desde la BD ── */
  useEffect(() => {
    const loadWords = async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/niveles/recordemos/${NIVEL_KEY}`);
        const data = await resp.json();
        const items: any[] = data?.data || data || [];
        if (Array.isArray(items) && items.length > 0) {
          const parsed = items
            .map((item: any) => ({
              palabra:  norm(item.RECORDEMOS_PALABRA || item.palabra || ""),
              concepto: item.RECORDEMOS_CONCEPTO || item.concepto || "",
            }))
            .filter((w: WordInfo) => w.palabra);
          if (parsed.length > 0) setWords(parsed);
        }
      } catch (e) {
        console.log("Usando palabras por defecto calidad:", e);
      }
    };
    loadWords();
  }, []);

  /* ── Medir origen del grid ── */
  const medirOrigen = (intentos = 0) => {
    if (!gridViewRef.current) return;
    gridViewRef.current.measure((_x, _y, _w, _h, px, py) => {
      if (px === 0 && py === 0 && intentos < 12) {
        setTimeout(() => medirOrigen(intentos + 1), 80);
        return;
      }
      gridOrigin.current = { x: px, y: py };
    });
  };

  /* ── Iniciar juego ── */
  const startGame = () => {
    const g = buildGrid(words);
    setGrid(g);
    setSelCells([]);    setCurWord("");
    setFoundCells({});  setCellClrs({});
    setFoundWords({});  setWordClrs({});
    setColorIdx(0);     setHintsLeft(MAX_HINTS);
    setHintCell(null);  setCheckResult(null);
    cellSizeLocked.current = false;
    gridOrigin.current     = null;
    fadeAnim.setValue(0);
    setPhase("game");
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const getCellAt = (px: number, py: number): Coord | null => {
    const o  = gridOrigin.current;
    const cs = cellSizeRef.current;
    if (!o || cs <= 0) return null;
    const rx = px - o.x, ry = py - o.y;
    if (rx < 0 || ry < 0) return null;
    const c = Math.floor(rx / cs), r = Math.floor(ry / cs);
    if (r >= 0 && r < GRID_N && c >= 0 && c < GRID_N) return { r, c };
    return null;
  };

  /* ── Verificar palabra ── */
  const checkWord = () => {
    const word  = curWordRef.current;
    const cells = selRef.current;
    if (word.length < 2) { clearSel(); return; }

    const ns   = norm(word);
    const idx  = colorIdxRef.current;
    const done = foundRef.current;

    const match = words.find(w => {
      if (done[w.palabra]) return false;
      const b = norm(w.palabra);
      return ns === b || ns === b.split("").reverse().join("");
    });

    if (match) {
      const color = PALETTE[idx % PALETTE.length];
      colorIdxRef.current = idx + 1;
      foundRef.current    = { ...done, [match.palabra]: true };
      wordClrsRef.current = { ...wordClrsRef.current, [match.palabra]: color };

      setColorIdx(idx + 1);
      setWordClrs(p  => ({ ...p, [match.palabra]: color }));
      setCellClrs(p  => { const u = { ...p }; cells.forEach(c => { u[ck(c.r, c.c)] = color; }); return u; });
      setFoundCells(p => { const u = { ...p }; cells.forEach(c => { u[ck(c.r, c.c)] = true;  }); return u; });
      setFoundWords(p => {
        const u = { ...p, [match.palabra]: true };
        if (Object.values(u).filter(Boolean).length === words.length) {
          setTimeout(() => {
            fadeAnim.setValue(0);
            setPhase("final");
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
          }, 600);
        }
        return u;
      });

      setCheckResult("ok");
      showPopup(match);
      setSelCells([]); setCurWord("");
      selRef.current = []; curWordRef.current = "";
      setTimeout(() => setCheckResult(null), 800);
    } else {
      setCheckResult("fail");
      setSelCells([]); setCurWord("");
      selRef.current = []; curWordRef.current = "";
      setTimeout(() => setCheckResult(null), 600);
    }
  };

  const clearSel = () => {
    setSelCells([]); setCurWord("");
    selRef.current = []; curWordRef.current = "";
    setCheckResult(null);
  };

  /* ── Popup de concepto ── */
  const showPopup = (info: WordInfo) => {
    setPopupInfo(info);
    setPopupVisible(true);
    popupAnim.setValue(0);
    Animated.sequence([
      Animated.spring(popupAnim, { toValue: 1, useNativeDriver: true, bounciness: 14 }),
      Animated.delay(2000),
      Animated.timing(popupAnim, { toValue: 0, duration: 280, useNativeDriver: true }),
    ]).start(() => setPopupVisible(false));
  };

  /* ── PanResponder ── */
  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder:        () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder:         () => true,
    onMoveShouldSetPanResponderCapture:  () => true,

    onPanResponderGrant: (evt) => {
      medirOrigen();
      const g = gridDataRef.current;
      if (!g) return;
      const cell = getCellAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      if (!cell) return;
      const w = g[cell.r][cell.c];
      selRef.current = [cell]; curWordRef.current = w;
      setSelCells([cell]); setCurWord(w); setCheckResult(null);
    },

    onPanResponderMove: (evt) => {
      const g = gridDataRef.current;
      if (!g || selRef.current.length === 0) return;
      const cell = getCellAt(evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      if (!cell) return;
      const line = lineCoords(selRef.current[0], cell);
      if (line.length === 0) return;
      let w = "";
      const valid: Coord[] = [];
      for (const lc of line) {
        const l = g[lc.r]?.[lc.c];
        if (l) { w += l; valid.push(lc); }
      }
      if (valid.length > 0) {
        selRef.current = valid; curWordRef.current = w;
        setSelCells([...valid]); setCurWord(w);
      }
    },

    onPanResponderRelease:   () => { checkWord(); },
    onPanResponderTerminate: () => { clearSel(); },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── Pista ── */
  const handleHint = () => {
    if (hintsLeft <= 0) return;
    const rem = words.filter(w => {
      if (foundRef.current[w.palabra]) return false;
      const path = WORD_PATHS[w.palabra];
      return path && path.length > 0;
    });
    if (!rem.length) return;
    const pick      = rem[Math.floor(Math.random() * rem.length)];
    const path      = WORD_PATHS[pick.palabra];
    const firstCell = path[0];

    setHintsLeft(h => h - 1);
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null; }
    setHintCell(null);
    requestAnimationFrame(() => {
      setHintCell(firstCell);
      hintTimer.current = setTimeout(() => {
        setHintCell(null);
        hintTimer.current = null;
      }, 3000);
    });
  };

  /* ── Guardar resultado ── */
  const guardarCompletado = async () => {
    try {
      setGuardando(true);
      const k  = await AsyncStorage.getItem("USUARIO_KEY");
      const uk = Number(k);
      if (!Number.isFinite(uk) || uk <= 0) return;
      const keyU       = (suffix: string) => `u:${uk}:${suffix}`;
      const wordsFound = Object.keys(foundWords).filter(k => foundWords[k]).length;
      const scorePct   = Math.round((wordsFound / words.length) * 100);
      await AsyncStorage.multiSet([
        [keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_recordemos_done`),  "true"],
        [keyU(`isla${ISLA_KEY}_nivel${NIVEL_KEY}_recordemos_score`), String(scorePct)],
        [keyU(`isla${ISLA_KEY}_nivel34_social_unlocked`),            "true"],
      ]);
      await fetch(`${API_URL}${COMPLETE_ENDPOINT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usuarioKey: uk, islaKey: ISLA_KEY,
          nivelKey: NIVEL_KEY, puntaje: scorePct,
          aprobado: scorePct >= 80,
        }),
      });
    } catch (e) { console.log(e); }
    finally { setGuardando(false); }
  };

  if (!loaded) return <View style={st.loading}><Text>Cargando...</Text></View>;

  const fondo = require("../assets/islas/fondogeneral.png");

  /* =========================================================
     RENDER
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={st.bg} resizeMode="cover">
      <View style={st.root}>

        {/* ── INTRO ── */}
        {phase === "intro" && (
          <View style={st.introWrap}>
            <View style={st.introCard}>
              <Text style={st.introH}>Nivel Recordemos – Calidad</Text>
              <Text style={st.introP}>
                Pon a prueba tu memoria con los conceptos clave del proceso de Calidad en AGP.{"\n\n"}
                Encuentra las palabras escondidas en la sopa de letras y relaciónalas con su significado.{"\n\n"}
                Pueden aparecer en horizontal, vertical o diagonal, e incluso al revés.{"\n"}
                Usa tus pistas 💡 cuando las necesites.
              </Text>
              <TouchableOpacity style={st.playBtn} onPress={startGame}>
                <Text style={st.playBtnTxt}>Jugar</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ── JUEGO ── */}
        {phase === "game" && grid && (
          <Animated.View style={[st.gameRoot, { opacity: fadeAnim }]}>

            {/* Columna izquierda: sopa */}
            <View style={st.leftCol}>
              <View
                style={st.sopaWrap}
                onLayout={(e) => {
                  if (cellSizeLocked.current) return;
                  const { width, height } = e.nativeEvent.layout;
                  const side = Math.min(width, height);
                  const cs   = Math.floor(side / GRID_N);
                  if (cs > 0) {
                    cellSizeLocked.current = true;
                    setCellSize(cs);
                  }
                }}
              >
                {cellSize > 0 && (
                  <View
                    ref={gridViewRef}
                    style={[st.gridBox, { width: cellSize * GRID_N, height: cellSize * GRID_N }]}
                    onLayout={() => { setTimeout(() => medirOrigen(), 120); }}
                    {...panResponder.panHandlers}
                  >
                    {grid.map((row, r) => (
                      <View key={r} style={st.gridRow}>
                        {row.map((letter, c) => {
                          const key     = ck(r, c);
                          const isSel   = selCells.some(s => s.r === r && s.c === c);
                          const isFound = !!foundCells[key];
                          const clr     = cellClrs[key];
                          const isHint  = hintCell !== null && hintCell.r === r && hintCell.c === c && !isFound;

                          const bg =
                            isFound ? clr :
                            isHint  ? "#FFD700" :
                            isSel   ? "#D1D5DB" :
                            "#FEFCE8";

                          const bd =
                            isFound ? clr :
                            isHint  ? "#FFA000" :
                            isSel   ? "#9CA3AF" :
                            "#BFDBFE";

                          return (
                            <View key={c} style={[st.cell, {
                              width: cellSize, height: cellSize,
                              backgroundColor: bg, borderColor: bd,
                            }]}>
                              <Text style={[st.cellTxt, { fontSize: cellSize * 0.5, color: "#000000", fontWeight: "normal" as const }]}>
                                {letter}
                              </Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Controles */}
              <View style={st.controls}>
                <View style={[
                  st.wordBox,
                  { borderColor: checkResult === "ok" ? "#16A34A" : checkResult === "fail" ? "#EF4444" : "#3B82F6" },
                ]}>
                  <Text style={[st.feedIcon, {
                    color: checkResult === "ok" ? "#16A34A" : checkResult === "fail" ? "#DC2626" : "transparent",
                  }]}>
                    {checkResult === "ok" ? "✓" : checkResult === "fail" ? "✗" : "·"}
                  </Text>
                  <Text style={st.wordTxt} numberOfLines={1} adjustsFontSizeToFit>
                    {curWord || "···"}
                  </Text>
                  <Text style={[st.feedLabel, {
                    color: checkResult === "ok" ? "#16A34A" : checkResult === "fail" ? "#DC2626" : "transparent",
                  }]}>
                    {checkResult === "ok" ? "¡Encontrada!" : checkResult === "fail" ? "No encontrada" : ""}
                  </Text>
                </View>

                <View style={st.btnRow}>
                  <TouchableOpacity
                    style={[st.hintBtn, hintsLeft <= 0 && { opacity: 0.4 }]}
                    onPress={handleHint}
                    disabled={hintsLeft <= 0}
                  >
                    <Text style={st.hintBtnTxt}>💡 {hintsLeft}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.clearBtn} onPress={clearSel}>
                    <Text style={st.clearBtnTxt}>Limpiar</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={st.backBtn} onPress={() => router.push(RUTA_VOLVER as any)}>
                    <Text style={st.backBtnTxt}>Volver</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* Columna derecha: conceptos */}
            <View style={st.rightCol}>
              <Text style={st.conceptsTitle}>Conceptos</Text>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ flex: 1 }}
                contentContainerStyle={{ gap: 6, paddingBottom: 8 }}
              >
                {words.map((w) => {
                  const ok = !!foundWords[w.palabra];
                  const wc = wordClrs[w.palabra] || "#CBD5E1";
                  return (
                    <View key={w.palabra} style={[st.conceptItem, ok && { borderLeftColor: wc, borderLeftWidth: 4 }]}>
                      <Text style={st.conceptTxt}>{w.concepto}</Text>
                      {ok && <Text style={[st.conceptWord, { color: "#333" }]}>✓ {w.palabra}</Text>}
                    </View>
                  );
                })}
              </ScrollView>
            </View>

          </Animated.View>
        )}

      </View>

      {/* ── POPUP CONCEPTO ── */}
      <Modal transparent visible={popupVisible} animationType="none" statusBarTranslucent>
        <View style={st.popupOv} pointerEvents="none">
          <Animated.View style={[st.popupCard, {
            opacity:   popupAnim,
            transform: [{ scale: popupAnim.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }]}>
            <Text style={st.popupW}>{popupInfo?.palabra}</Text>
            <View style={st.popupSep} />
            <Text style={st.popupC}>{popupInfo?.concepto}</Text>
          </Animated.View>
        </View>
      </Modal>

      {/* ── MODAL FINAL ── */}
      <Modal transparent visible={phase === "final"} animationType="fade" statusBarTranslucent>
        <View style={st.finalOv}>
          <Animated.View style={[st.finalCard, {
            opacity:   fadeAnim,
            transform: [{ scale: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
          }]}>
            <Text style={st.finalScore}>100%</Text>
            <Text style={st.finalH}>✅ ¡Encontraste todas las palabras!</Text>
            <TouchableOpacity
              style={[st.finalBtn, { marginTop: 16 }]}
              disabled={guardando}
              onPress={async () => { await guardarCompletado(); router.push(RUTA_VOLVER as any); }}
            >
              <Text style={st.finalBtnTxt}>{guardando ? "Guardando..." : "Continuar"}</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS — idénticos al código guía
========================================================= */
const st = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  bg:      { flex: 1 },
  root:    { flex: 1, backgroundColor: "rgba(255,255,255,0.88)", padding: 60 },

  introWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 30 },
  introCard: {
    backgroundColor: "rgba(143, 197, 207, 0.80)",
    paddingVertical: 40, paddingHorizontal: 40, borderRadius: 25,
    alignItems: "center", maxWidth: "80%",
    shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  introH:     { fontFamily: "PlusJakartaSans-Bold",    fontSize: 50, color: "#fff", textAlign: "center", marginBottom: 16 },
  introP:     { fontFamily: "PlusJakartaSans-Regular", fontSize: 30, color: "#fff", textAlign: "center", lineHeight: 33 },
  playBtn:    { marginTop: 40, backgroundColor: "#4C92E4", paddingVertical: 10, paddingHorizontal: 50, borderRadius: 16 },
  playBtnTxt: { fontFamily: "PlusJakartaSans-Bold", fontSize: 40, color: "#fff" },

  gameRoot: { flex: 1, flexDirection: "row", gap: 10 },
  leftCol:  { flex: 6, flexDirection: "column", gap: 6 },

  sopaWrap: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: "#EFF6FF", borderRadius: 10,
    borderWidth: 2, borderColor: "#BFDBFE", overflow: "hidden",
  },
  gridBox: {
    borderWidth: 2, borderColor: "#1E3A8A", borderRadius: 6,
    backgroundColor: "#FEFCE8", overflow: "hidden",
    elevation: 3, shadowColor: "#1E3A8A",
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4,
  },
  gridRow: { flexDirection: "row" },
  cell:    { borderWidth: 0.7, alignItems: "center", justifyContent: "center" },
  cellTxt: { fontFamily: "PlusJakartaSans-Bold", includeFontPadding: false, textAlignVertical: "center" },

  controls: { gap: 5, paddingHorizontal: 2 },
  wordBox: {
    borderWidth: 2, borderRadius: 10, paddingVertical: 6, paddingHorizontal: 14,
    backgroundColor: "#F8FAFF", height: 44,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
  },
  feedIcon:  { fontFamily: "PlusJakartaSans-Bold", fontSize: 16, textAlign: "center" },
  wordTxt:   { fontFamily: "PlusJakartaSans-Bold", fontSize: 18, color: "#1E3A8A", letterSpacing: 3, textAlign: "center" },
  feedLabel: { fontFamily: "PlusJakartaSans-Bold", fontSize: 12, textAlign: "center" },

  btnRow:     { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  hintBtn:    { backgroundColor: "#FEF9C3", borderWidth: 1.5, borderColor: "#EAB308", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  hintBtnTxt: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#92400E" },
  clearBtn:   { borderWidth: 1.5, borderColor: "#64748B", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "#F1F5F9" },
  clearBtnTxt:{ fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#334155" },
  backBtn:    { borderWidth: 1.5, borderColor: "#1E3A8A", borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  backBtnTxt: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#1E3A8A" },

  rightCol: {
    flex: 4, backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 12, borderWidth: 1.5, borderColor: "#E2E8F0",
    padding: 10, elevation: 2,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3,
  },
  conceptsTitle: {
    fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#1E3A8A",
    textAlign: "center", marginBottom: 6,
    borderBottomWidth: 1, borderBottomColor: "#DBEAFE", paddingBottom: 4,
  },
  conceptItem: {
    backgroundColor: "#F8FAFF", borderRadius: 8, padding: 8,
    borderLeftWidth: 3, borderLeftColor: "#CBD5E1",
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  conceptTxt:  { fontFamily: "PlusJakartaSans-Regular", fontSize: 12, color: "#1F2937", lineHeight: 17 },
  conceptWord: { fontFamily: "PlusJakartaSans-Bold",    fontSize: 12, marginTop: 3 },

  popupOv: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)" },
  popupCard: {
    backgroundColor: "rgba(143,197,207,0.82)", borderRadius: 24,
    paddingVertical: 24, paddingHorizontal: 24, alignItems: "center",
    maxWidth: "78%", minWidth: 280, elevation: 16,
    shadowColor: "#1E3A8A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 14,
  },
  popupW: {
    fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 25,
    color: "#ffffff", textAlign: "center", marginBottom: 12, letterSpacing: 2,
  },
  popupSep: { width: "80%", height: 1.5, backgroundColor: "rgba(0,0,0,0.15)", marginBottom: 12 },
  popupC:   { fontFamily: "PlusJakartaSans-Regular", fontSize: 25, color: "#000000", textAlign: "center", lineHeight: 24 },

  finalOv:    { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(0,0,0,0.45)", paddingHorizontal: 16 },
  finalCard:  {
    backgroundColor: "#77b479ff", paddingVertical: 22, paddingHorizontal: 35,
    borderRadius: 20, elevation: 10,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8,
    alignItems: "center", maxWidth: "85%",
  },
  finalScore: { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: 120, textAlign: "center", marginBottom: 12 },
  finalH:     { fontFamily: "PlusJakartaSans-Bold",      color: "#fff", fontSize: 35, textAlign: "center" },
  finalBtn:   { backgroundColor: "#4C92E4", paddingVertical: 10, paddingHorizontal: 30, borderRadius: 14 },
  finalBtnTxt:{ fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: 35 },
});