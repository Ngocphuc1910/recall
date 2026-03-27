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
import { useTabBarScrollHandler } from '@/lib/tab-bar-visibility';
import RecallCard from '@/components/RecallCard';
import EmptyState from '@/components/EmptyState';
import CategoryPicker from '@/components/CategoryPicker';
import PriorityPicker from '@/components/PriorityPicker';
import { DEFAULT_PRIORITY_CODE, PriorityCode } from '@/lib/types';

export default function TodayScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const tabBarScroll = useTabBarScrollHandler();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const addItem = useStore((s) => s.addItem);
  const markRecalled = useStore((s) => s.markRecalled);

  const [showAddModal, setShowAddModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'today' | 'week' | 'month' | 'pastdue'>('today');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [content, setContent] = useState('');
  const [detail, setDetail] = useState('');
  const [source, setSource] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? 'other');
  const [priorityCode, setPriorityCode] =
    useState<PriorityCode>(DEFAULT_PRIORITY_CODE);

  useEffect(() => {
    if (!categories.find((c) => c.id === categoryId)) {
      setCategoryId(categories[0]?.id ?? 'other');
    }
  }, [categories, categoryId]);

  const filteredItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const DAY = 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (item.status !== 'active') return false;
      switch (filterMode) {
        case 'today':
          return item.nextReviewDate <= endOfToday;
        case 'week':
          return item.nextReviewDate <= endOfToday + 6 * DAY;
        case 'month':
          return item.nextReviewDate <= endOfToday + 29 * DAY;
        case 'pastdue':
          return item.nextReviewDate < startOfToday;
        default:
          return item.nextReviewDate <= endOfToday;
      }
    });
  }, [items, filterMode]);

  const filterTitles: Record<string, string> = {
    today: 'Today',
    week: 'This Week',
    month: 'This Month',
    pastdue: 'Past Due',
  };

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
    setPriorityCode(DEFAULT_PRIORITY_CODE);
  };

  const handleSaveAdd = () => {
    if (!canSave) return;

    addItem({
      content: content.trim(),
      detail: detail.trim(),
      source: source.trim(),
      categoryId,
      priorityCode,
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
          <CategoryPicker
            categories={categories}
            selectedCategoryId={categoryId}
            onSelect={setCategoryId}
          />
        </View>

        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>PRIORITY</Text>
          <PriorityPicker
            selectedPriorityCode={priorityCode}
            onSelect={setPriorityCode}
          />
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
        keyboardVerticalOffset={0}
      >
        <View
          style={[
            styles.sheetHandle,
            { backgroundColor: colors.textTertiary + '40' },
          ]}
        />
        {renderAddFormCard()}
      </KeyboardAvoidingView>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            {filterTitles[filterMode]}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            {filteredItems.length === 0
              ? filterMode === 'today'
                ? 'All caught up!'
                : filterMode === 'pastdue'
                ? 'Nothing past due!'
                : 'No items in this range'
              : `${filteredItems.length} item${filteredItems.length !== 1 ? 's' : ''} to recall`}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowFilterMenu(!showFilterMenu)}
          hitSlop={10}
          style={[
            styles.filterButton,
            {
              backgroundColor: filterMode !== 'today' ? colors.tint + '15' : colors.surface,
              borderColor: filterMode !== 'today' ? colors.tint + '30' : colors.border,
            },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons
            name="options-outline"
            size={18}
            color={filterMode !== 'today' ? colors.tint : colors.textSecondary}
          />
        </TouchableOpacity>
      </View>

      {showFilterMenu && (
        <>
          <Pressable
            style={styles.filterBackdrop}
            onPress={() => setShowFilterMenu(false)}
          />
          <View
            style={[
              styles.filterMenu,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                shadowColor: colors.shadow,
              },
            ]}
          >
            {([
              { key: 'today' as const, label: 'Today', icon: 'today-outline' as const },
              { key: 'week' as const, label: 'This Week', icon: 'calendar-outline' as const },
              { key: 'month' as const, label: 'This Month', icon: 'calendar-number-outline' as const },
              { key: 'pastdue' as const, label: 'Past Due', icon: 'alert-circle-outline' as const },
            ]).map((option) => {
              const active = filterMode === option.key;
              return (
                <TouchableOpacity
                  key={option.key}
                  onPress={() => {
                    setFilterMode(option.key);
                    setShowFilterMenu(false);
                  }}
                  style={[
                    styles.filterOption,
                    active && { backgroundColor: colors.tint + '12' },
                  ]}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={option.icon}
                    size={18}
                    color={active ? colors.tint : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.filterOptionText,
                      { color: active ? colors.tint : colors.text },
                      active && { fontWeight: '700' as const },
                    ]}
                  >
                    {option.label}
                  </Text>
                  {active && (
                    <Ionicons name="checkmark" size={16} color={colors.tint} />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="checkmark-done-outline"
          iconColor={colors.success}
          title={
            filterMode === 'today'
              ? "You're all done!"
              : filterMode === 'pastdue'
              ? 'Nothing past due!'
              : 'All clear!'
          }
          subtitle={
            filterMode === 'today'
              ? 'No items to recall today. Tap + to add new items and start building your memory.'
              : filterMode === 'pastdue'
              ? 'All your items are up to date. Great job!'
              : `No items due ${filterMode === 'week' ? 'this week' : 'this month'}. Check back later!`
          }
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          onScroll={tabBarScroll.onScroll}
          scrollEventThrottle={tabBarScroll.scrollEventThrottle}
          renderItem={({ item }) => (
            <RecallCard
              item={item}
              onPress={() =>
                router.push({
                  pathname: '/item/[id]',
                  params: {
                    id: item.id,
                    sourceView: 'today',
                    itemIds: filteredItems.map((entry) => entry.id).join(','),
                  },
                })
              }
              onRecall={() => markRecalled(item.id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        onPress={openAddModal}
        style={[
          styles.fab,
          { backgroundColor: colors.tint, shadowColor: colors.tint },
        ]}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {isWeb ? (
        showAddModal ? (
          <View style={styles.webModalRoot}>{renderAddOverlay()}</View>
        ) : null
      ) : (
        <Modal
          visible={showAddModal}
          animationType="slide"
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
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  filterBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9,
  },
  filterMenu: {
    position: 'absolute',
    top: 76,
    right: 20,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    zIndex: 10,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 8,
    minWidth: 190,
  },
  filterOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  filterOptionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 5,
  },
  list: {
    paddingTop: 8,
    paddingBottom: 40,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  modalKeyboard: {
    width: '100%',
    maxHeight: '92%',
  },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 8,
  },
  webModalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  modalCard: {
    width: '100%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  modalContent: {
    padding: 20,
    paddingBottom: 32,
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
