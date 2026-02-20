import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  TextInput,
  useColorScheme,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import EmptyState from '@/components/EmptyState';

export default function LibraryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const items = useStore((s) => s.items);
  const categories = useStore((s) => s.categories);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredItems = useMemo(() => {
    let result = items.filter((i) => i.status === 'active');
    if (selectedCategory) {
      result = result.filter((i) => i.categoryId === selectedCategory);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (i) =>
          i.content.toLowerCase().includes(q) ||
          i.source.toLowerCase().includes(q) ||
          i.detail.toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }, [items, search, selectedCategory]);

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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Library</Text>
        <Text style={[styles.count, { color: colors.textSecondary }]}>
          {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
        </Text>
      </View>

      <View
        style={[
          styles.searchBar,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textTertiary} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search items..."
          placeholderTextColor={colors.textTertiary}
          value={search}
          onChangeText={setSearch}
        />
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

      <FlatList
        horizontal
        data={[{ id: null as string | null, name: 'All' }, ...categories]}
        keyExtractor={(item) => item.id ?? 'all'}
        renderItem={({ item: cat }) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <TouchableOpacity
              onPress={() =>
                setSelectedCategory(
                  cat.id === selectedCategory ? null : cat.id
                )
              }
              style={[
                styles.chip,
                {
                  backgroundColor: isSelected ? colors.tint : colors.surface,
                  borderColor: isSelected ? colors.tint : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? '#fff' : colors.textSecondary },
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          );
        }}
        contentContainerStyle={styles.chips}
        showsHorizontalScrollIndicator={false}
        style={styles.chipList}
      />

      {filteredItems.length === 0 ? (
        <EmptyState
          icon="library-outline"
          title="No items yet"
          subtitle="Tap the + button on the Today tab to add your first recall item."
        />
      ) : (
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => {
            const cat = categories.find((c) => c.id === item.categoryId);
            return (
              <TouchableOpacity
                onPress={() => router.push(`/item/${item.id}`)}
                style={[
                  styles.libraryItem,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.borderLight,
                  },
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: cat?.color ?? colors.tint },
                  ]}
                />
                <View style={styles.itemContent}>
                  <Text
                    style={[styles.itemText, { color: colors.text }]}
                    numberOfLines={1}
                  >
                    {item.content}
                  </Text>
                  <Text
                    style={[styles.itemMeta, { color: colors.textTertiary }]}
                  >
                    {cat?.name ?? 'Other'} · Next:{' '}
                    {formatDate(item.nextReviewDate)}
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            );
          }}
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
    alignItems: 'baseline',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  count: {
    fontSize: 15,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    padding: 0,
  },
  chipList: {
    flexGrow: 0,
    marginTop: 12,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
  list: {
    paddingTop: 12,
    paddingBottom: 40,
  },
  libraryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  itemContent: {
    flex: 1,
  },
  itemText: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
});
