/**
 * DESI GYM - Underground Music Radio Player
 * YouTube IFrame Player API Integration Architecture
 * Features:
 * - Shuffle Toggle & Random Initial Track Start
 * - Next & Previous Track Navigation
 * - Touch & Pointer Swipe to Change Songs (Forward / Backward)
 * - Screen Wake Lock to prevent phone screen timeout / locking during workouts
 * - MediaSession API & Background Audio Keep-Alive for lockscreen controls
 */

export const YOUTUBE_PLAYLIST_ID = 'RDCLAK5uy_k8jOtApFm8GvDPerBiJwOLRi7f1jVI9WE'; // YouTube Music Desi Gym Radio Playlist

// 1-second silent WAV data URI for maintaining background media session focus on mobile OS
const SILENT_AUDIO_URI = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

class RadioPlayer {
  constructor() {
    this.isPlaying = false;
    this.isShuffled = false;
    this.isFirstPlay = true;
    this.player = null;
    this.isApiReady = false;
    this.progressInterval = null;
    this.simulatedTime = 0;
    this.simulatedDuration = 180; // 3 min fallback
    this.wakeLock = null;
    this.silentAudio = null;

    // Swipe Gesture State
    this.touchStartX = 0;
    this.touchStartY = 0;
    this.touchStartTime = 0;
    this.isSwiping = false;

    // DOM Elements
    this.playerContainer = null;
    this.playBtn = null;
    this.shuffleBtn = null;
    this.nextBtn = null;
    this.playIcon = null;
    this.pauseIcon = null;
    this.progressBar = null;
    this.progressFill = null;
    this.titleEl = null;
    this.subtitleEl = null;
  }

  init({ playerContainerId, playBtnId, shuffleBtnId, nextBtnId, progressBarId, progressFillId, titleId, subtitleId }) {
    this.playerContainer = document.getElementById(playerContainerId);
    this.playBtn = document.getElementById(playBtnId);
    this.shuffleBtn = document.getElementById(shuffleBtnId);
    this.nextBtn = document.getElementById(nextBtnId);
    this.progressBar = document.getElementById(progressBarId);
    this.progressFill = document.getElementById(progressFillId);
    this.titleEl = document.getElementById(titleId);
    this.subtitleEl = document.getElementById(subtitleId);

    if (!this.playBtn) return;

    this.playIcon = this.playBtn.querySelector('.play-icon');
    this.pauseIcon = this.playBtn.querySelector('.pause-icon');

    this.initSilentAudioKeeper();
    this.bindEvents();
    this.initSwipeGestures();
    this.initWakeLockListener();
    this.loadYouTubeApi();
  }

  initSilentAudioKeeper() {
    try {
      this.silentAudio = new Audio(SILENT_AUDIO_URI);
      this.silentAudio.loop = true;
      this.silentAudio.volume = 0.01;
      this.silentAudio.setAttribute('playsinline', 'true');
      this.silentAudio.setAttribute('preload', 'auto');
    } catch (e) {
      console.debug('Silent audio keeper fallback', e);
    }
  }

