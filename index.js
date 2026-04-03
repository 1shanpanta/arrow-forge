// Generate ember particles
(function() {
  const container = document.getElementById('embers');
  for (let i = 0; i < 20; i++) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    ember.style.left = Math.random() * 100 + '%';
    ember.style.animationDuration = (6 + Math.random() * 8) + 's';
    ember.style.animationDelay = Math.random() * 10 + 's';
    ember.style.width = (2 + Math.random() * 2) + 'px';
    ember.style.height = ember.style.width;
    ember.style.background = Math.random() > 0.5 ? '#c9a84c' : '#ff8c42';
    container.appendChild(ember);
  }
})();

// Spark burst effect
function createSparkBurst(x, y, color) {
  const track = document.getElementById('track');
  const count = 8;
  for (let i = 0; i < count; i++) {
    const spark = document.createElement('div');
    spark.className = 'spark';
    spark.style.left = x + 'px';
    spark.style.top = y + 'px';
    spark.style.background = color;
    const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
    const dist = 15 + Math.random() * 20;
    const tx = Math.cos(angle) * dist;
    const ty = Math.sin(angle) * dist;
    spark.style.animation = 'none';
    spark.style.transition = 'all 0.35s ease-out';
    track.appendChild(spark);
    requestAnimationFrame(() => {
      spark.style.transform = `translate(${tx}px, ${ty}px) scale(0.3)`;
      spark.style.opacity = '0';
    });
    setTimeout(() => spark.remove(), 400);
  }
}

// Medieval music using Web Audio API
class MedievalMusic {
  constructor() {
    this.ctx = null;
    this.playing = false;
    this.nodes = [];
  }

