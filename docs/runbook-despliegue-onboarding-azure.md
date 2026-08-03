# Runbook — Despliegue de la API de Onboarding en Azure

**Proyecto:** Juego de Onboarding AGP
**Objetivo:** Restablecer el servicio de las tablets, hoy caído porque el equipo que hospedaba la API se dio de baja y su dirección `172.16.60.75` fue reasignada al computador `PREENSAMB-COEM`.
**Fecha:** 2026-07-29

---

## Contexto en una página

| Capa | Antes | Después |
|---|---|---|
| App en tablet | APK apuntando a `http://172.16.60.75:3001` | APK apuntando a `https://<app>.azurewebsites.net` |
| API | Equipo de escritorio dado de baja | Azure App Service (Linux, Node) |
| Base de datos | `agpcolombia.database.windows.net` · `AGP_RRHH` | **Sin cambios** |

La base de datos no se toca. Todo el trabajo está en la capa intermedia y en una recompilación del APK.

### Condiciones ya verificadas

- Las tablets tienen salida a internet → pueden alcanzar Azure.
- La base ya está en Azure SQL corporativo.
- El esquema de tablas fue confirmado con herramienta propia de AGP.

### Ruta crítica

La recompilación del APK requiere acceso a la cuenta de Expo **`onboardinggame`**. Gestionar ese acceso en paralelo; **no bloquea las fases 1 a 4 de este runbook.**

---

## Fase 0 · Prerrequisitos

- Suscripción de Azure con permiso para crear App Service y modificar el firewall de `agpcolombia`.
- Azure CLI instalado y autenticado: `az login`
- Código fuente de `onboardingAGP-api` (viene en el paquete del proveedor).
- Lista de **IP públicas de salida de AGP**, para restringir el acceso (solicitar a redes).
- Credenciales de la base. **No reutilizar las del archivo `.env` recibido**: viajaron en un ZIP y deben considerarse comprometidas. Rotarlas antes de este despliegue.

Definir nombres al inicio y reutilizarlos:

```bash
RG=rg-onboarding-agp
PLAN=plan-onboarding-agp
APP=api-onboarding-agp          # debe ser único global; genera <APP>.azurewebsites.net
REGION=eastus2
```

---

## Fase 1 · Ajustes de código antes de desplegar

Tres cambios pequeños. Los dos primeros son obligatorios; el tercero evita que este incidente se repita.

### 1.1 Sacar las credenciales del archivo `.env`

El código ya lee de variables de entorno (`process.env.DB_*`), así que **no requiere cambios**: basta con no desplegar el `.env` y definir las variables como App Settings en la Fase 3. Confirmar que `.env` esté en `.gitignore` y excluido del paquete de despliegue.

### 1.2 Quitar el registro de credenciales en consola

En `config/db.js` hay un `console.log` que imprime usuario y servidor, y en `controllers/adminAuth.controller.js` (~línea 210) se registra la contraseña del administrador en texto plano. En App Service esos registros quedan persistidos. Eliminar ambos antes de desplegar.

### 1.3 Centralizar la dirección de la API en el frontend

Causa raíz de esta falla: la dirección estaba incrustada 64 veces en 46 archivos de `onboarding-game/app/`. Dejar una sola definición en `app/config.ts` e importarla en el resto, eliminando los valores de reserva. Corregir además `nivelsocial5.tsx`, que apunta a un segundo equipo distinto (`172.16.61.81`).

Con la dirección centralizada, cualquier cambio futuro de host es una línea, no 46.

---

## Fase 2 · Crear la infraestructura

```bash
az group create --name $RG --location $REGION
```

```bash
az appservice plan create --name $PLAN --resource-group $RG --sku B1 --is-linux
```

Verificar el identificador exacto del runtime de Node disponible antes de crear la app:

```bash
az webapp list-runtimes --os linux --query "[?contains(@,'NODE')]" -o tsv
```

Crear la aplicación con el runtime que devolvió el comando anterior (ajustar `NODE:24-lts` si difiere):

```bash
az webapp create --name $APP --resource-group $RG --plan $PLAN --runtime "NODE:24-lts"
```

---

## Fase 3 · Configuración

### 3.1 Variables de entorno

Sustituir los valores por las credenciales **rotadas**. Evitar dejar la contraseña en el historial del shell — usar `read -s`:

```bash
read -s -p "Password de BD: " DBPASS && echo
```

```bash
az webapp config appsettings set --name $APP --resource-group $RG --settings DB_USER="Apps" DB_PASSWORD="$DBPASS" DB_SERVER="agpcolombia.database.windows.net" DB_DATABASE="AGP_RRHH" DB_PORT=1433 WEBSITE_NODE_DEFAULT_VERSION="~24"
```

No definir `PORT`: App Service la inyecta y el código ya la respeta (`process.env.PORT || 3001`).

### 3.2 Comando de arranque

```bash
az webapp config set --name $APP --resource-group $RG --startup-file "npm start"
```

