import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AlbumListScreen from './AlbumListScreen';
import AlbumDetailScreen from './AlbumDetailScreen';
import { COLORS } from '../config';
import type { AlbumStackParamList } from '../navigation/types';

const Stack = createNativeStackNavigator<AlbumStackParamList>();

export default function AlbumStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.sidebar },
        headerTintColor: COLORS.text,
      }}>
      <Stack.Screen name="AlbumList" component={AlbumListScreen} options={{ title: 'Albums' }} />
      <Stack.Screen name="AlbumDetail" component={AlbumDetailScreen} />
    </Stack.Navigator>
  );
}