  init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Master compressor for better sound
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.connect(this.ctx.destination);
    // Reverb-like delay
    this.delay = this.ctx.createDelay();
    this.delay.delayTime.value = 0.15;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.2;
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.compressor);
  }

  // Intensity level 0-4 controlled by game difficulty
  intensity = 0;

  setIntensity(level) {
    this.intensity = Math.min(level, 4);
    // Shift drone pitch and volume with intensity
    this.nodes.forEach((n, i) => {
      const baseFreqs = [65.41, 98.00, 130.81];
      const baseVols = [0.03, 0.02, 0.012];
      if (i < 3 && n.osc && n.gain) {
        // Raise drone pitch slightly and increase volume
        const pitchMult = 1 + this.intensity * 0.08;
        const volMult = 1 + this.intensity * 0.3;
        n.osc.frequency.linearRampToValueAtTime(
          baseFreqs[i] * pitchMult, this.ctx.currentTime + 0.5);
        n.gain.gain.linearRampToValueAtTime(
          Math.min(baseVols[i] * volMult, 0.08), this.ctx.currentTime + 0.5);
      }
    });
  }

  noteFreq(note) {
    // Scales get darker/more minor at higher intensity
    const scales = [
      [196.00, 220.00, 233.08, 261.63, 293.66, 329.63, 349.23, 392.00], // Dorian - calm
      [196.00, 220.00, 233.08, 261.63, 293.66, 311.13, 349.23, 392.00], // Natural minor
      [196.00, 207.65, 233.08, 261.63, 277.18, 311.13, 349.23, 392.00], // Phrygian - tense
      [196.00, 207.65, 233.08, 261.63, 277.18, 311.13, 369.99, 392.00], // Phrygian dominant
      [196.00, 207.65, 246.94, 261.63, 277.18, 329.63, 369.99, 392.00], // Hungarian minor - intense
    ];
    const scale = scales[Math.min(this.intensity, scales.length - 1)];
    return scale[note % scale.length] * (note >= 8 ? 2 : 1);
  }

  playNote(freq, time, duration, volume = 0.08) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    filter.type = 'lowpass';
    // Higher intensity = brighter, more piercing
    filter.frequency.value = 1500 + this.intensity * 400;
    filter.Q.value = 2 + this.intensity * 0.5;

    // More aggressive waveform at higher intensity
    const waveforms = ['triangle', 'triangle', 'sawtooth', 'sawtooth', 'square'];
    osc.type = waveforms[Math.min(this.intensity, 4)];
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
    [[65.41, 0.03], [98.00, 0.02], [130.81, 0.012]].forEach(([freq, vol]) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 300;
      osc.type = 'sawtooth';
      osc.frequency.value = freq;
      gain.gain.value = vol;
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.compressor);
      osc.start();
      this.nodes.push({ osc, gain });
    });
  }

  // Add percussion at higher intensities
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

    // Patterns get more complex and frantic at higher intensity
    const patternSets = [
      // Level 0: Calm, simple
      [[0,2,4,5,4,2,0,3], [5,4,2,0,2,4,7,5]],
      // Level 1: Slightly more movement
      [[0,2,4,5,4,2,0,3], [0,0,3,4,4,2,0,2], [4,5,7,5,4,2,3,0]],
      // Level 2: Faster, darker patterns + drums
      [[0,3,5,7,5,3,0,1,3,5,7,5], [7,5,3,1,0,1,3,5,7,5,3,0]],
      // Level 3: Intense, rapid runs
      [[0,1,3,5,7,5,3,1,0,3,7,5,3,1,0,1], [7,5,3,1,0,1,3,5,7,7,5,3,1,0,1,3]],
      // Level 4: Maximum chaos
      [[0,1,3,5,7,5,3,1,0,1,3,7,5,3,1,0,3,5,7,5], [7,5,3,0,1,3,5,7,5,3,1,0,3,5,7,5,3,1,0,1]],
    ];

    const set = patternSets[Math.min(this.intensity, 4)];
    const pattern = set[Math.floor(Math.random() * set.length)];
    // Tempo increases with intensity
    const beatLen = Math.max(0.4 - this.intensity * 0.05, 0.2);
    const vol = 0.05 + this.intensity * 0.008;

    pattern.forEach((note, i) => {
      const offset = (Math.random() - 0.5) * 0.02;
      this.playNote(this.noteFreq(note), now + i * beatLen + offset, beatLen * 0.7, vol);
      // Add drum hits on every 4th beat at intensity 2+
      if (i % 4 === 0) this.playDrum(now + i * beatLen);
    });

    this.melodyTimeout = setTimeout(
      () => this.playMelody(),
      pattern.length * beatLen * 1000 + 200 + Math.random() * 150
    );
  }

  start() {
    if (!this.ctx) this.init();
    if (this.ctx.state === 'suspended') this.ctx.resume();
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

const music = new MedievalMusic();
let musicOn = false;

document.getElementById('musicBtn').addEventListener('click', () => {
  musicOn = !musicOn;
  const btn = document.getElementById('musicBtn');
  btn.textContent = musicOn ? '\u266B Music On' : '\u266B Music';
  btn.classList.toggle('active', musicOn);
  if (musicOn) {
    music.start();
  } else {
    music.stop();
  }
});

// Game state
const DIRS = ['left', 'up', 'down', 'right'];
const SYMBOLS = { left: '\u25C0', up: '\u25B2', down: '\u25BC', right: '\u25B6' };
const LANE_X = { left: 0, up: 1, down: 2, right: 3 };
const KEY_MAP = { ArrowLeft: 'left', ArrowUp: 'up', ArrowDown: 'down', ArrowRight: 'right' };

let gameActive = false;
let score = 0;
let lives = 5;
let comboCount = 0;
let bestCombo = 0;
let perfects = 0;
let hits = 0;
let misses = 0;
let arrows = [];
let spawnInterval = null;
let animFrame = null;
let baseSpeed = 2.5;
let spawnRate = 1100;
let arrowId = 0;
let difficulty = 0;

const track = document.getElementById('track');
const trackHeight = 520;
const hitZoneTop = trackHeight - 110;
const hitZoneBot = trackHeight - 50;
const hitZoneCenter = (hitZoneTop + hitZoneBot) / 2;

function showFeedback(text, cls) {
  const fb = document.getElementById('feedback');
  fb.textContent = text;
  fb.className = 'feedback show ' + cls;
  setTimeout(() => fb.className = 'feedback', 500);
}

function flashTarget(dir, type) {
  const el = document.querySelector(`.target-arrow[data-dir="${dir}"]`);
  el.classList.add(type);
  setTimeout(() => el.classList.remove(type), 150);
}

function updateHUD() {
  document.getElementById('score').textContent = score;
  const shields = document.querySelectorAll('.shield');
  shields.forEach((s, i) => {
    s.classList.toggle('lost', i >= lives);
  });

  const comboEl = document.getElementById('combo');
  if (comboCount > 1) {
    comboEl.textContent = `Combo x${comboCount}`;
    comboEl.classList.add('show');
    comboEl.classList.toggle('fire', comboCount >= 10);
  } else {
    comboEl.classList.remove('show');
    comboEl.classList.remove('fire');
  }

  // Difficulty scaling
  const newDiff = Math.floor(score / 600);
  if (newDiff > difficulty) {
    difficulty = newDiff;
    baseSpeed = Math.min(2.5 + difficulty * 0.35, 5.5);
    spawnRate = Math.max(1100 - difficulty * 80, 450);
    restartSpawner();

    const badges = ['Apprentice', 'Journeyman', 'Blacksmith', 'Master Smith', 'Legendary'];
    document.getElementById('speedBadge').textContent = badges[Math.min(difficulty, badges.length - 1)];

    // Level up flash
    const flash = document.createElement('div');
    flash.className = 'level-up-flash';
    track.appendChild(flash);
    setTimeout(() => flash.remove(), 800);

    music.levelUpSound();
    music.setIntensity(difficulty);
  }
}

function spawnArrow() {
  if (!gameActive) return;

  const dir = DIRS[Math.floor(Math.random() * DIRS.length)];
  const el = document.createElement('div');
  el.className = 'arrow';
  const inner = document.createElement('div');
  inner.className = 'arrow-inner';
  inner.textContent = SYMBOLS[dir];
  el.appendChild(inner);
  el.style.left = (LANE_X[dir] * 25) + '%';
  el.style.top = '-45px';
  track.appendChild(el);

  arrows.push({
    id: arrowId++,
    dir,
    el,
    y: -45,
    speed: baseSpeed + (Math.random() * 0.4 - 0.2),
    hit: false,
  });
}

function restartSpawner() {
  clearInterval(spawnInterval);
  spawnInterval = setInterval(spawnArrow, spawnRate);
}

function gameLoop() {
  if (!gameActive) return;

  arrows.forEach(a => {
    if (a.hit) return;
    a.y += a.speed;
    a.el.style.top = a.y + 'px';

    if (a.y > trackHeight) {
      a.hit = true;
      a.el.classList.add('missed');
      setTimeout(() => a.el.remove(), 300);
      lives--;
      misses++;
      comboCount = 0;
      music.missSound();
      showFeedback('Miss', 'miss-text');
      flashTarget(a.dir, 'miss');
      document.getElementById('gameContainer').classList.add('shake');
      setTimeout(() => document.getElementById('gameContainer').classList.remove('shake'), 300);
      updateHUD();

      if (lives <= 0) {
        endGame();
        return;
      }
    }
  });

  arrows = arrows.filter(a => !(a.hit && a.y > trackHeight + 50));
  animFrame = requestAnimationFrame(gameLoop);
}

function handleKeyPress(dir) {
  if (!gameActive) return;

  let closest = null;
  let closestDist = Infinity;

  arrows.forEach(a => {
    if (a.hit || a.dir !== dir) return;
    const dist = Math.abs(a.y + 20 - hitZoneCenter);
    if (a.y + 20 >= hitZoneTop - 20 && a.y + 20 <= hitZoneBot + 20 && dist < closestDist) {
      closest = a;
      closestDist = dist;
    }
  });

  if (closest) {
    closest.hit = true;
    const isPerfect = closestDist < 15;

    // Calculate spark position
    const rect = closest.el.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    const sparkX = rect.left - trackRect.left + rect.width / 2 - 30;
    const sparkY = closest.y;

    if (isPerfect) {
      closest.el.classList.add('perfect');
      score += 150 * Math.max(1, Math.floor(comboCount / 5));
      perfects++;
      music.perfectSound();
      showFeedback('PERFECT', 'perfect-text');
      createSparkBurst(sparkX + 30, sparkY + 20, '#ffd700');
    } else {
      closest.el.classList.add('hit');
      score += 100 * Math.max(1, Math.floor(comboCount / 5));
      hits++;
      music.hitSound();
      showFeedback('Good', 'good-text');
      createSparkBurst(sparkX + 30, sparkY + 20, '#7ddf7d');
    }

    comboCount++;
    if (comboCount > bestCombo) bestCombo = comboCount;
    flashTarget(dir, 'flash');
    setTimeout(() => closest.el.remove(), 300);
    updateHUD();
  }
}

function startGame() {
  score = 0;
  lives = 5;
  comboCount = 0;
  bestCombo = 0;
  perfects = 0;
  hits = 0;
  misses = 0;
  difficulty = 0;
  baseSpeed = 2.5;
  spawnRate = 1100;
  arrows = [];
  gameActive = true;

  track.querySelectorAll('.arrow, .spark, .level-up-flash').forEach(el => el.remove());

  document.getElementById('speedBadge').textContent = 'Apprentice';
  updateHUD();

  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('gameOverScreen').classList.add('hidden');
  document.getElementById('nameInputArea').innerHTML = '';
  renderLeaderboard('startLeaderboard', -1);

  if (!music.ctx) music.init();
  if (music.ctx.state === 'suspended') music.ctx.resume();
  if (musicOn) {
    music.stop();
    music.start();
  }

  restartSpawner();
  animFrame = requestAnimationFrame(gameLoop);
}

// Leaderboard (localStorage)
const LB_KEY = 'arrow_forge_leaderboard';
const LB_MAX = 5;

function getLeaderboard() {
  try {
    return JSON.parse(localStorage.getItem(LB_KEY)) || [];
  } catch { return []; }
}

function saveLeaderboard(lb) {
  localStorage.setItem(LB_KEY, JSON.stringify(lb));
}

function isHighScore(s) {
  const lb = getLeaderboard();
  return lb.length < LB_MAX || s > (lb[lb.length - 1]?.score || 0);
}

function addToLeaderboard(name, s) {
  const lb = getLeaderboard();
  const entry = { name: name.slice(0, 16) || 'Anonymous', score: s, date: Date.now() };
  lb.push(entry);
  lb.sort((a, b) => b.score - a.score);
  if (lb.length > LB_MAX) lb.length = LB_MAX;
  saveLeaderboard(lb);
  return lb.indexOf(entry);
}

function renderLeaderboard(containerId, highlightIndex) {
  const container = document.getElementById(containerId);
  const lb = getLeaderboard();
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

function showNameInput(finalScore) {
  const area = document.getElementById('nameInputArea');
  const savedName = localStorage.getItem('arrow_forge_name') || '';
  area.innerHTML = `
    <div class="new-high-label">New High Score!</div>
    <div class="name-input-wrap">
      <input class="name-input" id="playerName" type="text" maxlength="16"
        placeholder="Thy name, smith" value="${savedName}" autofocus>
      <button class="name-submit" id="submitName">Inscribe</button>
    </div>`;

  const input = document.getElementById('playerName');
  const btn = document.getElementById('submitName');

  function submit() {
    const name = input.value.trim();
    localStorage.setItem('arrow_forge_name', name);
    const rank = addToLeaderboard(name || 'Anonymous', finalScore);
    area.innerHTML = '';
    renderLeaderboard('gameOverLeaderboard', rank);
  }

  btn.addEventListener('click', submit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
    e.stopPropagation();
  });

  setTimeout(() => input.focus(), 100);
}

// Show leaderboard on start screen
renderLeaderboard('startLeaderboard', -1);

function endGame() {
  gameActive = false;
  clearInterval(spawnInterval);
  cancelAnimationFrame(animFrame);

  document.getElementById('finalScore').textContent = score;
  document.getElementById('finalPerfects').textContent = perfects;
  document.getElementById('finalHits').textContent = hits;
  document.getElementById('finalMisses').textContent = misses;
  document.getElementById('finalCombo').textContent = bestCombo;

  setTimeout(() => {
    document.getElementById('gameOverScreen').classList.remove('hidden');
    if (isHighScore(score) && score > 0) {
      showNameInput(score);
      renderLeaderboard('gameOverLeaderboard', -1);
    } else {
      document.getElementById('nameInputArea').innerHTML = '';
      renderLeaderboard('gameOverLeaderboard', -1);
    }
  }, 600);
}

document.addEventListener('keydown', (e) => {
  if (KEY_MAP[e.key]) {
    e.preventDefault();
    handleKeyPress(KEY_MAP[e.key]);
  }
});

document.getElementById('startBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);

document.addEventListener('keydown', (e) => {
  const startVisible = !document.getElementById('startScreen').classList.contains('hidden');
  const overVisible = !document.getElementById('gameOverScreen').classList.contains('hidden');
  if (!gameActive && (startVisible || overVisible)) {
    if (KEY_MAP[e.key] || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      startGame();
    }
  }
});
