# Cómo probar el juego desde esta carpeta

Se puede probar **todo el sistema completo hoy**, sin Azure, sin el APK y sin la cuenta de
Expo. Ya se verificó que este equipo alcanza `agpcolombia.database.windows.net` por el
puerto 1433, así que la API corre local y habla con la base real.

Node v24.13.0 y npm 11.6.2 ya están instalados en el equipo.

---

## ⚠️ Antes de empezar — lee esto

**La base de datos configurada es PRODUCCIÓN.** Contiene 72 participantes reales, 317
resultados de nivel y las 18 preguntas de la evaluación final. Probar contra ella
**escribe datos reales**.

### Lo que NO debes hacer contra producción

| Acción | Qué pasa |
|---|---|
| Guardar contenido en el panel de administración | **Borra** las preguntas del nivel y las reinserta. Con el parche aplicado esto **ya sí se ejecuta** — antes fallaba y hacía rollback, protegiendo los datos por accidente. Las llaves cambian de valor. |
| Completar un nivel jugando | Inserta filas reales en `Onboarding_Resultados_Nivel` y actualiza `Onboarding_Resultados_Isla`. |
| Registrar un participante | Inserta una fila real en `Onboarding_Usuarios_NEW`. |

### La forma segura: probar contra una copia

Un solo comando en Azure SQL crea una copia completa del servidor:

```sql
CREATE DATABASE AGP_RRHH_TEST AS COPY OF AGP_RRHH;
```

Requiere permiso a nivel de servidor (`dbmanager` o administrador), que el login `Apps`
no tiene — hay que pedírselo a quien administre el servidor. Tarda unos minutos y luego
basta cambiar una línea en `onboardingAGP-api/.env`:

```
DB_DATABASE="AGP_RRHH_TEST"
```

Con eso puedes registrar participantes, jugar niveles y editar contenido sin
consecuencias. **Es lo recomendado si vas a mostrarlo al cliente.**

Si no es posible la copia, limítate a navegar y ver contenido, sin enviar respuestas y
sin entrar a guardar en el panel de administración.

---

## Paso 1 · Instalar dependencias

Dos proyectos, dos instalaciones. La primera vez tarda varios minutos.

```bash
cd "C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\onboardingAGP-api" && npm install
```

```bash
cd "C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\onboarding-game" && npm install
```

---

## Paso 2 · Completar la contraseña

El archivo `onboardingAGP-api/.env` está listo con servidor, base, usuario y puerto. Solo
falta la contraseña, que **deliberadamente se dejó vacía** para no escribirla en una
carpeta que sincroniza con OneDrive.

Ábrelo y completa la línea:

```
DB_PASSWORD=<la contraseña del usuario Apps>
```

Está en el `.env` del paquete original del proveedor, en `onboardingAGP-api/.env`.

> Recordatorio: esa credencial viajó en el ZIP y debe considerarse comprometida. Tiene
> roles `db_datareader`, `db_datawriter` y `db_ddladmin` sobre toda `AGP_RRHH`. Sirve para
> probar hoy, pero el despliegue definitivo debe usar un login dedicado.

---

## Paso 3 · Levantar la API

```bash
cd "C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\onboardingAGP-api" && node index.js
```

Debe imprimir:

```
Conectado a SQL Server
API encendida en 0.0.0.0:3001 (accesible desde la red local)
```

Si en cambio imprime `Error conectando a SQL:` y luego `No se pudo conectar a la DB. No se
levanta el servidor.`, la contraseña está mal o fue rotada. **La API está programada para
terminar el proceso si no conecta**, así que no queda escuchando.

Deja esa ventana abierta y comprueba en otra:

```bash
curl http://localhost:3001/api/health
```

Esperado: `{"ok":true,"db":true}`

Y que devuelva las 9 islas:

```bash
curl http://localhost:3001/api/islas/catalogo
```

Si esas dos responden, **el backend completo está funcionando**. Es la misma validación
que pide el runbook de Azure, así que este paso también verifica que el código está bien
antes de desplegarlo.

---

## Paso 4 · Levantar el juego

### Opción A — Navegador (la más rápida)

```bash
cd "C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\onboarding-game" && npx expo start --web
```

Abre en el navegador. El `.env` del frontend ya apunta a `http://localhost:3001`, así que
no hay que configurar nada.

El juego está diseñado para **tablet horizontal de 1280×800**. Ajusta el tamaño de la
ventana a esa proporción o la interfaz se verá desalineada.

Limitaciones del navegador, para no confundirlas con fallas: `expo-haptics` no hace nada,
`expo-screen-orientation` es limitado, y el comportamiento de video y voz puede diferir
del APK. Sirve para validar navegación, contenido y que la base responda — no para
certificar la experiencia final en tablet.

### Opción B — Tablet real en la misma red

Tres ajustes.

**1.** Cambiar el `.env` del frontend a la IP de este equipo (`172.16.50.95`), porque
`localhost` desde la tablet apunta a la tablet:

```
EXPO_PUBLIC_API_URL=http://172.16.50.95:3001
```

**2.** Permitir el puerto 3001 en el firewall de Windows (una sola vez, como
administrador):

```powershell
New-NetFirewallRule -DisplayName "Onboarding API 3001" -Direction Inbound -Protocol TCP -LocalPort 3001 -Action Allow
```

**3.** Arrancar y abrir con Expo Go en la tablet:

```bash
cd "C:\Users\bmartin\OneDrive - AGP GROUP\Documentos\GitHub\Archivos Juego RRHH\onboarding-game" && npx expo start
```

Escanea el código QR con la app Expo Go. Si algún módulo nativo falla en Expo Go, hay que
generar un *development build* — y eso ya requiere la cuenta de Expo.

> Nota: la tablet debe poder alcanzar `172.16.50.95`. Este equipo está en la subred
> `172.16.50.0/23`; si las tablets están en otro segmento, el enrutamiento corporativo
> debería permitirlo (se comprobó que este equipo alcanza `172.16.60.x` en 2 saltos), pero
> conviene verificarlo con un `ping` desde la tablet.

---

## Qué conviene revisar

Lo que vale la pena validar en esta prueba, en orden:

1. **Que el catálogo cargue.** Mapa con las 9 islas y sus niveles. Confirma que la base
   responde y que el contenido está completo.
2. **Que los niveles abran con contenido.** 76 pares visuales, 23 conceptos, 18 lecturas,
   15 casos sociales. Un nivel en blanco indicaría contenido faltante.
3. **La corrección de la dirección centralizada.** Si todo carga, el parche funciona: la
   aplicación está resolviendo la dirección desde `app/config.ts` y no desde 64 valores
   dispersos.
4. **Solo contra una copia de la base:** registro de participante, completar un nivel, y
   el guardado del panel de administración — que es el que estaba roto y ahora debe
   funcionar.

## Si algo falla

| Síntoma | Causa probable |
|---|---|
| La API no arranca y muestra error de SQL | Contraseña vacía o rotada en `.env` |
| El juego carga pero todo sale vacío | La API no está encendida, o el `.env` del frontend apunta a otra dirección |
| En consola del navegador: fallos de red a `localhost:3001` | La ventana de la API se cerró |
| La tablet no conecta pero el navegador sí | Firewall de Windows, o `.env` con `localhost` en vez de la IP |
| Advertencia de `EXPO_PUBLIC_API_URL no está definida` | Falta el `.env` del frontend. Es el aviso que agregó el parche |
| Subir imagen falla en el panel admin | Falta la carpeta `onboardingAGP-api/uploads/` |
