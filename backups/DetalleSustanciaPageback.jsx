// src/pages/DetalleSustanciaPage.jsx

import { useState, useEffect } from "react";
import { doc, getDoc, collection, getDocs, addDoc, updateDoc, query, orderBy, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../services/firebase";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const NIVEL_LABEL = { 1: "Bajo", 2: "Moderado", 3: "Alto", 4: "Muy Alto" };
const NIVEL_COLOR = {
  1: "bg-green-100 text-green-800",
  2: "bg-yellow-100 text-yellow-800",
  3: "bg-orange-100 text-orange-800",
  4: "bg-red-100 text-red-800",
};
const PIEL_COLOR = {
  bajo:  "bg-green-100 text-green-800",
  medio: "bg-yellow-100 text-yellow-800",
  alto:  "bg-red-100 text-red-800",
};
const GUANTE_COLOR = {
  apto:     "bg-green-100 text-green-700 border-green-300",
  limitado: "bg-yellow-100 text-yellow-700 border-yellow-300",
  no_apto:  "bg-red-100 text-red-700 border-red-300",
};
const GUANTE_LABEL = { apto: "✓ Apto", limitado: "⚠ Limitado", no_apto: "✕ No apto" };
const PICTOGRAMA_LABEL = {
  llama: "🔥 Inflamable", oxidante: "🔆 Oxidante", corrosion: "⚗ Corrosivo",
  calavera: "☠ Tóxico agudo", salud: "⚕ Peligro salud", exclamacion: "❕ Irritante",
  gas_presion: "🫙 Gas presión", medio_ambiente: "🌿 Ecotóxico",
};
const CL_COLOR = {
  1: "bg-green-100 text-green-800", 2: "bg-yellow-100 text-yellow-800",
  3: "bg-orange-100 text-orange-800", 4: "bg-red-100 text-red-800",
  5: "bg-purple-100 text-purple-800",
};

const TIPOS_ACCION = {
  consulta_asesor:        "Consulta a especialista",
  control_ingenieria:     "Control de ingeniería",
  control_administrativo: "Control administrativo",
  epp:                    "Cambio / mejora de EPP",
  capacitacion:           "Capacitación al personal",
  sustitucion:            "Sustitución del producto",
  otro:                   "Otro",
};

const RIESGO_RESIDUAL_COLOR = {
  bajo:     "bg-green-100 text-green-800",
  medio:    "bg-yellow-100 text-yellow-800",
  alto:     "bg-orange-100 text-orange-800",
  muy_alto: "bg-red-100 text-red-800",
};

function estadoFDS(fds_caducidad) {
  if (!fds_caducidad) return null;
  const dias = (new Date(fds_caducidad) - new Date()) / (1000 * 60 * 60 * 24);
  if (dias < 0) return "vencida";
  if (dias <= 180) return "proxima";
  return "vigente";
}

function Seccion({ titulo, children }) {
  return (
    <div className="mb-6 print:mb-4">
      <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3 print:text-gray-600">
        {titulo}
      </h2>
      {children}
    </div>
  );
}

function Campo({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-800">{value || "—"}</p>
    </div>
  );
}

function formatFecha(ts) {
  if (!ts) return "—";
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return "—"; }
}

