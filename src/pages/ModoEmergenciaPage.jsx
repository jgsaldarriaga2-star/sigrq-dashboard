// src/pages/ModoEmergenciaPage.jsx
//
// Modo Emergencia Móvil — vista pública de solo lectura pensada para
// abrirse desde un código QR pegado en el área física o un enlace
// compartido por el coordinador HSE, sin necesidad de iniciar sesión.
// Ruta: /emergencia/:empresaId/:sedeId(/:areaId) (fuera de PrivateRoute).
//
// El :areaId en la ruta es solo un identificador legible — el filtrado real
// por área usa el nombre de área que llega en el query param ?area=, igual
// que ?empresa=/?sede= para los nombres de empresa/sede. Esto evita abrir la
// colección "areas" a lectura pública (las sustancias no guardan areaId,
// solo uso.area con el nombre, así que hace falta el nombre para cruzar).
// Si la URL no trae área (QR de sede ya impreso, formato anterior), se
// muestra toda la sede sin filtrar por área — compatibilidad hacia atrás.
//
// Reutiliza derivarEmergencias (utils/emergencia.js) para el tipo de
// emergencia probable por sustancia, y los mismos TIPO_ICONO/
// TIPO_EMERGENCIA_LABEL que EscenariosEmergenciaPage.jsx para los
// escenarios, así el criterio de peligrosidad no se duplica.
//
// Solo lee de Firestore — nunca crea, edita ni elimina nada. Las
// colecciones sustancias, escenarios_emergencia y contactos_emergencia
// están abiertas a lectura pública en firestore.rules específicamente
// para esta ruta (ver comentario en las reglas).

import { useState, useEffect, useMemo } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../services/firebase";
import { GHSPictograma } from "../components/PictogramaGHS";
import { derivarEmergencias, TIPO_EMERGENCIA_LABEL } from "../utils/emergencia";
import { TIPO_ICONO } from "../utils/escenariosEmergencia";
import { etiquetaCas } from "../utils/cas";

const CISPROQUIM = "01 8000 916012";
const EMERGENCIA_NACIONAL = "123";

