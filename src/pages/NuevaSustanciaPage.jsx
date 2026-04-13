import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../services/firebase";
import { collection, addDoc, serverTimestamp, getDocs, orderBy, query } from "firebase/firestore";
import SeccionNanomateriales from "../components/SeccionNanomateriales";
import { useAuth } from "../context/AuthContext";

const EXTRAER_URL = "https://us-central1-gestionrq.cloudfunctions.net/extraerFDS";
const EVALUAR_URL = "https://us-central1-gestionrq.cloudfunctions.net/evaluarSustancia";

const camposVacios = {
  nombre: "", cas: "", fabricante: "", uso: "", areaId: "",
  estado_fisico: "", presion_vapor_kPa: "", punto_ebullicion: "",
  vla_ppm: "", vla_mgm3: "", cantidad_uso: "",
  duracion_exposicion: "", frecuencia_uso: "",
  contacto_piel: false, area_contacto: "", duracion_contacto: "",
};

export default function NuevaSustanciaPage() {
  const { empresaId } = useAuth();
const [campos, setCampos] = useState(camposVacios);
  const [archivo, setArchivo] = useState(null);
  const [extrayendo, setExtrayendo] = useState(false);
  const [evaluando, setEvaluando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState("");
  const [areas, setAreas] = useState([]);
  const [nanoData, setNanoData] = useState({
  esNanomaterial: false,
  nano_params: {
    hbBase: null,
    esAnalogo: false,
    insoluble1h: false,
    mayorReactividad: false,
    formaFisica: "solido",
    modificadores: [],
    procesos: [],
    esFibraBiopersistente: false,
  },
});
  const navigate = useNavigate();

  const [sedes, setSedes] = useState([]);

useEffect(() => {
  if (!empresaId) return;
  async function cargarDatos() {
    try {
      const [snapAreas, snapSedes] = await Promise.all([
        getDocs(query(collection(db, "empresas", empresaId, "areas"), orderBy("creadoEn", "desc"))),
        getDocs(query(collection(db, "empresas", empresaId, "sedes"), orderBy("creadoEn", "desc"))),
      ]);
      setAreas(snapAreas.docs.map(d => ({ id: d.id, ...d.data() })));
      setSedes(snapSedes.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Error cargando datos:", err);
    }
  }
  cargarDatos();
}, [empresaId]);

  function handleCampo(e) {
  const { name, value, type, checked } = e.target;
  if (name === "uso") {
  const areaSeleccionada = areas.find(a => a.id === value);
  setCampos(prev => ({
    ...prev,
    areaId: value,
    uso: areaSeleccionada?.nombre || "",
    sedeId: areaSeleccionada?.sedeId || "",
  }));
  return;
}
  setCampos(prev => ({ ...prev, [name]: type === "checkbox" ? checked : value }));
}

  async function extraerDesdePDF(e) {
  const file = e.target.files[0];
  if (!file) return;
  setArchivo(file);
  setError("");
  setExtrayendo(true);

  try {
    // Convertir PDF a base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(",")[1]);
      reader.onerror = () => reject(new Error("Error leyendo el archivo"));
      reader.readAsDataURL(file);
    });

    const token = await auth.currentUser.getIdToken();

    const res = await fetch(EXTRAER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        pdf_base64: base64,
        nombre_archivo: file.name,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error extrayendo FDS");

   setCampos(prev => ({
  ...prev,
  nombre:                  data.nombre_comercial      || data.nombre_quimico || "",
  cas:                     data.numero_cas            || "",
  fabricante:              data.proveedor             || "",
  estado_fisico:           data.estado_fisico         || "",
  presion_vapor_kPa:       data.presion_vapor_kpa     || "",
  punto_ebullicion:        data.punto_ebullicion_c    || "",
  vla_ppm:                 data.oel_ppm               || "",
  vla_mgm3:                data.oel_mg_m3             || "",
  // Campos extras para el motor
  frases_h:                data.frases_h              || [],
  frases_h_fisicoquimicas: data.frases_h_fisicoquimicas || [],
  pictogramas_ghs:         data.pictogramas_ghs       || [],
  formacion_polvo:         data.formacion_polvo       || null,
  punto_inflamacion_c:     data.punto_inflamacion_c   || null,
  temperatura_ignicion_c:  data.temperatura_ignicion_c || null,
  fds_fecha_emision:       data.fds_fecha_emision      || null,
}));
  } catch (err) {
    setError("No se pudo extraer la FDS: " + err.message);
  } finally {
    setExtrayendo(false);
  }
}

  async function handleEvaluar() {
    setError("");
    setEvaluando(true);
    setResultado(null);

    try {
      const token = await auth.currentUser.getIdToken();
      console.log("fds_fecha_emision enviada:", campos.fds_fecha_emision);
      const res = await fetch(EVALUAR_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
  empresaId,
  fds: {
  nombre_comercial:        campos.nombre              || null,
  nombre_quimico:          campos.nombre              || null,
  numero_cas:              campos.cas                 || null,
  fds_fecha_emision:       campos.fds_fecha_emision   || null,
  estado_fisico:           campos.estado_fisico         || "liquido",
  presion_vapor_kpa:       parseFloat(campos.presion_vapor_kPa) || null,
  punto_ebullicion_c:      parseFloat(campos.punto_ebullicion)  || null,
  oel_ppm:                 parseFloat(campos.vla_ppm)           || null,
  oel_mg_m3:               parseFloat(campos.vla_mgm3)          || null,
  frases_h:                campos.frases_h             || [],
  frases_h_fisicoquimicas: campos.frases_h_fisicoquimicas || [],
  pictogramas_ghs:         campos.pictogramas_ghs      || [],
  formacion_polvo:         campos.formacion_polvo      || null,
  punto_inflamacion_c:     campos.punto_inflamacion_c  || null,
  temperatura_ignicion_c:  campos.temperatura_ignicion_c || null,
  nano_params: nanoData.esNanomaterial ? nanoData.nano_params : null,
},
 uso: {
  area:              campos.uso                    || null,
  cantidad_litros:   parseFloat(campos.cantidad_uso) || null,
  unidad:            "L",
  duracion:          campos.duracion_exposicion    || null,
  frecuencia:        campos.frecuencia_uso         || null,
  contacto_piel:     campos.contacto_piel          || false,
  area_contacto:     campos.area_contacto          || "pequeña",
  duracion_contacto: campos.duracion_contacto      || "corta",
  sedeId: campos.sedeId || null,
  es_nanomaterial: nanoData.esNanomaterial,
},
}),
      });

      const data = await res.json();
      console.log("RESULTADO MOTOR:", JSON.stringify(data));
      if (!res.ok) throw new Error(data.error || "Error evaluando sustancia");

      // Guardar en Firestore
     

      setResultado(data);
    } catch (err) {
      setError("Error en evaluación: " + err.message);
    } finally {
      setEvaluando(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/dashboard")}
            className="text-sm text-gray-500 hover:text-gray-800">
            ← Volver
          </button>
          <h1 className="text-xl font-bold text-gray-800">Nueva Sustancia Química</h1>
        </div>

        {/* Upload FDS */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="font-semibold text-gray-700 mb-3">1. Cargar FDS (PDF)</h2>
          <label className="flex flex-col items-center justify-center border-2 border-dashed border-blue-300 rounded-xl p-8 cursor-pointer hover:bg-blue-50 transition">
            <span className="text-3xl mb-2">📄</span>
            <span className="text-sm text-gray-500">
              {extrayendo ? "Extrayendo información..." : archivo ? archivo.name : "Haz clic para seleccionar el PDF de la FDS"}
            </span>
            <input type="file" accept="application/pdf" className="hidden" onChange={extraerDesdePDF} />
          </label>
          {extrayendo && (
            <p className="text-xs text-blue-500 mt-2 text-center animate-pulse">
              Analizando FDS con IA... esto puede tomar unos segundos
            </p>
          )}
        </div>

        {/* Formulario */}
        <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-700">2. Datos de la sustancia</h2>

          <div className="grid grid-cols-2 gap-4">
            <Campo label="Nombre" name="nombre" value={campos.nombre} onChange={handleCampo} />
            <Campo label="CAS" name="cas" value={campos.cas} onChange={handleCampo} />
            <Campo label="Fabricante" name="fabricante" value={campos.fabricante} onChange={handleCampo} />
            <div>
  <label className="block text-xs font-medium text-gray-600 mb-1">Área / Proceso</label>
  <select
  name="uso"
  value={campos.areaId}
  onChange={handleCampo}
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    <option value="">Seleccionar área…</option>
    {areas.map(a => {
  const sede = sedes.find(s => s.id === a.sedeId);
  return (
    <option key={a.id} value={a.id}>
      {a.nombre}{sede ? ` — ${sede.nombre}` : ""}
    </option>
  );
})}
  </select>
</div>
            <Campo label="Estado físico" name="estado_fisico" value={campos.estado_fisico} onChange={handleCampo} />
            <Campo label="Presión de vapor (kPa)" name="presion_vapor_kPa" value={campos.presion_vapor_kPa} onChange={handleCampo} type="number" />
            <Campo label="Punto de ebullición (°C)" name="punto_ebullicion" value={campos.punto_ebullicion} onChange={handleCampo} type="number" />
            <Campo label="VLA-EC (ppm)" name="vla_ppm" value={campos.vla_ppm} onChange={handleCampo} type="number" />
            <Campo label="VLA-EC (mg/m³)" name="vla_mgm3" value={campos.vla_mgm3} onChange={handleCampo} type="number" />
            <Campo label="Cantidad de uso (L o kg)" name="cantidad_uso" value={campos.cantidad_uso} onChange={handleCampo} type="number" />
            <div>
  <label className="block text-xs font-medium text-gray-600 mb-1">Duración de exposición</label>
  <select
    name="duracion_exposicion"
    value={campos.duracion_exposicion}
    onChange={handleCampo}
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    <option value="">Seleccionar…</option>
    <option value="corta">Corta — menos de 30 min/día</option>
    <option value="media">Media — entre 30 y 120 min/día</option>
    <option value="larga">Larga — más de 120 min/día</option>
  </select>
</div>

<div>
  <label className="block text-xs font-medium text-gray-600 mb-1">Frecuencia de uso</label>
  <select
    name="frecuencia_uso"
    value={campos.frecuencia_uso}
    onChange={handleCampo}
    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
  >
    <option value="">Seleccionar…</option>
    <option value="diaria">Diaria — todos los días</option>
    <option value="semanal">Semanal — 2 a 3 veces por semana</option>
    <option value="ocasional">Ocasional — menos de una vez por semana</option>
    <option value="esporadica">Esporádica — pocas veces al año</option>
  </select>
</div>
          </div>

          {/* Piel */}
          <div className="border-t pt-4 space-y-3">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" name="contacto_piel" checked={campos.contacto_piel} onChange={handleCampo} />
              Hay contacto con piel
            </label>
            {campos.contacto_piel && (
  <div className="grid grid-cols-2 gap-4">
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Área de contacto</label>
      <select
        name="area_contacto"
        value={campos.area_contacto}
        onChange={handleCampo}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">Seleccionar…</option>
        <option value="pequeña">Pequeña — salpicaduras ocasionales</option>
        <option value="mediana">Mediana — manos en contacto</option>
        <option value="grande">Grande — manos y brazos expuestos</option>
      </select>
    </div>
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">Duración de contacto</label>
      <select
        name="duracion_contacto"
        value={campos.duracion_contacto}
        onChange={handleCampo}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">Seleccionar…</option>
        <option value="corta">Corta — menos de 15 min/día</option>
        <option value="larga">Larga — 15 min o más por día</option>
      </select>
    </div>
  </div>
)}
          </div>
        </div>
{/* Nanomateriales */}
<SeccionNanomateriales value={nanoData} onChange={setNanoData} />

        {/* Error */}
        {error && (
          <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
            {error}
          </div>
        )}

        {/* Botón evaluar */}
        <button
          onClick={handleEvaluar}
          disabled={evaluando || !campos.nombre}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-xl text-sm transition disabled:opacity-50"
        >
          {evaluando ? "Evaluando riesgo..." : "Evaluar y Guardar"}
        </button>

        {/* Resultado */}
        {resultado && <ResultadoEvaluacion data={resultado} />}
      </div>
    </div>
  );
}

// ─── Componente Campo ────────────────────────────────────────────────────────
function Campo({ label, name, value, onChange, type = "text" }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
    </div>
  );
}

