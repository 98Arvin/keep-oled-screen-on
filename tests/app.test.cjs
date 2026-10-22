const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const html = readFileSync(`${__dirname}/../index.html`, 'utf8');
const script = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
  .map(match => match[1]).find(source => source.includes('function init'));

async function boot({ storageBlocked = false, native = true, rejected = false, videoRejected = false, cleanupPending = false } = {}) {
  const elements = {}, handlers = {}, sentinels = [];
  let requests = 0, document, video;
  function element() {
    const classes = new Set(), listeners = {};
    return {
      style: { setProperty() {} }, isConnected: true, textContent: '',
      classList: {
        add: value => classes.add(value), remove: value => classes.delete(value),
        contains: value => classes.has(value),
        toggle(value, enabled) { enabled ? classes.add(value) : classes.delete(value); }
      },
      addEventListener(name, listener) { (listeners[name] ??= []).push(listener); },
      emit(name) { for (const listener of listeners[name] ?? []) listener(); },
      setAttribute() {}, appendChild() {}, querySelector: () => element(),
      focus() { document.activeElement = this; }
    };
  }
  document = {
    visibilityState: 'visible', body: element(), documentElement: element(),
    getElementById(id) { return elements[id] ??= element(); },
    addEventListener(name, listener) { (handlers[name] ??= []).push(listener); },
    createElement() {
      video = Object.assign(element(), {
        paused: true,
        play() {
          if (videoRejected) return Promise.reject(new Error('Playback blocked'));
          this.paused = false; this.emit('playing'); return Promise.resolve();
        },
        pause() { this.paused = true; this.emit('pause'); }
      });
      return video;
    }
  };
  document.activeElement = document.body;
  const navigator = native ? { wakeLock: { async request() {
    requests++;
    if (rejected) throw new Error('Lock denied');
    const sentinel = Object.assign(element(), { released: false });
    sentinels.push(sentinel);
    return sentinel;
  } } } : {};
  if (cleanupPending) navigator.serviceWorker = { getRegistrations: () => new Promise(() => {}) };
  function storage() { if (storageBlocked) throw new Error('SecurityError'); return null; }
  const context = {
    document, navigator,
    window: { innerWidth: 1000, innerHeight: 800, location: { href: 'https://oled.wtf/' }, addEventListener() {} },
    localStorage: { getItem: storage, setItem: storage, removeItem: storage },
    setTimeout() { return 1; }, clearTimeout() {}, setInterval() { return 1; }, clearInterval() {},
    requestAnimationFrame() { return 1; }, cancelAnimationFrame() {},
    performance: { now: () => 0 }, URL, history: { replaceState() {} }
  };
  vm.runInNewContext(script, context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  await settle();
  return {
    elements, document, sentinels, get requests() { return requests; }, get video() { return video; },
    async key(key, extra = {}) {
      for (const handler of handlers.keydown ?? []) handler({ key, preventDefault() {}, ...extra });
      await settle();
    },
    async visibility(value) {
      document.visibilityState = value;
      for (const handler of handlers.visibilitychange ?? []) await handler();
      await settle();
    },
    async release() {
      const sentinel = sentinels.at(-1);
      sentinel.released = true; sentinel.emit('release'); await settle();
    },
    denyLock(value) { rejected = value; }
  };
}

test('unavailable preference storage does not block wake locking or brightness', async () => {
  const app = await boot({ storageBlocked: true });
  assert.equal(app.requests, 1);
  await app.key('b');
  assert(app.document.body.classList.contains('brightness-low'));
});

test('both mechanisms failing produces actionable status and no success blip', async () => {
  const app = await boot({ native: false, videoRejected: true });
  assert.match(app.elements.toast.textContent, /UNAVAILABLE/);
  assert(!app.document.body.classList.contains('dot-visible'));
});

test('video-only operation is explicitly unverified', async () => {
  const app = await boot({ rejected: true });
  assert.match(app.elements.toast.textContent, /NOT VERIFIED/);
  assert(!app.document.body.classList.contains('dot-visible'));
});

test('native success controls the blip and recovers after returning to the page', async () => {
  const app = await boot();
  assert.match(app.elements.toast.textContent, /LOCK ACTIVE/);
  assert(app.document.body.classList.contains('dot-visible'));
  await app.visibility('hidden');
  await app.release();
  assert(!app.document.body.classList.contains('dot-visible'));
  assert.equal(app.requests, 1);
  await app.visibility('visible');
  assert.equal(app.requests, 2);
  assert(app.document.body.classList.contains('dot-visible'));
});

test('revocation followed by denial removes success indication', async () => {
  const app = await boot();
  app.denyLock(true);
  await app.release();
  assert(!app.document.body.classList.contains('dot-visible'));
  assert.match(app.elements.toast.textContent, /NOT VERIFIED/);
});

test('brightness ignores held keys and browser modifier shortcuts', async () => {
  const app = await boot();
  await app.key('b', { repeat: true });
  await app.key('b', { ctrlKey: true });
  assert(!app.document.body.classList.contains('brightness-low'));
  await app.key('b');
  assert(app.document.body.classList.contains('brightness-low'));
});

test('color dialog is keyboard accessible and restores focus', async () => {
  const app = await boot();
  await app.key('c');
  assert(app.elements.colorPanel.classList.contains('show'));
  assert.equal(app.document.activeElement, app.elements.colorPicker);
  await app.key('Tab');
  assert.equal(app.document.activeElement, app.elements.resetColor);
  await app.key('Tab', { shiftKey: true });
  assert.equal(app.document.activeElement, app.elements.colorPicker);
  await app.key('Escape');
  assert(!app.elements.colorPanel.classList.contains('show'));
  assert.equal(app.document.activeElement, app.document.body);
});

test('help reports the current wake state', async () => {
  const app = await boot({ native: false, videoRejected: true });
  await app.key('h');
  assert(app.elements.status.classList.contains('show'));
  assert.match(app.elements.toast.textContent, /UNAVAILABLE/);
});

test('muted video fallback is rendered across the viewport, not hidden off-screen', async () => {
  const app = await boot({ native: false });
  assert.equal(app.video.id, 'keepAwakeVideo');
  assert.equal(app.video.muted, true);
  assert.equal(app.video.loop, true);
  const css = html.match(/#keepAwakeVideo\s*\{([^}]+)\}/)[1];
  assert.match(css, /position:\s*fixed/);
  assert.match(css, /inset:\s*0/);
  assert.match(css, /width:\s*100%/);
  assert.match(css, /height:\s*100%/);
  assert.match(css, /object-fit:\s*fill/);
  assert.doesNotMatch(css, /opacity:\s*0|display:\s*none|visibility:\s*hidden/);
  assert.doesNotMatch(script, /video\.style\.(?:width|height|opacity|left|top)\s*=/);
});

test('video fallback pauses when hidden and resumes when visible', async () => {
  const app = await boot({ native: false });
  assert.equal(app.video.paused, false);
  await app.visibility('hidden');
  assert.equal(app.video.paused, true);
  await app.visibility('visible');
  assert.equal(app.video.paused, false);
});

test('pending cache cleanup does not block wake requests or retry listeners', async () => {
  const app = await boot({ cleanupPending: true, rejected: true });
  assert.equal(app.requests, 1);
  assert.equal(app.video.paused, false);
  app.denyLock(false);
  await app.key('b');
  assert.equal(app.requests, 2);
  assert(app.document.body.classList.contains('brightness-low'));
});
