import React, { useRef, useEffect } from 'react';
import { audioEngine } from '../../audio/audioEngine';

interface SpectrumVisualizerProps {
  height?: number;
  barColor?: string;
  bands?: number;
  className?: string;
}

export const SpectrumVisualizer: React.FC<SpectrumVisualizerProps> = ({
  height = 36,
  barColor = '#38bdf8',
  bands = 24,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const freqData = new Uint8Array(128);

    const render = () => {
      audioEngine.getMasterFrequencyData(freqData);

      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      if (canvas.width !== rect.width * dpr || canvas.height !== height * dpr) {
        canvas.width = rect.width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }

      const width = rect.width;
      ctx.clearRect(0, 0, width, height);

      const barWidth = Math.max(2, (width / bands) - 2);
      const step = Math.floor(freqData.length / bands);

      for (let i = 0; i < bands; i++) {
        let sum = 0;
        for (let j = 0; j < step; j++) {
          sum += freqData[i * step + j] || 0;
        }
        const avg = sum / step;
        const normalized = avg / 255;
        const barHeight = Math.max(2, normalized * (height - 4));
        const x = i * (barWidth + 2);

        // Gradient from blue to cyan/emerald
        const grad = ctx.createLinearGradient(0, height, 0, height - barHeight);
        grad.addColorStop(0, '#2563eb');
        grad.addColorStop(0.7, barColor);
        grad.addColorStop(1, '#67e8f9');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.roundRect(x, height - barHeight, barWidth, barHeight, 1);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [bands, barColor, height]);

  return (
    <div className={`flex items-center ${className}`}>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: `${height}px` }}
      />
    </div>
  );
};
