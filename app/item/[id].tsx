import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  useColorScheme,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import { getIntervalLabel } from '@/lib/srs';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const item = useStore((s) => s.getItemById(id));
  const category = useStore((s) =>
    item ? s.getCategoryById(item.categoryId) : undefined
  );
  const markRecalled = useStore((s) => s.markRecalled);
  const markForgotten = useStore((s) => s.markForgotten);
  const deleteItem = useStore((s) => s.deleteItem);
  const archiveItem = useStore((s) => s.archiveItem);

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

  const nextReviewFormatted = () => {
    const d = new Date(item.nextReviewDate);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const diff = Math.floor(
      (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diff <= 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `In ${diff} days`;
  };

  const handleDelete = () => {
    const doDelete = () => {
      deleteItem(item.id);
      router.back();
    };
    if (Platform.OS === 'web') {
      if (confirm('Delete this item? This cannot be undone.')) {
        doDelete();
      }
    } else {
      Alert.alert('Delete Item', 'This cannot be undone.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete },
      ]);
    }
  };

  const handleRecall = () => {
    markRecalled(item.id);
  };

  const handleForgot = () => {
    markForgotten(item.id);
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
    >
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

      <Text style={[styles.contentText, { color: colors.text }]}>
        {item.content}
      </Text>

      {item.source ? (
        <Text style={[styles.sourceText, { color: colors.textSecondary }]}>
          {item.source}
        </Text>
      ) : null}

      {item.detail ? (
        <View
          style={[
            styles.detailCard,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          <Text style={[styles.detailText, { color: colors.text }]}>
            {item.detail}
          </Text>
        </View>
      ) : null}

      {/* Stats */}
      <View
        style={[
          styles.statsCard,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
      >
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Next Review
          </Text>
          <Text style={[styles.statValue, { color: colors.tint }]}>
            {nextReviewFormatted()}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Current Interval
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {getIntervalLabel(item.currentInterval)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Times Reviewed
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {item.reviewCount}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Last Reviewed
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDate(item.lastReviewedAt)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
        <View style={styles.statRow}>
          <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
            Added
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {formatDate(item.createdAt)}
          </Text>
        </View>
      </View>

      {/* Intervals Progress */}
      <View style={styles.intervalsSection}>
        <Text style={[styles.intervalsTitle, { color: colors.textSecondary }]}>
          REVIEW SCHEDULE
        </Text>
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
                      i <= item.intervalIndex ? '#fff' : colors.textTertiary,
                  },
                ]}
              >
                {d}
              </Text>
            </View>
          ))}
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          onPress={handleRecall}
          style={[styles.actionBtn, { backgroundColor: colors.success }]}
          activeOpacity={0.8}
        >
          <Ionicons name="checkmark-circle-outline" size={22} color="#fff" />
          <Text style={styles.actionBtnText}>I Recall</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleForgot}
          style={[
            styles.actionBtn,
            { backgroundColor: colors.warning },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh-outline" size={22} color="#fff" />
          <Text style={styles.actionBtnText}>Forgot</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        onPress={handleDelete}
        style={styles.deleteBtn}
        activeOpacity={0.7}
      >
        <Ionicons name="trash-outline" size={18} color={colors.destructive} />
        <Text style={[styles.deleteText, { color: colors.destructive }]}>
          Delete Item
        </Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20 },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { fontSize: 16 },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    marginBottom: 12,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '600',
  },
  contentText: {
    fontSize: 24,
    fontWeight: '600',
    lineHeight: 32,
    marginBottom: 6,
  },
  sourceText: {
    fontSize: 15,
    marginBottom: 16,
  },
  detailCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 20,
  },
  detailText: {
    fontSize: 15,
    lineHeight: 22,
  },
  statsCard: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 20,
    overflow: 'hidden',
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  statLabel: { fontSize: 15 },
  statValue: { fontSize: 15, fontWeight: '600' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  intervalsSection: { marginBottom: 24 },
  intervalsTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  intervalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  intervalDot: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  intervalDotText: {
    fontSize: 12,
    fontWeight: '600',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: '500',
  },
});
