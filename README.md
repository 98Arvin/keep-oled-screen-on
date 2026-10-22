# Keep OLED Screen On

Minimal, OLED-friendly web page that keeps the screen awake while the page is open.

## Features

- Always active while the page is visible
- Pure black background
- Screen Wake Lock API (when supported)
- Brief moving status blips when a native screen wake lock is held
- Hold click/touch or press `C` to choose the accent color; `Escape` closes the panel
- Color is remembered locally
- `B` toggles a moderate low-brightness mode and remembers the setting
- `F` toggles fullscreen
- `H` shows help and the current wake status
- No service-worker/offline cache

## Live

- https://oled.wtf
- https://screenawake.app

## Analytics

Live stats:  
https://oled.goatcounter.com

## Reliability and testing

A muted, looping, pure-black video fills the viewport alongside native wake locking.
It must remain rendered on-screen: Chromium does not grant a media wake lock to a
muted, off-screen 1-pixel video. The controls and moving dot appear above the video.
Keep this tab visible; minimizing the browser or switching tabs can release wake locks.

Video playback alone cannot confirm that the operating system will keep the display awake;
in that mode the page shows an unverified status and does not show the success blip.
A native wake-lock status means the browser granted the request, not independent proof
that the desktop power manager accepted it. OS power policies can still take precedence.
If both mechanisms are unavailable, tap the page to retry. Blocked preference storage
falls back to in-memory settings without preventing startup. Legacy cache cleanup does
not delay keep-awake startup or recovery listeners.

On GNOME, inspect the desktop's actual inhibitors while the page remains visible:

```sh
gnome-session-inhibit --list
```

Look for the browser's `Video Wake Lock` or screen wake-lock entry and inhibition of
idle/suspend. If absent, investigate the browser's integration with the desktop rather
than assuming that JavaScript playback or a granted browser request proves protection.

Run the dependency-free regression suite with Node.js 22 or newer:

```sh
node --test
```

The tests simulate browser APIs and cover storage failures, wake-lock denial and recovery,
video-only status, fallback layout, visibility changes, nonblocking cache cleanup,
keyboard shortcuts, and dialog focus. A local Chromium 144 test with the native API
disabled confirmed that the corrected video sends a GNOME `Inhibit` request with flags
12 (idle + suspend) to a mock session-manager endpoint; the old hidden video sent none.
This verifies the outgoing request, not Fedora/GNOME's handling on a real machine.
Actual screen-sleep behavior and native color-picker interaction still require testing
in browsers on real devices.
