import { posthog } from '@/lib/posthog';

type LogAttributes = Record<string, boolean | number | string>;

/**
 * Emits only the structured application outcome logs intentionally exported to PostHog.
 * Do not route the app's general console logger through this module.
 */
export const posthogLog = {
  info(message: string, attributes: LogAttributes): void {
    try {
      posthog?.logger.info(message, attributes);
    } catch {
      // Logging must not change the outcome of the completed user action.
    }
  },
};
