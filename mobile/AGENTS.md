# Expo notes for this project

This app is pinned to **Expo SDK 54** (expo-router v6, React Native 0.81) because
the App Store build of Expo Go supports SDK 54 only. Consult the versioned docs
at https://docs.expo.dev/versions/v54.0.0/ before writing code, and don't
upgrade the SDK until the team moves to EAS development builds.

- Imports: `Tabs`/`Stack`/`Redirect` from `expo-router`; nav theming
  (`ThemeProvider`, `DefaultTheme`, `DarkTheme`) from `@react-navigation/native`.
- `npm install` requires the checked-in `.npmrc` (legacy-peer-deps).
- Typecheck with `npm run typecheck`; web build with `npm run export:web`.
