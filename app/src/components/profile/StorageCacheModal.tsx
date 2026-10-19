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
  space,
  Text,
} from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export interface StorageCacheModalProps {
  visible: boolean;
  onClose: () => void;
  testID?: string;
}

export function StorageCacheModal({
  visible,
  onClose,
  testID = 'modal-storage-cache',
}: StorageCacheModalProps) {
  const [cleared, setCleared] = useState(false);

  const handleClearCache = () => {
    playClickSound();
    setTimeout(() => {
      setCleared(true);
      playSuccessSound();
      setTimeout(() => setCleared(false), 2000);
    }, 400);
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
              testID="btn-close-storage-cache"
            >
              <ChevronLeftIcon color={dark.textHi} size={24} />
            </TouchableOpacity>
            <Text variant="heading" color={dark.textHi}>
              {t('me.storageCache.title')}
            </Text>
            <View style={styles.backButtonPlaceholder} />
          </View>

          <ScrollView contentContainerStyle={styles.content}>
            <Text variant="bodyS" color={dark.textMid} style={styles.introSubtitle}>
              {t('me.storageCache.subtitle')}
            </Text>

            {/* SQLite Database */}
            <Card elevation="s1" style={styles.card}>
              <Text variant="label" color={dark.textHi}>
                {t('me.storageCache.dbSizeLabel')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.cardSub}>
                {t('me.storageCache.dbSizeValue')}
              </Text>
            </Card>

            {/* Food Cache */}
            <Card elevation="s1" style={styles.card}>
              <Text variant="label" color={dark.textHi}>
                {t('me.storageCache.foodCacheLabel')}
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.cardSub}>
                {t('me.storageCache.foodCacheValue')}
              </Text>
            </Card>

            {/* Cache Clear action */}
            <View style={styles.actionWrap}>
              <Button
                variant="secondary"
                label={cleared ? t('me.storageCache.clearSuccess') : t('me.storageCache.clearCacheBtn')}
                onPress={handleClearCache}
                testID="btn-clear-food-cache"
                style={styles.clearBtn}
              />
            </View>
          </ScrollView>
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
  card: {
    padding: space[4],
    marginBottom: space[4],
  },
  cardSub: {
    marginTop: space[1],
  },
  actionWrap: {
    marginTop: space[2],
  },
  clearBtn: {
    width: '100%',
  },
});
