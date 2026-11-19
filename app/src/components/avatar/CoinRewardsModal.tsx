import React, { useEffect, useState } from 'react';
import { Share, Platform, ScrollView, View, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Button, Sheet, Text, space, useTheme } from '@calipartner/ui';
import { coinEarnOptions, coinReferralUrl } from '@/services/coinReferralService';
import { t, type TranslationKey } from '@/i18n';
import { releaseUpdate } from '@/i18n/releaseUpdate';
import { CoinAmount } from './CoinAmount';

export function CoinRewardsModal({
  mode,
  onClose,
}: {
  mode: 'invite' | 'earn';
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const [url, setUrl] = useState('');
  const [rows, setRows] = useState<{ action: string; amount: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retry, setRetry] = useState(0);
  const title = t(mode === 'invite' ? 'releaseUpdate.inviteTitle' : 'releaseUpdate.rewardsTitle');
  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    const work =
      mode === 'invite'
        ? coinReferralUrl().then((link) => {
            if (active) setUrl(link);
          })
        : coinEarnOptions().then((options) => {
            if (active) setRows(options);
          });
    void work
      .catch(() => {
        if (active) setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [mode, retry]);
  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(url);
        setCopied(true);
      } else await Share.share({ message: t('releaseUpdate.inviteMessage', { url }) });
    } catch {
      setFailed(true);
    }
  };
  return (
    <Sheet visible onClose={onClose} snapPoint="tall" accessibilityLabel={title}>
      <ScrollView
        contentContainerStyle={styles.content}
        testID={mode === 'invite' ? 'coin-invite-modal' : 'coin-earn-modal'}
      >
        <Button
          style={{ alignSelf: 'flex-end' }}
          variant="tertiary"
          label={t('homeRefresh.close')}
          onPress={onClose}
        />
        <Text variant="title2">{title}</Text>
        {mode === 'invite' && <Text>{t('releaseUpdate.inviteBody')}</Text>}
        {loading && <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>}
        {failed && (
          <>
            <Text accessibilityRole="alert" color={colors.danger}>
              {t('common.errorBody')}
            </Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => setRetry((value) => value + 1)}
            />
          </>
        )}
        {mode === 'earn' &&
          rows
            .filter((row) => Object.hasOwn(releaseUpdate.reward, row.action))
            .map((row) => (
              <View
                key={row.action}
                style={[styles.row, { borderBottomColor: colors.hairlineLit }]}
              >
                <Text style={styles.label}>
                  {t(('releaseUpdate.reward.' + row.action) as TranslationKey)}
                </Text>
                <CoinAmount amount={row.amount} />
              </View>
            ))}
        {mode === 'invite' && url && (
          <Button
            label={t(
              Platform.OS === 'web' ? 'releaseUpdate.copyInvite' : 'releaseUpdate.inviteShare',
            )}
            onPress={() => void share()}
            testID="coin-share-invite"
          />
        )}
        {copied && <Text accessibilityLiveRegion="polite">{t('releaseUpdate.inviteCopied')}</Text>}
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: { padding: space[4], gap: space[3] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    paddingVertical: space[2],
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  label: { flex: 1 },
});
