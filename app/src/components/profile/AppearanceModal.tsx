import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  SegmentedControl,
  space,
  SwitchRow,
  Text,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface AppearanceModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function AppearanceModal({
  visible,
  onClose,
  testID = 'modal-appearance',
}: AppearanceModalProps) {
  const [theme, setTheme] = useState<'dark' | 'system' | 'light'>('dark');
  const [reduceMotion, setReduceMotion] = useState(false);
  const [haptics, setHaptics] = useState(true);
  const [textScale, setTextScale] = useState<'100' | '130' | '150' | '200'>('100');

  const handleThemeChange = (id: string) => {
    playClickSound();
    setTheme(id as 'dark' | 'system' | 'light');
  };

  const handleScaleChange = (id: string) => {
    playClickSound();
    setTextScale(id as '100' | '130' | '150' | '200');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.container} testID={testID}>
          {/* Top Bar */}
          <View style={styles.topBar}>
            <TouchableOpacity
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backButton}
              testID="btn-close-appearance"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.appearance.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.appearance.subtitle')}
            </Text>

            {/* Theme selector */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.appearance.themeLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'dark', label: 'Dark' },
                  { value: 'system', label: 'System' },
                  { value: 'light', label: 'Light' },
                ]}
                value={theme}
                onChange={handleThemeChange}
                testID="segment-theme"
              />
              <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                {theme === 'dark'
                  ? 'Apricot on Espresso palette with AA high-contrast surfaces'
                  : theme === 'system'
                    ? 'Follows your device dark or light mode setting'
                    : 'Light mode preview'}
              </Text>
            </Card>

            {/* Motion & Haptics switches */}
            <Card elevation="s1" style={styles.sectionCard}>
              <SwitchRow
                title={t('me.appearance.reduceMotionLabel')}
                consequence={t('me.appearance.reduceMotionDesc')}
                value={reduceMotion}
                onValueChange={setReduceMotion}
                testID="switch-reduce-motion"
              />
              <SwitchRow
                title={t('me.appearance.hapticsLabel')}
                consequence={t('me.appearance.hapticsDesc')}
                value={haptics}
                onValueChange={setHaptics}
                testID="switch-haptics"
              />
            </Card>

            {/* Text Scale Preview */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.appearance.textSizeLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: '100', label: '100%' },
                  { value: '130', label: '130%' },
                  { value: '150', label: '150%' },
                  { value: '200', label: '200%' },
                ]}
                value={textScale}
                onChange={handleScaleChange}
                testID="segment-text-scale"
              />

              {/* Live Preview Box */}
              <View style={styles.previewBox}>
                <Text
                  variant="heading"
                  color={dark.textHi}
                  style={[
                    styles.previewText,
                    textScale === '130' && styles.scale130,
                    textScale === '150' && styles.scale150,
                    textScale === '200' && styles.scale200,
                  ]}
                >
                  CaliPartner accessible typography reflows cleanly without clipping.
                </Text>
              </View>
            </Card>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label="Done"
              onPress={onClose}
              testID="btn-done-appearance"
              style={styles.doneBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  topBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonPlaceholder: {
    width: 44,
  },
  content: {
    padding: space[4],
  },
  introSubtitle: {
    marginBottom: space[4],
  },
  sectionCard: {
    padding: space[4],
    marginBottom: space[4],
  },
  sectionLabel: {
    marginBottom: space[2],
  },
  helperText: {
    marginTop: space[2],
  },
  previewBox: {
    marginTop: space[4],
    padding: space[3],
    backgroundColor: dark.s2,
    borderRadius: radius.control,
  },
  previewText: {
    lineHeight: 22,
  },
  scale130: {
    fontSize: 20,
    lineHeight: 28,
  },
  scale150: {
    fontSize: 24,
    lineHeight: 32,
  },
  scale200: {
    fontSize: 32,
    lineHeight: 40,
  },
  bottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  doneBtn: {
    width: '100%',
  },
});
