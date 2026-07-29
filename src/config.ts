export const COLORS = {
  background: '#0f0f11',
  sidebar: '#161618',
  card: '#1e1e21',
  hover: '#252528',
  text: '#e8e8ea',
  textMuted: '#6b6b72',
  accent: '#4ade80',
  accentDark: '#1D9E75',
  blue: '#60a5fa',
  red: '#f87171',
  border: '#2a2a2e',
} as const;

export const STORAGE_KEYS = {
  session: 'session',
  username: 'username',
  sessionCookie: 'sessionCookie',
  uploadedLocalIds: 'uploadedLocalIds',
  lastSync: 'lastSync',
  cachedFiles: (type: string) => `cachedFiles:${type}`,
  cachedAlbums: 'cachedAlbums',
  cachedRecipes: 'cachedRecipes',
} as const;
