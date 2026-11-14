import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import Svg, { Line, Polyline, Text as SvgText } from 'react-native-svg';
import {
  Button,
  Text,
  space,
  homeLayout,
  radius,
  type as typography,
  blueprintLayout as chart,
} from '@calipartner/ui';
import { projectWeightPaths, type GoalProfile, type Sex } from '@calipartner/core';
import { t } from '@/i18n';
import { useSquadStyles } from '@/components/rooms/SquadViews';

export function BlueprintStep({
  goal,
  sex,
  onMake,
  onEdit,
  onFree,
}: {
  goal: GoalProfile;
  sex: Sex;
  onMake: () => void;
  onEdit: () => void;
  onFree: () => void;
}) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const [bias, setBias] = useState(0),
    [assumptions, setAssumptions] = useState(false);
  let paths;
  try {
    paths = projectWeightPaths({
      weight: goal.current_weight_kg,
      height: goal.input_height_cm ?? 0,
      sex,
      gymDays: goal.gym_days ?? 0,
      tdee: goal.tdee,
      calories: goal.daily_calorie_target,
      goal: goal.goal,
      rate: goal.weekly_rate_kg,
      targetWeight: goal.target_weight_kg,
      maintenanceBias: bias,
    });
  } catch {
    return (
      <View style={styles.stack}>
        <Text accessibilityRole="alert">{t('common.errorBody')}</Text>
        <Button label={t('aha.edit')} onPress={onEdit} />
      </View>
    );
  }
  const values = paths.flatMap((path) => path.points.map((p) => p.weight));
  const low = Math.floor(Math.min(...values)) - 1,
    high = Math.ceil(Math.max(...values)) + 1;
  const x = (week: number) => chart.left + (week / 12) * chart.plotWidth;
  const y = (weight: number) => chart.top + ((high - weight) / (high - low)) * chart.plotHeight;
  const summaries = paths.map((path) =>
    t('aha.path', {
      plan: t(`aha.${path.tier}`),
      start: goal.current_weight_kg,
      end: path.points.at(-1)!.weight.toFixed(1),
    }),
  );
  return (
    <View style={styles.stack} testID="onboarding-blueprint">
      <Text variant="label">{t('aha.ready')}</Text>
      <Text variant="title1">{t('aha.title')}</Text>
      <Text>{t('aha.subtitle')}</Text>
      <View style={styles.card}>
        <Text variant="heading">{t('aha.targets')}</Text>
        <View style={styles.row}>
          {(
            [
              { key: 'calories', value: goal.daily_calorie_target },
              { key: 'protein', value: goal.protein_grams },
              { key: 'carbs', value: goal.carb_grams },
              { key: 'fat', value: goal.fat_grams },
            ] as const
          ).map((metric) => (
            <View key={metric.key} style={{ flexGrow: 1, flexBasis: '40%', gap: space[1] }}>
              <Text variant="numeralM" tabular nutrient={metric.key}>
                {metric.value.toLocaleString()}
              </Text>
              <Text variant="bodyS" nutrient={metric.key}>
                {t(`squadDesign.${metric.key}`)} ·{' '}
                {t(metric.key === 'calories' ? 'squadDesign.kcal' : 'squadDesign.grams')}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.card}>
        <Text variant="heading">{t('aha.trajectory')}</Text>
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={summaries.join('. ')}
          testID="weight-projection-chart"
        >
          <Svg
            width="100%"
            height={chart.height}
            viewBox={`0 0 ${chart.width} ${chart.height}`}
            accessible={false}
          >
            {[low, (low + high) / 2, high].map((value) => (
              <React.Fragment key={value}>
                <Line
                  x1={chart.left}
                  x2={chart.left + chart.plotWidth}
                  y1={y(value)}
                  y2={y(value)}
                  stroke={dark.hairline}
                />
                <SvgText
                  x={chart.left - space[2]}
                  y={y(value)}
                  textAnchor="end"
                  fill={dark.textMid}
                  fontFamily={typography.micro.fontFamily}
                  fontSize={chart.axisFontSize}
                >
                  {value.toFixed(1)}
                </SvgText>
              </React.Fragment>
            ))}
            {paths.map((path, index) => (
              <Polyline
                key={path.tier}
                testID={`trajectory-${path.tier}`}
                points={path.points.map((p) => `${x(p.week)},${y(p.weight)}`).join(' ')}
                stroke={[dark.cream, dark.teal, dark.iris][index]}
                strokeWidth={index === 0 ? chart.basicLineWidth : chart.lineWidth}
                strokeDasharray={index < 2 ? chart.dash : undefined}
                strokeDashoffset={index === 1 ? 7 : 0}
                fill="none"
              />
            ))}
            {[0, 3, 6, 9, 12].map((week) => (
              <SvgText
                key={week}
                x={x(week)}
                y={chart.height - space[2]}
                textAnchor="middle"
                fill={dark.textMid}
                fontFamily={typography.micro.fontFamily}
                fontSize={chart.axisFontSize}
              >
                {t('aha.week', { week })}
              </SvgText>
            ))}
          </Svg>
        </View>
        {summaries.map((summary, index) => (
          <Text variant="bodyS" tabular key={index}>
            {summary}
          </Text>
        ))}
        <Text variant="bodyS">{t('aha.same')}</Text>
        <Text variant="label">{t('aha.bias')}</Text>
        <View style={styles.row} accessibilityRole="radiogroup">
          {[-0.1, 0, 0.1].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ checked: bias === value }}
              accessibilityLabel={t('aha.biasLabel', { percent: Math.round(value * 100) })}
              onPress={() => setBias(value)}
              testID={`projection-bias-${value}`}
              style={{
                minHeight: homeLayout.touchSize,
                minWidth: homeLayout.touchSize,
                padding: space[3],
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: bias === value ? dark.copper : dark.hairline,
                backgroundColor: bias === value ? dark.s3 : dark.s1,
              }}
            >
              <Text tabular>{t('aha.biasValue', { percent: Math.round(value * 100) })}</Text>
            </Pressable>
          ))}
        </View>
        <Button
          variant="tertiary"
          label={t('aha.assumptions')}
          onPress={() => setAssumptions((value) => !value)}
          testID="projection-assumptions"
        />
        {assumptions && (
          <>
            <Text variant="bodyS">{t('aha.assumptionsBody')}</Text>
            <Text variant="bodyS">{t('aha.reviewAssumption')}</Text>
          </>
        )}
        <Text variant="bodyS">{t('aha.noGuarantee')}</Text>
      </View>
      <Button label={t('aha.build')} onPress={onMake} testID="blueprint-make-plan" />
      <Button
        variant="secondary"
        label={t('aha.edit')}
        onPress={onEdit}
        testID="blueprint-edit-inputs"
      />
      <Button
        variant="tertiary"
        label={t('aha.free')}
        onPress={onFree}
        testID="blueprint-continue-free"
      />
    </View>
  );
}
