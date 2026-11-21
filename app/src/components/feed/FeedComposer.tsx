import { useCallback, useRef, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { useRouter, type Href } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Button, controls, radius, space, Text, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { generateClientUuid } from '@/services/foodService';
import { feedApi, feedMaxBytes, getFeedMediaType, type FeedAudience } from '@/services/feedService';
import { t } from '@/i18n';
import {
  FeedAction,
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

  const handleSelectedAsset = (selected: ImagePicker.ImagePickerAsset) => {
    const mediaType = getFeedMediaType(
      selected.mimeType || selected.file?.type,
      selected.fileName || selected.file?.name || selected.uri.split('?')[0],
    );
    if (!mediaType) {
      setMessage(t('feed.unsupported'));
      return;
    }
    if ((selected.fileSize ?? selected.file?.size ?? 0) > feedMaxBytes) {
      setMessage(t('feed.tooLarge'));
      return;
    }
    reset();
    setAsset({ ...selected, mediaType });
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
      if (result.canceled || !result.assets[0]) return;
      handleSelectedAsset(result.assets[0]);
    } catch (err) {
      setMessage(feedErrorMessage(err));
    }
  };

  const takePhoto = async () => {
    if (saving.current) return;
    setMessage('');
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setMessage('Camera permission is required to capture photos or videos.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.85,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      });
      if (result.canceled || !result.assets[0]) return;
      handleSelectedAsset(result.assets[0]);
    } catch (err) {
      setMessage(feedErrorMessage(err));
    }
  };

  const mayPublish = !!(asset && (preferences?.accepted || accept));

  const publish = useCallback(async () => {
    if (!asset || !mayPublish || saving.current) return;
    saving.current = true;
    setBusy(true);
    setMessage('');
    try {
      if (!preferences?.accepted && !(await feedApi.accept())) throw new Error('FEED_UNCONFIRMED');
      const retrying = draft.current !== null;
      const id = draft.current ?? (draft.current = generateClientUuid());
      const effectiveDescription = (caption.trim() || 'Photo or video post').slice(0, 240);
      const result = await feedApi.publish({
        id,
        uri: asset.uri,
        file: asset.file,
        mediaType: asset.mediaType,
        caption: caption.trim(),
        description: effectiveDescription,
        audience,
        shareProgress,
        retrying,
      });
      router.dismissTo(('/feed/post/' + result.id) as Href);
    } catch (err) {
      setMessage(feedErrorMessage(err));
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }, [asset, audience, caption, mayPublish, preferences?.accepted, router, shareProgress]);

  if (!preferences && (loading || error))
    return <FeedStatus loading={loading} error={error} retry={reload} />;
  if (!preferences) return <FeedSignIn setup onSignIn={() => router.push('/onboarding')} />;

  return (
    <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
      {/* Dashed Media Box */}
      <View
        style={[
          customStyles.uploadCard,
          {
            backgroundColor: colors.s1,
            borderColor: colors.hairline,
          },
        ]}
      >
        {asset ? (
          <View style={customStyles.previewContainer}>
            {asset.mediaType.startsWith('image/') ? (
              <Image
                source={{ uri: asset.uri }}
                style={customStyles.previewImage}
                resizeMode="cover"
                accessibilityLabel={caption || 'Selected media'}
                accessible
              />
            ) : (
              <View style={[customStyles.videoPlaceholder, { backgroundColor: colors.s3 }]}>
                <Ionicons name="videocam" size={48} color={colors.apricot} />
                <Text variant="label" style={{ color: colors.textHi, marginTop: 8 }}>
                  {asset.fileName || asset.file?.name || t('feed.paused')}
                </Text>
              </View>
            )}
            <View style={customStyles.previewActions}>
              <Pressable
                style={[
                  customStyles.pillButton,
                  { backgroundColor: colors.bg0, borderColor: colors.hairline },
                ]}
                onPress={() => void choose()}
                disabled={busy}
                testID="feed-choose-media"
                accessibilityRole="button"
                accessibilityLabel={t('feed.replaceMedia')}
              >
                <Ionicons name="images-outline" size={16} color={colors.textHi} />
                <Text style={[customStyles.pillText, { color: colors.textHi }]}>
                  {t('feed.replaceMedia')}
                </Text>
              </Pressable>
              <Pressable
                style={[
                  customStyles.pillButton,
                  { backgroundColor: colors.bg0, borderColor: colors.hairline },
                ]}
                onPress={() => {
                  reset();
                  setAsset(null);
                }}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Remove media"
              >
                <Ionicons name="trash-outline" size={16} color={colors.danger} />
                <Text style={[customStyles.pillText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={customStyles.uploadEmptyContent}>
            {/* Circle camera icon */}
            <View style={[customStyles.iconCircle, { backgroundColor: colors.apricot }]}>
              <Ionicons name="camera" size={28} color={colors.onBrand} />
            </View>
            <Text style={[customStyles.uploadTitle, { color: colors.textHi }]}>
              Add photo or video
            </Text>
            <Text style={[customStyles.uploadSubtitle, { color: colors.textMid }]}>
              Max 10 MB · JPG, PNG, MP4
            </Text>

            {/* Pill buttons row */}
            <View style={customStyles.pillsRow}>
              <Pressable
                style={[
                  customStyles.pillButton,
                  { backgroundColor: colors.bg0, borderColor: colors.hairline },
                ]}
                onPress={() => void choose()}
                disabled={busy}
                testID="feed-choose-media"
                accessibilityRole="button"
                accessibilityLabel="Gallery"
              >
                <Ionicons name="images-outline" size={18} color={colors.textHi} />
                <Text style={[customStyles.pillText, { color: colors.textHi }]}>Gallery</Text>
              </Pressable>

              <Pressable
                style={[
                  customStyles.pillButton,
                  { backgroundColor: colors.bg0, borderColor: colors.hairline },
                ]}
                onPress={() => void takePhoto()}
                disabled={busy}
                testID="feed-take-photo"
                accessibilityRole="button"
                accessibilityLabel="Camera"
              >
                <Ionicons name="camera-outline" size={18} color={colors.textHi} />
                <Text style={[customStyles.pillText, { color: colors.textHi }]}>Camera</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>

      {/* Caption Card */}
      <View
        style={[
          customStyles.captionCard,
          {
            backgroundColor: colors.s1,
            borderColor: colors.hairline,
          },
        ]}
      >
        <TextInput
          style={[customStyles.captionInput, { color: colors.textHi }]}
          placeholder="Write a caption..."
          placeholderTextColor={colors.textOff}
          multiline
          value={caption}
          onChangeText={(value) => {
            reset();
            setCaption(value);
          }}
          maxLength={300}
          editable={!busy}
          testID="feed-caption"
        />
        <Text style={[customStyles.counterText, { color: colors.textMid }]}>
          {caption.length}/300
        </Text>
      </View>

      {/* Audience */}
      <View style={customStyles.section}>
        <Text variant="label" style={{ color: colors.textMid, marginBottom: 8 }}>
          {t('feed.audience')}
        </Text>
        <View style={customStyles.pillsRow}>
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
        <Text variant="bodyS" color={colors.textMid} style={{ marginTop: 6 }}>
          {t(audienceOptions[audience])}
        </Text>
        {!preferences.community && (
          <Text variant="bodyS" color={colors.textMid} style={{ marginTop: 2 }}>
            {t('feed.privateProfile')}
          </Text>
        )}
      </View>

      {/* Compare Progress Switch */}
      <View style={customStyles.compareCard}>
        <View style={customStyles.rowBetween}>
          <Text variant="label" style={{ color: colors.textHi, flex: 1 }}>
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
        {shareProgress && (
          <Text variant="bodyS" color={colors.textMid} style={{ marginTop: 4 }}>
            {t('feed.compareHint')}
          </Text>
        )}
      </View>

      {/* Terms and Guidelines if not accepted */}
      {!preferences.accepted && (
        <View style={styles.stack}>
          <Text variant="label">{t('feed.rulesTitle')}</Text>
          <Text variant="bodyS">{t('feed.rules')}</Text>
          <Button
            variant="tertiary"
            label={t('feed.reviewRules')}
            onPress={() => {
              void Linking.openURL('https://app.calipartner.site/terms').catch((err) =>
                setMessage(feedErrorMessage(err)),
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

      {/* Error alert */}
      {!!message && (
        <Text accessibilityRole="alert" color={colors.danger}>
          {message}
        </Text>
      )}

      {/* Bottom Publish Post Button */}
      <Pressable
        style={[
          customStyles.publishBtn,
          {
            backgroundColor: mayPublish && !busy ? colors.apricot : colors.s2,
            opacity: mayPublish && !busy ? 1 : 0.6,
          },
        ]}
        onPress={() => void publish()}
        disabled={busy || !mayPublish}
        testID="feed-publish"
        accessibilityRole="button"
        accessibilityLabel={t('feed.publish')}
      >
        <Text
          style={[
            customStyles.publishBtnText,
            { color: mayPublish && !busy ? colors.onBrand : colors.textMid },
          ]}
        >
          {t(busy ? 'feed.publishing' : 'feed.publish')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

const customStyles = StyleSheet.create({
  uploadCard: {
    width: '100%',
    borderRadius: radius.card,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    padding: space[4],
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadEmptyContent: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[3],
  },
  uploadTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: space[1],
  },
  uploadSubtitle: {
    fontSize: 13,
    marginBottom: space[3],
  },
  pillsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space[2],
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: controls.touch,
  },
  pillText: {
    fontSize: 14,
    fontWeight: '600',
  },
  previewContainer: {
    width: '100%',
    alignItems: 'center',
    gap: space[2],
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: radius.control,
  },
  videoPlaceholder: {
    width: '100%',
    height: 180,
    borderRadius: radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewActions: {
    flexDirection: 'row',
    gap: space[2],
  },
  captionCard: {
    width: '100%',
    borderRadius: radius.button,
    borderWidth: 1,
    padding: space[3],
    minHeight: 140,
    justifyContent: 'space-between',
  },
  captionInput: {
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counterText: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  section: {
    width: '100%',
  },
  compareCard: {
    width: '100%',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  publishBtn: {
    width: '100%',
    borderRadius: radius.full,
    paddingVertical: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
    minHeight: 52,
  },
  publishBtnText: {
    fontSize: 16,
    fontWeight: '700',
  },
});
