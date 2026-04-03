// ── Constants ────────────────────────────────────────────────────────
const DIRS = ['left', 'up', 'down', 'right'];
const SYMBOLS = { left: '\u25C0', up: '\u25B2', down: '\u25BC', right: '\u25B6' };
const LANE_X = { left: 0, up: 1, down: 2, right: 3 };
const KEY_MAP = { ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right' };
const BADGES = ['Apprentice', 'Journeyman', 'Blacksmith', 'Master Smith', 'Legendary'];

const CONFIG = {
  trackHeight: 520,
  startLives: 5,
  startSpeed: 2.5,
  maxSpeed: 5.5,
  startSpawnRate: 1100,
  minSpawnRate: 450,
  scorePerLevel: 600,
  perfectThreshold: 15,
  perfectScore: 150,
  goodScore: 100,
  comboFireAt: 10,
  comboMultEvery: 5,
  speedPerLevel: 0.35,
  spawnRatePerLevel: 80,
};

const HIT_ZONE_TOP = CONFIG.trackHeight - 110;
const HIT_ZONE_BOT = CONFIG.trackHeight - 50;
const HIT_ZONE_CENTER = (HIT_ZONE_TOP + HIT_ZONE_BOT) / 2;

// ── DOM Cache ────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const dom = {
  embers: $('#embers'),
  musicBtn: $('#musicBtn'),
  startScreen: $('#startScreen'),
  gameOverScreen: $('#gameOverScreen'),
  startBtn: $('#startBtn'),
  restartBtn: $('#restartBtn'),
  gameContainer: $('#gameContainer'),
  track: $('#track'),
  score: $('#score'),
  combo: $('#combo'),
  speedBadge: $('#speedBadge'),
  feedback: $('#feedback'),
  nameInputArea: $('#nameInputArea'),
  finalScore: $('#finalScore'),
  finalPerfects: $('#finalPerfects'),
  finalHits: $('#finalHits'),
  finalMisses: $('#finalMisses'),
  finalCombo: $('#finalCombo'),
  shields: $$('.shield'),
};

// ── VFX ──────────────────────────────────────────────────────────────
const VFX = {
  initEmbers() {
    for (let i = 0; i < 20; i++) {
      const ember = document.createElement('div');
      ember.className = 'ember';
      const size = (2 + Math.random() * 2) + 'px';
      Object.assign(ember.style, {
        left: Math.random() * 100 + '%',
        animationDuration: (6 + Math.random() * 8) + 's',
        animationDelay: Math.random() * 10 + 's',
        width: size,
        height: size,
        background: Math.random() > 0.5 ? '#c9a84c' : '#ff8c42',
      });
      dom.embers.appendChild(ember);
    }
  },

  sparkBurst(x, y, color) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const spark = document.createElement('div');
      spark.className = 'spark';
      Object.assign(spark.style, {
        left: x + 'px',
        top: y + 'px',
        background: color,
        animation: 'none',
        transition: 'all 0.35s ease-out',
      });
      const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
      const dist = 15 + Math.random() * 20;
      const tx = Math.cos(angle) * dist;
      const ty = Math.sin(angle) * dist;
      dom.track.appendChild(spark);
      requestAnimationFrame(() => {
        spark.style.transform = `translate(${tx}px, ${ty}px) scale(0.3)`;
        spark.style.opacity = '0';
      });
      setTimeout(() => spark.remove(), 400);
    }
  },

  levelUpFlash() {
    const flash = document.createElement('div');
    flash.className = 'level-up-flash';
    dom.track.appendChild(flash);
    setTimeout(() => flash.remove(), 800);
  },

  shake() {
    dom.gameContainer.classList.add('shake');
    setTimeout(() => dom.gameContainer.classList.remove('shake'), 300);
  },
};

// ── Medieval Music (Web Audio API) ───────────────────────────────────
class MedievalMusic {
  ctx = null;
  playing = false;
  nodes = [];
  intensity = 0;
  melodyTimeout = null;
  compressor = null;
  delay = null;
  delayGain = null;

