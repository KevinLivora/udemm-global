import { IsInt, IsOptional, Max, Min } from 'class-validator';

/**
 * DTO para actualizar la configuración de MOD-AUT de una Facultad.
 * Solo ADMINISTRADOR_SISTEMA puede enviar este DTO.
 * La validación cruzada p02BajaH < p01TopeH se realiza en el servicio.
 */
export class ActualizarConfigFacultadDto {
  @IsOptional()
  @IsInt({ message: 'p01TopeH debe ser un entero' })
  @Min(1, { message: 'p01TopeH debe ser al menos 1' })
  @Max(168, { message: 'p01TopeH no puede superar 168 (horas semanales máximas)' })
  p01TopeH?: number;

  @IsOptional()
  @IsInt({ message: 'p02BajaH debe ser un entero' })
  @Min(1, { message: 'p02BajaH debe ser al menos 1' })
  p02BajaH?: number;

  @IsOptional()
  @IsInt({ message: 'p03MaxMat debe ser un entero' })
  @Min(1, { message: 'p03MaxMat debe ser al menos 1' })
  @Max(20, { message: 'p03MaxMat no puede superar 20' })
  p03MaxMat?: number;
}
