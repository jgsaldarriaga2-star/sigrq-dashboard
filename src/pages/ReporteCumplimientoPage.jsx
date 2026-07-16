/**
 * ReporteCumplimientoPage.jsx
 * SIGRQ — Reporte de cumplimiento normativo
 *
 * Genera un informe PDF del inventario completo de sustancias
 * con indicadores de cumplimiento para auditorías SGSST.
 *
 * Ruta: /reporte-cumplimiento
 * Roles: admin, coordinador_hse
 *
 * Integración en App.jsx:
 *   import ReporteCumplimientoPage from "./pages/ReporteCumplimientoPage";
 *   <Route path="/reporte-cumplimiento" element={<PrivateRoute><ReporteCumplimientoPage /></PrivateRoute>} />
 *
 * Botón en DashboardPage:
 *   <Boton icono="📋" titulo="Reporte" desc="Informe de cumplimiento normativo"
 *     onClick={() => navigate("/reporte-cumplimiento")} />
 */

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, getDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NIVEL_LABEL = { 1: "Bajo", 2: "Moderado", 3: "Alto", 4: "Muy Alto" };
const NIVEL_COLOR_PRINT = {
  1: "#16a34a", 2: "#ca8a04", 3: "#ea580c", 4: "#dc2626",
};
const PIEL_NUM = { bajo: 1, medio: 2, alto: 3 };

