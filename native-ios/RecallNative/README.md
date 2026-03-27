# Recall Native

Native iPhone rewrite of Recall using SwiftUI, Firebase Auth, and Cloud Firestore.

## Current State

This directory contains a full native source scaffold:

- premium SwiftUI app shell
- Firestore-first repositories
- native domain models matching the existing backend shape
- Today, Library, Approval, Item Detail, Settings, and Import screens
- Apple Books approval flow with priority and category support

## Important Setup

This scaffold expects a real iOS Firebase config file:

- `GoogleService-Info.plist`

Place it at:

- `native-ios/RecallNative/GoogleService-Info.plist`

The current repo only contains the web Firebase config, so the native app is coded to fail gracefully until the iOS plist is added.

## Project Generation

This directory includes an `XcodeGen` project spec in `project.yml`.

When `xcodegen` is available:

```bash
cd native-ios/RecallNative
xcodegen generate
open RecallNative.xcodeproj
```

## Design Direction

The UI is intentionally native and restrained:

- large-title navigation
- calm premium surfaces
- SF Symbols + SF typography
- strong hierarchy, spacing, and whitespace
- category and priority presented as concise semantic metadata

## Scope

This scaffold is iPhone-first and iOS 16+.
