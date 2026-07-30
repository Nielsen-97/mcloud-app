export type FileType = 'billede' | 'video' | 'dokument';

export interface MCloudFile {
  id: number;
  filename: string;
  original_name: string;
  size: number;
  filetype: FileType;
  owner: string;
  album_id: number | null;
  upload_date: string | null;
}

export interface Album {
  id: number;
  name: string;
  owner: string;
  is_shared: boolean;
  created_date?: string;
  cover_image?: string | null;
  share_token?: string | null;
}

export interface StorageStats {
  total: number;
  used: number;
  free: number;
}

export interface FileStats {
  billede?: number;
  video?: number;
  dokument?: number;
  [key: string]: number | undefined;
}

export interface BackupStatus {
  last_backup: string | null;
  status: 'ok' | 'running' | 'failed' | 'never';
  destination?: string;
}

/** Predefined starter tags — users can add their own on top of these (see services/customTags.ts). */
export const RECIPE_TAGS = [
  'aftensmad', 'frokost', 'morgenmad', 'kage', 'brød',
  'pizza', 'hurtig', 'vegetar', 'dessert', 'suppe', 'fisk', 'andet',
];

export type RecipeTag = string;

export interface Recipe {
  id: number;
  title: string;
  url: string;
  tags: RecipeTag[];
  snapshot_filename: string | null;
  thumbnail_url: string | null;
  added_by: string;
  created_date: string;
}