function nivelInhalacion(s) {
  return s.evaluacion?.inhalacion?.nivel ?? 0;
}
function nivelPiel(s) {
  return PIEL_NUM[s.evaluacion?.piel?.nivel] ?? 0;
}
function nivelGlobal(s) {
  return Math.max(nivelInhalacion(s), nivelPiel(s));
}
function estadoFDS(fds_caducidad) {
  if (!fds_caducidad) return "sin_datos";
  const dias = (new Date(fds_caducidad) - new Date()) / (1000 * 60 * 60 * 24);
  if (dias < 0) return "vencida";
  if (dias <= 180) return "proxima";
  return "vigente";
}
function formatFecha(str) {
  if (!str) return "—";
  try {
    return new Date(str).toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return str; }
}
function formatTs(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });
  } catch { return "—"; }
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function ReporteCumplimientoPage() {
  const { empresaId, role, sedeId } = useAuth();
  const navigate = useNavigate();

  const [sustancias, setSustancias] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [empresa, setEmpresa] = useState(null);
  const [loading, setLoading] = useState(true);
  // coordinador_hse arranca con su propia sede pre-seleccionada, igual que
  // en InventarioPage.jsx — sigue siendo un filtro normal, puede cambiarlo.
  const [filtroSede, setFiltroSede] = useState(() => (role === "coordinador_hse" && sedeId) ? sedeId : "todas");

  useEffect(() => {
    if (!empresaId) return;
    async function cargar() {
      try {
        const [snapS, snapSedes, snapEmp] = await Promise.all([
          getDocs(query(collection(db, "empresas", empresaId, "sustancias"), orderBy("creadoEn", "desc"))),
          getDocs(query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"))),
          getDoc(doc(db, "empresas", empresaId, "config", "empresa")),
        ]);
        setSustancias(snapS.docs.map(d => ({ id: d.id, ...d.data() })));
        setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
        if (snapEmp.exists()) setEmpresa(snapEmp.data());
      } catch (err) {
        console.error("Error cargando reporte:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [empresaId]);

  // Filtrado por sede
  const lista = filtroSede === "todas"
    ? sustancias
    : sustancias.filter(s => s.uso?.sedeId === filtroSede);

  // Métricas
  const total        = lista.length;
  const criticas     = lista.filter(s => (s.evaluacion?.requiere_asesor && !s.gestion?.asesor_consultado) || (nivelGlobal(s) >= 4 && !s.gestion?.controles_implementados)).length;
  const fdsVencidas  = lista.filter(s => estadoFDS(s.evaluacion?.fds_caducidad) === "vencida").length;
  const fdsVigentes  = lista.filter(s => estadoFDS(s.evaluacion?.fds_caducidad) === "vigente").length;
  const pctVigentes  = total > 0 ? Math.round(fdsVigentes / total * 100) : 0;

  const nombreSedeFiltro = filtroSede === "todas"
    ? "Todas las sedes"
    : sedes.find(s => s.id === filtroSede)?.nombre || filtroSede;

  const hoy = new Date().toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" });

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
      Generando reporte…
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100">

      {/* Barra de acciones — oculta al imprimir */}
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate("/dashboard")}
          className="text-sm text-gray-500 hover:text-gray-800">
          ← Dashboard
        </button>
        <div className="flex items-center gap-4">
          {sedes.length > 1 && (
            <select
              value={filtroSede}
              onChange={e => setFiltroSede(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              <option value="todas">Todas las sedes</option>
              {sedes.map(s => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            🖨 Exportar PDF
          </button>
        </div>
      </div>

      {/* INFORME — área de impresión */}
      <div className="max-w-5xl mx-auto px-6 py-8 print:px-0 print:py-0 print:max-w-none">
        <div className="bg-white shadow-sm rounded-2xl print:shadow-none print:rounded-none p-8 print:p-6">

          {/* ── ENCABEZADO ──────────────────────────────────────── */}
          <div className="flex items-start justify-between pb-4 border-b-2 border-gray-200 mb-6">
            <div className="flex items-start gap-4">
              {empresa?.logo_base64 ? (
                <img src={empresa.logo_base64} alt="Logo" className="h-14 object-contain" />
              ) : (
                <div className="h-14 w-28 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                  Logo
                </div>
              )}
              <div>
                <p className="font-bold text-gray-800 text-base">{empresa?.nombre_empresa || "Empresa"}</p>
                {empresa?.nit && <p className="text-xs text-gray-500">NIT: {empresa.nit}</p>}
                {empresa?.direccion && <p className="text-xs text-gray-500">{empresa.direccion}{empresa.ciudad ? `, ${empresa.ciudad}` : ""}</p>}
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 uppercase tracking-widest">Reporte de Cumplimiento</p>
              <p className="text-xs text-gray-400 uppercase tracking-widest">Gestión de Riesgos Químicos</p>
              <p className="text-xs text-gray-500 mt-2">Fecha: <span className="font-medium text-gray-700">{hoy}</span></p>
              <p className="text-xs text-gray-500">Alcance: <span className="font-medium text-gray-700">{nombreSedeFiltro}</span></p>
            </div>
          </div>

          {/* ── RESUMEN EJECUTIVO ───────────────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-4">
              Resumen Ejecutivo
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <TarjetaMetrica
                valor={total}
                label="Evaluaciones registradas"
                color="#2563eb"
              />
              <TarjetaMetrica
                valor={criticas}
                label="Requieren atención"
                sub={`${total > 0 ? Math.round(criticas / total * 100) : 0}% del total`}
                color="#dc2626"
              />
              <TarjetaMetrica
                valor={fdsVencidas}
                label="FDS vencidas"
                sub="Actualizar inmediatamente"
                color="#ea580c"
              />
              <TarjetaMetrica
                valor={`${pctVigentes}%`}
                label="FDS vigentes"
                sub={`${fdsVigentes} de ${total}`}
                color="#16a34a"
              />
            </div>
          </div>

          {/* ── DISTRIBUCIÓN POR NIVEL ──────────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-4">
              Distribución por Nivel de Riesgo
            </h2>
            <div className="grid grid-cols-4 gap-3">
              {[4, 3, 2, 1].map(n => {
                const cant = lista.filter(s => nivelGlobal(s) === n).length;
                const pct  = total > 0 ? Math.round(cant / total * 100) : 0;
                return (
                  <div key={n} className="border border-gray-200 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold" style={{ color: NIVEL_COLOR_PRINT[n] }}>{cant}</div>
                    <div className="text-xs font-semibold mt-1" style={{ color: NIVEL_COLOR_PRINT[n] }}>
                      {NIVEL_LABEL[n]}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{pct}%</div>
                    {/* Barra */}
                    <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: NIVEL_COLOR_PRINT[n] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── INVENTARIO COMPLETO ─────────────────────────────── */}
          <div className="mb-8">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
              Inventario de Evaluaciones ({total})
            </h2>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Sustancia</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">CAS</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Área / Sede</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Inhalación</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Piel</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Fuego</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Asesor</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">FDS</th>
                  <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Evaluado</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((s, i) => {
                  const ev     = s.evaluacion ?? {};
                  const nInh   = nivelInhalacion(s);
                  const nPiel  = ev.piel?.nivel;
                  const estado = estadoFDS(ev.fds_caducidad);
                  const sedeName = sedes.find(sd => sd.id === s.uso?.sedeId)?.nombre || null;
                  const critica = (ev.requiere_asesor && !s.gestion?.asesor_consultado) || (nivelGlobal(s) >= 4 && !s.gestion?.controles_implementados);

                  return (
                    <tr key={s.id} style={{ backgroundColor: critica ? "#fff7ed" : (i % 2 === 0 ? "#ffffff" : "#f9fafb") }}>
                      <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800 max-w-36" title={ev.sustancia || s.fds?.nombre_comercial || ""}>
                        {(ev.sustancia || s.fds?.nombre_comercial || "—").length > 40
                          ? (ev.sustancia || s.fds?.nombre_comercial).slice(0, 40) + "…"
                          : (ev.sustancia || s.fds?.nombre_comercial || "—")}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-500 whitespace-nowrap">
                        {ev.cas || s.fds?.numero_cas || "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-gray-600">
                        <div>{ev.area || s.uso?.area || "—"}</div>
                        {sedeName && <div className="text-gray-400">{sedeName}</div>}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">
                        <span className="font-bold text-xs" style={{ color: NIVEL_COLOR_PRINT[nInh] || "#6b7280" }}>
                          {NIVEL_LABEL[nInh] || "N/E"}
                        </span>
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center capitalize text-gray-600">
                        {nPiel || "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-600">
                        {ev.fuego?.serie
                          ? ({ "100": "Bajo", "200": "Moderado", "300": "Alto", "400": "Muy Alto" }[String(ev.fuego.serie)] || `S${ev.fuego.serie}`)
                          : ev.fuego?.grupoPC || "—"}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">
                        {(ev.requiere_asesor && !s.gestion?.asesor_consultado)
                          ? <span className="text-red-600 font-bold">⚠ Sí</span>
                          : <span className="text-gray-400">No</span>}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center">
                        {estado === "vencida"  && <span className="text-red-600 font-bold">Vencida</span>}
                        {estado === "proxima"  && <span className="text-orange-500 font-bold">Próxima</span>}
                        {estado === "vigente"  && <span className="text-green-600">Vigente</span>}
                        {estado === "sin_datos"&& <span className="text-gray-400">—</span>}
                      </td>
                      <td className="border border-gray-200 px-2 py-1.5 text-center text-gray-500 whitespace-nowrap">
                        {formatFecha(ev.fecha_evaluacion)}
                      </td>
                    </tr>
                  );
                })}
                {lista.length === 0 && (
                  <tr>
                    <td colSpan={9} className="border border-gray-200 px-4 py-6 text-center text-gray-400">
                      No hay sustancias registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ── SUSTANCIAS CRÍTICAS ─────────────────────────────── */}
          {criticas > 0 && (
            <div className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">
                Sustancias que Requieren Atención Inmediata
              </h2>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-red-50">
                    <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Sustancia</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Área</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-600">Nivel global</th>
                    <th className="border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-600">Acción recomendada</th>
                  </tr>
                </thead>
                <tbody>
                  {lista
                    .filter(s => (s.evaluacion?.requiere_asesor && !s.gestion?.asesor_consultado) || (nivelGlobal(s) >= 4 && !s.gestion?.controles_implementados))
                    .map((s, i) => {
                      const ev = s.evaluacion ?? {};
                      const ng = nivelGlobal(s);
                      let accion = "";
                      if (ev.requiere_asesor) accion = "Consultar asesor especializado en seguridad química";
                      else if (ng === 3) accion = "Implementar controles técnicos — aislamiento de fuente";
                      else if (ng === 4) accion = "Sistema cerrado obligatorio — asesor especializado";
                      if (estadoFDS(ev.fds_caducidad) === "vencida") accion += " · Actualizar FDS";

                      return (
                        <tr key={s.id} style={{ backgroundColor: i % 2 === 0 ? "#fff7ed" : "#fef3c7" }}>
                          <td className="border border-gray-200 px-2 py-1.5 font-medium text-gray-800">
                            {ev.sustancia || "—"}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-gray-600">
                            {ev.area || s.uso?.area || "—"}
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-center">
                            <span className="font-bold" style={{ color: NIVEL_COLOR_PRINT[ng] || "#6b7280" }}>
                              {NIVEL_LABEL[ng] || "N/E"}
                            </span>
                          </td>
                          <td className="border border-gray-200 px-2 py-1.5 text-gray-700">{accion}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── PIE DE PÁGINA ───────────────────────────────────── */}
          <div className="mt-8 pt-4 border-t border-gray-200">
            <div className="flex items-end justify-between">
              <div className="text-xs text-gray-400 space-y-1">
                <p>Generado por <span className="font-medium">SIGRQ</span> · Sistema de Gestión de Riesgos Químicos</p>
                <p>Metodología: OIT/BAuA EvariQui + EMKG · Decreto 1072 de 2015 · Resolución 0312 de 2019</p>
                <p>Este reporte es de uso interno para el Sistema de Gestión de Seguridad y Salud en el Trabajo (SGSST).</p>
              </div>
              <div className="text-center min-w-48">
                <div className="border-b border-gray-400 mb-2 h-10" />
                <p className="text-xs font-semibold text-gray-700">
                  {empresa?.responsable_hse || "Responsable HSE"}
                </p>
                <p className="text-xs text-gray-500">
                  {empresa?.cargo_responsable || "Coordinador HSE"}
                </p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* CSS impresión */}
      <style>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1cm 1.5cm; size: A4 landscape; }
        }
      `}</style>
    </div>
  );
}

// ─── Sub-componentes ──────────────────────────────────────────────────────────

function TarjetaMetrica({ valor, label, sub, color }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4 text-center">
      <div className="text-3xl font-bold" style={{ color }}>{valor}</div>
      <div className="text-xs font-semibold text-gray-700 mt-1">{label}</div>
      {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
    </div>
  );
}
