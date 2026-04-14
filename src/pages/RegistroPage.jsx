/**
 * RegistroPage.jsx
 * SIGRQ — Registro público de empresa (plan Free)
 * Ruta pública: /registro
 * No requiere autenticación.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

const REGISTRO_URL = "https://us-central1-gestionrq.cloudfunctions.net/registrarEmpresaPublica";

const FORM_DEFAULTS = {
  nombre_empresa: "",
  nit: "",
  ciudad: "",
  admin_nombre: "",
  admin_email: "",
  admin_password: "",
  admin_password_confirm: "",
};

export default function RegistroPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(FORM_DEFAULTS);
  const [registrando, setRegistrando] = useState(false);
  const [error, setError] = useState("");
  const [exito, setExito] = useState(false);

  function handleCampo(e) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError("");
  }

  async function handleRegistro(e) {
    e.preventDefault();
    setError("");

    if (!form.nombre_empresa.trim()) { setError("El nombre de la empresa es obligatorio."); return; }
    if (!form.admin_email.trim())    { setError("El correo es obligatorio."); return; }
    if (form.admin_password.length < 6) { setError("La contraseña debe tener mínimo 6 caracteres."); return; }
    if (form.admin_password !== form.admin_password_confirm) { setError("Las contraseñas no coinciden."); return; }

    setRegistrando(true);
    try {
      const res = await fetch(REGISTRO_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_empresa:   form.nombre_empresa.trim(),
          nit:              form.nit.trim() || null,
          ciudad:           form.ciudad.trim() || null,
          admin_nombre:     form.admin_nombre.trim() || null,
          admin_email:      form.admin_email.trim().toLowerCase(),
          admin_password:   form.admin_password,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo completar el registro.");

      setExito(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setRegistrando(false);
    }
  }

  if (exito) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center space-y-4">
          <div className="text-5xl">✅</div>
          <h2 className="text-xl font-bold text-gray-800">¡Registro exitoso!</h2>
          <p className="text-sm text-gray-600">
            Tu empresa fue creada con el plan <span className="font-bold text-blue-600">Free</span> — 
            5 evaluaciones de riesgo químico incluidas.
          </p>
          <p className="text-sm text-gray-500">
            Ingresa con el correo y contraseña que registraste.
          </p>
          <button onClick={() => navigate("/login")}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition">
            Ir al inicio de sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-white flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-lg w-full space-y-6">

        {/* Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-3">
            <span className="text-2xl">⚗️</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800">SIGRQ</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestión de Riesgos Químicos</p>
          <div className="mt-3 inline-block bg-blue-50 border border-blue-200 text-blue-700 text-xs font-semibold px-3 py-1.5 rounded-full">
            🎁 Plan Free — 5 evaluaciones sin costo
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleRegistro} className="space-y-4">

          {/* Datos empresa */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Datos de la empresa</p>
            <div className="space-y-3">
              <Campo label="Nombre de la empresa *" name="nombre_empresa"
                value={form.nombre_empresa} onChange={handleCampo}
                placeholder="Curtiembre San Jorge S.A.S." />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="NIT" name="nit"
                  value={form.nit} onChange={handleCampo}
                  placeholder="900.123.456-7" />
                <Campo label="Ciudad" name="ciudad"
                  value={form.ciudad} onChange={handleCampo}
                  placeholder="Medellín" />
              </div>
            </div>
          </div>

          {/* Datos admin */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Tu cuenta de acceso</p>
            <div className="space-y-3">
              <Campo label="Nombre completo" name="admin_nombre"
                value={form.admin_nombre} onChange={handleCampo}
                placeholder="Ing. María García" />
              <Campo label="Correo electrónico *" name="admin_email" type="email"
                value={form.admin_email} onChange={handleCampo}
                placeholder="admin@tuempresa.com" />
              <div className="grid grid-cols-2 gap-3">
                <Campo label="Contraseña *" name="admin_password" type="password"
                  value={form.admin_password} onChange={handleCampo}
                  placeholder="Mínimo 6 caracteres" />
                <Campo label="Confirmar contraseña *" name="admin_password_confirm" type="password"
                  value={form.admin_password_confirm} onChange={handleCampo}
                  placeholder="Repite la contraseña" />
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 rounded-xl">
              {error}
            </div>
          )}

          <button type="submit" disabled={registrando}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-medium py-3 rounded-xl text-sm transition">
            {registrando ? "Creando cuenta..." : "Crear cuenta gratis"}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center space-y-2">
          <p className="text-xs text-gray-400">
            ¿Ya tienes cuenta?{" "}
            <button onClick={() => navigate("/login")} className="text-blue-600 hover:underline font-medium">
              Iniciar sesión
            </button>
          </p>
          <p className="text-xs text-gray-400">
            ¿Necesitas más de 5 evaluaciones?{" "}
            <a href="https://wa.me/573007774342?text=Hola%2C%20quiero%20conocer%20los%20planes%20de%20SIGRQ."
              target="_blank" rel="noopener noreferrer"
              className="text-green-600 hover:underline font-medium">
              📲 Escríbenos por WhatsApp
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

function Campo({ label, name, value, onChange, placeholder = "", type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input type={type} name={name} value={value} onChange={onChange}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
    </div>
  );
}
