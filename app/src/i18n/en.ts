export const en = {
  app: { name: 'CaliPartner' },
  tabs: {
    today: 'Today',
    room: 'Room',
    log: 'Log',
    progress: 'Progress',
    me: 'Me',
  },
  placeholder: {
    comingSoon: 'Coming soon',
    today: 'Your day at a glance will appear here.',
    room: 'Your rooms will appear here.',
    log: 'Logging will appear here.',
    progress: 'Your progress will appear here.',
    me: 'Your profile and settings will appear here.',
  },
  common: {
    loading: 'Loading…',
    retry: 'Try again',
    errorTitle: 'Something went wrong',
    errorBody: 'Please try again. If the problem continues, restart the app.',
  },
  connection: {
    label: 'Server',
    checking: 'Checking connection…',
    connected: 'Connected',
    failed: 'Could not reach the server',
    notConfigured: 'Server is not configured',
    offline: 'You are offline',
    online: 'Online',
  },
} as const;

export type Messages = typeof en;
