import React from 'react';

interface SoniMixLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

export const SoniMixLogo: React.FC<SoniMixLogoProps> = ({
  className = '',
  size = 36,
  showWordmark = false,
}) => {
  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={showWordmark ? (size * 0.9) : size}
        viewBox="0 0 500 450"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <defs>
          <linearGradient id="sm-headband-grad" x1="50" y1="50" x2="450" y2="250" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="50%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="sm-s-grad" x1="150" y1="60" x2="350" y2="300" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="45%" stopColor="#2563eb" />
            <stop offset="100%" stopColor="#1d4ed8" />
          </linearGradient>
          <linearGradient id="sm-bars" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38bdf8" />
            <stop offset="100%" stopColor="#0284c7" />
          </linearGradient>
        </defs>

        {/* Headphone Arc Band */}
        <path
          d="M 125 180 C 125 75, 375 75, 375 180"
          stroke="url(#sm-headband-grad)"
          strokeWidth="28"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 145 175 C 145 95, 355 95, 355 175"
          stroke="#38bdf8"
          strokeWidth="5"
          strokeLinecap="round"
          opacity="0.6"
          fill="none"
        />

        {/* Headphone Left Earcup */}
        <rect x="92" y="160" width="38" height="110" rx="19" fill="url(#sm-headband-grad)" />
        <rect x="99" y="172" width="8" height="86" rx="4" fill="#38bdf8" opacity="0.8" />

        {/* Headphone Right Earcup */}
        <rect x="370" y="160" width="38" height="110" rx="19" fill="url(#sm-headband-grad)" />
        <rect x="393" y="172" width="8" height="86" rx="4" fill="#38bdf8" opacity="0.8" />

        {/* Equalizer Audio Waveform Bars (Top segment inside S) */}
        <g fill="url(#sm-bars)">
          <rect x="200" y="105" width="8" height="70" rx="4" />
          <rect x="216" y="80" width="8" height="110" rx="4" />
          <rect x="232" y="65" width="8" height="135" rx="4" />
          <rect x="248" y="75" width="8" height="120" rx="4" />
          <rect x="264" y="90" width="8" height="95" rx="4" />
          <rect x="280" y="110" width="8" height="65" rx="4" />
        </g>

        {/* Equalizer Audio Waveform Bars (Bottom segment) */}
        <g fill="url(#sm-bars)">
          <rect x="180" y="225" width="7" height="50" rx="3.5" />
          <rect x="195" y="210" width="7" height="85" rx="3.5" />
          <rect x="210" y="220" width="7" height="65" rx="3.5" />
          <rect x="225" y="215" width="7" height="95" rx="3.5" />
          <rect x="240" y="235" width="7" height="65" rx="3.5" />
          <rect x="255" y="240" width="7" height="50" rx="3.5" />
        </g>

        {/* Large Stylized Central "S" */}
        <path
          d="M 315 130
             C 300 70, 205 60, 185 125
             C 170 180, 230 195, 275 220
             C 330 250, 315 320, 240 315
             C 180 310, 170 260, 175 240
             L 190 238
             C 185 270, 210 295, 250 295
             C 295 295, 305 245, 255 220
             C 205 195, 155 170, 170 115
             C 190 50, 305 50, 325 115
             Z"
          fill="url(#sm-s-grad)"
        />

        {/* Top highlight inner curve on S */}
        <path
          d="M 310 115 C 290 65, 205 70, 185 125 C 175 160, 210 180, 250 195"
          stroke="#7dd3fc"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
          opacity="0.75"
        />

        {/* Optional wordmark inside SVG if requested */}
        {showWordmark && (
          <text
            x="250"
            y="390"
            textAnchor="middle"
            fontFamily="'Plus Jakarta Sans', system-ui, sans-serif"
            fontSize="54"
            fontWeight="800"
            letterSpacing="-1"
          >
            <tspan fill="#3b82f6">Soni</tspan>
            <tspan fill="#38bdf8">Mix</tspan>
          </text>
        )}
      </svg>
    </div>
  );
};
