import React, { useState } from 'react';
import {
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  Button,
  Card,
  ChevronLeftIcon,
  dark,
  radius,
  SegmentedControl,
  space,
  SwitchRow,
  Text,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface ReportFeedbackModalProps {
  visible: boolean;
  onClose: () => void;
  initialType?: 'bug' | 'food' | 'feedback';
  testID?: string;
}

export function ReportFeedbackModal({
  visible,
  onClose,
  initialType = 'feedback',
  testID = 'modal-report-feedback',
}: ReportFeedbackModalProps) {
  const [type, setType] = useState<'bug' | 'food' | 'feedback'>(initialType);
  const [message, setMessage] = useState('');
  const [includeLogs, setIncludeLogs] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (!message.trim()) return;
    playClickSound();
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
      playSuccessSound();
      setTimeout(() => {
        setSubmitted(false);
        setMessage('');
        onClose();
      }, 1000);
    }, 600);
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
              testID="btn-close-report-feedback"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.reportFeedback.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.reportFeedback.subtitle')}
            </Text>

            {/* Type selector */}
            <Card elevation="s1" style={styles.sectionCard}>
              <Text variant="label" color={dark.textHi} style={styles.sectionLabel}>
                {t('me.reportFeedback.typeLabel')}
              </Text>
              <SegmentedControl
                options={[
                  { value: 'feedback', label: 'Feedback' },
                  { value: 'bug', label: 'Problem' },
                  { value: 'food', label: 'Wrong food' },
                ]}
                value={type}
                onChange={(val: string) => setType(val as 'bug' | 'food' | 'feedback')}
                testID="segment-feedback-type"
              />
            </Card>

            {/* Message input */}
            <Card elevation="s1" style={styles.sectionCard}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                multiline
                numberOfLines={6}
                placeholder={t('me.reportFeedback.messagePlaceholder')}
                placeholderTextColor={dark.textOff}
                style={styles.textArea}
                testID="input-feedback-message"
                accessibilityLabel="Feedback message"
              />
            </Card>

            {/* Diagnostic Logs Switch */}
            <Card elevation="s1" style={styles.sectionCard}>
              <SwitchRow
                title={t('me.reportFeedback.includeLogsLabel')}
                consequence={t('me.reportFeedback.includeLogsDesc')}
                value={includeLogs}
                onValueChange={setIncludeLogs}
                testID="switch-include-logs"
              />
            </Card>

            {submitted && (
              <Card elevation="s2" style={styles.successCard}>
                <Text variant="bodyS" color={dark.mint}>
                  {t('me.reportFeedback.successMessage')}
                </Text>
              </Card>
            )}
          </ScrollView>

          <View style={styles.bottomBar}>
            <Button
              variant="primary"
              label={
                submitted ? 'Sent' : submitting ? 'Submitting…' : t('me.reportFeedback.submitBtn')
              }
              onPress={handleSubmit}
              disabled={submitting || !message.trim()}
              testID="btn-submit-feedback"
              style={styles.submitBtn}
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
    padding: space[3],
    marginBottom: space[4],
  },
  sectionLabel: {
    marginBottom: space[2],
  },
  textArea: {
    backgroundColor: dark.s2,
    borderColor: dark.hairline,
    borderWidth: 1,
    borderRadius: radius.control,
    height: 120,
    padding: space[3],
    color: dark.textHi,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  successCard: {
    padding: space[3],
    marginTop: space[2],
  },
  bottomBar: {
    padding: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    backgroundColor: dark.bg0,
  },
  submitBtn: {
    width: '100%',
  },
});
