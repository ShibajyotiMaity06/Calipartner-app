# Steps, workout dates, food photos and barcodes

Owner-requested repair scope, 26 October 2026: correct workout dates, add Android/iPhone health-step integration, and repair camera, non-food detection and barcode lookup. This authorizes the necessary app services, hooks, shared logic, native configuration and Edge Functions for these existing features.

## Which installation supports closed-app steps?

| Installation | Food photos and barcodes | Steps recorded while CaliPartner is closed |
| --- | --- | --- |
| Chrome website or Chrome “Install app” / “Add to home screen” | Yes, using camera/gallery permission on HTTPS | No native Health Connect/Apple Health access |
| Native Android APK or Play Store app | Yes | Health Connect history, when a phone/watch/source records steps |
| Native iPhone app / TestFlight | Yes | Apple Health history, when the phone/watch records steps |

Installing from Chrome creates a web app. It does not turn the website into a native Android/iPhone binary or grant health permissions. You can distribute the native Android APK by download without using the Play Store; that is a different installation from Chrome's website-install menu.

The native integration reads the operating system's cumulative daily totals. Phone and watch records are aggregated by the health platform rather than added together by CaliPartner. The app refreshes on launch, on return to the foreground and periodically while active, and backfills the last seven days. Health platforms keep recording while our app process is stopped; our JavaScript does not need to keep running. Uploads to Supabase happen through the existing offline outbox, rather than requiring a permanent background network connection.

Daily queries use your stored time zone and handle daylight-saving transitions. Totals may update in batches. Calories and step-derived distance remain estimates; a measured platform distance takes priority.

## One-time developer setup

