import React from 'react';
import { Text } from 'react-native';
import type { ChallengeSnapshot } from '@calipartner/core';
import { ct } from '@/i18n/challenges';
import { cs } from './ChallengeUI';
/** Real results are embedded in the detail sheet so the same cached record drives both. */
export function ChallengeResultModal({ snapshot }: { snapshot: ChallengeSnapshot }) {
  const summary = snapshot.participants.find((p) => p.self)?.summary;
  if (!summary) return null;
  return (
    <>
      <Text style={cs.heading}>
        {ct(snapshot.self.status === 'completed' ? 'resultComplete' : 'resultFinished')}
      </Text>
      <Text style={cs.body}>
        {ct('resultBody', {
          passed: summary.passed,
          eligible: summary.eligible,
          percent: summary.percent.toFixed(0),
        })}
      </Text>
      <Text style={cs.body}>{ct('streak', { count: summary.longest_streak })}</Text>
    </>
  );
}
