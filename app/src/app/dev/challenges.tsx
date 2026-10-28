import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { challengeRequest } from '@/services/challengeService';
import { getSupabase } from '@/lib/supabase';
import { ct } from '@/i18n/challenges';
import { CSheet, cs } from '@/components/progress/ChallengeUI';
interface Analytics {
  events: Record<string, number>;
  templates: Array<{ slug: string; joined: number; completed: number }>;
  formats: Array<{ format: string; joined: number; completed: number; finished: number }>;
  invitations: { sent: number; accepted: number };
  retention: { days: number; eligible: number; returned: number } | null;
}
/** The endpoint checks server-owned Auth app_metadata; showing this route grants no privilege. */
export default function ChallengeDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    if (user)
      void challengeRequest<Analytics>(getSupabase(), user.id, { action: 'analytics' })
        .then((value) => {
          if (live) setData(value);
        })
        .catch(() => {
          if (live) setError(true);
        });
    return () => {
      live = false;
    };
  }, [user]);
  return (
    <CSheet visible title={ct('title')} onClose={() => router.back()} testID="challenge-analytics">
      {error ? (
        <Text accessibilityRole="alert" style={cs.error}>
          {ct('error')}
        </Text>
      ) : !data ? (
        <Text style={cs.body}>{ct('loading')}</Text>
      ) : (
        <>
          <Text style={cs.heading}>{ct('activity')}</Text>
          {Object.entries(data.events).map(([event, count]) => (
            <Text key={event} style={cs.body}>
              {event} · {count}
            </Text>
          ))}
          {data.templates.map((template) => (
            <Text key={template.slug} style={cs.body}>
              {template.slug} · {ct('joined', { count: template.joined })} ?{' '}
              {ct('completedCount', { count: template.completed })}
            </Text>
          ))}
          <Text style={cs.small}>{ct('invitationsSummary', data.invitations)}</Text>
          {data.retention && <Text style={cs.small}>{ct('retentionSummary', data.retention)}</Text>}
        </>
      )}
    </CSheet>
  );
}
