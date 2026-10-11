# MATRIZ DE AUTORIZACIÓN — UDEMM Global

**Fecha:** 2026-08-27
**Actualizado:** 2026-10-10 (C16.3: Refuerzo de concurrencia en regularización histórica)
**Rama:** `feature/ajustes-permisos-docentes`
**Etapa:** S4 — ETAPA B COMPLETADA / FASES 1-3 scopes implementadas / Circuito de aprobación implementado

---

## Leyenda

| Columna | Significado |
|---------|-------------|
| **Auth** | `JWT` = requiere JwtAuthGuard · `—` = público |
| **Roles** | Roles autorizados (todos los demás → 403) |
| **Ownership** | Restricción adicional de recurso dentro del rol |
| **Riesgo** | `ALTO` / `MEDIO` / `BAJO` / `OK` |

---

## Scopes institucionales (FASE 1)

> **SCOPE ≠ PERMISO.**
> El scope delimita el universo de Carreras sobre las que un usuario puede operar.
> El RBAC (roles en controlador) determina qué operación puede ejecutar.
> Ambas condiciones deben cumplirse: **PERMISO RBAC + SCOPE INSTITUCIONAL**.

| Rol | Mecanismo de scope | Tablas involucradas |
|-----|--------------------|---------------------|
| `DIRECTOR_CARRERA` | Alcance sobre Carrera(s) en `UsuarioCarrera` | `UsuarioCarrera` |
| `DECANO` | Alcance sobre todas las Carreras de su Facultad (`UsuarioFacultad → Facultad → Carreras`) | `UsuarioFacultad`, `Carrera` |
| `SECRETARIA_ACADEMICA` | Global (sin restricción territorial) | — |
| `RECTORADO` | Global (sin restricción territorial) | — |
| `ADMINISTRADOR_SISTEMA` | Global (sin restricción territorial) | — |
| `ADMINISTRATIVO` | Global (sin restricción territorial) — scope global ≠ permiso de edición | — |
| `DOCENTE` | Sin scope de gestión sobre Carreras | — |

**Implementación:** `ScopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId)` en `backend/src/modules/scopes/scope.service.ts`.

**Limpieza automática:** al cambiar el rol de un usuario (`actualizarUsuario`), se eliminan las asociaciones de scope residuales (`UsuariosService.limpiarScopesResiduales`).

**Estado:** ✅ INFRAESTRUCTURA IMPLEMENTADA — FASE 2 (gestión desde UI de Usuarios) ✅ COMPLETADA — FASE 3 (aplicación a Programas de Asignatura) ✅ COMPLETADA.

---

## Roles reales del sistema (seed + código)

| Rol | Descripción |
|-----|-------------|
| `DOCENTE` | Docente universitario; acceso a su propia ficha y materias vinculadas |
| `ADMINISTRATIVO` | Personal administrativo; gestión académica y docentes |
| `DIRECTOR_CARRERA` | Director de carrera; planes, estructuras, tablas maestras |
| `SECRETARIA_ACADEMICA` | Secretaría; gestión completa excepto usuarios y configuración |
| `ADMINISTRADOR_SISTEMA` | Superusuario; acceso total |
| `DECANO` | Decano institucional; lecturas y aprobaciones amplias |
| `RECTORADO` | Rectorado institucional; lecturas y aprobaciones amplias |

---

## Módulo: Autenticación (`/auth`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/auth/login` | POST | — | — | — | OK (CSRF skip) | OK |
| `/auth/refresh` | POST | — | — | Solo usa cookie propia | OK | OK |
| `/auth/logout` | POST | — | — | Solo usa cookie propia | OK | OK |
| `/auth/me` | GET | JWT | Cualquier autenticado | Solo datos del propio JWT | OK | OK |
| `/auth/solicitar-recuperacion` | POST | — | — | — | OK (CSRF skip) | OK |
| `/auth/restablecer-contrasena` | POST | — | — | Token en body | OK (CSRF skip) | OK |

---

## Módulo: Health (`/`, `/health`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/` | GET | — | — | — | Expone: nombre API, versión, estado BD | BAJO |
| `/health` | GET | — | — | — | Expone: estado BD y API | BAJO |

**Nota:** Endpoints sin autenticación intencionales para monitoreo. Riesgo residual aceptable (sin datos de negocio).

---

