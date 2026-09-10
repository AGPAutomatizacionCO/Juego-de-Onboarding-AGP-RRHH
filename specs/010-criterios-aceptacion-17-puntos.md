[AGP · Agente: DOCUMENTAL]

# Criterios de aceptación — Corrección de 17 errores "Onboarding Game"

**project_id:** AGP-CO-ONBOARDING-B15
**Fecha:** 2026-09-10
**Referencia:** Documento de Requerimiento "Corrección de Errores en Aplicación Onboarding Game" (levantado 2026-05-23)

Este documento traduce cada uno de los 17 puntos del requerimiento original a un
criterio de aceptación verificable, con su estado real a la fecha y el commit donde
se corrigió. Objetivo: confirmar qué queda listo para validar y qué sigue
bloqueado antes de la sesión de mañana.

**Leyenda de estado:**
✅ Resuelto y verificado · ⚠️ Resuelto en código, pendiente de verificación en tablet/prod · ⏸️ Pausado a solicitud de AGP · ⛔ Bloqueado (falta algo fuera de código) · ➖ Descartado (fuera de alcance de este ticket)

---

## Resumen ejecutivo para la validación de mañana

| # | Punto | Estado |
|---|---|---|
| 1 | Podio por isla (puntaje + desempate por tiempo) | ✅ |
| 2 | Reintento de evaluación habilitado por admin | ⚠️ |
| 3 | HSE — progreso no se guardaba, podio 404 | ⚠️ |
| 4 | Procesos — bloqueo hacia Recordemos | ✅ |
| 5 | Procesos — contenido cruzado con Conceptos Generales | ✅ |
| 6 | Conceptos Generales — números sobre el vidrio | ✅ |
| 7 | Conceptos Generales — etiqueta Derecho/Izquierdo invertida | ✅ |
| 8 | Conceptos Generales — texto cortado en evaluación final | ✅ |
| 9 | Manipulación — perder vidas salta de módulo | ✅ |
| 10 | Manipulación — imágenes borrosas módulo visual 4 | ➖ |
| 11 | Manipulación — texto no visible en evaluación final | ✅ |
| 12 | Manipulación — flujo de respuestas correctas/incorrectas | ➖ |
| 13 | Metrología — crucigrama palabra 1 no carga | ✅ |
| 14 | Admin — reporte filtrable por usuario | ⏸️ |
| 15 | Admin — contadores inconsistentes | ⏸️ |
| 16 | Lectura OF — crash al entrar al nivel visual | ⛔ |
| 17 | Evaluación Final — no muestra porcentaje | ⚠️ |

**Bloqueante real para mañana:** el punto 16 no se puede dar por cerrado todavía
— ver detalle abajo. Todo lo marcado ⚠️ necesita una verificación puntual (no un
fix nuevo) antes de confirmarlo. Los ⏸️ siguen pausados porque así se pidió
explícitamente, no por olvido.

---

## Detalle por punto

### 1. Podio por isla — condición del podio
**Tipo:** Amarillo (general) · **Estado:** ✅ Resuelto

**Criterio de aceptación:** el podio de cualquier isla se calcula sobre el
promedio de los 5 niveles que la componen (no solo la evaluación final), ordena
por puntaje descendente y usa el tiempo total como desempate visible en pantalla.

**Verificado:**
- Backend (`getPodioIsla`) genérico por `islaKey`, confirmado correcto para las
  9 islas contra el catálogo real de Azure (commit `5016950`).
- Frontend (`podio.tsx`) exponía el cálculo pero ocultaba el tiempo de desempate
  y solo nombraba 3 de las 9 islas — corregido hoy (commit `9066274`).

**Pendiente:** validación visual en tablet/local de que el tiempo se ve
correctamente en al menos dos islas distintas.

---

### 2. Acceso a evaluación final — reintento por admin
**Tipo:** Amarillo (general) · **Estado:** ⚠️ Resuelto en código, falta confirmar migración

**Criterio de aceptación:** el administrador habilita el reintento por usuario y
por nivel específico; el permiso se consume solo al iniciar el intento, nunca antes
ni de forma automática.

**Verificado:** implementado en commit `5016950` (columna `REINTENTO_HABILITADO`,
consumo al pulsar "Comenzar", nunca antes).

**Bloqueante para cerrar:** la migración `onboardingAGP-api/sql/2026-09-01_add_reintento_habilitado.sql`
que agrega esa columna **no tiene confirmación de haberse ejecutado contra la
base de producción real**. Sin eso, el flujo de reintento fallará en producción
aunque el código esté listo. **Alguien con acceso a SSMS debe correrla y
confirmar antes de la validación de mañana.**

---

### 3. HSE — información no guardada / podio 404
**Tipo:** Amarillo (general) · **Estado:** ⚠️ Resuelto en código, falta verificación específica en HSE

