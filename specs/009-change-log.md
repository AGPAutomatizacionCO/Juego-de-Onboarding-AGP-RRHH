[AGP · Agente: DOCUMENTAL]

# Changelog — Juego de Onboarding AGP

**project_id:** AGP-CO-ONBOARDING-B15

Todos los cambios se aplicaron sobre una copia del paquete entregado por el proveedor.
El ZIP original y los repositorios de AGP no fueron modificados.

---

## 2026-07-30 — Evaluación técnica y correcciones

### Diagnóstico

- Identificada la causa de la falla: el equipo que hospedaba la API (`172.16.60.75`) se
  dio de baja y su dirección fue reasignada al computador `PREENSAMB-COEM`. Verificado en
  sitio: la dirección responde a nivel de red, el puerto 3001 está cerrado.
- Confirmado que la base de datos no requiere cambios: 12 tablas presentes en `AGP_RRHH`
  con 72 participantes y 317 resultados de nivel registrados.
- Confirmado el host incrustado en el APK: `http://172.16.60.75:3001`, una sola
  ocurrencia en el bytecode Hermes.

### Correcciones aplicadas

- **Centralización de la dirección del backend.** 64 direcciones fijas repartidas en 46
  archivos reemplazadas por una única definición en `onboarding-game/app/config.ts`.
  Corregidos además `nivelsocial5.tsx`, que apuntaba a un segundo equipo distinto
  (`172.16.61.81`), y `nivelcerebro1.tsx`, cuya dirección de reserva era inválida
  (`http://:3001`, sin host).
- **Corrección de endpoint inexistente.** `nivelsocial4.tsx`, `nivelsocial5.tsx` y
  `nivelsocial7.tsx` enviaban resultados a `/api/niveles/salto/:nivelKey/resultado`. Esa
  ruta no existe en la API; las rutas montadas son `/lectura`, `/visual`, `/recordemos`,
  `/social` y `/evaluacionFinal`. El fallo era silencioso porque un 404 no lanza excepción
  y el código no verificaba el estado de la respuesta, de modo que el participante veía el
  nivel aprobado y su puntaje nunca llegaba a la base.
- **Guardado de la evaluación final.** `Onboarding_Evaluacion.EVALUACION_KEY` es columna
  `IDENTITY` —verificado contra la base real—, pero el código calculaba la llave con
  `MAX(EVALUACION_KEY)+1` e insertaba el valor explícito sin `SET IDENTITY_INSERT`. SQL
  Server rechaza eso siempre, así que guardar preguntas desde el panel administrativo
  fallaba. Se dejó que la base asigne la llave, lo que además elimina una condición de
  carrera.
- **Registro de credenciales en consola.** Eliminados tres `console.log`: uno imprimía la
  configuración de base de datos en cada arranque, otro el cuerpo completo de la petición
  de login —con la contraseña— y el tercero ambas contraseñas de administrador en texto
  plano.
- **Eliminación de código muerto.** Retirado `onboardingAGP-api/Services/IslasService.js`:
  contenía una tercera dirección fija, nadie lo importaba, usaba sintaxis de módulos ES en
  un proyecto CommonJS (habría lanzado error si se requiriera) y apuntaba a `/islas`
  cuando la API expone `/api/islas`.

### Configuración añadida

- Declarados en `app.json`: `android.package` (`com.onboardinggame.juegoapp`, extraído del
  APK), `version` 1.0.1, `runtimeVersion`, bloque `updates`, `owner` y `projectId`.
- Creado `eas.json`, ausente en la entrega del proveedor, con perfiles `development`,
  `preview` y `production`.
- Creadas plantillas `.env.example` en ambos proyectos, sin valores de credenciales.
- Creada la carpeta `onboardingAGP-api/uploads/`, requerida por `multer`; sin ella la
  subida de imágenes del panel administrativo falla.
- Añadido `.gitignore` en el backend y excluido `.env` en el del frontend.

### Verificaciones ejecutadas

- **API en ejecución real.** Arrancada localmente contra la base de producción:
  `Conectado a SQL Server`, `/api/health` devolvió `{"ok":true,"db":true}` y
  `/api/islas/catalogo` devolvió las 9 islas. 0 credenciales en el log de arranque.
