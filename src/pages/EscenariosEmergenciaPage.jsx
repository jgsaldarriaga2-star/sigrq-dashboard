// src/pages/EscenariosEmergenciaPage.jsx
//
// Módulo de Escenarios de Emergencia — planes de respuesta por área,
// sugeridos automáticamente a partir de las sustancias registradas en esa
// área y sus incompatibilidades de almacenamiento (utils/escenariosEmergencia.js,
// que a su vez reutiliza utils/almacenamiento.js y utils/emergencia.js).
// Ruta: /escenarios-emergencia · Roles: admin, coordinador_hse

import { useState, useEffect, useMemo } from "react";
import {
  collection, doc, addDoc, updateDoc, getDocs, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { sugerirEscenarios, TIPO_ICONO } from "../utils/escenariosEmergencia";
import { TIPO_EMERGENCIA_LABEL } from "../utils/emergencia";

const TIPOS = ["incendio", "fuga_toxica", "derrame_corrosivo"];

export default function EscenariosEmergenciaPage() {
  const { empresaId } = useAuth();
  const navigate = useNavigate();

  const [areas, setAreas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [sustancias, setSustancias] = useState([]);
  const [escenarios, setEscenarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [areaSeleccionadaId, setAreaSeleccionadaId] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const [imprimirId, setImprimirId] = useState(null);

  // ── Carga inicial ──────────────────────────────────────────────────────
  async function cargarTodo() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const [snapAreas, snapSedes, snapSustancias, snapEscenarios] = await Promise.all([
        getDocs(query(collection(db, "empresas", empresaId, "areas"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"))),
        getDocs(collection(db, "empresas", empresaId, "sustancias")),
        getDocs(query(collection(db, "empresas", empresaId, "escenarios_emergencia"), orderBy("creadoEn", "desc"))),
      ]);
      setAreas(snapAreas.docs.map(d => ({ id: d.id, ...d.data() })));
      setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
      setSustancias(snapSustancias.docs.map(d => ({ id: d.id, ...d.data() })));
      setEscenarios(snapEscenarios.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error cargando escenarios de emergencia:", err);
      setError("No se pudo cargar el módulo de escenarios de emergencia.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargarTodo(); }, [empresaId]);

  // ── Impresión (una tarjeta a la vez, vía window.print()) ────────────────
  useEffect(() => {
    function limpiar() { setImprimirId(null); }
    window.addEventListener("afterprint", limpiar);
    return () => window.removeEventListener("afterprint", limpiar);
  }, []);
  function imprimirEscenario(id) {
    setImprimirId(id);
    setTimeout(() => window.print(), 50);
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  function nombrePorCas(cas) {
    const s = sustancias.find(s => (s.fds?.numero_cas || s.evaluacion?.cas) === cas);
    return s ? (s.evaluacion?.sustancia ?? s.fds?.nombre_comercial ?? cas) : cas;
  }

  // Las sustancias no guardan areaId (solo uso.area + uso.sedeId, igual que
  // el resto del proyecto), así que se cruzan por nombre de área + sede,
  // deduplicando por CAS igual que DetalleSustanciaPage/FichaEmergenciaPage.
  function sustanciasDelArea(area) {
    const vistos = new Set();
    const resultado = [];
    for (const s of sustancias) {
      if ((s.uso?.area || null) !== area.nombre) continue;
      if ((s.uso?.sedeId || null) !== (area.sedeId || null)) continue;
      const cas = s.fds?.numero_cas || s.evaluacion?.cas || s.id;
      if (vistos.has(cas)) continue;
      vistos.add(cas);
      resultado.push({
        id: s.id,
        cas,
        nombre: s.evaluacion?.sustancia ?? s.fds?.nombre_comercial ?? "Sin nombre",
        fds: s.fds ?? {},
      });
    }
    return resultado;
  }

  // ── Flujo de creación ─────────────────────────────────────────────────
  function abrirCrear() {
    setMostrarCrear(true);
    setAreaSeleccionadaId("");
    setSugerencias([]);
    setBorrador(null);
    setErrorGuardar("");
  }
  function cerrarCrear() {
    setMostrarCrear(false);
    setBorrador(null);
  }

  function seleccionarArea(areaId) {
    setAreaSeleccionadaId(areaId);
    setBorrador(null);
    const area = areas.find(a => a.id === areaId);
    if (!area) { setSugerencias([]); return; }
    setSugerencias(sugerirEscenarios(sustanciasDelArea(area)));
  }

  function usarSugerencia(sug) {
    const area = areas.find(a => a.id === areaSeleccionadaId);
    setBorrador({
      nombre: `${sug.label} — ${area?.nombre || ""}`,
      tipo: sug.tipo,
      areaId: areaSeleccionadaId,
      areaNombre: area?.nombre || "",
      sedeId: area?.sedeId || null,
      sustanciasInvolucradas: sug.sustanciasInvolucradas,
      pasos: sug.pasos,
    });
  }

  function crearEnBlanco() {
    const area = areas.find(a => a.id === areaSeleccionadaId);
    setBorrador({
      nombre: "",
      tipo: "incendio",
      areaId: areaSeleccionadaId,
      areaNombre: area?.nombre || "",
      sedeId: area?.sedeId || null,
      sustanciasInvolucradas: [],
      pasos: [],
    });
  }

  function actualizarBorrador(field, value) {
    setBorrador(prev => ({ ...prev, [field]: value }));
  }
  function agregarPasoBorrador() {
    setBorrador(prev => ({ ...prev, pasos: [...prev.pasos, { orden: prev.pasos.length + 1, accion: "", responsable: "" }] }));
  }
  function actualizarPasoBorrador(i, field, value) {
    setBorrador(prev => ({ ...prev, pasos: prev.pasos.map((p, idx) => idx === i ? { ...p, [field]: value } : p) }));
  }
  function eliminarPasoBorrador(i) {
    setBorrador(prev => ({
      ...prev,
      pasos: prev.pasos.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, orden: idx + 1 })),
    }));
  }
  function eliminarSustanciaBorrador(cas) {
    setBorrador(prev => ({ ...prev, sustanciasInvolucradas: prev.sustanciasInvolucradas.filter(c => c !== cas) }));
  }

  async function guardarEscenario() {
    if (!borrador?.nombre?.trim()) { setErrorGuardar("El nombre del escenario es obligatorio."); return; }
    if (!borrador.pasos.some(p => p.accion.trim())) { setErrorGuardar("Agrega al menos un paso de respuesta."); return; }
    setGuardando(true);
    setErrorGuardar("");
    try {
      await addDoc(collection(db, "empresas", empresaId, "escenarios_emergencia"), {
        nombre: borrador.nombre.trim(),
        tipo: borrador.tipo,
        sedeId: borrador.sedeId || null,
        areaId: borrador.areaId || null,
        areaNombre: borrador.areaNombre || null,
        sustanciasInvolucradas: borrador.sustanciasInvolucradas || [],
        pasos: borrador.pasos
          .filter(p => p.accion.trim())
          .map((p, i) => ({ orden: i + 1, accion: p.accion.trim(), responsable: p.responsable?.trim() || "" })),
        creadoEn: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      cerrarCrear();
      cargarTodo();
    } catch (err) {
      setErrorGuardar("Error al guardar: " + err.message);
    } finally {
      setGuardando(false);
    }
  }

  async function guardarPasosEscenario(id, pasos) {
    const pasosLimpios = pasos
      .filter(p => p.accion.trim())
      .map((p, i) => ({ orden: i + 1, accion: p.accion.trim(), responsable: p.responsable?.trim() || "" }));
    await updateDoc(doc(db, "empresas", empresaId, "escenarios_emergencia", id), {
      pasos: pasosLimpios,
      updatedAt: serverTimestamp(),
    });
    setEscenarios(prev => prev.map(e => e.id === id ? { ...e, pasos: pasosLimpios } : e));
  }

  const escenariosPorArea = useMemo(() => {
    const grupos = {};
    for (const e of escenarios) {
      const sedeNombre = sedes.find(s => s.id === e.sedeId)?.nombre;
      const key = e.areaNombre
        ? (sedeNombre ? `${e.areaNombre} — ${sedeNombre}` : e.areaNombre)
        : "Sin área asignada";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(e);
    }
    return grupos;
  }, [escenarios, sedes]);

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-mono">
      <header className="print:hidden border-b border-gray-800 bg-gray-900 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/dashboard")}
              className="text-gray-500 hover:text-gray-300 transition-colors text-sm">
              ← Dashboard
            </button>
            <span className="text-gray-700">|</span>
            <h1 className="text-lg font-bold tracking-tight text-gray-100">
              SIGRQ <span className="text-gray-500 font-normal">/ Escenarios de Emergencia</span>
            </h1>
          </div>
          <button onClick={abrirCrear}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors">
            + Nuevo escenario
          </button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading && <div className="text-center py-16 text-gray-600 text-sm">Cargando escenarios…</div>}
        {error && !loading && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">⚠ {error}</div>}

        {!loading && !error && escenarios.length === 0 && (
          <div className="text-center py-16 text-gray-600 text-sm">
            No hay escenarios de emergencia registrados todavía.
          </div>
        )}

        {!loading && !error && Object.entries(escenariosPorArea).map(([areaNombre, lista]) => (
          <section key={areaNombre}>
            <h2 className="print:hidden text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">
              📍 {areaNombre}
            </h2>
            <div className="space-y-4">
              {lista.map(esc => (
                <EscenarioCard
                  key={esc.id}
                  escenario={esc}
                  sedeNombre={sedes.find(s => s.id === esc.sedeId)?.nombre}
                  nombrePorCas={nombrePorCas}
                  onGuardarPasos={guardarPasosEscenario}
                  onImprimir={imprimirEscenario}
                  imprimiendo={imprimirId === esc.id}
                />
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* Modal: crear escenario */}
      {mostrarCrear && (
        <div className="print:hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-100 font-bold">Nuevo escenario de emergencia</h2>
              <button onClick={cerrarCrear} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>

            {/* Paso 1: área */}
            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1">Área</label>
              <select value={areaSeleccionadaId} onChange={e => seleccionarArea(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                <option value="">Seleccionar área…</option>
                {areas.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.nombre}{sedes.find(s => s.id === a.sedeId) ? ` — ${sedes.find(s => s.id === a.sedeId).nombre}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Paso 2: sugerencias */}
            {areaSeleccionadaId && !borrador && (
              <div className="space-y-3 mb-2">
                {sugerencias.length === 0 && (
                  <p className="text-xs text-gray-500">
                    No se detectaron riesgos automáticos para esta área con la información disponible.
                    Puedes crear un escenario en blanco.
                  </p>
                )}
                {sugerencias.map(sug => (
                  <div key={sug.tipo} className="border border-gray-700 rounded-lg p-4 bg-gray-800/50">
                    <p className="text-sm font-semibold text-gray-100">{sug.icono} {sug.label}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {sug.sustanciasInvolucradas.length} sustancia{sug.sustanciasInvolucradas.length !== 1 ? "s" : ""} involucrada{sug.sustanciasInvolucradas.length !== 1 ? "s" : ""}
                      {" · "}{sug.pasos.length} paso{sug.pasos.length !== 1 ? "s" : ""} sugerido{sug.pasos.length !== 1 ? "s" : ""}
                    </p>
                    <button onClick={() => usarSugerencia(sug)}
                      className="mt-2 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded transition-colors">
                      Usar esta sugerencia
                    </button>
                  </div>
                ))}
                <button onClick={crearEnBlanco} className="text-xs text-gray-400 hover:text-gray-200 underline">
                  + Crear escenario en blanco
                </button>
              </div>
            )}

            {/* Paso 3: confirmar / editar borrador */}
            {borrador && (
              <div className="space-y-4 border-t border-gray-800 pt-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Nombre del escenario</label>
                  <input type="text" value={borrador.nombre}
                    onChange={e => actualizarBorrador("nombre", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>

                <div>
                  <label className="block text-xs text-gray-500 mb-1">Tipo de emergencia</label>
                  <select value={borrador.tipo} onChange={e => actualizarBorrador("tipo", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    {TIPOS.map(t => (
                      <option key={t} value={t}>{TIPO_ICONO[t]} {TIPO_EMERGENCIA_LABEL[t]}</option>
                    ))}
                  </select>
                </div>

                {borrador.sustanciasInvolucradas.length > 0 && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Sustancias involucradas</label>
                    <div className="flex flex-wrap gap-1.5">
                      {borrador.sustanciasInvolucradas.map(cas => (
                        <span key={cas} className="inline-flex items-center gap-1.5 bg-gray-800 text-gray-300 text-xs px-2 py-1 rounded">
                          {nombrePorCas(cas)}
                          <button onClick={() => eliminarSustanciaBorrador(cas)} className="text-gray-500 hover:text-red-400">✕</button>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs text-gray-500">Pasos de respuesta</label>
                    <button onClick={agregarPasoBorrador} className="text-xs text-blue-400 hover:underline">+ Agregar paso</button>
                  </div>
                  <div className="space-y-2">
                    {borrador.pasos.length === 0 && <p className="text-xs text-gray-600">Agrega al menos un paso.</p>}
                    {borrador.pasos.map((p, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="text-xs text-gray-500 font-mono w-5 pt-1.5">{i + 1}.</span>
                        <textarea value={p.accion} rows={2} placeholder="Acción a ejecutar…"
                          onChange={e => actualizarPasoBorrador(i, "accion", e.target.value)}
                          className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 resize-none" />
                        <input type="text" value={p.responsable} placeholder="Responsable"
                          onChange={e => actualizarPasoBorrador(i, "responsable", e.target.value)}
                          className="w-28 bg-gray-800 border border-gray-700 text-gray-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" />
                        <button onClick={() => eliminarPasoBorrador(i)} className="text-gray-500 hover:text-red-400 text-xs pt-1.5">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {errorGuardar && <p className="text-xs text-red-400">⚠ {errorGuardar}</p>}

                <div className="flex justify-end gap-3 pt-2">
                  <button onClick={() => setBorrador(null)} className="text-sm text-gray-400 hover:text-gray-200">
                    ← Volver a sugerencias
                  </button>
                  <button onClick={guardarEscenario} disabled={guardando}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded transition-colors">
                    {guardando ? "Guardando…" : "Guardar escenario"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          ${imprimirId ? `
            .escenario-card { display: none !important; }
            .escenario-card.imprimir-activo {
              display: block !important;
              background: white !important;
              border-color: #ccc !important;
            }
            .escenario-card.imprimir-activo * { color: #111 !important; }
          ` : ""}
          @page { margin: 1.5cm; }
        }
      `}</style>
    </div>
  );
}

// ─── Tarjeta de escenario existente (pasos editables in-place) ─────────────
function EscenarioCard({ escenario, sedeNombre, nombrePorCas, onGuardarPasos, onImprimir, imprimiendo }) {
  const [pasos, setPasos] = useState(escenario.pasos || []);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    setPasos(escenario.pasos || []);
    setDirty(false);
  }, [escenario.pasos]);

  function actualizarPaso(i, field, value) {
    setPasos(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
    setDirty(true);
  }
  function agregarPaso() {
    setPasos(prev => [...prev, { orden: prev.length + 1, accion: "", responsable: "" }]);
    setDirty(true);
  }
  function eliminarPaso(i) {
    setPasos(prev => prev.filter((_, idx) => idx !== i).map((p, idx) => ({ ...p, orden: idx + 1 })));
    setDirty(true);
  }
  async function guardar() {
    setGuardando(true);
    try {
      await onGuardarPasos(escenario.id, pasos);
      setDirty(false);
    } catch (err) {
      console.error("Error guardando pasos:", err);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={`escenario-card ${imprimiendo ? "imprimir-activo" : ""} bg-gray-900 border border-gray-800 rounded-lg p-5`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-bold text-gray-100 flex items-center gap-2">
            <span>{TIPO_ICONO[escenario.tipo] || "⚠"}</span> {escenario.nombre}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {TIPO_EMERGENCIA_LABEL[escenario.tipo] || escenario.tipo} · {escenario.areaNombre || "Sin área"}{sedeNombre ? ` — ${sedeNombre}` : ""}
          </p>
        </div>
        <button onClick={() => onImprimir(escenario.id)}
          className="print:hidden text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1.5 rounded transition-colors whitespace-nowrap">
          🖨 PDF
        </button>
      </div>

      {escenario.sustanciasInvolucradas?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide mb-1">Sustancias involucradas</p>
          <div className="flex flex-wrap gap-1.5">
            {escenario.sustanciasInvolucradas.map(cas => (
              <span key={cas} className="bg-gray-800 text-gray-300 text-xs px-2 py-0.5 rounded">
                {nombrePorCas(cas)}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-500 uppercase tracking-wide">Pasos de respuesta</p>
          <button onClick={agregarPaso} className="print:hidden text-xs text-blue-400 hover:underline">+ Agregar paso</button>
        </div>
        {pasos.length === 0 && <p className="text-xs text-gray-600">Sin pasos definidos.</p>}
        {pasos.map((p, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-xs text-gray-500 font-mono w-5 pt-1.5">{i + 1}.</span>
            <textarea value={p.accion} rows={1}
              onChange={e => actualizarPaso(i, "accion", e.target.value)}
              className="print:hidden flex-1 bg-gray-800 border border-gray-700 text-gray-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500 resize-none" />
            <span className="hidden print:block flex-1 text-xs">{p.accion}</span>
            <input type="text" value={p.responsable} placeholder="Responsable"
              onChange={e => actualizarPaso(i, "responsable", e.target.value)}
              className="print:hidden w-32 bg-gray-800 border border-gray-700 text-gray-100 rounded px-2 py-1.5 text-xs focus:outline-none focus:border-blue-500" />
            <span className="hidden print:block w-32 text-xs">{p.responsable || "—"}</span>
            <button onClick={() => eliminarPaso(i)} className="print:hidden text-gray-500 hover:text-red-400 text-xs pt-1.5">✕</button>
          </div>
        ))}
      </div>

      {dirty && (
        <div className="print:hidden mt-3">
          <button onClick={guardar} disabled={guardando}
            className="text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-3 py-1.5 rounded transition-colors">
            {guardando ? "Guardando…" : "💾 Guardar cambios"}
          </button>
        </div>
      )}
    </div>
  );
}
