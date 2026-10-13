import { ProjectMetadata, ExportHistoryItem, MasteringSettings } from '../types/audio';

const STORAGE_KEY_PROJECTS = 'sonimix_projects_v1';
const STORAGE_KEY_EXPORTS = 'sonimix_exports_v1';

export function getSavedProjects(): ProjectMetadata[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROJECTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveProjectMetadata(project: ProjectMetadata) {
  try {
    const current = getSavedProjects();
    const index = current.findIndex((p) => p.id === project.id);
    if (index >= 0) {
      current[index] = { ...project, updatedAt: Date.now() };
    } else {
      current.unshift({ ...project, updatedAt: Date.now() });
    }
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function deleteProjectMetadata(id: string) {
  try {
    const current = getSavedProjects().filter((p) => p.id !== id);
    localStorage.setItem(STORAGE_KEY_PROJECTS, JSON.stringify(current));
  } catch {
    // ignore
  }
}

export function getExportHistory(): ExportHistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXPORTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function addExportHistoryItem(item: ExportHistoryItem) {
  try {
    const current = getExportHistory();
    // Keep recent 30 items
    current.unshift(item);
    const trimmed = current.slice(0, 30);
    // Don't save blob in localStorage
    const serializable = trimmed.map(({ blob, ...rest }) => rest);
    localStorage.setItem(STORAGE_KEY_EXPORTS, JSON.stringify(serializable));
  } catch {
    // ignore
  }
}

export const DEFAULT_MASTERING_PRESETS: Record<string, MasteringSettings> = {
  'Streaming Release': {
    targetLufs: -14,
    ceiling: -0.3,
    inputGain: 1.5,
    eqBass: 1.2,
    eqLowMid: -0.5,
    eqPresence: 1.0,
    eqAir: 1.8,
    stereoWidth: 1.2,
    compressionDrive: 0.35,
    warmTape: 0.25,
    presetName: 'Streaming Release (-14 LUFS)',
  },
  'Club & EDM Banger': {
    targetLufs: -9,
    ceiling: -0.1,
    inputGain: 3.5,
    eqBass: 3.2,
    eqLowMid: 0.0,
    eqPresence: 1.5,
    eqAir: 2.2,
    stereoWidth: 1.35,
    compressionDrive: 0.65,
    warmTape: 0.45,
    presetName: 'Club & EDM Banger (-9 LUFS)',
  },
  'Warm Analog Vinyl': {
    targetLufs: -15,
    ceiling: -0.5,
    inputGain: 0.5,
    eqBass: 2.0,
    eqLowMid: 1.2,
    eqPresence: -0.8,
    eqAir: 0.5,
    stereoWidth: 1.05,
    compressionDrive: 0.4,
    warmTape: 0.7,
    presetName: 'Warm Analog Vinyl (-15 LUFS)',
  },
  'Vocal Focus Pop': {
    targetLufs: -12,
    ceiling: -0.2,
    inputGain: 2.0,
    eqBass: 0.5,
    eqLowMid: -1.2,
    eqPresence: 2.5,
    eqAir: 2.0,
    stereoWidth: 1.15,
    compressionDrive: 0.45,
    warmTape: 0.2,
    presetName: 'Vocal Focus Pop (-12 LUFS)',
  },
  'Acoustic Audiophile': {
    targetLufs: -16,
    ceiling: -0.8,
    inputGain: 0.0,
    eqBass: 0.0,
    eqLowMid: 0.0,
    eqPresence: 0.5,
    eqAir: 1.0,
    stereoWidth: 1.0,
    compressionDrive: 0.15,
    warmTape: 0.1,
    presetName: 'Acoustic Audiophile (-16 LUFS)',
  },
};
