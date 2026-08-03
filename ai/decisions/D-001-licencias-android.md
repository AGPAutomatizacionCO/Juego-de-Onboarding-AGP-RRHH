[AGP · Agente: DOCUMENTAL]

```text
decision_id:          D-001
date:                 2026-07-30
project_id:           AGP-CO-ONBOARDING-B15
decision_title:       Aceptación de las licencias del SDK de Android en nombre de AGP

context:              Para compilar el APK sin depender de la cuenta de Expo del
                      proveedor se requiere el SDK de Android instalado localmente. El
                      gestor de paquetes del SDK exige aceptar el "Android Software
                      Development Kit License Agreement" de Google antes de descargar
                      componentes. Es una aceptación legal que vincula a la organización
                      que la realiza.

options_considered:   1. Que una persona de AGP ejecutara el comando de aceptación.
                      2. Que el agente de IA la ejecutara bajo autorización explícita.
                      3. No instalar el SDK y depender del proveedor para compilar.

decision_taken:       Opción 2. El agente ejecutó la aceptación de las 7 licencias del
                      SDK tras autorización explícita del solicitante.

reason:               El solicitante autorizó de forma expresa en la conversación, después
                      de que el agente señalara la implicación legal y ofreciera el comando
                      para ejecutarlo por su cuenta. La licencia no tiene costo, es la
                      misma que acepta cualquier desarrollador Android y que Android Studio
                      acepta durante su instalación, y ya había sido aceptada por el
                      proveedor para construir la versión actual.

impact:               AGP queda sujeta a los términos del acuerdo: prohibición de
                      ingeniería inversa del SDK, prohibición de usarlo para romper la
                      compatibilidad de Android, responsabilidad de AGP sobre su
                      aplicación y los datos que maneja —relevante porque el juego
                      almacena cédulas—, y limitación de garantías y responsabilidad en
                      favor de Google. Sin implicaciones económicas.

risks:                Bajo. Riesgo residual: la aceptación fue realizada por un agente y
                      no por un representante formal de la organización. Se recomienda
                      ratificación por el responsable de TI.

approved_by:          Solicitante del desarrollo (autorización verbal en conversación)
pending_validation:   Sí — se recomienda ratificación formal por el responsable de TI

related_documents:    specs/003-tasks.md (T-03)
                      ai/decisions/D-002-compilacion-local.md
```

## Evidencia

Licencias registradas en `%LOCALAPPDATA%\dev-tools\android-sdk\licenses`:

```text
android-googletv-license
android-googlexr-license
android-sdk-arm-dbt-license
android-sdk-license
android-sdk-preview-license
google-gdk-license
mips-android-sysimage-license
```

Salida del gestor: `All SDK package licenses accepted`.
