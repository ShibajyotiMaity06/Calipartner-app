import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Platform, ScrollView, Share, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { Ionicons } from '@expo/vector-icons';
import { Button, controls, Sheet, Text, useTheme } from '@calipartner/ui';
import { useBrowserModalBack, closeBrowserModalsThen } from '@/hooks/useBrowserModalBack';
import { generateClientUuid } from '@/services/foodService';
import { feedApi, type FeedComment, type FeedPost } from '@/services/feedService';
import { feedPostLink } from '@/services/feedLinks';
import { t } from '@/i18n';
import {
  FeedAction,
  FeedIdentity,
  FeedInput,
  FeedStatus,
  feedErrorMessage,
  feedName,
  localFeedDate,
  styles,
  useFeedResource,
} from './FeedPrimitives';

export type PostAction = 'comments' | 'share' | 'compare' | 'options';

function FeedSheet({
  title,
  close,
  titleId,
  children,
}: {
  title: string;
  close: () => void;
  titleId: string;
  children: ReactNode;
}) {
  useBrowserModalBack(true, close);
  return (
    <Sheet visible onClose={close} snapPoint="tall" accessibilityLabel={title} testID={titleId}>
      <View style={styles.header}>
        <Text variant="title2" accessibilityRole="header" style={styles.grow}>
          {title}
        </Text>
        <FeedAction
          icon="close"
          label={t('homeRefresh.close')}
          onPress={close}
          testID="feed-sheet-close"
        />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.page}>
        {children}
      </ScrollView>
    </Sheet>
  );
}

export function PostActions({
  action,
  post,
  owner,
  close,
  changed,
}: {
  action: PostAction;
  post: FeedPost;
  owner: string;
  close: () => void;
  changed: () => void;
}) {
  const titles = {
    comments: 'feed.comments',
    share: 'feed.share',
    compare: 'feed.compare',
    options: 'feed.menu',
  } as const;
  return (
    <FeedSheet title={t(titles[action])} close={close} titleId={'feed-sheet-' + action}>
      {action === 'comments' && <Comments post={post} owner={owner} changed={changed} />}
      {action === 'compare' && <Compare post={post} close={close} />}
      {action === 'share' && <SharePost post={post} />}
      {action === 'options' && (
        <Moderate post={post} owner={owner} close={close} changed={changed} />
      )}
    </FeedSheet>
  );
}

function Compare({ post, close }: { post: FeedPost; close: () => void }) {
  const router = useRouter();
  const load = useCallback(() => feedApi.compare(post.id), [post.id]);
  const { data, loading, error, reload } = useFeedResource(load);
  const { colors } = useTheme();
  const routed = useRef(false);
  useEffect(() => {
    if (data?.status !== 'locked' || routed.current) return;
    routed.current = true;
    close();
    closeBrowserModalsThen(() => router.push({ pathname: '/paywall', params: { tier: 'plus' } }));
  }, [close, data?.status, router]);
  if (!data) return <FeedStatus loading={loading} error={error} retry={reload} />;
  if (data.status === 'locked') return <FeedStatus loading />;
  if (data.status !== 'ready') return <Text>{t('feed.compareHidden')}</Text>;
  return (
    <>
      <Text variant="bodyS">{t('feed.compareDate', { date: localFeedDate(data.date, true) })}</Text>
      <View style={styles.wrap}>
        {[
          { label: t('feed.you'), value: data.you, color: colors.iris },
          { label: feedName(post.author), value: data.author, color: colors.teal },
        ].map(({ label, value, color }, index) => (
          <View key={index} style={styles.grow}>
            <Text variant="label" color={color}>
              {label}
            </Text>
            {value === null ? (
              <View style={styles.row}>
                <Ionicons
                  name="lock-closed-outline"
                  size={controls.icon}
                  color={colors.textMid}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                />
                <Text variant="bodyS" style={styles.grow}>
                  {t('feed.noGoal')}
                </Text>
              </View>
            ) : (
              <Text variant="numeralM" tabular>
                {t('feed.progressValue', { value })}
              </Text>
            )}
          </View>
        ))}
      </View>
    </>
  );
}

