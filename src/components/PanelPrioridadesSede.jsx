// src/components/PanelPrioridadesSede.jsx
//
// Panel de Prioridades por Sede — sección colapsable embebida en el
// dashboard del coordinador_hse (también admin/superadmin). Lista las
// sustancias de la sede seleccionada ordenadas por nivel de riesgo global,
// para identificar de un vistazo cuáles requieren atención prioritaria ante
// una emergencia.
//
// La lista de sedes usa el mismo patrón de consulta que InventarioPage.jsx/
// GestionUsuariosPage.jsx (collection "sedes" + orderBy "creadoEn" desc).
// El cruce de sustancias reutiliza el mismo patrón de dedup por CAS que
// DetalleSustanciaPage.jsx/FichaEmergenciaPage.jsx, y el esquema de niveles/
// colores de InventarioPage.jsx.
//
// La consulta de sustancias es diferida: solo se dispara cuando el panel
// está abierto, y se repite si cambia la sede seleccionada. El estado
// abierto/cerrado se persiste en localStorage.

import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { ChevronRight, ChevronDown } from "lucide-react";

const STORAGE_KEY = "sigrq_panel_prioridades_abierto";
const LIMITE_VISIBLE = 10;

const NIVELES = {
  4: { label: "Muy Alto", bg: "bg-red-600",    text: "text-white"    },
  3: { label: "Alto",     bg: "bg-orange-500", text: "text-white"    },
  2: { label: "Medio",    bg: "bg-yellow-400", text: "text-gray-900" },
  1: { label: "Bajo",     bg: "bg-green-500",  text: "text-white"    },
  0: { label: "N/E",      bg: "bg-gray-300",   text: "text-gray-700" },
};
const NIVEL_STR = { "bajo": 1, "medio": 2, "alto": 3, "muy alto": 4, "muy_alto": 4 };

function nivelInhalacion(s) {
  const ev = s?.evaluacion ?? s;
  const n = ev?.inhalacion?.nivel ?? 0;
  return typeof n === "string" ? (NIVEL_STR[n.toLowerCase()] ?? 0) : (n ?? 0);
}
function nivelPiel(s) {
  const ev = s?.evaluacion ?? s;
  const n = ev?.piel?.nivel ?? 0;
  return typeof n === "string" ? (NIVEL_STR[n.toLowerCase()] ?? 0) : (n ?? 0);
}
function nivelGlobal(s) {
  return Math.max(nivelInhalacion(s), nivelPiel(s));
}

function Badge({ label, nivel }) {
  const cfg = NIVELES[nivel] ?? NIVELES[0];
  return (
    <div className="text-center">
      {label && <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>}
      <span className={`inline-block px-2.5 py-1 rounded text-xs font-bold tracking-wide ${cfg.bg} ${cfg.text}`}>
        {cfg.label}
      </span>
    </div>
  );
}

