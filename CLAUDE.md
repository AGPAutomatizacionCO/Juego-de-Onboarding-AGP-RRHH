# Onboarding Game — contexto para Claude

Monorepo. Antes de investigar desde cero, lee esto y los dos docs referenciados abajo
— tienen el historial completo y evitan repetir trabajo ya hecho.

## Estructura

- `onboarding-game/` — frontend (React Native / Expo, SDK 54, Expo Router)
- `onboardingAGP-api/` — backend (Node/Express + mssql, Azure SQL)
- `specs/009-change-log.md` — historial cronológico completo de todo lo corregido
- `specs/010-criterios-aceptacion-17-puntos.md` — estado real de cada uno de los 17
  puntos del requerimiento original, con qué está listo y qué falta

## Infraestructura

- Backend en vivo: `https://agp-juego-rrhh-onboarding.azurewebsites.net` — Azure App
  Service `agp-juego-rrhh-onboarding`, grupo `AGP-Colombia`, plan F1 (gratuito, sin
  Always On — la primera petición tras inactividad tarda ~15-20s, no es un bug).
- Base de datos real: `agpcolombia.database.windows.net` / `AGP_RRHH` (SQL Server).
  No hay entorno de pruebas separado — todo se prueba contra producción real.
- EAS (OTA updates del frontend): proyecto `onboardinggame`, cuenta `agpautomatizacionco`.
  Publicar con `npx eas-cli update --branch production --message "..."` desde
  `onboarding-game/`. Cambios solo JS/TS no requieren build nuevo — se aplican solos
  con dos aperturas de la app con internet.
- Despliegue del backend: `az webapp deploy --resource-group AGP-Colombia --name
  agp-juego-rrhh-onboarding --src-path <zip> --type zip`. El zip se arma limpio con
  `git archive --format=zip -o backend-deploy.zip HEAD:onboardingAGP-api` (respeta
  .gitignore, no arrastra node_modules ni archivos sueltos). Esta acción requiere
  confirmación explícita del usuario en el chat — el sistema la bloquea si se intenta
  sin más contexto.
- GitHub Releases del APK: repo `AGPAutomatizacionCO/Juego-de-Onboarding-AGP-RRHH`.
  Release vigente: **v1.0.3** (no hace falta uno nuevo salvo que cambie código nativo).

## Local (desarrollo)

- Levantar todo (backend + frontend): doble clic en `onboarding-game/run-web.cmd`.
  Levanta la API (puerto 3001) en una ventana aparte y el frontend (Expo web) en la
  ventana actual — abre en `http://localhost:8081`. Sin la API corriendo, el login y
  cualquier llamada al backend fallan con `Failed to fetch` (visto en sesión real).
- También se puede levantar por separado con `preview_start` y los configs
  `onboarding-game-api` / `onboarding-game-web` de `.claude/launch.json`, que vive en
  la carpeta `AGP_CO_IDENTIFICADOR-REQUERIMIENTOS` — es el cwd real de la sesión, no
  `onboarding-game/`.
- `run-web.cmd` está en `.gitignore` a propósito (script de conveniencia local, no se
  versiona). Detalle paso a paso (incluida la contraseña de BD) en `PRUEBAS-LOCALES.md`.

## Cuentas de prueba

- Cédula `1122334455` — usuarioKey 98, "PRUEBA CLAUDE QA". Sin progreso real,
  usar para pruebas aisladas que no deban afectar datos de nadie.
- Cédula `1070926304` — usuarioKey 88, "Bradly Martin". Cuenta real del usuario
  con progreso real — no resetear ni tocar sin preguntar primero.
- Admin de prueba: usuario/contraseña quedaron en manos del usuario (tabla
  `dbo.Onboarding_Administrador`, columnas en texto plano — así ya funcionaba,
  no se introdujo por esta sesión).

## Reglas aprendidas en esta sesión

- Este repo tiene tablas con `IDENTITY` inconsistente entre sí (`EVALUACION_KEY`
  y `ADMINISTRADOR_KEY` sí lo son; `VISUAL_KEY`, `LECTURA_KEY`, `RECORDEMOS_KEY`,
  `SOCIAL_KEY` no) — **siempre confirmar contra `sys.columns` antes de escribir
  un INSERT**, no asumir por el nombre de la tabla.
- Los archivos `nivelvisualN.tsx` **no** corresponden 1:1 con el número de isla
  (p.ej. `nivelvisual7.tsx` es la isla 5, `nivelvisual8.tsx` es la isla 7) —
  verificar `ISLA_KEY` dentro de cada archivo, nunca asumir por el nombre.
- Las 9 islas tienen exactamente 5 niveles cada una salvo la isla 9 (Evaluación
  Final, 1 solo nivel) — `NIVELES_KEY` real = `(islaKey-1)*5 + nivelIdLocal`.
- `Alert.alert` de React Native **no se renderiza en `react-native-web`** — un
  flujo que parece "no hacer nada" en el navegador puede estar funcionando bien
  y solo faltarle el popup visual (ya pasó dos veces: nivel sin imágenes, nivel
  ya completado). Confirmar con logs/consola antes de asumir bug.
- `mapa.tsx` tenía una llamada que forzaba `USUARIO_PROGRESO_ISLA=9` (desbloquea
  todo) cada vez que cualquier usuario abría el selector de islas — corregida
  (2026-09-21). El mecanismo real de avance está en
  `evaluacionFinal.controller.js` (`upsertResultado`, `if (nk >= 5)`), que
  desbloquea la isla siguiente solo al guardar un resultado de su evaluación
  final. Se corrió `onboardingAGP-api/scripts/fix-progreso-islas.js --apply`
  contra producción para recalcular el progreso real de los 65 usuarios ya
  afectados y borrar datos de islas a las que habían llegado fuera de orden.

## Tareas recientes (más detalle en specs/009-change-log.md)

- ✅ Pantalla negra persistente (video de intro) — resuelta, publicada por OTA.
- ✅ Podio por isla: desempate por tiempo ahora visible y confirmado en las 9 islas.
- ✅ Panel admin: editor de "pares de imágenes" ahora puede crear filas nuevas
  (antes solo podía actualizar existentes) — desbloquea subir contenido para
  Lectura OF, Manipulación, Metrología, Calidad (islas 5-8, tabla de imágenes vacía).
- ✅ "Habilitar reintento": las 8 pantallas de isla ahora sí consultan el permiso
  del servidor (antes solo miraban una bandera local). Al consumirse, borra el
  resultado anterior pero preserva el conteo de intentos (INTENTO). Backend
  desplegado y verificado en vivo (`/api/admin/resultados/reintento` → 200 OK).
- 🔄 En progreso: reporte PDF del panel admin ahora exige seleccionar un
  onboarding específico antes de poder descargar (antes mezclaba todos los
  grupos en un solo PDF) — cambio hecho en `adminPanel.tsx`
  (`selectedOnboardingReporte`, `reporteFiltrado`), compila sin errores de
  TypeScript, **pendiente de verificación visual en el navegador**.
- ⏸️ Pausado a pedido de AGP: reporte admin filtrable por usuario individual
  dentro de un onboarding, y auditoría de consistencia de contadores.

## Pendientes conocidos

Ver la tabla resumen en `specs/010-criterios-aceptacion-17-puntos.md` para el
estado punto por punto. Nada bloqueante activo al cierre de esta nota salvo lo
marcado 🔄 arriba.
