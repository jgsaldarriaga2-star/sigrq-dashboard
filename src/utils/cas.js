// src/utils/cas.js
//
// Determina si un valor guardado en fds.numero_cas es en realidad un código
// interno (mezclas/formulaciones propias sin FDS de proveedor, formato
// MIX-{año}-{secuencial} o un código propio de la empresa) en vez de un
// número CAS real, para mostrar la etiqueta correcta en las pantallas donde
// aparece este campo.
//
// Acepta tanto "mezcla_sin_fds" (valor actual) como "mezcla" (valor legado
// de sustancias registradas antes de este cambio) para no romper docs viejos.

export function esCodigoInterno(cas, tipoProducto) {
  return (cas || "").startsWith("MIX-") || tipoProducto === "mezcla_sin_fds" || tipoProducto === "mezcla";
}

export function etiquetaCas(cas, tipoProducto) {
  return esCodigoInterno(cas, tipoProducto) ? "Cód. interno" : "CAS";
}
