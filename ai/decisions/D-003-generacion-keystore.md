[AGP · Agente: DOCUMENTAL]

```text
decision_id:          D-003
date:                 2026-07-31
project_id:           AGP-CO-ONBOARDING-B15
decision_title:       Generación de una clave de firma (keystore) propia de AGP para
                      compilar el APK, en lugar de esperar la del proveedor

context:              R-01 establece que la clave de firma actual pertenece a la cuenta
                      de Expo del proveedor, ajena a AGP. D-002 ya había decidido compilar
                      localmente sin esa cuenta. Faltaba resolver con qué clave firmar el
                      APK resultante.

options_considered:   1. Generar un keystore nuevo de AGP con `keytool`.
                      2. Esperar a que el proveedor entregue su keystore original.
                      3. Compilar sin firma de release (no es viable: Android exige firma
                         para instalar cualquier APK).

decision_taken:       Opción 1. El agente generó el keystore tras autorización explícita
                      del solicitante en la conversación ("dale hagamoslo").

reason:               El solicitante autorizó de forma expresa, después de que el agente
                      explicara qué es un keystore, sus contraseñas, y la consecuencia
                      directa: al usar una clave distinta a la instalada, Android no
                      permitirá actualizar sobre la app actual y habrá que desinstalarla
                      en cada tablet antes de reinstalar (evaluado en D-002: bajo costo,
                      porque el progreso reside en la base de datos y la app instalada hoy
                      no funciona).

impact:               AGP obtiene, por primera vez, control propio sobre la firma de sus
                      actualizaciones futuras del juego. El archivo generado
                      (`agp-onboarding-release.jks`, RSA 2048, alias `agp-onboarding`,
                      validez 10.000 días) y sus dos contraseñas se entregaron
                      directamente al solicitante en la conversación. El agente no
                      conservó copia en ningún repositorio ni sistema de AGP.

risks:                Alto si no se custodia formalmente: es un archivo de un solo punto
                      de fallo — perderlo impide actualizar la app instalada con esta
                      clave para siempre (mismo problema que R-01, ahora con clave propia
                      en vez de ajena). El certificado usa datos genéricos de
                      identificación (organización, país) razonables para AGP pero no
                      verificados formalmente contra el registro legal de la empresa.

approved_by:          Solicitante del desarrollo (autorización explícita en conversación)
pending_validation:   Sí — custodia formal del archivo y sus contraseñas en un
                      repositorio seguro de AGP, y designación de un responsable. Sin
                      esto, R-01 permanece abierto en la práctica aunque mitigado en
                      capacidad técnica.

related_documents:    specs/003-tasks.md (T-10)
                      specs/005-risks.md (R-01)
                      specs/009-change-log.md (2026-07-31)
                      ai/decisions/D-002-compilacion-local.md
```

## Nota de seguridad

Ni el archivo `.jks` ni sus contraseñas se escribieron en este repositorio. Quedan
únicamente en poder de quien los recibió directamente en la conversación. Cualquier copia
adicional que se haga de aquí en adelante es responsabilidad de quien la haga.
