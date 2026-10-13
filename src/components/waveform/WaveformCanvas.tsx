import React, { useRef, useEffect, useState } from 'react';

interface WaveformCanvasProps {
  peaks: number[];
  color?: string;
  height?: number;
  currentTime?: number;
  duration?: number;
  selectionStart?: number | null;
  selectionEnd?: number | null;
  interactive?: boolean;
  onSeek?: (time: number) => void;
  onSelectRegion?: (start: number, end: number) => void;
  className?: string;
}

export const WaveformCanvas: React.FC<WaveformCanvasProps> = ({
  peaks,
  color = '#3b82f6',
  height = 56,
  currentTime = 0,
  duration = 0,
  selectionStart = null,
  selectionEnd = null,
  interactive = true,
  onSeek,
  onSelectRegion,
  className = '',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartRatio, setDragStartRatio] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    ctx.clearRect(0, 0, width, height);

    if (!peaks || peaks.length === 0) {
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, height / 2);
      ctx.lineTo(width, height / 2);
      ctx.stroke();
      return;
    }

    const progressRatio = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
    const playheadX = progressRatio * width;
    const barWidth = Math.max(1.5, width / peaks.length - 1);
    const midY = height / 2;

    // Draw selection overlay background if active (Matches Reference Image 1)
    if (
      selectionStart !== null &&
      selectionEnd !== null &&
      selectionEnd > selectionStart &&
      duration > 0
    ) {
      const selX1 = (selectionStart / duration) * width;
      const selX2 = (selectionEnd / duration) * width;
      const selW = selX2 - selX1;

      ctx.fillStyle = 'rgba(59, 130, 246, 0.22)';
      ctx.fillRect(selX1, 0, selW, height);

      // Border bounds
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(selX1, 0, selW, height);
    }

    // Draw waveform bars
    for (let i = 0; i < peaks.length; i++) {
      const x = (i / peaks.length) * width;
      const peak = peaks[i];
      const barHeight = Math.max(2, peak * (height * 0.85));

      // Color played vs unplayed
      if (x <= playheadX) {
        ctx.fillStyle = color;
      } else {
        ctx.fillStyle = '#475569';
      }

      ctx.beginPath();
      ctx.roundRect(x, midY - barHeight / 2, barWidth, barHeight, 1);
      ctx.fill();
    }

    // Draw playhead vertical line
    if (duration > 0 && currentTime >= 0) {
      ctx.strokeStyle = '#f8fafc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();

      // Playhead cursor cap
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(playheadX, 3, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [peaks, color, height, currentTime, duration, selectionStart, selectionEnd]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!interactive || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setIsDragging(true);
    setDragStartRatio(ratio);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragStartRatio === null || !interactive || duration <= 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const currentRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    const minRatio = Math.min(dragStartRatio, currentRatio);
    const maxRatio = Math.max(dragStartRatio, currentRatio);

    if (maxRatio - minRatio > 0.01 && onSelectRegion) {
      onSelectRegion(minRatio * duration, maxRatio * duration);
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || dragStartRatio === null) return;
    setIsDragging(false);

    const rect = e.currentTarget.getBoundingClientRect();
    const currentRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));

    // If simple click without drag, seek to that point
    if (Math.abs(currentRatio - dragStartRatio) < 0.01 && onSeek && duration > 0) {
      onSeek(currentRatio * duration);
    }
    setDragStartRatio(null);
  };

  return (
    <div className={`relative w-full overflow-hidden select-none ${className}`}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        className={`w-full block ${interactive ? 'cursor-crosshair hover:opacity-95' : ''}`}
        style={{ height: `${height}px` }}
      />
    </div>
  );
};
