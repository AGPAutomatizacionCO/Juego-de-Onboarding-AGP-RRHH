[AGP · Agente: DOCUMENTAL]

# Registro de riesgos — Juego de Onboarding AGP

**project_id:** AGP-CO-ONBOARDING-B15
**Fecha de registro:** 2026-07-30
**Estado:** Requiere validación humana

---

## R-01 · Propiedad de la cuenta de compilación y clave de firma

```text
risk_id:                        R-01
date:                           2026-07-30
description:                    El instalador se genera desde la cuenta de Expo
                                "onboardinggame", ajena a AGP. Esa cuenta custodia la
                                clave de firma del APK.
impact:                         Crítico. Sin la misma clave, Android rechaza instalar
                                una versión nueva sobre la instalada. AGP no puede
                                producir actualizaciones por sí misma.
probability:                    Confirmado (no es hipótesis)
affected_area:                  Despliegue, continuidad, mantenimiento
mitigation:                     Solicitar transferencia del proyecto o exportación del
                                keystore. Alternativa: generar clave propia de AGP y
                                desinstalar la app en cada tablet antes de reinstalar.
owner:                          Pendiente de validación humana
urgency:                        Alta — es la ruta crítica del proyecto
status:                         Parcialmente mitigado (2026-07-31) — se generó una clave
                                propia de AGP (ver ai/decisions/D-003-generacion-keystore.md).
                                AGP ya tiene capacidad técnica de firmar sus propias
                                versiones. Sigue abierto en la práctica: falta custodia
                                formal del archivo y sus contraseñas, y sigue pendiente la
                                consecuencia de la transición (desinstalar en cada tablet
                                antes de reinstalar, por el cambio de firma).
human_validation_required:      Sí
```

## R-02 · Credencial de base de datos comprometida con permisos amplios

```text
risk_id:                        R-02
date:                           2026-07-30
description:                    El paquete entregado por el proveedor incluye el archivo
                                .env con la contraseña del login SQL "Apps" en texto
                                plano. Se verificó que la credencial sigue vigente.
impact:                         Crítico. El login tiene roles db_datareader, db_datawriter
                                y db_ddladmin sobre TODA la base AGP_RRHH: permite leer,
                                escribir y eliminar cualquier objeto, no solo las 12
                                tablas del juego. La base contiene datos personales.
probability:                    Confirmado
affected_area:                  Seguridad, datos personales, cumplimiento
mitigation:                     Crear login dedicado con permisos limitados a las tablas
                                dbo.Onboarding_*. Rotar "Apps" coordinando con el
                                administrador del servidor, verificando antes qué otros
                                sistemas lo consumen.
owner:                          Pendiente de validación humana
urgency:                        Alta
status:                         Abierto
human_validation_required:      Sí
```

## R-03 · Endpoints administrativos sin autenticación

```text
risk_id:                        R-03
date:                           2026-07-30
description:                    Las rutas /api/admin/* no validan sesión ni token, y CORS
                                está abierto a cualquier origen. Permiten reescribir el
                                contenido de los niveles y extraer nombres y cédulas de
                                todos los participantes.
impact:                         Crítico si la API se publica en internet. Contenido en la
                                red interna hoy, pero la migración a Azure lo expone.
probability:                    Confirmado
affected_area:                  Seguridad, datos personales
mitigation:                     Restricción de acceso por rango de IP en App Service
                                (mitigación de red, obligatoria antes de publicar) y
                                posteriormente autenticación real en los endpoints.
owner:                          Pendiente de validación humana
urgency:                        Alta — bloqueante para el despliegue
status:                         Abierto
human_validation_required:      Sí
```

## R-04 · Contraseñas de administrador sin hash

```text
risk_id:                        R-04
date:                           2026-07-30
description:                    El login del panel administrativo compara la contraseña
                                en texto plano contra la columna ADMINISTRADOR_PASSWORD.
impact:                         Alto. Cualquier lectura de la tabla expone credenciales.
probability:                    Confirmado
affected_area:                  Seguridad
mitigation:                     Aplicar hash con algoritmo adecuado y migrar los
                                registros existentes.
owner:                          Pendiente de validación humana
urgency:                        Media
status:                         Abierto
human_validation_required:      Sí
```

