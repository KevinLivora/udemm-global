import { BadRequestException } from '@nestjs/common';
import { EstadoCalculo } from '../types/estado-calculo.types';
import type { DocenteFichaAut } from '../consultas-academicas/consultas-academicas.types';
import type { ContextoEvaluacion } from './indicadores.types';
import { R12EvaluadorService } from './r12.evaluador';

// ── Constantes ───────────────────────────────────────────────────────────────

const USR    = 'usr-01';
const CAR_ID = 'car-01';
const FAC_ID = 'fac-01';
const FECHA  = new Date('2026-10-14');
const ADMIN  = 'ADMINISTRADOR_SISTEMA';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeContexto(overrides: Partial<ContextoEvaluacion> = {}): ContextoEvaluacion {
  return {
    usuarioId: USR,
    rolNombre: ADMIN,
    carreraId: CAR_ID,
    fechaEvaluacion: FECHA,
    ...overrides,
  };
}

/** Docente con ficha completa: cumple los tres ítems evaluados. */
function makeDocente(id: string, overrides: Partial<DocenteFichaAut> = {}): DocenteFichaAut {
  return {
    docenteId: id,
    nombre: `Nombre-${id}`,
    apellido: `Apellido-${id}`,
    activo: true,
    tituloGrado: 'Licenciado en Sistemas',
    areaDisciplinarId: 'area-01',
    fechaNacimiento: new Date('1985-03-15'),
    sexo: 'M',
    ...overrides,
  };
}

