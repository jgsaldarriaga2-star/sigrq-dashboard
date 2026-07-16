import { useAuth } from "../context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "../services/firebase";
import { useNavigate } from "react-router-dom";
import PanelPrioridadesSede from "../components/PanelPrioridadesSede";
import PanelOnboarding from "../components/PanelOnboarding";

export default function DashboardPage() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const esAdmin        = role === "admin";
  const esCoordinador  = role === "coordinador_hse";
  const esOperario     = role === "operario";
  const esSuperAdmin   = role === "superadmin";

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-4">

        {/* Header */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-800">Dashboard SIGRQ</h1>
          <p className="text-gray-500 mt-1">Bienvenido, {user?.displayName || user?.email}</p>
          <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full ${
            esSuperAdmin  ? "bg-purple-100 text-purple-700" :
            esAdmin       ? "bg-blue-100 text-blue-700" :
            esCoordinador ? "bg-green-100 text-green-700" :
                            "bg-gray-100 text-gray-700"
          }`}>
            Rol: {role}
          </span>
          <button
            onClick={() => signOut(auth)}
            className="mt-4 block text-sm text-red-500 hover:underline"
          >
            Cerrar sesión
          </button>
        </div>

        {/* Guía de onboarding — solo admin, solo mientras falten pasos */}
        {esAdmin && <PanelOnboarding />}

        {/* Panel de Prioridades por Sede — admin, coordinador_hse (no superadmin) */}
        {(esAdmin || esCoordinador) && <PanelPrioridadesSede />}

        {/* ── SUPERADMIN ─────────────────────────────────────────── */}
        {esSuperAdmin && (
          <div className="grid grid-cols-2 gap-4">
            <Boton icono="🏢" titulo="Super Admin" desc="Gestionar empresas clientes"
              onClick={() => navigate("/superadmin")} />
          </div>
        )}

        {/* ── ADMIN + COORDINADOR + OPERARIO ─────────────────────── */}
        {!esSuperAdmin && (
          <div className="grid grid-cols-2 gap-4">

            {/* Inventario — todos los roles */}
            <Boton icono="📦" titulo="Inventario" desc="Ver sustancias evaluadas"
              onClick={() => navigate("/inventario")} />

            {/* Analytics — todos los roles */}
            <Boton icono="📊" titulo="Analytics" desc="Distribución de riesgos por área"
              onClick={() => navigate("/analytics")} />

            {/* Nueva Sustancia — admin y coordinador */}
            {(esAdmin || esCoordinador) && (
              <Boton icono="⚗️" titulo="Nueva Sustancia" desc="Registrar y evaluar riesgo químico"
                onClick={() => navigate("/sustancias/nueva")} />
            )}

            {/* Áreas — admin y coordinador */}
            {(esAdmin || esCoordinador) && (
              <Boton icono="🏭" titulo="Áreas" desc="Gestionar áreas de trabajo"
                onClick={() => navigate("/areas")} />
            )}

            {/* Sedes — solo admin */}
            {esAdmin && (
              <Boton icono="🏗️" titulo="Sedes" desc="Gestionar sedes o plantas"
                onClick={() => navigate("/sedes")} />
            )}

            {/* Escenarios de emergencia — admin y coordinador */}
            {(esAdmin || esCoordinador) && (
              <Boton icono="🧯" titulo="Escenarios de emergencia" desc="Planes de respuesta por área"
                onClick={() => navigate("/escenarios-emergencia")} />
            )}

            {/* Usuarios — solo admin */}
            {esAdmin && (
              <Boton icono="👥" titulo="Usuarios" desc="Gestionar coordinadores y operarios"
                onClick={() => navigate("/usuarios")} />
            )}

            {/* Empresa — solo admin */}
            {esAdmin && (
              <Boton icono="🏢" titulo="Empresa" desc="Logo y datos del informe PDF"
                onClick={() => navigate("/config/empresa")} />
            )}

            {(esAdmin || esCoordinador) && (
              <Boton icono="📋" titulo="Reporte" desc="Informe de cumplimiento normativo"
                onClick={() => navigate("/reporte-cumplimiento")} />
            )}
            {(esAdmin || esCoordinador) && (
              <Boton icono="📡" titulo="Monitoreo IoT" desc="Calidad del aire en tiempo real"
                onClick={() => navigate("/monitoreo")} />
            )}
            {esAdmin && (
              <Boton icono="⚙" titulo="Sensores" desc="Gestión de sensores ESP32"
                onClick={() => navigate("/sensores")} />
            )}

          </div>
        )}

        {/* Mensaje orientativo para operario */}
        {esOperario && (
          <div className="bg-blue-50 border border-blue-200 text-blue-700 text-sm px-4 py-3 rounded-xl">
            Como operario puedes consultar el inventario de sustancias y los riesgos de tu área.
            Contacta al coordinador HSE para registrar nuevas sustancias.
          </div>
        )}

      </div>
    </div>
  );
}

function Boton({ icono, titulo, desc, onClick }) {
  return (
    <button
      onClick={onClick}
      className="bg-white rounded-2xl shadow-sm p-6 text-left hover:shadow-md transition w-full"
    >
      <span className="text-5xl">{icono}</span>
      <h3 className="font-semibold text-gray-800 mt-2">{titulo}</h3>
      <p className="text-xs text-gray-400 mt-1">{desc}</p>
    </button>
  );
}