## R-05 · Fallos de red silenciosos en el frontend

```text
risk_id:                        R-05
date:                           2026-07-30
description:                    23 de 82 llamadas fetch descartan la respuesta sin
                                verificar el código de estado. Un error HTTP no lanza
                                excepción, así que los fallos son invisibles.
impact:                         Alto sobre integridad de datos. Este patrón ocultó el
                                defecto corregido en fix-endpoint-social.patch, donde
                                tres niveles enviaban resultados a una ruta inexistente
                                y el participante veía el nivel como aprobado.
probability:                    Confirmado
affected_area:                  Integridad de datos, reportes
mitigation:                     Verificar response.ok en cada escritura y notificar al
                                usuario cuando el guardado falle.
owner:                          Pendiente de validación humana
urgency:                        Media
status:                         Parcialmente mitigado — corregido el caso conocido,
                                el patrón persiste en 23 puntos
human_validation_required:      Sí
```

## R-06 · Ausencia de control de versiones y de respaldo del instalador

```text
risk_id:                        R-06
date:                           2026-07-30
description:                    El código llegó como ZIP con archivos .bak y variantes
                                "_new" sueltas, sin repositorio. El único instalador vive
                                en la cuenta de un tercero; al intentar descargarlo de
                                forma anónima el CDN devolvió NoSuchKey.
impact:                         Alto. Sin trazabilidad de cambios y sin instalador propio,
                                una tablet nueva o un formateo dejan sin salida.
probability:                    Confirmado
affected_area:                  Mantenimiento, continuidad
mitigation:                     Versionar el código en un repositorio de AGP y almacenar
                                cada APK generado en un repositorio propio.
owner:                          Pendiente de validación humana
urgency:                        Media
status:                         Abierto
human_validation_required:      Sí
```

## R-07 · Ausencia de mecanismo de actualización remota

```text
risk_id:                        R-07
date:                           2026-07-30
description:                    El proyecto no incluye expo-updates. Verificado: 0
                                referencias en los tres archivos .dex del APK.
impact:                         Medio. Cualquier cambio de dirección del servicio o de
                                contenido exige recompilar e instalar en cada tablet.
                                Es la causa de que esta falla no se pudiera corregir
                                remotamente.
probability:                    Confirmado
affected_area:                  Operación, mantenimiento
mitigation:                     Añadir expo-updates en la recompilación. Configuración ya
                                declarada en app.json; falta instalar la dependencia.
owner:                          Pendiente de validación humana
urgency:                        Media
status:                         Abierto — configuración preparada
human_validation_required:      Sí
```

## R-08 · Imágenes almacenadas en disco del servicio

```text
risk_id:                        R-08
date:                           2026-07-30
description:                    El panel administrativo escribe los archivos subidos en
                                la carpeta local uploads/ del servicio.
impact:                         Medio. En App Service el directorio persiste entre
                                reinicios, pero se pierde en cada redespliegue.
probability:                    Alta
affected_area:                  Datos, operación
mitigation:                     Migrar a Azure Blob Storage. Hay indicios de una migración
                                iniciada en 2 de 8 niveles visuales, sin soporte en el
                                backend.
owner:                          Pendiente de validación humana
urgency:                        Media
status:                         Abierto
human_validation_required:      Sí
```

## R-09 · Diseño de arranque incompatible con planes sin Always On

```text
risk_id:                        R-09
date:                           2026-07-30
description:                    La API termina el proceso (process.exit) si no logra
                                conectar con la base al arrancar. En planes que suspenden
                                la aplicación por inactividad, cada reactivación reintenta
                                y un fallo transitorio provoca reinicio.
impact:                         Medio. Percepción de intermitencia. En plan F1 es
                                tolerable para validar; no para producción.
probability:                    Media
affected_area:                  Disponibilidad
mitigation:                     Usar plan con Always On en producción, o introducir
                                reintentos con espera en lugar de terminar el proceso.
owner:                          Pendiente de validación humana
urgency:                        Baja durante validación, Media en producción
status:                         Abierto
human_validation_required:      Sí
```

