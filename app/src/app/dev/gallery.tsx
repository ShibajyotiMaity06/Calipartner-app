import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Text,
  Button,
  Chip,
  SegmentedControl,
  Card,
  Sheet,
  Field,
  Stepper,
  ListRow,
  Avatar,
  Toast,
  Banner,
  SyncPill,
  SwitchRow,
  EmptyState,
  Skeleton,
  VisibilityEye,
  HiddenMetric,
  PermissionPrimer,
  PairRing,
  Seam,
  PairedCard,
  CalorieRing,
  MacroBar,
  TimerDisplay,
  useTheme,
  space,
  dark,
  type MealStatus,
  type MealType,
  type RoomMemberSummary,
} from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';

const FIXTURE_USER_MEALS_COMPLETE: Record<MealType, MealStatus> = {
  breakfast: { logged: true, name: 'Eggs & Toast', calories: 420 },
  lunch: { logged: true, name: 'Dal Khichdi & Salad', calories: 650 },
  dinner: { logged: true, name: 'Paneer Bowl', calories: 580 },
  snacks: { logged: true, name: 'Roasted Almonds', calories: 180 },
};

const FIXTURE_USER_MEALS_PARTIAL: Record<MealType, MealStatus> = {
  breakfast: { logged: true, name: 'Oatmeal', calories: 380 },
  lunch: { logged: true, name: 'Rice & Dal', calories: 520 },
  dinner: { logged: false },
  snacks: { logged: false },
};

const FIXTURE_PARTNER_MEALS_COMPLETE: Record<MealType, MealStatus> = {
  breakfast: { logged: true, name: 'Poha', calories: 350 },
  lunch: { logged: true, name: 'Roti & Sabzi', calories: 480 },
  dinner: { logged: true, name: 'Soup & Paneer', calories: 510 },
  snacks: { logged: true, name: 'Fruit Bowl', calories: 160 },
};

const FIXTURE_PARTNER_MEALS_EMPTY: Record<MealType, MealStatus> = {
  breakfast: { logged: false },
  lunch: { logged: false },
  dinner: { logged: false },
  snacks: { logged: false },
};

const FIXTURE_3PLUS_MEMBERS: RoomMemberSummary[] = [
  { id: '1', name: 'Priya', identityHue: 'teal', percent: 64, hasLoggedToday: true },
  { id: '2', name: 'Rahul', identityHue: 'mint', percent: 85, hasLoggedToday: true },
  { id: '3', name: 'Ananya', identityHue: 'rose', percent: 40, hasLoggedToday: false },
  { id: '4', name: 'Dev', identityHue: 'sky', percent: 110, hasLoggedToday: true },
];

