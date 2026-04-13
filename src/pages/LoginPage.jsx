import { useState } from "react";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../services/firebase";
import { useNavigate } from "react-router-dom";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetEnviado, setResetEnviado] = useState(false);
  const [loadingReset, setLoadingReset] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard");
    } catch (err) {
      setError("Credenciales incorrectas. Verifica tu email y contraseña.");
    } finally {
      setLoading(false);
    }
  }
  async function handleReset() {
    if (!email) {
      setError("Escribe tu correo arriba para recuperar la contraseña.");
      return;
    }
    setLoadingReset(true);
    setError("");
    try {
      await sendPasswordResetEmail(auth, email);
      setResetEnviado(true);
    } catch (err) {
      setError("No se pudo enviar el correo. Verifica el email ingresado.");
    } finally {
      setLoadingReset(false);
    }
  }
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-gray-800">SIGRQ</h1>
          <p className="text-sm text-gray-500 mt-1">Sistema de Gestión de Riesgos Químicos</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 rounded-lg text-sm transition disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
          {resetEnviado ? (
            <p className="text-center text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              ✓ Correo enviado. Revisa tu bandeja de entrada.
            </p>
          ) : (
            <button
              type="button"
              onClick={handleReset}
              disabled={loadingReset}
              className="w-full text-xs text-gray-400 hover:text-blue-500 transition text-center mt-1"
            >
              {loadingReset ? "Enviando..." : "¿Olvidaste tu contraseña?"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
} 
