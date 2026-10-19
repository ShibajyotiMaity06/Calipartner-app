import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { ChatMediaPickerModal, type SelectedMediaItem } from './ChatMediaPickerModal';

export interface ChatComposerProps {
  onSend: (text?: string | null, attachments?: SelectedMediaItem[]) => Promise<void>;
  disabled?: boolean;
  disabledReason?: string;
  termsAccepted: boolean;
  onRequireTerms: () => void;
  testID?: string;
}

export function ChatComposer({
  onSend,
  disabled = false,
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

  const canSend = !disabled && !isSending && (text.trim().length > 0 || selectedMedia.length > 0);
  const remainingChars = 2000 - text.length;
  const isNearLimit = text.length > 1800;
  const isOverLimit = text.length > 2000;

  const handlePressAttach = () => {
    if (disabled) return;
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

    setIsSending(true);
    try {
      await onSend(trimmedText || null, mediaToSend.length > 0 ? mediaToSend : undefined);
      setText('');
      setSelectedMedia([]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <View
      style={[
        styles.composerContainer,
        { backgroundColor: colors.surface, borderTopColor: colors.border },
      ]}
      testID={testID}
    >
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
              <Image source={{ uri: item.uri }} style={styles.previewImage} resizeMode="cover" />
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

      {/* Input bar row */}
      <View style={styles.inputBarRow}>
        {/* Camera / Photo Button */}
        <Pressable
          onPress={handlePressAttach}
          disabled={disabled || selectedMedia.length >= 5}
          style={[styles.iconBtn, (disabled || selectedMedia.length >= 5) && styles.btnDisabled]}
          accessibilityRole="button"
          accessibilityLabel={t('chat.attachPhoto')}
          testID="btn-chat-attach-photo"
        >
          <Ionicons
            name="camera-outline"
            size={24}
            color={selectedMedia.length >= 5 ? colors.textMuted : colors.accent}
          />
        </Pressable>

        {/* Text Input */}
        <View style={[styles.inputWrapper, { backgroundColor: colors.surfaceAlt }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={t('chat.placeholder')}
            placeholderTextColor={colors.textMuted}
            editable={!disabled}
            multiline
            maxLength={2050}
            style={[styles.textInput, { color: colors.text }]}
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
        >
          {isSending ? (
            <ActivityIndicator size="small" color={colors.onAccent} />
          ) : (
            <Ionicons
              name="arrow-up"
              size={20}
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
    borderTopWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
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
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  inputBarRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.xs,
  },
  iconBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  inputWrapper: {
    flex: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 40,
    maxHeight: 110,
    flexDirection: 'row',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    fontSize: fontSize.sm,
    lineHeight: 20,
    paddingTop: 6,
    paddingBottom: 6,
  },
  charLimitText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 4,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
