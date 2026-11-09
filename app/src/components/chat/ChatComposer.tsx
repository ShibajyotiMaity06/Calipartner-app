import { type as inputTypography } from '@calipartner/ui';
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
import { Text, type as typography } from '@calipartner/ui';
import { onboardingLayout as layout } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
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
  termsAccepted,
  onRequireTerms,
  testID = 'chat-composer',
}: ChatComposerProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [selectedMedia, setSelectedMedia] = useState<SelectedMediaItem[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [showPickerModal, setShowPickerModal] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [tagOpen, setTagOpen] = useState(false);
  const tagQuery = /(?:^|\s)@([a-zA-Z0-9_.]*)$/.exec(text)?.[1] ?? '';
  const tagMembers = mentionMembers.filter((member) =>
    (member.username + ' ' + member.nickname)
      .toLocaleLowerCase()
      .includes(tagQuery.toLocaleLowerCase()),
  );

  useEffect(() => {
    if (!allowMedia) setSelectedMedia([]);
  }, [allowMedia]);
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
    <View
      style={[styles.composerContainer, { backgroundColor: colors.background }]}
      testID={testID}
    >
      {reply && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            padding: spacing.sm,
            backgroundColor: colors.surfaceAlt,
          }}
          testID="chat-reply-draft"
        >
          <View style={{ flex: 1 }}>
            <Text>{t('aha.replying', { name: reply.name })}</Text>
            <Text numberOfLines={2}>{reply.text || t('aha.attachment')}</Text>
          </View>
          <Pressable
            onPress={onCancelReply}
            disabled={isSending}
            accessibilityRole="button"
            accessibilityLabel={t('aha.cancelReply')}
            style={{
              minHeight: layout.touch,
              minWidth: layout.touch,
              alignItems: 'center',
              justifyContent: 'center',
            }}
            testID="cancel-chat-reply"
          >
            <Ionicons name="close" size={layout.icon} color={colors.text} />
          </Pressable>
        </View>
      )}
      {tagOpen && !disabled && (
        <View testID="chat-tag-picker">
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: layout.touch * 4 }}>
            {tagMembers.map((member) => (
              <Pressable
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
              >
                <Text>{member.nickname}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
      {sendError ? (
        <Text
          accessibilityRole="alert"
          style={[styles.disabledNoticeText, { color: colors.danger }]}
        >
          {t('setup.sendMediaError')}
        </Text>
      ) : null}
      {/* Disabled reason notice (e.g. read-only dormant room or paused locked room) */}
      {disabled && Boolean(disabledReason) && (
        <View style={[styles.disabledNoticeWrap, { backgroundColor: colors.surfaceAlt }]}>
          <Ionicons name="lock-closed-outline" size={14} color={colors.textMuted} />
          <Text style={[styles.disabledNoticeText, { color: colors.textMuted }]}>
            {disabledReason}
          </Text>
        </View>
      )}

      {/* Selected media preview strip */}
      {selectedMedia.length > 0 && (
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
                  <Ionicons name="play-circle-outline" size={32} color={colors.text} />
                </View>
              ) : (
                <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="cover" />
              )}
              <Pressable
                onPress={() => handleRemoveMedia(idx)}
                style={styles.removeMediaBtn}
                accessibilityRole="button"
                accessibilityLabel="Remove photo"
                testID={`btn-remove-media-${idx}`}
              >
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </Pressable>
            </View>
          ))}
          {selectedMedia.length < 5 && (
            <Pressable
              onPress={handlePressAttach}
              style={[
                styles.addMoreCard,
                { borderColor: colors.border, backgroundColor: colors.surfaceAlt },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Add another photo"
              testID="btn-add-more-media"
            >
              <Ionicons name="add" size={20} color={colors.accent} />
              <Text style={[styles.addMoreText, { color: colors.accent }]}>
                {selectedMedia.length}/5
              </Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {/* TextInput bar row */}
      <View style={styles.inputBarRow}>
        {/* Camera / Photo Button */}
        <Pressable
          onPress={handlePressAttach}
          disabled={disabled || !allowMedia || selectedMedia.length >= 5}
          style={[
            styles.iconBtn,
            (disabled || !allowMedia || selectedMedia.length >= 5) && styles.btnDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={t(allowMedia ? 'repairs.chooseMedia' : 'setup.mediaPro')}
          testID="btn-chat-attach-photo"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons
            name="attach-outline"
            size={22}
            color={selectedMedia.length >= 5 ? colors.textMuted : colors.accent}
          />
        </Pressable>

        {/* Text TextInput */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt }]}>
          <TextInput
            value={text}
            onChangeText={(value) => {
              setText(value);
              setTagOpen(/(?:^|\s)@[a-zA-Z0-9_.]*$/.test(value));
              onTyping?.(Boolean(value.trim()));
            }}
            onBlur={() => onTyping?.(false)}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            editable={!disabled && !isSending}
            multiline
            maxLength={2050}
            style={[
              [styles.textInput, { color: colors.text }],
              { fontFamily: inputTypography.body.fontFamily },
            ]}
            accessibilityLabel="Chat message input"
            testID="input-chat-message"
          />

          {/* Near character limit indicator */}
          {isNearLimit && (
            <Text
              style={[
                styles.charLimitText,
                { color: isOverLimit ? colors.danger : colors.textMuted },
              ]}
              testID="text-chat-char-limit"
            >
              {remainingChars}
            </Text>
          )}
        </View>

        {/* Send Button */}
        <Pressable
          onPress={handleSend}
          disabled={!canSend || isOverLimit}
          style={[
            styles.sendBtn,
            { backgroundColor: canSend && !isOverLimit ? colors.accent : colors.surfaceAlt },
          ]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.sendBtn')}
          testID="btn-chat-send"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={18}
              color={canSend && !isOverLimit ? colors.onAccent : colors.textMuted}
            />
          )}
        </Pressable>
      </View>

      {/* Media Picker Sheet Modal */}
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
    paddingHorizontal: spacing.sm,
    paddingTop: 4,
    paddingBottom: 6,
  },
  disabledNoticeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    gap: 6,
  },
  disabledNoticeText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  previewsScroll: {
    marginBottom: spacing.xs,
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreCard: {
    width: 60,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addMoreText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 3,
    minHeight: 38,
    maxHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    lineHeight: 18,
    paddingTop: 2,
    paddingBottom: 2,
    minHeight: 22,
    textAlignVertical: 'center',
  },
  charLimitText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
