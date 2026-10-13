import React, { useState, useEffect } from 'react';
import {
  FolderKanban,
  Music2,
  GitFork,
  Download,
  Trash2,
  Clock,
  Plus,
  Layers,
  CheckCircle,
  FileAudio,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';
import { ExportHistoryItem, ProjectMetadata } from '../../types/audio';
import { apiRequest } from '../../utils/apiClient';

interface ProjectsDashboardProps {
  exportHistory: ExportHistoryItem[];
  onOpenMixer: () => void;
  onOpenMastering: () => void;
  onOpenStems: () => void;
  onOpenCover: () => void;
}

export const ProjectsDashboard: React.FC<ProjectsDashboardProps> = ({
  exportHistory,
  onOpenMixer,
  onOpenMastering,
  onOpenStems,
  onOpenCover,
}) => {
  const [projects, setProjects] = useState<ProjectMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<'bounces' | 'projects' | 'stems'>('bounces');

  useEffect(() => {
    apiRequest<{ projects: Array<{ id: string; name: string; createdAt: number; updatedAt: number; metadata: Record<string, unknown> }> }>('/api/projects')
      .then(({ projects: records }) => setProjects(records.map((record) => ({ id: record.id, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt, bpm: Number(record.metadata.bpm || 0), sampleRate: Number(record.metadata.sampleRate || 0), trackCount: Number(record.metadata.trackCount || 0), duration: Number(record.metadata.duration || 0), status: 'draft' }))))
      .catch(() => setProjects([]));
  }, []);

  const handleDeleteProject = async (id: string) => {
    await apiRequest(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setProjects((prev) => prev.filter((p) => p.id !== id));
  };

  const handleCreateNewProject = async () => {
    const name = window.prompt('Name your project');
    if (!name?.trim()) return;
    const { project } = await apiRequest<{ project: { id: string; name: string; createdAt: number; updatedAt: number } }>('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim() }) });
    const newProj: ProjectMetadata = { id: project.id, name: project.name, bpm: 0, sampleRate: 0, createdAt: project.createdAt, updatedAt: project.updatedAt, trackCount: 0, duration: 0, status: 'draft' };
    setProjects((prev) => [newProj, ...prev]);
    onOpenMixer();
  };

  // Filter stem exports if any
  const stemExports = exportHistory.filter((item) => item.type === 'stem');

  return (
    <div className="flex-1 bg-slate-950 text-slate-100 flex flex-col overflow-y-auto">
      {/* Top Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <FolderKanban className="w-5 h-5 text-blue-400" />
            <h1 className="font-heading font-extrabold text-xl text-white">
              Studio Projects & Bounces
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Manage your multitrack sessions, exported bounces, stems packages, and project assets.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenCover}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
          >
            <span>Cover Creator</span>
          </button>

          <button
            onClick={handleCreateNewProject}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Studio Session</span>
          </button>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-2 border-b border-slate-800 pb-3">
          <button
            onClick={() => setActiveTab('bounces')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'bounces'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Audio Bounces ({exportHistory.length})
          </button>
          <button
            onClick={() => setActiveTab('projects')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'projects'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Active Sessions ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('stems')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'stems'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-900'
            }`}
          >
            Stem Packages ({stemExports.length})
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'bounces' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-white">Exported Audio Bounces</span>
              <span className="text-xs text-slate-500">Your mastered mixes and exports</span>
            </div>

            {exportHistory.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/10 border border-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <FileAudio className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No audio bounces yet</h3>
                <p className="text-xs text-slate-400 mb-5">
                  Process and export tracks in Studio Mixer or AI Mastering to see your bounce history here.
                </p>
                <div className="flex items-center space-x-3">
                  <button
                    onClick={onOpenMixer}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Open Mixer</span>
                  </button>
                  <button
                    onClick={onOpenMastering}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Wand2 className="w-3.5 h-3.5 text-indigo-400" />
                    <span>AI Mastering</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {exportHistory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-9 h-9 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                        <FileAudio className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-white block">{item.title}</span>
                        <div className="flex items-center space-x-2 text-[10px] text-slate-400 font-mono">
                          <span>{item.format}</span>
                          <span>•</span>
                          <span>{item.fileSize}</span>
                          <span>•</span>
                          <span>{new Date(item.timestamp).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <a
                        href={item.downloadUrl}
                        download={item.title}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download</span>
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'projects' && (
          <div>
            {projects.length === 0 ? (
              <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 flex flex-col items-center justify-center text-center max-w-md mx-auto">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3">
                  <FolderKanban className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-white mb-1">No saved sessions yet</h3>
                <p className="text-xs text-slate-400 mb-5">
                  Start a new multitrack session in Studio Mixer to build your session catalog.
                </p>
                <button
                  onClick={handleCreateNewProject}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Start First Session</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj) => (
                  <div
                    key={proj.id}
                    className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4 hover:border-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                          <FolderKanban className="w-5 h-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-sm text-white">{proj.name}</h3>
                          <span className="text-[11px] text-slate-400 font-mono">
                          {proj.trackCount} Tracks {proj.sampleRate ? `• ${proj.sampleRate} Hz` : ''}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 font-bold">
                        {proj.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-500">
                        Updated {new Date(proj.updatedAt).toLocaleDateString()}
                      </span>

                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => handleDeleteProject(proj.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={onOpenMixer}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                        >
                          Open in Mixer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stems' && (
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-white">Separated Stem Packages</h3>
                <p className="text-xs text-slate-400">Isolated vocal, drum, bass, and instrumental stems</p>
              </div>

              <button
                onClick={onOpenStems}
                className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Split New Track
              </button>
            </div>

            {stemExports.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-purple-600/10 border border-purple-500/20 text-purple-400 flex items-center justify-center mb-3">
                  <GitFork className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white mb-1">No stem packages yet</h4>
                <p className="text-xs text-slate-400 mb-4 max-w-sm">
                  Upload any song into the Stem Splitter to isolate vocals, drums, bass, and melody.
                </p>
                <button
                  onClick={onOpenStems}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Open Stem Splitter
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {stemExports.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <GitFork className="w-4 h-4 text-purple-400" />
                      <div>
                        <span className="font-bold text-xs text-white block">{item.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {item.format} • {item.fileSize}
                        </span>
                      </div>
                    </div>
                    <a
                      href={item.downloadUrl}
                      download={item.title}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors cursor-pointer"
                    >
                      Download
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