function makeSvc(
  docentes: DocenteFichaAut[],
  alcanceFacultad = true,
  multiFacultadDocentes: string[] = [],
) {
  const consultas = {
    obtenerDocentesParaR12: jest.fn().mockResolvedValue({
      docentes,
      facultadId: FAC_ID,
      alcanceFacultad,
      docentesMultiFacultad: new Set(multiFacultadDocentes),
    }),
  };
  return { svc: new R12EvaluadorService(consultas as any), consultas };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('R12EvaluadorService', () => {

  it('lanza BadRequestException si falta carreraId', async () => {
    const { svc } = makeSvc([]);
    await expect(
      svc.evaluar(makeContexto({ carreraId: undefined })),
    ).rejects.toThrow(BadRequestException);
  });

  it('NO_APLICA cuando no hay docentes con APROBADAS en el alcance', async () => {
    const { svc } = makeSvc([]);
    const res = await svc.evaluar(makeContexto());

    expect(res.estadoCalculo).toBe(EstadoCalculo.NO_APLICA);
    expect(res.valor?.totalDocentes).toBe(0);
    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('CALCULADO y 0 incompletos cuando todos los docentes tienen ficha completa', async () => {
    const { svc } = makeSvc([makeDocente('d01'), makeDocente('d02')]);
    const res = await svc.evaluar(makeContexto());

    expect(res.estadoCalculo).toBe(EstadoCalculo.CALCULADO);
    expect(res.valor?.totalDocentes).toBe(2);
    expect(res.valor?.totalIncompletos).toBe(0);
    expect(res.valor?.incompletos).toHaveLength(0);
  });

  it('detecta faltante formacionGrado cuando tituloGrado es null', async () => {
    const { svc } = makeSvc([makeDocente('d01', { tituloGrado: null })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.totalIncompletos).toBe(1);
    expect(res.valor?.incompletos[0].faltantes).toContain('formacionGrado');
    expect(res.valor?.incompletos[0].faltantes).not.toContain('areaDesempeno');
    expect(res.valor?.incompletos[0].faltantes).not.toContain('personales');
  });

  it('detecta faltante formacionGrado cuando tituloGrado es string vacío', async () => {
    const { svc } = makeSvc([makeDocente('d01', { tituloGrado: '   ' })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).toContain('formacionGrado');
  });

  it('detecta faltante areaDesempeno cuando areaDisciplinarId es null', async () => {
    const { svc } = makeSvc([makeDocente('d01', { areaDisciplinarId: null })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).toContain('areaDesempeno');
    expect(res.valor?.incompletos[0].faltantes).not.toContain('formacionGrado');
  });

  it('detecta faltante personales cuando fechaNacimiento es null', async () => {
    const { svc } = makeSvc([makeDocente('d01', { fechaNacimiento: null })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).toContain('personales');
  });

  it('detecta faltante personales cuando sexo es null', async () => {
    const { svc } = makeSvc([makeDocente('d01', { sexo: null })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).toContain('personales');
  });

  it('detecta faltante personales cuando sexo es string vacío', async () => {
    const { svc } = makeSvc([makeDocente('d01', { sexo: '  ' })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).toContain('personales');
  });

  it('acumula múltiples faltantes en el mismo docente', async () => {
    const { svc } = makeSvc([
      makeDocente('d01', { tituloGrado: null, areaDisciplinarId: null, fechaNacimiento: null }),
    ]);
    const res = await svc.evaluar(makeContexto());

    const { faltantes } = res.valor!.incompletos[0];
    expect(faltantes).toContain('personales');
    expect(faltantes).toContain('formacionGrado');
    expect(faltantes).toContain('areaDesempeno');
    expect(faltantes).toHaveLength(3);
  });

  it('no incluye "docencia" en los faltantes (delegado a R-04)', async () => {
    const { svc } = makeSvc([makeDocente('d01', { tituloGrado: null })]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].faltantes).not.toContain('docencia');
  });

  it('ordena los incompletos alfabéticamente por nombre', async () => {
    const { svc } = makeSvc([
      makeDocente('d02', { tituloGrado: null, nombre: 'Zara', apellido: 'López' }),
      makeDocente('d01', { tituloGrado: null, nombre: 'Ana', apellido: 'García' }),
    ]);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.incompletos[0].nombre).toBe('Ana García');
    expect(res.valor?.incompletos[1].nombre).toBe('Zara López');
  });

  it('PARCIAL cuando alcanceFacultad = false (DIRECTOR_CARRERA)', async () => {
    const { svc } = makeSvc([makeDocente('d01')], false);
    const res = await svc.evaluar(makeContexto({ rolNombre: 'DIRECTOR_CARRERA' }));

    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    const dp = res.datosFaltantes.find((d) => d.campo === 'vinculacionesOtrasCarreras');
    expect(dp).toBeDefined();
  });

  it('PARCIAL con noDeterminables cuando hay docentes cross-facultad', async () => {
    const { svc } = makeSvc(
      [makeDocente('d01'), makeDocente('d02')],
      true,
      ['d01'],
    );
    const res = await svc.evaluar(makeContexto());

    expect(res.estadoCalculo).toBe(EstadoCalculo.PARCIAL);
    expect(res.valor?.totalNoDeterminables).toBe(1);
    expect(res.valor?.noDeterminables[0].docenteId).toBe('d01');
    expect(res.valor?.noDeterminables[0].causa).toBe('CROSS_FACULTAD');
    const dp = res.datosFaltantes.find((d) => d.campo === 'vinculacionesOtrasFacultades');
    expect(dp).toBeDefined();
  });

  it('excluye docentes cross-facultad del conteo de incompletos', async () => {
    const docenteCross = makeDocente('d-cross', { tituloGrado: null });
    const docenteOk = makeDocente('d-ok');
    const { svc } = makeSvc([docenteCross, docenteOk], true, ['d-cross']);
    const res = await svc.evaluar(makeContexto());

    expect(res.valor?.totalIncompletos).toBe(0);
    expect(res.valor?.totalNoDeterminables).toBe(1);
  });

  it('incluye datosFaltantes estructurales (DP-01, DP-02, DP-cargo) cuando hay docentes', async () => {
    const { svc } = makeSvc([makeDocente('d01')]);
    const res = await svc.evaluar(makeContexto());

    const campos = res.datosFaltantes.map((d) => d.campo);
    expect(campos).toContain('personales');
    expect(campos).toContain('docencia');
    expect(campos).toContain('cargoVigente');
  });

  it('no incluye datosFaltantes estructurales en NO_APLICA', async () => {
    const { svc } = makeSvc([]);
    const res = await svc.evaluar(makeContexto());

    expect(res.datosFaltantes).toHaveLength(0);
  });

  it('delega la llamada a consultas.obtenerDocentesParaR12 con los parámetros correctos', async () => {
    const { svc, consultas } = makeSvc([makeDocente('d01')]);
    await svc.evaluar(makeContexto());

    expect(consultas.obtenerDocentesParaR12).toHaveBeenCalledWith(CAR_ID, USR, ADMIN);
  });
});
