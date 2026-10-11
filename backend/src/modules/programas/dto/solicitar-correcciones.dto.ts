import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class SolicitarCorreccionesDto {
  @IsString()
  @IsNotEmpty({ message: 'Las observaciones son obligatorias.' })
  @MinLength(10, { message: 'Las observaciones deben tener al menos 10 caracteres.' })
  observaciones: string;
}
