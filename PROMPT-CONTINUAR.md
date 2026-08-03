# Prompt para continuar en otro chat

Copia todo lo que está bajo la línea y pégalo como primer mensaje.

---

Estoy retomando la remediación del **Juego de Onboarding AGP** (`project_id: AGP-CO-ONBOARDING-B15`). Ya hay trabajo hecho en una sesión anterior y está documentado.

**Lee primero, en este orden:**

1. `C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\README.md`
2. `specs\003-tasks.md` — estado de las 13 tareas
3. `specs\009-change-log.md` — todo lo ejecutado y verificado
4. `specs\005-risks.md` — 12 riesgos, dos de ellos críticos y abiertos
5. `specs\007-deployment-notes.md` — procedimientos
6. `ai\decisions\` — dos decisiones tomadas, ambas pendientes de validación formal

Trabaja bajo el AGP AI Governance Kit (`..\agp-ai-governance-kit\START-HERE.md`) e identifícate con el encabezado que exige.

## Situación en una línea

Las tablets de planta perdieron el servicio porque el equipo que hospedaba la API se dio de baja y su IP (`172.16.60.75`) fue reasignada a otro computador (`PREENSAMB-COEM`). La dirección estaba incrustada 64 veces en el código, sin posibilidad de redirigirla sin recompilar.

## Lo que YA está hecho y verificado

**Código corregido.** Cuatro parches aplicados en `Archivos Juego RRHH`, y disponibles como diff en `parches\`:
- `centralizar-api-url.patch` — 64 direcciones fijas → una sola en `app/config.ts`
- `fix-endpoint-social.patch` — 3 niveles enviaban resultados a una ruta inexistente
- `fix-logs-credenciales.patch` — 3 registros exponían credenciales en consola
- `fix-evaluacion-identity.patch` — el guardado de la evaluación final fallaba siempre

Verificado: 62 archivos TS/TSX y 31 JS sin errores de sintaxis, 356/356 archivos completos contra el ZIP original, 0 direcciones fijas.

**API desplegada y funcionando en Azure:**
```
URL      https://agp-juego-rrhh-onboarding.azurewebsites.net
Grupo    AGP-Colombia
Plan     plan-juego-rrhh-onboarding · F1 (Free) · Linux · East US
Runtime  NODE|24-lts
```
Validado: `/api/health` → `{"ok":true,"db":true}` y `/api/islas/catalogo` → 9 islas reales. HTTPS forzado, HTTP responde 301. Restricción de acceso por IP activa con `Deny all`. Costo cero.

**Base de datos confirmada**, sin cambios necesarios: `agpcolombia.database.windows.net` / `AGP_RRHH`, 12 tablas `dbo.Onboarding_*`, 72 participantes, 317 resultados.

**Toolchain de compilación instalado** en `%LOCALAPPDATA%\dev-tools`, sin admin y sin costo: OpenJDK Temurin 17.0.20, Android cmdline-tools (sdkmanager 19.0), 7/7 licencias aceptadas. Node 24.13.0 y npm 11.6.2 ya estaban.

**Proyecto nativo generado.** En `%LOCALAPPDATA%\Temp\claude\...\scratchpad\build-web` hay una copia del frontend con `npm install` hecho y `expo prebuild --platform android` ejecutado. En su `android\app\build.gradle`:
- `applicationId com.onboardinggame.juegoapp` — correcto, coincide con el APK instalado
- `versionCode 1000` — subido a mano desde 1, ver advertencia abajo
- `versionName "1.0.1"`

Se añadió `android.builder.sdkDownload=true` en `gradle.properties` y `local.properties` con `sdk.dir=C:/Users/bmartin/AppData/Local/dev-tools/android-sdk`.

## Lo que falta

**Paso inmediato: compilar el APK.**
```
cd <scratchpad>\build-web\android
$env:JAVA_HOME="$env:LOCALAPPDATA\dev-tools\jdk-17.0.20+8"
.\gradlew assembleRelease
```
No se han instalado paquetes concretos del SDK de Android a propósito: el plugin `expo-root-project` resuelve las versiones internamente y no están escritas en el proyecto. Con las licencias aceptadas y `sdkDownload=true`, Gradle debería descargar lo que necesite. Si falla nombrando un paquete, instálalo con `sdkmanager` y repite.

Falta también **generar la clave de firma de AGP** con `keytool` y configurar el bloque `signingConfigs`. Sin eso, `assembleRelease` firma con clave de depuración o falla.

**Después:** probar el APK en una tablet, distribuirlo, y archivar el binario en un repositorio de AGP.

## Advertencias que debes tener presentes

**El `versionCode` es una estimación.** No se pudo leer el del APK instalado (está como entero en el manifiesto binario y no hay `aapt`). Se puso 1000 para superarlo con margen. Si consigues el valor real, ajústalo.

**La firma cambiará.** Con una clave nueva de AGP, Android rechazará instalar sobre la app existente y habrá que **desinstalar en cada tablet**. El progreso de los participantes se conserva porque vive en la base de datos (el desbloqueo de islas se calcula en el servidor desde `USUARIO_PROGRESO_ISLA`). Solo se pierden marcas locales de detalle. La alternativa es pedirle al proveedor el keystore de la cuenta Expo `onboardinggame`.

**La restricción por IP es provisional.** Se descubrió que la red de AGP sale por múltiples IP públicas: se midió `201.184.66.82` y minutos después `190.109.27.56`. Ambas están permitidas, pero si el tráfico sale por una tercera, dará 403. **Hay que pedirle a redes el rango o pool de salida NAT**, y en particular la IP de salida de la red donde están las tablets — sin ese dato el juego quedará bloqueado en las tablets aunque el APK sea correcto. Quedó pendiente porque no había personal disponible.

## Dos asuntos críticos abiertos, ajenos al despliegue

Escalarlos a quien administre el servidor SQL. **No dependen del juego y son más urgentes que él.**

**R-12 · Firewall abierto a internet.** El servidor `agpcolombia` (grupo `COL-RG`) tiene una regla `Base IPs` con rango `160.0.0.0 – 205.0.0.0`: unos 750 millones de direcciones públicas.

**R-02 · Credencial comprometida.** La contraseña del login SQL `Apps` viajó en texto plano dentro del paquete del proveedor, **sigue vigente**, y ese login tiene `db_datareader`, `db_datawriter` y `db_ddladmin` sobre toda `AGP_RRHH`, que contiene nombres y cédulas. Además quedó impresa en la salida de una sesión de trabajo. Rotarla es urgente.

Combinados: cualquiera en ese rango con el paquete puede leer, escribir y eliminar objetos en la base de recursos humanos. El orden correcto para cerrar el firewall es enumerar primero las IP legítimas de AGP, agregarlas como reglas específicas, y solo entonces eliminar `Base IPs` — al revés dejaría sin acceso a sistemas que hoy dependen de ella.

## Contexto útil adicional

- **No existe repositorio.** El código llegó como ZIP con archivos `.bak` sueltos. Versionarlo en un repositorio de AGP es un pendiente (R-06).
- **El APK instalado es Expo SDK 49; el código fuente es SDK 54.** Las tablets corren una versión anterior a lo que hay en el código.
- **No hay actualización remota.** `expo-updates` no está instalado (0 referencias en los tres `.dex` del APK). Se dejó `updates.enabled: false` para simplificar la primera compilación; conviene añadirlo después con `npx expo install expo-updates` para que un futuro cambio de dirección no obligue a reinstalar tablet por tablet.
- **23 de 82 llamadas `fetch` descartan la respuesta** sin verificar el estado. Es el patrón que ocultó el bug del endpoint inexistente durante meses (R-05).
- **`Onboarding_Respuestas` tiene 0 filas** y ningún punto del código escribe en ella: el reporte de detalle por participante saldrá vacío. Preguntar al proveedor (R-10).
- **Existe un build web funcional** (`expo export --platform web`, 156 archivos, 59 MB, compiló limpio). No requiere cuenta de Expo, ni firma, ni reinstalar en tablets. Es el plan de contingencia si la compilación nativa se complica.
- **Costos:** todo el toolchain y el plan F1 son gratuitos. Si se migra a B1 Linux en East US: 0,017 USD/hora, ~12,40 USD/mes. Crear una copia de la base para pruebas **sí factura** una segunda base.

Empieza confirmándome que leíste la documentación y dime cuál es tu plan antes de ejecutar nada.
