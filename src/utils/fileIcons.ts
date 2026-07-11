const ICONS: Record<string, string> = {
  pdf: '📕',
  doc: '📘', docx: '📘',
  xls: '📗', xlsx: '📗',
  ppt: '📙', pptx: '📙',
  txt: '📄',
  zip: '🗜️', rar: '🗜️',
  csv: '📊',
};

export function iconForFilename(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ICONS[ext] ?? '📄';
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exp);
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`;
}
