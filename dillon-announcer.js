
 // Medic Bingo Bash — Dillon Sass recorded announcer
 // Locally hosted ElevenLabs MP3 recordings.

const GROUPS = {
  start: 5,
  pause: 5,
  resume: 5,
  invalid: 6,
  slow: 4,
  random: 6
};

const GAP_MS = 30000;
const PENDING_MAX_AGE_MS = 15000;

export function createDillonAnnouncer() {
  let current = null;
  let lastAt = 0;
  const lastPick = {};
  let pending = null;
  let unlocked = false;

  const prefix = new URL(
    './assets/dillon-voice/',
    import.meta.url
  ).href;

  function play(category, { force = false } = {}) {
    const count = GROUPS[category];

    if (!count) return false;

    // Mobile browsers may require a tap before playing sound.
    if (!unlocked) {
      pending = {
        category,
        force,
        at: Date.now()
      };
      return false;
    }

    const now = Date.now();

    // Prevent random announcements from talking over each other.
    if (
      !force &&
      (
        (current && !current.paused) ||
        now - lastAt < GAP_MS
      )
    ) {
      return false;
    }

    // Start, pause and resume can interrupt other announcements.
    if (current) {
      current.pause();
      current.currentTime = 0;
      current = null;
    }

    let index = 1 + Math.floor(Math.random() * count);

    // Avoid repeating the same recording consecutively.
    if (
      count > 1 &&
      index === lastPick[category]
    ) {
      index = index % count + 1;
    }

    lastPick[category] = index;

    const filename =
      category +
      '-' +
      String(index).padStart(2, '0') +
      '.mp3';

    const clip = new Audio(prefix + filename);

    clip.preload = 'auto';
    clip.volume = 0.85;

    current = clip;

    clip.onended = () => {
      if (current === clip) {
        current = null;
      }
    };

    clip.onerror = () => {
      if (current === clip) {
        current = null;
      }

      console.warn(
        'Dillon voice clip could not load:',
        clip.src
      );
    };

    try {
      const result = clip.play();

      if (
        result &&
        typeof result.catch === 'function'
      ) {
        result.catch(error => {
          if (current !== clip) return;

          current = null;

          if (error?.name === 'NotAllowedError') {
            // Retry on the player's next genuine interaction.
            unlocked = false;

            pending = {
              category,
              force,
              at: Date.now()
            };
          } else {
            console.warn(
              'Dillon voice playback failed:',
              error
            );
          }
        });
      }

      lastAt = now;
      pending = null;

      return true;

    } catch (error) {
      if (current === clip) {
        current = null;
      }

      console.warn(
        'Dillon voice playback failed:',
        error
      );

      return false;
    }
  }

  function unlock() {
    unlocked = true;

    const next = pending;
    pending = null;

    if (
      next &&
      Date.now() - next.at <= PENDING_MAX_AGE_MS
    ) {
      play(next.category, {
        force: next.force
      });
    }
  }

  // Keep these listeners active so phones can retry playback
  // after returning from a suspended/background session.
  document.addEventListener(
    'pointerdown',
    unlock,
    { capture: true }
  );

  document.addEventListener(
    'keydown',
    unlock,
    { capture: true }
  );

  return {
    speak: play
  };
}
