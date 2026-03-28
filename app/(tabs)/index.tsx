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
  useWindowDimensions,
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
import { DEFAULT_PRIORITY_CODE, PRIORITY_DEFINITIONS, PriorityCode } from '@/lib/types';

interface FilterChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  colors: (typeof Colors)['light'];
  selectedColor?: string;
}

function FilterChip({
  label,
  selected,
  onPress,
  colors,
  selectedColor,
}: FilterChipProps) {
  const activeColor = selectedColor ?? colors.tint;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.86}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? activeColor + '16' : colors.surfaceSecondary,
          borderColor: selected ? activeColor : colors.border,
          borderWidth: selected ? 1 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Text
        style={[
          styles.chipText,
          { color: selected ? activeColor : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function TodayScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isWeb = Platform.OS === 'web';
  const router = useRouter();
  const tabBarScroll = useTabBarScrollHandler();
  const { width } = useWindowDimensions();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const addItem = useStore((s) => s.addItem);
  const markRecalled = useStore((s) => s.markRecalled);
  const markForgotten = useStore((s) => s.markForgotten);
  const webViewportMode = useStore(
    (s) => s.settings.webViewportMode ?? 'desktop'
  );
  const updateSettings = useStore((s) => s.updateSettings);

  const [showAddModal, setShowAddModal] = useState(false);
  const [filterMode, setFilterMode] = useState<'today' | 'tomorrow' | 'week' | 'nextweek' | 'month' | 'nextmonth' | 'pastdue'>('today');
  const [showFilterMenu, setShowFilterMenu] = useState(false);
  const [expandedCards, setExpandedCards] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<PriorityCode[]>([]);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
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

  const timeFilteredItems = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    const DAY = 24 * 60 * 60 * 1000;

    return items.filter((item) => {
      if (item.status !== 'active') return false;
      const startOfTomorrow = startOfToday + DAY;
      const endOfTomorrow = endOfToday + DAY;
      const startOfNextWeek = startOfToday + 7 * DAY;
      const endOfNextWeek = endOfToday + 13 * DAY;
      const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();
      const endOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59, 999).getTime();

      switch (filterMode) {
        case 'today':
          return item.nextReviewDate <= endOfToday;
        case 'tomorrow':
          return item.nextReviewDate >= startOfTomorrow && item.nextReviewDate <= endOfTomorrow;
        case 'week':
          return item.nextReviewDate <= endOfToday + 6 * DAY;
        case 'nextweek':
          return item.nextReviewDate >= startOfNextWeek && item.nextReviewDate <= endOfNextWeek;
        case 'month':
          return item.nextReviewDate <= endOfToday + 29 * DAY;
        case 'nextmonth':
          return item.nextReviewDate >= startOfNextMonth && item.nextReviewDate <= endOfNextMonth;
        case 'pastdue':
          return item.nextReviewDate < startOfToday;
        default:
          return item.nextReviewDate <= endOfToday;
      }
    });
  }, [items, filterMode]);

  const sourceOptions = useMemo(() => {
    const uniqueSources = new Map<string, string>();
    timeFilteredItems.forEach((item) => {
      const src = item.source.trim() || 'Unknown source';
      const normalized = src.toLowerCase();
      if (!uniqueSources.has(normalized)) {
        uniqueSources.set(normalized, src);
      }
    });
    return Array.from(uniqueSources.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [timeFilteredItems]);

  const activeFacetFilterCount =
    selectedCategories.length +
    selectedPriorities.length +
    selectedSources.length;

  const filteredItems = useMemo(() => {
    let result = timeFilteredItems;

    if (selectedCategories.length > 0) {
      result = result.filter((item) =>
        selectedCategories.includes(item.categoryId)
      );
    }
    if (selectedPriorities.length > 0) {
      result = result.filter((item) =>
        selectedPriorities.includes(item.priorityCode)
      );
    }
    if (selectedSources.length > 0) {
      result = result.filter((item) =>
        selectedSources.includes((item.source.trim() || 'Unknown source').toLowerCase())
      );
    }

    return result;
  }, [timeFilteredItems, selectedCategories, selectedPriorities, selectedSources]);

  const filterTitles: Record<string, string> = {
    today: 'Today',
    tomorrow: 'Tomorrow',
    week: 'This Week',
    nextweek: 'Next Week',
    month: 'This Month',
    nextmonth: 'Next Month',
    pastdue: 'Past Due',
  };

  const toggleCategory = (categoryId: string) => {
    setSelectedCategories((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  };
  const togglePriority = (priorityCode: PriorityCode) => {
    setSelectedPriorities((current) =>
      current.includes(priorityCode)
        ? current.filter((code) => code !== priorityCode)
        : [...current, priorityCode]
    );
  };
  const toggleSource = (sourceId: string) => {
    setSelectedSources((current) =>
      current.includes(sourceId)
        ? current.filter((id) => id !== sourceId)
        : [...current, sourceId]
    );
  };
  const clearFacetFilters = () => {
    setSelectedCategories([]);
    setSelectedPriorities([]);
    setSelectedSources([]);
  };

  const canSave = content.trim().length > 0;
  const showViewportToggle = isWeb && width >= 900;

  const openAddModal = () => setShowAddModal(true);
  const setViewportMode = (mode: 'desktop' | 'iphone') => {
    updateSettings({ webViewportMode: mode });
  };

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

  const renderFilterSheet = () => {
    const closeSheet = () => setShowFilterMenu(false);
    return (
      <View style={styles.sheetOverlay}>
        <Pressable style={styles.sheetBackdrop} onPress={closeSheet} />
        <View
          style={[
            styles.sheetCard,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderLight,
              shadowColor: colors.shadow,
            },
          ]}
        >
          <View
            style={[
              styles.sheetHandle,
              { backgroundColor: colors.textTertiary + '40', marginTop: 10, marginBottom: 12 },
            ]}
          />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCopy}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                Filter
              </Text>
              <Text style={[styles.sheetDescription, { color: colors.textSecondary }]}>
                Narrow items by time range, category, priority, or source.
              </Text>
            </View>
            <TouchableOpacity
              onPress={closeSheet}
              style={[
                styles.sheetCloseButton,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
              activeOpacity={0.85}
            >
              <Ionicons name="close-outline" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.sheetScroll}
            contentContainerStyle={styles.sheetScrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                TIME RANGE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                {([
                  { key: 'today' as const, label: 'Today' },
                  { key: 'tomorrow' as const, label: 'Tomorrow' },
                  { key: 'week' as const, label: 'This Week' },
                  { key: 'nextweek' as const, label: 'Next Week' },
                  { key: 'month' as const, label: 'This Month' },
                  { key: 'nextmonth' as const, label: 'Next Month' },
                  { key: 'pastdue' as const, label: 'Past Due' },
                ]).map((option) => (
                  <FilterChip
                    key={option.key}
                    label={option.label}
                    selected={filterMode === option.key}
                    onPress={() => setFilterMode(option.key)}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                CATEGORY
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <FilterChip
                  label="All"
                  selected={selectedCategories.length === 0}
                  onPress={() => setSelectedCategories([])}
                  colors={colors}
                />
                {categories.map((category) => (
                  <FilterChip
                    key={category.id}
                    label={category.name}
                    selected={selectedCategories.includes(category.id)}
                    onPress={() => toggleCategory(category.id)}
                    colors={colors}
                    selectedColor={category.color}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                PRIORITY
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <FilterChip
                  label="Any"
                  selected={selectedPriorities.length === 0}
                  onPress={() => setSelectedPriorities([])}
                  colors={colors}
                />
                {PRIORITY_DEFINITIONS.map((priority) => (
                  <FilterChip
                    key={priority.code}
                    label={priority.label}
                    selected={selectedPriorities.includes(priority.code)}
                    onPress={() => togglePriority(priority.code)}
                    colors={colors}
                    selectedColor={priority.color}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.filterSection}>
              <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                SOURCE
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <FilterChip
                  label="Any"
                  selected={selectedSources.length === 0}
                  onPress={() => setSelectedSources([])}
                  colors={colors}
                />
                {sourceOptions.map((src) => (
                  <FilterChip
                    key={src.value}
                    label={src.label}
                    selected={selectedSources.includes(src.value)}
                    onPress={() => toggleSource(src.value)}
                    colors={colors}
                  />
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          <View style={styles.sheetActions}>
            <TouchableOpacity
              onPress={() => { clearFacetFilters(); setFilterMode('today'); }}
              style={[
                styles.sheetSecondaryAction,
                { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
              ]}
              activeOpacity={0.85}
            >
              <Text style={[styles.sheetSecondaryActionText, { color: colors.text }]}>
                Reset
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={closeSheet}
              style={[styles.sheetPrimaryAction, { backgroundColor: colors.tint }]}
              activeOpacity={0.85}
            >
              <Text style={styles.sheetPrimaryActionText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

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
        <View style={styles.headerActions}>
          {showViewportToggle ? (
            <View
              style={[
                styles.viewportSwitch,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <TouchableOpacity
                onPress={() => setViewportMode('desktop')}
                activeOpacity={0.82}
                style={[
                  styles.viewportSwitchButton,
                  webViewportMode === 'desktop' && {
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
              >
                <Ionicons
                  name="desktop-outline"
                  size={16}
                  color={
                    webViewportMode === 'desktop'
                      ? colors.text
                      : colors.textSecondary
                  }
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setViewportMode('iphone')}
                activeOpacity={0.82}
                style={[
                  styles.viewportSwitchButton,
                  webViewportMode === 'iphone' && {
                    backgroundColor: colors.surfaceSecondary,
                  },
                ]}
              >
                <Ionicons
                  name="phone-portrait-outline"
                  size={16}
                  color={
                    webViewportMode === 'iphone'
                      ? colors.text
                      : colors.textSecondary
                  }
                />
              </TouchableOpacity>
            </View>
          ) : null}

          <TouchableOpacity
            onPress={() => setExpandedCards(!expandedCards)}
            hitSlop={10}
            style={[
              styles.filterButton,
              {
                backgroundColor: expandedCards ? colors.tint + '15' : colors.surface,
                borderColor: expandedCards ? colors.tint + '30' : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name={expandedCards ? 'contract-outline' : 'expand-outline'}
              size={18}
              color={expandedCards ? colors.tint : colors.textSecondary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowFilterMenu(!showFilterMenu)}
            hitSlop={10}
            style={[
              styles.filterButton,
              {
                backgroundColor:
                  (filterMode !== 'today' || activeFacetFilterCount > 0)
                    ? colors.tint + '15'
                    : colors.surface,
                borderColor:
                  (filterMode !== 'today' || activeFacetFilterCount > 0)
                    ? colors.tint + '30'
                    : colors.border,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons
              name="options-outline"
              size={18}
              color={
                (filterMode !== 'today' || activeFacetFilterCount > 0)
                  ? colors.tint
                  : colors.textSecondary
              }
            />
            {activeFacetFilterCount > 0 ? (
              <View
                style={[
                  styles.filterCountBadge,
                  { backgroundColor: colors.tint },
                ]}
              >
                <Text style={styles.filterCountText}>
                  {activeFacetFilterCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter sheet rendered below via Modal / web overlay */}

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
              : `No items due ${filterTitles[filterMode]?.toLowerCase() ?? filterMode}. Check back later!`
          }
        />
      ) : (
        <FlatList
          style={styles.flatList}
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
              onForget={() => markForgotten(item.id)}
              expanded={expandedCards}
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

      {isWeb ? (
        showFilterMenu ? (
          <View style={styles.webModalRoot}>{renderFilterSheet()}</View>
        ) : null
      ) : (
        <Modal
          visible={showFilterMenu}
          animationType="fade"
          transparent
          onRequestClose={() => setShowFilterMenu(false)}
        >
          {renderFilterSheet()}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  viewportSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  viewportSwitchButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterCountText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
  },
  sheetOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  sheetCard: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    maxHeight: '78%',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.18,
    shadowRadius: 30,
    elevation: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 16,
    paddingHorizontal: 18,
    paddingBottom: 14,
  },
  sheetHeaderCopy: {
    flex: 1,
  },
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sheetDescription: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingBottom: 12,
  },
  filterSection: {
    gap: 8,
    paddingTop: 8,
  },
  filterLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    paddingHorizontal: 18,
  },
  chips: {
    paddingHorizontal: 18,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 18,
  },
  sheetSecondaryAction: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryActionText: {
    fontSize: 15,
    fontWeight: '700',
  },
  sheetPrimaryAction: {
    flex: 1.2,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetPrimaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
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
  flatList: {
    flex: 1,
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
