import React, { useMemo } from 'react';
import {
  Alert,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import CategoryPicker from '@/components/CategoryPicker';
import EmptyState from '@/components/EmptyState';
import PriorityBadge from '@/components/PriorityBadge';
import PriorityPicker from '@/components/PriorityPicker';
import { useStore } from '@/lib/store';
import { StagedHighlight } from '@/lib/types';

export default function WaitingApprovalScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const categories = useStore((s) => s.categories);
  const stagedHighlights = useStore((s) => s.stagedHighlights);
  const syncRequests = useStore((s) => s.syncRequests);
  const requestAppleBooksSync = useStore((s) => s.requestAppleBooksSync);
  const updateStagedHighlightCategory = useStore(
    (s) => s.updateStagedHighlightCategory
  );
  const updateStagedHighlightPriority = useStore(
    (s) => s.updateStagedHighlightPriority
  );
  const approveStagedHighlight = useStore((s) => s.approveStagedHighlight);
  const rejectStagedHighlight = useStore((s) => s.rejectStagedHighlight);
  const approveAllPendingStagedHighlights = useStore(
    (s) => s.approveAllPendingStagedHighlights
  );
  const rejectAllPendingStagedHighlights = useStore(
    (s) => s.rejectAllPendingStagedHighlights
  );
  const setPendingHighlightsCategory = useStore(
    (s) => s.setPendingHighlightsCategory
  );

  const pendingHighlights = useMemo(
    () =>
      stagedHighlights.filter((highlight) => highlight.approvalStatus === 'pending'),
    [stagedHighlights]
  );
  const approvedHighlights = useMemo(
    () =>
      stagedHighlights.filter((highlight) => highlight.approvalStatus === 'approved'),
    [stagedHighlights]
  );
  const rejectedHighlights = useMemo(
    () =>
      stagedHighlights.filter((highlight) => highlight.approvalStatus === 'rejected'),
    [stagedHighlights]
  );

  const latestRequest = syncRequests[0];
  const syncInFlight =
    latestRequest?.source === 'apple_books' &&
    (latestRequest.status === 'pending' || latestRequest.status === 'running');
  const needsBooksDefault = pendingHighlights.some(
    (highlight) => highlight.categoryId !== 'books'
  );
  const readyToApproveAll = pendingHighlights.filter(
    (highlight) =>
      !!highlight.categoryId && highlight.categoryStatus === 'chosen'
  ).length;

  const handleSyncRequest = async () => {
    try {
      await requestAppleBooksSync();
      notify('Apple Books sync requested. Your Mac agent can pick it up now.');
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  const handleSetAllToBooks = async () => {
    try {
      await setPendingHighlightsCategory('books');
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  const handleApproveAll = async () => {
    try {
      await approveAllPendingStagedHighlights();
      notify('Approved all pending highlights that already had a category.');
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  const handleRejectAll = async () => {
    try {
      await rejectAllPendingStagedHighlights();
      notify('Rejected all pending highlights.');
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  const handleApprove = async (highlight: StagedHighlight) => {
    try {
      await approveStagedHighlight(highlight.id);
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  const handleReject = async (highlight: StagedHighlight) => {
    try {
      await rejectStagedHighlight(highlight.id);
    } catch (error) {
      notify(getErrorMessage(error), true);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Waiting Approval</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Review synced Apple Books highlights, confirm their category, and move them
        into the recall cycle.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
      >
        <View style={styles.syncHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>
              Apple Books Sync
            </Text>
            <Text style={[styles.metaText, { color: colors.textSecondary }]}>
              {latestRequest
                ? `Latest request: ${formatStatus(latestRequest.status)}`
                : 'No sync request yet'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleSyncRequest}
            disabled={syncInFlight}
            style={[
              styles.syncButton,
              {
                backgroundColor: syncInFlight ? colors.tint + '40' : colors.tint,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="sync-outline" size={18} color="#fff" />
            <Text style={styles.syncButtonText}>
              {syncInFlight ? 'Syncing' : 'Sync Apple Books'}
            </Text>
          </TouchableOpacity>
        </View>

        {latestRequest?.resultSummary ? (
          <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
            {latestRequest.resultSummary}
          </Text>
        ) : null}
        {latestRequest?.error ? (
          <Text style={[styles.errorText, { color: colors.destructive }]}>
            {latestRequest.error}
          </Text>
        ) : null}
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          PENDING
        </Text>
        <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
          {pendingHighlights.length}
        </Text>
      </View>

      {pendingHighlights.length > 0 ? (
        <>
          <View style={styles.actionRow}>
            <TouchableOpacity
              onPress={handleSetAllToBooks}
              disabled={!needsBooksDefault}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.border,
                  opacity: needsBooksDefault ? 1 : 0.55,
                },
              ]}
            >
              <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
                Set All Visible To Books
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleApproveAll}
              disabled={readyToApproveAll === 0}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.success + '15',
                  borderColor: colors.success,
                  opacity: readyToApproveAll > 0 ? 1 : 0.55,
                },
              ]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.success }]}
              >
                Approve All Ready ({readyToApproveAll})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleRejectAll}
              disabled={pendingHighlights.length === 0}
              style={[
                styles.secondaryButton,
                {
                  backgroundColor: colors.destructive + '12',
                  borderColor: colors.destructive,
                  opacity: pendingHighlights.length > 0 ? 1 : 0.55,
                },
              ]}
            >
              <Text
                style={[styles.secondaryButtonText, { color: colors.destructive }]}
              >
                Reject All
              </Text>
            </TouchableOpacity>
          </View>

          {pendingHighlights.map((highlight) => (
            <ApprovalCard
              key={highlight.id}
              highlight={highlight}
              colors={colors}
              categories={categories}
              onSelectCategory={(categoryId) =>
                updateStagedHighlightCategory(highlight.id, categoryId).catch((error) =>
                  notify(getErrorMessage(error), true)
                )
              }
              onSelectPriority={(priorityCode) =>
                updateStagedHighlightPriority(highlight.id, priorityCode).catch((error) =>
                  notify(getErrorMessage(error), true)
                )
              }
              onApprove={() => handleApprove(highlight)}
              onReject={() => handleReject(highlight)}
            />
          ))}
        </>
      ) : (
        <EmptyState
          icon="hourglass-outline"
          title="Nothing waiting"
          subtitle="Request a sync from Apple Books, then approve the incoming highlights here."
        />
      )}

      <HistorySection
        title="APPROVED"
        highlights={approvedHighlights}
        colors={colors}
      />
      <HistorySection
        title="REJECTED"
        highlights={rejectedHighlights}
        colors={colors}
      />
    </ScrollView>
  );
}

function ApprovalCard({
  highlight,
  colors,
  categories,
  onSelectCategory,
  onSelectPriority,
  onApprove,
  onReject,
}: {
  highlight: StagedHighlight;
  colors: any;
  categories: ReturnType<typeof useStore.getState>['categories'];
  onSelectCategory: (categoryId: string) => void;
  onSelectPriority: (priorityCode: 1 | 2 | 3 | 4 | 5) => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isReady = !!highlight.categoryId && highlight.categoryStatus === 'chosen';

  return (
    <View
      style={[
        styles.card,
        styles.highlightCard,
        { backgroundColor: colors.surface, borderColor: colors.borderLight },
      ]}
    >
      <View style={styles.highlightHeader}>
        <View style={styles.sourceBlock}>
          <Text style={[styles.highlightSource, { color: colors.text }]}>
            {highlight.source || 'Apple Books'}
          </Text>
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {formatHighlightDate(highlight.highlightedAt)} · Apple Books
          </Text>
          <View style={styles.inlineMetaRow}>
            <PriorityBadge
              priorityCode={highlight.priorityCode}
              priorityLabel={highlight.priorityLabel}
              compact
            />
          </View>
        </View>
        {!isReady ? (
          <View
            style={[
              styles.warningBadge,
              { backgroundColor: colors.warning + '18' },
            ]}
          >
            <Text style={[styles.warningBadgeText, { color: colors.warning }]}>
              Category required
            </Text>
          </View>
        ) : null}
      </View>

      <Text style={[styles.highlightContent, { color: colors.text }]}>
        {highlight.content}
      </Text>

      {highlight.detail ? (
        <Text style={[styles.highlightDetail, { color: colors.textSecondary }]}>
          {highlight.detail}
        </Text>
      ) : null}

      <Text style={[styles.label, { color: colors.textSecondary }]}>CATEGORY</Text>
      <CategoryPicker
        categories={categories}
        selectedCategoryId={highlight.categoryId}
        onSelect={onSelectCategory}
        compact
      />

      <Text style={[styles.label, styles.inlineLabel, { color: colors.textSecondary }]}>
        PRIORITY
      </Text>
      <PriorityPicker
        selectedPriorityCode={highlight.priorityCode}
        onSelect={onSelectPriority}
        compact
      />

      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={onReject}
          style={[
            styles.outlineAction,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.outlineActionText, { color: colors.textSecondary }]}>
            Reject
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onApprove}
          disabled={!isReady}
          style={[
            styles.primaryAction,
            { backgroundColor: isReady ? colors.success : colors.success + '55' },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function HistorySection({
  title,
  highlights,
  colors,
}: {
  title: string;
  highlights: StagedHighlight[];
  colors: any;
}) {
  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          {title}
        </Text>
        <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
          {highlights.length}
        </Text>
      </View>

      {highlights.length === 0 ? (
        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          No {title.toLowerCase()} highlights yet.
        </Text>
      ) : (
        highlights.slice(0, 10).map((highlight) => (
          <View
            key={highlight.id}
            style={[
              styles.card,
              styles.historyCard,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
          >
            <View style={styles.historyHeader}>
              <View style={styles.historyTitleBlock}>
                <Text
                  style={[styles.historySource, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {highlight.source || 'Apple Books'}
                </Text>
                <PriorityBadge
                  priorityCode={highlight.priorityCode}
                  priorityLabel={highlight.priorityLabel}
                  compact
                />
              </View>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {highlight.importStatus === 'skipped_duplicate'
                  ? 'Duplicate'
                  : formatStatus(highlight.approvalStatus)}
              </Text>
            </View>
            <Text
              style={[styles.historyContent, { color: colors.textSecondary }]}
              numberOfLines={3}
            >
              {highlight.content}
            </Text>
          </View>
        ))
      )}
    </>
  );
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatHighlightDate(value?: string) {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Unknown date';
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function notify(message: string, isError = false) {
  if (Platform.OS === 'web') {
    if (isError) {
      alert(message);
      return;
    }
    alert(message);
    return;
  }

  Alert.alert(isError ? 'Error' : 'Done', message);
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }

  return 'Something went wrong.';
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 48 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    marginTop: 4,
    marginBottom: 16,
  },
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  syncHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.6,
  },
  sectionCount: {
    fontSize: 13,
    fontWeight: '600',
  },
  sectionNote: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  errorText: {
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  highlightCard: {
    marginBottom: 12,
  },
  historyCard: {
    marginBottom: 10,
  },
  highlightHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 8,
  },
  sourceBlock: {
    flex: 1,
    gap: 4,
  },
  inlineMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  highlightSource: {
    fontSize: 16,
    fontWeight: '600',
  },
  metaText: {
    fontSize: 13,
    marginTop: 2,
  },
  highlightContent: {
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 8,
  },
  highlightDetail: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inlineLabel: {
    marginTop: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
  },
  outlineAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  outlineActionText: {
    fontSize: 15,
    fontWeight: '600',
  },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  warningBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  warningBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  historyTitleBlock: {
    flex: 1,
    gap: 6,
  },
  historySource: {
    fontSize: 14,
    fontWeight: '600',
  },
  historyContent: {
    fontSize: 14,
    lineHeight: 20,
  },
});
