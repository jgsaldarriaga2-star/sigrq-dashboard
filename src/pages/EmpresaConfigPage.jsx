/**
 * EmpresaConfigPage.jsx
 * SIGRQ — Configuración de empresa (logo, datos, responsable HSE)
 *
 * Guarda en Firestore: config/empresa (documento único por proyecto)
 * Solo accesible para rol admin.
 *
 * Integración:
 *   1. import EmpresaConfigPage from "./pages/EmpresaConfigPage";
 *   2. <Route path="/config/empresa" element={<PrivateRoute><EmpresaConfigPage /></PrivateRoute>} />
 *   3. Botón en DashboardPage: navigate("/config/empresa")
 */

import { useState, useEffect } from "react";
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { auth } from "../services/firebase";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext"; // ajusta la ruta si difiere
import { Building2, Upload, Save, CheckCircle2, ChevronLeft, Trash2 } from "lucide-react";



const DEFAULTS = {
  nombre_empresa:      "",
  nit:                 "",
  vigencia_fds_anos:   3,
  direccion:           "",
  ciudad:              "",
  telefono:            "",
  email_contacto:      "",
  responsable_hse:     "",
  cargo_responsable:   "",
  logo_base64:         "",
};

export default function EmpresaConfigPage() {
  const navigate = useNavigate();
  const { empresaId, role } = useAuth();
  const DOC_REF = doc(db, "empresas", empresaId, "config", "empresa");
  const [campos, setCampos] = useState(DEFAULTS);
  const [planInfo, setPlanInfo] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [guardado, setGuardado] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passActual, setPassActual] = useState("");
