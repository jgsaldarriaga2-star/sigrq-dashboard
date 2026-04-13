// src/pages/UmbralesIotPage.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { db } from "../services/firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";

const VARIABLES = [
  { key: "co2_ppm",      label: "CO₂",             unidad: "ppm" },
  { key: "voc_ppm",      label: "COVs / TVOC",      unidad: "ppb" },
  { key: "co_ppm",       label: "CO",               unidad: "ppm" },
  { key: "temperatura_c",label: "Temperatura",       unidad: "°C"  },
  { key: "humedad_pct",  label: "Humedad",           unidad: "%"   },
];

const DEFAULTS = {
  co2_ppm:       { warn: 1000, peligro: 2000 },
  voc_ppm:       { warn: 500,  peligro: 1000 },
  co_ppm:        { warn: 25,   peligro: 50   },
  temperatura_c: { warn: 35,   peligro: 40   },
  humedad_pct:   { warn: 70,   peligro: 85   },
};

export default function UmbralesIotPage() {
  const { empresaId, role } = useAuth();
  const navigate = useNavigate();
  const [umbrales, setUmbrales] = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!empresaId) return;
    getDoc(doc(db, "empresas", empresaId, "config", "umbrales_iot"))
      .then(snap => {
        if (snap.exists()) setUmbrales({ ...DEFAULTS, ...snap.data() });
        setLoading(false);
      });
  }, [empresaId]);

  function handleCampo(variable, tipo, valor) {
    setUmbrales(u => ({
      ...u,
      [variable]: { ...u[variable], [tipo]: Number(valor) },
    }));
    setSaved(false);
  }

  async function guardar() {
    setSaving(true);
    await setDoc(doc(db, "empresas", empresaId, "config", "umbrales_iot"), umbrales);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (role !== "admin" && role !== "coordinador_hse" && role !== "superadmin") {
    return <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-500">Sin acceso.</div>;
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      <header className="border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/sensores")} className="text-gray-500 hover:text-gray-300 text-sm transition-colors">← Sensores</button>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold tracking-tight text-gray-100">SIGRQ <span className="text-gray-500 font-normal">/ Umbrales IoT</span></h1>
          </div>
          <button onClick={guardar} disabled={saving}
            className="bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors disabled:opacity-50">
            {saving ? "Guardando..." : saved ? "✓ Guardado" : "Guardar cambios"}
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <p className="text-xs text-gray-500 mb-6">
          Define dos niveles de alerta por variable. <span className="text-yellow-400">Amarillo</span> = advertencia · <span className="text-red-400">Rojo</span> = peligro. Aplica a todos los sensores de la empresa.
        </p>

        {loading ? (
          <div className="text-gray-500 text-sm">Cargando...</div>
        ) : (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-gray-800 text-xs text-gray-500 font-medium">
              <span>Variable</span>
              <span className="text-center text-yellow-500">⚠ Advertencia</span>
              <span className="text-center text-red-500">✕ Peligro</span>
            </div>
            {VARIABLES.map((v, i) => (
              <div key={v.key} className={`grid grid-cols-3 gap-4 px-5 py-4 items-center ${i < VARIABLES.length - 1 ? "border-b border-gray-800" : ""}`}>
                <div>
                  <div className="font-medium text-gray-100 text-sm">{v.label}</div>
                  <div className="text-xs text-gray-500">{v.unidad}</div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={umbrales[v.key]?.warn ?? ""}
                    onChange={e => handleCampo(v.key, "warn", e.target.value)}
                    className="w-full bg-gray-800 border border-yellow-900 rounded-lg px-3 py-2 text-sm text-yellow-200 text-right focus:outline-none focus:border-yellow-500"
                  />
                  <span className="text-xs text-gray-600 w-8 flex-shrink-0">{v.unidad}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={umbrales[v.key]?.peligro ?? ""}
                    onChange={e => handleCampo(v.key, "peligro", e.target.value)}
                    className="w-full bg-gray-800 border border-red-900 rounded-lg px-3 py-2 text-sm text-red-200 text-right focus:outline-none focus:border-red-500"
                  />
                  <span className="text-xs text-gray-600 w-8 flex-shrink-0">{v.unidad}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}