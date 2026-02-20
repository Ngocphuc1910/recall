import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';

export default function AddScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const categories = useStore((s) => s.categories);
  const addItem = useStore((s) => s.addItem);

  const [content, setContent] = useState('');
  const [detail, setDetail] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'other');

  const canSave = content.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    addItem({
      content: content.trim(),
      detail: detail.trim(),
      source: source.trim(),
      categoryId,
    });
    router.back();
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            CONTENT
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.contentInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            placeholder="What do you want to remember?"
            placeholderTextColor={colors.textTertiary}
            value={content}
            onChangeText={setContent}
            multiline
            autoFocus
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            NOTES (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              styles.detailInput,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            placeholder="Add context, explanation, or notes..."
            placeholderTextColor={colors.textTertiary}
            value={detail}
            onChangeText={setDetail}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            SOURCE (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.surface,
                borderColor: colors.border,
              },
            ]}
            placeholder="Book title, article, course..."
            placeholderTextColor={colors.textTertiary}
            value={source}
            onChangeText={setSource}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>
            CATEGORY
          </Text>
          <View style={styles.categoryGrid}>
            {categories.map((cat) => {
              const isSelected = categoryId === cat.id;
              return (
                <TouchableOpacity
                  key={cat.id}
                  onPress={() => setCategoryId(cat.id)}
                  style={[
                    styles.categoryCard,
                    {
                      backgroundColor: isSelected
                        ? cat.color + '18'
                        : colors.surface,
                      borderColor: isSelected ? cat.color : colors.border,
                      borderWidth: isSelected ? 1.5 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  <Ionicons
                    name={cat.icon as any}
                    size={22}
                    color={isSelected ? cat.color : colors.textTertiary}
                  />
                  <Text
                    style={[
                      styles.categoryLabel,
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
        </View>

        <TouchableOpacity
          onPress={handleSave}
          disabled={!canSave}
          style={[
            styles.saveButton,
            {
              backgroundColor: canSave ? colors.tint : colors.tint + '40',
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.saveButtonText}>Add Item</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },
  field: { marginBottom: 24 },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  contentInput: {
    minHeight: 80,
  },
  detailInput: {
    minHeight: 60,
  },
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
  categoryLabel: {
    fontSize: 13,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 14,
    marginTop: 8,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
