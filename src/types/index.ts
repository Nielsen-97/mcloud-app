export type FileType = 'billede' | 'video' | 'dokument';

export interface MCloudFile {
  id: number;
  filename: string;
  original_name: string;
  size: number;
  filetype: FileType;
  owner: string;
  album_id: number | null;
  upload_date: string;
}

export interface Album {
  id: number;
  name: string;
  owner: string;
  is_shared: boolean;
  shared_with: string[];
  cover_filename?: string | null;
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

export interface MCloudUser {
  username: string;
}
