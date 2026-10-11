import { IsArray, ArrayNotEmpty, IsUUID } from 'class-validator';

export class GenerarRegularizacionDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  programaIds: string[];
}
