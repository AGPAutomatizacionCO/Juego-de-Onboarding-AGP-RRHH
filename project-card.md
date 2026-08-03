[AGP · Agente: DOCUMENTAL]

# Project Card — Juego de Onboarding AGP

```text
project_id:              AGP-CO-ONBOARDING-B15
project_name:            Juego de Onboarding AGP (OnboardingGame)
business_area:           Recursos Humanos / Planta Colombia
requester:               Pendiente de validación humana
functional_owner:        Pendiente de validación humana
technical_owner:         Pendiente de validación humana — actualmente proveedor externo
it_owner:                Pendiente de validación humana
solution_type:           Aplicación móvil nativa (Android, tablets) + API REST + base de datos
status:                  Fuera de servicio — en remediación
lifecycle_stage:         Correctivo / migración de hospedaje
criticality:             Pendiente de validación humana
sla_level:               Pendiente de validación humana
business_problem:        Las tablets de planta no pueden acceder al juego de inducción.
                         El equipo que hospedaba la API se dio de baja y su dirección de
                         red fue reasignada a otro computador de producción.
business_objective:      Restablecer el servicio de inducción y eliminar la dependencia
                         de un equipo de escritorio, migrando la API a Azure.
expected_users:          72 participantes registrados a la fecha de evaluación
data_sources:            Azure SQL — agpcolombia.database.windows.net / AGP_RRHH
                         12 tablas dbo.Onboarding_*
data_sensitivity:        Datos personales — nombre y número de cédula de empleados
data_owner:              Pendiente de validación humana
authorized_environments: Producción (AGP_RRHH). Sin ambiente de pruebas definido.
repository_url:          Pendiente — el código llegó como paquete ZIP, sin control de versiones
documentation_url:       Esta carpeta: Archivos Juego RRHH/
deployment_url:          Pendiente — se definirá al crear el App Service
monitoring_tool:         Ninguno
support_channel:         Pendiente de validación humana
last_review_date:        2026-07-30
next_review_date:        Pendiente de validación humana
```

## Identificadores técnicos confirmados

```text
android_package:         com.onboardinggame.juegoapp
expo_project_id:         bbe87f7c-0753-4d3c-a010-3f6dc642525c
expo_account_owner:      onboardinggame  (cuenta externa, NO de AGP)
apk_sdk_version:         Expo SDK 49  (el instalado en tablets)
source_sdk_version:      Expo SDK 54  (el código fuente entregado)
api_host_en_apk:         http://172.16.60.75:3001  (inexistente)
ip_reasignada_a:         PREENSAMB-COEM
```

## Nota sobre propiedad

El instalador se genera desde una cuenta de Expo que **no pertenece a AGP**. Esto
condiciona la capacidad de AGP para producir versiones nuevas y, por la clave de firma
asociada, para actualizar la aplicación instalada. Ver `specs/005-risks.md` (R-01).
