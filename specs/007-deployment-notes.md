[AGP · Agente: DOCUMENTAL]

# Notas de despliegue — Juego de Onboarding AGP

**project_id:** AGP-CO-ONBOARDING-B15
**Fecha:** 2026-07-30

Dos procedimientos independientes: hospedar la API en Azure, y compilar el instalador
localmente. El segundo depende del primero solo por la URL.

---

## Arquitectura objetivo

```
Tablet (APK)  ──HTTPS──▶  App Service (Azure)  ──TLS 1.2──▶  agpcolombia.database.windows.net
                          Node 24 · Express               Azure SQL · AGP_RRHH · 12 tablas
```

La capa de datos no cambia. Todo el trabajo está en la capa intermedia y en una
recompilación del instalador.

---

## Parte 1 · API en Azure App Service

Procedimiento detallado con comandos en `docs/runbook-despliegue-onboarding-azure.md`.
Resumen de las decisiones y puntos de atención:

### Plan de servicio

Se acordó usar el plan **F1 (gratuito)** para validar funcionamiento, con migración a un
plan facturado por el área responsable si se confirma la necesidad.

Limitaciones a tener en cuenta durante la validación:

- 60 minutos de CPU al día. Suficiente para pruebas con una o dos tablets, no para una
  jornada de inducción con varios participantes.
- Sin *Always On*: la aplicación se suspende por inactividad. Como la API termina el
  proceso si no logra conectar con la base al arrancar (R-09), cada reactivación reintenta
  la conexión y un fallo transitorio provoca reinicio. Puede percibirse como
  intermitencia.
- **Sin confirmar:** si el plan F1 admite restricciones de acceso por IP. Es un punto
  bloqueante: sin esa restricción los endpoints `/api/admin/*`, que no tienen
  autenticación (R-03), quedarían accesibles desde internet. Si F1 no las soporta, no debe
  publicarse el servicio hasta resolverlo.

### Configuración obligatoria

- Variables de conexión (`DB_SERVER`, `DB_DATABASE`, `DB_USER`, `DB_PASSWORD`, `DB_PORT`)
  como configuración de la aplicación, **nunca en archivo**. No definir `PORT`: la
  plataforma la inyecta y el código ya la respeta.
- Restricción de acceso limitada a los rangos de salida de AGP.
- Autorizar el App Service en el firewall de Azure SQL.

### Orden crítico

**Primero la configuración, después el código.** Si se despliega antes de definir las
variables, el servicio entrará en ciclo de reinicios porque la API termina el proceso al
no poder conectar, y parecerá un fallo de despliegue cuando solo falta configuración.

### Validación

```text
GET /api/health           → {"ok":true,"db":true}
GET /api/islas/catalogo   → las 9 islas
```

Si ambas responden, el backend queda verificado de extremo a extremo. Esta misma
validación se ejecutó con éxito en local el 2026-07-30 contra la base de producción, por
lo que el riesgo de código en este paso está retirado.

---

## Parte 2 · Compilación local del instalador

No requiere cuenta de Expo ni tiene costo. Ver `ai/decisions/D-002-compilacion-local.md`.

### Toolchain instalado

```text
%LOCALAPPDATA%\dev-tools\jdk-17.0.20+8      OpenJDK Temurin 17
%LOCALAPPDATA%\dev-tools\android-sdk         cmdline-tools, sdkmanager 19.0
                                             7 de 7 licencias aceptadas
```

Node v24.13.0 y npm 11.6.2 ya estaban presentes en el equipo.

### Secuencia

1. `npx expo install expo-updates` — solo si se decide incluir actualización remota. Para
   la primera compilación se recomienda **omitirlo** y poner `updates.enabled` en `false`,
   para reducir variables.
2. `npx expo prebuild --platform android` — genera el proyecto nativo.
3. Leer del Gradle generado el `compileSdkVersion` y `buildToolsVersion` exigidos, e
   instalar **exactamente** esos paquetes con `sdkmanager`. No se instalaron por
   anticipado para evitar descargar plataformas que no se usan y para no equivocar la
   versión.
4. Generar la clave de firma de AGP con `keytool`, o incorporar la del proveedor si llega.
5. `./gradlew assembleRelease` en la carpeta `android/`.

El APK resultante queda en `android/app/build/outputs/apk/release/`.

### Requisito previo ineludible

`EXPO_PUBLIC_API_URL` debe apuntar a la URL definitiva del App Service **antes** de
compilar. Las variables `EXPO_PUBLIC_*` se incrustan en tiempo de compilación: editar la
configuración no modifica un APK ya generado.

### Consecuencia de la firma propia

Si se compila con clave de AGP, Android rechazará instalar sobre la aplicación existente
por firma distinta. Habrá que **desinstalar en cada tablet antes de reinstalar**. El
progreso de los participantes se conserva porque reside en la base de datos.

---

## Parte 3 · Alternativa web

El mismo código compila como aplicación web sin cuenta de Expo, sin firma y sin
instalación en dispositivos:

```text
npx expo export --platform web
```

Build generado y verificado el 2026-07-30: 156 archivos, 59 MB, sin errores.

Opción recomendada para servirlo: desde la misma API de Express, añadiendo
`app.use(express.static(...))`. Deja un solo servicio, una sola URL y **mismo origen**, lo
que elimina de raíz el problema de CORS abierto en lugar de solo mitigarlo. El patrón ya
existe en el código para la carpeta `/uploads`.

**No se aplicó ese cambio**, por estar pendiente de decisión.

Requiere validación previa: en navegador `expo-screen-orientation` es limitado y el
comportamiento de video y voz difiere del APK. `expo-haptics` está declarado pero no se
usa en ningún archivo, por lo que su falta de soporte web es irrelevante.

---

## Post-despliegue

| Acción | Motivo |
|---|---|
| Archivar el APK en un repositorio de AGP | El único instalador vivía en la cuenta de un tercero (R-06) |
| Custodiar la clave de firma en repositorio seguro | Perderla impide toda actualización futura |
| Versionar el código en un repositorio de AGP | Llegó como ZIP, sin trazabilidad (R-06) |
| Migrar imágenes a Blob Storage | En App Service se pierden al redesplegar (R-08) |
| Añadir autenticación a `/api/admin/*` | La restricción por IP es mitigación, no corrección (R-03) |
| Rotar la credencial `Apps` | Comprometida y con `db_ddladmin` sobre toda la base (R-02) |