**Criterio de aceptación:** cada nivel de HSE guarda su resultado en base de
datos (no solo el porcentaje general), y el podio de HSE carga sin error 404.

**Verificado:** commit `5016950` corrigió el guardado del nivel Social de HSE
(esperaba `nivelKey` en el cuerpo en vez de la URL) y una atribución de isla
incorrecta en Recordemos. El mecanismo genérico de podio (punto 1) ya cubre
HSE — confirmado que `ISLAS_KEY=2` tiene sus 5 niveles bien mapeados.

**Pendiente:** el reporte original menciona "4 últimos niveles deshabilitados"
— no hay evidencia de que esto se haya probado específicamente después del fix.
Recomendado: jugar HSE completo en la validación de mañana antes de marcarlo ✅.

---

### 4. Procesos de Producción — bloqueo hacia "Recordemos"
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** al completar los niveles previos de Procesos, el
usuario avanza a "Recordemos" sin bloqueos, y ese nivel no comparte progreso
con el "Recordemos" de HSE.

**Verificado:** commit `5016950` — "corrige claves de progreso desincronizadas
en Procesos que bloqueaban el avance a Recordemos". Las claves de progreso son
por isla+nivel (`u:<usuario>:isla<N>_nivel<N>_...`), no se cruzan entre islas.

---

### 5. Procesos de Producción — contenido cruzado con Conceptos Generales
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** Procesos de Producción muestra únicamente su propio
contenido; ninguna pantalla carga datos de Conceptos Generales.

**Verificado:** commit `5016950` — corrigió "la lectura del estado de evaluación
que apuntaba a la isla de Conceptos Generales en vez de Procesos".

---

### 6. Conceptos Generales — números sobre el vidrio
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** los marcadores numéricos no se superponen a las
piezas de vidrio en pantalla.

**Verificado:** commit `5016950`.

---

### 7. Conceptos Generales — etiqueta Izquierdo/Derecho invertida
**Tipo:** Rojo · **Estado:** ✅ Resuelto (con corrección posterior)

**Criterio de aceptación:** las etiquetas Izquierdo/Derecho corresponden a la
ubicación real de cada pieza, tanto en Parabrisas como en Posterior.

**Verificado:** commit `5016950` invirtió Parabrisas y Posterior por igual.
AGP reportó que Posterior ya estaba correcto antes de ese cambio — revertido
puntualmente hoy en commit `3ddc371`, publicado por OTA. Parabrisas se
mantiene invertido (esa sí era la corrección correcta).

---

### 8. Conceptos Generales — texto incompleto en evaluación final
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** el texto de las tablas en la primera actividad de
la evaluación final se ve completo, sin cortes.

**Verificado:** commit `5016950` — "texto de tabla que se cortaba en la
evaluación final, corregido en todas las islas" (fix único aplicado
transversalmente, no solo a esta isla).

---

### 9. Manipulación del Vidrio — perder vidas salta de módulo
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** al agotar las vidas de una sección, el sistema
reinicia esa misma sección — no avanza al siguiente módulo.

**Verificado:** commit `5016950`. Confirmado además en el código actual de
`nivelvisual7.tsx` (`reintentarActual` reinicia la sección actual, nunca llama
a `avanzarActual`).

---

### 10. Manipulación del Vidrio — imágenes borrosas en módulo visual 4
**Tipo:** Rojo · **Estado:** ➖ Descartado para este ticket

**Motivo:** limitación de resolución de las fotografías fuente, no corregible
por código. Marcado explícitamente por AGP como fuera de alcance.

---

### 11. Manipulación del Vidrio — texto no visible en evaluación final
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** el texto de las tablas de evaluación final es
legible completo, igual que en el punto 8.