- **Sintaxis.** 62 archivos TypeScript/TSX parseados con el compilador de TypeScript y 31
  archivos JavaScript del backend con `node --check`: 0 errores.
- **Completitud.** 356 de 356 archivos fuente verificados contra el ZIP original. Las dos
  ausencias son intencionales: el código muerto retirado y un archivo de prueba.
- **Build web.** Generado con `expo export --platform web`: 156 archivos, 59 MB, bundle de
  4,07 MB, sin errores. Confirmó que la dirección se resuelve desde la configuración
  centralizada.

### Incidencias durante el trabajo

Se registran por transparencia y porque justifican los controles añadidos.

- Un primer parche de centralización insertaba el `import` dentro de bloques de
  importación multilínea, rompiendo 8 de 53 archivos. No se detectó inicialmente porque la
  verificación comprobó semántica pero no que los archivos parsearan; `node --check` no
  interpreta TSX. Se rehízo con el compilador de TypeScript como validación.
- El corrector convertía finales de línea CRLF a LF, lo que infló el parche a 69.967
  líneas. Se rehízo preservando el formato original: 974 líneas.
- Una restauración desde copia de respaldo eliminó archivos añadidos posteriormente
  (`nivelvisual8.tsx`, `app/types/`, `app/firebase/`). Detectado y corregido mediante
  comparación contra el ZIP.
- Un `xargs` mal construido partió rutas con espacios e intentó eliminar
  `C:\Users\bmartin\OneDrive`. No hubo daño porque el comando carecía de la opción
  recursiva. Verificado: los 17 proyectos y la carpeta de OneDrive intactos, repositorios
  con 0 cambios.

### Toolchain instalado

- OpenJDK Temurin 17.0.20 y Android command-line tools (sdkmanager 19.0) en
  `%LOCALAPPDATA%\dev-tools`, sin permisos de administrador.
- Licencias del SDK de Android aceptadas: 7 de 7. Ver
  `ai/decisions/D-001-licencias-android.md`.

---

## 2026-07-31 — Despliegue de la API en Azure

### Recursos creados

```text
Suscripción:      Microsoft Azure (agpglass): #1181528
Grupo:            AGP-Colombia            (existente, se reutilizó por convención)
Plan:             plan-juego-rrhh-onboarding   F1 (Free) · Linux · East US
App Service:      agp-juego-rrhh-onboarding
URL:              https://agp-juego-rrhh-onboarding.azurewebsites.net
Runtime:          NODE|24-lts
```

Región East US elegida porque el servidor SQL `agpcolombia` resuelve a
`dataslice11.eastus.database.windows.net`.

Costo validado con la API oficial de precios de Azure: el nivel Free **no tiene registros
de precio**, es decir costo cero. Referencia si más adelante se migra: B1 Linux en East US
cuesta 0,017 USD/hora, aproximadamente 12,40 USD al mes.

### Configuración aplicada

- Variables de conexión a base de datos como configuración de la aplicación, no en
  archivo. Se desplegó **sin** el `.env`.
