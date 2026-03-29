import React, { useMemo } from 'react';
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import EmptyState from '@/components/EmptyState';
import PriorityBadge from '@/components/PriorityBadge';
import { useStore } from '@/lib/store';

export default function ArchivedScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);
  const unarchiveItem = useStore((s) => s.unarchiveItem);
  const showToast = useStore((s) => s.showToast);

  const archivedItems = useMemo(
    () =>
      [...items]
        .filter((item) => item.status === 'archived')
        .sort((a, b) => b.createdAt - a.createdAt),
    [items]
  );

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

  const handleUnarchive = (itemId: string) => {
    unarchiveItem(itemId);
    showToast('Item moved back to library', 'success');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Archived</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {archivedItems.length === 0
            ? 'Archived items stay out of your recall cycle until you need them.'
            : `${archivedItems.length} archived item${
                archivedItems.length === 1 ? '' : 's'
              } kept for later reference.`}
        </Text>
      </View>

      {archivedItems.length === 0 ? (
        <EmptyState
          icon="archive-outline"
          iconColor={colors.textSecondary}
          title="No archived items"
          subtitle="Archive cards from Today to keep them out of recall and library while preserving them here."
        />
      ) : (
        <FlatList
          data={archivedItems}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const category = categories.find((entry) => entry.id === item.categoryId);

            return (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: '/item/[id]',
                    params: {
                      id: item.id,
                      sourceView: 'archived',
                    },
                  })
                }
                activeOpacity={0.84}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                    shadowColor: colors.shadow,
                  },
                ]}
              >
                <View style={styles.cardTopRow}>
                  <View style={styles.cardBadges}>
                    <View
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: (category?.color ?? colors.tint) + '15',
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

                  <View style={styles.cardActions}>
                    <View
                      style={[
                        styles.archivedBadge,
                        { backgroundColor: colors.surfaceSecondary },
                      ]}
                    >
                      <Ionicons
                        name="archive"
                        size={13}
                        color={colors.textSecondary}
                      />
                      <Text
                        style={[
                          styles.archivedBadgeText,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Archived
                      </Text>
                    </View>

                    <TouchableOpacity
                      onPress={(event) => {
                        event.stopPropagation?.();
                        handleUnarchive(item.id);
                      }}
                      hitSlop={10}
                      activeOpacity={0.72}
                      style={styles.unarchiveAction}
                      accessibilityRole="button"
                      accessibilityLabel="Unarchive item"
                    >
                      <Ionicons
                        name="arrow-undo-outline"
                        size={18}
                        color={colors.textTertiary}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                <Text
                  style={[styles.contentText, { color: colors.text }]}
                  numberOfLines={3}
                >
                  {item.content}
                </Text>

                <Text
                  style={[styles.metaText, { color: colors.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.source || 'Unknown source'}
                </Text>

                {item.detail ? (
                  <Text
                    style={[styles.detailText, { color: colors.textSecondary }]}
                    numberOfLines={3}
                  >
                    {item.detail}
                  </Text>
                ) : null}

                <Text
                  style={[styles.dateText, { color: colors.textTertiary }]}
                >
                  Added {formatDate(item.createdAt)}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  subtitle: {
    marginTop: 6,
    fontSize: 15,
    lineHeight: 22,
  },
  list: {
    paddingHorizontal: 18,
    paddingBottom: 28,
  },
  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    marginBottom: 12,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 3,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  cardBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
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
  archivedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  archivedBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  unarchiveAction: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.9,
  },
  contentText: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
    letterSpacing: -0.2,
  },
  metaText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  detailText: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 21,
  },
  dateText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '500',
  },
});
