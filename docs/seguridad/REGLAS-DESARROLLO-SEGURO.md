# UDEMM GLOBAL — Reglas Permanentes de Desarrollo Seguro

**Sistema:** UDEMM Global
**Versión del documento:** 1.0
**Fecha de emisión:** 2026-08-27
**Rama de origen:** `feature/security-hardening`
**Fuentes:** FASE-S1 · FASE-S2 · FASE-S3 · FASE-S4 · MATRIZ-AUTORIZACION
**Responsable técnico:** Mariano Fuentes

---

## Convenciones

| Indicador | Significado |
|-----------|-------------|
| ✅ **IMPLEMENTADO** | Control implementado en el código actual y verificado con tests y/o build |
| ⏳ **PENDIENTE** | Documentado en S1–S4 como trabajo futuro; aún no implementado |
| 🔴 **RIESGO RESIDUAL** | Riesgo conocido, sin mitigación actual; requiere decisión o sprint específico |
| 🏛️ **DECISIÓN INSTITUCIONAL** | Requiere resolución por autoridades antes de implementar |

Las reglas con estado ✅ son obligatorias para cualquier cambio en el código.
Las reglas con ⏳ son compromisos activos de la hoja de ruta de seguridad.
Las reglas con 🔴 son riesgos documentados que deben tenerse en cuenta al planificar trabajo.

---

## 0. Principio General

> **Fail Secure / Fail Fast:** si falta una variable crítica, un secreto es inseguro o una configuración está ausente, el backend no arranca. Nunca usar valores por defecto inseguros.

El sistema aplica defensa en profundidad: ningún componente aislado es la única barrera de seguridad. Cada capa (autenticación, autorización, validación de input, headers HTTP, rate limiting) refuerza a las demás.

**Regla de oro para cualquier nuevo código:** si un endpoint o función maneja datos de usuario, el acceso al recurso o una operación sensible, debe existir un control explícito documentado en este documento o en la MATRIZ-AUTORIZACION. La ausencia de control explícito es un hallazgo de seguridad.

---

## 1. Secretos y Variables de Entorno

### 1.1 Variables obligatorias al arrancar

✅ `JWT_SECRET` — mínimo 32 caracteres; el backend rechaza arrancar si está ausente, vacía o es un valor inseguro conocido (ej: `'supersecretjwtkey'`, `'secret'`). Se usa `configService.getOrThrow()`, sin fallback hardcodeado.

✅ `DATABASE_URL` — debe comenzar con `postgresql://` o `postgres://`. El backend rechaza arrancar si está ausente o tiene formato inválido.

✅ `FRONTEND_URL` — debe ser una URL válida con protocolo `http://` o `https://`. El backend rechaza arrancar si está ausente o es inválida (usada por CORS y CsrfMiddleware).

✅ `NODE_ENV` — si se define, debe ser `development`, `production` o `test`. Cualquier otro valor hace fallar el arranque.

Validación centralizada: `backend/src/config/env.validation.ts` — función `validateEnv()` llamada desde `ConfigModule.forRoot({ validate: validateEnv })`.

### 1.2 Variables para el seed

✅ `SEED_ADMIN_PASS`, `SEED_DECANO_PASS`, `SEED_RECTORADO_PASS` — obligatorias si `NODE_ENV=production`. El seed aborta si alguna falta en producción. En desarrollo se usan valores de fallback con advertencia visible.

✅ El seed en producción **no sobreescribe contraseñas existentes** (el campo `contrasena` está ausente del bloque `update` del upsert de Prisma).

### 1.3 Reglas de manejo de secretos

✅ **El archivo `.env` nunca se sube al repositorio.** `.gitignore` lo excluye explícitamente.

✅ **`.env.example` contiene solo placeholders**, nunca valores reales. El archivo debe ser descriptivo sin ser un secreto en sí mismo.

⏳ En producción, los secretos deben provenir de un gestor de secretos (vault, secret manager del proveedor cloud, o variables de entorno del sistema operativo gestionadas por el equipo de infraestructura) — nunca de archivos `.env` copiados.

**Regla permanente:** cualquier valor sensible (secretos, contraseñas, claves de API, tokens) que aparezca en el código fuente es un hallazgo crítico. Generar `JWT_SECRET` con `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` (mínimo recomendado: 64 bytes → 128 chars hex).

---

## 2. Autenticación y Sesiones

### 2.1 Tokens — dónde viven

✅ Los tokens NO se almacenan en `localStorage` ni en `sessionStorage`. Ambos tokens viajan exclusivamente en cookies HttpOnly:

| Cookie | Contenido | Atributos |
|--------|-----------|-----------|
| `auth_token` | Access JWT firmado con `JWT_SECRET` | `httpOnly: true`, `secure: isProd`, `sameSite: 'lax'`, sin `maxAge` (sesión de navegador) |
| `refresh_token` | Hash bcrypt opaco | `httpOnly: true`, `secure: isProd`, `sameSite: 'lax'`, `maxAge: 30 días` |

JavaScript del cliente no puede leer ninguno de los dos tokens (`document.cookie` retorna vacío para ambos).

### 2.2 Estructura del JWT

✅ El payload del JWT contiene: `{ sub: usuarioId, correoElectronico, rol: { nombre }, sesionId? }`.

El campo `sesionId` apunta al registro `Sesion` en la BD y es el mecanismo de revocación del access token.

**Sobre el claim `rol` en el JWT:** el payload incluye `rol: { nombre }` en el momento del login. Sin embargo, cuando `sesionId` está presente (el caso normal), `JwtStrategy.validate()` **ignora** ese claim y obtiene el rol efectivo desde la BD. El claim `rol` del JWT nunca se usa para decisiones de autorización cuando hay `sesionId`.

⏳ **Mejora futura:** eliminar el claim `rol` del payload JWT. Actualmente existe por razones de compatibilidad con el flujo de login inicial; su presencia es inofensiva porque JwtStrategy lo descarta, pero su eliminación haría el contrato más explícito.

**Regla:** nunca usar `payload.rol` para decisiones de autorización. El rol efectivo de `req.user` se obtiene siempre desde la BD vía JwtStrategy. Si se agrega lógica que lea el rol del JWT directamente, es un error de seguridad.

### 2.3 Verificación en cada request — JwtStrategy

✅ `JwtStrategy.validate()` opera en dos modos según el payload:

**Modo normal (con `sesionId`):** realiza una consulta a la BD en cada request autenticado:

```typescript
// Con sesionId → BD authority
const sesion = await this.prisma.sesion.findUnique({
  where: { id: payload.sesionId },
  include: {
    usuario: { select: { activo: true, rol: { select: { nombre: true } } } },
  },
});
if (!sesion || !sesion.activo) throw new UnauthorizedException('Sesión inválida o revocada');
if (!sesion.usuario.activo)    throw new UnauthorizedException('Cuenta desactivada');
// El rol retornado en req.user viene de la BD — payload.rol es ignorado
return { id: payload.sub, correoElectronico: payload.correoElectronico,
         rol: { nombre: sesion.usuario.rol.nombre }, sesionId: payload.sesionId };
```

**Modo legacy (sin `sesionId`):** retorna el payload del JWT tal cual, sin consulta a BD. Este caso solo ocurre con tokens generados antes de S2. No hay sesiones activas de ese tipo en condiciones normales de operación.

El `rol` en `req.user` proviene de la BD cuando `sesionId` está presente. Un cambio de rol tiene efecto inmediato en el siguiente request.

**Regla:** nunca confiar en `payload.rol` para decisiones de autorización. Cuando `sesionId` está presente (caso normal post-S2), el rol efectivo es siempre el de la BD. Si por cualquier motivo se recibe un token sin `sesionId`, el rol del payload se retorna sin validación de estado del usuario — ese escenario es indeseable y se documenta como riesgo residual.

### 2.4 Logout

✅ `POST /auth/logout` invalida la **sesión actual únicamente** (el dispositivo desde el que se cierra sesión):
1. `TokenRefresh.activo = false` para el token de la cookie actual.
2. `Sesion.activo = false` para la sesión vinculada.
3. Cookies `auth_token` y `refresh_token` eliminadas de la respuesta.

Sesiones de otros dispositivos del mismo usuario **no se afectan** en logout individual.

