/* ============================================================================
   VERIFICACION DE ESQUEMA - Juego de Onboarding AGP
   Base de datos: AGP_RRHH   (agpcolombia.database.windows.net)

   PROPOSITO
     Confirmar si el esquema real coincide con lo que el codigo de la API
     (onboardingAGP-api) da por supuesto. Responde: las tablas estan
     operativas para este desarrollo?

   SEGURIDAD
     100% SOLO LECTURA. No hay INSERT, UPDATE, DELETE, MERGE ni DDL.
     Se puede ejecutar en produccion sin riesgo.

   COMO EJECUTAR
     SSMS o Azure Data Studio, conectado a la base AGP_RRHH.
     Ejecutar completo. Devuelve 5 resultados; revisar la columna VEREDICTO.

   QUE HACER CON EL RESULTADO
     Cualquier fila que diga FALLA o FALTA es un bloqueante real.
     Compartir los 5 resultados para interpretarlos.
============================================================================ */

SET NOCOUNT ON;

/* ---------------------------------------------------------------------------
   1. EXISTEN LAS 12 TABLAS?
   El codigo referencia estas 12 tablas del esquema dbo.
--------------------------------------------------------------------------- */

PRINT '=== 1. EXISTENCIA DE TABLAS ===';

;WITH Esperadas AS (
    SELECT tabla FROM (VALUES
        ('Onboarding_Usuarios_NEW'),
        ('Onboarding_Islas'),
        ('Onboarding_Niveles'),
        ('Onboarding_Visual'),
        ('Onboarding_Lectura'),
        ('Onboarding_Recordemos'),
        ('Onboarding_Social'),
        ('Onboarding_Evaluacion'),
        ('Onboarding_Resultados_Nivel'),
        ('Onboarding_Resultados_Isla'),
        ('Onboarding_Respuestas'),
        ('Onboarding_Administrador')
    ) AS t(tabla)
)
SELECT
    e.tabla                                        AS TABLA,
    CASE WHEN t.name IS NULL
         THEN 'FALTA - la tabla no existe'
         ELSE 'OK'
    END                                            AS VEREDICTO,
    ISNULL(CONVERT(varchar(19), t.create_date, 120), '-')  AS CREADA,
    ISNULL(CONVERT(varchar(19), t.modify_date, 120), '-')  AS MODIFICADA
FROM Esperadas e
LEFT JOIN sys.tables t
       ON t.name = e.tabla
      AND SCHEMA_NAME(t.schema_id) = 'dbo'
ORDER BY
    CASE WHEN t.name IS NULL THEN 0 ELSE 1 END,
    e.tabla;


/* ---------------------------------------------------------------------------
   2. IDENTITY - EL HALLAZGO MAS IMPORTANTE
   El codigo trata las llaves de forma INCONSISTENTE entre tablas:

   a) Onboarding_Usuarios_NEW: inserta SIN dar la llave y la recupera con
      OUTPUT INSERTED.USUARIO_KEY  ->  USUARIO_KEY DEBE ser IDENTITY.
      Si no lo es, el REGISTRO DE PARTICIPANTES falla.

   b) Lectura / Recordemos / Social / Evaluacion: el panel admin calcula
      la llave con MAX(KEY)+1 e inserta el valor EXPLICITO, pero NUNCA
      emite SET IDENTITY_INSERT ON  ->  esas llaves NO DEBEN ser IDENTITY.
      Si lo son, GUARDAR CONTENIDO desde el panel admin falla.
--------------------------------------------------------------------------- */

PRINT '=== 2. COLUMNAS IDENTITY (critico) ===';

