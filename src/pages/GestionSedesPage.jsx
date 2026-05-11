// src/pages/GestionSedesPage.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, orderBy, query, serverTimestamp } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function GestionSedesPage() {
  const { role, empresaId } = useAuth();
  const navigate = useNavigate();

  const [sedes, setSedes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [form, setForm]         = useState({ nombre: "", ciudad: "", direccion: "" });
  const [creando, setCreando]   = useState(false);
  const [exito, setExito]       = useState("");
  const [errForm, setErrForm]   = useState("");
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Nodos IoT
  const [areas, setAreas]           = useState([]);
  const [nodos, setNodos]           = useState([]);
  const [loadingNodos, setLoadingNodos] = useState(true);
  const [confirmDeleteNodo, setConfirmDeleteNodo] = useState(null);
  const [deletingNodo, setDeletingNodo] = useState(false);
  const [editandoNodo, setEditandoNodo] = useState(null);
  const [editForm, setEditForm]     = useState({ area_id: "", sedeId: "" });
  const [guardandoNodo, setGuardandoNodo] = useState(false);

  useEffect(() => {
    if (role && role === "operario") navigate("/dashboard");
  }, [role]);

  async function cargarSedes() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      setSedes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("No se pudo cargar las sedes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarSedes(); }, []);

  useEffect(() => {
    async function cargarAreas() {
      try {
        const snap = await getDocs(collection(db, "empresas", empresaId, "areas"));
        setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {}
    }
    cargarAreas();
    cargarNodos();
  }, []);

  async function cargarNodos() {
    setLoadingNodos(true);
    try {
      const snap = await getDocs(collection(db, "empresas", empresaId, "sensores"));
      setNodos(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (_) {
    } finally {
      setLoadingNodos(false);
    }
  }

  async function asignarNodo(id) {
    setGuardandoNodo(true);
    try {
      await updateDoc(doc(db, "empresas", empresaId, "sensores", id), {
        area_id: editForm.area_id || null,
        sedeId:  editForm.sedeId  || null,
      });
      setEditandoNodo(null);
      cargarNodos();
    } catch (err) {
      alert("Error al guardar: " + err.message);
    } finally {
      setGuardandoNodo(false);
    }
  }

  async function eliminarNodo(id) {
    setDeletingNodo(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "sensores", id));
      setNodos(prev => prev.filter(n => n.id !== id));
    } catch (_) {
      alert("No se pudo eliminar el nodo.");
    } finally {
      setDeletingNodo(false);
      setConfirmDeleteNodo(null);
    }
  }

  function handleForm(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function crearSede(e) {
    e.preventDefault();
    setErrForm("");
    setExito("");
    if (!form.nombre.trim()) { setErrForm("El nombre es obligatorio."); return; }
    setCreando(true);
    try {
      await addDoc(collection(db, "empresas", empresaId, "sedes"), {
        nombre:    form.nombre.trim(),
        ciudad:    form.ciudad.trim() || null,
        direccion: form.direccion.trim() || null,
        activa:    true,
        creadoEn:  serverTimestamp(),
      });
      setExito(`Sede "${form.nombre.trim()}" creada.`);
      setForm({ nombre: "", ciudad: "", direccion: "" });
      cargarSedes();
    } catch (err) {
      setErrForm("Error: " + err.message);
    } finally {
      setCreando(false);
    }
  }

  async function eliminarSede(id) {
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "empresas", empresaId, "sedes", id));
      setSedes(prev => prev.filter(s => s.id !== id));
    } catch (err) {
      alert("No se pudo eliminar la sede.");
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
            SIGRQ <span className="text-gray-500 font-normal">/ Gestión de Sedes</span>
          </h1>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Formulario */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">
            Crear nueva sede
          </h2>
          <form onSubmit={crearSede} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Nombre de la sede *</label>
                <input
                  type="text"
                  name="nombre"
                  value={form.nombre}
                  onChange={handleForm}
                  placeholder="Ej: Planta Principal, Sede Norte…"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ciudad</label>
                <input
                  type="text"
                  name="ciudad"
                  value={form.ciudad}
                  onChange={handleForm}
                  placeholder="Medellín"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Dirección</label>
                <input
                  type="text"
                  name="direccion"
                  value={form.direccion}
                  onChange={handleForm}
                  placeholder="Calle 10 #20-30"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
            {errForm && <p className="text-red-400 text-xs">⚠ {errForm}</p>}
            {exito  && <p className="text-green-400 text-xs">✓ {exito}</p>}
            <button type="submit" disabled={creando}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-5 py-2 rounded transition-colors disabled:opacity-50">
              {creando ? "Creando…" : "+ Crear sede"}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
              Sedes registradas
            </h2>
            <button onClick={cargarSedes}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ↻ Actualizar
            </button>
          </div>

          {loading && <div className="text-center py-10 text-gray-600 text-sm">Cargando sedes…</div>}
          {error   && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">⚠ {error}</div>}

          {!loading && !error && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Sede</th>
                    <th className="px-4 py-3 text-left">Ciudad</th>
                    <th className="px-4 py-3 text-left">Dirección</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {sedes.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-gray-600">
                        No hay sedes registradas. Si la empresa tiene una sola ubicación no es necesario crearla.
                      </td>
                    </tr>
                  )}
                  {sedes.map(s => (
                    <tr key={s.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-100">{s.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{s.ciudad || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{s.direccion || "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {role === "admin" && (
                          <button onClick={() => setConfirmDelete(s.id)}
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
                {sedes.length} sede{sedes.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
        {/* Sección nodos IoT — visible para admin y coordinador_hse */}
        {(role === "admin" || role === "coordinador_hse") && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Nodos IoT detectados</h2>
                <p className="text-xs text-gray-600 mt-0.5">Los sensores aparecen aquí automáticamente al enviar su primera lectura.</p>
              </div>
              <button onClick={cargarNodos} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">↻ Actualizar</button>
            </div>
            {loadingNodos ? (
              <div className="text-center py-6 text-gray-600 text-sm">Cargando nodos…</div>
            ) : (
              <div className="rounded-lg border border-gray-800 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                      <th className="px-4 py-3 text-left">Sensor ID</th>
                      <th className="px-4 py-3 text-left">MAC</th>
                      <th className="px-4 py-3 text-left">Área asignada</th>
                      <th className="px-4 py-3 text-left">Sede</th>
                      <th className="px-4 py-3 text-left">Estado</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {nodos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-gray-600">
                          Ningún sensor ha enviado lecturas todavía.
                        </td>
                      </tr>
                    )}
                    {nodos.map(n => (
                      <tr key={n.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-gray-200">{n.sensor_id || n.id}</td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-300">{n.mac || <span className="text-gray-600">—</span>}</td>
                        {editandoNodo === n.id ? (
                          <>
                            <td className="px-4 py-2">
                              <select
                                value={editForm.area_id}
                                onChange={e => setEditForm(f => ({ ...f, area_id: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              >
                                <option value="">Sin asignar</option>
                                {areas.map(a => <option key={a.id} value={a.id}>{a.nombre}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <select
                                value={editForm.sedeId}
                                onChange={e => setEditForm(f => ({ ...f, sedeId: e.target.value }))}
                                className="w-full bg-gray-800 border border-gray-600 text-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
                              >
                                <option value="">—</option>
                                {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                              </select>
                            </td>
                            <td className="px-4 py-2" />
                            <td className="px-4 py-2 text-right whitespace-nowrap">
                              <button onClick={() => asignarNodo(n.id)} disabled={guardandoNodo}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1 rounded mr-2 disabled:opacity-50">
                                {guardandoNodo ? "…" : "Guardar"}
                              </button>
                              <button onClick={() => setEditandoNodo(null)}
                                className="text-xs text-gray-500 hover:text-gray-300">
                                Cancelar
                              </button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {areas.find(a => a.id === n.area_id)?.nombre || <span className="text-gray-600">Sin asignar</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs">
                              {sedes.find(s => s.id === n.sedeId)?.nombre || "—"}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                n.activo ? "bg-green-900 text-green-300" : "bg-gray-800 text-gray-500"
                              }`}>
                                {n.activo ? "Activo" : "Inactivo"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => { setEditandoNodo(n.id); setEditForm({ area_id: n.area_id || "", sedeId: n.sedeId || "" }); }}
                                className="text-xs text-gray-400 hover:text-gray-200 border border-gray-700 px-3 py-1 rounded mr-2 transition-colors">
                                Asignar
                              </button>
                              {role === "admin" && (
                                <button onClick={() => setConfirmDeleteNodo(n.id)}
                                  className="text-gray-700 hover:text-red-400 transition-colors text-xs">
                                  ✕
                                </button>
                              )}
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-600 text-xs">
                  {nodos.length} nodo{nodos.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Modal confirmar eliminar nodo */}
      {confirmDeleteNodo && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-gray-100 font-bold mb-2">Eliminar nodo IoT</h2>
            <p className="text-gray-400 text-sm mb-6">
              ¿Confirmas que deseas eliminar este nodo? El dispositivo dejará de poder publicar datos.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDeleteNodo(null)} disabled={deletingNodo}
                className="flex-1 border border-gray-600 text-gray-300 rounded py-2 text-sm">
                Cancelar
              </button>
              <button onClick={() => eliminarNodo(confirmDeleteNodo)} disabled={deletingNodo}
                className="flex-1 bg-red-700 hover:bg-red-600 text-white font-bold rounded py-2 text-sm">
                {deletingNodo ? "Eliminando…" : "Eliminar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal confirmar eliminar */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-sm w-full mx-4">
            <h2 className="text-gray-100 font-bold mb-2">Eliminar sede</h2>
            <p className="text-gray-400 text-sm mb-6">
              ¿Confirmas que deseas eliminar esta sede? Las áreas asociadas no se eliminarán.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} disabled={deleting}
                className="flex-1 border border-gray-600 text-gray-300 rounded py-2 text-sm">
                Cancelar
              </button>
              <button onClick={() => eliminarSede(confirmDelete)} disabled={deleting}
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
