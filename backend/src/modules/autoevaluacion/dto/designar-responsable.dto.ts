import { IsBoolean } from 'class-validator';

/**
 * DTO para designar o quitar el responsable de cátedra de una vinculación.
 * Roles autorizados: ADMINISTRADOR_SISTEMA, DIRECTOR_CARRERA (con scope).
 */
export class DesignarResponsableDto {
  @IsBoolean({ message: 'esResponsable debe ser true o false' })
  esResponsable: boolean;
}
