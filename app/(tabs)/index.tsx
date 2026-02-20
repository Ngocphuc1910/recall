import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
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
  const router = useRouter();

  const items = useStore((s) => s.items);
  const markRecalled = useStore((s) => s.markRecalled);

  const todayItems = useMemo(() => {
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const endOfToday = now.getTime();
    return items.filter(
      (item) => item.status === 'active' && item.nextReviewDate <= endOfToday
    );
  }, [items]);

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
          onPress={() => router.push('/add')}
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
});
