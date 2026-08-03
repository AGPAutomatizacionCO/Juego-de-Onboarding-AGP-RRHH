[AGP · Agente: DOCUMENTAL]

# Tareas y plan de acción — Juego de Onboarding AGP

**project_id:** AGP-CO-ONBOARDING-B15
**Fecha:** 2026-07-30
**Objetivo:** Restablecer el servicio en las tablets de planta con la API hospedada en Azure.

---

## Principio de secuencia

La dirección del backend queda **incrustada en el APK al momento de compilar**. Por lo
tanto la API debe estar desplegada y con su URL definitiva **antes** de generar el
instalador. Compilar antes obliga a recompilar.

---

## Estado de las tareas

| # | Tarea | Responsable | Depende de | Estado |
|---|---|---|---|---|
| T-01 | Aplicar las 4 correcciones de código | Desarrollo | — | **Completada** |
| T-02 | Declarar identidad y versionado en `app.json` + crear `eas.json` | Desarrollo | — | **Completada** |
| T-03 | Instalar toolchain de compilación local (JDK + SDK Android) | Desarrollo | — | **Completada** |
| T-04 | Solicitar login dedicado de BD y rangos de IP de salida | AGP → TI | — | Pendiente |
| T-05 | Solicitar transferencia del proyecto Expo o exportación del keystore | AGP → Proveedor | — | Pendiente |
| T-06 | Crear App Service (plan F1 para validación) | Infraestructura | T-04 parcial | **Completada** (2026-07-31) |
| T-07 | Configurar variables de conexión y restricción de acceso por IP | Infraestructura | T-04, T-06 | **Completada — provisional** (ver nota IP abajo) |
| T-08 | Desplegar la API y validar `/api/health` y `/api/islas/catalogo` | Desarrollo | T-07 | **Completada** (2026-07-31) |
| T-09 | Generar proyecto nativo (`expo prebuild`) e instalar paquetes SDK exactos | Desarrollo | T-03 | **Completada** (2026-07-31) |
| T-10 | Generar clave de firma de AGP (o incorporar la del proveedor) | Desarrollo | T-05 (opcional) | **Completada** (2026-07-31) — ver D-003 |
| T-11 | Compilar el APK apuntando a la URL definitiva | Desarrollo | T-08, T-09, T-10 | **Completada** (2026-07-31) |
| T-12 | Validar el APK en una tablet | Operaciones | T-11 | Pendiente |
| T-13 | Distribuir a las demás tablets y archivar el APK en repositorio de AGP | Operaciones | T-12 | Pendiente |

**Nota sobre T-07:** la restricción de IP activa solo autoriza dos direcciones medidas el
2026-07-30 (`201.184.66.82`, `190.109.27.56`). AGP sale por al menos nueve direcciones
distintas (ver hallazgo en `specs/009-change-log.md`, 2026-07-31). Si la tablet en planta
sale por una tercera IP, la API responderá `403` — T-04 sigue siendo bloqueante para dejar
esto resuelto de forma definitiva.

Las tareas T-04 y T-05 son gestiones con terceros y deben iniciarse de inmediato porque
tienen tiempo de espera. No bloquean T-06 ni T-09.

---

## Detalle de tareas completadas

### T-01 · Correcciones de código

Cuatro parches, aplicados en esta carpeta y disponibles en `parches/` para aplicar sobre
el repositorio del proveedor.

| Parche | Líneas | Qué corrige |
|---|---|---|
| `centralizar-api-url.patch` | 974 | 64 direcciones fijas en 46 archivos → una sola definición en `app/config.ts`. Incluye dos defectos adicionales: `nivelsocial5.tsx` apuntaba a un segundo equipo (`172.16.61.81`) y `nivelcerebro1.tsx` tenía una dirección inválida sin host. |
| `fix-endpoint-social.patch` | 33 | `nivelsocial4`, `5` y `7` enviaban resultados a `/api/niveles/salto`, ruta que no existe. Sus puntajes nunca llegaban a la base. |
| `fix-logs-credenciales.patch` | 49 | Tres registros en consola que exponían la configuración de base de datos y ambas contraseñas de administrador en texto plano. |
| `fix-evaluacion-identity.patch` | 36 | `EVALUACION_KEY` es columna `IDENTITY`; el código insertaba valor explícito sin `SET IDENTITY_INSERT`, lo que hacía fallar siempre el guardado de la evaluación final. |

**Verificación aplicada:** 62 archivos parseados con el compilador de TypeScript, 0
errores de sintaxis. 31 archivos del backend validados con `node --check`, 0 errores.
0 direcciones fijas restantes. Finales de línea CRLF preservados.

### T-02 · Identidad y versionado

Declarado en `onboarding-game/app.json`:

```text
android.package    com.onboardinggame.juegoapp   (extraído del APK real)
version            1.0.1
runtimeVersion     policy: appVersion
updates.enabled    true
owner / projectId  onboardinggame / bbe87f7c-0753-4d3c-a010-3f6dc642525c
```

Creado `onboarding-game/eas.json` con perfiles `development`, `preview` y `production`,
todos con `distribution: internal` y `buildType: apk`, coherente con la distribución
actual sin Play Store.

**Decisión deliberada:** no se fijó `versionCode`. No fue posible leerlo del APK
instalado (está como entero en el manifiesto binario y no hay `aapt` disponible), y un
valor inventado podría quedar por debajo del instalado, lo que haría que Android
rechazara la actualización. Se dejó `appVersionSource: "remote"` para que el contador lo
gestione EAS.

**Pendiente asociado:** la dependencia `expo-updates` no se agregó al `package.json`.
Debe instalarse con `npx expo install expo-updates`, que resuelve la versión correcta
para el SDK, en lugar de fijar un número a mano.

### T-03 · Toolchain de compilación local

Instalado en `%LOCALAPPDATA%\dev-tools`, sin permisos de administrador y fuera de la
carpeta sincronizada con OneDrive:

```text
OpenJDK Temurin 17.0.20   (182 MB, api.adoptium.net, GPLv2+CE)
Android cmdline-tools     (136 MB, dl.google.com) — sdkmanager 19.0
Licencias del SDK         7 de 7 aceptadas
```

Esto permite compilar el APK **sin cuenta de Expo y sin costo**. Ver
`ai/decisions/D-002-compilacion-local.md`.

---

## Preguntas abiertas que bloquean el arranque

1. **Nombre y región del App Service.** Define la URL que queda incrustada en el APK;
   cambiarla después obliga a recompilar.
2. **Credencial para la validación.** ¿Se usa temporalmente el login `Apps` —comprometido
   y con `db_ddladmin`— o se espera el login dedicado?
3. **Rangos de IP públicas de salida de AGP**, para la restricción de acceso.
4. **Disponibilidad de restricciones por IP en el plan F1.** Sin confirmar. Si el plan
   gratuito no las soporta, no debe publicarse hasta resolverlo: los endpoints
   administrativos no tienen autenticación (R-03).
5. **Estrategia de firma.** Clave propia de AGP o la del proveedor.
6. **Número de tablets a intervenir.**

---

## Alternativa disponible sin dependencias externas

El proyecto compila también como aplicación web desde el mismo código, sin cuenta de
Expo, sin clave de firma y sin recompilar nada en las tablets. El build fue generado y
verificado: 156 archivos, 59 MB, sin errores.

Sirve para restablecer el servicio mientras se resuelven las gestiones con el proveedor,
o para demostrar el avance. **Requiere validación previa**: en navegador,
`expo-screen-orientation` es limitado y el comportamiento de video y voz difiere del
APK. No sustituye la validación en tablet si el entregable final es la app nativa.
