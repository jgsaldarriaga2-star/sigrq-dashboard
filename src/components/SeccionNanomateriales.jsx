/**
 * SeccionNanomateriales.jsx
 * SIGRQ — Formulario de nanomateriales (ANSES Nanotool 2010)
 *
 * Inputs mapeados exactamente a evaluarNano(params) en sigrq-motor-riesgo.js:
 *   hbBase           → clasificación CLP del bulk/análogo (1–5 | null)
 *   esAnalogo        → boolean
 *   insoluble1h      → boolean
 *   mayorReactividad → boolean
 *   formaFisica      → "solido"|"liquido"|"polvo"|"aerosol"
 *   modificadores    → ["friable","volátil","altaPolvosidad"]
 *   procesos         → ["fuerzasExternas","fundición","dispersionLiquido",
 *                        "evaporacionPolvo","pulverización","sinAerosol"]
 *   esFibraBiopersistente → boolean
 *
 * Props:
 *   value    → { esNanomaterial: bool, nano_params: object }
 *   onChange → función que recibe el nuevo value
 *
 * Integración en NuevaSustanciaPage:
 *   1. Agregar al estado inicial: nanoData: { esNanomaterial: false, nano_params: {} }
 *   2. En el payload del backend:
 *        uso.es_nanomaterial = nanoData.esNanomaterial
 *        fds.nano_params     = nanoData.nano_params
 *   3. Renderizar: <SeccionNanomateriales value={nanoData} onChange={setNanoData} />
 */

import { useState } from "react";
import {
  FlaskConical, AlertTriangle, ChevronDown, ChevronUp,
  HelpCircle, CheckCircle2, Info
} from "lucide-react";

// ─── Datos de clasificación (espejo de FRASE_H_A_HB del motor) ───────────────

const CLASIFICACIONES_HB = [
  {
    hb: null,
    label: "Sin datos / toxicología desconocida",
    badge: "—",
    badgeColor: "bg-gray-100 text-gray-600",
    desc: "No se dispone de datos de bulk ni de análogo → CL5 automático (evaluación por experto obligatoria)",
  },
  {
    hb: 1,
    label: "HB1 — Irritante leve",
    badge: "HB1",
    badgeColor: "bg-green-100 text-green-700",
    desc: "Eye irrit. 2 · Skin irrit. 2",
  },
  {
    hb: 2,
    label: "HB2 — Tóxico sistémico leve",
    badge: "HB2",
    badgeColor: "bg-yellow-100 text-yellow-700",
    desc: "Acute tox. 4 · STOT-SE 2",
  },
  {
    hb: 3,
    label: "HB3 — Tóxico agudo moderado / Corrosivo",
    badge: "HB3",
    badgeColor: "bg-orange-100 text-orange-700",
    desc: "Acute tox. 3 · STOT-RE 2 · Skin Corr. 1 · Eye Dam. 1 · Skin sens. 1 · STOT-SE 3",
  },
  {
    hb: 4,
    label: "HB4 — Tóxico severo / Repro / Carc. 2",
    badge: "HB4",
    badgeColor: "bg-red-100 text-red-700",
    desc: "Acute tox. 1–2 · STOT-SE 1 · STOT-RE 1 · Repro. Tox 1A/1B · Carc. 2",
  },
  {
    hb: 5,
    label: "HB5 — Carcinógeno Cat 1 / Mutágeno / Sensibilizante resp.",
    badge: "HB5",
    badgeColor: "bg-purple-100 text-purple-700",
    desc: "Carc. 1A/1B · Muta. 1A/1B · Muta. 2 · Resp. sens. 1",
  },
];

const FORMAS_FISICAS = [
  { key: "solido",  label: "Sólido",  desc: "Bloque, película, pasta — EP base: 1" },
  { key: "liquido", label: "Líquido", desc: "Suspensión, dispersión acuosa — EP base: 2" },
  { key: "polvo",   label: "Polvo",   desc: "Polvo seco, granulado fino — EP base: 3" },
  { key: "aerosol", label: "Aerosol", desc: "Spray, niebla, nanoaerosol — EP base: 4" },
];

