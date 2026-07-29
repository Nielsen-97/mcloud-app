import type { RecipeTag } from '../types';

const TAG_ICONS: Record<RecipeTag, string> = {
  aftensmad: '🍽️',
  frokost: '🥪',
  morgenmad: '🍳',
  kage: '🎂',
  brød: '🍞',
  pizza: '🍕',
  hurtig: '⚡',
  vegetar: '🥦',
  dessert: '🍨',
  suppe: '🍲',
  fisk: '🐟',
  andet: '🍴',
};

/** First tag determines the list icon, falling back to a generic plate. */
export function iconForTags(tags: RecipeTag[]): string {
  return TAG_ICONS[tags[0]] ?? '🍴';
}

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}
