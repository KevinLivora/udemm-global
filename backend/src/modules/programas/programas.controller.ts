import {
  Controller, Get, Patch, Body, Param, Req,
  UseGuards, UsePipes, ValidationPipe
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ProgramasService } from './programas.service';
import { ActualizarProgramaDto } from './dto/actualizar-programa.dto';

const ROLES_VER = [
  'ADMINISTRADOR_SISTEMA', 'SECRETARIA_ACADEMICA', 'DIRECTOR_CARRERA',
  'ADMINISTRATIVO', 'DECANO', 'RECTORADO', 'DOCENTE'
] as const;

// ADMINISTRADOR_SISTEMA: scope global (mismos permisos que SECRETARIA_ACADEMICA en Programas).
// DIRECTOR_CARRERA (scope carrera), DECANO (scope facultad),
// SECRETARIA_ACADEMICA y RECTORADO (scope global).
// DOCENTE y ADMINISTRATIVO son solo lectura.
const ROLES_EDITAR = [
  'ADMINISTRADOR_SISTEMA', 'DIRECTOR_CARRERA', 'DECANO', 'SECRETARIA_ACADEMICA', 'RECTORADO'
] as const;

@Controller('programas')
@UseGuards(JwtAuthGuard, RolesGuard)
@UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
export class ProgramasController {
  constructor(private readonly programasService: ProgramasService) {}

  @Get('materia/:materiaId')
  @Roles(...ROLES_VER)
  obtenerPrograma(@Param('materiaId') materiaId: string) {
    return this.programasService.obtenerPrograma(materiaId);
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
}