const MODIFICADORES = [
  {
    key: "friable",
    label: "Material friable",
    desc: "Se rompe o desintegra fácilmente en partículas finas al manipularlo",
    delta: "+2 EP",
    deltaColor: "text-red-600",
  },
  {
    key: "volátil",
    label: "Alta volatilidad",
    desc: "El material o su portador tienden a evaporarse a temperatura ambiente",
    delta: "+1 EP",
    deltaColor: "text-orange-600",
  },
  {
    key: "altaPolvosidad",
    label: "Alta generación de polvo",
    desc: "El proceso genera polvo fino de nanopartículas con facilidad",
    delta: "+1 EP",
    deltaColor: "text-orange-600",
  },
];

const PROCESOS = [
  {
    key: "fuerzasExternas",
    label: "Fuerzas mecánicas externas",
    desc: "Molienda, trituración, mecanizado, lijado — liberación intensa de nano",
    delta: "+3 EP",
    deltaColor: "text-red-700",
  },
  {
    key: "fundición",
    label: "Fundición / alta temperatura",
    desc: "Proceso térmico que puede liberar nanopartículas por evaporación",
    delta: "+1 EP",
    deltaColor: "text-orange-600",
  },
  {
    key: "dispersionLiquido",
    label: "Dispersión en líquido",
    desc: "Nanomaterial incorporado o dispersado en fase acuosa u orgánica",
    delta: "+1 EP",
    deltaColor: "text-orange-600",
  },
  {
    key: "evaporacionPolvo",
    label: "Evaporación / secado de polvo",
    desc: "Secado de suspensiones o soluciones con nanomaterial",
    delta: "+1 EP",
    deltaColor: "text-orange-600",
  },
  {
    key: "pulverización",
    label: "Pulverización / spray",
    desc: "Atomización de líquido o sólido que contiene nanomaterial",
    delta: "+1/+2 EP",
    deltaColor: "text-red-600",
  },
  {
    key: "sinAerosol",
    label: "Sin generación de aerosol",
    desc: "El proceso garantiza que no se forman aerosoles (encapsulado, húmedo…)",
    delta: "−1 EP",
    deltaColor: "text-green-600",
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label, id }) {
  return (
    <label htmlFor={id} className="flex items-center gap-3 cursor-pointer select-none">
      <div
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${
          checked ? "bg-blue-600" : "bg-gray-300"
        }`}
        onClick={onChange}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ${
            checked ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
    </label>
  );
}

function BoolCard({ checked, onChange, label, desc, warning = false }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`w-full text-left rounded-lg border-2 p-3 transition-all duration-150 ${
        checked
          ? warning
            ? "border-red-500 bg-red-50"
            : "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
            checked
              ? warning
                ? "border-red-500 bg-red-500"
                : "border-blue-500 bg-blue-500"
              : "border-gray-300"
          }`}
        >
          {checked && (
            <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div>
          <p className={`text-sm font-medium ${checked && warning ? "text-red-800" : "text-gray-800"}`}>
            {label}
          </p>
          {desc && <p className="text-xs text-gray-500 mt-0.5">{desc}</p>}
        </div>
      </div>
    </button>
  );
}

function DeltaBadge({ delta, color }) {
  return (
    <span className={`ml-auto text-xs font-mono font-bold ${color}`}>{delta}</span>
  );
}

function SectionLabel({ children, help }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <p className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{children}</p>
      {help && (
        <div className="group relative">
          <HelpCircle className="h-4 w-4 text-gray-400 cursor-help" />
          <div className="absolute left-6 top-0 z-10 hidden group-hover:block w-64 rounded-lg bg-gray-800 text-white text-xs p-3 shadow-xl">
            {help}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const NANO_DEFAULTS = {
  hbBase: null,
  esAnalogo: false,
  insoluble1h: false,
  mayorReactividad: false,
  formaFisica: "solido",
  modificadores: [],
  procesos: [],
  esFibraBiopersistente: false,
};

export default function SeccionNanomateriales({ value, onChange }) {
  const [expandido, setExpandido] = useState(false);

  const esNano = value?.esNanomaterial || false;
  const p = value?.nano_params || NANO_DEFAULTS;

  const setEsNano = (val) => {
    onChange({
      esNanomaterial: val,
      nano_params: val ? (value?.nano_params || NANO_DEFAULTS) : NANO_DEFAULTS,
    });
    if (val) setExpandido(true);
  };

  const update = (field, val) =>
    onChange({ ...value, nano_params: { ...p, [field]: val } });

  const toggleArr = (field, key) => {
    const arr = p[field] || [];
    update(field, arr.includes(key) ? arr.filter((k) => k !== key) : [...arr, key]);
  };

  // Vista previa HB final (para orientación al usuario)
  const previewHBFinal = () => {
    if (p.esFibraBiopersistente) return { hb: 5, label: "HB5 (fibra biopersistente)", color: "text-purple-700" };
    if (p.hbBase === null) return { hb: "5*", label: "CL5 (sin datos)", color: "text-red-600" };
    let hb = p.hbBase;
    if (p.esAnalogo) hb += 1;
    if (p.insoluble1h) hb += 1;
    if (p.mayorReactividad) hb += 1;
    hb = Math.min(5, Math.max(2, hb));
    const colors = { 2: "text-yellow-600", 3: "text-orange-600", 4: "text-red-600", 5: "text-purple-700" };
    return { hb, label: `HB${hb} (final con ajustes)`, color: colors[hb] || "text-gray-700" };
  };

  const hbPreview = esNano ? previewHBFinal() : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 flex items-center justify-between gap-4 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-100">
            <FlaskConical className="h-5 w-5 text-purple-600" />
          </div>
          <div>
            <p className="font-semibold text-gray-900">Nanomateriales</p>
            <p className="text-xs text-gray-500">ANSES Nanotool 2010 — Evaluación Control Banding nano</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Toggle
            id="toggle-nano"
            checked={esNano}
            onChange={() => setEsNano(!esNano)}
            label="Es nanomaterial"
          />
        </div>
      </div>

      {/* Si no es nano, mostrar mensaje informativo */}
      {!esNano && (
        <div className="px-5 py-4 flex items-center gap-3 text-sm text-gray-500">
          <Info className="h-4 w-4 flex-shrink-0" />
          <span>
            Active esta opción si la sustancia contiene partículas con al menos una dimensión entre 1–100 nm
            (nanotubos, nanopartículas, quantum dots, etc.).
          </span>
        </div>
      )}

      {/* Formulario nano */}
      {esNano && (
        <div className="px-5 pb-6 pt-4 space-y-6">

          {/* ── Alerta fibra biopersistente ─────────────────────────── */}
          <BoolCard
            checked={p.esFibraBiopersistente}
            onChange={() => update("esFibraBiopersistente", !p.esFibraBiopersistente)}
            label="⚠ Fibra biopersistente (asbesto, lana mineral, CNT largos…)"
            desc="Si se activa, el resultado es CL5 directo — evaluación completa por experto obligatoria."
            warning={true}
          />

          {/* Si es fibra biopersistente, no mostrar el resto */}
          {p.esFibraBiopersistente ? (
            <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800">Resultado: CL5 — Contención total + especialista</p>
                <p className="text-xs text-red-700 mt-1">
                  Las fibras biopersistentes requieren evaluación completa según normativa específica.
                  No se aplica la matriz Nanotool estándar.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* ── 1. Clasificación CLP del bulk/análogo ───────────────── */}
              <div>
                <SectionLabel help="Usar la clasificación CLP del material en tamaño convencional (bulk) o de un material análogo con estructura química similar.">
                  1. Clasificación CLP del material bulk / análogo
                </SectionLabel>
                <div className="space-y-2">
                  {CLASIFICACIONES_HB.map((c) => (
                    <button
                      key={String(c.hb)}
                      type="button"
                      onClick={() => update("hbBase", c.hb)}
                      className={`w-full text-left rounded-lg border-2 px-4 py-3 flex items-center gap-3 transition-all duration-150 ${
                        p.hbBase === c.hb
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.badgeColor} min-w-[36px] text-center`}>
                        {c.badge}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800">{c.label}</p>
                        <p className="text-xs text-gray-500 truncate">{c.desc}</p>
                      </div>
                      {p.hbBase === c.hb && (
                        <CheckCircle2 className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 2. Factores de incremento de HB ───────────────────── */}
              <div>
                <SectionLabel help="Cada factor incrementa en 1 la banda de peligro final (HB máximo: 5, mínimo: 2).">
                  2. Factores de incremento de peligro
                </SectionLabel>
                <div className="grid grid-cols-1 gap-2">
                  <BoolCard
                    checked={p.esAnalogo}
                    onChange={() => update("esAnalogo", !p.esAnalogo)}
                    label="Se usó material análogo (no hay datos del bulk exacto)"
                    desc="Incertidumbre adicional por extrapolar de un material distinto → +1 HB"
                  />
                  <BoolCard
                    checked={p.insoluble1h}
                    onChange={() => update("insoluble1h", !p.insoluble1h)}
                    label="No se disuelve completamente en agua en 1 hora"
                    desc="Persistencia en el sistema biológico — mayor biopersistencia → +1 HB"
                  />
                  <BoolCard
                    checked={p.mayorReactividad}
                    onChange={() => update("mayorReactividad", !p.mayorReactividad)}
                    label="Mayor reactividad que el material de referencia (PM/AM)"
                    desc="Superficie específica mayor, catálisis, reactividad superficial mejorada → +1 HB"
                  />
                </div>

                {/* Preview HB final */}
                {p.hbBase !== undefined && (
                  <div className="mt-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-2 flex items-center gap-2">
                    <span className="text-xs text-gray-500">HB final estimado:</span>
                    <span className={`text-sm font-bold ${hbPreview?.color}`}>
                      {hbPreview?.label}
                    </span>
                  </div>
                )}
              </div>

              {/* ── 3. Forma física del nanomaterial ──────────────────── */}
              <div>
                <SectionLabel help="La forma física en la que se manipula el nanomaterial en el puesto de trabajo. Determina el EP base.">
                  3. Forma física en el puesto de trabajo
                </SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAS_FISICAS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      onClick={() => update("formaFisica", f.key)}
                      className={`rounded-lg border-2 px-4 py-3 text-left transition-all duration-150 ${
                        p.formaFisica === f.key
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <p className="text-sm font-semibold text-gray-800">{f.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{f.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 4. Modificadores del material ─────────────────────── */}
              <div>
                <SectionLabel help="Características intrínsecas del material que aumentan su potencial de emisión.">
                  4. Modificadores — características del material
                </SectionLabel>
                <div className="space-y-2">
                  {MODIFICADORES.map((m) => (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => toggleArr("modificadores", m.key)}
                      className={`w-full text-left rounded-lg border-2 px-4 py-3 flex items-center gap-3 transition-all duration-150 ${
                        (p.modificadores || []).includes(m.key)
                          ? "border-orange-400 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                          (p.modificadores || []).includes(m.key)
                            ? "border-orange-400 bg-orange-400"
                            : "border-gray-300"
                        }`}
                      >
                        {(p.modificadores || []).includes(m.key) && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{m.label}</p>
                        <p className="text-xs text-gray-500">{m.desc}</p>
                      </div>
                      <DeltaBadge delta={m.delta} color={m.deltaColor} />
                    </button>
                  ))}
                </div>
              </div>

              {/* ── 5. Procesos / operaciones ─────────────────────────── */}
              <div>
                <SectionLabel help="Seleccione todos los procesos que involucran el nanomaterial. Pueden combinarse.">
                  5. Procesos / operaciones involucradas
                </SectionLabel>
                <div className="space-y-2">
                  {PROCESOS.map((proc) => (
                    <button
                      key={proc.key}
                      type="button"
                      onClick={() => toggleArr("procesos", proc.key)}
                      className={`w-full text-left rounded-lg border-2 px-4 py-3 flex items-center gap-3 transition-all duration-150 ${
                        (p.procesos || []).includes(proc.key)
                          ? proc.key === "sinAerosol"
                            ? "border-green-400 bg-green-50"
                            : "border-orange-400 bg-orange-50"
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      <div
                        className={`h-5 w-5 flex-shrink-0 rounded border-2 flex items-center justify-center ${
                          (p.procesos || []).includes(proc.key)
                            ? proc.key === "sinAerosol"
                              ? "border-green-400 bg-green-400"
                              : "border-orange-400 bg-orange-400"
                            : "border-gray-300"
                        }`}
                      >
                        {(p.procesos || []).includes(proc.key) && (
                          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-800">{proc.label}</p>
                        <p className="text-xs text-gray-500">{proc.desc}</p>
                      </div>
                      <DeltaBadge delta={proc.delta} color={proc.deltaColor} />
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
