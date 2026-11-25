import React, { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useTheme } from '@calipartner/ui';
import { CloseIcon, IconButton, layout } from '@calipartner/ui/v1';
import { AuthFormView, type AuthFormMode } from '@/components/auth/AuthFormView';
import { t } from '@/i18n';

interface OnboardingAuthModalProps {
  visible: boolean;
  initialMode?: AuthFormMode;
  onClose: () => void;
  onAuthenticated: () => void;
}

export function OnboardingAuthModal({
  visible,
  initialMode = 'signup',
  onClose,
  onAuthenticated,
}: OnboardingAuthModalProps) {
  const { reduceMotion } = useTheme();
  const [mode, setMode] = useState<AuthFormMode>(initialMode);

  return (
    <Modal
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
    >
      <AuthFormView
        mode={mode}
        onModeChange={setMode}
        onAuthenticated={onAuthenticated}
        testID="onboarding-auth-modal"
        topAction={
          <View style={styles.topRow}>
            <IconButton
              icon={<CloseIcon size={18} />}
              size={44}
              onPress={onClose}
              accessibilityLabel={t('setup.close')}
              testID="btn-close-onboarding-auth"
            />
          </View>
        }
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  topRow: {
    minHeight: layout.minTouchTarget,
    justifyContent: 'center',
    alignItems: 'flex-start',
    marginBottom: layout.navToTitle,
  },
});
