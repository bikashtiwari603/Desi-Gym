/**
 * DESI GYM - Underground Music Radio Player
 * YouTube IFrame Player API Integration Architecture with Shuffle & Next Track Support
 */

export const YOUTUBE_PLAYLIST_ID = 'RDCLAK5uy_k8jOtApFm8GvDPerBiJwOLRi7f1jVI9WE'; // YouTube Music Desi Gym Radio Playlist

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

    // DOM Elements
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

  init({ playBtnId, shuffleBtnId, nextBtnId, progressBarId, progressFillId, titleId, subtitleId }) {
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

    this.bindEvents();
    this.loadYouTubeApi();
  }

  bindEvents() {
    // Play / Pause Toggle
    this.playBtn.addEventListener('click', () => this.togglePlay());

    // Shuffle Button Toggle
    if (this.shuffleBtn) {
      this.shuffleBtn.addEventListener('click', () => this.toggleShuffle());
    }

    // Next Button Trigger
    if (this.nextBtn) {
      this.nextBtn.addEventListener('click', () => this.nextTrack());
    }

    // Progress Bar Click Seek
    if (this.progressBar) {
      this.progressBar.addEventListener('click', (e) => this.handleSeek(e));
    }
  }

  loadYouTubeApi() {
    // Register global callback for YouTube API
    window.onYouTubeIframeAPIReady = () => {
      this.createYouTubePlayer();
    };

    // Load API Script if not already loaded
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
      // Pick a random starting index for each site load (0 to 19)
      const randomStartIndex = Math.floor(Math.random() * 20);

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

    if (this.isApiReady && this.player && typeof this.player.playVideo === 'function') {
      try {
        // If first play of session, play a random index in playlist
        if (this.isFirstPlay) {
          this.isFirstPlay = false;
          if (typeof this.player.setShuffle === 'function') {
            this.player.setShuffle(true);
            this.isShuffled = true;
            this.updateShuffleUI();
          }
          if (typeof this.player.playVideoAt === 'function') {
            const playlistLength = (typeof this.player.getPlaylist === 'function' && this.player.getPlaylist()) ? this.player.getPlaylist().length : 25;
            const randomIndex = Math.floor(Math.random() * (playlistLength || 25));
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
      } else {
        this.shuffleBtn.classList.remove('active');
        this.shuffleBtn.setAttribute('title', 'Shuffle OFF');
      }
    }
  }

  nextTrack() {
    if (this.isApiReady && this.player && typeof this.player.nextVideo === 'function') {
      try {
        this.player.nextVideo();
        if (!this.isPlaying) {
          this.isPlaying = true;
          this.updateUI();
        }
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
    // YT.PlayerState.PLAYING = 1, PAUSED = 2, ENDED = 0
    if (event.data === 1) {
      this.isPlaying = true;
      this.updateUI();
      // Fetch track title
      if (this.player && typeof this.player.getVideoData === 'function') {
        const data = this.player.getVideoData();
        if (data && data.title && this.titleEl) {
          this.titleEl.textContent = data.title.length > 26 ? data.title.slice(0, 24) + '...' : data.title;
        }
      }
    } else if (event.data === 2 || event.data === 0) {
      this.isPlaying = false;
      this.updateUI();
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
          this.titleEl.textContent = data.title.length > 26 ? data.title.slice(0, 24) + '...' : data.title;
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
