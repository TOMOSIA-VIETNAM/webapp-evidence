# Setting a project up, and tuning how it records

Read this when a project has no `evidence.config.js` yet, or when a recording needs different
pacing, captions or archiving behaviour.

## Where the config is looked up

The place the config file sits decides how widely it applies. The runner searches from nearest to
furthest and stops at the first hit:

1. `EVIDENCE_CONFIG=<path>` — named outright
2. `evidence.config.js` **next to the step script** — one issue's own config, usually `require`-ing
   the shared one and overriding a key or two
3. Walking up the parent directories, checking `evidence.config.js` and
   `evidence/evidence.config.js` at each level — this is where a project's shared config belongs
4. `<project root>/.claude/evidence.config.js`
5. A shallow scan of the repository if nothing matched yet; more than one hit is an error asking for
   an explicit path

## Building the config the first time

The config is the whole of what this skill cannot work out for itself. Follow this order and there
is nothing left to guess:

1. **Find the dev URL and how the app starts** — read the README, `docker-compose.yml`,
   `package.json` scripts, `Procfile`. Note the start command and the port.
2. **Write a minimal config** from `assets/evidence.config.example.js`: `baseUrl` only, no `login`
   and no `prepare` yet. Put it in the project's shared evidence directory.
3. **Probe the login screen**: `node scripts/inspect.js /path-to-login` — take the real
   selectors of the email field, the password field and the submit button instead of guessing field
   names.
4. **Find where dev accounts come from**: seeds, fixtures, or a record already in the database.
   Prefer something the skill can obtain by itself (query the database, reset the password of an
   existing account) so later runs need no one's help. If that is impossible, ask the user once and
   store the result in `accountStore`.
5. **Write `login()`** using the selectors just probed. If the app has a second authentication step
   (a one-time code, an unrecognised-device check), handle it here — reading the code from the
   database is usually faster and steadier than reading a mailbox.
6. **Write `prepare()`** if the environment drifts often (a container is down, a dependency is
   missing, a migration is pending). Return the list of what it fixed so the runner can print it.
7. **Check the result**: `node scripts/inspect.js /some-screen-behind-login` — getting an
   element list back means the config and the login both work. Only now write the step script and
   record.

Steps 3 and 7 use `inspect.js` for two different purposes: once to **write** the login, once to
**confirm** it works.

## The shape of the config

`evidence.config.js` is split into scopes so that a new group can be added later without disturbing
the existing ones:

| Scope | Holds |
|---|---|
| `apps` | per app: `baseUrl`, `prepare`, `login` |
| `recording` | frame size, locale, browser, **action speed**, captions, video quality |
| `output` | what happens to the results: `overwrite`, `accountStore` |

Any key left out falls back to the skill's default; `scripts/settings.js` is the place that lists
them all.

An issue-specific config inherits from the shared one by spreading it. The spread is shallow, so an
override has to be written inside the right scope:

```js
const base = require('../../evidence/evidence.config.js');
module.exports = { ...base, recording: { ...base.recording, speed: 'slow' } };
```

## Speed

`recording.speed` reads like the playback speed of a video player: **a bigger number is faster**.

| Value | Meaning |
|---|---|
| `'slowest'` | 0.5× — half speed |
| `'slow'` | 0.67× |
| `'normal'` | 1× (default) |
| `'fast'` | 1.67× |
| any number in `0.2`–`5` | a custom rate, e.g. `0.8` for slightly slower than usual |

This is the key meant for real viewer feedback — people say "too fast", not "raise afterClickMs to
1200". A number outside the range is rejected with an explanation, so one typo cannot turn a take
into an hour of footage.

Underneath it sits `recording.pace`, holding each individual duration (the wait after a click, the
typing speed, how long the last frame is held…). Reach for it only when one specific action needs to
differ from the rest; a value written there is absolute and is not scaled by `speed` on top. The
full list lives in `scripts/settings.js`.

Do not tune pacing by scattering `sleep()` calls through the step script. Pacing is a property of
the whole take; kept in one place, changing it later is a single edit.

Three parts of `pace` are computed rather than fixed, so the take does not come out machine-even:

| Part | How it behaves |
|---|---|
| Waits | Jittered around the configured value by `pace.jitter` (default `0.18`). Perfectly even timing is the clearest sign of a bot-driven video. Set `0` when two takes must match frame for frame |
| Cursor travel time | Derived from the distance and the size of the target (`cursorBaseMs`, `cursorPerBitMs`, clamped between `cursorMinMs` and `cursorMaxMs`). Moving to the next field takes ~0.4s, crossing the screen ~0.8s. On a long move the cursor overshoots slightly and corrects |
| Typing speed | `typeCharMs` is an average; individual characters vary around it, slowing at spaces and after punctuation |

The randomness is seeded from the step script's name, so the same script produces the same pacing on
every run — which is what lets the runbook promise that re-running reproduces the take.

## Captions

```js
recording: {
  captions: { enabled: true, locale: 'ja' },   // locale: en | ja | vi
},
```

Set this in the shared config when the whole project always uses one language (Japanese for a
Japanese customer), so no one is asked again on every recording. `CAPTIONS` and `CAPTION_LOCALE` on
the command line beat the config — that is the decision of whoever is running it.

The caption language is the language **the MR reviewer reads**, not the language of the app's UI.
Same criterion as `mark()` and the `label` of `hotkey()`.

## Keeping previous takes

`output.overwrite` defaults to `false`: before recording, the previous results are moved into `v1`,
`v2`… inside the evidence directory, and the new take is written to the directory itself. The reason
is that evidence has already been attached to an MR — overwriting destroys the only thing left to
compare against when the old behaviour is disputed. Step scripts, fixtures and configs are not
results, so they stay where they are.

If only the newest take matters, set `output.overwrite: true`, or run once with
`EVIDENCE_OVERWRITE=1`.

`accountStore` has no such escape hatch: it holds passwords and stays around, so it must live in an
already git-ignored location.