**Verificado:** cubierto por el mismo fix transversal del punto 8 (commit
`5016950`, aplicado a todas las islas). La nota del documento original ("mismo
problema del punto anterior") referencia el punto 10 por error de trascripción
— el defecto real es de texto, no de imagen, y ese sí quedó resuelto.

---

### 12. Manipulación del Vidrio — flujo de respuestas correctas/incorrectas
**Tipo:** Rojo · **Estado:** ➖ Descartado para este ticket

**Motivo:** marcado explícitamente por AGP como descartado.

---

### 13. Metrología — crucigrama, palabra 1 no carga
**Tipo:** Rojo · **Estado:** ✅ Resuelto

**Criterio de aceptación:** el crucigrama carga completo, incluida la palabra 1
y sus espacios; el usuario puede resolverlo y avanzar.

**Verificado:** commit `5016950` — "crucigrama con el número de palabra tapado
y dos cruces de letras contradictorios que impedían completarlo".

---

### 14. Administrador — reporte filtrable por usuario/onboarding
**Tipo:** Rojo · **Estado:** ⏸️ Pausado a solicitud de AGP

**Criterio de aceptación (pendiente de retomar):** el reporte permite filtrar
por número de onboarding (grupos de 10 personas) y consultar el detalle de un
usuario individual.

**Estado real:** pausado explícitamente por AGP para una etapa posterior, no
iniciado. No se espera para la validación de mañana.

---

### 15. Administrador — información inconsistente (contadores)
**Tipo:** Rojo · **Estado:** ⏸️ Pausado a solicitud de AGP

**Criterio de aceptación (pendiente de retomar):** los contadores de errores,
intentos y vidas en el panel administrador coinciden exactamente con la
actividad real del usuario en el juego.

**Estado real:** pausado explícitamente por AGP, no iniciado. No se espera
para la validación de mañana.

---

### 16. Lectura de Orden de Fabricación — crash al entrar al nivel visual
**Tipo:** Rojo · **Estado:** ⛔ Bloqueado — no se puede validar completo mañana

**Criterio de aceptación:** la isla carga sin cerrar la aplicación, y el nivel
visual es jugable de principio a fin.

**Lo que sí se resolvió:**
- El crash original (pantalla vacía que cerraba la app) — commit `5016950`,
  nivel reconstruido con el mismo motor que HSE.
- La pantalla ya no cierra la aplicación.

**Lo que sigue bloqueado — no es un bug de código, es contenido faltante:**
El nivel visual de esta isla carga sus imágenes desde la base de datos
(`/api/niveles/visual/31`), y esa tabla está **vacía** — nadie subió el
contenido (parejas de imágenes). Además, se encontró que **el panel admin no
tenía forma de cargar ese contenido**: el editor de "pares de imágenes" no
tenía botón para agregar filas nuevas, y el backend solo sabía actualizar
filas ya existentes, nunca crear una desde cero.

Corregido hoy (commit `1eca728`):
- Backend: el guardado de pares visuales ahora crea filas nuevas (mismo patrón
  que ya usan Lectura/Recordemos/Social/Evaluación).
- Panel admin: botón "+ Añadir" y "Eliminar" en el editor de pares visuales.
- Frontend ya publicado por OTA. **El backend todavía no se ha desplegado a
  Azure — quedó pendiente de tu confirmación.**

**Para que este punto quede realmente cerrado mañana hacen falta, en orden:**
1. Desplegar el backend corregido a Azure (pendiente, solo falta tu confirmación).
2. Alguien con las imágenes de "Lectura OF" debe cargarlas desde el panel admin
   (esto no lo puedo hacer yo — necesita el contenido real: fotos + conceptos).
3. Volver a probar el nivel visual con contenido real cargado.

Mismo vacío de contenido existe en Manipulación del Vidrio, Metrología y
Calidad, pero esas tres no lo sufren en la práctica porque sus pantallas usan
imágenes fijas del proyecto en vez de traerlas de la base — no bloquean nada
hoy, aunque conviene saber que la tabla está vacía para ellas también.

**Riesgo adicional identificado, sin resolver:** las imágenes que se suban por
este editor se guardan en disco local del servidor (no en Blob Storage, que es
donde viven las imágenes que sí funcionan hoy) — se pierden en cada
redespliegue de Azure. Es un riesgo ya documentado desde el 2026-07-31
(`specs/007-deployment-notes.md`, riesgo R-08) y sigue sin solución definitiva.

---

### 17. Evaluación Final — no aparece el porcentaje
**Tipo:** Rojo · **Estado:** ⚠️ Pendiente de verificación puntual

**Criterio de aceptación:** al finalizar la evaluación final de cualquier isla,
la pantalla de resultados muestra el porcentaje obtenido.

**Estado real:** no hay un commit que lo mencione de forma aislada; su cierre
depende de la misma verificación pendiente del punto 2 (migración de
reintento) según quedó anotado en sesiones anteriores. Debe probarse
explícitamente mañana, completando una evaluación final real de principio a
fin y confirmando que el porcentaje se muestra.

---

## Qué hace falta antes de la sesión de mañana

1. **Confirmar y correr** (si no se ha hecho) la migración
   `2026-09-01_add_reintento_habilitado.sql` contra producción — bloquea los
   puntos 2 y 17.
2. **Autorizar el despliegue del backend a Azure** con el fix del panel admin
   (commit `1eca728`) — bloquea el punto 16.
3. **Conseguir el contenido real** (fotos + conceptos) de "Lectura de Orden de
   Fabricación" para cargarlo desde el panel una vez desplegado — bloquea el
   cierre completo del punto 16.
4. Jugar HSE completo (punto 3) y una evaluación final completa (punto 17)
   como parte de la validación, no solo revisar código.

Todo lo demás (1, 4, 5, 6, 7, 8, 9, 11, 13) está listo para validarse
directamente mañana sin acciones previas.
