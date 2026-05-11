// src/pages/MonitoreoPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import {
  collection, doc, onSnapshot, query,
  orderBy, limit, getDoc, getDocs
} from "firebase/firestore";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";

const VARIABLES = [
  { key: "co2_ppm",       label: "CO₂",        unidad: "ppm" },
  { key: "voc_ppm",       label: "COVs",        unidad: "ppb" },
  { key: "co_ppm",        label: "CO",          unidad: "ppm" },
  { key: "temperatura_c", label: "Temperatura", unidad: "°C"  },
  { key: "humedad_pct",   label: "Humedad",     unidad: "%"   },
];

const DEFAULTS_UMBRALES = {
  co2_ppm:       { warn: 1000, peligro: 2000 },
  voc_ppm:       { warn: 500,  peligro: 1000 },
  co_ppm:        { warn: 25,   peligro: 50   },
  temperatura_c: { warn: 35,   peligro: 40   },
  humedad_pct:   { warn: 70,   peligro: 85   },
};

function estadoSensor(ultimaLecturaEn) {
  if (!ultimaLecturaEn) return "sin_datos";
  const diff = (Date.now() - ultimaLecturaEn.toMillis()) / 1000;
  if (diff < 120) return "online";
  if (diff < 600) return "inactivo";
  return "offline";
}

function colorMetrica(valor, umbral) {
  if (valor === null || valor === undefined) return "text-gray-500";
  if (valor >= umbral.peligro) return "text-red-400";
  if (valor >= umbral.warn)    return "text-yellow-400";
  return "text-green-400";
}

function formatHora(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
}

