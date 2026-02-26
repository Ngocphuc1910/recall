import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();

  const settings = useStore((s) => s.settings);
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const updateSettings = useStore((s) => s.updateSettings);

  const [editingIntervals, setEditingIntervals] = useState(false);
  const [intervalsText, setIntervalsText] = useState(
    settings.defaultIntervals.join(', ')
  );

  const saveIntervals = () => {
    const parsed = intervalsText
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);

    if (parsed.length < 2) {
      const msg = 'Please enter at least 2 valid intervals.';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Invalid', msg);
      }
      return;
    }

    updateSettings({ defaultIntervals: parsed });
    setEditingIntervals(false);
  };

  const activeCount = items.filter((i) => i.status === 'active').length;
  const archivedCount = items.filter((i) => i.status === 'archived').length;
  const totalReviews = items.reduce((sum, i) => sum + i.reviewCount, 0);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          STATISTICS
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          <StatRow label="Active Items" value={String(activeCount)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow label="Archived" value={String(archivedCount)} colors={colors} />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow label="Total Reviews" value={String(totalReviews)} colors={colors} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          REVIEW INTERVALS (DAYS)
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          {editingIntervals ? (
            <View style={styles.editRow}>
              <TextInput
                style={[
                  styles.intervalsInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={intervalsText}
                onChangeText={setIntervalsText}
                placeholder="1, 2, 3, 7, 14, 30, 60"
                placeholderTextColor={colors.textTertiary}
              />
              <View style={styles.editButtons}>
                <TouchableOpacity
                  onPress={() => {
                    setEditingIntervals(false);
                    setIntervalsText(settings.defaultIntervals.join(', '));
                  }}
                  style={styles.cancelBtn}
                >
                  <Text style={{ color: colors.textSecondary }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveIntervals}
                  style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setEditingIntervals(true)}
              style={styles.intervalRow}
            >
              <View style={styles.intervalsDisplay}>
                {settings.defaultIntervals.map((d, i) => (
                  <View
                    key={i}
                    style={[
                      styles.intervalChip,
                      { backgroundColor: colors.tint + '15' },
                    ]}
                  >
                    <Text
                      style={[styles.intervalChipText, { color: colors.tint }]}
                    >
                      {d}
                    </Text>
                  </View>
                ))}
              </View>
              <Ionicons name="pencil" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          These intervals apply to new items. Existing items keep their own intervals.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          CATEGORIES
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          {categories.map((cat, idx) => (
            <View key={cat.id}>
              {idx > 0 && (
                <View
                  style={[
                    styles.divider,
                    { backgroundColor: colors.borderLight },
                  ]}
                />
              )}
              <View style={styles.catRow}>
                <View style={styles.catLeft}>
                  <Ionicons
                    name={cat.icon as any}
                    size={20}
                    color={cat.color}
                  />
                  <Text style={[styles.catName, { color: colors.text }]}>
                    {cat.name}
                  </Text>
                </View>
                <Text style={[styles.catCount, { color: colors.textTertiary }]}>
                  {
                    items.filter(
                      (i) => i.categoryId === cat.id && i.status === 'active'
                    ).length
                  }
                </Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          IMPORT
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/import')}
          style={[
            styles.card,
            styles.linkRow,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <Ionicons
              name="cloud-upload-outline"
              size={20}
              color={colors.tint}
            />
            <Text style={[styles.linkText, { color: colors.text }]}>
              Bulk Import JSON
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>
        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          Paste Apple Books highlights JSON and import as Recall items.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          ABOUT
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          <StatRow label="Version" value="1.0.0" colors={colors} />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function StatRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={statStyles.row}>
      <Text style={[statStyles.label, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[statStyles.value, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const statStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  label: { fontSize: 16 },
  value: { fontSize: 16, fontWeight: '600' },
});

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingBottom: 40 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sectionNote: {
    fontSize: 13,
    paddingHorizontal: 20,
    marginTop: 6,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  intervalsDisplay: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    flex: 1,
    paddingRight: 12,
  },
  intervalChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  intervalChipText: { fontSize: 14, fontWeight: '600' },
  editRow: { padding: 16, gap: 12 },
  intervalsInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    fontSize: 16,
  },
  editButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingHorizontal: 16, paddingVertical: 8 },
  saveBtn: { paddingHorizontal: 20, paddingVertical: 8, borderRadius: 8 },
  catRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  catLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  catName: { fontSize: 16 },
  catCount: { fontSize: 14 },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  linkText: { fontSize: 16, fontWeight: '500' },
});