- `httpsOnly = true`. Verificado: una petición HTTP plana responde `301` hacia HTTPS.
- Restricción de acceso por IP, con `Deny all` implícita para todo lo demás.
- Comando de arranque `npm start`.
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true` para que las dependencias se instalen en el
  servidor.

**Se confirmó que el plan F1 sí admite restricciones de acceso por IP**, incógnita que
estaba marcada como bloqueante en las notas de despliegue.

### Validación

```text
GET /api/health           → 200  {"ok":true,"db":true}
GET /api/islas/catalogo   → 200  9 islas reales desde AGP_RRHH
http:// (plano)           → 301  redirige a HTTPS
```

Las 9 islas devueltas: Introducción AGP, HSE, Procesos de Producción, Conceptos Generales,
Manipulación del Vidrio, Metrología, Lectura OF, Calidad y Evaluación Final.

### Configuración del frontend actualizada

- `EXPO_PUBLIC_API_URL` apunta ya a la URL de Azure.
- `updates.enabled` fijado en `false` y `runtimeVersion` retirado: la dependencia
  `expo-updates` no está instalada, y se decidió reducir variables en la primera
  compilación local. La actualización remota se incorpora después, con el pipeline ya
  funcionando.

### Hallazgo: la red de AGP sale por múltiples IP públicas

Al validar, la primera petición devolvió `403`. La causa no fue un error de
configuración: **la IP pública de salida de AGP cambia entre peticiones.** Se midió
`201.184.66.82` y minutos después `190.109.27.56`, confirmado por dos servicios
independientes.

Esto explica las siete reglas `ClientIPAddress_*` acumuladas en el firewall del servidor
SQL entre 2024 y 2026: corresponden a personas agregando la dirección que tenían ese día.
Entre lo observado, AGP sale por al menos nueve direcciones en bloques distintos
(190.x, 186.x, 200.x, 201.x, 158.23.x), probablemente varias sedes o enlaces.

**Las dos reglas configuradas son provisionales para validar, no la configuración
definitiva.** Si el tráfico sale por una tercera dirección, la respuesta será `403`. La
solución correcta es solicitar a redes el rango o pool de salida NAT, en lugar de agregar
direcciones sueltas — que es precisamente el error ya cometido en el firewall de la base
de datos.

### Incidencia de seguridad durante el trabajo

Un comando de configuración falló porque la contraseña del login `Apps` contiene
caracteres que el intérprete de comandos de Windows trata como operadores (`)` y `]`). Al
reportar el fallo, **el intérprete imprimió la contraseña en la salida de la sesión**. La
credencial ya estaba marcada para rotación en R-02; esta exposición adicional la vuelve
urgente. El problema se resolvió pasando la configuración mediante archivo JSON, que evita
el intérprete.

---

## 2026-07-31 — Regeneración del proyecto nativo y compilación del APK firmado

### Contexto

El trabajo de prebuild de la sesión anterior (dependencias instaladas, carpeta `android/`
generada) vivía en un directorio de scratchpad específico de esa sesión, que ya no
existía al retomar el trabajo. Se rehízo desde cero contra el mismo código fuente en
`onboarding-game/`, sin cambios respecto a lo ya verificado.

### Regeneración (T-09)

- Copiado el código fuente a un directorio de trabajo fuera de OneDrive, `npm install`
  (1221 paquetes) y `npx expo prebuild --platform android`, sin errores.
- Confirmado de nuevo `applicationId com.onboardinggame.juegoapp`.
- `versionCode` fijado a mano en 1000 (sigue siendo una estimación: no fue posible leer
  el valor real del APK instalado, igual que en la sesión anterior).
- `EXPO_PUBLIC_API_URL` fijada a `https://agp-juego-rrhh-onboarding.azurewebsites.net`
  mediante `.env` — la URL ya desplegada en Azure.

### Clave de firma (T-10)

Generado un keystore propio de AGP con `keytool` (RSA 2048, validez 10.000 días, alias
`agp-onboarding`), bajo autorización explícita del solicitante en la conversación. Ver
`ai/decisions/D-003-generacion-keystore.md`. El archivo y sus contraseñas se entregaron
directamente al solicitante; **no se guardó copia en este repositorio ni en ningún otro
sistema de AGP** — su custodia queda pendiente de decisión humana (R-01).

### Compilación (T-11) y una incidencia de ruta

El primer intento de `gradlew assembleRelease` falló compilando el código nativo (C++) de
varias dependencias (`react-native-screens`, luego `react-native-worklets`) con el error
de Windows `CreateProcess error=2` sobre un archivo `prefab_command.bat`. Diagnóstico: la
ruta del proyecto, anidada dentro del directorio de scratchpad, medía 304 caracteres —por
encima del límite de 260 de Windows para rutas sin soporte extendido—, y el propio
generador de esa ruta intermedia fallaba silenciosamente al no poder crear el archivo.

Se movió el proyecto a una ruta corta (`C:\Users\bmartin\ob-build`) con `robocopy`. El
build volvió a fallar con el mismo síntoma: los archivos generados de autolinking
(`autolinking.json`, `Android-autolinking.cmake`) y varias cachés `.gradle` dentro de
`node_modules` —de proyectos Gradle incluidos por composición, no del proyecto raíz—
conservaban las rutas absolutas de la ubicación anterior, y Gradle los marcaba como
"actualizados" sin regenerarlos. Se purgaron todas las cachés `.gradle`, `.cxx` y
carpetas `build` generadas dentro del árbol completo (incluyendo las de `node_modules`) y
se recompiló desde cero.