**Clasificación del endpoint:** sin `JwtAuthGuard` (funciona aunque el access token haya expirado), pero sujeto a `CsrfMiddleware` — requiere `Origin` válido y `X-Requested-With: XMLHttpRequest`. La sesión se identifica por la cookie `refresh_token`, no por un JWT en header. Ver tabla completa en §3.1.

### 2.5 Desactivación de usuario

✅ `PATCH /configuracion/usuarios/:id/estado` (desactivar): `UsuariosService.toggleEstado()` ejecuta en secuencia:
1. `usuario.update({ activo: false })`.
2. `sesion.updateMany({ where: { usuarioId, activo: true }, data: { activo: false } })` — invalida todas las sesiones activas del usuario.

El usuario desactivado recibe `401` en su siguiente request (JwtStrategy verifica `usuario.activo` desde la BD).

**Regla:** cualquier operación que cambie el estado de acceso de un usuario (desactivación, cambio de rol) debe tener efecto inmediato. No pueden existir ventanas donde el estado anterior persista en el token.

### 2.6 Restablecimiento de contraseña

✅ `POST /auth/restablecer-contrasena` invalida **todas las sesiones y refresh tokens activos del usuario** en una sola transacción Prisma:
```typescript
this.prisma.tokenRefresh.updateMany({ where: { usuarioId, activo: true }, data: { activo: false } }),
this.prisma.sesion.updateMany({ where: { usuarioId, activo: true }, data: { activo: false } }),
```

### 2.7 Refresh token — rotación

✅ Cada uso del refresh token invalida el anterior y genera un nuevo par (access JWT + refresh token). El nuevo par mantiene el mismo `sesionId` — la sesión continúa, solo rotan los tokens.

Reutilización de un refresh token ya invalidado → `401` inmediato.

🔴 **Riesgo residual documentado:** el refresh token usa `bcrypt.hash()` para generar el valor opaco. Bcrypt es una función de hash de contraseñas, no un generador de tokens — agrega latencia de cómputo innecesaria. El input contiene `crypto.randomBytes(16)` (128 bits de entropía real), lo que garantiza la seguridad. Sin embargo, reemplazar por `crypto.randomBytes(32).toString('hex')` almacenado directamente sería más apropiado semánticamente y más eficiente.

---

## 3. Autorización — Arquitectura General

### 3.1 Guards y su registro

✅ Tres guards activos en el sistema:

| Guard | Registro | Cobertura |
|-------|----------|-----------|
| `ThrottlerGuard` | `APP_GUARD` (global) | Todos los endpoints |
| `JwtAuthGuard` | `@UseGuards()` por controller | Solo endpoints declarados |
| `RolesGuard` | `@UseGuards()` junto con JwtAuthGuard | Solo endpoints con `@Roles()` |

**Atención — no existe "default deny" global:** los endpoints sin `@UseGuards(JwtAuthGuard)` no requieren JWT. Su clasificación completa:

| Endpoint | Sin JwtAuthGuard | Sujeto a CsrfMiddleware | Protección efectiva |
|----------|-----------------|------------------------|---------------------|
| `POST /auth/login` | ✓ | ✗ (excluido explícito) | Rate limit 5/min |
| `POST /auth/refresh` | ✓ | ✅ sí | CSRF + Opera via cookie `refresh_token` + Rate limit 20/min |
| `POST /auth/logout` | ✓ | ✅ sí | CSRF + Opera via cookie `refresh_token` + Rate limit global |
| `POST /auth/solicitar-recuperacion` | ✓ | ✗ (excluido explícito) | Rate limit 3/15min |
| `POST /auth/restablecer-contrasena` | ✓ | ✗ (excluido explícito) | Token en body + Rate limit 5/15min |
| `GET /` (health) | ✓ | ✗ (GET) | — |
| `GET /health` | ✓ | ✗ (GET) | — |

`POST /auth/refresh` y `POST /auth/logout` **no son endpoints públicos sin restricciones**: el CsrfMiddleware exige `Origin` válido y `X-Requested-With: XMLHttpRequest`. Ambos operan sobre la sesión identificada por la cookie `refresh_token`, no mediante un JWT de portador. Su ausencia de `JwtAuthGuard` es intencional — el refresh y el logout deben funcionar aunque el access token haya expirado.

**Regla:** cualquier nuevo endpoint que no declare `@UseGuards(JwtAuthGuard, RolesGuard)` debe tener justificación explícita. La ausencia de JWT guard no significa ausencia de control — detallar en la MATRIZ-AUTORIZACION qué protección alternativa aplica.

### 3.2 Comportamiento del RolesGuard

✅ `RolesGuard` verifica que `req.user.rol.nombre` esté en la lista de roles del decorador `@Roles()`.

```typescript
if (!requiredRoles) return true;  // Sin @Roles() → cualquier autenticado pasa
return requiredRoles.includes(user.rol.nombre);
```

**Regla:** todo endpoint que use `JwtAuthGuard` debe también declarar `@Roles()` explícitamente. Un endpoint con `@UseGuards(JwtAuthGuard, RolesGuard)` pero sin `@Roles()` es accesible por cualquier usuario autenticado.

---

## 4. IDs, Ownership y Protección IDOR/BOLA

### 4.1 Principio de ownership

El ownership es la garantía de que un usuario solo puede acceder o modificar recursos que le pertenecen. **El control de ownership nunca se delega al frontend** — es responsabilidad exclusiva del backend (service layer).

### 4.2 Patrones de ownership implementados

✅ **Ownership por token (no por parámetro URL):** cuando un DOCENTE accede a su propia ficha, el servicio resuelve el ID desde `req.user.id`, nunca desde un parámetro URL controlable por el cliente.

```typescript
// Correcto — resuelve desde el token:
GET /docentes/mi-ficha → service busca por { usuarioId: req.user.id }

// Incorrecto — nunca hacer esto para DOCENTE accediendo a datos propios:
GET /docentes/:id → DOCENTE no tiene acceso a este endpoint
```

✅ **Ownership de VinculacionCatedra:** el servicio verifica que `vinculacion.docenteId === docente.id` antes de retornar o modificar el recurso. Una vinculación ajena devuelve `ForbiddenException` (403), no 404.

✅ **Ownership de notificaciones:** el servicio verifica que `notificacion.docenteId === req.user.docenteId` antes de marcarla como leída.

### 4.3 Manipulación de IDs en URL (IDOR)

✅ **DOCENTE modificando materia/programa:** el check de ownership no solo verifica que el DOCENTE tenga vinculación aprobada, sino también que la vinculación sea **con la materia específica del parámetro URL**. Cambiar el `materiaId` en la URL con el que no tiene vinculación devuelve 403.

```typescript
// Query de ownership — el materiaId viene del parámetro URL:
const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
  where: { docenteId: docente.id, materiaId, estado: 'APROBADA' },
});
// Si el DOCENTE tiene APROBADA con Materia A pero el parámetro es Materia B → null → 403
```

**Regla:** cuando el DOCENTE accede a un recurso identificado por un parámetro URL, el servicio debe verificar que ese parámetro apunta a un recurso que le pertenece. No confiar en que el frontend enviará el ID correcto.

---

## 5. Control de Acceso Basado en Roles (RBAC)

### 5.1 Roles del sistema

| Rol | Descripción | Nivel de acceso |
|-----|-------------|-----------------|
| `DOCENTE` | Docente universitario | Ficha propia, materias vinculadas (con ownership), normativas vigentes |
| `ADMINISTRATIVO` | Personal administrativo | Gestión académica y docentes |
| `DIRECTOR_CARRERA` | Director de carrera | Planes, materias, tablas maestras, normativas, subáreas |
| `SECRETARIA_ACADEMICA` | Secretaría académica | Gestión amplia sin usuarios ni configuración |
| `ADMINISTRADOR_SISTEMA` | Superusuario | Acceso total incluyendo usuarios, roles, parámetros |
| `DECANO` | Decano institucional | Lecturas amplias, normativas, vinculaciones, docentes |
| `RECTORADO` | Rectorado institucional | Lecturas amplias, normativas, vinculaciones, docentes |

### 5.2 Cambio de rol — efecto inmediato

✅ Al cambiar el rol de un usuario en la BD, el nuevo rol tiene efecto **en el siguiente request** del usuario afectado. JwtStrategy lee el rol desde la BD (no del JWT payload) en cada request autenticado.

