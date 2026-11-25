import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  reduced: false,
}));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'RNText',
  TextInput: 'TextInput',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Modal: 'Modal',
  ActivityIndicator: 'ActivityIndicator',
  KeyboardAvoidingView: 'KeyboardAvoidingView',
  Platform: { OS: 'web' },
  Animated: {
    View: 'AnimatedView',
    Value: class {
      private current: number;
      constructor(initial: number) {
        this.current = initial;
      }
      setValue(val: number) {
        this.current = val;
      }
      interpolate() {
        return this.current;
      }
      addListener() {
        return '1';
      }
      removeListener() {}
    },
    timing: (_v: unknown, _cfg: unknown) => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
    spring: (_v: unknown, _cfg: unknown) => ({ start: (cb?: () => void) => cb?.(), stop: vi.fn() }),
    loop: () => ({ start: vi.fn(), stop: vi.fn() }),
    sequence: () => ({ start: vi.fn(), stop: vi.fn() }),
  },
  Easing: { out: (fn: unknown) => fn, cubic: (t: number) => t },
  StyleSheet: {
    create: <T,>(v: T) => v,
    flatten: (v: unknown) =>
      Array.isArray(v) ? Object.assign({}, ...v.flat(Infinity).filter(Boolean)) : v,
    absoluteFill: {},
    absoluteFillObject: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  },
}));

vi.mock('react-native-svg', () => ({
  default: 'Svg',
  Svg: 'Svg',
  Circle: 'Circle',
  Line: 'Line',
  Path: 'Path',
  Polyline: 'Polyline',
  Rect: 'Rect',
  Defs: 'Defs',
  LinearGradient: 'LinearGradient',
  Stop: 'Stop',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 44, bottom: 34, left: 0, right: 0 }),
}));

vi.mock('../theme/useTheme', () => ({
  useTheme: () => ({ reduceMotion: state.reduced, reduceTransparency: false }),
}));

import { View } from 'react-native';
import { getContrastRatio } from '../contrast';
import {
  AddButton,
  AppleIcon,
  ArrowRightIcon,
  AvatarRing,
  Badge,
  BarcodeIcon,
  BigNameField,
  BookmarkIcon,
  BowlIcon,
  CameraIcon,
  Card,
  ChartBarIcon,
  Checkbox,
  Chip,
  colors,
  EditIcon,
  elevation,
  EyeIcon,
  EyeOffIcon,
  FeedImageIcon,
  FloatingTabBar,
  fonts,
  GoogleIcon,
  Heatmap,
  heatmapScale,
  HistoryClockIcon,
  HomeIcon,
  IconButton,
  Input,
  layout,
  LeaderboardRow,
  LinkButton,
  ListRow,
  LogFabButton,
  macroColors,
  MealRow,
  MoonIcon,
  motion,
  ScanIcon,
  SunIcon,
  UtensilsIcon,
  NotificationPreview,
  NumberWithUnit,
  OptionCard,
  OptionTile,
  PageDots,
  PauseButton,
  PrimaryButton,
  ProgressBar,
  QuantityButton,
  Radio,
  radius,
  Ring,
  RulerPicker,
  ScreenTitle,
  ScreenWrapper,
  SecondaryButton,
  Segmented,
  SegmentedProgress,
  Sheet,
  SocialButton,
  space,
  StartButton,
  Switch,
  SwitchRow,
  Text,
  ToastBar,
  type,
} from './index';

let tree: ReactTestRenderer | undefined;

beforeEach(() => {
  state.reduced = false;
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});

afterEach(async () => {
  if (tree) {
    await act(async () => tree!.unmount());
    tree = undefined;
  }
});

