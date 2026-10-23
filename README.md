# GG Player vLG — Titan OS web app

This folder contains the Titan OS-oriented web app bundle. The UI, streaming libraries, CSS, artwork, login flow, and local catalog persistence were copied from the webOS project; platform-specific behavior was adapted in this folder only.

## Entry point and assets

- Entry point: `index.html`
- Browser app metadata: `manifest.webmanifest`
- Package metadata: `package.json`
- Icons: `icons/icon-192.png` and `icons/icon-512.png`
- 1080p splash artwork: `splash/splash-1920x1080.png`

`manifest.webmanifest` is a standard browser web app manifest. `package.json` includes project-level Titan OS deployment metadata; neither file is a claim that a public, vendor-standard Titan OS package format exists. Final certification, hosting, and packaging must follow the Titan OS partner/developer program for the target TV models.

## Platform behavior

- The app uses browser `localStorage` and IndexedDB for credentials, playlists, favorites, history, and catalog cache.
- A four-digit numeric `GG-` device identifier (for example, `GG-0427`) is generated with the browser crypto API when available and persisted locally. It is not a hardware ID; clearing browser storage creates a new ID. Previously saved UUID or six-character IDs are replaced on the next activation launch, so the device must be authorized again using its new code.
- Device registration and authorization follow the WebOS Firebase flow and use the Firestore `devices` and `config/global` documents without Firebase Authentication. The Firestore rules must permit unauthenticated device reads/creates and config reads for this legacy flow.
- D-pad, Back, media, and color-button key events are handled in the app. The browser or TV firmware must expose these remote buttons as keyboard events for them to work.
- webOS Luna APIs and app-launch calls are not used in this bundle. Opening a separate YouTube app is not supported; direct trailer embedding remains subject to provider restrictions.
- Browser CORS rules cannot be disabled by client JavaScript. Xtream, M3U, EPG, Firebase, and other remote services must return suitable CORS headers for the Titan OS app origin. If the service cannot be configured, a server-side proxy under your control is required.

## Validation and deployment

The files are a static web application and should be served from an HTTPS origin or packaged using the Titan OS partner tooling available to the publisher. Test authentication, remote-key delivery, media codecs, storage persistence, and cross-origin requests on each target TV model; those behaviors depend on the firmware and service responses.
