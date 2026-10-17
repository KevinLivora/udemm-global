import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ScopeModule } from '../scopes/scope.module';
import { AutoevaluacionController } from './autoevaluacion.controller';
import { ConfigFacultadService } from './config/config-facultad.service';
import { ConfigPlanService } from './config/config-plan.service';
import { ConsultasAcademicasService } from './consultas-academicas/consultas-academicas.service';
import { IndicadoresService } from './indicadores/indicadores.service';
import { RegistroIndicadores } from './indicadores/indicadores.registry';
import { R02EvaluadorService } from './indicadores/r02.evaluador';
import { R06EvaluadorService } from './indicadores/r06.evaluador';
import { R07EvaluadorService } from './indicadores/r07.evaluador';
import { R08EvaluadorService } from './indicadores/r08.evaluador';
import { R09EvaluadorService } from './indicadores/r09.evaluador';
import { ResponsablesService } from './responsables/responsables.service';
import { TablroPlanService } from './tablero/tablero-plan.service';

@Module({
  imports: [PrismaModule, ScopeModule],
  controllers: [AutoevaluacionController],
  providers: [
    ConfigFacultadService,
    ConfigPlanService,
    ResponsablesService,
    ConsultasAcademicasService,
    RegistroIndicadores,
    R02EvaluadorService,
    R06EvaluadorService,
    R07EvaluadorService,
    R08EvaluadorService,
    R09EvaluadorService,
    IndicadoresService,
    TablroPlanService,
  ],
  exports: [
    ConfigFacultadService,
    ConfigPlanService,
    ResponsablesService,
    ConsultasAcademicasService,
    RegistroIndicadores,
    R02EvaluadorService,
    R06EvaluadorService,
    R07EvaluadorService,
    R08EvaluadorService,
    R09EvaluadorService,
    IndicadoresService,
    TablroPlanService,
  ],
})
export class AutoevaluacionModule {}
