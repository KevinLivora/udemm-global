export interface PermisosPrograma {
  ver: boolean;
  editar: boolean;
  exportar: boolean;
  aprobar: boolean;
}

// La propiedad `editar` indica permiso genérico de edición por rol.
// La propiedad `aprobar` indica permiso para aprobar o solicitar correcciones en la Bandeja.
// La restricción de scope (carrera/facultad) se aplica adicionalmente en el componente.
export function getPermisosPrograma(rolNombre: string): PermisosPrograma {
  switch (rolNombre) {
    case 'DIRECTOR_CARRERA':
    case 'DECANO':
    case 'SECRETARIA_ACADEMICA':
    case 'RECTORADO':
      return { ver: true, editar: true, exportar: true, aprobar: true };
    case 'ADMINISTRADOR_SISTEMA':
      return { ver: true, editar: true, exportar: true, aprobar: false };
    case 'ADMINISTRATIVO':
      return { ver: true, editar: false, exportar: true, aprobar: false };
    case 'DOCENTE':
      return { ver: true, editar: false, exportar: false, aprobar: false };
    default:
      return { ver: false, editar: false, exportar: false, aprobar: false };
  }
}

export interface PermisosPlanEstudio {
  ver: boolean;
  crear: boolean;
  editar: boolean;
  eliminar: boolean;
  exportar: boolean;
  gestionarContenido: boolean;
}

export const ROLES_CON_ACCESO_PLAN_ESTUDIOS = [
  'ADMINISTRADOR_SISTEMA',
  'SECRETARIA_ACADEMICA',
  'DIRECTOR_CARRERA',
  'ADMINISTRATIVO',
  'DECANO',
  'RECTORADO',
  'DOCENTE'
] as const;

export function getPermisosPlanEstudio(rolNombre: string): PermisosPlanEstudio {
  switch (rolNombre) {
    case 'ADMINISTRADOR_SISTEMA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: true,
        exportar: true,
        gestionarContenido: true
      };
    case 'SECRETARIA_ACADEMICA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: false,
        exportar: true,
        gestionarContenido: true
      };
    case 'DIRECTOR_CARRERA':
      return {
        ver: true,
        crear: true,
        editar: true,
        eliminar: false,
        exportar: true,
        gestionarContenido: true
      };
    case 'ADMINISTRATIVO':
      return {
        ver: true,
        crear: false,
        editar: true,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
    case 'DECANO':
    case 'RECTORADO':
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: true,
        gestionarContenido: false
      };
    case 'DOCENTE':
      return {
        ver: true,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
    default:
      return {
        ver: false,
        crear: false,
        editar: false,
        eliminar: false,
        exportar: false,
        gestionarContenido: false
      };
  }
}