function leerAbiertoGuardado() {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export default function PanelPrioridadesSede() {
  const { empresaId, role, sedeId } = useAuth();
  const navigate = useNavigate();

  const [abierto, setAbierto] = useState(leerAbiertoGuardado);

  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState(
    role === "coordinador_hse" && sedeId ? sedeId : ""
  );

  const [sustancias, setSustancias] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [mostrarTodas, setMostrarTodas] = useState(false);

  // Lista de sedes — se carga siempre (independiente del estado abierto/cerrado)
  // porque el selector vive en el encabezado, visible incluso con el panel cerrado.
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

  function toggleAbierto() {
    setAbierto(prev => {
      const next = !prev;
      try { localStorage.setItem(STORAGE_KEY, next ? "1" : "0"); } catch { /* localStorage no disponible */ }
      return next;
    });
  }

  // Carga diferida: solo consulta sustancias cuando el panel está abierto,
  // y se repite si cambia la sede seleccionada.
  useEffect(() => {
    if (!abierto || !empresaId) return;
    setLoading(true);
    setError(null);
    async function cargar() {
      try {
        const snap = await getDocs(
          query(collection(db, "empresas", empresaId, "sustancias"), orderBy("creadoEn", "desc"))
        );
        const vistos = new Set();
        const resultado = [];
        for (const d of snap.docs) {
          const s = { id: d.id, ...d.data() };
          if (sedeSeleccionada && (s.uso?.sedeId || null) !== sedeSeleccionada) continue;
          const clave = s.fds?.numero_cas || s.evaluacion?.cas || s.id;
          if (vistos.has(clave)) continue;
          vistos.add(clave);
          resultado.push(s);
        }
        resultado.sort((a, b) => nivelGlobal(b) - nivelGlobal(a));
        setSustancias(resultado);
      } catch (err) {
        console.error("Error cargando panel de prioridades:", err);
        setError("No se pudo cargar el panel de prioridades.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [abierto, empresaId, sedeSeleccionada]);

  useEffect(() => { setMostrarTodas(false); }, [sedeSeleccionada]);

  const hayCriticas = sustancias.some(s => nivelGlobal(s) >= 3);
  const visibles = mostrarTodas ? sustancias : sustancias.slice(0, LIMITE_VISIBLE);

  return (
    <div className="bg-white rounded-2xl shadow-md overflow-hidden">
      {/* Encabezado — clicable para expandir/colapsar */}
      <div
        className="flex items-center justify-between gap-3 p-6 cursor-pointer select-none"
        onClick={toggleAbierto}
      >
        <div className="flex items-center gap-2">
          {abierto ? (
            <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
          )}
          <h2 className="text-lg font-bold text-gray-800">⚠ Prioridades de Emergencia por Sede</h2>
        </div>

        {sedes.length > 0 && (
          <select
            value={sedeSeleccionada}
            onClick={e => e.stopPropagation()}
            onChange={e => setSedeSeleccionada(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
          >
            <option value="">Todas las sedes</option>
            {sedes.map(s => (
              <option key={s.id} value={s.id}>{s.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* Contenido — solo se monta/consulta cuando el panel está abierto */}
      {abierto && (
        <div className="px-6 pb-6">
          <p className="text-xs text-gray-400 mb-4">
            Sustancias ordenadas de mayor a menor nivel de riesgo global.
          </p>

          {loading && <p className="text-sm text-gray-400 py-6 text-center">Cargando…</p>}
          {error && !loading && <p className="text-sm text-red-500 py-4">{error}</p>}

          {!loading && !error && (
            <>
              {!hayCriticas && sustancias.length > 0 && (
                <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl mb-3">
                  ✓ No hay sustancias de nivel Alto o Muy Alto en esta sede. Todo bajo control.
                </div>
              )}

              {sustancias.length === 0 ? (
                <p className="text-sm text-gray-400 py-4">No hay sustancias registradas en esta sede.</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {visibles.map(s => {
                      const ev = s.evaluacion ?? {};
                      const fds = s.fds ?? {};
                      const nombre = ev.sustancia ?? fds.nombre_comercial ?? "Sin nombre";
                      const cas = ev.cas || fds.numero_cas || null;
                      const area = ev.area || s.uso?.area || null;
                      return (
                        <div key={s.id}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 border border-gray-100 rounded-xl px-4 py-3">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-800 truncate">{nombre}</p>
                            <p className="text-xs text-gray-400">
                              {cas && <>CAS {cas} · </>}
                              {area || "Sin área"}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge label="Global" nivel={nivelGlobal(s)} />
                            <Badge label="Inhalación" nivel={nivelInhalacion(s)} />
                            <Badge label="Piel" nivel={nivelPiel(s)} />
                          </div>
                          <button
                            onClick={() => navigate(`/sustancias/${s.id}/ficha-emergencia`)}
                            className="bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors whitespace-nowrap"
                          >
                            Ficha de emergencia
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {sustancias.length > LIMITE_VISIBLE && (
                    <div className="text-center mt-3">
                      <button
                        onClick={() => setMostrarTodas(v => !v)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {mostrarTodas ? "Ver menos" : `Ver todas (${sustancias.length})`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