**Resultado:** `BUILD SUCCESSFUL`, 566 tareas ejecutadas. `app-release.apk` generado
(~140 MB — corresponde a las 4 arquitecturas nativas sin dividir en APKs separados).

### Verificación aplicada

- `apksigner verify --print-certs`: **Verifies** = true, firmado con **APK Signature
  Scheme v2**, certificado `CN=AGP Colombia, OU=TI, O=AGP Group, L=Bogota,
  ST=Cundinamarca, C=CO` — coincide con la clave generada, no con la de depuración.
  (Nota: `jarsigner -verify` reportó "jar is unsigned"; es un falso negativo esperado,
  porque `jarsigner` solo entiende el esquema v1 y AGP firma con v2 por defecto.)
- `output-metadata.json`: `applicationId com.onboardinggame.juegoapp`, `versionCode 1000`,
  `versionName 1.0.1` — coherente con lo declarado.

### Pendiente de registro

Validación en tablet real (T-12) y distribución (T-13). Ver `specs/003-tasks.md`.

---

## 2026-09-02 — Actualización remota (EAS Update) y corrección de 13 de 17 errores reportados

### Actualización remota

Instalada la dependencia `expo-updates` (pendiente desde T-02) y configurada bajo una
cuenta Expo propia de AGP (`agpautomatizacionco`), no la del proveedor. Declarado
`runtimeVersion` con política `appVersion` y `updates.url` apuntando al proyecto de AGP.
Esto permite publicar correcciones de JavaScript a las tablets ya instaladas sin generar
un nuevo APK, mediante `eas update`.

### Corrección de 13 de los 17 errores del documento de requerimientos

Detalle completo en el mensaje del commit `5016950`. Resumen:

- Podio por isla calculado como promedio de los 5 niveles, no solo la evaluación final,
  con desempate por tiempo.
- Nuevo permiso de reintento de evaluación: el administrador lo habilita por usuario y
  por nivel; se consume solo al iniciar el intento.
- Corregido el guardado del nivel Social de HSE (esperaba `nivelKey` en el cuerpo de la
  petición en vez de en la URL) y una atribución de isla incorrecta en Recordemos.
- Corregidas claves de progreso desincronizadas en Procesos que bloqueaban el avance a
  Recordemos, y una lectura de estado de evaluación que apuntaba a la isla equivocada.
- Conceptos Generales: el marcador numérico ya no tapa el vidrio en pantalla; etiquetas
  Izquierdo/Derecho invertidas corregidas en Parabrisas y Posterior; texto de tabla que se
  cortaba en la evaluación final, corregido en todas las islas.
- Manipulación de Vidrio: perder las vidas reinicia la sección en vez de saltar a la
  siguiente.
- Metrología: crucigrama con el número de palabra tapado y dos cruces de letras
  contradictorios que impedían completarlo.
- Lectura OF: la pantalla del nivel visual estaba vacía y crasheaba la app; reconstruida
  con el mismo motor que HSE.
- Retirada la pantalla huérfana `app/App.js` (paquete descontinuado, accesible por ruta
  pese a no usarse).

Dos de los 17 quedaron fuera de alcance de código (resolución de fotografías, limitada
por la cámara del dispositivo) o duplicados de otro ítem ya cubierto. Dos más —reporte de
administrador filtrable por usuario, y auditoría de consistencia de contadores— quedaron
pausados a solicitud expresa para una etapa posterior.

### Release v1.0.2 y hallazgo de configuración

Publicado `v1.0.2` en GitHub Releases. Al probar en tablet, la app resultó inutilizable:
el build había quedado compilado apuntando a una IP local de pruebas
(`EXPO_PUBLIC_API_URL`) en vez de la URL de Azure, un valor que no se revirtió antes de
compilar. Corregido y publicado como `v1.0.3`.

### Release v1.0.3 y pantalla negra persistente

