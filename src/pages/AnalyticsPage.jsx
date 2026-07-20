/**
 * AnalyticsPage.jsx
 * SIGRQ — Dashboard Analytics por empresa
 * Lee directamente de Firestore colección 'sustancias'
 *
 * Integración en el router (App.jsx o equivalente):
 *   import AnalyticsPage from "./pages/AnalyticsPage";
 *   <Route path="/analytics" element={<AnalyticsPage />} />
 *
 * Agregar enlace en el menú/sidebar:
 *   <Link to="/analytics">Analytics</Link>
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "../services/firebase";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend,
} from "recharts";
import {
  AlertTriangle, FlaskConical, MapPin, FileWarning,
  TrendingUp, ChevronLeft, Loader2,
} from "lucide-react";

// ─── Colores por nivel de inhalación ─────────────────────────────
const COLOR_NIVEL = {
  1: { bg: "bg-green-100",  text: "text-green-700",  hex: "#22c55e", label: "Nivel 1 — Bajo" },
  2: { bg: "bg-yellow-100", text: "text-yellow-700", hex: "#eab308", label: "Nivel 2 — Moderado" },
  3: { bg: "bg-orange-100", text: "text-orange-700", hex: "#f97316", label: "Nivel 3 — Alto" },
  4: { bg: "bg-red-100",    text: "text-red-700",    hex: "#ef4444", label: "Nivel 4 — Muy Alto" },
};

const COLOR_PIEL = {
  bajo:  { hex: "#22c55e", label: "Bajo" },
  medio: { hex: "#eab308", label: "Medio" },
  alto:  { hex: "#ef4444", label: "Alto" },
};

// ─── Helpers ──────────────────────────────────────────────────────
function esFDSCaducada(fds_caducidad) {
  if (!fds_caducidad) return false;
  return new Date(fds_caducidad) < new Date();
}

function nivelPielNum(nivel) {
  return { bajo: 1, medio: 2, alto: 3 }[nivel] || 0;
}

// ─── Componente Card resumen ──────────────────────────────────────
function CardResumen({ icono, titulo, valor, sub, color }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>{icono}</div>
      <div>
        <p className="text-2xl font-bold text-gray-800">{valor}</p>
        <p className="text-sm font-medium text-gray-700">{titulo}</p>
        {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Tooltip personalizado para Pie ──────────────────────────────
function TooltipPie({ active, payload }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow px-3 py-2 text-sm">
      <p className="font-semibold">{payload[0].name}</p>
      <p className="text-gray-600">{payload[0].value} evaluación{payload[0].value !== 1 ? "es" : ""}</p>
    </div>
  );
}

// ─── Tick personalizado del eje X — área arriba, sede debajo ─────
// Recharts clona este elemento e inyecta x/y/payload/index; el prop `data`
// (el mismo array dataAreas) se preserva para poder leer el campo "sede"
// de esa misma fila, ya que el payload del tick solo trae el valor de
// dataKey ("area"), no el resto de campos de la fila.
function CustomXAxisTick({ x, y, payload, index, data }) {
  const fila = data?.[index];
  const area = payload?.value ?? fila?.area ?? "";
  const sede = fila?.sede;
  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#374151">
        {area}
      </text>
      {sede && (
        <text x={0} y={0} dy={26} textAnchor="middle" fontSize={9} fill="#9ca3af">
          {sede}
        </text>
      )}
    </g>
  );
}

// ─── Componente principal ─────────────────────────────────────────
export default function AnalyticsPage() {
  const navigate = useNavigate();
const { empresaId, role, sedeId } = useAuth();
const [loading, setLoading] = useState(true);
const [sustancias, setSustancias] = useState([]);
const [sedes, setSedes] = useState([]);

  // admin/superadmin ven todas las sedes a la vez, así que un área con el
  // mismo nombre en dos sedes distintas ("Lavado" en Sede A y en Sede B) se
  // mezclaría en una sola barra si solo se agrupara por nombre de área.
  const mostrarSedeEnGrafico = role === "admin" || role === "superadmin";

  useEffect(() => {
  async function cargar() {
    try {
      const [snapSustancias, snapSedes] = await Promise.all([
        getDocs(query(collection(db, "empresas", empresaId, "sustancias"), orderBy("creadoEn", "desc"))),
        getDocs(collection(db, "empresas", empresaId, "sedes")),
      ]);
      let docs = snapSustancias.docs.map(d => ({ id: d.id, ...d.data() }));
      if ((role === "operario" || role === "coordinador_hse") && sedeId) {
        docs = docs.filter(s => s.uso?.sedeId === sedeId);
      }
      setSustancias(docs);
      setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error cargando analytics:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  // ── Métricas derivadas ─────────────────────────────────────────
  const total = sustancias.length;

  const requierenAsesor = sustancias.filter(
    s => (s.evaluacion?.requiere_asesor && !s.gestion?.asesor_consultado) ||
         (s.evaluacion?.inhalacion?.nivel >= 4 && !s.gestion?.controles_implementados)
  ).length;

  const fdsCaducadas = sustancias.filter(
    s => esFDSCaducada(s.evaluacion?.fds_caducidad)
  ).length;

  const areas = [...new Set(sustancias.map(s => s.evaluacion?.area).filter(Boolean))];

  // ── Datos gráfica donut — niveles inhalación ──────────────────
  const conteoNiveles = { 1: 0, 2: 0, 3: 0, 4: 0 };
  sustancias.forEach(s => {
    const n = s.evaluacion?.inhalacion?.nivel;
    if (n && conteoNiveles[n] !== undefined) conteoNiveles[n]++;
  });
  const dataNiveles = Object.entries(conteoNiveles)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: COLOR_NIVEL[k].label, value: v, hex: COLOR_NIVEL[k].hex }));

  // ── Datos gráfica barras — riesgo por área ─────────────────────
  // Para admin/superadmin se agrupa por área + sede (para no mezclar áreas
  // homónimas de sedes distintas, ej. "Lavado" en Sede A y en Sede B);
  // coordinador_hse/operario ya están filtrados a una sola sede, así que
  // agrupan solo por nombre de área, igual que antes. area y sede se
  // guardan como campos separados (no concatenados en un string) para que
  // CustomXAxisTick pueda dibujarlos en dos líneas independientes.
  const porArea = {};
  sustancias.forEach(s => {
    const area = s.evaluacion?.area;
    if (!area) return;
    const sedeNombre = mostrarSedeEnGrafico
      ? sedes.find(sd => sd.id === s.uso?.sedeId)?.nombre || null
      : null;
    // Separador interno solo para agrupar — nunca se muestra.
    const key = sedeNombre ? `${area}|||${sedeNombre}` : area;
    if (!porArea[key]) porArea[key] = { nivelMax: 0, total: 0, asesores: 0, area, sedeNombre };
    const n = s.evaluacion?.inhalacion?.nivel || 0;
    porArea[key].nivelMax = Math.max(porArea[key].nivelMax, n);
    porArea[key].total++;
    if (s.evaluacion?.requiere_asesor && !s.gestion?.asesor_consultado) porArea[key].asesores++;
  });
  const truncar = (texto, max) => (texto && texto.length > max ? texto.slice(0, max - 1) + "…" : texto);
  const dataAreas = Object.values(porArea).map(d => ({
    area: truncar(d.area, 18),
    sede: truncar(d.sedeNombre, 18),
    "Nivel máx.": d.nivelMax,
    Evaluaciones: d.total,
  }));

  // ── Sustancias críticas (tabla) ────────────────────────────────
  const criticas = sustancias
    .filter(s =>
      s.evaluacion?.inhalacion?.nivel >= 3 ||
      s.evaluacion?.piel?.nivel === "alto" ||
      (s.evaluacion?.requiere_asesor && !s.gestion?.asesor_consultado)
    )
    .slice(0, 10);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Cargando analytics...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Volver
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-800">Analytics de Riesgo</h1>
            <p className="text-xs text-gray-500">Resumen de evaluaciones registradas</p>
          </div>
        </div>

        {total === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-12 text-center text-gray-400">
            <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Sin evaluaciones registradas</p>
            <p className="text-sm mt-1">Agrega sustancias para ver el análisis de riesgos</p>
          </div>
        ) : (
          <>
            {/* ── Cards resumen ──────────────────────────────────── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <CardResumen
                icono={<FlaskConical className="h-5 w-5 text-blue-600" />}
                titulo="Evaluaciones registradas"
                valor={total}
                sub="en total"
                color="bg-blue-100"
              />
              <CardResumen
                icono={<AlertTriangle className="h-5 w-5 text-red-600" />}
                titulo="Requieren asesor"
                valor={requierenAsesor}
                sub={`${Math.round(requierenAsesor / total * 100)}% del total`}
                color="bg-red-100"
              />
              <CardResumen
                icono={<FileWarning className="h-5 w-5 text-orange-600" />}
                titulo="FDS caducadas"
                valor={fdsCaducadas}
                sub="solicitar actualización"
                color="bg-orange-100"
              />
              <CardResumen
                icono={<MapPin className="h-5 w-5 text-purple-600" />}
                titulo="Áreas monitoreadas"
                valor={areas.length}
                sub={areas.slice(0, 2).join(", ") + (areas.length > 2 ? "…" : "")}
                color="bg-purple-100"
              />
            </div>

            {/* ── Gráficas ───────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              {/* Donut — niveles inhalación */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-4">Nivel de riesgo por inhalación</h2>
                {dataNiveles.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={220}>
                      <PieChart>
                        <Pie
                          data={dataNiveles}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {dataNiveles.map((entry, i) => (
                            <Cell key={i} fill={entry.hex} />
                          ))}
                        </Pie>
                        <Tooltip content={<TooltipPie />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-3 justify-center mt-2">
                      {dataNiveles.map((d, i) => (
                        <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                          <span className="inline-block w-3 h-3 rounded-full" style={{ background: d.hex }} />
                          {d.name} ({d.value})
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos de inhalación</p>
                )}
              </div>

              {/* Barras — sustancias y nivel máx por área */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-4">Evaluaciones por área</h2>
                {dataAreas.length > 0 ? (
                  <ResponsiveContainer width="100%" height={270}>
                    <BarChart data={dataAreas} margin={{ top: 5, right: 10, left: -20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis
                        dataKey="area"
                        height={mostrarSedeEnGrafico ? 50 : 35}
                        interval={0}
                        tick={<CustomXAxisTick data={dataAreas} />}
                      />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="Evaluaciones" fill="#60a5fa" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Nivel máx." fill="#f97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">Sin datos por área</p>
                )}
              </div>
            </div>

            {/* ── Tabla sustancias críticas ──────────────────────── */}
            {criticas.length > 0 && (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <h2 className="font-semibold text-gray-700 mb-4">
                  Evaluaciones que requieren atención
                </h2>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Sustancia</th>
                        <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4">Área</th>
                        <th className="text-center text-xs font-medium text-gray-500 pb-2 pr-4">Inhalación</th>
                        <th className="text-center text-xs font-medium text-gray-500 pb-2 pr-4">Piel</th>
                        <th className="text-center text-xs font-medium text-gray-500 pb-2">FDS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {criticas.map((s, i) => {
                        const nInh  = s.evaluacion?.inhalacion?.nivel;
                        const nPiel = s.evaluacion?.piel?.nivel;
                        const caducada = esFDSCaducada(s.evaluacion?.fds_caducidad);
                        const cInh  = COLOR_NIVEL[nInh] || {};
                        const cPiel = COLOR_PIEL[nPiel] || {};
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="py-2.5 pr-4 font-medium text-gray-800 max-w-[180px] truncate">
                              {s.evaluacion?.sustancia || "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-gray-500">
                              {s.evaluacion?.area || "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              {nInh ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${cInh.bg} ${cInh.text}`}>
                                  Nivel {nInh}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 pr-4 text-center">
                              {nPiel ? (
                                <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold`}
                                  style={{ background: cPiel.hex + "22", color: cPiel.hex }}>
                                  {cPiel.label}
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-2.5 text-center">
                              {caducada ? (
                                <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-600">
                                  Caducada
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">Vigente</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
