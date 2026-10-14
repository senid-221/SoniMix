import React from 'react';

interface SoniMixLogoProps {
  className?: string;
  size?: number;
  showWordmark?: boolean;
}

/** One canonical SoniMix brand asset shared by the app logo and browser favicon. */
export const SoniMixLogo: React.FC<SoniMixLogoProps> = ({
  className = '',
  size = 36,
  showWordmark = false,
}) => (
  <span className={`inline-flex items-center gap-2 ${className}`}>
    <img
      src="/sonimix-logo.svg?v=20261014"
      alt="SoniMix"
      width={size}
      height={size}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
      draggable={false}
    />
    {showWordmark && (
      <span className="font-extrabold tracking-tight whitespace-nowrap" style={{ fontSize: size * 0.42 }}>
        <span className="text-blue-500">Soni</span><span className="text-cyan-400">Mix</span>
      </span>
    )}
  </span>
);
