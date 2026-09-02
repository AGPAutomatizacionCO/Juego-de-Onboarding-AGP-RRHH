-- Ticket #2: permite al administrador re-habilitar una evaluacion ya completada,
-- por usuario y por nivel. Ejecutar contra AGP_RRHH (o la copia de pruebas) antes
-- de desplegar el backend con el fix.

IF NOT EXISTS (
  SELECT 1 FROM sys.columns
  WHERE object_id = OBJECT_ID('dbo.Onboarding_Resultados_Nivel')
    AND name = 'REINTENTO_HABILITADO'
)
BEGIN
  ALTER TABLE dbo.Onboarding_Resultados_Nivel
  ADD REINTENTO_HABILITADO BIT NOT NULL DEFAULT 0;
END
