import React, { useRef, useEffect, useCallback } from 'react';
import { Platform, View, StyleProp, ViewStyle } from 'react-native';
import { TouchableOpacity } from 'react-native-gesture-handler';

interface WebSafeButtonProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  activeOpacity?: number;
  children: React.ReactNode;
}

/**
 * A button component that bypasses React Native's touch system on web.
 *
 * On web, GestureHandlerRootView can intercept all pointer events, making
 * React Native touch components (TouchableOpacity, Pressable) completely
 * unresponsive. This component works around that by rendering a React Native
 * View (for style compatibility) but attaching a native DOM click handler
 * directly via addEventListener, bypassing both React Native's touch system
 * and React's synthetic event system entirely.
 *
 * On native (iOS/Android), it renders a standard TouchableOpacity from
 * react-native-gesture-handler.
 */
export default function WebSafeButton({
  onPress,
  style,
  activeOpacity = 0.7,
  children,
}: WebSafeButtonProps) {
  if (Platform.OS === 'web') {
    return (
      <WebButton onPress={onPress} style={style}>
        {children}
      </WebButton>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={style}
      activeOpacity={activeOpacity}
    >
      {children}
    </TouchableOpacity>
  );
}

/**
 * Web-only inner component. Uses a React Native View for style compatibility
 * with react-native-web, but attaches a raw DOM click listener via
 * addEventListener to completely bypass GestureHandlerRootView's pointer
 * event interception.
 */
function WebButton({
  onPress,
  style,
  children,
}: {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const viewRef = useRef<View>(null);

  // Stable ref to always call the latest onPress without re-attaching the listener
  const onPressRef = useRef(onPress);
  useEffect(() => {
    onPressRef.current = onPress;
  }, [onPress]);

  const handleClick = useCallback((e: Event) => {
    e.stopPropagation();
    onPressRef.current();
  }, []);

  useEffect(() => {
    // In react-native-web, the View ref resolves to a real DOM element
    const node = viewRef.current as unknown as HTMLElement | null;
    if (!node) return;

    node.addEventListener('click', handleClick, true);

    // Apply web-specific styles directly on the DOM node so they are not
    // filtered out by react-native-web's style processing.
    node.style.cursor = 'pointer';
    node.style.userSelect = 'none';
    // @ts-ignore – webkit prefix for Safari
    node.style.webkitUserSelect = 'none';

    return () => {
      node.removeEventListener('click', handleClick, true);
    };
  }, [handleClick]);

  return (
    <View ref={viewRef} style={style}>
      {children}
    </View>
  );
}