## Módulo: Usuarios (`/configuracion/usuarios`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/configuracion/usuarios` | GET | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/usuarios` | POST | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/usuarios/:id` | GET | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/usuarios/:id` | PATCH | JWT | `ADMINISTRADOR_SISTEMA` | — | OK — incluye cambio de rol | OK |
| `/configuracion/usuarios/:id/estado` | PATCH | JWT | `ADMINISTRADOR_SISTEMA` | — | ✅ CORREGIDO (C2): invalida sesiones activas al desactivar | OK |

**F2 — CORREGIDO (C2):** `toggleEstado()` ahora ejecuta `sesion.updateMany({ activo: false })` al desactivar. `JwtStrategy` chequea `usuario.activo` en la misma query de sesión. El usuario desactivado recibe 401 en su siguiente request.

---

## Módulo: Roles (`/configuracion/roles`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/configuracion/roles` | GET | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/roles` | POST | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/roles/:id` | GET | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/roles/:id` | PATCH | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/roles/:id/estado` | PATCH | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |

**F1 — CORREGIDO (C1):** `JwtStrategy.validate()` ahora retorna `rol: { nombre: sesion.usuario.rol.nombre }` — desde BD, no del JWT. El cambio de rol tiene efecto inmediato en el siguiente request autenticado.

---

## Módulo: Parámetros (`/configuracion/parametros`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/configuracion/parametros` | GET | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |
| `/configuracion/parametros` | PATCH | JWT | `ADMINISTRADOR_SISTEMA` | — | OK | OK |

---

## Módulo: Docentes (`/docentes`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/docentes` | GET | JWT | ADMIN, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/docentes` | POST | JWT | ADMIN, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/docentes/mi-ficha` | GET | JWT | `DOCENTE` | Resuelve por `req.user.id` → `docenteId` (seguro) | OK | OK |
| `/docentes/mi-ficha` | PATCH | JWT | `DOCENTE` | Resuelve por `req.user.id` → `docenteId` (seguro) | OK | OK |
| `/docentes/:id` | GET | JWT | ADMIN, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK — DOCENTE no puede | OK |
| `/docentes/:id` | PATCH | JWT | ADMIN, DECANO, RECTORADO, DIRECTOR_CARRERA, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/docentes/:id` | DELETE | JWT | ADMIN, DECANO, RECTORADO, SECRETARIA_ACADEMICA | — | OK | OK |

**Nota:** `GET /docentes/:id` no está disponible para DOCENTE → no puede leer fichas de otros docentes por ID. Ownership de `/mi-ficha` resuelto desde token (no acepta ID externo). ✓

---

## Módulo: Materias (`/materias`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/materias` | GET | JWT | Todos los roles | — | OK | OK |
| `/materias/:id` | GET | JWT | Todos los roles | — | OK | OK |
| `/materias/:id/ficha` | GET | JWT | Todos los roles | — | OK | OK |
| `/materias/:id/historial` | GET | JWT | Todos los roles | — | OK | OK |
| `/materias` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | — | OK | OK |
| `/materias/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO, DOCENTE | ✅ DOCENTE: requiere VinculacionCatedra `estado='APROBADA'` | CORREGIDO (C4) | OK |
| `/materias/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | — | OK | OK |
| `/materias/:id/correlativas` | GET | JWT | Todos los roles | — | OK | OK |
| `/materias/:id/correlativas` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | DOCENTE excluido (arquitectura curricular) | CORREGIDO (C4) | OK |
| `/materias/:id/correlativas/:correlativaId` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | DOCENTE excluido (arquitectura curricular) | OK | OK |
| `/materias/:id/correlativas/:correlativaId` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | DOCENTE excluido (arquitectura curricular) | CORREGIDO (C4) | OK |

**F3 — CORREGIDO (C4):** `PATCH /materias/:id` con DOCENTE requiere `VinculacionCatedra` con `estado='APROBADA'`. `PENDIENTE_DE_APROBACION`, `RECHAZADA` y `DESVINCULADA` → 403. DOCENTE removido de correlativas (son arquitectura curricular).

---

## Módulo: Programas de Asignatura (`/programas`)

