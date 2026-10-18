import React from 'react';
import {
  View,
  StyleSheet,
  type ViewStyle,
} from 'react-native';
import { dark } from '../tokens/colors';
import { radius } from '../tokens/radius';
import { space } from '../tokens/space';
import { Text } from './Text';
import { Button } from './Button';

export interface PermissionPoint {
  title: string;
  detail: string;
}

export interface PermissionPrimerProps {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
  whatWeRead?: string;
  whatWeWrite?: string;
  whatWeNeverDo?: string;
  allowLabel?: string;
  denyLabel?: string;
  onAllow: () => void;
  onDeny: () => void;
  testID?: string;
  style?: ViewStyle;
}

export function PermissionPrimer({
  icon,
  title,
  subtitle,
  whatWeRead,
  whatWeWrite,
  whatWeNeverDo = 'We never sell your data or share your private metrics with strangers.',
  allowLabel = 'Allow access',
  denyLabel = 'Not now',
  onAllow,
  onDeny,
  testID,
  style,
}: PermissionPrimerProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

      <Text variant="title1" color={dark.textHi} style={styles.title}>
        {title}
      </Text>

      <Text variant="body" color={dark.textMid} style={styles.subtitle}>
        {subtitle}
      </Text>

      <View style={styles.pointsCard}>
        {whatWeRead ? (
          <View style={styles.pointRow}>
            <View style={[styles.indicator, { backgroundColor: dark.teal }]} />
            <View style={styles.pointContent}>
              <Text variant="label" color={dark.textHi}>
                What we read
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.pointDetail}>
                {whatWeRead}
              </Text>
            </View>
          </View>
        ) : null}

        {whatWeWrite ? (
          <View style={styles.pointRow}>
            <View style={[styles.indicator, { backgroundColor: dark.iris }]} />
            <View style={styles.pointContent}>
              <Text variant="label" color={dark.textHi}>
                What we save
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.pointDetail}>
                {whatWeWrite}
              </Text>
            </View>
          </View>
        ) : null}

        {whatWeNeverDo ? (
          <View style={styles.pointRow}>
            <View style={[styles.indicator, { backgroundColor: dark.danger }]} />
            <View style={styles.pointContent}>
              <Text variant="label" color={dark.textHi}>
                What we never do
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.pointDetail}>
                {whatWeNeverDo}
              </Text>
            </View>
          </View>
        ) : null}
      </View>

      <View style={styles.buttons}>
        <Button
          variant="primary"
          size="lg"
          fullWidth
          label={allowLabel}
          onPress={onAllow}
          testID={testID ? `${testID}-allow` : undefined}
        />
        <Button
          variant="secondary"
          size="md"
          fullWidth
          label={denyLabel}
          onPress={onDeny}
          testID={testID ? `${testID}-deny` : undefined}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space[5], // 20
    backgroundColor: dark.bg0,
    width: '100%',
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.card,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[4], // 16
  },
  title: {
    marginBottom: space[2], // 8
  },
  subtitle: {
    lineHeight: 22,
    marginBottom: space[5], // 20
  },
  pointsCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card, // 20
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4], // 16
    gap: space[4], // 16
    marginBottom: space[6], // 24
  },
  pointRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3], // 12
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  pointContent: {
    flex: 1,
  },
  pointDetail: {
    marginTop: 2,
    lineHeight: 18,
  },
  buttons: {
    gap: space[3], // 12
    width: '100%',
  },
});
