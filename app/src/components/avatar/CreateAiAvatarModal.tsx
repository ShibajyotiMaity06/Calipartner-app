import React from 'react';
import { Modal, SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { Button, Card, radius, Text, space, useTheme } from '@calipartner/ui';
import { ModalNavigation } from '@/components/ModalNavigation';
import { t } from '@/i18n';
import type { CustomAvatar } from '@/services/aiAvatarService';

export function CreateAiAvatarModal({
  onClose,
}: {
  onClose: () => void;
  onCreated?: (avatar: CustomAvatar) => void;
  onUpgrade?: () => void;
}) {
  const { colors, reduceMotion } = useTheme();

  return (
    <Modal visible onRequestClose={onClose} animationType={reduceMotion ? 'none' : 'slide'}>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          contentContainerStyle={{ padding: space[4], gap: space[4] }}
          testID="ai-avatar-modal"
        >
          <ModalNavigation onClose={onClose} />
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: colors.apricot }]}>
              <Text variant="micro" color={colors.onBrand} style={styles.badgeText}>
                {t('avatarAi.comingSoonBadge')}
              </Text>
            </View>
          </View>
          <Text variant="title1" accessibilityRole="header">
            {t('avatarAi.title')}
          </Text>
          <Card elevation="s1" style={styles.infoCard}>
            <Text variant="body" color={colors.textHi}>
              {t('avatarAi.instructions')}
            </Text>
          </Card>
          <Button label={t('avatarAi.gotIt')} onPress={onClose} testID="ai-avatar-got-it" />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  badgeRow: {
    alignItems: 'flex-start',
  },
  badge: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
  },
  badgeText: {
    fontWeight: '700',
    letterSpacing: 1,
  },
  infoCard: {
    padding: space[4],
  },
});