| Endpoint | Método | Auth | Roles | Ownership / Scope | Estado | Riesgo |
|----------|--------|------|-------|-------------------|--------|--------|
| `/programas/materia/:materiaId` | GET | JWT | Todos los roles | — | OK | OK |
| `/programas/materia/:materiaId` | PATCH | JWT | ADMINISTRADOR_SISTEMA, DIRECTOR_CARRERA, DECANO, SECRETARIA_ACADEMICA, RECTORADO, **DOCENTE** | ✅ ADMIN: global · ✅ DC: scope carrera · ✅ DECANO: scope facultad · SEC/REC: global · ✅ DOCENTE: solo con `VinculacionCatedra` `estado='APROBADA'` para esa asignatura (validado en servicio) | ✅ FASE 3 + C10 | OK |
| `/programas/solicitudes` | GET | JWT | SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | Filtrado por scope: DC → carrera · DECANO → facultad · SEC/REC → global | ✅ Circuito | OK |
| `/programas/solicitudes/:id/aprobar` | PATCH | JWT | SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | Scope institucional + 100% avance + race condition protection | ✅ Circuito | OK |
| `/programas/solicitudes/:id/solicitar-correcciones` | PATCH | JWT | SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | Scope institucional + observaciones obligatorias (≥10 chars) | ✅ Circuito | OK |
| `/programas/solicitudes/correcciones-docente` | GET | JWT | DOCENTE | Solo solicitudes donde el usuario tiene VinculacionCatedra APROBADA | ✅ Conversación | OK |
| `/programas/contadores` | GET | JWT | Todos los roles | Devuelve `{ correcciones }` — para DOCENTE siempre 0; para aprobadores: mensajes RESPUESTA no leídos en su scope | ✅ Conversación | OK |
| `/programas/solicitudes/:id/mensajes` | GET | JWT | Todos los roles | DOCENTE: vinculación APROBADA · Directivos: scope institucional | ✅ Conversación | OK |
| `/programas/solicitudes/:id/mensajes` | POST | JWT | Todos los roles | Misma ownership que GET · DOCENTE solo puede responder en estado CORRECCIONES_SOLICITADAS | ✅ Conversación | OK |
| `/programas/solicitudes/:id/mensajes/leer` | PATCH | JWT | Todos los roles | Marca como leídos solo los mensajes del tipo opuesto al rol del usuario | ✅ Conversación | OK |
| `/programas/materia/:materiaId/historial` | GET | JWT | Todos los roles | DIRECTOR_CARRERA: scope carrera · DECANO: scope facultad · SEC/REC/ADMIN: global · DOCENTE: VinculacionCatedra APROBADA | ✅ C12 | OK |
| `/programas/regularizacion` | GET | JWT | ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA | Global — solo lectura; no aplica cambios | ✅ C13 | OK |
| `/programas/regularizacion/generar` | POST | JWT | ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA | Global — recibe `programaIds[]` explícitos; crea solicitudes y notifica directivos | ✅ C16.2 | OK |

**FASE 3 — Scopes Institucionales y política definitiva de roles (C8):**
- `DIRECTOR_CARRERA`: solo puede editar programas de la Carrera que tiene asociada (`UsuarioCarrera`). Acceso a otras carreras → 403.
- `DECANO`: solo puede editar programas de Carreras pertenecientes a su Facultad (`UsuarioFacultad`). Acceso a carreras de otra facultad → 403.
- `ADMINISTRADOR_SISTEMA`: scope global, sin restricción territorial. Mismos permisos de edición que `SECRETARIA_ACADEMICA`.
- `SECRETARIA_ACADEMICA`, `RECTORADO`: scope global, sin restricción territorial.
- `DOCENTE`: puede editar el programa de una asignatura **solo si posee una `VinculacionCatedra` con `estado='APROBADA'`** para esa asignatura exacta. El servicio verifica `Docente.usuarioId → docenteId` y luego `VinculacionCatedra { docenteId, materiaId, estado:'APROBADA' }`. Sin vinculación aprobada → 403. No puede editar programas de asignaturas ajenas.
- `ADMINISTRATIVO`: **solo lectura** — no está en `ROLES_EDITAR`. `PATCH /programas/materia/:materiaId` devuelve 403.
- `estadoPrograma = 'APROBADO'` histórico se **conserva intacto** en BD tanto al consultar como al editar. Solo se recalcula PENDIENTE/EN_REVISION para programas que no eran APROBADO.
- El historial de modificaciones (`HistorialPrograma`) se persiste en una `$transaction` atómica junto con el upsert del programa.

