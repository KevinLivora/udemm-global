# Protocolo de Validación Manual — MOD-AUT
## FASE 2B.10 · UDEMM Global

**Rama:** `feature/ajustes-permisos-docentes`
**Commit base:** `cd2b567`
**Fecha de emisión:** 2026-10-18
**Estado del documento:** Pendiente de ejecución

---

## Propósito

Complementar la validación automatizada (909 tests, exit 0) con verificaciones funcionales
en navegador sobre datos académicos reales. Cubre los indicadores IP-01, IP-02, IP-03, IP-08
(tablero de carrera) e IPL-01, IPL-02, IPL-03, IPL-05 (tablero de plan).

## Prerequisitos

- Backend corriendo en `localhost:5000` (o entorno de staging).
- Frontend corriendo en `localhost:3000` (o entorno de staging).
- Base de datos con datos académicos cargados (al menos una carrera con plan, materias y docentes).
- Acceso a dos usuarios de prueba: uno con rol MOD-AUT y otro con rol DOCENTE o ADMINISTRATIVO.
- No utilizar credenciales ni datos personales de producción real en este documento.

---

## Instrucciones de uso

Para cada fila de verificación:
1. Ejecutar la **Acción** descrita.
2. Comparar el resultado visible con el **Resultado esperado**.
3. Registrar lo observado en **Resultado observado** (descripción textual, capturas opcionales).
4. Marcar el **Estado** como `Aprobado`, `Fallido` o dejar `Pendiente`.

No completar resultados de memoria ni anticipar resultados sin ejecutarlos.

---

## A. Acceso y autenticación

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| A-01 | Iniciar sesión con usuario con rol `SECRETARIA_ACADEMICA` o `DIRECTOR_CARRERA`. Navegar a `/autoevaluacion`. | La página de autoevaluación carga correctamente con el selector de carrera visible. | | Pendiente |
| A-02 | Iniciar sesión con usuario con rol `DOCENTE`. Intentar acceder a `/autoevaluacion`. | El sistema rechaza el acceso. Se muestra mensaje de acceso denegado o redirección al login. | | Pendiente |
| A-03 | Sin sesión activa, acceder directamente a `/autoevaluacion/tablero/carrera/<uuid>`. | El sistema redirige al login o devuelve 401/403. No se muestran datos académicos. | | Pendiente |
| A-04 | Iniciar sesión con usuario con rol `RECTORADO`. Navegar a `/autoevaluacion`. | La página carga correctamente. El selector muestra carreras en su alcance o todas. | | Pendiente |

---

## B. Selección académica

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| B-01 | Desde `/autoevaluacion`, abrir el selector de carrera. | Se listan las carreras disponibles para el usuario autenticado. Ninguna carrera de otra facultad aparece si el rol es `DIRECTOR_CARRERA`. | | Pendiente |
| B-02 | Seleccionar una carrera con plan de estudios activo. | El nombre de la carrera aparece en la interfaz. Se habilita el botón o enlace "Ver tablero de carrera". | | Pendiente |
| B-03 | Con la carrera seleccionada, hacer clic en "Ver tablero de carrera →". | Navega a `/autoevaluacion/tablero/carrera/<carreraId>`. La URL incluye el UUID correcto. El nombre de la carrera aparece como título. | | Pendiente |
| B-04 | Desde `/autoevaluacion`, seleccionar un plan de estudios de la carrera activa. | Se habilita el botón o enlace "Ver tablero →" para el plan seleccionado. | | Pendiente |
| B-05 | Hacer clic en "Ver tablero →" del plan. | Navega a `/autoevaluacion/tablero/<planEstudioId>`. La URL incluye el UUID correcto del plan. | | Pendiente |
| B-06 | Desde el tablero de carrera, usar el enlace de breadcrumb "Autoevaluación". | Regresa a `/autoevaluacion`. El selector conserva o limpia la selección previa. | | Pendiente |

---

## C. Tablero de carrera

> **Antes de ejecutar:** anotar los valores esperados consultando directamente la base de datos
> (conteo de docentes activos, cargos APROBADA, materias, etc.) para la carrera seleccionada.

