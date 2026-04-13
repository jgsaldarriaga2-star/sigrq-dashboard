// src/pages/GestionAreasPage.jsx
import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { collection, getDocs, addDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { useNavigate } from "react-router-dom";

export default function GestionAreasPage() {
  const { role, empresaId } = useAuth();
  const navigate = useNavigate();

  const [areas, setAreas]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [nombre, setNombre]     = useState("");
  const [creando, setCreando]   = useState(false);
  const [exito, setExito]       = useState("");
  const [errForm, setErrForm]   = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [sedes, setSedes] = useState([]);
  const [sedeSeleccionada, setSedeSeleccionada] = useState("");

  useEffect(() => {
    if (role && role === "operario") navigate("/dashboard");
  }, [role]);

  async function cargarAreas() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "empresas", empresaId, "areas"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("No se pudo cargar las áreas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarAreas(); }, []);

useEffect(() => {
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
}, []);

async function crearArea(e) {
    e.preventDefault();
    setErrForm("");
    setExito("");
    if (!nombre.trim()) { setErrForm("El nombre es obligatorio."); return; }
    setCreando(true);
    try {
      await addDoc(collection(db, "empresas", empresaId, "areas"), {
  nombre:   nombre.trim(),
  sedeId:   sedeSeleccionada || null,
  creadoEn: serverTimestamp(),
});
      setExito(`Área "${nombre.trim()}" creada.`);
      setNombre("");
      cargarAreas();
    } catch (err) {
      setErrForm("Error: " + err.message);
    } finally {
      setCreando(false);
    }
  }

  async function eliminarArea(id) {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "areas", id));
      setAreas(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert("No se pudo eliminar el área.");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← Dashboard
          </button>
          <span className="text-gray-700">|</span>
          <h1 className="text-lg font-bold tracking-tight text-gray-100">
            SIGRQ <span className="text-gray-500 font-normal">/ Gestión de Áreas</span>
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Formulario */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">
            Crear nueva área
          </h2>
          <form onSubmit={crearArea} className="flex gap-3">
            {sedes.length > 0 && (
  <select
    value={sedeSeleccionada}
    onChange={e => setSedeSeleccionada(e.target.value)}
    className="bg-gray-800 border border-gray-700 text-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
  >
    <option value="">Sin sede específica</option>
    {sedes.map(s => (
      <option key={s.id} value={s.id}>{s.nombre}</option>
    ))}
  </select>
)}
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              placeholder="Nombre del área (ej: Pintura, Laboratorio…)"
              className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
            />
            <button type="submit" disabled={creando}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2 rounded transition-colors disabled:opacity-50">
              {creando ? "Creando…" : "+ Crear"}
            </button>
          </form>
          {errForm && <p className="text-red-400 text-xs mt-2">⚠ {errForm}</p>}
          {exito && <p className="text-green-400 text-xs mt-2">✓ {exito}</p>}
        </div>

        {/* Lista */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
              Áreas registradas
            </h2>
            <button onClick={cargarAreas}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ↻ Actualizar
            </button>
          </div>

          {loading && <div className="text-center py-10 text-gray-600 text-sm">Cargando áreas…</div>}
          {error && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">⚠ {error}</div>}

          {!loading && !error && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Nombre</th>
                    {sedes.length > 0 && <th className="px-4 py-3 text-left">Sede</th>}
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {areas.length === 0 && (
                    <tr><td colSpan={2} className="text-center py-10 text-gray-600">No hay áreas registradas.</td></tr>
                  )}
                  {areas.map(a => (
                    <tr key={a.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-100">{a.nombre}</td>
                      {sedes.length > 0 && (
  <td className="px-4 py-3 text-gray-400 text-xs">
    {sedes.find(s => s.id === a.sedeId)?.nombre || "—"}
  </td>
)}
                      <td className="px-4 py-3 text-right">
                        {role === "admin" && (
                          <button onClick={() => setConfirmDelete(a.id)}
                            className="text-gray-700 hover:text-red-400 transition-colors text-xs">
                            ✕
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-600 text-xs">
                {areas.length} área{areas.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal confirmar eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-gray-100 font-bold mb-2">Eliminar área</h2>
            <p className="text-gray-400 text-sm mb-6">¿Confirmas que deseas eliminar esta área?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 border border-gray-600 text-gray-300 rounded py-2 text-sm">
                Cancelar
              </button>
              <button onClick={() => eliminarArea(confirmDelete)} disabled={deleting}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold rounded py-2 text-sm">
                {deleting ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}