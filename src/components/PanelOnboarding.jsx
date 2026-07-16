// src/components/PanelOnboarding.jsx
//
// Guía de onboarding para empresas nuevas — visible solo para admin.
// Checklist de 3 pasos (sede, área, sustancia) consultando Firestore con el
// mismo patrón de otras páginas (collection bajo empresas/{empresaId}).
// Usa query + limit(1) porque solo importa si existe al menos un documento,
// no el conteo completo.
//
// No usa localStorage para "recordar" que se completó: el estado siempre se
// deriva de los datos reales, así que en cuanto existan sede + área +
// sustancia, el panel deja de mostrarse y no vuelve a aparecer aunque se
// borren después (nueva verificación, no un flag persistido).

import { useState, useEffect } from "react";
import { collection, query, limit, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function PanelOnboarding() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();

  const [pasos, setPasos] = useState({ sedes: false, areas: false, sustancias: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!empresaId) return;
    async function cargar() {
      setLoading(true);
      try {
        const [snapSedes, snapAreas, snapSustancias] = await Promise.all([
          getDocs(query(collection(db, "empresas", empresaId, "sedes"), limit(1))),
          getDocs(query(collection(db, "empresas", empresaId, "areas"), limit(1))),
          getDocs(query(collection(db, "empresas", empresaId, "sustancias"), limit(1))),
        ]);
        setPasos({
          sedes: !snapSedes.empty,
          areas: !snapAreas.empty,
          sustancias: !snapSustancias.empty,
        });
      } catch (err) {
        console.error("Error cargando estado de onboarding:", err);
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [empresaId]);

  // Mientras carga no se muestra nada (evita parpadeo mostrando "incompleto"
  // antes de tener datos reales). Si ya completó los 3 pasos, tampoco.
  if (loading || (pasos.sedes && pasos.areas && pasos.sustancias)) return null;

  const pasosList = [
    {
      key: "sedes",
      label: "Crear tu primera sede",
      desc: "Registra la ubicación física de tu empresa.",
      ruta: "/sedes",
      completado: pasos.sedes,
    },
    {
      key: "areas",
      label: "Crear áreas de trabajo",
      desc: "Organiza los procesos donde se usan sustancias químicas.",
      ruta: "/areas",
      completado: pasos.areas,
    },
    {
      key: "sustancias",
      label: "Registrar tu primera sustancia química",
      desc: "Sube una FDS y evalúa su riesgo.",
      ruta: "/sustancias/nueva",
      completado: pasos.sustancias,
    },
  ];

  return (
    <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
      <h2 className="text-lg font-bold text-blue-900 mb-1">👋 Primeros pasos en SIGRQ</h2>
      <p className="text-sm text-blue-700 mb-4">
        Completa estos 3 pasos para dejar tu empresa lista.
      </p>
      <div className="space-y-2">
        {pasosList.map((p, i) => (
          <button
            key={p.key}
            onClick={() => navigate(p.ruta)}
            className={`w-full flex items-center gap-3 text-left px-4 py-3 rounded-xl border transition-colors ${
              p.completado
                ? "bg-white border-green-200"
                : "bg-white border-blue-200 hover:border-blue-400"
            }`}
          >
            <span className={`flex-shrink-0 h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${
              p.completado ? "bg-green-500 text-white" : "bg-blue-100 text-blue-600"
            }`}>
              {p.completado ? "✓" : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${p.completado ? "text-green-700 line-through" : "text-gray-800"}`}>
                {p.label}
              </p>
              <p className="text-xs text-gray-500">{p.desc}</p>
            </div>
            {!p.completado && <span className="text-blue-500 text-sm flex-shrink-0">→</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
