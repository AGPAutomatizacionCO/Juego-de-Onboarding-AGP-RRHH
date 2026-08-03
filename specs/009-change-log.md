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
