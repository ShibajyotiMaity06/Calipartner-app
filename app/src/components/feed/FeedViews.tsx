import { useCallback, useRef, useState } from 'react';
import { FlatList, Linking, Platform, ScrollView, useWindowDimensions, View } from 'react-native';
import { useLocalSearchParams, useRouter, useScrollToTop, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, getTabBarHeight, space, TAB_BAR_INSET, Text, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';
import { t } from '@/i18n';
import { feedApi, type FeedPost } from '@/services/feedService';
import { isFeedId, rememberFeedPost } from '@/services/feedLinks';
import {
  FeedAction,
  FeedIdentity,
  FeedMedia,
  FeedScreen,
  FeedSignIn,
  FeedStatus,
  feedErrorMessage,
  localFeedDate,
  styles,
  useFeedBack,
  useFeedResource,
} from './FeedPrimitives';
import { FeedProfileOptions, PostActions, type PostAction } from './FeedActions';

export function FeedTab() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [shared, setShared] = useState(false);
  return (
    <FeedScreen
      title={t('feed.title')}
      onSettings={() => router.push('/settings' as Href)}
      testID="screen-feed"
    >
      {isLoading ? (
        <FeedStatus loading />
      ) : !user ? (
        <FeedSignIn onSignIn={() => router.push('/auth/sign-in?mode=signin')} />
      ) : (
        <>
          <View style={[styles.header, styles.wrap]}>
            <FeedAction
              icon="globe-outline"
              label={t('feed.all')}
              text={t('feed.all')}
              selected={!shared}
              onPress={() => setShared(false)}
              testID="feed-all"
            />
            <FeedAction
              icon="paper-plane-outline"
              label={t('feed.shared')}
              text={t('feed.shared')}
              selected={shared}
              onPress={() => setShared(true)}
              testID="feed-shared"
            />
          </View>
          <FeedList key={user.id + String(shared)} owner={user.id} shared={shared} />
        </>
      )}
    </FeedScreen>
  );
}

function FeedList({
  owner,
  author,
  shared,
  profile,
}: {
  owner: string;
  author?: string;
  shared?: boolean;
  profile?: React.ReactElement;
}) {
  const load = useCallback(() => feedApi.list({ author, shared }), [author, shared]);
  const { data, loading, error, reload, setData } = useFeedResource(load);
  const [pageError, setPageError] = useState('');
  const [end, setEnd] = useState(false);
  const [paging, setPaging] = useState(false);
  const pageInFlight = useRef(false);
  const generation = useRef(0);
  const list = useRef<FlatList<FeedPost>>(null);
  useScrollToTop(list);
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const refresh = () => {
    generation.current++;
    setPageError('');
    setEnd(false);
    void reload();
  };
  const loadMore = async () => {
    if (pageInFlight.current || loading || !data?.length) return;
    pageInFlight.current = true;
    const request = generation.current;
    setPaging(true);
    setPageError('');
    try {
      const page = await feedApi.list({ author, shared, before: data.at(-1) });
      if (request !== generation.current) return;
      setData((current) => (current ?? []).concat(page));
      setEnd(page.length < 15);
    } catch (error) {
      if (request === generation.current) setPageError(feedErrorMessage(error));
    } finally {
      pageInFlight.current = false;
      setPaging(false);
    }
  };

  return (
    <FlatList
      testID="feed-post-list"
      ref={list}
      data={data ?? []}
      keyExtractor={(post) => post.id}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[
        styles.page,
        {
          paddingBottom: author
            ? insets.bottom + space[6]
            : getTabBarHeight(fontScale) + TAB_BAR_INSET + insets.bottom + space[6],
        },
      ]}
      refreshing={loading && !!data}
      onRefresh={refresh}
      ListHeaderComponent={profile}
      ListEmptyComponent={
        <FeedStatus
          loading={loading}
          error={error}
          retry={refresh}
          empty={t(author ? 'feed.emptyProfile' : shared ? 'feed.emptyShared' : 'feed.empty')}
        />
      }
      ListFooterComponent={
        !end && (data?.length ?? 0) >= 15 ? (
          <View style={styles.stack}>
            {!!pageError && <Text accessibilityRole="alert">{pageError}</Text>}
            <Button
              variant="secondary"
              label={t('feed.loadMore')}
              disabled={paging || loading}
              onPress={() => void loadMore()}
              testID="feed-load-more"
            />
          </View>
        ) : null
      }
      renderItem={({ item }) => <PostCard post={item} owner={owner} changed={refresh} />}
    />
  );
}

