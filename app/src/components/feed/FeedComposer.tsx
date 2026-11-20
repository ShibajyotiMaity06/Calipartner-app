import { useCallback, useRef, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Switch, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Button, Text, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { generateClientUuid } from '@/services/foodService';
import { feedApi, feedMaxBytes, getFeedMediaType, type FeedAudience } from '@/services/feedService';
import { t } from '@/i18n';
import {
  FeedAction,
  FeedInput,
  FeedScreen,
  FeedSignIn,
  FeedStatus,
  feedErrorMessage,
  styles,
  useFeedBack,
  useFeedResource,
} from './FeedPrimitives';

const audienceOptions = {
  friends: 'feed.friendsHint',
  squads: 'feed.squadsHint',
  community: 'feed.communityHint',
} as const;

export function FeedComposer() {
  const router = useRouter();
  const back = useFeedBack();
  const { user, isLoading } = useAuth();
  return (
    <FeedScreen title={t('feed.newPost')} back={back} testID="screen-feed-create">
      {isLoading ? (
        <FeedStatus loading />
      ) : !user ? (
        <FeedSignIn onSignIn={() => router.push('/auth/sign-in?mode=signin')} />
      ) : (
        <Composer key={user.id} />
      )}
    </FeedScreen>
  );
}

function Composer() {
  const router = useRouter();
  const { colors } = useTheme();
  const { data: preferences, loading, error, reload } = useFeedResource(feedApi.preferences);
  const [asset, setAsset] = useState<(ImagePicker.ImagePickerAsset & { mediaType: string }) | null>(
    null,
  );
  const [caption, setCaption] = useState('');
  const [description, setDescription] = useState('');
  const [audience, setAudience] = useState<FeedAudience>('friends');
  const [shareProgress, setShareProgress] = useState(false);
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const draft = useRef<string | null>(null);
  const [message, setMessage] = useState('');
  const reset = () => {
    draft.current = null;
    setMessage('');
  };
  const choose = async () => {
    if (saving.current) return;
    setMessage('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      });
      if (result.canceled) return;
      const selected = result.assets[0];
      if (!selected) return;
      const mediaType = getFeedMediaType(
        selected.mimeType || selected.file?.type,
        selected.fileName || selected.file?.name || selected.uri.split('?')[0],
      );
      if (!mediaType) return setMessage(t('feed.unsupported'));
      if ((selected.fileSize ?? selected.file?.size ?? 0) > feedMaxBytes)
        return setMessage(t('feed.tooLarge'));
      reset();
      setAsset({ ...selected, mediaType });
    } catch (error) {
      setMessage(feedErrorMessage(error));
    }
  };
  const mayPublish = !!(asset && description.trim() && (preferences?.accepted || accept));
  const publish = useCallback(async () => {
    if (!asset || !mayPublish || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (!preferences?.accepted && !(await feedApi.accept())) throw new Error('FEED_UNCONFIRMED');
      const retrying = draft.current !== null;
      const id = draft.current ?? (draft.current = generateClientUuid());
      const result = await feedApi.publish({
        id,
        uri: asset.uri,
        file: asset.file,
        mediaType: asset.mediaType,
        caption: caption.trim(),
        description: description.trim(),
        audience,
        shareProgress,
        retrying,
      });
      router.dismissTo(('/feed/post/' + result.id) as Href);
    } catch (error) {
      setMessage(feedErrorMessage(error));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [
    asset,
    audience,
    caption,
    description,
    mayPublish,
    preferences?.accepted,
    router,
    shareProgress,
  ]);

  if (!preferences && (loading || error))
    return <FeedStatus loading={loading} error={error} retry={reload} />;
  if (!preferences) return <FeedSignIn setup onSignIn={() => router.push('/onboarding')} />;
  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {asset &&
        (asset.mediaType.startsWith('image/') ? (
          <Image
            source={{ uri: asset.uri }}
            style={styles.media}
            resizeMode="contain"
            accessibilityLabel={description || t('feed.description')}
            accessible
          />
        ) : (
          <Text variant="label">{asset.fileName || asset.file?.name || t('feed.paused')}</Text>
        ))}
      <Button
        variant="secondary"
        label={t(asset ? 'feed.replaceMedia' : 'feed.chooseMedia')}
        onPress={() => void choose()}
        disabled={busy}
        testID="feed-choose-media"
      />
      {!asset && (
        <Text variant="bodyS" color={colors.textMid}>
          {t('feed.mediaHint')}
        </Text>
      )}
      <FeedInput
        label={t('feed.caption')}
        value={caption}
        onChange={(value) => {
          reset();
          setCaption(value);
        }}
        placeholder={t('feed.captionHint')}
        limit={1000}
        testID="feed-caption"
        disabled={busy}
      />
      <FeedInput
        label={t('feed.description')}
        value={description}
        onChange={(value) => {
          reset();
          setDescription(value);
        }}
        placeholder={t('feed.descriptionHint')}
        limit={240}
        testID="feed-description"
        disabled={busy}
      />
      <View style={styles.stack}>
        <Text variant="label">{t('feed.audience')}</Text>
        <View style={styles.wrap}>
          {(Object.keys(audienceOptions) as FeedAudience[]).map((option) => (
            <FeedAction
              key={option}
              icon={option === 'community' ? 'globe-outline' : 'people-outline'}
              label={t(`feed.${option}`)}
              text={t(`feed.${option}`)}
              selected={audience === option}
              disabled={busy || (option === 'community' && !preferences.community)}
              onPress={() => {
                reset();
                setAudience(option);
              }}
              testID={'feed-audience-' + option}
            />
          ))}
        </View>
        <Text variant="bodyS" color={colors.textMid}>
          {t(audienceOptions[audience])}
        </Text>
        {!preferences.community && (
          <Text variant="bodyS" color={colors.textMid}>
            {t('feed.privateProfile')}
          </Text>
        )}
      </View>
      <View style={styles.stack}>
        <View style={styles.row}>
          <Text variant="label" style={styles.grow}>
            {t('feed.compareOptIn')}
          </Text>
          <Switch
            value={shareProgress}
            disabled={busy}
            accessibilityLabel={t('feed.compareOptIn')}
            onValueChange={(value) => {
              reset();
              setShareProgress(value);
            }}
            testID="feed-comparison-opt-in"
          />
        </View>
        {shareProgress && <Text variant="bodyS">{t('feed.compareHint')}</Text>}
      </View>
      {!preferences.accepted && (
        <View style={styles.stack}>
          <Text variant="label">{t('feed.rulesTitle')}</Text>
          <Text variant="bodyS">{t('feed.rules')}</Text>
          <Button
            variant="tertiary"
            label={t('feed.reviewRules')}
            onPress={() => {
              void Linking.openURL('https://app.calipartner.site/terms').catch((error) =>
                setMessage(feedErrorMessage(error)),
              );
            }}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={t('feed.accept')}
            accessibilityState={{ checked: accept, disabled: busy }}
            disabled={busy}
            onPress={() => setAccept(!accept)}
            style={[styles.action, styles.row]}
            testID="feed-create-accept"
          >
            <Text>{t('feed.accept')}</Text>
            <Switch value={accept} onValueChange={setAccept} disabled={busy} accessible={false} />
          </Pressable>
        </View>
      )}
      <Text variant="bodyS" color={colors.textMid}>
        {t('feed.moderation')}
      </Text>
      {!!message && (
        <Text accessibilityRole="alert" color={colors.danger}>
          {message}
        </Text>
      )}
      <Button
        label={t(busy ? 'feed.publishing' : 'feed.publish')}
        onPress={() => void publish()}
        disabled={busy || !mayPublish}
        testID="feed-publish"
      />
    </ScrollView>
  );
}