### 3.3 Permitir que la API alcance Azure SQL

Regla especial `0.0.0.0` = "permitir servicios de Azure":

```bash
az sql server firewall-rule create --resource-group <RG-DE-LA-BD> --server agpcolombia --name AllowAzureServices --start-ip-address 0.0.0.0 --end-ip-address 0.0.0.0
```

> Si la política de AGP no admite esa regla amplia, la alternativa es integración con VNet más Private Endpoint. Requiere coordinación con redes y añade tiempo; evaluarlo con el equipo de infraestructura.

### 3.4 Restringir el acceso a la API — **obligatorio**

Los endpoints administrativos **no tienen autenticación** y CORS está abierto. Sin esta restricción, cualquiera en internet podría reescribir el contenido de los niveles o extraer nombres y cédulas de los participantes.

Repetir por cada rango público de salida de AGP:

```bash
az webapp config access-restriction add --resource-group $RG --name $APP --rule-name AGP-corporativo --action Allow --ip-address <RANGO_PUBLICO_AGP>/32 --priority 100
```

Al añadir la primera regla `Allow`, App Service deniega todo lo demás por omisión.

> Esto es una mitigación de red, no una corrección. Añadir autenticación a los endpoints `/api/admin/*` sigue siendo necesario.

---

## Fase 4 · Desplegar y validar

Empaquetar **sin** `node_modules` ni `.env`, y desplegar:

```bash
cd onboardingAGP-api && zip -r ../api.zip . -x "node_modules/*" ".env" "uploads/*"
```

```bash
az webapp deploy --resource-group $RG --name $APP --src-path ../api.zip --type zip
```

### Validación — el backend completo se prueba sin el APK

```bash
curl https://$APP.azurewebsites.net/api/health
```

Esperado: `{"ok":true,"db":true}`

- `{"ok":false,"db":false}` → la API arrancó pero no alcanza la base: revisar Fase 3.1 y 3.3.
- Sin respuesta → revisar los registros: `az webapp log tail --name $APP --resource-group $RG`

Recordar que la API **termina el proceso si no conecta con la base al arrancar**. En App Service eso se traduce en reintentos automáticos, pero si la configuración está mal el síntoma es un reinicio continuo visible en los registros.

Probar el catálogo, que es lo primero que pide la aplicación al abrir:

```bash
curl https://$APP.azurewebsites.net/api/islas/catalogo
```

Si devuelve las islas, **el backend está operativo de extremo a extremo** y la única tarea restante es la recompilación.

---

## Fase 5 · Recompilar el APK

Requiere acceso a la cuenta de Expo `onboardinggame`.

En `onboarding-game/.env`:

```
EXPO_PUBLIC_API_URL=https://<APP>.azurewebsites.net
```

> `EXPO_PUBLIC_*` se incrusta **en tiempo de compilación**. Editar este archivo no modifica un APK ya generado: hay que compilar de nuevo, siempre.

```bash
cd onboarding-game && npx eas build --platform android --profile preview
```

Instalar el APK resultante en una tablet y validar: registro de participante, carga del mapa, avance de un nivel y que el puntaje quede escrito en `Onboarding_Resultados_Nivel`.

---

## Alternativa si el acceso a Expo se demora

El proyecto incluye `react-native-web`, así que el mismo código compila a web **sin cuenta de EAS ni de Expo**:

```bash
cd onboarding-game && npx expo export --platform web
```

El resultado (`dist/`) se publica en Azure Static Web Apps o en el mismo App Service, y las tablets lo abren en el navegador.

**Requiere validación previa.** En web, `expo-haptics` no hace nada, `expo-screen-orientation` es limitado, y el comportamiento de video y voz debe probarse. Sirve para restablecer el servicio o demostrar la solución, no como reemplazo definitivo del APK sin antes verificarlo.

---

## Pendientes posteriores a la salida a producción

| Tema | Por qué importa |
|---|---|
| Autenticación en `/api/admin/*` | La restricción por IP es un paliativo, no una corrección |
| Contraseñas de administrador con hash | Hoy se comparan en texto plano contra la tabla |
| Imágenes a Blob Storage | En App Service `/home` persiste entre reinicios, pero se pierde al redesplegar |
| Escritura en `Onboarding_Respuestas` | La API la consulta pero nunca escribe: el reporte de detalle saldrá vacío |
| Columnas `IDENTITY` | El panel admin inserta llaves explícitas sin `SET IDENTITY_INSERT`; si esas columnas son `IDENTITY`, guardar contenido falla |
| Propiedad de la cuenta de Expo | Sin ella AGP no puede generar versiones nuevas |
| Control de versiones | El paquete llegó con archivos `.bak` y variantes `_new` sueltas |

---

## Reversión

No aplica en el sentido tradicional: el servicio ya está caído y no hay estado previo al cual volver. Si el despliegue falla, el impacto es nulo respecto a la situación actual. La base de datos no se modifica en ningún paso de este runbook.
