// Monoline illustration for the hero: shopping bags with a swinging sale tag.
export function BagsAndTag({ className = "" }) {
  const ink = { stroke: "#3f261c", strokeWidth: 2.4, strokeLinecap: "round", strokeLinejoin: "round", fill: "none" };
  return (
    <svg className={className} width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
      {/* back bag */}
      <path d="M62 52 H118 L124 128 H56 Z" {...ink} fill="#efe4d3" />
      <path d="M76 52 C76 36 104 36 104 52" {...ink} />
      {/* front bag */}
      <path d="M26 66 H90 L96 136 H20 Z" {...ink} fill="#fffdf9" />
      <path d="M42 66 C42 46 74 46 74 66" {...ink} />
      <path d="M34 92 H82" {...ink} strokeWidth="1.6" opacity=".35" />
      <text x="58" y="116" textAnchor="middle" fontFamily="Fraunces, Georgia, serif" fontWeight="700" fontSize="17" fill="#3f261c">BF</text>
      {/* swinging tag */}
      <g className="swing-tag">
        <path d="M104 52 L118 22" {...ink} strokeWidth="1.6" />
        <path d="M110 14 L138 20 L134 44 L108 48 L104 24 Z" fill="#b8324a" stroke="#3f261c" strokeWidth="2.2" strokeLinejoin="round" />
        <circle cx="111" cy="22" r="2.4" fill="#fffdf9" />
        <text x="122" y="38" textAnchor="middle" fontFamily="Inter, sans-serif" fontWeight="700" fontSize="12" fill="#fffdf9" transform="rotate(8 122 34)">%</text>
      </g>
      {/* sparkles */}
      <path d="M16 30 v10 M11 35 h10" {...ink} strokeWidth="2" />
      <path d="M136 82 v8 M132 86 h8" {...ink} strokeWidth="2" opacity=".6" />
    </svg>
  );
}
