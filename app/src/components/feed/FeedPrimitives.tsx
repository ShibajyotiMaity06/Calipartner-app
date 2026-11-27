import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Image, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Button, controls, feedLayout, radius, space, Text, useTheme } from '@calipartner/ui';
import { LoadingState } from '@/components/LoadingState';
import { t, type TranslationKey } from '@/i18n';
import { feedApi, type FeedPerson, type FeedPost } from '@/services/feedService';

export const feedName = (person: FeedPerson) =>
  person.nickname || person.username || t('feed.person');

export function feedErrorMessage(error: unknown) {
  const messages: Record<string, TranslationKey> = {
    FEED_UNAVAILABLE: 'feed.denied',
    FEED_TOO_LARGE: 'feed.tooLarge',
    FEED_UNSUPPORTED_MEDIA: 'feed.unsupported',
    FEED_CONTENT_REJECTED: 'feed.rejected',
    FEED_MODERATION_UNAVAILABLE: 'feed.moderationUnavailable',
    FEED_LIMIT: 'feed.limit',
    RATE_LIMITED: 'feed.limit',
    FEED_PRIVATE_PROFILE: 'feed.privateProfile',
    FEED_DRAFT_CHANGED: 'feed.draftChanged',
  };
  return t((error instanceof Error && messages[error.message]) || 'feed.saveError');
}

export function useFeedResource<T>(load: () => Promise<T>) {
  const sequence = useRef(0);
  const [data, setData] = useState<T>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const request = ++sequence.current;
    setLoading(true);
    setError(undefined);
    try {
      const result = await load();
      if (sequence.current === request) setData(result);
    } catch (error) {
      if (sequence.current === request) {
        setData(undefined);
        setError(error);
      }
    } finally {
      if (sequence.current === request) setLoading(false);
    }
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      void reload();
      return () => {
        sequence.current++;
      };
    }, [reload]),
  );
  return { data, error, loading, reload, setData };
}

export function FeedScreen({
  title,
  back,
  onSettings,
  children,
  testID,
}: {
  title: string;
  back?: () => void;
  onSettings?: () => void;
  children: ReactNode;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[styles.screen, { backgroundColor: colors.bg0 }]}
      testID={testID}
    >
      <View style={styles.header}>
        {back && (
          <FeedAction
            icon="arrow-back"
            label={t('squadDesign.back')}
            onPress={back}
            testID="feed-back"
          />
        )}
        <Text variant="title1" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        {onSettings ? (
          <FeedAction
            icon="settings-outline"
            label={t('settingsV1.openSettings')}
            onPress={onSettings}
            testID="btn-feed-settings"
          />
        ) : null}
      </View>
      {children}
    </SafeAreaView>
  );
}

export function FeedSignIn({ onSignIn, setup }: { onSignIn: () => void; setup?: boolean }) {
  return (
    <View style={styles.status}>
      <Text variant="title2">{t(setup ? 'feed.setupTitle' : 'feed.signInTitle')}</Text>
      {!setup && <Text>{t('feed.signInBody')}</Text>}
      <Button
        label={t(setup ? 'feed.setup' : 'feed.signIn')}
        onPress={onSignIn}
        testID="feed-sign-in"
      />
    </View>
  );
}

export function FeedStatus({
  loading,
  error,
  retry,
  empty,
}: {
  loading?: boolean;
  error?: unknown;
  retry?: () => void;
  empty?: string;
}) {
  if (loading) return <LoadingState />;
  return (
    <View style={styles.status}>
      <Text variant="bodyS" accessibilityRole={error ? 'alert' : undefined}>
        {error ? feedErrorMessage(error) : empty}
      </Text>
      {!!error && retry && (
        <Button variant="secondary" label={t('common.retry')} onPress={retry} testID="feed-retry" />
      )}
    </View>
  );
}

export function FeedAction({
  icon,
  label,
  text,
  onPress,
  testID,
  selected,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap | 'utensils';
  label: string;
  text?: string;
  onPress: () => void;
  testID: string;
  selected?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const ink = selected ? colors.apricot : colors.textHi;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected, disabled }}
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.s3 }]}
    >
      {icon === 'utensils' ? (
        <Svg
          width={controls.icon}
          height={controls.icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke={ink}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d="M3 3v5a3.5 3.5 0 0 0 7 0V3M6.5 3v18M17.5 13v8M21 8c0 3-1.6 5-3.5 5S14 11 14 8s1.6-5 3.5-5S21 5 21 8Z" />
        </Svg>
      ) : (
        <Ionicons name={icon} size={controls.icon} color={ink} />
      )}
      {text !== undefined && (
        <Text variant="label" tabular color={ink}>
          {text}
        </Text>
      )}
    </Pressable>
  );
}