**Circuito de Aprobación (C9 — 2026-10-08):**
- `ADMINISTRADOR_SISTEMA` **no** es aprobador. Conserva permisos de edición pero está explícitamente excluido de `ROLES_APROBAR`.
- Al alcanzar el 100% de avance se crea automáticamente una `SolicitudAprobacionPrograma` con estado `PENDIENTE_APROBACION`. No se crean duplicados (verificación atómica en `$transaction`).
- Si el avance cae del 100%, la solicitud pendiente pasa a `INVALIDADA`.
- Cambio en campo **sustancial** de un programa `APROBADO`: el programa pasa a `EN_REVISION` y se genera nueva solicitud. Campos **administrativos** (fechas, vigencias) no requieren nueva aprobación.
- `GET /programas/solicitudes`: cada aprobador ve solo las solicitudes de su scope (mismo mecanismo que edición: `ScopeService.getCarrerasEnScope`).
- `PATCH /solicitudes/:id/aprobar`: re-verifica 100% antes de aprobar · re-verifica estado dentro de `$transaction` (race condition protection: `ConflictException` si ya resuelta).
- `PATCH /solicitudes/:id/solicitar-correcciones`: observaciones obligatorias ≥10 caracteres (validadas con `class-validator` en `SolicitarCorreccionesDto`).
- Toda operación del circuito genera entrada en `HistorialPrograma` con acciones `APROBACION` o `CORRECCIONES_SOLICITADAS`.
- Estados de `SolicitudAprobacionPrograma`: `PENDIENTE_APROBACION` → `APROBADO` | `CORRECCIONES_SOLICITADAS` | `INVALIDADA`.

**Estados Funcionales + Historial Compartido (C12 — 2026-10-09):**
- Cinco estados funcionales visibles derivados en tiempo de ejecución: `INCOMPLETO`, `COMPLETO`, `EN_CORRECCION`, `EN_REVISION`, `APROBADO`. Ver C13 para reducción a 4 estados.
- `calcEstadoFuncional(estadoPrograma, todasCompletas, solicitudActual)` exportada desde el servicio. Usada en `obtenerPrograma`, `actualizarPrograma` y frontend (espejo exacto).
- `GET /programas/materia/:materiaId/historial`: retorna `{ historial: HistorialPrograma[], solicitudes: SolicitudAprobacionPrograma[] }` con mensajes anidados. El historial es **compartido** entre todos los directivos autorizados — todo el que tenga scope sobre la carrera ve el mismo timeline completo.
- DIRECTOR_CARRERA y DECANO: acceso validado por `tieneScopeCarrera` antes de consultar. Sin scope → 403.
- DOCENTE: acceso validado por `VinculacionCatedra estado='APROBADA'`. Sin vinculación → 403.

**Unificación de Estados y Notificaciones Automáticas (C13 — 2026-10-09):**
- `COMPLETO` eliminado del vocabulario visible. Cuatro estados funcionales: `INCOMPLETO` (gris), `EN_CORRECCION` (naranja), `EN_REVISION` (ámbar), `APROBADO` (verde).
- `EN_REVISION` requiere una `SolicitudAprobacionPrograma` con estado `PENDIENTE_APROBACION` persistida en BD — nunca se infiere solo por 100% de avance.
- Solicitud creada automáticamente en `actualizarPrograma` cuando el avance llega al 100% y no hay solicitud activa ni ciclo `CORRECCIONES_SOLICITADAS` vigente.
- Docente reenvía (`RESPUESTA` en estado `CORRECCIONES_SOLICITADAS`): reactiva la solicitud a `PENDIENTE_APROBACION` y notifica a directivos.
- `Notificacion` extendida: `docenteId` opcional, `usuarioId` opcional → permite notificaciones a directivos por `usuarioId` (no solo a docentes).
- Scope de notificaciones: SA/RECTORADO → global; DIRECTOR_CARRERA → solo su carrera; DECANO → solo su facultad. Usuarios inactivos excluidos. Sin duplicados por solicitud.
- `GET /programas/regularizacion`: identifica programas al 100% sin solicitud activa (solo lectura — no aplica cambios sin confirmación explícita).
- Frontend: badge de 4 estados en `programas-asignatura` y `ficha-asignatura`; polling automático de contadores cada 30s.

