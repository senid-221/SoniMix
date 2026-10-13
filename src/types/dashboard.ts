export type UserRole = 'user' | 'producer' | 'admin';
export type PlanTier = 'Free' | 'Pro' | 'Studio' | 'Account';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  plan: PlanTier;
  storageUsedMb: number;
  storageLimitMb: number;
  totalBounces: number;
  totalProjects: number;
  joinedDate: string;
  preferences: {
    defaultSampleRate: number;
    defaultTargetLufs: number;
    defaultBitDepth: 16 | 24;
    autoSaveEnabled: boolean;
  };
}

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  plan: PlanTier;
  joinedDate: string;
  storageUsedMb: number;
  bouncesCount: number;
  status: 'active' | 'suspended';
  lastActive: string;
}

export interface AppConfig {
  customLogoUrl: string | null;
  customFaviconUrl: string | null;
  brandName: string;
  pageTitle: string;
  heroHeadline: string;
  heroSubtitle: string;
  sectionTitles: {
    studiosHeadline: string;
    studiosSubtitle: string;
    pricingHeadline: string;
    pricingSubtitle: string;
    faqHeadline: string;
  };
  studioTitles: {
    mixer: string;
    mastering: string;
    stems: string;
    cover: string;
    resampler: string;
  };
  customIcons: Record<string, string>; // toolKey -> dataUrl/image
  maxUploadSizeMb: number;
  freeMasteringQuota: number;
  maintenanceMode: boolean;
  announcementText: string;
}
