import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  PriorityCode,
  PriorityLabel,
  getPriorityDefinition,
} from '@/lib/types';

interface PriorityBadgeProps {
  priorityCode: PriorityCode;
  priorityLabel?: PriorityLabel;
  compact?: boolean;
}

export default function PriorityBadge({
  priorityCode,
  priorityLabel,
  compact = false,
}: PriorityBadgeProps) {
  const priority = getPriorityDefinition(priorityCode);

  return (
    <View
      style={[
        styles.badge,
        compact && styles.badgeCompact,
        { backgroundColor: priority.color + '18' },
      ]}
    >
      <View
        style={[
          styles.dot,
          compact && styles.dotCompact,
          { backgroundColor: priority.color },
        ]}
      />
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          { color: priority.color },
        ]}
      >
        {priorityLabel ?? priority.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  badgeCompact: {
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotCompact: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
  },
  textCompact: {
    fontSize: 11,
  },
});