  static DRONE_FREQS = [65.41, 98.00, 130.81];
  static DRONE_VOLS = [0.03, 0.02, 0.012];
  static SCALES = [
    [196.00, 220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00],
    [196.00, 220.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00],
    [196.00, 207.65, 233.08, 261.63, 277.18, 311.13, 349.23, 392.00],
    [196.00, 207.65, 233.08, 261.63, 277.18, 311.13, 369.99, 392.00],
    [196.00, 207.65, 246.94, 261.63, 277.18, 329.63, 369.99, 392.00],
  ];
  static PATTERNS = [
    [[0,2,4,5,4,2,0,3], [5,4,2,0,2,4,7,5]],
    [[0,2,4,5,4,2,0,3], [0,0,3,4,4,2,0,2], [4,5,7,5,4,2,3,0]],
    [[0,3,5,7,5,3,0,1,3,5,7,5], [7,5,3,1,0,1,3,5,7,5,3,0]],
    [[0,1,3,5,7,5,3,1,0,3,7,5,3,1,0,1], [7,5,3,1,0,1,3,5,7,7,5,3,1,0,1,3]],
    [[0,1,3,5,7,5,3,1,0,1,3,7,5,3,1,0,3,5,7,5], [7,5,3,0,1,3,5,7,5,3,1,0,3,5,7,5,3,1,0,1]],
  ];
  static WAVEFORMS = ['triangle', 'triangle', 'sawtooth', 'sawtooth', 'square'];

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.connect(this.ctx.destination);
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.15;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.2;
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.compressor);
  }

  ensure() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  setIntensity(level) {
    this.intensity = Math.min(level, 4);
    const { DRONE_FREQS, DRONE_VOLS } = MedievalMusic;
    this.nodes.forEach((n, i) => {
      if (i < 3 && n.osc && n.gain) {
        const pitchMult = 1 + this.intensity * 0.08;
        const volMult = 1 + this.intensity * 0.3;
        n.osc.frequency.linearRampToValueAtTime(
          DRONE_FREQS[i] * pitchMult, this.ctx.currentTime + 0.5);
        n.gain.gain.linearRampToValueAtTime(
          Math.min(DRONE_VOLS[i] * volMult, 0.08), this.ctx.currentTime + 0.5);
      }
    });
  }

  noteFreq(note) {
    const scale = MedievalMusic.SCALES[Math.min(this.intensity, 4)];
    return scale[note % scale.length] * (note >= 8 ? 2 : 1);
  }

  playNote(freq, time, duration, volume = 0.08) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    filter.frequency.value = 1500 + this.intensity * 400;
    filter.Q.value = 2 + this.intensity * 0.5;

    osc.type = MedievalMusic.WAVEFORMS[Math.min(this.intensity, 4)];
    osc.frequency.value = freq;
    osc2.type = 'sine';
    osc2.frequency.value = freq * (1.003 + this.intensity * 0.002);

    gain.gain.setValueAtTime(0, time);
    gain.gain.linearRampToValueAtTime(volume, time + 0.03);
    gain.gain.setValueAtTime(volume * 0.7, time + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.compressor);
    gain.connect(this.delay);

    osc.start(time);
    osc.stop(time + duration);
    osc2.start(time);
    osc2.stop(time + duration);
  }

  playDrone() {
    if (!this.ctx) return;
    const { DRONE_FREQS, DRONE_VOLS } = MedievalMusic;
    DRONE_FREQS.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.value = DRONE_VOLS[i];
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      osc.start();
      this.nodes.push({ osc, gain });
    });
  }

  playDrum(time) {
    if (!this.ctx || this.intensity < 2) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.1);
    const vol = 0.04 + (this.intensity - 2) * 0.02;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    osc.connect(gain);
    gain.connect(this.compressor);
    osc.start(time);
    osc.stop(time + 0.15);
  }

  playMelody() {
    if (!this.ctx || !this.playing) return;
    const now = this.ctx.currentTime;
    const set = MedievalMusic.PATTERNS[Math.min(this.intensity, 4)];
    const pattern = set[Math.floor(Math.random() * set.length)];
    const beatLen = Math.max(0.4 - this.intensity * 0.05, 0.2);
    const vol = 0.05 + this.intensity * 0.008;

    pattern.forEach((note, i) => {
      const offset = (Math.random() - 0.5) * 0.02;
      this.playNote(this.noteFreq(note), now + i * beatLen + offset, beatLen * 0.7, vol);
      if (i % 4 === 0) this.playDrum(now + i * beatLen);
    });

    this.melodyTimeout = setTimeout(
      () => this.playMelody(),
      pattern.length * beatLen * 1000 + 200 + Math.random() * 150
    );
  }

  start() {
    this.ensure();
    this.playing = true;
    this.intensity = 0;
    this.playDrone();
    this.playMelody();
  }

  stop() {
    this.playing = false;
    clearTimeout(this.melodyTimeout);
    this.nodes.forEach(n => {
      n.gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.5);
      setTimeout(() => { try { n.osc.stop(); } catch(e) {} }, 600);
    });
    this.nodes = [];
  }

  hitSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playNote(880, now, 0.08, 0.1);
    this.playNote(1100, now + 0.04, 0.06, 0.07);
  }

  perfectSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.playNote(880, now, 0.08, 0.12);
    this.playNote(1100, now + 0.06, 0.08, 0.1);
    this.playNote(1320, now + 0.12, 0.12, 0.08);
  }

  missSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(80, now + 0.15);
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(this.compressor || this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  levelUpSound() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
      this.playNote(f, now + i * 0.1, 0.2, 0.08);
    });
  }
}