**Notificación Automática al Docente por Aprobación Definitiva (C15 — 2026-10-10):**
- **Causa raíz**: `aprobarSolicitud` actualizaba estado y programa pero no creaba ninguna `Notificacion` — el docente no recibía confirmación de aprobación.
- **Fix**: dentro de la misma transacción atómica, se identifican los docentes con `VinculacionCatedra { estado: 'APROBADA', materiaId }` y se crea una `Notificacion` por docente con `tipo='APROBACION_PROGRAMA'`. Deduplicación por `docenteId + solicitudProgramaId + leida=false`.
- **Cuerpo de la notificación**: JSON con `solicitudId`, `materiaId`, `materia`, `carrera`, `plan`, `directivo` (nombre completo del aprobador), `rolDirectivo`, `fechaAprobacion`.
- **Frontend**: nuevo tipo `APROBACION_PROGRAMA` en `badgeCfg` (emerald). Modal muestra campos de asignatura, carrera, plan, aprobador y fecha. Botón "Ver programa" navega a `/plan-estudios/ficha-asignatura?id={materiaId}&tab=programa`. Campo `materiaId` agregado a `DatosNotificacion`. Badge del DOCENTE se incrementa automáticamente (reutiliza `GET /notificaciones/no-leidas/count` existente).
- **Integridad transaccional**: si la aprobación falla (scope inválido, race condition, programa incompleto), ninguna notificación se crea.
- **272/272 tests pasando** (14 tests nuevos en `programas-c15.spec.ts`).

**Endpoint de Regularización Histórica (C16.2 — 2026-10-10):**
- `POST /programas/regularizacion/generar`: genera solicitudes de aprobación para los programas históricos identificados en C16.1. Recibe `{ programaIds: string[] }` — IDs explícitos, no genera solicitudes masivas automáticas.
- Roles autorizados: `ADMINISTRADOR_SISTEMA`, `SECRETARIA_ACADEMICA`. Sin acceso para ningún otro rol.
- Validación individual: para cada `programaId`, el servicio verifica completitud al 100%, ausencia de aprobación vigente, ausencia de solicitud activa y ausencia de correcciones en curso. Programa que no cumpla → `resultado: 'OMITIDO'` con motivo.
- Transacción por programa: re-verifica las condiciones dentro de `$transaction` para proteger contra solicitudes duplicadas concurrentes.
- Idempotente: si se invoca dos veces con el mismo `programaId` ya regularizado, la segunda vez reporta `OMITIDO` sin crear duplicados.
- Crea `HistorialPrograma` con `accion='REGULARIZACION_HISTORICA'` (auditoría de quién ejecutó y cuándo).
- Llama a `notificarDirectivos` (existente desde C13) para notificar a todos los directivos con scope sobre la carrera.
- Respuesta: `{ procesados, solicitudesGeneradas, omitidos, detalle[] }` donde `detalle` incluye resultado y motivo por programa.
- No genera migraciones nuevas.
- **296/296 tests pasando** (12 tests nuevos en `programas-c162.spec.ts`).

**Refuerzo de Concurrencia en Regularización Histórica (C16.3 — 2026-10-10):**
- **Problema identificado**: la protección anti-concurrencia en `generarSolicitudesRegularizacion` usaba dos `findFirst` (pre-check + re-verificación in-tx) sin ningún lock de BD. Bajo carga real (o `Promise.all`), dos transacciones podían pasar ambos checks simultáneamente y crear solicitudes duplicadas para el mismo programa.
- **Solución**: `SELECT id FROM "ProgramaAsignatura" WHERE id = $1 FOR UPDATE` como primera operación dentro de `$transaction`. PostgreSQL adquiere un lock exclusivo de fila sobre `ProgramaAsignatura` en la primera transacción; la segunda transacción bloquea en ese `SELECT` hasta que la primera confirme. Al desbloquear, el `findFirst` de la segunda transacción ya ve la solicitud creada y retorna `OMITIDO` sin crear duplicado.
- **Mecanismo**: el lock se adquiere antes de verificar solicitudes existentes, valida el estado actual del programa y crea la solicitud si corresponde — el lock se mantiene hasta el `COMMIT` de la transacción (comportamiento estándar de `SELECT ... FOR UPDATE`).
- **Compatibilidad**: `actualizarPrograma` usa `upsert` (write lock implícito); si corre concurrentemente con regularización, el upsert bloquea en el `SELECT FOR UPDATE` de regularización o viceversa — en ambos casos el resultado final es correcto. `aprobarSolicitud` y `enviarMensaje` no modifican `ProgramaAsignatura` directamente y no generan contención con este lock.
- **Sin nuevas migraciones**.
- **Tests**: 296/296 unitarios sin regresiones. Mock `$queryRaw: jest.fn().mockResolvedValue([{ id: PROG_ID }])` añadido en `programas-c162.spec.ts`. Test de integración real: `programas-c162-concurrencia.spec.ts` (1 test, requiere PostgreSQL activo; fixtures con prefijo `[TEST-C162]`; limpieza completa en `afterAll`).

