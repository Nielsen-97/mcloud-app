import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'customRecipeTags';

export async function loadCustomTags(): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

export async function addCustomTag(tag: string): Promise<string[]> {
  const normalized = tag.trim().toLowerCase();
  const current = await loadCustomTags();
  if (!normalized || current.includes(normalized)) return current;
  const updated = [...current, normalized];
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}

export async function removeCustomTag(tag: string): Promise<string[]> {
  const current = await loadCustomTags();
  const updated = current.filter(t => t !== tag);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  return updated;
}
