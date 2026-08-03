[AGP · Agente: DOCUMENTAL]

```text
decision_id:          D-002
date:                 2026-07-30
project_id:           AGP-CO-ONBOARDING-B15
decision_title:       Compilar el APK localmente en lugar de depender de la cuenta de
                      Expo del proveedor

context:              El instalador se genera desde la cuenta de Expo "onboardinggame",
                      ajena a AGP. Sin acceso a esa cuenta, AGP no puede producir
                      versiones nuevas. Se estableció como ruta crítica del proyecto. El
                      solicitante indicó el requisito de resolver el desarrollo sin
                      dependencias externas.

options_considered:   1. Esperar la transferencia del proyecto Expo por el proveedor.
                      2. Pedir al proveedor una compilación adicional con la nueva URL.
                      3. Crear una cuenta de Expo propia de AGP y compilar allí.
                      4. Compilar localmente con JDK y SDK de Android, sin cuenta alguna.
                      5. Publicar la versión web, que no requiere firma ni instalador.

decision_taken:       Opción 4 como vía principal, manteniendo la opción 1 en paralelo sin
                      bloquear, y la opción 5 como plan de contingencia.

reason:               EAS es un servicio de conveniencia, no un requisito: un proyecto
                      Expo se compila con Gradle. El equipo del solicitante reúne las
                      condiciones (829 GB libres, winget disponible, y el toolchain se
                      instala en espacio de usuario sin permisos de administrador). Esto
                      elimina la única dependencia externa del proyecto y no tiene costo.

impact:               AGP obtiene capacidad propia y permanente de generar instaladores.
                      Contrapartida: la clave de firma será distinta a la del APK
                      instalado, por lo que Android no permitirá actualizar encima y habrá
                      que desinstalar la aplicación en cada tablet antes de reinstalar.

                      El costo de esa desinstalación se evaluó y es bajo: se verificó que
                      el progreso de los participantes reside en la base de datos —el
                      desbloqueo de islas se calcula en el servidor desde
                      USUARIO_PROGRESO_ISLA y los puntajes están en
                      Onboarding_Resultados_Nivel—, de modo que al reinstalar el
                      participante recupera su avance al ingresar con su cédula. Solo se
                      pierden marcas locales de detalle. Además, la aplicación instalada
                      hoy no funciona, por lo que desinstalarla no representa pérdida de
                      servicio.

risks:                R-01 (propiedad de la clave de firma) queda mitigado en cuanto a
                      capacidad futura, no en cuanto a la transición. La primera
                      ejecución de `expo prebuild` puede revelar incompatibilidades de
                      plugins que el entorno de EAS resolvía; el proyecto solo usa
                      expo-router, por lo que el riesgo es bajo.

approved_by:          Solicitante del desarrollo
pending_validation:   Sí — la clave de firma generada debe custodiarse formalmente por
                      AGP, ya que de ella dependerán todas las versiones futuras

related_documents:    specs/003-tasks.md (T-03, T-10, T-11)
                      specs/005-risks.md (R-01)
                      ai/decisions/D-001-licencias-android.md
```

## Nota sobre la clave de firma

La clave que se genere para AGP debe almacenarse en un repositorio seguro de la
organización, junto con sus contraseñas. **Perderla implica no poder actualizar nunca más
la aplicación instalada**, obligando a desinstalar en cada dispositivo. Es el activo más
crítico del pipeline de compilación y su custodia no debe recaer en un equipo personal.
