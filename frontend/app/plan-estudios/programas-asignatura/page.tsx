'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { apiFetch as apiFetchBase, mensajeErrorHttp } from '@/lib/api';
import { getPermisosPrograma } from '@/lib/permisos-plan-estudios';
import { jsPDF } from 'jspdf';

// ── Constantes ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const TOTAL_SECCIONES = 6;
const ITEMS_POR_PAGINA = 10;

const NAV_INTERNA = [
  { label: 'Carreras',                         href: '/plan-estudios/carreras' },
  { label: 'Programas de Asignatura',          href: '/plan-estudios/programas-asignatura' },
  { label: 'Información de Planes de Estudio', href: '/plan-estudios/informacion-planes' },
];

// ── Tipos ─────────────────────────────────────────────────────────────────────

interface Carrera { id: string; nombre: string; facultadId?: string }
interface Plan    { id: string; nombre: string; anio?: number; version?: string; estado: string }

interface MateriaResumen {
  id: string; codigo: string; nombre: string;
  anio?: number; cuatrimestre?: number; estado: string;
  // Datos Generales + S1
  bloqueConocimiento?: string | null;
  modalidadDictado?: string | null;
  // Carga Horaria
  cargaHorariaSemanal?: number | null;
  cargaHorariaTotal?: number | null;
  creditos?: number | null;
  regimenCursado?: string | null;
}

interface ProgramaResumen {
  estadoS1: string; estadoS2: string; estadoS3: string;
  estadoS4: string; estadoS5: string; estadoS6: string;
  estadoPrograma: string;
  estadoFuncional?: string; // devuelto por el backend — INCOMPLETO|EN_CORRECCION|EN_REVISION|APROBADO
}

type EstadoLabel = 'Sin iniciar' | 'En proceso' | 'Completo';