**Corrección Inconsistencia COMPLETITUD vs ESTADO FUNCIONAL (C16 — 2026-10-10):**
- **Causa raíz**: `calcEstadoFuncional(estadoPrograma, todasCompletas, solicitudActual)` recibía el parámetro `todasCompletas` pero **nunca lo usaba**. El fallback final era `return 'INCOMPLETO'` para cualquier programa sin solicitud activa y sin `estadoPrograma='APROBADO'`. Los programas históricos completados antes de que existiera el circuito (100% de secciones, `estadoPrograma='PENDIENTE'`, sin ninguna `SolicitudAprobacionPrograma`) caían en ese fallback y mostraban INCOMPLETO pese a COMPLETITUD=COMPLETO y AVANCE=100%.
- **Fix**: añadida rama `if (!todasCompletas) return 'INCOMPLETO'` antes del fallback y el fallback cambiado a `return 'EN_REVISION'`. Programas históricos al 100% sin solicitud activa ahora muestran EN_REVISION, señalando que requieren regularización vía el endpoint `/programas/regularizacion`.
- **Sin cambios en BD**: la corrección es exclusivamente en lógica de derivación en tiempo de ejecución. No se crean migraciones ni se modifican registros históricos.
- **Impacto en programas-estados.spec.ts**: tres tests que verificaban el comportamiento anterior (tests 2, 8 y 9 esperaban INCOMPLETO con `todasCompletas=true`) fueron actualizados a EN_REVISION. Ninguna regresión en los 14 restantes.
- **12 nuevos tests** en `programas-c16.spec.ts` cubren la función pura `calcEstadoFuncional` con todos los escenarios relevantes + verificación de solo lectura de `listarProgramasParaRegularizacion`.
- **284/284 tests pasando**.

**Corrección Circuito Aprobación y Comunicación Bidireccional (C14 — 2026-10-10):**
- **Fix ERROR 1**: `solicitarCorrecciones` ahora actualiza `programaAsignatura.estadoPrograma → 'EN_REVISION'` dentro de la misma transacción. Garantiza que `calcEstadoFuncional` nunca devuelva `APROBADO` cuando hay correcciones activas, incluso si el programa fue aprobado en un ciclo anterior.
- **Validación de contenido vacío**: `enviarMensaje` rechaza con `BadRequestException` si `dto.contenido` es vacío o solo espacios (aplica a DOCENTE y directivo).
- **Notificación CORRECCIONES_PROGRAMA**: el modal de notificaciones en el frontend ahora muestra las observaciones del directivo, datos de la asignatura y un botón "Ver correcciones" que abre el hilo de conversación. Tipo `CORRECCIONES_PROGRAMA` registrado en `badgeCfg`. Interfaz `DatosNotificacion` extendida con `solicitudId`, `materia`, `directivo`, `rolDirectivo`, `observaciones`.
- **Circuito completo validado**: ciclo correcciones → respuesta docente reactiva solicitud → segunda ronda de correcciones soportada sin bloqueo.

**Comunicación Bidireccional DOCENTE↔DIRECTIVO (C11 — 2026-10-08):**
- Al solicitar correcciones, `solicitarCorrecciones` crea el primer `MensajeCorrecionPrograma` (`tipo='CORRECCION'`) y notificaciones individuales (`tipo='CORRECCIONES_PROGRAMA'`, `solicitudProgramaId`) para cada docente con `VinculacionCatedra APROBADA`.
- DOCENTE puede **leer y responder** la conversación (`tipo='RESPUESTA'`) solo si la solicitud está en `CORRECCIONES_SOLICITADAS`. Intento en estado `APROBADO`/`INVALIDADA` → `ConflictException`.
- Directivos con scope válido pueden leer y continuar la conversación sin restricción de estado.
- `PATCH /mensajes/leer`: marca como leídos los mensajes del **tipo opuesto** al rol del usuario — nunca los propios. DOCENTE: marca CORRECCION + limpia notificación; Directivo: marca RESPUESTA.
- No hay servicios externos. Todo el estado persiste en BD (`MensajeCorrecionPrograma`). Ausencia de perfil Docente → 403; IDOR a solicitud sin vinculación/scope → 403.
- `GET /programas/contadores`: devuelve `{ correcciones: N }` donde N = mensajes RESPUESTA no leídos dentro del scope del aprobador.

---

