/**
 * SuperAdminPage.jsx
 * SIGRQ — Panel de super-administrador (dueño de la plataforma)
 *
 * Solo accesible con role === "superadmin"
 * Ruta: /superadmin
 *
 * Funciones:
 *   - Ver todas las empresas registradas
 *   - Crear nueva empresa + usuario admin cliente
 *   - Activar / desactivar empresa
 */

import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, deleteDoc, orderBy, query, writeBatch, getDoc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import {
  Building2, Plus, CheckCircle2, XCircle,
  ChevronLeft, Loader2, RefreshCw, Eye, EyeOff
} from "lucide-react";

const functions = getFunctions(app, "us-central1");
const crearEmpresaFn = httpsCallable(functions, "crearEmpresa");
const eliminarEmpresaFn = httpsCallable(functions, "eliminarEmpresa");

const FORM_DEFAULTS = {
  nombre: "", nit: "", ciudad: "", direccion: "", telefono: "",
  adminEmail: "", adminPassword: "", adminNombre: "",
};

export default function SuperAdminPage() {
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [creando, setCreando] = useState(false);
  const [exito, setExito] = useState("");
  const [errForm, setErrForm] = useState("");
  const [verPassword, setVerPassword] = useState(false);

  async function cargarEmpresas() {
    setLoading(true);
    setError("");
    try {
      const q = query(collection(db, "empresas"), orderBy("creadoEn", "desc"));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setEmpresas(docs);
    } catch (err) {
      setError("No se pudieron cargar las empresas: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargarEmpresas(); }, []);

  function handleForm(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setErrForm("");
    setExito("");
  }

  async function handleCrear(e) {
    e.preventDefault();
    setErrForm("");
    setExito("");

    if (!form.nombre.trim()) { setErrForm("El nombre de la empresa es obligatorio."); return; }
    if (!form.adminEmail.trim()) { setErrForm("El email del administrador es obligatorio."); return; }
    if (form.adminPassword.length < 6) { setErrForm("La contraseña debe tener al menos 6 caracteres."); return; }

    setCreando(true);
    try {
      const result = await crearEmpresaFn({
        nombre:        form.nombre.trim(),
        nit:           form.nit.trim() || null,
        ciudad:        form.ciudad.trim() || null,
        direccion:     form.direccion.trim() || null,
        telefono:      form.telefono.trim() || null,
        adminEmail:    form.adminEmail.trim(),
        adminPassword: form.adminPassword,
        adminNombre:   form.adminNombre.trim() || null,
      });

      setExito(`✅ Empresa "${form.nombre}" creada. ID: ${result.data.empresaId}`);
      setForm(FORM_DEFAULTS);
      setMostrarForm(false);
      cargarEmpresas();
    } catch (err) {
      setErrForm("Error: " + (err.message || "No se pudo crear la empresa."));
    } finally {
      setCreando(false);
    }
  }

  async function abrirModalPlan(empresa) {
    try {
      const snap = await getDoc(doc(db, "empresas", empresa.id, "config", "empresa"));
      const config = snap.exists() ? snap.data() : {};
      setPlanForm({
        plan: config.plan || "free",
        plan_vence: config.plan_vence || "",
      });
      setModalPlan(empresa);
    } catch (err) {
      alert("Error cargando plan: " + err.message);
    }
  }

  async function guardarPlan() {
    if (!modalPlan) return;
    setGuardandoPlan(true);
    const LIMITES = { free: 5, pequeña: 50, mediana: 110, grande: null };
    try {
      await setDoc(
        doc(db, "empresas", modalPlan.id, "config", "empresa"),
        {
          plan: planForm.plan,
          evaluaciones_limite: LIMITES[planForm.plan],
          plan_vence: planForm.plan_vence || null,
        },
        { merge: true }
      );
      setModalPlan(null);
    } catch (err) {
      alert("Error guardando plan: " + err.message);
    } finally {
      setGuardandoPlan(false);
    }
  }

  async function toggleActiva(empresa) {
    try {
      await updateDoc(doc(db, "empresas", empresa.id), {
        activa: !empresa.activa,
      });
      setEmpresas(prev => prev.map(e =>
        e.id === empresa.id ? { ...e, activa: !e.activa } : e
      ));
    } catch (err) {
      alert("No se pudo actualizar el estado: " + err.message);
    }
  }

  const [confirmEliminar, setConfirmEliminar] = useState(null);
  const [modalPlan, setModalPlan] = useState(null); // empresa seleccionada para editar plan
  const [planForm, setPlanForm] = useState({ plan: "free", plan_vence: "" });
  const [guardandoPlan, setGuardandoPlan] = useState(false);

  async function eliminarEmpresa(empresa) {
    try {
      await eliminarEmpresaFn({ empresaId: empresa.id });
      setEmpresas(prev => prev.filter(e => e.id !== empresa.id));
      setConfirmEliminar(null);
    } catch (err) {
      alert("No se pudo eliminar la empresa: " + err.message);
    }
  }

  const activas   = empresas.filter(e => e.activa).length;
  const inactivas = empresas.filter(e => !e.activa).length;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">

      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")}
              className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1">
              <ChevronLeft className="h-4 w-4" /> Dashboard
            </button>
            <span className="text-gray-700">|</span>
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-400" />
              <h1 className="text-lg font-bold tracking-tight">
                SIGRQ <span className="text-gray-500 font-normal">/ Super Admin</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={cargarEmpresas}
              className="text-gray-500 hover:text-gray-300 text-sm flex items-center gap-1">
              <RefreshCw className="h-4 w-4" /> Actualizar
            </button>
            <button
              onClick={() => { setMostrarForm(f => !f); setErrForm(""); setExito(""); }}
              className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded flex items-center gap-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              {mostrarForm ? "Cancelar" : "Nueva empresa"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-gray-100">{empresas.length}</div>
            <div className="text-gray-500 text-xs mt-0.5">Total empresas</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-green-400">{activas}</div>
            <div className="text-gray-500 text-xs mt-0.5">Activas</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3">
            <div className="text-2xl font-bold text-red-400">{inactivas}</div>
            <div className="text-gray-500 text-xs mt-0.5">Inactivas</div>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {exito && (
          <div className="bg-green-950 border border-green-800 text-green-300 rounded-lg px-4 py-3 text-sm">
            {exito}
          </div>
        )}

        {/* Formulario nueva empresa */}
        {mostrarForm && (
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-5">
              Crear nueva empresa cliente
            </h2>
            <form onSubmit={handleCrear} className="space-y-5">

              {/* Datos empresa */}
              <div>
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-3">
                  Datos de la empresa
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <CampoForm label="Nombre de la empresa *" name="nombre"
                      value={form.nombre} onChange={handleForm} placeholder="Industrias XYZ S.A.S." />
                  </div>
                  <CampoForm label="NIT" name="nit"
                    value={form.nit} onChange={handleForm} placeholder="900.123.456-7" />
                  <CampoForm label="Ciudad" name="ciudad"
                    value={form.ciudad} onChange={handleForm} placeholder="Medellín" />
                  <div className="col-span-2">
                    <CampoForm label="Dirección" name="direccion"
                      value={form.direccion} onChange={handleForm} placeholder="Calle 10 #20-30" />
                  </div>
                  <CampoForm label="Teléfono" name="telefono"
                    value={form.telefono} onChange={handleForm} placeholder="+57 300 000 0000" />
                </div>
              </div>

              {/* Datos admin cliente */}
              <div className="border-t border-gray-800 pt-5">
                <p className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-3">
                  Usuario administrador de la empresa
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <CampoForm label="Nombre completo" name="adminNombre"
                      value={form.adminNombre} onChange={handleForm}
                      placeholder="Ing. María García" />
                  </div>
                  <CampoForm label="Email *" name="adminEmail" type="email"
                    value={form.adminEmail} onChange={handleForm}
                    placeholder="admin@empresa.com" />
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Contraseña *</label>
                    <div className="relative">
                      <input
                        type={verPassword ? "text" : "password"}
                        name="adminPassword"
                        value={form.adminPassword}
                        onChange={handleForm}
                        placeholder="Mínimo 6 caracteres"
                        className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 pr-10"
                      />
                      <button type="button"
                        onClick={() => setVerPassword(v => !v)}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300">
                        {verPassword
                          ? <EyeOff className="h-4 w-4" />
                          : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {errForm && (
                <p className="text-red-400 text-xs">⚠ {errForm}</p>
              )}

              <button type="submit" disabled={creando}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                {creando
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Creando empresa…</>
                  : "Crear empresa y usuario admin"
                }
              </button>
            </form>
          </div>
        )}

        {/* Lista empresas */}
        <div>
          <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">
            Empresas registradas
          </h2>

          {loading && (
            <div className="flex items-center justify-center py-16 text-gray-500 text-sm gap-2">
              <Loader2 className="h-5 w-5 animate-spin" /> Cargando empresas…
            </div>
          )}

          {error && (
            <div className="bg-red-950 border border-red-800 text-red-300 rounded-lg p-4 text-sm">
              ⚠ {error}
            </div>
          )}

          {!loading && !error && (
            <div className="rounded-lg border border-gray-800 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Empresa</th>
                    <th className="px-4 py-3 text-left">NIT</th>
                    <th className="px-4 py-3 text-left">Ciudad</th>
                    <th className="px-4 py-3 text-left">ID Firestore</th>
                    <th className="px-4 py-3 text-center">Plan</th>
                    <th className="px-4 py-3 text-center">Estado</th>
                    <th className="px-4 py-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {empresas.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-600">
                        No hay empresas registradas.
                      </td>
                    </tr>
                  )}
                  {empresas.map(e => (
                    <tr key={e.id} className="bg-gray-950 hover:bg-gray-900 transition-colors">
                      <td className="px-4 py-3 font-semibold text-gray-100">{e.nombre}</td>
                      <td className="px-4 py-3 text-gray-400">{e.nit || "—"}</td>
                      <td className="px-4 py-3 text-gray-400">{e.ciudad || "—"}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs font-mono">{e.id}</td>
                      <td className="px-4 py-3 text-center">
                        <button onClick={() => abrirModalPlan(e)}
                          className="text-xs font-bold px-2 py-1 rounded border border-blue-700 text-blue-400 hover:bg-blue-900 transition-colors">
                          Plan ✎
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {e.activa
                          ? <span className="inline-flex items-center gap-1 text-green-400 text-xs font-bold">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Activa
                            </span>
                          : <span className="inline-flex items-center gap-1 text-red-400 text-xs font-bold">
                              <XCircle className="h-3.5 w-3.5" /> Inactiva
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => toggleActiva(e)}
                            className={`text-xs font-bold px-3 py-1 rounded transition-colors ${
                              e.activa
                                ? "text-red-400 hover:text-red-300 border border-red-800 hover:border-red-600"
                                : "text-green-400 hover:text-green-300 border border-green-800 hover:border-green-600"
                            }`}
                          >
                            {e.activa ? "Desactivar" : "Activar"}
                          </button>
                          <button
                            onClick={() => setConfirmEliminar(e)}
                            className="text-xs font-bold px-3 py-1 rounded transition-colors text-gray-500 hover:text-red-400 border border-gray-700 hover:border-red-800"
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-gray-900 border-t border-gray-800 px-4 py-2 text-gray-600 text-xs">
                {empresas.length} empresa{empresas.length !== 1 ? "s" : ""}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modal gestión de plan */}
      {modalPlan && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-blue-800 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="font-bold text-blue-400 text-lg">Gestionar plan</h2>
            <p className="text-sm text-gray-300">
              Empresa: <span className="font-bold text-white">{modalPlan.nombre}</span>
            </p>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Plan</label>
              <select value={planForm.plan}
                onChange={e => setPlanForm(f => ({ ...f, plan: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="free">Free — 5 evaluaciones</option>
                <option value="pequeña">Pequeña — 50 evaluaciones</option>
                <option value="mediana">Mediana — 110 evaluaciones</option>
                <option value="grande">Grande — Ilimitada</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fecha de vencimiento del plan</label>
              <input type="date" value={planForm.plan_vence}
                onChange={e => setPlanForm(f => ({ ...f, plan_vence: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              <p className="text-xs text-gray-600 mt-1">Dejar vacío si no tiene vencimiento</p>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button onClick={() => setModalPlan(null)}
                className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded">
                Cancelar
              </button>
              <button onClick={guardarPlan} disabled={guardandoPlan}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded">
                {guardandoPlan ? "Guardando..." : "Guardar plan"}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmEliminar && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-900 border border-red-800 rounded-xl p-6 max-w-sm w-full mx-4 space-y-4">
            <h2 className="font-bold text-red-400 text-lg">Eliminar empresa</h2>
            <p className="text-sm text-gray-300">
              ¿Estás seguro que deseas eliminar <span className="font-bold text-white">{confirmEliminar.nombre}</span>?
            </p>
            <p className="text-xs text-gray-500">Esta acción eliminará todas las sustancias, usuarios, áreas y datos asociados. No se puede deshacer.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmEliminar(null)}
                className="text-sm text-gray-400 border border-gray-700 px-4 py-2 rounded">
                Cancelar
              </button>
              <button onClick={() => eliminarEmpresa(confirmEliminar)}
                className="bg-red-700 hover:bg-red-600 text-white text-sm font-bold px-4 py-2 rounded">
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CampoForm({ label, name, value, onChange, placeholder = "", type = "text" }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full bg-gray-800 border border-gray-700 text-gray-100 placeholder-gray-600 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}