export function FeedIdentity({ person, onPress }: { person: FeedPerson; onPress?: () => void }) {
  const { colors } = useTheme();
  const name = feedName(person);
  const body = (
    <>
      <View
        style={[styles.person, { backgroundColor: colors.s3 }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text variant="label" maxFontSizeMultiplier={1.5}>
          {Array.from(name)[0]?.toLocaleUpperCase()}
        </Text>
      </View>
      <View style={styles.grow}>
        <Text variant="label">{name}</Text>
        {person.username && person.username !== name && (
          <Text variant="bodyS" color={colors.textMid}>
            @{person.username}
          </Text>
        )}
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      style={styles.identity}
      accessibilityRole="button"
      accessibilityLabel={t('feed.openPerson', { name })}
      onPress={onPress}
      testID="feed-open-profile"
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.identity}>{body}</View>
  );
}

export function FeedInput({
  label,
  value,
  onChange,
  placeholder,
  limit,
  testID,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  limit: number;
  testID: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        maxLength={limit}
        multiline
        editable={!disabled}
        placeholder={placeholder}
        placeholderTextColor={colors.textMid}
        style={[
          styles.input,
          { color: colors.textHi, backgroundColor: colors.s2, borderColor: colors.hairlineLit },
        ]}
        testID={testID}
      />
    </View>
  );
}

function FeedVideo({
  uri,
  description,
  onError,
}: {
  uri: string;
  description: string;
  onError: () => void;
}) {
  const player = useVideoPlayer(uri, (video) => {
    video.muted = true;
    video.play();
  });
  useFocusEffect(
    useCallback(() => {
      return () => {
        try {
          player.pause();
        } catch {
          /* The player may already be released. */
        }
      };
    }, [player]),
  );
  useFocusEffect(
    useCallback(() => {
      const subscription = player.addListener('statusChange', ({ status }) => {
        if (status === 'error') onError();
      });
      return () => subscription.remove();
    }, [onError, player]),
  );
  return (
    <VideoView
      player={player}
      style={styles.media}
      accessibilityLabel={description}
      contentFit="contain"
      nativeControls
      fullscreenOptions={{ enable: true }}
      playsInline
    />
  );
}

export function FeedMedia({ post }: { post: FeedPost }) {
  const { colors } = useTheme();
  const isVideo = post.media_type.startsWith('video/');
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const load = useCallback(
    () => (playing || !isVideo ? feedApi.media(post.id) : Promise.resolve(null)),
    [isVideo, playing, post.id],
  );
  const { data, error, loading, reload } = useFeedResource(load);
  const uri = data?.url;
  const fail = useCallback(() => setFailed(true), []);
  return (
    <View style={[styles.media, styles.mediaBox, { backgroundColor: colors.s2 }]}>
      {error || failed ? (
        <View style={styles.mediaNotice}>
          <Text variant="bodyS" accessibilityRole="alert">
            {t('feed.mediaError')}
          </Text>
          <Button
            variant="tertiary"
            label={t('common.retry')}
            fullWidth={false}
            onPress={() => {
              setFailed(false);
              void reload();
            }}
            testID="feed-media-retry"
          />
        </View>
      ) : isVideo && !playing ? (
        <View style={styles.mediaNotice}>
          <FeedAction
            icon="play-circle-outline"
            label={t('feed.showVideo')}
            text={t('feed.showVideo')}
            testID="feed-video-play"
            onPress={() => setPlaying(true)}
          />
        </View>
      ) : loading && !uri ? (
        <Text variant="bodyS" accessibilityRole="progressbar">
          {t('common.loading')}
        </Text>
      ) : uri && isVideo ? (
        <FeedVideo key={uri} uri={uri} description={post.description} onError={fail} />
      ) : uri ? (
        <Image
          key={uri}
          source={{ uri }}
          accessibilityLabel={post.description}
          accessible
          resizeMode="contain"
          style={styles.media}
          onError={fail}
        />
      ) : null}
    </View>
  );
}

export function localFeedDate(value: string, dateOnly = false) {
  const date = new Date(dateOnly ? value + 'T00:00:00Z' : value);
  return new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    ...(dateOnly ? { timeZone: 'UTC' } : {}),
  }).format(date);
}

export function useFeedBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/(tabs)/feed' as Href));
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  grow: { flex: 1 },
  header: {
    width: '100%',
    maxWidth: feedLayout.maxWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    paddingHorizontal: space[4],
    paddingVertical: space[3],
  },
  page: {
    width: '100%',
    maxWidth: feedLayout.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
  status: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: feedLayout.maxWidth,
    padding: space[4],
    gap: space[3],
  },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: controls.touch,
    minWidth: controls.touch,
    gap: space[1],
    paddingHorizontal: space[2],
    borderRadius: radius.control,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: controls.touch,
    gap: space[2],
  },
  person: {
    width: feedLayout.personSize,
    minHeight: feedLayout.personSize,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: { gap: space[2] },
  input: {
    minHeight: controls.touch,
    borderRadius: radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    padding: space[3],
    textAlignVertical: 'top',
  },
  media: { width: '100%', aspectRatio: feedLayout.mediaRatio },
  mediaBox: {
    borderRadius: radius.control,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mediaNotice: { padding: space[3], alignItems: 'center', gap: space[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  stack: { gap: space[3] },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth },
});