// ── Leaderboard ──────────────────────────────────────────────────────
class Leaderboard {
  static KEY = 'arrow_forge_leaderboard';
  static NAME_KEY = 'arrow_forge_name';
  static MAX = 5;

  static get() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { return []; }
  }

  static save(lb) {
    localStorage.setItem(this.KEY, JSON.stringify(lb));
  }

  static isHighScore(score) {
    const lb = this.get();
    return lb.length < this.MAX || score > (lb[lb.length - 1]?.score || 0);
  }

  static add(name, score) {
    const lb = this.get();
    const entry = { name: (name || 'Anonymous').slice(0, 16), score, date: Date.now() };
    lb.push(entry);
    lb.sort((a, b) => b.score - a.score);
    if (lb.length > this.MAX) lb.length = this.MAX;
    this.save(lb);
    return lb.indexOf(entry);
  }

  static render(containerId, highlightIndex = -1) {
    const container = document.getElementById(containerId);
    const lb = this.get();
    if (lb.length === 0) {
      container.innerHTML = `
        <div class="lb-title">Hall of Smiths</div>
        <div class="lb-empty">No scores yet. Be the first!</div>`;
      return;
    }
    const rows = lb.map((e, i) => {
      const hl = i === highlightIndex ? ' highlight new-entry' : '';
      return `<div class="lb-entry${hl}">
        <span class="lb-rank">${i + 1}</span>
        <span class="lb-name">${e.name}</span>
        <span class="lb-score">${e.score.toLocaleString()}</span>
      </div>`;
    }).join('');
    container.innerHTML = `<div class="lb-title">Hall of Smiths</div><div class="lb-list">${rows}</div>`;
  }

  static showNameInput(finalScore) {
    const savedName = localStorage.getItem(this.NAME_KEY) || '';
    dom.nameInputArea.innerHTML = `
      <div class="new-high-label">New High Score!</div>
      <div class="name-input-wrap">
        <input class="name-input" id="playerName" type="text" maxlength="16"
          placeholder="Thy name, smith" value="${savedName}" autofocus>
        <button class="name-submit" id="submitName">Inscribe</button>
      </div>`;

    const input = $('#playerName');
    const btn = $('#submitName');

    const submit = () => {
      const name = input.value.trim();
      localStorage.setItem(this.NAME_KEY, name);
      const rank = this.add(name || 'Anonymous', finalScore);
      dom.nameInputArea.innerHTML = '';
      this.render('gameOverLeaderboard', rank);
    };

    btn.addEventListener('click', submit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
      e.stopPropagation();
    });
    setTimeout(() => input.focus(), 100);
  }
}

