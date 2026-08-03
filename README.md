[AGP · Agente: DOCUMENTAL]

# Juego de Onboarding AGP — Remediación y despliegue

**project_id:** AGP-CO-ONBOARDING-B15
**Estado:** Fuera de servicio — correcciones aplicadas, pendiente de despliegue
**Última revisión:** 2026-07-30

Código del juego de inducción para tablets de planta, **con las correcciones aplicadas**,
más la documentación de gobernanza y despliegue.

Origen: paquete `juego-app 1.zip` entregado por el proveedor. Archivos fuente del
2026-06-03. El ZIP original no fue modificado.

---

## Por qué existe esta carpeta

Las tablets dejaron de acceder al juego. **Causa confirmada:** el equipo que hospedaba la
API se dio de baja, y su dirección `172.16.60.75` fue reasignada a otro computador de
producción llamado `PREENSAMB-COEM`. Se verificó en sitio que la dirección responde a
nivel de red pero el puerto 3001 está cerrado.

La causa de fondo es que la dirección estaba **incrustada en el instalador**, repetida 64
veces en 46 archivos, sin posibilidad de redirigirla sin recompilar.

La base de datos está correcta y **no requiere cambios**: 12 tablas en `AGP_RRHH` con 72
participantes y 317 resultados de nivel.

---

## Dónde empezar

| Si necesitas… | Lee |
|---|---|
| Ficha de registro del proyecto | [project-card.md](project-card.md) |
| Qué se hizo y qué falta, con responsables | [specs/003-tasks.md](specs/003-tasks.md) |
| Riesgos identificados | [specs/005-risks.md](specs/005-risks.md) |
| Cómo desplegar | [specs/007-deployment-notes.md](specs/007-deployment-notes.md) |
| Detalle de cada cambio | [specs/009-change-log.md](specs/009-change-log.md) |
| Decisiones tomadas y por validar | [ai/decisions/](ai/decisions/) |
| Comandos exactos de Azure | [docs/runbook-despliegue-onboarding-azure.md](docs/runbook-despliegue-onboarding-azure.md) |
| Probar en local | [PRUEBAS-LOCALES.md](PRUEBAS-LOCALES.md) |
| Verificar el esquema de la base | [docs/verificar-esquema-onboarding.sql](docs/verificar-esquema-onboarding.sql) |

---

## Contenido

```
project-card.md              Ficha de registro
PRUEBAS-LOCALES.md           Guía para probar en este equipo
specs/                       Tareas, riesgos, despliegue, changelog
ai/decisions/                Registro de decisiones
docs/                        Runbook de Azure y script SQL de verificación
parches/                     Los 4 cambios, como diff aplicable al repo del proveedor
onboarding-game/             Frontend (Expo / React Native) — corregido
onboardingAGP-api/           Backend (Node.js / Express) — corregido
```

### Para compilar hace falta

`npm install` en cada uno de los dos proyectos. Las dependencias no se incluyen porque son
634 MB y se regeneran solas.

---

## Correcciones aplicadas

Cuatro parches, ya aplicados en el código de esta carpeta. Los diff en `parches/` sirven
para aplicarlos sobre el repositorio del proveedor.

| Parche | Corrige |
|---|---|
| `centralizar-api-url.patch` | 64 direcciones fijas → una definición en `app/config.ts`. Más dos defectos: un archivo apuntaba a un segundo equipo, otro tenía dirección inválida sin host. |
| `fix-endpoint-social.patch` | Tres niveles enviaban resultados a una ruta inexistente; sus puntajes nunca llegaban a la base. |
| `fix-logs-credenciales.patch` | Tres registros en consola exponían la configuración de base de datos y ambas contraseñas de administrador en texto plano. |
| `fix-evaluacion-identity.patch` | El guardado de la evaluación final fallaba siempre por conflicto con una columna `IDENTITY`. |

**Orden de aplicación:** `centralizar-api-url` antes de `fix-endpoint-social`, porque
tocan los mismos archivos.

> **Advertencia sobre el parche de evaluación.** Antes de la corrección la transacción
> fallaba y hacía rollback, preservando el contenido por accidente. Ahora el guardado **sí
> escribe**, y la operación borra las preguntas del nivel antes de insertar las nuevas. Hay
> 18 preguntas reales en producción: conviene probarlo sabiendo que un guardado con el
> formulario incompleto las reemplaza.

---

## Verificado

- **API en ejecución real** contra la base de producción: `/api/health` devolvió
  `{"ok":true,"db":true}` y `/api/islas/catalogo` las 9 islas. Sin credenciales en el log.
- **Sintaxis:** 62 archivos TypeScript y 31 JavaScript, 0 errores.
- **Completitud:** 356 de 356 archivos fuente contra el ZIP original.
- **Build web:** 156 archivos, 59 MB, sin errores.
- **Esquema:** 12 tablas confirmadas, con datos.

---

## Lo que falta, y de quién depende

| Pendiente | Depende de |
|---|---|
| Login dedicado de base de datos y rangos de IP de salida | TI / DBA de AGP |
| Crear y configurar el App Service | Infraestructura de AGP |
| Transferencia del proyecto Expo o exportación del keystore | Proveedor externo |
| Compilar el APK y distribuirlo | Desarrollo y Operaciones |

El trabajo de código está terminado. Los pendientes son accesos y gestión.

Existe una **alternativa sin dependencias externas**: publicar la versión web, que no
requiere cuenta de Expo, ni clave de firma, ni reinstalar en las tablets. Ver
`specs/007-deployment-notes.md`, parte 3.

---

## Advertencia de seguridad

La contraseña del login SQL `Apps` viajó en texto plano dentro del paquete del proveedor y
**se verificó que sigue vigente**. Ese login tiene permisos de lectura, escritura y
modificación de esquema sobre **toda** la base `AGP_RRHH`, que contiene datos personales.
Ver `specs/005-risks.md` (R-02).

Ningún archivo de esta carpeta contiene esa contraseña. Las plantillas `.env.example`
tienen los campos vacíos a propósito.
