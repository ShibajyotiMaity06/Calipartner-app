import { CharacterPanel } from './CharacterPanel';
import { ColorSwatch } from './ColorSwatch';
import { CoinAmount } from './CoinAmount';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import {
  Button,
  Text,
  useTheme,
  space,
  radius,
  avatarLayout,
  avatarPresentation,
} from '@calipartner/ui';
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
import { CreateAiAvatarModal } from './CreateAiAvatarModal';
import { PaywallModal } from '@/components/rooms/PaywallModal';

const slots: AvatarSlot[] = [
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
];
export function CharacterEditor({ creating = false }: { creating?: boolean }) {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ setup?: string; try?: string }>();
  const { user, profile: account } = useAuth();
  const { state, acknowledge, hasPaidPro, acknowledgeCustomBase } = useAvatar();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<AvatarProfile | null>(null);
  const [tab, setTab] = useState<AvatarSlot | 'body'>('body');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quote, setQuote] = useState<AvatarQuote | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [aiAvatarOpen, setAiAvatarOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const openUpgrade = () => {
    setAiAvatarOpen(false);
    setUpgradeOpen(true);
  };
  const baseline = useRef('');
  const initialized = useRef<string | null>(null);
  const busy = useRef(false);
  const allowLeave = useRef(false);
  const saveRequest = useRef<{ payload: string; id: string } | null>(null);
  const modelRequest = useRef<{ payload: string; id: string } | null>(null);
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
  const preparePurchase = async () => {
    if (!draft || !state) throw new Error('AVATAR_REQUIRED');
    if (!state.profile) {
      acknowledge(await createAvatar(getSupabase(), draft.gender, draft.skin_tone_id));
    } else if (state.profile.gender !== draft.gender) {
      // The existing purchase API checks the saved model. Acknowledge that model
      // with owned items first; no unpurchased preview is sent to avatar_save.
      const ownedSlots = Object.fromEntries(
        Object.entries(draft.slots).filter(([, id]) =>
          state.products.some((p) => p.id === id && (p.owned || p.starter)),
        ),
      );
      const ownedTints = Object.fromEntries(
        Object.entries(draft.tints).filter(([slot]) => ownedSlots[slot.replace('_finish', '')]),
      );
      const loadout = { ...draft, slots: ownedSlots, tints: ownedTints };
      const payload = fingerprint(loadout);
      if (modelRequest.current?.payload !== payload)
        modelRequest.current = { payload, id: generateClientUuid() };
      acknowledge(
        await saveAvatar(
          getSupabase(),
          modelRequest.current.id,
          draft.gender,
          draft.skin_tone_id,
          loadout,
        ),
      );
    }
  };
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
  const selectedPurchases =
    state?.products.filter(
      (p) => Object.values(draft?.slots ?? {}).includes(p.id) && !p.owned && !p.starter,
    ) ?? [];
  const canBuyAll =
    selectedPurchases.length > 0 &&
    selectedPurchases.every((p) => p.active && p.accessible && !p.earn_only);
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
      fixed
      title={t(creating ? 'avatar.create' : 'avatar.title')}
      onBack={leave}
      onUnavailable={
        params.setup === '1' ? () => router.replace('/weekly-plan?setup=1' as never) : undefined
      }
    >
      {state && draft ? (
        <CharacterPanel
          footer={
            <>
              {error ? <Text accessibilityRole="alert">{error}</Text> : null}
              {saved ? <Text accessibilityLiveRegion="polite">{t('avatar.saved')}</Text> : null}
              {canBuyAll ? (
                <Button
                  label={t('avatar.buyAll')}
                  testID="wardrobe-buy-all"
                  onPress={() =>
                    setQuote({
                      name: t('avatar.selectedItems'),
                      price: selectedPurchases.reduce(
                        (sum, p) => sum + (p.effective_price ?? p.price_cc),
                        0,
                      ),
                      productId: null,
                      collectionId: null,
                      items: selectedPurchases.map((p) => ({
                        productId: p.id,
                        name: p.name,
                        price: p.effective_price ?? p.price_cc,
                      })),
                    })
                  }
                />
              ) : null}
              {!canBuyAll ? (
                <Button
                  label={t(params.setup === '1' ? 'avatar.continue' : 'avatar.save')}
                  disabled={!!unowned}
                  loading={saving}
                  onPress={() => void save()}
                  testID="avatar-save"
                />
              ) : null}
              {unowned ? <Text>{t('avatar.previewHint')}</Text> : null}
            </>
          }
          character={(height) => (
            <AvatarView
              profile={draft}
              products={state.products}
              tints={state.tints}
              height={height}
            />
          )}
        >
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
              {state.profile && (
                <Button
                  variant="secondary"
                  label={t('avatarAi.create')}
                  disabled={state.profile.gender !== draft.gender}
                  onPress={() => setAiAvatarOpen(true)}
                  testID="create-ai-avatar"
                />
              )}
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
                    <ColorSwatch
                      key={tint.id}
                      color={tint.hex}
                      selected={draft.skin_tone_id === tint.id}
                      label={t('avatar.colorName', { number: index + 1 })}
                      testID={`avatar-${tint.id}`}
                      onPress={() => {
                        setDraft({ ...draft, skin_tone_id: tint.id });
                        setSaved(false);
                      }}
                    />
                  ))}
              </View>
            </>
          ) : (
            <>
              {draft.slots[tab] &&
              state.products.find((p) => p.id === draft.slots[tab])?.tintable ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.colorRow}
                  >
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
                          <ColorSwatch
                            key={tint.id}
                            color={tint.hex}
                            selected={selected}
                            locked={!allowed}
                            label={`${t(tint.tier_required === 'free' ? 'avatar.colorName' : 'avatar.fashionColor', { number: index + 1 })}${allowed ? '' : `, ${t('avatar.unlock', { tier: t('proPlan.pro') })}`}`}
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
                          />
                        );
                      })}
                  </ScrollView>
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
                          item={item}
                          label={item.name}
                          profile={preview}
                          products={state.products}
                          tints={state.tints}
                          preview
                          height={avatarLayout.thumbnailHeight}
                        />
                        <Text variant="label">{item.name}</Text>
                        {item.owned || item.starter || item.earn_only ? (
                          <Text variant="label">
                            {t(
                              item.owned || item.starter
                                ? chosen
                                  ? 'avatar.equipped'
                                  : 'avatar.owned'
                                : 'avatar.earnedOnly',
                            )}
                          </Text>
                        ) : (
                          <CoinAmount amount={item.effective_price ?? item.price_cc} />
                        )}
                        {!item.accessible && !item.owned ? (
                          <Text variant="micro">
                            {t('avatar.unlock', {
                              tier: t('proPlan.pro'),
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
                        tier: t('proPlan.pro'),
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
            </>
          )}
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
        </CharacterPanel>
      ) : null}
      {quote ? (
        <PurchaseSheet
          quote={quote}
          onBeforePurchase={preparePurchase}
          onClose={() => setQuote(null)}
        />
      ) : null}
      {aiAvatarOpen && <CreateAiAvatarModal onClose={() => setAiAvatarOpen(false)} />}
      {upgradeOpen && <PaywallModal visible onClose={() => setUpgradeOpen(false)} />}
      <Modal
        visible={!!pendingLeave}
        transparent
        animationType="none"
        onRequestClose={() => setPendingLeave(null)}
      >
        <View style={styles.discardOverlay}>
          <View accessibilityViewIsModal style={[styles.discard, { backgroundColor: colors.s1 }]}>
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
        </View>
      </Modal>
    </AvatarPage>
  );
}
const styles = StyleSheet.create({
  colorRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: space[2],
    paddingVertical: space[2],
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], alignItems: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  item: {
    width: '30%',
    minWidth: avatarLayout.editorCardMinWidth,
    borderRadius: radius.card,
    padding: space[2],
    gap: space[2],
  },
  discardOverlay: {
    flex: 1,
    justifyContent: 'center',
    padding: space[5],
    backgroundColor: avatarPresentation.modalScrim,
  },
  discard: { borderRadius: radius.card, padding: space[5], gap: space[4] },
});
