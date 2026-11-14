import React, { memo, useId } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Defs, Filter, FeColorMatrix, Image as SvgImage } from 'react-native-svg';
import { avatarLayers, type AvatarProfile, type AvatarProduct } from '@calipartner/core';
import { avatarLayout, radius, useTheme } from '@calipartner/ui';
import type { AvatarTint } from '@/services/avatarService';
import { t } from '@/i18n';
import { avatarAssets } from './assets.generated';

interface Props {
  profile: Pick<AvatarProfile, 'gender' | 'form' | 'slots' | 'tints' | 'skin_tone_id'>;
  products: AvatarProduct[];
  tints: AvatarTint[];
  height?: number;
  preview?: boolean;
  label?: string;
}
/** Luminance colorization preserves each layer's alpha, material shading and highlights. */
export function tintMatrix(hex: string): string {
  const values = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  return (
    values
      .map((v) => `${(v * 0.2126) / 0.65} ${(v * 0.7152) / 0.65} ${(v * 0.0722) / 0.65} 0 0`)
      .join(' ') + ' 0 0 0 1 0'
  );
}
export const AvatarView = memo(function AvatarView({
  profile,
  products,
  tints,
  height = avatarLayout.heroHeight,
  preview = false,
  label,
}: Props) {
  const { colors } = useTheme();
  const id = useId().replaceAll(':', '');
  const suffix = preview ? '_preview' : '';
  const layers = avatarLayers(profile, products);
  const base = [
    { key: `base_${profile.gender}_form${profile.form}`, tint: undefined as string | undefined },
    {
      key: `skinmask_${profile.gender}_form${profile.form}`,
      tint: tints.find((t) => t.id === profile.skin_tone_id)?.hex,
    },
  ];
  const images = [
    ...layers
      .filter((l) => l.product.slot === 'backdrop' || l.product.slot === 'aura')
      .map((l) => ({ key: l.path!, tint: undefined })),
    ...base,
    ...layers
      .filter((l) => l.product.slot !== 'backdrop' && l.product.slot !== 'aura')
      .map(({ path, product }) => ({
        key: path!,
        tint: product.tintable
          ? (products.find(
              (p) => p.id === profile.tints[`${product.slot}_finish`] && p.kind === 'finish',
            )?.finish ?? tints.find((t) => t.id === profile.tints[product.slot])?.hex)
          : undefined,
      })),
  ];
  return (
    <View
      style={[styles.canvas, { height, backgroundColor: colors.s2 }]}
      accessibilityRole="image"
      accessibilityLabel={label ?? t('avatar.title')}
      testID="avatar-view"
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${avatarLayout.canvasWidth} ${avatarLayout.canvasHeight}`}
      >
        <Defs>
          {images.map((layer, index) =>
            layer.tint ? (
              <Filter key={index} id={`${id}-${index}`} x="0%" y="0%" width="100%" height="100%">
                <FeColorMatrix type="matrix" values={tintMatrix(layer.tint)} />
              </Filter>
            ) : null,
          )}
        </Defs>
        {images.map((layer, index) => {
          const asset = avatarAssets[layer.key + suffix] ?? avatarAssets[layer.key];
          return asset ? (
            <SvgImage
              key={`${index}-${layer.key}`}
              href={asset}
              x={0}
              y={0}
              width={avatarLayout.canvasWidth}
              height={avatarLayout.canvasHeight}
              preserveAspectRatio="xMidYMid meet"
              filter={layer.tint ? `url(#${id}-${index})` : undefined}
            />
          ) : null;
        })}
      </Svg>
    </View>
  );
});
const styles = StyleSheet.create({
  canvas: { width: '100%', overflow: 'hidden', borderRadius: radius.card },
});