## Módulo: Planes de Estudio (`/plan-estudios`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/plan-estudios/carreras` | GET | JWT | Todos los roles | — | OK | OK |
| `/plan-estudios/kpis` | GET | JWT | Todos los roles | — | OK | OK |
| `/plan-estudios` | GET | JWT | Todos los roles | — | OK | OK |
| `/plan-estudios/:id` | GET | JWT | Todos los roles | — | OK | OK |
| `/plan-estudios/:id/estadisticas` | GET | JWT | Todos los roles | — | OK | OK |
| `/plan-estudios` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/plan-estudios/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, ADMINISTRATIVO | — | OK | OK |
| `/plan-estudios/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA | — | OK | OK |
| `/plan-estudios/exportar/excel` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | — | OK | OK |
| `/plan-estudios/exportar/pdf` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | — | OK | OK |

---

## Módulo: Facultades (`/facultades`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/facultades/universidades` | GET | JWT | Todos los roles | — | OK | OK |
| `/facultades` | GET | JWT | Todos los roles | — | OK | OK |
| `/facultades/:id` | GET | JWT | Todos los roles | — | OK | OK |
| `/facultades` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/facultades/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/facultades/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA | — | OK | OK |

---

## Módulo: Carreras (`/carreras`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/carreras` | GET | JWT | Todos los roles | — | OK | OK |
| `/carreras/:id` | GET | JWT | Todos los roles | — | OK | OK |
| `/carreras` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/carreras/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, ADMINISTRATIVO | — | OK | OK |
| `/carreras/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA | — | OK | OK |

---

## Módulo: Vinculaciones a Cátedra (`/vinculaciones-catedra`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/vinculaciones-catedra` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO, DOCENTE | DOCENTE → filtrado automático por docenteId propio | OK | OK |
| `/vinculaciones-catedra/:id` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO, DOCENTE | DOCENTE → ForbiddenException si no es suya | OK | OK |
| `/vinculaciones-catedra` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | — | OK | OK |
| `/vinculaciones-catedra/:id/aprobar` | PATCH | JWT | ADMIN, **DOCENTE** | DOCENTE → solo la suya | OK | OK |
| `/vinculaciones-catedra/:id/rechazar` | PATCH | JWT | ADMIN, **DOCENTE** | DOCENTE → solo la suya | OK | OK |
| `/vinculaciones-catedra/:id/desvincular` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DECANO, RECTORADO | — | OK | OK |

**F5 — IMPLEMENTADO (C7):** DIRECTOR_CARRERA tiene acceso a leer, crear y desvincular vinculaciones (igual que DECANO/RECTORADO). No puede aprobar ni rechazar. **Limitación conocida:** sin una relación explícita `Usuario↔Carrera` en el schema, DIRECTOR_CARRERA ve todas las vinculaciones (sin filtro por carrera). Esta limitación es aceptada institucionalmente — no se creó nueva relación de datos. El filtro por carrera queda pendiente como mejora futura cuando se decida el modelo `DirectorCarrera`.

---

## Módulo: Notificaciones (`/notificaciones`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/notificaciones` | GET | JWT | ADMIN, DOCENTE | DOCENTE → solo las propias; ADMIN → todas | OK | OK |
| `/notificaciones/no-leidas/count` | GET | JWT | ADMIN, DOCENTE | DOCENTE → solo las propias | OK | OK |
| `/notificaciones/todas/leer` | PATCH | JWT | ADMIN, DOCENTE | DOCENTE → solo las propias | OK | OK |
| `/notificaciones/:id/leer` | PATCH | JWT | ADMIN, DOCENTE | DOCENTE → ForbiddenException si no es suya | OK | OK |

---

## Módulo: Repositorio de Normativas (`/normativas`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/normativas/tipos` | GET | JWT | Todos los roles | — | OK | OK |
| `/normativas/candidata-sucesora` | GET | JWT | ROLES_GESTION | — | OK | OK |
| `/normativas/conteo-por-tipo` | GET | JWT | Todos los roles | DOCENTE: solo vigentes | OK | OK |
| `/normativas/auditoria` | GET | JWT | ROLES_GESTION | — | OK | OK |
| `/normativas/auditoria/:logId` | GET | JWT | ROLES_GESTION | — | OK | OK |
| `/normativas` | GET | JWT | Todos los roles | DOCENTE: excluye eliminadas y no-vigentes | OK | OK |
| `/normativas/exportar/pdf` | GET | JWT | Todos los roles | DOCENTE: excluye eliminadas y no-vigentes | OK | OK |
| `/normativas/exportar/excel` | GET | JWT | Todos los roles | DOCENTE: excluye eliminadas y no-vigentes | OK | OK |
| `/normativas/:id/archivo` | GET | JWT | Todos los roles | DOCENTE: solo vigentes; Eliminadas: 404 para no-GESTION | OK | OK |
| `/normativas/:id/estado` | PATCH | JWT | ROLES_GESTION | — | OK | OK |
| `/normativas/:id` | PATCH | JWT | ROLES_GESTION | — | OK | OK |
| `/normativas/:id` | DELETE | JWT | ROLES_GESTION | — | OK — baja lógica | OK |
| `/normativas/:id` | GET | JWT | Todos los roles | DOCENTE: excluye eliminadas | OK | OK |
| `/normativas` | POST | JWT | ROLES_GESTION | — | OK | OK |

