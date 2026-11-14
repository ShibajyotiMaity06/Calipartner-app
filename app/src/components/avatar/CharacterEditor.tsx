import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { Button, Text, useTheme, space, radius, avatarLayout } from '@calipartner/ui';
import type { AvatarGender, AvatarLoadout, AvatarProfile, AvatarSlot } from '@calipartner/core';
import { useAvatar } from '@/hooks/useAvatar';
import { useAuth } from '@/contexts/AuthContext';
import { createAvatar, saveAvatar } from '@/services/avatarService';
import { getSupabase } from '@/lib/supabase';
import { generateClientUuid } from '@/services/foodService';
import { t } from '@/i18n';
import { AvatarPage } from './AvatarPage';
import { AvatarView } from './AvatarView';
import { PurchaseSheet, type AvatarQuote } from './PurchaseSheet';

const slots: AvatarSlot[] = [
  'backdrop',
  'aura',
  'hair',
  'facial',
  'headwear',
  'eyewear',
  'ears',
  'top',
  'bottom',
  'wrist',
  'neck',
  'shoes',
  'frame',
];
export function CharacterEditor({ creating = false }: { creating?: boolean }) {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ setup?: string; try?: string }>();
  const { user, profile: account } = useAuth();
  const { state, acknowledge } = useAvatar();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<AvatarProfile | null>(null);
  const [tab, setTab] = useState<AvatarSlot | 'body'>('body');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quote, setQuote] = useState<AvatarQuote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const baseline = useRef('');
  const initialized = useRef<string | null>(null);
  const busy = useRef(false);
  const allowLeave = useRef(false);
  const saveRequest = useRef<{ payload: string; id: string } | null>(null);
  const [pendingLeave, setPendingLeave] = useState<(() => void) | null>(null);
  const fingerprint = useCallback(
    (value: AvatarProfile) =>
      JSON.stringify([value.gender, value.skin_tone_id, value.slots, value.tints]),
    [],
  );
  useEffect(() => {
    if (!state?.enabled || !user || initialized.current === user.id) return;
    const gender: AvatarGender = account?.sex === 'female' ? 'f' : 'm';
    const starterSlots = Object.fromEntries(
      state.products
        .filter((p) => p.starter && p.kind === 'item' && p.genders.includes(gender))
        .map((p) => [p.slot, p.id]),
    );
    const initial = state.profile ?? {
      user_id: user.id,
      gender,
      skin_tone_id: state.tints.find((t) => t.kind === 'skin')!.id,
      form: 1,
      level: 1,
      xp: 0,
      slots: starterSlots,
      tints: {},
    };
    baseline.current = fingerprint(initial);
    setDraft(initial);
    initialized.current = user.id;
  }, [state, user, account?.sex, fingerprint]);
  useEffect(() => {
    if (!draft || !state || !params.try) return;
    const item = state.products.find(
      (p) => p.id === params.try && p.genders.includes(draft.gender),
    );
    if (item && item.slot !== 'finish') {
      setDraft((d) => (d ? { ...d, slots: { ...d.slots, [item.slot]: item.id } } : d));
      setTab(item.slot);
      setSelectedId(item.id);
      router.setParams({ try: undefined });
    }
  }, [draft, state, params.try, router]);
  const dirty = !!draft && fingerprint(draft) !== baseline.current;
  usePreventRemove(dirty && !allowLeave.current, ({ data }) =>
    setPendingLeave(() => () => {
      allowLeave.current = true;
      navigation.dispatch(data.action);
    }),
  );
  const leave = () => {
    const action = () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today'));
    if (dirty && !allowLeave.current) setPendingLeave(() => action);
    else action();
  };
  const changeModel = (gender: AvatarGender) => {
    if (!draft || !state) return;
    const nextSlots = Object.fromEntries(
      Object.entries(draft.slots).filter(([, id]) =>
        state.products.find((p) => p.id === id)?.genders.includes(gender),
      ),
    );
    if (!nextSlots.hair) {
      const hair = state.products.find(
        (p) => p.starter && p.slot === 'hair' && p.genders.includes(gender),
      );
      if (hair) nextSlots.hair = hair.id;
    }
    const tints = Object.fromEntries(
      Object.entries(draft.tints).filter(([slot]) => nextSlots[slot.replace('_finish', '')]),
    );
    setDraft({ ...draft, gender, slots: nextSlots, tints });
    setSelectedId(null);
    setSaved(false);
  };
  const save = async () => {
    if (!draft || !state || busy.current) return;
    busy.current = true;
    setSaving(true);
    setError(null);
    setSaved(false);
    const payload = fingerprint(draft);
    if (saveRequest.current?.payload !== payload)
      saveRequest.current = { payload, id: generateClientUuid() };
    try {
      if (!state.profile)
        acknowledge(await createAvatar(getSupabase(), draft.gender, draft.skin_tone_id));
      const result = await saveAvatar(
        getSupabase(),
        saveRequest.current.id,
        draft.gender,
        draft.skin_tone_id,
        draft as AvatarLoadout,
      );
      acknowledge(result);
      baseline.current = payload;
      setSaved(true);
      if (params.setup === '1') {
        allowLeave.current = true;
        router.replace('/weekly-plan?setup=1' as never);
      }
    } catch (e) {
      setError(
        t(
          e instanceof Error && e.message.includes('NETWORK_UNAVAILABLE')
            ? 'avatar.offline'
            : 'avatar.saveError',
        ),
      );
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  const current = state?.products.find((p) => p.id === selectedId);
  const unowned = useMemo(
    () =>
      draft && state
        ? Object.values(draft.slots).some(
            (id) =>
              !state.products.find((p) => p.id === id)?.owned &&
              !state.products.find((p) => p.id === id)?.starter,
          )
        : false,
    [draft, state],
  );
  const visibleItems =
    state?.products.filter(
      (p) => (p.active || p.owned) && p.slot === tab && p.genders.includes(draft?.gender ?? 'm'),
    ) ?? [];
  const button = (label: string, onPress: () => void, id: string, selected = false) => (
    <Button
      key={id}
      variant={selected ? 'primary' : 'secondary'}
      fullWidth={false}
      size="sm"
      label={label}
      onPress={onPress}
      testID={id}
    />
  );
  return (
    <AvatarPage
      title={t(creating ? 'avatar.create' : 'avatar.title')}
      onBack={leave}
      onUnavailable={
        params.setup === '1' ? () => router.replace('/weekly-plan?setup=1' as never) : undefined
      }
    >
      {state && draft ? (
        <>
          <AvatarView
            profile={draft}
            products={state.products}
            tints={state.tints}
            height={avatarLayout.editorHeight}
          />
          <Text>{t(creating ? 'avatar.freeStarter' : 'avatar.subtitle')}</Text>
          <View style={styles.row}>
            <Button
              variant="secondary"
              fullWidth={false}
              label={t('avatar.shop')}
              onPress={() => router.push('/shop')}
              testID="wardrobe-shop"
            />
            {state.profile ? (
              <Button
                variant="tertiary"
                fullWidth={false}
                label={t('avatar.progress')}
                onPress={() => router.push('/avatar/progress')}
                testID="wardrobe-progress"
              />
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.row}
          >
            {button(
              t('avatar.body'),
              () => {
                setTab('body');
                setSelectedId(null);
              },
              'avatar-tab-body',
              tab === 'body',
            )}
            {slots
              .filter((s) => s !== 'facial' || draft.gender === 'm')
              .map((s) =>
                button(
                  t(`avatar.slots.${s}`),
                  () => {
                    setTab(s);
                    setSelectedId(draft.slots[s] ?? null);
                  },
                  `avatar-tab-${s}`,
                  tab === s,
                ),
              )}
          </ScrollView>
          {tab === 'body' ? (
            <>
              <Text variant="heading">{t('avatar.model')}</Text>
              <View style={styles.row}>
                {(['m', 'f'] as AvatarGender[]).map((g) =>
                  button(
                    t(g === 'm' ? 'avatar.male' : 'avatar.female'),
                    () => changeModel(g),
                    `avatar-model-${g}`,
                    draft.gender === g,
                  ),
                )}
              </View>
              <Text variant="heading">{t('avatar.skin')}</Text>
              <View style={styles.row}>
                {state.tints
                  .filter((t) => t.kind === 'skin')
                  .map((tint, index) => (
                    <Pressable
                      key={tint.id}
                      onPress={() => {
                        setDraft({ ...draft, skin_tone_id: tint.id });
                        setSaved(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={t('avatar.colorName', { number: index + 1 })}
                      accessibilityState={{ selected: draft.skin_tone_id === tint.id }}
                      testID={`avatar-${tint.id}`}
                      style={[
                        styles.swatch,
                        {
                          backgroundColor: tint.hex,
                          borderColor:
                            draft.skin_tone_id === tint.id ? colors.textHi : colors.hairline,
                          borderWidth:
                            draft.skin_tone_id === tint.id
                              ? avatarLayout.selectedBorderWidth
                              : avatarLayout.borderWidth,
                        },
                      ]}
                    >
                      {draft.skin_tone_id === tint.id ? (
                        <Text color={colors.textHi} style={{ backgroundColor: colors.s1 }}>
                          {t('avatar.selected')}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
              </View>
            </>
          ) : (
            <>
              <View style={styles.grid}>
                {visibleItems.length === 0 ? (
                  <Text>{t('avatar.empty')}</Text>
                ) : (
                  visibleItems.map((item) => {
                    const chosen = draft.slots[tab] === item.id;
                    const preview = { ...draft, slots: { ...draft.slots, [tab]: item.id } };
                    return (
                      <Pressable
                        key={item.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${item.name}, ${t(item.owned || item.starter ? 'avatar.owned' : 'avatar.preview')}`}
                        accessibilityState={{ selected: chosen }}
                        testID={`avatar-item-${item.id}`}
                        onPress={() => {
                          setDraft(preview);
                          setSelectedId(item.id);
                          setSaved(false);
                        }}
                        style={({ pressed }) => [
                          styles.item,
                          {
                            backgroundColor: colors.s1,
                            borderColor: chosen ? colors.apricot : colors.hairline,
                            borderWidth: chosen
                              ? avatarLayout.selectedBorderWidth
                              : avatarLayout.borderWidth,
                            opacity: pressed ? avatarLayout.opacityPressed : 1,
                          },
                        ]}
                      >
                        <AvatarView
                          profile={preview}
                          products={state.products}
                          tints={state.tints}
                          preview
                          height={avatarLayout.thumbnailHeight}
                        />
                        <Text variant="label">{item.name}</Text>
                        <Text variant="label">
                          {item.owned || item.starter
                            ? t(chosen ? 'avatar.equipped' : 'avatar.owned')
                            : item.earn_only
                              ? t('avatar.earnedOnly')
                              : t('avatar.price', {
                                  amount: item.effective_price ?? item.price_cc,
                                })}
                        </Text>
                        {!item.accessible && !item.owned ? (
                          <Text variant="micro">
                            {t('avatar.unlock', {
                              tier:
                                state.collections.find((c) => c.id === item.collection_id)
                                  ?.tier_required ?? 'Plus',
                            })}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
              {current && !current.owned && !current.starter ? (
                <>
                  <Text>
                    {t(current.earn_only ? 'avatar.earnCondition' : 'avatar.previewHint', {
                      name: current.name,
                    })}
                  </Text>
                  {!current.earn_only ? (
                    <Button
                      variant="secondary"
                      label={t(current.accessible ? 'avatar.buy' : 'avatar.unlock', {
                        tier:
                          state.collections.find((c) => c.id === current.collection_id)
                            ?.tier_required ?? 'Plus',
                      })}
                      onPress={() =>
                        current.accessible
                          ? setQuote({
                              name: current.name,
                              price: current.effective_price ?? current.price_cc,
                              productId: current.id,
                              collectionId: null,
                            })
                          : router.push('/paywall')
                      }
                      testID="wardrobe-buy"
                    />
                  ) : null}
                </>
              ) : null}
              {draft.slots[tab] ? (
                <Button
                  variant="tertiary"
                  label={t('avatar.remove')}
                  onPress={() => {
                    const next = { ...draft.slots };
                    delete next[tab];
                    const tints = { ...draft.tints };
                    delete tints[tab];
                    delete tints[`${tab}_finish`];
                    setDraft({ ...draft, slots: next, tints });
                    setSelectedId(null);
                    setSaved(false);
                  }}
                  testID="avatar-remove-item"
                />
              ) : null}
              {draft.slots[tab] &&
              state.products.find((p) => p.id === draft.slots[tab])?.tintable ? (
                <>
                  <Text variant="heading">{t('avatar.color')}</Text>
                  {button(
                    t('avatar.originalColor'),
                    () => {
                      const tints = { ...draft.tints };
                      delete tints[tab];
                      delete tints[`${tab}_finish`];
                      setDraft({ ...draft, tints });
                    },
                    'avatar-color-original',
                  )}
                  <View style={styles.row}>
                    {state.tints
                      .filter(
                        (t) => t.kind === (tab === 'hair' || tab === 'facial' ? 'hair' : 'garment'),
                      )
                      .map((tint, index) => {
                        const allowed =
                          tint.tier_required === 'free' ||
                          state.tier === 'pro' ||
                          state.tier === tint.tier_required;
                        const selected = draft.tints[tab] === tint.id;
                        return (
                          <Pressable
                            key={tint.id}
                            accessibilityRole="button"
                            accessibilityLabel={`${t(tint.tier_required === 'free' ? 'avatar.colorName' : 'avatar.fashionColor', { number: index + 1 })}${allowed ? '' : `, ${t('avatar.unlock', { tier: 'Plus' })}`}`}
                            accessibilityState={{ selected }}
                            testID={`avatar-color-${tint.id}`}
                            onPress={() => {
                              if (!allowed) {
                                router.push('/paywall');
                                return;
                              }
                              const next = { ...draft.tints, [tab]: tint.id };
                              delete next[`${tab}_finish`];
                              setDraft({ ...draft, tints: next });
                              setSaved(false);
                            }}
                            style={[
                              styles.swatch,
                              {
                                backgroundColor: tint.hex,
                                borderColor: selected ? colors.apricot : colors.hairline,
                                borderWidth: selected
                                  ? avatarLayout.selectedBorderWidth
                                  : avatarLayout.borderWidth,
                              },
                            ]}
                          >
                            {selected || !allowed ? (
                              <Text
                                variant="micro"
                                color={colors.textHi}
                                style={{ backgroundColor: colors.s1 }}
                              >
                                {t(selected ? 'avatar.selected' : 'avatar.unlock', {
                                  tier: 'Plus',
                                })}
                              </Text>
                            ) : null}
                          </Pressable>
                        );
                      })}
                  </View>
                  <View style={styles.row}>
                    {state.products
                      .filter((p) => p.kind === 'finish' && p.owned)
                      .map((finish) =>
                        button(
                          finish.name,
                          () =>
                            setDraft({
                              ...draft,
                              tints: { ...draft.tints, [`${tab}_finish`]: finish.id },
                            }),
                          `avatar-finish-${finish.id}`,
                          draft.tints[`${tab}_finish`] === finish.id,
                        ),
                      )}
                  </View>
                </>
              ) : null}
            </>
          )}
          {error ? <Text accessibilityRole="alert">{error}</Text> : null}
          {saved ? <Text accessibilityLiveRegion="polite">{t('avatar.saved')}</Text> : null}
          <Button
            label={t(params.setup === '1' ? 'avatar.continue' : 'avatar.save')}
            disabled={!!unowned}
            loading={saving}
            onPress={() => void save()}
            testID="avatar-save"
          />
          {unowned ? <Text>{t('avatar.previewHint')}</Text> : null}
        </>
      ) : null}
      {quote ? <PurchaseSheet quote={quote} onClose={() => setQuote(null)} /> : null}
      <Modal
        visible={!!pendingLeave}
        transparent={false}
        animationType="none"
        onRequestClose={() => setPendingLeave(null)}
      >
        <View style={[styles.discard, { backgroundColor: colors.bg0 }]}>
          <Text variant="title2">{t('avatar.discardTitle')}</Text>
          <Text>{t('avatar.discardBody')}</Text>
          <Button
            variant="secondary"
            label={t('avatar.stay')}
            onPress={() => setPendingLeave(null)}
            testID="avatar-keep-editing"
          />
          <Button
            label={t('avatar.discard')}
            onPress={() => {
              allowLeave.current = true;
              const action = pendingLeave;
              setPendingLeave(null);
              action?.();
            }}
            testID="avatar-discard"
          />
        </View>
      </Modal>
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  item: {
    width: '46%',
    minWidth: avatarLayout.cardMinWidth,
    borderRadius: radius.card,
    padding: space[2],
    gap: space[2],
  },
  swatch: {
    minWidth: avatarLayout.swatchSize,
    minHeight: avatarLayout.swatchSize,
    maxWidth: avatarLayout.swatchSize + space[4],
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discard: { flex: 1, justifyContent: 'center', padding: space[5], gap: space[4] },
});
