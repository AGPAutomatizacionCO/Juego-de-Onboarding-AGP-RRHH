import { useRouter } from "expo-router";
import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  Alert,
  Animated,
  Easing,
  Image,
  ImageBackground,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { scaleDP } from "./scale";
import { API_BASE_URL } from "./config";

const fondo = require("../assets/FONDOREG.png");
const RUTA_VOLVER = "/mapa"; // Evaluación general → vuelve al mapa principal

const API_BASE     = `${API_BASE_URL}/api/niveles`;
const API_USUARIOS = `${API_BASE_URL}/api/usuarios`;
const ISLA_KEY  = 9;   // ← Evaluación Final (según tabla BD Onboarding_Islas)
const NIVEL_KEY = 41;  // ← Evaluación Final General

/* =========================================================
   IMÁGENES DE APOYO
   ⚠️ Copia la carpeta assets_evaluacion que te entregué a
   tu proyecto como: assets/evaluacion/
========================================================= */
const IMG_VEHICULO       = require("../assets/evaluacion/vehiculo_codificacion.png");
const IMG_PARABRISAS     = require("../assets/evaluacion/zonas_parabrisas.png");
const IMG_LAT_DELANTEROS = require("../assets/evaluacion/zonas_lat_delanteros.png");
const IMG_LAT_TRASEROS   = require("../assets/evaluacion/zonas_lat_traseros.png");

/* =========================================================
   TIPOS
========================================================= */
type KeyOpt       = "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h" | "i";
type MatrixColumn = string;

type Modulo = { num: number; nombre: string };

type SingleQuestion = { id: number; type: "single"; modulo: Modulo; text: string; image?: any; options: { key: KeyOpt; label: string }[]; correct: KeyOpt };
type MultiQuestion  = { id: number; type: "multi";  modulo: Modulo; text: string; image?: any; options: { key: KeyOpt; label: string }[]; correct: KeyOpt[] };
type MatrixRow      = { id: string; label: string; correct: MatrixColumn };
type MatrixQuestion = { id: number; type: "matrix"; modulo: Modulo; text: string; image?: any; rows: MatrixRow[]; columns: { key: MatrixColumn; label: string }[]; lockRows?: boolean };
// matrixmulti: cada fila puede tener VARIAS columnas correctas (checkboxes)
type MatrixMultiRow      = { id: string; label: string; correct: MatrixColumn[] };
type MatrixMultiQuestion = { id: number; type: "matrixmulti"; modulo: Modulo; text: string; image?: any; rows: MatrixMultiRow[]; columns: { key: MatrixColumn; label: string }[] };
type Question       = SingleQuestion | MultiQuestion | MatrixQuestion | MatrixMultiQuestion;
type Player         = { id: string; nombre: string; puntaje: number | null };

/* =========================================================
   MÓDULOS (8, según los títulos de la presentación)
========================================================= */
const MOD1: Modulo = { num: 1, nombre: "HSE" };
const MOD2: Modulo = { num: 2, nombre: "Metrología" };
const MOD3: Modulo = { num: 3, nombre: "Codificación de piezas" };
const MOD4: Modulo = { num: 4, nombre: "Codificación de piezas II" }; // ⚠️ en la presentación este módulo repite el título "Codificación de piezas"; cámbialo si tiene otro nombre
const MOD5: Modulo = { num: 5, nombre: "Cultura AGP" };
const MOD6: Modulo = { num: 6, nombre: "Conceptos Generales" };
const MOD7: Modulo = { num: 7, nombre: "Calidad" };
const MOD8: Modulo = { num: 8, nombre: "Orden de Fabricación" };

/* =========================================================
   HELPERS
========================================================= */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function shuffleSingle(q: SingleQuestion): SingleQuestion {
  const shuffled = shuffle(q.options);
  const correct  = shuffled.find((o) => o.key === q.correct)!.key;
  return { ...q, options: shuffled, correct };
}
function shuffleMulti(q: MultiQuestion): MultiQuestion { return { ...q, options: shuffle(q.options) }; }
function shuffleMatrix(q: MatrixQuestion): MatrixQuestion {
  return { ...q, rows: q.lockRows ? q.rows : shuffle(q.rows), columns: shuffle(q.columns) };
}
function shuffleMatrixMulti(q: MatrixMultiQuestion): MatrixMultiQuestion {
  return { ...q, rows: shuffle(q.rows), columns: shuffle(q.columns) };
}
function shuffleQuestion(q: Question): Question {
  if (q.type === "single")      return shuffleSingle(q);
  if (q.type === "multi")       return shuffleMulti(q);
  if (q.type === "matrix")      return shuffleMatrix(q);
  if (q.type === "matrixmulti") return shuffleMatrixMulti(q);
  return q;
}

