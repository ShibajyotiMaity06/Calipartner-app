import React from 'react';
import { View, StyleSheet, type ViewStyle } from 'react-native';
import { dark } from '../tokens/colors';
import { space } from '../tokens/space';
import { Text } from './Text';
import { Button } from './Button';

export interface EmptyStateProps {
  /** Line-art icon or glyph (e.g. 48px) */
  icon?: React.ReactNode;
  /** One line of what this is */
  title: string;
  /** One line of why / helpful context */
  description?: string;
  /** Action button label */
  actionLabel?: string;
  /** Action on press handler */
  onAction?: () => void;
  /** Secondary action label */
  secondaryActionLabel?: string;
  /** Secondary action handler */
  onSecondaryAction?: () => void;
  testID?: string;
  style?: ViewStyle;
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  testID,
  style,
}: EmptyStateProps): React.JSX.Element {
  return (
    <View style={[styles.container, style]} testID={testID}>
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}

      <Text variant="title2" color={dark.textHi} style={styles.title}>
        {title}
      </Text>

      {description ? (
        <Text variant="bodyS" color={dark.textMid} style={styles.description}>
          {description}
        </Text>
      ) : null}

      {actionLabel && onAction ? (
        <View style={styles.actionWrap}>
          <Button
            variant="primary"
            size="md"
            label={actionLabel}
            onPress={onAction}
            testID={testID ? `${testID}-action` : undefined}
          />
        </View>
      ) : null}

      {secondaryActionLabel && onSecondaryAction ? (
        <View style={styles.secondaryActionWrap}>
          <Button
            variant="tertiary"
            size="sm"
            label={secondaryActionLabel}
            onPress={onSecondaryAction}
            testID={testID ? `${testID}-secondary-action` : undefined}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: space[6], // 24
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  iconWrap: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3], // 12
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
    marginTop: space[2], // 8
    lineHeight: 20,
    maxWidth: 320,
  },
  actionWrap: {
    marginTop: space[5], // 20
    alignItems: 'center',
  },
  secondaryActionWrap: {
    marginTop: space[2], // 8
    alignItems: 'center',
  },
});
