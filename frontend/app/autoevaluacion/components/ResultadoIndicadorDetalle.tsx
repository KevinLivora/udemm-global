// Presentación específica por indicador — sin hooks propios.
// Importado exclusivamente desde componentes cliente.

import type { ReactNode } from 'react';

// ── Interfaz mínima requerida del componente padre ─────────────────────────

export interface ResultadoBase {
  codigo: string;
  estadoCalculo: string | null;
  estadoImplementacion: string;
  valor: unknown;
  unidad?: string;
}

// ── Tipos de valor por indicador ───────────────────────────────────────────
// Reflejan con fidelidad las interfaces de los evaluadores del backend.
// Solo se agregan campos necesarios para la presentación.

interface AlertaR02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  cantidadResponsables: number;
}

interface ParIncierto02 {
  materiaId: string;
  materiaNombre: string;
  materiaCodigo: string;
  catedraId: string;
  confirmedTrue: number;
  sinClasificar: number;
}

interface ValorR02 {
  paresConAlerta: AlertaR02[];
  paresInciertos: ParIncierto02[];
  totalMaterias: number;
}

interface DocenteR06 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
}

interface ValorR06 {
  carreraId: string;
  totalDocentes: number;
  promedio: number | null;
  mediana: number | null;
  maximo: number | null;
  distribucion: DocenteR06[];
}

interface AsignacionR07 {
  planEstudioId: string;
  materiaId: string;
  catedraId: string;
  materiaNombre?: string;
}

interface DocenteAlertaR07 {
  docenteId: string;
  nombre: string;
  nMaterias: number;
  exceso: number;
  asignaciones: AsignacionR07[];
}

interface DocenteNoDeterminableR07 {
  docenteId: string;
  nombre: string;
  nMateriasConocidas: number;
  causa: string;
}

interface ValorR07 {
  carreraId: string;
  facultadId: string;
  limite: number | null;
  totalDocentes: number;
  totalSobreasignados: number;
  sobreasignados: DocenteAlertaR07[];
  totalNoDeterminables: number;
  noDeterminables: DocenteNoDeterminableR07[];
  alcanceFacultad: boolean;
}

interface AlertaMateriaR08 {
  materiaId: string;
  nombre: string;
  codigo: string;
  tieneVinculacionesAprobadas: boolean;
}

interface ValorR08 {
  materiasConAlerta: AlertaMateriaR08[];
  materiasInciertas: AlertaMateriaR08[];
  totalMaterias: number;
  totalConResponsable: number;
}

interface EvaluacionDimension {
  horasReales: number | null;
  horasMinimas: number | null;
  diferencia: number | null;
  cumple: boolean | null;
}

interface MateriaR09 {
  materiaId: string;
  nombre: string;
  codigo: string;
  bloqueConocimientoRaw?: string | null;
}

interface ValorR09 {
  planEstudioId: string;
  totalMaterias: number;
  materiasSinHoras: MateriaR09[];
  materiasConBloqueIndeterminado: MateriaR09[];
  horasTotal: number | null;
  horasPorBloque: { CB: number | null; TB: number | null; TA: number | null; CX: number | null };
  evaluaciones: {
    total: EvaluacionDimension;
    CB: EvaluacionDimension;
    TB: EvaluacionDimension;
    TA: EvaluacionDimension;
    CX: EvaluacionDimension;
  };
}

// ── Helpers de formato ────────────────────────────────────────────────────

function numVal(v: number | null | undefined): string {
  return v === null || v === undefined ? '—' : String(v);
}

function numDec(v: number | null | undefined, d: number): string {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('es-AR', { minimumFractionDigits: d, maximumFractionDigits: d });
}

// ── Componentes de presentación compartidos ────────────────────────────────

