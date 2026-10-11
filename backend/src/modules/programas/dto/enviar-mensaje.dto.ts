import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class EnviarMensajeDto {
  @IsString()
  @IsNotEmpty({ message: 'El contenido del mensaje es obligatorio.' })
  @MinLength(1, { message: 'El mensaje no puede estar vacío.' })
  @MaxLength(2000, { message: 'El mensaje no puede superar los 2000 caracteres.' })
  contenido: string;
}