const [passNueva, setPassNueva] = useState("");
const [passConfirm, setPassConfirm] = useState("");
const [cambiandoPass, setCambiandoPass] = useState(false);
const [passGuardada, setPassGuardada] = useState(false);
const [errorPass, setErrorPass] = useState("");

  // Cargar configuración existente
  useEffect(() => {
    async function cargar() {
      try {
        const [snap, snapSustancias] = await Promise.all([
          getDoc(DOC_REF),
          getDocs(collection(db, "empresas", empresaId, "sustancias")),
        ]);
        if (snap.exists()) {
          const data = snap.data();
          setCampos({ ...DEFAULTS, ...data });
          const plan = data.plan || "free";
          const limite = plan === "grande" ? null : (data.evaluaciones_limite ?? 5);
          const usadas = snapSustancias.size;
          const NOMBRES = { free: "Free", pequeña: "Pequeña", mediana: "Mediana", grande: "Grande" };
          setPlanInfo({ plan, limite, usadas, nombre: NOMBRES[plan] || plan, plan_vence: data.plan_vence || null });
        }
      } catch (err) {
        console.error("Error cargando config:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, []);

  function handleCampo(e) {
    const { name, value } = e.target;
    setCampos(prev => ({ ...prev, [name]: value }));
    setGuardado(false);
  }

  // Convertir logo a base64
  function handleLogo(e) {
    const file = e.target.files[0];
    if (!file) return;

    const maxSize = 200 * 1024; // 200 KB
    if (file.size > maxSize) {
      setError("El logo no debe superar 200 KB. Usa una imagen más pequeña o comprimida.");
      return;
    }
    setError("");

    const reader = new FileReader();
    reader.onload = () => {
      setCampos(prev => ({ ...prev, logo_base64: reader.result }));
      setGuardado(false);
    };
    reader.readAsDataURL(file);
  }

  function quitarLogo() {
    setCampos(prev => ({ ...prev, logo_base64: "" }));
    setGuardado(false);
  }

  async function handleGuardar() {
    if (!campos.nombre_empresa.trim()) {
      setError("El nombre de la empresa es obligatorio.");
      return;
    }
    setError("");
    setGuardando(true);
    try {
      await setDoc(DOC_REF, { ...campos, actualizadoEn: new Date().toISOString() });
      setGuardado(true);
    } catch (err) {
      setError("No se pudo guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function handleCambiarPassword() {
  setErrorPass("");
  setPassGuardada(false);
  if (!passActual || !passNueva || !passConfirm) {
    setErrorPass("Completa todos los campos."); return;
  }
  if (passNueva.length < 6) {
    setErrorPass("La nueva contraseña debe tener mínimo 6 caracteres."); return;
  }
  if (passNueva !== passConfirm) {
    setErrorPass("Las contraseñas nuevas no coinciden."); return;
  }
  setCambiandoPass(true);
  try {
    const credential = EmailAuthProvider.credential(auth.currentUser.email, passActual);
    await reauthenticateWithCredential(auth.currentUser, credential);
    await updatePassword(auth.currentUser, passNueva);
    setPassActual(""); setPassNueva(""); setPassConfirm("");
    setPassGuardada(true);
  } catch (err) {
    if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
      setErrorPass("La contraseña actual es incorrecta.");
    } else {
      setErrorPass("No se pudo cambiar la contraseña: " + err.message);
    }
  } finally {
    setCambiandoPass(false);
  }
}
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">
        Cargando configuración…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" /> Volver
          </button>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-xl">
              <Building2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-800">Configuración de Empresa</h1>
              <p className="text-xs text-gray-500">Datos que aparecen en los informes PDF</p>
            </div>
          </div>
        </div>

        {/* Plan actual */}
        {planInfo && (
          <div className={`rounded-2xl shadow-sm p-5 border-2 ${
            planInfo.plan === "free" ? "bg-gray-50 border-gray-200" :
            planInfo.plan === "pequeña" ? "bg-blue-50 border-blue-200" :
            planInfo.plan === "mediana" ? "bg-purple-50 border-purple-200" :
            "bg-green-50 border-green-200"
          }`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Plan actual</p>
                <p className="text-xl font-bold text-gray-800">Plan {planInfo.nombre}</p>
                {planInfo.plan_vence && (
                  <p className="text-xs text-gray-500 mt-0.5">Vence: {new Date(planInfo.plan_vence).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" })}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-800">
                  {planInfo.usadas}
                  {planInfo.limite !== null && <span className="text-lg text-gray-400"> / {planInfo.limite}</span>}
                </p>
                <p className="text-xs text-gray-500">evaluaciones {planInfo.limite === null ? "ilimitadas" : "usadas"}</p>
                {planInfo.limite !== null && (
                  <div className="mt-1.5 w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(planInfo.usadas / planInfo.limite * 100, 100)}%`,
                        backgroundColor: planInfo.usadas >= planInfo.limite ? "#dc2626" :
                          planInfo.usadas >= planInfo.limite * 0.8 ? "#f97316" : "#2563eb"
                      }} />
                  </div>
                )}
              </div>
            </div>
            {planInfo.plan === "free" && (
              <p className="text-xs text-gray-500 mt-3 border-t border-gray-200 pt-3">
                ¿Necesitas más evaluaciones? Escríbenos a{" "}
              <a href="https://wa.me/573007774342?text=Hola%2C%20quiero%20actualizar%20el%20plan%20de%20mi%20empresa%20en%20SIGRQ."
                target="_blank" rel="noopener noreferrer"
                className="text-green-600 hover:underline font-medium">
                📲 Escríbenos por WhatsApp
              </a>
              </p>
            )}
          </div>
        )}

        {/* Logo */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-4">Logo de la empresa</h2>

          {campos.logo_base64 ? (
            <div className="flex items-start gap-4">
              <img
                src={campos.logo_base64}
                alt="Logo empresa"
                className="h-20 object-contain border border-gray-200 rounded-lg p-2 bg-white"
              />
              <div className="flex flex-col gap-2">
                <p className="text-xs text-gray-500">Logo cargado correctamente</p>
                <button
                  onClick={quitarLogo}
                  className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-3 w-3" /> Quitar logo
                </button>
                <label className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 cursor-pointer">
                  <Upload className="h-3 w-3" /> Cambiar logo
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
                </label>
              </div>
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-8 cursor-pointer hover:bg-blue-50 transition">
              <Upload className="h-8 w-8 text-blue-400 mb-2" />
              <span className="text-sm text-gray-500">Haz clic para subir el logo</span>
              <span className="text-xs text-gray-400 mt-1">PNG, JPG — máximo 200 KB</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleLogo} />
            </label>
          )}
        </div>

        {/* Datos de empresa */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Datos de la empresa</h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <CampoInput label="Nombre de la empresa *" name="nombre_empresa"
                value={campos.nombre_empresa} onChange={handleCampo} />
            </div>
            <CampoInput label="NIT" name="nit"
              value={campos.nit} onChange={handleCampo} placeholder="900.123.456-7" />
            <CampoInput label="Ciudad" name="ciudad"
              value={campos.ciudad} onChange={handleCampo} placeholder="Medellín" />
            <div className="col-span-2">
              <CampoInput label="Dirección" name="direccion"
                value={campos.direccion} onChange={handleCampo} placeholder="Calle 10 #20-30" />
            </div>
            <CampoInput label="Teléfono" name="telefono"
              value={campos.telefono} onChange={handleCampo} placeholder="+57 300 000 0000" />
            <CampoInput label="Email de contacto" name="email_contacto"
              value={campos.email_contacto} onChange={handleCampo} placeholder="hse@empresa.com" />
            <div className="col-span-2">
              <CampoInput label="Vigencia de FDS (años)" name="vigencia_fds_anos"
                value={campos.vigencia_fds_anos} onChange={handleCampo} placeholder="3" />
              <p className="text-xs text-gray-400 mt-1">Colombia: 5 años · UE/EE.UU.: 3 años</p>
            </div>
          </div>
        </div>

        {/* Responsable HSE */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">Responsable HSE</h2>
          <p className="text-xs text-gray-500">
            Aparece como firmante por defecto en los informes PDF. Se puede editar por informe.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <CampoInput label="Nombre completo" name="responsable_hse"
              value={campos.responsable_hse} onChange={handleCampo}
              placeholder="Ing. Juan García" />
            <CampoInput label="Cargo" name="cargo_responsable"
              value={campos.cargo_responsable} onChange={handleCampo}
              placeholder="Coordinador HSE" />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Botón guardar */}
        <button
          onClick={handleGuardar}
          disabled={guardando}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {guardando ? (
            "Guardando…"
          ) : guardado ? (
            <><CheckCircle2 className="h-4 w-4" /> Configuración guardada</>
          ) : (
            <><Save className="h-4 w-4" /> Guardar configuración</>
          )}
        </button>

        {/* Cambio de contraseña */}
        {(role === "admin" || role === "coordinador_hse") && (
          <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
            <h2 className="font-semibold text-gray-700">Cambiar contraseña</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña actual</label>
                <input type="password" value={passActual} onChange={e => setPassActual(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nueva contraseña</label>
                <input type="password" value={passNueva} onChange={e => setPassNueva(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Confirmar nueva contraseña</label>
                <input type="password" value={passConfirm} onChange={e => setPassConfirm(e.target.value)}
                  placeholder="Repite la nueva contraseña"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              {errorPass && (
                <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{errorPass}</p>
              )}
              {passGuardada && (
                <p className="text-sm text-green-600 bg-green-50 px-3 py-2 rounded-lg">
                  ✓ Contraseña actualizada correctamente.
                </p>
              )}
              <button onClick={handleCambiarPassword} disabled={cambiandoPass}
                className="w-full bg-gray-700 hover:bg-gray-800 text-white font-medium py-2 rounded-xl text-sm transition disabled:opacity-50">
                {cambiandoPass ? "Actualizando..." : "Actualizar contraseña"}
              </button>
            </div>
          </div>
        )}

        {guardado && (
          <p className="text-center text-xs text-gray-400">
            Los cambios se aplicarán en todos los informes PDF generados a partir de ahora.
          </p>
        )}
      </div>
    </div>
  );
}

function CampoInput({ label, name, value, onChange, placeholder = "" }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}
