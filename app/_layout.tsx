import FontAwesome from '@expo/vector-icons/FontAwesome';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { Platform, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import 'react-native-reanimated';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';

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
  const colors = Colors[colorScheme ?? 'light'];
  const hasHydrated = useStore((s) => s.hasHydrated);
  const initializeCloudSync = useStore((s) => s.initializeCloudSync);
  const toast = useStore((s) => s.toast);
  const pathname = usePathname();
  const isItemScreen = pathname.startsWith('/item/');

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const AppContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;
  const toastBackground =
    toast?.tone === 'warning'
      ? colors.warning
      : toast?.tone === 'destructive'
      ? colors.destructive
      : colors.success;

  useEffect(() => {
    if (hasHydrated) {
      initializeCloudSync();
    }
  }, [hasHydrated, initializeCloudSync]);

  return (
    <AppContainer style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: colors.background,
            },
            headerTintColor: colors.text,
            headerShadowVisible: false,
            headerBackButtonDisplayMode: 'minimal',
            contentStyle: {
              backgroundColor: colors.background,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="add"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              headerTitle: 'Add Item',
            }}
          />
          <Stack.Screen
            name="import"
            options={{
              presentation: Platform.OS === 'web' ? 'card' : 'modal',
              headerTitle: 'Bulk Import JSON',
            }}
          />
          <Stack.Screen
            name="waiting-approval"
            options={{
              headerTitle: 'Waiting Approval',
            }}
          />
          <Stack.Screen
            name="item/[id]"
            options={{
              headerTitle: 'Item Detail',
              headerTitleAlign: 'center',
              headerTitleStyle: {
                fontSize: 15,
                fontWeight: '700',
              },
              headerStyle: {
                backgroundColor: colors.background,
              },
            }}
          />
        </Stack>
        {toast ? (
          <View
            pointerEvents="none"
            style={[
              styles.toastViewport,
              isItemScreen ? styles.toastViewportTop : styles.toastViewportBottom,
            ]}
          >
            <View
              style={[
                styles.toastCard,
                {
                  backgroundColor: toastBackground,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={styles.toastText}>{toast.message}</Text>
            </View>
          </View>
        ) : null}
      </ThemeProvider>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  toastViewport: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 100,
  },
  toastViewportTop: {
    bottom: 90,
  },
  toastViewportBottom: {
    bottom: 28,
  },
  toastCard: {
    minWidth: 180,
    maxWidth: 420,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
});
