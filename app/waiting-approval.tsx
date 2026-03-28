import React, { useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Colors from '@/constants/Colors';
import CategoryPicker from '@/components/CategoryPicker';
import EmptyState from '@/components/EmptyState';
import PriorityBadge from '@/components/PriorityBadge';
import PriorityPicker from '@/components/PriorityPicker';
import { useStore } from '@/lib/store';
import { ImportResult } from '@/lib/import';
import { PriorityCode, StagedHighlight } from '@/lib/types';

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

export default function WaitingApprovalScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];

  const categories = useStore((s) => s.categories);
  const stagedHighlights = useStore((s) => s.stagedHighlights);
  const syncRequests = useStore((s) => s.syncRequests);
  const requestAppleBooksSync = useStore((s) => s.requestAppleBooksSync);
  const bulkImportFromJson = useStore((s) => s.bulkImportFromJson);
  const updateStagedHighlightFields = useStore((s) => s.updateStagedHighlightFields);
  const approveStagedHighlight = useStore((s) => s.approveStagedHighlight);
  const rejectStagedHighlight = useStore((s) => s.rejectStagedHighlight);
  const approveAllPendingStagedHighlights = useStore((s) => s.approveAllPendingStagedHighlights);
  const rejectAllPendingStagedHighlights = useStore((s) => s.rejectAllPendingStagedHighlights);
  const setPendingHighlightsCategory = useStore((s) => s.setPendingHighlightsCategory);

  const [showBulkAdd, setShowBulkAdd] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [importPreview, setImportPreview] = useState<ImportResult | null>(null);
  const [lastImport, setLastImport] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);

  const canValidate = jsonText.trim().length > 0;
  const canImport = !!importPreview && importPreview.errors.length === 0 && importPreview.valid > 0 && !importing;

  const previewTitle = importPreview
    ? importPreview.errors.length > 0 ? 'Validation failed' : 'Validation summary'
    : 'No preview yet';

  const handleBulkValidate = async () => {
    const result = await bulkImportFromJson(jsonText, { dryRun: true });
    setImportPreview(result);
    setLastImport(null);
  };

  const handleBulkImport = async () => {
    if (!canImport) return;
    setImporting(true);
    try {
      const result = await bulkImportFromJson(jsonText);
      setImportPreview(result);
      setLastImport(result);
      if (result.errors.length === 0) {
        setShowBulkAdd(false);
        setJsonText('');
        setImportPreview(null);
        setLastImport(null);
      }
    } catch (e) {
      notify(getErrorMessage(e), true);
    } finally {
      setImporting(false);
    }
  };

  const closeBulkAdd = () => {
    setShowBulkAdd(false);
    setJsonText('');
    setImportPreview(null);
    setLastImport(null);
  };

  const [editingHighlight, setEditingHighlight] = useState<StagedHighlight | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editDetail, setEditDetail] = useState('');
  const [editSource, setEditSource] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [editPriorityCode, setEditPriorityCode] = useState<PriorityCode>(2);
  const [saving, setSaving] = useState(false);

  const pendingHighlights = useMemo(
    () => stagedHighlights.filter((h) => h.approvalStatus === 'pending'),
    [stagedHighlights]
  );
  const approvedHighlights = useMemo(
    () => stagedHighlights.filter((h) => h.approvalStatus === 'approved'),
    [stagedHighlights]
  );
  const rejectedHighlights = useMemo(
    () => stagedHighlights.filter((h) => h.approvalStatus === 'rejected'),
    [stagedHighlights]
  );

  const latestRequest = syncRequests[0];
  const syncInFlight =
    latestRequest?.source === 'apple_books' &&
    (latestRequest.status === 'pending' || latestRequest.status === 'running');
  const needsBooksDefault = pendingHighlights.some((h) => h.categoryId !== 'books');
  const readyToApproveAll = pendingHighlights.filter(
    (h) => !!h.categoryId && h.categoryStatus === 'chosen'
  ).length;

  const openEdit = (highlight: StagedHighlight) => {
    setEditingHighlight(highlight);
    setEditContent(highlight.content);
    setEditDetail(highlight.detail ?? '');
    setEditSource(highlight.source ?? '');
    setEditCategoryId(highlight.categoryId ?? categories[0]?.id ?? '');
    setEditPriorityCode(highlight.priorityCode);
  };

  const closeEdit = () => {
    setEditingHighlight(null);
  };

  const handleSaveEdit = async () => {
    if (!editingHighlight || !editContent.trim()) return;
    setSaving(true);
    try {
      await updateStagedHighlightFields(editingHighlight.id, {
        content: editContent.trim(),
        detail: editDetail.trim(),
        source: editSource.trim(),
        categoryId: editCategoryId,
        priorityCode: editPriorityCode,
      });
      closeEdit();
    } catch (e) {
      notify(getErrorMessage(e), true);
    } finally {
      setSaving(false);
    }
  };

  const handleSyncRequest = async () => {
    try {
      await requestAppleBooksSync();
      notify('Apple Books sync requested.');
    } catch (e) {
      notify(getErrorMessage(e), true);
    }
  };

  const handleApproveAll = async () => {
    try {
      await approveAllPendingStagedHighlights();
    } catch (e) {
      notify(getErrorMessage(e), true);
    }
  };

  const handleRejectAll = async () => {
    try {
      await rejectAllPendingStagedHighlights();
    } catch (e) {
      notify(getErrorMessage(e), true);
    }
  };

  const handleApprove = async (highlight: StagedHighlight) => {
    try {
      await approveStagedHighlight(highlight.id);
    } catch (e) {
      notify(getErrorMessage(e), true);
    }
  };

  const handleReject = async (highlight: StagedHighlight) => {
    try {
      await rejectStagedHighlight(highlight.id);
    } catch (e) {
      notify(getErrorMessage(e), true);
    }
  };

  return (
    <>
      <ScrollView
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.pageHeader}>
          <Text style={[styles.title, { color: colors.text }]}>Approval</Text>
          <View style={styles.headerButtons}>
            <TouchableOpacity
              onPress={handleSyncRequest}
              disabled={syncInFlight}
              style={[
                styles.syncButton,
                { backgroundColor: syncInFlight ? colors.tint + '40' : colors.tint },
              ]}
              activeOpacity={0.8}
            >
              <Ionicons name="sync-outline" size={16} color="#fff" />
              <Text style={styles.syncButtonText}>
                {syncInFlight ? 'Syncing…' : 'Sync Books'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setShowBulkAdd(true)}
              style={[styles.syncButton, { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }]}
              activeOpacity={0.8}
            >
              <Ionicons name="add-outline" size={16} color={colors.text} />
              <Text style={[styles.syncButtonText, { color: colors.text }]}>Bulk Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>PENDING</Text>
          <Text style={[styles.sectionCount, { color: colors.textTertiary }]}>
            {pendingHighlights.length}
          </Text>
        </View>

        {pendingHighlights.length > 0 ? (
          <>
            <View style={styles.actionRow}>
              <TouchableOpacity
                onPress={() =>
                  setPendingHighlightsCategory('books').catch((e) =>
                    notify(getErrorMessage(e), true)
                  )
                }
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
                  Set All To Books
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
                <Text style={[styles.secondaryButtonText, { color: colors.success }]}>
                  Approve All Ready ({readyToApproveAll})
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleRejectAll}
                style={[
                  styles.secondaryButton,
                  {
                    backgroundColor: colors.destructive + '12',
                    borderColor: colors.destructive,
                    opacity: pendingHighlights.length > 0 ? 1 : 0.55,
                  },
                ]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.destructive }]}>
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
                onEdit={() => openEdit(highlight)}
                onApprove={() => handleApprove(highlight)}
                onReject={() => handleReject(highlight)}
              />
            ))}
          </>
        ) : (
          <EmptyState
            icon="hourglass-outline"
            title="Nothing waiting"
            subtitle="Request a sync from Apple Books or bulk import JSON, then approve highlights here."
          />
        )}

        <HistorySection title="APPROVED" highlights={approvedHighlights} colors={colors} />
        <HistorySection title="REJECTED" highlights={rejectedHighlights} colors={colors} />
      </ScrollView>

      {/* Edit bottom sheet */}
      <Modal
        visible={!!editingHighlight}
        transparent
        animationType="slide"
        onRequestClose={closeEdit}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeEdit} />
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View
              style={[
                styles.modalCard,
                { backgroundColor: colors.background, borderColor: colors.border },
              ]}
            >
              <View
                style={[styles.sheetHandle, { backgroundColor: colors.textTertiary + '40' }]}
              />
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Item</Text>
                <TouchableOpacity onPress={closeEdit} style={styles.closeButton}>
                  <Ionicons name="close-outline" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>

              <ScrollView
                contentContainerStyle={styles.modalContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CONTENT</Text>
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
                    value={editContent}
                    onChangeText={setEditContent}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    NOTES (OPTIONAL)
                  </Text>
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
                    placeholder="Add context or notes..."
                    placeholderTextColor={colors.textTertiary}
                    value={editDetail}
                    onChangeText={setEditDetail}
                    multiline
                    textAlignVertical="top"
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                    SOURCE (OPTIONAL)
                  </Text>
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
                    value={editSource}
                    onChangeText={setEditSource}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>CATEGORY</Text>
                  <CategoryPicker
                    categories={categories}
                    selectedCategoryId={editCategoryId}
                    onSelect={setEditCategoryId}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>PRIORITY</Text>
                  <PriorityPicker
                    selectedPriorityCode={editPriorityCode}
                    onSelect={setEditPriorityCode}
                  />
                </View>

                <View style={styles.modalActions}>
                  <TouchableOpacity
                    onPress={closeEdit}
                    style={[
                      styles.cancelButton,
                      { borderColor: colors.border, backgroundColor: colors.surface },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.cancelButtonText, { color: colors.text }]}>Cancel</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={handleSaveEdit}
                    disabled={!editContent.trim() || saving}
                    style={[
                      styles.saveButton,
                      {
                        backgroundColor:
                          editContent.trim() && !saving
                            ? colors.tint
                            : colors.tint + '40',
                      },
                    ]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>{saving ? 'Saving…' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Bulk Add Modal */}
      <Modal visible={showBulkAdd} transparent animationType="slide" onRequestClose={closeBulkAdd}>
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={closeBulkAdd} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalKeyboard}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, shadowColor: colorScheme === 'dark' ? '#000' : '#111d2d' }]}>
              <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
                <View>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>Bulk Import JSON</Text>
                  <Text style={[styles.bulkAddSubtitle, { color: colors.textSecondary }]}>
                    Paste a highlights payload, validate, then stage for review.
                  </Text>
                </View>
                <TouchableOpacity onPress={closeBulkAdd}>
                  <Ionicons name="close" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.bulkScrollContent}>

                {/* JSON Payload card */}
                <View style={[styles.bulkCard, { backgroundColor: colors.elevated, borderColor: colors.borderLight }]}>
                  <Text style={[styles.bulkCardTitle, { color: colors.textSecondary }]}>JSON PAYLOAD</Text>
                  <TextInput
                    style={[styles.jsonInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
                    value={jsonText}
                    onChangeText={(text) => { setJsonText(text); setImportPreview(null); setLastImport(null); }}
                    placeholder={SAMPLE_JSON}
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    textAlignVertical="top"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <View style={styles.bulkActions}>
                    <TouchableOpacity
                      onPress={() => { setJsonText(SAMPLE_JSON); setImportPreview(null); setLastImport(null); }}
                      style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.background }]}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Use Sample</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={handleBulkValidate}
                      disabled={!canValidate}
                      style={[styles.primaryButton, { backgroundColor: canValidate ? colors.tint : colors.tint + '40' }]}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Validate</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Preview card */}
                <View style={[styles.bulkCard, { backgroundColor: colors.elevated, borderColor: colors.borderLight }]}>
                  <Text style={[styles.bulkCardTitle, { color: colors.textSecondary }]}>{previewTitle.toUpperCase()}</Text>

                  {importPreview ? (
                    <>
                      <BulkSummaryRow label="Total rows" value={String(importPreview.total)} colors={colors} />
                      <BulkSummaryRow label="Valid rows" value={String(importPreview.valid)} colors={colors} />
                      <BulkSummaryRow label="Invalid rows" value={String(importPreview.skippedInvalid)} colors={colors} />
                      <BulkSummaryRow label="Duplicate rows" value={String(importPreview.skippedDuplicates)} colors={colors} />
                      <BulkSummaryRow label="Ready to import" value={String(importPreview.imported)} colors={colors} />

                      {importPreview.invalidRows.length > 0 && (
                        <View style={styles.bulkBlock}>
                          <Text style={[styles.bulkBlockTitle, { color: colors.textSecondary }]}>Invalid Rows</Text>
                          {importPreview.invalidRows.slice(0, 8).map((row) => (
                            <Text key={`${row.rowIndex}-${row.reason}`} style={[styles.bulkBlockLine, { color: colors.destructive }]}>
                              Row {row.rowIndex}: {row.reason}
                            </Text>
                          ))}
                        </View>
                      )}
                      {importPreview.errors.length > 0 && (
                        <View style={styles.bulkBlock}>
                          <Text style={[styles.bulkBlockTitle, { color: colors.textSecondary }]}>Errors</Text>
                          {importPreview.errors.map((error) => (
                            <Text key={error} style={[styles.bulkBlockLine, { color: colors.destructive }]}>{error}</Text>
                          ))}
                        </View>
                      )}
                      {importPreview.warnings.length > 0 && (
                        <View style={styles.bulkBlock}>
                          <Text style={[styles.bulkBlockTitle, { color: colors.textSecondary }]}>Warnings</Text>
                          {importPreview.warnings.slice(0, 8).map((warning) => (
                            <Text key={warning} style={[styles.bulkBlockLine, { color: colors.warning }]}>{warning}</Text>
                          ))}
                        </View>
                      )}
                    </>
                  ) : (
                    <Text style={[styles.bulkEmptyText, { color: colors.textTertiary }]}>
                      Validate JSON to preview valid, invalid, and duplicate counts.
                    </Text>
                  )}

                  <TouchableOpacity
                    onPress={handleBulkImport}
                    disabled={!canImport}
                    style={[styles.importButton, { backgroundColor: canImport ? colors.success : colors.success + '55' }]}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                    <Text style={styles.importButtonText}>{importing ? 'Staging…' : 'Stage for Review'}</Text>
                  </TouchableOpacity>

                  {lastImport && lastImport.errors.length === 0 && (
                    <Text style={[styles.bulkFooterNote, { color: colors.textTertiary }]}>
                      {lastImport.imported} item{lastImport.imported !== 1 ? 's' : ''} staged for review
                      {lastImport.skippedDuplicates > 0 ? `, ${lastImport.skippedDuplicates} duplicates skipped` : ''}
                      {lastImport.skippedInvalid > 0 ? `, ${lastImport.skippedInvalid} invalid skipped` : ''}.
                    </Text>
                  )}
                </View>

              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
}

