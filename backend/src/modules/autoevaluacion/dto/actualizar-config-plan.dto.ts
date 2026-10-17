import { IsInt, IsOptional, Min } from 'class-validator';

/**
 * DTO para configurar los umbrales horarios de un Plan de Estudio (P-10..P-14).
 * Solo ADMINISTRADOR_SISTEMA puede enviar este DTO.
 * NULL en cada campo significa "sin umbral configurado" → R-09 no evalúa ese bloque.
 * Enviar null explícitamente borra el umbral. Enviar undefined lo deja sin cambios.
 */
export class ActualizarConfigPlanDto {
  @IsOptional()
  @IsInt({ message: 'horasMinTotales debe ser un entero' })
  @Min(0, { message: 'horasMinTotales debe ser 0 o mayor' })
  horasMinTotales?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinCB debe ser un entero' })
  @Min(0, { message: 'horasMinCB debe ser 0 o mayor' })
  horasMinCB?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinTB debe ser un entero' })
  @Min(0, { message: 'horasMinTB debe ser 0 o mayor' })
  horasMinTB?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinTA debe ser un entero' })
  @Min(0, { message: 'horasMinTA debe ser 0 o mayor' })
  horasMinTA?: number | null;

  @IsOptional()
  @IsInt({ message: 'horasMinCTX debe ser un entero' })
  @Min(0, { message: 'horasMinCTX debe ser 0 o mayor' })
  horasMinCTX?: number | null;
}
