import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

interface TabBarVisibilityContextValue {
  isTabBarHidden: boolean;
  hideTabBar: () => void;
  showTabBar: () => void;
}

const TabBarVisibilityContext =
  createContext<TabBarVisibilityContextValue | null>(null);

export function TabBarVisibilityProvider({
  children,
}: PropsWithChildren) {
  const [isTabBarHidden, setIsTabBarHidden] = useState(false);

  const hideTabBar = useCallback(() => {
    setIsTabBarHidden(true);
  }, []);

  const showTabBar = useCallback(() => {
    setIsTabBarHidden(false);
  }, []);

  const value = useMemo(
    () => ({
      isTabBarHidden,
      hideTabBar,
      showTabBar,
    }),
    [hideTabBar, isTabBarHidden, showTabBar]
  );

  return (
    <TabBarVisibilityContext.Provider value={value}>
      {children}
    </TabBarVisibilityContext.Provider>
  );
}

export function useTabBarVisibility() {
  const context = useContext(TabBarVisibilityContext);

  if (!context) {
    throw new Error(
      'useTabBarVisibility must be used within TabBarVisibilityProvider'
    );
  }

  return context;
}

export function useTabBarScrollHandler() {
  const { hideTabBar, isTabBarHidden, showTabBar } = useTabBarVisibility();
  const lastOffsetRef = useRef(0);
  const hiddenRef = useRef(isTabBarHidden);

  hiddenRef.current = isTabBarHidden;

  useFocusEffect(
    useCallback(() => {
      showTabBar();
      lastOffsetRef.current = 0;

      return () => {
        showTabBar();
      };
    }, [showTabBar])
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offsetY = Math.max(event.nativeEvent.contentOffset.y, 0);
      const deltaY = offsetY - lastOffsetRef.current;

      if (offsetY <= 24) {
        if (hiddenRef.current) {
          showTabBar();
        }
        lastOffsetRef.current = offsetY;
        return;
      }

      if (deltaY > 14 && !hiddenRef.current) {
        hideTabBar();
        hiddenRef.current = true;
      } else if (deltaY < -14 && hiddenRef.current) {
        showTabBar();
        hiddenRef.current = false;
      }

      lastOffsetRef.current = offsetY;
    },
    [hideTabBar, showTabBar]
  );

  // On web, skip the JS scroll handler entirely — it blocks native scroll
  // momentum on Safari and causes jank. The tab bar stays always visible.
  if (Platform.OS === 'web') {
    return {};
  }

  return {
    onScroll,
    scrollEventThrottle: 16 as const,
  };
}
