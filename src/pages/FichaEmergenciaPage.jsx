// src/pages/FichaEmergenciaPage.jsx
//
// Ficha de Emergencia Química — versión imprimible de campo por sustancia.
// Ruta: /sustancias/:id/ficha-emergencia · Roles: admin, coordinador_hse, superadmin
//
// Reutiliza la misma carga de datos y el mismo criterio de compatibilidad de
// almacenamiento que DetalleSustanciaPage.jsx (fds/evaluacion/uso desde
// Firestore, clasificarAlmacenamiento + evaluarCompatibilidad contra el
// resto del inventario de la misma sede), y exporta a PDF con window.print()
// igual que el resto de la app (no hay librería de PDF instalada).

import { useState, useEffect } from "react";
import { doc, getDoc, collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../services/firebase";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { GHSPictograma } from "../components/PictogramaGHS";
import { clasificarAlmacenamiento, evaluarCompatibilidad, NIVEL_LABEL as ALMACEN_NIVEL_LABEL } from "../utils/almacenamiento";
import { derivarEmergencias } from "../utils/emergencia";
import { etiquetaCas } from "../utils/cas";

const CISPROQUIM = "01 8000 916012";
const EMERGENCIA_NACIONAL = "123";

export default function FichaEmergenciaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { empresaId } = useAuth();
  const [sustancia, setSustancia] = useState(null);
  const [incompatiblesCriticas, setIncompatiblesCriticas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    setSustancia(null);
    setError(null);
    setLoading(true);
    setIncompatiblesCriticas([]);
    async function cargar() {
      try {
        const [snapSustancia, snapTodas] = await Promise.all([
          getDoc(doc(db, "empresas", empresaId, "sustancias", id)),
          getDocs(query(collection(db, "empresas", empresaId, "sustancias"), orderBy("creadoEn", "desc"))),
        ]);

        if (!snapSustancia.exists()) { setError("Sustancia no encontrada."); return; }
        const sustanciaData = { id: snapSustancia.id, ...snapSustancia.data() };
        setSustancia(sustanciaData);

        const sedeActual = sustanciaData.uso?.sedeId || null;
        if (sedeActual) {
          const propia = clasificarAlmacenamiento(sustanciaData.fds);
          const vistos = new Set();
          const resultado = [];
          for (const d of snapTodas.docs) {
            if (d.id === id) continue;
            const otra = { id: d.id, ...d.data() };
            if ((otra.uso?.sedeId || null) !== sedeActual) continue;
            const clave = otra.fds?.numero_cas || otra.evaluacion?.cas || otra.id;
            if (vistos.has(clave)) continue;
            vistos.add(clave);
            const compat = evaluarCompatibilidad(propia, clasificarAlmacenamiento(otra.fds));
            if (compat.nivel !== "ok") {
              resultado.push({
                id: otra.id,
                nombre: otra.evaluacion?.sustancia ?? otra.fds?.nombre_comercial ?? "Sin nombre",
                area: otra.evaluacion?.area || otra.uso?.area || null,
                nivel: compat.nivel,
                motivos: compat.motivos,
              });
            }
          }
          resultado.sort((a, b) => (a.nivel === b.nivel ? 0 : a.nivel === "peligro" ? -1 : 1));
          setIncompatiblesCriticas(resultado);
        }
      } catch (err) {
        console.error(err);
        setError("No se pudo cargar la ficha de emergencia.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [id, empresaId]);

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Cargando ficha…</div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500 text-sm">{error}</div>
  );

  const ev  = sustancia.evaluacion ?? {};
  const fds = sustancia.fds ?? {};
  const nombre = ev.sustancia ?? fds.nombre_comercial ?? "Sin nombre";
  const cas = ev.cas || fds.numero_cas || null;
  const emergencias = derivarEmergencias(fds);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate(`/sustancias/${id}`)} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Volver a la sustancia
        </button>
        <button onClick={() => window.print()}
          className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          🖨 Descargar ficha PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 print:px-0 print:py-0">
        <div className="bg-white border-2 border-red-600 rounded-2xl print:border print:rounded-none p-6 print:p-5">

          {/* Encabezado */}
          <div className="flex items-start justify-between gap-4 pb-4 border-b-2 border-red-600">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-red-600">Ficha de Emergencia Química</p>
              <h1 className="text-xl font-bold text-gray-900 mt-1">{nombre}</h1>
              {cas && <p className="text-sm text-gray-500">{etiquetaCas(cas, fds.tipo_producto)}: {cas}</p>}
            </div>
            <div className="flex gap-1.5 flex-wrap justify-end max-w-40">
              {(fds.pictogramas_ghs || []).map(p => (
                <GHSPictograma key={p} tipo={p} size={52} />
              ))}
            </div>
          </div>

          {/* Tipo de emergencia probable + acciones inmediatas */}
          <div className="mt-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
              Tipo de Emergencia Probable
            </h2>
            {emergencias.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                No se identificó un tipo de emergencia específico a partir de los pictogramas GHS registrados. Consulte la FDS completa ante cualquier incidente.
              </p>
            ) : (
              <div className="space-y-4">
                {emergencias.map(e => (
                  <div key={e.tipo} className="border-2 border-red-200 bg-red-50 rounded-xl p-4">
                    <p className="text-sm font-bold text-red-700 uppercase tracking-wide mb-2">⚠ {e.label}</p>
                    <ol className="list-decimal list-inside space-y-1">
                      {e.acciones.map((a, i) => (
                        <li key={i} className="text-sm text-gray-800">{a}</li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* EPP de respuesta */}
          <div className="mt-6">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">EPP de Respuesta</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Guantes</p>
                {ev.epp?.suspendido ? (
                  <p className="text-sm text-red-600 font-medium">Suspendido — {ev.epp.motivo}</p>
                ) : ev.epp?.recomendado ? (
                  <p className="text-sm font-bold text-gray-800 capitalize">{ev.epp.recomendado}</p>
                ) : (
                  <p className="text-sm text-gray-400">No calculado</p>
                )}
              </div>
              <div className="border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500 mb-1">Respirador</p>
                {ev.epr?.suspendido ? (
                  <p className="text-sm text-red-600 font-medium">Suspendido — {ev.epr.motivo}</p>
                ) : ev.epr?.denominacion ? (
                  <>
                    <p className="text-sm font-bold text-gray-800">Filtro {ev.epr.denominacion}</p>
                    <p className="text-xs text-gray-500">{ev.epr.equipo?.tipo}</p>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">No calculado</p>
                )}
              </div>
            </div>
          </div>

          {/* Incompatibilidades críticas */}
          {incompatiblesCriticas.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">
                Incompatibilidades en esta Sede
              </h2>
              <div className="space-y-2">
                {incompatiblesCriticas.map(item => (
                  <div key={item.id}
                    className={`border rounded-lg px-3 py-2 ${item.nivel === "peligro" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
                    <p className={`text-sm font-semibold ${item.nivel === "peligro" ? "text-red-700" : "text-amber-700"}`}>
                      {item.nivel === "peligro" ? "⚠ " : ""}{ALMACEN_NIVEL_LABEL[item.nivel]} — {item.nombre}{item.area ? ` (${item.area})` : ""}
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{item.motivos.join(" · ")}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contactos de emergencia */}
          <div className="mt-6 pt-4 border-t-2 border-red-600">
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Contactos de Emergencia</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-900 text-white rounded-xl p-4 text-center">
                <p className="text-xs uppercase tracking-wider opacity-80">CISPROQUIM Colombia</p>
                <p className="text-2xl font-bold mt-1">{CISPROQUIM}</p>
              </div>
              <div className="bg-red-600 text-white rounded-xl p-4 text-center">
                <p className="text-xs uppercase tracking-wider opacity-90">Emergencia nacional</p>
                <p className="text-2xl font-bold mt-1">{EMERGENCIA_NACIONAL}</p>
              </div>
            </div>
          </div>

          <p className="mt-5 text-[10px] text-gray-400 text-center">
            Ficha generada por SIGRQ para uso en campo. No reemplaza la Ficha de Datos de Seguridad completa del proveedor.
          </p>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          @page { size: letter portrait; margin: 1.2cm; }
        }
      `}</style>
    </div>
  );
}
