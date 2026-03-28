import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';

/**
 * On web (iPhone viewport), portals modal content into #phone-overlay-root,
 * which sits above the tab bar but is clipped to the phone frame bounds.
 * On native, renders nothing (use Modal instead).
 * Falls back to rendering in-tree if the portal target isn't mounted yet.
 */
export function WebPortal({
  visible,
  children,
}: {
  visible: boolean;
  children: React.ReactNode;
}) {
  if (Platform.OS !== 'web' || !visible) return null;

  if (typeof document === 'undefined') return null;

  // Lazy-require to keep native bundle clean
  let createPortal: typeof import('react-dom').createPortal;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    createPortal = require('react-dom').createPortal;
  } catch {
    return <View style={StyleSheet.absoluteFillObject}>{children}</View>;
  }

  const target = document.getElementById('phone-overlay-root');
  if (!target) {
    // Fallback: render in-tree (e.g. non-iPhone-viewport desktop web)
    return <View style={StyleSheet.absoluteFillObject}>{children}</View>;
  }

  return createPortal(
    <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
      {children}
    </View>,
    target,
  ) as React.ReactElement;
}
