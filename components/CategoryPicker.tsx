import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, useColorScheme } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { Category } from '@/lib/types';

interface CategoryPickerProps {
  categories: Category[];
  selectedCategoryId: string | null;
  onSelect: (categoryId: string) => void;
  compact?: boolean;
}

export default function CategoryPicker({
  categories,
  selectedCategoryId,
  onSelect,
  compact = false,
}: CategoryPickerProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  return (
    <View style={styles.categoryGrid}>
      {categories.map((cat) => {
        const isSelected = selectedCategoryId === cat.id;
        return (
          <TouchableOpacity
            key={cat.id}
            onPress={() => onSelect(cat.id)}
            style={[
              styles.categoryCard,
              compact && styles.categoryCardCompact,
              {
                backgroundColor: isSelected ? cat.color + '18' : colors.surface,
                borderColor: isSelected ? cat.color : colors.border,
                borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={cat.icon as any}
              size={compact ? 18 : 22}
              color={isSelected ? cat.color : colors.textTertiary}
            />
            <Text
              style={[
                styles.categoryLabel,
                compact && styles.categoryLabelCompact,
                {
                  color: isSelected ? cat.color : colors.textSecondary,
                  fontWeight: isSelected ? '600' : '400',
                },
              ]}
            >
              {cat.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    minWidth: 90,
    gap: 4,
  },
  categoryCardCompact: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    minWidth: 78,
  },
  categoryLabel: {
    fontSize: 13,
  },
  categoryLabelCompact: {
    fontSize: 12,
  },
});
