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

The video workaround remains enabled alongside native wake locking for Linux compatibility.
Video playback alone cannot confirm that the operating system will keep the display awake;
in that mode the page shows an unverified status and does not show the success blip.
If both mechanisms are unavailable, tap the page to retry. Blocked preference storage
falls back to in-memory settings without preventing startup.

Run the dependency-free regression suite with Node.js 22 or newer:

```sh
node --test
```

The tests simulate browser APIs and cover storage failures, wake-lock denial and recovery,
video-only status, keyboard shortcuts, and dialog focus. Actual screen-sleep behavior and
native color-picker interaction still require testing in browsers on real devices.
