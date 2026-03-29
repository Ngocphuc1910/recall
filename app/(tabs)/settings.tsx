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
import * as AppleAuthentication from 'expo-apple-authentication';
import Colors from '@/constants/Colors';
import { useStore } from '@/lib/store';
import { useTabBarScrollHandler } from '@/lib/tab-bar-visibility';

export default function SettingsScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const router = useRouter();
  const tabBarScroll = useTabBarScrollHandler();

  const settings = useStore((s) => s.settings);
  const categories = useStore((s) => s.categories);
  const items = useStore((s) => s.items);
  const updateSettings = useStore((s) => s.updateSettings);
  const stagedHighlights = useStore((s) => s.stagedHighlights);
  const syncRequests = useStore((s) => s.syncRequests);
  const requestAppleBooksSync = useStore((s) => s.requestAppleBooksSync);
  const cloudAuthStatus = useStore((s) => s.cloudAuthStatus);
  const cloudSyncStatus = useStore((s) => s.cloudSyncStatus);
  const cloudUserId = useStore((s) => s.cloudUserId);
  const cloudAccountId = useStore((s) => s.cloudAccountId);
  const cloudProvider = useStore((s) => s.cloudProvider);
  const cloudIsAnonymous = useStore((s) => s.cloudIsAnonymous);
  const cloudIsStableAccount = useStore((s) => s.cloudIsStableAccount);
  const cloudError = useStore((s) => s.cloudError);
  const lastSyncedAt = useStore((s) => s.lastSyncedAt);
  const initializeCloudSync = useStore((s) => s.initializeCloudSync);
  const startAppleUpgrade = useStore((s) => s.startAppleUpgrade);
  const startGoogleUpgrade = useStore((s) => s.startGoogleUpgrade);
  const startGoogleLogin = useStore((s) => s.startGoogleLogin);
  const createAccountLinkCode = useStore((s) => s.createAccountLinkCode);
  const redeemAccountLinkCode = useStore((s) => s.redeemAccountLinkCode);
  const signOutCloudUser = useStore((s) => s.signOutCloudUser);

  const [editingIntervals, setEditingIntervals] = useState(false);
  const [intervalsText, setIntervalsText] = useState(
    settings.defaultIntervals.join(', ')
  );
  const [generatedLinkCode, setGeneratedLinkCode] = useState<string | null>(null);
  const [redeemCode, setRedeemCode] = useState('');

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
  const pendingApprovals = stagedHighlights.filter(
    (highlight) => highlight.approvalStatus === 'pending'
  ).length;
  const latestAppleBooksRequest = syncRequests.find(
    (request) => request.source === 'apple_books'
  );
  const appleBooksSyncInFlight =
    latestAppleBooksRequest?.status === 'pending' ||
    latestAppleBooksRequest?.status === 'running';

  const handleAppleBooksSync = async () => {
    try {
      await requestAppleBooksSync();
      if (Platform.OS === 'web') {
        alert('Apple Books sync requested. Your Mac sync agent can fetch it now.');
      } else {
        Alert.alert(
          'Sync Requested',
          'Apple Books sync requested. Your Mac sync agent can fetch it now.'
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to request Apple Books sync.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleAppleUpgrade = async () => {
    try {
      await startAppleUpgrade();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start Apple sign-in.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleGoogleUpgrade = async () => {
    try {
      await startGoogleUpgrade();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to start Google sign-in.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await startGoogleLogin();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to sign in with Google.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleCreateLinkCode = async () => {
    try {
      const linkCode = await createAccountLinkCode();
      setGeneratedLinkCode(linkCode.code);
      if (Platform.OS === 'web') {
        alert(`Link code created: ${linkCode.code}`);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to create account link code.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleRedeemLinkCode = async () => {
    try {
      await redeemAccountLinkCode(redeemCode.trim());
      setRedeemCode('');
      if (Platform.OS === 'web') {
        alert('Account link code redeemed. Your account is now synced.');
      } else {
        Alert.alert('Success', 'Account link code redeemed.');
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to redeem account link code.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutCloudUser();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign out.';
      if (Platform.OS === 'web') {
        alert(message);
      } else {
        Alert.alert('Error', message);
      }
    }
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      onScroll={tabBarScroll.onScroll}
      scrollEventThrottle={tabBarScroll.scrollEventThrottle}
    >
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          CLOUD SYNC
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          <StatRow
            label="Auth"
            value={formatCloudStatus(cloudAuthStatus)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Sync"
            value={formatCloudStatus(cloudSyncStatus)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="User ID"
            value={cloudUserId ? `${cloudUserId.slice(0, 8)}...` : 'Not signed in'}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Account ID"
            value={cloudAccountId ? `${cloudAccountId.slice(0, 8)}...` : 'Not resolved'}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Provider"
            value={cloudProvider ?? 'Unknown'}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Account Type"
            value={cloudIsStableAccount ? 'Stable' : cloudIsAnonymous ? 'Anonymous trial' : 'Temporary'}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Last Sync"
            value={lastSyncedAt ? formatDateTime(lastSyncedAt) : 'Not yet'}
            colors={colors}
          />
        </View>

        {Platform.OS === 'web' && cloudIsAnonymous ? (
          <>
            <TouchableOpacity
              onPress={handleGoogleLogin}
              style={[
                styles.card,
                styles.linkRow,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="log-in-outline" size={20} color={colors.tint} />
                <Text style={[styles.linkText, { color: colors.text }]}>
                  Sign In To Existing Google Account
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleGoogleUpgrade}
              style={[
                styles.card,
                styles.linkRow,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="logo-google" size={20} color={colors.tint} />
                <Text style={[styles.linkText, { color: colors.text }]}>
                  Upgrade Trial To Google Account
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>
          </>
        ) : null}

        {Platform.OS === 'web' && !cloudIsStableAccount && !cloudIsAnonymous ? (
          <TouchableOpacity
            onPress={handleGoogleUpgrade}
            style={[
              styles.card,
              styles.linkRow,
              { backgroundColor: colors.surface, borderColor: colors.borderLight },
            ]}
            activeOpacity={0.7}
          >
            <View style={styles.linkLeft}>
              <Ionicons name="logo-google" size={20} color={colors.tint} />
              <Text style={[styles.linkText, { color: colors.text }]}>
                Continue With Google
              </Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textTertiary}
            />
          </TouchableOpacity>
        ) : null}

        {Platform.OS === 'ios' && !cloudIsStableAccount ? (
          <View
            style={[
              styles.card,
              styles.appleButtonCard,
              {
                backgroundColor: colors.surface,
                borderColor: colors.borderLight,
              },
            ]}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={10}
              style={styles.appleButton}
              onPress={handleAppleUpgrade}
            />
          </View>
        ) : null}

        {cloudIsStableAccount ? (
          <>
            <TouchableOpacity
              onPress={handleCreateLinkCode}
              style={[
                styles.card,
                styles.linkRow,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
              ]}
              activeOpacity={0.7}
            >
              <View style={styles.linkLeft}>
                <Ionicons name="key-outline" size={20} color={colors.tint} />
                <Text style={[styles.linkText, { color: colors.text }]}>
                  Generate Device Link Code
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={colors.textTertiary}
              />
            </TouchableOpacity>

            {generatedLinkCode ? (
              <Text style={[styles.sectionNote, { color: colors.text }]}>
                Current link code: {generatedLinkCode}
              </Text>
            ) : null}

            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.borderLight },
              ]}
            >
              <TextInput
                style={[
                  styles.linkCodeInput,
                  { color: colors.text, borderColor: colors.border },
                ]}
                value={redeemCode}
                onChangeText={setRedeemCode}
                placeholder="Redeem device link code"
                placeholderTextColor={colors.textTertiary}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={handleRedeemLinkCode}
                disabled={!redeemCode.trim()}
                style={[
                  styles.inlineAction,
                  {
                    backgroundColor: redeemCode.trim()
                      ? colors.tint
                      : `${colors.tint}55`,
                  },
                ]}
              >
                <Text style={styles.inlineActionText}>Redeem Code</Text>
              </TouchableOpacity>
            </View>

            {Platform.OS === 'web' ? (
              <TouchableOpacity
                onPress={handleSignOut}
                style={[
                  styles.card,
                  styles.linkRow,
                  { backgroundColor: colors.surface, borderColor: colors.borderLight },
                ]}
                activeOpacity={0.7}
              >
                <View style={styles.linkLeft}>
                  <Ionicons name="log-out-outline" size={20} color={colors.destructive} />
                  <Text style={[styles.linkText, { color: colors.text }]}>
                    Sign Out
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={16}
                  color={colors.textTertiary}
                />
              </TouchableOpacity>
            ) : null}
          </>
        ) : null}

        <TouchableOpacity
          onPress={initializeCloudSync}
          style={[
            styles.card,
            styles.linkRow,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <Ionicons name="sync-outline" size={20} color={colors.tint} />
            <Text style={[styles.linkText, { color: colors.text }]}>
              Retry Firebase Sync
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          {Platform.OS === 'web' && cloudIsAnonymous
            ? 'Use Sign In if you already have a Google-backed Recall account. Use Upgrade if you want to keep this anonymous trial account and attach Google to it.'
            : 'Recall now resolves a stable account before syncing durable data. Anonymous accounts are temporary and should be upgraded on web before using cross-device sync.'}
        </Text>
        {cloudError ? (
          <Text style={[styles.sectionNote, { color: colors.destructive }]}>
            {cloudError}
          </Text>
        ) : null}
      </View>

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
          ARCHIVE
        </Text>
        <TouchableOpacity
          onPress={() => router.push('/archived')}
          style={[
            styles.card,
            styles.linkRow,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <Ionicons name="archive-outline" size={20} color={colors.tint} />
            <View>
              <Text style={[styles.linkText, { color: colors.text }]}>
                Archived Items
              </Text>
              <Text style={[styles.linkSubtext, { color: colors.textSecondary }]}>
                Hidden from Today and Library, kept for reference.
              </Text>
            </View>
          </View>
          <View style={styles.linkRight}>
            <Text style={[styles.linkValue, { color: colors.textSecondary }]}>
              {archivedCount}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={16}
              color={colors.textTertiary}
            />
          </View>
        </TouchableOpacity>
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
          APPLE BOOKS
        </Text>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
        >
          <StatRow
            label="Pending Approval"
            value={String(pendingApprovals)}
            colors={colors}
          />
          <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />
          <StatRow
            label="Last Request"
            value={
              latestAppleBooksRequest
                ? formatCloudStatus(latestAppleBooksRequest.status)
                : 'Not requested'
            }
            colors={colors}
          />
        </View>

        <TouchableOpacity
          onPress={handleAppleBooksSync}
          disabled={appleBooksSyncInFlight}
          style={[
            styles.card,
            styles.linkRow,
            {
              backgroundColor: colors.surface,
              borderColor: colors.borderLight,
              opacity: appleBooksSyncInFlight ? 0.65 : 1,
            },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <Ionicons name="sync-outline" size={20} color={colors.tint} />
            <Text style={[styles.linkText, { color: colors.text }]}>
              {appleBooksSyncInFlight
                ? 'Apple Books Sync In Progress'
                : 'Request Apple Books Sync'}
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/waiting-approval' as any)}
          style={[
            styles.card,
            styles.linkRow,
            { backgroundColor: colors.surface, borderColor: colors.borderLight },
          ]}
          activeOpacity={0.7}
        >
          <View style={styles.linkLeft}>
            <Ionicons
              name="checkmark-done-circle-outline"
              size={20}
              color={colors.tint}
            />
            <Text style={[styles.linkText, { color: colors.text }]}>
              Open Waiting Approval
            </Text>
          </View>
          <Ionicons
            name="chevron-forward"
            size={16}
            color={colors.textTertiary}
          />
        </TouchableOpacity>

        <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
          Synced Apple Books highlights stay in Waiting Approval until you choose a
          category and approve them. New Apple Books sync requests require a stable
          account.
        </Text>
        {latestAppleBooksRequest?.resultSummary ? (
          <Text style={[styles.sectionNote, { color: colors.textTertiary }]}>
            {latestAppleBooksRequest.resultSummary}
          </Text>
        ) : null}
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

function formatCloudStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
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
  linkSubtext: {
    fontSize: 13,
    marginTop: 2,
  },
  linkRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 12,
  },
  linkValue: {
    fontSize: 15,
    fontWeight: '600',
  },
  linkCodeInput: {
    borderWidth: 1,
    borderRadius: 10,
    margin: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  appleButtonCard: {
    padding: 12,
  },
  appleButton: {
    width: '100%',
    height: 48,
  },
  inlineAction: {
    alignSelf: 'flex-end',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  inlineActionText: {
    color: '#fff',
    fontWeight: '700',
  },
});