function Metrica({
  label,
  valor,
  destaca = false,
}: {
  label: string;
  valor: string | number;
  destaca?: boolean;
}) {
  return (
    <div
      className={`rounded-lg px-3 py-2 border text-center ${
        destaca ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5 leading-tight">
        {label}
      </p>
      <p className={`text-sm font-bold tabular-nums ${destaca ? 'text-red-700' : 'text-slate-700'}`}>
        {valor}
      </p>
    </div>
  );
}

function SeccionTitulo({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${className ?? 'text-slate-400'}`}>
      {children}
    </p>
  );
}

function TablaWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  );
}

// ── R-02: Doble responsable de cátedra ────────────────────────────────────

function DetalleR02({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de doble responsable de cátedra.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR02;
  const paresConAlerta = v.paresConAlerta ?? [];
  const paresInciertos = v.paresInciertos ?? [];
  const totalMaterias = v.totalMaterias ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica
          label="Pares con alerta"
          valor={paresConAlerta.length}
          destaca={paresConAlerta.length > 0}
        />
        <Metrica
          label="Pares inciertos"
          valor={paresInciertos.length}
          destaca={paresInciertos.length > 0}
        />
      </div>

      {paresConAlerta.length === 0 && paresInciertos.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Sin pares (materia, cátedra) con doble responsable confirmado o incierto.
        </p>
      )}

      {paresConAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Doble responsable confirmado ({paresConAlerta.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Responsables</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {paresConAlerta.map((p, i) => (
                <tr key={i} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{p.materiaNombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{p.materiaCodigo}</td>
                  <td className="px-3 py-1.5 text-center font-bold text-red-700">{p.cantidadResponsables}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {paresInciertos.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Pares con datos insuficientes — posible doble responsable ({paresInciertos.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen vinculaciones APROBADAS con <span className="font-mono">esResponsableCatedra</span> sin clasificar.
            No puede confirmarse la ausencia de doble responsable.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-24">Confirmados</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Sin clasificar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {paresInciertos.map((p, i) => (
                <tr key={i} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{p.materiaNombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{p.materiaCodigo}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600 tabular-nums">{p.confirmedTrue}</td>
                  <td className="px-3 py-1.5 text-center font-semibold text-amber-700 tabular-nums">{p.sinClasificar}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-06: Distribución de materias por docente ────────────────────────────

function DetalleR06({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    const v = valor as ValorR06 | null | undefined;
    return (
      <div className="space-y-2">
        <p className="text-xs text-sky-600">
          No se encontraron docentes con asignaciones computables para este indicador en la carrera
          seleccionada.
        </p>
        {v !== null && v !== undefined && (
          <div className="w-32">
            <Metrica label="Docentes computables" valor={v.totalDocentes ?? 0} />
          </div>
        )}
      </div>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR06;
  const distribucion = v.distribucion ?? [];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Promedio" valor={numDec(v.promedio, 2)} />
        <Metrica label="Mediana" valor={numVal(v.mediana)} />
        <Metrica label="Máximo" valor={numVal(v.maximo)} />
      </div>

      {distribucion.length > 0 && (
        <div>
          <SeccionTitulo>Distribución por docente</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Docente</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-36">
                  Materias asignadas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {distribucion.map((d) => (
                <tr key={d.docenteId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-700">
                    {d.nMaterias}
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            Materias distintas por docente — la misma materia en múltiples cátedras cuenta como una.
          </p>
        </div>
      )}
    </div>
  );
}

// ── R-07: Docentes sobre-asignados ────────────────────────────────────────

function DetalleR07({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        Sin vinculaciones docentes APROBADAS activas en el alcance evaluado.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR07;
  const sobreasignados = v.sobreasignados ?? [];
  const noDeterminables = v.noDeterminables ?? [];
  const limiteStr = v.limite !== null && v.limite !== undefined ? String(v.limite) : '—';

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          La evaluación no puede completarse: la facultad de esta carrera no tiene el parámetro{' '}
          <span className="font-mono font-semibold">p03MaxMat</span> configurado en MOD-AUT.
          Sin ese umbral no es posible determinar sobreasignaciones.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Total docentes" valor={v.totalDocentes} />
        <Metrica label="Límite (p03MaxMat)" valor={limiteStr} />
        <Metrica
          label="Sobreasignados"
          valor={v.totalSobreasignados}
          destaca={v.totalSobreasignados > 0}
        />
        <Metrica
          label="No determinables"
          valor={v.totalNoDeterminables}
          destaca={v.totalNoDeterminables > 0}
        />
      </div>

      {!v.alcanceFacultad && (
        <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          Alcance parcial: la evaluación cubre únicamente la carrera solicitada.
          Los valores de materias por docente pueden estar subestimados.
        </p>
      )}

      {sobreasignados.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Docentes sobreasignados ({sobreasignados.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Docente</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-24">Materias</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-20">Exceso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {sobreasignados.map((d) => (
                <tr key={d.docenteId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-center font-semibold tabular-nums text-slate-700">{d.nMaterias}</td>
                  <td className="px-3 py-1.5 text-center font-bold tabular-nums text-red-700">+{d.exceso}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {noDeterminables.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Docentes no determinables ({noDeterminables.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen asignaciones APROBADAS en más de una facultad. No es posible aplicar un único{' '}
            <span className="font-mono">p03MaxMat</span> institucional.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Docente</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Mat. conocidas</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Causa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {noDeterminables.map((d) => (
                <tr key={d.docenteId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{d.nombre}</td>
                  <td className="px-3 py-1.5 text-center tabular-nums text-slate-600">{d.nMateriasConocidas}</td>
                  <td className="px-3 py-1.5 font-mono text-[11px] text-amber-700">{d.causa}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}

      {sobreasignados.length === 0 && noDeterminables.length === 0 && estadoCalculo === 'CALCULADO' && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Sin docentes sobreasignados en el alcance evaluado.
        </p>
      )}
    </div>
  );
}

// ── R-08: Materias sin responsable de cátedra ─────────────────────────────

function DetalleR08({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de responsables de cátedra.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR08;
  const materiasConAlerta = v.materiasConAlerta ?? [];
  const materiasInciertas = v.materiasInciertas ?? [];
  const totalMaterias = v.totalMaterias ?? 0;
  const totalConResponsable = v.totalConResponsable ?? 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica label="Con responsable" valor={totalConResponsable} />
        <Metrica
          label="Sin responsable"
          valor={materiasConAlerta.length}
          destaca={materiasConAlerta.length > 0}
        />
        <Metrica
          label="Inciertas"
          valor={materiasInciertas.length}
          destaca={materiasInciertas.length > 0}
        />
      </div>

      {materiasConAlerta.length === 0 && materiasInciertas.length === 0 && (
        <p className="text-xs text-emerald-700 font-medium flex items-center gap-1.5">
          <span className="text-emerald-500">✓</span>
          Todas las materias del plan tienen responsable de cátedra confirmado.
        </p>
      )}

      {materiasConAlerta.length > 0 && (
        <div>
          <SeccionTitulo className="text-red-600">
            Sin responsable confirmado ({materiasConAlerta.length})
          </SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-red-50 border-b border-red-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-28">Código</th>
                <th className="text-center px-3 py-2 text-[10px] font-semibold uppercase text-red-700 w-32">Vinc. aprobadas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-red-100">
              {materiasConAlerta.map((m) => (
                <tr key={m.materiaId} className="hover:bg-red-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                  <td className="px-3 py-1.5 text-center text-slate-600">{m.tieneVinculacionesAprobadas ? 'Sí' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            &quot;Vinc. aprobadas: No&quot; — sin ninguna vinculación APROBADA para la materia.
            &quot;Sí&quot; — tiene vinculaciones pero ninguna con responsable confirmado.
          </p>
        </div>
      )}

      {materiasInciertas.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Responsabilidad incierta ({materiasInciertas.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Tienen vinculaciones APROBADAS con{' '}
            <span className="font-mono">esResponsableCatedra = null</span>. La ausencia de responsable
            no puede confirmarse.
          </p>
          <TablaWrapper>
            <thead>
              <tr className="bg-amber-50 border-b border-amber-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700">Materia</th>
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-amber-700 w-28">Código</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-amber-100">
              {materiasInciertas.map((m) => (
                <tr key={m.materiaId} className="hover:bg-amber-50/40">
                  <td className="px-3 py-1.5 text-slate-700">{m.nombre}</td>
                  <td className="px-3 py-1.5 font-mono text-slate-500">{m.codigo}</td>
                </tr>
              ))}
            </tbody>
          </TablaWrapper>
        </div>
      )}
    </div>
  );
}

// ── R-09: Control de umbrales horarios ────────────────────────────────────

// Fuente: consultas-academicas.types.ts — BloqueNormalizado comment
const BLOQUE_NOMBRE: Record<string, string> = {
  Total: 'Total del plan',
  CB: 'Ciencias Básicas (CB)',
  TB: 'Tecnologías Básicas (TB)',
  TA: 'Tecnologías Aplicadas (TA)',
  CX: 'Cs. y Tec. Complementarias (CX)',
};

function FilaDimension({ bloque, dim }: { bloque: string; dim: EvaluacionDimension }) {
  const { horasReales, horasMinimas, diferencia, cumple } = dim;
  const sinUmbral = horasMinimas === null;

  let evaluacionEl: ReactNode;
  if (sinUmbral) {
    evaluacionEl = <span className="text-slate-400 text-[11px]">Sin umbral configurado</span>;
  } else if (cumple === null) {
    evaluacionEl = <span className="text-slate-400">—</span>;
  } else if (cumple) {
    evaluacionEl = (
      <span className="text-emerald-600 font-semibold text-[11px]">
        ✓ Cumple {diferencia !== null && diferencia > 0 && `(+${diferencia} hs)`}
      </span>
    );
  } else {
    evaluacionEl = (
      <span className="text-red-600 font-semibold text-[11px]">
        ✗ Faltan {diferencia !== null ? Math.abs(diferencia) : '?'} hs
      </span>
    );
  }

  return (
    <tr className="hover:bg-slate-50/60">
      <td className="px-3 py-1.5 text-slate-700">{BLOQUE_NOMBRE[bloque] ?? bloque}</td>
      <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-slate-700">
        {horasReales !== null ? `${horasReales} hs` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">
        {horasMinimas !== null ? `${horasMinimas} hs` : '—'}
      </td>
      <td className="px-3 py-1.5 text-right">{evaluacionEl}</td>
    </tr>
  );
}

function DetalleR09({
  valor,
  estadoCalculo,
}: {
  valor: unknown;
  estadoCalculo: string | null;
}) {
  if (estadoCalculo === 'NO_APLICA') {
    return (
      <p className="text-xs text-sky-600">
        El plan no tiene materias registradas. No aplica la evaluación de carga horaria.
      </p>
    );
  }

  if (!valor || typeof valor !== 'object') return <FallbackDetalle valor={valor} />;
  const v = valor as ValorR09;
  const materiasSinHoras = v.materiasSinHoras ?? [];
  const materiasConBloqueIndeterminado = v.materiasConBloqueIndeterminado ?? [];
  const { totalMaterias = 0, horasTotal, evaluaciones } = v;

  return (
    <div className="space-y-3">
      {estadoCalculo === 'NO_DETERMINABLE' && (
        <div className="p-2.5 rounded-lg bg-slate-100 border border-slate-200 text-xs text-slate-600">
          Todas las materias del plan tienen{' '}
          <span className="font-mono">cargaHorariaTotal = null</span>. No es posible calcular los
          totales horarios.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        <Metrica label="Materias evaluadas" valor={totalMaterias} />
        <Metrica label="Horas totales" valor={horasTotal !== null ? `${horasTotal} hs` : '—'} />
        <Metrica
          label="Sin carga horaria"
          valor={materiasSinHoras.length}
          destaca={materiasSinHoras.length > 0}
        />
      </div>

      {evaluaciones && (
        <div>
          <SeccionTitulo>Distribución y umbrales por bloque curricular</SeccionTitulo>
          <TablaWrapper>
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-3 py-2 text-[10px] font-semibold uppercase text-slate-500">Bloque</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-28">Horas reales</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-24">Mínimo</th>
                <th className="text-right px-3 py-2 text-[10px] font-semibold uppercase text-slate-500 w-44">Evaluación</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <FilaDimension bloque="Total" dim={evaluaciones.total} />
              <FilaDimension bloque="CB" dim={evaluaciones.CB} />
              <FilaDimension bloque="TB" dim={evaluaciones.TB} />
              <FilaDimension bloque="TA" dim={evaluaciones.TA} />
              <FilaDimension bloque="CX" dim={evaluaciones.CX} />
            </tbody>
          </TablaWrapper>
          <p className="text-[10px] text-slate-400 mt-1">
            Mínimo &quot;—&quot; indica que el umbral no está configurado en el plan; esa dimensión no se evalúa.
          </p>
        </div>
      )}

      {materiasSinHoras.length > 0 && (
        <div>
          <SeccionTitulo className="text-amber-600">
            Materias sin carga horaria registrada ({materiasSinHoras.length})
          </SeccionTitulo>
          <ul className="space-y-1">
            {materiasSinHoras.map((m) => (
              <li key={m.materiaId} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-amber-400 font-bold mt-0.5 flex-shrink-0">•</span>
                <span>
                  {m.nombre}{' '}
                  <span className="text-slate-400 font-mono text-[11px]">({m.codigo})</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {materiasConBloqueIndeterminado.length > 0 && (
        <div>
          <SeccionTitulo className="text-slate-500">
            Materias con bloque curricular sin clasificar ({materiasConBloqueIndeterminado.length})
          </SeccionTitulo>
          <p className="text-[11px] text-slate-500 mb-1.5">
            Sus horas se incluyen en el total pero no pueden asignarse a ningún bloque.
          </p>
          <ul className="space-y-1">
            {materiasConBloqueIndeterminado.map((m) => (
              <li key={m.materiaId} className="text-xs text-slate-600 flex items-start gap-2">
                <span className="text-slate-400 font-bold mt-0.5 flex-shrink-0">•</span>
                <span>
                  {m.nombre}{' '}
                  <span className="text-slate-400 font-mono text-[11px]">({m.codigo})</span>
                  {m.bloqueConocimientoRaw && (
                    <span className="text-slate-400">
                      {' '}— bloque registrado: <span className="font-mono">{m.bloqueConocimientoRaw}</span>
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Fallback para indicadores no reconocidos ──────────────────────────────

function FallbackDetalle({ valor }: { valor: unknown }) {
  if (valor === null || valor === undefined) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Valor</p>
      <pre className="text-xs bg-slate-100 text-slate-700 rounded-lg p-3 overflow-x-auto font-mono whitespace-pre-wrap max-h-48 leading-relaxed">
        {typeof valor === 'object' ? JSON.stringify(valor, null, 2) : String(valor)}
      </pre>
    </div>
  );
}

// ── Dispatcher principal ───────────────────────────────────────────────────

export function ResultadoIndicadorDetalle({ resultado }: { resultado: ResultadoBase }) {
  const { codigo, estadoCalculo, valor } = resultado;

  if (codigo === 'R-02') return <DetalleR02 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-06') return <DetalleR06 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-07') return <DetalleR07 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-08') return <DetalleR08 valor={valor} estadoCalculo={estadoCalculo} />;
  if (codigo === 'R-09') return <DetalleR09 valor={valor} estadoCalculo={estadoCalculo} />;

  return <FallbackDetalle valor={valor} />;
}
