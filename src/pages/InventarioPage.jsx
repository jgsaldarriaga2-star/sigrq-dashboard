// src/pages/InventarioPage.jsx
// Pantalla: Inventario de sustancias evaluadas
// Coloca este archivo en: C:\proyectos\sigrq-dashboard\src\pages\

import { useState, useEffect, useMemo } from "react";
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

// ─── Helpers de riesgo ──────────────────────────────────────────────────────

const NIVELES = {
  4: { label: "Muy Alto", bg: "bg-red-600",    text: "text-white",      dot: "bg-red-500"    },
  3: { label: "Alto",     bg: "bg-orange-500", text: "text-white",      dot: "bg-orange-400" },
  2: { label: "Medio",    bg: "bg-yellow-400", text: "text-gray-900",   dot: "bg-yellow-300" },
  1: { label: "Bajo",     bg: "bg-green-500",  text: "text-white",      dot: "bg-green-400"  },
  0: { label: "N/E",      bg: "bg-gray-600",   text: "text-gray-200",   dot: "bg-gray-500"   },
};

const NIVEL_STR = { "bajo": 1, "medio": 2, "alto": 3, "muy alto": 4, "muy_alto": 4 };

function nivelInhalacion(sustancia) {
  const ev = sustancia?.evaluacion ?? sustancia;
  const n = ev?.inhalacion?.nivel ?? ev?.resultado?.inhalacion?.nivel ?? 0;
  return typeof n === "string" ? (NIVEL_STR[n.toLowerCase()] ?? 0) : (n ?? 0);
}

function nivelPiel(sustancia) {
  const ev = sustancia?.evaluacion ?? sustancia;
  const n = ev?.piel?.nivel ?? ev?.resultado?.piel?.nivel ?? 0;
  return typeof n === "string" ? (NIVEL_STR[n.toLowerCase()] ?? 0) : (n ?? 0);
}

function nivelGlobal(sustancia) {
  return Math.max(nivelInhalacion(sustancia), nivelPiel(sustancia));
}

