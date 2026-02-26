import React, { useEffect, useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import RecallCard from '@/components/RecallCard';
import EmptyState from '@/components/EmptyState';

export default function TodayScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isWeb = Platform.OS === 'web';
  const router = useRouter();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const addItem = useStore((s) => s.addItem);
  const markRecalled = useStore((s) => s.markRecalled);

  const [showAddModal, setShowAddModal] = useState(false);
  const [content, setContent] = useState('');
  const [detail, setDetail] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'other');

  useEffect(() => {
    if (!categories.find((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? 'other');
    }
  }, [categories, categoryId]);

  const todayItems = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const endOfToday = now.getTime();
    return items.filter(
      (item) => item.status === 'active' && item.nextReviewDate <= endOfToday
    );
  }, [items]);

  const canSave = content.trim().length > 0;

  const openAddModal = () => setShowAddModal(true);

  const closeAddModal = () => {
    setShowAddModal(false);
  };

  const resetAddForm = () => {
    setContent('');
    setDetail('');
    setSource('');
    setCategoryId(categories[0]?.id ?? 'other');
  };

  const handleSaveAdd = () => {
    if (!canSave) return;

    addItem({
      content: content.trim(),
      detail: detail.trim(),
      source: source.trim(),
      categoryId,
    });

    resetAddForm();
    closeAddModal();
  };

  const renderAddFormCard = () => (
    <View
      style={[
        styles.modalCard,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.modalHeader,
          { borderBottomColor: colors.borderLight },
        ]}
      >
        <Text style={[styles.modalTitle, { color: colors.text }]}>Add Item</Text>
        <TouchableOpacity onPress={closeAddModal} style={styles.closeButton}>
          <Ionicons
            name="close-outline"
            size={24}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.modalContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>CONTENT</Text>
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>NOTES (OPTIONAL)</Text>
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>SOURCE (OPTIONAL)</Text>
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
          <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
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
                      backgroundColor: isSelected ? cat.color + '18' : colors.surface,
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

        <View style={styles.modalActions}>
          <TouchableOpacity
            onPress={closeAddModal}
            style={[
              styles.cancelButton,
              { borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleSaveAdd}
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
        </View>
      </ScrollView>
    </View>
  );

  const renderAddOverlay = () => (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={closeAddModal} />
      <KeyboardAvoidingView
        style={styles.modalKeyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {renderAddFormCard()}
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Today</Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {todayItems.length === 0
              ? 'All caught up!'
              : `${todayItems.length} item${todayItems.length !== 1 ? 's' : ''} to recall`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={openAddModal}
          hitSlop={10}
          style={[styles.addButton, { backgroundColor: colors.tint }]}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {todayItems.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          title="You're all done!"
          subtitle="No items to recall today. Tap + to add new items and start building your memory."
        />
      ) : (
        <FlatList
          data={todayItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecallCard
              item={item}
              onPress={() => router.push(`/item/${item.id}`)}
              onRecall={() => markRecalled(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {isWeb ? (
        showAddModal ? (
          <View style={styles.webModalRoot}>{renderAddOverlay()}</View>
        ) : null
      ) : (
        <Modal
          visible={showAddModal}
          animationType="fade"
          transparent
          onRequestClose={closeAddModal}
        >
          {renderAddOverlay()}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    zIndex: 3,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 2,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
    shadowColor: '#007AFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
  },
  modalKeyboard: {
    width: '100%',
    alignItems: 'center',
  },
  webModalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 680,
    maxHeight: '92%',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  modalContent: {
    padding: 16,
    paddingBottom: 24,
  },
  field: { marginBottom: 20 },
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
  modalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  cancelButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
