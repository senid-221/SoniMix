import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Palette,
  Download,
  RotateCcw,
  CheckCircle,
  Copy,
  Sliders,
  Upload,
  Trash2,
  RotateCw,
  Sun,
  Contrast,
  Image as ImageIcon,
  Move,
  ZoomIn,
} from 'lucide-react';

interface CoverCreatorStudioProps {
  onAddExport: (title: string, blob: Blob, format: string) => void;
  studioTitle?: string;
}

// Minimal, studio-grade neutral color presets
const MINIMAL_COLOR_PRESETS = [
  { name: 'SoniMix Deep Navy', hex: '#0f172a' },
  { name: 'Pure Obsidian', hex: '#09090b' },
  { name: 'Jet Black', hex: '#000000' },
  { name: 'Studio Slate', hex: '#1e293b' },
  { name: 'Midnight Charcoal', hex: '#18181b' },
  { name: 'Deep Sapphire', hex: '#172554' },
  { name: 'Abyssal Indigo', hex: '#312e81' },
  { name: 'Dark Emerald', hex: '#064e3b' },
  { name: 'Burgundy Crimson', hex: '#4c0519' },
  { name: 'Pure White', hex: '#ffffff' },
];

export const CoverCreatorStudio: React.FC<CoverCreatorStudioProps> = ({
  onAddExport,
  studioTitle = 'Cover Creator Studio',
}) => {
  // Designated background color state
  const [backgroundColor, setBackgroundColor] = useState<string>('#0f172a');
  const [copiedHex, setCopiedHex] = useState<boolean>(false);

  // Essential Image Manipulation States
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageElement, setImageElement] = useState<HTMLImageElement | null>(null);
  const [fitMode, setFitMode] = useState<'contain' | 'cover' | 'custom'>('contain');
  const [scale, setScale] = useState<number>(100); // 20% - 250%
  const [borderPadding, setBorderPadding] = useState<number>(0); // 0% - 30% margin around image
  const [positionX, setPositionX] = useState<number>(0); // -100 to 100
  const [positionY, setPositionY] = useState<number>(0); // -100 to 100
  const [rotation, setRotation] = useState<number>(0); // 0, 90, 180, 270 degrees

  // Image adjustments
  const [brightness, setBrightness] = useState<number>(100); // 50% - 150%
  const [contrast, setContrast] = useState<number>(100); // 50% - 150%
  const [saturation, setSaturation] = useState<number>(100); // 0% - 200%
  const [opacity, setOpacity] = useState<number>(100); // 10% - 100%

  // Export settings
  const [exportRes, setExportRes] = useState<3000 | 1500 | 800>(3000);
  const [exportFormat, setExportFormat] = useState<'png' | 'jpeg'>('png');
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Handle image upload
  const handleImageUpload = (file: File) => {
    if (!file.type.startsWith('image/')) return;
    setImageFile(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImageElement(img);
      };
      img.src = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleImageUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImageElement(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetImageControls = () => {
    setFitMode('contain');
    setScale(100);
    setBorderPadding(0);
    setPositionX(0);
    setPositionY(0);
    setRotation(0);
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setOpacity(100);
  };

  const handleResetAll = () => {
    setBackgroundColor('#0f172a');
    handleRemoveImage();
    handleResetImageControls();
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  // Draw on canvas function
  const renderCanvas = useCallback(
    (canvas: HTMLCanvasElement | null, size: number) => {
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = size;
      canvas.height = size;

      // 1. Fill designated background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, size, size);

      // 2. Draw image if loaded
      if (imageElement) {
        ctx.save();

        const paddingPixels = (size * borderPadding) / 100;
        const availableWidth = size - paddingPixels * 2;
        const availableHeight = size - paddingPixels * 2;

        const imgAspect = imageElement.width / imageElement.height;
        const boxAspect = availableWidth / availableHeight;

        let drawWidth = availableWidth;
        let drawHeight = availableHeight;

        if (fitMode === 'contain') {
          if (imgAspect > boxAspect) {
            drawWidth = availableWidth;
            drawHeight = availableWidth / imgAspect;
          } else {
            drawHeight = availableHeight;
            drawWidth = availableHeight * imgAspect;
          }
        } else if (fitMode === 'cover') {
          if (imgAspect > boxAspect) {
            drawHeight = availableHeight;
            drawWidth = availableHeight * imgAspect;
          } else {
            drawWidth = availableWidth;
            drawHeight = availableWidth / imgAspect;
          }
        } else {
          // Custom scale mode
          const baseScale = Math.min(availableWidth / imageElement.width, availableHeight / imageElement.height);
          const finalScale = baseScale * (scale / 100);
          drawWidth = imageElement.width * finalScale;
          drawHeight = imageElement.height * finalScale;
        }

        // Apply scale multiplier if custom fit
        if (fitMode !== 'custom' && scale !== 100) {
          drawWidth *= scale / 100;
          drawHeight *= scale / 100;
        }

        // Offset positions
        const offsetX = (positionX / 100) * (size / 2);
        const offsetY = (positionY / 100) * (size / 2);

        // Center point
        const centerX = size / 2 + offsetX;
        const centerY = size / 2 + offsetY;

        // Transformations
        ctx.translate(centerX, centerY);
        if (rotation !== 0) {
          ctx.rotate((rotation * Math.PI) / 180);
        }

        // Image adjustments
        const filterStr = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%) opacity(${opacity}%)`;
        ctx.filter = filterStr;

        ctx.drawImage(imageElement, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);

        ctx.restore();
      }
    },
    [
      backgroundColor,
      imageElement,
      fitMode,
      scale,
      borderPadding,
      positionX,
      positionY,
      rotation,
      brightness,
      contrast,
      saturation,
      opacity,
    ]
  );

  // Redraw preview whenever any control changes
  useEffect(() => {
    renderCanvas(previewCanvasRef.current, 600);
  }, [renderCanvas]);

  const handleCopyHex = () => {
    navigator.clipboard.writeText(backgroundColor);
    setCopiedHex(true);
    setTimeout(() => setCopiedHex(false), 2000);
  };

  const handleExportArtwork = async () => {
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      renderCanvas(exportCanvas, exportRes);

      const mimeType = exportFormat === 'png' ? 'image/png' : 'image/jpeg';
      const ext = exportFormat === 'png' ? 'png' : 'jpg';

      exportCanvas.toBlob(
        (blob) => {
          if (!blob) {
            setIsExporting(false);
            return;
          }

          const cleanHex = backgroundColor.replace('#', '');
          const filename = `Artwork_${cleanHex}_${exportRes}x${exportRes}.${ext}`;
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);

          onAddExport(filename, blob, `Artwork ${exportRes}×${exportRes} ${exportFormat.toUpperCase()}`);
          setExportSuccess(`Artwork exported cleanly at ${exportRes} × ${exportRes} px (${exportFormat.toUpperCase()})`);
          setTimeout(() => setExportSuccess(null), 4000);
          setIsExporting(false);
        },
        mimeType,
        exportFormat === 'png' ? 1.0 : 0.95
      );
    } catch (err) {
      console.error(err);
      setIsExporting(false);
    }
  };

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <Palette className="w-5 h-5 text-blue-400" />
            <h1 className="font-heading font-extrabold text-lg text-white">
              {studioTitle}
            </h1>
            <span className="text-[11px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-mono">
              {exportRes} × {exportRes} PX
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Minimalist studio with designated background color and essential image controls.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2.5">
          <button
            onClick={handleResetAll}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
            title="Reset background color and image adjustments"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
            <span>Reset All</span>
          </button>

          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as 'png' | 'jpeg')}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer focus:outline-none"
          >
            <option value="png">PNG (Lossless)</option>
            <option value="jpeg">JPEG (High Q)</option>
          </select>

          <select
            value={exportRes}
            onChange={(e) => setExportRes(Number(e.target.value) as 3000 | 1500 | 800)}
            className="bg-slate-800 border border-slate-700 text-xs rounded-lg px-2.5 py-1.5 text-slate-200 cursor-pointer focus:outline-none"
          >
            <option value={3000}>3000 × 3000 px</option>
            <option value={1500}>1500 × 1500 px</option>
            <option value={800}>800 × 800 px</option>
          </select>

          <button
            onClick={handleExportArtwork}
            disabled={isExporting}
            className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Exporting...' : 'Export'}</span>
          </button>
        </div>
      </div>

      {/* Main Studio View: Canvas Center + Essential Controls Sidebar */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left/Center Canvas View */}
        <div
          className="flex-1 p-6 sm:p-8 flex flex-col items-center justify-center bg-slate-950 border-b lg:border-b-0 lg:border-r border-slate-800 overflow-y-auto"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <div className="relative group p-3 sm:p-5 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl">
            {/* Minimalist Canvas */}
            <canvas
              ref={previewCanvasRef}
              className="w-[280px] sm:w-[400px] md:w-[460px] h-[280px] sm:h-[400px] md:h-[460px] rounded-lg shadow-inner block transition-all"
            />

            {/* Subtle Overlay Info */}
            <div className="absolute top-6 right-6 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] font-mono text-slate-300 border border-slate-800 flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full border border-white/20" style={{ backgroundColor }} />
              <span>{backgroundColor.toUpperCase()}</span>
            </div>

            <div className="absolute bottom-6 left-6 bg-slate-950/80 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] font-mono text-slate-400 border border-slate-800">
              1:1 • {exportRes} × {exportRes} PX
            </div>
          </div>

          {/* Export Success Banner */}
          {exportSuccess && (
            <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-xs flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 shrink-0" />
              <span>{exportSuccess}</span>
            </div>
          )}

          {!imageElement && (
            <p className="text-[11px] text-slate-500 mt-3 text-center">
              Drag and drop an image file directly onto the canvas to manipulate it over the background.
            </p>
          )}
        </div>

        {/* Right Sidebar: Essential Controls */}
        <div className="w-full lg:w-96 bg-slate-900 p-5 flex flex-col space-y-5 overflow-y-auto">
          {/* SECTION 1: Designated Background Color */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Palette className="w-4 h-4 text-blue-400" />
              <h2 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-200">
                Designated Background Color
              </h2>
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={backgroundColor}
                  onChange={(e) => setBackgroundColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-0.5"
                />

                <div className="flex-1 flex items-center bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5">
                  <span className="text-slate-500 font-mono text-xs mr-1">HEX</span>
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val.startsWith('#') || val.length <= 7) {
                        setBackgroundColor(val);
                      }
                    }}
                    className="w-full bg-transparent text-xs font-mono text-white focus:outline-none uppercase"
                    maxLength={7}
                  />
                  <button
                    onClick={handleCopyHex}
                    className="p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    title="Copy HEX code"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {copiedHex && (
                <span className="text-[10px] text-emerald-400 font-mono block">
                  Copied to clipboard
                </span>
              )}

              {/* Minimalist Color Swatches */}
              <div className="grid grid-cols-5 gap-1.5 pt-1">
                {MINIMAL_COLOR_PRESETS.map((swatch) => {
                  const isSelected = backgroundColor.toLowerCase() === swatch.hex.toLowerCase();
                  return (
                    <button
                      key={swatch.hex}
                      onClick={() => setBackgroundColor(swatch.hex)}
                      className={`h-7 rounded-md border transition-all cursor-pointer flex items-center justify-center ${
                        isSelected
                          ? 'border-blue-400 ring-2 ring-blue-500/40 scale-105'
                          : 'border-slate-800 hover:border-slate-600'
                      }`}
                      style={{ backgroundColor: swatch.hex }}
                      title={`${swatch.name} (${swatch.hex})`}
                    >
                      {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white shadow" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* SECTION 2: Image Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ImageIcon className="w-4 h-4 text-blue-400" />
                <h2 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-200">
                  Image Layer
                </h2>
              </div>
              {imageElement && (
                <button
                  onClick={handleRemoveImage}
                  className="flex items-center space-x-1 text-[11px] text-rose-400 hover:text-rose-300 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              )}
            </div>

            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleImageUpload(e.target.files[0]);
                  }
                }}
                className="hidden"
                id="artwork-image-upload"
              />

              {!imageElement ? (
                <label
                  htmlFor="artwork-image-upload"
                  className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-700 hover:border-slate-500 rounded-lg cursor-pointer transition-colors text-center"
                >
                  <Upload className="w-5 h-5 text-slate-400 mb-1" />
                  <span className="text-xs font-semibold text-slate-200">Upload Image</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">PNG, JPG, WebP, SVG</span>
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs text-slate-300">
                    <span className="truncate max-w-[180px] font-mono text-[11px]">
                      {imageFile?.name || 'Uploaded image'}
                    </span>
                    <label
                      htmlFor="artwork-image-upload"
                      className="text-[11px] text-blue-400 hover:text-blue-300 cursor-pointer font-medium"
                    >
                      Change
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3: Essential Image Manipulation Controls (Only when image is loaded) */}
          {imageElement && (
            <>
              {/* Placement & Framing */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Move className="w-4 h-4 text-blue-400" />
                    <h2 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-200">
                      Sizing & Position
                    </h2>
                  </div>
                  <button
                    onClick={handleResetImageControls}
                    className="text-[11px] text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    Reset
                  </button>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3.5">
                  {/* Fit Mode Toggle */}
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-mono block mb-1.5">Fit Mode</span>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(['contain', 'cover', 'custom'] as const).map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setFitMode(mode)}
                          className={`py-1 text-xs rounded capitalize transition-colors cursor-pointer ${
                            fitMode === mode
                              ? 'bg-blue-600 text-white font-semibold'
                              : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Scale Slider */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <ZoomIn className="w-3 h-3" /> Scale
                      </span>
                      <span className="font-mono">{scale}%</span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={200}
                      value={scale}
                      onChange={(e) => setScale(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Border / Margin Padding Slider (Reveals background color as frame) */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Background Margin</span>
                      <span className="font-mono">{borderPadding}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={30}
                      value={borderPadding}
                      onChange={(e) => setBorderPadding(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Position Offset X */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Pan X</span>
                      <span className="font-mono">{positionX}</span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={positionX}
                      onChange={(e) => setPositionX(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Position Offset Y */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Pan Y</span>
                      <span className="font-mono">{positionY}</span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={positionY}
                      onChange={(e) => setPositionY(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Rotate 90 deg */}
                  <div className="pt-1 flex items-center justify-between">
                    <span className="text-[11px] text-slate-400">Rotation</span>
                    <button
                      onClick={handleRotate}
                      className="flex items-center space-x-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-colors cursor-pointer"
                    >
                      <RotateCw className="w-3 h-3" />
                      <span>{rotation}°</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Adjustments: Brightness, Contrast, Saturation */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Sliders className="w-4 h-4 text-blue-400" />
                  <h2 className="font-heading font-bold text-xs uppercase tracking-wider text-slate-200">
                    Image Adjustments
                  </h2>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3">
                  {/* Brightness */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <Sun className="w-3 h-3" /> Brightness
                      </span>
                      <span className="font-mono">{brightness}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={brightness}
                      onChange={(e) => setBrightness(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Contrast */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span className="flex items-center gap-1">
                        <Contrast className="w-3 h-3" /> Contrast
                      </span>
                      <span className="font-mono">{contrast}%</span>
                    </div>
                    <input
                      type="range"
                      min={50}
                      max={150}
                      value={contrast}
                      onChange={(e) => setContrast(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Saturation */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Saturation</span>
                      <span className="font-mono">{saturation}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={saturation}
                      onChange={(e) => setSaturation(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>

                  {/* Opacity */}
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-400 mb-1">
                      <span>Opacity</span>
                      <span className="font-mono">{opacity}%</span>
                    </div>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={opacity}
                      onChange={(e) => setOpacity(Number(e.target.value))}
                      className="w-full accent-blue-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
