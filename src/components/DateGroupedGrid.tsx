import React from 'react';
import {
  SectionList, View, Image, StyleSheet, Text, TouchableOpacity,
  Dimensions, RefreshControl,
} from 'react-native';
import { COLORS } from '../config';
import { authHeaders } from '../api/client';
import { chunkSections, groupByDay, parseServerDate } from '../utils/date';
import type { MCloudFile } from '../types';

const SCREEN_WIDTH = Dimensions.get('window').width;
const COLUMNS = 3;
const GAP = 2;
export const GRID_THUMB_SIZE = (SCREEN_WIDTH - GAP * (COLUMNS - 1)) / COLUMNS;
const IMAGE_SIZE = GRID_THUMB_SIZE;

interface Props {
  files: MCloudFile[];
  thumbnailUri?: (file: MCloudFile) => string;
  renderThumbnail?: (file: MCloudFile) => React.ReactNode;
  onPress: (file: MCloudFile) => void;
  onLongPress?: (file: MCloudFile) => void;
  renderBadge?: (file: MCloudFile) => React.ReactNode;
  refreshing: boolean;
  onRefresh: () => void;
}

export default function DateGroupedGrid({
  files, thumbnailUri, renderThumbnail, onPress, onLongPress, renderBadge, refreshing, onRefresh,
}: Props) {
  const sections = chunkSections<MCloudFile>(
    groupByDay<MCloudFile>(files, (f: MCloudFile) => parseServerDate(f.upload_date)),
    COLUMNS,
  );

  return (
    <SectionList<MCloudFile[]>
      sections={sections}
      keyExtractor={(row: MCloudFile[], index: number) => row.map(f => f.id).join('-') || `row-${index}`}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionHeader}>{section.title}</Text>
      )}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((file: MCloudFile) => (
            <TouchableOpacity
              key={file.id}
              onPress={() => onPress(file)}
              onLongPress={() => onLongPress?.(file)}
              style={styles.thumbWrap}>
              {renderThumbnail
                ? renderThumbnail(file)
                : <Image source={{ uri: thumbnailUri?.(file), headers: authHeaders() }} style={styles.image} />}
              {renderBadge?.(file)}
            </TouchableOpacity>
          ))}
        </View>
      )}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.accent} />
      }
      contentContainerStyle={files.length === 0 ? styles.emptyContainer : undefined}
      ListEmptyComponent={<Text style={styles.emptyText}>Ingen filer endnu</Text>}
      stickySectionHeadersEnabled={false}
    />
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    backgroundColor: COLORS.background,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 6,
    textTransform: 'capitalize',
  },
  row: { flexDirection: 'row', gap: GAP, paddingHorizontal: 0 },
  thumbWrap: { marginBottom: GAP },
  image: { width: IMAGE_SIZE, height: IMAGE_SIZE, backgroundColor: COLORS.card },
  emptyContainer: { flexGrow: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: COLORS.textMuted, fontSize: 14 },
});
