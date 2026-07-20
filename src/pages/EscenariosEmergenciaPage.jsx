// src/pages/EscenariosEmergenciaPage.jsx
//
// Módulo de Emergencias — tres pestañas dentro de una misma página:
//  · Escenarios: planes de respuesta por área, sugeridos automáticamente a
//    partir de las sustancias del área y sus incompatibilidades de
//    almacenamiento (utils/escenariosEmergencia.js, que reutiliza
//    utils/almacenamiento.js y utils/emergencia.js).
//  · Recursos: extintores, kits de derrame, duchas, lavaojos y botiquines
//    por sede/área, con alerta de revisión próxima a vencer.
//  · Contactos: directorio de emergencia por tipo, con CISPROQUIM y la
//    línea nacional de emergencias fijas al tope (no editables, igual que
//    en FichaEmergenciaPage.jsx).
// Ruta: /escenarios-emergencia · Roles: admin, coordinador_hse

import { useState, useEffect, useMemo } from "react";
import {
  collection, doc, addDoc, updateDoc, getDoc, getDocs, orderBy, query, serverTimestamp,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { sugerirEscenarios, TIPO_ICONO } from "../utils/escenariosEmergencia";
import { TIPO_EMERGENCIA_LABEL } from "../utils/emergencia";

const TIPOS = ["incendio", "fuga_toxica", "derrame_corrosivo"];

const TIPO_RECURSO_LABEL = {
  extintor: "Extintor",
  kit_derrame: "Kit de derrames",
  ducha_emergencia: "Ducha de emergencia",
  lavaojos: "Lavaojos",
  botiquin: "Botiquín",
};
const TIPO_RECURSO_ICONO = {
  extintor: "🧯",
  kit_derrame: "🪣",
  ducha_emergencia: "🚿",
  lavaojos: "💧",
  botiquin: "🩹",
};

const TIPO_CONTACTO_LABEL = {
  brigada_interna: "Brigada interna",
  bomberos: "Bomberos",
  arl: "ARL",
  cisproquim: "CISPROQUIM",
  policia: "Policía",
  ambulancia: "Ambulancia",
};
const TIPO_CONTACTO_ICONO = {
  brigada_interna: "👷",
  bomberos: "🚒",
  arl: "🏥",
  cisproquim: "☎️",
  policia: "🚓",
  ambulancia: "🚑",
};

// Mismos contactos fijos que FichaEmergenciaPage.jsx — no se guardan en
// Firestore, se muestran siempre al tope de la pestaña Contactos.
const CISPROQUIM = "01 8000 916012";
const EMERGENCIA_NACIONAL = "123";

function estadoRevision(proximaRevision) {
  if (!proximaRevision) return null;
  const dias = (new Date(proximaRevision) - new Date()) / (1000 * 60 * 60 * 24);
  if (dias < 30) return "alerta"; // vencida o a menos de 30 días — badge rojo
  return "vigente";
}

export default function EscenariosEmergenciaPage() {
  const { empresaId, role, sedeId } = useAuth();
  const navigate = useNavigate();

  const [tab, setTab] = useState("escenarios"); // "escenarios" | "recursos" | "contactos"

  const [areas, setAreas] = useState([]);
  const [sedes, setSedes] = useState([]);
  const [sustancias, setSustancias] = useState([]);
  const [escenarios, setEscenarios] = useState([]);
  const [recursos, setRecursos] = useState([]);
  const [contactos, setContactos] = useState([]);
  const [empresaNombre, setEmpresaNombre] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Modo Emergencia Móvil: QR por área ───────────────────────────────
  const [qrObjetivo, setQrObjetivo] = useState(null); // { sede, area } | null

  // ── Escenarios: flujo de creación ────────────────────────────────────
  const [mostrarCrear, setMostrarCrear] = useState(false);
  const [areaSeleccionadaId, setAreaSeleccionadaId] = useState("");
  const [sugerencias, setSugerencias] = useState([]);
  const [borrador, setBorrador] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const [imprimirId, setImprimirId] = useState(null);

  // ── Recursos: formulario de creación ─────────────────────────────────
  const [mostrarCrearRecurso, setMostrarCrearRecurso] = useState(false);
  const [formRecurso, setFormRecurso] = useState(recursoVacio());
  const [guardandoRecurso, setGuardandoRecurso] = useState(false);
  const [errorRecurso, setErrorRecurso] = useState("");

  // ── Contactos: formulario de creación ────────────────────────────────
  const [mostrarCrearContacto, setMostrarCrearContacto] = useState(false);
  const [formContacto, setFormContacto] = useState(contactoVacio());
  const [guardandoContacto, setGuardandoContacto] = useState(false);
  const [errorContacto, setErrorContacto] = useState("");

  function recursoVacio() {
    return { tipo: "extintor", ubicacion: "", sedeId: "", areaNombre: "", fechaUltimaRevision: "", proximaRevision: "" };
  }
  function contactoVacio() {
    return { nombre: "", cargo: "", telefono: "", tipo: "brigada_interna", sedeId: "" };
  }

  // ── Carga inicial ──────────────────────────────────────────────────────
  async function cargarTodo() {
    if (!empresaId) return;
    setLoading(true);
    setError(null);
    try {
      const [snapAreas, snapSedes, snapSustancias, snapEscenarios, snapRecursos, snapContactos, snapEmpresa] = await Promise.all([
        getDocs(query(collection(db, "empresas", empresaId, "areas"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"))),
        getDocs(collection(db, "empresas", empresaId, "sustancias")),
        getDocs(query(collection(db, "empresas", empresaId, "escenarios_emergencia"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "empresas", empresaId, "recursos_emergencia"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "empresas", empresaId, "contactos_emergencia"), orderBy("creadoEn", "desc"))),
        getDoc(doc(db, "empresas", empresaId, "config", "empresa")),
      ]);
      setAreas(snapAreas.docs.map(d => ({ id: d.id, ...d.data() })));
      setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
      setSustancias(snapSustancias.docs.map(d => ({ id: d.id, ...d.data() })));
      setEscenarios(snapEscenarios.docs.map(d => ({ id: d.id, ...d.data() })));
      setRecursos(snapRecursos.docs.map(d => ({ id: d.id, ...d.data() })));
      setContactos(snapContactos.docs.map(d => ({ id: d.id, ...d.data() })));
      setEmpresaNombre(snapEmpresa.exists() ? (snapEmpresa.data().nombre_empresa || "") : "");
    } catch (err) {
      console.error("Error cargando el módulo de emergencias:", err);
      setError("No se pudo cargar el módulo de emergencias.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { cargarTodo(); }, [empresaId]);

  // ── Impresión (una tarjeta de escenario a la vez, vía window.print()) ──
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

  // ── Escenarios: flujo de creación ─────────────────────────────────────
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

  // coordinador_hse con sede asignada solo ve los escenarios de su sede.
  const escenariosVisibles = useMemo(() => {
    if (role === "coordinador_hse" && sedeId) {
      return escenarios.filter(e => e.sedeId === sedeId);
    }
    return escenarios;
  }, [escenarios, role, sedeId]);

  const escenariosPorArea = useMemo(() => {
    const grupos = {};
    for (const e of escenariosVisibles) {
      const sedeNombre = sedes.find(s => s.id === e.sedeId)?.nombre;
      const key = e.areaNombre
        ? (sedeNombre ? `${e.areaNombre} — ${sedeNombre}` : e.areaNombre)
        : "Sin área asignada";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(e);
    }
    return grupos;
  }, [escenariosVisibles, sedes]);

  // ── Recursos: creación ────────────────────────────────────────────────
  function abrirCrearRecurso() {
    setFormRecurso(recursoVacio());
    setErrorRecurso("");
    setMostrarCrearRecurso(true);
  }
  function handleFormRecurso(field, value) {
    setFormRecurso(prev => ({ ...prev, [field]: value }));
  }
  async function guardarRecurso() {
    if (!formRecurso.ubicacion.trim()) { setErrorRecurso("La ubicación es obligatoria."); return; }
    setGuardandoRecurso(true);
    setErrorRecurso("");
    try {
      await addDoc(collection(db, "empresas", empresaId, "recursos_emergencia"), {
        tipo: formRecurso.tipo,
        ubicacion: formRecurso.ubicacion.trim(),
        sedeId: formRecurso.sedeId || null,
        areaNombre: formRecurso.areaNombre.trim() || null,
        fechaUltimaRevision: formRecurso.fechaUltimaRevision || null,
        proximaRevision: formRecurso.proximaRevision || null,
        creadoEn: serverTimestamp(),
      });
      setMostrarCrearRecurso(false);
      cargarTodo();
    } catch (err) {
      setErrorRecurso("Error al guardar: " + err.message);
    } finally {
      setGuardandoRecurso(false);
    }
  }

  const recursosPorGrupo = useMemo(() => {
    const grupos = {};
    for (const r of recursos) {
      const sedeNombre = sedes.find(s => s.id === r.sedeId)?.nombre;
      const key = `${r.areaNombre || "Sin área"} — ${sedeNombre || "Sin sede"}`;
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(r);
    }
    return grupos;
  }, [recursos, sedes]);

  // ── Contactos: creación ───────────────────────────────────────────────
  function abrirCrearContacto() {
    setFormContacto(contactoVacio());
    setErrorContacto("");
    setMostrarCrearContacto(true);
  }
  function handleFormContacto(field, value) {
    setFormContacto(prev => ({ ...prev, [field]: value }));
  }
  async function guardarContacto() {
    if (!formContacto.nombre.trim() || !formContacto.telefono.trim()) {
      setErrorContacto("Nombre y teléfono son obligatorios.");
      return;
    }
    setGuardandoContacto(true);
    setErrorContacto("");
    try {
      await addDoc(collection(db, "empresas", empresaId, "contactos_emergencia"), {
        nombre: formContacto.nombre.trim(),
        cargo: formContacto.cargo.trim() || null,
        telefono: formContacto.telefono.trim(),
        tipo: formContacto.tipo,
        sedeId: formContacto.sedeId || null,
        creadoEn: serverTimestamp(),
      });
      setMostrarCrearContacto(false);
      cargarTodo();
    } catch (err) {
      setErrorContacto("Error al guardar: " + err.message);
    } finally {
      setGuardandoContacto(false);
    }
  }

  const contactosPorTipo = useMemo(() => {
    const grupos = {};
    for (const c of contactos) {
      const key = c.tipo || "otro";
      if (!grupos[key]) grupos[key] = [];
      grupos[key].push(c);
    }
    return grupos;
  }, [contactos]);

  function botonAgregar() {
    if (tab === "escenarios") return { label: "+ Nuevo escenario", onClick: abrirCrear };
    if (tab === "recursos") return { label: "+ Agregar recurso", onClick: abrirCrearRecurso };
    return { label: "+ Agregar contacto", onClick: abrirCrearContacto };
  }
  const btn = botonAgregar();

  // Modo Emergencia Móvil: URL pública por área (sin login). Los nombres de
  // empresa/sede/área van como query params para no tener que abrir a
  // lectura pública los documentos empresas/sedes/areas (que traen más
  // datos, como NIT) — ModoEmergenciaPage cruza por nombre de área contra
  // uso.area, igual que el resto del proyecto hace con sustanciasDelArea().
  function urlEmergencia(sede, area) {
    const params = new URLSearchParams({
      empresa: empresaNombre || "",
      sede: sede.nombre || "",
      area: area?.nombre || "",
    });
    const base = `${window.location.origin}/emergencia/${empresaId}/${sede.id}`;
    return area ? `${base}/${area.id}?${params.toString()}` : `${base}?${params.toString()}`;
  }

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
              SIGRQ <span className="text-gray-500 font-normal">/ Emergencias</span>
            </h1>
          </div>
          <button onClick={btn.onClick}
            className="bg-red-600 hover:bg-red-500 text-white text-sm font-bold px-4 py-2 rounded transition-colors">
            {btn.label}
          </button>
        </div>
      </header>

      {/* Pestañas */}
      <div className="print:hidden border-b border-gray-800 bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 flex gap-1">
          {[
            { key: "escenarios", label: "Escenarios" },
            { key: "recursos", label: "Recursos" },
            { key: "contactos", label: "Contactos" },
          ].map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`text-sm px-4 py-2.5 border-b-2 transition-colors ${
                tab === t.key
                  ? "border-red-500 text-gray-100 font-semibold"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Modo Emergencia Móvil — un QR por área, agrupados por sede, visible
          en cualquier pestaña. coordinador_hse con sede asignada solo ve
          las áreas de su sede. */}
      {!loading && !error && (
        <div className="print:hidden max-w-4xl mx-auto px-6 pt-6">
          {(() => {
            const sedesVisibles = (role === "coordinador_hse" && sedeId)
              ? sedes.filter(s => s.id === sedeId)
              : sedes;
            return sedesVisibles.length === 0 ? (
              <p className="text-xs text-gray-600">
                Crea al menos una sede en <button onClick={() => navigate("/sedes")} className="text-blue-400 hover:underline">Gestión de Sedes</button> para generar códigos QR de Modo Emergencia Móvil.
              </p>
            ) : (
              <div className="space-y-2">
                <span className="text-xs text-gray-500 uppercase tracking-wide">📱 QR Modo Emergencia por área:</span>
                {sedesVisibles.map(sede => {
                  const areasDeSede = areas.filter(a => a.sedeId === sede.id);
                  return (
                    <div key={sede.id} className="flex flex-wrap items-center gap-2">
                      <span className="text-xs text-gray-400 font-semibold whitespace-nowrap">{sede.nombre}:</span>
                      {areasDeSede.length === 0 ? (
                        <span className="text-xs text-gray-600">
                          Sin áreas — <button onClick={() => navigate("/areas")} className="text-blue-400 hover:underline">créalas aquí</button>
                        </span>
                      ) : (
                        areasDeSede.map(area => (
                          <button key={area.id} onClick={() => setQrObjetivo({ sede, area })}
                            className="text-xs bg-gray-900 border border-gray-700 hover:border-red-500 text-gray-300 px-3 py-1.5 rounded transition-colors">
                            {area.nombre}
                          </button>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {loading && <div className="text-center py-16 text-gray-600 text-sm">Cargando…</div>}
        {error && !loading && <div className="bg-red-950 border border-red-800 text-red-300 rounded p-4 text-sm">⚠ {error}</div>}

        {/* ── PESTAÑA: ESCENARIOS ─────────────────────────────────────── */}
        {!loading && !error && tab === "escenarios" && (
          <>
            {escenariosVisibles.length === 0 && (
              <div className="text-center py-16 text-gray-600 text-sm">
                No hay escenarios de emergencia registrados todavía.
              </div>
            )}
            {Object.entries(escenariosPorArea).map(([areaNombre, lista]) => (
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
          </>
        )}

        {/* ── PESTAÑA: RECURSOS ───────────────────────────────────────── */}
        {!loading && !error && tab === "recursos" && (
          <>
            {recursos.length === 0 && (
              <div className="text-center py-16 text-gray-600 text-sm">
                No hay recursos de emergencia registrados todavía.
              </div>
            )}
            {Object.entries(recursosPorGrupo).map(([grupo, lista]) => (
              <section key={grupo}>
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">📍 {grupo}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {lista.map(r => <RecursoCard key={r.id} recurso={r} />)}
                </div>
              </section>
            ))}
          </>
        )}

        {/* ── PESTAÑA: CONTACTOS ──────────────────────────────────────── */}
        {!loading && !error && tab === "contactos" && (
          <>
            <section>
              <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">📌 Contactos del sistema</h2>
              <div className="space-y-2">
                <ContactoFijoCard icono="☎️" nombre="CISPROQUIM Colombia" cargo="Orientación toxicológica nacional 24/7" telefono={CISPROQUIM} />
                <ContactoFijoCard icono="🚨" nombre="Emergencia Nacional" cargo="Línea única de emergencias" telefono={EMERGENCIA_NACIONAL} />
              </div>
            </section>

            {Object.entries(contactosPorTipo).map(([tipo, lista]) => (
              <section key={tipo}>
                <h2 className="text-sm font-bold text-gray-300 uppercase tracking-wider mb-3">
                  {TIPO_CONTACTO_ICONO[tipo] || "📞"} {TIPO_CONTACTO_LABEL[tipo] || tipo}
                </h2>
                <div className="space-y-2">
                  {lista.map(c => (
                    <div key={c.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-100">{c.nombre}</p>
                        <p className="text-xs text-gray-500">
                          {c.cargo && `${c.cargo} · `}
                          {c.sedeId ? (sedes.find(s => s.id === c.sedeId)?.nombre || "Sede") : "Toda la empresa"}
                        </p>
                      </div>
                      <a href={`tel:${c.telefono}`} className="text-sm font-bold text-blue-400 whitespace-nowrap">{c.telefono}</a>
                    </div>
                  ))}
                </div>
              </section>
            ))}

            {contactos.length === 0 && (
              <p className="text-xs text-gray-600">No hay contactos adicionales registrados.</p>
            )}
          </>
        )}
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

      {/* Modal: crear recurso */}
      {mostrarCrearRecurso && (
        <div className="print:hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-100 font-bold">Nuevo recurso de emergencia</h2>
              <button onClick={() => setMostrarCrearRecurso(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select value={formRecurso.tipo} onChange={e => handleFormRecurso("tipo", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  {Object.entries(TIPO_RECURSO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{TIPO_RECURSO_ICONO[k]} {v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ubicación</label>
                <input type="text" value={formRecurso.ubicacion}
                  onChange={e => handleFormRecurso("ubicacion", e.target.value)}
                  placeholder="Ej: Pasillo bodega, junto a la puerta principal"
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Sede</label>
                  <select value={formRecurso.sedeId} onChange={e => handleFormRecurso("sedeId", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                    <option value="">Sin sede específica</option>
                    {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Área</label>
                  <input type="text" value={formRecurso.areaNombre}
                    onChange={e => handleFormRecurso("areaNombre", e.target.value)}
                    placeholder="Ej: Bodega"
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Última revisión</label>
                  <input type="date" value={formRecurso.fechaUltimaRevision}
                    onChange={e => handleFormRecurso("fechaUltimaRevision", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Próxima revisión</label>
                  <input type="date" value={formRecurso.proximaRevision}
                    onChange={e => handleFormRecurso("proximaRevision", e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
                </div>
              </div>
              {errorRecurso && <p className="text-xs text-red-400">⚠ {errorRecurso}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMostrarCrearRecurso(false)} className="text-sm text-gray-400 hover:text-gray-200">
                  Cancelar
                </button>
                <button onClick={guardarRecurso} disabled={guardandoRecurso}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded transition-colors">
                  {guardandoRecurso ? "Guardando…" : "Guardar recurso"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: crear contacto */}
      {mostrarCrearContacto && (
        <div className="print:hidden fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-gray-100 font-bold">Nuevo contacto de emergencia</h2>
              <button onClick={() => setMostrarCrearContacto(false)} className="text-gray-500 hover:text-gray-300">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nombre</label>
                <input type="text" value={formContacto.nombre}
                  onChange={e => handleFormContacto("nombre", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Cargo</label>
                <input type="text" value={formContacto.cargo}
                  onChange={e => handleFormContacto("cargo", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Teléfono</label>
                <input type="text" value={formContacto.telefono}
                  onChange={e => handleFormContacto("telefono", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                <select value={formContacto.tipo} onChange={e => handleFormContacto("tipo", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  {Object.entries(TIPO_CONTACTO_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>{TIPO_CONTACTO_ICONO[k]} {v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Sede</label>
                <select value={formContacto.sedeId} onChange={e => handleFormContacto("sedeId", e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-100 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500">
                  <option value="">Toda la empresa</option>
                  {sedes.map(s => <option key={s.id} value={s.id}>{s.nombre}</option>)}
                </select>
              </div>
              {errorContacto && <p className="text-xs text-red-400">⚠ {errorContacto}</p>}
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setMostrarCrearContacto(false)} className="text-sm text-gray-400 hover:text-gray-200">
                  Cancelar
                </button>
                <button onClick={guardarContacto} disabled={guardandoContacto}
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-5 py-2 rounded transition-colors">
                  {guardandoContacto ? "Guardando…" : "Guardar contacto"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: QR Modo Emergencia Móvil */}
      {qrObjetivo && (
        <div className="qr-modal-overlay fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full text-center">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-gray-900 font-bold text-left">QR de Emergencia</h2>
              <button onClick={() => setQrObjetivo(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="text-sm text-gray-600 mb-4">{qrObjetivo.area.nombre} — {qrObjetivo.sede.nombre}</p>
            <p className="text-xs text-gray-500 mb-4">
              Imprime y pega este código en el área física. Cualquiera puede escanearlo y ver la información de
              emergencia de esta área sin necesidad de iniciar sesión.
            </p>
            <div className="flex justify-center mb-4 bg-white p-3 border border-gray-200 rounded-lg inline-block">
              <QRCodeSVG value={urlEmergencia(qrObjetivo.sede, qrObjetivo.area)} size={200} />
            </div>
            <p className="text-[10px] text-gray-400 break-all mb-4">{urlEmergencia(qrObjetivo.sede, qrObjetivo.area)}</p>
            <div className="flex gap-2 justify-center">
              <button onClick={() => navigator.clipboard.writeText(urlEmergencia(qrObjetivo.sede, qrObjetivo.area))}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded transition-colors">
                Copiar enlace
              </button>
              <button onClick={() => window.print()}
                className="text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded transition-colors">
                🖨 Imprimir
              </button>
            </div>
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
          ${qrObjetivo ? `
            main { display: none !important; }
            .qr-modal-overlay {
              position: static !important;
              background: white !important;
              display: block !important;
            }
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

// ─── Tarjeta de recurso de emergencia ───────────────────────────────────────
function RecursoCard({ recurso }) {
  const estado = estadoRevision(recurso.proximaRevision);
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-100 flex items-center gap-2">
          <span>{TIPO_RECURSO_ICONO[recurso.tipo] || "🧰"}</span> {TIPO_RECURSO_LABEL[recurso.tipo] || recurso.tipo}
        </p>
        {estado === "alerta" && (
          <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
            ⚠ Revisión próxima/vencida
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-1">{recurso.ubicacion}</p>
      <div className="text-[11px] text-gray-500 mt-2 space-y-0.5">
        {recurso.fechaUltimaRevision && <p>Última revisión: {recurso.fechaUltimaRevision}</p>}
        {recurso.proximaRevision && <p>Próxima revisión: {recurso.proximaRevision}</p>}
      </div>
    </div>
  );
}

// ─── Tarjeta de contacto fijo (CISPROQUIM / emergencia nacional) ───────────
function ContactoFijoCard({ icono, nombre, cargo, telefono }) {
  return (
    <div className="bg-gray-900 border border-red-900/50 rounded-lg p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="text-xl">{icono}</span>
        <div>
          <p className="text-sm font-semibold text-gray-100">{nombre}</p>
          <p className="text-xs text-gray-500">{cargo}</p>
        </div>
      </div>
      <a href={`tel:${telefono}`} className="text-sm font-bold text-red-400 whitespace-nowrap">{telefono}</a>
    </div>
  );
}
