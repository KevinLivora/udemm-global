'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { jsPDF } from 'jspdf';
import { useAuth } from '@/lib/auth-context';
import { apiFetch } from '@/lib/api';
import { normalizarMayusculas } from '@/lib/normalizarMayusculas';

interface FormData {
  nombre: string;
  apellido: string;
  sexo: string;
  fechaNacimiento: string;
  tipoDocumento: string;
  numeroDocumento: string;
  cuit: string;
  pisoDepto: string;
  residencia: string;
  provincia: string;
  localidad: string;
  codigoPostal: string;
  tituloGrado: string;
  tituloPosgrado: string;
  otrosTitulos: string;
  cargoDeclarado: string;
  justificacionPertinencia: string;
  actividadesProfesionales: string;
  antecedentesAcademicos: string;
  unidadAcademica: string;
  categoriaDocente: string;
  dedicacion: string;
  dedicacionDeclaradaSemanal: string;
  tiempoDocencia: string;
  tiempoInvestigacion: string;
  tiempoExtension: string;
  tiempoGestionAcademica: string;
  fechaInicioCargo: string;
  fechaFinCargo: string;
  designacion: string;
  disciplinaCargo: string;
  asignaturasVinculadas: string;
  funcionGestion: string;
  unidadAcademicaGestion: string;
  carreraAsociadaGestion: string;
  tiempoDedicacionGestionSemanal: string;
  fechaInicioGestion: string;
  fechaFinGestion: string;
  normativaDesignacionGestion: string;
  tituloProyectoInvestigacion: string;
  institucionProyectoInvestigacion: string;
  institucionEvaluadoraProyectoInvestigacion: string;
  institucionFinanciadoraProyectoInvestigacion: string;
  fechaInicioProyectoInvestigacion: string;
  fechaFinProyectoInvestigacion: string;
  vinculadoCarreraProyectoInvestigacion: string;
  disciplinasVinculadasProyectoInvestigacion: string;
  sistemaPromocion: string;
  categoriaPromocion: string;
  fechaAltaPromocion: string;
  tituloActividadExtension: string;
  rolActividadExtension: string;
  institucionDestinoActividadExtension: string;
  fechaInicioActividadExtension: string;
  finEstadoActividadExtension: string;
  vinculadaActividadExtension: string;
  carreraFormacionDocenteJson: string;
  areaDisciplinar: string;
  subarea: string;
  areaDisciplinarId: string;
  subareaId: string;
  observacionesArea: string;
  actividadesPosgradoJson: string;
  trayectoriaCargosPasadosJson: string;
  direccionTesisJson: string;
  experienciaDistancia: string;
  cargosAcademicosJson: string;
  otrasDedicacionesJson: string;
  desempenoActualJson: string;
  desempenoPasadoJson: string;
  proyectosInvestigacionJson: string;
  sistemasPromocionInvestigacionJson: string;
  participacionVinculacionJson: string;
  produccionCientificaJson: string;
  actividadesExtensionJson: string;
  reunionesCientificasJson: string;
  comitesJuradosJson: string;
  carreraDocentePosgrado: string;
  actividadesTransferenciaExtension: string;
  premiosDistinciones: string;
  estanciasCursosExterior: string;
  membresiasInstituciones: string;
  registrosPromocionJson: string;
  activo?: boolean;
}

interface TituloGradoItem {
  id: string;
  denominacion: string;
  anio: string;
  pais: string;
  institucion: string;
}

interface TituloGradoForm {
  denominacion: string;
  anio: string;
  pais: string;
  institucion: string;
}

interface TituloPosgradoItem {
  id: string;
  denominacion: string;
  tipo: string;
  tipoId: string;
  anio: string;
  institucion: string;
}

interface TituloPosgradoForm {
  denominacion: string;
  tipo: string;
  tipoId: string;
  anio: string;
  institucion: string;
}

interface OtroTituloItem {
  id: string;
  denominacion: string;
  anio: string;
  institucion: string;
}

interface OtroTituloForm {
  denominacion: string;
  anio: string;
  institucion: string;
}

interface CarreraFormacionDocenteItem {
  id: string;
  denominacion: string;
  institucion: string;
  unidadAcademica: string;
  anio: string;
}

interface CarreraFormacionDocenteForm {
  denominacion: string;
  institucion: string;
  unidadAcademica: string;
  anio: string;
}

interface CargoAcademicoItem {
  id: string;
  cargo: string;
  institucion: string;
  modalidad: string;
  periodoDesde: string;
  periodoHasta: string;
  dedicacionSemanal: string;
}

interface CargoAcademicoForm {
  cargo: string;
  institucion: string;
  modalidad: string;
  periodoDesde: string;
  periodoHasta: string;
  dedicacionSemanal: string;
}

interface OtraDedicacionItem {
  id: string;
  concepto: string;
  horasSeman: string;
}

interface OtraDedicacionForm {
  concepto: string;
  horasSeman: string;
}

interface DesempenoActualItem {
  id: string;
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  cargo: string;
  modalidad: string;
  dedicacionSeman: string;
}

interface DesempenoActualForm {
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  cargo: string;
  modalidad: string;
  dedicacionSeman: string;
}

interface DesempenoPasadoItem {
  id: string;
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  cargo: string;
}

interface DesempenoPasadoForm {
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  cargo: string;
}

interface ProyectoInvestigacionItem {
  id: string;
  codigo: string;
  titulo: string;
  rol: string;
  horasSemanales: string;
}

interface SistemaPromocionInvItem {
  id: string;
  sistema: string;
  categoria: string;
  detalle: string;
  periodoDesde: string;
  periodoHasta: string;
}
interface SistemaPromocionInvForm {
  sistema: string;
  categoria: string;
  detalle: string;
  periodoDesde: string;
  periodoHasta: string;
}
interface ParticipacionVinculacionItem {
  id: string;
  codigo: string;
  actividad: string;
  rol: string;
  horasSemanales: string;
}
interface ParticipacionVinculacionForm {
  codigo: string;
  actividad: string;
  rol: string;
  horasSemanales: string;
}
interface ProduccionCientificaItem {
  id: string;
  tipo: string;
  referenciaBibliografica: string;
  anio: string;
}
interface ProduccionCientificaForm {
  tipo: string;
  referenciaBibliografica: string;
  anio: string;
}

interface ComiteJuradoItem {
  id: string;
  organismoConvocante: string;
  lugar: string;
  tipoEvaluacion: string;
  fecha: string;
}
interface ComiteJuradoForm {
  organismoConvocante: string;
  lugar: string;
  tipoEvaluacion: string;
  fecha: string;
}

interface ReunionCientificaItem {
  id: string;
  titulo: string;
  lugar: string;
  formaParticipacion: string;
  tipo: string;
  fecha: string;
}
interface ReunionCientificaForm {
  titulo: string;
  lugar: string;
  formaParticipacion: string;
  tipo: string;
  fecha: string;
}

interface ActividadExtensionItem {
  id: string;
  titulo: string;
  rol: string;
  horasSemanales: string;
  institucionDestino: string;
  vinculacionCarrera: string;
  carreraVinculada: string;
  fechaInicio: string;
  fechaFin: string;
}

interface RegistroPromocionItem {
  id: string;
  sistema: string;
  categoria: string;
  fechaAlta: string;
}

interface SituacionActualItem {
  id: string;
  carrera: string;
  asignatura: string;
  plan: string;
  catedra: string;
  anioInicio: string;
  cargo: string;
  modalidad: string;
  designacion: string;
  disciplinaSubdisciplina: string;
}

interface SituacionActualForm {
  carrera: string;
  asignatura: string;
  plan: string;
  catedra: string;
  anioInicio: string;
  cargo: string;
  modalidad: string;
  designacion: string;
  disciplinaSubdisciplina: string;
}

interface AreaDisciplinarItem {
  id: string;
  nombre: string;
}

interface SubareaItem {
  id: string;
  nombre: string;
  areaDisciplinarId: string;
}

interface VinculacionAprobada {
  id: string;
  estado: string;
  horasSemana: number | null;
  anioInicio: number | null;
  fechaAprobacion: string | null;
  facultad:    { nombre: string };
  carrera:     { nombre: string };
  planEstudio: { nombre: string; codigo?: string };
  materia:     { nombre: string; codigo?: string };
  catedra:     { nombre: string };
  cargo:       { nombre: string };
  modalidad:   { nombre: string };
  designacion: { nombre: string };
  aprobador?:  { nombre: string; apellido: string } | null;
}

interface ActividadPosgradoItem {
  id: string;
  carrerasPosgrado: string;
  actividadCurricular: string;
  plan: string;
  anioInicio: string;
}

interface ActividadPosgradoForm {
  carrerasPosgrado: string;
  actividadCurricular: string;
  plan: string;
  anioInicio: string;
}

interface TrayectoriaCargoItem {
  id: string;
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  unidadAcademica: string;
  cargo: string;
  cargoId?: string;
  modalidad: string;
  modalidadId?: string;
  dedicacionSem: string;
}

interface TrayectoriaCargoForm {
  periodoDesde: string;
  periodoHasta: string;
  institucion: string;
  unidadAcademica: string;
  cargo: string;
  cargoId: string;
  modalidad: string;
  modalidadId: string;
  dedicacionSem: string;
}

interface DireccionTesisSummary {
  tesisDoctoralesConcluidas: string;
  tesisDoctoralesActuales: string;
  tesisMaestriaConcluidas: string;
  tesisMaestriaActuales: string;
  trabajosFinalesConcluidos: string;
  trabajosFinalesActuales: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000';
const TAB_TITLES = [
  { numero: '1', texto: 'Datos personales' },
  { numero: '2', texto: 'Formacion' },
  { numero: '3', texto: 'Área de desempeño' },
  { numero: '4', texto: 'Docencia universitaria' },
  { numero: '5', texto: 'Gestión Académica' },
  { numero: '6', texto: 'Desempeño No Académico' },
  { numero: '7', texto: 'Investigación' },
  { numero: '8', texto: 'Reuniones Científicas' },
  { numero: '9', texto: 'Comités y Jurados' },
  { numero: '10', texto: 'Otra Información' },
];
const SOLO_CARACTERES_REGEX = /^[\p{L}\s'\-]+$/u;
const SOLO_ALFANUMERICO_REGEX = /^[\p{L}\p{N}\s'.,\-()\/:;°+&#º]+$/u;
const SOLO_NUMEROS_REGEX = /^\d+$/;
const ANIO_REGEX = /^\d{4}$/;

function parseTitulosGrado(rawValue: unknown): TituloGradoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `titulo-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        anio: String(item.anio ?? ''),
        pais: String(item.pais ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseTitulosPosgrado(rawValue: unknown): TituloPosgradoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `posgrado-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        tipo: String(item.tipo ?? '').toUpperCase(),
        tipoId: String(item.tipoId ?? ''),
        anio: String(item.anio ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseOtrosTitulos(rawValue: unknown): OtroTituloItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `otro-titulo-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        anio: String(item.anio ?? ''),
        institucion: String(item.institucion ?? '')
      }));
  } catch {
    return [];
  }
}

function parseCarreraFormacionDocente(rawValue: unknown): CarreraFormacionDocenteItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `carrera-fd-${Date.now()}-${index}`,
        denominacion: String(item.denominacion ?? ''),
        institucion: String(item.institucion ?? ''),
        unidadAcademica: String(item.unidadAcademica ?? ''),
        anio: String(item.anio ?? '')
      }));
  } catch {
    return [];
  }
}

function parseSituacionActual(rawValue: unknown): SituacionActualItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `situacion-${Date.now()}-${index}`,
        carrera: String(item.carrera ?? ''),
        asignatura: String(item.asignatura ?? ''),
        plan: String(item.plan ?? ''),
        catedra: String(item.catedra ?? ''),
        anioInicio: String(item.anioInicio ?? ''),
        cargo: String(item.cargo ?? ''),
        modalidad: String(item.modalidad ?? ''),
        designacion: String(item.designacion ?? ''),
        disciplinaSubdisciplina: String(item.disciplinaSubdisciplina ?? '')
      }));
  } catch {
    return [];
  }
}

function parseActividadesPosgrado(rawValue: unknown): ActividadPosgradoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `posgrado-${Date.now()}-${index}`,
        carrerasPosgrado: String(item.carrerasPosgrado ?? ''),
        actividadCurricular: String(item.actividadCurricular ?? ''),
        plan: String(item.plan ?? ''),
        anioInicio: String(item.anioInicio ?? '')
      }));
  } catch {
    return [];
  }
}

function parseTrayectoriaCargosPasados(rawValue: unknown): TrayectoriaCargoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `trayectoria-${Date.now()}-${index}`,
        periodoDesde: String(item.periodoDesde ?? ''),
        periodoHasta: String(item.periodoHasta ?? ''),
        institucion: String(item.institucion ?? ''),
        unidadAcademica: String(item.unidadAcademica ?? ''),
        cargo: String(item.cargo ?? ''),
        cargoId: typeof item.cargoId === 'string' ? item.cargoId : undefined,
        modalidad: String(item.modalidad ?? ''),
        modalidadId: typeof item.modalidadId === 'string' ? item.modalidadId : undefined,
        dedicacionSem: String(item.dedicacionSem ?? '')
      }));
  } catch {
    return [];
  }
}

const TESIS_DEFAULTS: DireccionTesisSummary = {
  tesisDoctoralesConcluidas: '', tesisDoctoralesActuales: '',
  tesisMaestriaConcluidas: '', tesisMaestriaActuales: '',
  trabajosFinalesConcluidos: '', trabajosFinalesActuales: ''
};

function parseDireccionTesisSummary(rawValue: unknown): DireccionTesisSummary {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return { ...TESIS_DEFAULTS };
  try {
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== 'object' || Array.isArray(parsed) || parsed === null) return { ...TESIS_DEFAULTS };
    return {
      tesisDoctoralesConcluidas: String(parsed.tesisDoctoralesConcluidas ?? ''),
      tesisDoctoralesActuales: String(parsed.tesisDoctoralesActuales ?? ''),
      tesisMaestriaConcluidas: String(parsed.tesisMaestriaConcluidas ?? ''),
      tesisMaestriaActuales: String(parsed.tesisMaestriaActuales ?? ''),
      trabajosFinalesConcluidos: String(parsed.trabajosFinalesConcluidos ?? ''),
      trabajosFinalesActuales: String(parsed.trabajosFinalesActuales ?? '')
    };
  } catch {
    return { ...TESIS_DEFAULTS };
  }
}

function formatearPeriodo(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 6);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}-${digits.slice(2)}`;
}

function parseCargosAcademicos(rawValue: unknown): CargoAcademicoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `cargo-${Date.now()}-${index}`,
        cargo: String(item.cargo ?? ''),
        institucion: String(item.institucion ?? ''),
        modalidad: String(item.modalidad ?? ''),
        periodoDesde: String(item.periodoDesde ?? ''),
        periodoHasta: String(item.periodoHasta ?? ''),
        dedicacionSemanal: String(item.dedicacionSemanal ?? '')
      }));
  } catch {
    return [];
  }
}

function parseOtrasDedicaciones(rawValue: unknown): OtraDedicacionItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `otra-ded-${Date.now()}-${index}`,
        concepto: String(item.concepto ?? ''),
        horasSeman: String(item.horasSeman ?? '')
      }));
  } catch {
    return [];
  }
}

function parseDesempenoActual(rawValue: unknown): DesempenoActualItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `desact-${Date.now()}-${index}`,
        periodoDesde: String(item.periodoDesde ?? ''),
        periodoHasta: String(item.periodoHasta ?? ''),
        institucion: String(item.institucion ?? ''),
        cargo: String(item.cargo ?? ''),
        modalidad: String(item.modalidad ?? ''),
        dedicacionSeman: String(item.dedicacionSeman ?? '')
      }));
  } catch {
    return [];
  }
}

function parseDesempenoPasado(rawValue: unknown): DesempenoPasadoItem[] {
  if (typeof rawValue !== 'string' || rawValue.trim() === '') return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item) => item && typeof item === 'object')
      .map((item: any, index: number) => ({
        id: typeof item.id === 'string' && item.id ? item.id : `despas-${Date.now()}-${index}`,
        periodoDesde: String(item.periodoDesde ?? ''),
        periodoHasta: String(item.periodoHasta ?? ''),
        institucion: String(item.institucion ?? ''),
        cargo: String(item.cargo ?? '')
      }));
  } catch {
    return [];
  }
}