/* =========================================================
   PREGUNTAS — Evaluación Final General (39 preguntas, 8 módulos)
   Contenido extraído de la presentación evaluacion_final.pdf
   Busca ⚠️ para ver las respuestas que debes verificar.
========================================================= */
const QUESTIONS_BASE: Question[] = [

  /* ═════════ MÓDULO 1 — HSE ═════════ */
  {
    id: 1, type: "single", modulo: MOD1,
    text: "¿Cuáles son los elementos de protección personal (EPP's) básicos y obligatorios que se deben usar para el ingreso a la planta?",
    options: [
      { key: "a", label: "Gafas - Tapa oídos - Guantes anticorte - Mangas" },
      { key: "b", label: "Mangas - Casco - Slinga - Tapa oídos" },
      { key: "c", label: "Arnés - Chaqueta reflectiva - Guantes de nitrilo" },
    ],
    correct: "a",
  },
  {
    id: 2, type: "single", modulo: MOD1,
    text: "Según la directriz, ¿cómo se debe realizar la manipulación de piezas grandes?",
    options: [
      { key: "a", label: "Una persona" },
      { key: "b", label: "Dos personas" },
      { key: "c", label: "No se debe realizar" },
    ],
    correct: "b",
  },
  {
    id: 3, type: "single", modulo: MOD1,
    text: "¿Para qué me sirve un elemento de protección personal?",
    options: [
      { key: "a", label: "Proteger mi salud y mi integridad en el espacio de trabajo" },
      { key: "b", label: "Verme bien, de acuerdo al código de la empresa" },
      { key: "c", label: "Portar el uniforme para hacer que el proceso sea más rápido" },
    ],
    correct: "a",
  },
  {
    id: 4, type: "single", modulo: MOD1,
    text: "En AGP Colombia, ¿cuántos kg máximo puede levantar una persona?",
    options: [
      { key: "a", label: "Mujer 12,5 kg - Hombre 25 kg" },
      { key: "b", label: "Mujer 20 kg - Hombre 22,5 kg" },
      { key: "c", label: "Mujer 5 kg - Hombre 30 kg" },
    ],
    correct: "a",
  },
  {
    id: 5, type: "matrix", modulo: MOD1,
    text: "¿Cómo se clasifican los residuos en AGP?",
    columns: [
      { key: "noaprov",  label: "No aprovechables" },
      { key: "pelig",    label: "Peligrosos" },
      { key: "aprov",    label: "Aprovechables o reciclables" },
      { key: "organ",    label: "Orgánicos" },
    ],
    rows: [
      { id: "blanca", label: "Depósito Blanca", correct: "aprov"   }, // ⚠️ no venía marcada; asumí el código de colores estándar
      { id: "verde",  label: "Depósito Verde",  correct: "organ"   }, // ⚠️
      { id: "negro",  label: "Depósito Negro",  correct: "noaprov" }, // ⚠️
      { id: "rojo",   label: "Depósito Rojo",   correct: "pelig"   }, // ⚠️
    ],
  },

  /* ═════════ MÓDULO 2 — Metrología ═════════ */
  {
    id: 6, type: "single", modulo: MOD2,
    text: "¿Qué herramienta se usa para medir el offset, y en qué unidad de medida está?",
    options: [
      { key: "a", label: "Profundímetro en mm" },
      { key: "b", label: "Profundímetro en CC" },
      { key: "c", label: "Taper Gauge en mm" },
      { key: "d", label: "Micrómetro en cm" },
      { key: "e", label: "Galgas de comprobación en Pulg" },
    ],
    correct: "a",
  },
  {
    id: 7, type: "single", modulo: MOD2,
    text: "¿Cuál es la opción correcta de 3,25 ± 0,5 mm?",
    options: [
      { key: "a", label: "3,30 mm y 3,20 mm" },
      { key: "b", label: "3,55 mm y 2,85 mm" },
      { key: "c", label: "3,75 mm y 2,75 mm" },
    ],
    correct: "c", // ⚠️ verifica: matemáticamente 3,25 ± 0,5 = 3,75 y 2,75
  },
  {
    id: 8, type: "single", modulo: MOD2,
    text: "La siguiente afirmación: ( 110 mm > 90 mm )",
    options: [
      { key: "a", label: "VERDADERA" },
      { key: "b", label: "FALSA" },
    ],
    correct: "a",
  },
  {
    id: 9, type: "single", modulo: MOD2,
    text: "La siguiente afirmación: ( 225 mm < 115 mm )",
    options: [
      { key: "a", label: "VERDADERA" },
      { key: "b", label: "FALSA" },
    ],
    correct: "b",
  },
  {
    id: 10, type: "single", modulo: MOD2,
    text: "¿Cuál es la opción correcta de 1,20 ± 0,15 mm?",
    options: [
      { key: "a", label: "1,15 mm y 1,45 mm" },
      { key: "b", label: "1,35 mm y 1,05 mm" },
      { key: "c", label: "1,25 mm y 1,15 mm" },
    ],
    correct: "b", // ⚠️ verifica: matemáticamente 1,20 ± 0,15 = 1,35 y 1,05
  },

  /* ═════════ MÓDULO 3 — Codificación de piezas ═════════ */
  {
    id: 11, type: "matrix", modulo: MOD3,
    text: "Ordene de manera adecuada la codificación de las piezas con la imagen de referencia",
    image: IMG_VEHICULO,
    columns: [
      { key: "A", label: "A" }, { key: "B", label: "B" }, { key: "C", label: "C" },
      { key: "D", label: "D" }, { key: "E", label: "E" }, { key: "F", label: "F" },
      { key: "G", label: "G" }, { key: "H", label: "H" }, { key: "I", label: "I" },
    ],
    rows: [
      { id: "pbs00", label: "PBS 00", correct: "A" }, // ⚠️ mapeo según posición en el diagrama (volante arriba izquierda) — verifica todas
      { id: "ldi01", label: "LDI 01", correct: "B" },
      { id: "lti03", label: "LTI 03", correct: "C" },
      { id: "qti07", label: "QTI 07", correct: "D" },
      { id: "srf10", label: "SRF 10", correct: "I" },
      { id: "ldd02", label: "LDD 02", correct: "H" },
      { id: "ltd04", label: "LTD 04", correct: "G" },
      { id: "qtd08", label: "QTD 08", correct: "F" },
      { id: "pos09", label: "POS 09", correct: "E" },
    ],
  },
  {
    id: 12, type: "matrix", modulo: MOD3,
    text: "Seleccione la codificación correcta para cada una de las piezas",
    columns: [
      { key: "25", label: "25" }, { key: "11", label: "11" }, { key: "30", label: "30" },
      { key: "87", label: "87" }, { key: "18", label: "18" }, { key: "17", label: "17" },
      { key: "41", label: "41" },
    ],
    rows: [
      { id: "latext",   label: "Lateral Extendido Izquierdo", correct: "25" }, // ⚠️ verifica
      { id: "particion",label: "Partición",                   correct: "30" }, // (coincide con la sopa de letras: Partición = 30)
      { id: "sunroof3", label: "Sun Roof Terciario",          correct: "11" }, // ⚠️ verifica
      { id: "probeta",  label: "Probeta",                     correct: "87" }, // ⚠️ verifica
      { id: "mirilla",  label: "Mirilla",                     correct: "17" }, // (coincide con la sopa de letras: Mirilla = 17)
      { id: "especial", label: "Pieza Especial",              correct: "41" }, // ⚠️ verifica
    ],
  },

  /* ═════════ MÓDULO 4 — Codificación de piezas II ═════════ */
  {
    id: 13, type: "matrix", modulo: MOD4,
    text: "Relacione cada proceso con su UMA correspondiente",
    columns: [
      { key: "uma1", label: "UMA 1" }, { key: "uma2", label: "UMA 2" }, { key: "uma3", label: "UMA 3" },
      { key: "uma4", label: "UMA 4" }, { key: "uma5", label: "UMA 5" }, { key: "uma6", label: "UMA 6" },
      { key: "calidad", label: "CALIDAD" },
    ],
    rows: [
      { id: "r1", label: "Corte, Mecanizado",                       correct: "uma1" },
      { id: "r2", label: "Serigrafía, Vitrificado, Empalme",        correct: "uma2" },
      { id: "r3", label: "Curvado",                                 correct: "uma3" },
      { id: "r4", label: "Recorte, Sentado de acero, Pulido",       correct: "uma4" },
      { id: "r5", label: "Corte PC, Zund, Ensamble",                correct: "uma5" },
      { id: "r6", label: "Embolsado, Autoclave, Reprocesos",        correct: "uma6" },
      { id: "r7", label: "Acabado, Control Final",                  correct: "calidad" },
    ],
  },
  {
    id: 14, type: "single", modulo: MOD4,
    text: "¿Qué es Retrofit y qué es OEM?",
    options: [
      { key: "a", label: "Líneas de Negocio" },
      { key: "b", label: "Líneas de Fabricación" },
      { key: "c", label: "Métodos de venta" },
    ],
    correct: "a",
  },
  {
    id: 15, type: "single", modulo: MOD4,
    text: "¿Cuál es el orden del código de prioridades?",
    options: [
      { key: "a", label: "VERDE - AMARILLO - ROJO - NEGRO" },
      { key: "b", label: "NEGRO - VERDE - AMARILLO - ROJO" },
      { key: "c", label: "NEGRO - ROJO - AMARILLO - VERDE" },
    ],
    correct: "c",
  },
  {
    id: 16, type: "single", modulo: MOD4,
    text: "¿De qué está compuesto como mínimo un vidrio blindado?",
    options: [
      { key: "a", label: "Vidrios" },
      { key: "b", label: "Vidrios, Polímeros y Policarbonatos" },
      { key: "c", label: "Vidrios y plásticos" },
    ],
    correct: "b",
  },
  {
    id: 17, type: "single", modulo: MOD4,
    text: "¿Quién es mi cliente interno?",
    options: [
      { key: "a", label: "El proceso general" },
      { key: "b", label: "Los compañeros que reclaman material en insumos" },
      { key: "c", label: "Mis compañeros y personal de las siguientes áreas que reciben mi trabajo" },
      { key: "d", label: "Es el siguiente proceso de producción a la que pasa el lite" },
    ],
    correct: "d", // ⚠️ verifica: en la diapositiva el resaltado está en esta opción
  },
  {
    id: 18, type: "single", modulo: MOD4,
    text: "¿Cuáles son los 3 NO negociables?",
    options: [
      { key: "a", label: "Trabajar con calidad y velocidad, Usar los EPPs, Espíritu de mejora continua" },
      { key: "b", label: "Mentalidad del correcaminos, Órdenes de Fabricación, JES" },
      { key: "c", label: "Check list, Cumplimiento de estándares, SOS" },
    ],
    correct: "a",
  },
  {
    id: 19, type: "single", modulo: MOD4,
    text: "¿Cuáles son las metas de volumen?",
    options: [
      { key: "a", label: "600 Sets" },
      { key: "b", label: "1050 Sets" },
      { key: "c", label: "800 Sets" },
      { key: "d", label: "400 Sets" },
    ],
    correct: "b", // ⚠️ verifica el resaltado de la diapositiva
  },
  {
    id: 20, type: "single", modulo: MOD4,
    text: "¿Cuál es el cumplimiento al cliente en AGP?",
    options: [
      { key: "a", label: "100%" },
      { key: "b", label: "100% a 85%" },
      { key: "c", label: "75% a 90%" },
    ],
    correct: "a", // ⚠️ verifica el resaltado de la diapositiva
  },

  /* ═════════ MÓDULO 5 — Cultura AGP ═════════ */
  {
    id: 21, type: "single", modulo: MOD5,
    text: "¿Cuál es la misión de AGP?",
    options: [
      { key: "a", label: "Salvar vidas, Construir un mundo más seguro" },
      { key: "b", label: "Ser el mejor en soluciones blindadas transparentes" },
      { key: "c", label: "Cumplimiento de código de prioridades" },
    ],
    correct: "a",
  },
  {
    id: 22, type: "multi", modulo: MOD5,
    text: "¿Cuáles son los valores de AGP?",
    options: [
      { key: "a", label: "Meritocracia" },
      { key: "b", label: "Obsesión por el cliente" },
      { key: "c", label: "Mentalidad de fundador" },
      { key: "d", label: "Soñar en grande" },
      { key: "e", label: "Cumplimiento 100%" },
      { key: "f", label: "Mejora continua" },
      { key: "g", label: "Hacer las cosas rápido sin importar la calidad" },
    ],
    correct: ["a", "b", "c", "d"], // ⚠️ verifica: asumí los 4 valores clásicos de AGP; confirma si "Mejora continua" también va
  },

  /* ═════════ MÓDULO 6 — Conceptos Generales ═════════ */
  {
    id: 23, type: "matrixmulti", modulo: MOD6,
    text: "¿Cuáles son los tipos de cristales? Seleccione los espesores de cada uno",
    columns: [
      { key: "3",  label: "3" }, { key: "4", label: "4" }, { key: "5", label: "5" },
      { key: "8",  label: "8" }, { key: "10", label: "10" }, { key: "6", label: "6" },
    ],
    rows: [
      // ⚠️⚠️ IMPORTANTE: en la presentación NO están marcados los espesores correctos.
      // DEBES completar los arreglos "correct" con los espesores reales de cada cristal.
      { id: "sodalime", label: "Sodalime",  correct: ["3", "4", "5", "6", "8", "10"] }, // ⚠️ COMPLETAR
      { id: "aluminum", label: "Aluminum",  correct: ["3"] },                            // ⚠️ COMPLETAR
      { id: "white",    label: "White",     correct: ["4", "5"] },                       // ⚠️ COMPLETAR
      { id: "grisdark", label: "Gris Dark", correct: ["3", "5"] },                       // ⚠️ COMPLETAR
      { id: "grislig",  label: "Gris Ligth",correct: ["3"] },                            // ⚠️ COMPLETAR
    ],
  },
  {
    id: 24, type: "single", modulo: MOD6,
    text: "¿Qué es Caso 1 en serigrafía?",
    options: [
      { key: "a", label: "BRILLANTE – BRILLANTE" },
      { key: "b", label: "BRILLANTE – OPACO" },
      { key: "c", label: "OPACO – OPACO" },
    ],
    correct: "a",
  },
  {
    id: 25, type: "single", modulo: MOD6,
    text: "¿Qué es Caso 2 en serigrafía?",
    options: [
      { key: "a", label: "BRILLANTE – BRILLANTE" },
      { key: "b", label: "BRILLANTE – OPACO" },
      { key: "c", label: "OPACO – OPACO" },
    ],
    correct: "b",
  },
  {
    id: 26, type: "single", modulo: MOD6,
    text: "¿Qué es offset?",
    options: [
      { key: "a", label: "Distancia entre Vidrio Pintura y Vidrio Paquete" },
      { key: "b", label: "Distancia entre Vidrio Pintura y Banda Negra" },
      { key: "c", label: "La medida de la Banda Negra" },
    ],
    correct: "a",
  },

  /* ═════════ MÓDULO 7 — Calidad ═════════ */
  {
    id: 27, type: "single", modulo: MOD7,
    text: "¿Qué son las zonas de verificación?",
    options: [
      { key: "a", label: "Las diferentes zonas que hay dentro de una pieza, con las cuales fijo criterios de aceptación" },
      { key: "b", label: "La cantidad de partes de mi pieza, uniendo vidrio pintura y paquete" },
      { key: "c", label: "La zona donde sí pasan los rayones y el conductor nunca se va a dar cuenta" },
    ],
    correct: "a",
  },
  {
    id: 28, type: "single", modulo: MOD7,
    text: "¿Qué es y para qué sirve la tabla de criterios de aceptación?",
    options: [
      { key: "a", label: "Son aquellos criterios que me permiten saber qué defecto pasa o no pasa según la zona en la que esté" },
      { key: "b", label: "Tiene la información de personal nuevo y capacitado para la revisión de piezas" },
      { key: "c", label: "Es donde encuentro el compilado de normas" },
    ],
    correct: "a",
  },
  {
    id: 29, type: "matrix", modulo: MOD7,
    text: "Relacione qué significa cada una de las Zonas",
    columns: [
      { key: "alta",  label: "Alta visibilidad para el conductor" },
      { key: "baja",  label: "Baja visibilidad para el conductor" },
      { key: "media", label: "Media visibilidad para el conductor" },
    ],
    rows: [
      { id: "za", label: "A", correct: "alta"  }, // ⚠️ no venía marcada; asumí A=alta, B=media, C=baja — verifica
      { id: "zb", label: "B", correct: "media" }, // ⚠️
      { id: "zc", label: "C", correct: "baja"  }, // ⚠️
    ],
  },
  {
    id: 30, type: "matrix", modulo: MOD7,
    text: "Relacione las Zonas con cada una de las letras asignadas (Parabrisas)",
    image: IMG_PARABRISAS,
    columns: [
      { key: "X", label: "X" }, { key: "Y", label: "Y" }, { key: "Z", label: "Z" },
    ],
    rows: [
      { id: "pa", label: "A", correct: "Y" }, // ⚠️ asumí: Y=zona azul (visión del conductor)=A, X=verde=B, Z=fucsia=C — verifica
      { id: "pb", label: "B", correct: "X" }, // ⚠️
      { id: "pc", label: "C", correct: "Z" }, // ⚠️
    ],
  },
  {
    id: 31, type: "matrix", modulo: MOD7,
    text: "Relacione las Zonas con cada una de las letras asignadas (Laterales Delanteros)",
    image: IMG_LAT_DELANTEROS,
    columns: [
      { key: "M", label: "M" }, { key: "N", label: "N" },
    ],
    rows: [
      { id: "la", label: "A", correct: "N" }, // ⚠️ asumí: N=zona azul=A, M=zona verde=B — verifica
      { id: "lb", label: "B", correct: "M" }, // ⚠️
    ],
  },
  {
    id: 32, type: "matrix", modulo: MOD7,
    text: "Relacione las Zonas con cada una de las letras asignadas (Laterales Traseros)",
    image: IMG_LAT_TRASEROS,
    columns: [
      { key: "H", label: "H" }, { key: "G", label: "G" },
    ],
    rows: [
      { id: "tb", label: "B", correct: "H" }, // ⚠️ asumí: H=zona verde=B, G=zona fucsia=C — verifica
      { id: "tc", label: "C", correct: "G" }, // ⚠️
    ],
  },
  {
    id: 33, type: "matrix", modulo: MOD7,
    text: "¿Cuáles son los 5 pasos, en orden, para interpretar correctamente la tabla de criterios de aceptación?",
    columns: [
      { key: "p1", label: "1 paso" }, { key: "p2", label: "2 paso" }, { key: "p3", label: "3 paso" },
      { key: "p4", label: "4 paso" }, { key: "p5", label: "5 paso" },
    ],
    rows: [
      { id: "ident",   label: "Identificar",           correct: "p1" },
      { id: "ubicar",  label: "Ubicar la zona",        correct: "p2" },
      { id: "medir",   label: "Medir",                 correct: "p3" },
      { id: "comparar",label: "Comparar con la norma", correct: "p4" },
      { id: "decidir", label: "Tomar una decisión",    correct: "p5" },
    ],
  },
  {
    id: 34, type: "single", modulo: MOD7,
    text: "¿Cuáles son las dos variables o características críticas que se controlan en el Plan Control?",
    options: [
      { key: "a", label: "Funcionalidad – Seguridad" },
      { key: "b", label: "Funcionalidad – Movilidad" },
      { key: "c", label: "Mejora – Seguridad" },
    ],
    correct: "a",
  },
  {
    id: 35, type: "single", modulo: MOD7,
    text: "¿Qué significan los símbolos del Plan Control? (triángulo dentro del círculo / rombo)",
    options: [
      { key: "a", label: "Seguridad – Funcionalidad" },
      { key: "b", label: "Advertencia – Metodología" },
      { key: "c", label: "Muestra – Saliente" },
    ],
    correct: "a",
  },
  {
    id: 36, type: "single", modulo: MOD7,
    text: "¿Qué debe hacer cuando encuentre una anomalía en el Check List?",
    options: [
      { key: "a", label: "Informar al capitán o gestor" },
      { key: "b", label: "Corregirla" },
      { key: "c", label: "Anotarla y decirle al siguiente turno cuando entrego" },
    ],
    correct: "a",
  },

  /* ═════════ MÓDULO 8 — Orden de Fabricación ═════════ */
  {
    id: 37, type: "matrix", modulo: MOD8,
    text: "¿Cuáles son los colores de las órdenes de fabricación que manejan en bloque Curvo?",
    columns: [
      { key: "blanca",   label: "Blanca" },
      { key: "verdeflu", label: "Verde (fluorescente)" },
      { key: "amarilla", label: "Amarilla" },
    ],
    rows: [
      { id: "bandanegra",    label: "Banda Negra",     correct: "blanca"   }, // ⚠️ no venía marcada; asumí el orden de las listas — verifica
      { id: "antilacerativo",label: "Antilacerativo",  correct: "verdeflu" }, // ⚠️
      { id: "boroalum",      label: "Boro o Aluminum", correct: "amarilla" }, // ⚠️
    ],
  },
  {
    id: 38, type: "matrix", modulo: MOD8,
    text: "¿Cuáles son los colores de las órdenes de fabricación que manejan en bloque Plano?",
    columns: [
      { key: "azul",     label: "Azul" },
      { key: "rojo",     label: "Rojo" },
      { key: "rosa",     label: "Rosa" },
      { key: "verdeop",  label: "Verde (opaco)" },
      { key: "blanca",   label: "Blanca" },
      { key: "amarilla", label: "Amarilla" },
    ],
    rows: [
      { id: "litesnuevos", label: "Lites nuevos",     correct: "azul"     }, // ⚠️ no venía marcada; asumí el orden de las listas — verifica
      { id: "rechazos",    label: "Rechazos",         correct: "rojo"     }, // ⚠️
      { id: "redes",       label: "Redes o antenas",  correct: "rosa"     }, // ⚠️
      { id: "bninterna",   label: "Banda N. interna", correct: "verdeop"  }, // ⚠️
      { id: "bnexterna",   label: "Banda N. Externa", correct: "blanca"   }, // ⚠️
      { id: "boroalum2",   label: "Boro o Aluminum",  correct: "amarilla" }, // ⚠️
    ],
  },
  {
    id: 39, type: "matrix", modulo: MOD8,
    text: "Relacione el nombre de cada abreviatura",
    columns: [
      { key: "vext", label: "VEXT" }, { key: "vpo", label: "VPO" },
      { key: "vpro", label: "VPRO" }, { key: "vtpa", label: "VTPA" },
    ],
    rows: [
      { id: "vexterno",   label: "Vidrio Externo",   correct: "vext" },
      { id: "vpaquete",   label: "Vidrio Paquete",   correct: "vpo"  },
      { id: "vprotector", label: "Vidrio Protector", correct: "vpro" },
      { id: "vtapa",      label: "Vidrio Tapa",      correct: "vtpa" },
    ],
  },
];

