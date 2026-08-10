/**
 * DESI GYM / देसी जिम - Main Application Entrypoint
 */

import { initCaptionRotation } from './captions.js';
import { initPresence } from './presence.js';
import { initPlayer } from './player.js';

// Initialize Live Local Clock
function initClock() {
  const clockEl = document.getElementById('clock');
  if (!clockEl) return;

  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    
    hours = hours % 12;
    hours = hours ? hours : 12; // convert 0 to 12
    const formattedHours = String(hours).padStart(2, '0');

    clockEl.textContent = `${formattedHours}:${minutes} ${ampm}`;
    clockEl.setAttribute('datetime', now.toISOString());
  }

  updateClock();
  setInterval(updateClock, 1000);
}

// Initialize Application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  // 1. Clock
  initClock();

  // 2. Presence
  const liveCountEl = document.getElementById('live-user-count');
  initPresence(liveCountEl);

  // 3. Captions
  const captionEl = document.getElementById('caption');
  initCaptionRotation(captionEl);

  // 4. Radio Player
  initPlayer({
    playBtnId: 'play-btn',
    progressBarId: 'player-progress',
    progressFillId: 'player-progress-fill',
    titleId: 'player-title',
    subtitleId: 'player-subtitle'
  });

  // 5. Lower Atmosphere Subtle Mouse Interaction
  initAtmosphereInteraction();
});

// Initialize Subtle Lower Atmosphere Cursor Interaction
function initAtmosphereInteraction() {
  const hero = document.getElementById('hero');
  if (!hero) return;

  let ticking = false;
  window.addEventListener('mousemove', (e) => {
    if (ticking) return;
    ticking = true;

    requestAnimationFrame(() => {
      const xPct = Math.round((e.clientX / window.innerWidth) * 100);
      const rawY = (e.clientY / window.innerHeight) * 100;
      const yPct = Math.round(75 + (rawY * 0.25));

      hero.style.setProperty('--mouse-x', `${xPct}%`);
      hero.style.setProperty('--mouse-y', `${yPct}%`);
      ticking = false;
    });
  }, { passive: true });
}