**ROLES_GESTION:** ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, DECANO, RECTORADO
**ROLES_CONSULTA:** todos los 7 roles

---

## Módulo: Tablas Maestras (`/configuracion/tablas-maestras`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/:tipo/activos` | GET | JWT | Todos los roles | — | OK | OK |
| `/:tipo` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:tipo` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:tipo/:id/toggle` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:tipo/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:tipo/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |

---

## Módulo: Áreas Disciplinares / Subáreas (`/configuracion/subareas`)

| Endpoint | Método | Auth | Roles | Ownership | Estado previo | Riesgo |
|----------|--------|------|-------|-----------|---------------|--------|
| `/activos` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DOCENTE | — | OK | BAJO |
| `/` | GET | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA, DOCENTE | — | OK | BAJO |
| `/` | POST | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:id/toggle` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:id` | PATCH | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |
| `/:id` | DELETE | JWT | ADMIN, SECRETARIA_ACADEMICA, DIRECTOR_CARRERA | — | OK | OK |

**C3 — CORREGIDO:** Controlador actualizado con `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` a nivel de clase.

---

## Resumen de Hallazgos — Estado Final S4

| ID | Tipo | Descripción | Severidad | Estado |
|----|------|-------------|-----------|--------|
| F1 | M-05a | Cambio de rol no tiene efecto inmediato | ALTO | ✅ CORREGIDO (C1) — rol desde BD en cada request |
| F2 | M-05b | Usuario desactivado puede seguir usando sesiones activas | ALTO | ✅ CORREGIDO (C1+C2) — chequeo activo + invalidación de sesiones |
| F3 | IDOR | DOCENTE puede modificar CUALQUIER materia sin ownership | MEDIO | ✅ CORREGIDO (C4) — solo estado='APROBADA' otorga acceso |
| F4 | RBAC | DOCENTE recibía 403 al guardar programa pese a tener vinculación APROBADA | MEDIO | ✅ CORREGIDO (C10) — DOCENTE agregado a ROLES_EDITAR; servicio valida vinculación APROBADA por asignatura |
| F5 | DIP | DIRECTOR_CARRERA no podía ver vinculaciones | INSTITUCIONAL | ✅ IMPLEMENTADO (C7) — acceso a leer/crear/desvincular sin filtro por carrera (limitación aceptada institucionalmente) |
| F8 | SCOPE | DC/DECANO podían editar programas fuera de su scope territorial | MEDIO | ✅ CORREGIDO (C8) — FASE 3: ScopeService.tieneScopeCarrera() en ProgramasService |
| F6 | INFO | Health endpoints públicos exponen info de versión | BAJO | Aceptado — sin datos de negocio |
| F7 | INFO | AreasDisiplinaresController sin @UsePipes | BAJO | ✅ CORREGIDO (C3) |

### Política de ownership definitiva (VinculacionCatedra)

> **C10:** El ownership por `VinculacionCatedra` aplica tanto al módulo de Vinculaciones **como a Programas de Asignatura para el rol DOCENTE**.
> DOCENTE puede editar el programa de una asignatura solo si tiene `VinculacionCatedra.estado = 'APROBADA'` para esa asignatura.
> ADMINISTRATIVO es solo lectura en Programas. La tabla de estados aplica a ambos módulos según corresponda.

Estados del modelo `VinculacionCatedra` confirmados en código:

| Estado | Significado | Relevante para Vinculaciones |
|--------|-------------|------------------------------|
| `PENDIENTE_DE_APROBACION` | Solicitud enviada, sin resolución | ❌ NO |
| `APROBADA` | Vinculación efectivamente activa | ✅ SÍ |
| `RECHAZADA` | Vinculación denegada | ❌ NO |
| `DESVINCULADA` | Vinculación finalizada (baja) | ❌ NO |

**DIP:** Decisión Institucional Pendiente
