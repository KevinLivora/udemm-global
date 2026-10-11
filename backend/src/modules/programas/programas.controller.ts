import {
  Controller, Get, Patch, Post, Body, Param, Req,
  UseGuards, UsePipes, ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProgramasService } from './programas.service';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';
import { EnviarMensajeDto } from './dto/enviar-mensaje.dto';
import { GenerarRegularizacionDto } from './dto/generar-regularizacion.dto';
import { SolicitarCorreccionesDto } from './dto/solicitar-correcciones.dto';

const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA',
  'ADMINISTRATIVO', 'DECANO', 'RECTORADO', 'DOCENTE'
] as const;

// ADMINISTRADOR_SISTEMA: scope global (mismos permisos que SECRETARIA_ACADEMICA en Programas).
// DIRECTOR_CARRERA (scope carrera), DECANO (scope facultad),
// SECRETARIA_ACADEMICA y RECTORADO (scope global).
// DOCENTE: puede editar solo con vinculación APROBADA para esa asignatura (validado en servicio).
// ADMINISTRATIVO es solo lectura.
const ROLES_EDITAR = [
  'ADMINISTRADOR_SISTEMA', 'DIRECTOR_CARRERA', 'DECANO', 'SECRETARIA_ACADEMICA', 'RECTORADO',
  'DOCENTE',
] as const;

// Roles autorizados para aprobar programas. ADMINISTRADOR_SISTEMA excluido por requerimiento.
const ROLES_APROBAR = [
  'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA', 'DECANO', 'RECTORADO'
] as const;

@Controller('programas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProgramasController {
  constructor(private readonly programasService: ProgramasService) {}

  // ── Programa por materia ──────────────────────────────────────────────────

  @Get('materia/:materiaId')
  @Roles(...ROLES_VER)
  obtenerPrograma(@Param('materiaId') materiaId: string) {
    return this.programasService.obtenerPrograma(materiaId);
  }

  @Get('materia/:materiaId/historial')
  @Roles(...ROLES_VER)
  obtenerHistorialPrograma(@Param('materiaId') materiaId: string, @Req() req: any) {
    return this.programasService.obtenerHistorialPrograma(materiaId, req.user.id, req.user.rol.nombre);
  }

  @Patch('materia/:materiaId')
  @Roles(...ROLES_EDITAR)
  actualizarPrograma(
    @Param('materiaId') materiaId: string,
    @Body() dto: ActualizarProgramaDto,
    @Req() req: any
  ) {
    return this.programasService.actualizarPrograma(materiaId, dto, req.user.id, req.user.rol.nombre);
  }

  // ── Circuito de aprobación ────────────────────────────────────────────────

  // ── Regularización (C13) ─────────────────────────────────────────────────────

  @Get('regularizacion')
  @Roles('ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA')
  listarProgramasParaRegularizacion(@Req() req: any) {
    return this.programasService.listarProgramasParaRegularizacion(req.user.id, req.user.rol.nombre);
  }

  @Post('regularizacion/generar')
  @Roles('ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA')
  generarSolicitudesRegularizacion(@Body() dto: GenerarRegularizacionDto, @Req() req: any) {
    return this.programasService.generarSolicitudesRegularizacion(dto, req.user.id);
  }

  // ── Circuito de aprobación ────────────────────────────────────────────────

  @Get('solicitudes')
  @Roles(...ROLES_APROBAR)
  obtenerSolicitudes(@Req() req: any) {
    return this.programasService.obtenerSolicitudes(req.user.id, req.user.rol.nombre);
  }

  @Patch('solicitudes/:id/aprobar')
  @Roles(...ROLES_APROBAR)
  aprobarSolicitud(@Param('id') id: string, @Req() req: any) {
    return this.programasService.aprobarSolicitud(id, req.user.id, req.user.rol.nombre);
  }

  @Patch('solicitudes/:id/solicitar-correcciones')
  @Roles(...ROLES_APROBAR)
  solicitarCorrecciones(
    @Param('id') id: string,
    @Body() dto: SolicitarCorreccionesDto,
    @Req() req: any,
  ) {
    return this.programasService.solicitarCorrecciones(id, dto, req.user.id, req.user.rol.nombre);
  }

  // ── Conversación DOCENTE ↔ DIRECTIVO ───────────────────────────────────────

  // Roles DOCENTE puede ver correcciones pendientes propias
  @Get('solicitudes/correcciones-docente')
  @Roles('DOCENTE')
  obtenerCorrecionesDocente(@Req() req: any) {
    return this.programasService.obtenerCorrecionesDocente(req.user.id);
  }

  // Contadores de novedades para badge (DOCENTE y aprobadores)
  @Get('contadores')
  @Roles(...ROLES_VER)
  contadoresNovedades(@Req() req: any) {
    return this.programasService.contadoresNovedades(req.user.id, req.user.rol.nombre);
  }

  // Mensajes de conversación — accesible por DOCENTE (con vinculación) y aprobadores (con scope)
  @Get('solicitudes/:id/mensajes')
  @Roles(...ROLES_VER)
  obtenerMensajes(@Param('id') id: string, @Req() req: any) {
    return this.programasService.obtenerMensajes(id, req.user.id, req.user.rol.nombre);
  }

  @Post('solicitudes/:id/mensajes')
  @Roles(...ROLES_VER)
  enviarMensaje(
    @Param('id') id: string,
    @Body() dto: EnviarMensajeDto,
    @Req() req: any,
  ) {
    return this.programasService.enviarMensaje(id, dto, req.user.id, req.user.rol.nombre);
  }

  @Patch('solicitudes/:id/mensajes/leer')
  @Roles(...ROLES_VER)
  marcarMensajesLeidos(@Param('id') id: string, @Req() req: any) {
    return this.programasService.marcarMensajesLeidos(id, req.user.id, req.user.rol.nombre);
  }
}
