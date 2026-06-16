// src/components/PictogramaGHS.jsx
//
// Pictogramas GHS (Sistema Globalmente Armonizado) dibujados en SVG.
// Son símbolos regulatorios estandarizados internacionalmente (rombo rojo,
// fondo blanco, símbolo negro) y no tienen restricción de uso ni de licencia.

export const PICTOGRAMA_LABEL = {
  llama: "Inflamable",
  oxidante: "Oxidante",
  corrosion: "Corrosivo",
  calavera: "Tóxico agudo",
  salud: "Peligro para la salud",
  exclamacion: "Irritante / Nocivo",
  gas_presion: "Gas a presión",
  medio_ambiente: "Peligroso para el medio ambiente",
};

// Qué pictogramas se muestran junto a cada bloque de evaluación.
// Editar este objeto si se quiere cambiar el criterio de relevancia.
export const PICTOGRAMA_RELEVANCIA = {
  inhalacion: ["calavera", "salud", "exclamacion"],
  piel: ["corrosion", "exclamacion", "calavera"],
  fuego: ["llama", "oxidante", "gas_presion"],
};

const COLOR_BORDE = "#DC2626"; // red-600, consistente con la paleta de la app

function Glifo({ tipo }) {
  switch (tipo) {
    case "llama":
      return (
        <path
          d="M50 26 C58 36 64 44 64 54 C64 66 58 74 50 78 C42 74 36 66 36 54 C36 47 39 41 43 36 C44 43 47 47 51 49 C53 42 51 33 50 26 Z"
          fill="#000"
        />
      );
    case "oxidante":
      return (
        <g fill="#000">
          <circle cx="50" cy="68" r="11" />
          <path d="M50 24 C56 33 60 40 60 49 C60 58 56 65 50 68 C44 65 40 58 40 49 C40 43 43 38 46 34 C47 40 49 43 52 45 C53 39 51 31 50 24 Z" />
        </g>
      );
    case "corrosion":
      return (
        <g fill="#000">
          <rect x="26" y="24" width="9" height="22" rx="2" transform="rotate(-25 30 35)" />
          <rect x="58" y="22" width="9" height="24" rx="2" transform="rotate(20 62 34)" />
          <circle cx="33" cy="50" r="2.2" />
          <circle cx="37" cy="55" r="1.8" />
          <circle cx="65" cy="48" r="2.2" />
          <path d="M22 62 H48 C48 68 43 72 36 72 H22 Z" />
          <path d="M56 60 Q62 67 70 67 Q76 67 78 61 L78 72 L56 72 Z" />
        </g>
      );
    case "calavera":
      return (
        <g>
          <circle cx="50" cy="42" r="18" fill="#000" />
          <circle cx="43" cy="40" r="4.2" fill="#fff" />
          <circle cx="57" cy="40" r="4.2" fill="#fff" />
          <path d="M46 50 L50 55 L54 50" stroke="#fff" strokeWidth="2.4" fill="none" />
          <rect x="41" y="55" width="18" height="5" rx="2" fill="#000" />
          <line x1="28" y1="68" x2="72" y2="80" stroke="#000" strokeWidth="5" />
          <line x1="72" y1="68" x2="28" y2="80" stroke="#000" strokeWidth="5" />
        </g>
      );
    case "salud":
      return (
        <g fill="#000">
          <circle cx="50" cy="32" r="10" />
          <path d="M33 72 C33 55 40 47 50 47 C60 47 67 55 67 72 Z" />
          <path
            d="M50 50 L53 58 L62 60 L54 65 L56 75 L50 69 L44 75 L46 65 L38 60 L47 58 Z"
            fill="#fff"
          />
        </g>
      );
    case "exclamacion":
      return (
        <g fill="#000">
          <rect x="46" y="26" width="8" height="30" rx="3" />
          <circle cx="50" cy="66" r="5" />
        </g>
      );
    case "gas_presion":
      return (
        <g fill="#000">
          <rect x="38" y="38" width="24" height="36" rx="6" />
          <rect x="44" y="27" width="12" height="13" rx="2" />
          <rect x="41" y="23" width="18" height="5" rx="1.5" />
        </g>
      );
    case "medio_ambiente":
      return (
        <g stroke="#000" fill="none" strokeWidth="2.6" strokeLinecap="round">
          <path d="M50 26 L50 56" />
          <path d="M50 33 L42 26" />
          <path d="M50 33 L58 26" />
          <path d="M50 42 L43 36" />
          <path d="M50 42 L57 36" />
          <path d="M24 60 H76" strokeWidth="2.2" />
          <path d="M32 60 C36 55 44 55 48 60 C44 65 36 65 32 60 Z" fill="#000" stroke="none" />
          <path d="M48 60 L54 55 L54 65 Z" fill="#000" stroke="none" />
        </g>
      );
    default:
      return null;
  }
}

/** Un único pictograma GHS (rombo rojo + símbolo negro). */
export function GHSPictograma({ tipo, size = 22, className = "" }) {
  const label = PICTOGRAMA_LABEL[tipo] || tipo;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={label}
      className={`inline-block align-middle flex-shrink-0 ${className}`}
    >
      <title>{label}</title>
      <rect
        x="18"
        y="18"
        width="64"
        height="64"
        rx="2"
        transform="rotate(45 50 50)"
        fill="#fff"
        stroke={COLOR_BORDE}
        strokeWidth="6"
      />
      <Glifo tipo={tipo} />
    </svg>
  );
}

/**
 * Fila de pictogramas relevantes para una categoría de evaluación
 * (inhalacion | piel | fuego), filtrados a partir de los pictogramas
 * GHS reales de la sustancia (fds.pictogramas_ghs).
 */
export function PictogramasFiltrados({ pictogramasGhs, categoria, size = 16, className = "" }) {
  const relevantes = (pictogramasGhs || []).filter((p) =>
    PICTOGRAMA_RELEVANCIA[categoria]?.includes(p)
  );
  if (relevantes.length === 0) return null;
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      {relevantes.map((p) => (
        <GHSPictograma key={p} tipo={p} size={size} />
      ))}
    </span>
  );
}

// Palabras de clasificación que, si aparecen como texto exacto (p. ej.
// ev.epp.tipo_sustancia), se acompañan automáticamente del pictograma.
const PALABRA_A_TIPO = {
  corrosivo: "corrosion",
  corrosiva: "corrosion",
  inflamable: "llama",
  oxidante: "oxidante",
  toxico: "calavera",
  "tóxico": "calavera",
  toxica: "calavera",
  "tóxica": "calavera",
  irritante: "exclamacion",
  nocivo: "exclamacion",
  nociva: "exclamacion",
  ecotoxico: "medio_ambiente",
  "ecotóxico": "medio_ambiente",
  ecotoxica: "medio_ambiente",
  "ecotóxica": "medio_ambiente",
};

/** Antepone el pictograma correspondiente si el texto coincide con una palabra de clasificación conocida. */
export function TextoConPictograma({ texto, size = 14 }) {
  if (!texto) return texto;
  const tipo = PALABRA_A_TIPO[texto.toString().trim().toLowerCase()];
  if (!tipo) return texto;
  return (
    <span className="inline-flex items-center gap-1.5">
      <GHSPictograma tipo={tipo} size={size} />
      {texto}
    </span>
  );
}
