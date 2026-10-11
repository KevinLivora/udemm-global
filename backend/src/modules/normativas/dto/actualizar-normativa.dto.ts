import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ActualizarNormativaDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  titulo: string;

  @IsUUID('4')
  @IsNotEmpty()
  tipoNormativaId: string;

  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}/)
  @IsNotEmpty()
  fechaEmision: string;

  @IsString()
  @IsNotEmpty()
  areaEmisora: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-\/]*$/)
  @IsNotEmpty()
  numeroNorma: string;

  @IsInt()
  @Min(0)
  @Max(99)
  @Type(() => Number)
  anio: number;

  @IsIn(['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'])
  @IsOptional()
  vigencia?: string;

  @IsString()
  @IsOptional()
  palabrasClave?: string;
}
