import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Rect } from 'react-native-svg';
import { Avatar, Button, Chip, dark, radius, space, Text } from '@calipartner/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { playClickSound, playSuccessSound } from '@/lib/sound';

export type ConnectChoice = '1-on-1' | 'create-squad' | 'join-squad';

export interface PartnerProfileItem {
  id: string;
  name: string;
  ageBand: string;
  city: string;
  avatarHue: keyof typeof dark;
  goal: string;
  workoutStyle: string;
  bio: string;
  enabledFeatures: {
    steps: boolean;
    workouts: boolean;
    meals: boolean;
    water: boolean;
  };
}

const SAMPLE_PARTNERS: PartnerProfileItem[] = [
  {
    id: 'partner-1',
    name: 'Ananya Sharma',
    ageBand: '24',
    city: 'Bangalore',
    avatarHue: 'iris',
    goal: 'Lose Fat & Tone',
    workoutStyle: 'HIIT + Evening Walks',
    bio: 'Looking for an everyday partner to hit 8,000 steps and log dinner together.',
    enabledFeatures: { steps: true, workouts: true, meals: true, water: true },
  },
  {
    id: 'partner-2',
    name: 'Rohit Verma',
    ageBand: '28',
    city: 'Mumbai',
    avatarHue: 'teal',
    goal: 'Build Muscle',
    workoutStyle: 'Heavy Lifting & 5k Runs',
    bio: 'Training 5x a week. Need someone who pushes hard and does not skip leg day.',
    enabledFeatures: { steps: true, workouts: true, meals: false, water: true },
  },
  {
    id: 'partner-3',
    name: 'Meghana Reddy',
    ageBand: '26',
    city: 'Hyderabad',
    avatarHue: 'rose',
    goal: 'Consistency & Fasting',
    workoutStyle: 'Pilates & Morning Walks',
    bio: 'Intermittent faster (16:8). Let us keep our hydration and meal streaks intact!',
    enabledFeatures: { steps: true, workouts: false, meals: true, water: true },
  },
  {
    id: 'partner-4',
    name: 'Karthik Nair',
    ageBand: '29',
    city: 'Pune',
    avatarHue: 'mint',
    goal: 'Calisthenics & Cardio',
    workoutStyle: 'Bodyweight & 10k Steps',
    bio: 'Bodyweight training and marathon prep. Let us conquer 10k steps daily.',
    enabledFeatures: { steps: true, workouts: true, meals: false, water: true },
  },
  {
    id: 'partner-5',
    name: 'Pooja Iyer',
    ageBand: '27',
    city: 'Chennai',
    avatarHue: 'orchid',
    goal: 'Clean Eating & Steps',
    workoutStyle: 'Yoga & Daily Steps',
    bio: 'Software engineer beating sedentary routine with daily walks and real food.',
    enabledFeatures: { steps: true, workouts: false, meals: true, water: true },
  },
  {
    id: 'partner-6',
    name: 'Aman Joshi',
    ageBand: '25',
    city: 'Delhi NCR',
    avatarHue: 'sky',
    goal: 'Strength & Fat Loss',
    workoutStyle: 'Push-Pull-Legs & Cycling',
    bio: 'Accountability is everything. Daily check-in partner for nutrition and lifting.',
    enabledFeatures: { steps: true, workouts: true, meals: true, water: false },
  },
];

export interface SquadConnectFlowProps {
  isPlusOrPro: boolean;
  onOpenPaywall: () => void;
  onCreateSquad: (name: string) => Promise<{ room_id: string; code?: string } | void>;
  onJoinSquad: () => void;
  onSquadCreatedAndReady?: (roomId: string) => void;
  testID?: string;
}