// ── Game ──────────────────────────────────────────────────────────────
class Game {
  active = false;
  score = 0;
  lives = 0;
  combo = 0;
  bestCombo = 0;
  perfects = 0;
  hits = 0;
  misses = 0;
  difficulty = 0;
  baseSpeed = 0;
  spawnRate = 0;
  arrows = [];
  arrowId = 0;
  spawnInterval = null;
  animFrame = null;

  constructor(music) {
    this.music = music;
  }

  start() {
    this.score = 0;
    this.lives = CONFIG.startLives;
    this.combo = 0;
    this.bestCombo = 0;
    this.perfects = 0;
    this.hits = 0;
    this.misses = 0;
    this.difficulty = 0;
    this.baseSpeed = CONFIG.startSpeed;
    this.spawnRate = CONFIG.startSpawnRate;
    this.arrows = [];
    this.active = true;

    dom.track.querySelectorAll('.arrow, .spark, .level-up-flash').forEach(el => el.remove());
    dom.speedBadge.textContent = BADGES[0];
    this.updateHUD();

    dom.startScreen.classList.add('hidden');
    dom.gameOverScreen.classList.add('hidden');
    dom.nameInputArea.innerHTML = '';
    Leaderboard.render('startLeaderboard');

    this.music.ensure();
    if (musicOn) {
      this.music.stop();
      this.music.start();
    }

    this.restartSpawner();
    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  end() {
    this.active = false;
    clearInterval(this.spawnInterval);
    cancelAnimationFrame(this.animFrame);

    dom.finalScore.textContent = this.score;
    dom.finalPerfects.textContent = this.perfects;
    dom.finalHits.textContent = this.hits;
    dom.finalMisses.textContent = this.misses;
    dom.finalCombo.textContent = this.bestCombo;

    setTimeout(() => {
      dom.gameOverScreen.classList.remove('hidden');
      if (Leaderboard.isHighScore(this.score) && this.score > 0) {
        Leaderboard.showNameInput(this.score);
      } else {
        dom.nameInputArea.innerHTML = '';
      }
      Leaderboard.render('gameOverLeaderboard');
    }, 600);
  }

  updateHUD() {
    dom.score.textContent = this.score;
    dom.shields.forEach((s, i) => s.classList.toggle('lost', i >= this.lives));

    if (this.combo > 1) {
      dom.combo.textContent = `Combo x${this.combo}`;
      dom.combo.classList.add('show');
      dom.combo.classList.toggle('fire', this.combo >= CONFIG.comboFireAt);
    } else {
      dom.combo.classList.remove('show', 'fire');
    }
  }

  checkDifficulty() {
    const newDiff = Math.floor(this.score / CONFIG.scorePerLevel);
    if (newDiff <= this.difficulty) return;

    this.difficulty = newDiff;
    this.baseSpeed = Math.min(CONFIG.startSpeed + this.difficulty * CONFIG.speedPerLevel, CONFIG.maxSpeed);
    this.spawnRate = Math.max(CONFIG.startSpawnRate - this.difficulty * CONFIG.spawnRatePerLevel, CONFIG.minSpawnRate);
    this.restartSpawner();

    dom.speedBadge.textContent = BADGES[Math.min(this.difficulty, BADGES.length - 1)];
    VFX.levelUpFlash();
    this.music.levelUpSound();
    this.music.setIntensity(this.difficulty);
  }

  spawnArrow() {
    if (!this.active) return;

    const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
    const el = document.createElement('div');
    el.className = 'arrow';
    el.style.left = (LANE_X[dir] * 25) + '%';
    el.style.top = '-45px';

    const inner = document.createElement('div');
    inner.className = 'arrow-inner';
    inner.textContent = SYMBOLS[dir];
    el.appendChild(inner);
    dom.track.appendChild(el);

    this.arrows.push({
      id: this.arrowId++,
      dir,
      el,
      y: -45,
      speed: this.baseSpeed + (Math.random() * 0.4 - 0.2),
      hit: false,
    });
  }

  restartSpawner() {
    clearInterval(this.spawnInterval);
    this.spawnInterval = setInterval(() => this.spawnArrow(), this.spawnRate);
  }

  loop() {
    if (!this.active) return;

    for (const a of this.arrows) {
      if (a.hit) continue;
      a.y += a.speed;
      a.el.style.top = a.y + 'px';

      if (a.y > CONFIG.trackHeight) {
        a.hit = true;
        a.el.classList.add('missed');
        setTimeout(() => a.el.remove(), 300);
        this.lives--;
        this.misses++;
        this.combo = 0;
        this.music.missSound();
        this.showFeedback('Miss', 'miss-text');
        this.flashTarget(a.dir, 'miss');
        VFX.shake();
        this.updateHUD();

        if (this.lives <= 0) {
          this.end();
          return;
        }
      }
    }

    this.arrows = this.arrows.filter(a => !(a.hit && a.y > CONFIG.trackHeight + 50));
    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  handleKey(dir) {
    if (!this.active) return;

    let closest = null;
    let closestDist = Infinity;

    for (const a of this.arrows) {
      if (a.hit || a.dir !== dir) continue;
      const center = a.y + 20;
      const dist = Math.abs(center - HIT_ZONE_CENTER);
      if (center >= HIT_ZONE_TOP - 20 && center <= HIT_ZONE_BOT + 20 && dist < closestDist) {
        closest = a;
        closestDist = dist;
      }
    }

    if (!closest) return;

    closest.hit = true;
    const isPerfect = closestDist < CONFIG.perfectThreshold;
    const comboMult = Math.max(1, Math.floor(this.combo / CONFIG.comboMultEvery));

    const rect = closest.el.getBoundingClientRect();
    const trackRect = dom.track.getBoundingClientRect();
    const sparkX = rect.left - trackRect.left + rect.width / 2;
    const sparkY = closest.y + 20;

    if (isPerfect) {
      closest.el.classList.add('perfect');
      this.score += CONFIG.perfectScore * comboMult;
      this.perfects++;
      this.music.perfectSound();
      this.showFeedback('PERFECT', 'perfect-text');
      VFX.sparkBurst(sparkX, sparkY, '#ffd700');
    } else {
      closest.el.classList.add('hit');
      this.score += CONFIG.goodScore * comboMult;
      this.hits++;
      this.music.hitSound();
      this.showFeedback('Good', 'good-text');
      VFX.sparkBurst(sparkX, sparkY, '#7ddf7d');
    }

    this.combo++;
    if (this.combo > this.bestCombo) this.bestCombo = this.combo;
    this.flashTarget(dir, 'flash');
    setTimeout(() => closest.el.remove(), 300);
    this.updateHUD();
    this.checkDifficulty();
  }

  showFeedback(text, cls) {
    dom.feedback.textContent = text;
    dom.feedback.className = 'feedback show ' + cls;
    setTimeout(() => dom.feedback.className = 'feedback', 500);
  }

  flashTarget(dir, type) {
    const el = $(`.target-arrow[data-dir="${dir}"]`);
    el.classList.add(type);
    setTimeout(() => el.classList.remove(type), 150);
  }
}

// ── Init ─────────────────────────────────────────────────────────────
VFX.initEmbers();

const music = new MedievalMusic();
const game = new Game(music);
let musicOn = false;

dom.musicBtn.addEventListener('click', () => {
  musicOn = !musicOn;
  dom.musicBtn.textContent = musicOn ? '\u266B Music On' : '\u266B Music';
  dom.musicBtn.classList.toggle('active', musicOn);
  musicOn ? music.start() : music.stop();
});

dom.startBtn.addEventListener('click', () => game.start());
dom.restartBtn.addEventListener('click', () => game.start());

document.addEventListener('keydown', (e) => {
  if (KEY_MAP[e.key]) {
    e.preventDefault();
    if (game.active) {
      game.handleKey(KEY_MAP[e.key]);
    } else {
      game.start();
    }
    return;
  }
  if (!game.active && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    game.start();
  }
});

Leaderboard.render('startLeaderboard');
