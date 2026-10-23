import React, { useState } from 'react';
import { Modal, SafeAreaView, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  SegmentedControl,
  space,
  Text,
} from '@calipartner/ui';
import { getLocale, setLocale, t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

export interface UnitsLanguageModalProps {
  visible: boolean;
  onClose: () => void;
  currentUnits?: 'metric' | 'imperial';
  onUpdateUnits?: (units: 'metric' | 'imperial') => Promise<void> | void;
  testID?: string;
}

export function UnitsLanguageModal({
  visible,
  onClose,
  currentUnits = 'metric',
  onUpdateUnits,
  testID = 'modal-units-language',
}: UnitsLanguageModalProps) {
  const [units, setUnits] = useState<'metric' | 'imperial'>(currentUnits);
  const [lang, setLang] = useState<string>(getLocale());
  const [timezone] = useState<string>(
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
  );

  const handleUnitsChange = async (val: string) => {
    playClickSound();
    const nextUnits = val as 'metric' | 'imperial';
    setUnits(nextUnits);
    if (onUpdateUnits) {
      await onUpdateUnits(nextUnits);
    }
  };

  const handleLanguageChange = (val: string) => {
    playClickSound();
    setLang(val);
    setLocale(val);
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
              testID="btn-close-units-lang"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.unitsLanguage.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.unitsLanguage.subtitle')}
            </Text>

            {/* Units Selector */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.unitsLanguage.unitsLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'metric', label: t('me.unitsLanguage.metric') },
                  { value: 'imperial', label: t('me.unitsLanguage.imperial') },
                ]}
                value={units}
                onChange={handleUnitsChange}
                testID="segment-units"
              />
              <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                {units === 'metric'
                  ? 'Weights in kg, heights in cm, liquids in ml'
                  : 'Weights in lb, heights in ft/in, liquids in fl oz'}
              </Text>
            </Card>

            {/* Language Selector */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.unitsLanguage.languageLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'en', label: t('me.unitsLanguage.english') },
                  { value: 'hi', label: t('me.unitsLanguage.hindi') },
                ]}
                value={lang}
                onChange={handleLanguageChange}
                testID="segment-language"
              />
              <Text variant="micro" color={dark.textLo} style={styles.helperText}>
                {t('me.unitsLanguage.instantNotice')}
              </Text>
            </Card>

            {/* Timezone Display */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.unitsLanguage.timezoneLabel')}
              </Text>
              <View style={styles.timezoneBox}>
                <Text variant="heading" color={dark.textHi}>
                  {timezone}
                </Text>
                <Text variant="micro" color={dark.textLo} style={styles.timezoneDesc}>
                  Used to calculate your daily logging boundaries at midnight UTC offset.
                </Text>
              </View>
            </Card>
          </ScrollView>

          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label="Done"
              onPress={onClose}
              testID="btn-done-units-lang"
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
  timezoneBox: {
    marginTop: space[1],
  },
  timezoneDesc: {
    marginTop: space[1],
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
