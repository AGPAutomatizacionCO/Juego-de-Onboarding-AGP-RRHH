const sql = require("mssql");

// ¿La columna admite NULL? Se consulta una sola vez a la base y se recuerda.
// Sirve para guardar "dato no reportado" como NULL cuando la columna lo permite
// y como 0 cuando no (así un guardado nunca falla por esto).
const cache = {};

async function admiteNull(pool, columna) {
  if (cache[columna] !== undefined) return cache[columna];
  try {
    const r = await pool
      .request()
      .input("col", sql.NVarChar(128), columna)
      .query(`
        SELECT IS_NULLABLE
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Onboarding_Resultados_Nivel' AND COLUMN_NAME = @col
      `);
    const v = r.recordset?.[0]?.IS_NULLABLE;
    cache[columna] = v ? v === "YES" : false;   // sin dato: lo seguro es no usar NULL
  } catch (e) {
    console.error("admiteNull:", e.message);
    return false;                               // sin cachear, se reintenta la proxima vez
  }
  return cache[columna];
}

// Valor a guardar en una columna de Onboarding_Resultados_Nivel:
// el dato si vino, y si no vino, NULL (o 0 si la columna no admite NULL).
async function valorColumna(pool, columna, valor) {
  if (valor != null) return Number(valor);
  return (await admiteNull(pool, columna)) ? null : 0;
}

// ¿Existe la columna en Onboarding_Resultados_Nivel? Solo se recuerda el "sí":
// mientras no exista se vuelve a preguntar, así el backend sigue funcionando
// antes del ALTER TABLE y empieza a usarla sola apenas la creen.
const existe = {};

async function existeColumna(pool, columna) {
  if (existe[columna]) return true;
  try {
    const r = await pool
      .request()
      .input("col", sql.NVarChar(128), columna)
      .query(`
        SELECT 1 AS ok
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_NAME = 'Onboarding_Resultados_Nivel' AND COLUMN_NAME = @col
      `);
    existe[columna] = r.recordset.length > 0;
  } catch (e) {
    console.error("existeColumna:", e.message);
    return false;
  }
  return existe[columna];
}

module.exports = { valorColumna, existeColumna };