`v1.0.3` corrigió además dos causas de pantalla negra al abrir detectadas en la misma
prueba: faltaba el plugin `expo-splash-screen` (el formato antiguo de `splash` en
`app.json` ya no aplica en el SDK actual) y el logo del ícono de transición ocupaba 78%
del lienzo, fuera de la zona segura del ícono adaptativo de Android (reducido a 56%).

La app seguía quedando en pantalla negra después de estas correcciones. Diagnóstico
retomado el 2026-09-03.

---

## 2026-09-03 — Diagnóstico y corrección de la pantalla negra persistente

### Método

Ante la sospecha fundada de que el problema solo era observable en hardware real —y tras
dos ciclos de compilación a ciegas sin resultado—, se depuró directamente sobre una
tablet Samsung Galaxy Tab A9+ física mediante ADB (depuración inalámbrica, sin acceso
USB disponible por falta de driver del fabricante), leyendo `logcat` en cada intento en
lugar de seguir conjeturando desde el código.

### Causa raíz encontrada

`app/index.tsx` (primera pantalla) reproducía un video de introducción
(`INTROYES.mp4`) con `expo-av`, y solo navegaba a `/registration` cuando el video
terminaba (`onPlaybackStatusUpdate`). El log de la tablet mostró:

```text
ExoPlayerImplInternal: Playback error ... FileNotFoundException:
/android_res/raw/assets_introyes.mp4: open failed: ENOENT
```

El archivo existe, está referenciado correctamente, y no hay ninguna exclusión en
`.gitignore`, `.easignore` (no existe) ni en `assetExts` de Metro que explique por qué no
se empaquetó en el binario nativo — la causa exacta de ese fallo de empaquetado quedó sin
determinar. Sin manejo de error ni límite de tiempo, la ausencia del video dejaba la app
varada en negro para siempre, sin ninguna salida posible.

### Primer intento (commit `fe0d453`) — insuficiente

Se agregó `onError` al componente `<Video>` y un `setTimeout` de seguridad de 8 segundos,
ambos invocando la misma función de avance. Compilado como build de prueba (no publicado
como release). En pruebas posteriores sobre el dispositivo real, el hilo de JavaScript de
esa pantalla se observó sin actividad después de `Running "main"` de forma intermitente
—ni el evento de error del video ni el `setTimeout` independiente llegaban a ejecutarse
en algunas corridas—, un comportamiento no atribuible con certeza al video en sí. Se
decidió no seguir agregando capas defensivas sobre un componente cuyo comportamiento en
este hardware no podía explicarse por completo.

### Corrección definitiva (commit `47d94df`)

Eliminada la dependencia del video por completo. `index.tsx` reescrito para mostrar una
imagen estática (`assets/introfinal.png`, ya existente en el proyecto como último cuadro
del video) durante 3 segundos y navegar. Cero referencias a `expo-av` en el proyecto tras
el cambio.

### Publicación por actualización remota, no por nuevo APK

Al ser un cambio exclusivo de JavaScript, se publicó mediante `eas update --branch
production` en lugar de compilar un nuevo binario — evitando la cola de compilación de
EAS (que en este proyecto llegó a superar 4 horas en el plan gratuito). Verificado en la
tablet real: una instalación completamente nueva del APK `v1.0.3` público (el mismo que
está en GitHub Releases, sin ninguna modificación) descarga y aplica la actualización
remota en su primer arranque con conexión a internet, sin quedar nunca en pantalla negra.
**No se requiere ni se publicó un nuevo release del APK** — `v1.0.3` sigue siendo la
versión vigente a distribuir.

### Verificación adicional ejecutada sobre la tablet real

Con la actualización ya aplicada, se ejecutó una batería de pruebas funcionales contra
producción (Azure + `AGP_RRHH` real): registro de usuario, inicio de sesión por cédula
con recuperación de progreso, bloqueo secuencial de niveles, carga del nivel Visual 1
(memoria) y navegación a la pantalla de login de administrador. Cero excepciones fatales
ni ANR en el `logcat` completo de la sesión.

Dos hallazgos menores, ninguno bloqueante, quedan pendientes de una sesión posterior:

- Si el registro falla en el backend (probado con una cédula que desborda la columna
  `int`, causando un `500`), el botón vuelve a su estado inicial sin mostrar ningún
  mensaje de error al usuario.
