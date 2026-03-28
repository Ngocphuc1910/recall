import React, { useMemo, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  Alert,
  TouchableOpacity,
  useColorScheme,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import { ImportResult } from '@/lib/import';

const SAMPLE_JSON = `{
  "version": 1,
  "source": {
    "provider": "apple_books",
    "bookTitle": "Deep Work",
    "assetId": "book-asset-id"
  },
  "items": [
    {
      "externalId": "highlight-1",
      "content": "Clarity about what matters provides clarity about what does not.",
      "detail": "Chapter 1",
      "meta": {
        "locationCfi": "epubcfi(/6/14!/4/2/10)",
        "highlightedAt": "2026-02-25T08:15:00Z",
        "style": 1
      }
    }
  ]
}`;

export default function ImportScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const bulkImportFromJson = useStore((s) => s.bulkImportFromJson);

  const [jsonText, setJsonText] = useState('');
  const [preview, setPreview] = useState<ImportResult | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const canValidate = jsonText.trim().length > 0;
  const canImport =
    !!preview && preview.errors.length === 0 && preview.valid > 0 && !importing;

  const previewTitle = useMemo(() => {
    if (!preview) return 'No preview yet';
    if (preview.errors.length > 0) return 'Validation failed';
    return 'Validation summary';
  }, [preview]);

  const handleValidate = async () => {
    const result = await bulkImportFromJson(jsonText, { dryRun: true });
    setPreview(result);
    setLastImport(null);
  };

  const handleImport = async () => {
    if (!canImport) return;
    setImporting(true);

    try {
      const result = await bulkImportFromJson(jsonText);
      setPreview(result);
      setLastImport(result);

      if (result.errors.length > 0) {
        return;
      }

      router.replace('/waiting-approval');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Import failed.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Import Error', message);
      }
    } finally {
      setImporting(false);
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.title, { color: colors.text }]}>Bulk Import JSON</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Paste Apple Books highlights payload, validate, then import in bulk.
      </Text>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
          JSON PAYLOAD
        </Text>
        <TextInput
          style={[
            styles.jsonInput,
            {
              color: colors.text,
              backgroundColor: colors.background,
              borderColor: colors.border,
            },
          ]}
          value={jsonText}
          onChangeText={(text) => {
            setJsonText(text);
            setPreview(null);
            setLastImport(null);
          }}
          placeholder={SAMPLE_JSON}
          placeholderTextColor={colors.textTertiary}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          autoCorrect={false}
        />

        <View style={styles.actions}>
          <TouchableOpacity
            onPress={() => {
              setJsonText(SAMPLE_JSON);
              setPreview(null);
              setLastImport(null);
            }}
            style={[
              styles.secondaryButton,
              { borderColor: colors.border, backgroundColor: colors.background },
            ]}
            activeOpacity={0.8}
          >
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>
              Use Sample
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handleValidate}
            disabled={!canValidate}
            style={[
              styles.primaryButton,
              { backgroundColor: canValidate ? colors.tint : colors.tint + '40' },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
            <Text style={styles.primaryButtonText}>Validate</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.borderLight },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>
          {previewTitle.toUpperCase()}
        </Text>

        {preview ? (
          <>
            <SummaryRow label="Total rows" value={String(preview.total)} colors={colors} />
            <SummaryRow label="Valid rows" value={String(preview.valid)} colors={colors} />
            <SummaryRow
              label="Invalid rows"
              value={String(preview.skippedInvalid)}
              colors={colors}
            />
            <SummaryRow
              label="Duplicate rows"
              value={String(preview.skippedDuplicates)}
              colors={colors}
            />
            <SummaryRow
              label="Ready to import"
              value={String(preview.imported)}
              colors={colors}
            />

            {preview.invalidRows.length > 0 ? (
              <View style={styles.block}>
                <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>
                  Invalid Rows
                </Text>
                {preview.invalidRows.slice(0, 8).map((row) => (
                  <Text
                    key={`${row.rowIndex}-${row.reason}`}
                    style={[styles.blockLine, { color: colors.destructive }]}
                  >
                    Row {row.rowIndex}: {row.reason}
                  </Text>
                ))}
              </View>
            ) : null}

            {preview.errors.length > 0 ? (
              <View style={styles.block}>
                <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>
                  Errors
                </Text>
                {preview.errors.map((error) => (
                  <Text
                    key={error}
                    style={[styles.blockLine, { color: colors.destructive }]}
                  >
                    {error}
                  </Text>
                ))}
              </View>
            ) : null}

            {preview.warnings.length > 0 ? (
              <View style={styles.block}>
                <Text style={[styles.blockTitle, { color: colors.textSecondary }]}>
                  Warnings
                </Text>
                {preview.warnings.slice(0, 8).map((warning) => (
                  <Text
                    key={warning}
                    style={[styles.blockLine, { color: colors.warning }]}
                  >
                    {warning}
                  </Text>
                ))}
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            Validate JSON to preview valid, invalid, and duplicate counts.
          </Text>
        )}

        <TouchableOpacity
          onPress={handleImport}
          disabled={!canImport}
          style={[
            styles.importButton,
            { backgroundColor: canImport ? colors.success : colors.success + '55' },
          ]}
          activeOpacity={0.8}
        >
          <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
          <Text style={styles.importButtonText}>{importing ? 'Staging…' : 'Stage for Review'}</Text>
        </TouchableOpacity>

        {lastImport && lastImport.errors.length === 0 ? (
          <Text style={[styles.footerNote, { color: colors.textTertiary }]}>
            {lastImport.imported} item{lastImport.imported !== 1 ? 's' : ''} staged for review
            {lastImport.skippedDuplicates > 0 ? `, ${lastImport.skippedDuplicates} duplicates skipped` : ''}
            {lastImport.skippedInvalid > 0 ? `, ${lastImport.skippedInvalid} invalid skipped` : ''}.
          </Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

function SummaryRow({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: any;
}) {
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.summaryValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40, gap: 16 },
  title: {
    fontSize: 34,
    fontWeight: '700',
    letterSpacing: 0.37,
  },
  subtitle: {
    fontSize: 15,
    marginTop: -6,
    marginBottom: 4,
  },
  card: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  jsonInput: {
    minHeight: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  secondaryButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 10,
    paddingVertical: 12,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  summaryLabel: {
    fontSize: 14,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  block: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E5EA',
    gap: 3,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  blockLine: {
    fontSize: 13,
    lineHeight: 18,
  },
  emptyText: {
    fontSize: 14,
    marginBottom: 6,
  },
  importButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 14,
    borderRadius: 10,
    paddingVertical: 14,
  },
  importButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerNote: {
    fontSize: 12,
    marginTop: 10,
    textAlign: 'center',
  },
});
