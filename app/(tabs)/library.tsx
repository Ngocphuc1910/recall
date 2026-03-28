import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import EmptyState from '@/components/EmptyState';
import PriorityBadge from '@/components/PriorityBadge';
import { useStore } from '@/lib/store';
import { useTabBarScrollHandler } from '@/lib/tab-bar-visibility';
import { PRIORITY_DEFINITIONS, PriorityCode } from '@/lib/types';

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

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const tabBarScroll = useTabBarScrollHandler();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);

  const [search, setSearch] = useState('');
  const [showFiltersSheet, setShowFiltersSheet] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<PriorityCode[]>(
    []
  );
  const [selectedSources, setSelectedSources] = useState<string[]>([]);

  const activeItems = useMemo(
    () => items.filter((item) => item.status === 'active'),
    [items]
  );

  const sourceOptions = useMemo(() => {
    const uniqueSources = new Map<string, string>();

    activeItems.forEach((item) => {
      const source = item.source.trim() || 'Unknown source';
      const normalizedSource = source.toLowerCase();

      if (!uniqueSources.has(normalizedSource)) {
        uniqueSources.set(normalizedSource, source);
      }
    });

    return Array.from(uniqueSources.entries())
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [activeItems]);

  const hasActiveFilters = Boolean(
    search.trim() ||
      selectedCategories.length ||
      selectedPriorities.length ||
      selectedSources.length
  );
  const activeFacetFilterCount =
    selectedCategories.length +
    selectedPriorities.length +
    selectedSources.length;

  const filteredItems = useMemo(() => {
    let result = activeItems;

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
      result = result.filter(
        (item) => selectedSources.includes((item.source.trim() || 'Unknown source').toLowerCase())
      );
    }

    if (search.trim()) {
      const query = search.toLowerCase();

      result = result.filter(
        (item) =>
          item.content.toLowerCase().includes(query) ||
          item.source.toLowerCase().includes(query) ||
          item.detail.toLowerCase().includes(query)
      );
    }

    return [...result].sort((a, b) => b.createdAt - a.createdAt);
  }, [activeItems, search, selectedCategories, selectedPriorities, selectedSources]);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const today = now.getTime();
    const diff = Math.floor((d.getTime() - today) / (1000 * 60 * 60 * 24));

    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Tomorrow';

    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCategories([]);
    setSelectedPriorities([]);
    setSelectedSources([]);
  };

  const closeFiltersSheet = () => setShowFiltersSheet(false);
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

  const renderFiltersSheet = () => (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={closeFiltersSheet} />
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
            { backgroundColor: colors.textTertiary + '40' },
          ]}
        />

        <View style={styles.sheetHeader}>
          <View style={styles.sheetHeaderCopy}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Filter library
            </Text>
            <Text
              style={[styles.sheetDescription, { color: colors.textSecondary }]}
            >
              Narrow the archive by category, priority, or source.
            </Text>
          </View>

          <TouchableOpacity
            onPress={closeFiltersSheet}
            style={[
              styles.sheetCloseButton,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Ionicons
              name="close-outline"
              size={18}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.filterSection}>
            <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
              Category
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
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
              Priority
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
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
              Source
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <FilterChip
                label="Any"
                selected={selectedSources.length === 0}
                onPress={() => setSelectedSources([])}
                colors={colors}
              />
              {sourceOptions.map((source) => (
                <FilterChip
                  key={source.value}
                  label={source.label}
                  selected={selectedSources.includes(source.value)}
                  onPress={() => toggleSource(source.value)}
                  colors={colors}
                />
              ))}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={styles.sheetActions}>
          <TouchableOpacity
            onPress={clearFilters}
            style={[
              styles.sheetSecondaryAction,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
            activeOpacity={0.85}
          >
            <Text
              style={[styles.sheetSecondaryActionText, { color: colors.text }]}
            >
              Reset
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={closeFiltersSheet}
            style={[styles.sheetPrimaryAction, { backgroundColor: colors.tint }]}
            activeOpacity={0.85}
          >
            <Text style={styles.sheetPrimaryActionText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const compactLayout = width < 720;
  const titleStyle = compactLayout ? styles.titleCompact : styles.title;
  const itemTextStyle = compactLayout ? styles.itemTextCompact : styles.itemText;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>

      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.id}
        onScroll={tabBarScroll.onScroll}
        scrollEventThrottle={tabBarScroll.scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.page}>
            <View
              style={[
                styles.heroPanel,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.borderLight,
                  shadowColor: colors.shadow,
                },
              ]}
            >
              <Text style={[styles.eyebrow, { color: colors.textSecondary }]}>
                PERSONAL MEMORY ATLAS
              </Text>

              <View style={styles.heroHeader}>
                <View style={styles.heroTitleBlock}>
                  <Text style={[titleStyle, { color: colors.text }]}>
                    Library
                  </Text>
                </View>
              </View>

              <View
                style={[
                  styles.searchBar,
                  {
                    backgroundColor: colors.surfaceSecondary,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Ionicons name="search" size={18} color={colors.textTertiary} />
                <TextInput
                  style={[styles.searchInput, { color: colors.text }]}
                  placeholder="Search by phrase, book, note, or idea"
                  placeholderTextColor={colors.textTertiary}
                  value={search}
                  onChangeText={setSearch}
                />
                <TouchableOpacity
                  onPress={() => setShowFiltersSheet(true)}
                  activeOpacity={0.86}
                  style={[
                    styles.filterButton,
                    {
                      backgroundColor:
                        activeFacetFilterCount > 0
                          ? colors.tint + '14'
                          : colors.surface,
                      borderColor:
                        activeFacetFilterCount > 0 ? colors.tint : colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="options-outline"
                    size={18}
                    color={
                      activeFacetFilterCount > 0
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
                {search ? (
                  <TouchableOpacity onPress={() => setSearch('')}>
                    <Ionicons
                      name="close-circle"
                      size={18}
                      color={colors.textTertiary}
                    />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <View style={styles.collectionHeader}>
              <View>
                <Text style={[styles.collectionTitle, { color: colors.text }]}>
                  Collection
                </Text>
                <Text
                  style={[
                    styles.collectionSubtitle,
                    { color: colors.textSecondary },
                  ]}
                >
                  {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''} — Ordered by newest additions so recent captures stay within reach.
                </Text>
              </View>
            </View>
          </View>
        }
        ListEmptyComponent={
          <View
            style={[
              styles.emptyCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
                shadowColor: colors.shadow,
              },
            ]}
          >
            <EmptyState
              icon="library-outline"
              title={hasActiveFilters ? 'No matching items' : 'No items yet'}
              subtitle={
                hasActiveFilters
                  ? 'Try widening the lens or resetting one of the filters.'
                  : 'Add your first recall item to start building your personal archive.'
              }
            />
          </View>
        }
        renderItem={({ item }) => {
          const category = categories.find((cat) => cat.id === item.categoryId);

          return (
            <View style={styles.page}>
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/item/[id]',
                    params: {
                      id: item.id,
                      sourceView: 'library',
                      itemIds: filteredItems.map((entry) => entry.id).join(','),
                    },
                  })
                }
                style={[
                  styles.libraryItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    shadowColor: colors.shadow,
                  },
                ]}
                activeOpacity={0.88}
              >
                <View style={styles.itemLeading}>
                  <View
                    style={[
                      styles.dot,
                      { backgroundColor: category?.color ?? colors.tint },
                    ]}
                  />
                  <View style={styles.itemContent}>
                    <Text
                      style={[itemTextStyle, { color: colors.text }]}
                      numberOfLines={2}
                    >
                      {item.content}
                    </Text>

                    <View style={styles.itemMetaRow}>
                      <Text
                        style={[styles.itemSource, { color: colors.textSecondary }]}
                      >
                        {item.source || 'Unknown source'}
                      </Text>
                      <Text
                        style={[styles.metaDivider, { color: colors.textTertiary }]}
                      >
                        •
                      </Text>
                      <Text
                        style={[styles.itemMeta, { color: colors.textTertiary }]}
                      >
                        Next {formatDate(item.nextReviewDate)}
                      </Text>
                    </View>

                    <View style={styles.itemFooter}>
                      <View
                        style={[
                          styles.categoryPill,
                          {
                            backgroundColor:
                              (category?.color ?? colors.tint) + '15',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.categoryPillText,
                            { color: category?.color ?? colors.tint },
                          ]}
                        >
                          {category?.name ?? 'Other'}
                        </Text>
                      </View>
                      <PriorityBadge
                        priorityCode={item.priorityCode}
                        priorityLabel={item.priorityLabel}
                        compact
                      />
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          );
        }}
      />

      {isWeb ? (
        showFiltersSheet ? (
          <View style={styles.webModalRoot}>{renderFiltersSheet()}</View>
        ) : null
      ) : (
        <Modal
          visible={showFiltersSheet}
          animationType="fade"
          transparent
          onRequestClose={closeFiltersSheet}
        >
          {renderFiltersSheet()}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backdropGlow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -150,
    right: -80,
  },
  backdropGlowSecondary: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 160,
    left: -180,
    opacity: 0.7,
  },
  listContent: {
    paddingBottom: 120,
  },
  page: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 18,
  },
  heroPanel: {
    marginTop: 20,
    padding: 18,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 5,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.1,
    marginBottom: 12,
  },
  heroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 18,
  },
  heroTitleBlock: {
    flex: 1,
    maxWidth: 700,
  },
  title: {
    fontSize: 36,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  titleCompact: {
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '800',
    letterSpacing: -0.7,
  },
  heroDescription: {
    marginTop: 10,
    fontSize: 14,
    lineHeight: 22,
    maxWidth: 660,
  },
  countCard: {
    minWidth: 104,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'flex-start',
  },
  countValue: {
    fontSize: 22,
    lineHeight: 24,
    fontWeight: '800',
  },
  countLabel: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    padding: 0,
  },
  filterButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
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
  webModalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
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
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 12,
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
    maxWidth: 520,
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
  collectionHeader: {
    paddingTop: 20,
    paddingBottom: 12,
  },
  collectionTitle: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  collectionSubtitle: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
  },
  emptyCard: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    marginTop: 6,
    marginHorizontal: 18,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 22,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  libraryItem: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  itemLeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginTop: 8,
  },
  itemContent: {
    flex: 1,
  },
  itemTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  itemText: {
    flex: 1,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  itemTextCompact: {
    flex: 1,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  itemMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  itemSource: {
    fontSize: 13,
    fontWeight: '600',
  },
  metaDivider: {
    fontSize: 13,
  },
  itemMeta: {
    fontSize: 13,
    fontWeight: '500',
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 12,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