export default function MonitoreoPage() {
  const { empresaId, role } = useAuth();
  const navigate = useNavigate();
  const [sensores, setSensores] = useState([]);
  const [lecturasPorSensor, setLecturasPorSensor] = useState({});
  const [umbrales, setUmbrales] = useState(DEFAULTS_UMBRALES);
  const [areas, setAreas] = useState([]);
  const [filtroArea, setFiltroArea] = useState("todas");
  const [varGrafica, setVarGrafica] = useState("co2_ppm");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    getDoc(doc(db, "empresas", empresaId, "config", "umbrales_iot"))
      .then(snap => { if (snap.exists()) setUmbrales({ ...DEFAULTS_UMBRALES, ...snap.data() }); });
    getDocs(collection(db, "empresas", empresaId, "areas"))
      .then(snap => setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubSensores = onSnapshot(
      collection(db, "empresas", empresaId, "sensores"),
      snap => {
        setSensores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        setLoading(false);
      }
    );
    return () => unsubSensores();
  }, [empresaId]);

  useEffect(() => {
    if (!empresaId || sensores.length === 0) return;
    const unsubs = sensores.map(sensor => {
      const q = query(
        collection(db, "empresas", empresaId, "lecturas"),
        orderBy("timestamp", "desc"),
        limit(24)
      );
      return onSnapshot(q, snap => {
        const lecturas = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(l => l.sensor_id === sensor.id)
          .reverse();
        setLecturasPorSensor(prev => ({ ...prev, [sensor.id]: lecturas }));
      });
    });
    return () => unsubs.forEach(u => u());
  }, [empresaId, sensores]);

  if (role !== "admin" && role !== "coordinador_hse" && role !== "superadmin") {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Sin acceso.</div>;
  }

  const sensoresFiltrados = filtroArea === "todas"
    ? sensores
    : sensores.filter(s => s.area_id === filtroArea);

  const ESTADO_COLOR = {
    online:    "bg-green-900 text-green-300",
    inactivo:  "bg-yellow-900 text-yellow-300",
    offline:   "bg-gray-800 text-gray-400",
    sin_datos: "bg-gray-800 text-gray-400",
  };
  const PUNTO_COLOR = {
    online: "bg-green-400", inactivo: "bg-yellow-400",
    offline: "bg-gray-600", sin_datos: "bg-gray-600",
  };
  const ESTADO_LABEL = {
    online: "Online", inactivo: "Inactivo",
    offline: "Offline", sin_datos: "Sin datos",
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Dashboard</button>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold tracking-tight text-gray-100">SIGRQ <span className="text-gray-500 font-normal">/ Monitoreo IoT</span></h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/sensores")} className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">⚙ Sensores</button>
            <button onClick={() => navigate("/umbrales-iot")} className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">📊 Umbrales</button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* Filtros */}
        <div className="flex items-center gap-4 flex-wrap">
          <select value={filtroArea} onChange={e => setFiltroArea(e.target.value)}
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-blue-500">
            <option value="todas">Todas las áreas</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
          </select>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">Gráfica:</span>
            {VARIABLES.map(v => (
              <button key={v.key} onClick={() => setVarGrafica(v.key)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${varGrafica === v.key ? "bg-blue-900 border-blue-700 text-blue-300" : "border-gray-700 text-gray-400 hover:text-gray-200"}`}>
                {v.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-gray-500 text-sm">Cargando sensores...</div>
        ) : sensoresFiltrados.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500 text-sm">
            No hay sensores en esta área.
          </div>
        ) : (
          sensoresFiltrados.map(sensor => {
            const estado = estadoSensor(sensor.ultima_lectura_en);
            const lecturas = lecturasPorSensor[sensor.id] || [];
            const ultima = lecturas[lecturas.length - 1] || null;
            const area = areas.find(a => a.id === sensor.area_id);
            const datosGrafica = lecturas.map(l => ({
              hora: formatHora(l.timestamp),
              valor: l[varGrafica] ?? null,
            }));
            const varActual = VARIABLES.find(v => v.key === varGrafica);

            return (
              <div key={sensor.id} className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                {/* Header sensor */}
                <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PUNTO_COLOR[estado]}`} />
                  <div className="flex-1">
                    <span className="font-semibold text-gray-100">{sensor.nombre || sensor.sensor_id}</span>
                    {area && <span className="text-xs text-gray-500 ml-2">· {area.nombre}</span>}
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[estado]}`}>{ESTADO_LABEL[estado]}</span>
                  {sensor.ultima_lectura_en && (
                    <span className="text-xs text-gray-600">Última lectura: {formatHora(sensor.ultima_lectura_en)}</span>
                  )}
                </div>

                {estado === "offline" || estado === "sin_datos" ? (
                  <div className="px-5 py-10 text-center text-gray-600 text-sm">
                    Sin datos recientes. Verifique la conexión del sensor.
                  </div>
                ) : (
                  <div className="px-5 py-4 space-y-4">
                    {/* Métricas */}
                    <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
                      {VARIABLES.map(v => {
                        const val = ultima?.[v.key] ?? null;
                        const color = val !== null ? colorMetrica(val, umbrales[v.key]) : "text-gray-600";
                        return (
                          <div key={v.key} className="bg-gray-950 rounded-lg px-3 py-3">
                            <div className="text-xs text-gray-500 mb-1">{v.label}</div>
                            <div className={`text-xl font-semibold ${color}`}>
                              {val !== null ? val.toFixed(1) : "—"}
                              <span className="text-xs text-gray-600 ml-1">{v.unidad}</span>
                            </div>
                          </div>
                        );
                      })}
                      {/* Señal WiFi */}
                      <div className="bg-gray-950 rounded-lg px-3 py-3">
                        <div className="text-xs text-gray-500 mb-1">WiFi</div>
                        <div className="text-xl font-semibold text-gray-400">
                          {ultima?.rssi_dbm ?? "—"}
                          <span className="text-xs text-gray-600 ml-1">dBm</span>
                        </div>
                      </div>
                    </div>

                    {/* Gráfica histórica */}
                    {datosGrafica.length > 1 && (
                      <div>
                        <div className="text-xs text-gray-500 mb-2">
                          Histórico — {varActual?.label} ({varActual?.unidad}) · últimas {lecturas.length} lecturas
                        </div>
                        <ResponsiveContainer width="100%" height={140}>
                          <LineChart data={datosGrafica} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                            <XAxis dataKey="hora" tick={{ fontSize: 10, fill: "#6b7280" }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: "#6b7280" }} />
                            <Tooltip
                              contentStyle={{ background: "#111827", border: "1px solid #374151", borderRadius: 8, fontSize: 12 }}
                              labelStyle={{ color: "#9ca3af" }}
                              itemStyle={{ color: "#60a5fa" }}
                            />
                            <ReferenceLine y={umbrales[varGrafica]?.warn} stroke="#eab308" strokeDasharray="4 2" strokeWidth={1} />
                            <ReferenceLine y={umbrales[varGrafica]?.peligro} stroke="#ef4444" strokeDasharray="4 2" strokeWidth={1} />
                            <Line
                              type="monotone" dataKey="valor" stroke="#3b82f6"
                              strokeWidth={2} dot={false} connectNulls
                            />
                          </LineChart>
                        </ResponsiveContainer>
                        <div className="flex gap-4 mt-1">
                          <span className="text-xs text-yellow-500">— Advertencia ({umbrales[varGrafica]?.warn} {varActual?.unidad})</span>
                          <span className="text-xs text-red-500">— Peligro ({umbrales[varGrafica]?.peligro} {varActual?.unidad})</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>
    </div>
  );
}