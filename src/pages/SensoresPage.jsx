// src/pages/SensoresPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import {
  collection, doc, addDoc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, getDocs
} from "firebase/firestore";

export default function SensoresPage() {
  const { empresaId, role } = useAuth();
  const navigate = useNavigate();
  const [sensores, setSensores] = useState([]);
  const [areas, setAreas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ sensor_id: "", area_id: "", sede_id: "" });
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    const unsub = onSnapshot(
      collection(db, "empresas", empresaId, "sensores"),
      snap => { setSensores(snap.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); },
      () => setLoading(false)
    );
    getDocs(collection(db, "empresas", empresaId, "areas"))
      .then(snap => setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    getDocs(collection(db, "empresas", empresaId, "sedes"))
      .then(snap => setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    return () => unsub();
  }, [empresaId]);

  function handleCampo(e) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }));
  }

  function abrirNuevo() {
    setEditando(null);
    setForm({ sensor_id: "", area_id: "", sede_id: "" });
    setError(null);
    setMostrarForm(true);
  }

  function abrirEditar(s) {
    setEditando(s.id);
    setForm({ sensor_id: s.sensor_id, area_id: s.area_id || "", sede_id: s.sede_id || "" });
    setError(null);
    setMostrarForm(true);
  }

  async function guardar() {
    if (!form.sensor_id.trim()) { setError("El ID del sensor es obligatorio."); return; }
    if (!form.area_id) { setError("Selecciona un área."); return; }
    setSaving(true);
    setError(null);
    try {
      const data = {
        sensor_id: form.sensor_id.trim(),
        area_id: form.area_id,
        sede_id: form.sede_id || null,
        ultima_lectura_en: null,
      };
      if (editando) {
        await updateDoc(doc(db, "empresas", empresaId, "sensores", editando), data);
      } else {
        await addDoc(collection(db, "empresas", empresaId, "sensores"), {
          ...data,
          creadoEn: new Date(),
        });
      }
      setMostrarForm(false);
    } catch (e) {
      setError("Error al guardar: " + e.message);
    }
    setSaving(false);
  }

  async function eliminar(id) {
    await deleteDoc(doc(db, "empresas", empresaId, "sensores", id));
    setConfirmDelete(null);
  }

  function estadoSensor(s) {
    if (!s.ultima_lectura_en) return "sin_datos";
    const diff = (Date.now() - s.ultima_lectura_en.toMillis()) / 1000;
    if (diff < 120) return "online";
    if (diff < 600) return "inactivo";
    return "offline";
  }

  const ESTADO_LABEL = { online: "Online", inactivo: "Inactivo", offline: "Offline", sin_datos: "Sin datos" };
  const ESTADO_COLOR = {
    online: "bg-green-900 text-green-300",
    inactivo: "bg-yellow-900 text-yellow-300",
    offline: "bg-gray-800 text-gray-400",
    sin_datos: "bg-gray-800 text-gray-400",
  };
  const PUNTO_COLOR = { online: "bg-green-400", inactivo: "bg-yellow-400", offline: "bg-gray-600", sin_datos: "bg-gray-600" };

  if (role !== "admin" && role !== "coordinador_hse" && role !== "superadmin") {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Sin acceso.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Dashboard</button>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold tracking-tight text-gray-100">SIGRQ <span className="text-gray-500 font-normal">/ Sensores IoT</span></h1>
          </div>
          <div className="flex gap-3">
            <button onClick={() => navigate("/umbrales-iot")} className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">⚙ Umbrales</button>
            <button onClick={() => navigate("/monitoreo")} className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">📡 Monitoreo</button>
            <button onClick={abrirNuevo} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors">+ Agregar sensor</button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-6">
        {loading ? (
          <div className="text-gray-500 text-sm">Cargando sensores...</div>
        ) : sensores.length === 0 ? (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center text-gray-500 text-sm">
            No hay sensores registrados. Agrega el primero.
          </div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            {sensores.map((s, i) => {
              const estado = estadoSensor(s);
              const area = areas.find(a => a.id === s.area_id);
              const sede = sedes.find(sd => sd.id === s.sede_id);
              return (
                <div key={s.id} className={`flex items-center gap-4 px-5 py-4 ${i < sensores.length - 1 ? "border-b border-gray-800" : ""}`}>
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PUNTO_COLOR[estado]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-gray-100">{s.sensor_id || s.id}</div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {area ? area.nombre : <span className="text-gray-600">Sin área</span>}
                      {sede && <span> · {sede.nombre}</span>}
                    </div>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${ESTADO_COLOR[estado]}`}>{ESTADO_LABEL[estado]}</span>
                  <button onClick={() => abrirEditar(s)} className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1.5 rounded transition-colors">Editar</button>
                  <button onClick={(e) => { e.stopPropagation(); setConfirmDelete(s.id); }} className="text-xs text-red-500 hover:text-red-400 border border-gray-700 px-3 py-1.5 rounded transition-colors">Eliminar</button>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-xs text-gray-600">El ID del sensor debe coincidir exactamente con el configurado en el firmware del ESP32.</p>

        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 space-y-4">
            <h2 className="font-semibold text-gray-200">{editando ? "Editar sensor" : "Agregar sensor"}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">ID del sensor *</label>
                <input name="sensor_id" value={form.sensor_id} onChange={handleCampo} disabled={!!editando}
                  placeholder="Ej. ESP32-S01"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Área asignada *</label>
                <select name="area_id" value={form.area_id} onChange={handleCampo}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                  <option value="">Seleccionar área</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Sede</label>
                <select name="sede_id" value={form.sede_id} onChange={handleCampo}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-blue-500">
                  <option value="">Sin sede específica</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
            </div>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-3 justify-end">
              <button onClick={() => setMostrarForm(false)} className="text-sm text-gray-400 hover:text-gray-200 border border-gray-700 px-4 py-2 rounded transition-colors">Cancelar</button>
              <button onClick={guardar} disabled={saving} className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors disabled:opacity-50">
                {saving ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        )}
      </main>

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="font-semibold text-gray-100">¿Eliminar sensor?</h2>
            <p className="text-sm text-gray-400">Esta acción no se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(null)} className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded">Cancelar</button>
              <button onClick={() => eliminar(confirmDelete)} className="bg-red-700 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}