describe('CaliPartner Design System v1 — Tokens & Contrast', () => {
  it('matches exact Section 2 palette hex and alpha values without green or blue', () => {
    expect(colors.bg0).toBe('#0E0B08');
    expect(colors.s1).toBe('#1A1511');
    expect(colors.s2).toBe('#241E18');
    expect(colors.s3).toBe('#2F2821');
    expect(colors.hairline).toBe('#3A3228');
    expect(colors.hairlineLit).toBe('#85755F');
    expect(colors.textHi).toBe('#F7F0E7');
    expect(colors.textMid).toBe('#C9BCAC');
    expect(colors.textLo).toBe('#9A8E7F');
    expect(colors.textOff).toBe('#6F6558');
    expect(colors.apricot).toBe('#F4B67D');
    expect(colors.apricotPressed).toBe('#E19A5C');
    expect(colors.onBrand).toBe('#1C1109');
    expect(colors.danger).toBe('#F65C58');
    expect(colors.onDanger).toBe('#1C1109');
    expect(colors.scrim).toBe('rgba(14,11,8,0.80)');
    expect(colors.apricotHalo).toBe('rgba(244,182,125,0.20)');
    expect(colors).not.toHaveProperty('green');
    expect(colors).not.toHaveProperty('blue');
    expect(colors).not.toHaveProperty('mint');
    expect(colors).not.toHaveProperty('teal');

    expect(macroColors).toEqual({
      protein: colors.apricot,
      carbs: colors.apricotPressed,
      fat: colors.hairlineLit,
    });
    expect(heatmapScale).toEqual([colors.s3, colors.heat1, colors.heat2, colors.apricot]);
  });

  it('meets all computed Section 2 contrast benchmarks', () => {
    expect(getContrastRatio(colors.textHi, colors.bg0)).toBeGreaterThanOrEqual(17);
    expect(getContrastRatio(colors.textMid, colors.bg0)).toBeGreaterThanOrEqual(10);
    expect(getContrastRatio(colors.textLo, colors.bg0)).toBeGreaterThanOrEqual(6);
    expect(getContrastRatio(colors.textLo, colors.s3)).toBeGreaterThanOrEqual(4.5);
    expect(getContrastRatio(colors.apricot, colors.bg0)).toBeGreaterThanOrEqual(11);
    expect(getContrastRatio(colors.onBrand, colors.apricot)).toBeGreaterThanOrEqual(10);
    expect(getContrastRatio(colors.danger, colors.bg0)).toBeGreaterThanOrEqual(6);
  });

  it('defines Fraunces + Manrope fonts and complete Section 3/4/7 tokens', () => {
    expect(fonts.display).toBe('Fraunces_500Medium');
    expect(fonts.displayItalic).toBe('Fraunces_500Medium_Italic');
    expect(fonts.regular).toBe('Manrope_400Regular');
    expect(fonts.bold).toBe('Manrope_700Bold');
    expect(fonts.extrabold).toBe('Manrope_800ExtraBold');

    expect(type.displayXL.fontSize).toBe(104);
    expect(type.displayL.fontSize).toBe(40);
    expect(type.title.fontSize).toBe(34);
    expect(type.numXL.fontVariant).toEqual(['tabular-nums']);
    expect(type.eyebrow.textTransform).toBe('uppercase');
    expect(type.eyebrow.letterSpacing).toBe(1.7);

    expect(space.xxl).toBe(24);
    expect(layout.screenPaddingX).toBe(24);
    expect(layout.tabBarClearance).toBe(150);
    expect(radius.button).toBe(28);
    expect(radius.card).toBe(22);
    expect(radius.sheet).toBe(32);
    expect(motion.press.scale).toBe(0.98);
    expect(motion.sheetSpring).toEqual({ damping: 20, stiffness: 220, mass: 1 });
    expect(motion.ringFill.duration).toBe(700);
    expect(elevation.logButton.shadowColor).toBe(colors.apricot);
  });
});

