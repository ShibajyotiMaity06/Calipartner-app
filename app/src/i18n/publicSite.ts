/** English launch catalogue, shared by static web pages and the in-app legal sheet. */
export const publicSite = {
  origin: 'https://www.calipartner.site',
  email: 'shibajyoti.maity06@gmail.com',
  title: 'CaliPartner: Indian Calorie Tracker, Diet & Workout Partner',
  description:
    'Log Indian meals in seconds, team up in accountability rooms, track workouts, and stay consistent with streaks. Built for Indian food.',
  audience: 'Built for Indian food & fitness accountability.',
  trial: 'Personal tracking is free forever. Pro is an optional paid subscription.',
  browserHelp:
    'If Google login doesn’t open in this browser, use the email 6-digit code or open in Safari/Chrome.',
  googlePending: 'Google sign-in has not completed. You can use your email code below.',
  legalTitle: 'Legal and privacy',
  closeLegal: 'Close legal information',
  agree: 'Agree and continue',
  done: 'Done',
  updated: 'Updated 20 November 2026',
  privacy: {
    title: 'Privacy policy',
    sections: [
      {
        title: 'Who we are and how to contact us',
        body: 'CaliPartner provides nutrition, workout and accountability tools. Contact shibajyoti.maity06@gmail.com about privacy, access, corrections or deletion. This policy applies to the app and app.calipartner.site.',
      },
      {
        title: 'Information you provide',
        body: 'We process your email or Apple/Google sign-in identifier, profile and planning inputs, food and nutrition logs, weight, water, steps, workouts, goals, saved meals, room membership and messages. Health screening and allergies you provide help apply safety rules. Support messages include information you choose to send. Payment providers process payment details; we store subscription status and transaction references to manage access.',
      },
      {
        title: 'Photos, device permissions and location',
        body: 'Camera and gallery access are optional. Private progress photos are stored on your device, separately for each account, with no CaliPartner cloud backup. Photos submitted for AI food analysis are sent for processing after consent. Room media you choose to share is stored privately with controlled access. Foreground location records distance and route during a run; we do not promise background tracking. Motion or connected health permissions supply steps when enabled. Notifications support reminders and room updates. You can revoke permissions in device settings.',
      },
      {
        title: 'Room privacy and sharing',
        body: 'Room members receive only the progress allowed by your sharing settings and membership. Review per-room privacy before sharing. Messages and media you post are visible to permitted room members. Blocking and reporting tools help manage interactions. Other people may retain information they have already seen or copied.',
      },
      {
        title: 'Feed posts and comments',
        body: 'Photos, videos, descriptions, captions and comments you submit to Feed are checked by server-side moderation providers before publication. Published media is stored privately and can be opened by the signed-in audience you choose. If you choose to share goal completion on a post, Pro viewers who can open that post can compare percentages for that day. Shares and links follow the same audience settings. You can delete your posts and comments and report or block other users.',
      },
      {
        title: 'AI processing and consent',
        body: 'AI features require explicit consent and the relevant purchased plan. Requests may include your prompt, food photo, relevant profile, targets and diary context. Server-side AI providers process this information to produce a response. AI estimates can be wrong; review them before saving. Coaching conversations and request records may be retained to provide history, prevent duplicate charges, manage responsible use and investigate failures. Do not include unnecessary sensitive information. You can decline AI and continue manual tracking.',
      },
      {
        title: 'Service providers and security',
        body: 'Supabase provides authentication and database services; Cloudflare R2 stores shared media; Apple/Google, RevenueCat and supported web billing providers handle purchases; push services deliver notifications. AI requests use configured server-side providers. Hosting providers process technical connection information such as IP address and request logs. Processing may occur outside your country. Access controls protect account data, but no system can guarantee absolute security. These public pages do not load advertising or analytics trackers.',
      },
      {
        title: 'Storage, retention and deletion',
        body: 'Account data is kept while needed to operate your account. You can request account deletion in You → Settings → Delete account or email us from your registered address. We verify ownership before manual deletion. Deletion removes your account and linked personal records through the account-deletion process; shared rooms and other members’ records may remain. Provider backups, security records and legally required transaction records may persist under applicable retention requirements. We do not promise immediate removal from every backup. Device copies on other devices must be removed there. Deleting an account does not cancel store subscriptions.',
      },
      {
        title: 'Your choices and policy changes',
        body: 'You can edit your profile, control sharing and permissions, decline AI processing and contact us about your data rights. Full self-service export is Coming soon and is not currently offered in the app. We update this page when processing changes; its date identifies the latest version.',
      },
    ],
  },
  terms: {
    title: 'Terms of service',
    sections: [
      {
        title: 'Using CaliPartner',
        body: 'By creating an account or using CaliPartner, you agree to these terms. Keep your sign-in secure and provide accurate information. You are responsible for content you submit. Contact shibajyoti.maity06@gmail.com for help or questions.',
      },
      {
        title: 'Health and safety',
        body: 'CaliPartner provides general nutrition, workout and habit information, not medical advice, diagnosis or treatment. Targets include calorie floors and rate limits, but are not a guarantee of individual suitability or results. Consult a qualified clinician or dietitian before changing your diet, training or fasting, especially if you have a health condition. AI estimates and food data require your review.',
      },
      {
        title: 'Free tracking',
        body: 'Personal tracking is free forever. Full AI meal and workout plans require purchased Pro and consent',
      },
      {
        title: 'Subscriptions, renewal and cancellation',
        body: 'Paid Pro subscriptions are offered for one year, six months or three months. The purchase screen shows the price, currency, duration and renewal terms before you confirm. Paid purchases bill immediately and automatically renew unless cancelled according to your provider’s terms. Manage Apple subscriptions in Apple account subscription settings and Google Play subscriptions in Payments and subscriptions. For web purchases, use the billing management link in the app or your provider’s receipt. Cancel before the provider’s renewal deadline; access generally continues to the end of the paid period. Refund requests follow the payment provider’s policy and applicable law. Deleting your account or uninstalling the app does not cancel a subscription.',
      },
      {
        title: 'Available and planned features',
        body: 'Plan access depends on your active entitlement. AI features require consent and responsible-use controls. Progress photos are device-local and need your own backup arrangements. Features marked Coming soon are planned, are not available with a purchase today and have no guaranteed release date. Monthly progress reviews require enough logs and your explicit acceptance before targets change.',
      },
      {
        title: 'Community and availability',
        body: 'Share only content you have permission to post. Harassment, threats, hate speech, sexual content, graphic violence, scams, spam and unlawful content are prohibited. Use report and block controls when needed. We may restrict abusive accounts or remove content. Signed-in saves require an internet connection and are confirmed only after the server acknowledges them. Cached browsing can be available offline. Services may be interrupted for maintenance or failures.',
      },
      {
        title: 'Deletion and changes',
        body: 'You can request deletion in the app or through the public account-deletion page. The privacy policy explains data handling and retention. We may update these terms and will identify the updated version here. These terms do not limit rights you have under applicable consumer law.',
      },
    ],
  },
} as const;
