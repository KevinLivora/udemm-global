import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ConfigFacultadService } from './config/config-facultad.service';
import { ConfigPlanService } from './config/config-plan.service';
import { ResponsablesService } from './responsables/responsables.service';
import { IndicadoresService } from './indicadores/indicadores.service';
import { RegistroIndicadores } from './indicadores/indicadores.registry';
import { ActualizarConfigFacultadDto } from './dto/actualizar-config-facultad.dto';
import { ActualizarConfigPlanDto } from './dto/actualizar-config-plan.dto';
import { DesignarResponsableDto } from './dto/designar-responsable.dto';
import { EvaluarIndicadorDto } from './dto/evaluar-indicador.dto';
import { TablroPlanService } from './tablero/tablero-plan.service';
import { TablroCarreraService } from './tablero/tablero-carrera.service';

const ROLES_MODAUT = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'RECTORADO',
  'DECANO',
  'DIRECTOR_CARRERA',
] as const;

/**
 * Controlador de MOD-AUT.
 * DOCENTE y ADMINISTRATIVO no tienen acceso a ningún endpoint de este módulo.
 * El scope institucional se verifica en los servicios para prevenir IDOR.
 *
 * Seguridad de indicadores:
 * - usuarioId y rolNombre se toman siempre del contexto autenticado (req.user).
 * - El body de evaluación solo acepta identificadores académicos opcionales.
 * - ValidationPipe con whitelist:true descarta cualquier campo adicional.
 * - IndicadoresService verifica autorización y scope antes de delegar al evaluador.
 * - ConsultasAcademicasService valida scope en cada consulta interna (defensa en profundidad).
 */