;WITH Requisito AS (
    SELECT tabla, columna, debe_ser_identity, motivo FROM (VALUES
        ('Onboarding_Usuarios_NEW', 'USUARIO_KEY',     1,
         'La API inserta sin llave y usa OUTPUT INSERTED'),
        ('Onboarding_Lectura',      'LECTURA_KEY',     0,
         'El panel admin inserta llave explicita sin SET IDENTITY_INSERT'),
        ('Onboarding_Recordemos',   'RECORDEMOS_KEY',  0,
         'El panel admin inserta llave explicita sin SET IDENTITY_INSERT'),
        ('Onboarding_Social',       'SOCIAL_KEY',      0,
         'El panel admin inserta llave explicita sin SET IDENTITY_INSERT'),
        ('Onboarding_Evaluacion',   'EVALUACION_KEY',  0,
         'El panel admin inserta llave explicita sin SET IDENTITY_INSERT')
    ) AS r(tabla, columna, debe_ser_identity, motivo)
)
SELECT
    r.tabla                                            AS TABLA,
    r.columna                                          AS COLUMNA,
    CASE r.debe_ser_identity WHEN 1 THEN 'SI' ELSE 'NO' END  AS SE_ESPERA_IDENTITY,
    CASE
        WHEN c.name IS NULL THEN '-'
        WHEN c.is_identity = 1 THEN 'SI'
        ELSE 'NO'
    END                                                AS ES_IDENTITY,
    CASE
        WHEN c.name IS NULL
            THEN 'FALTA - no existe la columna'
        WHEN c.is_identity = r.debe_ser_identity
            THEN 'OK'
        WHEN r.debe_ser_identity = 1
            THEN 'FALLA - el registro de participantes fallara'
        ELSE 'FALLA - guardar desde el panel admin fallara'
    END                                                AS VEREDICTO,
    r.motivo                                           AS RAZON
FROM Requisito r
LEFT JOIN sys.columns c
       ON c.name = r.columna
      AND c.object_id = OBJECT_ID('dbo.' + r.tabla)
ORDER BY
    CASE WHEN c.name IS NULL OR c.is_identity <> r.debe_ser_identity THEN 0 ELSE 1 END,
    r.tabla;


/* ---------------------------------------------------------------------------
   3. FALTAN COLUMNAS QUE EL CODIGO USA?
   Cada columna listada aparece explicitamente en una consulta de la API.
   Si falta alguna, la consulta que la usa lanza error en ejecucion.
--------------------------------------------------------------------------- */

PRINT '=== 3. COLUMNAS REQUERIDAS POR EL CODIGO ===';