function ApprovalCard({
  highlight,
  colors,
  categories,
  onEdit,
  onApprove,
  onReject,
}: {
  highlight: StagedHighlight;
  colors: any;
  categories: ReturnType<typeof useStore.getState>['categories'];
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const isReady = !!highlight.categoryId && highlight.categoryStatus === 'chosen';
  const category = categories.find((c) => c.id === highlight.categoryId);

  return (
    <View
      style={[
        styles.card,
        styles.highlightCard,
        { backgroundColor: colors.surface, borderColor: colors.borderLight },
      ]}
    >
      {/* Header row */}
      <View style={styles.cardTopRow}>
        <View style={styles.cardLeading}>
          <View style={styles.cardMeta}>
            <Text style={[styles.highlightSource, { color: colors.text }]} numberOfLines={1}>
              {highlight.source || 'Unknown source'}
            </Text>
            {highlight.highlightedAt ? (
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                {formatHighlightDate(highlight.highlightedAt)}
              </Text>
            ) : null}
          </View>
        </View>
        <TouchableOpacity onPress={onEdit} style={styles.editButton} activeOpacity={0.7}>
          <Ionicons name="create-outline" size={20} color={colors.textTertiary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <Text style={[styles.highlightContent, { color: colors.text }]} numberOfLines={3}>
        {highlight.content}
      </Text>

      {/* Pills row */}
      <View style={styles.pillsRow}>
        {category ? (
          <View style={[styles.categoryPill, { backgroundColor: category.color + '15' }]}>
            <Text style={[styles.categoryPillText, { color: category.color }]}>
              {category.name}
            </Text>
          </View>
        ) : (
          <View style={[styles.categoryPill, { backgroundColor: colors.warning + '18' }]}>
            <Text style={[styles.categoryPillText, { color: colors.warning }]}>
              No category — tap edit
            </Text>
          </View>
        )}
        <PriorityBadge
          priorityCode={highlight.priorityCode}
          priorityLabel={highlight.priorityLabel}
          compact
        />
      </View>

      {/* Actions */}
      <View style={styles.actionButtons}>
        <TouchableOpacity
          onPress={onReject}
          style={[
            styles.outlineAction,
            { borderColor: colors.border, backgroundColor: colors.background },
          ]}
          activeOpacity={0.8}
        >
          <Text style={[styles.outlineActionText, { color: colors.textSecondary }]}>Reject</Text>
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
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>{title}</Text>
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
              <Text style={[styles.historySource, { color: colors.text }]} numberOfLines={1}>
                {highlight.source || 'Unknown source'}
              </Text>
              <Text style={[styles.metaText, { color: colors.textTertiary }]}>
                {highlight.importStatus === 'skipped_duplicate'
                  ? 'Duplicate'
                  : formatStatus(highlight.approvalStatus)}
              </Text>
            </View>
            <Text style={[styles.historyContent, { color: colors.textSecondary }]} numberOfLines={2}>
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
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function notify(message: string, isError = false) {
  if (Platform.OS === 'web') {
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
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: { fontSize: 34, fontWeight: '700', letterSpacing: 0.37 },

  card: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: '600' },

  headerButtons: {
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 8,
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  syncButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  bulkAddLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 6 },
  bulkAddInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  bulkAddTextArea: { minHeight: 180 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 13, fontWeight: '600', letterSpacing: 0.6 },
  sectionCount: { fontSize: 13, fontWeight: '600' },
  sectionNote: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  errorText: { fontSize: 13, marginTop: 8, lineHeight: 18 },

  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  secondaryButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '600' },

  highlightCard: { marginBottom: 12 },
  historyCard: { marginBottom: 10 },

  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cardLeading: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  dot: { width: 9, height: 9, borderRadius: 4.5, flexShrink: 0 },
  cardMeta: { flex: 1 },
  editButton: { padding: 4 },

  highlightSource: { fontSize: 14, fontWeight: '600' },
  metaText: { fontSize: 12, marginTop: 1 },
  highlightContent: { fontSize: 16, fontWeight: '700', lineHeight: 24, letterSpacing: -0.2, marginBottom: 12 },

  pillsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  categoryPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 },
  categoryPillText: { fontSize: 11, fontWeight: '700' },

  actionButtons: { flexDirection: 'row', gap: 10 },
  outlineAction: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  outlineActionText: { fontSize: 15, fontWeight: '600' },
  primaryAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryActionText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 4,
  },
  historySource: { fontSize: 14, fontWeight: '600', flex: 1 },
  historyContent: { fontSize: 14, lineHeight: 20 },

  // Edit bottom sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.34)',
  },
  modalKeyboard: { width: '100%', maxHeight: '92%' },
  sheetHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
    marginBottom: 8,
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
  modalTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  closeButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  modalContent: { padding: 20, paddingBottom: 32 },
  field: { marginBottom: 20 },
  fieldLabel: { fontSize: 13, fontWeight: '600', letterSpacing: 0.5, marginBottom: 8 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  contentInput: { minHeight: 80 },
  detailInput: { minHeight: 60 },
  modalActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  cancelButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  cancelButtonText: { fontSize: 15, fontWeight: '500' },
  saveButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