// ─── Componente Resultado ────────────────────────────────────────────────────
function ResultadoEvaluacion({ data }) {
  const nivelPiel = { bajo: 1, medio: 2, alto: 3, "muy alto": 4 };
  const etiquetas = { 1: "Bajo", 2: "Moderado", 3: "Alto", 4: "Muy Alto" };
  const bgMap = {
    1: "bg-green-100 text-green-700",
    2: "bg-yellow-100 text-yellow-700",
    3: "bg-orange-100 text-orange-700",
    4: "bg-red-100 text-red-700",
  };

  const nivelInhalacion = data.inhalacion?.nivel;
  const nivelPielNum    = nivelPiel[data.piel?.nivel] || data.piel?.nivel;
  const nivelFuego      = data.fuego?.serie ? 2 : null;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 space-y-4">
      <h2 className="font-semibold text-gray-700">3. Resultado de Evaluación</h2>

      <div className="grid grid-cols-2 gap-4">
        {data.inhalacion && (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Inhalación</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${bgMap[nivelInhalacion] || "bg-gray-100 text-gray-700"}`}>
              Nivel {nivelInhalacion} — {etiquetas[nivelInhalacion] || nivelInhalacion}
            </span>
            <p className="text-xs text-gray-400 mt-1">HG: {data.inhalacion.hg}</p>
            <p className="text-xs text-gray-500 mt-1">{data.inhalacion.descripcion}</p>
          </div>
        )}

        {data.piel && (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Piel</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${bgMap[nivelPielNum] || "bg-gray-100 text-gray-700"}`}>
              {data.piel.nivel?.charAt(0).toUpperCase() + data.piel.nivel?.slice(1)}
            </span>
            <p className="text-xs text-gray-400 mt-1">HG: {data.piel.hgPiel}</p>
            <p className="text-xs text-gray-500 mt-1">{data.piel.descripcion}</p>
          </div>
        )}

        {data.fuego && (
          <div className="border border-gray-100 rounded-xl p-4">
            <p className="text-xs text-gray-500 mb-1">Fuego/Explosión</p>
            <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${bgMap[nivelFuego]}`}>
              Serie {data.fuego.serie}
            </span>
            <p className="text-xs text-gray-400 mt-1">Grupo: {data.fuego.grupoPC}</p>
            <p className="text-xs text-gray-500 mt-1">{data.fuego.descripcion}</p>
          </div>
        )}
      </div>
{data.nano && (
  <div className="border border-gray-100 rounded-xl p-4">
    <p className="text-xs text-gray-500 mb-1">Nanomateriales</p>
    <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${
      data.nano.cl <= 2 ? "bg-green-100 text-green-700" :
      data.nano.cl === 3 ? "bg-yellow-100 text-yellow-700" :
      data.nano.cl === 4 ? "bg-orange-100 text-orange-700" :
      "bg-red-100 text-red-700"
    }`}>
      CL{data.nano.cl}
    </span>
    <p className="text-xs text-gray-400 mt-1">HB final: {data.nano.hbFinal} · EP: {data.nano.epFinal}</p>
    <p className="text-xs text-gray-500 mt-1">{data.nano.descripcion}</p>
  </div>
)}

      {/* EPP — Guantes */}
{data.epp && (
  <div className="border border-gray-100 rounded-xl p-4 col-span-2">
    <p className="text-xs text-gray-500 mb-3">
      Selección de guantes — <span className="font-medium">{data.epp.norma}</span>
      {" · "}Sustancia tipo: <span className="font-medium capitalize">{data.epp.tipo_sustancia}</span>
    </p>
    <div className="flex flex-wrap gap-2">
      {Object.entries(data.epp.compatibilidad).map(([material, nivel]) => {
        const colores = {
          apto:     "bg-green-100 text-green-700 border-green-200",
          limitado: "bg-yellow-100 text-yellow-700 border-yellow-200",
          no_apto:  "bg-red-100 text-red-700 border-red-200",
        };
        const etiquetas = {
          apto:     "✓ Apto",
          limitado: "⚠ Limitado",
          no_apto:  "✕ No apto",
        };
        return (
          <div key={material}
            className={`border rounded-lg px-3 py-2 text-xs font-medium ${colores[nivel]}`}>
            <div className="font-bold capitalize">{material}</div>
            <div>{etiquetas[nivel]}</div>
          </div>
        );
      })}
    </div>
    {data.epp.recomendado && (
      <p className="text-xs text-gray-500 mt-3">
        Recomendado: <span className="font-bold text-green-700 capitalize">{data.epp.recomendado}</span>
        {data.epp.alternativas?.length > 0 && (
          <span> · Alternativas: <span className="capitalize">{data.epp.alternativas.join(", ")}</span></span>
        )}
      </p>
    )}
  </div>
)}  
      {data.requiere_asesor && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-xl">
          ⚠️ Esta sustancia requiere evaluación por asesor especializado.
        </div>
      )}
{/* EPR — Protección Respiratoria */}
{data.epr && (
  <div className="border border-gray-100 rounded-xl p-4 col-span-2">
    <p className="text-xs text-gray-500 mb-1">
      Protección respiratoria — <span className="font-medium">{data.epr.norma}</span>
    </p>
    <div className="flex flex-wrap gap-4 items-start mb-3">
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-center">
        <p className="text-xs text-blue-600 font-bold">Filtro / Cartucho</p>
        <p className="text-2xl font-bold text-blue-800">{data.epr.denominacion}</p>
      </div>
      <div className="flex-1">
        <p className="text-sm font-semibold text-gray-700">{data.epr.equipo?.tipo}</p>
        <p className="text-xs text-gray-500">{data.epr.equipo?.clase}</p>
        <p className="text-xs text-gray-500 mt-1">{data.epr.equipo?.descripcion}</p>
      </div>
    </div>
    {data.epr.advertencias?.length > 0 && (
      <div className="space-y-1">
        {data.epr.advertencias.map((a, i) => (
          <p key={i} className="text-xs text-yellow-700 bg-yellow-50 border border-yellow-200 px-3 py-1.5 rounded">
            ⚠ {a}
          </p>
        ))}
      </div>
    )}
  </div>
)}
      <p className="text-xs text-gray-400">✅ Sustancia guardada en Firestore</p>
    </div>
  );
}
