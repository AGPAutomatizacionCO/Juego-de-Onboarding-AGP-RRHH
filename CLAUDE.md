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
  Los APK anteriores a v1.0.3 **no reciben OTA** (`expo-updates` se agregó el
  2026-09-02): si una tablet no se actualiza tras abrir la app dos veces, reinstalar v1.0.3.
- Azure CLI está en este equipo en versión portable (`%LOCALAPPDATA%/azure-cli/bin/az.cmd`,
  en el PATH del usuario). La cuenta `jcastillol@agpglass.com` **no** tiene suscripciones
  en el tenant "AGP GROUP": el backend lo despliega el tercero que administra Azure.

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
- Cédulas `900000001`…`900000005` — usuarioKey 108, 109, 105, 106, 107, onboarding 99.
  Perfiles de la prueba de la fila 17 (perfecto, pocos errores, justo en 70,
  reprobado, repite niveles). Cédula `1410` (usuarioKey 112) y `1111` (113): pruebas
  manuales del usuario. Se dejan por indicación del usuario.

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
- Había una segunda llamada igual en `evaluacionFinal2.tsx` (HSE): `/avanzar` con
  `nuevaIsla: 9` al terminar la evaluación. Quitada el 2026-10-14 (`d79ed54`); los
  usuarios que pasaron por ahí antes siguen con todo abierto hasta re-correr el script.
- Regla única de aprobado: **70 %** (`onboardingAGP-api/config/aprobado.js` en el
  servidor, `MIN_PASS_SCORE` de `onboarding-game/app/config.ts` en la app). Aprobar
  no es requisito para pasar a la isla siguiente, a propósito.
- El seguimiento actual es por **filas del Excel de AGP (1-23)**, no por los 17
  puntos de `specs/010`. Nombrar siempre la fila.

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
- ✅ Octubre 2026, filas del Excel 1, 2, 3, 11, 15, 16, 17, 18 y 20: publicadas por
  OTA; el backend de la fila 17 desplegado y verificado el 2026-10-15. Detalle y
  arreglos posteriores (podio, HSE, UMAS, sopas de letras, regla de 70 %) en la
  sección "2026-10" de `specs/009-change-log.md`.

## Pendientes conocidos

- Re-correr `fix-progreso-islas.js --apply` contra la BD para los usuarios que
  terminaron HSE antes de `d79ed54` (requiere credenciales de BD).
- Si el tercero desplegó un zip anterior a `026b9cb`, el próximo despliegue debe
  llevar el zip actual (solo cambia el 70 % del resumen de isla, que no se muestra).
