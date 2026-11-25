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
