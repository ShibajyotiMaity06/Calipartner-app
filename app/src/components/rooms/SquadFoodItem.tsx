import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, dark, homeLayout, radius, Sheet, space, Text } from '@calipartner/ui';
import type { MealSection, SquadMeal } from '@calipartner/core';
import { copyRoomMeal } from '@/services/roomMealService';
import { generateClientUuid } from '@/services/foodService';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export function SquadFoodItem({
  item,
  roomId,
  memberId,
  section,
}: {
  item: SquadMeal['items'][number];
  roomId?: string;
  memberId?: string;
  section: MealSection;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false),
    [saved, setSaved] = useState(false),
    [target, setTarget] = useState<MealSection>(section);
  const request = useRef<string | null>(null),
    lock = useRef(false);
  const close = () => {
    if (!lock.current) setOpen(false);
  };
  useBrowserModalBack(open, close);
  const save = async () => {
    if (lock.current || !roomId || !memberId) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    request.current ??= generateClientUuid();
    try {
      await copyRoomMeal(request.current, roomId, memberId, item.id, target, true);
      setSaved(true);
      setOpen(false);
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <View
      style={{
        backgroundColor: dark.s2,
        borderRadius: radius.control,
        padding: space[3],
        gap: space[2],
      }}
    >
      <Ionicons
        name="restaurant-outline"
        size={homeLayout.iconSize}
        color={dark.textMid}
        accessible={false}
      />
      <Text variant="label">{item.name}</Text>
      <Text variant="bodyS" tabular>
        {item.quantity} {item.unit}
      </Text>
      {saved ? (
        <Text
          variant="bodyS"
          accessibilityLiveRegion="polite"
          testID={`peer-food-saved-${item.id}`}
        >
          {t('fixNovember.copied')}
        </Text>
      ) : (
        roomId &&
        memberId && (
          <Button
            variant="secondary"
            size="sm"
            fullWidth={false}
            label={t('fixNovember.logFood')}
            onPress={() => setOpen(true)}
            testID={`log-peer-food-${item.id}`}
          />
        )
      )}
      {open && (
        <Sheet
          visible
          onClose={close}
          accessibilityLabel={t('fixNovember.copyTitle')}
          testID={`copy-peer-food-${item.id}`}
        >
          <View style={{ padding: space[4], gap: space[4] }}>
            <Text variant="title2">{t('fixNovember.copyTitle')}</Text>
            <Text>{item.name}</Text>
            <Text>{t('fixNovember.copyHint')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {(['breakfast', 'lunch', 'dinner', 'snacks', 'extra'] as const).map((meal) => (
                <Pressable
                  key={meal}
                  style={{
                    minHeight: homeLayout.touchSize,
                    padding: space[3],
                    borderRadius: radius.control,
                    backgroundColor: target === meal ? dark.s3 : dark.s1,
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: target === meal, disabled: busy || failed }}
                  disabled={busy || failed}
                  onPress={() => setTarget(meal)}
                  testID={`copy-food-section-${meal}`}
                >
                  <Text>{t(`diary.sections.${meal}`)}</Text>
                </Pressable>
              ))}
            </View>
            {failed && <Text accessibilityRole="alert">{t('fixNovember.copyFailed')}</Text>}
            <Button
              label={t(busy ? 'common.saving' : 'fixNovember.logFood')}
              disabled={busy}
              onPress={() => void save()}
              testID="confirm-peer-food-log"
            />
            <Button
              variant="tertiary"
              label={t('common.cancel')}
              disabled={busy}
              onPress={close}
              testID="cancel-peer-food-log"
            />
          </View>
        </Sheet>
      )}
    </View>
  );
}