### C.1 — IP-01: Docentes vigentes

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| C-01 | Abrir el tablero de una carrera con docentes activos y vinculaciones aprobadas. | La tarjeta IP-01 muestra un número mayor a cero y estadoCalculo = CALCULADO. | | Pendiente |
| C-02 | Comparar el valor `ip01.total` con el conteo manual: `SELECT COUNT(DISTINCT "docenteId") FROM "VinculacionCatedra" WHERE "carreraId" = '<id>' AND "estado" = 'APROBADA'` combinado con `docente.activo = true`. | Los valores coinciden. | | Pendiente |
| C-03 | Abrir el tablero de una carrera sin docentes activos o sin vinculaciones aprobadas. | La tarjeta IP-01 muestra aviso "No aplica" con estadoCalculo = NO_APLICA. | | Pendiente |

### C.2 — IP-02: Cargos docentes vigentes

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| C-04 | Verificar que el valor de IP-02 sea ≥ IP-01 (un docente puede tener más de un cargo). | `ip02.total >= ip01.total`. | | Pendiente |
| C-05 | Comparar IP-02 con el conteo manual de pares `(docenteId, cargoId)` APROBADA con docente activo, excluyendo cargos de gestión (no Titular/Asociado/Adjunto/JTP/Ayudante). | Los valores coinciden. | | Pendiente |
| C-06 | En una carrera con solo cargos de gestión (Coordinador, Director, etc.) como únicos cargos. | La tarjeta IP-02 muestra estadoCalculo = NO_APLICA, total = 0. | | Pendiente |

### C.3 — IP-03: Materias cubiertas

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| C-07 | Verificar total de materias, cubiertas y sin cobertura en la carrera de prueba. | La suma `cubiertas + sinCobertura == total`. El porcentaje de cobertura es coherente. | | Pendiente |
| C-08 | Verificar el caso en que `cubiertas < total`. | El contador "Sin cobertura" muestra en rojo el número de materias sin asignación aprobada. La tarjeta **no** dice que el indicador falló — solo informa el estado. | | Pendiente |
| C-09 | Abrir tablero de carrera sin planes de estudio activos. | La tarjeta IP-03 muestra estadoCalculo = NO_APLICA y texto explicativo. | | Pendiente |

### C.4 — IP-08: Relación profesores / auxiliares

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| C-10 | Verificar ratio P/A en una carrera con profesores y auxiliares. | El ratio mostrado coincide con `round(profesores/auxiliares * 10) / 10`. | | Pendiente |
| C-11 | Verificar carrera con solo profesores (sin auxiliares aprobados). | El campo "Relación P:A" muestra "No calculable" (ratio null). La tarjeta **no** lanza error. | | Pendiente |
| C-12 | Verificar que cargos de gestión (Coordinador, Director, etc.) no aparecen en el conteo P ni A. | El total `profesores + auxiliares` es menor o igual al total de vinculaciones si existen cargos de gestión. | | Pendiente |

### C.5 — Estado general

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| C-13 | Con todos los indicadores en CALCULADO, verificar el badge "Estado general de cálculo". | Muestra CALCULADO en verde. El texto aclara que no indica cumplimiento institucional. | | Pendiente |
| C-14 | Con algún indicador en NO_APLICA, verificar el badge. | El badge muestra NO_APLICA (azul claro). El texto de aclaración sigue presente. | | Pendiente |
| C-15 | Hacer clic en el botón "Actualizar". | Los datos se recargan desde el servidor. El badge de estado se actualiza. No se produce error visible. | | Pendiente |

---

## D. Tablero de plan

> **Antes de ejecutar:** anotar umbrales configurados (P-10 a P-14) para el plan seleccionado.

### D.1 — IPL-01: Carga horaria total

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| D-01 | Abrir tablero de un plan con configuración de umbral total (P-10). | Se muestra `horasTotal`, `horasMinimas`, `diferencia` y `cumple`. Los valores son coherentes. | | Pendiente |
| D-02 | Verificar plan sin umbral P-10 configurado. | IPL-01 muestra `horasMinimas = null`, `cumple = null`, estadoCalculo = NO_APLICA. | | Pendiente |
| D-03 | Verificar plan con materias sin carga horaria. | IPL-01 muestra estadoCalculo = PARCIAL. Las materias sin datos aparecen listadas si corresponde. | | Pendiente |

