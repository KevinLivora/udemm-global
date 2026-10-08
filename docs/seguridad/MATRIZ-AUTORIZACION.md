# MATRIZ DE AUTORIZACIÓN — UDEMM Global

**Fecha:** 2026-08-27
**Actualizado:** 2026-09-16 (FASE 3 — scopes aplicados a Programas de Asignatura)
**Rama:** `feature/ajustes-permisos-docentes`
**Etapa:** S4 — ETAPA B COMPLETADA / FASES 1-3 scopes implementadas

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
| `/programas/materia/:materiaId` | PATCH | JWT | ADMINISTRADOR_SISTEMA, DIRECTOR_CARRERA, DECANO, SECRETARIA_ACADEMICA, RECTORADO | ✅ ADMIN: global · ✅ DC: scope carrera · ✅ DECANO: scope facultad · SEC/REC: global | ✅ FASE 3 | OK |

**FASE 3 — Scopes Institucionales y política definitiva de roles (C8):**
- `DIRECTOR_CARRERA`: solo puede editar programas de la Carrera que tiene asociada (`UsuarioCarrera`). Acceso a otras carreras → 403.
- `DECANO`: solo puede editar programas de Carreras pertenecientes a su Facultad (`UsuarioFacultad`). Acceso a carreras de otra facultad → 403.
- `ADMINISTRADOR_SISTEMA`: scope global, sin restricción territorial. Mismos permisos de edición que `SECRETARIA_ACADEMICA`.
- `SECRETARIA_ACADEMICA`, `RECTORADO`: scope global, sin restricción territorial.
- `DOCENTE`, `ADMINISTRATIVO`: **solo lectura** — no están en `ROLES_EDITAR`. `PATCH /programas/materia/:materiaId` devuelve 403 para estos roles.
- Endpoint `POST /aprobar` **eliminado**. El flujo de aprobación deja de usarse funcionalmente.
- `estadoPrograma = 'APROBADO'` histórico se **conserva intacto** en BD tanto al consultar como al editar. Solo se recalcula PENDIENTE/EN_REVISION para programas que no eran APROBADO.
- No se generan nuevas entradas de tipo `APROBACION` en historial; las existentes son visibles en la ficha.
- El historial de modificaciones (`HistorialPrograma`) se persiste en una `$transaction` atómica junto con el upsert del programa.

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
| F4 | RBAC | DOCENTE podía modificar programas (con VinculacionCatedra APROBADA) | MEDIO | ✅ CORREGIDO (C5→C9) — DOCENTE eliminado de ROLES_EDITAR; es solo lectura en Programas |
| F5 | DIP | DIRECTOR_CARRERA no podía ver vinculaciones | INSTITUCIONAL | ✅ IMPLEMENTADO (C7) — acceso a leer/crear/desvincular sin filtro por carrera (limitación aceptada institucionalmente) |
| F8 | SCOPE | DC/DECANO podían editar programas fuera de su scope territorial | MEDIO | ✅ CORREGIDO (C8) — FASE 3: ScopeService.tieneScopeCarrera() en ProgramasService |
| F6 | INFO | Health endpoints públicos exponen info de versión | BAJO | Aceptado — sin datos de negocio |
| F7 | INFO | AreasDisiplinaresController sin @UsePipes | BAJO | ✅ CORREGIDO (C3) |

### Política de ownership definitiva (VinculacionCatedra — solo módulo Vinculaciones)

> **FASE 3:** El ownership por `VinculacionCatedra` ya **no aplica a Programas de Asignatura**.
> DOCENTE y ADMINISTRATIVO son solo lectura en Programas. La tabla de estados aplica únicamente al módulo de Vinculaciones.

Estados del modelo `VinculacionCatedra` confirmados en código:

| Estado | Significado | Relevante para Vinculaciones |
|--------|-------------|------------------------------|
| `PENDIENTE_DE_APROBACION` | Solicitud enviada, sin resolución | ❌ NO |
| `APROBADA` | Vinculación efectivamente activa | ✅ SÍ |
| `RECHAZADA` | Vinculación denegada | ❌ NO |
| `DESVINCULADA` | Vinculación finalizada (baja) | ❌ NO |

**DIP:** Decisión Institucional Pendiente