export default function MiFichaPage() {
  const router = useRouter();
  const { usuario } = useAuth();
  const [docenteIdDesdeListado, setDocenteIdDesdeListado] = useState<string | null>(null);
  const [esNuevoDocente, setEsNuevoDocente] = useState(false);
  const [nuevoDocenteId, setNuevoDocenteId] = useState<string | null>(null);
  const [queryReady, setQueryReady] = useState(false);
  const esVistaDesdeListado = Boolean(docenteIdDesdeListado);
  const esRolDocente = usuario?.rol?.nombre === 'DOCENTE';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData | null>(null);
  const isComposingRef = useRef(false);
  const puedeEditarFicha = esNuevoDocente || (esRolDocente || esVistaDesdeListado) && Boolean(formData?.activo);
  const puedeDarBajaLogica =
    esVistaDesdeListado &&
    ['ADMINISTRADOR_SISTEMA', 'RECTORADO', 'DECANO', 'SECRETARIA_ACADEMICA'].includes(usuario?.rol?.nombre ?? '');
  const [activeTab, setActiveTab] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormData, string>>>({});

  const [titulosGrado, setTitulosGrado] = useState<TituloGradoItem[]>([]);
  const [tituloForm, setTituloForm] = useState<TituloGradoForm>({ denominacion: '', anio: '', pais: '', institucion: '' });
  const [tituloErrors, setTituloErrors] = useState<Partial<Record<keyof TituloGradoForm, string>>>({});
  const [editandoTituloId, setEditandoTituloId] = useState<string | null>(null);
  const [mostrarFormGrado, setMostrarFormGrado] = useState(false);
  const [titulosPosgrado, setTitulosPosgrado] = useState<TituloPosgradoItem[]>([]);
  const [tiposPosgrado, setTiposPosgrado] = useState<{ id: string; nombre: string }[]>([]);
  const [posgradoForm, setPosgradoForm] = useState<TituloPosgradoForm>({ denominacion: '', tipo: '', tipoId: '', anio: '', institucion: '' });
  const [posgradoErrors, setPosgradoErrors] = useState<Partial<Record<keyof TituloPosgradoForm, string>>>({});
  const [editandoPosgradoId, setEditandoPosgradoId] = useState<string | null>(null);
  const [mostrarFormPosgrado, setMostrarFormPosgrado] = useState(false);
  const [otrosTitulos, setOtrosTitulos] = useState<OtroTituloItem[]>([]);
  const [otroTituloForm, setOtroTituloForm] = useState<OtroTituloForm>({ denominacion: '', anio: '', institucion: '' });
  const [otroTituloErrors, setOtroTituloErrors] = useState<Partial<Record<keyof OtroTituloForm, string>>>({});
  const [editandoOtroTituloId, setEditandoOtroTituloId] = useState<string | null>(null);
  const [mostrarFormOtroTitulo, setMostrarFormOtroTitulo] = useState(false);
  const [carrerasFormacionDocente, setCarrerasFormacionDocente] = useState<CarreraFormacionDocenteItem[]>([]);
  const [carreraFormDoc, setCarreraFormDoc] = useState<CarreraFormacionDocenteForm>({ denominacion: '', institucion: '', unidadAcademica: '', anio: '' });
  const [carreraFormDocErrors, setCarreraFormDocErrors] = useState<Partial<Record<keyof CarreraFormacionDocenteForm, string>>>({});
  const [editandoCarreraFormDocId, setEditandoCarreraFormDocId] = useState<string | null>(null);
  const [mostrarFormCarreraFormDoc, setMostrarFormCarreraFormDoc] = useState(false);
  const [situacionActual, setSituacionActual] = useState<SituacionActualItem[]>([]);
  const [situacionActualForm, setSituacionActualForm] = useState<SituacionActualForm>({ carrera: '', asignatura: '', plan: '', catedra: '', anioInicio: '', cargo: '', modalidad: '', designacion: '', disciplinaSubdisciplina: '' });
  const [situacionActualErrors, setSituacionActualErrors] = useState<Partial<Record<keyof SituacionActualForm, string>>>({});
  const [editandoSituacionId, setEditandoSituacionId] = useState<string | null>(null);
  const [mostrarFormSituacionActual, setMostrarFormSituacionActual] = useState(false);
  const [vinculacionesAprobadas, setVinculacionesAprobadas] = useState<VinculacionAprobada[]>([]);
  const [loadingVinculaciones, setLoadingVinculaciones] = useState(false);
  const [areasDisciplinares, setAreasDisciplinares] = useState<AreaDisciplinarItem[]>([]);
  const [subareas, setSubareas] = useState<SubareaItem[]>([]);
  const [actividadesPosgrado, setActividadesPosgrado] = useState<ActividadPosgradoItem[]>([]);
  const [actividadPosgradoForm, setActividadPosgradoForm] = useState<ActividadPosgradoForm>({ carrerasPosgrado: '', actividadCurricular: '', plan: '', anioInicio: '' });
  const [actividadPosgradoErrors, setActividadPosgradoErrors] = useState<Partial<Record<keyof ActividadPosgradoForm, string>>>({});
  const [editandoActPosgradoId, setEditandoActPosgradoId] = useState<string | null>(null);
  const [mostrarFormActPosgrado, setMostrarFormActPosgrado] = useState(false);
  const [trayectoriaCargosPasados, setTrayectoriaCargosPasados] = useState<TrayectoriaCargoItem[]>([]);
  const [trayectoriaCargoForm, setTrayectoriaCargoForm] = useState<TrayectoriaCargoForm>({ periodoDesde: '', periodoHasta: '', institucion: '', unidadAcademica: '', cargo: '', cargoId: '', modalidad: '', modalidadId: '', dedicacionSem: '' });
  const [trayectoriaCargoErrors, setTrayectoriaCargoErrors] = useState<Partial<Record<keyof TrayectoriaCargoForm, string>>>({});
  const [cargosOpciones, setCargosOpciones] = useState<{ id: string; nombre: string }[]>([]);
  const [modalidadesOpciones, setModalidadesOpciones] = useState<{ id: string; nombre: string }[]>([]);
  const [editandoTrayectoriaId, setEditandoTrayectoriaId] = useState<string | null>(null);
  const [mostrarFormTrayectoria, setMostrarFormTrayectoria] = useState(false);
  const [direccionTesisSummary, setDireccionTesisSummary] = useState<DireccionTesisSummary>({ ...TESIS_DEFAULTS });
  const [editProyectoInv, setEditProyectoInv] = useState(false);
  const [editSistemaPromocion, setEditSistemaPromocion] = useState(false);
  const [editActividadExtension, setEditActividadExtension] = useState(false);
  const [cargosAcademicos, setCargosAcademicos] = useState<CargoAcademicoItem[]>([]);
  const [cargoForm, setCargoForm] = useState<CargoAcademicoForm>({ cargo: '', institucion: '', modalidad: '', periodoDesde: '', periodoHasta: '', dedicacionSemanal: '' });
  const [cargoErrors, setCargoErrors] = useState<Partial<Record<keyof CargoAcademicoForm, string>>>({});
  const [editandoCargoId, setEditandoCargoId] = useState<string | null>(null);
  const [mostrarFormCargo, setMostrarFormCargo] = useState(false);
  const [otrasDedicaciones, setOtrasDedicaciones] = useState<OtraDedicacionItem[]>([]);
  const [otraDedicacionForm, setOtraDedicacionForm] = useState<OtraDedicacionForm>({ concepto: '', horasSeman: '' });
  const [otraDedicacionErrors, setOtraDedicacionErrors] = useState<Partial<Record<keyof OtraDedicacionForm, string>>>({});
  const [editandoOtraDedicacionId, setEditandoOtraDedicacionId] = useState<string | null>(null);
  const [mostrarFormOtraDedicacion, setMostrarFormOtraDedicacion] = useState(false);
  const [desempenoActual, setDesempenoActual] = useState<DesempenoActualItem[]>([]);
  const [desempenoActualForm, setDesempenoActualForm] = useState<DesempenoActualForm>({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '', modalidad: '', dedicacionSeman: '' });
  const [desempenoActualErrors, setDesempenoActualErrors] = useState<Partial<Record<keyof DesempenoActualForm, string>>>({});
  const [editandoDesActualId, setEditandoDesActualId] = useState<string | null>(null);
  const [mostrarFormDesActual, setMostrarFormDesActual] = useState(false);
  const [desempenoPasado, setDesempenoPasado] = useState<DesempenoPasadoItem[]>([]);
  const [desempenoPasadoForm, setDesempenoPasadoForm] = useState<DesempenoPasadoForm>({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '' });
  const [desempenoPasadoErrors, setDesempenoPasadoErrors] = useState<Partial<Record<keyof DesempenoPasadoForm, string>>>({});
  const [editandoDesPasadoId, setEditandoDesPasadoId] = useState<string | null>(null);
  const [mostrarFormDesPasado, setMostrarFormDesPasado] = useState(false);
  const [proyectosInvestigacion, setProyectosInvestigacion] = useState<ProyectoInvestigacionItem[]>([]);
  const [proyectoForm, setProyectoForm] = useState({ codigo: '', titulo: '', rol: '', horasSemanales: '' });
  const [proyectoErrors, setProyectoErrors] = useState<Partial<Record<'codigo' | 'titulo' | 'rol' | 'horasSemanales', string>>>({});
  const [editandoProyectoId, setEditandoProyectoId] = useState<string | null>(null);
  const [mostrarFormProyecto, setMostrarFormProyecto] = useState(false);
  const [sistemasPromocionInv, setSistemasPromocionInv] = useState<SistemaPromocionInvItem[]>([]);
  const [sistemaPromocionInvForm, setSistemaPromocionInvForm] = useState<SistemaPromocionInvForm>({ sistema: '', categoria: '', detalle: '', periodoDesde: '', periodoHasta: '' });
  const [sistemaPromocionInvErrors, setSistemaPromocionInvErrors] = useState<Partial<Record<keyof SistemaPromocionInvForm, string>>>({});
  const [editandoSistPromoInvId, setEditandoSistPromoInvId] = useState<string | null>(null);
  const [mostrarFormSistPromoInv, setMostrarFormSistPromoInv] = useState(false);
  const [participacionVinculacion, setParticipacionVinculacion] = useState<ParticipacionVinculacionItem[]>([]);
  const [participacionVinculacionForm, setParticipacionVinculacionForm] = useState<ParticipacionVinculacionForm>({ codigo: '', actividad: '', rol: '', horasSemanales: '' });
  const [participacionVinculacionErrors, setParticipacionVinculacionErrors] = useState<Partial<Record<keyof ParticipacionVinculacionForm, string>>>({});
  const [editandoPartVinculacionId, setEditandoPartVinculacionId] = useState<string | null>(null);
  const [mostrarFormPartVinculacion, setMostrarFormPartVinculacion] = useState(false);
  const [produccionCientifica, setProduccionCientifica] = useState<ProduccionCientificaItem[]>([]);
  const [produccionCientificaForm, setProduccionCientificaForm] = useState<ProduccionCientificaForm>({ tipo: '', referenciaBibliografica: '', anio: '' });
  const [produccionCientificaErrors, setProduccionCientificaErrors] = useState<Partial<Record<keyof ProduccionCientificaForm, string>>>({});
  const [editandoProdCientId, setEditandoProdCientId] = useState<string | null>(null);
  const [mostrarFormProdCient, setMostrarFormProdCient] = useState(false);
  const [comitesJurados, setComitesJurados] = useState<ComiteJuradoItem[]>([]);
  const [comiteJuradoForm, setComiteJuradoForm] = useState<ComiteJuradoForm>({ organismoConvocante: '', lugar: '', tipoEvaluacion: '', fecha: '' });
  const [comiteJuradoErrors, setComiteJuradoErrors] = useState<Partial<Record<keyof ComiteJuradoForm, string>>>({});
  const [editandoComiteId, setEditandoComiteId] = useState<string | null>(null);
  const [mostrarFormComite, setMostrarFormComite] = useState(false);
  const [reunionesCientificas, setReunionesCientificas] = useState<ReunionCientificaItem[]>([]);
  const [reunionCientificaForm, setReunionCientificaForm] = useState<ReunionCientificaForm>({ titulo: '', lugar: '', formaParticipacion: '', tipo: '', fecha: '' });
  const [reunionCientificaErrors, setReunionCientificaErrors] = useState<Partial<Record<keyof ReunionCientificaForm, string>>>({});
  const [editandoReunionId, setEditandoReunionId] = useState<string | null>(null);
  const [mostrarFormReunion, setMostrarFormReunion] = useState(false);
  const [actividadesExtension, setActividadesExtension] = useState<ActividadExtensionItem[]>([]);
  const [actividadForm, setActividadForm] = useState({ titulo: '', rol: '', horasSemanales: '', institucionDestino: '', vinculacionCarrera: '', carreraVinculada: '', fechaInicio: '', fechaFin: '' });
  const [registrosPromocion, setRegistrosPromocion] = useState<RegistroPromocionItem[]>([]);
  const [registroPromocionForm, setRegistroPromocionForm] = useState({ sistema: '', categoria: '', fechaAlta: '' });

  function normalizarFechaSoloDia(valor: string) {
    if (!valor) return '';
    return valor.includes('T') ? valor.split('T')[0] : valor;
  }

  function formatFechaCorta(iso: string | null | undefined) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    setDocenteIdDesdeListado(params.get('docenteId'));
    setEsNuevoDocente(params.get('modo') === 'nuevo');
    setQueryReady(true);
  }, []);

  useEffect(() => {
    if (!queryReady || esNuevoDocente || !usuario) return;
    setLoadingVinculaciones(true);
    const qp = new URLSearchParams({ estado: 'APROBADA' });
    if (esVistaDesdeListado && docenteIdDesdeListado) qp.set('docenteId', docenteIdDesdeListado);
    apiFetch(`${API_URL}/vinculaciones-catedra?${qp}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => setVinculacionesAprobadas(Array.isArray(data) ? data : []))
      .catch(() => setVinculacionesAprobadas([]))
      .finally(() => setLoadingVinculaciones(false));
  }, [queryReady, esNuevoDocente, usuario, docenteIdDesdeListado, esVistaDesdeListado]);

  useEffect(() => {
    apiFetch(`${API_URL}/configuracion/tablas-maestras/areas-disciplinares/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setAreasDisciplinares(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch(`${API_URL}/configuracion/subareas/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSubareas(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch(`${API_URL}/configuracion/tablas-maestras/cargos/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setCargosOpciones(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch(`${API_URL}/configuracion/tablas-maestras/modalidades/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setModalidadesOpciones(Array.isArray(d) ? d : []))
      .catch(() => {});
    apiFetch(`${API_URL}/configuracion/tablas-maestras/tipos-posgrado/activos`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setTiposPosgrado(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!queryReady) return;
    if (esNuevoDocente) {
      setFormData({
        nombre: '', apellido: '', sexo: '', fechaNacimiento: '',
        tipoDocumento: 'DNI', numeroDocumento: '', cuit: '',
        pisoDepto: '', residencia: 'ARGENTINA',
        provincia: '', localidad: '', codigoPostal: '',
        tituloGrado: '', tituloPosgrado: '', otrosTitulos: '', carreraFormacionDocenteJson: '',
        cargoDeclarado: '', justificacionPertinencia: '',
        actividadesProfesionales: '', antecedentesAcademicos: '',
        unidadAcademica: '', categoriaDocente: '', dedicacion: '',
        dedicacionDeclaradaSemanal: '', tiempoDocencia: '',
        tiempoInvestigacion: '', tiempoExtension: '', tiempoGestionAcademica: '',
        fechaInicioCargo: '', fechaFinCargo: '', designacion: '', disciplinaCargo: '',
        asignaturasVinculadas: '',
        actividadesPosgradoJson: '', trayectoriaCargosPasadosJson: '', direccionTesisJson: '', experienciaDistancia: '',
        funcionGestion: '', unidadAcademicaGestion: '',
        tiempoDedicacionGestionSemanal: '', fechaInicioGestion: '',
        fechaFinGestion: '', carreraAsociadaGestion: '', normativaDesignacionGestion: '',
        cargosAcademicosJson: '', otrasDedicacionesJson: '',
        desempenoActualJson: '', desempenoPasadoJson: '',
        tituloProyectoInvestigacion: '', institucionProyectoInvestigacion: '',
        institucionEvaluadoraProyectoInvestigacion: '', institucionFinanciadoraProyectoInvestigacion: '',
        fechaInicioProyectoInvestigacion: '', fechaFinProyectoInvestigacion: '',
        vinculadoCarreraProyectoInvestigacion: '', disciplinasVinculadasProyectoInvestigacion: '',
        proyectosInvestigacionJson: '',
        sistemasPromocionInvestigacionJson: '', participacionVinculacionJson: '', produccionCientificaJson: '',
        tituloActividadExtension: '', rolActividadExtension: '',
        institucionDestinoActividadExtension: '', fechaInicioActividadExtension: '',
        finEstadoActividadExtension: '', vinculadaActividadExtension: '',
        actividadesExtensionJson: '',
        reunionesCientificasJson: '',
        comitesJuradosJson: '',
        carreraDocentePosgrado: '',
        actividadesTransferenciaExtension: '',
        premiosDistinciones: '',
        estanciasCursosExterior: '',
        membresiasInstituciones: '',
        sistemaPromocion: '', categoriaPromocion: '', fechaAltaPromocion: '',
        registrosPromocionJson: '',
        areaDisciplinar: '', subarea: '', areaDisciplinarId: '', subareaId: '', observacionesArea: '',
        activo: true,
      });
      setEditMode(true);
      setLoading(false);
      return;
    }
    if (!usuario) return;
    if (!esRolDocente && !esVistaDesdeListado) {
      router.push('/docentes');
      return;
    }
    cargarFicha();
  }, [usuario, router, esRolDocente, esVistaDesdeListado, docenteIdDesdeListado, queryReady, esNuevoDocente]);

  async function cargarFicha(silencioso = false) {
    if (!silencioso) setLoading(true);
    setError(null);
    if (!silencioso) setSuccessMessage(null);

    try {
      const endpoint = esVistaDesdeListado && docenteIdDesdeListado
        ? `${API_URL}/docentes/${docenteIdDesdeListado}`
        : `${API_URL}/docentes/mi-ficha`;
      const res = await apiFetch(endpoint);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Error ${res.status}`);
      }

      const data = await res.json();
      const titulos = parseTitulosGrado(data.tituloGrado);
      const posgrados = parseTitulosPosgrado(data.tituloPosgrado);
      const otros = parseOtrosTitulos(data.otrosTitulos);
      const carrerasFD = parseCarreraFormacionDocente(data.carreraFormacionDocenteJson);
      const asignaturas = parseSituacionActual(data.asignaturasVinculadas);
      const actPosgrado = parseActividadesPosgrado(data.actividadesPosgradoJson);
      const trayectoria = parseTrayectoriaCargosPasados(data.trayectoriaCargosPasadosJson);
      const dirTesis = parseDireccionTesisSummary(data.direccionTesisJson);
      setTitulosGrado(titulos);
      setTitulosPosgrado(posgrados);
      setOtrosTitulos(otros);
      setCarrerasFormacionDocente(carrerasFD);
      setSituacionActual(asignaturas);
      setActividadesPosgrado(actPosgrado);
      setTrayectoriaCargosPasados(trayectoria);
      setDireccionTesisSummary(dirTesis);
      setFormData({
        nombre: data.nombre ?? usuario?.nombre ?? '',
        apellido: data.apellido ?? usuario?.apellido ?? '',
        sexo: data.sexo ?? '',
        fechaNacimiento: data.fechaNacimiento ? normalizarFechaSoloDia(String(data.fechaNacimiento)) : '',
        tipoDocumento: data.tipoDocumento ?? 'DNI',
        numeroDocumento: ((d) => d.length <= 8 ? d : '')((data.numeroDocumento ?? '').replace(/\D/g, '')),
        cuit: data.cuit ?? '',
        pisoDepto: data.pisoDepto ?? '',
        residencia: data.residencia ? normalizarMayusculas(data.residencia) : 'ARGENTINA',
        provincia: data.provincia ?? '',
        localidad: data.localidad ?? '',
        codigoPostal: data.codigoPostal ?? '',
        tituloGrado: titulos.length ? JSON.stringify(titulos) : '',
        tituloPosgrado: posgrados.length ? JSON.stringify(posgrados) : '',
        otrosTitulos: otros.length ? JSON.stringify(otros) : '',
        carreraFormacionDocenteJson: carrerasFD.length ? JSON.stringify(carrerasFD) : '',
        cargoDeclarado: data.cargoDeclarado ?? '',
        justificacionPertinencia: data.justificacionPertinencia ?? '',
        actividadesProfesionales: data.actividadesProfesionales ?? '',
        antecedentesAcademicos: data.antecedentesAcademicos ?? '',
        unidadAcademica: data.unidadAcademica ?? '',
        categoriaDocente: data.categoriaDocente ?? '',
        dedicacion: data.dedicacion ?? '',
        dedicacionDeclaradaSemanal: data.dedicacionDeclaradaSemanal ?? '',
        tiempoDocencia: data.tiempoDocencia ?? '',
        tiempoInvestigacion: data.tiempoInvestigacion ?? '',
        tiempoExtension: data.tiempoExtension ?? '',
        tiempoGestionAcademica: data.tiempoGestionAcademica ?? '',
        fechaInicioCargo: data.fechaInicioCargo ? normalizarFechaSoloDia(String(data.fechaInicioCargo)) : '',
        fechaFinCargo: data.fechaFinCargo ? normalizarFechaSoloDia(String(data.fechaFinCargo)) : '',
        designacion: data.designacion ?? '',
        disciplinaCargo: data.disciplinaCargo ?? '',
        asignaturasVinculadas: asignaturas.length ? JSON.stringify(asignaturas) : '',
        actividadesPosgradoJson: actPosgrado.length ? JSON.stringify(actPosgrado) : '',
        trayectoriaCargosPasadosJson: trayectoria.length ? JSON.stringify(trayectoria) : '',
        direccionTesisJson: JSON.stringify(dirTesis),
        experienciaDistancia: data.experienciaDistancia ?? '',
        funcionGestion: data.funcionGestion ?? '',
        unidadAcademicaGestion: data.unidadAcademicaGestion ?? '',
        carreraAsociadaGestion: data.carreraAsociadaGestion ?? '',
        tiempoDedicacionGestionSemanal: data.tiempoDedicacionGestionSemanal ?? '',
        fechaInicioGestion: data.fechaInicioGestion ? normalizarFechaSoloDia(String(data.fechaInicioGestion)) : '',
        fechaFinGestion: data.fechaFinGestion ? normalizarFechaSoloDia(String(data.fechaFinGestion)) : '',
        normativaDesignacionGestion: data.normativaDesignacionGestion ?? '',
        tituloProyectoInvestigacion: data.tituloProyectoInvestigacion ?? '',
        institucionProyectoInvestigacion: data.institucionProyectoInvestigacion ?? '',
        institucionEvaluadoraProyectoInvestigacion: data.institucionEvaluadoraProyectoInvestigacion ?? '',
        institucionFinanciadoraProyectoInvestigacion: data.institucionFinanciadoraProyectoInvestigacion ?? '',
        fechaInicioProyectoInvestigacion: '',
        fechaFinProyectoInvestigacion: '',
        vinculadoCarreraProyectoInvestigacion: data.vinculadoCarreraProyectoInvestigacion ?? '',
        disciplinasVinculadasProyectoInvestigacion: data.disciplinasVinculadasProyectoInvestigacion ?? '',
        sistemasPromocionInvestigacionJson: data.sistemasPromocionInvestigacionJson ?? '',
        participacionVinculacionJson: data.participacionVinculacionJson ?? '',
        produccionCientificaJson: data.produccionCientificaJson ?? '',
        sistemaPromocion: data.sistemaPromocion ?? '',
        categoriaPromocion: data.categoriaPromocion ?? '',
        fechaAltaPromocion: data.fechaAltaPromocion ? normalizarFechaSoloDia(String(data.fechaAltaPromocion)) : '',
        tituloActividadExtension: data.tituloActividadExtension ?? '',
        rolActividadExtension: data.rolActividadExtension ?? '',
        institucionDestinoActividadExtension: data.institucionDestinoActividadExtension ?? '',
        fechaInicioActividadExtension: data.fechaInicioActividadExtension ? normalizarFechaSoloDia(String(data.fechaInicioActividadExtension)) : '',
        finEstadoActividadExtension: data.finEstadoActividadExtension ?? '',
        vinculadaActividadExtension: data.vinculadaActividadExtension ?? '',
        cargosAcademicosJson: data.cargosAcademicosJson ?? '',
        otrasDedicacionesJson: data.otrasDedicacionesJson ?? '',
        desempenoActualJson: data.desempenoActualJson ?? '',
        desempenoPasadoJson: data.desempenoPasadoJson ?? '',
        proyectosInvestigacionJson: data.proyectosInvestigacionJson ?? '',
        actividadesExtensionJson: data.actividadesExtensionJson ?? '',
        reunionesCientificasJson: data.reunionesCientificasJson ?? '',
        comitesJuradosJson: data.comitesJuradosJson ?? '',
        carreraDocentePosgrado: data.carreraDocentePosgrado ?? '',
        actividadesTransferenciaExtension: data.actividadesTransferenciaExtension ?? '',
        premiosDistinciones: data.premiosDistinciones ?? '',
        estanciasCursosExterior: data.estanciasCursosExterior ?? '',
        membresiasInstituciones: data.membresiasInstituciones ?? '',
        registrosPromocionJson: data.registrosPromocionJson ?? '',
        areaDisciplinar: data.areaDisciplinar ?? '',
        subarea: data.subarea ?? '',
        areaDisciplinarId: data.areaDisciplinarId ?? '',
        subareaId: data.subareaId ?? '',
        observacionesArea: data.observacionesArea ?? '',
        activo: data.activo ?? false
      });
      setCargosAcademicos(parseCargosAcademicos(data.cargosAcademicosJson));
      setOtrasDedicaciones(parseOtrasDedicaciones(data.otrasDedicacionesJson));
      setDesempenoActual(parseDesempenoActual(data.desempenoActualJson));
      setDesempenoPasado(parseDesempenoPasado(data.desempenoPasadoJson));
      setProyectosInvestigacion(data.proyectosInvestigacionJson ? JSON.parse(data.proyectosInvestigacionJson) : []);
      setSistemasPromocionInv(data.sistemasPromocionInvestigacionJson ? JSON.parse(data.sistemasPromocionInvestigacionJson) : []);
      setParticipacionVinculacion(data.participacionVinculacionJson ? JSON.parse(data.participacionVinculacionJson) : []);
      setProduccionCientifica(data.produccionCientificaJson ? JSON.parse(data.produccionCientificaJson) : []);
      setReunionesCientificas(data.reunionesCientificasJson ? JSON.parse(data.reunionesCientificasJson) : []);
      setComitesJurados(data.comitesJuradosJson ? JSON.parse(data.comitesJuradosJson) : []);
      setActividadesExtension(
        data.actividadesExtensionJson
          ? JSON.parse(data.actividadesExtensionJson)
          : data.tituloActividadExtension
            ? [{ id: 'actividad-inicial', titulo: data.tituloActividadExtension ?? '', rol: data.rolActividadExtension ?? '', horasSemanales: '', institucionDestino: data.institucionDestinoActividadExtension ?? '', vinculacionCarrera: data.vinculadaActividadExtension ?? '', carreraVinculada: '', fechaInicio: data.fechaInicioActividadExtension ? normalizarFechaSoloDia(String(data.fechaInicioActividadExtension)) : '', fechaFin: '' }]
            : []
      );
      setRegistrosPromocion(
        data.registrosPromocionJson
          ? JSON.parse(data.registrosPromocionJson)
          : data.sistemaPromocion
            ? [{ id: 'promocion-inicial', sistema: data.sistemaPromocion ?? '', categoria: data.categoriaPromocion ?? '', fechaAlta: data.fechaAltaPromocion ? normalizarFechaSoloDia(String(data.fechaAltaPromocion)) : '' }]
            : []
      );
    } catch (err) {
      if (!silencioso) setError((err as Error).message);
    } finally {
      if (!silencioso) setLoading(false);
    }
  }

  function getFichaUpdateEndpoint() {
    return esVistaDesdeListado && docenteIdDesdeListado
      ? `${API_URL}/docentes/${docenteIdDesdeListado}`
      : `${API_URL}/docentes/mi-ficha`;
  }

  function handleFieldChange(field: keyof FormData, value: string) {
    setFormData((current) => (current ? { ...current, [field]: value } : current));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleConstrainFieldChange(field: keyof FormData, value: string) {
    // Durante composición IME (ej: teclas muertas para tildes) no filtrar caracteres intermedios
    if (isComposingRef.current) {
      handleFieldChange(field, value);
      return;
    }

    // Normalizar a NFC antes de filtrar para manejar caracteres Unicode descompuestos
    const nfc = value.normalize('NFC');
    let nextValue = nfc;

    if (['apellido', 'nombre', 'residencia', 'provincia', 'localidad'].includes(field)) {
      nextValue = normalizarMayusculas(nfc.replace(/[^\p{L}\s'\-]/gu, ''));
    }

    if (field === 'numeroDocumento') {
      nextValue = nfc.replace(/\D/g, '').slice(0, 8);
    }
    if (field === 'codigoPostal') {
      nextValue = nfc.replace(/\D/g, '');
    }

    if (
      field === 'dedicacionDeclaradaSemanal' ||
      field === 'tiempoDocencia' ||
      field === 'tiempoInvestigacion' ||
      field === 'tiempoExtension' ||
      field === 'tiempoGestionAcademica' ||
      field === 'tiempoDedicacionGestionSemanal'
    ) {
      nextValue = nfc.replace(/\D/g, '');
    }

    if (field === 'cuit') {
      nextValue = nfc.replace(/\D/g, '').slice(0, 11);
    }

    if (field === 'pisoDepto') {
      nextValue = normalizarMayusculas(nfc.replace(/[^\p{L}\p{N}\s'.,\-()\/:;°+&#º]/gu, ''));
    }

    if (field === 'unidadAcademica') {
      nextValue = normalizarMayusculas(nfc.replace(/[^\p{L}\p{N}\s'.,\-()\/:;°+&#º]/gu, ''));
    }
    if (field === 'unidadAcademicaGestion' || field === 'carreraAsociadaGestion') {
      nextValue = normalizarMayusculas(nfc.replace(/[^\p{L}\p{N}\s'.,\-()\/:;°+&#º]/gu, ''));
    }

    handleFieldChange(field, nextValue);
  }

  function validarFicha() {
    if (!formData) return false;
    const requiredFields: Array<keyof FormData> = [
      'apellido', 'nombre', 'sexo', 'fechaNacimiento', 'tipoDocumento', 'numeroDocumento', 'cuit'
    ];

    const errors: Partial<Record<keyof FormData, string>> = {};
    requiredFields.forEach((field) => {
      const value = formData[field];
      if (!value || String(value).trim() === '') errors[field] = 'Campo obligatorio';
    });

    if (formData.apellido && !SOLO_CARACTERES_REGEX.test(formData.apellido.trim())) {
      errors.apellido = 'Solo acepta caracteres';
    }
    if (formData.nombre && !SOLO_CARACTERES_REGEX.test(formData.nombre.trim())) {
      errors.nombre = 'Solo acepta caracteres';
    }
    if (formData.numeroDocumento && !/^\d{7,8}$/.test(formData.numeroDocumento.trim())) {
      errors.numeroDocumento = 'Debe tener 7 u 8 dígitos numéricos';
    }
    if (formData.cuit && !/^\d{11}$/.test(formData.cuit.trim())) {
      errors.cuit = 'Debe tener 11 valores numericos';
    }
    if (formData.unidadAcademica && !SOLO_ALFANUMERICO_REGEX.test(formData.unidadAcademica.trim())) {
      errors.unidadAcademica = 'Solo acepta valores alfanumericos';
    }
    if (formData.dedicacionDeclaradaSemanal && !SOLO_NUMEROS_REGEX.test(formData.dedicacionDeclaradaSemanal.trim())) {
      errors.dedicacionDeclaradaSemanal = 'Solo acepta numeros';
    }
    if (formData.tiempoDocencia && !SOLO_NUMEROS_REGEX.test(formData.tiempoDocencia.trim())) {
      errors.tiempoDocencia = 'Solo acepta numeros';
    }
    if (formData.tiempoInvestigacion && !SOLO_NUMEROS_REGEX.test(formData.tiempoInvestigacion.trim())) {
      errors.tiempoInvestigacion = 'Solo acepta numeros';
    }
    if (formData.tiempoExtension && !SOLO_NUMEROS_REGEX.test(formData.tiempoExtension.trim())) {
      errors.tiempoExtension = 'Solo acepta numeros';
    }
    if (formData.tiempoGestionAcademica && !SOLO_NUMEROS_REGEX.test(formData.tiempoGestionAcademica.trim())) {
      errors.tiempoGestionAcademica = 'Solo acepta numeros';
    }
    if (formData.tiempoDedicacionGestionSemanal && !SOLO_NUMEROS_REGEX.test(formData.tiempoDedicacionGestionSemanal.trim())) {
      errors.tiempoDedicacionGestionSemanal = 'Solo acepta numeros';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function validarTitulo(form: TituloGradoForm) {
    const errors: Partial<Record<keyof TituloGradoForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta letras, números y puntuación académica';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.pais.trim()) errors.pais = 'Campo obligatorio';
    else if (!SOLO_CARACTERES_REGEX.test(form.pais.trim())) errors.pais = 'Solo acepta caracteres';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setTituloErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoTitulo(field: keyof TituloGradoForm, value: string) {
    const nextValue = field !== 'anio' ? normalizarMayusculas(value) : value;
    setTituloForm((prev) => ({ ...prev, [field]: nextValue }));
    setTituloErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarTituloForm() {
    setTituloForm({ denominacion: '', anio: '', pais: '', institucion: '' });
    setTituloErrors({});
    setEditandoTituloId(null);
  }

  function validarPosgrado(form: TituloPosgradoForm) {
    const errors: Partial<Record<keyof TituloPosgradoForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta letras, números y puntuación académica';

    if (!form.tipo.trim()) errors.tipo = 'Campo obligatorio';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setPosgradoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoPosgrado(field: keyof TituloPosgradoForm, value: string) {
    const nextValue = field !== 'tipoId' ? normalizarMayusculas(value) : value;
    setPosgradoForm((prev) => ({ ...prev, [field]: nextValue }));
    setPosgradoErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarPosgradoForm() {
    setPosgradoForm({ denominacion: '', tipo: '', tipoId: '', anio: '', institucion: '' });
    setPosgradoErrors({});
    setEditandoPosgradoId(null);
  }

  function validarOtroTitulo(form: OtroTituloForm) {
    const errors: Partial<Record<keyof OtroTituloForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta letras, números y puntuación académica';

    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';

    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';

    setOtroTituloErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoOtroTitulo(field: keyof OtroTituloForm, value: string) {
    const nextValue = field !== 'anio' ? normalizarMayusculas(value) : value;
    setOtroTituloForm((prev) => ({ ...prev, [field]: nextValue }));
    setOtroTituloErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarOtroTituloForm() {
    setOtroTituloForm({ denominacion: '', anio: '', institucion: '' });
    setOtroTituloErrors({});
    setEditandoOtroTituloId(null);
  }

  function guardarOtroTitulo() {
    if (!validarOtroTitulo(otroTituloForm)) return;
    const nuevo: OtroTituloItem = {
      id: editandoOtroTituloId ?? `otro-titulo-${Date.now()}`,
      denominacion: otroTituloForm.denominacion.trim(),
      anio: otroTituloForm.anio.trim(),
      institucion: otroTituloForm.institucion.trim()
    };

    setOtrosTitulos((prev) => {
      const next = editandoOtroTituloId ? prev.map((item) => (item.id === editandoOtroTituloId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, otrosTitulos: JSON.stringify(next) } : current));
      return next;
    });

    limpiarOtroTituloForm();
    setMostrarFormOtroTitulo(false);
  }

  function editarOtroTitulo(item: OtroTituloItem) {
    setOtroTituloForm({ denominacion: item.denominacion, anio: item.anio, institucion: item.institucion });
    setEditandoOtroTituloId(item.id);
    setOtroTituloErrors({});
    setMostrarFormOtroTitulo(true);
  }

  function eliminarOtroTitulo(id: string) {
    setOtrosTitulos((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => (current ? { ...current, otrosTitulos: JSON.stringify(next) } : current));
      return next;
    });
  }

  function validarCarreraFormDoc(form: CarreraFormacionDocenteForm) {
    const errors: Partial<Record<keyof CarreraFormacionDocenteForm, string>> = {};
    if (!form.denominacion.trim()) errors.denominacion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.denominacion.trim())) errors.denominacion = 'Solo acepta letras, números y puntuación académica';
    if (!form.institucion.trim()) errors.institucion = 'Campo obligatorio';
    else if (!SOLO_ALFANUMERICO_REGEX.test(form.institucion.trim())) errors.institucion = 'Solo acepta valores alfanumericos';
    if (!form.anio.trim()) errors.anio = 'Campo obligatorio';
    else if (!ANIO_REGEX.test(form.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';
    setCarreraFormDocErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoCarreraFormDoc(field: keyof CarreraFormacionDocenteForm, value: string) {
    const nextValue = field !== 'anio' ? normalizarMayusculas(value) : value;
    setCarreraFormDoc((prev) => ({ ...prev, [field]: nextValue }));
    setCarreraFormDocErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }

  function limpiarCarreraFormDoc() {
    setCarreraFormDoc({ denominacion: '', institucion: '', unidadAcademica: '', anio: '' });
    setCarreraFormDocErrors({});
    setEditandoCarreraFormDocId(null);
  }

  function guardarCarreraFormDoc() {
    if (!validarCarreraFormDoc(carreraFormDoc)) return;
    const nueva: CarreraFormacionDocenteItem = {
      id: editandoCarreraFormDocId ?? `carrera-fd-${Date.now()}`,
      denominacion: carreraFormDoc.denominacion.trim(),
      institucion: carreraFormDoc.institucion.trim(),
      unidadAcademica: carreraFormDoc.unidadAcademica.trim(),
      anio: carreraFormDoc.anio.trim()
    };
    setCarrerasFormacionDocente((prev) => {
      const next = editandoCarreraFormDocId ? prev.map((item) => (item.id === editandoCarreraFormDocId ? nueva : item)) : [...prev, nueva];
      setFormData((current) => (current ? { ...current, carreraFormacionDocenteJson: JSON.stringify(next) } : current));
      return next;
    });
    limpiarCarreraFormDoc();
    setMostrarFormCarreraFormDoc(false);
  }

  function editarCarreraFormDoc(item: CarreraFormacionDocenteItem) {
    setCarreraFormDoc({ denominacion: item.denominacion, institucion: item.institucion, unidadAcademica: item.unidadAcademica, anio: item.anio });
    setEditandoCarreraFormDocId(item.id);
    setCarreraFormDocErrors({});
    setMostrarFormCarreraFormDoc(true);
  }

  function eliminarCarreraFormDoc(id: string) {
    setCarrerasFormacionDocente((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => (current ? { ...current, carreraFormacionDocenteJson: JSON.stringify(next) } : current));
      return next;
    });
  }

  function guardarTituloPosgrado() {
    if (!validarPosgrado(posgradoForm)) return;
    const nuevo: TituloPosgradoItem = {
      id: editandoPosgradoId ?? `posgrado-${Date.now()}`,
      denominacion: posgradoForm.denominacion.trim(),
      tipo: posgradoForm.tipo.trim(),
      tipoId: posgradoForm.tipoId,
      anio: posgradoForm.anio.trim(),
      institucion: posgradoForm.institucion.trim()
    };

    setTitulosPosgrado((prev) => {
      const next = editandoPosgradoId ? prev.map((item) => (item.id === editandoPosgradoId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, tituloPosgrado: JSON.stringify(next) } : current));
      return next;
    });

    limpiarPosgradoForm();
    setMostrarFormPosgrado(false);
  }

  function editarPosgrado(item: TituloPosgradoItem) {
    const tipo = item.tipo.toUpperCase();
    const tipoId = item.tipoId || (tiposPosgrado.find(t => t.nombre === tipo)?.id ?? '');
    setPosgradoForm({ denominacion: item.denominacion, tipo, tipoId, anio: item.anio, institucion: item.institucion });
    setEditandoPosgradoId(item.id);
    setPosgradoErrors({});
    setMostrarFormPosgrado(true);
  }

  function eliminarTituloPosgrado(id: string) {
    setTitulosPosgrado((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => (current ? { ...current, tituloPosgrado: JSON.stringify(next) } : current));
      return next;
    });
  }

  function guardarTituloGrado() {
    if (!validarTitulo(tituloForm)) return;
    const nuevo: TituloGradoItem = {
      id: editandoTituloId ?? `titulo-${Date.now()}`,
      denominacion: tituloForm.denominacion.trim(),
      anio: tituloForm.anio.trim(),
      pais: tituloForm.pais.trim(),
      institucion: tituloForm.institucion.trim()
    };

    setTitulosGrado((prev) => {
      const next = editandoTituloId ? prev.map((item) => (item.id === editandoTituloId ? nuevo : item)) : [...prev, nuevo];
      setFormData((current) => (current ? { ...current, tituloGrado: JSON.stringify(next) } : current));
      return next;
    });

    limpiarTituloForm();
    setMostrarFormGrado(false);
  }

  function editarTitulo(item: TituloGradoItem) {
    setTituloForm({ denominacion: item.denominacion, anio: item.anio, pais: item.pais, institucion: item.institucion });
    setEditandoTituloId(item.id);
    setTituloErrors({});
    setMostrarFormGrado(true);
  }

  function eliminarTituloGrado(id: string) {
    setTitulosGrado((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => (current ? { ...current, tituloGrado: JSON.stringify(next) } : current));
      return next;
    });
  }

  function eliminarCargoAcademico(id: string) {
    setCargosAcademicos((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, cargosAcademicosJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function editarCargoAcademico(item: CargoAcademicoItem) {
    setCargoForm({ cargo: item.cargo, institucion: item.institucion, modalidad: item.modalidad, periodoDesde: item.periodoDesde, periodoHasta: item.periodoHasta, dedicacionSemanal: item.dedicacionSemanal });
    setEditandoCargoId(item.id);
    setCargoErrors({});
    setMostrarFormCargo(true);
  }

  function validarCargoAcademico(): boolean {
    const errors: Partial<Record<keyof CargoAcademicoForm, string>> = {};
    if (!cargoForm.cargo.trim()) errors.cargo = 'Campo requerido';
    if (!cargoForm.institucion.trim()) errors.institucion = 'Campo requerido';
    if (!cargoForm.modalidad) errors.modalidad = 'Campo requerido';
    setCargoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarCargoAcademico() {
    if (!validarCargoAcademico()) return;
    setCargosAcademicos((prev) => {
      const next = editandoCargoId
        ? prev.map((item) => item.id === editandoCargoId ? { ...item, ...cargoForm } : item)
        : [...prev, { id: `cargo-${Date.now()}`, ...cargoForm }];
      setFormData((current) => current ? { ...current, cargosAcademicosJson: JSON.stringify(next) } : current);
      return next;
    });
    setCargoForm({ cargo: '', institucion: '', modalidad: '', periodoDesde: '', periodoHasta: '', dedicacionSemanal: '' });
    setEditandoCargoId(null);
    setMostrarFormCargo(false);
    setCargoErrors({});
  }

  function eliminarOtraDedicacion(id: string) {
    setOtrasDedicaciones((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, otrasDedicacionesJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function editarOtraDedicacion(item: OtraDedicacionItem) {
    setOtraDedicacionForm({ concepto: item.concepto, horasSeman: item.horasSeman });
    setEditandoOtraDedicacionId(item.id);
    setOtraDedicacionErrors({});
    setMostrarFormOtraDedicacion(true);
  }

  function validarOtraDedicacion(): boolean {
    const errors: Partial<Record<keyof OtraDedicacionForm, string>> = {};
    if (!otraDedicacionForm.concepto.trim()) errors.concepto = 'Campo requerido';
    setOtraDedicacionErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarOtraDedicacion() {
    if (!validarOtraDedicacion()) return;
    setOtrasDedicaciones((prev) => {
      const next = editandoOtraDedicacionId
        ? prev.map((item) => item.id === editandoOtraDedicacionId ? { ...item, ...otraDedicacionForm } : item)
        : [...prev, { id: `otra-ded-${Date.now()}`, ...otraDedicacionForm }];
      setFormData((current) => current ? { ...current, otrasDedicacionesJson: JSON.stringify(next) } : current);
      return next;
    });
    setOtraDedicacionForm({ concepto: '', horasSeman: '' });
    setEditandoOtraDedicacionId(null);
    setMostrarFormOtraDedicacion(false);
    setOtraDedicacionErrors({});
  }

  function eliminarDesempenoActual(id: string) {
    setDesempenoActual((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, desempenoActualJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function editarDesempenoActual(item: DesempenoActualItem) {
    setDesempenoActualForm({ periodoDesde: item.periodoDesde, periodoHasta: item.periodoHasta, institucion: item.institucion, cargo: item.cargo, modalidad: item.modalidad, dedicacionSeman: item.dedicacionSeman });
    setEditandoDesActualId(item.id);
    setDesempenoActualErrors({});
    setMostrarFormDesActual(true);
  }

  function validarDesempenoActual(): boolean {
    const errors: Partial<Record<keyof DesempenoActualForm, string>> = {};
    if (!desempenoActualForm.institucion.trim()) errors.institucion = 'Campo requerido';
    if (!desempenoActualForm.cargo.trim()) errors.cargo = 'Campo requerido';
    if (!desempenoActualForm.modalidad) errors.modalidad = 'Campo requerido';
    setDesempenoActualErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarDesempenoActual() {
    if (!validarDesempenoActual()) return;
    setDesempenoActual((prev) => {
      const next = editandoDesActualId
        ? prev.map((item) => item.id === editandoDesActualId ? { ...item, ...desempenoActualForm } : item)
        : [...prev, { id: `desact-${Date.now()}`, ...desempenoActualForm }];
      setFormData((current) => current ? { ...current, desempenoActualJson: JSON.stringify(next) } : current);
      return next;
    });
    setDesempenoActualForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '', modalidad: '', dedicacionSeman: '' });
    setEditandoDesActualId(null);
    setMostrarFormDesActual(false);
    setDesempenoActualErrors({});
  }

  function eliminarDesempenoPasado(id: string) {
    setDesempenoPasado((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, desempenoPasadoJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function editarDesempenoPasado(item: DesempenoPasadoItem) {
    setDesempenoPasadoForm({ periodoDesde: item.periodoDesde, periodoHasta: item.periodoHasta, institucion: item.institucion, cargo: item.cargo });
    setEditandoDesPasadoId(item.id);
    setDesempenoPasadoErrors({});
    setMostrarFormDesPasado(true);
  }

  function validarDesempenoPasado(): boolean {
    const errors: Partial<Record<keyof DesempenoPasadoForm, string>> = {};
    if (!desempenoPasadoForm.institucion.trim()) errors.institucion = 'Campo requerido';
    if (!desempenoPasadoForm.cargo.trim()) errors.cargo = 'Campo requerido';
    setDesempenoPasadoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarDesempenoPasado() {
    if (!validarDesempenoPasado()) return;
    setDesempenoPasado((prev) => {
      const next = editandoDesPasadoId
        ? prev.map((item) => item.id === editandoDesPasadoId ? { ...item, ...desempenoPasadoForm } : item)
        : [...prev, { id: `despas-${Date.now()}`, ...desempenoPasadoForm }];
      setFormData((current) => current ? { ...current, desempenoPasadoJson: JSON.stringify(next) } : current);
      return next;
    });
    setDesempenoPasadoForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '' });
    setEditandoDesPasadoId(null);
    setMostrarFormDesPasado(false);
    setDesempenoPasadoErrors({});
  }

  function eliminarProyectoInvestigacion(id: string) {
    setProyectosInvestigacion((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, proyectosInvestigacionJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function eliminarActividadExtension(id: string) {
    setActividadesExtension((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, actividadesExtensionJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function validarReunionCientifica(): boolean {
    const errors: Partial<Record<keyof ReunionCientificaForm, string>> = {};
    if (!reunionCientificaForm.titulo.trim()) errors.titulo = 'Campo requerido';
    if (!reunionCientificaForm.formaParticipacion.trim()) errors.formaParticipacion = 'Campo requerido';
    if (!reunionCientificaForm.tipo.trim()) errors.tipo = 'Campo requerido';
    setReunionCientificaErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarReunionCientifica() {
    if (!validarReunionCientifica()) return;
    setReunionesCientificas((prev) => {
      const next = editandoReunionId
        ? prev.map((item) => item.id === editandoReunionId ? { ...item, ...reunionCientificaForm } : item)
        : [...prev, { id: `reunion-${Date.now()}`, ...reunionCientificaForm }];
      setFormData((current) => current ? { ...current, reunionesCientificasJson: JSON.stringify(next) } : current);
      return next;
    });
    setReunionCientificaForm({ titulo: '', lugar: '', formaParticipacion: '', tipo: '', fecha: '' });
    setEditandoReunionId(null);
    setMostrarFormReunion(false);
    setReunionCientificaErrors({});
  }

  function editarReunionCientifica(item: ReunionCientificaItem) {
    setReunionCientificaForm({ titulo: item.titulo, lugar: item.lugar, formaParticipacion: item.formaParticipacion, tipo: item.tipo, fecha: item.fecha });
    setEditandoReunionId(item.id);
    setMostrarFormReunion(true);
    setReunionCientificaErrors({});
  }

  function eliminarReunionCientifica(id: string) {
    setReunionesCientificas((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, reunionesCientificasJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function validarComiteJurado(): boolean {
    const errors: Partial<Record<keyof ComiteJuradoForm, string>> = {};
    if (!comiteJuradoForm.organismoConvocante.trim()) errors.organismoConvocante = 'Campo requerido';
    if (!comiteJuradoForm.tipoEvaluacion.trim()) errors.tipoEvaluacion = 'Campo requerido';
    setComiteJuradoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarComiteJurado() {
    if (!validarComiteJurado()) return;
    setComitesJurados((prev) => {
      const next = editandoComiteId
        ? prev.map((item) => item.id === editandoComiteId ? { ...item, ...comiteJuradoForm } : item)
        : [...prev, { id: `comite-${Date.now()}`, ...comiteJuradoForm }];
      setFormData((current) => current ? { ...current, comitesJuradosJson: JSON.stringify(next) } : current);
      return next;
    });
    setComiteJuradoForm({ organismoConvocante: '', lugar: '', tipoEvaluacion: '', fecha: '' });
    setEditandoComiteId(null);
    setMostrarFormComite(false);
    setComiteJuradoErrors({});
  }

  function editarComiteJurado(item: ComiteJuradoItem) {
    setComiteJuradoForm({ organismoConvocante: item.organismoConvocante, lugar: item.lugar, tipoEvaluacion: item.tipoEvaluacion, fecha: item.fecha });
    setEditandoComiteId(item.id);
    setMostrarFormComite(true);
    setComiteJuradoErrors({});
  }

  function eliminarComiteJurado(id: string) {
    setComitesJurados((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, comitesJuradosJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function eliminarRegistroPromocion(id: string) {
    setRegistrosPromocion((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, registrosPromocionJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  function agregarRegistroPromocion() {
    if (!registroPromocionForm.sistema || !registroPromocionForm.categoria) return;
    const nuevo: RegistroPromocionItem = { id: `promocion-${Date.now()}`, ...registroPromocionForm };
    setRegistrosPromocion((prev) => {
      const next = [...prev, nuevo];
      setFormData((current) => current ? {
        ...current,
        registrosPromocionJson: JSON.stringify(next),
        sistemaPromocion: nuevo.sistema,
        categoriaPromocion: nuevo.categoria,
        fechaAltaPromocion: nuevo.fechaAlta,
      } : current);
      return next;
    });
    setRegistroPromocionForm({ sistema: '', categoria: '', fechaAlta: '' });
  }

  function agregarActividadExtension() {
    if (!actividadForm.titulo || !actividadForm.rol || !actividadForm.horasSemanales || !actividadForm.vinculacionCarrera || !actividadForm.fechaInicio) return;
    const nueva: ActividadExtensionItem = { id: `actividad-${Date.now()}`, ...actividadForm };
    setActividadesExtension((prev) => {
      const next = [...prev, nueva];
      setFormData((current) => current ? {
        ...current,
        actividadesExtensionJson: JSON.stringify(next),
        tituloActividadExtension: nueva.titulo,
        rolActividadExtension: nueva.rol,
        institucionDestinoActividadExtension: nueva.institucionDestino,
        vinculadaActividadExtension: nueva.vinculacionCarrera,
        fechaInicioActividadExtension: nueva.fechaInicio,
        finEstadoActividadExtension: nueva.fechaFin ? 'Finalizada' : 'Vigente',
      } : current);
      return next;
    });
    setActividadForm({ titulo: '', rol: '', horasSemanales: '', institucionDestino: '', vinculacionCarrera: '', carreraVinculada: '', fechaInicio: '', fechaFin: '' });
  }

  function validarProyecto(): boolean {
    const errors: Partial<Record<'codigo' | 'titulo' | 'rol' | 'horasSemanales', string>> = {};
    if (!proyectoForm.titulo.trim()) errors.titulo = 'Campo requerido';
    if (!proyectoForm.rol.trim()) errors.rol = 'Campo requerido';
    setProyectoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarProyectoInvestigacion() {
    if (!validarProyecto()) return;
    setProyectosInvestigacion((prev) => {
      const next = editandoProyectoId
        ? prev.map((item) => item.id === editandoProyectoId ? { ...item, ...proyectoForm } : item)
        : [...prev, { id: `proyecto-${Date.now()}`, ...proyectoForm }];
      setFormData((current) => current ? { ...current, proyectosInvestigacionJson: JSON.stringify(next) } : current);
      return next;
    });
    setProyectoForm({ codigo: '', titulo: '', rol: '', horasSemanales: '' });
    setEditandoProyectoId(null);
    setMostrarFormProyecto(false);
    setProyectoErrors({});
  }

  function editarProyecto(item: ProyectoInvestigacionItem) {
    setProyectoForm({ codigo: item.codigo, titulo: item.titulo, rol: item.rol, horasSemanales: item.horasSemanales });
    setEditandoProyectoId(item.id);
    setMostrarFormProyecto(true);
    setProyectoErrors({});
  }

  // 7.1 Sistemas de promoción de la investigación
  function validarSistemaPromocionInv(): boolean {
    const errors: Partial<Record<keyof SistemaPromocionInvForm, string>> = {};
    if (!sistemaPromocionInvForm.sistema.trim()) errors.sistema = 'Campo requerido';
    if (!sistemaPromocionInvForm.categoria.trim()) errors.categoria = 'Campo requerido';
    setSistemaPromocionInvErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarSistemaPromocionInv() {
    if (!validarSistemaPromocionInv()) return;
    setSistemasPromocionInv((prev) => {
      const next = editandoSistPromoInvId
        ? prev.map((item) => item.id === editandoSistPromoInvId ? { ...item, ...sistemaPromocionInvForm } : item)
        : [...prev, { id: `sistpromoinv-${Date.now()}`, ...sistemaPromocionInvForm }];
      setFormData((current) => current ? { ...current, sistemasPromocionInvestigacionJson: JSON.stringify(next) } : current);
      return next;
    });
    setSistemaPromocionInvForm({ sistema: '', categoria: '', detalle: '', periodoDesde: '', periodoHasta: '' });
    setEditandoSistPromoInvId(null);
    setMostrarFormSistPromoInv(false);
    setSistemaPromocionInvErrors({});
  }

  function editarSistemaPromocionInv(item: SistemaPromocionInvItem) {
    setSistemaPromocionInvForm({ sistema: item.sistema, categoria: item.categoria, detalle: item.detalle, periodoDesde: item.periodoDesde, periodoHasta: item.periodoHasta });
    setEditandoSistPromoInvId(item.id);
    setMostrarFormSistPromoInv(true);
    setSistemaPromocionInvErrors({});
  }

  function eliminarSistemaPromocionInv(id: string) {
    setSistemasPromocionInv((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, sistemasPromocionInvestigacionJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  // 7.3 Participación en vinculación
  function validarParticipacionVinculacion(): boolean {
    const errors: Partial<Record<keyof ParticipacionVinculacionForm, string>> = {};
    if (!participacionVinculacionForm.actividad.trim()) errors.actividad = 'Campo requerido';
    if (!participacionVinculacionForm.rol.trim()) errors.rol = 'Campo requerido';
    setParticipacionVinculacionErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarParticipacionVinculacion() {
    if (!validarParticipacionVinculacion()) return;
    setParticipacionVinculacion((prev) => {
      const next = editandoPartVinculacionId
        ? prev.map((item) => item.id === editandoPartVinculacionId ? { ...item, ...participacionVinculacionForm } : item)
        : [...prev, { id: `partvinc-${Date.now()}`, ...participacionVinculacionForm }];
      setFormData((current) => current ? { ...current, participacionVinculacionJson: JSON.stringify(next) } : current);
      return next;
    });
    setParticipacionVinculacionForm({ codigo: '', actividad: '', rol: '', horasSemanales: '' });
    setEditandoPartVinculacionId(null);
    setMostrarFormPartVinculacion(false);
    setParticipacionVinculacionErrors({});
  }

  function editarParticipacionVinculacion(item: ParticipacionVinculacionItem) {
    setParticipacionVinculacionForm({ codigo: item.codigo, actividad: item.actividad, rol: item.rol, horasSemanales: item.horasSemanales });
    setEditandoPartVinculacionId(item.id);
    setMostrarFormPartVinculacion(true);
    setParticipacionVinculacionErrors({});
  }

  function eliminarParticipacionVinculacion(id: string) {
    setParticipacionVinculacion((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, participacionVinculacionJson: JSON.stringify(next) } : current);
      return next;
    });
  }

  // 7.4 Producción científica
  function validarProduccionCientifica(): boolean {
    const errors: Partial<Record<keyof ProduccionCientificaForm, string>> = {};
    if (!produccionCientificaForm.tipo.trim()) errors.tipo = 'Campo requerido';
    if (!produccionCientificaForm.referenciaBibliografica.trim()) errors.referenciaBibliografica = 'Campo requerido';
    if (produccionCientificaForm.anio.trim() && !ANIO_REGEX.test(produccionCientificaForm.anio.trim())) errors.anio = 'Debe tener 4 valores numericos';
    setProduccionCientificaErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function agregarProduccionCientifica() {
    if (!validarProduccionCientifica()) return;
    setProduccionCientifica((prev) => {
      const next = editandoProdCientId
        ? prev.map((item) => item.id === editandoProdCientId ? { ...item, ...produccionCientificaForm } : item)
        : [...prev, { id: `prodcient-${Date.now()}`, ...produccionCientificaForm }];
      setFormData((current) => current ? { ...current, produccionCientificaJson: JSON.stringify(next) } : current);
      return next;
    });
    setProduccionCientificaForm({ tipo: '', referenciaBibliografica: '', anio: '' });
    setEditandoProdCientId(null);
    setMostrarFormProdCient(false);
    setProduccionCientificaErrors({});
  }

  function editarProduccionCientifica(item: ProduccionCientificaItem) {
    setProduccionCientificaForm({ tipo: item.tipo, referenciaBibliografica: item.referenciaBibliografica, anio: item.anio });
    setEditandoProdCientId(item.id);
    setMostrarFormProdCient(true);
    setProduccionCientificaErrors({});
  }

  function eliminarProduccionCientifica(id: string) {
    setProduccionCientifica((prev) => {
      const next = prev.filter((item) => item.id !== id);
      setFormData((current) => current ? { ...current, produccionCientificaJson: JSON.stringify(next) } : current);
      return next;
    });
  }


  function validarSituacionActual(): boolean {
    const errors: Partial<Record<keyof SituacionActualForm, string>> = {};
    if (!situacionActualForm.carrera.trim()) errors.carrera = 'Campo requerido';
    if (!situacionActualForm.asignatura.trim()) errors.asignatura = 'Campo requerido';
    setSituacionActualErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoSituacionActual<K extends keyof SituacionActualForm>(campo: K, valor: SituacionActualForm[K]) {
    setSituacionActualForm((prev) => ({ ...prev, [campo]: valor }));
    if (situacionActualErrors[campo]) setSituacionActualErrors((prev) => ({ ...prev, [campo]: undefined }));
  }

  function limpiarSituacionActualForm() {
    setSituacionActualForm({ carrera: '', asignatura: '', plan: '', catedra: '', anioInicio: '', cargo: '', modalidad: '', designacion: '', disciplinaSubdisciplina: '' });
    setSituacionActualErrors({});
    setEditandoSituacionId(null);
    setMostrarFormSituacionActual(false);
  }

  function guardarSituacionActual() {
    if (!formData) return;
    if (!validarSituacionActual()) return;
    let next: SituacionActualItem[];
    if (editandoSituacionId) {
      next = situacionActual.map((item) => item.id === editandoSituacionId ? { ...item, ...situacionActualForm } : item);
    } else {
      next = [...situacionActual, { id: `situacion-${Date.now()}`, ...situacionActualForm }];
    }
    setSituacionActual(next);
    setFormData((prev) => prev ? { ...prev, asignaturasVinculadas: JSON.stringify(next) } : prev);
    limpiarSituacionActualForm();
  }

  function editarSituacionActual(item: SituacionActualItem) {
    setSituacionActualForm({
      carrera: item.carrera,
      asignatura: item.asignatura,
      plan: item.plan,
      catedra: item.catedra,
      anioInicio: item.anioInicio,
      cargo: item.cargo,
      modalidad: item.modalidad,
      designacion: item.designacion,
      disciplinaSubdisciplina: item.disciplinaSubdisciplina
    });
    setEditandoSituacionId(item.id);
    setMostrarFormSituacionActual(true);
  }

  function eliminarSituacionActual(id: string) {
    if (!formData) return;
    const next = situacionActual.filter((item) => item.id !== id);
    setSituacionActual(next);
    setFormData((prev) => prev ? { ...prev, asignaturasVinculadas: JSON.stringify(next) } : prev);
  }

  // ── Actividades curriculares de posgrado ───────────────────────────────────
  function validarActividadPosgrado(): boolean {
    const errors: Partial<Record<keyof ActividadPosgradoForm, string>> = {};
    if (!actividadPosgradoForm.carrerasPosgrado.trim()) errors.carrerasPosgrado = 'Campo requerido';
    if (actividadPosgradoForm.anioInicio.trim() && !ANIO_REGEX.test(actividadPosgradoForm.anioInicio.trim())) errors.anioInicio = 'Debe tener 4 valores numericos';
    setActividadPosgradoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoActPosgrado<K extends keyof ActividadPosgradoForm>(campo: K, valor: ActividadPosgradoForm[K]) {
    const valorNorm = normalizarMayusculas(valor as string) as ActividadPosgradoForm[K];
    setActividadPosgradoForm((prev) => ({ ...prev, [campo]: valorNorm }));
    if (actividadPosgradoErrors[campo]) setActividadPosgradoErrors((prev) => ({ ...prev, [campo]: undefined }));
  }

  function limpiarActividadPosgradoForm() {
    setActividadPosgradoForm({ carrerasPosgrado: '', actividadCurricular: '', plan: '', anioInicio: '' });
    setActividadPosgradoErrors({});
    setEditandoActPosgradoId(null);
    setMostrarFormActPosgrado(false);
  }

  function guardarActividadPosgrado() {
    if (!formData) return;
    if (!validarActividadPosgrado()) return;
    let next: ActividadPosgradoItem[];
    if (editandoActPosgradoId) {
      next = actividadesPosgrado.map((item) => item.id === editandoActPosgradoId ? { ...item, ...actividadPosgradoForm } : item);
    } else {
      next = [...actividadesPosgrado, { id: `posgrado-${Date.now()}`, ...actividadPosgradoForm }];
    }
    setActividadesPosgrado(next);
    setFormData((prev) => prev ? { ...prev, actividadesPosgradoJson: JSON.stringify(next) } : prev);
    limpiarActividadPosgradoForm();
  }

  function editarActividadPosgrado(item: ActividadPosgradoItem) {
    setActividadPosgradoForm({ carrerasPosgrado: item.carrerasPosgrado, actividadCurricular: item.actividadCurricular, plan: item.plan, anioInicio: item.anioInicio });
    setEditandoActPosgradoId(item.id);
    setMostrarFormActPosgrado(true);
  }

  function eliminarActividadPosgrado(id: string) {
    if (!formData) return;
    const next = actividadesPosgrado.filter((item) => item.id !== id);
    setActividadesPosgrado(next);
    setFormData((prev) => prev ? { ...prev, actividadesPosgradoJson: JSON.stringify(next) } : prev);
  }

  // ── 4.2 Trayectoria — cargos pasados ──────────────────────────────────────
  function validarTrayectoriaCargo(): boolean {
    const errors: Partial<Record<keyof TrayectoriaCargoForm, string>> = {};
    if (!trayectoriaCargoForm.institucion.trim()) errors.institucion = 'Campo requerido';
    // Aceptar cargoId (seleccionado de tablas maestras) o cargo texto (registros históricos sin ID)
    if (!trayectoriaCargoForm.cargoId && !trayectoriaCargoForm.cargo.trim()) errors.cargo = 'Campo requerido';
    setTrayectoriaCargoErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function actualizarCampoTrayectoria<K extends keyof TrayectoriaCargoForm>(campo: K, valor: TrayectoriaCargoForm[K]) {
    setTrayectoriaCargoForm((prev) => ({ ...prev, [campo]: valor }));
    if (trayectoriaCargoErrors[campo]) setTrayectoriaCargoErrors((prev) => ({ ...prev, [campo]: undefined }));
  }

  function limpiarTrayectoriaCargoForm() {
    setTrayectoriaCargoForm({ periodoDesde: '', periodoHasta: '', institucion: '', unidadAcademica: '', cargo: '', cargoId: '', modalidad: '', modalidadId: '', dedicacionSem: '' });
    setTrayectoriaCargoErrors({});
    setEditandoTrayectoriaId(null);
    setMostrarFormTrayectoria(false);
  }

  function guardarTrayectoriaCargo() {
    if (!formData) return;
    if (!validarTrayectoriaCargo()) return;
    let next: TrayectoriaCargoItem[];
    if (editandoTrayectoriaId) {
      next = trayectoriaCargosPasados.map((item) => item.id === editandoTrayectoriaId ? { ...item, ...trayectoriaCargoForm } : item);
    } else {
      next = [...trayectoriaCargosPasados, { id: `trayectoria-${Date.now()}`, ...trayectoriaCargoForm }];
    }
    setTrayectoriaCargosPasados(next);
    setFormData((prev) => prev ? { ...prev, trayectoriaCargosPasadosJson: JSON.stringify(next) } : prev);
    limpiarTrayectoriaCargoForm();
  }

  function editarTrayectoriaCargo(item: TrayectoriaCargoItem) {
    setTrayectoriaCargoForm({
      periodoDesde: item.periodoDesde, periodoHasta: item.periodoHasta,
      institucion: item.institucion, unidadAcademica: item.unidadAcademica,
      cargo: item.cargo, cargoId: item.cargoId ?? '',
      modalidad: item.modalidad, modalidadId: item.modalidadId ?? '',
      dedicacionSem: item.dedicacionSem
    });
    setEditandoTrayectoriaId(item.id);
    setMostrarFormTrayectoria(true);
  }

  function eliminarTrayectoriaCargo(id: string) {
    if (!formData) return;
    const next = trayectoriaCargosPasados.filter((item) => item.id !== id);
    setTrayectoriaCargosPasados(next);
    setFormData((prev) => prev ? { ...prev, trayectoriaCargosPasadosJson: JSON.stringify(next) } : prev);
  }

  // ── 4.3 Dirección de tesis ─────────────────────────────────────────────────
  function actualizarCampoTesisSummary<K extends keyof DireccionTesisSummary>(campo: K, valor: string) {
    const next = { ...direccionTesisSummary, [campo]: valor.replace(/\D/g, '') };
    setDireccionTesisSummary(next);
    setFormData((prev) => prev ? { ...prev, direccionTesisJson: JSON.stringify(next) } : prev);
  }

  async function guardarSeccionTab5() {
    if (!formData) return;
    try {
      const response = await apiFetch(getFichaUpdateEndpoint(), {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);
      setSuccessMessage('Sección actualizada correctamente.');
      setEditProyectoInv(false);
      setEditSistemaPromocion(false);
      setEditActividadExtension(false);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function cancelarSeccionTab5(setter: (value: boolean) => void) {
    setter(false);
    cargarFicha();
  }

  function exportarFichaDocente() {
    if (!formData) return;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 40;
    const tableWidth = pageWidth - marginX * 2;
    const labelColW = 190;
    const valueColW = tableWidth - labelColW;
    let y = 70;

    const checkPage = (h: number) => {
      if (y + h > 800) { doc.addPage(); y = 50; }
    };

    // Shared: draw tab name header + optional subtitle bar
    const drawHeader = (tabName: string, subtitle?: string) => {
      doc.setFillColor(15, 76, 129);
      doc.rect(marginX, y, tableWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(tabName, marginX + 8, y + 16);
      y += 24;
      if (subtitle) {
        doc.setFillColor(235, 241, 248);
        doc.rect(marginX, y, tableWidth, 18, 'F');
        doc.setDrawColor(190, 210, 230);
        doc.rect(marginX, y, tableWidth, 18);
        doc.setTextColor(15, 76, 129);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text(subtitle, marginX + 8, y + 12);
        y += 18;
      }
    };

    // ── Shared PDF constants ──────────────────────────────────────────────────
    const LH_FACTOR = 1.4;
    const PAGE_BOTTOM = 800;

    // Key-value section — dynamic row height, full text wrap, per-row page break
    const drawSection = (tabName: string, subtitle: string | null, rows: Array<[string, string]>) => {
      const fontSize = 9;
      const lineH = fontSize * LH_FACTOR;
      const padTop = 5;
      const padBot = 4;
      const minRowH = 20;

      doc.setFontSize(fontSize);

      const rowData = rows.map(([label, rawValue]) => {
        const value = rawValue && rawValue.trim() ? rawValue : '-';
        doc.setFont('helvetica', 'bold');
        const lblLines = doc.splitTextToSize(label, labelColW - 12) as string[];
        doc.setFont('helvetica', 'normal');
        const valLines = doc.splitTextToSize(value, valueColW - 12) as string[];
        const rowH = Math.max(minRowH, padTop + Math.max(lblLines.length, valLines.length) * lineH + padBot);
        return { lblLines, valLines, rowH };
      });

      // Keep section header + first row together on the same page
      const sectionHdrH = 24 + (subtitle ? 18 : 0);
      const firstH = rowData.length > 0 ? rowData[0].rowH : minRowH;
      checkPage(sectionHdrH + firstH);
      drawHeader(tabName, subtitle ?? undefined);

      doc.setTextColor(30, 41, 59);
      rowData.forEach(({ lblLines, valLines, rowH }, idx) => {
        if (y + rowH > PAGE_BOTTOM) { doc.addPage(); y = 50; }

        doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
        doc.rect(marginX, y, tableWidth, rowH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, rowH);
        doc.line(marginX + labelColW, y, marginX + labelColW, y + rowH);

        const textY = y + padTop + fontSize;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(fontSize);
        doc.text(lblLines, marginX + 6, textY, { lineHeightFactor: LH_FACTOR });
        doc.setFont('helvetica', 'normal');
        doc.text(valLines, marginX + labelColW + 6, textY, { lineHeightFactor: LH_FACTOR });

        y += rowH;
      });
      y += 12;
    };

    // Table section — dynamic row heights, full cell wrap, per-row page break with header re-draw
    const drawTableSection = (
      tabName: string,
      subtitle: string | null,
      headers: string[],
      rows: string[][],
      colFractions: number[],
      summaryLines?: string[]
    ) => {
      const colWidths = colFractions.map(f => f * tableWidth);
      const fontSize = 8;
      const lineH = fontSize * LH_FACTOR;
      const padTop = 4;
      const padBot = 3;
      const minRowH = 18;

      // Pre-compute header wrapping to set dynamic column header height
      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'bold');
      const hdrCellLines = headers.map((h, i) =>
        doc.splitTextToSize(h.toUpperCase(), colWidths[i] - 8) as string[]
      );
      const maxHdrLines = Math.max(...hdrCellLines.map((l: string[]) => l.length), 1);
      const hdrLineH = Math.ceil(7.5 * LH_FACTOR);
      const colHdrH = Math.max(18, 4 + maxHdrLines * hdrLineH + 4);

      // Pre-compute all cell lines and row heights at fontSize=8
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(fontSize);
      const rowData = rows.map(row => {
        const cells = row.map((cell, i) =>
          doc.splitTextToSize(cell || '-', colWidths[i] - 8) as string[]
        );
        const maxLines = Math.max(...cells.map(c => c.length), 1);
        const rowH = Math.max(minRowH, padTop + maxLines * lineH + padBot);
        return { cells, rowH };
      });

      // Keep section header + column header + first row together
      const sectionHdrH = 24 + (subtitle ? 18 : 0);
      const firstDataH = rowData.length > 0 ? rowData[0].rowH : minRowH;
      checkPage(sectionHdrH + colHdrH + firstDataH);
      drawHeader(tabName, subtitle ?? undefined);

      // Column headers — extracted as function so page breaks can re-draw them
      const drawColHeaders = () => {
        doc.setFillColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, colHdrH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, colHdrH);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        let cx = marginX;
        headers.forEach((h, i) => {
          if (i > 0) doc.line(cx, y, cx, y + colHdrH);
          doc.text(hdrCellLines[i], cx + 4, y + 4 + 7.5, { lineHeightFactor: LH_FACTOR });
          cx += colWidths[i];
        });
        y += colHdrH;
      };

      drawColHeaders();

      if (rows.length === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, tableWidth, minRowH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, minRowH);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Sin registros', marginX + 6, y + 12);
        y += minRowH;
      } else {
        rowData.forEach(({ cells, rowH }, idx) => {
          // Page break — re-draw column headers on the new page
          if (y + rowH > PAGE_BOTTOM) {
            doc.addPage();
            y = 50;
            drawColHeaders();
          }

          doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
          doc.rect(marginX, y, tableWidth, rowH, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(marginX, y, tableWidth, rowH);

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(fontSize);
          doc.setTextColor(30, 41, 59);

          const textY = y + padTop + fontSize;
          let colX = marginX;
          cells.forEach((lines, i) => {
            if (i > 0) doc.line(colX, y, colX, y + rowH);
            doc.text(lines, colX + 4, textY, { lineHeightFactor: LH_FACTOR });
            colX += colWidths[i];
          });

          y += rowH;
        });
      }

      if (summaryLines && summaryLines.length > 0) {
        const sumH = summaryLines.length * 16;
        checkPage(sumH);
        doc.setFillColor(241, 245, 249);
        doc.rect(marginX, y, tableWidth, sumH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, sumH);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(15, 76, 129);
        summaryLines.forEach((line, i) => doc.text(line, marginX + 6, y + 11 + i * 16));
        y += sumH;
      }
      y += 12;
    };

    // ── Header ───────────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(15, 76, 129);
    doc.setFontSize(22);
    doc.text('UDEMM', pageWidth / 2, 34, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(51, 65, 85);
    doc.text('Ficha Docente Completa', pageWidth / 2, 52, { align: 'center' });

    // ── 1. Datos Personales ───────────────────────────────────
    drawSection('Datos Personales', 'Identidad', [
      ['Apellido', formData.apellido],
      ['Nombres', formData.nombre],
      ['Sexo', formData.sexo],
      ['Fecha de nacimiento', formData.fechaNacimiento],
      ['Tipo de documento', formData.tipoDocumento],
      ['N° de documento', formData.numeroDocumento],
      ['CUIT', formData.cuit],
    ]);
    drawSection('', 'Domicilio', [
      ['País de residencia', 'Argentina'],
      ['Provincia', formData.provincia],
      ['Departamento / Partido', formData.pisoDepto],
      ['Localidad', formData.localidad],
      ['Código Postal', formData.codigoPostal],
    ]);

    // ── 2. Formacion ─────────────────────────────────────────
    drawTableSection(
      'Formación', '2.1 Títulos de grado',
      ['Título', 'Año', 'País', 'Institución'],
      titulosGrado.map(t => [t.denominacion, t.anio, t.pais, t.institucion]),
      [0.40, 0.10, 0.18, 0.32]
    );
    drawTableSection(
      '', '2.2 Posgrado',
      ['Título', 'Tipo', 'Año', 'Institución'],
      titulosPosgrado.map(t => [t.denominacion, t.tipo, t.anio, t.institucion]),
      [0.38, 0.18, 0.10, 0.34]
    );
    drawTableSection(
      '', '2.3 Otros títulos de nivel superior (terciario/técnico)',
      ['Título', 'Año', 'Institución'],
      otrosTitulos.map(t => [t.denominacion, t.anio, t.institucion]),
      [0.46, 0.10, 0.44]
    );
    drawTableSection(
      '', '2.4 Carrera de formación docente',
      ['Título', 'Institución', 'Unidad Académica', 'Año'],
      carrerasFormacionDocente.map(t => [t.denominacion, t.institucion, t.unidadAcademica, t.anio]),
      [0.32, 0.28, 0.26, 0.14]
    );

    // ── 3. Área de desempeño ──────────────────────────────────
    const areaEncontrada = areasDisciplinares.find(
  a => a.id === formData.areaDisciplinarId
);

const subareaEncontrada = subareas.find(
  s => s.id === formData.subareaId
);

const pdfAreaNombre =
  areaEncontrada?.nombre ||
  formData.areaDisciplinar ||
  'Sin información registrada';

const pdfSubareaNombre =
  subareaEncontrada?.nombre ||
  formData.subarea ||
  'Sin información registrada';

drawSection('Área de desempeño', '3.1 Disciplina y área', [
  ['Área disciplinar', pdfAreaNombre],
  ['Subárea', pdfSubareaNombre],
  ['Observaciones', formData.observacionesArea || 'Sin información registrada'],
]);
    // ── 4. Docencia universitaria ─────────────────────────────
    // 4.1 Situación actual — orientación vertical, 11 columnas, fuente compacta
    {
      const p41Fs    = 7;
      const p41LH    = LH_FACTOR;
      const p41LineH = p41Fs * p41LH;
      const p41Pad   = 3;  // padding horizontal en celdas

      // Anchos proporcionales al contenido (suma = tableWidth)
      // Columnas cortas: H/SEM (num.), Año inicio (4 dígitos), Aprobada (fecha)
      const p41RawW  = [58, 56, 41, 56, 44, 40, 48, 56, 31, 32, 53];
      const p41RawSum = p41RawW.reduce((s, w) => s + w, 0);
      const p41ColW   = p41RawW.map(w => (w / p41RawSum) * tableWidth);

      const p41Hdrs = [
        'Facultad','Carrera','Plan','Asignatura','Cátedra',
        'Cargo','Modalidad','Designación','H/SEM','Año inicio','Aprobada',
      ];
      const p41Data: string[][] = vinculacionesAprobadas.map(a => [
        a.facultad.nombre,
        a.carrera.nombre,
        a.planEstudio.nombre + (a.planEstudio.codigo ? ` (${a.planEstudio.codigo})` : ''),
        a.materia.nombre,
        a.catedra.nombre,
        a.cargo.nombre,
        a.modalidad.nombre,
        a.designacion.nombre,
        a.horasSemana != null ? String(a.horasSemana) : '—',
        a.anioInicio   != null ? String(a.anioInicio)   : '—',
        formatFechaCorta(a.fechaAprobacion),
      ]);

      // Pre-computar líneas de encabezado con wrap dinámico (misma fuente que datos)
      doc.setFontSize(p41Fs);
      doc.setFont('helvetica', 'bold');
      const p41HdrLines = p41Hdrs.map((h, i) =>
        doc.splitTextToSize(h.toUpperCase(), p41ColW[i] - p41Pad * 2) as string[]
      );
      const p41MaxHL = Math.max(...p41HdrLines.map(l => l.length), 1);
      const p41CHH   = Math.max(18, p41Pad + p41MaxHL * Math.ceil(p41Fs * p41LH) + p41Pad);

      // Pre-computar alturas de filas con wrap dinámico
      doc.setFont('helvetica', 'normal');
      const p41Rows = p41Data.map(row => {
        const cells = row.map((cell, i) =>
          doc.splitTextToSize(cell || '-', p41ColW[i] - p41Pad * 2) as string[]
        );
        const maxL = Math.max(...cells.map(c => c.length), 1);
        return { cells, rowH: Math.max(14, p41Pad + maxL * p41LineH + p41Pad) };
      });

      // Verificar espacio para encabezado de sección + col header + primera fila
      const p41SHH      = 24 + 18;
      const p41FirstH   = p41Rows.length > 0 ? p41Rows[0].rowH : 14;
      checkPage(p41SHH + p41CHH + p41FirstH);

      // Barra de sección principal
      doc.setFillColor(15, 76, 129);
      doc.rect(marginX, y, tableWidth, 24, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('Docencia universitaria', marginX + 8, y + 16);
      y += 24;

      // Barra de subtítulo
      doc.setFillColor(235, 241, 248);
      doc.rect(marginX, y, tableWidth, 18, 'F');
      doc.setDrawColor(190, 210, 230);
      doc.rect(marginX, y, tableWidth, 18);
      doc.setTextColor(15, 76, 129);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.text('4.1 Situación actual', marginX + 8, y + 12);
      y += 18;

      // Encabezados de columna (función redibujable en salto de página)
      const drawP41CH = () => {
        doc.setFillColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, p41CHH, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, p41CHH);
        doc.setTextColor(71, 85, 105);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(p41Fs);
        let cx = marginX;
        p41Hdrs.forEach((hdr, i) => {
          if (i > 0) doc.line(cx, y, cx, y + p41CHH);
          doc.text(p41HdrLines[i], cx + p41Pad, y + p41Pad + p41Fs, { lineHeightFactor: p41LH });
          cx += p41ColW[i];
        });
        y += p41CHH;
      };
      drawP41CH();

      if (p41Data.length === 0) {
        doc.setFillColor(248, 250, 252);
        doc.rect(marginX, y, tableWidth, 14, 'F');
        doc.setDrawColor(226, 232, 240);
        doc.rect(marginX, y, tableWidth, 14);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(148, 163, 184);
        doc.text('Sin registros', marginX + 6, y + 10);
        y += 14;
      } else {
        p41Rows.forEach(({ cells, rowH }, idx) => {
          if (y + rowH > PAGE_BOTTOM) { doc.addPage(); y = 50; drawP41CH(); }
          doc.setFillColor(idx % 2 === 0 ? 248 : 255, idx % 2 === 0 ? 250 : 255, idx % 2 === 0 ? 252 : 255);
          doc.rect(marginX, y, tableWidth, rowH, 'F');
          doc.setDrawColor(226, 232, 240);
          doc.rect(marginX, y, tableWidth, rowH);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(p41Fs);
          doc.setTextColor(30, 41, 59);
          const textY = y + p41Pad + p41Fs;
          let colX = marginX;
          cells.forEach((lines, i) => {
            if (i > 0) doc.line(colX, y, colX, y + rowH);
            doc.text(lines, colX + p41Pad, textY, { lineHeightFactor: p41LH });
            colX += p41ColW[i];
          });
          y += rowH;
        });
      }
      y += 12;
    }
    drawTableSection(
      '', '4.2 Actividades curriculares de posgrado',
      ['Carrera / Posgrado', 'Actividad curricular', 'Plan', 'Año inicio'],
      actividadesPosgrado.map(a => [a.carrerasPosgrado, a.actividadCurricular, a.plan, a.anioInicio]),
      [0.32, 0.36, 0.20, 0.12]
    );
    drawTableSection(
      '', '4.3 Trayectoria — cargos pasados',
      ['Período desde', 'Período hasta', 'Institución', 'Unidad Académica', 'Cargo', 'Modalidad', 'Ded. sem. (hs)'],
      trayectoriaCargosPasados.map(t => [t.periodoDesde, t.periodoHasta, t.institucion, t.unidadAcademica, t.cargo, t.modalidad, t.dedicacionSem]),
      [0.10, 0.10, 0.20, 0.18, 0.15, 0.15, 0.12]
    );
    drawSection('', '4.4 Dirección de tesis, tesinas y trabajos finales', [
      ['Tesis doctorales concluidas',  direccionTesisSummary.tesisDoctoralesConcluidas],
      ['Tesis doctorales en curso',    direccionTesisSummary.tesisDoctoralesActuales],
      ['Tesis de maestría concluidas', direccionTesisSummary.tesisMaestriaConcluidas],
      ['Tesis de maestría en curso',   direccionTesisSummary.tesisMaestriaActuales],
      ['Trabajos finales concluidos',  direccionTesisSummary.trabajosFinalesConcluidos],
      ['Trabajos finales en curso',    direccionTesisSummary.trabajosFinalesActuales],
    ]);
    drawSection('', '4.5 Experiencia en educación a distancia', [
      ['Descripción', formData.experienciaDistancia],
    ]);

    // ── 5. Gestión Académica ──────────────────────────────────
    drawTableSection(
      'Gestión Académica', '5.1 Cargos de gestión vigentes',
      ['Cargo', 'Institución', 'Modalidad', 'Período desde', 'Período hasta', 'Ded. sem. (hs)'],
      cargosAcademicos.map(c => [c.cargo, c.institucion, c.modalidad, c.periodoDesde, c.periodoHasta, c.dedicacionSemanal]),
      [0.20, 0.20, 0.15, 0.15, 0.15, 0.15]
    );
    drawTableSection(
      '', '5.2 Otras dedicaciones universitarias',
      ['Concepto', 'Horas seman. (hs)'],
      otrasDedicaciones.map(d => [d.concepto, d.horasSeman]),
      [0.75, 0.25]
    );

    // ── 6. Desempeño No Académico ─────────────────────────────
    drawTableSection(
      'Desempeño No Académico', '6.1 Desempeño no académico actual',
      ['Período desde', 'Período hasta', 'Institución', 'Cargo', 'Modalidad', 'Ded. sem. (hs)'],
      desempenoActual.map(d => [d.periodoDesde, d.periodoHasta, d.institucion, d.cargo, d.modalidad, d.dedicacionSeman]),
      [0.14, 0.14, 0.24, 0.20, 0.14, 0.14]
    );
    drawTableSection(
      '', '6.2 Desempeño no académico pasado',
      ['Período desde', 'Período hasta', 'Institución', 'Cargo'],
      desempenoPasado.map(d => [d.periodoDesde, d.periodoHasta, d.institucion, d.cargo]),
      [0.16, 0.16, 0.36, 0.32]
    );

    // ── 7. Investigación ──────────────────────────────────────
    drawTableSection(
      'Investigación', '7.1 Sistemas de promoción de la investigación',
      ['Sistema', 'Categoría', 'Detalle', 'Período desde', 'Período hasta'],
      sistemasPromocionInv.map(s => [s.sistema, s.categoria, s.detalle, s.periodoDesde, s.periodoHasta]),
      [0.22, 0.18, 0.26, 0.17, 0.17]
    );
    drawTableSection(
      '', '7.2 Participación en proyectos de investigación',
      ['Código', 'Título del proyecto', 'Rol', 'Hs semanales'],
      proyectosInvestigacion.map(p => [p.codigo, p.titulo, p.rol, p.horasSemanales]),
      [0.18, 0.50, 0.18, 0.14]
    );
    drawTableSection(
      '', '7.3 Participación en vinculación',
      ['Código', 'Actividad', 'Rol', 'Hs semanales'],
      participacionVinculacion.map(v => [v.codigo, v.actividad, v.rol, v.horasSemanales]),
      [0.18, 0.50, 0.18, 0.14]
    );
    drawTableSection(
      '', '7.4 Producción científica',
      ['Tipo', 'Referencia bibliográfica', 'Año'],
      produccionCientifica.map(p => [p.tipo, p.referenciaBibliografica, p.anio]),
      [0.22, 0.66, 0.12]
    );

    // ── 8. Reuniones Científicas ──────────────────────────────
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    drawTableSection(
      'Reuniones Científicas', '8.1 Congresos, jornadas y eventos académicos (Últimos 5 años)',
      ['Título', 'Lugar', 'Forma de participación', 'Tipo', 'Período'],
      reunionesCientificas.map(r => [r.titulo, r.lugar, r.formaParticipacion, r.tipo, r.fecha]),
      [0.32, 0.18, 0.22, 0.16, 0.12]
    );

    // ── 9. Comités y Jurados ──────────────────────────────────
    drawTableSection(
      'Comités y Jurados', '9.1 Participación en comités y jurados',
      ['Organismo convocante', 'Lugar', 'Tipo de evaluación', 'Fecha'],
      comitesJurados.map(c => [c.organismoConvocante, c.lugar, c.tipoEvaluacion, c.fecha]),
      [0.32, 0.22, 0.28, 0.18]
    );

    // ── 10. Otra Información ─────────────────────────────────
    drawSection('Otra Información', null, [
      ['10.1 Carrera docente o de posgrado en curso', formData.carreraDocentePosgrado],
      ['10.2 Actividades de transferencia o extensión a la comunidad', formData.actividadesTransferenciaExtension],
      ['10.3 Premios y distinciones', formData.premiosDistinciones],
      ['10.4 Estancias o cursos en el exterior', formData.estanciasCursosExterior],
      ['10.5 Membresías en instituciones científicas o profesionales', formData.membresiasInstituciones],
    ]);

    doc.save(`ficha-docente-${(formData.apellido || 'docente').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function getDatosPestana(tab: number): Partial<FormData> {
    if (!formData) return {};
    switch (tab) {
      case 1: return {
        nombre: formData.nombre, apellido: formData.apellido,
        sexo: formData.sexo, fechaNacimiento: formData.fechaNacimiento,
        tipoDocumento: formData.tipoDocumento, numeroDocumento: formData.numeroDocumento,
        cuit: formData.cuit,
        pisoDepto: formData.pisoDepto, residencia: formData.residencia,
        provincia: formData.provincia, localidad: formData.localidad,
        codigoPostal: formData.codigoPostal,
      };
      case 2: return {
        tituloGrado: formData.tituloGrado,
        tituloPosgrado: formData.tituloPosgrado,
        otrosTitulos: formData.otrosTitulos,
        carreraFormacionDocenteJson: formData.carreraFormacionDocenteJson,
      };
      case 3: return {
        areaDisciplinarId: formData.areaDisciplinarId || undefined,
        subareaId: formData.subareaId || undefined,
        observacionesArea: formData.observacionesArea,
      };
      case 4: return {
        asignaturasVinculadas: formData.asignaturasVinculadas,
        actividadesPosgradoJson: formData.actividadesPosgradoJson,
        trayectoriaCargosPasadosJson: formData.trayectoriaCargosPasadosJson,
        direccionTesisJson: formData.direccionTesisJson,
        experienciaDistancia: formData.experienciaDistancia,
      };
      case 5: return {
        cargosAcademicosJson: formData.cargosAcademicosJson,
        otrasDedicacionesJson: formData.otrasDedicacionesJson,
      };
      case 6: return {
        desempenoActualJson: formData.desempenoActualJson,
        desempenoPasadoJson: formData.desempenoPasadoJson,
      };
      case 7: return {
        sistemasPromocionInvestigacionJson: formData.sistemasPromocionInvestigacionJson,
        proyectosInvestigacionJson: formData.proyectosInvestigacionJson,
        participacionVinculacionJson: formData.participacionVinculacionJson,
        produccionCientificaJson: formData.produccionCientificaJson,
      };
      case 8: return {
        reunionesCientificasJson: formData.reunionesCientificasJson,
      };
      case 9: return {
        comitesJuradosJson: formData.comitesJuradosJson,
      };
      case 10: return {
        carreraDocentePosgrado: formData.carreraDocentePosgrado,
        actividadesTransferenciaExtension: formData.actividadesTransferenciaExtension,
        premiosDistinciones: formData.premiosDistinciones,
        estanciasCursosExterior: formData.estanciasCursosExterior,
        membresiasInstituciones: formData.membresiasInstituciones,
      };
      default: return {};
    }
  }

  async function guardarPestanaActual() {
    if (!formData) return;

    if (activeTab === 1 && !validarFicha()) {
      setError('Por favor completá los campos obligatorios marcados en rojo.');
      return;
    }
    if (esNuevoDocente && activeTab > 1 && !nuevoDocenteId) {
      setError('Primero guardá la Pestaña 1 (Datos Personales) para registrar el docente.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let endpoint: string;
      let method: string;

      if (esNuevoDocente) {
        const esCreacion = activeTab === 1 && !nuevoDocenteId;
        endpoint = esCreacion ? `${API_URL}/docentes` : `${API_URL}/docentes/${nuevoDocenteId}`;
        method = esCreacion ? 'POST' : 'PATCH';
      } else {
        endpoint = getFichaUpdateEndpoint();
        method = 'PATCH';
      }

      const payload = getDatosPestana(activeTab);
      const response = await apiFetch(endpoint, {
        method,
        body: JSON.stringify(payload),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);

      if (esNuevoDocente && activeTab === 1 && !nuevoDocenteId && result?.id) {
        setNuevoDocenteId(result.id);
      }

      const esUltimaNuevo = esNuevoDocente && activeTab === TAB_TITLES.length;
      setSuccessMessage(
        esUltimaNuevo
          ? 'Ficha completa guardada. Redirigiendo al listado...'
          : `Pestaña ${activeTab} guardada correctamente.${esNuevoDocente && activeTab < TAB_TITLES.length ? ` Podés continuar con la pestaña ${activeTab + 1}.` : ''}`
      );

      if (esUltimaNuevo) {
        setTimeout(() => router.push('/docentes'), 1500);
      } else {
        cargarFicha(true);
      }

    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function guardarFicha() {
    if (!formData) return;
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    if (!validarFicha()) {
      setError('Por favor completa los campos obligatorios marcados en rojo.');
      setSubmitting(false);
      return;
    }

    try {
      const response = await apiFetch(getFichaUpdateEndpoint(), {
        method: 'PATCH',
        body: JSON.stringify(formData),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);

      setSuccessMessage('Ficha actualizada correctamente.');
      setEditMode(false);
      setFieldErrors({});
      limpiarTituloForm();
      limpiarPosgradoForm();
      limpiarOtroTituloForm();
      setMostrarFormGrado(false);
      setMostrarFormPosgrado(false);
      setMostrarFormOtroTitulo(false);
      cargarFicha(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  async function darBajaLogica() {
    if (!formData?.activo) return;
    const confirmar = window.confirm('¿Confirmás la baja lógica del docente? El estado pasará a Inactivo.');
    if (!confirmar) return;

    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const response = await apiFetch(getFichaUpdateEndpoint(), {
        method: 'PATCH',
        body: JSON.stringify({ activo: false }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.message || `Error ${response.status}`);

      setFormData((current) => (current ? { ...current, activo: false } : current));
      setEditMode(false);
      setVinculacionesAprobadas([]);
      setSuccessMessage('Baja lógica aplicada. El estado del docente ahora es Inactivo.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function cancelarEdicion() {
    setEditMode(false);
    setFieldErrors({});
    limpiarTituloForm();
    limpiarPosgradoForm();
    limpiarOtroTituloForm();
    setMostrarFormGrado(false);
    setMostrarFormPosgrado(false);
    setMostrarFormOtroTitulo(false);
    cargarFicha();
  }

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">Cargando ficha docente...</div>;
  if (!formData) return <div className="min-h-screen bg-slate-50 flex items-center justify-center">No se pudo cargar la ficha docente.</div>;

  return (
    <main className="space-y-4 max-w-7xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-0.5">
              {esNuevoDocente ? 'Nuevo Docente' : esVistaDesdeListado ? 'Ficha docente' : 'Mi ficha docente'}
            </p>
            <h1 className="text-xl font-bold text-slate-800">
              {esNuevoDocente ? 'Crear Nuevo Docente' : `${formData.apellido} ${formData.nombre}`}
            </h1>
            {!esNuevoDocente && (
              <p className="mt-1 text-xs text-slate-500">Estado: <span className={`font-semibold ${formData.activo ? 'text-green-700' : 'text-red-600'}`}>{formData.activo ? 'Activo' : 'Inactivo'}</span></p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {esNuevoDocente ? (
              <>
                <button
                  type="button"
                  onClick={guardarPestanaActual}
                  disabled={submitting}
                  className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0a3960] transition"
                >
                  {submitting ? 'Guardando...' : `Guardar Pestaña ${activeTab}`}
                </button>
                <button type="button" onClick={() => router.push('/docentes')} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </>
            ) : puedeEditarFicha && editMode ? (
              <>
                <button type="button" onClick={guardarPestanaActual} disabled={submitting} className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0a3960] transition">
                  {submitting ? 'Guardando...' : `Guardar Cambios ${activeTab}`}
                </button>
                <button type="button" onClick={cancelarEdicion} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Cancelar
                </button>
              </>
            ) : puedeEditarFicha ? (
              <button type="button" onClick={() => { setEditMode(true); setActiveTab(1); }} className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0a3960] transition">
                Editar ficha
              </button>
            ) : null}
            {!esNuevoDocente && (
              <button type="button" onClick={exportarFichaDocente} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                Exportar ficha
              </button>
            )}
            {puedeDarBajaLogica ? (
              <button
                type="button"
                onClick={darBajaLogica}
                disabled={submitting || !formData.activo}
                className="rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100 transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                Baja lógica
              </button>
            ) : null}
          </div>
        </div>

        <section className="rounded-xl bg-white p-5 shadow-sm border border-slate-200">
          {error ? <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
          {successMessage ? <div className="mb-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{successMessage}</div> : null}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-2">
              {TAB_TITLES.map((tab, index) => (
                <button key={tab.numero} type="button" onClick={() => setActiveTab(index + 1)} className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium ${activeTab === index + 1 ? 'bg-[#0f4c81] text-white' : 'bg-white text-slate-700 border border-slate-200'}`}>
                  <span className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold ${activeTab === index + 1 ? 'bg-white text-[#0f4c81]' : 'bg-slate-200 text-slate-700'}`}>
                    {tab.numero}
                  </span>
                  <span>{tab.texto}</span>
                </button>
              ))}
            </div>
          </div>

          <div
            className="mt-4 space-y-6"
            onCompositionStart={() => { isComposingRef.current = true; }}
            onCompositionEnd={() => { isComposingRef.current = false; }}
          >
            {activeTab === 1 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Apellido *</p>
                      {editMode ? <input data-no-uppercase="true" value={formData.apellido} onChange={(e) => handleConstrainFieldChange('apellido', e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.apellido || '-'}</p>}
                      {fieldErrors.apellido ? <p className="mt-1 text-xs text-red-600">{fieldErrors.apellido}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Nombres *</p>
                      {editMode ? <input data-no-uppercase="true" value={formData.nombre} onChange={(e) => handleConstrainFieldChange('nombre', e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.nombre || '-'}</p>}
                      {fieldErrors.nombre ? <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Sexo *</p>
                      {editMode ? (
                        <select value={formData.sexo} onChange={(e) => handleFieldChange('sexo', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar</option>
                          <option value="Masculino">Masculino</option>
                          <option value="Femenino">Femenino</option>
                          <option value="Otro">Otro</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.sexo || '-'}</p>}
                      {fieldErrors.sexo ? <p className="mt-1 text-xs text-red-600">{fieldErrors.sexo}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Fecha Nac. *</p>
                      {editMode ? <input type="date" value={formData.fechaNacimiento} onChange={(e) => handleFieldChange('fechaNacimiento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.fechaNacimiento || '-'}</p>}
                      {fieldErrors.fechaNacimiento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.fechaNacimiento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Tipo Doc. *</p>
                      {editMode ? (
                        <select value={formData.tipoDocumento} onChange={(e) => handleFieldChange('tipoDocumento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="DNI">DNI</option>
                          <option value="PASAPORTE">PASAPORTE</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.tipoDocumento || '-'}</p>}
                      {fieldErrors.tipoDocumento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.tipoDocumento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">N° Documento *</p>
                      {editMode ? <input value={formData.numeroDocumento} onChange={(e) => handleConstrainFieldChange('numeroDocumento', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.numeroDocumento || '-'}</p>}
                      {fieldErrors.numeroDocumento ? <p className="mt-1 text-xs text-red-600">{fieldErrors.numeroDocumento}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Cuit *</p>
                      {editMode ? <input value={formData.cuit} onChange={(e) => handleConstrainFieldChange('cuit', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.cuit || '-'}</p>}
                      {fieldErrors.cuit ? <p className="mt-1 text-xs text-red-600">{fieldErrors.cuit}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Pais de Residencia</p>
                      {editMode ? <input data-no-uppercase="true" value={formData.residencia} onChange={(e) => handleConstrainFieldChange('residencia', e.target.value)} autoComplete="off" spellCheck={false} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.residencia || 'ARGENTINA'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Provincia</p>
                      {editMode ? (
                        <select value={formData.provincia} onChange={(e) => handleFieldChange('provincia', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <option value="">Seleccionar provincia</option>
                          <option value="Buenos Aires">Buenos Aires</option>
                          <option value="Catamarca">Catamarca</option>
                          <option value="Chaco">Chaco</option>
                          <option value="Chubut">Chubut</option>
                          <option value="Ciudad Autónoma de Buenos Aires">Ciudad Autónoma de Buenos Aires</option>
                          <option value="Córdoba">Córdoba</option>
                          <option value="Corrientes">Corrientes</option>
                          <option value="Entre Ríos">Entre Ríos</option>
                          <option value="Formosa">Formosa</option>
                          <option value="Jujuy">Jujuy</option>
                          <option value="La Pampa">La Pampa</option>
                          <option value="La Rioja">La Rioja</option>
                          <option value="Mendoza">Mendoza</option>
                          <option value="Misiones">Misiones</option>
                          <option value="Neuquén">Neuquén</option>
                          <option value="Río Negro">Río Negro</option>
                          <option value="Salta">Salta</option>
                          <option value="San Juan">San Juan</option>
                          <option value="San Luis">San Luis</option>
                          <option value="Santa Cruz">Santa Cruz</option>
                          <option value="Santa Fe">Santa Fe</option>
                          <option value="Santiago del Estero">Santiago del Estero</option>
                          <option value="Tierra del Fuego, Antártida e Islas del Atlántico Sur">Tierra del Fuego, Antártida e Islas del Atlántico Sur</option>
                          <option value="Tucumán">Tucumán</option>
                        </select>
                      ) : <p className="mt-1 text-sm">{formData.provincia || '-'}</p>}
                      {fieldErrors.provincia ? <p className="mt-1 text-xs text-red-600">{fieldErrors.provincia}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Departamento/Partido</p>
                      {editMode ? <input data-no-uppercase="true" value={formData.pisoDepto} onChange={(e) => handleConstrainFieldChange('pisoDepto', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.pisoDepto || '-'}</p>}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Localidad</p>
                      {editMode ? <input data-no-uppercase="true" value={formData.localidad} onChange={(e) => handleConstrainFieldChange('localidad', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.localidad || '-'}</p>}
                      {fieldErrors.localidad ? <p className="mt-1 text-xs text-red-600">{fieldErrors.localidad}</p> : null}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Codigo Postal</p>
                      {editMode ? <input value={formData.codigoPostal} onChange={(e) => handleConstrainFieldChange('codigoPostal', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /> : <p className="mt-1 text-sm">{formData.codigoPostal || '-'}</p>}
                      {fieldErrors.codigoPostal ? <p className="mt-1 text-xs text-red-600">{fieldErrors.codigoPostal}</p> : null}
                    </div>
                  </div>
                  <p className="mt-3 text-xs text-slate-500">Los campos marcados con * son obligatorios.</p>
                </div>
              </div>
            )}

            {activeTab === 2 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">2.1 Títulos de grado</p>
                    {editMode ? <button type="button" onClick={() => { limpiarTituloForm(); setMostrarFormGrado(true); }} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormGrado ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Titulo *</label><input data-no-uppercase="true" value={tituloForm.denominacion} onChange={(e) => actualizarCampoTitulo('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{tituloErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={tituloForm.anio} onChange={(e) => actualizarCampoTitulo('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.anio ? <p className="mt-1 text-xs text-red-600">{tituloErrors.anio}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Pais *</label><input data-no-uppercase="true" value={tituloForm.pais} onChange={(e) => actualizarCampoTitulo('pais', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.pais ? <p className="mt-1 text-xs text-red-600">{tituloErrors.pais}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institucion *</label><input data-no-uppercase="true" value={tituloForm.institucion} onChange={(e) => actualizarCampoTitulo('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{tituloErrors.institucion ? <p className="mt-1 text-xs text-red-600">{tituloErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarTituloGrado} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarTituloForm(); setMostrarFormGrado(false); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white"><tr><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Pais</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{titulosGrado.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : titulosGrado.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.pais}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <div className="inline-flex gap-1"><button type="button" onClick={() => editarTitulo(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar registro" title="Editar registro"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button><button type="button" onClick={() => eliminarTituloGrado(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar registro" title="Eliminar registro"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button></div> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">2.2 Posgrado</p>
                    {editMode ? <button type="button" onClick={() => { limpiarPosgradoForm(); setMostrarFormPosgrado(true); }} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormPosgrado ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Titulo *</label><input data-no-uppercase="true" value={posgradoForm.denominacion} onChange={(e) => actualizarCampoPosgrado('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Tipo *</label><select value={posgradoForm.tipoId} onChange={(e) => { const sel = tiposPosgrado.find(t => t.id === e.target.value); setPosgradoForm(prev => ({ ...prev, tipoId: e.target.value, tipo: sel?.nombre ?? '' })); setPosgradoErrors(prev => { const n = { ...prev }; delete n.tipo; return n; }); }} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"><option value="">Seleccionar</option>{tiposPosgrado.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select>{posgradoErrors.tipo ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.tipo}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={posgradoForm.anio} onChange={(e) => actualizarCampoPosgrado('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.anio ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.anio}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institucion *</label><input data-no-uppercase="true" value={posgradoForm.institucion} onChange={(e) => actualizarCampoPosgrado('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{posgradoErrors.institucion ? <p className="mt-1 text-xs text-red-600">{posgradoErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarTituloPosgrado} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarPosgradoForm(); setMostrarFormPosgrado(false); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white"><tr><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Tipo</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{titulosPosgrado.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : titulosPosgrado.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.tipo}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <div className="inline-flex gap-1"><button type="button" onClick={() => editarPosgrado(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar registro posgrado" title="Editar registro posgrado"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button><button type="button" onClick={() => eliminarTituloPosgrado(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar registro posgrado" title="Eliminar registro posgrado"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button></div> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">2.3 Otros títulos de nivel superior (terciario/técnico)</p>
                    {editMode ? <button type="button" onClick={() => { limpiarOtroTituloForm(); setMostrarFormOtroTitulo(true); }} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormOtroTitulo ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Titulo *</label><input data-no-uppercase="true" value={otroTituloForm.denominacion} onChange={(e) => actualizarCampoOtroTitulo('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={otroTituloForm.anio} onChange={(e) => actualizarCampoOtroTitulo('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.anio ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.anio}</p> : null}</div>
                        <div className="sm:col-span-2"><label className="text-xs uppercase text-slate-500">Institucion *</label><input data-no-uppercase="true" value={otroTituloForm.institucion} onChange={(e) => actualizarCampoOtroTitulo('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{otroTituloErrors.institucion ? <p className="mt-1 text-xs text-red-600">{otroTituloErrors.institucion}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarOtroTitulo} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarOtroTituloForm(); setMostrarFormOtroTitulo(false); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white"><tr><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Año</th><th className="px-3 py-2">Institucion</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{otrosTitulos.length === 0 ? <tr><td colSpan={4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : otrosTitulos.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2 text-right">{editMode ? <div className="inline-flex gap-1"><button type="button" onClick={() => editarOtroTitulo(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar otro titulo" title="Editar otro titulo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button><button type="button" onClick={() => eliminarOtroTitulo(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar otro titulo" title="Eliminar otro titulo"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button></div> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">2.4 Carrera de formación docente</p>
                    {editMode ? <button type="button" onClick={() => { limpiarCarreraFormDoc(); setMostrarFormCarreraFormDoc(true); }} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">+ Agregar</button> : null}
                  </div>
                  {editMode && mostrarFormCarreraFormDoc ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div><label className="text-xs uppercase text-slate-500">Titulo *</label><input data-no-uppercase="true" value={carreraFormDoc.denominacion} onChange={(e) => actualizarCampoCarreraFormDoc('denominacion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{carreraFormDocErrors.denominacion ? <p className="mt-1 text-xs text-red-600">{carreraFormDocErrors.denominacion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Institución *</label><input data-no-uppercase="true" value={carreraFormDoc.institucion} onChange={(e) => actualizarCampoCarreraFormDoc('institucion', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{carreraFormDocErrors.institucion ? <p className="mt-1 text-xs text-red-600">{carreraFormDocErrors.institucion}</p> : null}</div>
                        <div><label className="text-xs uppercase text-slate-500">Unidad Académica</label><input data-no-uppercase="true" value={carreraFormDoc.unidadAcademica} onChange={(e) => actualizarCampoCarreraFormDoc('unidadAcademica', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" /></div>
                        <div><label className="text-xs uppercase text-slate-500">Año *</label><input value={carreraFormDoc.anio} onChange={(e) => actualizarCampoCarreraFormDoc('anio', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />{carreraFormDocErrors.anio ? <p className="mt-1 text-xs text-red-600">{carreraFormDocErrors.anio}</p> : null}</div>
                      </div>
                      <div className="mt-4 flex justify-end gap-2">
                        <button type="button" onClick={guardarCarreraFormDoc} className="rounded-md bg-[#0f4c81] px-3 py-1.5 text-xs font-medium text-white">Guardar</button>
                        <button type="button" onClick={() => { limpiarCarreraFormDoc(); setMostrarFormCarreraFormDoc(false); }} className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700">Cancelar</button>
                      </div>
                    </div>
                  ) : null}
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white"><tr><th className="px-3 py-2">Titulo</th><th className="px-3 py-2">Institución</th><th className="px-3 py-2">Unidad Académica</th><th className="px-3 py-2">Año</th><th className="px-3 py-2 text-right">Accion</th></tr></thead>
                      <tbody>{carrerasFormacionDocente.length === 0 ? <tr><td colSpan={5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr> : carrerasFormacionDocente.map((item) => <tr key={item.id} className="border-t border-slate-100"><td className="px-3 py-2">{item.denominacion}</td><td className="px-3 py-2">{item.institucion}</td><td className="px-3 py-2">{item.unidadAcademica}</td><td className="px-3 py-2">{item.anio}</td><td className="px-3 py-2 text-right">{editMode ? <div className="inline-flex gap-1"><button type="button" onClick={() => editarCarreraFormDoc(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar carrera formacion docente" title="Editar carrera formacion docente"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button><button type="button" onClick={() => eliminarCarreraFormDoc(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar carrera formacion docente" title="Eliminar carrera formacion docente"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button></div> : null}</td></tr>)}</tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Área Disciplinar</p>
                      {editMode ? (
                        <select
                          value={formData.areaDisciplinarId}
                          onChange={(e) => {
                            const newAreaId = e.target.value;
                            handleFieldChange('areaDisciplinarId', newAreaId);
                            const subareaActual = subareas.find(s => s.id === formData.subareaId);
                            if (subareaActual && subareaActual.areaDisciplinarId !== newAreaId) {
                              handleFieldChange('subareaId', '');
                            }
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Seleccioná un área...</option>
                          {areasDisciplinares.map(a => (
                            <option key={a.id} value={a.id}>{a.nombre}</option>
                          ))}
                        </select>
                      ) : (
                        <p className="mt-1 text-sm">
                          {formData.areaDisciplinarId
                            ? ((areasDisciplinares.find(a => a.id === formData.areaDisciplinarId)?.nombre ?? formData.areaDisciplinar) || '-')
                            : (formData.areaDisciplinar || '-')}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="text-xs uppercase text-slate-500">Subárea</p>
                      {editMode ? (
                        <select
                          value={formData.subareaId}
                          onChange={(e) => handleFieldChange('subareaId', e.target.value)}
                          disabled={!formData.areaDisciplinarId}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">{formData.areaDisciplinarId ? 'Seleccioná una subárea...' : 'Primero seleccioná un área'}</option>
                          {subareas
                            .filter(s => s.areaDisciplinarId === formData.areaDisciplinarId)
                            .map(s => (
                              <option key={s.id} value={s.id}>{s.nombre}</option>
                            ))}
                        </select>
                      ) : (
                        <p className="mt-1 text-sm">
                          {formData.subareaId
                            ? ((subareas.find(s => s.id === formData.subareaId)?.nombre ?? formData.subarea) || '-')
                            : (formData.subarea || '-')}
                        </p>
                      )}
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
                      <p className="text-xs uppercase text-slate-500">Observaciones</p>
                      {editMode ? (
                        <textarea data-no-uppercase="true" value={formData.observacionesArea} onChange={(e) => handleFieldChange('observacionesArea', normalizarMayusculas(e.target.value))} rows={6} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-y" />
                      ) : <p className="mt-1 whitespace-pre-wrap break-words text-sm">{formData.observacionesArea || '-'}</p>}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 4 && (
              <div className="space-y-6">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-sm font-semibold text-slate-700">4.1 Situación actual</p>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 uppercase tracking-wide">Completado automáticamente</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-4">
                    Se actualiza con las vinculaciones a cátedra aprobadas en la Bandeja de Aprobaciones. No admite edición manual.
                  </p>
                  {loadingVinculaciones ? (
                    <div className="py-6 text-center text-xs text-slate-400">Cargando vinculaciones…</div>
                  ) : vinculacionesAprobadas.length === 0 ? (
                    <div className="py-8 text-center rounded-xl border border-slate-100 bg-slate-50">
                      <svg className="mx-auto mb-2 h-8 w-8 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-500">No posee vinculaciones a cátedra aprobadas.</p>
                      <p className="mt-1 text-xs text-slate-400">Las vinculaciones aprobadas en la Bandeja de Aprobaciones se mostrarán aquí.</p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-slate-200">
                      <table className="min-w-full text-sm">
                        <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                          <tr>
                            <th className="px-3 py-2 whitespace-nowrap">Facultad</th>
                            <th className="px-3 py-2 whitespace-nowrap">Carrera</th>
                            <th className="px-3 py-2 whitespace-nowrap">Plan</th>
                            <th className="px-3 py-2 whitespace-nowrap">Asignatura</th>
                            <th className="px-3 py-2 whitespace-nowrap">Cátedra</th>
                            <th className="px-3 py-2 whitespace-nowrap">Cargo</th>
                            <th className="px-3 py-2 whitespace-nowrap">Modalidad</th>
                            <th className="px-3 py-2 whitespace-nowrap">Designación</th>
                            <th className="px-3 py-2 whitespace-nowrap">H/SEM</th>
                            <th className="px-3 py-2 whitespace-nowrap">Año inicio</th>
                            <th className="px-3 py-2 whitespace-nowrap">Aprobada</th>
                          </tr>
                        </thead>
                        <tbody>
                          {vinculacionesAprobadas.map((v) => (
                            <tr key={v.id} className="border-t border-slate-100 hover:bg-slate-50/60 transition-colors">
                              <td className="px-3 py-2 text-slate-600 text-xs">{v.facultad.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">{v.carrera.nombre}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs">{v.planEstudio.nombre}{v.planEstudio.codigo ? ` (${v.planEstudio.codigo})` : ''}</td>
                              <td className="px-3 py-2 font-medium text-slate-800">{v.materia.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">{v.catedra.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">{v.cargo.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">{v.modalidad.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">{v.designacion.nombre}</td>
                              <td className="px-3 py-2 text-slate-700">
                                {v.horasSemana != null ? `${v.horasSemana} h/sem` : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-3 py-2 text-slate-700">{v.anioInicio ?? <span className="text-slate-400">—</span>}</td>
                              <td className="px-3 py-2 text-slate-500 text-xs whitespace-nowrap">{formatFechaCorta(v.fechaAprobacion)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Actividades curriculares de posgrado */}
                {editMode && mostrarFormActPosgrado && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoActPosgradoId ? 'Editar actividad' : 'Nueva actividad'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Carreras de posgrado *</p>
                        <input data-no-uppercase="true" value={actividadPosgradoForm.carrerasPosgrado} onChange={(e) => actualizarCampoActPosgrado('carrerasPosgrado', e.target.value)} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${actividadPosgradoErrors.carrerasPosgrado ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {actividadPosgradoErrors.carrerasPosgrado && <p className="mt-1 text-xs text-red-500">{actividadPosgradoErrors.carrerasPosgrado}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Actividad curricular</p>
                        <input data-no-uppercase="true" value={actividadPosgradoForm.actividadCurricular} onChange={(e) => actualizarCampoActPosgrado('actividadCurricular', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Plan</p>
                        <input data-no-uppercase="true" value={actividadPosgradoForm.plan} onChange={(e) => actualizarCampoActPosgrado('plan', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Año inicio</p>
                        <input value={actividadPosgradoForm.anioInicio} onChange={(e) => actualizarCampoActPosgrado('anioInicio', e.target.value.replace(/\D/g, '').slice(0, 4))} maxLength={4} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${actividadPosgradoErrors.anioInicio ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {actividadPosgradoErrors.anioInicio && <p className="mt-1 text-xs text-red-500">{actividadPosgradoErrors.anioInicio}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={guardarActividadPosgrado} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoActPosgradoId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={limpiarActividadPosgradoForm} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">4.2 Actividades curriculares de posgrado</p>
                    {editMode && !mostrarFormActPosgrado && (
                      <button type="button" onClick={() => { limpiarActividadPosgradoForm(); setMostrarFormActPosgrado(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Carreras de posgrado</th>
                          <th className="px-3 py-2">Actividad curricular</th>
                          <th className="px-3 py-2">Plan</th>
                          <th className="px-3 py-2">Año inicio</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {actividadesPosgrado.length === 0 ? (
                          <tr><td colSpan={editMode ? 5 : 4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : actividadesPosgrado.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{item.carrerasPosgrado || '-'}</td>
                            <td className="px-3 py-2">{item.actividadCurricular || '-'}</td>
                            <td className="px-3 py-2">{item.plan || '-'}</td>
                            <td className="px-3 py-2">{item.anioInicio || '-'}</td>
                            {editMode && (
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-1">
                                  <button type="button" onClick={() => editarActividadPosgrado(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                  <button type="button" onClick={() => eliminarActividadPosgrado(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4.2 Trayectoria — cargos pasados */}
                {editMode && mostrarFormTrayectoria && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoTrayectoriaId ? 'Editar cargo' : 'Nuevo cargo pasado'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Periodo desde</p>
                        <input value={trayectoriaCargoForm.periodoDesde} onChange={(e) => actualizarCampoTrayectoria('periodoDesde', formatearPeriodo(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Periodo hasta</p>
                        <input value={trayectoriaCargoForm.periodoHasta} onChange={(e) => actualizarCampoTrayectoria('periodoHasta', formatearPeriodo(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Institución *</p>
                        <input data-no-uppercase="true" value={trayectoriaCargoForm.institucion} onChange={(e) => actualizarCampoTrayectoria('institucion', normalizarMayusculas(e.target.value))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${trayectoriaCargoErrors.institucion ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {trayectoriaCargoErrors.institucion && <p className="mt-1 text-xs text-red-500">{trayectoriaCargoErrors.institucion}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Unidad académica</p>
                        <input data-no-uppercase="true" value={trayectoriaCargoForm.unidadAcademica} onChange={(e) => actualizarCampoTrayectoria('unidadAcademica', normalizarMayusculas(e.target.value))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Cargo *</p>
                        <select
                          value={trayectoriaCargoForm.cargoId}
                          onChange={(e) => {
                            const opt = cargosOpciones.find(c => c.id === e.target.value);
                            actualizarCampoTrayectoria('cargoId', e.target.value);
                            actualizarCampoTrayectoria('cargo', opt?.nombre ?? '');
                          }}
                          className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${trayectoriaCargoErrors.cargo ? 'border-red-400' : 'border-slate-200'} bg-white`}
                        >
                          <option value="">Seleccionar cargo...</option>
                          {cargosOpciones.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                        {!trayectoriaCargoForm.cargoId && trayectoriaCargoForm.cargo && (
                          <p className="mt-1 text-xs text-amber-600">Valor histórico: <strong>{trayectoriaCargoForm.cargo}</strong>. Seleccioná del listado para actualizar.</p>
                        )}
                        {trayectoriaCargoErrors.cargo && <p className="mt-1 text-xs text-red-500">{trayectoriaCargoErrors.cargo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Modalidad</p>
                        <select
                          value={trayectoriaCargoForm.modalidadId}
                          onChange={(e) => {
                            const opt = modalidadesOpciones.find(m => m.id === e.target.value);
                            actualizarCampoTrayectoria('modalidadId', e.target.value);
                            actualizarCampoTrayectoria('modalidad', opt?.nombre ?? '');
                          }}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                        >
                          <option value="">Seleccionar modalidad...</option>
                          {modalidadesOpciones.map(m => (
                            <option key={m.id} value={m.id}>{m.nombre}</option>
                          ))}
                        </select>
                        {!trayectoriaCargoForm.modalidadId && trayectoriaCargoForm.modalidad && (
                          <p className="mt-1 text-xs text-amber-600">Valor histórico: <strong>{trayectoriaCargoForm.modalidad}</strong>. Seleccioná del listado para actualizar.</p>
                        )}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Dedicación sem.</p>
                        <input value={trayectoriaCargoForm.dedicacionSem} onChange={(e) => actualizarCampoTrayectoria('dedicacionSem', e.target.value)} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={guardarTrayectoriaCargo} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoTrayectoriaId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={limpiarTrayectoriaCargoForm} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">4.3 Trayectoria — cargos pasados</p>
                    {editMode && !mostrarFormTrayectoria && (
                      <button type="button" onClick={() => { limpiarTrayectoriaCargoForm(); setMostrarFormTrayectoria(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Periodo desde</th>
                          <th className="px-3 py-2">Periodo hasta</th>
                          <th className="px-3 py-2">Institución</th>
                          <th className="px-3 py-2">Unidad académica</th>
                          <th className="px-3 py-2">Cargo</th>
                          <th className="px-3 py-2">Modalidad</th>
                          <th className="px-3 py-2">Dedicación sem.</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {trayectoriaCargosPasados.length === 0 ? (
                          <tr><td colSpan={editMode ? 8 : 7} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : trayectoriaCargosPasados.map((item) => (
                          <tr key={item.id} className="border-t border-slate-100">
                            <td className="px-3 py-2">{item.periodoDesde || '-'}</td>
                            <td className="px-3 py-2">{item.periodoHasta || '-'}</td>
                            <td className="px-3 py-2">{item.institucion || '-'}</td>
                            <td className="px-3 py-2">{item.unidadAcademica || '-'}</td>
                            <td className="px-3 py-2">{item.cargo || '-'}</td>
                            <td className="px-3 py-2">{item.modalidad || '-'}</td>
                            <td className="px-3 py-2">{item.dedicacionSem || '-'}</td>
                            {editMode && (
                              <td className="px-3 py-2 text-right">
                                <div className="inline-flex gap-1">
                                  <button type="button" onClick={() => editarTrayectoriaCargo(item)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                  <button type="button" onClick={() => eliminarTrayectoriaCargo(item.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 4.3 Dirección de tesis, tesinas y trabajos finales */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">4.4 Dirección de tesis, tesinas y trabajos finales</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {([
                      ['tesisDoctoralesConcluidas', 'Tesis doctorales concluidas (5 a.)'],
                      ['tesisDoctoralesActuales', 'Tesis doctorales actuales'],
                      ['tesisMaestriaConcluidas', 'Tesis maestría concluidas (5 a.)'],
                      ['tesisMaestriaActuales', 'Tesis maestría actuales'],
                      ['trabajosFinalesConcluidos', 'Trabajos finales concluidos (5 a.)'],
                      ['trabajosFinalesActuales', 'Trabajos finales actuales'],
                    ] as [keyof DireccionTesisSummary, string][]).map(([campo, label]) => (
                      <div key={campo} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                        <p className="text-xs uppercase text-slate-500">{label}</p>
                        {editMode ? (
                          <input
                            inputMode="numeric"
                            value={direccionTesisSummary[campo]}
                            onChange={(e) => actualizarCampoTesisSummary(campo, e.target.value)}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                          />
                        ) : (
                          <p className="mt-1 text-sm font-medium text-slate-700">{direccionTesisSummary[campo] || '0'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* 4.4 Experiencia en educación a distancia */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="text-sm font-semibold text-slate-700">4.5 Experiencia en educación a distancia</p>
                  <div className="mt-3">
                    {editMode ? (
                      <textarea
                        value={formData.experienciaDistancia}
                        onChange={(e) => handleFieldChange('experienciaDistancia', normalizarMayusculas(e.target.value))}
                        rows={5}
                        placeholder="Describa su experiencia si es docente de carreras semipresenciales o a distancia"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none placeholder:text-slate-400"
                      />
                    ) : (
                      <p className="whitespace-pre-wrap text-sm text-slate-700">{formData.experienciaDistancia || <span className="text-slate-400">Sin información cargada.</span>}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
            {activeTab === 5 && (
              <div className="space-y-6">
                {editMode && mostrarFormCargo && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoCargoId ? 'Editar cargo' : 'Nuevo cargo'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Cargo *</p>
                        <input data-no-uppercase="true" value={cargoForm.cargo} onChange={(e) => setCargoForm((prev) => ({ ...prev, cargo: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${cargoErrors.cargo ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {cargoErrors.cargo && <p className="mt-1 text-xs text-red-500">{cargoErrors.cargo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Institución *</p>
                        <input data-no-uppercase="true" value={cargoForm.institucion} onChange={(e) => setCargoForm((prev) => ({ ...prev, institucion: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${cargoErrors.institucion ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {cargoErrors.institucion && <p className="mt-1 text-xs text-red-500">{cargoErrors.institucion}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Modalidad *</p>
                        <select value={cargoForm.modalidad} onChange={(e) => setCargoForm((prev) => ({ ...prev, modalidad: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white ${cargoErrors.modalidad ? 'border-red-400' : 'border-slate-200'}`}>
                          <option value="">Seleccionar</option>
                          <option value="Anual">Anual</option>
                          <option value="Cuatrimestral">Cuatrimestral</option>
                        </select>
                        {cargoErrors.modalidad && <p className="mt-1 text-xs text-red-500">{cargoErrors.modalidad}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período desde</p>
                        <input value={cargoForm.periodoDesde} onChange={(e) => setCargoForm((prev) => ({ ...prev, periodoDesde: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período hasta</p>
                        <input value={cargoForm.periodoHasta} onChange={(e) => setCargoForm((prev) => ({ ...prev, periodoHasta: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Dedicación semanal (hs)</p>
                        <input value={cargoForm.dedicacionSemanal} onChange={(e) => setCargoForm((prev) => ({ ...prev, dedicacionSemanal: e.target.value.replace(/\D/g, '') }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" inputMode="numeric" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarCargoAcademico} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoCargoId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setCargoForm({ cargo: '', institucion: '', modalidad: '', periodoDesde: '', periodoHasta: '', dedicacionSemanal: '' }); setEditandoCargoId(null); setCargoErrors({}); setMostrarFormCargo(false); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">5.1 Cargos de gestión vigentes</p>
                    {editMode && !mostrarFormCargo && (
                      <button type="button" onClick={() => { setCargoForm({ cargo: '', institucion: '', modalidad: '', periodoDesde: '', periodoHasta: '', dedicacionSemanal: '' }); setCargoErrors({}); setMostrarFormCargo(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Cargo</th>
                          <th className="px-3 py-2">Institución</th>
                          <th className="px-3 py-2">Modalidad</th>
                          <th className="px-3 py-2">Período desde</th>
                          <th className="px-3 py-2">Período hasta</th>
                          <th className="px-3 py-2">Ded. sem. (hs)</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {cargosAcademicos.length === 0 ? (
                          <tr><td colSpan={editMode ? 7 : 6} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          cargosAcademicos.map((c) => (
                            <tr key={c.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{c.cargo || '-'}</td>
                              <td className="px-3 py-2">{c.institucion || '-'}</td>
                              <td className="px-3 py-2">{c.modalidad || '-'}</td>
                              <td className="px-3 py-2">{c.periodoDesde || '-'}</td>
                              <td className="px-3 py-2">{c.periodoHasta || '-'}</td>
                              <td className="px-3 py-2">{c.dedicacionSemanal || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarCargoAcademico(c)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                    <button type="button" onClick={() => eliminarCargoAcademico(c.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {editMode && mostrarFormOtraDedicacion && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoOtraDedicacionId ? 'Editar dedicación' : 'Nueva dedicación'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Concepto *</p>
                        <input data-no-uppercase="true" value={otraDedicacionForm.concepto} onChange={(e) => setOtraDedicacionForm((prev) => ({ ...prev, concepto: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${otraDedicacionErrors.concepto ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {otraDedicacionErrors.concepto && <p className="mt-1 text-xs text-red-500">{otraDedicacionErrors.concepto}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Horas seman. (hs)</p>
                        <input value={otraDedicacionForm.horasSeman} onChange={(e) => setOtraDedicacionForm((prev) => ({ ...prev, horasSeman: e.target.value.replace(/\D/g, '') }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" inputMode="numeric" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarOtraDedicacion} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoOtraDedicacionId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setOtraDedicacionForm({ concepto: '', horasSeman: '' }); setEditandoOtraDedicacionId(null); setOtraDedicacionErrors({}); setMostrarFormOtraDedicacion(false); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">5.2 Otras dedicaciones universitarias</p>
                    {editMode && !mostrarFormOtraDedicacion && (
                      <button type="button" onClick={() => { setOtraDedicacionForm({ concepto: '', horasSeman: '' }); setOtraDedicacionErrors({}); setMostrarFormOtraDedicacion(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Concepto</th>
                          <th className="px-3 py-2">Horas seman. (hs)</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {otrasDedicaciones.length === 0 ? (
                          <tr><td colSpan={editMode ? 3 : 2} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          otrasDedicaciones.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{d.concepto || '-'}</td>
                              <td className="px-3 py-2">{d.horasSeman || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarOtraDedicacion(d)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                    <button type="button" onClick={() => eliminarOtraDedicacion(d.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 6 && (
              <div className="space-y-6">
                {editMode && mostrarFormDesActual && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoDesActualId ? 'Editar registro' : 'Nuevo registro'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período desde</p>
                        <input value={desempenoActualForm.periodoDesde} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, periodoDesde: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período hasta</p>
                        <input value={desempenoActualForm.periodoHasta} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, periodoHasta: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Institución *</p>
                        <input data-no-uppercase="true" value={desempenoActualForm.institucion} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, institucion: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${desempenoActualErrors.institucion ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {desempenoActualErrors.institucion && <p className="mt-1 text-xs text-red-500">{desempenoActualErrors.institucion}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Cargo *</p>
                        <input data-no-uppercase="true" value={desempenoActualForm.cargo} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, cargo: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${desempenoActualErrors.cargo ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {desempenoActualErrors.cargo && <p className="mt-1 text-xs text-red-500">{desempenoActualErrors.cargo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Modalidad *</p>
                        <select value={desempenoActualForm.modalidad} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, modalidad: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm bg-white ${desempenoActualErrors.modalidad ? 'border-red-400' : 'border-slate-200'}`}>
                          <option value="">Seleccionar</option>
                          <option value="Anual">Anual</option>
                          <option value="Cuatrimestral">Cuatrimestral</option>
                        </select>
                        {desempenoActualErrors.modalidad && <p className="mt-1 text-xs text-red-500">{desempenoActualErrors.modalidad}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Dedicación seman. (hs)</p>
                        <input value={desempenoActualForm.dedicacionSeman} onChange={(e) => setDesempenoActualForm((prev) => ({ ...prev, dedicacionSeman: e.target.value.replace(/\D/g, '') }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" inputMode="numeric" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarDesempenoActual} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoDesActualId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setDesempenoActualForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '', modalidad: '', dedicacionSeman: '' }); setEditandoDesActualId(null); setDesempenoActualErrors({}); setMostrarFormDesActual(false); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">6.1 Desempeño no académico actual</p>
                    {editMode && !mostrarFormDesActual && (
                      <button type="button" onClick={() => { setDesempenoActualForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '', modalidad: '', dedicacionSeman: '' }); setDesempenoActualErrors({}); setMostrarFormDesActual(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Período desde</th>
                          <th className="px-3 py-2">Período hasta</th>
                          <th className="px-3 py-2">Institución</th>
                          <th className="px-3 py-2">Cargo</th>
                          <th className="px-3 py-2">Modalidad</th>
                          <th className="px-3 py-2">Ded. sem. (hs)</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {desempenoActual.length === 0 ? (
                          <tr><td colSpan={editMode ? 7 : 6} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          desempenoActual.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{d.periodoDesde || '-'}</td>
                              <td className="px-3 py-2">{d.periodoHasta || '-'}</td>
                              <td className="px-3 py-2">{d.institucion || '-'}</td>
                              <td className="px-3 py-2">{d.cargo || '-'}</td>
                              <td className="px-3 py-2">{d.modalidad || '-'}</td>
                              <td className="px-3 py-2">{d.dedicacionSeman || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarDesempenoActual(d)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                    <button type="button" onClick={() => eliminarDesempenoActual(d.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {editMode && mostrarFormDesPasado && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoDesPasadoId ? 'Editar registro' : 'Nuevo registro'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período desde</p>
                        <input value={desempenoPasadoForm.periodoDesde} onChange={(e) => setDesempenoPasadoForm((prev) => ({ ...prev, periodoDesde: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período hasta</p>
                        <input value={desempenoPasadoForm.periodoHasta} onChange={(e) => setDesempenoPasadoForm((prev) => ({ ...prev, periodoHasta: formatearPeriodo(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="mm-aaaa" maxLength={7} />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Institución *</p>
                        <input data-no-uppercase="true" value={desempenoPasadoForm.institucion} onChange={(e) => setDesempenoPasadoForm((prev) => ({ ...prev, institucion: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${desempenoPasadoErrors.institucion ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {desempenoPasadoErrors.institucion && <p className="mt-1 text-xs text-red-500">{desempenoPasadoErrors.institucion}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Cargo *</p>
                        <input data-no-uppercase="true" value={desempenoPasadoForm.cargo} onChange={(e) => setDesempenoPasadoForm((prev) => ({ ...prev, cargo: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${desempenoPasadoErrors.cargo ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {desempenoPasadoErrors.cargo && <p className="mt-1 text-xs text-red-500">{desempenoPasadoErrors.cargo}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarDesempenoPasado} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoDesPasadoId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setDesempenoPasadoForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '' }); setEditandoDesPasadoId(null); setDesempenoPasadoErrors({}); setMostrarFormDesPasado(false); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">6.2 Desempeño no académico pasado</p>
                    {editMode && !mostrarFormDesPasado && (
                      <button type="button" onClick={() => { setDesempenoPasadoForm({ periodoDesde: '', periodoHasta: '', institucion: '', cargo: '' }); setDesempenoPasadoErrors({}); setMostrarFormDesPasado(true); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Período desde</th>
                          <th className="px-3 py-2">Período hasta</th>
                          <th className="px-3 py-2">Institución</th>
                          <th className="px-3 py-2">Cargo</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {desempenoPasado.length === 0 ? (
                          <tr><td colSpan={editMode ? 5 : 4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          desempenoPasado.map((d) => (
                            <tr key={d.id} className="border-t border-slate-100">
                              <td className="px-3 py-2">{d.periodoDesde || '-'}</td>
                              <td className="px-3 py-2">{d.periodoHasta || '-'}</td>
                              <td className="px-3 py-2">{d.institucion || '-'}</td>
                              <td className="px-3 py-2">{d.cargo || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarDesempenoPasado(d)} className="rounded-md border border-slate-200 p-1.5 text-slate-600" aria-label="Editar" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M13.586 3.586a2 2 0 112.828 2.828l-8.12 8.12a2 2 0 01-.878.497l-3.11.889a.75.75 0 01-.927-.927l.889-3.11a2 2 0 01.497-.878l8.12-8.12z" /></svg></button>
                                    <button type="button" onClick={() => eliminarDesempenoPasado(d.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" aria-label="Eliminar" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 7 && (
              <div className="space-y-6">
                {/* 7.1 Sistemas de promoción de la investigación */}
                {editMode && mostrarFormSistPromoInv && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoSistPromoInvId ? 'Editar sistema de promoción' : 'Nuevo sistema de promoción'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Sistema *</p>
                        <select value={sistemaPromocionInvForm.sistema} onChange={(e) => setSistemaPromocionInvForm((prev) => ({ ...prev, sistema: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${sistemaPromocionInvErrors.sistema ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="CONICET">CONICET</option>
                          <option value="Programa de Incentivos">Programa de Incentivos</option>
                          <option value="Otros">Otros</option>
                        </select>
                        {sistemaPromocionInvErrors.sistema && <p className="mt-1 text-xs text-red-500">{sistemaPromocionInvErrors.sistema}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Categoría *</p>
                        <select value={sistemaPromocionInvForm.categoria} onChange={(e) => setSistemaPromocionInvForm((prev) => ({ ...prev, categoria: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${sistemaPromocionInvErrors.categoria ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Adjunto">Adjunto</option>
                          <option value="Asistente">Asistente</option>
                          <option value="Independiente">Independiente</option>
                          <option value="I">I</option>
                          <option value="II">II</option>
                          <option value="III">III</option>
                          <option value="IV">IV</option>
                          <option value="V">V</option>
                        </select>
                        {sistemaPromocionInvErrors.categoria && <p className="mt-1 text-xs text-red-500">{sistemaPromocionInvErrors.categoria}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Detalle</p>
                        <input data-no-uppercase="true" value={sistemaPromocionInvForm.detalle} onChange={(e) => setSistemaPromocionInvForm((prev) => ({ ...prev, detalle: normalizarMayusculas(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período desde</p>
                        <input value={sistemaPromocionInvForm.periodoDesde} onChange={(e) => setSistemaPromocionInvForm((prev) => ({ ...prev, periodoDesde: formatearPeriodo(e.target.value) }))} maxLength={7} placeholder="mm-aaaa" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período hasta</p>
                        <input value={sistemaPromocionInvForm.periodoHasta} onChange={(e) => setSistemaPromocionInvForm((prev) => ({ ...prev, periodoHasta: formatearPeriodo(e.target.value) }))} maxLength={7} placeholder="mm-aaaa" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarSistemaPromocionInv} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoSistPromoInvId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormSistPromoInv(false); setEditandoSistPromoInvId(null); setSistemaPromocionInvForm({ sistema: '', categoria: '', detalle: '', periodoDesde: '', periodoHasta: '' }); setSistemaPromocionInvErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">7.1 Sistemas de promoción de la investigación</p>
                    {editMode && !mostrarFormSistPromoInv && (
                      <button type="button" onClick={() => { setMostrarFormSistPromoInv(true); setEditandoSistPromoInvId(null); setSistemaPromocionInvForm({ sistema: '', categoria: '', detalle: '', periodoDesde: '', periodoHasta: '' }); setSistemaPromocionInvErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Sistema</th>
                          <th className="px-3 py-2">Categoría</th>
                          <th className="px-3 py-2">Detalle</th>
                          <th className="px-3 py-2">Período desde</th>
                          <th className="px-3 py-2">Período hasta</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {sistemasPromocionInv.length === 0 ? (
                          <tr><td colSpan={editMode ? 6 : 5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          sistemasPromocionInv.map((s) => (
                            <tr key={s.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{s.sistema || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{s.categoria || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{s.detalle || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{s.periodoDesde || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{s.periodoHasta || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarSistemaPromocionInv(s)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarSistemaPromocionInv(s.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 7.2 Participación en proyectos de investigación */}
                {editMode && mostrarFormProyecto && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoProyectoId ? 'Editar proyecto de investigación' : 'Nuevo proyecto de investigación'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Código</p>
                        <input value={proyectoForm.codigo} onChange={(e) => setProyectoForm((prev) => ({ ...prev, codigo: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Rol *</p>
                        <select value={proyectoForm.rol} onChange={(e) => setProyectoForm((prev) => ({ ...prev, rol: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${proyectoErrors.rol ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Investigador">Investigador</option>
                          <option value="Director">Director</option>
                        </select>
                        {proyectoErrors.rol && <p className="mt-1 text-xs text-red-500">{proyectoErrors.rol}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Título del proyecto *</p>
                        <input data-no-uppercase="true" value={proyectoForm.titulo} onChange={(e) => setProyectoForm((prev) => ({ ...prev, titulo: normalizarMayusculas(e.target.value) }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${proyectoErrors.titulo ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {proyectoErrors.titulo && <p className="mt-1 text-xs text-red-500">{proyectoErrors.titulo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Horas semanales</p>
                        <input value={proyectoForm.horasSemanales} onChange={(e) => setProyectoForm((prev) => ({ ...prev, horasSemanales: e.target.value.replace(/\D/g, '') }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarProyectoInvestigacion} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoProyectoId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormProyecto(false); setEditandoProyectoId(null); setProyectoForm({ codigo: '', titulo: '', rol: '', horasSemanales: '' }); setProyectoErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">7.2 Participación en proyectos de investigación</p>
                    {editMode && !mostrarFormProyecto && (
                      <button type="button" onClick={() => { setMostrarFormProyecto(true); setEditandoProyectoId(null); setProyectoForm({ codigo: '', titulo: '', rol: '', horasSemanales: '' }); setProyectoErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Título del proyecto</th>
                          <th className="px-3 py-2">Rol</th>
                          <th className="px-3 py-2">Hs semanales</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {proyectosInvestigacion.length === 0 ? (
                          <tr><td colSpan={editMode ? 5 : 4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          proyectosInvestigacion.map((p) => (
                            <tr key={p.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{p.codigo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{p.titulo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{p.rol || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{p.horasSemanales || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarProyecto(p)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarProyectoInvestigacion(p.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 7.3 Participación en vinculación */}
                {editMode && mostrarFormPartVinculacion && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoPartVinculacionId ? 'Editar participación en vinculación' : 'Nueva participación en vinculación'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Código</p>
                        <input value={participacionVinculacionForm.codigo} onChange={(e) => setParticipacionVinculacionForm((prev) => ({ ...prev, codigo: e.target.value }))} placeholder="PVF-FI 009/1" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Rol *</p>
                        <select value={participacionVinculacionForm.rol} onChange={(e) => setParticipacionVinculacionForm((prev) => ({ ...prev, rol: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${participacionVinculacionErrors.rol ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Participante">Participante</option>
                          <option value="Director">Director</option>
                        </select>
                        {participacionVinculacionErrors.rol && <p className="mt-1 text-xs text-red-500">{participacionVinculacionErrors.rol}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Actividad *</p>
                        <input data-no-uppercase="true" value={participacionVinculacionForm.actividad} onChange={(e) => setParticipacionVinculacionForm((prev) => ({ ...prev, actividad: normalizarMayusculas(e.target.value) }))} placeholder="Titulo de la actividad" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${participacionVinculacionErrors.actividad ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {participacionVinculacionErrors.actividad && <p className="mt-1 text-xs text-red-500">{participacionVinculacionErrors.actividad}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Horas semanales</p>
                        <input value={participacionVinculacionForm.horasSemanales} onChange={(e) => setParticipacionVinculacionForm((prev) => ({ ...prev, horasSemanales: e.target.value.replace(/\D/g, '') }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarParticipacionVinculacion} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoPartVinculacionId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormPartVinculacion(false); setEditandoPartVinculacionId(null); setParticipacionVinculacionForm({ codigo: '', actividad: '', rol: '', horasSemanales: '' }); setParticipacionVinculacionErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">7.3 Participación en vinculación</p>
                    {editMode && !mostrarFormPartVinculacion && (
                      <button type="button" onClick={() => { setMostrarFormPartVinculacion(true); setEditandoPartVinculacionId(null); setParticipacionVinculacionForm({ codigo: '', actividad: '', rol: '', horasSemanales: '' }); setParticipacionVinculacionErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Código</th>
                          <th className="px-3 py-2">Actividad</th>
                          <th className="px-3 py-2">Rol</th>
                          <th className="px-3 py-2">Hs semanales</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {participacionVinculacion.length === 0 ? (
                          <tr><td colSpan={editMode ? 5 : 4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          participacionVinculacion.map((v) => (
                            <tr key={v.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{v.codigo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{v.actividad || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{v.rol || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{v.horasSemanales || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarParticipacionVinculacion(v)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarParticipacionVinculacion(v.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 7.4 Producción científica */}
                {editMode && mostrarFormProdCient && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoProdCientId ? 'Editar producción científica' : 'Nueva producción científica'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Tipo *</p>
                        <select value={produccionCientificaForm.tipo} onChange={(e) => setProduccionCientificaForm((prev) => ({ ...prev, tipo: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${produccionCientificaErrors.tipo ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Publicación c/arbitraje">Publicación c/arbitraje</option>
                          <option value="Publicación s/arbitraje">Publicación s/arbitraje</option>
                          <option value="Capitulo de libro">Capitulo de libro</option>
                          <option value="Libro">Libro</option>
                          <option value="Congreso">Congreso</option>
                        </select>
                        {produccionCientificaErrors.tipo && <p className="mt-1 text-xs text-red-500">{produccionCientificaErrors.tipo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Año</p>
                        <input value={produccionCientificaForm.anio} onChange={(e) => setProduccionCientificaForm((prev) => ({ ...prev, anio: e.target.value.replace(/\D/g, '').slice(0, 4) }))} maxLength={4} placeholder="aaaa" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${produccionCientificaErrors.anio ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {produccionCientificaErrors.anio && <p className="mt-1 text-xs text-red-500">{produccionCientificaErrors.anio}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Referencia bibliográfica *</p>
                        <input data-no-uppercase="true" value={produccionCientificaForm.referenciaBibliografica} onChange={(e) => setProduccionCientificaForm((prev) => ({ ...prev, referenciaBibliografica: normalizarMayusculas(e.target.value) }))} placeholder="Autores, titulo, medio ..." className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${produccionCientificaErrors.referenciaBibliografica ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {produccionCientificaErrors.referenciaBibliografica && <p className="mt-1 text-xs text-red-500">{produccionCientificaErrors.referenciaBibliografica}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarProduccionCientifica} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoProdCientId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormProdCient(false); setEditandoProdCientId(null); setProduccionCientificaForm({ tipo: '', referenciaBibliografica: '', anio: '' }); setProduccionCientificaErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">7.4 Producción científica</p>
                    {editMode && !mostrarFormProdCient && (
                      <button type="button" onClick={() => { setMostrarFormProdCient(true); setEditandoProdCientId(null); setProduccionCientificaForm({ tipo: '', referenciaBibliografica: '', anio: '' }); setProduccionCientificaErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Referencia bibliográfica</th>
                          <th className="px-3 py-2">Año</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {produccionCientifica.length === 0 ? (
                          <tr><td colSpan={editMode ? 4 : 3} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          produccionCientifica.map((p) => (
                            <tr key={p.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{p.tipo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{p.referenciaBibliografica || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{p.anio || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarProduccionCientifica(p)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarProduccionCientifica(p.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 8 && (
              <div className="space-y-6">
                {/* 8.1 Congresos, jornadas y eventos académicos */}
                {editMode && mostrarFormReunion && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoReunionId ? 'Editar reunión científica' : 'Nueva reunión científica'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Título *</p>
                        <input data-no-uppercase="true" value={reunionCientificaForm.titulo} onChange={(e) => setReunionCientificaForm((prev) => ({ ...prev, titulo: normalizarMayusculas(e.target.value) }))} placeholder="Nombre del Evento" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${reunionCientificaErrors.titulo ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {reunionCientificaErrors.titulo && <p className="mt-1 text-xs text-red-500">{reunionCientificaErrors.titulo}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Lugar</p>
                        <input data-no-uppercase="true" value={reunionCientificaForm.lugar} onChange={(e) => setReunionCientificaForm((prev) => ({ ...prev, lugar: normalizarMayusculas(e.target.value) }))} placeholder="Ciudad" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Período</p>
                        <input value={reunionCientificaForm.fecha} onChange={(e) => setReunionCientificaForm((prev) => ({ ...prev, fecha: formatearPeriodo(e.target.value) }))} maxLength={7} placeholder="mm-aaaa" className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Forma de participación *</p>
                        <select value={reunionCientificaForm.formaParticipacion} onChange={(e) => setReunionCientificaForm((prev) => ({ ...prev, formaParticipacion: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${reunionCientificaErrors.formaParticipacion ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Panelista">Panelista</option>
                          <option value="Expositor">Expositor</option>
                          <option value="Asistente">Asistente</option>
                          <option value="Organizador">Organizador</option>
                        </select>
                        {reunionCientificaErrors.formaParticipacion && <p className="mt-1 text-xs text-red-500">{reunionCientificaErrors.formaParticipacion}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Tipo *</p>
                        <select value={reunionCientificaForm.tipo} onChange={(e) => setReunionCientificaForm((prev) => ({ ...prev, tipo: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${reunionCientificaErrors.tipo ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Congreso">Congreso</option>
                          <option value="Jornada">Jornada</option>
                          <option value="Seminario">Seminario</option>
                        </select>
                        {reunionCientificaErrors.tipo && <p className="mt-1 text-xs text-red-500">{reunionCientificaErrors.tipo}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarReunionCientifica} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoReunionId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormReunion(false); setEditandoReunionId(null); setReunionCientificaForm({ titulo: '', lugar: '', formaParticipacion: '', tipo: '', fecha: '' }); setReunionCientificaErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">8.1 Congresos, jornadas y eventos académicos (Últimos 5 años)</p>
                    {editMode && !mostrarFormReunion && (
                      <button type="button" onClick={() => { setMostrarFormReunion(true); setEditandoReunionId(null); setReunionCientificaForm({ titulo: '', lugar: '', formaParticipacion: '', tipo: '', fecha: '' }); setReunionCientificaErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Título</th>
                          <th className="px-3 py-2">Lugar</th>
                          <th className="px-3 py-2">Forma de participación</th>
                          <th className="px-3 py-2">Tipo</th>
                          <th className="px-3 py-2">Período</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {reunionesCientificas.length === 0 ? (
                          <tr><td colSpan={editMode ? 6 : 5} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          reunionesCientificas.map((r) => (
                            <tr key={r.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{r.titulo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.lugar || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.formaParticipacion || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.tipo || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{r.fecha || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarReunionCientifica(r)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarReunionCientifica(r.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 9 && (
              <div className="space-y-6">
                {/* 9.1 Participación en comités y jurados */}
                {editMode && mostrarFormComite && (
                  <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3">
                    <p className="text-sm font-semibold text-slate-700">{editandoComiteId ? 'Editar comité / jurado' : 'Nuevo comité / jurado'}</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Organismo convocante *</p>
                        <input data-no-uppercase="true" value={comiteJuradoForm.organismoConvocante} onChange={(e) => setComiteJuradoForm((prev) => ({ ...prev, organismoConvocante: normalizarMayusculas(e.target.value) }))} placeholder="Organismo" className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${comiteJuradoErrors.organismoConvocante ? 'border-red-400' : 'border-slate-200'} bg-white`} />
                        {comiteJuradoErrors.organismoConvocante && <p className="mt-1 text-xs text-red-500">{comiteJuradoErrors.organismoConvocante}</p>}
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Lugar</p>
                        <input data-no-uppercase="true" value={comiteJuradoForm.lugar} onChange={(e) => setComiteJuradoForm((prev) => ({ ...prev, lugar: normalizarMayusculas(e.target.value) }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5">
                        <p className="text-xs uppercase text-slate-500">Fecha</p>
                        <input type="date" value={comiteJuradoForm.fecha} onChange={(e) => setComiteJuradoForm((prev) => ({ ...prev, fecha: e.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm" />
                      </div>
                      <div className="rounded-xl border border-slate-200 bg-white p-2.5 sm:col-span-2">
                        <p className="text-xs uppercase text-slate-500">Tipo de evaluación *</p>
                        <select value={comiteJuradoForm.tipoEvaluacion} onChange={(e) => setComiteJuradoForm((prev) => ({ ...prev, tipoEvaluacion: e.target.value }))} className={`mt-1 w-full rounded-xl border px-3 py-2 text-sm ${comiteJuradoErrors.tipoEvaluacion ? 'border-red-400' : 'border-slate-200'} bg-white`}>
                          <option value="">Seleccionar</option>
                          <option value="Concurso">Concurso</option>
                          <option value="Evaluación de Proyectos">Evaluación de Proyectos</option>
                          <option value="Producciones Académicas">Producciones Académicas</option>
                          <option value="Otros">Otros</option>
                        </select>
                        {comiteJuradoErrors.tipoEvaluacion && <p className="mt-1 text-xs text-red-500">{comiteJuradoErrors.tipoEvaluacion}</p>}
                      </div>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button type="button" onClick={agregarComiteJurado} className="rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">{editandoComiteId ? 'Actualizar' : 'Agregar'}</button>
                      <button type="button" onClick={() => { setMostrarFormComite(false); setEditandoComiteId(null); setComiteJuradoForm({ organismoConvocante: '', lugar: '', tipoEvaluacion: '', fecha: '' }); setComiteJuradoErrors({}); }} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600">Cancelar</button>
                    </div>
                  </div>
                )}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-700">9.1 Participación en comités y jurados</p>
                    {editMode && !mostrarFormComite && (
                      <button type="button" onClick={() => { setMostrarFormComite(true); setEditandoComiteId(null); setComiteJuradoForm({ organismoConvocante: '', lugar: '', tipoEvaluacion: '', fecha: '' }); setComiteJuradoErrors({}); }} className="rounded-md bg-sky-600 px-3 py-1 text-xs font-medium text-white">+ Agregar</button>
                    )}
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200">
                    <table className="min-w-full text-sm">
                      <thead className="bg-[#0f4c81] text-left text-xs uppercase text-white">
                        <tr>
                          <th className="px-3 py-2">Organismo convocante</th>
                          <th className="px-3 py-2">Lugar</th>
                          <th className="px-3 py-2">Tipo de evaluación</th>
                          <th className="px-3 py-2">Fecha</th>
                          {editMode && <th className="px-3 py-2 text-right">Acciones</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {comitesJurados.length === 0 ? (
                          <tr><td colSpan={editMode ? 5 : 4} className="px-3 py-3 text-slate-500">Sin registros cargados.</td></tr>
                        ) : (
                          comitesJurados.map((c) => (
                            <tr key={c.id} className="border-t border-slate-100">
                              <td className="px-3 py-2 text-slate-700">{c.organismoConvocante || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{c.lugar || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{c.tipoEvaluacion || '-'}</td>
                              <td className="px-3 py-2 text-slate-700">{c.fecha || '-'}</td>
                              {editMode && (
                                <td className="px-3 py-2 text-right">
                                  <div className="inline-flex gap-1">
                                    <button type="button" onClick={() => editarComiteJurado(c)} className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" /><path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" /></svg></button>
                                    <button type="button" onClick={() => eliminarComiteJurado(c.id)} className="rounded-md border border-red-200 p-1.5 text-red-500 hover:bg-red-50" title="Eliminar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4"><path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" /></svg></button>
                                  </div>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            {activeTab === 10 && (
              <div className="space-y-6">
                {/* 10.1 */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">10.1 Carrera docente o de posgrado en curso</p>
                  {editMode ? (
                    <textarea
                      data-no-uppercase="true"
                      value={formData?.carreraDocentePosgrado ?? ''}
                      onChange={(e) => { const val = normalizarMayusculas(e.target.value); setFormData((prev) => prev ? { ...prev, carreraDocentePosgrado: val } : prev); }}
                      placeholder="Especialización, Maestría o Doctorado que está cursando"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData?.carreraDocentePosgrado || <span className="text-slate-400">Sin información registrada.</span>}</p>
                  )}
                </div>
                {/* 10.2 */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">10.2 Actividades de transferencia o extensión a la comunidad</p>
                  {editMode ? (
                    <textarea
                      data-no-uppercase="true"
                      value={formData?.actividadesTransferenciaExtension ?? ''}
                      onChange={(e) => { const val = normalizarMayusculas(e.target.value); setFormData((prev) => prev ? { ...prev, actividadesTransferenciaExtension: val } : prev); }}
                      placeholder="Descripción de la actividad"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData?.actividadesTransferenciaExtension || <span className="text-slate-400">Sin información registrada.</span>}</p>
                  )}
                </div>
                {/* 10.3 */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">10.3 Premios y distinciones</p>
                  {editMode ? (
                    <textarea
                      data-no-uppercase="true"
                      value={formData?.premiosDistinciones ?? ''}
                      onChange={(e) => { const val = normalizarMayusculas(e.target.value); setFormData((prev) => prev ? { ...prev, premiosDistinciones: val } : prev); }}
                      placeholder="Trabajos en Congresos, trayectoria profesional o de investigación"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData?.premiosDistinciones || <span className="text-slate-400">Sin información registrada.</span>}</p>
                  )}
                </div>
                {/* 10.4 */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">10.4 Estancias o cursos en el exterior</p>
                  {editMode ? (
                    <textarea
                      data-no-uppercase="true"
                      value={formData?.estanciasCursosExterior ?? ''}
                      onChange={(e) => { const val = normalizarMayusculas(e.target.value); setFormData((prev) => prev ? { ...prev, estanciasCursosExterior: val } : prev); }}
                      placeholder="Institución, país, periodo, motivo"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData?.estanciasCursosExterior || <span className="text-slate-400">Sin información registrada.</span>}</p>
                  )}
                </div>
                {/* 10.5 */}
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <p className="mb-2 text-sm font-semibold text-slate-700">10.5 Membresías en instituciones científicas o profesionales</p>
                  {editMode ? (
                    <textarea
                      data-no-uppercase="true"
                      value={formData?.membresiasInstituciones ?? ''}
                      onChange={(e) => { const val = normalizarMayusculas(e.target.value); setFormData((prev) => prev ? { ...prev, membresiasInstituciones: val } : prev); }}
                      placeholder="Institución, tipo de membresía, periodo"
                      rows={4}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm resize-none focus:border-sky-400 focus:outline-none"
                    />
                  ) : (
                    <p className="text-sm text-slate-700 whitespace-pre-wrap">{formData?.membresiasInstituciones || <span className="text-slate-400">Sin información registrada.</span>}</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {editMode ? (
            <div className="mt-8 flex justify-end gap-3">
              <button type="button" onClick={guardarPestanaActual} disabled={submitting} className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white disabled:opacity-50 hover:bg-[#0a3960] transition">
                {submitting ? 'Guardando...' : esNuevoDocente ? `Guardar Pestaña ${activeTab}` : `Guardar Cambios ${activeTab}`}
              </button>
              {!esNuevoDocente && (
                <button type="button" onClick={cancelarEdicion} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
                  Cancelar
                </button>
              )}
            </div>
          ) : null}
        </section>
    </main>
  );
}
