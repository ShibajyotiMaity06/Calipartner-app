/**
 * CaliPartner Design System v1 — Iconography
 * Single source of truth: docs/ui/DESIGN_SYSTEM_V1.md (Section 5)
 *
 * 24 pt grid, 1.8 pt default stroke, round caps and joins,
 * no fills except filled heart and filled spark.
 * Emphasis icons (plus on Log, arrows on buttons, pause) use 2 to 3 pt stroke.
 * Sizes: 14, 16, 18, 20, 22, 24, 26, 30.
 */
import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors, iconTokens } from './theme';

export type DSIconSize = 14 | 16 | 18 | 20 | 22 | 24 | 26 | 30;

export interface DSIconProps {
  size?: DSIconSize | number;
  color?: string;
  strokeWidth?: number;
  filled?: boolean;
}

const DEFAULT_STROKE = iconTokens.stroke;

export function ArrowRightIcon({
  size = 18,
  color = colors.onBrand,
  strokeWidth = 2.2,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={5}
        y1={12}
        x2={19}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Polyline
        points="13 6 19 12 13 18"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronLeftIcon({
  size = 20,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="15 18 9 12 15 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ChevronRightIcon({
  size = 18,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="9 18 15 12 9 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CloseIcon({
  size = 20,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={18}
        y1={6}
        x2={6}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={6}
        y1={6}
        x2={18}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlusIcon({
  size = 18,
  color = colors.apricot,
  strokeWidth = iconTokens.emphasisStroke,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={12}
        y1={5}
        x2={12}
        y2={19}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={5}
        y1={12}
        x2={19}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MinusIcon({
  size = 18,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={5}
        y1={12}
        x2={19}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function CheckIcon({
  size = 14,
  color = colors.onBrand,
  strokeWidth = 2.4,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="20 6 9 17 4 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function LockIcon({
  size = 14,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect
        x={4}
        y={11}
        width={16}
        height={10}
        rx={2.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8 11V7a4 4 0 0 1 8 0v4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SparkIcon({
  size = 20,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
  filled = false,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2L12 3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function HeartIcon({
  size = 20,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
  filled = false,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill={filled ? color : 'none'}
      />
    </Svg>
  );
}

export function PauseIcon({
  size = 30,
  color = colors.onBrand,
  strokeWidth = iconTokens.heavyStroke,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={9}
        y1={5}
        x2={9}
        y2={19}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={15}
        y1={5}
        x2={15}
        y2={19}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PlayIcon({
  size = 24,
  color = colors.onBrand,
  strokeWidth = iconTokens.emphasisStroke,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M7 5l12 7-12 7V5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SearchIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={11} cy={11} r={7} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={20}
        y1={20}
        x2={16.2}
        y2={16.2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function HomeIcon({
  size = 22,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SquadIcon({
  size = 22,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={9} cy={7} r={3.5} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M22 21v-2a4 4 0 0 0-3-3.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M16.5 3.6a3.5 3.5 0 0 1 0 6.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function DumbbellIcon({
  size = 22,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={7}
        y1={12}
        x2={17}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Rect x={4} y={7} width={3} height={10} rx={1} stroke={color} strokeWidth={strokeWidth} />
      <Rect x={17} y={7} width={3} height={10} rx={1} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={2}
        y1={9.5}
        x2={2}
        y2={14.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={22}
        y1={9.5}
        x2={22}
        y2={14.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ProfileIcon({
  size = 22,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={8} r={4} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M4 20a8 8 0 0 1 16 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FlameIcon({
  size = 20,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BrandRingMark({
  size = 22,
  color = colors.apricot,
  strokeWidth = 3,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={colors.hairline} strokeWidth={strokeWidth} />
      <Path
        d="M 12 3 A 9 9 0 0 1 18.89 17.79"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function TrendIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="3 17 9 11 13 15 21 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function PulseIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="2 12 6 12 9 4 15 20 18 12 22 12"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function DropletIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 2.7l5.7 6.8a7.5 7.5 0 1 1-11.4 0L12 2.7z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function ScaleIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={3} width={18} height={18} rx={4} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M8 10.5a4 4 0 0 1 8 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={10.5}
        x2={14.5}
        y2={7.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function TimerIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={13} r={8} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={10}
        y1={2}
        x2={14}
        y2={2}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={2}
        x2={12}
        y2={5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={13}
        x2={15.5}
        y2={10}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function UtensilsIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 3v7a3 3 0 0 0 3 3h1a3 3 0 0 0 3-3V3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={7.5}
        y1={3}
        x2={7.5}
        y2={21}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M17 3v18M17 3c2.2 0 3.5 2.1 3.5 5.2 0 2.6-1.3 4.3-3.5 4.3"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AppleIcon({ size = 18, color = colors.onBrand }: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.945 1.34-1.94 2.71-3.43 2.71-1.517 0-1.9-.88-3.63-.88-1.698 0-2.302.91-3.67.91-1.377 0-2.332-1.26-3.428-2.8-1.287-1.82-2.323-4.63-2.323-7.28 0-4.28 2.797-6.55 5.552-6.55 1.448 0 2.675.95 3.6.95.865 0 2.222-1.01 3.902-1.01.613 0 2.886.06 4.374 2.19-.13.09-2.383 1.37-2.383 4.19 0 3.26 2.854 4.42 2.955 4.45z"
        fill={color}
      />
    </Svg>
  );
}

export function GoogleIcon({
  size = 18,
  color = colors.apricotPressed,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21.35 11.1H12v3.72h5.38c-.45 2.34-2.35 3.63-5.38 3.63-3.32 0-6.02-2.72-6.02-6.08s2.7-6.08 6.02-6.08c1.56 0 2.9.56 3.92 1.5l2.74-2.74C16.95 3.43 14.63 2.5 12 2.5 6.75 2.5 2.5 6.75 2.5 12s4.25 9.5 9.5 9.5c5.48 0 9.15-3.85 9.15-9.25 0-.42-.04-.78-.12-1.15z"
        fill={color}
      />
    </Svg>
  );
}

export function CameraIcon({
  size = 18,
  color = colors.onBrand,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8.5A2.5 2.5 0 0 1 6.5 6h2l1.4-2h4.2l1.4 2h2A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={13} r={3.2} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function ScanIcon({
  size = 20,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={3.5} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeIcon({
  size = 18,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={12} cy={12} r={2.5} stroke={color} strokeWidth={strokeWidth} />
    </Svg>
  );
}

export function EyeOffIcon({
  size = 18,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.6 10.6 0 0 1 12 19.5C6 19.5 2.5 12 2.5 12a18.5 18.5 0 0 1 4.1-4.96M9.9 5.24A10.1 10.1 0 0 1 12 4.5C18 4.5 21.5 12 21.5 12a18.4 18.4 0 0 1-2.16 3.19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={3}
        y1={3}
        x2={21}
        y2={21}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function EditIcon({
  size = 16,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M15.5 4.5l4 4L8 20H4v-4L15.5 4.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={13}
        y1={7}
        x2={17}
        y2={11}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChartBarIcon({
  size = 20,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={6}
        y1={19}
        x2={6}
        y2={13}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={19}
        x2={12}
        y2={6}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={18}
        y1={19}
        x2={18}
        y2={10}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FeedImageIcon({
  size = 20,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={4} width={18} height={16} rx={3} stroke={color} strokeWidth={strokeWidth} />
      <Circle cx={8.5} cy={9.5} r={1.5} stroke={color} strokeWidth={strokeWidth} />
      <Polyline
        points="21 16 15.5 11 6 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SunIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={4} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={12}
        y1={2.5}
        x2={12}
        y2={5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={19}
        x2={12}
        y2={21.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={2.5}
        y1={12}
        x2={5}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={19}
        y1={12}
        x2={21.5}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={5.3}
        y1={5.3}
        x2={7.1}
        y2={7.1}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={16.9}
        y1={16.9}
        x2={18.7}
        y2={18.7}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={18.7}
        y1={5.3}
        x2={16.9}
        y2={7.1}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={7.1}
        y1={16.9}
        x2={5.3}
        y2={18.7}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BowlIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={8}
        y1={20}
        x2={16}
        y2={20}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={16.5}
        y1={5.5}
        x2={14.5}
        y2={11.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function MoonIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function BarcodeIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={4}
        y1={6}
        x2={4}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={8}
        y1={6}
        x2={8}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={12}
        y1={6}
        x2={12}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={16}
        y1={6}
        x2={16}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={20}
        y1={6}
        x2={20}
        y2={18}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function BookmarkIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M6 4.5A1.5 1.5 0 0 1 7.5 3h9A1.5 1.5 0 0 1 18 4.5V20l-6-4-6 4V4.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function HistoryClockIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={8.5} stroke={color} strokeWidth={strokeWidth} />
      <Polyline
        points="12 7.5 12 12 15 14"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function FlashIcon({
  size = 20,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M13 2.5 5.5 13h6l-1 8.5L18.5 11h-6l.5-8.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CubeIcon({
  size = 20,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3 4.5 7.2v9.6L12 21l7.5-4.2V7.2L12 3z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="4.5 7.2 12 11.4 19.5 7.2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={11.4}
        x2={12}
        y2={21}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function InfoCircleIcon({
  size = 18,
  color = colors.textLo,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={12}
        y1={8}
        x2={12}
        y2={12.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16} r={0.9} fill={color} />
    </Svg>
  );
}

export function CheckCircleIcon({
  size = 18,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Polyline
        points="8.5 12.2 11 14.7 15.8 9.8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function AlertCircleIcon({
  size = 18,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={12}
        y1={8}
        x2={12}
        y2={12.5}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16} r={0.9} fill={color} />
    </Svg>
  );
}

export function ChatBubbleIcon({
  size = 18,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-2.9-.4-4.1-1L4 20.5l1.4-4.2A8.5 8.5 0 1 1 21 11.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function MoreDotsIcon({ size = 18, color = colors.textHi }: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={6} cy={12} r={1.6} fill={color} />
      <Circle cx={12} cy={12} r={1.6} fill={color} />
      <Circle cx={18} cy={12} r={1.6} fill={color} />
    </Svg>
  );
}

export function ShareUploadIcon({
  size = 18,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="16 8 12 4 8 8"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={4}
        x2={12}
        y2={15}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function ChevronDownIcon({
  size = 18,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="6 9 12 15 18 9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SettingsIcon({
  size = 18,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SlidersIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={4}
        y1={8}
        x2={20}
        y2={8}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={9} cy={8} r={2} stroke={color} strokeWidth={strokeWidth} fill={colors.s2} />
      <Line
        x1={4}
        y1={16}
        x2={20}
        y2={16}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={15} cy={16} r={2} stroke={color} strokeWidth={strokeWidth} fill={colors.s2} />
    </Svg>
  );
}

export function BellIcon({
  size = 18,
  color = colors.textHi,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M13.73 21a2 2 0 0 1-3.46 0"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function EnvelopeIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Polyline
        points="4 7 12 13 20 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function KeyIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={7.5} cy={15.5} r={3.5} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M10.5 12.5 19 4m0 0-1 3.5M19 4l-3.5 1m-1.5 4 2 2"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function CreditCardIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x={3} y={5} width={18} height={14} rx={2.5} stroke={color} strokeWidth={strokeWidth} />
      <Line x1={3} y1={10} x2={21} y2={10} stroke={color} strokeWidth={strokeWidth} />
      <Line
        x1={7}
        y1={15}
        x2={11}
        y2={15}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function FlagIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={5}
        y1={21}
        x2={5}
        y2={4}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M5 5h13l-2.5 4.5L18 14H5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function StarIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 3.5l2.6 5.3 5.9.8-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8-4.2-4.1 5.9-.8z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SignOutIcon({
  size = 18,
  color = colors.danger,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Polyline
        points="16 17 21 12 16 7"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={21}
        y1={12}
        x2={9}
        y2={12}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function TrashIcon({
  size = 18,
  color = colors.danger,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Line
        x1={4}
        y1={6}
        x2={20}
        y2={6}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Path
        d="M9 6V4h6v2m2 0-.8 13a2 2 0 0 1-2 1.8H9.8a2 2 0 0 1-2-1.8L7 6"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function SwapIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Polyline
        points="16 5 20 9 16 13"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={4}
        y1={9}
        x2={20}
        y2={9}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Polyline
        points="8 11 4 15 8 19"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={4}
        y1={15}
        x2={20}
        y2={15}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function PinIcon({
  size = 16,
  color = colors.apricot,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 4v5l3 3v2H7v-2l3-3V4h4z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line
        x1={12}
        y1={14}
        x2={12}
        y2={21}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function UsersIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={9} cy={8} r={3} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M3.5 19c0-2.8 2.5-4.5 5.5-4.5s5.5 1.7 5.5 4.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={17} cy={9.5} r={2.2} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M15.5 14.5c2.2.3 4 1.6 4.5 4"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function RulerIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function QuestionCircleIcon({
  size = 18,
  color = colors.textMid,
  strokeWidth = DEFAULT_STROKE,
}: DSIconProps): React.JSX.Element {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Circle cx={12} cy={12} r={9} stroke={color} strokeWidth={strokeWidth} />
      <Path
        d="M9.5 9.5a2.6 2.6 0 0 1 5 1c0 1.7-2.5 2.2-2.5 3.5"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={17} r={0.9} fill={color} />
    </Svg>
  );
}