@Controller('autoevaluacion')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class AutoevaluacionController {
  constructor(
    private readonly configFacultad: ConfigFacultadService,
    private readonly configPlan: ConfigPlanService,
    private readonly responsables: ResponsablesService,
    private readonly indicadores: IndicadoresService,
    private readonly registro: RegistroIndicadores,
    private readonly tablero: TablroPlanService,
    private readonly tableroCarrera: TablroCarreraService,
  ) {}

  // ── Configuración por Facultad ──────────────────────────────────────────────

  /**
   * Consulta la configuración MOD-AUT de una Facultad.
   * Devuelve null si la Facultad no tiene configuración todavía (estado esperado).
   */
  @Get('config/facultad/:facultadId')
  @Roles(...ROLES_MODAUT)
  async obtenerConfigFacultad(@Param('facultadId') facultadId: string, @Req() req: any) {
    return this.configFacultad.obtenerConfig(facultadId, req.user.id, req.user.rol.nombre);
  }

  /**
   * Crea o actualiza la configuración MOD-AUT de una Facultad.
   * Solo ADMINISTRADOR_SISTEMA puede modificar la configuración.
   */
  @Patch('config/facultad/:facultadId')
  @Roles('ADMINISTRADOR_SISTEMA')
  async actualizarConfigFacultad(
    @Param('facultadId') facultadId: string,
    @Body() dto: ActualizarConfigFacultadDto,
    @Req() req: any,
  ) {
    return this.configFacultad.upsertConfig(facultadId, dto, req.user.id);
  }

  // ── Umbrales por Plan de Estudio ────────────────────────────────────────────

  /**
   * Consulta los umbrales horarios de un Plan de Estudio (P-10..P-14).
   * Los campos null indican que el umbral no está configurado → R-09 no evalúa ese bloque.
   */
  @Get('config/plan/:planEstudioId')
  @Roles(...ROLES_MODAUT)
  async obtenerConfigPlan(@Param('planEstudioId') planEstudioId: string, @Req() req: any) {
    return this.configPlan.obtenerUmbrales(planEstudioId, req.user.id, req.user.rol.nombre);
  }

  /**
   * Actualiza los umbrales horarios de un Plan de Estudio.
   * Solo ADMINISTRADOR_SISTEMA puede modificar umbrales de planes.
   */
  @Patch('config/plan/:planEstudioId')
  @Roles('ADMINISTRADOR_SISTEMA')
  async actualizarConfigPlan(
    @Param('planEstudioId') planEstudioId: string,
    @Body() dto: ActualizarConfigPlanDto,
  ) {
    return this.configPlan.actualizarUmbrales(planEstudioId, dto);
  }

  // ── Responsables de cátedra ─────────────────────────────────────────────────

  /**
   * Designa o quita el responsable de cátedra de una vinculación.
   * ADMINISTRADOR_SISTEMA: puede operar globalmente.
   * DIRECTOR_CARRERA: solo puede operar sobre sus carreras autorizadas.
   * La vinculación debe estar en estado APROBADA.
   * Si se intenta marcar como responsable y ya hay uno, devuelve 409.
   */
  @Patch('responsable/:vinculacionId')
  @Roles('ADMINISTRADOR_SISTEMA', 'DIRECTOR_CARRERA')
  async designarResponsable(
    @Param('vinculacionId') vinculacionId: string,
    @Body() dto: DesignarResponsableDto,
    @Req() req: any,
  ) {
    return this.responsables.designarResponsable(
      vinculacionId,
      dto.esResponsable,
      req.user.id,
      req.user.rol.nombre,
    );
  }

  /**
   * Consulta el responsable confirmado de una (materia, cátedra).
   * Devuelve null si ninguna vinculación tiene esResponsableCatedra=true.
   */
  @Get('responsable/:materiaId/:catedraId')
  @Roles(...ROLES_MODAUT)
  async obtenerResponsable(
    @Param('materiaId') materiaId: string,
    @Param('catedraId') catedraId: string,
    @Req() req: any,
  ) {
    return this.responsables.obtenerResponsable(
      materiaId,
      catedraId,
      req.user.id,
      req.user.rol.nombre,
    );
  }

  // ── Tablero por plan de estudios ────────────────────────────────────────────

  /**
   * Devuelve el tablero de indicadores IPL-01, IPL-02, IPL-03 e IPL-05
   * para el plan de estudios indicado.
   *
   * Seguridad:
   * - planEstudioId se valida como UUID v4 en el path.
   * - usuarioId y rolNombre provienen exclusivamente del token JWT.
   * - TablroPlanService delega la verificación de scope a IndicadoresService,
   *   que a su vez usa ScopeService (defensa en profundidad).
   */
  @Post('tablero/plan/:planEstudioId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async tablroPlan(
    @Param('planEstudioId', new ParseUUIDPipe({ version: '4' })) planEstudioId: string,
    @Req() req: any,
  ) {
    return this.tablero.consultarPlan(planEstudioId, req.user.id, req.user.rol.nombre);
  }

  // ── Tablero por carrera ─────────────────────────────────────────────────────

  /**
   * Devuelve el tablero de indicadores IP-03 e IP-08 para la carrera indicada.
   *
   * IP-03: Materias cubiertas (FSD §7) — asignaturas con ≥1 vinculación APROBADA.
   * IP-08: Relación profesores/auxiliares (FSD §7) — ratio P/A según categorías CONEAU.
   *
   * Seguridad:
   * - carreraId se valida como UUID v4 en el path.
   * - usuarioId y rolNombre provienen exclusivamente del token JWT.
   * - TablroCarreraService verifica rol y scope antes de ejecutar los cálculos.
   */
  @Post('tablero/carrera/:carreraId')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async tablroCarrera(
    @Param('carreraId', new ParseUUIDPipe({ version: '4' })) carreraId: string,
    @Req() req: any,
  ) {
    return this.tableroCarrera.consultarCarrera(carreraId, req.user.id, req.user.rol.nombre);
  }

  // ── Indicadores ─────────────────────────────────────────────────────────────

  /**
   * Lista todos los indicadores registrados en MOD-AUT con sus metadatos públicos.
   * No ejecuta evaluadores ni devuelve datos académicos.
   * Incluye motivoPendiente para indicadores NO_IMPLEMENTADO.
   */
  @Get('indicadores')
  @Roles(...ROLES_MODAUT)
  listarIndicadores() {
    return this.registro.listar().map((def) => ({
      codigo: def.codigo,
      nombre: def.nombre,
      descripcion: def.descripcion,
      tipo: def.tipo,
      severidad: def.severidad,
      alcance: def.alcance,
      estadoImplementacion: def.estadoImplementacion,
      ...(def.motivoPendiente !== undefined && { motivoPendiente: def.motivoPendiente }),
    }));
  }

  /**
   * Evalúa un indicador individual para el contexto académico indicado.
   *
   * Seguridad:
   * - usuarioId y rolNombre provienen exclusivamente del token JWT (req.user).
   * - El body solo acepta carreraId y planEstudioId opcionales.
   * - Campos adicionales son descartados por ValidationPipe con whitelist:true.
   * - IndicadoresService verifica rol y scope antes de delegar al evaluador.
   * - Para roles territoriales sin contexto: 403 desde IndicadoresService.
   *
   * Preserva todos los estados: CALCULADO, PARCIAL, NO_DETERMINABLE, NO_APLICA y NO_IMPLEMENTADO.
   */
  @Post('indicadores/:codigo/evaluar')
  @HttpCode(200)
  @Roles(...ROLES_MODAUT)
  async evaluarIndicador(
    @Param('codigo') codigo: string,
    @Body() dto: EvaluarIndicadorDto,
    @Req() req: any,
  ) {
    return this.indicadores.evaluar({
      codigoIndicador: codigo,
      contexto: {
        usuarioId: req.user.id,
        rolNombre: req.user.rol.nombre,
        carreraId: dto.carreraId,
        planEstudioId: dto.planEstudioId,
        fechaEvaluacion: new Date(),
      },
    });
  }
}
