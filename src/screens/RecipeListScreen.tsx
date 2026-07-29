import React, { useCallback, useEffect, useState } from 'react';
import {
  View, FlatList, Text, StyleSheet, ActivityIndicator, TouchableOpacity,
  Modal, TextInput, Alert, RefreshControl, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import FileViewer from 'react-native-file-viewer';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as api from '../api/client';
import { authHeaders, recipeSnapshotUrl } from '../api/client';
import { COLORS, STORAGE_KEYS } from '../config';
import { RECIPE_TAGS } from '../types';
import type { Recipe, RecipeTag } from '../types';
import { iconForTags, domainFromUrl } from '../utils/recipeIcons';
import type { RecipeStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeList'>;

const CACHE_KEY = STORAGE_KEYS.cachedRecipes;

export default function RecipeListScreen({ navigation }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [activeTag, setActiveTag] = useState<RecipeTag | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [openingSnapshotId, setOpeningSnapshotId] = useState<number | null>(null);

  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [fetchingTitle, setFetchingTitle] = useState(false);
  const [selectedTags, setSelectedTags] = useState<RecipeTag[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    try {
      const data = await api.getRecipes();
      setRecipes(data);
      setOffline(false);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        setRecipes(JSON.parse(cached));
        setOffline(true);
      }
    }
    isRefresh ? setRefreshing(false) : setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = activeTag ? recipes.filter(r => r.tags.includes(activeTag)) : recipes;

  const resetModal = () => {
    setUrl('');
    setTitle('');
    setSelectedTags([]);
    setModalVisible(false);
  };

  const fetchTitle = async () => {
    if (!url.trim()) return;
    setFetchingTitle(true);
    try {
      const result = await api.previewRecipeTitle(url.trim());
      setTitle(result.title);
    } catch {
      Alert.alert('Fejl', 'Kunne ikke hente titel fra siden — udfyld den manuelt.');
    }
    setFetchingTitle(false);
  };

  const toggleTag = (tag: RecipeTag) => {
    setSelectedTags(prev => (prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]));
  };

  const saveRecipe = async () => {
    if (!url.trim() || !title.trim()) return;
    setSaving(true);
    try {
      await api.createRecipe(url.trim(), title.trim(), selectedTags);
      resetModal();
      await load();
    } catch {
      Alert.alert('Fejl', 'Kunne ikke gemme opskriften');
    }
    setSaving(false);
  };

  const confirmDelete = (recipe: Recipe) => {
    Alert.alert('Slet opskrift', `Slet "${recipe.title}"?`, [
      { text: 'Annuller', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteRecipe(recipe.id);
            setRecipes(prev => prev.filter(r => r.id !== recipe.id));
          } catch {
            Alert.alert('Fejl', 'Kunne ikke slette opskriften');
          }
        },
      },
    ]);
  };

  const openSnapshot = async (recipe: Recipe) => {
    if (!recipe.snapshot_filename) {
      Alert.alert('Ikke tilgængelig', 'Der er ikke gemt et PDF-snapshot for denne opskrift.');
      return;
    }
    setOpeningSnapshotId(recipe.id);
    try {
      const dest = `${RNFS.TemporaryDirectoryPath}/${recipe.snapshot_filename}`;
      await RNFS.downloadFile({
        fromUrl: recipeSnapshotUrl(recipe.id),
        toFile: dest,
        headers: authHeaders(),
      }).promise;
      await FileViewer.open(dest);
    } catch {
      Alert.alert('Fejl', 'Kunne ikke åbne PDF-snapshot');
    }
    setOpeningSnapshotId(null);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.accent} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {offline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>Offline — viser cachede opskrifter</Text>
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tagFilterRow}>
        <TouchableOpacity
          style={[styles.tagChip, !activeTag && styles.tagChipActive]}
          onPress={() => setActiveTag(null)}>
          <Text style={[styles.tagChipText, !activeTag && styles.tagChipTextActive]}>Alle</Text>
        </TouchableOpacity>
        {RECIPE_TAGS.map(tag => (
          <TouchableOpacity
            key={tag}
            style={[styles.tagChip, activeTag === tag && styles.tagChipActive]}
            onPress={() => setActiveTag(tag === activeTag ? null : tag)}>
            <Text style={[styles.tagChipText, activeTag === tag && styles.tagChipTextActive]}>{tag}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <FlatList
        data={filtered}
        keyExtractor={item => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={COLORS.accent} />
        }
        ListEmptyComponent={<Text style={styles.emptyText}>Ingen opskrifter endnu</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate('RecipeWebView', { recipe: item })}
            onLongPress={() => confirmDelete(item)}>
            <Text style={styles.icon}>{iconForTags(item.tags)}</Text>
            <View style={styles.info}>
              <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
              <Text style={styles.domain}>{domainFromUrl(item.url)}</Text>
              <View style={styles.tagRow}>
                {item.tags.map(tag => (
                  <Text key={tag} style={styles.tagBadge}>{tag}</Text>
                ))}
              </View>
            </View>
            <TouchableOpacity
              style={styles.pdfButton}
              onPress={() => openSnapshot(item)}
              disabled={openingSnapshotId === item.id}>
              {openingSnapshotId === item.id ? (
                <ActivityIndicator size="small" color={COLORS.accent} />
              ) : (
                <Text style={styles.pdfButtonText}>PDF</Text>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={resetModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView>
              <Text style={styles.modalTitle}>Ny opskrift</Text>
              <TextInput
                style={styles.input}
                placeholder="URL"
                placeholderTextColor={COLORS.textMuted}
                value={url}
                onChangeText={setUrl}
                autoCapitalize="none"
                keyboardType="url"
              />
              <TouchableOpacity style={styles.fetchButton} onPress={fetchTitle} disabled={fetchingTitle}>
                <Text style={styles.fetchButtonText}>
                  {fetchingTitle ? 'Henter titel…' : 'Hent titel automatisk'}
                </Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.input, styles.inputSpaced]}
                placeholder="Titel"
                placeholderTextColor={COLORS.textMuted}
                value={title}
                onChangeText={setTitle}
              />
              <Text style={styles.tagPickerLabel}>Tags</Text>
              <View style={styles.tagPicker}>
                {RECIPE_TAGS.map(tag => (
                  <TouchableOpacity
                    key={tag}
                    style={[styles.tagChip, selectedTags.includes(tag) && styles.tagChipActive]}
                    onPress={() => toggleTag(tag)}>
                    <Text style={[styles.tagChipText, selectedTags.includes(tag) && styles.tagChipTextActive]}>
                      {tag}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.modalButton} onPress={resetModal}>
                  <Text style={styles.modalButtonText}>Annuller</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.modalButtonPrimary]}
                  onPress={saveRecipe}
                  disabled={saving}>
                  <Text style={styles.modalButtonText}>{saving ? 'Gemmer…' : 'Gem'}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
  offlineBanner: {
    backgroundColor: '#3a2020', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  offlineText: { color: COLORS.text, fontSize: 12, fontWeight: '600' },
  tagFilterRow: {
    flexGrow: 0, paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  tagChip: {
    backgroundColor: COLORS.card, paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16, marginRight: 8,
  },
  tagChipActive: { backgroundColor: COLORS.accentDark },
  tagChipText: { color: COLORS.textMuted, fontSize: 12 },
  tagChipTextActive: { color: '#fff', fontWeight: '600' },
  row: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  icon: { fontSize: 26, marginRight: 14 },
  info: { flex: 1 },
  title: { color: COLORS.text, fontSize: 15, fontWeight: '600' },
  domain: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  tagBadge: {
    color: COLORS.blue, fontSize: 10, backgroundColor: COLORS.card,
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  pdfButton: {
    backgroundColor: COLORS.card, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: 8, marginLeft: 10,
  },
  pdfButtonText: { color: COLORS.accent, fontSize: 11, fontWeight: '700' },
  emptyText: { color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  fab: {
    position: 'absolute', right: 20, bottom: 24, width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.accentDark, justifyContent: 'center', alignItems: 'center',
  },
  fabText: { color: '#fff', fontSize: 28, marginTop: -2 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: COLORS.sidebar, borderTopLeftRadius: 16, borderTopRightRadius: 16,
    padding: 20, maxHeight: '85%',
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700', marginBottom: 16 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, padding: 12, borderRadius: 10, fontSize: 15 },
  inputSpaced: { marginTop: 12 },
  fetchButton: {
    backgroundColor: COLORS.card, paddingVertical: 10, borderRadius: 10,
    alignItems: 'center', marginTop: 8,
  },
  fetchButtonText: { color: COLORS.accent, fontWeight: '600', fontSize: 13 },
  tagPickerLabel: { color: COLORS.textMuted, fontSize: 12, textTransform: 'uppercase', marginTop: 16, marginBottom: 8 },
  tagPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 20 },
  modalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  modalButtonPrimary: { backgroundColor: COLORS.accentDark },
  modalButtonText: { color: COLORS.text, fontWeight: '600' },
});
