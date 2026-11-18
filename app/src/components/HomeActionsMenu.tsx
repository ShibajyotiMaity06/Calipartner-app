import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Text, controls, homeLayout, radius, space, useTheme } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { useSubscription } from '@/hooks/useSubscription';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';
import { CoinAmount } from './avatar/CoinAmount';
import { CoinRewardsModal } from './avatar/CoinRewardsModal';

const AnimatedPath = Animated.createAnimatedComponent(Path);

export function HomeActionsMenu() {
  const router = useRouter();
  const { colors, reduceMotion } = useTheme();
  const { state } = useAvatar();
  const { currentTier, hasActiveAccess, loading, error } = useSubscription();
  const [open, setOpen] = useState(false);
  const [rewards, setRewards] = useState<'invite' | 'earn' | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const close = () => setOpen(false);
  useBrowserModalBack(open, close);
  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(open ? 1 : 0);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: 500,
      easing: Easing.inOut(Easing.ease),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [open, progress, reduceMotion]);
  const tier = !loading && !error && hasActiveAccess ? currentTier : 'free';
  const balance = state?.enabled ? state.balances.earned + state.balances.purchased : null;
  const label = t(open ? 'ownerPolish.closeMenu' : 'ownerPolish.openMenu');

  return (
    <View style={styles.anchor}>
      <Button
        variant="tertiary"
        iconOnly
        fullWidth={false}
        label={label}
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        testID="home-menu-toggle"
        onPress={() => setOpen((current) => !current)}
        icon={
          <Animated.View
            style={{
              transform: [
                {
                  rotate: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '-45deg'],
                  }),
                },
              ],
            }}
          >
            <Svg
              width={homeLayout.menuIconSize}
              height={homeLayout.menuIconSize}
              viewBox="0 0 32 32"
              fill="none"
              stroke={colors.textHi}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <AnimatedPath
                d="M27 10 13 10C10.8 10 9 8.2 9 6 9 3.5 10.8 2 13 2 15.2 2 17 3.8 17 6L17 26C17 28.2 18.8 30 21 30 23.2 30 25 28.2 25 26 25 23.8 23.2 22 21 22L7 22"
                strokeDasharray={progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['12 63', '20 300'],
                })}
                strokeDashoffset={progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -32.42],
                })}
              />
              <Path d="M7 16 27 16" />
            </Svg>
          </Animated.View>
        }
      />
      {open && (
        <View
          testID="home-actions-menu"
          style={[styles.menu, { backgroundColor: colors.s1, borderColor: colors.hairlineLit }]}
        >
          <Button
            variant="tertiary"
            label={t('ownerPolish.aiCoach')}
            testID="home-coach-icon"
            icon={<Ionicons name="chatbubble-outline" size={controls.icon} color={colors.textHi} />}
            onPress={() => {
              close();
              router.push('/coach');
            }}
          />
          <Button
            variant="tertiary"
            label={t('ownerPolish.upgrade')}
            testID="btn-header-upgrade"
            icon={<Ionicons name="flash-outline" size={controls.icon} color={colors.textHi} />}
            onPress={() => {
              close();
              if (tier === 'pro') router.push('/me');
              else if (tier === 'plus')
                router.push({ pathname: '/paywall', params: { tier: 'pro' } });
              else router.push('/paywall');
            }}
          />
          <View style={styles.balance}>
            <Button
              variant="tertiary"
              fullWidth={false}
              label={t('ownerPolish.caliCash')}
              testID="header-cc-balance"
              onPress={() => {
                close();
                router.push('/wallet');
              }}
            />
            {balance === null ? (
              <Text color={colors.textMid}>{t('ownerPolish.balanceUnavailable')}</Text>
            ) : (
              <CoinAmount amount={balance} />
            )}
          </View>
          <Button
            variant="tertiary"
            label={t('releaseUpdate.invite')}
            testID="home-coin-invite"
            onPress={() => {
              close();
              setRewards('invite');
            }}
          />
          <Button
            variant="tertiary"
            label={t('releaseUpdate.earn')}
            testID="home-earn-coins"
            onPress={() => {
              close();
              setRewards('earn');
            }}
          />
        </View>
      )}
      {rewards && (
        <CoinRewardsModal key={rewards} mode={rewards} onClose={() => setRewards(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { zIndex: 1 },
  menu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    minWidth: controls.touch * 4,
    borderRadius: radius.control,
    padding: space[2],
    borderWidth: StyleSheet.hairlineWidth,
  },
  balance: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
});
