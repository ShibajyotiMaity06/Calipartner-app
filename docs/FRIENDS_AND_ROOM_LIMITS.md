# Friends, social profiles and room limits

Owner-approved revision, 24 October 2026. This request supersedes conflicting room quotas and Partner Finder access statements in earlier requirements. Existing paid room features, prices and lifecycle rules remain in effect.

## Room limits

| Host plan | Hosted rooms | People in each room |
| --- | --- | --- |
| Free | 1 | 2 |
| Plus | 3 | 5 |
| Pro | 5 | 20 |

These are hosted-room limits. Members can still join a room covered by an eligible host without buying a subscription. Friend acceptance does not create a room, share health data or bypass room capacity.

## Username search and friendships

Signed-in users can search discoverable usernames, view permitted profiles, and send friend requests. Free users can send three new requests in a rolling seven-day window. Active Plus and Pro remove that weekly limit. Accepted, declined, removed or cancelled requests still count for the window; retries and existing pending requests do not consume another request.

Recipients explicitly accept or decline requests. Senders can cancel pending requests. Either friend can remove the friendship. Blocking and discoverability apply on the server. Search and friendship do not enable direct messages or reveal private tracking data.

## Social profiles

Users can set a short bio, training style, optional Instagram handle and HTTPS website. These fields are private until the user enables sharing. Public identity uses the existing nickname, username and avatar. Profiles never reveal email, date of birth, private place, body measurements, nutrition logs or fitness targets.

## Offline behaviour

Profile edits and friend actions are saved to an account-scoped SQLite outbox. Requests are shown as queued until the server checks the live entitlement and weekly allowance. Cached profile and inbox data are labelled when offline. Failed requests do not silently become sent.

## Validation and release

The implementation includes database tests for quota, consent, privacy, blocking, account binding and recipient-account deletion; SQLite and browser tests for durable retries and cached data; and interface tests for profile consent and free search. Final results and deployment steps are in the [feature-wise delivery report](FEATURE_CHANGES.md).

Deploy the new database migration before releasing the app. Existing subscriptions and console products are reused; no new secret is needed. Friend requests appear in the Friends screen on refresh/focus; new friend push notifications are outside this request.