  bindEvents() {
    // Play / Pause Toggle
    this.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.togglePlay();
    });

    // Shuffle Button Toggle
    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleShuffle();
      });
    }

    // Next Button Trigger
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.nextTrack();
      });
    }

    // Progress Bar Click Seek
    if (this.progressBar) {
      this.progressBar.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleSeek(e);
      });
    }
  }

  initSwipeGestures() {
    const el = this.playerContainer || document.getElementById('music-player') || document.getElementById('player-wrapper');
    if (!el) return;

    // Touch Events for Mobile Devices
    el.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
        this.isSwiping = true;
        el.style.transition = 'none';
      }
    }, { passive: true });

    el.addEventListener('touchmove', (e) => {
      if (!this.isSwiping || e.touches.length !== 1) return;
      const currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      const diffX = currentX - this.touchStartX;
      const diffY = currentY - this.touchStartY;

      // If horizontal gesture is dominant
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (e.cancelable && Math.abs(diffX) > 10) {
          e.preventDefault();
        }
        // Subtle interactive translation feedback (clamped)
        const damp = Math.sign(diffX) * Math.min(Math.abs(diffX) * 0.35, 50);
        el.style.transform = `translateX(${damp}px)`;
      }
    }, { passive: false });

    const handleSwipeEnd = (e) => {
      if (!this.isSwiping) return;
      this.isSwiping = false;

      el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translateX(0px)';

      const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : this.touchStartX;
      const diffX = endX - this.touchStartX;
      const timeElapsed = Date.now() - this.touchStartTime;

      const threshold = 35; // Minimum horizontal pixel delta

      if (Math.abs(diffX) > threshold && timeElapsed < 700) {
        if (diffX < 0) {
          // Swiped Left -> Forward / Next Track
          this.triggerSwipeAnimation('left');
          this.nextTrack();
        } else {
          // Swiped Right -> Backward / Previous Track
          this.triggerSwipeAnimation('right');
          this.prevTrack();
        }

        // Haptic feedback if available on mobile
        if (typeof navigator.vibrate === 'function') {
          navigator.vibrate(25);
        }
      }
    };

    el.addEventListener('touchend', handleSwipeEnd, { passive: true });
    el.addEventListener('touchcancel', () => {
      this.isSwiping = false;
      el.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
      el.style.transform = 'translateX(0px)';
    }, { passive: true });
  }

  triggerSwipeAnimation(direction) {
    const el = this.playerContainer || document.getElementById('music-player');
    if (!el) return;
    el.classList.remove('swipe-left-feedback', 'swipe-right-feedback');
    void el.offsetWidth; // trigger reflow
    el.classList.add(direction === 'left' ? 'swipe-left-feedback' : 'swipe-right-feedback');
    setTimeout(() => {
      el.classList.remove('swipe-left-feedback', 'swipe-right-feedback');
    }, 400);
  }

  /* --------------------------------------------------------------------------
     Screen Wake Lock & Keep-Alive System
     -------------------------------------------------------------------------- */
  async requestWakeLock() {
    if ('wakeLock' in navigator) {
      try {
        if (!this.wakeLock) {
          this.wakeLock = await navigator.wakeLock.request('screen');
          this.wakeLock.addEventListener('release', () => {
            this.wakeLock = null;
          });
        }
      } catch (err) {
        console.debug('Screen WakeLock request error:', err);
      }
    }
  }

  async releaseWakeLock() {
    if (this.wakeLock) {
      try {
        await this.wakeLock.release();
      } catch (e) {}
      this.wakeLock = null;
    }
  }

  initWakeLockListener() {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && this.isPlaying) {
        this.requestWakeLock();
      }
    });
  }

  /* --------------------------------------------------------------------------
     MediaSession API (Mobile Lock Screen & Notification Center Controls)
     -------------------------------------------------------------------------- */
  updateMediaSession(title, artist) {
    if ('mediaSession' in navigator) {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: title || 'देसी जिम RADIO',
          artist: artist || 'Desi Gym Underground',
          album: 'Desi Gym Underground Radio',
          artwork: [
            { src: '/images/hero-mobile.webp', sizes: '512x512', type: 'image/webp' },
            { src: '/images/hero-desktop.webp', sizes: '1024x1024', type: 'image/webp' }
          ]
        });

        navigator.mediaSession.setActionHandler('play', () => this.play());
        navigator.mediaSession.setActionHandler('pause', () => this.pause());
        navigator.mediaSession.setActionHandler('nexttrack', () => this.nextTrack());
        navigator.mediaSession.setActionHandler('previoustrack', () => this.prevTrack());
      } catch (e) {
        console.debug('MediaSession update ignored:', e);
      }
    }
  }

  /* --------------------------------------------------------------------------
     YouTube API & Player Lifecycle
     -------------------------------------------------------------------------- */
  loadYouTubeApi() {
    window.onYouTubeIframeAPIReady = () => {
      this.createYouTubePlayer();
    };

    if (!document.getElementById('yt-iframe-api')) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    }
  }

  createYouTubePlayer() {
    let container = document.getElementById('yt-player-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'yt-player-container';
      container.style.position = 'absolute';
      container.style.width = '1px';
      container.style.height = '1px';
      container.style.opacity = '0';
      container.style.pointerEvents = 'none';
      container.style.overflow = 'hidden';
      document.body.appendChild(container);
    }

    const playerDiv = document.createElement('div');
    playerDiv.id = 'yt-player';
    container.appendChild(playerDiv);

    try {
      // Pick a random starting index for each site load (0 to 24)
      const randomStartIndex = Math.floor(Math.random() * 25);

      this.player = new window.YT.Player('yt-player', {
        height: '1',
        width: '1',
        playerVars: {
          listType: 'playlist',
          list: YOUTUBE_PLAYLIST_ID,
          index: randomStartIndex,
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0
        },
        events: {
          onReady: () => {
            this.isApiReady = true;
            // Enable shuffle by default so every visit feels fresh
            try {
              if (typeof this.player.setShuffle === 'function') {
                this.player.setShuffle(true);
                this.isShuffled = true;
                this.updateShuffleUI();
              }
            } catch(e) {}
          },
          onStateChange: (event) => this.onPlayerStateChange(event),
          onError: () => {
            console.log('YouTube player fallback activated');
          }
        }
      });
    } catch (e) {
      console.warn('YouTube Player initialization fallback', e);
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    this.isPlaying = true;
    this.updateUI();
    this.requestWakeLock();

    // Trigger silent audio keep-alive for iOS / Android background session
    if (this.silentAudio) {
      this.silentAudio.play().catch(() => {});
    }

    if (this.isApiReady && this.player && typeof this.player.playVideo === 'function') {
      try {
        if (this.isFirstPlay) {
          this.isFirstPlay = false;
          if (typeof this.player.setShuffle === 'function') {
            this.player.setShuffle(this.isShuffled);
          }
          if (typeof this.player.playVideoAt === 'function') {
            const playlist = (typeof this.player.getPlaylist === 'function' && this.player.getPlaylist()) || [];
            const count = playlist && playlist.length > 0 ? playlist.length : 25;
            const randomIndex = Math.floor(Math.random() * count);
            this.player.playVideoAt(randomIndex);
            this.startProgressTracker();
            return;
          }
        }

        this.player.playVideo();
      } catch (e) {
        this.startFallbackTimer();
      }
    } else {
      this.startFallbackTimer();
    }

    this.startProgressTracker();
  }

  pause() {
    this.isPlaying = false;
    this.updateUI();
    this.releaseWakeLock();

    if (this.silentAudio) {
      this.silentAudio.pause();
    }

    if (this.isApiReady && this.player && typeof this.player.pauseVideo === 'function') {
      try {
        this.player.pauseVideo();
      } catch (e) {}
    }
    
    this.stopProgressTracker();
  }

  toggleShuffle() {
    this.isShuffled = !this.isShuffled;
    this.updateShuffleUI();

    if (this.isApiReady && this.player && typeof this.player.setShuffle === 'function') {
      try {
        this.player.setShuffle(this.isShuffled);
      } catch (e) {}
    }
  }

  updateShuffleUI() {
    if (this.shuffleBtn) {
      if (this.isShuffled) {
        this.shuffleBtn.classList.add('active');
        this.shuffleBtn.setAttribute('title', 'Shuffle ON');
        this.shuffleBtn.setAttribute('aria-pressed', 'true');
      } else {
        this.shuffleBtn.classList.remove('active');
        this.shuffleBtn.setAttribute('title', 'Shuffle OFF');
        this.shuffleBtn.setAttribute('aria-pressed', 'false');
      }
    }
  }

  nextTrack() {
    this.isFirstPlay = false;
    this.requestWakeLock();

    if (this.isApiReady && this.player && typeof this.player.nextVideo === 'function') {
      try {
        this.player.nextVideo();
        this.isPlaying = true;
        this.updateUI();
        this.startProgressTracker();
      } catch (e) {
        this.simulatedTime = 0;
      }
    } else {
      this.simulatedTime = 0;
      if (this.progressFill) {
        this.progressFill.style.width = '0%';
      }
    }
  }

  prevTrack() {
    this.isFirstPlay = false;
    this.requestWakeLock();

    if (this.isApiReady && this.player && typeof this.player.previousVideo === 'function') {
      try {
        this.player.previousVideo();
        this.isPlaying = true;
        this.updateUI();
        this.startProgressTracker();
      } catch (e) {
        this.simulatedTime = 0;
      }
    } else {
      this.simulatedTime = 0;
      if (this.progressFill) {
        this.progressFill.style.width = '0%';
      }
    }
  }

  onPlayerStateChange(event) {
    // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0, BUFFERING = 3
    if (event.data === 1) {
      this.isPlaying = true;
      this.updateUI();
      this.requestWakeLock();
      this.startProgressTracker();
      this.updateTrackMetadata();
    } else if (event.data === 2 || event.data === 0) {
      this.isPlaying = false;
      this.updateUI();
      this.releaseWakeLock();
    } else if (event.data === 3) {
      this.updateTrackMetadata();
    }
  }

  updateTrackMetadata() {
    if (this.player && typeof this.player.getVideoData === 'function') {
      const data = this.player.getVideoData();
      if (data && data.title) {
        const titleText = data.title.length > 28 ? data.title.slice(0, 26) + '...' : data.title;
        const authorText = data.author || 'Desi Gym Playlist';

        if (this.titleEl) {
          this.titleEl.textContent = titleText;
          this.titleEl.setAttribute('title', data.title);
        }
        if (this.subtitleEl) {
          this.subtitleEl.textContent = authorText;
        }

        this.updateMediaSession(data.title, authorText);
      }
    }
  }

  updateUI() {
    if (this.playBtn) {
      this.playBtn.setAttribute('aria-label', this.isPlaying ? 'Pause music' : 'Play music');
      if (this.playIcon && this.pauseIcon) {
        this.playIcon.style.display = this.isPlaying ? 'none' : 'block';
        this.pauseIcon.style.display = this.isPlaying ? 'block' : 'none';
      }
    }
  }

  startProgressTracker() {
    this.stopProgressTracker();
    this.progressInterval = setInterval(() => {
      this.updateProgress();
    }, 500);
  }

  stopProgressTracker() {
    if (this.progressInterval) {
      clearInterval(this.progressInterval);
      this.progressInterval = null;
    }
  }

  updateProgress() {
    let percent = 0;
    if (this.isApiReady && this.player && typeof this.player.getDuration === 'function') {
      const current = this.player.getCurrentTime() || 0;
      const duration = this.player.getDuration() || 1;
      percent = Math.min(100, (current / duration) * 100);
      
      // Keep title updated if changed dynamically
      if (this.player.getVideoData) {
        const data = this.player.getVideoData();
        if (data && data.title && this.titleEl && this.titleEl.textContent === 'देसी जिम RADIO') {
          this.titleEl.textContent = data.title.length > 28 ? data.title.slice(0, 26) + '...' : data.title;
        }
      }
    } else {
      this.simulatedTime += 0.5;
      if (this.simulatedTime > this.simulatedDuration) {
        this.simulatedTime = 0;
      }
      percent = (this.simulatedTime / this.simulatedDuration) * 100;
    }

    if (this.progressFill) {
      this.progressFill.style.width = `${percent}%`;
    }
  }

  startFallbackTimer() {
    if (!this.progressInterval) {
      this.startProgressTracker();
    }
  }

  handleSeek(e) {
    if (!this.progressBar) return;
    const rect = this.progressBar.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const fraction = Math.max(0, Math.min(1, clickX / width));

    if (this.isApiReady && this.player && typeof this.player.getDuration === 'function') {
      const duration = this.player.getDuration();
      if (duration) {
        this.player.seekTo(duration * fraction, true);
      }
    } else {
      this.simulatedTime = this.simulatedDuration * fraction;
    }

    if (this.progressFill) {
      this.progressFill.style.width = `${fraction * 100}%`;
    }
  }
}

export function initPlayer(config) {
  const player = new RadioPlayer();
  player.init(config);
  return player;
}
