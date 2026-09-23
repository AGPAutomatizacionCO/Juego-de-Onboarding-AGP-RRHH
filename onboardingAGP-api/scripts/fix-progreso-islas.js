/**
 * Corrige el bug de mapa.tsx que forzaba USUARIO_PROGRESO_ISLA=9 para
 * cualquier usuario que abriera el selector de islas, sin importar su
 * avance real (ver commit del fix en onboarding-game/app/mapa.tsx).
 *
 * Para cada usuario:
 *   1) Calcula M = cuántas islas completó de forma consecutiva desde la 1
 *      (una isla se considera "completada" si tiene una fila en
 *      Onboarding_Resultados_Nivel para su nivel de Evaluación Final,
 *      NIVELES_KEY = islaKey*5 — mismo criterio que ya usa el propio juego
 *      para desbloquear la siguiente isla en evaluacionFinal.controller.js).
 *   2) Corrige USUARIO_PROGRESO_ISLA a M+1 (la isla M+1 es la siguiente
 *      legítima a desbloquear).
 *   3) Para toda isla > M+1 que SÍ tenga datos (solo pudo llegar ahí por el
 *      bug, saltándose islas intermedias), borra sus resultados: las 5
 *      filas de nivel (Visual/Lectura/Recordemos/Social/Evaluación) en
 *      Onboarding_Resultados_Nivel, su fila en Onboarding_Resultados_Isla,
 *      y su conteo en Onboarding_Intentos_Nivel — la deja como si nunca se
 *      hubiera jugado, para que la desbloquee de nuevo en el orden correcto.
 *
 * Por defecto corre en modo SIMULACIÓN (no escribe nada) e imprime un
 * reporte de qué cambiaría por usuario. Pasar --apply para ejecutar de
 * verdad, dentro de una transacción por usuario.
 *
 * Uso:
 *   node scripts/fix-progreso-islas.js            (dry-run, solo reporte)
 *   node scripts/fix-progreso-islas.js --apply     (aplica los cambios)
 */
require("dotenv").config();
const { connectDB, sql } = require("../config/db");

const APPLY = process.argv.includes("--apply");
const TOTAL_ISLAS = 9;
const evalKey = (islaKey) => islaKey * 5;
const nivelesDeIsla = (islaKey) => {
  const base = (islaKey - 1) * 5;
  return [base + 1, base + 2, base + 3, base + 4, base + 5];
};

(async () => {
  const pool = await connectDB();
  if (!pool) {
    console.error("No se pudo conectar a la base de datos.");
    process.exit(1);
  }

  const usuarios = (
    await pool.request().query(`
      SELECT USUARIO_KEY, USUARIO_NOMBRE, USUARIO_PROGRESO_ISLA
      FROM dbo.Onboarding_Usuarios_NEW
      ORDER BY USUARIO_KEY ASC
    `)
  ).recordset;

  // Onboarding_Intentos_Nivel es de la migración pendiente del fix de
  // reintento (sql/2026-09-16_add_intentos_nivel.sql) — puede no existir
  // todavía en esta base. Si no existe, simplemente se omite su limpieza.
  const tablaIntentosExiste = (
    await pool.request().query(`
      SELECT CASE WHEN OBJECT_ID('dbo.Onboarding_Intentos_Nivel') IS NOT NULL THEN 1 ELSE 0 END AS existe
    `)
  ).recordset[0].existe === 1;

  let usuariosAfectados = 0;
  let islasLimpiadas = 0;

  for (const u of usuarios) {
    const uk = u.USUARIO_KEY;

    const filas = (
      await pool
        .request()
        .input("USUARIO_KEY", sql.Int, uk)
        .query(`
          SELECT DISTINCT NIVELES_KEY
          FROM dbo.Onboarding_Resultados_Nivel
          WHERE USUARIO_KEY = @USUARIO_KEY
        `)
    ).recordset;

    const nivelesConDatos = new Set(filas.map((f) => Number(f.NIVELES_KEY)));

    // M = islas completadas consecutivamente desde la 1
    let M = 0;
    while (M < TOTAL_ISLAS && nivelesConDatos.has(evalKey(M + 1))) {
      M += 1;
    }
    const progresoCorrecto = M + 1;

    // Islas fuera de orden: > M+1 y con algún dato
    const islasFueraDeOrden = [];
    for (let isla = M + 2; isla <= TOTAL_ISLAS; isla++) {
      const tieneDatos = nivelesDeIsla(isla).some((nk) => nivelesConDatos.has(nk));
      if (tieneDatos) islasFueraDeOrden.push(isla);
    }

    const progresoActual = Number(u.USUARIO_PROGRESO_ISLA ?? 1);
    const cambia = progresoActual !== progresoCorrecto || islasFueraDeOrden.length > 0;
    if (!cambia) continue;

    usuariosAfectados += 1;
    islasLimpiadas += islasFueraDeOrden.length;

    console.log(
      `Usuario ${uk} (${u.USUARIO_NOMBRE}): progresoIsla ${progresoActual} -> ${progresoCorrecto}` +
        (islasFueraDeOrden.length
          ? `, limpia islas fuera de orden: [${islasFueraDeOrden.join(", ")}]`
          : "")
    );

    if (!APPLY) continue;

    const tx = new sql.Transaction(pool);
    await tx.begin();
    try {
      for (const isla of islasFueraDeOrden) {
        const niveles = nivelesDeIsla(isla);
        const nivelesCsv = niveles.join(",");

        await tx
          .request()
          .input("USUARIO_KEY", sql.Int, uk)
          .query(`
            DELETE FROM dbo.Onboarding_Resultados_Nivel
            WHERE USUARIO_KEY = @USUARIO_KEY AND NIVELES_KEY IN (${nivelesCsv});
          `);

        if (tablaIntentosExiste) {
          await tx
            .request()
            .input("USUARIO_KEY", sql.Int, uk)
            .query(`
              DELETE FROM dbo.Onboarding_Intentos_Nivel
              WHERE USUARIO_KEY = @USUARIO_KEY AND NIVELES_KEY IN (${nivelesCsv});
            `);
        }

        await tx
          .request()
          .input("USUARIO_KEY", sql.Int, uk)
          .input("ISLAS_KEY", sql.Int, isla)
          .query(`
            DELETE FROM dbo.Onboarding_Resultados_Isla
            WHERE USUARIO_KEY = @USUARIO_KEY AND ISLAS_KEY = @ISLAS_KEY;
          `);
      }

      await tx
        .request()
        .input("USUARIO_KEY", sql.Int, uk)
        .input("PROGRESO", sql.Int, progresoCorrecto)
        .query(`
          UPDATE dbo.Onboarding_Usuarios_NEW
          SET USUARIO_PROGRESO_ISLA = @PROGRESO
          WHERE USUARIO_KEY = @USUARIO_KEY;
        `);

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      console.error(`  ERROR en usuario ${uk}, se revirtió su transacción:`, e.message);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log(
    APPLY
      ? `Aplicado. Usuarios corregidos: ${usuariosAfectados}. Islas fuera de orden limpiadas: ${islasLimpiadas}.`
      : `SIMULACIÓN (no se escribió nada). Usuarios que cambiarían: ${usuariosAfectados}. Islas fuera de orden a limpiar: ${islasLimpiadas}.\nVolvé a correr con --apply para ejecutar de verdad.`
  );

  process.exit(0);
})();
