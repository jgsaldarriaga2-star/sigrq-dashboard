import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import RegistroPage from "./pages/RegistroPage";
import LandingPage from "./pages/LandingPage";
import DashboardPage from "./pages/DashboardPage";
import NuevaSustanciaPage from "./pages/NuevaSustanciaPage";
import InventarioPage from "./pages/InventarioPage";
import GestionAreasPage from "./pages/GestionAreasPage";
import GestionUsuariosPage from "./pages/GestionUsuariosPage";
import DetalleSustanciaPage from "./pages/DetalleSustanciaPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import EmpresaConfigPage from "./pages/EmpresaConfigPage";
import SuperAdminPage from "./pages/SuperAdminPage";
import GestionSedesPage from "./pages/GestionSedesPage";
import ReporteCumplimientoPage from "./pages/ReporteCumplimientoPage";
import SensoresPage from "./pages/SensoresPage";
import UmbralesIotPage from "./pages/UmbralesIotPage";
import MonitoreoPage from "./pages/MonitoreoPage";
import FichaEmergenciaPage from "./pages/FichaEmergenciaPage";
import EscenariosEmergenciaPage from "./pages/EscenariosEmergenciaPage";
import ModoEmergenciaPage from "./pages/ModoEmergenciaPage";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-white" />;
  return user ? children : <Navigate to="/login" />;
}
function SuperAdminGuard({ children }) {
  const { role } = useAuth();
  return role === "superadmin" ? children : <Navigate to="/dashboard" />;
}
function RolGuard({ roles, children }) {
  const { role } = useAuth();
  return roles.includes(role) ? children : <Navigate to="/dashboard" />;
}
function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/registro" element={user ? <Navigate to="/dashboard" /> : <RegistroPage />} />
      <Route path="/dashboard" element={<PrivateRoute><DashboardPage /></PrivateRoute>} />
      <Route path="/sustancias/nueva" element={<PrivateRoute><NuevaSustanciaPage /></PrivateRoute>} />
      <Route path="/inventario" element={<PrivateRoute><InventarioPage /></PrivateRoute>} />
      <Route path="/areas" element={<PrivateRoute><GestionAreasPage /></PrivateRoute>} />
      <Route path="/usuarios" element={<PrivateRoute><GestionUsuariosPage /></PrivateRoute>} />
      <Route path="/analytics" element={<PrivateRoute><AnalyticsPage /></PrivateRoute>} />
      <Route path="/config/empresa" element={<PrivateRoute><EmpresaConfigPage /></PrivateRoute>} />
      <Route path="/sedes" element={<PrivateRoute><GestionSedesPage /></PrivateRoute>} />
      <Route path="/reporte-cumplimiento" element={<PrivateRoute><ReporteCumplimientoPage /></PrivateRoute>} />
      <Route path="/monitoreo" element={<PrivateRoute><MonitoreoPage /></PrivateRoute>} />
      <Route path="/sensores" element={<PrivateRoute><SensoresPage /></PrivateRoute>} />
      <Route path="/umbrales-iot" element={<PrivateRoute><UmbralesIotPage /></PrivateRoute>} />
      <Route path="/superadmin" element={
  <PrivateRoute>
    <SuperAdminGuard>
      <SuperAdminPage />
    </SuperAdminGuard>
  </PrivateRoute>
} />
      <Route path="*" element={<Navigate to="/" />} />
      <Route path="/sustancias/:id" element={<PrivateRoute><DetalleSustanciaPage /></PrivateRoute>} />
      <Route path="/sustancias/:id/ficha-emergencia" element={
        <PrivateRoute>
          <RolGuard roles={["admin", "coordinador_hse", "superadmin"]}>
            <FichaEmergenciaPage />
          </RolGuard>
        </PrivateRoute>
      } />
      <Route path="/escenarios-emergencia" element={
        <PrivateRoute>
          <RolGuard roles={["admin", "coordinador_hse"]}>
            <EscenariosEmergenciaPage />
          </RolGuard>
        </PrivateRoute>
      } />
      {/* Pública — sin PrivateRoute. Acceso vía QR o enlace compartido, sin login.
          La variante con :areaId es la que generan los QR nuevos (por área);
          la variante sin :areaId se conserva para QR de sede ya impresos. */}
      <Route path="/emergencia/:empresaId/:sedeId" element={<ModoEmergenciaPage />} />
      <Route path="/emergencia/:empresaId/:sedeId/:areaId" element={<ModoEmergenciaPage />} />

    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}