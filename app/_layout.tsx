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
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
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
  const { width } = useWindowDimensions();
  const hasHydrated = useStore((s) => s.hasHydrated);
  const initializeCloudSync = useStore((s) => s.initializeCloudSync);
  const toast = useStore((s) => s.toast);
  const webViewportMode = useStore(
    (s) => s.settings.webViewportMode ?? 'desktop'
  );
  const pathname = usePathname();
  const isItemScreen = pathname.startsWith('/item/');

  const navTheme = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
  const AppContainer = Platform.OS === 'web' ? View : GestureHandlerRootView;
  const isDesktopWeb = Platform.OS === 'web' && width >= 900;
  const isIphoneViewport = isDesktopWeb && webViewportMode === 'iphone';
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

  const appContent = (
    <>
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
    </>
  );

  return (
    <AppContainer style={{ flex: 1 }}>
      <ThemeProvider value={navTheme}>
        <View
          style={[
            styles.appCanvas,
            {
              backgroundColor: isIphoneViewport ? '#F3F4F6' : colors.background,
            },
          ]}
        >
          {isIphoneViewport ? (
            <View style={[styles.phoneShell, { shadowColor: '#000000' }]}>
              <View style={styles.phoneSideButtonsLeft}>
                <View style={styles.phoneSideButtonShort} />
                <View style={styles.phoneSideButtonLong} />
                <View style={styles.phoneSideButtonLong} />
              </View>
              <View style={styles.phoneSideButtonsRight}>
                <View style={styles.phoneSideButtonPower} />
              </View>
              <View style={styles.phoneIslandWrap} pointerEvents="none">
                <View style={styles.phoneIsland}>
                  <View style={styles.phoneSpeaker} />
                  <View style={styles.phoneCamera} />
                </View>
              </View>
              <View
                style={[
                  styles.appFramePhonePreview,
                  {
                    borderColor: colors.borderLight,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                {appContent}
              </View>
            </View>
          ) : (
            <View style={[styles.appFrame, styles.appFrameDesktop]}>
              {appContent}
            </View>
          )}
        </View>
      </ThemeProvider>
    </AppContainer>
  );
}

const styles = StyleSheet.create({
  appCanvas: {
    flex: 1,
    alignItems: 'center',
  },
  appFrame: {
    flex: 1,
    alignSelf: 'stretch',
  },
  appFramePhonePreview: {
    width: 430,
    maxWidth: '100%',
    flex: 1,
    alignSelf: 'center',
    borderRadius: 34,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  appFrameDesktop: {
    width: '100%',
  },
  phoneShell: {
    width: 458,
    maxWidth: '100%',
    flex: 1,
    alignSelf: 'center',
    marginVertical: 10,
    paddingTop: 18,
    paddingBottom: 14,
    paddingHorizontal: 12,
    borderRadius: 44,
    backgroundColor: '#0E1013',
    position: 'relative',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 48,
    elevation: 12,
  },
  phoneIslandWrap: {
    position: 'absolute',
    top: 7,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 3,
  },
  phoneIsland: {
    width: 116,
    height: 28,
    borderRadius: 16,
    backgroundColor: '#050608',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  phoneSpeaker: {
    width: 38,
    height: 6,
    borderRadius: 999,
    backgroundColor: '#1E2228',
  },
  phoneCamera: {
    width: 10,
    height: 10,
    borderRadius: 999,
    backgroundColor: '#151A21',
    borderWidth: 1,
    borderColor: '#20262D',
  },
  phoneSideButtonsLeft: {
    position: 'absolute',
    left: -3,
    top: 138,
    gap: 10,
  },
  phoneSideButtonsRight: {
    position: 'absolute',
    right: -3,
    top: 182,
  },
  phoneSideButtonShort: {
    width: 4,
    height: 28,
    borderRadius: 999,
    backgroundColor: '#1D2127',
  },
  phoneSideButtonLong: {
    width: 4,
    height: 56,
    borderRadius: 999,
    backgroundColor: '#1D2127',
  },
  phoneSideButtonPower: {
    width: 4,
    height: 88,
    borderRadius: 999,
    backgroundColor: '#1D2127',
  },
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
