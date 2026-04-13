// src/pages/GestionUsuariosPage.jsx
import { useState, useEffect } from "react";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import app, { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { getFunctions, httpsCallable } from "firebase/functions";

const ROLES = {
  admin:           { label: "Admin",           bg: "bg-purple-600" },
  coordinador_hse: { label: "Coordinador HSE", bg: "bg-blue-600"   },
  operario:        { label: "Operario",        bg: "bg-gray-600"   },
};

function RolBadge({ role }) {
  const cfg = ROLES[role] ?? { label: role, bg: "bg-gray-700" };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold text-white ${cfg.bg}`}>
      {cfg.label}
    </span>
  );
}

function formatFecha(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

export default function GestionUsuariosPage() {
  const { role, empresaId } = useAuth();
  const navigate = useNavigate();

  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [form, setForm] = useState({ email: "", nombre: "", password: "", role: "operario", sedeId: "" });
  const [creando, setCreando]   = useState(false);
  const [exito, setExito]       = useState("");
  const [errForm, setErrForm]   = useState("");

  const [sedes, setSedes] = useState([]);

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
  useEffect(() => {
    if (role && role !== "admin") navigate("/dashboard");
  }, [role]);

  async function cargarUsuarios() {
    setLoading(true);
    setError(null);
    try {
      const q = query(collection(db, "empresas", empresaId, "usuarios"), orderBy("createdAt", "desc"));
      const snap = await getDocs(q);
      setUsuarios(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      setError("No se pudo cargar la lista de usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarUsuarios(); }, []);

  function handleForm(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  }

  async function crearUsuario(e) {
    e.preventDefault();
    setErrForm("");
    setExito("");

    if (!form.email || !form.nombre || !form.password || !form.role) {
      setErrForm("Todos los campos son obligatorios.");
      return;
    }
    if (form.password.length < 6) {
      setErrForm("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setCreando(true);
    try {
      const functions = getFunctions(app, "us-central1");
const asignarRol = httpsCallable(functions, "asignarRol");
const result = await asignarRol({
  email:     form.email,
  nombre:    form.nombre,
  password:  form.password,
  role:      form.role,
  empresaId: empresaId,
  sedeId:    form.sedeId || null,
});

      if (result.data.success) {
        setExito(`Usuario ${form.email} creado correctamente.`);
        setForm({ email: "", nombre: "", password: "", role: "operario" });
        cargarUsuarios();
      }
    } catch (err) {
      setErrForm("Error: " + (err.message || "No se pudo crear el usuario."));
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate("/dashboard")}
            className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
            ← Dashboard
          </button>
          <span className="text-gray-700">|</span>
          <h1 className="text-lg font-bold tracking-tight text-gray-100">
            SIGRQ <span className="text-gray-500 font-normal">/ Gestión de Usuarios</span>
          </h1>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* Formulario */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">
            Crear nuevo usuario
          </h2>
          <form onSubmit={crearUsuario} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Campo label="Nombre completo" name="nombre" value={form.nombre} onChange={handleForm} />
              <Campo label="Correo electrónico" name="email" value={form.email} onChange={handleForm} type="email" />
              <Campo label="Contraseña" name="password" value={form.password} onChange={handleForm} type="password" />
              <div>
                <label className="block text-xs text-gray-500 mb-1">Rol</label>
                <select name="role" value={form.role} onChange={handleForm}
  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
  <option value="coordinador_hse">Coordinador HSE</option>
  <option value="operario">Operario</option>
</select>
</div>

{sedes.length > 0 && (
  <div>
    <label className="block text-xs text-gray-500 mb-1">Sede asignada</label>
    <select name="sedeId" value={form.sedeId} onChange={handleForm}
      className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
      <option value="">Sin sede específica</option>
      {sedes.map(s => (
        <option key={s.id} value={s.id}>{s.nombre}</option>
      ))}
    </select>
  </div>
)}
            </div>

            {errForm && (
              <div className="bg-red-950 border border-red-800 text-red-300 rounded px-4 py-2 text-sm">⚠ {errForm}</div>
            )}
            {exito && (
              <div className="bg-green-950 border border-green-800 text-green-300 rounded px-4 py-2 text-sm">✓ {exito}</div>
            )}

            <button type="submit" disabled={creando}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-6 py-2 rounded transition-colors disabled:opacity-50">
              {creando ? "Creando…" : "Crear usuario"}
            </button>
          </form>
        </div>

        {/* Lista */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider">
              Usuarios registrados
            </h2>
            <button onClick={cargarUsuarios}
              className="text-gray-500 hover:text-gray-300 text-sm transition-colors">
              ↻ Actualizar
            </button>
          </div>

          {loading && <div className="text-center py-12 text-gray-600 text-sm">Cargando usuarios…</div>}
          {error && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">⚠ {error}</div>}

          {!loading && !error && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Nombre</th>
                    <th className="px-4 py-3 text-left">Correo</th>
                    <th className="px-4 py-3 text-left">Rol</th>
                    <th className="px-4 py-3 text-left">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {usuarios.length === 0 && (
                    <tr><td colSpan={4} className="text-center py-10 text-gray-600">No hay usuarios.</td></tr>
                  )}
                  {usuarios.map(u => (
                    <tr key={u.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-100">{u.nombre ?? "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{u.email}</td>
                      <td className="px-4 py-3"><RolBadge role={u.role} /></td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{formatFecha(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-600 text-xs">
                {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function Campo({ label, name, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
    </div>
  );
}