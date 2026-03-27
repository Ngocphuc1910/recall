import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
  useWindowDimensions,
} from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import { getIntervalLabel } from '@/lib/srs';
import PriorityBadge from '@/components/PriorityBadge';
import {
  PRIORITY_DEFINITIONS,
  PriorityCode,
  getPriorityDefinition,
} from '@/lib/types';

export default function ItemDetailScreen() {
  const { id, itemIds, sourceView } = useLocalSearchParams<{
    id: string;
    itemIds?: string;
    sourceView?: string;
  }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web';
  const [showDetailsSheet, setShowDetailsSheet] = React.useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = React.useState(false);

  const item = useStore((s) => s.getItemById(id));
  const items = useStore((s) => s.items);
  const category = useStore((s) =>
    item ? s.getCategoryById(item.categoryId) : undefined
  );
  const reviewQueueMode = useStore(
    (s) => s.settings.reviewQueueMode ?? 'sequential'
  );
  const markRecalled = useStore((s) => s.markRecalled);
  const markForgotten = useStore((s) => s.markForgotten);
  const deleteItem = useStore((s) => s.deleteItem);
  const updateItem = useStore((s) => s.updateItem);
  const updateSettings = useStore((s) => s.updateSettings);
  const showToast = useStore((s) => s.showToast);

  if (!item) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.centered}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            Item not found
          </Text>
        </View>
      </View>
    );
  }

  const formatDate = (ts: number | null) => {
    if (!ts) return 'Never';
    return new Date(ts).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCalendarDate = (ts: number) => {
    const d = new Date(ts);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleDelete = () => {
    deleteItem(item.id);
    showToast('Item deleted', 'destructive');
    router.back();
  };

  const toggleReviewQueueMode = () => {
    const nextMode = reviewQueueMode === 'sequential' ? 'random' : 'sequential';
    updateSettings({
      reviewQueueMode: nextMode,
    });
    showToast(
      nextMode === 'random'
        ? 'Next card mode set to random'
        : 'Next card mode set to next',
      'success'
    );
  };

  const closeDetailsSheet = () => {
    setShowDetailsSheet(false);
    setPriorityMenuOpen(false);
  };

  const navigateAfterReview = () => {
    const queue = typeof itemIds === 'string' ? itemIds.split(',').filter(Boolean) : [];
    const currentIndex = queue.indexOf(id);
    const remainingQueue =
      currentIndex >= 0
        ? queue
            .slice(currentIndex + 1)
            .filter((candidateId) =>
              items.some((candidate) => candidate.id === candidateId)
            )
        : [];

    if (remainingQueue.length > 0) {
      const nextId =
        reviewQueueMode === 'random'
          ? remainingQueue[Math.floor(Math.random() * remainingQueue.length)]
          : remainingQueue[0];
      const nextQueue =
        reviewQueueMode === 'random'
          ? [
              ...queue.slice(0, currentIndex + 1),
              nextId,
              ...remainingQueue.filter((candidateId) => candidateId !== nextId),
            ].join(',')
          : itemIds;

      if (nextId) {
        router.replace({
          pathname: '/item/[id]',
          params: {
            id: nextId,
            itemIds: nextQueue,
            sourceView,
          },
        });
        return;
      }
    }

    if (sourceView === 'library') {
      router.replace('/library');
      return;
    }

    if (sourceView === 'today') {
      router.replace('/');
      return;
    }

    router.back();
  };

  const handleRecall = () => {
    markRecalled(item.id);
    showToast('Marked as recalled', 'success');
    navigateAfterReview();
  };

  const handleForgot = () => {
    markForgotten(item.id);
    showToast('Marked as forgotten', 'warning');
    navigateAfterReview();
  };

  const handlePriorityChange = (priorityCode: PriorityCode) => {
    const priority = getPriorityDefinition(priorityCode);
    updateItem(item.id, {
      priorityCode: priority.code,
      priorityLabel: priority.label,
    });
    setPriorityMenuOpen(false);
  };

  const compactLayout = width < 760;
  const heroTextStyle = compactLayout ? styles.contentTextCompact : styles.contentText;
  const focusTextStyle = compactLayout
    ? styles.contentTextFocusCompact
    : styles.contentTextFocus;
  const mainColumnStyle = compactLayout
    ? styles.columnFullWidth
    : styles.mainColumn;
  const sideColumnStyle = compactLayout
    ? styles.columnFullWidth
    : styles.sideColumn;

  const renderQueueModeButton = () => (
    <TouchableOpacity
      onPress={toggleReviewQueueMode}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel={
        reviewQueueMode === 'random'
          ? 'Switch to in-order next card mode'
          : 'Switch to random next card mode'
      }
      style={styles.queueModeButton}
    >
      <Ionicons
        name={
          reviewQueueMode === 'random'
            ? 'shuffle'
            : 'swap-horizontal-outline'
        }
        size={18}
        color={
          reviewQueueMode === 'random' ? colors.tint : colors.textSecondary
        }
      />
    </TouchableOpacity>
  );

  const renderReviewActions = () => (
    <View style={styles.actionRow}>
      <TouchableOpacity
        onPress={handleForgot}
        style={[styles.secondaryAction, { backgroundColor: colors.warning }]}
        activeOpacity={0.86}
      >
        <Ionicons name="refresh-outline" size={22} color="#fff" />
        <Text style={styles.primaryActionText}>Forgot</Text>
      </TouchableOpacity>

      <TouchableOpacity
        onPress={handleRecall}
        style={[styles.primaryAction, { backgroundColor: colors.success }]}
        activeOpacity={0.86}
      >
        <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
        <Text style={styles.primaryActionText}>I Recall</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeroTopRow = () => (
    <View style={styles.heroTopRow}>
      <View style={styles.badgeRow}>
        <View
          style={[
            styles.categoryBadge,
            { backgroundColor: (category?.color ?? colors.tint) + '15' },
          ]}
        >
          <Ionicons
            name={(category?.icon as any) ?? 'star-outline'}
            size={14}
            color={category?.color ?? colors.tint}
          />
          <Text
            style={[
              styles.categoryText,
              { color: category?.color ?? colors.tint },
            ]}
          >
            {category?.name ?? 'Other'}
          </Text>
        </View>

        <PriorityBadge
          priorityCode={item.priorityCode}
          priorityLabel={item.priorityLabel}
        />
      </View>

      {renderQueueModeButton()}
    </View>
  );

  const renderFocusReview = () => (
    <View style={styles.focusShell}>
      <ScrollView
        style={styles.focusScroll}
        contentContainerStyle={styles.focusScrollContent}
        showsVerticalScrollIndicator={false}
      >
        {renderHeroTopRow()}

        <Text style={[focusTextStyle, { color: colors.text }]}>
          {item.content}
        </Text>

        <Text style={[styles.sourceTextFocus, { color: colors.textSecondary }]}>
          {item.source || 'Unknown source'}
        </Text>

        {item.detail ? (
          <View
            style={[
              styles.detailCard,
              {
                backgroundColor: colors.surfaceSecondary,
                borderColor: colors.border,
              },
            ]}
          >
            <Text style={[styles.detailEyebrow, { color: colors.textTertiary }]}>
              CONTEXT
            </Text>
            <Text style={[styles.detailText, { color: colors.text }]}>
              {item.detail}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.focusActionBar,
          {
            backgroundColor: colors.background,
            borderTopColor: colors.borderLight,
          },
        ]}
      >
        {renderReviewActions()}
      </View>
    </View>
  );

  const renderDetailsSheet = () => (
    <View style={styles.sheetOverlay}>
      <Pressable style={styles.sheetBackdrop} onPress={closeDetailsSheet} />
      <View
        style={[
          styles.sheetCard,
          {
            backgroundColor: colors.background,
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
          <View>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>
              Item details
            </Text>
            <Text
              style={[styles.sheetSubtitle, { color: colors.textSecondary }]}
            >
              Review the metadata, schedule, and controls for this item.
            </Text>
          </View>

          <TouchableOpacity
            onPress={closeDetailsSheet}
            activeOpacity={0.8}
            style={styles.sheetCloseButton}
          >
            <Ionicons
              name="close-outline"
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.sheetScroll}
          contentContainerStyle={styles.sheetScrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.twoColumnLayout}>
            <View style={sideColumnStyle}>
              <View
                style={[
                  styles.panel,
                  styles.statsPanel,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <Text style={[styles.panelEyebrow, { color: colors.textSecondary }]}>
                  ITEM STATUS
                </Text>
                <Text style={[styles.panelTitle, { color: colors.text }]}>
                  Current memory state
                </Text>

                <View style={styles.statStack}>
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Next Review
                    </Text>
                    <Text style={[styles.statValueAccent, { color: colors.tint }]}>
                      {formatCalendarDate(item.nextReviewDate)}
                    </Text>
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: colors.borderLight }]}
                  />
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Current Interval
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {getIntervalLabel(item.currentInterval)}
                    </Text>
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: colors.borderLight }]}
                  />
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Times Reviewed
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {item.reviewCount}
                    </Text>
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: colors.borderLight }]}
                  />
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Last Reviewed
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {formatDate(item.lastReviewedAt)}
                    </Text>
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: colors.borderLight }]}
                  />
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Priority
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {item.priorityLabel}
                    </Text>
                  </View>
                  <View
                    style={[styles.divider, { backgroundColor: colors.borderLight }]}
                  />
                  <View style={styles.statRow}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                      Added
                    </Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>
                      {formatDate(item.createdAt)}
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={mainColumnStyle}>
              <View
                style={[
                  styles.panel,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <Text style={[styles.panelEyebrow, { color: colors.textSecondary }]}>
                  PRIORITY & REVIEW SCHEDULE
                </Text>
                <TouchableOpacity
                  onPress={() => setPriorityMenuOpen((open) => !open)}
                  style={[
                    styles.selectTrigger,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                  activeOpacity={0.82}
                >
                  <View style={styles.selectTriggerValue}>
                    <View
                      style={[
                        styles.selectDot,
                        {
                          backgroundColor: getPriorityDefinition(
                            item.priorityCode
                          ).color,
                        },
                      ]}
                    />
                    <Text style={[styles.selectText, { color: colors.text }]}>
                      {item.priorityCode}. {item.priorityLabel}
                    </Text>
                  </View>
                  <Ionicons
                    name={priorityMenuOpen ? 'chevron-up' : 'chevron-down'}
                    size={16}
                    color={colors.textSecondary}
                  />
                </TouchableOpacity>

                {priorityMenuOpen ? (
                  <View
                    style={[
                      styles.selectMenu,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    {PRIORITY_DEFINITIONS.map((priority) => {
                      const isSelected = priority.code === item.priorityCode;
                      return (
                        <TouchableOpacity
                          key={priority.code}
                          onPress={() => handlePriorityChange(priority.code)}
                          style={[
                            styles.selectOption,
                            isSelected && {
                              backgroundColor: priority.color + '12',
                            },
                          ]}
                          activeOpacity={0.82}
                        >
                          <View style={styles.selectTriggerValue}>
                            <View
                              style={[
                                styles.selectDot,
                                { backgroundColor: priority.color },
                              ]}
                            />
                            <Text
                              style={[
                                styles.selectText,
                                {
                                  color: isSelected ? priority.color : colors.text,
                                  fontWeight: isSelected ? '700' : '600',
                                },
                              ]}
                            >
                              {priority.code}. {priority.label}
                            </Text>
                          </View>
                          {isSelected ? (
                            <Ionicons
                              name="checkmark"
                              size={16}
                              color={priority.color}
                            />
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ) : null}

                <View
                  style={[styles.sectionDivider, { backgroundColor: colors.borderLight }]}
                />

                <View style={styles.scheduleHeader}>
                  <Text style={[styles.scheduleLabel, { color: colors.textSecondary }]}>
                    Review schedule
                  </Text>
                  <Text style={[styles.scheduleValue, { color: colors.text }]}>
                    {item.intervals[item.intervalIndex] ?? item.currentInterval} day
                    {((item.intervals[item.intervalIndex] ?? item.currentInterval) || 0) ===
                    1
                      ? ''
                      : 's'}
                  </Text>
                </View>

                <View style={styles.intervalsRow}>
                  {item.intervals.map((d, i) => (
                    <View
                      key={i}
                      style={[
                        styles.intervalDot,
                        {
                          backgroundColor:
                            i < item.intervalIndex
                              ? colors.success
                              : i === item.intervalIndex
                              ? colors.tint
                              : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.intervalDotText,
                          {
                            color:
                              i <= item.intervalIndex
                                ? '#fff'
                                : colors.textTertiary,
                          },
                        ]}
                      >
                        {d}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          </View>

          <TouchableOpacity
            onPress={handleDelete}
            style={[
              styles.deleteCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
              },
            ]}
            activeOpacity={0.78}
          >
            <Ionicons
              name="trash-outline"
              size={18}
              color={colors.destructive}
            />
            <Text style={[styles.deleteText, { color: colors.destructive }]}>
              Delete Item
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen
        options={{
          headerRight: () => (
            <TouchableOpacity
              onPress={() => setShowDetailsSheet(true)}
              hitSlop={10}
              activeOpacity={0.7}
              style={styles.headerAction}
            >
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          ),
        }}
      />

      {renderFocusReview()}

      {isWeb ? (
        showDetailsSheet ? (
          <View style={styles.webModalRoot}>{renderDetailsSheet()}</View>
        ) : null
      ) : (
        <Modal
          visible={showDetailsSheet}
          animationType="fade"
          transparent
          onRequestClose={closeDetailsSheet}
        >
          {renderDetailsSheet()}
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  backdropGlow: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    top: -120,
    right: -100,
  },
  backdropGlowSecondary: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: 240,
    left: -140,
    opacity: 0.72,
  },
  scrollContent: {
    paddingBottom: 80,
  },
  webModalRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  page: {
    width: '100%',
    maxWidth: 1120,
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingTop: 16,
  },
  headerAction: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 16 },
  focusShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 18,
  },
  focusScroll: {
    flex: 1,
  },
  focusScrollContent: {
    paddingBottom: 36,
  },
  focusActionBar: {
    paddingHorizontal: 0,
    paddingTop: 6,
    paddingBottom: 18,
    borderTopWidth: StyleSheet.hairlineWidth,
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
    maxHeight: '82%',
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
  sheetTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sheetSubtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    maxWidth: 520,
  },
  sheetCloseButton: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetScroll: {
    flexGrow: 0,
  },
  sheetScrollContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  heroPanel: {
    borderRadius: 26,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.12,
    shadowRadius: 36,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flex: 1,
    gap: 8,
  },
  queueModeButton: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
  },
  contentText: {
    fontSize: 31,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.8,
  },
  contentTextCompact: {
    fontSize: 24,
    lineHeight: 31,
    fontWeight: '800',
    letterSpacing: -0.35,
  },
  contentTextFocus: {
    fontSize: 38,
    lineHeight: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  contentTextFocusCompact: {
    fontSize: 30,
    lineHeight: 39,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  sourceText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  sourceTextFocus: {
    marginTop: 14,
    fontSize: 17,
    lineHeight: 24,
    fontWeight: '600',
  },
  detailCard: {
    marginTop: 18,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  detailEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 8,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  primaryAction: {
    flex: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 11,
  },
  secondaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderRadius: 16,
    paddingVertical: 11,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  twoColumnLayout: {
    flexDirection: 'row',
    gap: 14,
    alignItems: 'flex-start',
    marginTop: 14,
    flexWrap: 'wrap',
  },
  mainColumn: {
    flex: 1.3,
    minWidth: 320,
    gap: 16,
  },
  sideColumn: {
    flex: 0.9,
    minWidth: 300,
    gap: 16,
  },
  columnFullWidth: {
    width: '100%',
    minWidth: 0,
    gap: 16,
  },
  panel: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 28,
    elevation: 3,
  },
  panelEyebrow: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  panelTitle: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  panelDescription: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  selectTrigger: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectTriggerValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  selectDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  selectText: {
    fontSize: 14,
    fontWeight: '600',
  },
  selectMenu: {
    marginTop: 10,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  sectionDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 14,
    marginBottom: 14,
  },
  scheduleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  scheduleLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  scheduleValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  selectOption: {
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  statsPanel: {
    overflow: 'hidden',
  },
  statStack: {
    marginTop: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  statLabel: {
    flex: 1,
    fontSize: 14,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
  },
  statValueAccent: {
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  intervalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    marginTop: 12,
  },
  intervalDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalDotText: {
    fontSize: 10,
    fontWeight: '700',
  },
  deleteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  deleteText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