export default function ModoEmergenciaPage() {
  const { empresaId, sedeId, areaId } = useParams();
  const [searchParams] = useSearchParams();
  const nombreEmpresa = searchParams.get("empresa") || "Emergencia Química";
  const nombreSede = searchParams.get("sede") || "";
  const nombreArea = areaId ? (searchParams.get("area") || "") : "";

  const [sustancias, setSustancias] = useState([]);
  const [escenarios, setEscenarios] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [expandidoId, setExpandidoId] = useState(null);

  useEffect(() => {
    if (!empresaId || !sedeId) return;
    async function cargar() {
      setLoading(true);
      setError(null);
      try {
        const [snapSustancias, snapEscenarios, snapContactos] = await Promise.all([
          getDocs(collection(db, "empresas", empresaId, "sustancias")),
          getDocs(collection(db, "empresas", empresaId, "escenarios_emergencia")),
          getDocs(collection(db, "empresas", empresaId, "contactos_emergencia")),
        ]);

        // Dedup por CAS, igual que DetalleSustanciaPage/FichaEmergenciaPage.
        // Si la URL trae área (nombreArea), además de la sede se filtra por
        // uso.area — las sustancias no guardan areaId, solo el nombre.
        const vistos = new Set();
        const listaSustancias = [];
        for (const d of snapSustancias.docs) {
          const s = { id: d.id, ...d.data() };
          if ((s.uso?.sedeId || null) !== sedeId) continue;
          if (nombreArea && (s.uso?.area || null) !== nombreArea) continue;
          const cas = s.fds?.numero_cas || s.evaluacion?.cas || s.id;
          if (vistos.has(cas)) continue;
          vistos.add(cas);
          listaSustancias.push(s);
        }
        setSustancias(listaSustancias);

        setEscenarios(
          snapEscenarios.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(e => (e.sedeId || null) === sedeId)
            .filter(e => !nombreArea || e.areaNombre === nombreArea)
        );

        // Contactos de la sede + contactos de toda la empresa (sedeId null).
        setContactos(
          snapContactos.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(c => !c.sedeId || c.sedeId === sedeId)
        );
      } catch (err) {
        console.error("Error cargando modo emergencia:", err);
        setError("No se pudo cargar la información de emergencia. Verifica el enlace o inténtalo de nuevo.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [empresaId, sedeId, nombreArea]);

  const termino = busqueda.trim().toLowerCase();

  const sustanciasFiltradas = useMemo(() => {
    if (!termino) return sustancias;
    return sustancias.filter(s => {
      const nombre = (s.evaluacion?.sustancia ?? s.fds?.nombre_comercial ?? "").toLowerCase();
      const area = (s.evaluacion?.area ?? s.uso?.area ?? "").toLowerCase();
      return nombre.includes(termino) || area.includes(termino);
    });
  }, [sustancias, termino]);

  const escenariosFiltrados = useMemo(() => {
    if (!termino) return escenarios;
    return escenarios.filter(e =>
      (e.nombre || "").toLowerCase().includes(termino) ||
      (e.areaNombre || "").toLowerCase().includes(termino)
    );
  }, [escenarios, termino]);

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <div className="sticky top-0 z-10 shadow-md">
        <header className="bg-red-600 text-white px-4 py-4">
          <p className="text-[11px] uppercase tracking-widest opacity-80">⚠ Modo Emergencia</p>
          <h1 className="text-xl font-bold leading-tight">{nombreEmpresa}</h1>
          {nombreSede && (
            <p className="text-sm opacity-90">
              {nombreSede}{nombreArea ? ` — ${nombreArea}` : ""}
            </p>
          )}
        </header>
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <input
            type="text"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar sustancia o área…"
            className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:border-red-500"
          />
        </div>
      </div>

      {loading && <p className="text-center py-12 text-gray-400 text-sm">Cargando información de emergencia…</p>}
      {error && !loading && (
        <div className="mx-4 my-4 bg-red-50 border-2 border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {!loading && !error && (
        <main className="px-4 py-4 space-y-8 pb-16">

          {/* Contactos — siempre arriba */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Contactos de emergencia</h2>
            <div className="space-y-2">
              <ContactoBoton icono="☎️" nombre="CISPROQUIM" cargo="Orientación toxicológica 24/7" telefono={CISPROQUIM} />
              <ContactoBoton icono="🚨" nombre="Emergencia Nacional" cargo="Línea única de emergencias" telefono={EMERGENCIA_NACIONAL} />
              {contactos.map(c => (
                <ContactoBoton key={c.id} icono="📞" nombre={c.nombre} cargo={c.cargo} telefono={c.telefono} />
              ))}
            </div>
          </section>

          {/* Sustancias */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Sustancias ({sustanciasFiltradas.length})
            </h2>
            {sustanciasFiltradas.length === 0 && (
              <p className="text-sm text-gray-400">No hay sustancias que coincidan con la búsqueda.</p>
            )}
            <div className="space-y-3">
              {sustanciasFiltradas.map(s => (
                <SustanciaCard
                  key={s.id}
                  sustancia={s}
                  expandido={expandidoId === s.id}
                  onToggle={() => setExpandidoId(prev => (prev === s.id ? null : s.id))}
                />
              ))}
            </div>
          </section>

          {/* Escenarios */}
          <section>
            <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">
              Escenarios de emergencia ({escenariosFiltrados.length})
            </h2>
            {escenariosFiltrados.length === 0 && (
              <p className="text-sm text-gray-400">No hay escenarios registrados para esta búsqueda.</p>
            )}
            <div className="space-y-3">
              {escenariosFiltrados.map(e => (
                <div key={e.id} className="border-2 border-gray-200 rounded-xl p-4">
                  <p className="font-bold text-base flex items-center gap-2">
                    <span>{TIPO_ICONO[e.tipo] || "⚠"}</span> {e.nombre}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {TIPO_EMERGENCIA_LABEL[e.tipo] || e.tipo}{e.areaNombre ? ` · ${e.areaNombre}` : ""}
                  </p>
                  {(e.pasos || []).length === 0 ? (
                    <p className="text-xs text-gray-400">Sin pasos definidos.</p>
                  ) : (
                    <ol className="list-decimal list-inside space-y-1">
                      {e.pasos.map((p, i) => (
                        <li key={i} className="text-sm text-gray-800">
                          {p.accion}
                          {p.responsable && <span className="text-gray-400"> — {p.responsable}</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              ))}
            </div>
          </section>
        </main>
      )}
    </div>
  );
}

function ContactoBoton({ icono, nombre, cargo, telefono }) {
  return (
    <a href={`tel:${telefono}`}
      className="flex items-center justify-between gap-3 bg-red-50 border-2 border-red-200 rounded-xl px-4 py-3 active:bg-red-100 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-2xl flex-shrink-0">{icono}</span>
        <div className="min-w-0">
          <p className="font-bold text-red-700 truncate">{nombre}</p>
          {cargo && <p className="text-xs text-gray-500 truncate">{cargo}</p>}
        </div>
      </div>
      <span className="font-bold text-red-700 text-lg whitespace-nowrap">{telefono}</span>
    </a>
  );
}

function SustanciaCard({ sustancia, expandido, onToggle }) {
  const ev = sustancia.evaluacion ?? {};
  const fds = sustancia.fds ?? {};
  const nombre = ev.sustancia ?? fds.nombre_comercial ?? "Sin nombre";
  const cas = ev.cas || fds.numero_cas || null;
  const area = ev.area || sustancia.uso?.area || null;
  const emergencias = derivarEmergencias(fds);

  return (
    <div className="border-2 border-gray-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left px-4 py-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold text-base truncate">{nombre}</p>
          <p className="text-xs text-gray-500">
            {cas ? `${etiquetaCas(cas, fds.tipo_producto)} ${cas}` : ""}{area ? ` · ${area}` : ""}
          </p>
          {emergencias.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {emergencias.map(e => (
                <span key={e.tipo}
                  className="inline-flex items-center gap-1 bg-red-100 text-red-700 text-[11px] font-bold px-2 py-0.5 rounded-full">
                  {TIPO_ICONO[e.tipo]} {e.label}
                </span>
              ))}
            </div>
          )}
        </div>
        <span className="text-gray-400 text-xl flex-shrink-0">{expandido ? "▲" : "▼"}</span>
      </button>

      {expandido && (
        <div className="border-t-2 border-gray-100 px-4 py-3 bg-gray-50 space-y-3">
          {fds.pictogramas_ghs?.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {fds.pictogramas_ghs.map(p => <GHSPictograma key={p} tipo={p} size={40} />)}
            </div>
          )}

          {emergencias.length === 0 && (
            <p className="text-xs text-gray-500">
              No se identificó un tipo de emergencia específico a partir de los pictogramas GHS. Consulte la FDS completa.
            </p>
          )}

          {emergencias.map(e => (
            <div key={e.tipo}>
              <p className="text-xs font-bold text-red-700 uppercase tracking-wide mb-1">
                {TIPO_ICONO[e.tipo]} {e.label}
              </p>
              <ol className="list-decimal list-inside space-y-1">
                {e.acciones.map((a, i) => <li key={i} className="text-sm text-gray-800">{a}</li>)}
              </ol>
            </div>
          ))}

          {(ev.epp?.recomendado || ev.epp?.suspendido) && (
            <p className="text-xs text-gray-600">
              <span className="font-bold">Guantes:</span>{" "}
              {ev.epp.suspendido ? `Suspendido — ${ev.epp.motivo}` : ev.epp.recomendado}
            </p>
          )}
          {(ev.epr?.denominacion || ev.epr?.suspendido) && (
            <p className="text-xs text-gray-600">
              <span className="font-bold">Respirador:</span>{" "}
              {ev.epr.suspendido ? `Suspendido — ${ev.epr.motivo}` : `Filtro ${ev.epr.denominacion}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
