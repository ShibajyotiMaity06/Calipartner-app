import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import type { Units } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ProfileEditScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, updateProfile, changeUsername } = useAuth();
  const { status: usernameStatus, checkAvailability } = useUsername();

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [heightCm, setHeightCm] = useState(profile ? String(profile.height_cm) : '175');
  const [units, setUnits] = useState<Units>(profile?.units ?? 'metric');
  const [discoverable, setDiscoverable] = useState(profile?.discoverable ?? true);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!newUsername || newUsername.trim().length < 3) return;
    const timer = setTimeout(() => {
      checkAvailability(newUsername);
    }, 400);
    return () => clearTimeout(timer);
  }, [newUsername, checkAvailability]);

  const handleSaveProfile = async () => {
    setErrorMessage(null);
    setFeedbackMessage(null);

    const heightNum = parseFloat(heightCm);
    if (isNaN(heightNum) || heightNum < 50 || heightNum > 300) {
      setErrorMessage('Height must be between 50 and 300 cm.');
      return;
    }

    setLoading(true);
    const { error } = await updateProfile({
      nickname: nickname.trim(),
      height_cm: heightNum,
      units,
      discoverable,
    });
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setFeedbackMessage(t('profileEdit.saveSuccess'));
    }
  };

  const handleChangeUsername = async () => {
    if (!newUsername.trim()) return;
    setErrorMessage(null);
    setFeedbackMessage(null);

    const isAvailable = await checkAvailability(newUsername);
    if (!isAvailable) {
      setErrorMessage(t('profileSetup.usernameTaken'));
      return;
    }

    setLoading(true);
    const { error } = await changeUsername(newUsername.trim());
    setLoading(false);

    if (error) {
      setErrorMessage(error.message);
    } else {
      setNewUsername('');
      setFeedbackMessage(t('profileEdit.saveSuccess'));
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Pressable testID="btn-back" style={styles.backButton} onPress={() => router.back()}>
            <Text style={{ color: colors.accent, fontSize: fontSize.md, fontWeight: '500' }}>
              ‹ Back
            </Text>
          </Pressable>
          <Text style={[styles.title, { color: colors.text }]}>{t('profileEdit.title')}</Text>
        </View>

        {feedbackMessage && (
          <View
            style={[
              styles.feedbackBox,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.sm }}>{feedbackMessage}</Text>
          </View>
        )}

        {errorMessage && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{errorMessage}</Text>
          </View>
        )}

        {/* Current profile info */}
        <View
          style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.label, { color: colors.textMuted }]}>Current @username</Text>
          <Text
            style={{
              color: colors.text,
              fontSize: fontSize.lg,
              fontWeight: '600',
              marginBottom: spacing.md,
            }}
          >
            @{profile?.username ?? '—'}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileEdit.nicknameLabel')}
          </Text>
          <TextInput
            testID="input-edit-nickname"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            value={nickname}
            onChangeText={setNickname}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Height (cm)</Text>
          <TextInput
            testID="input-edit-height"
            style={[
              styles.input,
              { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
            ]}
            keyboardType="decimal-pad"
            value={heightCm}
            onChangeText={setHeightCm}
          />

          {/* Units */}
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileEdit.unitsLabel')}
          </Text>
          <View style={styles.segmentedRow}>
            {(['metric', 'imperial'] as const).map((u) => (
              <Pressable
                key={u}
                testID={`btn-edit-units-${u}`}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: units === u ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setUnits(u)}
              >
                <Text
                  style={{
                    color: units === u ? colors.onAccent : colors.text,
                    fontSize: fontSize.sm,
                    fontWeight: '600',
                  }}
                >
                  {t(`profileSetup.${u}`)}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Discoverable toggle */}
          <View style={[styles.switchRow, { marginTop: spacing.md }]}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '500' }}>
                {t('profileEdit.discoverableLabel')}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
                {t('profileEdit.discoverableDescription')}
              </Text>
            </View>
            <Switch
              testID="switch-discoverable"
              value={discoverable}
              onValueChange={setDiscoverable}
            />
          </View>

          <Pressable
            testID="btn-save-profile"
            style={[
              styles.primaryButton,
              { backgroundColor: colors.accent, marginTop: spacing.lg },
            ]}
            onPress={handleSaveProfile}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.onAccent} />
            ) : (
              <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
                {t('common.save')}
              </Text>
            )}
          </Pressable>
        </View>

        {/* Change Username Card */}
        <View
          style={[
            styles.card,
            { borderColor: colors.border, backgroundColor: colors.surface, marginTop: spacing.lg },
          ]}
        >
          <Text style={{ color: colors.text, fontSize: fontSize.lg, fontWeight: '600' }}>
            {t('profileEdit.changeUsernameLabel')}
          </Text>
          <Text
            style={{ color: colors.textMuted, fontSize: fontSize.sm, marginVertical: spacing.xs }}
          >
            {t('profileEdit.changeUsernameNotice')}
          </Text>

          <TextInput
            testID="input-change-username"
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
                marginTop: spacing.sm,
              },
            ]}
            placeholder="new_username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            value={newUsername}
            onChangeText={setNewUsername}
          />

          {newUsername.length >= 3 && (
            <Text
              style={{ color: colors.textMuted, fontSize: fontSize.sm, marginBottom: spacing.sm }}
            >
              {usernameStatus === 'checking'
                ? t('profileSetup.checkingAvailability')
                : usernameStatus === 'available'
                  ? t('profileSetup.usernameAvailable')
                  : usernameStatus === 'taken'
                    ? t('profileSetup.usernameTaken')
                    : usernameStatus === 'invalid'
                      ? t('profileSetup.usernameInvalid')
                      : ''}
            </Text>
          )}

          <Pressable
            testID="btn-change-username"
            style={[styles.secondaryButton, { borderColor: colors.border }]}
            onPress={handleChangeUsername}
            disabled={loading || !newUsername.trim()}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.md, fontWeight: '500' }}>
              Update @username
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: 56,
    paddingBottom: 48,
  },
  header: {
    marginBottom: spacing.lg,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  backButton: {
    marginBottom: spacing.xs,
  },
  feedbackBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    borderWidth: 1,
    paddingVertical: 12,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
});