- `app/nivelvisual1.tsx` llama a un endpoint (`/niveles/visual/:nivelKey/estado`) que no
  existe en el backend — falta el prefijo `/api` y la ruta nunca se implementó del lado
  del servidor. Falla en silencio y el código ya contempla ese caso: cae de inmediato al
  progreso guardado localmente (`AsyncStorage`), que sí funciona. Código aislado a ese
  archivo, sin efecto observable en el uso normal de una tablet.

### Dato registrado en producción durante la prueba

Queda en la base de datos real un registro de prueba identificable
(`PRUEBA CLAUDE QA`, cédula `1122334455`), a la espera de que AGP decida si lo conserva
como caso de prueba o lo elimina.

### Corrección: etiqueta Izquierdo/Derecho invertida en la zona Posterior

El fix del 2026-09-02 (commit `5016950`) invirtió las etiquetas Izquierdo/Derecho tanto en
Parabrisas como en Posterior, asumiendo el mismo efecto espejo en ambas vistas de
`nivelvisual4.tsx`. AGP confirmó que la vista Posterior ya estaba correcta antes de ese
cambio — solo Parabrisas necesitaba la inversión. Revertido el mapeo de Posterior a su
estado original (commit `3ddc371`) y publicado por `eas update`.

---

## 2026-09-10 — Podio por isla: el desempate por tiempo no era verificable

### Reporte

AGP solicitó confirmar si el mecanismo de podio (orden por puntaje, desempate por tiempo)
está correctamente implementado para las 9 islas, señalando que **actualmente no es
posible revisarlo**.

### Diagnóstico

El backend (`getPodioIsla`, en `evaluacionFinal.model.js`) ya calculaba y ordenaba
correctamente por puntaje descendente con desempate por tiempo ascendente
(`DATEDIFF(SECOND, inicio, fin)`), mediante una sola consulta genérica parametrizada por
`islaKey` — no hay lógica distinta por isla. Se confirmó contra el catálogo real de
niveles en Azure (`GET /api/islas/:islaKey/niveles`) que las 9 islas tienen
`NIVELES_KEY`/`ISLAS_KEY` bien formados: 8 islas con 5 niveles cada una (Visual, Lectura,
Recordemos, Social, Evaluación) y la isla 9 (Evaluación Final) con 1 nivel único, como
corresponde a su naturaleza de cierre. El backend era correcto para las 9.

El problema real estaba en el frontend (`app/podio.tsx`):

- La respuesta del backend incluye `tiempoSegundos`, pero el mapeo al estado del
  componente lo descartaba por completo — el tiempo nunca se guardaba ni se mostraba en
  ninguna parte de la pantalla. Sin verlo, no había forma de confirmar que el desempate
  ocurría.
- El componente reordenaba la lista en el cliente comparando **solo** por puntaje, sin su
  propio criterio de desempate — dependía implícitamente de que el orden ya correcto que
  entrega el backend sobreviviera un `Array.sort` en JavaScript (estable en motores
  modernos, pero no declarado ni garantizado por el código).
- El subtítulo de la pantalla solo reconocía las islas 1, 2 y 3 por nombre
  (Introducción, HSE, Procesos); las 6 restantes mostraban el genérico "Isla N".
- El título decía "Podio - Evaluación Final", desactualizado desde que el fix del
  2026-09-02 cambió el cálculo al promedio de los 5 niveles de la isla.

### Corrección aplicada (commit `9066274`)

- Se captura `tiempoSegundos` y se muestra (formato `mm:ss`, u `h:mm:ss` si supera una
  hora) junto al puntaje, tanto en el podio de medallas como en la lista completa.
- El reordenamiento del cliente ahora replica explícitamente el mismo criterio del
  backend (puntaje descendente, tiempo ascendente como desempate), sin depender de la
  estabilidad implícita del ordenamiento recibido.
- Nombres de las 9 islas declarados explícitamente para el subtítulo.
- Título corregido a "Podio" a secas, sin la referencia obsoleta a evaluación final.

Publicado por `eas update` (branch `production`) — no requirió compilar un nuevo APK.