No hay ventana de tiempo donde el rol anterior persista. El JWT contiene `sesionId` para identificar la sesión, pero el rol siempre se resuelve desde la BD.

### 5.3 Separación de responsabilidades por endpoint

✅ Ejemplo de separación correcta — gestión de materias:

| Operación | Roles autorizados | Ownership |
|-----------|-------------------|-----------|
| Modificar datos de materia (`PATCH /materias/:id`) | ADMIN, SECRETARIA, DIRECTOR_CARRERA, ADMINISTRATIVO, **DOCENTE** | DOCENTE: solo con VinculacionCatedra APROBADA |
| Gestionar correlativas (`POST/DELETE /materias/:id/correlativas`) | ADMIN, SECRETARIA, DIRECTOR_CARRERA, ADMINISTRATIVO | DOCENTE: **excluido** (arquitectura curricular) |

**Regla:** la granularidad del RBAC debe coincidir con la granularidad del riesgo. Separar en endpoints distintos las operaciones que tienen diferente nivel de sensibilidad o que aplican a distintos conjuntos de roles.

---

## 6. Regla DOCENTE — Ownership por VinculacionCatedra

### 6.1 Política definitiva

✅ Un DOCENTE solo puede modificar una materia o su programa de asignatura si tiene una `VinculacionCatedra` con `estado = 'APROBADA'` para esa materia específica.

**Estados de VinculacionCatedra y su efecto:**

| Estado | Significado | ¿Otorga acceso? |
|--------|-------------|-----------------|
| `PENDIENTE_DE_APROBACION` | Solicitud enviada, sin resolución | ❌ NO → 403 |
| `APROBADA` | Vinculación efectivamente activa | ✅ SÍ |
| `RECHAZADA` | Vinculación denegada | ❌ NO → 403 |
| `DESVINCULADA` | Vinculación finalizada (baja) | ❌ NO → 403 |

### 6.2 Query de ownership

```typescript
// La única query válida para verificar ownership DOCENTE:
const vinculacion = await this.prisma.vinculacionCatedra.findFirst({
  where: {
    docenteId: docente.id,
    materiaId,             // ← del parámetro URL, no del body
    estado: 'APROBADA',   // ← string exacto, nunca { in: [...] }
  },
});
if (!vinculacion) throw new ForbiddenException('Sin acceso: no tenés una vinculación aprobada con esta asignatura');
```

**Regla:** nunca usar `estado: { in: ['PENDIENTE_DE_APROBACION', 'APROBADA'] }` ni ninguna variante que incluya estados distintos de `'APROBADA'`. Una vinculación pendiente no es una vinculación activa.

### 6.3 Verificación de perfil docente

```typescript
// Primero verificar que el usuario tiene perfil docente:
const docente = await this.prisma.docente.findUnique({ where: { usuarioId } });
if (!docente) throw new ForbiddenException('Sin acceso: sin perfil docente asociado');
// Luego verificar la vinculación:
const vinculacion = await this.prisma.vinculacionCatedra.findFirst({ ... });
```

Un usuario con rol DOCENTE sin perfil docente (sin registro en tabla `Docente`) recibe 403.

### 6.4 Alcance del ownership DOCENTE

El ownership aplica a:
- ✅ `PATCH /materias/:id` — modificar datos de la materia
- ✅ `PATCH /programas/materia/:materiaId` — modificar el programa de asignatura (C10: DOCENTE requiere VinculacionCatedra APROBADA para esa asignatura)

No aplica a:
- Lectura (`GET`) de materias o programas — sin restricción por rol
- Correlativas — DOCENTE excluido de estos endpoints completamente
- Aprobación de programas — rol excluido del endpoint

---

## 7. DIRECTOR_CARRERA — Decisión Institucional Pendiente

### 7.1 Estado actual

✅ **DIRECTOR_CARRERA puede ver y gestionar vinculaciones de cátedra** (`/vinculaciones-catedra`). El rol está incluido en `ROLES_LEER` y `ROLES_CREAR` del controlador de vinculaciones.

**Acciones habilitadas:** leer listado, leer detalle, crear solicitudes, desvincular.

**Acciones NO habilitadas:** aprobar, rechazar (reservado a ADMINISTRADOR_SISTEMA y DOCENTE para las propias).

### 7.2 Limitación de scope por carrera

DIRECTOR_CARRERA ve **todas las vinculaciones** del sistema, sin filtro por carrera. Esto se debe a que:

- El modelo `Usuario` no tiene campo `carreraId`.
- No existe un modelo `DirectorCarrera` en el schema de Prisma.
- Sin esa relación explícita, es imposible implementar el filtro de forma confiable.

Esta limitación fue aceptada institucionalmente (C7). DIRECTOR_CARRERA tiene el mismo scope que DECANO/RECTORADO en este módulo.

### 7.3 Mejora futura pendiente

El filtro por carrera requiere:
1. Decisión de modelo de datos: ¿`carreraId` en `Usuario`? ¿modelo `DirectorCarrera`?
2. Migración de base de datos.
3. Modificación del servicio de vinculaciones.
4. Tests de ownership de DIRECTOR_CARRERA.

Documentado originalmente en S4 como C6/DIP-3. Implementación parcial en C7.

---

## 8. DTOs y Validación de Input

### 8.1 ValidationPipe global

✅ `ValidationPipe` configurado globalmente en `main.ts`:

```typescript
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
}));
```

- `whitelist: true` + `forbidNonWhitelisted: true` (configuración conjunta): los campos no declarados en el DTO son rechazados con `HTTP 400` inmediatamente. No se ignoran silenciosamente.
- `transform: true`: los tipos de los campos se convierten según los decoradores del DTO.

✅ El pipe global cubre todos los controllers, incluyendo `AuthController` y `UsuariosController` (que antes no tenían pipe).

**Sobre pipes locales:** `AreasDisiplinaresController` tiene `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` a nivel de clase. Ese pipe local no debe tomarse como modelo a replicar en nuevos controllers — la configuración global ya los cubre. Los pipes locales no se agregan por defecto. Solo deben usarse para necesidades específicas, preferentemente más restrictivas que la configuración global. Si fuera necesario relajar alguna protección global (ej: deshabilitar `forbidNonWhitelisted` o `whitelist`), detener la implementación y realizar una revisión explícita de seguridad antes del cambio.

### 8.2 Campos sensibles en DTOs

✅ Los DTOs no exponen campos de auditoría, estados internos ni campos de propiedad:

| DTO | Protección |
|-----|-----------|
| `CrearUsuarioDto` / `ActualizarUsuarioDto` | `rolId` presente pero el endpoint solo es accesible por `ADMINISTRADOR_SISTEMA` |
| `CrearVinculacionDto` | `usuarioSolicitanteId` tomado de `req.user.id`, no del body |
| `ActualizarDocenteDto` | `usuarioId` no está en el DTO |
| `CrearNormativaDto` | `eliminado`, `eliminadoPorUsuarioId` no están en el DTO |
| `EliminarNormativaDto` | `eliminadoPorUsuarioId` tomado de `req.user.id`, no del body |

### 8.3 Reglas para nuevos DTOs

**Regla:** todo campo que pueda cambiar el estado de autorización de un recurso (ownership, estado de aprobación, eliminado, activo) debe estar fuera del DTO o protegido por un endpoint exclusivo de roles elevados.

**Regla:** los campos de auditoría (`creadoPorUsuarioId`, `eliminadoPorUsuarioId`, `fechaCreacion`, etc.) nunca deben ser campos del DTO. Se resuelven desde `req.user.id` o desde la BD en el servicio.

**Regla:** `@IsUUID()` para todos los campos que sean foreign keys o IDs de entidades.

---

## 9. Base de Datos y Prisma

### 9.1 Queries de autorización

✅ Las queries de verificación de ownership usan filtros exactos, no aproximados:

```typescript
// Correcto:
vinculacionCatedra.findFirst({ where: { docenteId, materiaId, estado: 'APROBADA' } })

// Incorrecto — no usar:
vinculacionCatedra.findFirst({ where: { docenteId, materiaId, estado: { in: ['APROBADA', 'PENDIENTE_DE_APROBACION'] } } })
```

### 9.2 Errores de Prisma

