import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, onboardingLayout as layout, type as typography } from '@calipartner/ui';
import {
  ArrowRightIcon,
  CloseIcon,
  LockIcon,
  PlusIcon,
  Text as V1Text,
  borders,
  colors as v1Colors,
  fonts,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import { visualPrimitives } from '@calipartner/ui/tokens';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { ChatMediaPickerModal, type SelectedMediaItem } from './ChatMediaPickerModal';

export interface ChatComposerProps {
  reply?: { name: string; text: string | null } | null;
  onCancelReply?: () => void;
  mentionMembers?: { user_id: string; username: string; nickname: string }[];
  onTyping?: (typing: boolean) => void;
  onSend: (text?: string | null, attachments?: SelectedMediaItem[]) => Promise<void>;
  disabled?: boolean;
  allowMedia?: boolean;
  disabledReason?: string;
  placeholder?: string;
  prefillText?: string | null;
  onPrefillConsumed?: () => void;
  termsAccepted: boolean;
  onRequireTerms: () => void;
  testID?: string;
}

export function ChatComposer({
  mentionMembers = [],
  reply,
  onCancelReply,
  onSend,
  onTyping,
  disabled = false,
  allowMedia = true,
  disabledReason,
  placeholder,
  prefillText,
  onPrefillConsumed,
  termsAccepted,
  onRequireTerms,
  testID = 'chat-composer',
}: ChatComposerProps) {
  const [text, setText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);

  useEffect(() => {
    if (prefillText) {
      setText(prefillText);
      onPrefillConsumed?.();
    }
  }, [prefillText, onPrefillConsumed]);

  useEffect(() => {
    if (!allowMedia) setSelectedMedia([]);
  }, [allowMedia]);

  const tagQuery = /(?:^|\s)@([a-zA-Z0-9_.]*)$/.exec(text)?.[1] ?? '';
  const tagMembers = mentionMembers.filter((member) =>
    (member.username + ' ' + member.nickname)
      .toLocaleLowerCase()
      .includes(tagQuery.toLocaleLowerCase()),
  );

  const canSend = !disabled && !isSending && (text.trim().length > 0 || selectedMedia.length > 0);
  const remainingChars = 2000 - text.length;
  const isNearLimit = text.length > 1800;
  const isOverLimit = text.length > 2000;

  const handlePressAttach = () => {
    if (disabled || !allowMedia) return;
    if (selectedMedia.length >= 5) return;
    setShowPickerModal(true);
  };

  const handleRemoveMedia = (index: number) => {
    setSelectedMedia((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if (!canSend || isOverLimit) return;

    if (!termsAccepted) {
      onRequireTerms();
      return;
    }

    const trimmedText = text.trim();
    const mediaToSend = [...selectedMedia];

    setSendError(false);
    setIsSending(true);
    try {
      await onSend(trimmedText || null, mediaToSend.length > 0 ? mediaToSend : undefined);
      onTyping?.(false);
      setText('');
      setSelectedMedia([]);
    } catch {
      setSendError(true);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View style={styles.composerContainer} testID={testID}>
      {reply ? (
        <View style={styles.replyBanner} testID="chat-reply-draft">
          <View style={styles.replyTextCol}>
            <V1Text variant="meta" color="textLo">
              {t('aha.replying', { name: reply.name })}
            </V1Text>
            <V1Text variant="body" color="textHi">
              {reply.text || t('aha.attachment')}
            </V1Text>
          </View>
          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('aha.cancelReply')}
            iconOnly
            icon={<CloseIcon size={16} color={v1Colors.textHi} />}
            onPress={onCancelReply}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel={t('aha.cancelReply')}
            style={styles.cancelReplyBtn}
            testID="cancel-chat-reply"
          />
        </View>
      ) : null}

      {tagOpen && !disabled ? (
        <View testID="chat-tag-picker">
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: layout.touch * 4 }}>
            {tagMembers.map((member) => (
              <Button
                variant="secondary"
                fullWidth={false}
                label={member.nickname}
                key={member.user_id}
                onPress={() => {
                  setText((previous) =>
                    /(?:^|\s)@[a-zA-Z0-9_.]*$/.test(previous)
                      ? previous.replace(/(^|\s)@[a-zA-Z0-9_.]*$/, '$1@' + member.username + ' ')
                      : previous +
                        (previous && !/\s$/.test(previous) ? ' ' : '') +
                        '@' +
                        member.username +
                        ' ',
                  );
                  setTagOpen(false);
                  onTyping?.(true);
                }}
                accessibilityRole="button"
                accessibilityLabel={t('squadDesign.tag') + ': ' + member.nickname}
                style={{
                  minHeight: layout.touch,
                  justifyContent: 'center',
                  paddingHorizontal: spacing.sm,
                }}
                testID={`tag-member-${member.user_id}`}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {sendError ? (
        <V1Text variant="meta" color="danger" accessibilityRole="alert">
          {t('setup.sendMediaError')}
        </V1Text>
      ) : null}

      {disabled && Boolean(disabledReason) ? (
        <View style={styles.disabledNoticeWrap}>
          <LockIcon size={13} color={v1Colors.textLo} />
          <V1Text variant="meta" color="textLo">
            {disabledReason}
          </V1Text>
        </View>
      ) : null}

      {selectedMedia.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.previewsScroll}
          contentContainerStyle={styles.previewsContent}
        >
          {selectedMedia.map((item, idx) => (
            <View key={idx} style={styles.previewCard} testID={`composer-preview-${idx}`}>
              {item.mimeType.startsWith('video/') ? (
                <View style={styles.previewImage}>
                  <Ionicons name="play-circle-outline" size={32} color={v1Colors.textHi} />
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="cover" />
              )}
              <Button
                variant="tertiary"
                fullWidth={false}
                label="Remove photo"
                iconOnly
                icon={<Ionicons name="close" size={14} color={visualPrimitives.colors.white} />}
                onPress={() => handleRemoveMedia(idx)}
                style={styles.removeMediaBtn}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                testID={`btn-remove-media-${idx}`}
              />
            </View>
          ))}
          {selectedMedia.length < 5 ? (
            <Pressable
              onPress={handlePressAttach}
              style={styles.addMoreCard}
              accessibilityRole="button"
              accessibilityLabel="Add another photo"
              testID="btn-add-more-media"
            >
              <PlusIcon size={18} color={v1Colors.apricot} />
              <V1Text variant="micro" color="apricot">
                {selectedMedia.length}/5
              </V1Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      <View style={styles.inputBarRow}>
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t(allowMedia ? 'repairs.chooseMedia' : 'setup.mediaPro')}
          iconOnly
          icon={
            <PlusIcon
              size={18}
              color={selectedMedia.length >= 5 || !allowMedia ? v1Colors.textOff : v1Colors.textHi}
            />
          }
          onPress={handlePressAttach}
          disabled={disabled || !allowMedia || selectedMedia.length >= 5}
          style={[
            styles.iconBtn,
            disabled || !allowMedia || selectedMedia.length >= 5 ? styles.btnDisabled : null,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(allowMedia ? 'repairs.chooseMedia' : 'setup.mediaPro')}
          testID="btn-chat-attach-photo"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        />

        <View style={styles.inputWrapper}>
          <TextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              setTagOpen(/(?:^|\s)@[a-zA-Z0-9_.]*$/.test(value));
              onTyping?.(Boolean(value.trim()));
            }}
            onBlur={() => onTyping?.(false)}
            placeholder={placeholder ?? t('chat.placeholder')}
            placeholderTextColor={v1Colors.textLo}
            editable={!disabled && !isSending}
            multiline
            maxLength={2050}
            style={styles.textInput}
            accessibilityLabel="Chat message input"
            testID="input-chat-message"
          />

          {isNearLimit ? (
            <V1Text
              variant="micro"
              color={isOverLimit ? 'danger' : 'textLo'}
              style={styles.charLimitText}
              testID="text-chat-char-limit"
            >
              {remainingChars}
            </V1Text>
          ) : null}
        </View>

        <Pressable
          onPress={handleSend}
          disabled={!canSend || isOverLimit}
          style={[
            styles.sendBtn,
            {
              backgroundColor: canSend && !isOverLimit ? v1Colors.apricot : v1Colors.s2,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.sendBtn')}
          testID="btn-chat-send"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={v1Colors.onBrand} />
          ) : (
            <ArrowRightIcon
              size={18}
              color={canSend && !isOverLimit ? v1Colors.onBrand : v1Colors.textLo}
            />
          )}
        </Pressable>
      </View>

      <ChatMediaPickerModal
        visible={showPickerModal}
        onClose={() => setShowPickerModal(false)}
        onSelectMedia={(newItems) => {
          setSelectedMedia((prev) => [...prev, ...newItems].slice(0, 5));
        }}
        currentCount={selectedMedia.length}
        maxCount={5}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  composerContainer: {
    paddingHorizontal: v1Space.lg,
    paddingTop: v1Space.sm,
    paddingBottom: v1Space.sm,
    backgroundColor: v1Colors.bg0,
    borderTopWidth: borders.width,
    borderTopColor: v1Colors.hairline,
    gap: v1Space.xs,
  },
  replyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: v1Space.sm,
    borderRadius: v1Radius.chip,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
  },
  replyTextCol: {
    flex: 1,
  },
  cancelReplyBtn: {
    minHeight: layout.touch,
    minWidth: layout.touch,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabledNoticeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: v1Space.md,
    paddingVertical: v1Space.xs + 2,
    borderRadius: v1Radius.chip,
    backgroundColor: v1Colors.s1,
    gap: 6,
  },
  previewsScroll: {
    maxHeight: 70,
  },
  previewsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: 2,
  },
  previewCard: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    overflow: 'hidden',
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  removeMediaBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    backgroundColor: v1Colors.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreCard: {
    width: 60,
    height: 60,
    borderRadius: v1Radius.chip,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: v1Colors.hairlineLit,
    backgroundColor: v1Colors.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s2,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
  },
  btnDisabled: {
    opacity: 0.45,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.s1,
    borderWidth: borders.width,
    borderColor: v1Colors.hairline,
    paddingHorizontal: v1Space.lg,
    paddingVertical: 6,
    minHeight: 42,
    maxHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: v1Colors.textHi,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 22,
    textAlignVertical: 'center',
  },
  charLimitText: {
    marginLeft: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: v1Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

void typography;