1. Build a **new native app** from this commit. A web deployment, hot reload or an old development client cannot add the new Health Connect/HealthKit modules. This repository uses EAS builds, rather than Expo Go.
2. Supply the existing non-secret `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in the EAS environment for the selected build profile. Keep AI and service-role keys in Supabase secrets.
3. From `app/`, sign in to your Expo account with `npx eas-cli login` if needed, then build Android with `npx eas-cli build --platform android --profile preview`. Download and install its APK. Allow installation from your download source when Android asks.
4. For a physical iPhone, use `npx eas-cli build --platform ios --profile preview` with your Apple Developer account and register the test device when EAS asks. The existing `development` profile targets an iOS simulator, so use `preview` for a phone. For wider distribution, use a production build and TestFlight/App Store distribution.
5. The Expo plugins configure Android read access for **Steps** and **Distance**, the camera declaration, and the iOS HealthKit capability and health-read explanation. No health-write permission is requested. Review the generated native permissions/capabilities in the build before store submission.
6. For store distribution, complete the Google Play Health Connect declarations for these read types and the corresponding App Store health/privacy declarations. These console declarations are separate from the user's on-device permission prompt.

No separate health API key or backend health account is required. Existing AI provider secrets remain on the Supabase project. The `ai-food-photo` and `food-lookup` functions must be deployed using their function-local `deno.json` files and committed gateway settings.

## What each user does

1. Open **Me → Health sync** in the native app and enable the connection. Alternatively, use the steps card's permission action.
2. On Android, allow reading Steps and Distance in Health Connect. On iPhone, allow the requested Apple Health read types. Phone motion access may also be needed for the fallback pedometer or a walking session.
3. Walk with the phone or a connected watch, close CaliPartner, walk again, then reopen it. The steps card should refresh from the health platform's daily aggregate and show its source. Compare the same date and time zone in the phone's health app.
4. Normally you do this **once**, not every time you open CaliPartner. Reinstallation, revoked permissions, clearing app data, changing the phone or a system permission reset can require setup again. Use **Open health settings** if access was previously denied. Disconnect stops health-platform reads in CaliPartner.

On supported Android 14+ devices with SDK extension 20+, Health Connect can record phone steps itself once a Steps read permission exists. Other Android devices/versions need a step source that writes into Health Connect, such as a supported fitness/watch app. Older Android hardware sensor fallback does not provide historical steps after process termination. If Health Connect has no step records, CaliPartner preserves an unknown/previous reading instead of inventing a total. iPhone HealthKit deliberately does not reveal whether a read permission was denied; an empty response is not proof of a zero-step day.

## Camera, food-photo and barcode setup

- Allow camera access when taking a photo or scanning a live barcode. Allow photo-library access when choosing an existing image. In Chrome, camera access requires HTTPS or localhost; a plain HTTP LAN address is not a secure camera origin.
- Gallery photos are resized and encoded as real JPEG data before analysis. Upload preview works even if camera permission was denied. The image is sent for AI processing only after consent and server access/usage checks.
- Food-photo results show **estimated** macros for review. A photo without food returns: “This does not look like a food photo. Please take or choose a clear photo of your food.” A provider/network failure is an error, rather than sample food or invented macros.
- Barcodes can be read by the native camera, a browser camera, an uploaded photo or manual numeric entry. Local catalog lookup works offline. An unknown product offers a custom-food path; an upstream connection failure offers retry. Confirm the portion and meal before saving.
- Taking photos does not grant Pro access. The server retains the configured plan gates, explicit AI consent, scan limits and budget checks.

The deployed access repair follows the approved feature matrix: Free has three starter scans over the account's lifetime; active Pro has five scans per stored local day; Plus and its trial do not include AI photo scans. Usage recording is restricted to server functions. Invalid/non-food images that reach the model count as a scan attempt, since provider processing has occurred.

## Manual device checks before release

Test on an Android phone and an iPhone built from this commit: grant/deny/revoke health and camera permissions; walk with the screen locked and app closed; reopen across midnight; compare the same day's platform steps; deny camera but upload a photo; photograph a meal and a non-food object; scan a known packaged-food barcode; try an unknown barcode; save the selected portion to the diary while offline, then reconnect. Emulator/browser tests cannot establish physical sensor accuracy or prove a native binary works on a real device.

References: [Android on-device steps and aggregate reads](https://developer.android.com/health-and-fitness/health-connect/read-data), [Health Connect availability](https://developer.android.com/health-and-fitness/health-connect/availability), [Health Connect Expo integration](https://github.com/matinzd/react-native-health-connect), [HealthKit React Native integration](https://kingstinct.com/react-native-healthkit/), [Expo camera](https://docs.expo.dev/versions/latest/sdk/camera/).

## Delivery report — 26 October 2026

Built: real time-zone-aware workout dates and date navigation; native read-only Health Connect/HealthKit integration with resume refresh and history backfill; deterministic step-source selection and serialized offline upserts; real JPEG camera/gallery preparation; specific estimated food macros; clear non-food/provider errors; barcode image/camera/manual lookup and portion saving. Removed automatic sample-food substitutions. Corrected photo access and scan-limit copy to the approved plans.

Live validation used disposable accounts against the existing Supabase project. A real banana photograph returned a food result and estimated macros; a non-food app icon returned HTTP 422 with `NO_FOOD_DETECTED`; barcode `3017620422003` resolved to Nutella and nutrition data. Chrome also verified the workout date in a different saved time zone, barcode JPEG upload through portion saving, non-food upload, and food upload through reviewable macro results. All disposable accounts were removed.

The new migration `20261026000000_food_photo_access_repair.sql` was applied and recorded in the live ledger. Only the scoped photo functions/ACLs changed; no existing entitlement or room membership was modified. `ai-food-photo` and `food-lookup` were deployed. Broader old migrations were not replayed.

Validation summary:

```text
Format: All matched files use Prettier code style!
Lint: 0 errors, 89 existing warnings; no new token violations.
TypeScript: app, core and UI passed.
App: Test Files 74 passed (74); Tests 613 passed (613).
Core: Test Files 39 passed (39); Tests 482 passed (482).
UI: Test Files 5 passed (5); Tests 52 passed (52).
Database migrations: 38 passed.
Database tests: 17 passed, 0 failed.
Friends database tests: 13 passed, 0 failed.
Billing and goal database tests: 5 passed, 0 failed.
Food capture database tests: 6 passed, 0 failed.
Dodo Edge tests: ok | 9 passed | 0 failed.
Food capture Edge tests: ok | 8 passed | 0 failed.
Web build: Exported: dist.
Android native generation: prebuild passed.
iOS configuration: HealthKit entitlement and health-read/camera descriptions verified.
Live API: food, non-food and barcode checks passed.
Chrome: four UI checks passed against the production web export and live backend.
```

Assumptions: keep the approved pricing/AI limits and existing offline outbox; use the stored user time zone; prefer platform aggregates to separate phone/watch totals. Background counting means platform recording with refresh on reopen, rather than keeping browser JavaScript alive. Physical Android/iPhone sensor and permission behavior requires the manual checks above; no physical-device or signed native-binary test was performed here.

Files changed include app native dependencies/configuration and lockfile; workout date screens/hooks; `useCurrentLocalDate`, `useSteps`, native health, activity, barcode and food-photo services and tests; camera/scanner/food-log/health/steps views; English strings; shared local-day/barcode/AI/step logic and tests; the photo/food lookup Edge Functions, tests, import maps and gateway config; the new photo migration and database regression harness; and this setup document plus the PRD/build-plan pointers.

Manual actions: publish the updated frontend and install new native Android/iPhone builds; authorize health and camera/gallery access once; complete store health declarations when distributing through stores; perform real-device closed-app walking and permission checks. The existing public frontend deployment remains separate from a Git push.

Later work observed, not built: the separate planned-exercise service still keeps draft plans in memory and has demonstration progress data. Persisting that planner and replacing its demo progress is outside this date/capture/health repair. Other pre-existing Expo patch-version recommendations were not broadly upgraded; camera and secure storage were aligned with SDK 57 because these features use them.
