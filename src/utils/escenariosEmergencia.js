// src/utils/escenariosEmergencia.js
//
// Motor de sugerencias para el Módulo de Escenarios de Emergencia.
// No reimplementa criterios de peligrosidad: reutiliza clasificarAlmacenamiento
// y evaluarCompatibilidad de utils/almacenamiento.js para las incompatibilidades
// entre sustancias del área, y derivarEmergencias de utils/emergencia.js para
// el tipo de emergencia y las acciones base por sustancia individual.

import { clasificarAlmacenamiento, evaluarCompatibilidad } from "./almacenamiento";
import { derivarEmergencias, TIPO_EMERGENCIA_LABEL } from "./emergencia";

export const TIPO_ICONO = {
  incendio: "🔥",
  fuga_toxica: "☠️",
  derrame_corrosivo: "🧪",
};

// Bridge grupo de almacenamiento → tipo de emergencia, usado solo para saber
// en qué escenario(s) anotar una incompatibilidad cruzada "peligro" detectada
// entre dos sustancias del área (no repite la matriz de almacenamiento.js,
// solo indica a qué tipo de plan de respuesta pertenece cada grupo).
const GRUPO_A_TIPO = {
  inflamable: "incendio",
  oxidante: "incendio",
  reactivo_agua: "incendio",
  gas: "fuga_toxica",
  toxico: "fuga_toxica",
  acido: "derrame_corrosivo",
  base: "derrame_corrosivo",
};

/**
 * Sugiere borradores de escenario de emergencia para un conjunto de
 * sustancias de una misma área. Cada sustancia debe traer al menos
 * { id, cas, nombre, fds }.
 *
 * Devuelve un array de { tipo, label, icono, sustanciasInvolucradas, pasos },
 * uno por cada tipo de emergencia detectado en el área (como máximo uno de
 * cada uno de incendio / fuga_toxica / derrame_corrosivo).
 */
export function sugerirEscenarios(sustancias = []) {
  const buckets = {}; // tipo -> { acciones: string[], cas: Set<string> }

  function bucket(tipo) {
    if (!buckets[tipo]) buckets[tipo] = { acciones: [], cas: new Set() };
    return buckets[tipo];
  }
  function agregarAcciones(b, acciones) {
    for (const a of acciones) if (!b.acciones.includes(a)) b.acciones.push(a);
  }

  // 1) Emergencias derivadas por sustancia individual.
  for (const s of sustancias) {
    const emergencias = derivarEmergencias(s.fds);
    for (const e of emergencias) {
      const b = bucket(e.tipo);
      agregarAcciones(b, e.acciones);
      b.cas.add(s.cas || s.id);
    }
  }

  // 2) Incompatibilidades cruzadas "peligro" entre pares de sustancias del
  //    área — refuerzan la sugerencia y agregan una advertencia específica.
  for (let i = 0; i < sustancias.length; i++) {
    const clasifA = clasificarAlmacenamiento(sustancias[i].fds);
    for (let j = i + 1; j < sustancias.length; j++) {
      const clasifB = clasificarAlmacenamiento(sustancias[j].fds);
      const compat = evaluarCompatibilidad(clasifA, clasifB);
      if (compat.nivel !== "peligro") continue;

      const tiposAfectados = new Set(
        [...clasifA.grupos, ...clasifB.grupos]
          .map(g => GRUPO_A_TIPO[g])
          .filter(Boolean)
      );
      const advertencia = `⚠ Riesgo de reacción: ${sustancias[i].nombre} + ${sustancias[j].nombre} (${compat.motivos.join(" · ")}). No almacenar ni manipular juntas.`;

      for (const tipo of tiposAfectados) {
        const b = bucket(tipo);
        agregarAcciones(b, [advertencia]);
        b.cas.add(sustancias[i].cas || sustancias[i].id);
        b.cas.add(sustancias[j].cas || sustancias[j].id);
      }
    }
  }

  return Object.entries(buckets).map(([tipo, b]) => ({
    tipo,
    label: TIPO_EMERGENCIA_LABEL[tipo],
    icono: TIPO_ICONO[tipo],
    sustanciasInvolucradas: [...b.cas],
    pasos: b.acciones.map((accion, i) => ({ orden: i + 1, accion, responsable: "" })),
  }));
}
