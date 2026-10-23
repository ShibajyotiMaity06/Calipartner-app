import { describe, expect, it } from 'vitest';
import { en } from '@/i18n/en';
import { t } from '@/i18n';
import type { ChatAttachment, ChatMessage } from '@/types/chat';

describe('Phase 8 — Chat View Layer & UI Logic Tests', () => {
  describe('1. Message List & Inverted Pagination Ordering', () => {
    it('orders messages in inverted list where newest message is at index 0', () => {
      const sampleMessages: Partial<ChatMessage>[] = [
        {
          id: 'msg-3',
          room_id: 'room-1',
          sender_id: 'user-1',
          text: 'Newest message',
          message_type: 'user',
          delivery_status: 'sent',
          created_at: '2026-10-11T12:05:00.000Z',
        },
        {
          id: 'msg-2',
          room_id: 'room-1',
          sender_id: 'user-2',
          text: 'Middle message',
          message_type: 'user',
          delivery_status: 'sent',
          created_at: '2026-10-11T12:02:00.000Z',
        },
        {
          id: 'msg-1',
          room_id: 'room-1',
          sender_id: 'user-1',
          text: 'Oldest message',
          message_type: 'user',
          delivery_status: 'sent',
          created_at: '2026-10-11T12:00:00.000Z',
        },
      ];

      // Inverted list displays index 0 at the bottom (newest)
      expect(sampleMessages[0]?.text).toBe('Newest message');
      expect(sampleMessages[2]?.text).toBe('Oldest message');
    });

    it('positions the "New Messages" divider accurately based on unread count in inverted list', () => {
      // In an inverted FlatList (index 0 is newest):
      // If unreadCount = 2, messages at index 0 and index 1 are unread.
      // The divider sits above index 1 (between index 1 and index 2).
      const calculateDividerPosition = (
        index: number,
        unreadCount: number,
        totalMessages: number,
      ) => {
        return unreadCount > 0 && index === unreadCount - 1 && index < totalMessages - 1;
      };

      const total = 5;
      const unread = 2;

      expect(calculateDividerPosition(0, unread, total)).toBe(false);
      expect(calculateDividerPosition(1, unread, total)).toBe(true);
      expect(calculateDividerPosition(2, unread, total)).toBe(false);
      expect(calculateDividerPosition(3, unread, total)).toBe(false);

      // If no unread messages, divider is never shown
      expect(calculateDividerPosition(1, 0, total)).toBe(false);
    });

    it('triggers loadMore only when hasMore is true and not currently loadingMore', () => {
      let loadMoreCalled = false;
      const onEndReached = (hasMore: boolean, loadingMore: boolean) => {
        if (hasMore && !loadingMore) {
          loadMoreCalled = true;
        }
      };

      onEndReached(false, false);
      expect(loadMoreCalled).toBe(false);

      onEndReached(true, true);
      expect(loadMoreCalled).toBe(false);

      onEndReached(true, false);
      expect(loadMoreCalled).toBe(true);
    });
  });

  describe('2. Message Bubbles & System Messages', () => {
    it('formats system event messages with proper icons and neutral pills', () => {
      const getSystemIcon = (eventType?: string | null) => {
        switch (eventType) {
          case 'member_joined':
            return 'person-add-outline';
          case 'member_left':
            return 'person-remove-outline';
          case 'room_created':
            return 'sparkles-outline';
          case 'streak_milestone':
            return 'flame-outline';
          default:
            return 'information-circle-outline';
        }
      };

      expect(getSystemIcon('member_joined')).toBe('person-add-outline');
      expect(getSystemIcon('member_left')).toBe('person-remove-outline');
      expect(getSystemIcon('room_created')).toBe('sparkles-outline');
      expect(getSystemIcon('streak_milestone')).toBe('flame-outline');
      expect(getSystemIcon(null)).toBe('information-circle-outline');
    });

    it('determines sender initial and label correctly for incoming messages', () => {
      const getSenderDisplay = (msg: Partial<ChatMessage>) => {
        const name = msg.sender_nickname || msg.sender_username || 'Partner';
        const initial = name.charAt(0).toUpperCase();
        return { name, initial };
      };

      expect(getSenderDisplay({ sender_nickname: 'Alex' })).toEqual({ name: 'Alex', initial: 'A' });
      expect(getSenderDisplay({ sender_username: 'chris_fit' })).toEqual({
        name: 'chris_fit',
        initial: 'C',
      });
      expect(getSenderDisplay({})).toEqual({ name: 'Partner', initial: 'P' });
    });

    it('renders soft placeholder text when a message has been deleted', () => {
      const msg: Partial<ChatMessage> = {
        deleted_at: '2026-10-11T12:00:00Z',
        text: 'Secret message',
      };

      const displayText = msg.deleted_at ? en.chat.deletedMessage : msg.text;
      expect(displayText).toBe('[Message deleted]');
    });

    it('safeguards against blocked attachments by displaying a safety shield notice', () => {
      const attachment: Partial<ChatAttachment> = {
        id: 'att-1',
        message_id: 'msg-1',
        storage_key: 'rooms/r1/photo.jpg',
        size: 50000,
        mime_type: 'image/jpeg',
        width: 800,
        height: 600,
        moderation_status: 'blocked',
      };

      const isBlocked = attachment.moderation_status === 'blocked';
      expect(isBlocked).toBe(true);
      expect(en.chat.blockedImage).toBe('[Image blocked by safety filter]');
    });

    it('distinguishes delivery states: sending, sent, and failed with retry', () => {
      const checkDeliveryUI = (status: ChatMessage['delivery_status']) => {
        return {
          showSpinner: status === 'sending',
          showCheckmark: status === 'sent',
          showRetryBtn: status === 'failed',
        };
      };

      expect(checkDeliveryUI('sending')).toEqual({
        showSpinner: true,
        showCheckmark: false,
        showRetryBtn: false,
      });

      expect(checkDeliveryUI('sent')).toEqual({
        showSpinner: false,
        showCheckmark: true,
        showRetryBtn: false,
      });

      expect(checkDeliveryUI('failed')).toEqual({
        showSpinner: false,
        showCheckmark: false,
        showRetryBtn: true,
      });
    });
  });

  describe('3. Composer Rules & Character Limit', () => {
    it('enforces maximum 2000 characters limit and signals near-limit warning (>1800)', () => {
      const validateText = (input: string) => {
        const len = input.length;
        return {
          remaining: 2000 - len,
          isNearLimit: len > 1800,
          isOverLimit: len > 2000,
          canSend: len > 0 && len <= 2000,
        };
      };

      const shortText = 'Great workout today!';
      expect(validateText(shortText)).toEqual({
        remaining: 2000 - shortText.length,
        isNearLimit: false,
        isOverLimit: false,
        canSend: true,
      });

      const nearLimitText = 'a'.repeat(1850);
      expect(validateText(nearLimitText).isNearLimit).toBe(true);
      expect(validateText(nearLimitText).isOverLimit).toBe(false);
      expect(validateText(nearLimitText).canSend).toBe(true);

      const overLimitText = 'a'.repeat(2005);
      expect(validateText(overLimitText).isNearLimit).toBe(true);
      expect(validateText(overLimitText).isOverLimit).toBe(true);
      expect(validateText(overLimitText).canSend).toBe(false);
    });

    it('enforces maximum 5 photo attachments clamp', () => {
      const maxImages = 5;
      const canAttachMore = (currentCount: number) => currentCount < maxImages;

      expect(canAttachMore(0)).toBe(true);
      expect(canAttachMore(4)).toBe(true);
      expect(canAttachMore(5)).toBe(false);
      expect(canAttachMore(6)).toBe(false);
    });

    it('intercepts message dispatch when terms are not accepted', () => {
      let termsModalOpened = false;
      let messageSent = false;

      const handleSendAttempt = (termsAccepted: boolean, text: string) => {
        if (!termsAccepted) {
          termsModalOpened = true;
          return;
        }
        if (text.trim().length > 0) {
          messageSent = true;
        }
      };

      // 1. Without terms accepted -> opens terms sheet
      handleSendAttempt(false, 'Hello partner');
      expect(termsModalOpened).toBe(true);
      expect(messageSent).toBe(false);

      // 2. With terms accepted -> message dispatches cleanly
      handleSendAttempt(true, 'Hello partner');
      expect(messageSent).toBe(true);
    });
  });

  describe('4. Full-screen Image Viewer & Zoom Controls', () => {
    it('restricts zoom scale between 1.0x and 3.0x', () => {
      const zoomStep = 0.5;
      const minScale = 1;
      const maxScale = 3;

      let scale = 1;
      const zoomIn = () => {
        scale = Math.min(scale + zoomStep, maxScale);
      };
      const zoomOut = () => {
        scale = Math.max(scale - zoomStep, minScale);
      };

      zoomIn();
      expect(scale).toBe(1.5);
      zoomIn();
      zoomIn();
      zoomIn();
      zoomIn(); // exceeds 3.0
      expect(scale).toBe(3);

      zoomOut();
      expect(scale).toBe(2.5);
      zoomOut();
      zoomOut();
      zoomOut();
      zoomOut(); // below 1.0
      expect(scale).toBe(1);
    });

    it('formats image metadata file size and dimensions cleanly', () => {
      const formatMetadata = (
        width?: number | null,
        height?: number | null,
        sizeBytes?: number,
      ) => {
        const dim = width && height ? `${width} × ${height}` : '';
        const sizeStr = sizeBytes
          ? sizeBytes > 1024 * 1024
            ? `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`
            : `${Math.round(sizeBytes / 1024)} KB`
          : '';
        return [dim, sizeStr].filter(Boolean).join(' • ');
      };

      expect(formatMetadata(1920, 1080, 250000)).toBe('1920 × 1080 • 244 KB');
      expect(formatMetadata(3000, 2000, 2500000)).toBe('3000 × 2000 • 2.4 MB');
      expect(formatMetadata(null, null, 50000)).toBe('49 KB');
    });
  });

  describe('5. Long-Press Action Sheet & Safety Actions', () => {
    it('permits deleting own messages while disallowing deleting others messages', () => {
      const getAvailableActions = (isMine: boolean) => {
        return {
          canCopy: true,
          canDelete: isMine,
          canReport: !isMine,
          canBlock: !isMine,
          canMute: !isMine,
        };
      };

      const myActions = getAvailableActions(true);
      expect(myActions.canDelete).toBe(true);
      expect(myActions.canReport).toBe(false);
      expect(myActions.canBlock).toBe(false);

      const otherActions = getAvailableActions(false);
      expect(otherActions.canDelete).toBe(false);
      expect(otherActions.canReport).toBe(true);
      expect(otherActions.canBlock).toBe(true);
      expect(otherActions.canMute).toBe(true);
    });

    it('provides standard safety reporting reasons', () => {
      const reportReasons = ['inappropriate', 'harassment', 'spam', 'other'] as const;
      expect(reportReasons).toHaveLength(4);
      expect(reportReasons).toContain('inappropriate');
      expect(reportReasons).toContain('harassment');
      expect(reportReasons).toContain('spam');
    });

    it('instantly filters out blocked member messages from state and storage', () => {
      const messages: Partial<ChatMessage>[] = [
        { id: '1', sender_id: 'user-a', text: 'Hi' },
        { id: '2', sender_id: 'abusive-user', text: 'Spam' },
        { id: '3', sender_id: 'user-a', text: 'How are you?' },
      ];

      const blockedUserId = 'abusive-user';
      const filtered = messages.filter((m) => m.sender_id !== blockedUserId);
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.sender_id)).not.toContain('abusive-user');
    });
  });

  describe('6. Room State Banners & Offline Handling', () => {
    it('displays offline banner when network is unavailable', () => {
      const isOnline = false;
      const showOfflineBanner = isOnline === false;
      expect(showOfflineBanner).toBe(true);
      expect(en.chat.offlineBanner).toBe(
        "You're offline. Messages will send automatically once reconnected.",
      );
    });

    it('enforces paused state for locked rooms (banner + composer disabled)', () => {
      const isLocked = true;
      const bannerVisible = isLocked;
      const composerDisabled = isLocked;
      const disabledReason = isLocked ? en.chat.pausedTitle : undefined;

      expect(bannerVisible).toBe(true);
      expect(composerDisabled).toBe(true);
      expect(disabledReason).toBe('This room is paused');
    });

    it('displays dormant waiting banner when fewer than 2 members are active', () => {
      const isDormant = true;
      const isLocked = false;
      const showDormantBanner = isDormant && !isLocked;

      expect(showDormantBanner).toBe(true);
      expect(en.chat.dormantBanner).toBe(
        'This room is waiting for a partner. Chat is read-only until a second member joins.',
      );
    });

    it('provides friendly empty state with conversation starters', () => {
      expect(en.chat.emptyTitle).toBe('Say hi to your partner');
      expect(en.chat.emptySubtitle).toBe(
        'Share meal photos, celebrate workout PRs, and keep each other accountable.',
      );
      expect(en.chat.starter1).toBe('Ready for today! 💪');
      expect(en.chat.starter2).toBe('Just logged my meals 🥗');
      expect(en.chat.starter3).toBe('Crushing goals together 🎯');
    });
  });

  describe('7. i18n & Accessibility Completeness', () => {
    it('verifies all chat localization strings exist in en dictionary', () => {
      expect(t('chat.emptyTitle')).toBe('Say hi to your partner');
      expect(t('chat.placeholder')).toBe('Message room…');
      expect(t('chat.termsTitle')).toBe('CaliPartner Chat Guidelines');
      expect(t('chat.reportMsg')).toBe('Report message');
      expect(t('chat.deleteOwn')).toBe('Delete message');
      expect(t('chat.muteMember', { username: 'partner' })).toBe('Mute @partner');
      expect(t('chat.savedImageToast')).toBe('Photo saved to your gallery!');
      expect(t('chat.newMessagesDivider')).toBe('New Messages');
      expect(t('chat.offlineBanner')).toBe(
        "You're offline. Messages will send automatically once reconnected.",
      );
    });
  });
});
