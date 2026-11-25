import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import {
  CameraIcon,
  Card,
  CheckIcon,
  Input,
  ScreenTitle,
  Text,
  borders,
  colors,
  fonts,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { t } from '@/i18n';

export interface ProfileSetupStepProps {
  nickname: string;
  initialUsername?: string;
  initialAvatarUri?: string | null;
  onChangeUsername: (username: string) => void;
  onChangeValid: (valid: boolean) => void;
  onChangePhotoUri?: (uri: string | null) => void;
  errorMessage?: string | null;
}

export function ProfileSetupStep({
  nickname,
  initialUsername = '',
  initialAvatarUri = null,
  onChangeUsername,
  onChangeValid,
  onChangePhotoUri,
  errorMessage,
}: ProfileSetupStepProps): React.JSX.Element {
  const { profile } = useAuth();
  const { checkAvailability, status, setStatus } = useUsername();
  const [username, setUsername] = useState(initialUsername || profile?.username || '');
  const [photoUri, setPhotoUri] = useState<string | null>(
    initialAvatarUri ?? profile?.avatar_url ?? null,
  );

  const displayName = nickname.trim() || t('onboardingV1.previewFallbackName');
  const initialLetter = (displayName.slice(0, 1) || 'P').toUpperCase();
  const matchesExistingHandle = Boolean(
    profile?.username && username.trim().toLowerCase() === profile.username.toLowerCase(),
  );

  useEffect(() => {
    const clean = username.trim().toLowerCase();
    onChangeUsername(clean);
    if (!clean) {
      setStatus('idle');
      onChangeValid(false);
      return;
    }
    if (matchesExistingHandle) {
      setStatus('available');
      onChangeValid(true);
      return;
    }
    onChangeValid(false);
    const timer = setTimeout(() => {
      void checkAvailability(clean).then((ok) => onChangeValid(ok));
    }, 280);
    return () => clearTimeout(timer);
    // Debounce checks as handle changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, matchesExistingHandle]);

  const pickPhoto = async () => {
    try {
      if (typeof ImagePicker.launchImageLibraryAsync !== 'function') return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      if (!res.canceled && res.assets?.[0]?.uri) {
        setPhotoUri(res.assets[0].uri);
        onChangePhotoUri?.(res.assets[0].uri);
      }
    } catch {
      // Gallery permission cancelled or unavailable on web
    }
  };

  const usernameError =
    status === 'taken' || status === 'reserved' || status === 'held'
      ? t('profileSetup.usernameTaken')
      : status === 'invalid'
        ? t('profileSetup.usernameInvalid')
        : status === 'error'
          ? t('common.errorBody')
          : null;

  return (
    <View style={styles.root} testID="step-profile-v1">
      <ScreenTitle
        eyebrow={t('onboardingV1.profileEyebrow')}
        title={t('onboardingV1.profileTitle')}
        accentWord={t('onboardingV1.profileAccent')}
        subtitle={t('onboardingV1.profileSubtitle')}
        spacingBottom={space.xl}
        testID="profile-setup-header"
      />

      <View style={styles.avatarSection}>
        <Pressable
          onPress={() => void pickPhoto()}
          accessibilityRole="button"
          accessibilityLabel={t('onboardingV1.profilePhotoLabel')}
          style={styles.avatarHit}
          testID="btn-pick-profile-photo"
        >
          <View style={styles.avatarCircle}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.avatarImage} />
            ) : (
              <Text style={styles.avatarInitial}>{initialLetter}</Text>
            )}
          </View>
          <View style={styles.cameraBadge}>
            <CameraIcon size={15} color={colors.onBrand} />
          </View>
        </Pressable>
      </View>

      <View style={styles.fieldBlock}>
        <Input
          label={t('onboardingV1.profileUsernameLabel')}
          value={username}
          onChangeText={(value) => {
            setUsername(value.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
          }}
          placeholder={t('onboardingV1.profileUsernamePlaceholder')}
          leadingIcon={
            <Text variant="bodyL" color="textLo">
              @
            </Text>
          }
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="username"
          maxLength={20}
          testID="input-username"
        />

        {status === 'available' || matchesExistingHandle ? (
          <View style={styles.availabilityRow} testID="profile-username-available">
            <CheckIcon size={13} color={colors.apricot} strokeWidth={2.5} />
            <Text variant="meta" color="textMid">
              {t('onboardingV1.profileUsernameAvailable')}
            </Text>
          </View>
        ) : status === 'checking' ? (
          <View style={styles.availabilityRow}>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.profileUsernameChecking')}
            </Text>
          </View>
        ) : usernameError ? (
          <Text
            variant="meta"
            color="danger"
            accessibilityRole="alert"
            testID="onboarding-username-error"
          >
            {usernameError}
          </Text>
        ) : null}
      </View>

      <View style={styles.previewWrap}>
        <Card style={styles.previewCard} testID="profile-squad-preview">
          <View style={styles.previewAvatar}>
            {photoUri ? (
              <Image source={{ uri: photoUri }} style={styles.previewAvatarImg} />
            ) : (
              <Text variant="label" color="onBrand" style={styles.previewInitial}>
                {initialLetter}
              </Text>
            )}
          </View>
          <View style={styles.previewText}>
            <Text variant="rowTitle" color="textHi">
              {displayName}
            </Text>
            <Text variant="meta" color="textLo">
              {`@${username.trim() || t('onboardingV1.profileUsernamePlaceholder')}`}
            </Text>
          </View>
        </Card>
        <Text variant="meta" color="textLo" style={styles.previewCaption}>
          {t('onboardingV1.profilePreviewCaption')}
        </Text>
      </View>

      {errorMessage ? (
        <View style={styles.errorBanner} testID="onboarding-profile-error">
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {errorMessage}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    gap: space.xl,
  },
  avatarSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarHit: {
    position: 'relative',
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 92,
    height: 92,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarInitial: {
    fontFamily: fonts.display,
    fontSize: 38,
    lineHeight: 42,
    color: colors.textHi,
  },
  cameraBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    borderWidth: 2,
    borderColor: colors.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldBlock: {
    gap: space.sm,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs + 2,
  },
  previewWrap: {
    gap: space.sm,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  previewAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  previewAvatarImg: {
    width: '100%',
    height: '100%',
  },
  previewInitial: {
    fontFamily: fonts.extrabold,
    fontSize: 15,
  },
  previewText: {
    flex: 1,
    gap: 2,
  },
  previewCaption: {
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.danger,
    borderRadius: radius.chip,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
  },
});
