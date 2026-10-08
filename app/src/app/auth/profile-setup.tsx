import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { isAtLeast18, type Sex, type Units } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { createProfile } = useAuth();
  const { status: usernameStatus, checkAvailability } = useUsername();

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [heightCm, setHeightCm] = useState('175');
  const [units, setUnits] = useState<Units>('metric');
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Debounced username availability check
  useEffect(() => {
    if (!username || username.trim().length < 3) return;
    const timer = setTimeout(() => {
      checkAvailability(username);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, checkAvailability]);

  const handleSubmit = async () => {
    setSubmitError(null);

    // 1. Validate username
    if (usernameStatus !== 'available') {
      const isNowAvailable = await checkAvailability(username);
      if (!isNowAvailable) {
        setSubmitError(t('profileSetup.usernameTaken'));
        return;
      }
    }

    // 2. Validate nickname
    if (!nickname.trim()) {
      setSubmitError(t('common.errorBody'));
      return;
    }

    // 3. Age gate validation (18+ required)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob.trim())) {
      setSubmitError(t('profileSetup.invalidDobError'));
      return;
    }

    if (!isAtLeast18(dob.trim())) {
      setSubmitError(t('profileSetup.under18Error'));
      return;
    }

    // 4. Validate height
    const heightNum = parseFloat(heightCm);
    if (isNaN(heightNum) || heightNum < 50 || heightNum > 300) {
      setSubmitError('Height must be between 50 and 300 cm.');
      return;
    }

    setLoading(true);
    const { error } = await createProfile({
      username: username.trim(),
      nickname: nickname.trim(),
      date_of_birth: dob.trim(),
      sex,
      height_cm: heightNum,
      units,
    });
    setLoading(false);

    if (error) {
      setSubmitError(error.message);
    } else {
      router.replace('/today');
    }
  };

  const renderUsernameHint = () => {
    if (!username || username.length < 3) return null;
    if (usernameStatus === 'checking') {
      return (
        <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
          {t('profileSetup.checkingAvailability')}
        </Text>
      );
    }
    if (usernameStatus === 'available') {
      return (
        <Text
          style={{ color: colors.text, fontSize: fontSize.sm, fontWeight: '500' }}
          testID="hint-username-available"
        >
          {t('profileSetup.usernameAvailable')}
        </Text>
      );
    }
    if (usernameStatus === 'taken') {
      return (
        <Text style={{ color: colors.danger, fontSize: fontSize.sm }} testID="hint-username-taken">
          {t('profileSetup.usernameTaken')}
        </Text>
      );
    }
    if (usernameStatus === 'reserved') {
      return (
        <Text
          style={{ color: colors.danger, fontSize: fontSize.sm }}
          testID="hint-username-reserved"
        >
          {t('profileSetup.usernameReserved')}
        </Text>
      );
    }
    if (usernameStatus === 'invalid') {
      return (
        <Text
          style={{ color: colors.danger, fontSize: fontSize.sm }}
          testID="hint-username-invalid"
        >
          {t('profileSetup.usernameInvalid')}
        </Text>
      );
    }
    return null;
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>{t('profileSetup.title')}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {t('profileSetup.subtitle')}
          </Text>
        </View>

        {submitError && (
          <View
            style={[
              styles.errorBox,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            testID="error-profile-setup"
          >
            <Text style={{ color: colors.danger, fontSize: fontSize.sm }}>{submitError}</Text>
          </View>
        )}

        {/* Username */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.usernameLabel')}
          </Text>
          <TextInput
            testID="input-username"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            placeholder={t('profileSetup.usernamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            value={username}
            onChangeText={setUsername}
          />
          {renderUsernameHint()}
        </View>

        {/* Nickname */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.nicknameLabel')}
          </Text>
          <TextInput
            testID="input-nickname"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            placeholder={t('profileSetup.nicknamePlaceholder')}
            placeholderTextColor={colors.textMuted}
            value={nickname}
            onChangeText={setNickname}
          />
        </View>

        {/* Date of Birth / Age Gate */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.dobLabel')}
          </Text>
          <TextInput
            testID="input-dob"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            placeholder={t('profileSetup.dobPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            value={dob}
            onChangeText={setDob}
          />
          <Text style={{ color: colors.textMuted, fontSize: fontSize.sm }}>
            {t('profileSetup.dobHelp')}
          </Text>
        </View>

        {/* Sex */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.sexLabel')}
          </Text>
          <View style={styles.segmentedRow}>
            {(['male', 'female', 'other'] as const).map((s) => (
              <Pressable
                key={s}
                testID={`btn-sex-${s}`}
                style={[
                  styles.segmentButton,
                  {
                    backgroundColor: sex === s ? colors.accent : colors.surface,
                    borderColor: colors.border,
                  },
                ]}
                onPress={() => setSex(s)}
              >
                <Text
                  style={{
                    color: sex === s ? colors.onAccent : colors.text,
                    fontSize: fontSize.sm,
                    fontWeight: '600',
                  }}
                >
                  {t(`profileSetup.${s}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Height */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.heightLabel')}
          </Text>
          <TextInput
            testID="input-height"
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            placeholder={t('profileSetup.heightPlaceholder')}
            placeholderTextColor={colors.textMuted}
            keyboardType="decimal-pad"
            value={heightCm}
            onChangeText={setHeightCm}
          />
        </View>

        {/* Units */}
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.textMuted }]}>
            {t('profileSetup.unitsLabel')}
          </Text>
          <View style={styles.segmentedRow}>
            {(['metric', 'imperial'] as const).map((u) => (
              <Pressable
                key={u}
                testID={`btn-units-${u}`}
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
        </View>

        {/* Submit Button */}
        <Pressable
          testID="btn-submit-profile"
          accessibilityRole="button"
          accessibilityLabel={t('profileSetup.createProfileButton')}
          style={[styles.primaryButton, { backgroundColor: colors.accent, marginTop: spacing.md }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.onAccent} />
          ) : (
            <Text style={{ color: colors.onAccent, fontWeight: '600', fontSize: fontSize.md }}>
              {t('profileSetup.createProfileButton')}
            </Text>
          )}
        </Pressable>
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
  subtitle: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    marginBottom: spacing.xs,
  },
  errorBox: {
    padding: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: fontSize.md,
    marginBottom: spacing.xs,
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  segmentButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButton: {
    paddingVertical: 14,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
