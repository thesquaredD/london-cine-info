# Phone app

Read the root AGENTS.md and docs/mobile.md. Use the versioned Expo SDK 57 documentation
before changing native APIs, and install native packages with `npx expo install`.

Routes live in app/; reusable code lives in src/. Never import Preact hooks or browser
storage into the app. Use shared selection logic from @lci/core and native React components.
Use EAS for builds and store submissions; do not commit generated ios/ or android/ folders.
EAS Update is out of scope. Device checks in docs/mobile.md are release gates, not unit tests.
