import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { isAtLeast18, type Sex, type Units } from '@calipartner/core';
import { Text, Button, Field, Avatar, space, dark, radius, CheckIcon } from '@calipartner/ui';
import { AvatarPickerModal, type AvatarOption } from '@/components/profile/AvatarPickerModal';
import { InteractiveDobPicker } from '@/components/onboarding/InteractiveDobPicker';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { createProfile } = useAuth();
  const { status: usernameStatus, checkAvailability } = useUsername();

  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('2000-01-15');
  const [sex, setSex] = useState<Sex>('male');
  const [heightCm, setHeightCm] = useState('175');
  const [units, setUnits] = useState<Units>('metric');
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarOption>({
    id: 'iris-1',
    name: 'Alex',
    hue: 'iris',
  });
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
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
      setSubmitError('Please enter a display nickname.');
      return;
    }

    // 3. Age gate validation (18+ required per Spec AUTH-3)
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
      router.replace('/today' as never);
    }
  };

  const renderUsernameStatusIcon = () => {
    if (usernameStatus === 'available') {
      return (
        <View style={styles.validCheck} testID="hint-username-available">
          <CheckIcon size={16} color={dark.teal} />
        </View>
      );
    }
    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flexOne}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text
              variant="title1"
              color={dark.textHi}
              style={styles.title}
              testID="profile-setup-title"
            >
              {t('profileSetup.title')}
            </Text>
            <Text variant="body" color={dark.textMid} style={styles.subtitle}>
              {t('profileSetup.subtitle')}
            </Text>
          </View>

          {/* Avatar Preview & Chooser (Spec B05) */}
          <View style={styles.avatarSection}>
            <TouchableOpacity
              onPress={() => setShowAvatarPicker(true)}
              style={styles.avatarTouchable}
              accessibilityRole="button"
              accessibilityLabel="Change avatar"
              testID="btn-open-avatar-picker"
            >
              <Avatar
                name={selectedAvatar.name}
                identityHue={selectedAvatar.hue}
                size="lg"
                testID="profile-current-avatar"
              />
              <Text variant="bodyS" color={dark.apricot} style={styles.changeAvatarText}>
                Choose avatar →
              </Text>
            </TouchableOpacity>
          </View>

          {submitError && (
            <View style={styles.errorBox} testID="error-profile-setup">
              <Text variant="bodyS" color={dark.danger}>
                {submitError}
              </Text>
            </View>
          )}

          {/* Nickname (Spec B04) */}
          <View style={styles.fieldSection}>
            <Field
              label={t('profileSetup.nicknameLabel')}
              value={nickname}
              onChangeText={setNickname}
              placeholder={t('profileSetup.nicknamePlaceholder')}
              testID="input-nickname"
            />
          </View>

          {/* Username (@username) with live availability & rules (Spec B04) */}
          <View style={styles.fieldSection}>
            <View style={styles.usernameRow}>
              <View style={styles.flexOne}>
                <Field
                  label={t('profileSetup.usernameLabel')}
                  value={username}
                  onChangeText={(text) => {
                    setUsername(text.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
                  }}
                  placeholder={t('profileSetup.usernamePlaceholder')}
                  autoCapitalize="none"
                  autoCorrect={false}
                  testID="input-username"
                />
              </View>
              {renderUsernameStatusIcon()}
            </View>

            {/* Spec B04: Rules under field (3 to 20, letters, numbers, _, .) */}
            <Text variant="label" color={dark.textLo} style={styles.rulesText}>
              Rules: 3 to 20 characters, lowercase letters, numbers, _ and .
            </Text>

            {usernameStatus === 'taken' && (
              <Text variant="label" color={dark.danger} testID="hint-username-taken">
                {t('profileSetup.usernameTaken')}
              </Text>
            )}
            {usernameStatus === 'invalid' && (
              <Text variant="label" color={dark.danger} testID="hint-username-invalid">
                {t('profileSetup.usernameInvalid')}
              </Text>
            )}
          </View>

          {/* Age Gate DOB (Spec A03) */}
          <View style={styles.fieldSection}>
            <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
              Date of Birth (18+ required)
            </Text>
            <InteractiveDobPicker value={dob} onChange={setDob} />
          </View>

          {/* Biological Sex */}
          <View style={styles.fieldSection}>
            <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
              {t('profileSetup.sexLabel')}
            </Text>
            <View style={styles.segmentedRow}>
              {(['male', 'female', 'other'] as const).map((s) => (
                <TouchableOpacity
                  key={s}
                  testID={`btn-sex-${s}`}
                  style={[styles.segmentButton, sex === s && styles.segmentButtonActive]}
                  onPress={() => {
                    playClickSound();
                    setSex(s);
                  }}
                >
                  <Text
                    variant="bodyS"
                    color={sex === s ? dark.onBrand : dark.textMid}
                    style={sex === s ? styles.boldText : undefined}
                  >
                    {t(`profileSetup.${s}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Height */}
          <View style={styles.fieldSection}>
            <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
              {t('profileSetup.heightLabel')}
            </Text>
            <TextInput
              testID="input-height"
              style={styles.textInput}
              placeholder={t('profileSetup.heightPlaceholder')}
              placeholderTextColor={dark.textOff}
              keyboardType="decimal-pad"
              value={heightCm}
              onChangeText={setHeightCm}
            />
          </View>

          {/* Units */}
          <View style={styles.fieldSection}>
            <Text variant="label" color={dark.textLo} style={styles.sectionLabel}>
              {t('profileSetup.unitsLabel')}
            </Text>
            <View style={styles.segmentedRow}>
              {(['metric', 'imperial'] as const).map((u) => (
                <TouchableOpacity
                  key={u}
                  testID={`btn-units-${u}`}
                  style={[styles.segmentButton, units === u && styles.segmentButtonActive]}
                  onPress={() => {
                    playClickSound();
                    setUnits(u);
                  }}
                >
                  <Text
                    variant="bodyS"
                    color={units === u ? dark.onBrand : dark.textMid}
                    style={units === u ? styles.boldText : undefined}
                  >
                    {t(`profileSetup.${u}`)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Submit Button */}
          <View style={styles.submitSection}>
            <Button
              variant="primary"
              size="lg"
              label={t('profileSetup.createProfileButton')}
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              testID="btn-submit-profile"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Avatar Picker Modal (Spec B05) */}
      <AvatarPickerModal
        visible={showAvatarPicker}
        selectedAvatarId={selectedAvatar.id}
        onSelectAvatar={(avatar) => setSelectedAvatar(avatar)}
        onClose={() => setShowAvatarPicker(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  flexOne: {
    flex: 1,
  },
  scrollContent: {
    padding: space[4],
    paddingTop: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
  header: {
    gap: space[1],
  },
  title: {
    letterSpacing: -0.4,
  },
  subtitle: {
    lineHeight: 20,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: space[2],
  },
  avatarTouchable: {
    alignItems: 'center',
    gap: space[2],
    minHeight: 44,
  },
  changeAvatarText: {
    fontWeight: '600',
  },
  errorBox: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: radius.control,
    padding: space[3],
  },
  fieldSection: {
    gap: space[1],
  },
  usernameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  validCheck: {
    paddingTop: space[3],
    paddingRight: space[1],
  },
  rulesText: {
    lineHeight: 16,
    marginTop: 2,
  },
  sectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
    marginBottom: space[1],
  },
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.full,
    padding: 3,
  },
  segmentButton: {
    flex: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  segmentButtonActive: {
    backgroundColor: dark.apricot,
  },
  boldText: {
    fontWeight: '700',
  },
  textInput: {
    height: 48,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
    color: dark.textHi,
    paddingHorizontal: space[3],
    fontSize: 16,
  },
  submitSection: {
    marginTop: space[3],
  },
});
