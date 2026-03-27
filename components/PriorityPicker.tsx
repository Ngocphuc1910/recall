import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import Colors from '@/constants/Colors';
import {
  PRIORITY_DEFINITIONS,
  PriorityCode,
  getPriorityDefinition,
} from '@/lib/types';

interface PriorityPickerProps {
  selectedPriorityCode: PriorityCode;
  onSelect: (priorityCode: PriorityCode) => void;
  compact?: boolean;
}

export default function PriorityPicker({
  selectedPriorityCode,
  onSelect,
  compact = false,
}: PriorityPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.priorityGrid}>
      {PRIORITY_DEFINITIONS.map((priority) => {
        const isSelected = priority.code === selectedPriorityCode;
        const selected = getPriorityDefinition(priority.code);

        return (
          <TouchableOpacity
            key={priority.code}
            onPress={() => onSelect(priority.code)}
            style={[
              styles.priorityCard,
              compact && styles.priorityCardCompact,
              {
                backgroundColor: isSelected ? selected.color + '18' : colors.surface,
                borderColor: isSelected ? selected.color : colors.border,
                borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
            activeOpacity={0.8}
          >
            <View
              style={[
                styles.priorityDot,
                compact && styles.priorityDotCompact,
                { backgroundColor: selected.color },
              ]}
            />
            <Text
              style={[
                styles.priorityCode,
                compact && styles.priorityCodeCompact,
                {
                  color: isSelected ? selected.color : colors.textTertiary,
                },
              ]}
            >
              {priority.code}
            </Text>
            <Text
              style={[
                styles.priorityLabel,
                compact && styles.priorityLabelCompact,
                {
                  color: isSelected ? selected.color : colors.textSecondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}
            >
              {priority.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  priorityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  priorityCard: {
    minWidth: 96,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 3,
  },
  priorityCardCompact: {
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  priorityDotCompact: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  priorityCode: {
    fontSize: 12,
    fontWeight: '700',
  },
  priorityCodeCompact: {
    fontSize: 11,
  },
  priorityLabel: {
    fontSize: 13,
  },
  priorityLabelCompact: {
    fontSize: 12,
  },
});
