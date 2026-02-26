import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';

export { ErrorBoundary } from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    ...FontAwesome.font,
    ...Ionicons.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const AppContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;

  return (
    <AppContainer style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              headerTitle: 'Add Item',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="import"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              headerTitle: 'Bulk Import JSON',
              headerShadowVisible: false,
            }}
          />
          <Stack.Screen
            name="item/[id]"
            options={{
              headerTitle: '',
              headerBackTitle: 'Back',
              headerShadowVisible: false,
            }}
          />
        </Stack>
      </ThemeProvider>
    </AppContainer>
  );
}
