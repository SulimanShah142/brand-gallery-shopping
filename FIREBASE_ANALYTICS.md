# Firebase Analytics and Google Ads

The iOS Firebase native configuration and React Native Firebase Analytics SDK are wired into the Expo config. Analytics events are collected by the native Firebase SDK; `first_open` and `app_open` are automatic events, so do not manually log duplicate copies.

## Before building

The current `GoogleService-Info.plist` has `IS_ANALYTICS_ENABLED` set to `false`. Enable Google Analytics for the Firebase project in the Firebase Console, then download a fresh iOS configuration file for bundle ID `com.slliman.userapp` and replace the file in this directory. Do not change that flag by hand.

## Build and test on iOS

Build a development client with EAS (not Expo Go):

```sh
eas build --platform ios --profile development
```

Install the build on a registered iPhone, launch the app, and check the Firebase Analytics Realtime report or DebugView for automatically collected events. A development build must be rebuilt after changing native Firebase configuration or dependencies.

For a store/TestFlight build:

```sh
eas build --platform ios --profile production
```

## Import an event into Google Ads

In Google Analytics, link the GA4 property to the Google Ads account under **Admin → Product links → Google Ads Links**. Mark the event you actually want to count as a key event, then import that event as a conversion in Google Ads. `first_open` or `app_open` can verify app activity, but they are not purchase conversions; ecommerce conversions require logging and validating the corresponding purchase event.
