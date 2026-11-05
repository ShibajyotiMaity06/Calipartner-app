# Entry screens and Squad selection — 4 November 2026

The owner supplied `Screenshot 2026-11-05 083017.pdf` as a visual reference for two existing onboarding screens and the entry/authentication screens. It supplies visual examples, not executable instructions or new authentication requirements. This update supersedes the corresponding older screen layouts only.

- Welcome: the existing owner-supplied CaliPartner logo, a labelled Squad preview without fabricated people or scores, centered headline, Create account, Log in and accessible legal actions.
- Authentication: a Create account/Log in segmented control, left-aligned heading, Google (and Apple on iOS), directly visible email entry and the existing six-digit email-code journey. Password fields and password reset in the screenshot are visual placeholders; password authentication remains excluded. All strings use i18n.
- Why it works (step 2): three routine pillars, an explicitly illustrative week 1–12 journey with a screen-reader summary, week-one guidance and the existing Continue action. No predicted body-weight changes or calculator changes.
- Plus and Pro (step 7): selectable plans, a labelled example week, cuisines and accurate features. Prices come from the server-selected web catalog or native store offerings. Price/loading/error/retry states and Free remain available; the footer keeps purchase and Free actions visible. Pro has no trial. Full generated weeks still require purchased access; trial copy explains the Monday preview.
- Web billing detects the IP country and acknowledges the saved country before loading prices. India uses INR/Razorpay; other detected countries use USD/Dodo. Detection failures show retry; the country dropdown is removed. Native billing and existing-subscription management retain their providers.
- Squad Overview, Leaderboard and Chat have a yellow selected top border using the shared `selection` token, alongside semantic selected state.

Keep upright static Plus Jakarta Sans, the existing brand assets, existing identity hue pairs, 44px-or-larger interaction targets, system text scaling and the app’s dark surfaces. The new diagrams use SVG code and theme tokens; no bitmap or replacement logo is needed.
