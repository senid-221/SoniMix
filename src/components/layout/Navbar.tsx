import React, { useState, useRef, useEffect } from 'react';
import {
  SlidersHorizontal,
  Wand2,
  GitFork,
  Image as ImageIcon,
  Gauge,
  FolderKanban,
  Sparkles,
  ArrowRight,
  User,
  Menu,
  ChevronDown,
  LogOut,
  LayoutDashboard,
  Tag,
  X,
  Volume2,
  Music2,
} from 'lucide-react';
import { SoniMixLogo } from '../common/SoniMixLogo';
import { AuthUser } from '../../utils/authStore';

export type NavTab =
  | 'landing'
  | 'mixer'
  | 'mastering'
  | 'stems'
  | 'cover'
  | 'resampler'
  | 'projects'
  | 'voice'
  | 'music'
  | 'user-dashboard'
  | 'admin-dashboard'
  | 'admin-login';

interface NavbarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  hasTracks: boolean;
  customLogoUrl?: string | null;
  customIcons?: Record<string, string>;
  brandName?: string;
  currentUser: AuthUser | null;
  onOpenAuthModal: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  hasTracks,
  customLogoUrl,
  customIcons = {},
  brandName = 'SoniMix',
  currentUser,
  onOpenAuthModal,
  onLogout,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  // Close menus on outside click
  useEffect(() => {
    const handleDocClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleDocClick);
    return () => document.removeEventListener('mousedown', handleDocClick);
  }, []);

  // ONLY Home, Studio Mixer, and AI Mastering are directly in the header
  const headerLinks: { id: NavTab; label: string; icon: React.ElementType }[] = [
    { id: 'landing', label: 'Home', icon: SoniMixLogo as unknown as React.ElementType },
    { id: 'mixer', label: 'Studio Mixer', icon: SlidersHorizontal },
    { id: 'mastering', label: 'AI Mastering', icon: Wand2 },
  ];

  // All other remaining tools and sections go in the Menu
  const menuItems: { id: NavTab; label: string; description: string; icon: React.ElementType }[] = [
    {
      id: 'voice', label: 'Voice Studio', description: 'Generate voiceovers with configured ElevenLabs access', icon: Volume2,
    },
    {
      id: 'music', label: 'Music Generation', description: 'Loudly API availability and configuration', icon: Music2,
    },
    {
      id: 'stems',
      label: 'Stem Splitter',
      description: 'Separate vocals, drums, bass & melody',
      icon: GitFork,
    },
    {
      id: 'cover',
      label: 'Cover Creator',
      description: '3000px minimalist album cover studio',
      icon: ImageIcon,
    },
    {
      id: 'resampler',
      label: 'Audio Resampler',
      description: 'PCM conversion, pitch & tempo transposition',
      icon: Gauge,
    },
    {
      id: 'projects',
      label: 'My Projects',
      description: 'Multitrack sessions & audio bounce catalog',
      icon: FolderKanban,
    },
  ];

  const isMoreActive = menuItems.some((item) => item.id === currentTab);

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Brand Logo & Primary Direct Links */}
        <div className="flex items-center space-x-6">
          <button
            onClick={() => onSelectTab('landing')}
            className="flex items-center space-x-3 text-left group cursor-pointer focus:outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center shadow-lg shadow-blue-500/10 group-hover:scale-105 transition-transform p-1 overflow-hidden">
              {customLogoUrl ? (
                <img src={customLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
              ) : (
                <SoniMixLogo size={32} />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-heading font-extrabold text-xl tracking-tight text-white">
                  {brandName === 'SoniMix' ? (
                    <>
                      <span className="text-blue-500">Soni</span>
                      <span className="text-sky-400">Mix</span>
                    </>
                  ) : (
                    brandName
                  )}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">AI Music Production Studio</p>
            </div>
          </button>

          {/* Header Primary Links: ONLY Home, Studio Mixer, AI Mastering */}
          <nav className="hidden md:flex items-center space-x-1">
            {headerLinks.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const customIconUrl = customIcons[item.id];
              return (
                <button
                  key={item.id}
                  onClick={() => onSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                  }`}
                >
                  {customIconUrl ? (
                    <img src={customIconUrl} alt={item.label} className="w-3.5 h-3.5 object-contain rounded-xs" />
                  ) : (
                    item.id !== 'landing' && Icon && <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>{item.label}</span>
                </button>
              );
            })}

            {/* Menu Dropdown Button for all other remaining tools */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen((prev) => !prev)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isMoreActive || isMenuOpen
                    ? 'bg-slate-800 text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                <Menu className="w-3.5 h-3.5 text-blue-400" />
                <span>Menu</span>
                <ChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Popover */}
              {isMenuOpen && (
                <div className="absolute top-full left-0 mt-2 w-72 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 p-2 z-50 space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    Production Modules & Assets
                  </div>
                  {menuItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = currentTab === item.id;
                    const customIconUrl = customIcons[item.id];
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          onSelectTab(item.id);
                          setIsMenuOpen(false);
                        }}
                        className={`w-full flex items-start space-x-3 p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                          isActive
                            ? 'bg-blue-600/20 text-white border border-blue-500/30'
                            : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                        }`}
                      >
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            isActive
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-950 border border-slate-800 text-blue-400'
                          }`}
                        >
                          {customIconUrl ? (
                            <img src={customIconUrl} alt={item.label} className="w-4 h-4 object-contain" />
                          ) : (
                            <Icon className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white flex items-center space-x-1.5">
                            <span>{item.label}</span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </nav>
        </div>

        {/* Right Action buttons: Launch Studio + Login / Google */}
        <div className="flex items-center space-x-3">
          {currentTab !== 'mixer' && (
            <button
              onClick={() => onSelectTab('mixer')}
              className="hidden sm:flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 transition-all cursor-pointer"
            >
              <span>Launch Studio</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {hasTracks && currentTab === 'mixer' && (
            <button
              onClick={() => onSelectTab('mastering')}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Wand2 className="w-3.5 h-3.5" />
              <span>Master Mix</span>
            </button>
          )}

          {/* Authentication Button: Login / Google or User Profile Dropdown */}
          {!currentUser ? (
            <button
              onClick={onOpenAuthModal}
              className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700/80 text-white border border-slate-700 hover:border-slate-600 transition-all cursor-pointer shadow-sm"
            >
              <User className="w-3.5 h-3.5 shrink-0" />
              <span>Sign In</span>
            </button>
          ) : (
            <div className="relative" ref={userMenuRef}>
              <button
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                className="flex items-center space-x-2 p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 transition-colors cursor-pointer"
              >
                <div className="w-7 h-7 rounded-lg bg-blue-600 text-white font-bold text-xs flex items-center justify-center">{currentUser.name.slice(0, 1).toUpperCase()}</div>
                <span className="text-xs font-semibold text-slate-200 hidden sm:block max-w-[100px] truncate">
                  {currentUser.name}
                </span>
                <ChevronDown className="w-3 h-3 text-slate-400" />
              </button>

              {/* User Account Popover */}
              {isUserMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 p-2 z-50 space-y-1">
                  <div className="px-3 py-2 border-b border-slate-800">
                    <div className="text-xs font-bold text-white truncate">{currentUser.name}</div>
                    <div className="text-[11px] text-slate-400 truncate">{currentUser.email}</div>
                    <span className="inline-block mt-1 text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
                      {currentUser.role === 'admin' ? 'Administrator' : 'Account'}
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      onSelectTab('user-dashboard');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <LayoutDashboard className="w-3.5 h-3.5 text-blue-400" />
                    <span>User Dashboard</span>
                  </button>

                  <button
                    onClick={() => {
                      onSelectTab('projects');
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <FolderKanban className="w-3.5 h-3.5 text-indigo-400" />
                    <span>My Projects</span>
                  </button>

                  <div className="border-t border-slate-800 pt-1">
                    <button
                      onClick={() => {
                        onLogout();
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile subnavigation bar: Home, Studio Mixer, AI Mastering, Menu */}
      <div className="md:hidden border-t border-slate-800 px-4 py-2 flex items-center justify-between text-xs overflow-x-auto space-x-2">
        <div className="flex items-center space-x-1.5">
          {headerLinks.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`px-2.5 py-1 rounded whitespace-nowrap font-medium text-xs ${
                currentTab === item.id ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          aria-expanded={isMenuOpen}
          aria-haspopup="true"
          onClick={() => setIsMenuOpen((prev) => !prev)}
          className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-semibold border transition-colors ${
            isMoreActive || isMenuOpen ? 'bg-slate-800 text-blue-400 border-blue-500/40' : 'text-slate-300 border-slate-700 hover:text-white hover:bg-slate-800/70'
          }`}
        >
          {isMenuOpen ? <X className="w-3.5 h-3.5 text-blue-400" /> : <Menu className="w-3.5 h-3.5 text-blue-400" />}
          <span>Menu</span>
          <ChevronDown className={`w-3 h-3 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Mobile menu panel: rendered outside the desktop-only nav so the Menu button works on phones. */}
      {isMenuOpen && (
        <div ref={menuRef} className="md:hidden absolute right-4 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] max-h-[70vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl shadow-black/80 p-2 z-50 space-y-1">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Production Modules & Assets
          </div>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            const customIconUrl = customIcons[item.id];
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectTab(item.id);
                  setIsMenuOpen(false);
                }}
                className={`w-full flex items-start space-x-3 p-2.5 rounded-xl transition-all cursor-pointer text-left ${
                  isActive
                    ? 'bg-blue-600/20 text-white border border-blue-500/30'
                    : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-950 border border-slate-800 text-blue-400'
                }`}>
                  {customIconUrl ? (
                    <img src={customIconUrl} alt={item.label} className="w-4 h-4 object-contain" />
                  ) : (
                    <Icon className="w-4 h-4" />
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white"><span>{item.label}</span></div>
                  <p className="text-[11px] text-slate-400 truncate">{item.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </header>
  );
};