✅ El filtro global de excepciones (`HttpExceptionFilter`) intercepta errores no manejados antes de que lleguen al cliente. En producción, los errores Prisma (constraint violations, unique violations) retornan solo `"Error interno del servidor"` con código 500. El mensaje interno de Prisma no se expone.

**Regla:** los servicios no deben retornar mensajes de error de Prisma directamente. Lanzar `NotFoundException`, `ConflictException` u otras `HttpException` con mensajes apropiados para el cliente.

### 9.3 Relaciones y jerarquía

Las operaciones de vinculaciones validan en el servicio la existencia de facultad, carrera, plan, materia, docente, catedra, cargo, modalidad y designación.

🔴 **Riesgo residual / pendiente de validación:** no se verifica que `planId` pertenezca a `carreraId` ni que `materiaId` pertenezca a `planId`. Es posible crear vinculaciones con combinaciones de IDs jerárquicamente inconsistentes (ej: una materia de una carrera vinculada a un plan de otra). El hecho de que estas operaciones estén restringidas a roles institucionales (SECRETARIA_ACADEMICA o superiores) reduce la probabilidad de abuso, pero no elimina el riesgo de inconsistencias accidentales. Pendiente de evaluación en sprint dedicado a integridad de datos.

### 9.4 Cambios de schema

**Regla:** cualquier cambio al schema de Prisma que afecte tablas de seguridad (`Sesion`, `TokenRefresh`, `VinculacionCatedra`, `Usuario`, `Rol`) requiere revisión de impacto en los controles de esta lista. La relación `TokenRefresh → Sesion` (campo `sesionId`) es parte del mecanismo de revocación de tokens y no debe eliminarse.

---

## 10. Protección CSRF

### 10.1 Estrategia de defensa en profundidad

✅ Cuatro capas de protección CSRF, aplicadas en conjunto:

| Capa | Mecanismo | Implementación |
|------|-----------|---------------|
| 1 | `SameSite=Lax` en cookies | Auth token y refresh token |
| 2 | CORS con origen explícito | `enableCors({ origin: frontendUrl })` |
| 3 | Validación de cabecera `Origin` | `CsrfMiddleware` |
| 4 | Cabecera personalizada `X-Requested-With` | `CsrfMiddleware` + `apiFetch` |

### 10.2 CsrfMiddleware

✅ El middleware aplica a todos los métodos mutantes (`POST`, `PUT`, `PATCH`, `DELETE`):

```
Sin cabecera Origin              → 403 "Origin requerido"
Origin ≠ FRONTEND_URL           → 403 "Origin no permitido"
Sin X-Requested-With: XMLHttpRequest → 403 "Header de seguridad requerido"
```

✅ Endpoints excluidos del check CSRF (no dependen de cookie de sesión para autorizar):
- `POST /auth/login`
- `POST /auth/solicitar-recuperacion`
- `POST /auth/restablecer-contrasena`

### 10.3 Frontend — cumplimiento automático

✅ `apiFetch` (wrapper centralizado de fetch) envía automáticamente `X-Requested-With: XMLHttpRequest` en todos los métodos mutantes. La cabecera no se envía en `GET`/`HEAD`/`OPTIONS` para evitar preflights CORS innecesarios.

✅ `tentarRenovar()` (auto-refresh en 401) incluye la cabecera `X-Requested-With` para que `POST /auth/refresh` pase el `CsrfMiddleware`.

**Regla:** toda llamada a la API del backend debe pasar por `apiFetch`. No usar `fetch` directamente sin incluir las cabeceras de seguridad.

⏳ **Mejora futura documentada en S2:** evaluar CSRF token con doble submit o header `X-CSRF-Token` para protección adicional en escenarios donde `SameSite=Lax` no sea suficiente.

---

## 11. CORS

### 11.1 Configuración actual

✅ CORS configurado en `backend/src/main.ts`:

```typescript
app.enableCors({
  origin: frontendUrl,           // desde FRONTEND_URL env var — nunca wildcard (*)
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With'],
  exposedHeaders: ['Content-Disposition'],  // para descargas Excel/PDF
  maxAge: 86_400,                // preflight cacheado 24h
});
```

**Regla:** `origin` nunca puede ser `'*'` ni `(origin, callback) => callback(null, true)`. El origen debe ser siempre el valor de `FRONTEND_URL`.

**Regla:** `allowedHeaders` no incluye `Authorization` — los tokens viajan en cookies HttpOnly, no en headers. Si se agrega un header al frontend, debe incluirse en esta lista.

### 11.2 Frontend — cookies en cada request

✅ `apiFetch` incluye `credentials: 'include'` en todas las peticiones. Esto envía las cookies HttpOnly al backend en cada request cross-origin.

**Regla:** no agregar `Authorization: Bearer <token>` en ningún request. Los tokens están en cookies y el backend los lee automáticamente.

---

## 12. Rate Limiting

### 12.1 Configuración global

✅ `ThrottlerGuard` registrado como `APP_GUARD` (aplica a todos los endpoints):

```typescript
ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 100 }])
```

Límite general: **100 requests/IP/minuto**.

### 12.2 Límites específicos por endpoint

✅ Endpoints de autenticación con límites más estrictos:

| Endpoint | Límite | Ventana | Propósito |
|----------|--------|---------|-----------|
| `POST /auth/login` | 5 req | 1 min | Brute force de credenciales |
| `POST /auth/refresh` | 20 req | 1 min | Múltiples pestañas sin abrir abuso |
| `POST /auth/solicitar-recuperacion` | 3 req | 15 min | Prevenir spam de emails |
| `POST /auth/restablecer-contrasena` | 5 req | 15 min | Limitar spray de tokens |
| Todos los demás | 100 req | 1 min | Límite general |

### 12.3 Trust Proxy — requisito para producción

⏳ **Pendiente para producción:** en producción detrás de un reverse proxy (nginx, load balancer), activar Trust Proxy para que `req.ip` refleje la IP real del cliente:

```typescript
// main.ts — SOLO en producción con proxy confiable:
app.getHttpAdapter().getInstance().set('trust proxy', 1);
```

Sin Trust Proxy, el rate limiting opera sobre la IP del proxy (todos los usuarios comparten el mismo bucket). Esto NO está activado en desarrollo.

**Advertencia:** activar `trust proxy` sin un proxy confiable permite falsificar la IP via `X-Forwarded-For`, eludiendo el rate limiting.

**Regla:** los nuevos endpoints de autenticación o acciones sensibles (cambio de contraseña, descarga masiva, etc.) deben tener un `@Throttle()` específico. No depender solo del límite global.

---

## 13. Hardening HTTP — Cabeceras de Seguridad

### 13.1 Backend — Helmet

✅ Helmet 7.x configurado en `main.ts`:

```typescript
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  hsts: isProd ? { maxAge: 63_072_000, includeSubDomains: true } : false,
}));
```

Cabeceras aplicadas:

| Cabecera | Valor | Propósito |
|----------|-------|-----------|
| `X-Content-Type-Options` | `nosniff` | Previene MIME sniffing |
| `X-Frame-Options` | `SAMEORIGIN` | Previene clickjacking |
| `X-XSS-Protection` | `0` | Desactiva filtro XSS obsoleto |
| `Referrer-Policy` | `no-referrer` | No envía referrer en navegaciones |
| `X-DNS-Prefetch-Control` | `off` | Deshabilita prefetch DNS |
| `X-Download-Options` | `noopen` | Previene apertura directa en IE |
| `X-Permitted-Cross-Domain-Policies` | `none` | Bloquea Adobe Flash cross-domain |
| `X-Powered-By` | *(eliminado)* | No revela que el backend usa Express/NestJS |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains` | HSTS — **solo en producción** |

**Regla HSTS en producción:** `includeSubDomains` exige que todos los subdominios del dominio institucional sirvan HTTPS. Confirmar institucionalmente antes de activar en producción que no hay subdominios HTTP-only activos. No agregar `preload` sin registro previo en la lista de precarga de navegadores.

### 13.2 Frontend — Next.js security headers

✅ Configurados en `frontend/next.config.mjs` para todas las rutas:

| Cabecera | Valor |
|----------|-------|
| `X-Frame-Options` | `DENY` |
| `X-Content-Type-Options` | `nosniff` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(), payment=()` |
| `X-DNS-Prefetch-Control` | `on` |

⏳ **Content-Security-Policy (Next.js):** no implementada. Next.js 14 App Router requiere nonces para CSP estricta (scripts inline de hidratación de React). Implementar requiere nonces en `layout.tsx` y el middleware. Queda pendiente.