function Comments({
  post,
  owner,
  changed,
}: {
  post: FeedPost;
  owner: string;
  changed: () => void;
}) {
  const load = useCallback(
    () => Promise.all([feedApi.comments(post.id), feedApi.preferences()]),
    [post.id],
  );
  const { data, loading, error, reload, setData } = useFeedResource(load);
  const [more, setMore] = useState(true);
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [accept, setAccept] = useState(false);
  const [message, setMessage] = useState('');
  const [selected, setSelected] = useState<FeedComment | null>(null);
  const mutation = useRef<string | null>(null);
  const working = useRef(false);
  const run = async (action: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setMessage('');
    try {
      await action();
    } catch (error) {
      setMessage(feedErrorMessage(error));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };
  if (!data) return <FeedStatus loading={loading} error={error} retry={reload} />;
  const [comments, preferences] = data;
  const send = () =>
    run(async () => {
      if (!body.trim() || (!preferences?.accepted && !accept)) return;
      if (!preferences?.accepted && !(await feedApi.accept())) throw new Error('FEED_UNCONFIRMED');
      const id = mutation.current ?? (mutation.current = generateClientUuid());
      await feedApi.comment(post.id, id, body.trim());
      setBody('');
      mutation.current = null;
      setMore(true);
      changed();
      void reload();
    });
  const loadMore = () =>
    run(async () => {
      const rows = await feedApi.comments(post.id, comments.at(-1));
      setData([comments.concat(rows), preferences]);
      setMore(rows.length >= 25);
    });
  if (selected)
    return (
      <Moderate
        post={post}
        comment={selected}
        owner={owner}
        close={() => setSelected(null)}
        changed={() => {
          setSelected(null);
          setMore(true);
          changed();
          void reload();
        }}
      />
    );
  return (
    <>
      {preferences && (
        <>
          <FeedInput
            label={t('feed.comment')}
            value={body}
            onChange={(text) => {
              mutation.current = null;
              setBody(text);
            }}
            limit={500}
            testID="feed-comment-input"
            disabled={busy}
          />
          {!preferences.accepted && (
            <>
              <Text variant="bodyS">{t('feed.rules')}</Text>
              <FeedAction
                icon={accept ? 'checkbox-outline' : 'square-outline'}
                selected={accept}
                label={t('feed.accept')}
                text={t('feed.accept')}
                testID="feed-comment-accept"
                disabled={busy}
                onPress={() => setAccept(!accept)}
              />
            </>
          )}
          <Button
            label={t('feed.sendComment')}
            disabled={busy || !body.trim() || (!preferences.accepted && !accept)}
            onPress={() => void send()}
            testID="feed-comment-send"
          />
        </>
      )}
      {!!message && <Text accessibilityRole="alert">{message}</Text>}
      {!comments.length && <Text variant="bodyS">{t('feed.noComments')}</Text>}
      {comments.map((comment) => (
        <View key={comment.id} style={styles.stack}>
          <View style={styles.row}>
            <FeedIdentity person={comment.author} />
            <FeedAction
              icon="ellipsis-horizontal"
              label={t('feed.commentMenu')}
              onPress={() => setSelected(comment)}
              testID="feed-comment-options"
            />
          </View>
          <Text>{comment.body}</Text>
        </View>
      ))}
      {comments.length >= 25 && more && (
        <Button
          variant="secondary"
          label={t('feed.loadMore')}
          disabled={busy}
          onPress={() => void loadMore()}
          testID="feed-comments-more"
        />
      )}
    </>
  );
}

function SharePost({ post }: { post: FeedPost }) {
  const load = useCallback(() => feedApi.targets(post.id), [post.id]);
  const { data, loading, error, reload } = useFeedResource(load);
  const [pending, setPending] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const attempts = useRef(new Map<string, string>());
  const working = useRef(false);
  const link = feedPostLink(post.id);
  const send = async (id: string, name: string, squad: boolean) => {
    if (working.current) return;
    working.current = true;
    const key = String(squad) + id;
    const requestId = attempts.current.get(key) ?? generateClientUuid();
    attempts.current.set(key, requestId);
    setPending(key);
    setNote('');
    setProblem('');
    try {
      await feedApi.share(post.id, requestId, id, squad);
      setNote(t('feed.sharedSuccess', { name }));
    } catch (error) {
      setProblem(feedErrorMessage(error));
    } finally {
      working.current = false;
      setPending(null);
    }
  };
  const copy = async () => {
    setProblem('');
    try {
      if (!(await Clipboard.setStringAsync(link))) throw new Error('COPY_FAILED');
      setNote(t('feed.copied'));
    } catch (error) {
      setProblem(feedErrorMessage(error));
    }
  };
  const shareLink = async () => {
    setProblem('');
    try {
      if (Platform.OS === 'web') {
        const navigator = globalThis.navigator as Navigator & {
          share?: (data: { url: string }) => Promise<void>;
        };
        if (!navigator?.share) {
          await copy();
          return;
        }
        await navigator.share({ url: link });
      } else await Share.share({ message: link });
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError'))
        setProblem(t('feed.shareFailed'));
    }
  };
  return (
    <>
      <View style={styles.wrap}>
        <FeedAction
          icon="link-outline"
          label={t('feed.copyLink')}
          text={t('feed.copyLink')}
          onPress={() => void copy()}
          testID="feed-copy-link"
        />
        <FeedAction
          icon="share-outline"
          label={t('feed.shareLink')}
          text={t('feed.shareLink')}
          onPress={() => void shareLink()}
          testID="feed-share-link"
        />
      </View>
      <Text variant="bodyS">{t('feed.linkAccess')}</Text>
      {!!note && <Text accessibilityLiveRegion="polite">{note}</Text>}
      {!!problem && <Text accessibilityRole="alert">{problem}</Text>}
      {!data ? (
        <FeedStatus loading={loading} error={error} retry={reload} />
      ) : (
        <>
          {data.people.length > 0 && <Text variant="label">{t('feed.sharePeople')}</Text>}
          {data.people.map((person) => (
            <View key={person.id} style={styles.row}>
              <FeedIdentity person={person} />
              <FeedAction
                icon="paper-plane-outline"
                label={t('feed.shareTo', { name: feedName(person) })}
                onPress={() => void send(person.id, feedName(person), false)}
                disabled={pending !== null}
                testID="feed-share-person"
              />
            </View>
          ))}
          {data.squads.length > 0 && <Text variant="label">{t('feed.shareSquads')}</Text>}
          {data.squads.map((squad) => (
            <View key={squad.id} style={styles.row}>
              <Text style={styles.grow}>{squad.name}</Text>
              <FeedAction
                icon="paper-plane-outline"
                label={t('feed.shareTo', { name: squad.name })}
                onPress={() => void send(squad.id, squad.name, true)}
                disabled={pending !== null}
                testID="feed-share-squad"
              />
            </View>
          ))}
          {!data.people.length && !data.squads.length && (
            <Text variant="bodyS">{t('feed.shareNone')}</Text>
          )}
        </>
      )}
    </>
  );
}

const reasons = ['inappropriate', 'harassment', 'spam'] as const;
type ModerationTarget = { post: FeedPost; comment?: FeedComment } | { person: FeedPost['author'] };

function Moderate({
  owner,
  close,
  changed,
  ...target
}: ModerationTarget & {
  owner: string;
  close: () => void;
  changed: () => void;
}) {
  const post = 'post' in target ? target.post : undefined;
  const comment = 'post' in target ? target.comment : undefined;
  const person = 'person' in target ? target.person : (comment?.author ?? post!.author);
  const own = person.id === owner;
  const [mode, setMode] = useState<
    'menu' | 'drop' | 'report' | 'user-report' | 'block' | 'reported'
  >('menu');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const report = useRef(generateClientUuid());
  const working = useRef(false);
  const run = async (fn: () => Promise<void>) => {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (error) {
      setError(feedErrorMessage(error));
    } finally {
      working.current = false;
      setBusy(false);
    }
  };

  return (
    <>
      {!!error && <Text accessibilityRole="alert">{error}</Text>}
      {mode === 'menu' &&
        (own ? (
          <Button
            variant="destructive"
            label={t(comment ? 'feed.deleteComment' : 'feed.deletePost')}
            testID="feed-delete"
            onPress={() => setMode('drop')}
          />
        ) : (
          <>
            {post && (
              <Button
                variant="secondary"
                label={t(comment ? 'feed.reportComment' : 'feed.reportPost')}
                testID="feed-report-content"
                onPress={() => setMode('report')}
              />
            )}
            <Button
              variant="secondary"
              label={t('feed.reportPerson')}
              testID="feed-report-user"
              onPress={() => setMode('user-report')}
            />
            <Button
              variant="destructive"
              label={t('feed.blockPerson')}
              testID="feed-block-user"
              onPress={() => setMode('block')}
            />
          </>
        ))}
      {mode === 'drop' && post && (
        <>
          <Text>{t('feed.confirmDelete')}</Text>
          <Button
            variant="destructive"
            label={t(comment ? 'feed.deleteComment' : 'feed.deletePost')}
            testID="feed-confirm-delete"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                if (comment) await feedApi.removeComment(comment.id);
                else await feedApi.remove(post.id);
                close();
                changed();
              })
            }
          />
        </>
      )}
      {mode === 'block' && (
        <>
          <Text>{t('feed.confirmBlock', { name: feedName(person) })}</Text>
          <Button
            variant="destructive"
            label={t('feed.blockPerson')}
            testID="feed-confirm-block"
            disabled={busy}
            onPress={() =>
              void run(async () => {
                await feedApi.block(owner, person.id);
                close();
                changed();
              })
            }
          />
        </>
      )}
      {(mode === 'report' || mode === 'user-report') &&
        reasons.map((reason) => (
          <Button
            key={reason}
            variant="secondary"
            label={t(`feed.${reason}`)}
            testID={'feed-report-' + reason}
            disabled={busy}
            onPress={() =>
              void run(async () => {
                const accepted =
                  mode === 'report' && post
                    ? await feedApi.report(post.id, report.current, reason, comment?.id)
                    : (await feedApi.reportUser(owner, report.current, person.id, reason))
                        ?.status === 'reported';
                if (!accepted) throw new Error('FEED_UNCONFIRMED');
                setMode('reported');
              })
            }
          />
        ))}
      {mode === 'reported' && (
        <Text accessibilityLiveRegion="polite">{t('feed.reportSuccess')}</Text>
      )}
      {mode !== 'reported' && (
        <Button variant="tertiary" label={t('homeRefresh.close')} onPress={close} disabled={busy} />
      )}
    </>
  );
}

export function FeedProfileOptions({
  person,
  owner,
  close,
  changed,
}: {
  person: FeedPost['author'];
  owner: string;
  close: () => void;
  changed: () => void;
}) {
  return (
    <FeedSheet title={t('feed.profileMenu')} close={close} titleId="feed-profile-options-sheet">
      <Moderate person={person} owner={owner} close={close} changed={changed} />
    </FeedSheet>
  );
}
