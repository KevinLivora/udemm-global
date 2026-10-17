import { IsOptional, IsUUID } from 'class-validator';

/**
 * DTO para evaluar un indicador de MOD-AUT.
 *
 * Los roles globales (ADMINISTRADOR_SISTEMA, SECRETARIA_ACADEMICA, RECTORADO) pueden
 * omitir ambos identificadores. Los roles territoriales (DECANO, DIRECTOR_CARRERA)
 * deben proporcionar al menos uno: IndicadoresService lanza 403 si falta contexto territorial.
 *
 * Nunca aceptar usuarioId ni rolNombre del cliente: ambos se obtienen del token JWT.
 * ValidationPipe con whitelist:true descarta cualquier campo no declarado aquí.
 */
export class EvaluarIndicadorDto {
  @IsOptional()
  @IsUUID('4', { message: 'carreraId debe ser un UUID v4' })
  carreraId?: string;

  @IsOptional()
  @IsUUID('4', { message: 'planEstudioId debe ser un UUID v4' })
  planEstudioId?: string;
}