interface MateriaConPrograma extends MateriaResumen {
  programa: ProgramaResumen | null;
  avancePct: number;       // avance del Programa de Asignatura (S1–S6)
  estadoLabel: EstadoLabel;
  estadoPrograma: string;  // estado formal del programa (PENDIENTE / EN_REVISION / APROBADO)
  estadoFuncional: string; // INCOMPLETO | COMPLETO | EN_CORRECCION | EN_REVISION | APROBADO
  avanceGlobal: number;    // promedio de las 4 solapas (Datos Gen. + Corr. + Carga H. + Programa)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Calcula el avance de las 6 secciones del Programa de Asignatura usando
// los estados almacenados en BD (estadoS1–estadoS6), que son la fuente de
// verdad compartida con la ficha individual.
function calcAvance(prog: ProgramaResumen | null): { pct: number; label: EstadoLabel } {
  const estados = [
    prog?.estadoS1 ?? 'PENDIENTE',
    prog?.estadoS2 ?? 'PENDIENTE',
    prog?.estadoS3 ?? 'PENDIENTE',
    prog?.estadoS4 ?? 'PENDIENTE',
    prog?.estadoS5 ?? 'PENDIENTE',
    prog?.estadoS6 ?? 'PENDIENTE',
  ];
  const n   = estados.filter(s => s === 'COMPLETO').length;
  const pct = Math.round((n / TOTAL_SECCIONES) * 100);
  return { pct, label: pct === 0 ? 'Sin iniciar' : pct === 100 ? 'Completo' : 'En proceso' };
}

// Avance global de la asignatura = promedio de las 4 solapas del plan de estudios.
//
// Tab 1 — Datos Generales : % de 4 campos clave completados
//           (bloqueConocimiento, modalidadDictado, anio, cuatrimestre)
// Tab 2 — Correlatividades: 100% si tiene al menos una correlativa cargada,
//           o si es 1° año (sin requisitos previos esperados),
//           o si el año no está asignado (no se puede determinar).
//           0% si es 2°+ año y aún no tiene correlativas.
// Tab 3 — Carga Horaria  : % de 4 campos clave completados
//           (cargaHorariaSemanal, cargaHorariaTotal, creditos, regimenCursado)
// Tab 4 — Programa        : avance S1–S6 calculado por calcAvance()
function calcAvanceGlobal(
  m: MateriaResumen,
  prog: ProgramaResumen | null,
  correlativasCount: number,
): number {
  // Tab 1: Datos Generales
  const dgPct = (
    [m.bloqueConocimiento, m.modalidadDictado, m.anio, m.cuatrimestre]
      .filter(v => v != null && v !== '').length / 4
  ) * 100;

  // Tab 2: Correlatividades
  const corrPct = (correlativasCount > 0 || m.anio === 1 || m.anio == null) ? 100 : 0;

  // Tab 3: Carga Horaria
  const chPct = (
    [
      (m.cargaHorariaSemanal ?? 0) > 0 ? 1 : 0,
      (m.cargaHorariaTotal   ?? 0) > 0 ? 1 : 0,
      (m.creditos            ?? 0) > 0 ? 1 : 0,
      m.regimenCursado               ? 1 : 0,
    ].reduce((a, b) => a + b, 0) / 4
  ) * 100;

  // Tab 4: Programa de Asignatura
  const { pct: progPct } = calcAvance(prog);

  return Math.round((dgPct + corrPct + chPct + progPct) / 4);
}

const ESTADO_FUNC_CFG: Record<string, { label: string; cls: string }> = {
  INCOMPLETO:    { label: 'Incompleto',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
  EN_CORRECCION: { label: 'En corrección', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  EN_REVISION:   { label: 'En revisión',   cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  APROBADO:      { label: 'Aprobado',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
};

const IcSpinner = () => (
  <div className="w-5 h-5 rounded-full border-2 border-slate-200 border-t-[#0f4c81] animate-spin" />
);

// ── Página ────────────────────────────────────────────────────────────────────

export default function ProgramasAsignaturaPage() {
  const pathname  = usePathname();
  const router    = useRouter();
  const { usuario } = useAuth();

  const permisosPrograma = getPermisosPrograma(usuario?.rol?.nombre ?? '');


  const [carreras,        setCarreras]        = useState<Carrera[]>([]);
  const [planes,          setPlanes]          = useState<Plan[]>([]);
  const [materias,        setMaterias]        = useState<MateriaConPrograma[]>([]);
  const [carreraId,       setCarreraId]       = useState('');
  const [planId,          setPlanId]          = useState('');
  const [filtroCodigo,    setFiltroCodigo]    = useState('');
  const [filtroNombre,    setFiltroNombre]    = useState('');
  const [filtroEstado,    setFiltroEstado]    = useState<EstadoLabel | ''>('');
  const [debouncedCodigo, setDebouncedCodigo] = useState('');
  const [debouncedNombre, setDebouncedNombre] = useState('');
  const [pagina,          setPagina]          = useState(1);
  const [cargando,        setCargando]        = useState(false);
  const [cargandoPlanes,  setCargandoPlanes]  = useState(false);
  const [reloadKey,       setReloadKey]       = useState(0);
  const planIdRef = useRef(planId);

  // Scope-aware: DC solo puede editar su carrera; DECANO solo las de su facultad.
  // SECRETARIA_ACADEMICA/RECTORADO tienen scope global → permisosPrograma.editar basta.
  // Declarada después de todos los useState para que carreraId y carreras estén inicializados.
  function puedeEditarEnCarreraSeleccionada(): boolean {
    if (!carreraId) return false;
    const rol = usuario?.rol?.nombre;
    if (rol === 'DIRECTOR_CARRERA') {
      return usuario?.carreraAsociada?.id === carreraId;
    }
    if (rol === 'DECANO') {
      const carrera = carreras.find(c => c.id === carreraId);
      return !!carrera?.facultadId && carrera.facultadId === usuario?.facultadAsociada?.id;
    }
    return permisosPrograma.editar;
  }

  const puedeCompletar = puedeEditarEnCarreraSeleccionada();

  // ── API helper ─────────────────────────────────────────────────────────────

  async function apiFetch(url: string, opts?: RequestInit) {
    const res = await apiFetchBase(url, opts);
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(mensajeErrorHttp(res, data, 'Error en la solicitud'));
    return data;
  }

  // ── Efectos de carga ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!usuario) return;
    apiFetch(`${API_URL}/plan-estudios/carreras`).then(setCarreras).catch(() => {});
  }, [usuario]);

  useEffect(() => {
    if (!carreraId) { setPlanes([]); setPlanId(''); setMaterias([]); return; }
    setCargandoPlanes(true);
    apiFetch(`${API_URL}/plan-estudios?carreraId=${carreraId}`)
      .then(setPlanes).catch(() => {}).finally(() => setCargandoPlanes(false));
    setPlanId('');
    setMaterias([]);
  }, [carreraId]);

  // Mantener ref sincronizada para usarla en el handler de visibilitychange
  useEffect(() => { planIdRef.current = planId; }, [planId]);

  // Resetear filtros cuando cambia el plan (no al recargar por visibilidad)
  useEffect(() => {
    setFiltroCodigo('');
    setFiltroNombre('');
    setFiltroEstado('');
    setDebouncedCodigo('');
    setDebouncedNombre('');
    setPagina(1);
  }, [planId]);

  // Cargar datos: dispara cuando cambia el plan O cuando se solicita recarga
  useEffect(() => {
    if (!planId) { setMaterias([]); return; }
    setCargando(true);
    apiFetch(`${API_URL}/materias?planEstudioId=${planId}`)
      .then(async (mats: MateriaResumen[]) => {
        const [progResults, corrResults] = await Promise.all([
          Promise.allSettled(mats.map(m => apiFetch(`${API_URL}/programas/materia/${m.id}`))),
          Promise.allSettled(mats.map(m => apiFetch(`${API_URL}/materias/${m.id}/correlativas`))),
        ]);

        const enriched: MateriaConPrograma[] = mats.map((m, i) => {
          const prog: ProgramaResumen | null =
            progResults[i].status === 'fulfilled'
              ? (progResults[i] as PromiseFulfilledResult<ProgramaResumen>).value
              : null;
          const corrCount: number =
            corrResults[i].status === 'fulfilled'
              ? ((corrResults[i] as PromiseFulfilledResult<unknown[]>).value?.length ?? 0)
              : 0;
          const { pct, label } = calcAvance(prog);
          const avanceGlobal   = calcAvanceGlobal(m, prog, corrCount);
          const estadoPrograma = prog?.estadoPrograma ?? 'PENDIENTE';
          // El backend ya calcula estadoFuncional y lo devuelve en la respuesta.
          const estadoFuncional = prog?.estadoFuncional ?? 'INCOMPLETO';
          return { ...m, programa: prog, avancePct: pct, estadoLabel: label, estadoPrograma, estadoFuncional, avanceGlobal };
        });
        setMaterias(enriched);
      })
      .catch(() => setMaterias([]))
      .finally(() => setCargando(false));
  }, [planId, reloadKey]);


  // Debounce filtro código
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCodigo(filtroCodigo), 350);
    return () => clearTimeout(t);
  }, [filtroCodigo]);

