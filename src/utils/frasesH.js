// src/utils/frasesH.js
//
// Texto descriptivo de las indicaciones de peligro H (GHS/CLP) más
// frecuentes en fichas de datos de seguridad de uso industrial. Usado en
// DetalleSustanciaPage.jsx para mostrar el significado junto al código.
// Tabla estática — no cubre el listado completo de frases H, solo las de
// aparición más común en FDS industriales.

export const FRASES_H = {
  // ── Peligros físicos (H200–H290) ──────────────────────────────────────────
  H200: "Explosivos inestables",
  H201: "Explosivo; peligro de explosión en masa",
  H202: "Explosivo; grave peligro de proyección",
  H203: "Explosivo; peligro de incendio, de onda expansiva o de proyección",
  H204: "Peligro de incendio o de proyección",
  H205: "Peligro de explosión en masa en caso de incendio",
  H220: "Gas extremadamente inflamable",
  H221: "Gas inflamable",
  H222: "Aerosol extremadamente inflamable",
  H223: "Aerosol inflamable",
  H224: "Líquido y vapores extremadamente inflamables",
  H225: "Líquido y vapores muy inflamables",
  H226: "Líquidos y vapores inflamables",
  H228: "Sólido inflamable",
  H240: "Peligro de explosión en caso de calentamiento",
  H241: "Peligro de incendio o explosión en caso de calentamiento",
  H242: "Peligro de incendio en caso de calentamiento",
  H250: "Se inflama espontáneamente en contacto con el aire",
  H251: "Se calienta espontáneamente; puede inflamarse",
  H252: "Se calienta espontáneamente en grandes cantidades; puede inflamarse",
  H260: "En contacto con el agua desprende gases inflamables que pueden inflamarse espontáneamente",
  H261: "En contacto con el agua desprende gases inflamables",
  H270: "Puede provocar o agravar un incendio; comburente",
  H271: "Puede provocar un incendio o una explosión; comburente fuerte",
  H272: "Puede agravar un incendio; comburente",
  H280: "Contiene gas a presión; peligro de explosión en caso de calentamiento",
  H281: "Contiene gas refrigerado; puede provocar quemaduras o lesiones criogénicas",
  H290: "Puede ser corrosivo para los metales",

  // ── Peligros para la salud (H300–H373) ────────────────────────────────────
  H300: "Mortal en caso de ingestión",
  H301: "Tóxico en caso de ingestión",
  H302: "Nocivo en caso de ingestión",
  H304: "Puede ser mortal en caso de ingestión y penetración en las vías respiratorias",
  H310: "Mortal en contacto con la piel",
  H311: "Tóxico en contacto con la piel",
  H312: "Nocivo en contacto con la piel",
  H314: "Provoca quemaduras graves en la piel y lesiones oculares graves",
  H315: "Provoca irritación cutánea",
  H317: "Puede provocar una reacción alérgica en la piel",
  H318: "Provoca lesiones oculares graves",
  H319: "Provoca irritación ocular grave",
  H330: "Mortal en caso de inhalación",
  H331: "Tóxico en caso de inhalación",
  H332: "Nocivo en caso de inhalación",
  H334: "Puede provocar síntomas de alergia o asma o dificultades respiratorias en caso de inhalación",
  H335: "Puede irritar las vías respiratorias",
  H336: "Puede provocar somnolencia o vértigo",
  H340: "Puede provocar defectos genéticos",
  H341: "Se sospecha que provoca defectos genéticos",
  H350: "Puede provocar cáncer",
  H351: "Se sospecha que provoca cáncer",
  H360: "Puede perjudicar la fertilidad o dañar al feto",
  H361: "Se sospecha que perjudica la fertilidad o daña al feto",
  H370: "Provoca daños en los órganos",
  H371: "Puede provocar daños en los órganos",
  H372: "Provoca daños en los órganos tras exposiciones prolongadas o repetidas",
  H373: "Puede provocar daños en los órganos tras exposiciones prolongadas o repetidas",

  // ── Peligros para el medio ambiente (H400–H413) ───────────────────────────
  H400: "Muy tóxico para los organismos acuáticos",
  H410: "Muy tóxico para los organismos acuáticos, con efectos nocivos duraderos",
  H411: "Tóxico para los organismos acuáticos, con efectos nocivos duraderos",
  H412: "Nocivo para los organismos acuáticos, con efectos nocivos duraderos",
  H413: "Puede ser nocivo para los organismos acuáticos, con efectos nocivos duraderos",

  // ── Declaraciones suplementarias (EUH) ────────────────────────────────────
  // Usadas también por el módulo de compatibilidad de almacenamiento
  // (src/utils/almacenamiento.js) para detectar liberación de gas con ácidos.
  EUH031: "En contacto con ácidos libera gases tóxicos",
  EUH032: "En contacto con ácidos libera gases muy tóxicos",
};

export function descripcionFraseH(codigo) {
  return FRASES_H[codigo] || null;
}
