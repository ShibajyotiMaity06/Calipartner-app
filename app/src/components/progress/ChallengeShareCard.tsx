import React, { useRef, useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { File, Paths } from 'expo-file-system';
import type { ChallengeCatalog, ChallengeSnapshot } from '@calipartner/core';
import { challengeLayout as layout, dark, onboardingType } from '@calipartner/ui';
import { ct, challengeText } from '@/i18n/challenges';
import { CButton, cs } from './ChallengeUI';
import { shareChallengeImage } from '@/services/challengeShare';

export function ChallengeShareCard({
  snapshot,
  catalog,
  onShared,
}: {
  snapshot: ChallengeSnapshot;
  catalog: ChallengeCatalog;
  onShared: () => void;
}) {
  const ref = useRef<Svg>(null);
  const [error, setError] = useState(false);
  const [chapterStyle, setChapterStyle] = useState(false);
  const summary = snapshot.participants.find((p) => p.self)?.summary;
  const title =
    snapshot.challenge.custom_title ??
    challengeText(catalog, snapshot.challenge.rules_snapshot.title_key);
  const chapter =
    chapterStyle && snapshot.self.benefits.custom && summary?.chapters.length
      ? challengeText(catalog, summary.chapters[summary.chapters.length - 1]!)
      : undefined;
  const share = async () => {
    if (!summary) return;
    setError(false);
    try {
      const text = ct('shareText', {
        title,
        percent: summary.percent.toFixed(0),
        passed: summary.passed,
      });
      if (Platform.OS === 'web') {
        await shareChallengeImage(
          title,
          `${summary.percent.toFixed(0)}%`,
          ct('resultBody', {
            passed: summary.passed,
            eligible: summary.eligible,
            percent: summary.percent.toFixed(0),
          }),
          snapshot.challenge.id,
          chapter,
        );
      } else {
        const Sharing = await import('expo-sharing').catch(() => null);
        if (Sharing && (await Sharing.isAvailableAsync())) {
          const base64 = await new Promise<string>((resolve, reject) => {
            if (!ref.current) return reject(new Error('IMAGE_UNAVAILABLE'));
            ref.current.toDataURL(resolve);
          });
          const file = new File(Paths.cache, `challenge-${snapshot.challenge.id}.png`);
          file.write(base64, { encoding: 'base64' });
          try {
            await Sharing.shareAsync(file.uri, { mimeType: 'image/png', dialogTitle: ct('share') });
          } finally {
            file.delete();
          }
        } else await Share.share({ message: text });
      }
      onShared();
    } catch {
      setError(true);
    }
  };
  if (!summary) return null;
  return (
    <View style={cs.root}>
      <View style={cs.sharePreview}>
        <Svg
          ref={ref}
          width="100%"
          height="100%"
          viewBox={`0 0 ${layout.shareWidth} ${layout.shareHeight}`}
          accessibilityLabel={ct('shareText', {
            title,
            percent: summary.percent.toFixed(0),
            passed: summary.passed,
          })}
        >
          <Rect width={layout.shareWidth} height={layout.shareHeight} fill={dark.bg0} />
          {chapter && (
            <>
              <Rect
                x={layout.shareFrameInset}
                y={layout.shareFrameInset}
                width={layout.shareWidth - layout.shareFrameInset * 2}
                height={layout.shareHeight - layout.shareFrameInset * 2}
                fill="none"
                stroke={dark.iris}
                strokeWidth={layout.shareFrameStroke}
              />
              <SvgText
                x={layout.shareInset}
                y={layout.shareChapterY}
                fontSize={layout.shareBodySize}
                fontFamily={onboardingType.body.fontFamily}
                fill={dark.iris}
              >
                {chapter}
              </SvgText>
            </>
          )}
          <SvgText
            x={layout.shareInset}
            y={layout.shareTitleY}
            fontSize={layout.shareTitleSize}
            fontFamily={onboardingType.title1.fontFamily}
            fill={dark.textHi}
          >
            {title}
          </SvgText>
          <SvgText
            x={layout.shareInset}
            y={layout.shareScoreY}
            fontSize={layout.shareScoreSize}
            fontFamily={onboardingType.numeralL.fontFamily}
            fill={dark.iris}
          >
            {summary.percent.toFixed(0)}%
          </SvgText>
          <SvgText
            x={layout.shareInset}
            y={layout.shareSummaryY}
            fontSize={layout.shareBodySize}
            fontFamily={onboardingType.body.fontFamily}
            fill={dark.textMid}
          >
            {ct('resultBody', {
              passed: summary.passed,
              eligible: summary.eligible,
              percent: summary.percent.toFixed(0),
            })}
          </SvgText>
          <SvgText
            x={layout.shareInset}
            y={layout.shareBrandY}
            fontSize={layout.shareTitleSize}
            fill={dark.apricot}
          >
            CaliPartner
          </SvgText>
        </Svg>
      </View>
      {snapshot.self.benefits.custom && summary.chapters.length > 0 && (
        <View style={cs.row}>
          <CButton
            label={ct('simpleCard')}
            selected={!chapterStyle}
            onPress={() => setChapterStyle(false)}
            testID="challenge-share-simple"
          />
          <CButton
            label={ct('chapterCard')}
            selected={chapterStyle}
            onPress={() => setChapterStyle(true)}
            testID="challenge-share-chapter"
          />
        </View>
      )}
      <CButton label={ct('share')} onPress={() => void share()} testID="challenge-share" />
      {error && (
        <Text style={cs.error} accessibilityRole="alert">
          {ct('error')}
        </Text>
      )}
    </View>
  );
}