## R-10 · Funcionalidad incompleta: tabla de respuestas sin escritura

```text
risk_id:                        R-10
date:                           2026-07-30
description:                    La tabla Onboarding_Respuestas se consulta para el reporte
                                de detalle por participante, pero ningún punto del código
                                escribe en ella. Verificado: 0 filas.
impact:                         Medio. El reporte de detalle saldrá siempre vacío.
probability:                    Confirmado
affected_area:                  Funcional, reportes
mitigation:                     Consultar al proveedor si se alimenta por otra vía o si es
                                funcionalidad pendiente.
owner:                          Pendiente de validación humana
urgency:                        Baja
status:                         Abierto — requiere aclaración del proveedor
human_validation_required:      Sí
```

## R-12 · Regla de firewall que expone la base de datos a internet

```text
risk_id:                        R-12
date:                           2026-07-30
description:                    El servidor agpcolombia (grupo COL-RG) tiene una regla de
                                firewall llamada "Base IPs" con rango 160.0.0.0 a
                                205.0.0.0, que abarca aproximadamente 750 millones de
                                direcciones públicas.
impact:                         CRÍTICO. Combinado con R-02 —la contraseña del login
                                "Apps" viajó en texto plano en el paquete del proveedor y
                                se verificó vigente, con roles db_datareader,
                                db_datawriter y db_ddladmin sobre toda AGP_RRHH—, cualquier
                                persona dentro de ese rango que tenga el paquete puede
                                leer, escribir y eliminar objetos en la base de recursos
                                humanos, que contiene nombres y cédulas de empleados.
probability:                    Confirmado. Se verificó que la credencial funciona y que
                                la conexión desde la red de AGP se autoriza únicamente por
                                esta regla: la IP de salida del equipo de trabajo
                                (201.184.66.82) no coincide con ninguna otra regla.
affected_area:                  Seguridad, datos personales, cumplimiento
mitigation:                     Enumerar las IP de salida legítimas de AGP, agregarlas
                                como reglas específicas, y solo entonces eliminar la regla
                                "Base IPs". El orden importa: eliminarla primero dejaría
                                sin acceso a sistemas que hoy dependen de ella.
                                Rotar la credencial "Apps" en paralelo (ver R-02).
owner:                          Administrador del servidor SQL — pendiente de asignación
urgency:                        Máxima. Supera en prioridad al despliegue del juego y no
                                depende de él.
status:                         Abierto — escalado al solicitante el 2026-07-30
human_validation_required:      Sí
```

**Nota sobre el alcance de este hallazgo.** Se detectó de forma incidental al buscar los
rangos de IP necesarios para restringir el acceso al App Service. No forma parte del
alcance de la remediación del juego de onboarding, pero afecta a la misma base de datos y
a datos personales, por lo que se documenta y se escala.

Otras 7 reglas del mismo servidor corresponden a direcciones IP individuales acumuladas
entre 2024 y 2026 (`ClientIPAddress_*`), aparentemente conexiones puntuales de personas.
Conviene revisarlas en el mismo ejercicio.

---

## R-11 · Costos no presupuestados

```text
risk_id:                        R-11
date:                           2026-07-30
description:                    La copia de base de datos recomendada para pruebas
                                (CREATE DATABASE AS COPY OF) genera una segunda base
                                facturada por separado. El almacenamiento Blob, si se
                                adopta, también tiene costo.
impact:                         Bajo en monto, relevante en autorización.
probability:                    Aplica solo si se ejecutan esas acciones
affected_area:                  Costos
mitigation:                     Validar con el área responsable antes de crear la copia,
                                o crearla y eliminarla el mismo día. El plan F1 de App
                                Service y todo el toolchain de compilación local no
                                tienen costo.
owner:                          Pendiente de validación humana
urgency:                        Baja
status:                         Informado al solicitante
human_validation_required:      Sí
```
