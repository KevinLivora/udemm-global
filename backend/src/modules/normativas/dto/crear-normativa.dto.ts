import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const VIGENCIAS = ['VIGENTE', 'DEROGADA', 'SUSPENDIDA', 'REEMPLAZADA'] as const;

export class CrearNormativaDto {
  @IsString()
  @IsNotEmpty({ message: 'El título es obligatorio' })
  @MaxLength(200, { message: 'El título no puede superar 200 caracteres' })
  titulo: string;

  @IsUUID('4', { message: 'Tipo de normativa inválido' })
  @IsNotEmpty({ message: 'El tipo de normativa es obligatorio' })
  tipoNormativaId: string;

  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'La fecha de emisión debe tener formato YYYY-MM-DD' })
  @IsNotEmpty({ message: 'La fecha de emisión es obligatoria' })
  fechaEmision: string;

  @IsString()
  @IsNotEmpty({ message: 'El área emisora es obligatoria' })
  areaEmisora: string;

  @IsString()
  @Matches(/^[A-Za-z0-9][A-Za-z0-9\-\/]*$/, { message: 'El N° de norma solo puede contener letras, números, guiones y barras (ej: 002, RES-123, ORD-045/2026)' })
  @IsNotEmpty({ message: 'El N° de norma es obligatorio' })
  numeroNorma: string;

  @IsInt({ message: 'El año debe ser un número entero' })
  @Min(0, { message: 'El año debe ser de 2 dígitos (ej: 26)' })
  @Max(99, { message: 'El año debe ser de 2 dígitos (ej: 26)' })
  @Type(() => Number)
  anio: number;

  @IsIn(VIGENCIAS, { message: 'La vigencia no es válida' })
  @IsOptional()
  vigencia?: string;

  @IsString()
  @IsOptional()
  palabrasClave?: string;
}
