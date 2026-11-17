import { publicSite as copy } from '../../app/src/i18n/publicSite';

export type Section = { title: string; body: string };
export type PublicPage = {
  path: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: readonly Section[];
  noindex?: boolean;
};
export const pages: PublicPage[] = [
  {
    path: '/about',
    title: copy.title,
    description: copy.description,
    heading: 'Your food. Your goals. Someone on your side.',
    intro:
      'An Indian food calorie tracker with workouts and partner accountability. Build your day around the meals you actually eat.',
    sections: [
      {
        title: 'Log familiar meals',
        body: 'Search roti, dal, sabzi and more. Track calories and macros, scan a barcode or save a meal combination for next time.',
      },
      {
        title: 'Keep each other going',
        body: 'Start a room for two on Free. Chat with your squad and share only the progress you choose. Compare consistency against your own goals.',
      },
      {
        title: 'Make movement part of your day',
        body: 'Log exercises, sets and reps, track steps and water, and record outdoor running routes with foreground GPS.',
      },
      { title: 'Start with Free', body: copy.trial },
      {
        title: 'Add tools when you need them',
        body: 'Plus adds 90+ Indian recipes, fasting and larger rooms. Purchased Plus and Pro include AI plans with consent. Purchased Pro adds your AI coach, food-photo estimates and monthly progress reviews. Review and accept changes yourself.',
      },
    ],
  },
  {
    path: '/features',
    title: 'Indian Food, Workouts and Partner Features | CaliPartner',
    description:
      'Explore food logging, private saved meals, workouts, GPS runs, partner rooms and recipes. See which CaliPartner tools are Free, Plus or purchased Pro.',
    heading: 'Small daily actions, shared consistency.',
    intro: 'Track your own day and choose what to share with the people supporting you.',
    sections: [
      {
        title: 'Food tracking — Free',
        body: 'Search Indian foods, scan barcodes, create custom foods and save My meals. Review portions, calories, protein, carbs and fat. Signed-in saves need an internet connection.',
      },
      {
        title: 'Partner rooms — all plans',
        body: 'Free can host a room for two; Plus and Pro support larger squads. Chat, invite friends and control per-room sharing. Hidden data stays private. Friend discovery is available; automated partner matching is Coming soon.',
      },
      {
        title: 'Workouts and GPS — Free tracking',
        body: 'Log custom exercises, sets and reps. Record outdoor runs with foreground location and view your route, distance and pace. Purchased Plus and Pro can generate workout routines with consent. Background GPS, rest timers and personal records are not promised.',
      },
      {
        title: 'Recipes and planning — Plus and Pro',
        body: 'Browse 90+ Indian recipes and use the fasting tracker with its safety screening. Full AI meal plans and grocery lists require purchased Plus or Pro and consent; these plans are excluded from the cardless trial.',
      },
      {
        title: 'Private progress photos — Plus and Pro',
        body: 'Save camera or gallery photos with a date, optional weight and notes. Compare two photos. Your vault stays on this device; there is no CaliPartner cloud backup.',
      },
      {
        title: 'AI support — purchased Pro',
        body: 'Ask your coach about nutrition and training, review photo estimates or describe a meal before logging. Monthly reviews use sufficient recent logs and require explicit acceptance of target changes. Pro support emails are tagged for priority handling; no response time is guaranteed.',
      },
    ],
  },
  {
    path: '/pricing',
    title: 'Free, Plus and Pro Plans and Trial Details | CaliPartner',
    description:
      'Compare CaliPartner Free, Plus and Pro. Learn how the cardless seven-day Plus trial works, what purchased plans include and how to cancel subscriptions.',
    heading: 'Start free. Choose the support you need.',
    intro: copy.trial,
    sections: [
      {
        title: 'Free — personal tracking',
        body: 'Food and workout logging, saved meals, barcode search, steps, water, weight, a hosted room for two and squad text chat.',
      },
      {
        title: 'Plus — more ways to stay consistent',
        body: 'India: ₹249 monthly or ₹1,499 annually. International: $4.99 monthly or $29.99 annually. Larger rooms, 90+ recipes, fasting, custom macros and device-local progress photos. Full AI meal and workout plans require a purchased subscription and consent.',
      },
      {
        title: 'Pro — personal AI support',
        body: 'India: ₹499 monthly or ₹2,499 annually. International: $9.99 monthly or $49.99 annually. Plus features, personal AI coach, food-photo estimates, chat-to-log, monthly progress reviews, room media sharing and Pro-tagged support. Pro has no trial.',
      },
      {
        title: 'What happens after the trial?',
        body: 'The seven-day Plus trial requires no card and never starts an automatic charge. Eligible accounts get one trial. At expiry you return to Free unless you separately purchase a plan. Full AI plans and Pro AI features are excluded.',
      },
      {
        title: 'How do billing and cancellation work?',
        body: 'Prices shown here are the published plan catalogue. Your checkout confirms the applicable price, currency, taxes and billing period. Paid purchases bill immediately and renew automatically unless cancelled. Cancel in Apple or Google subscription settings, or through your web billing provider. Deleting the app or account does not cancel billing.',
      },
      {
        title: 'Coming soon — not included today',
        body: 'Body circumferences, full data export, partner matching and messaging, challenges, trophies and badges, workout timers and personal records, fits-my-day recipe collections and weekly AI insights are planned. There are no guaranteed release dates. Monthly progress reviews are available on purchased Pro.',
      },
    ],
  },
  {
    path: '/download',
    title: 'Open CaliPartner and Check App Availability | CaliPartner',
    description:
      'Start using CaliPartner on the web. Find verified iPhone and Android download links when available, and learn about Free tracking and the Plus trial.',
    heading: 'Your next small step starts here.',
    intro:
      'Open CaliPartner in your browser. You can create an account with a six-digit email code.',
    sections: [{ title: 'Track on your terms', body: copy.trial }],
  },
  ...(['privacy', 'terms'] as const).map((key) => ({
    path: `/${key}`,
    title: `${copy[key].title} — Data, Access and Your Choices | CaliPartner`,
    description:
      key === 'privacy'
        ? 'Read how CaliPartner handles account and health logs, photos, foreground location, AI consent, room sharing, retention and requests to delete your data.'
        : 'Read CaliPartner terms for Free tracking, the cardless Plus trial, paid subscriptions, automatic renewal, cancellation, community use and account deletion.',
    heading: copy[key].title,
    intro: copy.updated,
    sections: copy[key].sections,
  })),
  {
    path: '/support',
    title: 'Contact CaliPartner Support and Get Account Help',
    description:
      'Contact CaliPartner about sign-in, food logging, billing or privacy. Use the help centre for Pro-tagged support and find instructions to delete an account.',
    heading: 'Let’s help you get back to your day.',
    intro:
      'Email shibajyoti.maity06@gmail.com. Include what happened and your app version; never send your sign-in code or payment-card details.',
    sections: [
      {
        title: 'Pro priority support',
        body: 'In You → Help centre, active Pro members can open a priority-tagged email containing their account and app details. Finish sending the message in your email app. We do not guarantee a response time.',
      },
      { title: 'Sign-in help', body: copy.browserHelp },
      {
        title: 'Billing help',
        body: 'Use the subscription management action or the provider’s receipt to manage web billing. For Apple and Google purchases, use your store subscription settings. Account deletion does not cancel billing.',
      },
    ],
  },
  {
    path: '/delete-account',
    title: 'Delete Your CaliPartner Account and Personal Data',
    description:
      'Request deletion of your CaliPartner account and linked data without reinstalling the app. See ownership checks, retention details and subscription advice.',
    heading: 'Delete your account and data.',
    intro:
      'You can request deletion from the web by emailing us from the address registered to your CaliPartner account.',
    sections: [
      {
        title: 'Request deletion by email',
        body: 'Send an email to shibajyoti.maity06@gmail.com with the subject “CaliPartner account deletion”. Include your username if known and say that you want your account and linked personal data deleted. We verify ownership before acting. Do not send your password or one-time sign-in code. Opening a draft does not submit the request; send it in your email app.',
      },
      {
        title: 'Delete inside the app',
        body: 'Open You → Settings → Delete account, read the confirmation and complete the request online. Wait for the server confirmation before assuming deletion is complete.',
      },
      {
        title: 'What is removed and what may remain',
        body: 'The deletion process removes your account, profile and linked personal logs, membership and owned chat media. Shared rooms and other members’ content may remain. Provider backups, security records and legally required transaction records may persist under applicable retention requirements. We confirm the status and any relevant retention details when handling your request. We do not promise instant erasure from every backup. Remove local copies on your other devices separately.',
      },
      {
        title: 'Cancel billing separately',
        body: 'Deletion is permanent and does not cancel Apple, Google or web subscriptions. Cancel with your billing provider to stop renewal. You can contact us without reinstalling the app.',
      },
    ],
  },
  {
    path: '/404',
    title: 'Page Not Found | CaliPartner',
    description:
      'This page could not be found. Return to CaliPartner or find features, pricing and support.',
    heading: 'This page isn’t here.',
    intro:
      'Use the navigation to find features, pricing or support, or open the app to search foods.',
    sections: [],
    noindex: true,
  },
];
