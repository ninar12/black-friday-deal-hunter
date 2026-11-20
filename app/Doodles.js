// Hand-drawn style bakery doodles used around the site.
const C = { cocoa: "#3f261c", berry: "#d9435a", butter: "#f4d58d", pink: "#f8d7dd", mint: "#bfe0ca", cream: "#fffdf9", crumb: "#e9c9a0" };
const line = { stroke: C.cocoa, strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" };

function Face({ x, y, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <circle cx="-9" cy="0" r="2.6" fill={C.cocoa} />
      <circle cx="9" cy="0" r="2.6" fill={C.cocoa} />
      <path d="M-5 5 Q0 10 5 5" fill="none" {...line} strokeWidth="2.5" />
      <circle cx="-15" cy="6" r="3.5" fill={C.berry} opacity=".35" />
      <circle cx="15" cy="6" r="3.5" fill={C.berry} opacity=".35" />
    </g>
  );
}

// Cupcake holding a magnifying glass: the deal hunter.
export function HunterCupcake({ size = 120, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 120 120" aria-hidden="true">
      <path d="M30 66 L38 108 H82 L90 66 Z" fill={C.butter} {...line} />
      <path d="M46 68 L50 106 M60 68 V106 M74 68 L70 106" {...line} strokeWidth="2" />
      <path d="M24 66 C14 62 18 46 30 46 C28 32 46 26 52 34 C56 22 76 22 78 36 C92 30 102 44 92 52 C102 56 98 70 86 68 Z" fill={C.pink} {...line} />
      <circle cx="60" cy="22" r="7" fill={C.berry} {...line} />
      <path d="M60 15 Q64 6 70 6" fill="none" {...line} strokeWidth="2.5" />
      <g strokeWidth="3" strokeLinecap="round">
        <path d="M38 52 l4 -3" stroke={C.berry} /><path d="M70 44 l4 2" stroke="#6fb38a" />
        <path d="M54 46 l-2 4" stroke={C.butter} /><path d="M82 56 l3 -3" stroke="#6fb38a" />
      </g>
      <Face x={60} y={84} s={0.9} />
      <circle cx="100" cy="90" r="11" fill={C.cream} {...line} />
      <path d="M92 98 L84 106" {...line} strokeWidth="4" />
      <path d="M96 85 Q99 82 103 84" fill="none" stroke={C.mint} strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

// A happy cookie wearing a price tag.
export function TagCookie({ size = 100, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="46" cy="56" r="34" fill={C.crumb} {...line} />
      <g fill={C.cocoa}>
        <ellipse cx="30" cy="42" rx="4" ry="3" /><ellipse cx="62" cy="38" rx="3.5" ry="3" />
        <ellipse cx="66" cy="70" rx="4" ry="3" /><ellipse cx="28" cy="72" rx="3" ry="2.5" />
      </g>
      <Face x={46} y={56} s={0.85} />
      <path d="M70 26 L88 12" {...line} strokeWidth="2" />
      <path d="M84 4 h14 v18 l-7 6 l-7 -6 Z" fill={C.berry} {...line} strokeWidth="2.5" transform="rotate(20 91 16)" />
      <text x="91" y="19" fontSize="9" fontWeight="800" fill="#fff" textAnchor="middle" fontFamily="Inter, sans-serif" transform="rotate(20 91 16)">%</text>
    </svg>
  );
}

// Slice of pie for empty states.
export function PieSlice({ size = 90, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <path d="M12 70 L88 70 L76 36 Z" fill={C.berry} {...line} />
      <path d="M10 70 Q50 92 90 70 L88 80 Q50 100 12 80 Z" fill={C.butter} {...line} />
      <path d="M76 36 Q66 26 54 34 Q44 26 34 40 L12 70" fill="none" {...line} />
      <path d="M30 22 q4 -6 0 -12 M44 18 q4 -6 0 -12" fill="none" stroke={C.cocoa} strokeWidth="2.5" strokeLinecap="round" opacity=".5" />
      <Face x={50} y={78} s={0.7} />
    </svg>
  );
}

// Donut for the footer.
export function Donut({ size = 56, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="52" r="38" fill={C.crumb} {...line} />
      <path d="M18 46 C20 22 80 20 84 46 C86 60 70 54 64 62 C56 70 42 58 34 64 C24 70 16 58 18 46 Z" fill={C.pink} {...line} strokeWidth="2.5" />
      <circle cx="50" cy="48" r="10" fill={C.cream} {...line} />
      <g strokeWidth="3" strokeLinecap="round">
        <path d="M30 38 l4 -2" stroke={C.berry} /><path d="M66 34 l3 3" stroke="#6fb38a" />
        <path d="M70 50 l-2 4" stroke={C.butter} /><path d="M36 54 l3 2" stroke="#6fb38a" />
      </g>
    </svg>
  );
}

// Tiny sparkle used between sections.
export function Sparkle({ size = 18, color = C.butter, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2 C13 9 15 11 22 12 C15 13 13 15 12 22 C11 15 9 13 2 12 C9 11 11 9 12 2 Z" fill={color} stroke={C.cocoa} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}
