// src/utils/emergencia.js
//
// Deriva el/los tipo(s) de emergencia química probable a partir de los
// mismos grupos de peligro que ya calcula clasificarAlmacenamiento()
// (utils/almacenamiento.js), y expone la tabla estática de acciones
// inmediatas de respuesta por tipo. Reutiliza esa clasificación en vez de
// volver a parsear pictogramas/frases H, para no duplicar el criterio de
// qué hace a una sustancia inflamable, tóxica o corrosiva.

import { clasificarAlmacenamiento } from "./almacenamiento";

export const TIPO_EMERGENCIA_LABEL = {
  incendio: "Riesgo de incendio",
  fuga_toxica: "Riesgo de fuga / exposición tóxica",
  derrame_corrosivo: "Riesgo de derrame corrosivo",
};

const ACCIONES_BASE = {
  incendio: [
    "Evacúe el área y active la alarma de emergencia.",
    "Corte la fuente de ignición y el suministro eléctrico si es seguro hacerlo.",
    "Use extintor de polvo químico seco o CO2 solo si el fuego es incipiente y usted está entrenado.",
    "Aleje otros materiales inflamables u oxidantes cercanos al foco del incendio.",
    "Llame a la línea de emergencia 123 si el fuego no se controla de inmediato.",
  ],
  fuga_toxica: [
    "Evacúe y ventile el área de inmediato; no respire los vapores o gases.",
    "Use el equipo de protección respiratoria (EPR) recomendado antes de intervenir.",
    "Aísle la zona y restrinja el acceso a personal no autorizado.",
    "Si hay exposición (inhalación, ingestión o contacto), traslade a la persona a un área ventilada y busque atención médica de inmediato.",
    "Contacte a CISPROQUIM (01 8000 916012) para orientación toxicológica.",
  ],
  derrame_corrosivo: [
    "Use EPP químico completo (guantes, gafas y protección corporal) antes de aproximarse al derrame.",
    "Contenga el derrame con material absorbente inerte; no lo lave con agua a menos que la FDS lo indique.",
    "Ventile el área y evite el contacto directo con piel y ojos.",
    "Recoja y disponga el material como residuo peligroso según el procedimiento de la FDS.",
    "En caso de contacto con piel u ojos, lave con agua abundante durante al menos 15 minutos y busque atención médica.",
  ],
};

/**
 * Devuelve los tipos de emergencia probables para una sustancia (puede ser
 * más de uno, p. ej. un ácido oxidante), con sus acciones inmediatas.
 * Cada tipo incluye, cuando aplica, advertencias específicas derivadas de
 * datos ya calculados por clasificarAlmacenamiento (reactivo al agua,
 * libera gas tóxico en contacto con ácidos).
 */
export function derivarEmergencias(fds = {}) {
  const { grupos, liberaGasConAcidos } = clasificarAlmacenamiento(fds);
  const tipos = [];

  if (grupos.includes("inflamable")) {
    const acciones = [...ACCIONES_BASE.incendio];
    if (grupos.includes("reactivo_agua")) {
      acciones.push("No use agua para apagar: esta sustancia reacciona con el agua liberando gases peligrosos.");
    }
    tipos.push({ tipo: "incendio", label: TIPO_EMERGENCIA_LABEL.incendio, acciones });
  }

  if (grupos.includes("toxico")) {
    tipos.push({ tipo: "fuga_toxica", label: TIPO_EMERGENCIA_LABEL.fuga_toxica, acciones: [...ACCIONES_BASE.fuga_toxica] });
  }

  if (grupos.includes("acido") || grupos.includes("base")) {
    const acciones = [...ACCIONES_BASE.derrame_corrosivo];
    if (liberaGasConAcidos) {
      acciones.push("No mezcle con otros químicos derramados: libera gases tóxicos en contacto con ácidos.");
    }
    tipos.push({ tipo: "derrame_corrosivo", label: TIPO_EMERGENCIA_LABEL.derrame_corrosivo, acciones });
  }

  return tipos;
}