function PostCard({
  post,
  owner,
  changed,
}: {
  post: FeedPost;
  owner: string;
  changed: () => void;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  const [action, setAction] = useState<PostAction | null>(null);
  const [ack, setAck] = useState<{ baseline: FeedPost; liked: boolean; likes: number } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const liked = ack?.baseline === post ? ack.liked : post.liked;
  const likes = ack?.baseline === post ? ack.likes : post.likes;
  const like = async () => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      const updated = await feedApi.like(post.id, !liked);
      if (updated?.id !== post.id || updated.liked !== !liked) throw new Error('FEED_UNCONFIRMED');
      setAck({ baseline: post, liked: updated.liked, likes: updated.likes });
    } catch (error) {
      setError(feedErrorMessage(error));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  return (
    <View
      style={[
        styles.stack,
        styles.divider,
        { borderColor: colors.hairlineLit, paddingBottom: space[3] },
      ]}
      testID="feed-post"
    >
      <View style={styles.row}>
        <FeedIdentity
          person={post.author}
          onPress={() => router.push(('/feed/profile/' + post.author.id) as Href)}
        />
        <FeedAction
          icon="ellipsis-horizontal"
          label={t('feed.menu')}
          onPress={() => setAction('options')}
          testID="feed-post-options"
        />
      </View>
      <FeedMedia post={post} />
      <View style={styles.wrap}>
        <FeedAction
          icon="utensils"
          label={
            t(liked ? 'feed.unlike' : 'feed.like') +
            ', ' +
            t(likes === 1 ? 'feed.oneLike' : 'feed.likeCount', { count: likes })
          }
          text={String(likes)}
          selected={liked}
          disabled={busy}
          onPress={() => void like()}
          testID="feed-like"
        />
        <FeedAction
          icon="chatbubble-outline"
          label={t(post.comments === 1 ? 'feed.oneComment' : 'feed.commentCount', {
            count: post.comments,
          })}
          text={String(post.comments)}
          onPress={() => setAction('comments')}
          testID="feed-comments"
        />
        <FeedAction
          icon="share-social-outline"
          label={t('feed.share')}
          onPress={() => setAction('share')}
          testID="feed-share"
        />
        {owner !== post.author.id && (
          <FeedAction
            icon="git-compare-outline"
            label={t('feed.compare')}
            text={t('feed.compare')}
            onPress={() => setAction('compare')}
            testID="feed-compare"
          />
        )}
      </View>
      {!!error && (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      )}
      {!!post.caption && <Text>{post.caption}</Text>}
      <Text variant="bodyS" color={colors.textMid}>
        {localFeedDate(post.published_at)}
      </Text>
      {action && (
        <PostActions
          key={action}
          action={action}
          post={post}
          owner={owner}
          close={() => setAction(null)}
          changed={changed}
        />
      )}
    </View>
  );
}

export function FeedPostScreen() {
  const { postId } = useLocalSearchParams<{ postId?: string }>();
  const { user, isLoading } = useAuth();
  const targets = useTargets();
  const router = useRouter();
  const back = useFeedBack();
  const [error, setError] = useState('');
  const signIn = async (setup = false) => {
    if (!isFeedId(postId)) return;
    try {
      await rememberFeedPost(postId);
      router.push(setup ? '/onboarding' : '/auth/sign-in?mode=signin');
    } catch (error) {
      setError(feedErrorMessage(error));
    }
  };
  return (
    <FeedScreen title={t('feed.post')} back={back} testID="screen-feed-post">
      {!isFeedId(postId) ? (
        <FeedStatus empty={t('feed.missing')} />
      ) : isLoading || (user && targets.loading) ? (
        <FeedStatus loading />
      ) : !user || !targets.currentGoalProfile ? (
        <>
          <FeedSignIn setup={!!user} onSignIn={() => void signIn(!!user)} />
          {Platform.OS === 'web' && !user && (
            <View style={styles.page}>
              <Button
                variant="tertiary"
                label={t('feed.openApp')}
                onPress={() => {
                  void Linking.openURL('calipartner://feed/post/' + postId).catch(() =>
                    setError(t('feed.openAppFailed')),
                  );
                }}
              />
            </View>
          )}
          {!!error && (
            <Text accessibilityRole="alert" style={styles.status}>
              {error}
            </Text>
          )}
        </>
      ) : (
        <PostDetail key={user.id + postId} owner={user.id} id={postId} />
      )}
    </FeedScreen>
  );
}

function PostDetail({ owner, id }: { owner: string; id: string }) {
  const load = useCallback(() => feedApi.post(id), [id]);
  const { data, loading, error, reload } = useFeedResource(load);
  if (!data)
    return <FeedStatus loading={loading} error={error} retry={reload} empty={t('feed.missing')} />;
  return (
    <ScrollView contentContainerStyle={styles.page}>
      <PostCard post={data} owner={owner} changed={() => void reload()} />
    </ScrollView>
  );
}

export function FeedProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const back = useFeedBack();
  return (
    <FeedScreen title={t('feed.profile')} back={back} testID="screen-feed-profile">
      {isLoading ? (
        <FeedStatus loading />
      ) : !user ? (
        <FeedSignIn onSignIn={() => router.push('/auth/sign-in?mode=signin')} />
      ) : isFeedId(userId) ? (
        <ProfileDetail key={user.id + userId} userId={userId} owner={user.id} />
      ) : (
        <FeedStatus empty={t('common.unavailable')} />
      )}
    </FeedScreen>
  );
}

function ProfileDetail({ userId, owner }: { userId: string; owner: string }) {
  const load = useCallback(() => feedApi.profile(userId), [userId]);
  const { data, loading, error, reload } = useFeedResource(load);
  const { colors } = useTheme();
  const router = useRouter();
  const [options, setOptions] = useState(false);
  if (!data)
    return (
      <FeedStatus loading={loading} error={error} retry={reload} empty={t('common.unavailable')} />
    );
  return (
    <>
      <FeedList
        owner={owner}
        author={userId}
        profile={
          <View
            style={[
              styles.stack,
              styles.divider,
              { borderColor: colors.hairlineLit, paddingBottom: space[3] },
            ]}
          >
            <View style={styles.row}>
              <FeedIdentity person={data} />
              {owner === userId ? (
                <FeedAction
                  icon="create-outline"
                  label={t('feed.editProfile')}
                  text={t('feed.editProfile')}
                  onPress={() => router.push('/profile/social')}
                  testID="feed-edit-bio"
                />
              ) : (
                <FeedAction
                  icon="ellipsis-horizontal"
                  label={t('feed.profileMenu')}
                  onPress={() => setOptions(true)}
                  testID="feed-profile-options"
                />
              )}
            </View>
            {!!data.bio && <Text>{data.bio}</Text>}
          </View>
        }
      />
      {options && (
        <FeedProfileOptions
          person={data}
          owner={owner}
          close={() => setOptions(false)}
          changed={() => void reload()}
        />
      )}
    </>
  );
}
