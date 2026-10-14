import React, { useRef } from 'react';
import {
  SlidersHorizontal,
  Wand2,
  GitFork,
  Image as ImageIcon,
  Gauge,
  Sparkles,
  Upload,
  ArrowRight,
  CheckCircle,
  Play,
  Shield,
  Layers,
  Music,
  Headphones,
  Zap,
} from 'lucide-react';
import { NavTab } from '../layout/Navbar';
import { SoniMixLogo } from '../common/SoniMixLogo';
import { AppConfig } from '../../types/dashboard';

interface LandingPageProps {
  onSelectTab: (tab: NavTab) => void;
  onFileUpload: (file: File) => void;
  appConfig?: AppConfig;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onSelectTab,
  onFileUpload,
  appConfig,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  return (
    <div className="flex-1 bg-white text-slate-900 flex flex-col overflow-y-auto">
      {/* 1. HERO SECTION (Deep Navy Blue background from Mixia reference) */}
      <section className="relative bg-gradient-to-b from-slate-950 via-slate-900 to-slate-900 text-white pt-16 pb-28 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-blue-600/10 blur-[120px] pointer-events-none" />

        <div className="max-w-5xl mx-auto text-center relative z-10 space-y-6">
          {/* Logo Badge */}
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-white rounded-2xl border border-slate-200 shadow-2xl shadow-blue-500/20 overflow-hidden flex items-center justify-center">
              {appConfig?.customLogoUrl ? (
                <img
                  src={appConfig.customLogoUrl}
                  alt="SoniMix Logo"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/sonimix-logo.svg?v=20261014';
                  }}
                  className="max-h-16 max-w-[200px] object-contain"
                />
              ) : (
                <SoniMixLogo size={72} />
              )}
            </div>
          </div>

          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>{appConfig?.announcementText || 'Next-Generation AI Audio Engineering Platform'}</span>
          </div>

          <h1 className="font-heading font-extrabold text-4xl sm:text-6xl lg:text-7xl tracking-tight text-white max-w-4xl mx-auto leading-[1.1]">
            {appConfig?.heroHeadline || 'Your sound. Your vision. One studio.'}
          </h1>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {appConfig?.heroSubtitle ||
              'The all-in-one browser production suite for independent artists and producers. Real-time multitrack mixing, industry release mastering, source stem separation, 3000px album cover design, and true PCM audio resampling.'}
          </p>

          {/* Functional Upload Entry Point (Prompt Requirement) */}
          <div className="pt-4 max-w-xl mx-auto">
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-blue-500/40 hover:border-blue-400 bg-slate-950/60 hover:bg-slate-950/90 rounded-2xl p-7 transition-all cursor-pointer shadow-2xl hover:shadow-blue-500/10"
            >
              <input
                type="file"
                ref={fileInputRef}
                onChange={(e) => {
                  if (e.target.files?.[0]) onFileUpload(e.target.files[0]);
                }}
                accept="audio/*"
                className="hidden"
              />
              <div className="flex flex-col items-center space-y-3">
                <div className="w-12 h-12 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <span className="font-bold text-sm text-white block">
                    Drop your audio here to start mixing or mastering
                  </span>
                  <span className="text-xs text-slate-400 block mt-0.5">
                    Supports WAV, MP3, FLAC, AAC, OGG (up to 200MB)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Launch Buttons */}
            <div className="mt-5 flex items-center justify-center space-x-3 text-xs">
              <button
                onClick={() => onSelectTab('mixer')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-600/30 cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Launch Studio Mixer</span>
              </button>
              <button
                onClick={() => onSelectTab('mastering')}
                className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold transition-all cursor-pointer"
              >
                <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                <span>Open AI Mastering</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 2. THE 5 CORE PRODUCTION WORKSPACES (Clean white & slate backgrounds from Mixia) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full">
        <div className="text-center max-w-3xl mx-auto mb-16 space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
            Integrated Audio Production
          </span>
          <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900 tracking-tight">
            {appConfig?.sectionTitles?.studiosHeadline || 'Engineered for real audio workflows. Not mockups.'}
          </h2>
          <p className="text-sm sm:text-base text-slate-600">
            {appConfig?.sectionTitles?.studiosSubtitle ||
              'Every studio module features actual Web Audio API signal processing, offline DSP rendering, and accurate technical exports.'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Mixing Studio */}
          <div
            onClick={() => onSelectTab('mixer')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {appConfig?.studioTitles?.mixer || 'AI Multitrack Mixing Studio'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Full-featured DAW channel strips with parametric 3-band EQ, HPF/LPF cut filters, dynamic compression, analog saturation, studio reverb sends, and instant A/B bypass comparisons.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-blue-600 group-hover:translate-x-1 transition-transform">
              <span>Launch Mixer</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 2: AI Mastering */}
          <div
            onClick={() => onSelectTab('mastering')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Wand2 className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {appConfig?.studioTitles?.mastering || 'AI Mastering Console'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Release optimization targeting Spotify (-14 LUFS), Apple Music, and Club systems (-9 LUFS). Includes live True Peak metering, crest factor analysis, glue compressor, and stereo widening.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-indigo-600 group-hover:translate-x-1 transition-transform">
              <span>Master Songs</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 3: Stem Splitter */}
          <div
            onClick={() => onSelectTab('stems')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-purple-500 hover:shadow-xl hover:shadow-purple-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <GitFork className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {appConfig?.studioTitles?.stems || 'Stem Separation Splitter'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Isolate clean Vocals, Drums, Bass, and Melody with synchronized audio preview. Mute, solo, and export stems individually or package them together into a high-fidelity ZIP bundle.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-purple-600 group-hover:translate-x-1 transition-transform">
              <span>Split Audio Stems</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 4: Album Cover Creator */}
          <div
            onClick={() => onSelectTab('cover')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-pink-500 hover:shadow-xl hover:shadow-pink-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <ImageIcon className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {appConfig?.studioTitles?.cover || 'Cover Creator Studio'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Interactive artwork canvas producing 3000 × 3000 pixel images with custom background colors, image manipulation controls, and lossless distribution master exports.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-pink-600 group-hover:translate-x-1 transition-transform">
              <span>Create Album Cover</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 5: Track Resampler */}
          <div
            onClick={() => onSelectTab('resampler')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-teal-500 hover:shadow-xl hover:shadow-teal-500/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Gauge className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                {appConfig?.studioTitles?.resampler || 'Audio Resampler Engine'}
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Professional sample-rate conversion (44.1kHz - 96kHz) with anti-aliasing filters, 16/24-bit PCM quantization, speed changes, and musical pitch transposition.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-teal-600 group-hover:translate-x-1 transition-transform">
              <span>Resample Audio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>

          {/* Card 6: Project & Bounces Dashboard */}
          <div
            onClick={() => onSelectTab('projects')}
            className="p-6 rounded-2xl border border-slate-200 bg-white hover:border-slate-800 hover:shadow-xl hover:shadow-slate-900/5 transition-all cursor-pointer group flex flex-col justify-between"
          >
            <div>
              <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="font-heading font-bold text-lg text-slate-900 mb-2">
                Bounces & Project History
              </h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">
                Track your active DAW projects, audio bounces, stems packages, and storage quotas in one unified dashboard inspired by modern music studio managers.
              </p>
            </div>
            <div className="flex items-center space-x-1 text-xs font-bold text-slate-800 group-hover:translate-x-1 transition-transform">
              <span>View Projects</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </div>
          </div>
        </div>
      </section>

      {/* 3. TRANSPARENT PRICING & PLAN INFORMATION (Prompt Section 8) */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-50 border-t border-slate-200">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-14 space-y-2">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-600 font-mono">
              Simple Studio Plans
            </span>
            <h2 className="font-heading font-extrabold text-3xl sm:text-4xl text-slate-900">
              {appConfig?.sectionTitles?.pricingHeadline || 'Clear quotas. Zero hidden charges.'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-600">
              {appConfig?.sectionTitles?.pricingSubtitle ||
                'Pick the right tier for your release schedule. No surprise bills.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Free Tier */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Free Starter</span>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-extrabold text-slate-900">$0</span>
                  <span className="text-xs text-slate-500"> / forever</span>
                </div>
                <p className="text-xs text-slate-600 mb-6">
                  Essential tools for independent experimenters and bedroom beatmakers.
                </p>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Unlimited browser DAW mixing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>3 AI Masterings per month</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Basic 4-stem audio separation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>16-bit WAV & MP3 downloads</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onSelectTab('mixer')}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 transition-colors cursor-pointer"
              >
                Start Free in Studio
              </button>
            </div>

            {/* Pro Tier (Popular) */}
            <div className="bg-slate-900 p-7 rounded-2xl border-2 border-blue-500 shadow-xl text-white flex flex-col justify-between space-y-6 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-full shadow-md">
                Most Popular for Artists
              </div>
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-blue-400 font-mono">Pro Producer</span>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-extrabold text-white">$14</span>
                  <span className="text-xs text-slate-400"> / month</span>
                </div>
                <p className="text-xs text-slate-300 mb-6">
                  Everything an active songwriter or electronic producer needs to release music.
                </p>
                <ul className="space-y-3 text-xs text-slate-300">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Unlimited 24-bit studio exports</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Unlimited AI Mastering with presets</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Unlimited stem separation + ZIP downloads</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>3000 × 3000 px Cover Art exports</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>Full PCM 96kHz resampling engine</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onSelectTab('mixer')}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              >
                Get Pro Access
              </button>
            </div>

            {/* Studio Tier */}
            <div className="bg-white p-7 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between space-y-6">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500 font-mono">Studio Label</span>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-extrabold text-slate-900">$29</span>
                  <span className="text-xs text-slate-500"> / month</span>
                </div>
                <p className="text-xs text-slate-600 mb-6">
                  For mastering engineers, labels, and commercial recording studios.
                </p>
                <ul className="space-y-3 text-xs text-slate-600">
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Batch multitrack stem processing</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Custom LUFS target mastering profiles</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Team project collaboration & cloud bounces</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                    <span>Dedicated audio engineering priority</span>
                  </li>
                </ul>
              </div>
              <button
                onClick={() => onSelectTab('mixer')}
                className="w-full py-2.5 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer"
              >
                Contact Studio Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 4. FREQUENTLY ASKED QUESTIONS */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-4xl mx-auto w-full">
        <div className="text-center mb-12">
          <h2 className="font-heading font-extrabold text-2xl sm:text-3xl text-slate-900">
            {appConfig?.sectionTitles?.faqHeadline || 'Frequently Asked Questions'}
          </h2>
        </div>

        <div className="space-y-4">
          {[
            {
              q: 'Does SoniMix perform actual audio processing or simulate it?',
              a: 'SoniMix uses the Web Audio API and OfflineAudioContext DSP engine for genuine audio processing. Filter cutoffs, compressors, reverb convolutions, stereo imagers, and mastering limiters directly alter the audio buffer and bake into real downloadable WAV/MP3 files.',
            },
            {
              q: 'What loudness standard does the AI Mastering console target?',
              a: 'Our default streaming preset targets -14.0 LUFS with a -0.3 dBFS True Peak ceiling, aligning with Spotify and Apple Music normalization. We also provide Club (-9 LUFS), CD (-11 LUFS), and Audiophile (-16 LUFS) profiles.',
            },
            {
              q: 'Can I open separated stems directly inside the Mixer?',
              a: 'Yes! After running Stem Separation, click "Open in Multitrack Mixer" and all 4 stems (Vocals, Drums, Bass, Melody) will load into independent tracks with preserved sample alignment.',
            },
            {
              q: 'Are the cover art exports high enough resolution for Spotify?',
              a: 'Yes. The Cover Creator exports true 3000 × 3000 pixel images in PNG format, which satisfies the distribution standards for Spotify, Apple Music, Tidal, Amazon Music, and physical CD jewel cases.',
            },
          ].map((faq, i) => (
            <div key={i} className="p-5 rounded-xl border border-slate-200 bg-white shadow-sm">
              <h3 className="font-bold text-sm text-slate-900 mb-1.5">{faq.q}</h3>
              <p className="text-xs text-slate-600 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 5. FOOTER */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800 text-xs">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center p-0.5 overflow-hidden">
              {appConfig?.customLogoUrl ? (
                <img src={appConfig.customLogoUrl} alt="Logo" className="w-6 h-6 object-contain" />
              ) : (
                <SoniMixLogo size={26} />
              )}
            </div>
            <span className="font-heading font-extrabold text-base tracking-tight text-white">
              {appConfig?.brandName === 'SoniMix' || !appConfig?.brandName ? (
                <>
                  <span className="text-blue-500">Soni</span>
                  <span className="text-sky-400">Mix</span>
                </>
              ) : (
                appConfig.brandName
              )}
            </span>
            <span className="text-slate-500 ml-2">© 2026 {appConfig?.brandName || 'SoniMix'} Audio Technologies Inc.</span>
          </div>

          <div className="flex items-center space-x-6 text-slate-400">
            <button onClick={() => onSelectTab('mixer')} className="hover:text-white cursor-pointer">
              Mixing Studio
            </button>
            <button onClick={() => onSelectTab('mastering')} className="hover:text-white cursor-pointer">
              AI Mastering
            </button>
            <button onClick={() => onSelectTab('stems')} className="hover:text-white cursor-pointer">
              Stem Splitter
            </button>
            <button onClick={() => onSelectTab('cover')} className="hover:text-white cursor-pointer">
              Cover Creator
            </button>
            <button onClick={() => onSelectTab('resampler')} className="hover:text-white cursor-pointer">
              Resampler
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
