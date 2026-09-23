# Onboarding Game — guía de entrega para el equipo de desarrollo

Punto de entrada para cualquier persona (o agente de IA) que se sume a este
desarrollo. Da contexto suficiente para orientarse sin tener que leer todo el
historial primero. Para el detalle profundo, ver la sección "Más contexto" al
final.

## Qué es esto

App de inducción para tablets de planta (React Native / Expo) + API propia
(Node/Express) + Azure SQL. La usan los nuevos colaboradores de AGP Glass para
completar un recorrido de 9 "islas" temáticas, cada una con 5 niveles
(Visual, Lectura, Recordemos, Social, Evaluación), salvo la última isla que es
solo una evaluación final.

**Estado actual:** en producción, en uso activo. No es un proyecto nuevo ni
"fuera de servicio" — si ves documentación antigua (`README.md`,
`project-card.md`, `specs/00X-*.md`) que diga lo contrario, es de una etapa
anterior (migración de hospedaje, ya resuelta) y quedó como historial.

## Estructura del repo

```
onboarding-game/     frontend (TypeScript, React Native + Expo)
onboardingAGP-api/   backend (JavaScript, Node/Express + mssql)
specs/               documentación histórica (incidentes, criterios de aceptación)
CLAUDE.md            notas operativas y lecciones aprendidas, denso y factual
PRUEBAS-LOCALES.md   guía paso a paso para levantar todo en una máquina nueva
```

## Stack

**Frontend** (`onboarding-game/`) — carpeta `app/`
- TypeScript (`.tsx`/`.ts`, ~64 archivos) — el grueso del código
- React Native 0.81.5 + Expo SDK 54 + Expo Router (navegación por archivos)
- Algunos archivos sueltos en JavaScript plano

**Backend** (`onboardingAGP-api/`)
- JavaScript (Node.js, ~33 archivos) — sin TypeScript aquí
- Express 4 (API REST) + `mssql` (driver hacia Azure SQL)

**Base de datos**
- SQL Server / T-SQL (Azure SQL) — las migraciones están en
  `onboardingAGP-api/sql/*.sql`

## Cómo levantar todo en local

Guía completa con capturas de lo esperado en `PRUEBAS-LOCALES.md`. Resumen:

1. `npm install` en `onboarding-game/` y en `onboardingAGP-api/`.
2. Completar `DB_PASSWORD` en `onboardingAGP-api/.env` (no viaja en el repo).
3. Levantar la API: `cd onboardingAGP-api && node index.js` (puerto 3001).
4. Levantar el frontend: `cd onboarding-game && npx expo start --web`
   (puerto 8081) — el `.env` del frontend ya apunta a `localhost:3001`.

No hay entorno de pruebas separado: todo corre contra la base de datos real
(`agpcolombia.database.windows.net` / `AGP_RRHH`). Ver "Cuentas de prueba"
abajo antes de tocar nada a mano.

## Cómo continuar el desarrollo (flujo de trabajo)

1. Rama `main` es la única rama activa — se trabaja directo sobre ella
   (proyecto pequeño, sin flujo de PRs establecido todavía).
2. Commits en español, formato `tipo(alcance): descripción corta`
   (`fix(reintento): ...`, `feat(admin): ...`, `docs: ...`) — revisar
   `git log` para el estilo exacto antes de tu primer commit.
3. `git push origin main` normal, sin force-push.

## Cómo desplegar

**Backend → Azure App Service**
```bash
cd onboardingAGP-api
git archive --format=zip -o backend-deploy.zip HEAD:onboardingAGP-api  # (desde la raiz del repo)
az webapp deploy --resource-group AGP-Colombia --name agp-juego-rrhh-onboarding --src-path backend-deploy.zip --type zip
```
Requiere estar logueado con `az login` y tener acceso al grupo de recursos
`AGP-Colombia`. El plan es F1 (gratuito, sin Always On) — la primera petición
tras inactividad tarda ~15-20s, no es un bug.

**Frontend → OTA (Expo Updates)**
```bash
cd onboarding-game
npx eas-cli update --branch production --message "descripcion del cambio"
```
Solo aplica a cambios JS/TS (que es casi todo). Requiere acceso a la cuenta de
Expo `agpautomatizacionco` (proyecto `onboardinggame`) — **pedir que agreguen
a la cuenta como miembro** para poder publicar. Un cambio de código nativo
(nueva librería, permisos) sí necesita un build nuevo (`eas build`) y un APK
nuevo, no solo un update.

## Cómo validar en las tablets

- **Cambios de backend:** se ven de inmediato, no requieren nada del lado de
  la tablet (solo que la API esté arriba — probar `GET /api/health` primero).
- **Cambios de frontend (OTA):** la tablet necesita **abrir la app dos veces
  completas, con internet, cerrándola del todo entre una y otra** — la
  primera descarga la actualización en segundo plano, la segunda la aplica.
  Si solo se abre una vez, o se minimiza en vez de cerrar, seguirá viéndose
  la versión anterior — no es que el despliegue haya fallado.
- **No hace falta reinstalar el APK** salvo que el cambio sea de código
  nativo — verificar el mensaje de `eas update` (dice explícitamente qué
  runtime version y plataformas alcanzó).

## Cuentas de prueba

- Cédula `1122334455` — usuarioKey 98, "PRUEBA CLAUDE QA". Sin progreso real,
  usar para pruebas aisladas que no deban afectar datos de nadie.
- Cédula `1070926304` — usuarioKey 88, "Bradly Martin". Cuenta real con
  progreso real — no resetear ni tocar sin preguntar primero.
- Admin: credenciales en manos del equipo (tabla
  `dbo.Onboarding_Administrador`, columnas en texto plano).

## Más contexto

- `CLAUDE.md` — notas operativas densas: infraestructura, reglas aprendidas a
  la fuerza (numeración de niveles, columnas `IDENTITY` inconsistentes,
  peculiaridades de `react-native-web`), tareas recientes.
- `specs/009-change-log.md` — historial cronológico de todo lo corregido.
- `specs/010-criterios-aceptacion-17-puntos.md` — estado punto por punto del
  requerimiento original de corrección de errores.
- `README.md` / `project-card.md` / `specs/00X-*.md` — historial del
  incidente original (migración de hospedaje) y la gobernanza inicial del
  proyecto. Contexto histórico, no refleja el estado actual.
