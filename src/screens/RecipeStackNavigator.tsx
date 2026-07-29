import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import RecipeListScreen from './RecipeListScreen';
import RecipeWebViewScreen from './RecipeWebViewScreen';
import { COLORS } from '../config';
import type { RecipeStackParamList } from '../navigation/types';

const Stack = createNativeStackNavigator<RecipeStackParamList>();

export default function RecipeStackNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.sidebar },
        headerTintColor: COLORS.text,
      }}>
      <Stack.Screen name="RecipeList" component={RecipeListScreen} options={{ title: 'Opskrifter' }} />
      <Stack.Screen name="RecipeWebView" component={RecipeWebViewScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}