/* =========================================================
   CONSTANTES MATRIZ
========================================================= */
const MIN_PASS_SCORE  = 80;
const MATRIX_LABEL_W  = scaleDP(150);
const MATRIX_COL_W    = scaleDP(72);
const MATRIX_ROW_H    = scaleDP(40);
const MATRIX_FONT     = scaleDP(11);
const MATRIX_HEADER_F = scaleDP(10);
const MATRIX_RADIO    = scaleDP(16);
const MATRIX_RADIO_IN = scaleDP(8);

/* =========================================================
   COMPONENTE PRINCIPAL
========================================================= */
export default function EvaluacionFinalGeneral() {
  const router = useRouter();

  const [usuarioKey,       setUsuarioKey]       = useState<number | null>(null);
  const [numeroOnboarding, setNumeroOnboarding] = useState<number | null>(null);
  const [savedPct,         setSavedPct]         = useState<number>(0);
  const [showIntro,        setShowIntro]        = useState(true);
  const [showGame,         setShowGame]         = useState(false);
  const [qIndex,           setQIndex]           = useState(0);
  const [questions,        setQuestions]        = useState<Question[]>([]);
  const [answersSingle,    setAnswersSingle]    = useState<Record<number, KeyOpt | undefined>>({});
  const [answersMulti,     setAnswersMulti]     = useState<Record<number, KeyOpt[]>>({});
  const [answersMatrix,    setAnswersMatrix]    = useState<Record<number, Record<string, MatrixColumn | undefined>>>({});
  const [answersMatrixMulti, setAnswersMatrixMulti] = useState<Record<number, Record<string, MatrixColumn[]>>>({});
  const [showResult,       setShowResult]       = useState(false);
  const [score,            setScore]            = useState(0);
  const [showPodio,        setShowPodio]        = useState(false);
  const [players,          setPlayers]          = useState<Player[]>([]);
  const [podioLoading,     setPodioLoading]     = useState(false);
  const [showIncomplete,   setShowIncomplete]   = useState(false);
  const [missingCount,     setMissingCount]     = useState(0);
  const [reintentoPendiente, setReintentoPendiente] = useState(false);

  const transOpacity = useRef(new Animated.Value(1)).current;
  const transX       = useRef(new Animated.Value(0)).current;
  const transScale   = useRef(new Animated.Value(1)).current;
  const [transitioning, setTransitioning] = useState(false);

  const current = useMemo(() => questions[qIndex], [questions, qIndex]);
  const isLast  = qIndex === questions.length - 1;
  const passed  = score >= MIN_PASS_SCORE;

  /* ── Cargar sesión ── */
  useEffect(() => {
    (async () => {
      const ukMain  = await AsyncStorage.getItem("USUARIO_KEY");
      const ukLeg   = await AsyncStorage.getItem("usuarioKey");
      const no      = await AsyncStorage.getItem("numeroOnboarding");
      const uKey    = Number(ukMain || ukLeg || 0);
      const nOn     = Number(no || 0);
      const finalUk = Number.isFinite(uKey) && uKey > 0 ? uKey : null;
      setUsuarioKey(finalUk);
      setNumeroOnboarding(Number.isFinite(nOn) && nOn > 0 ? nOn : null);
      if (finalUk) {
        const evaDone  = await AsyncStorage.getItem(`u:${finalUk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`);
        const evaScore = await AsyncStorage.getItem(`u:${finalUk}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`);
        if (evaDone === "true") {
          const pct = evaScore ? Number(evaScore) : 0;
          setSavedPct(Number.isFinite(pct) ? pct : 0); setScore(pct); setShowIntro(false); setShowResult(true);
        }
        try {
          const r = await apiJson(`${API_BASE}/evaluacionFinal/resultado/${finalUk}/${NIVEL_KEY}`);
          const pct = Number(r?.data?.puntaje ?? 0);
          if (pct > 0) setSavedPct(Number.isFinite(pct) ? pct : 0);
          if (r?.data?.reintentoHabilitado) {
            setReintentoPendiente(true);
            setShowResult(false);
            setShowIntro(true);
          }
        } catch { setSavedPct(0); }
      }
    })();
  }, []);

  async function apiJson(url: string, options?: RequestInit) {
    const res  = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...(options?.headers || {}) } });
    const text = await res.text();
    let data: any = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!res.ok) throw new Error(data?.message || data?.error || `Error HTTP ${res.status}`);
    return data;
  }

  /* ── Iniciar juego ── */
  const startGame = () => {
    if (reintentoPendiente && usuarioKey) {
      AsyncStorage.multiRemove([
        `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`,
        `u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`,
      ]);
      apiJson(`${API_BASE}/evaluacionFinal/reintento/consumir`, {
        method: "POST",
        body: JSON.stringify({ usuarioKey, nivelKey: NIVEL_KEY }),
      }).catch(() => {});
      setReintentoPendiente(false);
    }
    const shuffled = QUESTIONS_BASE.map((q) => shuffleQuestion(q));
    setQuestions(shuffled);
    setAnswersSingle({}); setAnswersMulti({}); setAnswersMatrix({}); setAnswersMatrixMulti({});
    setQIndex(0); setShowIntro(false); setShowGame(true);
  };

  /* ── Selección ── */
  const selectSingle = (qId: number, opt: KeyOpt) => setAnswersSingle((p) => ({ ...p, [qId]: opt }));
  const toggleMulti  = (qId: number, opt: KeyOpt) =>
    setAnswersMulti((p) => { const cur = p[qId] || []; return { ...p, [qId]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] }; });
  const selectMatrix = (qId: number, rowId: string, col: MatrixColumn) =>
    setAnswersMatrix((p) => ({ ...p, [qId]: { ...(p[qId] || {}), [rowId]: col } }));
  const toggleMatrixMulti = (qId: number, rowId: string, col: MatrixColumn) =>
    setAnswersMatrixMulti((p) => {
      const q   = p[qId] || {};
      const cur = q[rowId] || [];
      const next = cur.includes(col) ? cur.filter((x) => x !== col) : [...cur, col];
      return { ...p, [qId]: { ...q, [rowId]: next } };
    });

  /* ── Animación navegación ── */
  const animateChange = (dir: "next" | "prev", onMid: () => void) => {
    if (transitioning) return;
    setTransitioning(true);
    const sign = dir === "next" ? -1 : 1;
    Animated.parallel([
      Animated.timing(transOpacity, { toValue: 0, duration: 160, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(transX,       { toValue: sign * 48, duration: 160, useNativeDriver: true }),
      Animated.timing(transScale,   { toValue: 0.97, duration: 160, useNativeDriver: true }),
    ]).start(() => {
      onMid();
      transOpacity.setValue(0); transX.setValue(-sign * 48); transScale.setValue(0.97);
      Animated.parallel([
        Animated.timing(transOpacity, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(transX,       { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.spring(transScale,   { toValue: 1, useNativeDriver: true, friction: 6, tension: 60 }),
      ]).start(() => setTransitioning(false));
    });
  };

  const goNext = () => { if (qIndex < questions.length - 1 && !transitioning) animateChange("next", () => setQIndex((i) => i + 1)); };
  const goPrev = () => { if (qIndex > 0 && !transitioning) animateChange("prev", () => setQIndex((i) => i - 1)); };

  /* ── Verificaciones ── */
  const isQuestionAnswered = (q: Question): boolean => {
    if (q.type === "single") return !!answersSingle[q.id];
    if (q.type === "multi")  return (answersMulti[q.id] || []).length > 0;
    if (q.type === "matrix") { const ans = answersMatrix[q.id] || {}; return q.rows.every((r) => !!ans[r.id]); }
    if (q.type === "matrixmulti") { const ans = answersMatrixMulti[q.id] || {}; return q.rows.every((r) => (ans[r.id] || []).length > 0); }
    return false;
  };

  const sameSet = (a: string[], b: string[]) =>
    a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

  const isMultiCorrect  = (sel: KeyOpt[], cor: KeyOpt[]) => sameSet(sel, cor);
  const isMatrixCorrect = (qId: number, rows: MatrixRow[]) => { const ans = answersMatrix[qId] || {}; return rows.every((r) => ans[r.id] === r.correct); };
  const isMatrixMultiCorrect = (qId: number, rows: MatrixMultiRow[]) => {
    const ans = answersMatrixMulti[qId] || {};
    return rows.every((r) => sameSet(ans[r.id] || [], r.correct));
  };

  /* ── Guardar en BD ── */
  const saveScoreToDB = async (pct: number) => {
    if (!usuarioKey) throw new Error("No se encontró USUARIO_KEY en la sesión.");
    await apiJson(`${API_BASE}/evaluacionFinal/resultado`, { method: "POST", body: JSON.stringify({ usuarioKey, nivelKey: NIVEL_KEY, islaKey: ISLA_KEY, puntaje: pct }) });
    await AsyncStorage.multiSet([
      [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_done`,  "true"],
      [`u:${usuarioKey}:isla${ISLA_KEY}_nivel${NIVEL_KEY}_evaluacion_score`, String(pct)],
    ]);
    setSavedPct(pct);
  };

  /* ── Calcular score ── */
  const calcularScore = async () => {
    let aciertos = 0;
    questions.forEach((q) => {
      if (q.type === "single"      && answersSingle[q.id] === q.correct) aciertos++;
      if (q.type === "multi"       && isMultiCorrect(answersMulti[q.id] || [], q.correct)) aciertos++;
      if (q.type === "matrix"      && isMatrixCorrect(q.id, q.rows)) aciertos++;
      if (q.type === "matrixmulti" && isMatrixMultiCorrect(q.id, q.rows)) aciertos++;
    });
    const pct = Math.round((aciertos / questions.length) * 100);
    setScore(pct); setShowGame(false); setShowResult(true);
    try { await saveScoreToDB(pct); } catch (e: any) { Alert.alert("Ups", e?.message || "No se pudo guardar tu puntaje."); }
  };

  const handleFinish = () => {
    const unanswered = questions.filter((q) => !isQuestionAnswered(q)).length;
    if (unanswered > 0) { setMissingCount(unanswered); setShowIncomplete(true); return; }
    calcularScore();
  };

  /* ── Reset ── */
  const resetAll = () => {
    setQIndex(0); setAnswersSingle({}); setAnswersMulti({}); setAnswersMatrix({}); setAnswersMatrixMulti({});
    setScore(0); setShowResult(false); setShowIncomplete(false); setMissingCount(0);
    setShowPodio(false); setShowIntro(true); setShowGame(false); setPlayers([]); setQuestions([]);
    transOpacity.setValue(1); transX.setValue(0); transScale.setValue(1);
  };

  /* ── Cargar podio ── */
  const loadPodio = async () => {
    let nOn = numeroOnboarding;
    if (!nOn) { const raw = await AsyncStorage.getItem("numeroOnboarding"); nOn = raw ? Number(raw) : null; if (nOn && nOn > 0) setNumeroOnboarding(nOn); }
    if ((!nOn || nOn <= 0) && usuarioKey) {
      try {
        const res = await fetch(`${API_USUARIOS}/${usuarioKey}`); const data = await res.json();
        nOn = Number(data?.data?.USUARIO_NUMERO_ONBOARDING ?? 0);
        if (nOn > 0) { setNumeroOnboarding(nOn); await AsyncStorage.setItem("numeroOnboarding", String(nOn)); }
      } catch { nOn = null; }
    }
    if (!nOn || nOn <= 0) { Alert.alert("Sin grupo", "No se encontró el número de onboarding."); return; }
    try {
      setPodioLoading(true);
      const r = await apiJson(`${API_BASE}/evaluacionFinal/podio-isla?islaKey=${ISLA_KEY}&numeroOnboarding=${nOn}`);
      setPlayers((r?.data || []).map((row: any, idx: number) => ({ id: String(row.usuarioKey ?? idx), nombre: row.nombre ?? "Sin nombre", puntaje: row.puntaje != null ? Number(row.puntaje) : null })));
    } catch (e: any) { Alert.alert("Error al cargar podio", e?.message || "No se pudo cargar."); setPlayers([]); }
    finally { setPodioLoading(false); }
  };

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => {
    if (a.puntaje == null && b.puntaje == null) return 0;
    if (a.puntaje == null) return 1;
    if (b.puntaje == null) return -1;
    return b.puntaje - a.puntaje;
  }), [players]);

  const top3 = sortedPlayers.filter(p => p.puntaje != null).slice(0, 3);

  const getMedal = (index: number) => {
    if (index === 0) return "🥇";
    if (index === 1) return "🥈";
    if (index === 2) return "🥉";
    return `#${index + 1}`;
  };

  /* =========================================================
     RENDERERS
  ========================================================= */
  const renderModuloBadge = (q: Question) => (
    <Text style={st.moduloBadge}>Módulo {q.modulo.num} · {q.modulo.nombre}</Text>
  );

  const renderImage = (q: Question) =>
    q.image ? (
      <Image source={q.image} style={st.questionImage} resizeMode="contain" />
    ) : null;

  const renderSingle = (q: SingleQuestion) => (
    <>
      {renderModuloBadge(q)}
      <Text style={st.question}>{q.text}</Text>
      {renderImage(q)}
      {q.options.map((op) => {
        const sel = answersSingle[q.id] === op.key;
        return (
          <TouchableOpacity key={op.key} onPress={() => selectSingle(q.id, op.key)} activeOpacity={0.9}
            style={[st.optionRow, sel && st.optionRowSelected]}>
            <Text style={[st.optionLabel, sel && st.optionLabelSelected]}>{op.label}</Text>
          </TouchableOpacity>
        );
      })}
    </>
  );

  const renderMulti = (q: MultiQuestion) => {
    const selList = answersMulti[q.id] || [];
    return (
      <>
        {renderModuloBadge(q)}
        <Text style={st.question}>{q.text}</Text>
        {renderImage(q)}
        <Text style={st.helperText}>Selecciona una o varias opciones</Text>
        <View style={st.multiGrid}>
          {q.options.map((op) => {
            const sel = selList.includes(op.key);
            return (
              <TouchableOpacity key={op.key} onPress={() => toggleMulti(q.id, op.key)} activeOpacity={0.9}
                style={[st.multiOption, sel && st.optionRowSelected]}>
                <View style={[st.checkboxFake, sel && st.checkboxFakeSelected]}>
                  {sel && <Text style={st.checkboxTick}>✓</Text>}
                </View>
                <Text style={[st.multiOptionLabel, sel && st.optionLabelSelected]}>{op.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </>
    );
  };

  const renderMatrix = (q: MatrixQuestion) => {
    const matAns = answersMatrix[q.id] || {};
    return (
      <>
        {renderModuloBadge(q)}
        <Text style={st.question}>{q.text}</Text>
        {renderImage(q)}
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: scaleDP(6), width: "100%" }} contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center" }}>
          <View>
            <View style={st.mxHeaderRow}>
              <View style={{ width: MATRIX_LABEL_W }} />
              {q.columns.map((col) => (
                <View key={col.key} style={st.mxColHeader}>
                  <Text style={st.mxHeaderText}>{col.label}</Text>
                </View>
              ))}
            </View>
            {q.rows.map((row, i) => {
              const answered = !!matAns[row.id];
              return (
                <View key={row.id} style={[st.mxRow, i % 2 === 0 && st.mxRowAlt]}>
                  <View style={[st.mxLabelCell, answered && st.mxLabelAnswered]}>
                    <Text style={st.mxLabelText}>{row.label}</Text>
                  </View>
                  {q.columns.map((col) => {
                    const sel = matAns[row.id] === col.key;
                    return (
                      <TouchableOpacity key={col.key} style={st.mxOptionCell} activeOpacity={0.75} onPress={() => selectMatrix(q.id, row.id, col.key)}>
                        <View style={[st.mxRadioOuter, sel && st.mxRadioOuterSel]}>
                          {sel && <View style={st.mxRadioInner} />}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  };

  const renderMatrixMulti = (q: MatrixMultiQuestion) => {
    const matAns = answersMatrixMulti[q.id] || {};
    return (
      <>
        {renderModuloBadge(q)}
        <Text style={st.question}>{q.text}</Text>
        {renderImage(q)}
        <Text style={st.helperText}>Cada fila puede tener varias opciones seleccionadas</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={true} style={{ marginTop: scaleDP(6), width: "100%" }} contentContainerStyle={{ alignItems: "center", flexGrow: 1, justifyContent: "center" }}>
          <View>
            <View style={st.mxHeaderRow}>
              <View style={{ width: MATRIX_LABEL_W }} />
              {q.columns.map((col) => (
                <View key={col.key} style={st.mxColHeader}>
                  <Text style={st.mxHeaderText}>{col.label}</Text>
                </View>
              ))}
            </View>
            {q.rows.map((row, i) => {
              const selCols = matAns[row.id] || [];
              return (
                <View key={row.id} style={[st.mxRow, i % 2 === 0 && st.mxRowAlt]}>
                  <View style={[st.mxLabelCell, selCols.length > 0 && st.mxLabelAnswered]}>
                    <Text style={st.mxLabelText}>{row.label}</Text>
                  </View>
                  {q.columns.map((col) => {
                    const sel = selCols.includes(col.key);
                    return (
                      <TouchableOpacity key={col.key} style={st.mxOptionCell} activeOpacity={0.75} onPress={() => toggleMatrixMulti(q.id, row.id, col.key)}>
                        <View style={[st.mxCheckOuter, sel && st.mxCheckOuterSel]}>
                          {sel && <Text style={st.mxCheckTick}>✓</Text>}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })}
          </View>
        </ScrollView>
      </>
    );
  };

  const renderQuestion = () => {
    if (!current) return null;
    if (current.type === "single")      return renderSingle(current);
    if (current.type === "multi")       return renderMulti(current);
    if (current.type === "matrix")      return renderMatrix(current);
    if (current.type === "matrixmulti") return renderMatrixMulti(current);
    return null;
  };

  /* =========================================================
     RENDER PRINCIPAL
  ========================================================= */
  return (
    <ImageBackground source={fondo} style={st.background} resizeMode="cover">
      <View style={st.backdrop} />

      {/* ── INTRO ── */}
      {showIntro && (
        <View style={st.header}>
          <View style={st.introBox}>
            <Text style={st.tituloIntro}>Evaluación Final AGP</Text>
            <Text style={st.descripcionIntro}>
              ¡Llegaste al final de tu recorrido de onboarding! 🎓{"\n\n"}
              Esta evaluación general reúne los 8 módulos: HSE, Metrología, Codificación de piezas (I y II), Cultura AGP, Conceptos Generales, Calidad y Orden de Fabricación.{"\n\n"}
              Puedes moverte entre las preguntas con los botones de navegación y revisar tus respuestas antes de finalizar.
            </Text>
            <TouchableOpacity style={st.playButton} onPress={startGame}>
              <Text style={st.playButtonText}>Comenzar</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── JUEGO ── */}
      {showGame && current && (
        <View style={st.gameContainer}>
          <Text style={st.progress}>Pregunta {qIndex + 1} / {questions.length}</Text>
          <View style={st.cardWrap}>
            <Animated.View style={[st.card, { opacity: transOpacity, transform: [{ translateX: transX }, { scale: transScale }] }]}>
              <ScrollView style={{ flexGrow: 0 }} contentContainerStyle={st.cardInner} showsVerticalScrollIndicator={false}>
                {renderQuestion()}
              </ScrollView>
            </Animated.View>
          </View>
          <View style={st.navRow}>
            <TouchableOpacity onPress={goPrev} disabled={qIndex === 0 || transitioning}
              style={[st.navBtn, { backgroundColor: "#B2B2B2" }, (qIndex === 0 || transitioning) && st.navBtnDisabled]} activeOpacity={0.8}>
              <Text style={st.navBtnText}>Anterior</Text>
            </TouchableOpacity>
            {!isLast && (
              <TouchableOpacity onPress={goNext} disabled={transitioning}
                style={[st.navBtn, { backgroundColor: "#4C92E4" }, transitioning && st.navBtnDisabled]} activeOpacity={0.8}>
                <Text style={st.navBtnText}>Siguiente</Text>
              </TouchableOpacity>
            )}
            {isLast && (
              <TouchableOpacity onPress={handleFinish} style={[st.navBtn, { backgroundColor: "#4C92E4" }]} activeOpacity={0.9}>
                <Text style={st.navBtnText}>Continuar</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ── RESPUESTAS INCOMPLETAS ── */}
      {showIncomplete && (
        <View style={st.overlay}>
          <View style={st.modalBoxSmall}>
            <Text style={st.modalTitleSmall}>Te faltan respuestas</Text>
            <Text style={st.modalDescSmall}>
              Aún tienes {missingCount} pregunta{missingCount === 1 ? "" : "s"} sin responder.{"\n"}Revisa y completa todas antes de finalizar.
            </Text>
            <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(14) }]} onPress={() => setShowIncomplete(false)}>
              <Text style={st.modalBtnText}>Entendido</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── RESULTADO ── */}
      {showResult && (
        <View style={st.overlay}>
          <View style={st.resultAlertBox}>
            <Text style={st.scoreBig}>{savedPct > 0 ? savedPct : score}%</Text>
            <Text style={st.resultMainText}>
              {passed ? "¡Excelente! Has aprobado la evaluación final de todo el onboarding 🎉"
                : score >= 60 ? "Vas por buen camino, pero aún puedes mejorar tu resultado."
                : "Tu resultado está por debajo de lo esperado. Puedes repetir la evaluación para reforzar los conceptos."}
            </Text>
            <View style={st.resultRow}>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#10B981", marginTop: scaleDP(18) }]} onPress={resetAll}>
                <Text style={st.modalBtnText}>Reintentar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#4C92E4", marginTop: scaleDP(18) }]} onPress={() => router.push(RUTA_VOLVER as any)}>
                <Text style={st.modalBtnText}>Volver al mapa</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={[st.modalBtn, { backgroundColor: "#FACC15", marginTop: scaleDP(18), alignSelf: "stretch" }]} disabled={podioLoading}
              onPress={async () => { setShowResult(false); setShowPodio(true); await loadPodio(); }}>
              <Text style={[st.modalBtnText, { color: "#78350F" }]}>{podioLoading ? "Cargando podio..." : "Ver podio 🏆"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ── PODIO ── */}
      {showPodio && (
        <View style={st.overlay}>
          <View style={st.podioBox}>
            <View style={st.podioHeader}>
              <Text style={st.podioTitle}>🏆 Podio Evaluación Final AGP</Text>
              <Text style={st.podioSubtitle}>{numeroOnboarding ? `Grupo onboarding #${numeroOnboarding}` : "Clasificación del grupo"}</Text>
            </View>
            {top3.length > 0 && (
              <View style={st.top3Container}>
                {top3[1] && (
                  <View style={[st.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(40) }]}>🥈</Text>
                    <Text style={st.medalName} numberOfLines={1}>{top3[1].nombre}</Text>
                    <Text style={st.medalScore}>{top3[1].puntaje}%</Text>
                  </View>
                )}
                {top3[0] && (
                  <View style={[st.medalBox, { marginTop: 0 }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(50) }]}>🥇</Text>
                    <Text style={[st.medalName, { fontSize: scaleDP(18) }]} numberOfLines={1}>{top3[0].nombre}</Text>
                    <Text style={[st.medalScore, { fontSize: scaleDP(24) }]}>{top3[0].puntaje}%</Text>
                  </View>
                )}
                {top3[2] && (
                  <View style={[st.medalBox, { marginTop: scaleDP(20) }]}>
                    <Text style={[st.medalEmoji, { fontSize: scaleDP(34) }]}>🥉</Text>
                    <Text style={st.medalName} numberOfLines={1}>{top3[2].nombre}</Text>
                    <Text style={st.medalScore}>{top3[2].puntaje}%</Text>
                  </View>
                )}
              </View>
            )}
            <Text style={st.podioListTitle}>Todos los participantes</Text>
            <ScrollView style={st.podioList} contentContainerStyle={{ paddingBottom: scaleDP(10) }} showsVerticalScrollIndicator={false}>
              {podioLoading ? (
                <Text style={st.podioEmpty}>Cargando...</Text>
              ) : sortedPlayers.length === 0 ? (
                <Text style={st.podioEmpty}>Aún no hay resultados en tu grupo.</Text>
              ) : (
                sortedPlayers.map((p, idx) => (
                  <View key={p.id} style={st.playerRow}>
                    <Text style={st.playerRank}>{getMedal(idx)}</Text>
                    <Text style={st.playerName} numberOfLines={1}>{p.nombre}</Text>
                    {p.puntaje != null
                      ? <Text style={st.playerScore}>{p.puntaje}%</Text>
                      : <Text style={st.playerNoResponse}>Aún no responde</Text>}
                  </View>
                ))
              )}
            </ScrollView>
            <View style={{ flexDirection: "row", gap: scaleDP(10), marginTop: scaleDP(14) }}>
              <TouchableOpacity style={[st.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]} onPress={() => { setShowPodio(false); setShowResult(true); }}>
                <Text style={st.podioBtnText}>Volver</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[st.podioBtn, { backgroundColor: "#a3ecf1", flex: 1 }]} onPress={() => router.push("/mapa" as any)}>
                <Text style={st.podioBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </ImageBackground>
  );
}

/* =========================================================
   ESTILOS — idénticos al código guía (+ badge de módulo,
   imagen de pregunta y checkbox de matriz múltiple)
========================================================= */
const st = StyleSheet.create({
  background: { flex: 1, width: "100%", height: "100%" },
  backdrop:   { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(255,255,255,0.35)" },
  header:     { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(30) },
  introBox:   { backgroundColor: "rgba(143, 197, 207, 0.85)", paddingVertical: scaleDP(40), paddingHorizontal: scaleDP(40), borderRadius: scaleDP(25), alignItems: "center", maxWidth: "90%", shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 15, shadowOffset: { width: 0, height: 4 } },
  tituloIntro:      { fontFamily: "PlusJakartaSans-Bold",    fontSize: scaleDP(50), color: "#fff", textAlign: "center", marginBottom: scaleDP(16) },
  descripcionIntro: { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(25), color: "#fff", textAlign: "center", lineHeight: scaleDP(25) },
  playButton:       { marginTop: scaleDP(30), backgroundColor: "#4C92E4", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(50), borderRadius: scaleDP(16) },
  playButtonText:   { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30) },

  gameContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: scaleDP(30), paddingVertical: scaleDP(16) },
  progress:      { fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(14), color: "#0F1B4C", marginBottom: scaleDP(8) },
  cardWrap:      { width: "90%", maxWidth: 1200, maxHeight: "78%" },
  card:          { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: scaleDP(16), borderWidth: scaleDP(2), borderColor: "#E5E7EB", elevation: 8, overflow: "hidden" },
  cardInner:     { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(14), gap: scaleDP(6) },

  moduloBadge: {
    fontFamily: "PlusJakartaSans-Bold",
    fontSize: scaleDP(12),
    color: "#1E40AF",
    textAlign: "center",
    backgroundColor: "#EFF6FF",
    borderWidth: scaleDP(1),
    borderColor: "#BFDBFE",
    borderRadius: scaleDP(20),
    paddingVertical: scaleDP(4),
    paddingHorizontal: scaleDP(12),
    alignSelf: "center",
    marginBottom: scaleDP(6),
    overflow: "hidden",
  },

  questionImage: {
    width: "100%",
    height: scaleDP(200),
    marginVertical: scaleDP(6),
    alignSelf: "center",
  },

  question:            { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(20), color: "#0F1B4C", textAlign: "center", marginBottom: scaleDP(6) },
  optionRow:           { borderWidth: scaleDP(2), borderColor: "#D1D5DB", backgroundColor: "#F9FAFB", paddingVertical: scaleDP(10), paddingHorizontal: scaleDP(14), borderRadius: scaleDP(12) },
  optionRowSelected:   { borderColor: "#4C92E4", backgroundColor: "#E0EDFF" },
  optionLabel:         { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(15), color: "#111827", textAlign: "center" },
  optionLabelSelected: { fontFamily: "PlusJakartaSans-Bold", color: "#0F1B4C" },

  helperText:    { fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(16), color: "#4B5563", textAlign: "center", marginBottom: scaleDP(4) },
  multiGrid:     { flexDirection: "row", flexWrap: "wrap", gap: scaleDP(8) },
  multiOption:   { flexDirection: "row", alignItems: "center", gap: scaleDP(8), width: "48%", borderWidth: scaleDP(2), borderColor: "#D1D5DB", backgroundColor: "#F9FAFB", paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(10), borderRadius: scaleDP(12) },
  multiOptionLabel:     { flex: 1, fontFamily: "PlusJakartaSans-Regular", fontSize: scaleDP(14), color: "#111827" },
  checkboxFake:         { width: scaleDP(26), height: scaleDP(26), borderRadius: scaleDP(8), borderWidth: scaleDP(2), borderColor: "#9CA3AF", backgroundColor: "#fff", alignItems: "center", justifyContent: "center", flexShrink: 0 },
  checkboxFakeSelected: { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },
  checkboxTick:         { color: "#fff", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(16), lineHeight: scaleDP(18) },

  mxHeaderRow:   { flexDirection: "row", backgroundColor: "#EFF6FF", borderBottomWidth: scaleDP(1.5), borderBottomColor: "#BFDBFE" },
  mxColHeader:   { width: MATRIX_COL_W, paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(2), alignItems: "center", justifyContent: "flex-end", borderLeftWidth: scaleDP(1), borderLeftColor: "#DBEAFE" },
  mxHeaderText:  { fontFamily: "PlusJakartaSans-Bold", fontSize: MATRIX_HEADER_F, color: "#1E40AF", textAlign: "center" },
  mxRow:         { flexDirection: "row", minHeight: MATRIX_ROW_H, borderBottomWidth: scaleDP(1), borderBottomColor: "#E5E7EB", backgroundColor: "#fff" },
  mxRowAlt:      { backgroundColor: "#F9FAFB" },
  mxLabelCell:   { width: MATRIX_LABEL_W, paddingVertical: scaleDP(8), paddingHorizontal: scaleDP(10), justifyContent: "center", borderRightWidth: scaleDP(1.5), borderRightColor: "#BFDBFE" },
  mxLabelAnswered:{ borderRightColor: "#4C92E4" },
  mxLabelText:   { fontFamily: "PlusJakartaSans-Regular", fontSize: MATRIX_FONT, color: "#111827" },
  mxOptionCell:  { width: MATRIX_COL_W, alignItems: "center", justifyContent: "center", borderLeftWidth: scaleDP(1), borderLeftColor: "#E5E7EB" },
  mxRadioOuter:  { width: MATRIX_RADIO, height: MATRIX_RADIO, borderRadius: MATRIX_RADIO / 2, borderWidth: scaleDP(1.5), borderColor: "#9CA3AF", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  mxRadioOuterSel:{ borderColor: "#4C92E4", backgroundColor: "#EFF6FF" },
  mxRadioInner:  { width: MATRIX_RADIO_IN, height: MATRIX_RADIO_IN, borderRadius: MATRIX_RADIO_IN / 2, backgroundColor: "#4C92E4" },

  // Checkbox para matriz múltiple (cristales / espesores)
  mxCheckOuter: {
    width: scaleDP(20), height: scaleDP(20), borderRadius: scaleDP(5),
    borderWidth: scaleDP(1.5), borderColor: "#9CA3AF", backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  mxCheckOuterSel: { backgroundColor: "#4C92E4", borderColor: "#4C92E4" },
  mxCheckTick:     { color: "#fff", fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(13), lineHeight: scaleDP(15) },

  navRow:         { flexDirection: "row", justifyContent: "center", gap: scaleDP(16), marginTop: scaleDP(18), width: "60%" },
  navBtn:         { flex: 1, paddingVertical: scaleDP(10), borderRadius: scaleDP(12), alignItems: "center" },
  navBtnDisabled: { opacity: 0.4 },
  navBtnText:     { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(16) },

  overlay:         { position: "absolute", inset: 0 as any, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", paddingHorizontal: scaleDP(24) },
  modalBoxSmall:   { backgroundColor: "#fff", borderRadius: scaleDP(16), paddingVertical: scaleDP(18), paddingHorizontal: scaleDP(22), alignItems: "center", elevation: 8, maxWidth: "80%" },
  modalTitleSmall: { fontFamily: "PlusJakartaSans-ExtraBold", fontSize: scaleDP(60), color: "#0F1B4C", marginBottom: scaleDP(8), textAlign: "center" },
  modalDescSmall:  { fontFamily: "PlusJakartaSans-Regular",   fontSize: scaleDP(40), color: "#111827", textAlign: "center" },
  resultAlertBox:  { backgroundColor: "#77b479", paddingVertical: scaleDP(22), paddingHorizontal: scaleDP(35), borderRadius: scaleDP(20), elevation: 10, maxWidth: "80%", alignItems: "center" },
  scoreBig:        { fontFamily: "PlusJakartaSans-ExtraBold", color: "#fff", fontSize: scaleDP(80), marginBottom: scaleDP(12) },
  resultMainText:  { fontFamily: "PlusJakartaSans-Bold", color: "#fff", fontSize: scaleDP(40), textAlign: "center" },
  resultRow:       { marginTop: scaleDP(16), flexDirection: "row", gap: scaleDP(10) },
  modalBtn:        { paddingVertical: scaleDP(12), paddingHorizontal: scaleDP(18), borderRadius: scaleDP(10) },
  modalBtnText:    { color: "#fff", fontFamily: "PlusJakartaSans-Bold", fontSize: scaleDP(30), textAlign: "center" },

  podioBox:      { backgroundColor: "#1a1a2e", padding: scaleDP(20), borderRadius: scaleDP(20), maxWidth: "90%", width: "90%", elevation: 10 },
  podioHeader:   { alignItems: "center", marginBottom: scaleDP(16) },
  podioTitle:    { fontSize: scaleDP(24), fontWeight: "bold", color: "#a3ecf1", textAlign: "center" },
  podioSubtitle: { fontSize: scaleDP(14), color: "#AAAAAA", marginTop: scaleDP(4) },
  top3Container: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", marginBottom: scaleDP(16) },
  medalBox:      { alignItems: "center", marginHorizontal: scaleDP(10), padding: scaleDP(14), borderRadius: scaleDP(14), backgroundColor: "rgba(255,255,255,0.1)", minWidth: scaleDP(90) },
  medalEmoji:    { marginBottom: scaleDP(4) },
  medalName:     { color: "#FFFFFF", fontSize: scaleDP(13), fontWeight: "bold", textAlign: "center" },
  medalScore:    { color: "#a3ecf1", fontSize: scaleDP(16), fontWeight: "bold", marginTop: scaleDP(4) },
  podioListTitle:   { color: "#AAAAAA", fontSize: scaleDP(12), fontWeight: "bold", marginBottom: scaleDP(6), textTransform: "uppercase", letterSpacing: 1 },
  podioList:        { maxHeight: scaleDP(180), marginBottom: scaleDP(8) },
  podioEmpty:       { color: "#9CA3AF", fontSize: scaleDP(12), textAlign: "center", paddingVertical: scaleDP(14) },
  playerRow:        { flexDirection: "row", alignItems: "center", padding: scaleDP(10), backgroundColor: "rgba(255,255,255,0.05)", borderRadius: scaleDP(10), marginBottom: scaleDP(6) },
  playerRank:       { color: "#FFFFFF", fontSize: scaleDP(14), fontWeight: "bold", width: scaleDP(36) },
  playerName:       { color: "#FFFFFF", fontSize: scaleDP(14), flex: 1 },
  playerScore:      { color: "#a3ecf1", fontSize: scaleDP(14), fontWeight: "bold" },
  playerNoResponse: { color: "#6B7280", fontSize: scaleDP(11), fontStyle: "italic" },
  podioBtn:         { paddingVertical: scaleDP(10), borderRadius: scaleDP(10), alignItems: "center" },
  podioBtnText:     { color: "#1a1a2e", fontWeight: "bold", fontSize: scaleDP(14) },
});