describe('CaliPartner Design System v1 — Foundation & Primitives', () => {
  it('renders Text and NumberWithUnit with proper dynamic scaling caps', async () => {
    await act(async () => {
      tree = create(
        <>
          <Text variant="displayL" testID="headline">
            Ready
          </Text>
          <Text variant="body" testID="copy">
            Stay steady
          </Text>
          <NumberWithUnit value={72.5} unit="kg" testID="weight" />
        </>,
      );
    });
    const headline = tree!.root
      .findAllByProps({ testID: 'headline' })
      .find((n) => String(n.type) === 'RNText')!;
    const copy = tree!.root
      .findAllByProps({ testID: 'copy' })
      .find((n) => String(n.type) === 'RNText')!;
    expect(headline.props.maxFontSizeMultiplier).toBe(1.2);
    expect(copy.props.maxFontSizeMultiplier).toBe(2);
    expect(tree!.root.findByProps({ testID: 'weight' })).toBeDefined();
  });

  it('renders ScreenWrapper and ScreenTitle with a single italic apricot accent word', async () => {
    await act(async () => {
      tree = create(
        <ScreenWrapper scroll hasTabBar testID="screen" footer={<PrimaryButton title="Next" />}>
          <ScreenTitle
            eyebrow="YOUR GOAL"
            title="What are you training for?"
            accentWord="for?"
            subtitle="Pick one main focus right now."
            testID="title-block"
          />
        </ScreenWrapper>,
      );
    });
    const wrapper = tree!.root
      .findAllByProps({ testID: 'screen' })
      .find((n) => String(n.type) === 'View')!;
    expect(wrapper.props.style[0].backgroundColor).toBe(colors.bg0);
    const titleNode = tree!.root
      .findAllByProps({ testID: 'title-block-title' })
      .find((n) => String(n.type) === 'RNText')!;
    const innerTexts = titleNode.findAllByType('RNText' as React.ElementType);
    const accentSpan = innerTexts.find(
      (node) => node.props.children === 'for?' && node.props.style,
    );
    expect(accentSpan).toBeDefined();
  });

  it('renders all Section 6 primitives with accessible roles and states', async () => {
    const press = vi.fn();
    await act(async () => {
      tree = create(
        <View>
          <PrimaryButton title="Continue" showArrow onPress={press} testID="btn-primary" />
          <PrimaryButton title="Disabled" disabled testID="btn-disabled" />
          <SecondaryButton title="Skip" onPress={press} testID="btn-secondary" />
          <LinkButton title="Learn more" variant="accent" onPress={press} testID="btn-link" />
          <IconButton
            icon={<HomeIcon />}
            accessibilityLabel="Home"
            onPress={press}
            testID="btn-icon"
          />
          <AddButton accessibilityLabel="Add" onPress={press} testID="btn-add" />
          <QuantityButton glyph="+" accessibilityLabel="More" onPress={press} testID="btn-qty" />
          <SocialButton
            provider="apple"
            title="Continue with Apple"
            icon={<ArrowRightIcon />}
            onPress={press}
            testID="btn-apple"
          />
          <StartButton onPress={press} testID="btn-start" />
          <PauseButton onPress={press} testID="btn-pause" />
          <LogFabButton onPress={press} testID="btn-fab" />
          <Chip label="Strength" selected locked onPress={press} testID="chip" />
          <Segmented
            options={[
              { value: 'a', label: '7d' },
              { value: 'b', label: '30d' },
            ]}
            value="a"
            onChange={press}
            testID="seg"
          />
          <PageDots count={4} activeIndex={1} testID="dots" />
          <Switch value onValueChange={press} accessibilityLabel="Reminders" testID="sw" />
          <Checkbox checked onChange={press} accessibilityLabel="Agree" testID="cb" />
          <Radio selected onSelect={press} accessibilityLabel="Option A" testID="rad" />
          <OptionCard
            title="Cut"
            subtitle="Lose fat slowly"
            selected
            onPress={press}
            testID="opt"
          />
          <OptionTile title="Meals" meta="4/day" selected onPress={press} testID="tile" />
          <Input label="Email" error="Invalid email" testID="inp" />
          <BigNameField placeholder="Your name" testID="bigname" />
          <ProgressBar progress={0.5} testID="pbar" />
          <SegmentedProgress total={5} completed={3} testID="sbar" />
          <Ring progress={0.75} testID="ring" />
          <AvatarRing initial="A" progress={0.8} testID="aring" />
          <RulerPicker min={40} max={120} value={70} onChange={press} unit="kg" testID="ruler" />
          <RulerPicker
            vertical
            inverted
            align="right"
            min={120}
            max={230}
            value={178}
            step={1}
            majorStep={10}
            midStep={5}
            tickGap={9}
            onChange={press}
            unit="cm"
            testID="vruler"
          />
          <Heatmap columns={[[0, 1, 2, 3]]} testID="heat" />
          <Badge variant="bestValue" testID="badge" />
          <Card variant="highlight" testID="card">
            <Text>Inside</Text>
          </Card>
          <Sheet visible onClose={press} testID="sheet">
            <Text>Sheet</Text>
          </Sheet>
          <ToastBar visible message="Saved" actionLabel="Undo" onAction={press} testID="toast" />
          <ListRow title="Target" meta="2,100 kcal" testID="row" />
          <SwitchRow
            title="Haptics"
            icon={<HomeIcon />}
            value
            onValueChange={press}
            testID="srow"
          />
          <MealRow title="Lunch" kcal="620 kcal" icon={<HomeIcon />} onAdd={press} testID="mrow" />
          <LeaderboardRow
            rank={1}
            name="Rohan"
            status="Logged"
            percentage={92}
            isCurrentUser
            testID="lrow"
          />
          <FloatingTabBar
            tabs={[{ id: 'today', label: 'Today', icon: (c) => <HomeIcon color={c} /> }]}
            activeId="today"
            badges={{ today: 0, room: 2 }}
            onSelect={press}
            onLogPress={press}
            testID="tabs"
          />
          <FloatingTabBar
            tabs={[{ id: 'today', label: 'Today', icon: (c) => <HomeIcon color={c} /> }]}
            activeId="today"
            visible={false}
            onSelect={press}
            onLogPress={press}
            testID="tabs-hidden"
          />
          <NotificationPreview
            appName="CALIPARTNER"
            showStackPeek
            title="Time for lunch"
            body="640 kcal left today."
            testID="notif"
          />
          <UtensilsIcon />
          <AppleIcon />
          <GoogleIcon />
          <CameraIcon />
          <ScanIcon />
          <EyeIcon />
          <EyeOffIcon />
          <EditIcon />
          <ChartBarIcon />
          <FeedImageIcon />
          <SunIcon />
          <BowlIcon />
          <MoonIcon />
          <BarcodeIcon />
          <BookmarkIcon />
          <HistoryClockIcon />
        </View>,
      );
    });

    const primaryBtn = tree!.root
      .findAllByProps({ testID: 'btn-primary' })
      .find((n) => String(n.type) === 'Pressable')!;
    expect(primaryBtn.props.accessibilityRole).toBe('button');
    expect(tree!.root.findByProps({ testID: 'inp-error' })).toBeDefined();
    expect(tree!.root.findAllByProps({ testID: 'tabs' }).length).toBeGreaterThan(1);
    expect(tree!.root.findByProps({ testID: 'tabs-hidden' }).children).toHaveLength(0);
    const sheetModal = tree!.root
      .findAllByProps({ testID: 'sheet' })
      .find((n) => String(n.type) === 'Modal')!;
    expect(sheetModal.props.visible).toBe(true);
    expect(tree!.root.findByProps({ testID: 'toast-action' })).toBeDefined();
    expect(tree!.root.findByProps({ testID: 'mrow-add' })).toBeDefined();
  });
});
