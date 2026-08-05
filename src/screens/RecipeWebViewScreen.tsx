import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../config';
import type { RecipeStackParamList } from '../navigation/types';

// react-native-webview's package export resolves to its platform-agnostic
// FunctionComponent type here rather than the ref-forwarding iOS-specific
// one, which makes TS reject the ref prop entirely. The component itself
// supports refs fine at runtime; this only works around the type mismatch.
const WebViewAny = WebView as unknown as React.ComponentType<any>;

type Props = NativeStackScreenProps<RecipeStackParamList, 'RecipeWebView'>;

export default function RecipeWebViewScreen({ route, navigation }: Props) {
  const { recipe } = route.params;
  const insets = useSafeAreaInsets();
  const webviewRef = useRef<{ goBack: () => void }>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [loading, setLoading] = useState(true);

  return (
    <View style={styles.container}>
      <View style={[styles.toolbar, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={styles.toolbarButton}
          onPress={() => (canGoBack ? webviewRef.current?.goBack() : navigation.goBack())}>
          <Text style={styles.toolbarButtonText}>{canGoBack ? '‹ Tilbage' : 'Luk'}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{recipe.title}</Text>
        <View style={styles.toolbarSpacer} />
      </View>
      <WebViewAny
        ref={webviewRef}
        source={{ uri: recipe.url }}
        onNavigationStateChange={(state: { canGoBack: boolean }) => setCanGoBack(state.canGoBack)}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
      />
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator color={COLORS.accent} size="large" />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.sidebar,
  },
  toolbarButton: { paddingVertical: 4, paddingRight: 12 },
  toolbarButtonText: { color: COLORS.accent, fontWeight: '600', fontSize: 15 },
  toolbarSpacer: { width: 60 },
  title: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: '600', textAlign: 'center' },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
});