### 13.3 Límites de payload

✅ Configurados en `main.ts`:

```typescript
app.use(json({ limit: '1mb' }));
app.use(urlencoded({ extended: true, limit: '1mb' }));
```

El backend se crea con `{ bodyParser: false }` — NestJS no registra su propio parser.

**Excepción:** subidas de archivos usan multer (configurado en `normativas.controller.ts`) con límite de 55 MB en el controlador. El service rechaza archivos sobre 50 MB.

### 13.4 Cache-Control en autenticación

✅ `@Header('Cache-Control', 'no-store, private')` en:
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`

### 13.5 Sanitización de errores

✅ `HttpExceptionFilter` (global) sanitiza errores en producción:

- Errores HTTP conocidos (`HttpException`): expone `statusCode`, `message`, `timestamp`, `path`. Sin stack trace.
- Errores no manejados (`500`): expone solo `"Error interno del servidor"`. Stack trace logueado en servidor, no en respuesta.

---

## 14. Seguridad en Carga y Descarga de Archivos

### 14.1 Subida de archivos (PDF)

✅ Controles implementados para subida en Repositorio de Normativas:

| Control | Implementación |
|---------|---------------|
| Magic bytes check | `esPdf()` verifica `%PDF-` (bytes 0x25 0x50 0x44 0x46) — no se confía en el Content-Type del cliente |
| Nombre de archivo seguro | `randomUUID()` — nunca usa el nombre original del archivo |
| Path traversal prevention | `StorageService.resolverRuta()` verifica que la ruta resuelta comience con `basePath + sep` |
| Tamaño máximo | Multer: 55 MB; Service: 50 MB (el service rechaza antes de escribir a disco) |
| Tipo MIME | No se usa el MIME del cliente; solo magic bytes determinan el tipo válido |

**Regla:** cualquier nuevo endpoint de subida de archivos debe incluir verificación de magic bytes, nombre aleatorio (nunca el original) y path traversal prevention.

### 14.2 Descarga de archivos

✅ Endpoint `GET /normativas/:id/archivo`:
- `Cache-Control: private, no-store` — no cacheado en proxies ni navegador.
- `X-Content-Type-Options: nosniff` — el navegador no infiere el tipo.
- Verificación de autorización (JwtAuthGuard + RolesGuard) antes de servir.
- Path traversal prevention vía `StorageService.resolverRuta()`.
- Los archivos de normativas eliminadas retornan 404, no el archivo.

---

## 15. Secretos en el Código

### 15.1 Reglas absolutas

**Regla:** ningún secreto, contraseña, clave de API, token o credential hardcodeada en el código fuente. Sin excepciones.

**Regla:** ningún valor de fallback inseguro. `|| 'valor_default'` para secretos está prohibido. Usar `getOrThrow()`.

**Regla:** `.env` nunca en el repositorio. `.env.example` con placeholders, no con valores reales.

**Regla:** el log del servidor nunca imprime valores de secretos, contraseñas, tokens ni cookies. En la validación de entorno, los mensajes de error describen el problema sin revelar el valor.

### 15.2 Generación de secretos seguros

Para JWT_SECRET (mínimo 32 chars, recomendado 64 bytes):
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

Para tokens de un solo uso (ej: recuperación de contraseña): `crypto.randomBytes(32)`.

---

## 16. Auditoría

### 16.1 Cobertura actual

✅ Módulos con auditoría implementada:

| Módulo | Tabla de auditoría | Acciones registradas |
|--------|-------------------|----------------------|
| Normativas | `AuditLogNormativa` | CARGA, EDICION, CAMBIO_ESTADO, BAJA_LOGICA, DESCARGA, EXPORTACION, ACCESO_DENEGADO |
| Materias | `HistorialMateria` | CREACION, ACTUALIZACION, BAJA |
| Programas | `HistorialPrograma` | ACTUALIZACION, REVERSION, APROBACION, CORRECCIONES_SOLICITADAS |
| Sesiones | `Sesion` | Login (creación de sesión), Logout (desactivación), desactivación por password reset |

### 16.2 Acciones sin auditoría

🔴 **Riesgo residual documentado:** las siguientes acciones críticas no tienen registro de auditoría:

| Acción | Módulo | Datos mínimos a registrar |
|--------|--------|---------------------------|
| Cambio de rol de usuario | Usuarios | `usuarioId` afectado, `rolAnterior`, `rolNuevo`, `adminId`, timestamp |
| Activación/desactivación de usuario | Usuarios | `usuarioId`, estado anterior/nuevo, `adminId`, timestamp |
| Creación de usuario | Usuarios | nuevo `usuarioId`, `rol`, `adminId`, timestamp |
| Cambios de roles del sistema | Roles | `rolId`, descripción del cambio, `adminId` |
| Creación/modificación de vinculaciones | Vinculaciones | `vinculacionId`, `docenteId`, `materiaId`, `estado`, `adminId` |

⏳ **Trabajo futuro:** implementar auditoría en el módulo de Usuarios al menos para cambios de rol y activación/desactivación. Estas son las acciones de mayor impacto en el sistema de acceso.

### 16.3 Reglas para nuevos módulos con datos sensibles

**Regla:** todo módulo que gestione datos de acceso (usuarios, roles, vinculaciones), datos institucionales críticos (planes de estudio aprobados) o documentos legales (normativas) debe implementar un registro de auditoría con al menos: acción, usuarioId que ejecuta, timestamp, recurso afectado.

---

## 17. Frontend — Reglas de Seguridad

### 17.1 Comunicación con el backend

✅ **Usar siempre `apiFetch`** (`frontend/lib/api.ts`) para toda comunicación con el backend:
- Incluye automáticamente `credentials: 'include'` (cookies HttpOnly).
- Incluye `X-Requested-With: XMLHttpRequest` en métodos mutantes.
- Maneja auto-refresh en 401 con protección de concurrencia (singleton).
- Emite evento `auth:sesion-expirada` cuando el refresh falla.

**Regla:** no usar `fetch` directamente. No usar `axios` sin el wrapper de seguridad. No leer tokens de `localStorage` o `sessionStorage`.

### 17.2 Middleware de navegación Next.js

✅ `frontend/middleware.ts` implementa guardia de navegación (UX, no seguridad):
- Redirige a `/login` si no existe cookie `auth_token`.
- Rutas públicas: `/login`, `/solicitar-recuperacion`, `/restablecer-contrasena`.

**Nota de seguridad:** el middleware de Next.js es una guardia UX, no un control de seguridad. El backend valida el token en cada request independientemente de lo que muestre el frontend.

### 17.3 Visibilidad de módulos por rol

El frontend controla la visibilidad de módulos según el rol almacenado en la sesión. Esto es UX, no seguridad. El backend rechaza operaciones no autorizadas independientemente de lo que el frontend muestre o no.

**Regla:** nunca confiar en que "el frontend no muestra el botón". El backend debe rechazar la operación independientemente.

### 17.4 Errores y datos sensibles en el frontend

**Regla:** el frontend no debe mostrar mensajes de error técnicos del backend (mensajes de Prisma, stack traces, nombres de tablas o campos). Mostrar mensajes amigables; loguear el detalle en consola en desarrollo.

---

## 18. Reglas para Nuevos Módulos

### 18.1 Checklist de seguridad al crear un nuevo módulo backend

Todo nuevo módulo (controller + service) debe verificar:

1. **Autenticación:** todos los endpoints no públicos tienen `@UseGuards(JwtAuthGuard, RolesGuard)`.
2. **Roles:** todos los endpoints tienen `@Roles(...)` declarado explícitamente.
3. **Roles definidos:** los nuevos roles permitidos están reflejados en la MATRIZ-AUTORIZACION.
4. **DTOs:** el DTO no incluye campos de auditoría, estados internos ni campos de ownership.
5. **ValidationPipe:** el controller tiene `@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))` si necesita configuración específica.
6. **Ownership:** si el módulo gestiona recursos per-usuario, el servicio implementa verificación de ownership desde `req.user.id`.
7. **Rate limiting:** si el endpoint es de acceso crítico (autenticación, envío de emails, operaciones costosas), tiene `@Throttle()` específico.
8. **Auditoría:** si el módulo gestiona datos sensibles o acceso, tiene un registro de auditoría.
9. **Errores:** el servicio lanza `HttpException` con mensajes apropiados, no mensajes internos de Prisma.

### 18.2 Checklist de seguridad para nuevos endpoints frontend

1. Toda llamada HTTP usa `apiFetch`.
2. No se almacena información de sesión en `localStorage`/`sessionStorage`.
3. Los formularios con datos sensibles no los persisten en el estado del componente más allá de lo necesario.
4. Las rutas protegidas están cubiertas por el middleware de navegación Next.js.

---

## 19. Pruebas de Seguridad

### 19.1 Suites implementadas

✅ 296/296 tests unitarios de seguridad pasando (S1–S4 + Circuito de Aprobación + C10 + C11 + C12 + C13 + C14 + C15 + C16 + C16.2 + C16.3) + 1 test de integración contra PostgreSQL real (`programas-c162-concurrencia.spec.ts`):

| Suite | Tests | Cobertura |
|-------|-------|-----------|
| `jwt-strategy.spec.ts` | 6 | Sin sesionId → payload tal cual; sesión inexistente → 401; sesión inactiva → 401; usuario.activo=false → 401; rol cambiado en BD → nuevo rol; rol sin cambio → pasa |
| `materias-ownership.spec.ts` | 9 | Sin perfil docente → 403; sin vinculación → 403; PENDIENTE → 403; RECHAZADA → 403; DESVINCULADA → 403; APROBADA → OK; IDOR Materia B → 403; ADMINISTRADOR sin check → OK; SECRETARIA sin check → OK |
| `programas-ownership.spec.ts` | 12 | SECRETARIA sin checks → OK; DIRECTOR_CARRERA en/fuera scope → OK/403; DOCENTE con vinculación APROBADA → OK; DOCENTE sin perfil → 403; DOCENTE sin vinculación → 403; DOCENTE IDOR asignatura ajena → 403 |
| `programas-scope.spec.ts` | 26 | SECRETARIA/RECTORADO scope global; DIRECTOR_CARRERA en/fuera scope; DECANO en/fuera scope; APROBADO histórico conservado; estadoPrograma calculado; historial atómico; validación horasClase; ADMINISTRADOR_SISTEMA scope global |
| `programas-aprobacion.spec.ts` | 28 | Solicitud al 100%; sin duplicados; invalidación por avance; visibilidad por scope (4 roles); aprobación por 4 roles; fuera de scope → 403; ADMIN excluido de ROLES_APROBAR; race condition → ConflictException; correcciones con observaciones; ciclo completo; cambio sustancial; cambio admin. sin re-aprobación; historial preservado; BadRequest si programa < 100% al aprobar |
| `programas-conversacion.spec.ts` | 16 | solicitarCorrecciones crea mensaje CORRECCION; DOCENTE con vinculación lee mensajes; DOCENTE sin vinculación → 403; 4 docentes → 4 notificaciones sin duplicados; DOCENTE envía RESPUESTA; directivo con scope lee; leido=false por defecto; marcarLeidos + limpieza notif; DOCENTE no en ROLES_APROBAR; directivo fuera scope → 403; orden cronológico; respuesta sin solicitud activa → ConflictException; sin perfil docente → 403; contadoresNovedades tipos correctos |
| `programas-estados.spec.ts` | 25 | calcEstadoFuncional 9 casos (pura, C13: 4 estados); obtenerPrograma incluye estadoFuncional; actualizarPrograma retorna estadoFuncional; historial: SECRETARIA/RECTORADO sin validar scope; DC/DECANO con/sin scope → OK/403; DOCENTE con/sin vinculación → OK/403; datos completos con mensajes anidados; materia sin programa → vacío |
| `programas-c13.spec.ts` | 24 | calcEstadoFuncional 4 estados (COMPLETO eliminado); solicitud auto al 100%; sin duplicados con PENDIENTE activa; CORRECCIONES activas → sin nueva solicitud; cambio sustancial invalida CORRECCIONES; notificaciones a SA/REC/DC/DECANO con scope correcto; scope errado → sin notificación; inactivos excluidos; deduplicación por usuarioId; DOCENTE reenvía → PENDIENTE_APROBACION; reenvío < 100% → BadRequest; regularización identifica/excluye correctamente |
| `programas-c14.spec.ts` | 28 | Fix ERROR 1: estadoFuncional EN_CORRECCION (no APROBADO) tras solicitarCorrecciones; reset estadoPrograma a EN_REVISION; contenido notificación con observaciones/solicitudId/directivo; sin duplicado de notificación; reenvío rechaza contenido vacío/espacios; reenvío rechaza programa<100%; reenvío rechaza PENDIENTE→ConflictException; sin vinculación→403; ciclo reactiva a PENDIENTE_APROBACION; historial en respuesta; notificarDirectivos al reenviar; segundo ciclo soportado; obtenerCorrecionesDocente filtra APROBADA; sin perfil→403; directivo envía en PENDIENTE y CORRECCIONES; contenido vacío directivo→BadRequest; marcarMensajesLeidos CORRECCION para DOCENTE |
| `programas-c15.spec.ts` | 14 | Notificación APROBACION_PROGRAMA al docente tras aprobación; docenteId correcto; cuerpo con materia/carrera/plan/directivo/fechaAprobacion; materiaId para enlace VER PROGRAMA; nombre del aprobador; múltiples docentes → múltiples notificaciones; sin vinculación → sin notificación; deduplicación; aprobación fallida → sin notificación; solicitudProgramaId ligado; tipo APROBACION_PROGRAMA; historial conservado; ForbiddenException notificación ajena |
| `programas-c16.spec.ts` | 12 | `calcEstadoFuncional` 12 casos: 17% → INCOMPLETO; 100% sin solicitud → EN_REVISION (fix clave); 100% PENDIENTE_APROBACION → EN_REVISION; CORRECCIONES activas → EN_CORRECCION; APROBADO → APROBADO; todasCompletas=true nunca devuelve INCOMPLETO; programa histórico pre-circuito → EN_REVISION; listarProgramasParaRegularizacion solo lectura (sin create/update) |
| `programas-c162.spec.ts` | 12 | `generarSolicitudesRegularizacion`: programa completo → GENERADA; incompleto → OMITIDO; aprobado → OMITIDO; correcciones activas → OMITIDO; pendiente existente → OMITIDO con solicitudId; idempotencia (segunda ejecución → OMITIDO); concurrencia (race condition in-tx → OMITIDO sin duplicar); notificaciones a directivos; historial REGULARIZACION_HISTORICA; RBAC endpoint; NotFoundException programa inexistente; fallo transaccional — **$queryRaw mock actualizado en C16.3** |
| `programas-c162-concurrencia.spec.ts` | 1 (integración) | **Test de integración real contra PostgreSQL (C16.3):** `Promise.all` con dos solicitudes concurrentes → exactamente una GENERADA + una OMITIDO; BD: 1 solicitud PENDIENTE_APROBACION; 1 historial REGULARIZACION_HISTORICA. Requiere conexión activa a PostgreSQL. Fixtures con prefijo `[TEST-C162]`; limpieza completa en `afterAll` |
| `scope.spec.ts` | 22 | Scopes por rol; limpieza de scopes residuales; scope global vs. restringido |
| `vinculaciones-situacion-actual.spec.ts` | 14 | Situación actual de vinculaciones |
| `usuarios-scope.spec.ts` | 12 | Scopes en gestión de usuarios |
| `docentes-baja-logica.spec.ts` | varies | Baja lógica de docentes |
| `csrf.middleware.spec.ts` | 21 | GET/HEAD/OPTIONS → pasan; CSRF_SKIP_PATHS → pasan; Origin ausente → 403; Origin incorrecto → 403; sin X-Requested-With → 403; credenciales completas → pasan; refresh/logout sin Origin → 403; refresh/logout legítimos → pasan |
| `throttle.spec.ts` | 8 | Límites específicos de login, refresh, recovery, reset |

### 19.2 Regla de mocks para ownership

✅ Los mocks de Prisma en tests de ownership deben simular el comportamiento real del filtro `estado: 'APROBADA'`:

```typescript
// Patrón correcto — tieneVinculacionAprobada:boolean simula el filtro Prisma:
const makePrisma = (tieneVinculacionAprobada: boolean) => ({
  vinculacionCatedra: {
    findFirst: jest.fn().mockResolvedValue(
      tieneVinculacionAprobada
        ? { id: 'vc-id', docenteId: DOCENTE_ID, materiaId: MATERIA_A_ID, estado: 'APROBADA' }
        : null,   // ← null porque Prisma no encuentra nada con ese filtro
    ),
  },
});
// PENDIENTE/RECHAZADA/DESVINCULADA → makePrisma(false) → findFirst retorna null → 403
// APROBADA → makePrisma(true) → findFirst retorna objeto → OK
```

**Regla:** nunca mockear `findFirst` retornando un objeto con `estado: 'PENDIENTE_DE_APROBACION'`. El mock debe simular lo que Prisma retornaría **con el filtro `estado: 'APROBADA'` aplicado**, no el estado de los datos subyacentes.

### 19.3 Escenarios mínimos de test para nuevos controles de ownership

| Escenario | Resultado esperado |
|-----------|-------------------|
| Sin perfil del rol (ej: sin registro `Docente`) | 403 ForbiddenException |
| Sin vinculación con el recurso | 403 ForbiddenException |
| Con vinculación en estado no APROBADA | 403 ForbiddenException |
| Con vinculación APROBADA, recurso propio | 200 / éxito |
| Con vinculación APROBADA, IDOR a recurso ajeno | 403 ForbiddenException |
| Cada rol con los controles que le define MATRIZ-AUTORIZACION | Resultado según la política del recurso |

**Nota:** los roles institucionales actuales (ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, etc.) no tienen chequeo de ownership en los módulos existentes, pero eso no es una regla general — es la política actual de cada recurso documentada en MATRIZ-AUTORIZACION. Un rol institucional puede tener scope restringido (ejemplo futuro: DIRECTOR_CARRERA con filtro por carreraId). Consultar MATRIZ-AUTORIZACION para la política de cada endpoint antes de escribir o auditar tests.

### 19.4 Scopes institucionales (FASE 1 — implementado)

✅ **`scope.spec.ts`** — 22 tests cubren:

| Test | Rol | Resultado |
|------|-----|-----------|
| 1 | DIRECTOR_CARRERA + Carrera A | scope permitido |
| 2 | DIRECTOR_CARRERA + Carrera B (no asociada) | scope rechazado |
| 3 | DIRECTOR_CARRERA sin asociación | sin scope (array vacío) |
| 4 | DECANO + Carrera de su Facultad | scope permitido |
| 5 | DECANO + Carrera de otra Facultad | scope rechazado |
| 6 | DECANO sin asociación | sin scope (array vacío) |
| 7–8 | SECRETARIA_ACADEMICA, RECTORADO | scope global (null — sin restricción) |
| 9–10 | ADMINISTRADOR_SISTEMA, ADMINISTRATIVO | scope global |
| 11 | ADMINISTRATIVO — scope global ≠ permiso de edición | documentado en test |
| 12 | DOCENTE con UsuarioCarrera accidental | no obtiene scope de DIRECTOR_CARRERA |
| 13 | Ex-DIRECTOR con rol DOCENTE (asociación residual) | no obtiene scope |
| 14 | Ex-DECANO con rol DOCENTE (asociación residual) | no obtiene scope |

**Regla de scopes:**
```
SCOPE   = qué Carreras puede gestionar el rol
PERMISO = qué operación puede ejecutar sobre esas Carreras (RBAC del controlador)
Ambos deben cumplirse: PERMISO RBAC + SCOPE INSTITUCIONAL
```

**Implementación centralizada:** `ScopeService.tieneScopeCarrera(usuarioId, rolNombre, carreraId)` — no distribuir esta lógica en controllers.

**Limpieza de scopes residuales:** `UsuariosService.limpiarScopesResiduales()` se invoca al cambiar el rol en `actualizarUsuario`. Si el nuevo rol no es DIRECTOR_CARRERA, se eliminan sus UsuarioCarrera. Si no es DECANO, se eliminan sus UsuarioFacultad. El `ScopeService` también verifica ROL + ASOCIACIÓN como defensa en profundidad.

---

## 20. Checklist de Revisión de Seguridad por PR

Usar antes de hacer merge de cualquier cambio que toque autenticación, autorización, validación de input o manejo de archivos.

### Autenticación / sesiones
- [ ] ¿Los tokens siguen viviendo solo en cookies HttpOnly? (no en `localStorage`)
- [ ] ¿`apiFetch` sigue siendo el único punto de comunicación con el backend en el frontend?
- [ ] ¿Se revoca la sesión (y no solo el token) al hacer logout o cambiar contraseña?

### Autorización / roles
- [ ] ¿El nuevo endpoint tiene `@UseGuards(JwtAuthGuard, RolesGuard)` y `@Roles(...)`?
- [ ] ¿El nuevo endpoint está en la MATRIZ-AUTORIZACION con roles y ownership documentados?
- [ ] ¿Se extrae el `usuarioId` de `req.user.id` (no del body ni de URL params)?

### Ownership
- [ ] ¿La query de ownership usa `estado: 'APROBADA'` (string exacto) para VinculacionCatedra?
- [ ] ¿El parámetro URL del recurso se verifica contra el ownership del usuario autenticado?
- [ ] ¿Se aplican los controles de ownership y/o scope definidos para cada rol y recurso en MATRIZ-AUTORIZACION?

### DTOs y validación
- [ ] ¿El DTO no incluye campos de auditoría, ownership ni estado interno?
- [ ] ¿Los campos de foreign keys usan `@IsUUID()`?
- [ ] ¿El DTO no tiene campos que puedan elevar privilegios si son manipulados?

### Archivos (si aplica)
- [ ] ¿Se verifica el tipo por magic bytes (no por MIME del cliente)?
- [ ] ¿El nombre del archivo almacenado es un UUID aleatorio?
- [ ] ¿Se verifica path traversal en la ruta de almacenamiento?

### Secretos
- [ ] ¿No hay secretos hardcodeados ni valores de fallback inseguros en el código nuevo?
- [ ] ¿Las nuevas variables de entorno están validadas en `env.validation.ts` y documentadas en `.env.example`?

---

## 21. Validación de Seguridad por Fase

### Criterios mínimos de aceptación para cualquier fase de seguridad

Antes de considerar implementada una corrección de seguridad:

1. **Build:** `npm run build` en backend → 0 errores TypeScript. `npm run build` en frontend → 0 errores, todas las páginas generadas.
2. **Tests:** todas las suites de seguridad pasan (actualmente 296/296). Los nuevos controles tienen tests unitarios.
3. **Documentación:** el hallazgo y su corrección están registrados en el archivo `FASE-Sx` correspondiente y la MATRIZ-AUTORIZACION está actualizada.
4. **Sin riesgos residuales no documentados:** si un riesgo queda sin corregir, debe estar explícitamente documentado en el archivo de fase con justificación.

### Estado actual de fases

| Fase | Estado | Tests | Descripción |
|------|--------|-------|-------------|
| S1 | ✅ IMPLEMENTADO | 16 casos (env validation manual) | Secretos, ValidationPipe global, seed seguro |
| S2 | ✅ IMPLEMENTADO | Build verificado | Tokens HttpOnly, sesiones revocables, refresh rotation |
| S3 | ✅ IMPLEMENTADO | 29/29 | Helmet, CORS hardening, CSRF, rate limiting, headers |
| S4 | ✅ IMPLEMENTADO | 53/53 | RBAC, ownership DOCENTE, rol desde BD, desactivación inmediata |
| Circuito Aprobación | ✅ IMPLEMENTADO | 159/159 | ROLES_APROBAR sin ADMIN; scope filtering; race condition; DTOs validados; historial |
| C10 DOCENTE Programas | ✅ IMPLEMENTADO | 162/162 | DOCENTE puede editar programa con VinculacionCatedra APROBADA; sin perfil → 403; IDOR a otra asignatura → 403 |
| C11 Comunicación Bidireccional | ✅ IMPLEMENTADO | 181/181 | DOCENTE↔DIRECTIVO mensajes de corrección; IDOR → 403; estado inválido → ConflictException; notificaciones individuales por docente; marcar leídos + badge sidebar |
| C12 Estados Funcionales + Historial | ✅ IMPLEMENTADO | 206/206 | 5 estados visibles derivados (INCOMPLETO/COMPLETO/EN_CORRECCION/EN_REVISION/APROBADO); historial compartido con scope; DOCENTE requiere VinculacionCatedra; DC/DECANO: scope carrera/facultad; SEC/REC/ADMIN: global |
| C13 Unificación Estados + Notif. Automáticas | ✅ IMPLEMENTADO | 230/230 | COMPLETO eliminado → 4 estados; solicitud auto al 100%; notificaciones a directivos con scope; DOCENTE reenvío reactiva solicitud; GET /programas/regularizacion (solo lectura); polling 30s en frontend |
| C14 Corrección circuito aprobación + comunicación | ✅ IMPLEMENTADO | 258/258 | solicitarCorrecciones resets estadoPrograma→EN_REVISION (fix APROBADO bug); enviarMensaje valida contenido no vacío; modal notificación CORRECCIONES_PROGRAMA muestra observaciones + botón Ver correcciones; DatosNotificacion extiende campos; 28 tests |
| C15 Notificación aprobación definitiva docente | ✅ IMPLEMENTADO | 272/272 | aprobarSolicitud crea notificación APROBACION_PROGRAMA para cada docente con vinculación APROBADA; cuerpo incluye materiaId/materia/carrera/plan/directivo/fechaAprobacion; deduplicación; frontend: badge + modal con campos + botón VER PROGRAMA; 14 tests |
| C16 Corrección inconsistencia COMPLETITUD vs ESTADO FUNCIONAL | ✅ IMPLEMENTADO | 284/284 | `calcEstadoFuncional` aceptaba `todasCompletas` pero nunca la usaba — fallback devolvía INCOMPLETO para cualquier programa sin solicitud activa; programas históricos al 100% (pre-circuito, `estadoPrograma='PENDIENTE'`) mostraban INCOMPLETO pese a COMPLETITUD=COMPLETO y AVANCE=100%; fix: añadida rama `if (!todasCompletas) return 'INCOMPLETO'` y fallback cambiado a `return 'EN_REVISION'`; sin cambios en BD, sin migraciones; 12 tests nuevos + 3 tests actualizados en programas-estados.spec.ts |
| C16.2 Endpoint regularización histórica | ✅ IMPLEMENTADO | 296/296 | `POST /programas/regularizacion/generar`: genera `SolicitudAprobacionPrograma PENDIENTE_APROBACION` para programas 100% sin solicitud activa; recibe `programaIds[]` explícitos (no masivo automático); pre-checks + re-verificación dentro de `$transaction` (race condition protection); idempotente (segunda ejecución → OMITIDO); genera `HistorialPrograma accion='REGULARIZACION_HISTORICA'`; notifica directivos via `notificarDirectivos` existente; respuesta detallada por programa (GENERADA/OMITIDO + motivo); `GenerarRegularizacionDto` con `@IsUUID` + `@ArrayNotEmpty`; roles: ADMINISTRADOR_SISTEMA y SECRETARIA_ACADEMICA solamente; sin nuevas migraciones |
| C16.3 Refuerzo de concurrencia en regularización | ✅ IMPLEMENTADO | 296/296 unit + 1 integración | `SELECT ... FOR UPDATE` en PostgreSQL dentro de `$transaction` como primera operación: bloquea la fila `ProgramaAsignatura` a nivel de motor de BD, serializando transacciones concurrentes para el mismo programa. Segunda transacción espera liberación del lock y luego detecta solicitud ya creada (OMITIDO). Sin nuevas migraciones. Mock `$queryRaw` en `programas-c162.spec.ts` (296/296 sin regresiones). Test de integración real: `programas-c162-concurrencia.spec.ts` con `Promise.all` de dos llamadas concurrentes — verifica exactamente 1 solicitud + 1 historial en BD. `actualizarPrograma`, `aprobarSolicitud` y `enviarMensaje` son compatibles (upsert/update implican write locks; flujo normal no contende con regularización) |

### Riesgos residuales documentados (abiertos)

| ID | Descripción | Fuente | Severidad |
|----|-------------|--------|-----------|
| RR-1 | Next.js 14.2.5 presenta vulnerabilidades reportadas (auth bypass, cache poisoning, SSRF y otras). Determinar versión mínima corregida, compatibilidad e impacto durante el sprint específico de dependencias/CVEs. Versión objetivo aún no decidida. | S4 | ALTO |
| RR-2 | `multer` con vulnerabilidad DoS por uploads incompletos — evaluar actualización menor | S4 | ALTO (runtime) |
| RR-3 | Tokens JWT sin `sesionId` (emitidos antes de S2 o en escenarios de edge case): JwtStrategy retorna `payload.rol` sin verificar `usuario.activo` ni `sesion.activo`. Estos tokens deberían ser inexistentes en condiciones normales, pero si existieran no serían revocables vía sesión | S2/S4 | BAJO |
| RR-4 | Refresh token usando bcrypt para generación (misuse semántico, latencia innecesaria) | S2 | BAJO |
| RR-5 | Sin auditoría en módulo Usuarios (cambios de rol, activación/desactivación) | S4 | MEDIO |
| RR-6 | CSP no implementada en frontend Next.js | S3 | MEDIO |
| RR-7 | Trust Proxy no configurado para producción (rate limiting sobre IP del proxy) | S3 | MEDIO en prod |
| RR-8 | Health endpoints públicos exponen versión y estado de BD | S4 | BAJO |

---

## 22. Git — Seguridad en el Flujo de Trabajo

### 22.1 Commits

**Regla:** antes de hacer commit, verificar que no hay archivos `.env`, secretos, tokens ni credenciales en los archivos staged.

**Regla:** el archivo `.env` no debe aparecer nunca en `git status` como tracked. Si aparece, eliminarlo del tracking con `git rm --cached .env` inmediatamente.

**Regla:** `.env.example` puede comitearse (es una plantilla pública). Verificar que no tenga valores reales, solo placeholders.

### 22.2 Ramas de seguridad

Las correcciones de seguridad implementadas en S1–S4 viven en la rama `feature/security-hardening`. Esta rama no debe ser revertida ni squashada sin revisión explícita del impacto en los controles de este documento.

### 22.3 Pull Requests con cambios de seguridad

Los PRs que toquen autenticación, autorización, CORS, CSRF o manejo de archivos deben incluir en la descripción:
- Qué control de seguridad cambia o impacta.
- Tests que cubren el cambio.
- Referencia a la sección de este documento que aplica.

---

## Apéndice A — Referencia de Archivos Clave

| Archivo | Función de seguridad |
|---------|---------------------|
| `backend/src/config/env.validation.ts` | Validación centralizada de variables de entorno |
| `backend/src/main.ts` | Helmet, CORS, body limits, ValidationPipe global, exception filter |
| `backend/src/app.module.ts` | ThrottlerModule, ThrottlerGuard global, CsrfMiddleware |
| `backend/src/common/filters/http-exception.filter.ts` | Sanitización de errores en producción |
| `backend/src/common/middleware/csrf.middleware.ts` | Validación Origin + X-Requested-With |
| `backend/src/modules/auth/strategies/jwt.strategy.ts` | Verificación de sesion.activo + usuario.activo + rol desde BD |
| `backend/src/modules/auth/auth.service.ts` | Login con sesionId, logout, refresh, password reset |
| `backend/src/modules/users/usuarios.service.ts` | toggleEstado con invalidación de sesiones |
| `backend/src/modules/materias/materias.service.ts` | verificarOwnershipDocente para PATCH /materias/:id |
| `backend/src/modules/programas/programas.service.ts` | verificarOwnershipDocente para PATCH /programas/materia/:id |
| `frontend/lib/api.ts` | apiFetch — wrapper centralizado con cookies y CSRF |
| `frontend/middleware.ts` | Guardia de navegación Next.js |
| `frontend/next.config.mjs` | Security headers del frontend |
| `docs/seguridad/MATRIZ-AUTORIZACION.md` | Matriz completa de endpoints, roles y ownership |

---

*Este documento consolida las decisiones de seguridad de las fases S1–S4 del proyecto UDEMM Global. Debe mantenerse actualizado con cada fase de hardening subsiguiente. En caso de contradicción entre este documento y los archivos de fase individuales (FASE-S1, FASE-S2, FASE-S3, FASE-S4), el archivo de fase individual es la fuente de verdad para los detalles técnicos específicos.*