export default function ComponentGalleryScreen(): React.JSX.Element | null {
  const router = useRouter();
  const { reduceMotion } = useTheme();

  // Dev controls
  const [motionOverride, setMotionOverride] = useState(reduceMotion);
  const [textScale, setTextScale] = useState<'1.0' | '1.3' | '2.0'>('1.0');

  // Interactive component states
  const [selectedChip, setSelectedChip] = useState('Breakfast');
  const [segmentVal, setSegmentVal] = useState('today');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnap, setSheetSnap] = useState<'half' | 'tall'>('half');
  const [stepperVal, setStepperVal] = useState(250);
  const [switchVal, setSwitchVal] = useState(true);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMsg, setToastMsg] = useState('Lunch logged (520 kcal)');
  const [fieldVal, setFieldVal] = useState('');
  const [primerOpen, setPrimerOpen] = useState(false);

  // UI-3 Signature Interactive States
  const [fuseAnimTrigger, setFuseAnimTrigger] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState('1');
  const [nudgesSent, setNudgesSent] = useState(0);

  // If in production build, disable gallery route
  if (!__DEV__) {
    return null;
  }

  const multiplier = textScale === '2.0' ? 2.0 : textScale === '1.3' ? 1.3 : 1.0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Button size="sm" variant="tertiary" label="← Back" onPress={() => router.back()} />
          <Text variant="title1" color={dark.textHi}>
            UI-2 Component Gallery
          </Text>
          <Text variant="bodyS" color={dark.textMid}>
            All core components rendered in dark espresso with warm apricot accents.
          </Text>
        </View>

        {/* Dev Controls Bar */}
        <Card elevation="s2" style={styles.controlCard}>
          <Text variant="heading" color={dark.apricot}>
            Gallery Controls
          </Text>
          <View style={styles.controlRow}>
            <Text variant="label" color={dark.textMid}>
              Text Scale:
            </Text>
            <SegmentedControl
              options={[
                { value: '1.0', label: '1.0×' },
                { value: '1.3', label: '1.3× (Max Tab)' },
                { value: '2.0', label: '2.0× (A11y)' },
              ]}
              value={textScale}
              onChange={(val) => setTextScale(val as '1.0' | '1.3' | '2.0')}
              fullWidth={false}
            />
          </View>
          <SwitchRow
            title="Reduce Motion"
            consequence="Replaces sweep transitions with instant 120ms crossfade"
            value={motionOverride}
            onValueChange={setMotionOverride}
          />
        </Card>

        {/* 1. Typography & Text Variants */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            1. Typography Scale (Text.tsx)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="numeralXL" maxFontSizeMultiplier={multiplier}>
              2,450 kcal
            </Text>
            <Text variant="numeralL" maxFontSizeMultiplier={multiplier}>
              34:12 numeralL
            </Text>
            <Text variant="numeralM" maxFontSizeMultiplier={multiplier}>
              1,280 numeralM
            </Text>
            <Text variant="title1" maxFontSizeMultiplier={multiplier}>
              Title 1 Bricolage
            </Text>
            <Text variant="title2" maxFontSizeMultiplier={multiplier}>
              Title 2 Section Title
            </Text>
            <Text variant="heading" maxFontSizeMultiplier={multiplier}>
              Heading Figtree 600
            </Text>
            <Text variant="body" maxFontSizeMultiplier={multiplier}>
              Body Figtree 400 — Warm, clean, and highly readable.
            </Text>
            <Text variant="bodyS" maxFontSizeMultiplier={multiplier}>
              BodyS secondary text for metadata and captions.
            </Text>
            <Text variant="label" maxFontSizeMultiplier={multiplier}>
              Label 13sp for chips, tabs, and tags
            </Text>
            <Text variant="micro" maxFontSizeMultiplier={multiplier}>
              Micro 11sp non-critical helper text
            </Text>
          </Card>
        </View>

        {/* 2. Buttons (CMP-01) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            2. Buttons (CMP-01)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="label" color={dark.textMid}>
              Primary (Apricot fill, dark onBrand text, 56h)
            </Text>
            <Button
              variant="primary"
              label="Add to lunch"
              fullWidth
              onPress={() => setToastVisible(true)}
            />

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Secondary (HairlineLit border, textHi label)
            </Text>
            <Button variant="secondary" label="View past meals" fullWidth onPress={() => {}} />

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Tertiary & Destructive
            </Text>
            <View style={styles.rowWrap}>
              <Button variant="tertiary" size="md" label="Cancel" onPress={() => {}} />
              <Button variant="destructive" size="md" label="Delete entry" onPress={() => {}} />
            </View>

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              States: Loading & Disabled
            </Text>
            <View style={styles.rowWrap}>
              <Button variant="primary" size="md" label="Saving" loading />
              <Button variant="primary" size="md" label="Disabled" disabled />
            </View>
          </Card>
        </View>

        {/* 3. Chips & Segmented Control (CMP-02) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            3. Chips & Segmented Control (CMP-02)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="label" color={dark.textMid}>
              Chips (36h, 44px hit area, 12 radius)
            </Text>
            <View style={styles.rowWrap}>
              {['Breakfast', 'Lunch', 'Dinner', 'Snacks'].map((meal) => (
                <Chip
                  key={meal}
                  label={meal}
                  selected={selectedChip === meal}
                  onPress={() => setSelectedChip(meal)}
                />
              ))}
            </View>

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Segmented Control (40h, 12 radius)
            </Text>
            <SegmentedControl
              options={[
                { value: 'today', label: 'Today' },
                { value: 'members', label: 'Members', badge: 3 },
                { value: 'chat', label: 'Chat' },
              ]}
              value={segmentVal}
              onChange={setSegmentVal}
            />
          </Card>
        </View>

        {/* 4. Cards & Surface Elevation (CMP-03) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            4. Cards (CMP-03)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="heading" color={dark.textHi}>
              Standard Card (s1)
            </Text>
            <Text variant="bodyS" color={dark.textMid}>
              Radius 20, 1px hairline border, top highlight, 16px inner padding.
            </Text>
          </Card>
          <Card elevation="s2" lit style={[styles.sectionCard, { marginTop: space[3] }]}>
            <Text variant="heading" color={dark.textHi}>
              Raised Card with Lit Edge (s2)
            </Text>
            <Text variant="bodyS" color={dark.textMid}>
              Higher elevation step with hairlineLit border (4.06:1 contrast).
            </Text>
          </Card>
        </View>

        {/* 5. Fields & Stepper (CMP-06) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            5. Fields & Stepper (CMP-06)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Field
              label="Food name"
              placeholder="e.g., Masala Dosa"
              value={fieldVal}
              onChangeText={setFieldVal}
            />
            <Field label="Calories" placeholder="450" keyboardType="numeric" unitSuffix="kcal" />
            <Field
              label="Username (error state demonstration)"
              value="invalid username!"
              error="Use 3 to 20 letters, numbers, . or _"
            />

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Numeric Stepper (48×48 buttons, tabular numeral)
            </Text>
            <Stepper
              value={stepperVal}
              onChange={setStepperVal}
              min={50}
              max={1000}
              step={25}
              unit="g"
            />
          </Card>
        </View>

        {/* 6. ListRow (CMP-07) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            6. List Rows (CMP-07)
          </Text>
          <Card elevation="s1" padding={0} style={styles.sectionCard}>
            <ListRow
              title="Daily Calorie Target"
              subtitle="2,100 kcal / day"
              leading={<Ionicons name="flame-outline" size={24} color={dark.apricot} />}
              trailing={
                <Text variant="heading" color={dark.textHi}>
                  2,100
                </Text>
              }
              onPress={() => {}}
            />
            <ListRow
              title="Water Reminder"
              subtitle="Every 2 hours during day"
              leading={<Ionicons name="water-outline" size={24} color={dark.teal} />}
              trailing={<Ionicons name="chevron-forward" size={18} color={dark.textLo} />}
              onPress={() => {}}
            />
            <ListRow
              title="Notifications"
              subtitle="Manage sound and haptics"
              leading={<Ionicons name="notifications-outline" size={24} color={dark.iris} />}
              showDivider={false}
              onPress={() => {}}
            />
          </Card>
        </View>

        {/* 7. Avatar (CMP-08) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            7. Avatars (CMP-08)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="bodyS" color={dark.textMid}>
              Sizes 24, 36, 40, 72 with identity rings and presence dots (never green).
            </Text>
            <View style={styles.avatarRow}>
              <Avatar size="xs" name="Alex" identityHue="iris" />
              <Avatar size="sm" name="Priya Patel" identityHue="teal" presence />
              <Avatar size="md" name="Shiba Maity" identityHue="rose" presence />
              <Avatar size="lg" name="Coach Ari" identityHue="mint" />
            </View>
          </Card>
        </View>

        {/* 8. Toast, Banner & SyncPill (CMP-15) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            8. Toast, Banner & Sync Pill (CMP-15)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="label" color={dark.textMid}>
              Sync Pills (Header status)
            </Text>
            <View style={styles.rowWrap}>
              <SyncPill status="offline" />
              <SyncPill status="syncing" />
              <SyncPill status="synced" />
            </View>

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Inline Banners
            </Text>
            <Banner
              title="Room almost full"
              subtitle="4 of 5 member spots occupied. Upgrade to Plus for up to 12 members."
              variant="brand"
              actionLabel="View plans"
              onAction={() => {}}
              icon={<Ionicons name="people" size={22} color={dark.apricot} />}
            />

            <Button
              variant="secondary"
              size="md"
              label="Trigger Toast with Undo (4s)"
              onPress={() => setToastVisible(true)}
              style={{ marginTop: space[3] }}
            />
          </Card>
        </View>

        {/* 9. SwitchRow (CMP-16) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            9. Switch Row (CMP-16)
          </Text>
          <Card elevation="s1" padding={0} style={styles.sectionCard}>
            <SwitchRow
              title="Share food log with partners"
              consequence="Partners in your room can see meal items and portions."
              value={switchVal}
              onValueChange={setSwitchVal}
            />
          </Card>
        </View>

        {/* 10. Skeletons (CMP-18) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            10. Skeletons (CMP-18, No Shimmer)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Skeleton.ListRow />
            <Skeleton.Card style={{ marginTop: space[3] }} />
          </Card>
        </View>

        {/* 11. VisibilityEye & HiddenMetric (CMP-23, CMP-25) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            11. Visibility & Privacy (CMP-23, CMP-25)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <View style={styles.rowBetween}>
              <View>
                <Text variant="heading" color={dark.textHi}>
                  Oatmeal with berries (420 kcal)
                </Text>
                <Text variant="bodyS" color={dark.textMid}>
                  Logged at 8:30 AM
                </Text>
              </View>
              <VisibilityEye audience="Room partners" />
            </View>

            <View style={[styles.rowBetween, { marginTop: space[4] }]}>
              <Text variant="heading" color={dark.textHi}>
                Partner weight
              </Text>
              <HiddenMetric label="Not shared" />
            </View>
          </Card>
        </View>

        {/* 12. Empty State (CMP-17) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            12. Empty State (CMP-17)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <EmptyState
              icon={<Ionicons name="restaurant-outline" size={36} color={dark.apricot} />}
              title="No foods logged today"
              description="Log breakfast, lunch or snacks to track your calorie and macro progress together."
              actionLabel="Add food"
              onAction={() => {}}
            />
          </Card>
        </View>

        {/* 13. Sheets & Permission Primer (CMP-04, CMP-24) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            13. Sheets & Permission Primer (CMP-04, CMP-24)
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <View style={styles.rowWrap}>
              <Button
                variant="secondary"
                size="md"
                label="Open Half Sheet"
                onPress={() => {
                  setSheetSnap('half');
                  setSheetOpen(true);
                }}
              />
              <Button
                variant="secondary"
                size="md"
                label="Open Tall Sheet"
                onPress={() => {
                  setSheetSnap('tall');
                  setSheetOpen(true);
                }}
              />
              <Button
                variant="primary"
                size="md"
                label="Open Permission Primer"
                onPress={() => setPrimerOpen(true)}
              />
            </View>
          </Card>
        </View>

        {/* ========================================================= */}
        {/* UI-3 SIGNATURE COMPONENTS (CMP-09 to CMP-13, CMP-21)      */}
        {/* ========================================================= */}

        {/* 14. PairRing (CMP-09 & Spec 5.2) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            14. PairRing (CMP-09, Spec 5.2)
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.sectionDesc}>
            Two arcs on one circle: outer You (10px at 184), inner Partner (7px, 6px gap). Round
            caps, glow at 100%, cream second lap past 100%, partner percent pill at arc end.
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <Text variant="label" color={dark.textMid}>
              Sizes 184 (Room Hero), 120 (Today Strip), 64 (List Overview)
            </Text>
            <View style={styles.ringShowcaseRow}>
              <View style={styles.ringItem}>
                <PairRing
                  size={184}
                  userPercent={78}
                  partnerPercent={64}
                  partnerName="Priya"
                  remainingAmount="1,180"
                />
                <Text variant="micro" color={dark.textMid} style={styles.ringLabel}>
                  184dp Standard (78% / 64%)
                </Text>
              </View>

              <View style={styles.ringItem}>
                <PairRing size={120} userPercent={100} partnerPercent={100} partnerName="Priya" />
                <Text variant="micro" color={dark.textMid} style={styles.ringLabel}>
                  120dp 100% Both Glow
                </Text>
              </View>

              <View style={styles.ringItem}>
                <PairRing size={64} userPercent={85} partnerPercent={70} partnerName="Priya" />
                <Text variant="micro" color={dark.textMid} style={styles.ringLabel}>
                  64dp List View
                </Text>
              </View>
            </View>

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              Over Goal (Cream Second Lap on Top, Max Two Laps)
            </Text>
            <View style={styles.ringCenter}>
              <PairRing
                size={184}
                userPercent={125}
                partnerPercent={92}
                partnerName="Priya"
                overAmount="320"
              />
            </View>
          </Card>
        </View>

        {/* 15. The Seam & Day-Complete Fuse (CMP-10 & Spec 5.3) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            15. The Seam (CMP-10, Spec 5.3)
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.sectionDesc}>
            1px vertical line with inset 24. Broken (6px dashes), Half-lit (finished person hue +
            5px dot), and Fused (sweeping in from both ends over 900ms with 2px iris-teal glow
            gradient).
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <View style={styles.seamGrid}>
              <View style={styles.seamCell}>
                <Text variant="label" color={dark.textMid}>
                  Broken
                </Text>
                <Seam state="broken" length={160} />
                <Text variant="micro" color={dark.textLo} style={styles.seamSubText}>
                  Neither logged
                </Text>
              </View>
              <View style={styles.seamCell}>
                <Text variant="label" color={dark.textMid}>
                  Half-lit (You)
                </Text>
                <Seam state="half-lit" finishedPerson="user" length={160} />
                <Text variant="micro" color={dark.textLo} style={styles.seamSubText}>
                  Dot on left
                </Text>
              </View>
              <View style={styles.seamCell}>
                <Text variant="label" color={dark.textMid}>
                  Half-lit (Partner)
                </Text>
                <Seam state="half-lit" finishedPerson="partner" length={160} />
                <Text variant="micro" color={dark.textLo} style={styles.seamSubText}>
                  Dot on right
                </Text>
              </View>
              <View style={styles.seamCell}>
                <Text variant="label" color={dark.textMid}>
                  Fused
                </Text>
                <Seam state="fused" streakDays={12} length={160} triggerFuse={fuseAnimTrigger} />
                <Text variant="micro" color={dark.textLo} style={styles.seamSubText}>
                  2px gradient glow
                </Text>
              </View>
            </View>

            <Button
              variant="primary"
              label="Trigger Seam Fuse Animation (900ms sweep)"
              onPress={() => {
                setFuseAnimTrigger(false);
                setTimeout(() => setFuseAnimTrigger(true), 50);
              }}
              style={{ marginTop: space[3] }}
            />
          </Card>
        </View>

        {/* 16. PairedCard Hero — All Required States (Spec J01, 5.4, 5.5) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            16. PairedCard Hero (All 9 Spec States)
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.sectionDesc}>
            Side-by-side room card composing PairRing, mirrored PersonColumns, central Seam, and
            NudgeButton.
          </Text>

          {/* State 1: Fused (Both logged, Day 12) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 1: Fused (Both Logged Today · Day 12)
          </Text>
          <PairedCard
            userPercent={88}
            userSteps={9420}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            partnerPercent={76}
            partnerSteps={8100}
            partnerMeals={FIXTURE_PARTNER_MEALS_COMPLETE}
            seamState="fused"
            streakDays={12}
            nudgesSentToday={nudgesSent}
            onNudge={() => {
              setNudgesSent((n) => n + 1);
              setToastMsg('Nudged Priya');
              setToastVisible(true);
            }}
            onNudgeLimit={(msg) => {
              setToastMsg(msg);
              setToastVisible(true);
            }}
          />

          {/* State 2: Half-Lit (User finished, partner not logged yet) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            {"State 2: Half-Lit (You Finished · Priya Hasn't Logged)"}
          </Text>
          <PairedCard
            userPercent={80}
            userSteps={8200}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            partnerPercent={0}
            partnerSteps={1200}
            partnerMeals={FIXTURE_PARTNER_MEALS_EMPTY}
            seamState="half-lit"
            finishedPerson="user"
          />

          {/* State 3: Partner Not Logged (Broken Seam) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 3: Partner Not Logged (Broken Seam)
          </Text>
          <PairedCard
            userPercent={45}
            userSteps={4100}
            userMeals={FIXTURE_USER_MEALS_PARTIAL}
            partnerPercent={0}
            partnerSteps={800}
            partnerMeals={FIXTURE_PARTNER_MEALS_EMPTY}
            seamState="broken"
          />

          {/* State 4: Over Goal (Cream Second Lap, "320 over") */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            {'State 4: Over Goal (Cream Second Lap + "320 over")'}
          </Text>
          <PairedCard
            userPercent={125}
            userOverAmount="320"
            userSteps={11500}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            partnerPercent={82}
            partnerSteps={8900}
            partnerMeals={FIXTURE_PARTNER_MEALS_COMPLETE}
            seamState="fused"
            streakDays={15}
          />

          {/* State 5: Hidden Data (CMP-25 Neutral Lock) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 5: Hidden Data (CMP-25 Neutral Lock, Never Zero)
          </Text>
          <PairedCard
            userPercent={78}
            userSteps={8400}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            partnerPercent={64}
            partnerSteps={0}
            partnerMeals={FIXTURE_PARTNER_MEALS_COMPLETE}
            isPartnerDataHidden={true}
            seamState="half-lit"
            finishedPerson="user"
          />

          {/* State 6: Paused Participation (ROOM-10) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            {'State 6: Paused Participation ("Paused until 24 Oct")'}
          </Text>
          <PairedCard
            userPercent={72}
            userSteps={7600}
            userMeals={FIXTURE_USER_MEALS_PARTIAL}
            partnerPercent={0}
            isPartnerPaused={true}
            partnerPauseUntilDate="24 Oct"
            seamState="half-lit"
            finishedPerson="user"
          />

          {/* State 7: No Partner Yet (Dashed Placeholder Half) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 7: No Partner Yet (Dashed Outline Placeholder Half)
          </Text>
          <PairedCard
            hasPartner={false}
            userPercent={65}
            userSteps={6200}
            userMeals={FIXTURE_USER_MEALS_PARTIAL}
            seamState="broken"
            onInviteFriend={() => {
              setToastMsg('Invite link copied');
              setToastVisible(true);
            }}
            onFindPartner={() => {
              setToastMsg('Opening Partner Finder');
              setToastVisible(true);
            }}
          />

          {/* State 8: 3+ People Selector (Avatar Strip & Comparison) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 8: 3+ People Selector (Spec J02 Strip & Swap)
          </Text>
          <PairedCard
            userPercent={88}
            userSteps={9200}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            members={FIXTURE_3PLUS_MEMBERS}
            selectedMemberId={selectedMemberId}
            onSelectMember={setSelectedMemberId}
            partnerName={
              FIXTURE_3PLUS_MEMBERS.find((m) => m.id === selectedMemberId)?.name || 'Priya'
            }
            partnerHue={
              FIXTURE_3PLUS_MEMBERS.find((m) => m.id === selectedMemberId)?.identityHue || 'teal'
            }
            partnerPercent={
              FIXTURE_3PLUS_MEMBERS.find((m) => m.id === selectedMemberId)?.percent || 64
            }
            partnerSteps={8100}
            partnerMeals={FIXTURE_PARTNER_MEALS_COMPLETE}
            seamState="fused"
            streakDays={9}
          />

          {/* State 9: Reflow Layout (Stacked Columns at 200% Text Scale) */}
          <Text variant="heading" color={dark.textHi} style={styles.stateHeading}>
            State 9: Reflow Layout (Stacked Columns, Horizontal Seam)
          </Text>
          <PairedCard
            forceReflow={true}
            userPercent={88}
            userSteps={9420}
            userMeals={FIXTURE_USER_MEALS_COMPLETE}
            partnerPercent={76}
            partnerSteps={8100}
            partnerMeals={FIXTURE_PARTNER_MEALS_COMPLETE}
            seamState="fused"
            streakDays={12}
          />
        </View>

        {/* 17. CalorieRing & MacroBar (CMP-13) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            17. CalorieRing & MacroBar (CMP-13)
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.sectionDesc}>
            {"Single-person ring for Today screen in owner's identity hue (never apricot)."}
            {' Macro bar in 100/55/28% identity opacity steps with gram values under.'}
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <View style={styles.calorieRow}>
              <View style={styles.ringItem}>
                <CalorieRing eaten={1450} target={2100} identityHue="iris" />
                <Text variant="micro" color={dark.textMid} style={styles.ringLabel}>
                  Remaining Mode (650 left)
                </Text>
              </View>
              <View style={styles.ringItem}>
                <CalorieRing eaten={2420} target={2100} identityHue="teal" />
                <Text variant="micro" color={dark.textMid} style={styles.ringLabel}>
                  Over Goal (Cream Second Lap)
                </Text>
              </View>
            </View>

            <Text variant="label" color={dark.textMid} style={styles.subLabel}>
              MacroBar (Three Tonal Steps of Identity Hue)
            </Text>
            <MacroBar
              proteinGrams={140}
              carbsGrams={210}
              fatGrams={55}
              proteinTargetGrams={150}
              carbsTargetGrams={240}
              fatTargetGrams={65}
              identityHue="iris"
            />
          </Card>
        </View>

        {/* 18. TimerDisplay (CMP-21) */}
        <View style={styles.section}>
          <Text variant="heading" color={dark.apricot} style={styles.sectionTitle}>
            18. TimerDisplay (CMP-21)
          </Text>
          <Text variant="bodyS" color={dark.textMid} style={styles.sectionDesc}>
            Tabular numeral time computed from stored UTC timestamps (never an accumulating
            counter). Thin 6px progress ring.
          </Text>
          <Card elevation="s1" style={styles.sectionCard}>
            <View style={styles.timerRow}>
              <View style={styles.ringItem}>
                <TimerDisplay
                  startedAtUtc={Date.now() - 14 * 3600 * 1000 - 22 * 60 * 1000}
                  durationMinutes={16 * 60}
                  mode="elapsed"
                  title="Fasting Duration"
                  subtitle="16:8 Protocol"
                  accentColor={dark.teal}
                />
              </View>
            </View>
          </Card>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Floating Toast */}
      <Toast
        visible={toastVisible}
        message={toastMsg}
        undoLabel="Undo"
        onUndo={() => {}}
        onDismiss={() => setToastVisible(false)}
      />

      {/* Demo Sheet */}
      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        snapPoint={sheetSnap}
        accessibilityLabel="Demo Bottom Sheet"
      >
        <View style={styles.sheetBody}>
          <Text variant="title2" color={dark.textHi}>
            {sheetSnap === 'half' ? 'Half Sheet' : 'Tall Sheet'}
          </Text>
          <Text variant="body" color={dark.textMid}>
            Radius 28 on top corners, 36×4 hairlineLit grabber, 55% black scrim. Tap backdrop or
            button to dismiss.
          </Text>
          <Button
            variant="primary"
            fullWidth
            label="Close sheet"
            onPress={() => setSheetOpen(false)}
            style={{ marginTop: space[4] }}
          />
        </View>
      </Sheet>

      {/* Permission Primer Sheet */}
      <Sheet visible={primerOpen} onClose={() => setPrimerOpen(false)} snapPoint="tall">
        <PermissionPrimer
          icon={<Ionicons name="notifications-outline" size={32} color={dark.apricot} />}
          title="Stay synced with your partner"
          subtitle="Timely nudges and meal updates help both of you hit your targets."
          whatWeRead="Activity status and meal timestamps"
          whatWeWrite="Local meal and water reminders on this phone"
          whatWeNeverDo="We never send marketing notifications or sell your data"
          allowLabel="Enable notifications"
          denyLabel="Maybe later"
          onAllow={() => setPrimerOpen(false)}
          onDeny={() => setPrimerOpen(false)}
        />
      </Sheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  scrollContent: {
    padding: space[4], // 16
    paddingBottom: 40,
  },
  header: {
    marginBottom: space[5], // 20
    gap: space[2], // 8
  },
  controlCard: {
    marginBottom: space[5], // 20
    gap: space[3], // 12
    borderColor: dark.apricot,
  },
  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  section: {
    marginBottom: space[6], // 24
  },
  sectionTitle: {
    marginBottom: space[2], // 8
  },
  sectionDesc: {
    marginBottom: space[3],
  },
  stateHeading: {
    marginTop: space[4],
    marginBottom: space[2],
  },
  sectionCard: {
    gap: space[3], // 12
  },
  subLabel: {
    marginTop: space[3], // 12
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2], // 8
    alignItems: 'center',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[4], // 16
    paddingVertical: space[2],
  },
  sheetBody: {
    padding: space[5], // 20
    gap: space[3], // 12
  },
  ringShowcaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: space[3],
  },
  ringItem: {
    alignItems: 'center',
    gap: space[2],
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
  },
  ringLabel: {
    textAlign: 'center',
  },
  seamGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'flex-start',
    paddingVertical: space[2],
  },
  seamCell: {
    alignItems: 'center',
    gap: space[2],
  },
  seamSubText: {
    marginTop: 4,
  },
  calorieRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: space[4],
    paddingVertical: space[2],
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexWrap: 'wrap',
    gap: space[4],
    paddingVertical: space[2],
  },
});
