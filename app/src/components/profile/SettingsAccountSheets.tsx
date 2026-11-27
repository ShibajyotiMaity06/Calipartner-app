import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  CheckCircleIcon,
  CloseIcon,
  IconButton,
  Input,
  PrimaryButton,
  SecondaryButton,
  Sheet,
  Text,
  borders,
  colors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

export function EmailSettingsSheet({
  visible,
  currentEmail,
  onClose,
  onSave,
}: {
  visible: boolean;
  currentEmail: string;
  onClose: () => void;
  onSave: (newEmail: string) => Promise<{ error: Error | null }>;
}) {
  const [email, setEmail] = useState(currentEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  if (!visible) return null;

  const submit = async () => {
    const clean = email.trim();
    if (!clean || !clean.includes('@')) {
      setError(t('settingsV1.invalidEmail'));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await onSave(clean);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setSent(true);
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('settingsV1.emailSheetTitle')}
      testID="sheet-settings-email"
    >
      <View style={styles.sheetWrap}>
        <View style={styles.sheetTop}>
          <Text variant="titleM" color="textHi">
            {t('settingsV1.emailSheetTitle')}
          </Text>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('common.cancel')}
            onPress={onClose}
            testID="btn-close-email-sheet"
          />
        </View>
        <Text variant="body" color="textMid">
          {t('settingsV1.emailSheetSubtitle')}
        </Text>
        <Input
          label={t('settingsV1.email')}
          value={email}
          onChangeText={(next) => {
            setEmail(next);
            setSent(false);
          }}
          placeholder={t('settingsV1.emailPlaceholder')}
          keyboardType="email-address"
          autoCapitalize="none"
          testID="input-settings-email"
        />
        {error ? (
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {sent ? (
          <Text variant="meta" color="apricot" testID="settings-email-sent">
            {t('settingsV1.emailSent')}
          </Text>
        ) : null}
        <PrimaryButton
          title={t('common.save')}
          loading={busy}
          onPress={() => void submit()}
          testID="btn-save-settings-email"
        />
      </View>
    </Sheet>
  );
}

export function PasswordSettingsSheet({
  visible,
  userEmail,
  onClose,
  onSavePassword,
  onSendReset,
}: {
  visible: boolean;
  userEmail: string;
  onClose: () => void;
  onSavePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  onSendReset: (email: string) => Promise<{ error: Error | null }>;
}) {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetBusy, setResetBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!visible) return null;

  const submit = async () => {
    if (password.length < 8) {
      setError(t('settingsV1.passwordSheetSubtitle'));
      return;
    }
    setBusy(true);
    setError(null);
    setStatusMessage(null);
    const res = await onSavePassword(password);
    setBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setPassword('');
    setStatusMessage(t('settingsV1.passwordSaved'));
  };

  const triggerReset = async () => {
    if (!userEmail) return;
    setResetBusy(true);
    setError(null);
    setStatusMessage(null);
    const res = await onSendReset(userEmail);
    setResetBusy(false);
    if (res.error) {
      setError(res.error.message);
      return;
    }
    setStatusMessage(t('settingsV1.resetEmailSent', { email: userEmail }));
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('settingsV1.passwordSheetTitle')}
      testID="sheet-settings-password"
    >
      <View style={styles.sheetWrap}>
        <View style={styles.sheetTop}>
          <Text variant="titleM" color="textHi">
            {t('settingsV1.passwordSheetTitle')}
          </Text>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('common.cancel')}
            onPress={onClose}
            testID="btn-close-password-sheet"
          />
        </View>
        <Text variant="body" color="textMid">
          {t('settingsV1.passwordSheetSubtitle')}
        </Text>
        <Input
          label={t('settingsV1.password')}
          value={password}
          onChangeText={setPassword}
          placeholder={t('settingsV1.passwordPlaceholder')}
          secureTextEntry
          autoCapitalize="none"
          testID="input-settings-password"
        />
        {error ? (
          <Text variant="meta" color="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        {statusMessage ? (
          <Text variant="meta" color="apricot" testID="settings-password-status">
            {statusMessage}
          </Text>
        ) : null}
        <PrimaryButton
          title={t('common.save')}
          loading={busy}
          onPress={() => void submit()}
          testID="btn-save-settings-password"
        />
        {userEmail ? (
          <SecondaryButton
            title={t('settingsV1.sendResetEmail')}
            disabled={resetBusy}
            onPress={() => void triggerReset()}
            testID="btn-send-password-reset"
          />
        ) : null}
      </View>
    </Sheet>
  );
}

export function SignInMethodsSheet({
  visible,
  providers,
  email,
  onClose,
}: {
  visible: boolean;
  providers: string[];
  email: string;
  onClose: () => void;
}) {
  if (!visible) return null;

  const hasProvider = (name: string) =>
    providers.some((p) => p.toLowerCase() === name.toLowerCase());

  const items = [
    { id: 'apple', label: 'Apple', connected: hasProvider('apple'), detail: '' },
    { id: 'google', label: 'Google', connected: hasProvider('google'), detail: '' },
    { id: 'email', label: t('settingsV1.email'), connected: hasProvider('email'), detail: email },
  ];

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('settingsV1.signInMethodsTitle')}
      testID="sheet-sign-in-methods"
    >
      <View style={styles.sheetWrap}>
        <View style={styles.sheetTop}>
          <Text variant="titleM" color="textHi">
            {t('settingsV1.signInMethodsTitle')}
          </Text>
          <IconButton
            icon={<CloseIcon size={18} color={colors.textHi} />}
            accessibilityLabel={t('common.cancel')}
            onPress={onClose}
            testID="btn-close-methods-sheet"
          />
        </View>
        <Text variant="body" color="textMid">
          {t('settingsV1.signInMethodsSubtitle')}
        </Text>
        <View style={styles.methodList}>
          {items.map((item) => (
            <Pressable
              key={item.id}
              style={styles.methodRow}
              accessibilityRole="text"
              accessibilityLabel={`${item.label} ${item.connected ? t('settingsV1.connected') : t('settingsV1.off')}`}
            >
              <View style={styles.methodInfo}>
                <Text variant="label" color="textHi">
                  {item.label}
                </Text>
                {item.detail ? (
                  <Text variant="meta" color="textLo">
                    {item.detail}
                  </Text>
                ) : null}
              </View>
              <View style={styles.methodRight}>
                <Text variant="meta" color={item.connected ? 'apricot' : 'textLo'}>
                  {item.connected ? t('settingsV1.connected') : t('settingsV1.off')}
                </Text>
                {item.connected ? <CheckCircleIcon size={16} color={colors.apricot} /> : null}
              </View>
            </Pressable>
          ))}
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  sheetWrap: {
    gap: space.md,
  },
  sheetTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  methodList: {
    borderRadius: radius.card,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    overflow: 'hidden',
  },
  methodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.optical14,
    paddingHorizontal: space.lg,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.s2,
    minHeight: 54,
  },
  methodInfo: {
    flex: 1,
    gap: 2,
  },
  methodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
  },
});
