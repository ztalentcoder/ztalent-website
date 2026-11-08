export default function HeroIllustration() {
  return (
    <svg
      className="hero-illustration"
      viewBox="0 0 480 340"
      role="img"
      aria-label="Illustration of connected computer, data, and AI tools"
    >
      <circle cx="250" cy="175" r="150" fill="#1e90e8" opacity=".2" />
      <rect x="14" y="274" width="452" height="8" rx="4" fill="#fff" opacity=".28" />
      <rect x="125" y="52" width="240" height="165" rx="12" fill="#06152b" stroke="#2a6bb3" strokeWidth="3" />
      <g transform="translate(140 66)">
        <rect width="210" height="137" rx="6" fill="#0d2a52" />
        <rect x="12" y="14" width="70" height="7" rx="3" fill="#1e90e8" />
        <rect x="26" y="30" width="110" height="7" rx="3" fill="#fff" opacity=".85" />
        <rect x="26" y="46" width="85" height="7" rx="3" fill="#7cc0f5" />
        <rect x="40" y="62" width="120" height="7" rx="3" fill="#fff" opacity=".6" />
        <rect x="26" y="78" width="60" height="7" rx="3" fill="#1e90e8" />
        <rect x="12" y="94" width="95" height="7" rx="3" fill="#fff" opacity=".85" />
        <rect x="12" y="110" width="45" height="7" rx="3" fill="#7cc0f5" />
      </g>
      <rect x="235" y="217" width="20" height="40" fill="#2a6bb3" />
      <rect x="198" y="255" width="94" height="14" rx="7" fill="#2a6bb3" />
      <g transform="translate(18 150)">
        <rect x="8" width="112" height="74" rx="6" fill="#06152b" stroke="#2a6bb3" strokeWidth="3" />
        <rect x="16" y="8" width="96" height="58" rx="3" fill="#0d2a52" />
        <g transform="translate(22 14) scale(.42)">
          <polyline points="12,108 50,84 88,96 126,52 164,64 198,26" fill="none" stroke="#4db0ff" strokeWidth="5" strokeLinejoin="round" />
          <circle cx="198" cy="26" r="6" fill="#fff" />
          <rect x="12" y="116" width="186" height="4" rx="2" fill="#fff" opacity=".3" />
          <rect x="12" y="12" width="40" height="7" rx="3" fill="#fff" opacity=".7" />
        </g>
        <path d="M0 84h128l-8 16H8Z" fill="#2a6bb3" />
      </g>
      <rect x="388" y="150" width="52" height="98" rx="10" fill="#06152b" stroke="#2a6bb3" strokeWidth="3" />
      <rect x="396" y="164" width="36" height="9" rx="3" fill="#1e90e8" />
      <rect x="396" y="180" width="36" height="22" rx="3" fill="#fff" opacity=".4" />
      <rect x="396" y="210" width="26" height="6" rx="3" fill="#7cc0f5" />
      <g transform="translate(410 70)">
        <circle r="27" fill="#1e90e8" stroke="#fff" strokeWidth="3" />
        <text textAnchor="middle" dy=".35em" fill="#fff" fontWeight="800" fontSize="15" fontFamily="Sora, sans-serif" />
      </g>
      <g transform="translate(72 86)">
        <circle r="27" fill="#1e90e8" stroke="#fff" strokeWidth="3" />
        <text textAnchor="middle" dy=".35em" fill="#fff" fontWeight="800" fontSize="15" fontFamily="Sora, sans-serif">AI</text>
      </g>
      <g transform="translate(420 272)">
        <circle r="27" fill="#1e90e8" stroke="#fff" strokeWidth="3" />
        <text textAnchor="middle" dy=".35em" fill="#fff" fontWeight="800" fontSize="15" fontFamily="Sora, sans-serif">{'{ }'}</text>
      </g>
    </svg>
  );
}