export default function DetalleSustanciaPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { empresaId, role } = useAuth();
  const [sustancia, setSustancia] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [firmante, setFirmante] = useState({ nombre: "", cargo: "" });
  const [editandoFirma, setEditandoFirma] = useState(false);
  const [acciones, setAcciones] = useState([]);
  const [gestion, setGestion] = useState({ asesor_consultado: false, controles_implementados: false, riesgo_residual: null });
  const [formAccion, setFormAccion] = useState({ tipo: "consulta_asesor", descripcion: "", responsable: "", riesgo_residual: "" });
  const [guardandoAccion, setGuardandoAccion] = useState(false);
  const [guardandoGestion, setGuardandoGestion] = useState(false);
  const [accionGuardada, setAccionGuardada] = useState(false);
  const [mostrarFormAccion, setMostrarFormAccion] = useState(false);
  const [mostrarReeval, setMostrarReeval] = useState(false);
  const [formUso, setFormUso] = useState({});
  const [reevaluando, setReevaluando] = useState(false);
  const [errorReeval, setErrorReeval] = useState(null);

  useEffect(() => {
    if (!empresaId) return;
    setSustancia(null);
    setError(null);
    setLoading(true);
    setAcciones([]);
    setGestion({ asesor_consultado: false, controles_implementados: false, riesgo_residual: null });
    async function cargar() {
      try {
        const [snapSustancia, snapEmpresa, snapHistorial] = await Promise.all([
          getDoc(doc(db, "empresas", empresaId, "sustancias", id)),
          getDoc(doc(db, "empresas", empresaId, "config", "empresa")),
          getDocs(query(collection(db, "empresas", empresaId, "sustancias"), orderBy("creadoEn", "desc"))),
        ]);

        if (!snapSustancia.exists()) { setError("Sustancia no encontrada."); return; }
        const sustanciaData = { id: snapSustancia.id, ...snapSustancia.data() };
        setSustancia(sustanciaData);

        const cas = sustanciaData.fds?.numero_cas || sustanciaData.evaluacion?.cas;
        if (cas) {
          const hist = snapHistorial.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter(d => (d.fds?.numero_cas || d.evaluacion?.cas) === cas && d.id !== id);
          setHistorial(hist);
        }

        // Cargar gestión y acciones
        if (sustanciaData.gestion) setGestion(sustanciaData.gestion);
        try {
          const snapAcciones = await getDocs(
            query(collection(db, "empresas", empresaId, "sustancias", id, "acciones"), orderBy("fecha", "desc"))
          );
          setAcciones(snapAcciones.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (_) {
          setAcciones([]);
        }

        if (snapEmpresa.exists()) {
          const emp = snapEmpresa.data();
          setEmpresa(emp);
          setFirmante({ nombre: emp.responsable_hse || "", cargo: emp.cargo_responsable || "" });
        }
      } catch (err) {
        setError("No se pudo cargar el informe.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [id, empresaId]);

  function abrirReeval() {
    setFormUso({
      cantidad_uso:        uso.cantidad_litros?.toString() || "",
      duracion_exposicion: uso.duracion     || "",
      frecuencia_uso:      uso.frecuencia   || "",
      contacto_piel:       uso.contacto_piel || false,
      area_contacto:       uso.area_contacto || "pequeña",
      duracion_contacto:   uso.duracion_contacto || "corta",
    });
    setErrorReeval(null);
    setMostrarReeval(true);
  }

  async function ejecutarReeval() {
    if (!formUso.duracion_exposicion || !formUso.frecuencia_uso) {
      setErrorReeval("Duración y frecuencia son obligatorias.");
      return;
    }
    setReevaluando(true);
    setErrorReeval(null);
    try {
      const body = {
        empresaId,
        sustanciaId: id,
        fds: sustancia.fds,
        uso: {
          area:              uso.area || null,
          cantidad_litros:   parseFloat(formUso.cantidad_uso) || null,
          unidad:            "L",
          duracion:          formUso.duracion_exposicion,
          frecuencia:        formUso.frecuencia_uso,
          contacto_piel:     formUso.contacto_piel,
          area_contacto:     formUso.area_contacto || "pequeña",
          duracion_contacto: formUso.duracion_contacto || "corta",
          sedeId:            uso.sedeId || null,
          es_nanomaterial:   uso.es_nanomaterial || false,
        },
      };
      const token = await auth.currentUser.getIdToken();
      const res = await fetch("https://us-central1-gestionrq.cloudfunctions.net/evaluarSustancia", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Error en el servidor");
      const nueva = await getDoc(doc(db, "empresas", empresaId, "sustancias", id));
      setSustancia({ id: nueva.id, ...nueva.data() });
      setMostrarReeval(false);
    } catch (e) {
      setErrorReeval("No se pudo re-evaluar: " + e.message);
    }
    setReevaluando(false);
  }

  async function guardarGestion(nuevaGestion) {
    setGuardandoGestion(true);
    try {
      await updateDoc(doc(db, "empresas", empresaId, "sustancias", id), {
        gestion: { ...nuevaGestion, ultima_actualizacion: serverTimestamp() }
      });
      setGestion(nuevaGestion);
    } catch (e) { console.error(e); }
    setGuardandoGestion(false);
  }

  async function registrarAccion() {
    if (!formAccion.descripcion.trim()) return;
    setGuardandoAccion(true);
    try {
      const nueva = {
        tipo: formAccion.tipo,
        descripcion: formAccion.descripcion.trim(),
        responsable: formAccion.responsable.trim(),
        riesgo_residual: formAccion.riesgo_residual || null,
        fecha: serverTimestamp(),
        registrado_por: empresaId,
      };
      const ref = await addDoc(collection(db, "empresas", empresaId, "sustancias", id, "acciones"), nueva);
      // Si es consulta_asesor, actualizar gestion automáticamente
      const nuevaGestion = { ...gestion };
      if (formAccion.tipo === "consulta_asesor") nuevaGestion.asesor_consultado = true;
      if (formAccion.riesgo_residual) nuevaGestion.riesgo_residual = formAccion.riesgo_residual;
      await updateDoc(doc(db, "empresas", empresaId, "sustancias", id), {
        gestion: { ...nuevaGestion, ultima_actualizacion: serverTimestamp() }
      });
      setGestion(nuevaGestion);
      setAcciones(prev => [{ id: ref.id, ...nueva, fecha: { toDate: () => new Date() } }, ...prev]);
      setFormAccion({ tipo: "consulta_asesor", descripcion: "", responsable: "", riesgo_residual: "" });
      setMostrarFormAccion(false);
      setAccionGuardada(true);
      setTimeout(() => setAccionGuardada(false), 3000);
    } catch (e) { console.error(e); }
    setGuardandoAccion(false);
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-400 text-sm">Cargando informe…</div>
  );
  if (error) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center text-red-500 text-sm">{error}</div>
  );

  const ev  = sustancia.evaluacion ?? {};
  const fds = sustancia.fds ?? {};
  const uso = sustancia.uso ?? {};
  const nivelInhalacion = ev.inhalacion?.nivel ?? 0;
  const estadoFds = estadoFDS(ev.fds_caducidad);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="print:hidden bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between sticky top-0 z-10">
        <button onClick={() => navigate("/inventario")} className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
          ← Inventario
        </button>
        <div className="flex items-center gap-3">
          {!empresa && (
            <button onClick={() => navigate("/config/empresa")} className="text-xs text-blue-600 hover:underline">
              ⚙ Configurar empresa
            </button>
          )}
          {(role === "admin" || role === "coordinador_hse" || role === "superadmin") && (
            <button onClick={abrirReeval}
              className="bg-amber-500 hover:bg-amber-400 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
              ↺ Re-evaluar
            </button>
          )}
          <button onClick={() => window.print()}
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            🖨 Exportar PDF
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 print:px-8 print:py-6">

        {/* Encabezado empresa */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-200 print:border-gray-400">
          <div className="flex items-start gap-4">
            {empresa?.logo_base64 ? (
              <img src={empresa.logo_base64} alt="Logo empresa" className="h-16 object-contain" />
            ) : (
              <div className="h-16 w-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center text-xs text-gray-400">Logo empresa</div>
            )}
            <div>
              <p className="font-bold text-gray-800 text-base">{empresa?.nombre_empresa || "Nombre de la empresa"}</p>
              {empresa?.nit && <p className="text-xs text-gray-500">NIT: {empresa.nit}</p>}
              {empresa?.direccion && <p className="text-xs text-gray-500">{empresa.direccion}{empresa.ciudad ? `, ${empresa.ciudad}` : ""}</p>}
              {empresa?.telefono && <p className="text-xs text-gray-500">{empresa.telefono}</p>}
              {empresa?.email_contacto && <p className="text-xs text-gray-500">{empresa.email_contacto}</p>}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Informe de Evaluación</p>
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">de Riesgo Químico</p>
            <p className="text-xs text-gray-500">Fecha: <span className="font-medium text-gray-700">
              {ev.fecha_evaluacion ? new Date(ev.fecha_evaluacion).toLocaleDateString("es-CO", { day: "2-digit", month: "long", year: "numeric" }) : "—"}
            </span></p>
            {ev.area && <p className="text-xs text-gray-500 mt-1">Área: <span className="font-medium text-gray-700">{ev.area}</span></p>}
          </div>
        </div>

        {/* Sustancia */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 print:text-xl">{ev.sustancia ?? fds.nombre_comercial ?? "Sin nombre"}</h1>
          {ev.cas && <p className="text-sm text-gray-500 mt-1">CAS: {ev.cas}</p>}
          {estadoFds === "vencida" && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">
              ⚠ FDS vencida desde {ev.fds_caducidad} — solicitar versión actualizada al proveedor
            </div>
          )}
          {estadoFds === "proxima" && (
            <div className="mt-3 bg-yellow-50 border border-yellow-200 text-yellow-700 text-sm px-4 py-2 rounded-lg">
              ⏳ FDS próxima a vencer: {ev.fds_caducidad}
            </div>
          )}
        </div>

        {/* Resumen ejecutivo */}
        <div className="mb-8 print:mb-6">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-400 border-b border-gray-200 pb-1 mb-3">Resumen Ejecutivo</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className={`rounded-xl p-4 text-center ${NIVEL_COLOR[nivelInhalacion] || "bg-gray-100 text-gray-600"}`}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1">Inhalación</p>
              <p className="text-xl font-bold">{NIVEL_LABEL[nivelInhalacion] ?? "N/E"}</p>
              <p className="text-xs mt-1">HG: {ev.inhalacion?.hg ?? "—"}</p>
              {ev.inhalacion?.nivelBase && ev.inhalacion.nivelBase !== nivelInhalacion && (
                <p className="text-xs mt-0.5 opacity-70">Base: {NIVEL_LABEL[ev.inhalacion.nivelBase]}</p>
              )}
            </div>
            <div className={`rounded-xl p-4 text-center ${PIEL_COLOR[ev.piel?.nivel] || "bg-gray-100 text-gray-600"}`}>
              <p className="text-xs font-bold uppercase tracking-wider mb-1">Piel</p>
              <p className="text-xl font-bold capitalize">{ev.piel?.nivel ?? "N/E"}</p>
              <p className="text-xs mt-1">HG: {ev.piel?.hgPiel ?? "—"}</p>
            </div>
            <div className="bg-gray-100 rounded-xl p-4 text-center">
              <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-600">Fuego</p>
              <p className="text-xl font-bold text-gray-800">Serie {ev.fuego?.serie ?? "—"}</p>
              <p className="text-xs mt-1 text-gray-600">Grupo: {ev.fuego?.grupoPC ?? "—"}</p>
            </div>
            {ev.nano ? (
              <div className={`rounded-xl p-4 text-center ${CL_COLOR[ev.nano.cl] || "bg-gray-100 text-gray-600"}`}>
                <p className="text-xs font-bold uppercase tracking-wider mb-1">Nano</p>
                <p className="text-xl font-bold">CL{ev.nano.cl}</p>
                <p className="text-xs mt-1">HB:{ev.nano.hbFinal} EP:{ev.nano.epFinal}</p>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-4 text-center border border-dashed border-gray-200">
                <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-400">Nano</p>
                <p className="text-sm text-gray-400">No aplica</p>
              </div>
            )}
          </div>
          {ev.requiere_asesor && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm font-medium">
              ⚠ Esta sustancia requiere evaluación por asesor especializado en seguridad química
            </div>
          )}
        </div>

        {/* Historial de evaluaciones */}
        {historial.length > 0 && (
          <Seccion titulo={`Historial de evaluaciones anteriores (${historial.length})`}>
            <div className="print:hidden rounded-lg border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="px-4 py-2 text-left">Fecha</th>
                    <th className="px-4 py-2 text-left">Área</th>
                    <th className="px-4 py-2 text-center">Inhalación</th>
                    <th className="px-4 py-2 text-center">Piel</th>
                    <th className="px-4 py-2 text-center">Fuego</th>
                    <th className="px-4 py-2 text-center">Ver</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {historial.map(h => {
                    const hev = h.evaluacion ?? {};
                    const nInh = hev.inhalacion?.nivel ?? 0;
                    return (
                      <tr key={h.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-xs text-gray-500">{formatFecha(h.creadoEn)}</td>
                        <td className="px-4 py-2 text-xs text-gray-600">{hev.area || h.uso?.area || "—"}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${NIVEL_COLOR[nInh] || "bg-gray-100 text-gray-600"}`}>
                            {NIVEL_LABEL[nInh] ?? "N/E"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold capitalize ${PIEL_COLOR[hev.piel?.nivel] || "bg-gray-100 text-gray-600"}`}>
                            {hev.piel?.nivel ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-center text-xs text-gray-600">
                          {hev.fuego?.serie ? `Serie ${hev.fuego.serie}` : "—"}
                        </td>
                        <td className="px-4 py-2 text-center">
                          <button onClick={(e) => { e.stopPropagation(); window.scrollTo(0,0); navigate(`/sustancias/${h.id}`); }}
                            className="text-xs text-blue-500 hover:underline">Ver →</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Seccion>
        )}

        {/* Datos FDS */}
        <Seccion titulo="Ficha de Datos de Seguridad">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <Campo label="Estado físico"     value={fds.estado_fisico} />
            <Campo label="OEL (ppm)"         value={fds.oel_ppm} />
            <Campo label="OEL (mg/m³)"       value={fds.oel_mg_m3} />
            <Campo label="Fecha emisión"     value={fds.fds_fecha_emision} />
            <Campo label="Punto ebullición"  value={fds.punto_ebullicion_c ? `${fds.punto_ebullicion_c} °C` : null} />
            <Campo label="Punto inflamación" value={fds.punto_inflamacion_c ? `${fds.punto_inflamacion_c} °C` : null} />
            <Campo label="Presión de vapor"  value={fds.presion_vapor_kpa ? `${fds.presion_vapor_kpa} kPa` : null} />
            <Campo label="FDS caduca"        value={ev.fds_caducidad} />
          </div>
          {fds.pictogramas_ghs?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Pictogramas GHS</p>
              <div className="flex flex-wrap gap-2">
                {fds.pictogramas_ghs.map(p => (
                  <span key={p} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">{PICTOGRAMA_LABEL[p] ?? p}</span>
                ))}
              </div>
            </div>
          )}
          {fds.frases_h?.length > 0 && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 mb-1">Frases H (peligro salud)</p>
              <div className="flex flex-wrap gap-1">
                {fds.frases_h.map(f => (
                  <span key={f} className="bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded border border-red-100">{f}</span>
                ))}
              </div>
            </div>
          )}
          {fds.frases_h_fisicoquimicas?.length > 0 && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Frases H (fisicoquímicas)</p>
              <div className="flex flex-wrap gap-1">
                {fds.frases_h_fisicoquimicas.map(f => (
                  <span key={f} className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded border border-orange-100">{f}</span>
                ))}
              </div>
            </div>
          )}
        </Seccion>

        {/* Condiciones de uso */}
        <Seccion titulo="Condiciones de Uso">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Campo label="Área / Proceso"      value={uso.area} />
            <Campo label="Cantidad"            value={uso.cantidad_litros ? `${uso.cantidad_litros} L` : null} />
            <Campo label="Duración exposición" value={uso.duracion} />
            <Campo label="Frecuencia"          value={uso.frecuencia} />
            <Campo label="Contacto piel"       value={uso.contacto_piel ? "Sí" : "No"} />
            <Campo label="Área de contacto"    value={uso.area_contacto} />
            <Campo label="Duración contacto"   value={uso.duracion_contacto} />
          </div>
        </Seccion>

        {/* Inhalación */}
        <Seccion titulo="Evaluación — Inhalación">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
            <div className={`px-3 py-2 rounded-lg text-center min-w-24 ${NIVEL_COLOR[nivelInhalacion] || "bg-gray-100"}`}>
              <p className="text-xs font-bold">Nivel</p>
              <p className="text-xl font-bold">{nivelInhalacion}</p>
              <p className="text-xs">{NIVEL_LABEL[nivelInhalacion] ?? "N/E"}</p>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700 mb-1">{ev.inhalacion?.descripcion}</p>
              {ev.inhalacion?.advertencias?.length > 0 && ev.inhalacion.advertencias.map((a, i) => (
                <p key={i} className="text-xs text-yellow-700 bg-yellow-50 px-2 py-1 rounded mb-1">{a}</p>
              ))}
            </div>
          </div>
        </Seccion>

        {/* Piel */}
        {uso.contacto_piel && (
          <Seccion titulo="Evaluación — Piel">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
              <div className={`px-3 py-2 rounded-lg text-center min-w-24 ${PIEL_COLOR[ev.piel?.nivel] || "bg-gray-100"}`}>
                <p className="text-xs font-bold">Nivel</p>
                <p className="text-xl font-bold capitalize">{ev.piel?.nivel ?? "—"}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{ev.piel?.descripcion}</p>
              </div>
            </div>
          </Seccion>
        )}

        {/* Fuego */}
        <Seccion titulo="Evaluación — Fuego / Explosión">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
            <div className="bg-gray-100 px-3 py-2 rounded-lg text-center min-w-24">
              <p className="text-xs font-bold text-gray-600">Serie</p>
              <p className="text-xl font-bold text-gray-800">{ev.fuego?.serie ?? "—"}</p>
              <p className="text-xs text-gray-600">{ev.fuego?.grupoPC}</p>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">{ev.fuego?.descripcion}</p>
            </div>
          </div>
        </Seccion>

        {/* Nanomateriales */}
        {ev.nano && (
          <Seccion titulo="Evaluación — Nanomateriales (ANSES Nanotool 2010)">
            <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-4">
              <div className={`px-3 py-2 rounded-lg text-center min-w-24 ${CL_COLOR[ev.nano.cl] || "bg-gray-100"}`}>
                <p className="text-xs font-bold">Clase</p>
                <p className="text-xl font-bold">CL{ev.nano.cl}</p>
                <p className="text-xs mt-0.5">HB:{ev.nano.hbFinal} EP:{ev.nano.epFinal}</p>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-700">{ev.nano.descripcion}</p>
              </div>
            </div>
          </Seccion>
        )}

        {/* EPP Guantes */}
        {ev.epp?.suspendido ? (
          <Seccion titulo="EPP — Selección de Guantes (EN ISO 374)">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700">⚠️ Selección de EPP suspendida</p>
              <p className="text-xs text-red-600 mt-1">{ev.epp.motivo}</p>
            </div>
          </Seccion>
        ) : ev.epp && (
          <Seccion titulo="EPP — Selección de Guantes (EN ISO 374)">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <p className="text-xs text-gray-500 mb-3">
                Tipo de sustancia: <span className="font-medium capitalize text-gray-700">{ev.epp.tipo_sustancia}</span>
              </p>
              <div className="flex flex-wrap gap-2 mb-3">
                {Object.entries(ev.epp.compatibilidad).map(([material, nivel]) => (
                  <div key={material} className={`border rounded-lg px-3 py-2 text-xs font-medium text-center min-w-20 ${GUANTE_COLOR[nivel]}`}>
                    <div className="font-bold capitalize">{material}</div>
                    <div>{GUANTE_LABEL[nivel]}</div>
                  </div>
                ))}
              </div>
              {ev.epp.recomendado && (
                <p className="text-sm text-gray-600">
                  Recomendado: <span className="font-bold text-green-700 capitalize">{ev.epp.recomendado}</span>
                  {ev.epp.alternativas?.length > 0 && <span className="text-gray-500"> · Alternativas: <span className="capitalize">{ev.epp.alternativas.join(", ")}</span></span>}
                  {ev.epp.no_permitidos?.length > 0 && <span className="text-gray-500"> · No permitidos: <span className="capitalize text-red-600">{ev.epp.no_permitidos.join(", ")}</span></span>}
                </p>
              )}
              {ev.epp.recomendado && Object.values(ev.epp.compatibilidad).every(v => v !== "apto") && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                  ⚠️ Compatibilidad reducida por condiciones de uso (duración o área de contacto). Considere reducir el tiempo de exposición o consulte al proveedor.
                </p>
              )}
            </div>
          </Seccion>
        )}

        {/* EPR */}
        {ev.epr?.suspendido ? (
          <Seccion titulo="EPR — Protección Respiratoria (EN 14387)">
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-red-700">⚠️ Selección de EPR suspendida</p>
              <p className="text-xs text-red-600 mt-1">{ev.epr.motivo}</p>
            </div>
          </Seccion>
        ) : ev.epr && (
          <Seccion titulo="EPR — Protección Respiratoria (EN 14387)">
            <div className="bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex flex-wrap gap-4 items-start mb-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-center min-w-24">
                  <p className="text-xs text-blue-600 font-bold mb-1">Filtro</p>
                  <p className="text-2xl font-bold text-blue-800">{ev.epr.denominacion}</p>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-gray-800">{ev.epr.equipo?.tipo}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{ev.epr.equipo?.clase}</p>
                  <p className="text-xs text-gray-500 mt-1">{ev.epr.equipo?.descripcion}</p>
                  {ev.epr.equipo?.obligatorio && (
                    <span className="inline-block mt-2 text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded font-medium">Uso obligatorio</span>
                  )}
                </div>
              </div>
              {ev.epr.advertencias?.length > 0 && (
                <div className="space-y-1 mt-2">
                  {ev.epr.advertencias.map((a, i) => (
                    <p key={i} className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded">⚠ {a}</p>
                  ))}
                </div>
              )}
            </div>
          </Seccion>
        )}

        {/* Panel re-evaluación */}
        {mostrarReeval && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden">
            <div className="bg-white rounded-2xl shadow-xl p-6 max-w-lg w-full mx-4 space-y-4">
              <h2 className="font-bold text-gray-800 text-lg">Re-evaluar con nuevas condiciones</h2>
              <p className="text-xs text-gray-500">La FDS original se conserva. Solo se actualizan las condiciones de uso y se recalcula el riesgo.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cantidad de uso (L o kg)</label>
                  <input type="number" value={formUso.cantidad_uso}
                    onChange={e => setFormUso(f => ({ ...f, cantidad_uso: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Duración de exposición *</label>
                  <select value={formUso.duracion_exposicion}
                    onChange={e => setFormUso(f => ({ ...f, duracion_exposicion: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Seleccionar...</option>
                    <option value="corta">Corta — menos de 30 min/día</option>
                    <option value="media">Media — entre 30 y 120 min/día</option>
                    <option value="larga">Larga — más de 120 min/día</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Frecuencia de uso *</label>
                  <select value={formUso.frecuencia_uso}
                    onChange={e => setFormUso(f => ({ ...f, frecuencia_uso: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="">Seleccionar...</option>
                    <option value="diaria">Diaria — todos los días</option>
                    <option value="semanal">Semanal — 2 a 3 veces por semana</option>
                    <option value="ocasional">Ocasional — menos de una vez por semana</option>
                    <option value="esporadica">Esporádica — pocas veces al año</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Contacto con piel</label>
                  <select value={formUso.contacto_piel ? "si" : "no"}
                    onChange={e => setFormUso(f => ({ ...f, contacto_piel: e.target.value === "si" }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                    <option value="no">No</option>
                    <option value="si">Sí</option>
                  </select>
                </div>
                {formUso.contacto_piel && (
                  <>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Área de contacto</label>
                      <select value={formUso.area_contacto}
                        onChange={e => setFormUso(f => ({ ...f, area_contacto: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="pequeña">Pequeña — manos/antebrazos</option>
                        <option value="grande">Grande — cuerpo completo</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Duración del contacto</label>
                      <select value={formUso.duracion_contacto}
                        onChange={e => setFormUso(f => ({ ...f, duracion_contacto: e.target.value }))}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400">
                        <option value="corta">Corta — menos de 15 min</option>
                        <option value="larga">Larga — más de 15 min</option>
                      </select>
                    </div>
                  </>
                )}
              </div>
              {errorReeval && <p className="text-xs text-red-500">{errorReeval}</p>}
              <div className="flex gap-3 justify-end pt-2">
                <button onClick={() => setMostrarReeval(false)}
                  className="text-sm text-gray-500 border border-gray-200 px-4 py-2 rounded-lg hover:bg-gray-50">
                  Cancelar
                </button>
                <button onClick={ejecutarReeval} disabled={reevaluando}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors">
                  {reevaluando ? "Re-evaluando..." : "Confirmar re-evaluación"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Gestión de riesgos — solo admin y coordinador_hse */}
        {(role === "admin" || role === "coordinador_hse" || role === "superadmin") && (
          <Seccion titulo="Gestión de Riesgos — Acciones y Trazabilidad">
            {/* Estado de gestión */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Estado de gestión</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gestion.asesor_consultado}
                    onChange={e => guardarGestion({ ...gestion, asesor_consultado: e.target.checked })}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">Especialista consultado</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={gestion.controles_implementados}
                    onChange={e => guardarGestion({ ...gestion, controles_implementados: e.target.checked })}
                    className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700">Controles implementados</span>
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 whitespace-nowrap">Riesgo residual:</span>
                  <select value={gestion.riesgo_residual || ""}
                    onChange={e => guardarGestion({ ...gestion, riesgo_residual: e.target.value || null })}
                    className="text-sm border border-gray-300 rounded px-2 py-1 flex-1">
                    <option value="">Sin evaluar</option>
                    <option value="bajo">Bajo</option>
                    <option value="medio">Medio</option>
                    <option value="alto">Alto</option>
                    <option value="muy_alto">Muy Alto</option>
                  </select>
                </div>
              </div>
              {gestion.riesgo_residual && (
                <div className={`inline-flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-lg ${RIESGO_RESIDUAL_COLOR[gestion.riesgo_residual]}`}>
                  Riesgo residual declarado: <span className="font-bold capitalize">{gestion.riesgo_residual.replace("_", " ")}</span>
                </div>
              )}
              {guardandoGestion && <p className="text-xs text-blue-500 mt-2">Guardando...</p>}
            </div>

            {/* Botón para abrir formulario / confirmación de éxito */}
            {!mostrarFormAccion && (
              <div className="mb-4 print:hidden">
                {accionGuardada && (
                  <p className="text-xs text-green-600 mb-2">✓ Acción registrada correctamente.</p>
                )}
                <button onClick={() => setMostrarFormAccion(true)}
                  className="text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors">
                  ➕ Registrar nueva acción
                </button>
              </div>
            )}

            {/* Formulario nueva acción */}
            {mostrarFormAccion && (
              <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 print:hidden">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Registrar acción de control</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Tipo de acción</label>
                    <select value={formAccion.tipo}
                      onChange={e => setFormAccion(f => ({ ...f, tipo: e.target.value }))}
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5">
                      {Object.entries(TIPOS_ACCION).map(([k, v]) => (
                        <option key={k} value={k}>{v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1">Responsable</label>
                    <input type="text" value={formAccion.responsable}
                      onChange={e => setFormAccion(f => ({ ...f, responsable: e.target.value }))}
                      placeholder="Nombre del responsable"
                      className="w-full text-sm border border-gray-300 rounded px-2 py-1.5" />
                  </div>
                </div>
                <div className="mb-3">
                  <label className="text-xs text-gray-500 block mb-1">Descripción de la acción *</label>
                  <textarea value={formAccion.descripcion}
                    onChange={e => setFormAccion(f => ({ ...f, descripcion: e.target.value }))}
                    placeholder="Describa la acción implementada..."
                    rows={3}
                    className="w-full text-sm border border-gray-300 rounded px-2 py-1.5 resize-none" />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-500 whitespace-nowrap">Riesgo residual tras esta acción:</label>
                    <select value={formAccion.riesgo_residual}
                      onChange={e => setFormAccion(f => ({ ...f, riesgo_residual: e.target.value }))}
                      className="text-sm border border-gray-300 rounded px-2 py-1">
                      <option value="">No aplica</option>
                      <option value="bajo">Bajo</option>
                      <option value="medio">Medio</option>
                      <option value="alto">Alto</option>
                      <option value="muy_alto">Muy Alto</option>
                    </select>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <button onClick={() => setMostrarFormAccion(false)}
                      className="text-sm text-gray-500 border border-gray-200 px-3 py-1.5 rounded hover:bg-gray-50 transition-colors">
                      Cancelar
                    </button>
                    <button onClick={registrarAccion} disabled={guardandoAccion || !formAccion.descripcion.trim()}
                      className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-bold px-4 py-1.5 rounded transition-colors">
                      {guardandoAccion ? "Registrando..." : "Registrar acción"}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Historial de acciones */}
            {acciones.length > 0 && (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-3">Historial de acciones ({acciones.length})</p>
                <div className="space-y-3">
                  {acciones.map(a => (
                    <div key={a.id} className="border border-gray-100 rounded-lg px-4 py-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded">
                          {TIPOS_ACCION[a.tipo] || a.tipo}
                        </span>
                        <span className="text-xs text-gray-400">
                          {a.fecha?.toDate ? a.fecha.toDate().toLocaleDateString("es-CO", { day: "2-digit", month: "short", year: "numeric" }) : "Ahora"}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 mt-1">{a.descripcion}</p>
                      <div className="flex items-center gap-4 mt-2 flex-wrap">
                        {a.responsable && <span className="text-xs text-gray-500">Responsable: <span className="font-medium">{a.responsable}</span></span>}
                        {a.riesgo_residual && (
                          <span className={`text-xs font-medium px-2 py-0.5 rounded ${RIESGO_RESIDUAL_COLOR[a.riesgo_residual]}`}>
                            Riesgo residual: {a.riesgo_residual.replace("_", " ")}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {acciones.length === 0 && (
              <p className="text-xs text-gray-400 italic px-1">No se han registrado acciones de control para esta sustancia.</p>
            )}
          </Seccion>
        )}

        {/* Pie + firma */}
        <div className="mt-10 pt-6 border-t-2 border-gray-200 print:border-gray-400">
          <div className="flex items-end justify-between">
            <div className="text-xs text-gray-400 space-y-1">
              <p>Generado por <span className="font-medium">SIGRQ</span> · Sistema de Gestión de Riesgos Químicos</p>
              <p>Metodología: OIT/BAuA EvariQui + EMKG · EPP: EN ISO 374 · EPR: EN 14387</p>
              {ev.nano && <p>Nanomateriales: ANSES Nanotool 2010</p>}
              <p className="mt-2 text-gray-400">Este informe es orientativo. Consulte un asesor especializado para sustancias de nivel 4 o CL5.</p>
            </div>
            <div className="text-center min-w-52">
              <div className="border-b border-gray-400 mb-2 h-10 print:h-12" />
              {editandoFirma && role !== "operario" ? (
  <div className="print:hidden space-y-1 mb-1">
    <input type="text" value={firmante.nombre}
      onChange={e => setFirmante(p => ({ ...p, nombre: e.target.value }))}
      placeholder="Nombre completo"
      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center" />
    <input type="text" value={firmante.cargo}
      onChange={e => setFirmante(p => ({ ...p, cargo: e.target.value }))}
      placeholder="Cargo"
      className="w-full border border-gray-300 rounded px-2 py-1 text-xs text-center" />
    <button onClick={() => setEditandoFirma(false)} className="text-xs text-blue-600 hover:underline">Confirmar</button>
  </div>
) : (
  <>
    <p className="text-xs font-semibold text-gray-700">{firmante.nombre || "Responsable HSE"}</p>
    <p className="text-xs text-gray-500">{firmante.cargo || "Cargo"}</p>
    {role !== "operario" && (
      <button onClick={() => setEditandoFirma(true)} className="print:hidden text-xs text-gray-400 hover:text-blue-500 mt-1">✏ Editar</button>
    )}
  </>
)}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1.5cm 2cm; }
        }
      `}</style>
    </div>
  );
}