### D.2 — IPL-02: Cumplimiento por bloque

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| D-04 | Verificar con plan que tiene umbrales para CB, TB, TA y CX configurados. | Se muestra `bloquesCumplen` y `bloquesConUmbral`. Los valores son coherentes con los umbrales. | | Pendiente |
| D-05 | Verificar bloque con umbral no configurado. | Ese bloque no se cuenta en `bloquesConUmbral`. | | Pendiente |

### D.3 — IPL-03: Responsables de cátedra

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| D-06 | Verificar plan con materias sin responsable designado. | `sinResponsable > 0`. Las materias sin responsable son identificables. | | Pendiente |
| D-07 | Verificar que `sinResponsable + inciertas + conResponsable == totalMaterias`. | La suma exacta se cumple. | | Pendiente |

### D.4 — IPL-05: Detalle por bloque horario

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| D-08 | Verificar que el tablero muestra los cinco bloques: CB, TB, TA, CX y TOTAL. | Los cinco bloques aparecen. El bloque CX corresponde a CTC del FSD. | | Pendiente |
| D-09 | Verificar bloque sin umbral configurado. | Ese bloque muestra estadoCalculo = NO_APLICA y `cumple = null`. | | Pendiente |

---

## E. Casos especiales

| # | Acción | Resultado esperado | Resultado observado | Estado |
|---|---|---|---|---|
| E-01 | Acceder al tablero de carrera de una carrera sin planes de estudio. | IP-03 muestra NO_APLICA. El resto de los indicadores también reflejan su estado real. No se produce error 500. | | Pendiente |
| E-02 | Acceder al tablero de un plan sin configuración de umbrales (ningún P-10..P-14 definido). | IPL-01 e IPL-02 muestran NO_APLICA. El tablero carga igual. | | Pendiente |
| E-03 | Carrera donde todos los cargos son de gestión (sin Titular/Asociado/Adjunto/JTP/Ayudante). | IP-02 muestra NO_APLICA. IP-08 muestra NO_APLICA. IP-01 puede ser CALCULADO si hay docentes activos con vinculaciones. | | Pendiente |
| E-04 | Ingresar manualmente una URL con UUID inexistente: `/autoevaluacion/tablero/carrera/00000000-0000-4000-0000-000000000000`. | La página muestra un mensaje de error claro ("Carrera no encontrada" o similar). No muestra datos vacíos. | | Pendiente |
| E-05 | Ingresar manualmente una URL con ID no-UUID: `/autoevaluacion/tablero/carrera/abc`. | La API responde 400. La UI muestra mensaje de error. No se produce pantalla en blanco sin mensaje. | | Pendiente |
| E-06 | Con sesión activa del tablero abierto, recargar la página (F5). | Los datos se vuelven a consultar. El indicador de carga aparece y desaparece. El resultado es igual al anterior. | | Pendiente |
| E-07 | Abrir el tablero de una carrera a la que el usuario `DIRECTOR_CARRERA` no tiene scope. | La API responde 403. La UI muestra mensaje de acceso denegado. No se expone información de la carrera. | | Pendiente |
| E-08 | Verificar que el campo `estadoGeneralCalculo` no se interpreta como aprobación institucional en ningún aviso de la UI. | El texto de la interfaz aclara que el estado refleja la completitud del cálculo, no el cumplimiento de requisitos CONEAU. | | Pendiente |

---

## Resumen de ejecución

| Sección | Total | Aprobados | Fallidos | Pendientes |
|---|---|---|---|---|
| A. Acceso | 4 | | | 4 |
| B. Selección | 6 | | | 6 |
| C. Tablero de carrera | 15 | | | 15 |
| D. Tablero de plan | 9 | | | 9 |
| E. Casos especiales | 8 | | | 8 |
| **Total** | **42** | | | **42** |

---

## Notas

- Este documento no contiene credenciales, tokens ni datos personales reales.
- Los resultados observados deben completarse durante la ejecución manual en navegador.
- Si se detecta un defecto, documentarlo en el issue tracker del proyecto con el número de caso (#C-xx, #D-xx, etc.) y evidencia reproducible.
- La validación visual no reemplaza la cobertura de tests automatizados (909 tests, exit 0).
