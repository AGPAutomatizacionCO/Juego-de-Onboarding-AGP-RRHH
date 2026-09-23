-- Reintento: al consumirse, la fila de Onboarding_Resultados_Nivel se BORRA
-- (para que el nivel vuelva a verse como "no completado" y no como
-- "completado con 0%"). Como el conteo de INTENTO vivía en esa misma fila,
-- borrarla también borraba el historial de intentos. Esta tabla lo guarda
-- aparte, independiente de si existe o no una fila de resultado.
-- Ejecutar contra AGP_RRHH (o la copia de pruebas) antes de desplegar el
-- backend con el fix.

IF NOT EXISTS (
  SELECT 1 FROM sys.tables
  WHERE name = 'Onboarding_Intentos_Nivel' AND schema_id = SCHEMA_ID('dbo')
)
BEGIN
  CREATE TABLE dbo.Onboarding_Intentos_Nivel (
    USUARIO_KEY INT NOT NULL,
    NIVELES_KEY INT NOT NULL,
    TOTAL_INTENTOS INT NOT NULL CONSTRAINT DF_Onboarding_Intentos_Nivel_Total DEFAULT (0),
    CONSTRAINT PK_Onboarding_Intentos_Nivel PRIMARY KEY (USUARIO_KEY, NIVELES_KEY)
  );
END

-- Backfill: siembra el conteo actual a partir del historial existente en
-- Onboarding_Resultados_Nivel, para no perder los intentos ya jugados.
INSERT INTO dbo.Onboarding_Intentos_Nivel (USUARIO_KEY, NIVELES_KEY, TOTAL_INTENTOS)
SELECT r.USUARIO_KEY, r.NIVELES_KEY, MAX(ISNULL(r.INTENTO, 1))
FROM dbo.Onboarding_Resultados_Nivel r
WHERE NOT EXISTS (
  SELECT 1 FROM dbo.Onboarding_Intentos_Nivel i
  WHERE i.USUARIO_KEY = r.USUARIO_KEY AND i.NIVELES_KEY = r.NIVELES_KEY
)
GROUP BY r.USUARIO_KEY, r.NIVELES_KEY;