  // Debounce filtro asignatura
  useEffect(() => {
    const t = setTimeout(() => setDebouncedNombre(filtroNombre), 350);
    return () => clearTimeout(t);
  }, [filtroNombre]);

  // Resetear página al cambiar filtros efectivos
  useEffect(() => { setPagina(1); }, [debouncedCodigo, debouncedNombre, filtroEstado]);

  // Recargar cuando el documento vuelve a ser visible (volver de otra solapa/ficha)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible' && planIdRef.current) {
        setReloadKey(k => k + 1);
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, []);

  // ── Datos derivados ────────────────────────────────────────────────────────

  const filtradas = useMemo(() => {
    const cod = debouncedCodigo.trim().toLowerCase();
    const nom = debouncedNombre.trim().toLowerCase();
    return materias.filter(m =>
      (!cod || m.codigo.toLowerCase().includes(cod)) &&
      (!nom || m.nombre.toLowerCase().normalize('NFC').includes(nom.normalize('NFC'))) &&
      (!filtroEstado || m.estadoLabel === filtroEstado)
    );
  }, [materias, debouncedCodigo, debouncedNombre, filtroEstado]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / ITEMS_POR_PAGINA));
  const paginadas    = filtradas.slice((pagina - 1) * ITEMS_POR_PAGINA, pagina * ITEMS_POR_PAGINA);

  const selectCls = 'w-full text-sm border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81] disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed';

  // ── Exportar PDF ───────────────────────────────────────────────────────────

  function exportarPdf() {
    if (filtradas.length === 0) {
      alert('No hay registros para exportar con los filtros aplicados.');
      return;
    }

    const doc    = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageW  = doc.internal.pageSize.getWidth();   // 841.89
    const pageH  = doc.internal.pageSize.getHeight();  // 595.28
    const ML     = 35;
    const MR     = 35;
    const usableW = pageW - ML - MR;

    const columns = [
      { label: 'Código',      width: 80  },
      { label: 'Asignatura',  width: 340 },
      { label: 'Año',         width: 50  },
      { label: 'Completitud', width: 120 },
      { label: 'Avance',      width: 80  },
    ];

    const carreraNombre = carreras.find(c => c.id === carreraId)?.nombre ?? '';
    const planObj       = planes.find(p => p.id === planId);
    const planNombre    = planObj
      ? `${planObj.nombre}${planObj.anio ? ` (${planObj.anio})` : ''}${planObj.version ? ` v${planObj.version}` : ''}`
      : '';
    const fecha = new Date().toLocaleDateString('es-AR',  { day: '2-digit', month: '2-digit', year: 'numeric' });
    const hora  = new Date().toLocaleTimeString('es-AR',  { hour: '2-digit', minute: '2-digit' });

    const filtrosAplicados: { etiqueta: string; valor: string }[] = [
      ...(debouncedCodigo ? [{ etiqueta: 'Código',     valor: debouncedCodigo }] : []),
      ...(debouncedNombre ? [{ etiqueta: 'Asignatura', valor: debouncedNombre }] : []),
      ...(filtroEstado    ? [{ etiqueta: 'Estado',     valor: filtroEstado    }] : []),
    ];

    const ROW_H      = 20;
    const HDR_H      = 22;
    const FOOTER_TOP = pageH - 38;

    let pageNum = 1;
    let y       = 0;

    // ── Footer ────────────────────────────────────────────────────────────────
    function drawFooter() {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(ML, FOOTER_TOP - 6, pageW - MR, FOOTER_TOP - 6);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(100, 116, 139);
      doc.text('Universidad de la Marina Mercante  ·  Programas de Asignatura', ML, FOOTER_TOP);
      doc.text(`Página ${pageNum}`, pageW - MR, FOOTER_TOP, { align: 'right' });
    }

    // ── Encabezado primera página ─────────────────────────────────────────────
    function drawFirstPageHeader() {
      // Título institucional
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(13);
      doc.setTextColor(15, 76, 129);
      doc.text('UNIVERSIDAD DE LA MARINA MERCANTE', pageW / 2, 34, { align: 'center' });

      doc.setFontSize(10);
      doc.setTextColor(30, 41, 59);
      doc.text('PROGRAMAS DE ASIGNATURA', pageW / 2, 50, { align: 'center' });

      doc.setDrawColor(15, 76, 129);
      doc.setLineWidth(1.2);
      doc.line(ML, 57, pageW - MR, 57);

      // Contexto
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const contexto = [
        carreraNombre ? `Carrera: ${carreraNombre}` : null,
        planNombre    ? `Plan: ${planNombre}`        : null,
      ].filter(Boolean).join('   ·   ');
      doc.text(contexto, ML, 67);
      doc.text(`Generado: ${fecha} ${hora}`, pageW - MR, 67, { align: 'right' });

      // Filtros aplicados
      let fy = 82;
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      if (filtrosAplicados.length === 0) {
        doc.text('FILTROS APLICADOS: NINGUNO', ML, fy);
        fy += 11;
      } else {
        doc.text('FILTROS APLICADOS', ML, fy);
        fy += 11;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        for (const f of filtrosAplicados) {
          doc.text(`${f.etiqueta}: ${f.valor}`, ML + 10, fy);
          fy += 10;
        }
      }

      // Total registros
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);
      doc.text(`TOTAL DE REGISTROS: ${filtradas.length}`, ML, fy + 2);
      fy += 14;

      // Separador antes de la tabla
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(ML, fy, pageW - MR, fy);

      y = fy + 8;
    }

    // ── Encabezado páginas siguientes ────────────────────────────────────────
    function drawContinuationHeader() {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('UNIVERSIDAD DE LA MARINA MERCANTE  ·  PROGRAMAS DE ASIGNATURA', ML, 26);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(ML, 31, pageW - MR, 31);
      y = 42;
    }

    // ── Encabezado de tabla ───────────────────────────────────────────────────
    function drawTableHeader() {
      doc.setFillColor(15, 76, 129);
      doc.rect(ML, y, usableW, HDR_H, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      let x = ML;
      for (const col of columns) {
        doc.text(col.label, x + 5, y + 15);
        x += col.width;
      }
      y += HDR_H;
    }

    // ── Nueva página ─────────────────────────────────────────────────────────
    function newPage() {
      drawFooter();
      doc.addPage();
      pageNum++;
      drawContinuationHeader();
      drawTableHeader();
    }

    // ── Fila de datos ─────────────────────────────────────────────────────────
    function drawRow(values: string[], rowIdx: number) {
      if (y + ROW_H > FOOTER_TOP - 14) newPage();

      if (rowIdx % 2 === 0) {
        doc.setFillColor(248, 250, 252);
      } else {
        doc.setFillColor(255, 255, 255);
      }
      doc.rect(ML, y, usableW, ROW_H, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.25);
      doc.rect(ML, y, usableW, ROW_H);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(30, 41, 59);

      let x = ML;
      for (let i = 0; i < columns.length; i++) {
        const colW = columns[i].width;
        doc.text(values[i] ?? '—', x + 5, y + 13, { maxWidth: colW - 8 });
        if (i < columns.length - 1) {
          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.25);
          doc.line(x + colW, y, x + colW, y + ROW_H);
        }
        x += colW;
      }
      y += ROW_H;
    }

    // ── Generar ───────────────────────────────────────────────────────────────
    drawFirstPageHeader();
    drawTableHeader();

    filtradas.forEach((m, i) => {
      drawRow([
        m.codigo,
        m.nombre,
        m.anio ? `${m.anio}°` : '—',
        m.estadoLabel,
        `${m.avancePct}%`,
      ], i);
    });

    drawFooter();
    doc.save('programas-de-asignatura.pdf');
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl">

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-slate-400 mb-5">
        <a href="/" className="hover:text-slate-600 transition-colors">Inicio</a>
        <span>/</span>
        <a href="/plan-estudios" className="hover:text-slate-600 transition-colors">Plan de Estudios</a>
        <span>/</span>
        <span className="text-slate-600 font-medium">Programas de Asignatura</span>
      </nav>

      {/* Encabezado */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-1">
          Plan de Estudios
        </p>
        <h1 className="text-xl font-bold text-slate-800">Programas de Asignatura</h1>
        <p className="mt-1 text-sm text-slate-500">
          Estado de completitud de los programas analíticos por carrera y plan de estudio.
        </p>
      </div>

      {/* Navegación interna */}
      <div className="flex gap-1 mb-6 border-b border-slate-200 overflow-x-auto">
        {NAV_INTERNA.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
              pathname === item.href
                ? 'border-[#0f4c81] text-[#0f4c81]'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {/* Selectores */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Carrera
            </label>
            <select value={carreraId} onChange={e => setCarreraId(e.target.value)} className={selectCls}>
              <option value="">-- Seleccionar carrera --</option>
              {carreras.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex-1">
            <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
              Plan de Estudio
            </label>
            <select
              value={planId}
              onChange={e => setPlanId(e.target.value)}
              disabled={!carreraId || cargandoPlanes}
              className={selectCls}
            >
              <option value="">-- Seleccionar plan --</option>
              {planes.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre}{p.anio ? ` (${p.anio})` : ''}{p.version ? ` v${p.version}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Estado vacío */}
      {!planId && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <div className="w-10 h-10 rounded-xl bg-[#0f4c81]/8 flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-[#0f4c81]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">Seleccioná una carrera y un plan</p>
          <p className="text-xs text-slate-400 max-w-xs mx-auto">
            Para ver el estado de los programas, elegí la carrera y el plan de estudio.
          </p>
        </div>
      )}

      {/* Contenido principal */}
      {planId && (
        <>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input
              value={filtroCodigo}
              onChange={e => setFiltroCodigo(e.target.value)}
              placeholder="Filtrar por código..."
              className="w-full sm:w-40 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            />
            <input
              value={filtroNombre}
              onChange={e => setFiltroNombre(e.target.value)}
              placeholder="Filtrar por asignatura..."
              className="flex-1 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            />
            <select
              value={filtroEstado}
              onChange={e => setFiltroEstado(e.target.value as EstadoLabel | '')}
              className="w-full sm:w-40 text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/20 focus:border-[#0f4c81]"
            >
              <option value="">Todos los estados</option>
              <option value="Sin iniciar">Sin iniciar</option>
              <option value="En proceso">En proceso</option>
              <option value="Completo">Completo</option>
            </select>
            <span className="text-xs text-slate-400 self-center whitespace-nowrap">
              {filtradas.length} resultado{filtradas.length !== 1 ? 's' : ''}
            </span>
            {permisosPrograma.ver && (
              <button
                type="button"
                onClick={exportarPdf}
                disabled={cargando || filtradas.length === 0}
                className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap font-medium"
              >
                Exportar PDF
              </button>
            )}
          </div>

          {/* Grilla */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {cargando ? (
              <div className="flex items-center justify-center gap-3 py-14">
                <IcSpinner />
                <span className="text-sm text-slate-500">Cargando programas...</span>
              </div>
            ) : filtradas.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                {materias.length === 0
                  ? 'Este plan no tiene asignaturas registradas.'
                  : 'No hay resultados para los filtros aplicados.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-[#0f4c81] text-white text-xs font-semibold uppercase tracking-wider">
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-28">Código</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide">Asignatura</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-16">Año</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-28">Completitud</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-36">Estado</th>
                        <th className="text-left px-4 py-3 font-semibold text-slate-500 uppercase tracking-wide w-40">Avance</th>
                        <th className="px-4 py-3 w-44 text-right font-semibold text-slate-500 uppercase tracking-wide">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {paginadas.map(m => (
                        <FilaPrograma
                          key={m.id}
                          materia={m}
                          puedeCompletar={puedeCompletar}
                          router={router}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
                {totalPaginas > 1 && (
                  <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
                    <span>
                      Mostrando {(pagina - 1) * ITEMS_POR_PAGINA + 1}–{Math.min(pagina * ITEMS_POR_PAGINA, filtradas.length)} de {filtradas.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setPagina(p => Math.max(1, p - 1))}
                        disabled={pagina === 1}
                        className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        ← Anterior
                      </button>
                      <span className="font-semibold text-slate-700">
                        Página {pagina} de {totalPaginas}
                      </span>
                      <button
                        onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                        disabled={pagina === totalPaginas}
                        className="px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
                      >
                        Siguiente →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Fila de la grilla ─────────────────────────────────────────────────────────

function FilaPrograma({
  materia, puedeCompletar, router,
}: {
  materia: MateriaConPrograma;
  puedeCompletar: boolean;
  router: ReturnType<typeof useRouter>;
}) {
  const { avancePct, estadoLabel, estadoFuncional } = materia;

  const estadoCls =
    estadoLabel === 'Completo'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    estadoLabel === 'En proceso'? 'bg-amber-50 text-amber-700 border-amber-200' :
                                  'bg-slate-100 text-slate-500 border-slate-200';

  const funcCfg = ESTADO_FUNC_CFG[estadoFuncional] ?? ESTADO_FUNC_CFG.INCOMPLETO;

  const barCls =
    avancePct === 100 ? 'bg-emerald-500' :
    avancePct > 0     ? 'bg-amber-400'   : 'bg-slate-200';

  const pctColor =
    avancePct === 100 ? '#10b981' :
    avancePct > 0     ? '#f59e0b' : '#94a3b8';

  const fichaUrl = `/plan-estudios/ficha-asignatura?id=${materia.id}&tab=programa`;

  return (
    <tr className="hover:bg-slate-50/50 transition-colors">

      {/* Código */}
      <td className="px-4 py-3">
        <span className="text-[11px] font-bold font-mono bg-[#0f4c81]/8 text-[#0f4c81] px-2 py-0.5 rounded border border-[#0f4c81]/10 whitespace-nowrap">
          {materia.codigo}
        </span>
      </td>

      {/* Asignatura */}
      <td className="px-4 py-3">
        <p className="text-xs font-semibold text-slate-800 leading-tight">{materia.nombre}</p>
        {materia.cuatrimestre != null && (
          <p className="text-[10px] text-slate-400 mt-0.5">
            {materia.cuatrimestre === 0 ? 'Anual' : `${materia.cuatrimestre}° Cuatrimestre`}
          </p>
        )}
      </td>

      {/* Año */}
      <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
        {materia.anio ? `${materia.anio}°` : '—'}
      </td>

      {/* Completitud */}
      <td className="px-4 py-3">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded border whitespace-nowrap ${estadoCls}`}>
          {estadoLabel}
        </span>
      </td>

      {/* Estado institucional */}
      <td className="px-4 py-3">
        <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border whitespace-nowrap ${funcCfg.cls}`}>
          {funcCfg.label}
        </span>
      </td>

      {/* Avance */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden min-w-[5rem]">
            <div
              className={`h-full rounded-full transition-all duration-500 ${barCls}`}
              style={{ width: `${avancePct}%` }}
            />
          </div>
          <span
            className="text-[11px] font-semibold tabular-nums w-9 text-right"
            style={{ color: pctColor }}
          >
            {avancePct}%
          </span>
        </div>
      </td>

      {/* Acciones */}
      <td className="px-4 py-3 text-right">
        <div className="flex items-center justify-end gap-2 flex-wrap">
          {puedeCompletar && (
            <button
              onClick={() => router.push(fichaUrl)}
              className="text-[11px] font-semibold bg-[#0f4c81] text-white px-3 py-1 rounded-lg hover:bg-[#0d3e6b] transition-colors whitespace-nowrap"
            >
              Editar
            </button>
          )}
          <button
            onClick={() => router.push(`/plan-estudios/ficha-asignatura?id=${materia.id}&modo=ver`)}
            className="text-[11px] font-semibold border border-slate-200 text-slate-600 px-3 py-1 rounded-lg hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            Ver
          </button>
        </div>
      </td>
    </tr>
  );
}