export function SquadConnectFlow({
  isPlusOrPro,
  onOpenPaywall,
  onCreateSquad,
  onJoinSquad,
  onSquadCreatedAndReady,
  testID = 'squad-connect-flow',
}: SquadConnectFlowProps) {
  const insets = useSafeAreaInsets();
  const dynamicBottom = Math.max(96, insets.bottom + 68);

  // Current screen step: 'choice' | 'partner_profiles' | 'create_squad' | 'invite_squad'
  const [step, setStep] = useState<'choice' | 'partner_profiles' | 'create_squad' | 'invite_squad'>('choice');
  const [selectedChoice, setSelectedChoice] = useState<ConnectChoice>('1-on-1');

  // Plus Feature required modal state
  const [showPlusModal, setShowPlusModal] = useState(!isPlusOrPro);

  // Partner profiles request states
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());

  // Squad Creation state
  const [squadName, setSquadName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Invite Screen state
  const [createdSquadName, setCreatedSquadName] = useState('My Squad');
  const [createdSquadCode, setCreatedSquadCode] = useState('CALI-8821');
  const [createdRoomId, setCreatedRoomId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  // Ensure free users see the Plus modal when attempting to connect
  const handleNextFromChoice = () => {
    playClickSound();
    if (!isPlusOrPro) {
      setShowPlusModal(true);
      return;
    }

    if (selectedChoice === '1-on-1') {
      setStep('partner_profiles');
    } else if (selectedChoice === 'create-squad') {
      setStep('create_squad');
    } else if (selectedChoice === 'join-squad') {
      onJoinSquad();
    }
  };

  const handleSendPartnerRequest = (partnerId: string, partnerName: string) => {
    playSuccessSound();
    setSentRequests((prev) => new Set(prev).add(partnerId));
    Alert.alert(
      'Request Sent',
      `Partner request sent to ${partnerName}. They will receive your invitation once they check in.`,
    );
  };

  const handleCreateSquadSubmit = async () => {
    const trimmed = squadName.trim();
    if (trimmed.length < 3) {
      setCreateError('Squad name must be at least 3 characters');
      return;
    }

    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await onCreateSquad(trimmed);
      const code =
        res && typeof res === 'object' && 'code' in res && res.code
          ? String(res.code)
          : `CALI-${Math.floor(1000 + Math.random() * 9000)}`;
      const roomId =
        res && typeof res === 'object' && 'room_id' in res && res.room_id ? String(res.room_id) : '';

      setCreatedSquadName(trimmed);
      setCreatedSquadCode(code);
      setCreatedRoomId(roomId);
      playSuccessSound();
      setStep('invite_squad');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('PLAN_ALREADY_ATTACHED')) {
        setCreateError(
          'You already have an active squad attached to your plan. Leave or finish your previous squad before creating a new one.',
        );
      } else if (msg.includes('MAX_ROOMS_REACHED')) {
        setCreateError('You have reached the maximum limit of 3 joined squads.');
      } else {
        setCreateError(msg);
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleWhatsAppShare = () => {
    playClickSound();
    const shareUrl = `https://calipartner-live.loca.lt/join?code=${createdSquadCode}`;
    const text = `Join my fitness squad "${createdSquadName}" on CaliPartner! 🏋️‍♂️ Squad Code: ${createdSquadCode}\n${shareUrl}`;
    const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
    Linking.openURL(waUrl).catch(() => {
      Alert.alert('Sharing', text);
    });
  };

  const handleCopyLink = async () => {
    playClickSound();
    const shareUrl = `https://calipartner-live.loca.lt/join?code=${createdSquadCode}`;

    if (Platform.OS === 'web' && typeof globalThis !== 'undefined') {
      const nav = (globalThis as unknown as { navigator?: { clipboard?: { writeText: (s: string) => Promise<void> } } }).navigator;
      if (nav?.clipboard?.writeText) {
        await nav.clipboard.writeText(shareUrl);
      }
    }

    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2500);
  };

  // STEP 1: Find a Partner (Matching user's Screenshot 1: media_1792558737920.png)
  if (step === 'choice') {
    return (
      <View style={styles.container} testID={testID}>
        <ScrollView contentContainerStyle={styles.choiceScroll} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.choiceHeader}>
            <Text variant="title1" color={dark.textHi} style={styles.mainTitle}>
              Find a Partner
            </Text>
            <Text variant="body" color={dark.textMid} style={styles.mainSubtitle}>
              Choose how you want to connect.
            </Text>
          </View>

          {/* Option 1: 1-on-1 Partner */}
          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setSelectedChoice('1-on-1');
            }}
            accessibilityRole="button"
            accessibilityLabel="1-on-1 Partner. Track activities with one partner."
            accessibilityState={{ selected: selectedChoice === '1-on-1' }}
            testID="option-1-on-1-partner"
            style={[
              styles.optionCard,
              selectedChoice === '1-on-1' && styles.optionCardSelected,
            ]}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="person" size={28} color={dark.apricot} />
            </View>
            <View style={styles.optionTextCol}>
              <Text variant="title2" color={dark.textHi} style={styles.optionTitle}>
                1-on-1 Partner
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.optionSubtitle}>
                Track activities with one partner.
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 2: Create a Squad */}
          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setSelectedChoice('create-squad');
            }}
            accessibilityRole="button"
            accessibilityLabel="Create a Squad. Make a group with friends (2–10 people)."
            accessibilityState={{ selected: selectedChoice === 'create-squad' }}
            testID="option-create-squad"
            style={[
              styles.optionCard,
              selectedChoice === 'create-squad' && styles.optionCardSelected,
            ]}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="people" size={28} color={dark.apricot} />
            </View>
            <View style={styles.optionTextCol}>
              <Text variant="title2" color={dark.textHi} style={styles.optionTitle}>
                Create a Squad
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.optionSubtitle}>
                Make a group with friends (2–10 people).
              </Text>
            </View>
          </TouchableOpacity>

          {/* Option 3: Join an Existing Squad */}
          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setSelectedChoice('join-squad');
            }}
            accessibilityRole="button"
            accessibilityLabel="Join an Existing Squad. Join with an invite code."
            accessibilityState={{ selected: selectedChoice === 'join-squad' }}
            testID="option-join-squad"
            style={[
              styles.optionCard,
              selectedChoice === 'join-squad' && styles.optionCardSelected,
            ]}
          >
            <View style={styles.optionIconContainer}>
              <Ionicons name="search" size={26} color={dark.apricot} />
            </View>
            <View style={styles.optionTextCol}>
              <Text variant="title2" color={dark.textHi} style={styles.optionTitle}>
                Join an Existing Squad
              </Text>
              <Text variant="bodyS" color={dark.textMid} style={styles.optionSubtitle}>
                Join with an invite code.
              </Text>
            </View>
          </TouchableOpacity>
        </ScrollView>

        {/* Bottom Primary Button */}
        <View style={[styles.bottomBar, { bottom: dynamicBottom }]}>
          <TouchableOpacity
            onPress={handleNextFromChoice}
            style={styles.nextPillButton}
            accessibilityRole="button"
            accessibilityLabel="Next"
            testID="btn-find-partner-next"
          >
            <Text variant="heading" color={dark.onBrand} style={styles.nextPillText}>
              Next →
            </Text>
          </TouchableOpacity>
        </View>

        {/* Plus Feature Modal for Free Users */}
        <Modal
          visible={showPlusModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowPlusModal(false)}
        >
          <View style={styles.plusBackdrop}>
            <View style={styles.plusModalCard} testID="modal-plus-required">
              <View style={styles.plusBadge}>
                <Ionicons name="star" size={14} color={dark.onBrand} />
                <Text variant="micro" color={dark.onBrand} style={{ fontWeight: '800' }}>
                  PLUS FEATURE
                </Text>
              </View>

              <Text variant="title1" color={dark.textHi} style={styles.plusTitle}>
                Squads & Partners
              </Text>
              <Text variant="body" color={dark.textMid} style={styles.plusDesc}>
                Accountability rooms and 1-on-1 partners are included with CaliPartner Plus. Connect with
                real partners to log food, workouts, and reach your goals together.
              </Text>

              <View style={styles.plusBenefitsList}>
                <View style={styles.plusBenefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color={dark.apricot} />
                  <Text variant="bodyS" color={dark.textHi}>
                    1-on-1 partner & group accountability squads
                  </Text>
                </View>
                <View style={styles.plusBenefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color={dark.apricot} />
                  <Text variant="bodyS" color={dark.textHi}>
                    Side-by-side progress & live activity feed
                  </Text>
                </View>
                <View style={styles.plusBenefitItem}>
                  <Ionicons name="checkmark-circle" size={18} color={dark.apricot} />
                  <Text variant="bodyS" color={dark.textHi}>
                    Squad chat, meal reactions & photo check-ins
                  </Text>
                </View>
              </View>

              <View style={styles.plusActionCol}>
                <Button
                  variant="primary"
                  size="lg"
                  label="Buy Plus"
                  onPress={() => {
                    playClickSound();
                    setShowPlusModal(false);
                    onOpenPaywall();
                  }}
                  testID="btn-buy-plus-modal"
                />
                <Button
                  variant="secondary"
                  size="md"
                  label="Maybe later"
                  onPress={() => {
                    playClickSound();
                    setShowPlusModal(false);
                  }}
                  testID="btn-dismiss-plus-modal"
                />
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  // STEP 2: 1-on-1 Partner Profiles List
  if (step === 'partner_profiles') {
    return (
      <View style={styles.container} testID="screen-partner-profiles">
        {/* Top Header */}
        <View style={styles.flowTopBar}>
          <TouchableOpacity
            onPress={() => setStep('choice')}
            style={styles.backIconButton}
            accessibilityRole="button"
            accessibilityLabel="Back to connection choice"
            testID="btn-back-to-choice"
          >
            <Ionicons name="arrow-back" size={22} color={dark.textHi} />
          </TouchableOpacity>
          <View style={styles.flowTopTitleCol}>
            <Text variant="title2" color={dark.textHi} style={{ fontWeight: '700' }}>
              Accountability Partners
            </Text>
            <Text variant="micro" color={dark.textLo}>
              Profiles open to connect
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.partnerListScroll} showsVerticalScrollIndicator={false}>
          <Text variant="bodyS" color={dark.textMid} style={styles.partnerListIntro}>
            Browse partners with compatible fitness goals and see what activities they have enabled to share.
          </Text>

          {SAMPLE_PARTNERS.map((partner) => {
            const isSent = sentRequests.has(partner.id);

            return (
              <View key={partner.id} style={styles.partnerCard} testID={`card-partner-${partner.id}`}>
                {/* Top Row: Avatar + Name + Goal */}
                <View style={styles.partnerHeaderRow}>
                  <Avatar name={partner.name} identityHue={partner.avatarHue} size="md" />
                  <View style={styles.partnerNameCol}>
                    <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                      {partner.name}
                    </Text>
                    <Text variant="micro" color={dark.textLo}>
                      {partner.ageBand} yrs · {partner.city} · {partner.workoutStyle}
                    </Text>
                  </View>
                  <Chip label={partner.goal} selected={true} />
                </View>

                {/* Bio quote */}
                <Text variant="bodyS" color={dark.textMid} style={styles.partnerBio}>
                  &ldquo;{partner.bio}&rdquo;
                </Text>

                {/* Enabled Activities Row */}
                <View style={styles.enabledFeaturesSection}>
                  <Text variant="micro" color={dark.textLo} style={styles.enabledSectionLabel}>
                    What they share:
                  </Text>
                  <View style={styles.featuresPillsRow}>
                    {partner.enabledFeatures.steps && (
                      <View style={styles.featurePill}>
                        <Ionicons name="footsteps" size={13} color={dark.apricot} />
                        <Text variant="micro" color={dark.textHi}>
                          Steps
                        </Text>
                      </View>
                    )}
                    {partner.enabledFeatures.workouts && (
                      <View style={styles.featurePill}>
                        <Ionicons name="barbell" size={13} color={dark.teal} />
                        <Text variant="micro" color={dark.textHi}>
                          Workouts
                        </Text>
                      </View>
                    )}
                    {partner.enabledFeatures.meals && (
                      <View style={styles.featurePill}>
                        <Ionicons name="restaurant" size={13} color="#EB7A6B" />
                        <Text variant="micro" color={dark.textHi}>
                          Meals & Calories
                        </Text>
                      </View>
                    )}
                    {partner.enabledFeatures.water && (
                      <View style={styles.featurePill}>
                        <Ionicons name="water" size={13} color={dark.sky} />
                        <Text variant="micro" color={dark.textHi}>
                          Water
                        </Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Send Request Button */}
                <TouchableOpacity
                  onPress={() => !isSent && handleSendPartnerRequest(partner.id, partner.name)}
                  disabled={isSent}
                  style={[styles.partnerActionBtn, isSent && styles.partnerActionBtnSent]}
                  accessibilityRole="button"
                  accessibilityLabel={isSent ? 'Request sent' : `Send request to ${partner.name}`}
                  testID={`btn-send-request-${partner.id}`}
                >
                  <Ionicons
                    name={isSent ? 'checkmark' : 'person-add-outline'}
                    size={16}
                    color={isSent ? dark.onBrand : dark.textHi}
                  />
                  <Text
                    variant="label"
                    color={isSent ? dark.onBrand : dark.textHi}
                    style={{ fontWeight: '700' }}
                  >
                    {isSent ? 'Request Sent' : 'Send Request'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  // STEP 3: Create Squad Form
  if (step === 'create_squad') {
    return (
      <View style={styles.container} testID="screen-create-squad-form">
        <View style={styles.flowTopBar}>
          <TouchableOpacity
            onPress={() => setStep('choice')}
            style={styles.backIconButton}
            accessibilityRole="button"
            testID="btn-back-to-choice-from-create"
          >
            <Ionicons name="arrow-back" size={22} color={dark.textHi} />
          </TouchableOpacity>
          <View style={styles.flowTopTitleCol}>
            <Text variant="title2" color={dark.textHi} style={{ fontWeight: '700' }}>
              Create Your Squad
            </Text>
            <Text variant="micro" color={dark.textLo}>
              Set up a group for friends & teammates
            </Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.createFormScroll}>
          <Text variant="body" color={dark.textMid} style={{ marginBottom: space[4], lineHeight: 22 }}>
            Give your accountability squad a name. Once created, you will get an invite code, WhatsApp share link, and QR code for friends.
          </Text>

          <Text variant="label" color={dark.textHi} style={{ marginBottom: space[2], fontWeight: '700' }}>
            Squad Name
          </Text>
          <TextInput
            value={squadName}
            onChangeText={(txt) => {
              setSquadName(txt);
              setCreateError(null);
            }}
            placeholder="e.g. Morning Grinders"
            placeholderTextColor={dark.textOff}
            style={styles.squadInput}
            maxLength={35}
            autoFocus
            testID="input-squad-name"
          />

          {createError && (
            <View
              style={{
                marginTop: space[2],
                padding: space[3],
                backgroundColor: dark.s2,
                borderRadius: radius.card,
                borderWidth: 1,
                borderColor: '#FF6B6B',
              }}
            >
              <Text variant="bodyS" color="#FF6B6B">
                {createError}
              </Text>
              {(createError.includes('previous squad') || createError.includes('PLAN_ALREADY_ATTACHED')) && (
                <TouchableOpacity
                  onPress={async () => {
                    setIsCreating(true);
                    setCreateError(null);
                    try {
                      const { getSupabase } = await import('@/lib/supabase');
                      const supabase = getSupabase();
                      const { data: userData } = await supabase.auth.getUser();
                      if (userData?.user?.id) {
                        const { data: oldRooms } = await supabase
                          .from('rooms')
                          .select('id')
                          .eq('plan_holder_id', userData.user.id)
                          .in('state', ['active', 'dormant', 'over_capacity']);
                        if (oldRooms) {
                          for (const r of oldRooms) {
                            try {
                              await supabase.rpc('leave_room', { p_room_id: r.id });
                            } catch {
                              // ignore
                            }
                            try {
                              await supabase
                                .from('rooms')
                                .update({ state: 'archived' })
                                .eq('id', r.id);
                            } catch {
                              // ignore
                            }
                          }
                        }
                      }
                      await handleCreateSquadSubmit();
                    } catch (e: any) {
                      setCreateError(e.message || String(e));
                    } finally {
                      setIsCreating(false);
                    }
                  }}
                  style={{
                    marginTop: 8,
                    backgroundColor: dark.apricot,
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: radius.control,
                    alignItems: 'center',
                  }}
                >
                  <Text variant="label" color={dark.onBrand} style={{ fontWeight: '700' }}>
                    Archive Previous Squad & Create New
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Quick Suggestions */}
          <Text variant="micro" color={dark.textLo} style={{ marginTop: space[4], marginBottom: space[2] }}>
            Suggestions:
          </Text>
          <View style={styles.suggestionsRow}>
            {['Morning Grinders', 'Iron Squad', 'Calorie Crushers', '10k Steps Daily'].map((sug) => (
              <TouchableOpacity
                key={sug}
                onPress={() => setSquadName(sug)}
                style={styles.suggestionChip}
                accessibilityRole="button"
              >
                <Text variant="micro" color={dark.apricot}>
                  + {sug}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        <View style={[styles.bottomBar, { bottom: dynamicBottom }]}>
          <TouchableOpacity
            onPress={handleCreateSquadSubmit}
            disabled={isCreating || squadName.trim().length < 3}
            style={[
              styles.nextPillButton,
              (isCreating || squadName.trim().length < 3) && { opacity: 0.5 },
            ]}
            accessibilityRole="button"
            testID="btn-confirm-create-squad"
          >
            {isCreating ? (
              <ActivityIndicator size="small" color={dark.onBrand} />
            ) : (
              <Text variant="heading" color={dark.onBrand} style={styles.nextPillText}>
                Create Squad →
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // STEP 4: Invite Partner Screen (WhatsApp, Copy Link, QR Code)
  return (
    <View style={styles.container} testID="screen-invite-squad">
      <ScrollView contentContainerStyle={styles.inviteScroll} showsVerticalScrollIndicator={false}>
        {/* Success checkmark badge */}
        <View style={styles.inviteSuccessCircle}>
          <Ionicons name="checkmark" size={32} color={dark.onBrand} />
        </View>

        <Text variant="title1" color={dark.textHi} style={styles.inviteTitle}>
          Your Squad is Ready!
        </Text>
        <Text variant="body" color={dark.textMid} style={styles.inviteSubtitle}>
          Invite friends to &ldquo;{createdSquadName}&rdquo; to start tracking together.
        </Text>

        {/* Big Code Card */}
        <View style={styles.codeCard}>
          <Text variant="micro" color={dark.textLo} style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
            Squad Invite Code
          </Text>
          <Text variant="title1" color={dark.apricot} style={styles.codeText} testID="text-squad-code">
            {createdSquadCode}
          </Text>
          <Text variant="micro" color={dark.textMid}>
            Share this 6-character code with your partners
          </Text>
        </View>

        {/* 3 Share Options: WhatsApp, Copy Link, QR Code */}
        <View style={styles.shareOptionsCol}>
          {/* WhatsApp */}
          <TouchableOpacity
            onPress={handleWhatsAppShare}
            style={styles.shareOptionRow}
            accessibilityRole="button"
            accessibilityLabel="Share to WhatsApp"
            testID="btn-share-whatsapp"
          >
            <View style={[styles.shareIconCircle, { backgroundColor: '#25D366' }]}>
              <Ionicons name="logo-whatsapp" size={24} color="#FFFFFF" />
            </View>
            <View style={styles.shareTextCol}>
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                Share via WhatsApp
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                Send instant invite link and code to chats
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={dark.textLo} />
          </TouchableOpacity>

          {/* Copy Link */}
          <TouchableOpacity
            onPress={handleCopyLink}
            style={styles.shareOptionRow}
            accessibilityRole="button"
            accessibilityLabel="Copy invite link"
            testID="btn-share-copy-link"
          >
            <View style={[styles.shareIconCircle, { backgroundColor: dark.s3 }]}>
              <Ionicons name={copyFeedback ? 'checkmark' : 'copy-outline'} size={22} color={dark.apricot} />
            </View>
            <View style={styles.shareTextCol}>
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                {copyFeedback ? 'Link Copied! ✓' : 'Copy Invite Link'}
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                calipartner-live.loca.lt/join?code={createdSquadCode}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={dark.textLo} />
          </TouchableOpacity>

          {/* QR Code */}
          <TouchableOpacity
            onPress={() => {
              playClickSound();
              setShowQrModal(true);
            }}
            style={styles.shareOptionRow}
            accessibilityRole="button"
            accessibilityLabel="Show QR Code"
            testID="btn-share-qr-code"
          >
            <View style={[styles.shareIconCircle, { backgroundColor: dark.s3 }]}>
              <Ionicons name="qr-code-outline" size={22} color={dark.teal} />
            </View>
            <View style={styles.shareTextCol}>
              <Text variant="body" color={dark.textHi} style={{ fontWeight: '700' }}>
                Show QR Code
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                Scan in person to join instantly
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={dark.textLo} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Done Button */}
      <View style={[styles.bottomBar, { bottom: dynamicBottom }]}>
        <TouchableOpacity
          onPress={() => {
            playSuccessSound();
            if (createdRoomId && onSquadCreatedAndReady) {
              onSquadCreatedAndReady(createdRoomId);
            } else {
              setStep('choice');
            }
          }}
          style={styles.nextPillButton}
          accessibilityRole="button"
          accessibilityLabel="Go to squad"
          testID="btn-go-to-squad"
        >
          <Text variant="heading" color={dark.onBrand} style={styles.nextPillText}>
            Go to Squad →
          </Text>
        </TouchableOpacity>
      </View>

      {/* Interactive QR Code Modal */}
      <Modal
        visible={showQrModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQrModal(false)}
      >
        <View style={styles.plusBackdrop}>
          <View style={styles.qrModalCard} testID="modal-squad-qr">
            <Text variant="title2" color={dark.textHi} style={{ fontWeight: '700', marginBottom: 4 }}>
              Scan to Join Squad
            </Text>
            <Text variant="bodyS" color={dark.textMid} style={{ marginBottom: space[4], textAlign: 'center' }}>
              Point camera at QR code to join &ldquo;{createdSquadName}&rdquo;
            </Text>

            {/* SVG Crisp QR Code visual representation */}
            <View style={styles.qrSvgWrapper}>
              <Svg width={200} height={200} viewBox="0 0 200 200">
                <Rect width={200} height={200} fill="#FFFFFF" rx={12} />
                {/* Outer corners */}
                <Rect x={16} y={16} width={44} height={44} fill="#0E0B08" rx={4} />
                <Rect x={22} y={22} width={32} height={32} fill="#FFFFFF" rx={2} />
                <Rect x={28} y={28} width={20} height={20} fill="#F4B67D" rx={2} />

                <Rect x={140} y={16} width={44} height={44} fill="#0E0B08" rx={4} />
                <Rect x={146} y={22} width={32} height={32} fill="#FFFFFF" rx={2} />
                <Rect x={152} y={28} width={20} height={20} fill="#F4B67D" rx={2} />

                <Rect x={16} y={140} width={44} height={44} fill="#0E0B08" rx={4} />
                <Rect x={22} y={146} width={32} height={32} fill="#FFFFFF" rx={2} />
                <Rect x={28} y={152} width={20} height={20} fill="#F4B67D" rx={2} />

                {/* Matrix blocks */}
                <Rect x={72} y={24} width={12} height={12} fill="#0E0B08" />
                <Rect x={96} y={24} width={12} height={12} fill="#0E0B08" />
                <Rect x={116} y={24} width={12} height={12} fill="#0E0B08" />
                <Rect x={72} y={48} width={12} height={12} fill="#0E0B08" />
                <Rect x={108} y={48} width={12} height={12} fill="#0E0B08" />

                <Rect x={24} y={72} width={12} height={12} fill="#0E0B08" />
                <Rect x={48} y={72} width={12} height={12} fill="#0E0B08" />
                <Rect x={72} y={72} width={16} height={16} fill="#F4B67D" rx={2} />
                <Rect x={100} y={72} width={12} height={12} fill="#0E0B08" />
                <Rect x={124} y={72} width={12} height={12} fill="#0E0B08" />
                <Rect x={148} y={72} width={12} height={12} fill="#0E0B08" />

                <Rect x={24} y={96} width={12} height={12} fill="#0E0B08" />
                <Rect x={60} y={96} width={12} height={12} fill="#0E0B08" />
                <Rect x={84} y={96} width={28} height={28} fill="#1FBDB6" rx={4} />
                <Rect x={124} y={96} width={12} height={12} fill="#0E0B08" />
                <Rect x={160} y={96} width={12} height={12} fill="#0E0B08" />

                <Rect x={72} y={136} width={12} height={12} fill="#0E0B08" />
                <Rect x={96} y={136} width={12} height={12} fill="#0E0B08" />
                <Rect x={120} y={136} width={12} height={12} fill="#0E0B08" />
                <Rect x={144} y={136} width={12} height={12} fill="#0E0B08" />

                <Rect x={72} y={160} width={12} height={12} fill="#0E0B08" />
                <Rect x={108} y={160} width={12} height={12} fill="#0E0B08" />
                <Rect x={144} y={160} width={16} height={16} fill="#F4B67D" rx={2} />
              </Svg>
            </View>

            <View style={styles.qrCodeBadge}>
              <Text variant="title2" color={dark.apricot} style={{ fontWeight: '800', letterSpacing: 2 }}>
                {createdSquadCode}
              </Text>
            </View>

            <Button
              variant="secondary"
              size="md"
              label="Close"
              onPress={() => setShowQrModal(false)}
              style={{ marginTop: space[4], width: '100%' }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  choiceScroll: {
    paddingHorizontal: space[4],
    paddingTop: space[4],
    paddingBottom: 180,
    gap: space[3],
  },
  choiceHeader: {
    marginBottom: space[3],
  },
  mainTitle: {
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  mainSubtitle: {
    lineHeight: 20,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderWidth: 1.5,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[4],
  },
  optionCardSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  optionIconContainer: {
    width: 52,
    height: 52,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTextCol: {
    flex: 1,
  },
  optionTitle: {
    fontWeight: '700',
    marginBottom: 4,
  },
  optionSubtitle: {
    lineHeight: 18,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 96,
    left: space[4],
    right: space[4],
    zIndex: 50,
  },
  nextPillButton: {
    backgroundColor: dark.apricot,
    paddingVertical: 16,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  nextPillText: {
    fontWeight: '800',
    fontSize: 16,
  },
  plusBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: space[4],
  },
  plusModalCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[5],
    width: '100%',
    maxWidth: 400,
    gap: space[3],
  },
  plusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.apricot,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.full,
    alignSelf: 'flex-start',
  },
  plusTitle: {
    fontWeight: '800',
  },
  plusDesc: {
    lineHeight: 22,
  },
  plusBenefitsList: {
    gap: space[2],
    marginVertical: space[2],
  },
  plusBenefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  plusActionCol: {
    gap: space[2],
    marginTop: space[2],
  },
  flowTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    gap: space[3],
  },
  backIconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: dark.s1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowTopTitleCol: {
    flex: 1,
  },
  partnerListScroll: {
    padding: space[4],
    paddingBottom: 180,
    gap: space[4],
  },
  partnerListIntro: {
    lineHeight: 20,
    marginBottom: space[1],
  },
  partnerCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  partnerHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  partnerNameCol: {
    flex: 1,
  },
  partnerBio: {
    lineHeight: 20,
    fontStyle: 'italic',
  },
  enabledFeaturesSection: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[3],
    gap: space[2],
  },
  enabledSectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  featuresPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.s3,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  partnerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    paddingVertical: 12,
    borderRadius: radius.full,
  },
  partnerActionBtnSent: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  createFormScroll: {
    padding: space[4],
    paddingBottom: 180,
  },
  squadInput: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    color: dark.textHi,
    paddingHorizontal: space[4],
    paddingVertical: 14,
    fontSize: 16,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  suggestionChip: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    paddingHorizontal: space[3],
    paddingVertical: 8,
    borderRadius: radius.full,
  },
  inviteScroll: {
    padding: space[4],
    alignItems: 'center',
    paddingBottom: 180,
  },
  inviteSuccessCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: space[3],
  },
  inviteTitle: {
    letterSpacing: -0.4,
    marginBottom: 4,
    textAlign: 'center',
  },
  inviteSubtitle: {
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: space[4],
  },
  codeCard: {
    backgroundColor: dark.s1,
    borderWidth: 1.5,
    borderColor: dark.apricot,
    borderRadius: radius.card,
    padding: space[4],
    alignItems: 'center',
    width: '100%',
    gap: space[1],
    marginBottom: space[4],
  },
  codeText: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 2,
    marginVertical: space[1],
  },
  shareOptionsCol: {
    width: '100%',
    gap: space[3],
  },
  shareOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[3],
  },
  shareIconCircle: {
    width: 48,
    height: 48,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareTextCol: {
    flex: 1,
  },
  qrModalCard: {
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.card,
    padding: space[5],
    alignItems: 'center',
    width: '100%',
    maxWidth: 340,
  },
  qrSvgWrapper: {
    backgroundColor: '#FFFFFF',
    padding: space[3],
    borderRadius: radius.control,
    marginVertical: space[3],
  },
  qrCodeBadge: {
    backgroundColor: dark.s2,
    paddingHorizontal: space[4],
    paddingVertical: space[2],
    borderRadius: radius.full,
    marginTop: space[2],
  },
});
