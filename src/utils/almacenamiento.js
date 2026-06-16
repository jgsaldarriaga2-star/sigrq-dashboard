// src/utils/almacenamiento.js
//
// Clasificación de sustancias en grupos de almacenamiento y matriz de
// compatibilidad, derivadas de los datos ya extraídos de la FDS
// (pictogramas GHS, frases H, estado físico). Es independiente de
// evaluacion.epp.tipo_sustancia a propósito: ese campo solo guarda UN tipo
// por sustancia, y para almacenamiento una sustancia puede pertenecer a
// varios grupos a la vez (p. ej. un ácido oxidante es Ácido Y Oxidante).

export const GRUPOS_LABEL = {
  acido: "Ácidos",
  base: "Bases",
  oxidante: "Oxidantes",
  inflamable: "Inflamables",
  gas: "Gases",
  toxico: "Tóxicos",
  reactivo_agua: "Reactivos al agua",
};

export const NIVEL_LABEL = {
  ok: "Compatible",
  separar: "Mantener separado",
  peligro: "Riesgo de reacción peligrosa",
};

const SEVERIDAD = { ok: 0, separar: 1, peligro: 2 };

// Matriz de compatibilidad entre grupos de almacenamiento.
// Simplificación de primera versión: dentro de un mismo grupo se asume
// compatible, salvo Oxidantes y Gases (distintos oxidantes o distintos
// tipos de gas entre sí pueden tener incompatibilidades específicas que
// esta matriz todavía no distingue). Editar aquí si se ajusta el criterio.
const MATRIZ = {
  acido:         { acido: "ok",      base: "peligro", oxidante: "peligro", inflamable: "separar", gas: "separar", toxico: "separar", reactivo_agua: "peligro" },
  base:          { acido: "peligro", base: "ok",      oxidante: "separar", inflamable: "separar", gas: "separar", toxico: "separar", reactivo_agua: "peligro" },
  oxidante:      { acido: "peligro", base: "separar", oxidante: "separar", inflamable: "peligro",  gas: "separar", toxico: "separar", reactivo_agua: "separar" },
  inflamable:    { acido: "separar", base: "separar", oxidante: "peligro", inflamable: "ok",       gas: "separar", toxico: "separar", reactivo_agua: "peligro" },
  gas:           { acido: "separar", base: "separar", oxidante: "separar", inflamable: "separar",  gas: "separar", toxico: "separar", reactivo_agua: "separar" },
  toxico:        { acido: "separar", base: "separar", oxidante: "separar", inflamable: "separar",  gas: "separar", toxico: "ok",      reactivo_agua: "separar" },
  reactivo_agua: { acido: "peligro", base: "peligro", oxidante: "separar", inflamable: "peligro",  gas: "separar", toxico: "separar", reactivo_agua: "ok" },
};

/**
 * Clasifica una sustancia en sus grupos de almacenamiento a partir de los
 * datos ya extraídos de la FDS. Una sustancia puede pertenecer a varios
 * grupos a la vez (devuelve un arreglo, no un único valor).
 */
export function clasificarAlmacenamiento(fds = {}) {
  const pictogramas = fds.pictogramas_ghs || [];
  const todasFrases = [...(fds.frases_h || []), ...(fds.frases_h_fisicoquimicas || [])];
  const grupos = [];

  const esCorrosivo = pictogramas.includes("corrosion");
  const esAcido = esCorrosivo && todasFrases.some((f) => ["H314", "EUH031", "EUH032"].includes(f));
  if (esAcido) grupos.push("acido");
  if (esCorrosivo && !esAcido) grupos.push("base");
  if (pictogramas.includes("oxidante")) grupos.push("oxidante");
  if (pictogramas.includes("llama")) grupos.push("inflamable");
  if (pictogramas.includes("gas_presion") || fds.estado_fisico === "gas") grupos.push("gas");
  if (pictogramas.includes("calavera") || pictogramas.includes("salud")) grupos.push("toxico");
  if (todasFrases.includes("H260") || todasFrases.includes("H261")) grupos.push("reactivo_agua");

  return {
    grupos,
    // EUH031/EUH032: "en contacto con ácidos libera gases (muy) tóxicos".
    // Se trata aparte de la matriz porque el riesgo es agudo y específico
    // contra cualquier ácido, no una simple recomendación de "separar".
    liberaGasConAcidos: todasFrases.includes("EUH031") || todasFrases.includes("EUH032"),
  };
}

/**
 * Evalúa la compatibilidad de almacenamiento entre dos sustancias ya
 * clasificadas (salida de clasificarAlmacenamiento). Devuelve el nivel más
 * restrictivo encontrado entre todos los pares de grupos, más el detalle
 * de qué combinación lo causó.
 */
export function evaluarCompatibilidad(a, b) {
  if (!a?.grupos?.length || !b?.grupos?.length) return { nivel: "ok", motivos: [] };

  let nivel = "ok";
  const motivos = [];

  for (const ga of a.grupos) {
    for (const gb of b.grupos) {
      const n = MATRIZ[ga]?.[gb] ?? "separar";
      if (n !== "ok") {
        motivos.push(`${GRUPOS_LABEL[ga]} + ${GRUPOS_LABEL[gb]}`);
        if (SEVERIDAD[n] > SEVERIDAD[nivel]) nivel = n;
      }
    }
  }

  if ((a.liberaGasConAcidos && b.grupos.includes("acido")) ||
      (b.liberaGasConAcidos && a.grupos.includes("acido"))) {
    nivel = "peligro";
    motivos.unshift("Libera gas tóxico en contacto con ácidos (EUH031/EUH032)");
  }

  return { nivel, motivos: [...new Set(motivos)] };
}