function Badge({ nivel }) {
  const cfg = NIVELES[nivel] ?? NIVELES[0];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-bold tracking-wide ${cfg.bg} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} opacity-80`} />
      {cfg.label}
    </span>
  );
}

function formatFecha(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return "—";
  }
}
function estadoFDS(fds_caducidad) {
  if (!fds_caducidad) return null;
  const hoy = new Date();
  const caducidad = new Date(fds_caducidad);
  const diasRestantes = (caducidad - hoy) / (1000 * 60 * 60 * 24);
  if (diasRestantes < 0) return "vencida";
  if (diasRestantes <= 180) return "proxima";
  return "vigente";
}
// ─── Componente principal ────────────────────────────────────────────────────

export default function InventarioPage() {
  const { user, role, empresaId, sedeId } = useAuth();
  const navigate = useNavigate();

  const [sustancias, setSustancias] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [busqueda, setBusqueda]     = useState("");
  const [filtroNivel, setFiltroNivel] = useState("todos");
  const [confirmDelete, setConfirmDelete] = useState(null); // id del doc a eliminar
  const [deleting, setDeleting]     = useState(false);
  const [sortField, setSortField]   = useState("fecha_evaluacion");
  const [sortDir, setSortDir]       = useState("desc");

  // ─── Carga de datos ────────────────────────────────────────────────────────

  async function cargarSustancias() {
  setLoading(true);
  setError(null);
  try {
    let q;

    q = query(
  collection(db, "empresas", empresaId, "sustancias"),
  orderBy("creadoEn", "desc")
);

    const snap = await getDocs(q);
    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setSustancias(docs);
  } catch (err) {
    console.error("Error cargando inventario:", err);
    setError("No se pudo cargar el inventario. Verifica los índices de Firestore.");
  } finally {
    setLoading(false);
  }
}

 useEffect(() => {
  cargarSustancias();
}, [user, role]);

const [sedes, setSedes] = useState([]);
const [filtroSede, setFiltroSede] = useState("todas");

useEffect(() => {
  if (!empresaId) return;
  async function cargarSedes() {
    try {
      const q = query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error cargando sedes:", err);
    }
  }
  cargarSedes();
}, [empresaId]);

  // ─── Filtrado y ordenamiento ───────────────────────────────────────────────

  const datosFiltrados = useMemo(() => {
    let lista = [...sustancias];

    // Operario ve solo su sede
if (role === "operario" && sedeId) {
  lista = lista.filter(s => s.uso?.sedeId === sedeId);
} else if (filtroSede !== "todas") {
  lista = lista.filter(s => s.uso?.sedeId === filtroSede);
}

    // Búsqueda por nombre o CAS
    if (busqueda.trim()) {
      const term = busqueda.toLowerCase();
      lista = lista.filter(s =>
        (s.evaluacion?.sustancia ?? s.nombre ?? "").toLowerCase().includes(term) ||
        (s.evaluacion?.cas ?? s.cas ?? "").toLowerCase().includes(term) ||
        (s.evaluacion?.area ?? s.uso?.area ?? s.area ?? "").toLowerCase().includes(term)
      );
    }

    // Filtro nivel global
    if (filtroNivel !== "todos") {
      const n = parseInt(filtroNivel);
      lista = lista.filter(s => nivelGlobal(s) === n);
    }

    // Ordenamiento
    lista.sort((a, b) => {
      let va, vb;
      if (sortField === "nivel") {
        va = nivelGlobal(a);
        vb = nivelGlobal(b);
      } else if (sortField === "fecha_evaluacion") {
        va = a.fecha_evaluacion?.toMillis?.() ?? 0;
        vb = b.fecha_evaluacion?.toMillis?.() ?? 0;
      } else {
        va = (a[sortField] ?? "").toString().toLowerCase();
        vb = (b[sortField] ?? "").toString().toLowerCase();
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return lista;
  }, [sustancias, busqueda, filtroNivel, sortField, sortDir]);

  function toggleSort(field) {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  }

  // ─── Eliminar ──────────────────────────────────────────────────────────────

  async function eliminarSustancia(id) {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "sustancias", id));
      setSustancias(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      console.error("Error eliminando:", err);
      alert("No se pudo eliminar la sustancia.");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  // ─── Stats rápidas ────────────────────────────────────────────────────────

  const stats = useMemo(() => {
  const lista = role === "operario" && sedeId
    ? sustancias.filter(s => s.uso?.sedeId === sedeId)
    : sustancias;
  const casList = [...new Set(lista.map(s => s.evaluacion?.cas ?? s.fds?.numero_cas).filter(Boolean))];
  const total   = casList.length || lista.length;
  const muyAlto = lista.filter(s => nivelGlobal(s) === 4).length;
  const alto    = lista.filter(s => nivelGlobal(s) === 3).length;
  const asesor  = lista.filter(s => (s.evaluacion?.requiere_asesor ?? s.requiere_asesor) && !s.gestion?.asesor_consultado).length;
  return { total, muyAlto, alto, asesor };
}, [sustancias, role, sedeId]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/dashboard")}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm"
            >
              ← Dashboard
            </button>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold tracking-tight text-gray-100">
              SIGRQ <span className="text-gray-500 font-normal">/ Inventario</span>
            </h1>
          </div>
          {role !== "operario" && (
  <button
    onClick={() => navigate("/sustancias/nueva")}
    className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors"
  >
    + Nueva sustancia
  </button>
)}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard label="Total sustancias" value={stats.total} color="text-gray-100" />
          <StatCard label="Muy Alto riesgo" value={stats.muyAlto} color="text-red-400" />
          <StatCard label="Alto riesgo" value={stats.alto} color="text-orange-400" />
          <StatCard label="Requieren asesor" value={stats.asesor} color="text-yellow-400" />
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            type="text"
            placeholder="Buscar por nombre, CAS o área…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-500 rounded px-3 py-2 text-sm w-72 focus:outline-none focus:border-blue-500"
          />
          {sedes.length > 1 && role !== "operario" && (
  <select
    value={filtroSede}
    onChange={e => setFiltroSede(e.target.value)}
    className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  >
    <option value="todas">Todas las sedes</option>
    {sedes.map(s => (
      <option key={s.id} value={s.id}>{s.nombre}</option>
    ))}
  </select>
)}
          <select
            value={filtroNivel}
            onChange={e => setFiltroNivel(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="todos">Todos los niveles</option>
            <option value="4">Muy Alto</option>
            <option value="3">Alto</option>
            <option value="2">Medio</option>
            <option value="1">Bajo</option>
          </select>
          <button
            onClick={cargarSustancias}
            className="ml-auto text-gray-500 hover:text-gray-300 text-sm transition-colors"
          >
            ↻ Actualizar
          </button>
        </div>

        {/* Estado de carga / error */}
        {loading && (
          <div className="text-center py-16 text-gray-500 text-sm">
            Cargando inventario…
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">
            ⚠ {error}
          </div>
        )}

        {/* Tabla */}
        {!loading && !error && (
          <div className="rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
  <Th field="nombre" current={sortField} dir={sortDir} toggle={toggleSort}>
    Sustancia / CAS
  </Th>
  <Th field="area" current={sortField} dir={sortDir} toggle={toggleSort}>
    Área
  </Th>
  <Th field="nivel" current={sortField} dir={sortDir} toggle={toggleSort}>
    Nivel global
  </Th>
  <th className="px-4 py-3 text-left">Inhalación</th>
  <th className="px-4 py-3 text-left">Piel</th>
  <th className="px-4 py-3 text-left">Asesor</th>
  <Th field="fecha_evaluacion" current={sortField} dir={sortDir} toggle={toggleSort}>
    Fecha
  </Th>
  <th className="px-4 py-3 text-left">FDS Caduca</th>
  {role === "admin" || role === "coordinador_hse" ? (
    <th className="px-4 py-3" />
  ) : null}
</tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {datosFiltrados.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-600">
                      No hay sustancias que coincidan con los filtros.
                    </td>
                  </tr>
                )}
                {datosFiltrados.map(s => (
                  <tr key={s.id} onClick={() => navigate(`/sustancias/${s.id}`)}
  className="bg-gray-950 hover:bg-gray-900 transition-colors cursor-pointer">
                    {/* Nombre / CAS */}
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-100 leading-tight">
                        {s.evaluacion?.sustancia ?? s.evaluacion?.nombre ?? s.nombre ?? "Sin nombre"}
                      </div>
                      {(s.evaluacion?.cas ?? s.cas) && (
  <div className="text-gray-400 text-xs mt-0.5">CAS {s.evaluacion?.cas ?? s.cas}</div>
)}
                    </td>

                    {/* Área */}
                    <td className="px-4 py-3 text-gray-400">
  <div>{s.evaluacion?.area ?? s.uso?.area ?? "—"}</div>
  {sedes.length > 1 && s.uso?.sedeId && (
    <div className="text-xs text-gray-400">
      {sedes.find(sd => sd.id === s.uso.sedeId)?.nombre || ""}
    </div>
  )}
</td>

                    {/* Nivel global */}
                    <td className="px-4 py-3">
                      <Badge nivel={nivelGlobal(s)} />
                    </td>

                    {/* Inhalación */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <Badge nivel={nivelInhalacion(s)} />
                        {(s?.resultado?.inhalacion?.hg ?? s?.riesgo_inhalacion?.hg) && (
                          <span className="text-gray-600 text-xs">
                            {s?.resultado?.inhalacion?.hg ?? s?.riesgo_inhalacion?.hg}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Piel */}
                    <td className="px-4 py-3">
                      <Badge nivel={nivelPiel(s)} />
                    </td>

                    {/* Asesor requerido */}
                    <td className="px-4 py-3">
                      {(() => {
                        const requiere = s.evaluacion?.requiere_asesor ?? s.requiere_asesor;
                        const gestionado = s.gestion?.asesor_consultado;
                        const residual = s.gestion?.riesgo_residual;
                        if (!requiere) return <span className="text-gray-400 text-xs">No</span>;
                        if (gestionado) return (
                          <span className="text-green-400 font-bold text-xs">✓ Gestionado{residual ? ` · ${residual.replace("_"," ")}` : ""}</span>
                        );
                        return <span className="text-yellow-400 font-bold text-xs">⚠ Pendiente</span>;
                      })()}
                    </td>

                    {/* Fecha */}
<td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
  {formatFecha(s.evaluacion?.fecha_evaluacion ?? s.creadoEn)}
</td>

{/* FDS Caduca */}
<td className="px-4 py-3 text-xs whitespace-nowrap">
  {(() => {
    const caducidad = s.evaluacion?.fds_caducidad;
    const estado = estadoFDS(caducidad);
    if (!caducidad) return <span className="text-gray-400">—</span>;
    if (estado === "vencida") return <span className="text-red-400 font-bold">⚠ Vencida · {formatFecha(caducidad)}</span>;
    if (estado === "proxima") return <span className="text-yellow-400 font-bold">⏳ {formatFecha(caducidad)}</span>;
    return <span className="text-green-400">{formatFecha(caducidad)}</span>;
  })()}
</td>

{/* Acciones */}
{(role === "admin" || role === "coordinador_hse") && (
  <td className="px-4 py-3">
    <button
      onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }}
      className="text-gray-400 hover:text-red-400 transition-colors text-xs"
      title="Eliminar"
    >
      ✕
    </button>
  </td>
)}
                    
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Footer con conteo */}
            <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-600 text-xs">
              {datosFiltrados.length} de {sustancias.length} sustancias
            </div>
          </div>
        )}
      </main>

      {/* Modal confirmación eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4 shadow-2xl">
            <h2 className="text-gray-100 font-bold mb-2">Eliminar sustancia</h2>
            <p className="text-gray-400 text-sm mb-6">
              ¿Confirmas que deseas eliminar este registro? Esta acción no se puede deshacer.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={deleting}
                className="flex-1 border border-gray-600 text-gray-300 hover:text-gray-100 rounded py-2 text-sm transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarSustancia(confirmDelete)}
                disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold rounded py-2 text-sm transition-colors"
              >
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

function StatCard({ label, value, color }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-gray-500 text-xs mt-0.5">{label}</div>
    </div>
  );
}

function Th({ field, current, dir, toggle, children }) {
  const active = current === field;
  return (
    <th
      className="px-4 py-3 text-left cursor-pointer hover:text-gray-200 select-none"
      onClick={() => toggle(field)}
    >
      <span className={active ? "text-blue-400" : ""}>{children}</span>
      {active && <span className="ml-1 text-blue-400">{dir === "asc" ? "↑" : "↓"}</span>}
    </th>
  );
}
