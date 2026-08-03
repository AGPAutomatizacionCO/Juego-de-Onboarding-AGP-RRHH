**Asunto:** Juego de Onboarding AGP — Servicio restablecido (AGP-CO-ONBOARDING-B15)

Buen día,

El servicio del juego de inducción quedó **restablecido y validado**. Comparto el resumen; el detalle técnico está documentado en el repositorio indicado al final.

---

## Lo solicitado

Determinar por qué las tablets de planta no podían acceder al juego de inducción, considerando que las tablas de datos ya estaban en el servidor corporativo de Azure.

## Diagnóstico

**El equipo que hospedaba el servicio de datos se dio de baja.** La aplicación tenía su dirección —`172.16.60.75`— grabada de forma permanente dentro del instalador. Al retirarse el equipo, esa dirección fue reasignada a otro computador de producción (`PREENSAMB-COEM`), que nunca tuvo el servicio.

La base de datos estaba correcta y no requirió cambios: 12 tablas en `AGP_RRHH`, con 72 participantes y 317 resultados registrados.

La causa de fondo es que la dirección estaba repetida **64 veces en 46 archivos**, sin forma de redirigirla sin recompilar e reinstalar en cada tablet.

## Qué se hizo

- **Se centralizó la dirección del servicio** en un único punto configurable. Esto es lo que evita que la falla se repita: un cambio futuro de servidor se resuelve en una línea.
- **Se corrigieron tres defectos funcionales adicionales** encontrados en la revisión: tres niveles no guardaban los puntajes en la base de datos (falla silenciosa, el participante veía el nivel aprobado); el guardado de la evaluación final fallaba siempre; y tres puntos del código imprimían credenciales en registros.
- **Se migró el servicio a Azure**, eliminando la dependencia de equipos de escritorio.
- **Se generó un instalador nuevo** con capacidad propia de AGP, sin depender de la cuenta del proveedor.

## Servicios creados en Azure

| Elemento | Nombre |
|---|---|
| Suscripción | `Microsoft Azure (agpglass): #1181528` |
| Grupo de recursos | `AGP-Colombia` *(existente)* |
| Plan de App Service | `plan-juego-rrhh-onboarding` — **F1 (Free) · Linux · East US** |
| Aplicación | `agp-juego-rrhh-onboarding` |
| **Dirección del servicio** | **https://agp-juego-rrhh-onboarding.azurewebsites.net** |
| Runtime | Node 24 LTS |
| Base de datos | `agpcolombia.database.windows.net` / `AGP_RRHH` — **sin cambios** |

Región East US por coincidir con la del servidor de base de datos. **Costo actual: cero**, verificado contra la API oficial de precios de Azure.

Configuración de seguridad aplicada: credenciales en la configuración del servicio y no en archivos, **HTTPS obligatorio** (antes las cédulas viajaban sin cifrar), y restricción de acceso por IP con denegación por defecto.

Validado: estado del servicio, conexión a base de datos, catálogo de contenido devolviendo las 9 islas, y rechazo de tráfico sin cifrar.

## Entregado

| Entregable | Detalle |
|---|---|
| `OnboardingGame-1.0.1-AGP.apk` | Instalador firmado · `com.onboardinggame.juegoapp` · v1.0.1 |
| `agp-onboarding-release.jks` | Clave de firma propiedad de AGP, con sus contraseñas |

**La aplicación anterior debe desinstalarse antes de instalar la nueva** — la clave de firma es distinta a la del proveedor y Android no permite actualizar sobre una firma diferente. El progreso de los participantes no se pierde: reside en la base de datos y se recupera al ingresar con la cédula.

## Pendiente

**1 · Prueba en las tablets.** Es lo único que falta para cerrar. **Conviene realizarla pronto**; de lo contrario habrá que abrir un ticket nuevo para retomarlo.

**2 · IP públicas de salida de la red de planta.** Hoy están autorizadas dos direcciones puntuales, medidas durante la intervención. Se detectó que el tráfico de AGP sale por **varias direcciones distintas** —se midieron dos desde el mismo equipo en minutos, y se identificaron al menos nueve en bloques diferentes—, comportamiento propio de múltiples enlaces con balanceo.

Si una tablet sale por una dirección no autorizada, el servicio la rechazará y el juego se verá caído de forma intermitente, que es el escenario más difícil de diagnosticar. Se requiere del área de Redes: **cuántos enlaces tiene la red de planta y sus IP públicas de salida, o el bloque asignado**.

## Hallazgos ajenos al alcance

Detectados de forma incidental. **No dependen del juego y su urgencia es mayor**; corresponden al área que administre el servidor de base de datos.

- **Regla de firewall abierta.** El servidor `agpcolombia` tiene una regla `Base IPs` con el rango `160.0.0.0 – 205.0.0.0`: unos 750 millones de direcciones públicas.
- **Credencial comprometida y vigente.** La contraseña del usuario SQL `Apps` venía en texto plano en el paquete del proveedor. Ese usuario tiene permisos de lectura, escritura y modificación de esquema sobre **toda** la base `AGP_RRHH`, que contiene nombres y cédulas de empleados.

## Observaciones sobre el plan de Azure

El nivel **F1 es gratuito y sirvió para validar, pero no para operación sostenida**: 60 minutos de CPU al día y suspensión por inactividad. Alcanza para pruebas con una o dos tablets, no para una jornada con varios participantes simultáneos. Referencia de migración a nivel Basic: aproximadamente 12,40 USD mensuales.

---

## Documentación

Todo el detalle técnico está versionado en:

**https://github.com/AGPAutomatizacionCO/Juego-de-Onboarding-AGP-RRHH**

| Documento | Contenido |
|---|---|
| `project-card.md` | Ficha de registro del proyecto |
| `specs/003-tasks.md` | Estado de las 13 tareas con responsables |
| `specs/005-risks.md` | 12 riesgos identificados, con impacto y mitigación |
| `specs/007-deployment-notes.md` | Procedimientos de despliegue y compilación |
| `specs/009-change-log.md` | Registro completo de cada cambio y verificación |
| `ai/decisions/` | Decisiones tomadas, pendientes de validación formal |
| `parches/` | Los cuatro cambios de código, aplicables al repositorio del proveedor |
| `PRUEBAS-LOCALES.md` | Guía para reproducir el entorno |

Incluye además los puntos que quedaron abiertos y no requieren acción inmediata: la ausencia de mecanismo de actualización remota, la custodia de la clave de firma, la falta de monitoreo del servicio, y dos aclaraciones pendientes con el proveedor sobre funcionalidad incompleta.

Quedo atento a comentarios.

Cordialmente,