;WITH Requeridas AS (
    SELECT tabla, columna FROM (VALUES
        -- Participantes: registro y login por cedula
        ('Onboarding_Usuarios_NEW','USUARIO_KEY'),
        ('Onboarding_Usuarios_NEW','USUARIO_NOMBRE'),
        ('Onboarding_Usuarios_NEW','USUARIO_CEDULA'),
        ('Onboarding_Usuarios_NEW','USUARIO_NUMERO_ONBOARDING'),
        ('Onboarding_Usuarios_NEW','USUARIO_PROGRESO_ISLA'),
        ('Onboarding_Usuarios_NEW','USUARIO_PROGRESO_NIVEL'),
        -- Catalogos
        ('Onboarding_Islas','ISLAS_KEY'),
        ('Onboarding_Islas','ISLAS_NOMBRE'),
        ('Onboarding_Niveles','NIVELES_KEY'),
        ('Onboarding_Niveles','ISLAS_KEY'),
        ('Onboarding_Niveles','NIVELES_NOMBRE'),
        ('Onboarding_Niveles','NIVELES_TITULO'),
        ('Onboarding_Niveles','NIVELES_DESCRIPCION'),
        ('Onboarding_Niveles','NIVELES_MODIFICACION'),
        -- Nivel visual
        ('Onboarding_Visual','VISUAL_KEY'),
        ('Onboarding_Visual','NIVELES_KEY'),
        ('Onboarding_Visual','VISUAL_IMAGEN_FOTO'),
        ('Onboarding_Visual','VISUAL_IMAGEN_CONCEPTO'),
        ('Onboarding_Visual','VISUAL_MODIFICACION'),
        -- Nivel lectura (incluye las 10 respuestas)
        ('Onboarding_Lectura','LECTURA_KEY'),
        ('Onboarding_Lectura','NIVELES_KEY'),
        ('Onboarding_Lectura','LECTURA_ANTES'),
        ('Onboarding_Lectura','LECTURA_DESPUES'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_1'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_2'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_3'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_4'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_5'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_6'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_7'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_8'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_9'),
        ('Onboarding_Lectura','LECTURA_RESPUESTA_10'),
        ('Onboarding_Lectura','LECTURA_CORRECTA'),
        ('Onboarding_Lectura','LECTURA_ESTATUS'),
        ('Onboarding_Lectura','LECTURA_CREACION'),
        ('Onboarding_Lectura','LECTURA_MODIFICACION'),
        -- Nivel memoria
        ('Onboarding_Recordemos','RECORDEMOS_KEY'),
        ('Onboarding_Recordemos','NIVELES_KEY'),
        ('Onboarding_Recordemos','RECORDEMOS_PALABRA'),
        ('Onboarding_Recordemos','RECORDEMOS_CONCEPTO'),
        -- Nivel social
        ('Onboarding_Social','SOCIAL_KEY'),
        ('Onboarding_Social','NIVELES_KEY'),
        ('Onboarding_Social','SOCIAL_CASO'),
        ('Onboarding_Social','SOCIAL_RESPUESTA_1'),
        ('Onboarding_Social','SOCIAL_RESPUESTA_2'),
        ('Onboarding_Social','SOCIAL_RESPUESTA_3'),
        ('Onboarding_Social','SOCIAL_CORRECTA'),
        ('Onboarding_Social','SOCIAL_ESTATUS'),
        -- Evaluacion final (OJO: filtra por EVALUACION_COD, no por NIVELES_KEY)
        ('Onboarding_Evaluacion','EVALUACION_KEY'),
        ('Onboarding_Evaluacion','EVALUACION_COD'),
        ('Onboarding_Evaluacion','EVALUACION_PREGUNTA'),
        ('Onboarding_Evaluacion','EVALUACION_RESPUESTA_1'),
        ('Onboarding_Evaluacion','EVALUACION_RESPUESTA_2'),
        ('Onboarding_Evaluacion','EVALUACION_RESPUESTA_3'),
        ('Onboarding_Evaluacion','EVALUACION_RESPUESTA_4'),
        ('Onboarding_Evaluacion','EVALUACION_CORRECTA'),
        ('Onboarding_Evaluacion','EVALUACION_ESTATUS'),
        -- Resultados por nivel: aqui se guarda el avance del jugador
        ('Onboarding_Resultados_Nivel','USUARIO_KEY'),
        ('Onboarding_Resultados_Nivel','NIVELES_KEY'),
        ('Onboarding_Resultados_Nivel','PUNTAJE'),
        ('Onboarding_Resultados_Nivel','APROBADO'),
        ('Onboarding_Resultados_Nivel','INTENTO'),
        ('Onboarding_Resultados_Nivel','FECHA'),
        ('Onboarding_Resultados_Nivel','MISMATCHES'),
        ('Onboarding_Resultados_Nivel','LIVES_LEFT'),
        -- Consolidado por isla (destino de un MERGE)
        ('Onboarding_Resultados_Isla','USUARIO_KEY'),
        ('Onboarding_Resultados_Isla','ISLAS_KEY'),
        ('Onboarding_Resultados_Isla','PORCENTAJE'),
        ('Onboarding_Resultados_Isla','APROBADO'),
        ('Onboarding_Resultados_Isla','FECHA'),
        -- Detalle de respuestas (la API la lee pero nunca escribe en ella)
        ('Onboarding_Respuestas','USUARIO_KEY'),
        ('Onboarding_Respuestas','NIVELES_KEY'),
        ('Onboarding_Respuestas','RESPUESTA_KEY'),
        ('Onboarding_Respuestas','RESPUESTA_PREGUNTA'),
        ('Onboarding_Respuestas','RESPUESTA_USUARIO'),
        -- Panel administrativo
        ('Onboarding_Administrador','ADMINISTRADOR_KEY'),
        ('Onboarding_Administrador','ADMINISTRADOR_USUARIO'),
        ('Onboarding_Administrador','ADMINISTRADOR_PASSWORD'),
        ('Onboarding_Administrador','ADMINISTRADOR_ESTATUS')
    ) AS r(tabla, columna)
)
SELECT
    r.tabla                                    AS TABLA,
    r.columna                                  AS COLUMNA_QUE_USA_EL_CODIGO,
    CASE WHEN c.name IS NULL
         THEN 'FALTA'
         ELSE 'OK'
    END                                        AS VEREDICTO,
    ISNULL(TYPE_NAME(c.user_type_id), '-')     AS TIPO,
    CASE
        WHEN c.name IS NULL THEN '-'
        WHEN c.max_length = -1 THEN 'MAX'
        ELSE CONVERT(varchar(10), c.max_length)
    END                                        AS LONGITUD,
    CASE
        WHEN c.name IS NULL THEN '-'
        WHEN c.is_nullable = 1 THEN 'SI'
        ELSE 'NO'
    END                                        AS ACEPTA_NULL
FROM Requeridas r
LEFT JOIN sys.columns c
       ON c.name = r.columna
      AND c.object_id = OBJECT_ID('dbo.' + r.tabla)
ORDER BY
    CASE WHEN c.name IS NULL THEN 0 ELSE 1 END,   -- las faltantes primero
    r.tabla,
    r.columna;


/* ---------------------------------------------------------------------------
   4. HAY CONTENIDO CARGADO?
   Una tabla que existe pero esta vacia deja el juego sin preguntas.
   Se usa el conteo exacto de particiones (no requiere escaneo completo).
--------------------------------------------------------------------------- */

PRINT '=== 4. VOLUMEN DE DATOS ===';

SELECT
    t.name                          AS TABLA,
    SUM(p.rows)                     AS FILAS,
    CASE
        WHEN SUM(p.rows) = 0 AND t.name IN (
                'Onboarding_Islas','Onboarding_Niveles','Onboarding_Visual',
                'Onboarding_Lectura','Onboarding_Recordemos',
                'Onboarding_Social','Onboarding_Evaluacion')
            THEN 'VACIA - el juego no tendra contenido en este nivel'
        WHEN SUM(p.rows) = 0 AND t.name = 'Onboarding_Administrador'
            THEN 'VACIA - nadie podra entrar al panel admin'
        WHEN SUM(p.rows) = 0
            THEN 'vacia (esperable si aun no hay uso real)'
        ELSE 'con datos'
    END                             AS VEREDICTO
FROM sys.tables t
JOIN sys.partitions p
     ON p.object_id = t.object_id
    AND p.index_id IN (0, 1)          -- heap o indice agrupado
WHERE SCHEMA_NAME(t.schema_id) = 'dbo'
  AND t.name LIKE 'Onboarding[_]%'
GROUP BY t.name
ORDER BY SUM(p.rows), t.name;


/* ---------------------------------------------------------------------------
   5. COHERENCIA DEL CONTENIDO
   Verifica que el contenido este realmente asociado a niveles existentes.
   Filas huerfanas se traducen en niveles que abren vacios en la tablet.
--------------------------------------------------------------------------- */

PRINT '=== 5. INTEGRIDAD REFERENCIAL ===';

SELECT 'Onboarding_Visual'      AS TABLA, COUNT(*) AS FILAS_HUERFANAS
FROM dbo.Onboarding_Visual v
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Niveles n WHERE n.NIVELES_KEY = v.NIVELES_KEY)
UNION ALL
SELECT 'Onboarding_Lectura', COUNT(*)
FROM dbo.Onboarding_Lectura l
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Niveles n WHERE n.NIVELES_KEY = l.NIVELES_KEY)
UNION ALL
SELECT 'Onboarding_Recordemos', COUNT(*)
FROM dbo.Onboarding_Recordemos r
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Niveles n WHERE n.NIVELES_KEY = r.NIVELES_KEY)
UNION ALL
SELECT 'Onboarding_Social', COUNT(*)
FROM dbo.Onboarding_Social s
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Niveles n WHERE n.NIVELES_KEY = s.NIVELES_KEY)
UNION ALL
-- Evaluacion se relaciona por EVALUACION_COD, no por NIVELES_KEY
SELECT 'Onboarding_Evaluacion (por COD)', COUNT(*)
FROM dbo.Onboarding_Evaluacion e
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Niveles n WHERE n.NIVELES_KEY = e.EVALUACION_COD)
UNION ALL
SELECT 'Onboarding_Niveles (isla inexistente)', COUNT(*)
FROM dbo.Onboarding_Niveles n
WHERE NOT EXISTS (SELECT 1 FROM dbo.Onboarding_Islas i WHERE i.ISLAS_KEY = n.ISLAS_KEY)
ORDER BY FILAS_HUERFANAS DESC;


/* ============================================================================
   INTERPRETACION RAPIDA

   Resultado 1  Alguna tabla FALTA         -> bloqueante: la API fallara.
   Resultado 2  Alguna fila dice FALLA     -> bloqueante mas probable de todos.
                                              Ver el detalle en RAZON.
   Resultado 3  Alguna columna FALTA       -> bloqueante en la pantalla que la usa.
   Resultado 4  Tablas de contenido VACIA  -> el juego abre pero sin preguntas.
   Resultado 5  FILAS_HUERFANAS > 0        -> niveles que cargan vacios.

   Si los 5 resultados salen limpios, el esquema esta alineado con el codigo
   y el unico pendiente para dejarlo operativo es el hospedaje de la API.
============================================================================ */
