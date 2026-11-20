import PostHog from 'posthog-react-native';
import { env } from '@/lib/env';

const projectToken = env.posthogProjectToken;
const host = env.posthogHost;

function reportMissingConfiguration(variableName: string) {
  if (__DEV__) {
    console.error(
      `${variableName} variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variableName} is configured`,
    );
  }
}

if (!projectToken) reportMissingConfiguration('EXPO_PUBLIC_POSTHOG_PROJECT_TOKEN');
if (!host) reportMissingConfiguration('EXPO_PUBLIC_POSTHOG_HOST');

function createPostHog() {
  if (!projectToken || !host) return null;

  const client = new PostHog(projectToken, {
    host,
    captureAppLifecycleEvents: true,
    logs: {
      serviceName: 'calipartner-mobile',
      environment: __DEV__ ? 'development' : 'production',
    },
    errorTracking: {
      autocapture: {
        uncaughtExceptions: true,
        unhandledRejections: true,
      },
    },
  });
  if (__DEV__) client.debug();
  return client;
}

export const posthog = createPostHog();
