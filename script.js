// ==========================================
// GLOBAL & SHARED LOGIC
// ==========================================

const screens = {
    mainMenu: document.getElementById('main-menu-screen'),
    rrStart: document.getElementById('rr-start-screen'),
    rrGame: document.getElementById('rr-game-screen'),
    rrGameOver: document.getElementById('rr-game-over-screen'),
    ccStart: document.getElementById('cc-start-screen'),
    ccGame: document.getElementById('cc-game-screen'),
    ccGameOver: document.getElementById('cc-game-over-screen'),
    pmStart: document.getElementById('pm-start-screen'),
    pmGame: document.getElementById('pm-game-screen'),
    pmGameOver: document.getElementById('pm-game-over-screen'),
    mbStart: document.getElementById('mb-start-screen'),
    mbGame: document.getElementById('mb-game-screen'),
    mbGameOver: document.getElementById('mb-game-over-screen'),
    trStart: document.getElementById('tr-start-screen'),
    trGame: document.getElementById('tr-game-screen'),
    trGameOver: document.getElementById('tr-game-over-screen')
};

let currentGame = null; // 'rr', 'cc', 'pm', 'mb', or 'tr'
let isPaused = false;
let soundEnabled = localStorage.getItem('cognixSoundEnabled') !== 'false';

// Audio Context (Synthesized Sounds)
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!soundEnabled) return;
    initAudio();
    if (!audioCtx) return;

    const now = audioCtx.currentTime;

    // Helper to play a single pleasant note with an envelope
    function playNote(freq, typeWave, startTime, duration, startVol, endVol) {
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        osc.type = typeWave;
        osc.frequency.setValueAtTime(freq, startTime);
        
        gainNode.gain.setValueAtTime(startVol, startTime);
        gainNode.gain.exponentialRampToValueAtTime(endVol, startTime + duration);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
    }

    if (type === 'beep') {
        // Soft marimba-like warm click (triangle + sine harmonic)
        playNote(587.33, 'triangle', now, 0.12, 0.15, 0.001); // D5
        playNote(1174.66, 'sine', now, 0.08, 0.05, 0.001);  // D6 (octave harmonic)
    } else if (type === 'correct') {
        // Sparkling arpeggio chime (C Major)
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
            playNote(freq, 'sine', now + (idx * 0.07), 0.25, 0.12, 0.001);
        });
    } else if (type === 'wrong') {
        // Soft detuned low-pass filtered triangle thud (womp-womp)
        const osc1 = audioCtx.createOscillator();
        const osc2 = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(261.63, now); // C4
        osc1.frequency.linearRampToValueAtTime(130.81, now + 0.3); // down to C3

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(265.63, now); // Detuned
        osc2.frequency.linearRampToValueAtTime(132.81, now + 0.3);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(600, now);

        gainNode.gain.setValueAtTime(0.25, now);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.3);
        osc2.stop(now + 0.3);
    } else if (type === 'start') {
        // Upward energetic major arpeggio
        const notes = [261.63, 329.63, 392.00, 523.25]; // C4, E4, G4, C5
        notes.forEach((freq, idx) => {
            playNote(freq, 'triangle', now + (idx * 0.04), 0.35, 0.15, 0.001);
        });
    } else if (type === 'gameover') {
        // Melancholic descending chime
        const notes = [493.88, 392.00, 311.13, 261.63]; // B4, G4, Eb4, C4
        notes.forEach((freq, idx) => {
            playNote(freq, 'sine', now + (idx * 0.1), 0.6, 0.15, 0.001);
        });
    } else if (type === 'hover') {
        // Very subtle click/tick sound for hovers
        playNote(880.00, 'sine', now, 0.03, 0.03, 0.001);
    }
}

async function waitUnlessPaused(ms) {
    let elapsed = 0;
    const interval = 50;
    while (elapsed < ms) {
        if (!isPaused) {
            elapsed += interval;
        }
        await new Promise(r => setTimeout(r, interval));
    }
}

function switchScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function goHome() {
    isPaused = false;
    document.getElementById('pause-overlay').classList.remove('active');
    
    if (currentGame === 'rr') ReverseRecall.cleanup();
    if (currentGame === 'cc') ColorClash.cleanup();
    if (currentGame === 'pm') PatternMatrix.cleanup();
    if (currentGame === 'mb') MathBlitz.cleanup();
    if (currentGame === 'tr') TypeRush.cleanup();
    
    currentGame = null;
    updateBackgroundEffects(0);
    displayRandomNeuroTip();
    switchScreen('mainMenu');
}

function togglePause() {
    isPaused = !isPaused;
    const overlay = document.getElementById('pause-overlay');
    if (isPaused) {
        overlay.classList.add('active');
        if (currentGame === 'rr') clearInterval(ReverseRecall.timerInterval);
        if (currentGame === 'cc') clearInterval(ColorClash.timerInterval);
        if (currentGame === 'mb') clearInterval(MathBlitz.timerInterval);
        if (currentGame === 'tr') clearInterval(TypeRush.timerInterval);
    } else {
        overlay.classList.remove('active');
        if (currentGame === 'rr' && ReverseRecall.state.isInputPhase) ReverseRecall.resumeTimer();
        if (currentGame === 'cc' && ColorClash.state.isPlaying) ColorClash.resumeTimer();
        if (currentGame === 'mb' && MathBlitz.state.isPlaying) MathBlitz.resumeTimer();
        if (currentGame === 'tr' && TypeRush.state.isPlaying) TypeRush.resumeTimer();
    }
}

// Global Setup
document.addEventListener('DOMContentLoaded', () => {
    // Main Menu Cards
    document.querySelectorAll('.game-card').forEach(card => {
        card.addEventListener('click', () => {
            const game = card.dataset.game;
            currentGame = game;
            updateBackgroundEffects(0);
            if (game === 'rr') switchScreen('rrStart');
            if (game === 'cc') switchScreen('ccStart');
            if (game === 'pm') switchScreen('pmStart');
            if (game === 'mb') switchScreen('mbStart');
            if (game === 'tr') switchScreen('trStart');
        });
    });

    // Global Buttons
    document.querySelectorAll('.go-home-btn').forEach(btn => btn.addEventListener('click', goHome));
    document.querySelectorAll('.pause-btn').forEach(btn => btn.addEventListener('click', togglePause));
    document.getElementById('resume-btn').addEventListener('click', togglePause);
    document.getElementById('pause-home-btn').addEventListener('click', goHome);
    document.querySelectorAll('.quit-btn').forEach(btn => btn.addEventListener('click', goHome));

    // Settings (Sound toggle, reset stats, close settings dialog)
    const toggleSoundBtn = document.getElementById('toggle-sound-btn');
    
    function updateSoundBtnUI() {
        if (soundEnabled) {
            toggleSoundBtn.textContent = '🔊 Sound: ON';
            toggleSoundBtn.className = 'settings-control-btn sound-on';
        } else {
            toggleSoundBtn.textContent = '🔇 Sound: OFF';
            toggleSoundBtn.className = 'settings-control-btn sound-off';
        }
    }
    updateSoundBtnUI();

    toggleSoundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        localStorage.setItem('cognixSoundEnabled', soundEnabled);
        updateSoundBtnUI();
        if (soundEnabled) {
            playSound('beep');
        }
    });

    const resetScoresBtn = document.getElementById('reset-scores-btn');
    resetScoresBtn.addEventListener('click', () => {
        localStorage.removeItem('cognixRRHighScore');
        localStorage.removeItem('cognixCCHighScore');
        localStorage.removeItem('cognixPMHighScore');
        localStorage.removeItem('cognixMBHighScore');
        localStorage.removeItem('cognixTRHighScore');
        localStorage.removeItem('cognixRRMaxSequence');
        localStorage.removeItem('cognixCCMaxStreak');
        localStorage.removeItem('cognixPMMaxLevel');
        localStorage.removeItem('cognixMBMaxLevel');
        localStorage.removeItem('cognixTRMaxWPM');
        
        ReverseRecall.state.highScore = 0;
        ColorClash.state.highScore = 0;
        PatternMatrix.state.highScore = 0;
        MathBlitz.state.highScore = 0;
        TypeRush.state.highScore = 0;

        if (ReverseRecall.ui.hs) ReverseRecall.ui.hs.textContent = '0';
        if (ColorClash.ui.hs) ColorClash.ui.hs.textContent = '0';
        if (PatternMatrix.ui.hs) PatternMatrix.ui.hs.textContent = '0';
        if (MathBlitz.ui.hs) MathBlitz.ui.hs.textContent = '0';
        if (TypeRush.ui.hs) TypeRush.ui.hs.textContent = '0';

        const desktopRRHS = document.getElementById('desktop-rr-hs');
        if (desktopRRHS) desktopRRHS.textContent = '0';
        const desktopCCHS = document.getElementById('desktop-cc-hs');
        if (desktopCCHS) desktopCCHS.textContent = '0';
        const desktopPMHS = document.getElementById('desktop-pm-hs');
        if (desktopPMHS) desktopPMHS.textContent = '0';
        const desktopMBHS = document.getElementById('desktop-mb-hs');
        if (desktopMBHS) desktopMBHS.textContent = '0';
        const desktopTRHS = document.getElementById('desktop-tr-hs');
        if (desktopTRHS) desktopTRHS.textContent = '0';

        updateCognitiveMetrics();
        updateDailyObjectives();

        const originalText = resetScoresBtn.textContent;
        resetScoresBtn.textContent = '✅ Scores Reset!';
        resetScoresBtn.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        resetScoresBtn.style.color = '#34d399';
        setTimeout(() => {
            resetScoresBtn.textContent = originalText;
            resetScoresBtn.style.borderColor = '';
            resetScoresBtn.style.color = '';
        }, 1500);
    });

    document.getElementById('settings-btn').addEventListener('click', () => {
        document.getElementById('settings-overlay').classList.add('active');
    });
    document.getElementById('close-settings-btn').addEventListener('click', () => {
        document.getElementById('settings-overlay').classList.remove('active');
    });

    // Stats Modal Overlay Show/Hide
    const statsOverlay = document.getElementById('stats-overlay');
    document.getElementById('stats-btn').addEventListener('click', () => {
        displayRandomNeuroTip();
        statsOverlay.classList.add('active');
    });
    document.getElementById('close-stats-btn').addEventListener('click', () => {
        statsOverlay.classList.remove('active');
    });

    // Settings Help Tabs
    const helpTabs = document.querySelectorAll('.help-tab');
    const helpPanes = document.querySelectorAll('.help-pane');
    helpTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            playSound('hover');
            helpTabs.forEach(t => t.classList.remove('active'));
            helpPanes.forEach(p => p.style.display = 'none');
            
            tab.classList.add('active');
            const activePane = document.getElementById(tab.dataset.tab);
            if (activePane) activePane.style.display = 'block';
        });
    });

    // Hover sounds for interactive elements
    const hoverElements = document.querySelectorAll('.game-card, .help-tab, .diff-btn, .primary-btn, .secondary-btn, .control-btn, .settings-control-btn, .icon-btn');
    hoverElements.forEach(el => {
        el.addEventListener('mouseenter', () => {
            playSound('hover');
        });
    });

    // Init Games
    ReverseRecall.init();
    ColorClash.init();
    PatternMatrix.init();
    MathBlitz.init();
    TypeRush.init();
    updateBackgroundEffects(0);
    displayRandomNeuroTip();
    updateCognitiveMetrics();
    updateDailyObjectives();
});

// ==========================================
// REVERSE RECALL GAME
// ==========================================
const ReverseRecall = {
    state: {
        score: 0, streak: 0, level: 1, difficulty: 'medium',
        sequence: [], expectedInputSequence: [], playerInputIndex: 0,
        highScore: localStorage.getItem('cognixRRHighScore') || 0,
        isInputPhase: false
    },
    timerInterval: null,
    totalTimeMs: 0,
    remainingTimeMs: 0,
    diffMap: {
        easy: { lengthStart: 3, displayTimeMs: 1500, inputTimeSec: 15, distractions: false },
        medium: { lengthStart: 4, displayTimeMs: 1000, inputTimeSec: 12, distractions: true },
        hard: { lengthStart: 5, displayTimeMs: 800, inputTimeSec: 8, distractions: true }
    },
    ui: {},

    init() {
        this.ui = {
            hs: document.getElementById('rr-high-score'),
            diffBtns: document.querySelectorAll('#rr-difficulty .diff-btn'),
            startBtn: document.getElementById('rr-start-btn'),
            restartBtn: document.getElementById('rr-restart-btn'),
            lvl: document.getElementById('rr-level'),
            score: document.getElementById('rr-score'),
            streak: document.getElementById('rr-streak'),
            timerBar: document.getElementById('rr-timer-bar'),
            seqDisp: document.getElementById('rr-sequence-display'),
            inputDisp: document.getElementById('rr-player-input'),
            keypad: document.getElementById('rr-keypad'),
            distLayer: document.getElementById('distraction-layer'),
            goMsg: document.getElementById('rr-game-over-msg'),
            fScore: document.getElementById('rr-final-score'),
            fLvl: document.getElementById('rr-final-level'),
            newHs: document.getElementById('rr-new-high-score')
        };

        this.ui.hs.textContent = this.state.highScore;
        const desktopRRHS = document.getElementById('desktop-rr-hs');
        if (desktopRRHS) desktopRRHS.textContent = this.state.highScore;
        
        this.ui.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.difficulty = e.target.dataset.diff;
            });
        });

        this.ui.startBtn.addEventListener('click', () => this.startGame());
        this.ui.restartBtn.addEventListener('click', () => this.startGame());

        // Generate Keypad
        this.ui.keypad.innerHTML = '';
        for (let i = 1; i <= 9; i++) {
            const btn = document.createElement('button');
            btn.className = 'keypad-btn';
            btn.textContent = i;
            btn.addEventListener('click', () => this.handleInput(i));
            this.ui.keypad.appendChild(btn);
        }
    },

    cleanup() {
        clearInterval(this.timerInterval);
        this.state.isInputPhase = false;
        this.ui.distLayer.innerHTML = '';
        this.ui.hs.textContent = this.state.highScore;
    },

    updateUI() {
        this.ui.lvl.textContent = this.state.level;
        this.ui.score.textContent = this.state.score;
        this.ui.streak.textContent = this.state.streak;
    },

    startGame() {
        this.cleanup();
        this.state.score = 0;
        this.state.streak = 0;
        this.state.level = 1;
        this.updateUI();
        updateBackgroundEffects(0);
        switchScreen('rrGame');
        playSound('start');
        setTimeout(() => this.nextLevel(), 500);
    },

    nextLevel() {
        this.ui.distLayer.innerHTML = '';
        const settings = this.diffMap[this.state.difficulty];
        const seqLength = settings.lengthStart + Math.floor((this.state.level - 1) / 2);
        
        this.state.sequence = [];
        for (let i = 0; i < seqLength; i++) {
            this.state.sequence.push(Math.floor(Math.random() * 9) + 1);
        }
        
        this.state.expectedInputSequence = [...this.state.sequence].reverse();
        this.state.playerInputIndex = 0;
        
        this.ui.inputDisp.textContent = Array(seqLength).fill('_').join(' ');
        this.ui.keypad.classList.remove('active');
        
        this.playSequence();
    },

    async playSequence() {
        const settings = this.diffMap[this.state.difficulty];
        this.ui.seqDisp.textContent = '';
        
        if (settings.distractions && this.state.level % 3 === 0) {
            this.triggerFocusChallenge();
        }

        await waitUnlessPaused(800);
        if (currentGame !== 'rr') return;

        for (let i = 0; i < this.state.sequence.length; i++) {
            if (currentGame !== 'rr') return;
            this.ui.seqDisp.textContent = this.state.sequence[i];
            playSound('beep');
            await waitUnlessPaused(settings.displayTimeMs);
            if (currentGame !== 'rr') return;
            this.ui.seqDisp.textContent = '';
            await waitUnlessPaused(200);
            if (currentGame !== 'rr') return;
        }

        this.ui.seqDisp.textContent = 'GO!';
        await waitUnlessPaused(500);
        if (currentGame !== 'rr') return;
        this.ui.seqDisp.textContent = '';
        this.startInputPhase();
    },

    startInputPhase() {
        this.state.isInputPhase = true;
        this.ui.keypad.classList.add('active');
        
        const settings = this.diffMap[this.state.difficulty];
        this.totalTimeMs = settings.inputTimeSec * 1000;
        this.remainingTimeMs = this.totalTimeMs;
        
        this.ui.timerBar.style.width = '100%';
        this.ui.timerBar.style.backgroundColor = 'var(--success-color)';
        this.resumeTimer();
    },

    resumeTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (isPaused) return;

            this.remainingTimeMs -= 50;
            let percentage = (this.remainingTimeMs / this.totalTimeMs) * 100;
            this.ui.timerBar.style.width = `${percentage}%`;

            if (percentage < 30) this.ui.timerBar.style.backgroundColor = 'var(--error-color)';
            else if (percentage < 60) this.ui.timerBar.style.backgroundColor = '#fbbf24';

            if (this.remainingTimeMs <= 0) {
                clearInterval(this.timerInterval);
                this.state.isInputPhase = false;
                playSound('wrong');
                this.ui.inputDisp.classList.add('shake', 'wrong-flash');
                setTimeout(() => {
                    this.ui.inputDisp.classList.remove('shake', 'wrong-flash');
                    this.gameOver("Time's Up!");
                }, 1000);
            }
        }, 50);
    },

    handleInput(num) {
        const expected = this.state.expectedInputSequence[this.state.playerInputIndex];
        if (num === expected) {
            playSound('beep');
            this.state.playerInputIndex++;
            
            let currentDisplay = this.ui.inputDisp.textContent.split(' ');
            currentDisplay[this.state.playerInputIndex - 1] = num;
            this.ui.inputDisp.textContent = currentDisplay.join(' ');

            if (this.state.playerInputIndex === this.state.expectedInputSequence.length) {
                clearInterval(this.timerInterval);
                this.state.isInputPhase = false;
                playSound('correct');
                this.state.streak++;
                this.state.score += (this.state.level * 10) + (this.state.streak * 5);
                
                // Track max successfully recalled sequence length for Objectives
                const seqLength = this.state.sequence.length;
                const currentMaxSeq = parseInt(localStorage.getItem('cognixRRMaxSequence') || '0', 10);
                if (seqLength > currentMaxSeq) {
                    localStorage.setItem('cognixRRMaxSequence', seqLength);
                    updateDailyObjectives();
                }

                this.state.level++;
                this.ui.inputDisp.classList.add('correct-flash');
                this.updateUI();
                updateBackgroundEffects(this.state.streak);
                
                setTimeout(() => {
                    this.ui.inputDisp.classList.remove('correct-flash');
                    this.nextLevel();
                }, 1000);
            }
        } else {
            clearInterval(this.timerInterval);
            this.state.isInputPhase = false;
            playSound('wrong');
            this.ui.inputDisp.classList.add('wrong-flash', 'shake');
            
            let currentDisplay = this.ui.inputDisp.textContent.split(' ');
            currentDisplay[this.state.playerInputIndex] = expected;
            this.ui.inputDisp.textContent = currentDisplay.join(' ');
            
            setTimeout(() => {
                this.ui.inputDisp.classList.remove('wrong-flash', 'shake');
                this.gameOver("Wrong sequence!");
            }, 1500);
        }
    },

    triggerFocusChallenge() {
        const symbols = ['★', '▲', '●', '?', '!', '@', '#'];
        const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#d4af37'];
        for (let i = 0; i < 5; i++) {
            const el = document.createElement('div');
            el.className = 'distraction';
            el.textContent = symbols[Math.floor(Math.random() * symbols.length)];
            el.style.color = colors[Math.floor(Math.random() * colors.length)];
            el.style.left = `${Math.random() * 80 + 10}%`;
            el.style.top = `${Math.random() * 80 + 10}%`;
            el.style.animationDuration = `${Math.random() * 2 + 2}s`;
            this.ui.distLayer.appendChild(el);
        }
    },

    gameOver(reason) {
        this.ui.goMsg.textContent = reason;
        this.ui.fScore.textContent = this.state.score;
        this.ui.fLvl.textContent = this.state.level;
        
        this.ui.newHs.classList.add('hidden');
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('cognixRRHighScore', this.state.highScore);
            this.ui.newHs.classList.remove('hidden');
            const desktopRRHS = document.getElementById('desktop-rr-hs');
            if (desktopRRHS) desktopRRHS.textContent = this.state.highScore;
            updateCognitiveMetrics();
        }
        updateBackgroundEffects(0);
        switchScreen('rrGameOver');
        playSound('gameover');
    }
};

// ==========================================
// COLOR CLASH GAME
// ==========================================
const ColorClash = {
    colors: [
        { name: 'RED', hex: '#ef4444' },
        { name: 'BLUE', hex: '#3b82f6' },
        { name: 'GREEN', hex: '#10b981' },
        { name: 'YELLOW', hex: '#f59e0b' }
    ],
    state: {
        score: 0, streak: 0, level: 0, difficulty: 'medium',
        currentInk: null, currentWord: null,
        highScore: localStorage.getItem('cognixCCHighScore') || 0,
        isPlaying: false
    },
    timerInterval: null,
    totalTimeMs: 0,
    remainingTimeMs: 0,
    diffMap: {
        easy: { timeSec: 5.0, matchChance: 0.5 },
        medium: { timeSec: 3.5, matchChance: 0.2 },
        hard: { timeSec: 2.0, matchChance: 0.1 }
    },
    ui: {},

    init() {
        this.ui = {
            hs: document.getElementById('cc-high-score'),
            diffBtns: document.querySelectorAll('#cc-difficulty .diff-btn'),
            startBtn: document.getElementById('cc-start-btn'),
            restartBtn: document.getElementById('cc-restart-btn'),
            lvl: document.getElementById('cc-level'),
            score: document.getElementById('cc-score'),
            streak: document.getElementById('cc-streak'),
            timerBar: document.getElementById('cc-timer-bar'),
            wordDisp: document.getElementById('cc-word-display'),
            keypad: document.getElementById('cc-keypad'),
            goMsg: document.getElementById('cc-game-over-msg'),
            fScore: document.getElementById('cc-final-score'),
            fLvl: document.getElementById('cc-final-level'),
            newHs: document.getElementById('cc-new-high-score')
        };

        this.ui.hs.textContent = this.state.highScore;
        const desktopCCHS = document.getElementById('desktop-cc-hs');
        if (desktopCCHS) desktopCCHS.textContent = this.state.highScore;
        
        this.ui.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.difficulty = e.target.dataset.diff;
            });
        });

        this.ui.startBtn.addEventListener('click', () => this.startGame());
        this.ui.restartBtn.addEventListener('click', () => this.startGame());

        // Generate Keypad
        this.ui.keypad.innerHTML = '';
        this.colors.forEach(c => {
            const btn = document.createElement('button');
            btn.className = 'color-btn';
            btn.textContent = c.name;
            btn.style.backgroundColor = c.hex;
            btn.addEventListener('click', () => this.handleInput(c.name));
            this.ui.keypad.appendChild(btn);
        });
    },

    cleanup() {
        clearInterval(this.timerInterval);
        this.state.isPlaying = false;
        this.ui.hs.textContent = this.state.highScore;
    },

    updateUI() {
        this.ui.lvl.textContent = this.state.level;
        this.ui.score.textContent = this.state.score;
        this.ui.streak.textContent = this.state.streak;
    },

    startGame() {
        this.cleanup();
        this.state.score = 0;
        this.state.streak = 0;
        this.state.level = 0;
        this.updateUI();
        updateBackgroundEffects(0);
        switchScreen('ccGame');
        playSound('start');
        this.nextWord();
    },

    nextWord() {
        this.state.level++;
        this.updateUI();
        
        const settings = this.diffMap[this.state.difficulty];
        
        // Pick word
        const wordObj = this.colors[Math.floor(Math.random() * this.colors.length)];
        this.state.currentWord = wordObj.name;
        
        // Pick ink color
        if (Math.random() < settings.matchChance) {
            this.state.currentInk = wordObj; // match
        } else {
            let options = this.colors.filter(c => c.name !== wordObj.name);
            this.state.currentInk = options[Math.floor(Math.random() * options.length)];
        }

        this.ui.wordDisp.textContent = this.state.currentWord;
        this.ui.wordDisp.style.color = this.state.currentInk.hex;

        this.startTimer();
    },

    startTimer() {
        this.state.isPlaying = true;
        const settings = this.diffMap[this.state.difficulty];
        
        // Time gets slightly faster as streak increases (less aggressive speedup)
        const speedMultiplier = Math.max(0.7, 1 - (this.state.streak * 0.015));
        this.totalTimeMs = settings.timeSec * 1000 * speedMultiplier;
        this.remainingTimeMs = this.totalTimeMs;
        
        this.ui.timerBar.style.width = '100%';
        this.ui.timerBar.style.backgroundColor = 'var(--success-color)';
        
        this.resumeTimer();
    },

    resumeTimer() {
        clearInterval(this.timerInterval);
        this.timerInterval = setInterval(() => {
            if (isPaused) return;

            this.remainingTimeMs -= 50;
            let percentage = (this.remainingTimeMs / this.totalTimeMs) * 100;
            this.ui.timerBar.style.width = `${percentage}%`;

            if (percentage < 30) this.ui.timerBar.style.backgroundColor = 'var(--error-color)';
            else if (percentage < 60) this.ui.timerBar.style.backgroundColor = '#fbbf24';

            if (this.remainingTimeMs <= 0) {
                clearInterval(this.timerInterval);
                this.state.isPlaying = false;
                playSound('wrong');
                this.gameOver("Time's Up!");
            }
        }, 50);
    },

    handleInput(clickedColorName) {
        if (!this.state.isPlaying || isPaused) return;

        this.state.isPlaying = false; // Block rapid double-clicks immediately
        clearInterval(this.timerInterval);

        if (clickedColorName === this.state.currentInk.name) {
            // Correct
            playSound('beep');
            this.state.streak++;
            this.state.score += 10 + (this.state.streak * 2);
            
            // Track max streak length in Color Clash for Objectives
            const currentMaxCCStreak = parseInt(localStorage.getItem('cognixCCMaxStreak') || '0', 10);
            if (this.state.streak > currentMaxCCStreak) {
                localStorage.setItem('cognixCCMaxStreak', this.state.streak);
                updateDailyObjectives();
            }

            updateBackgroundEffects(this.state.streak);
            
            this.ui.wordDisp.classList.add('correct-flash');
            setTimeout(() => this.ui.wordDisp.classList.remove('correct-flash'), 150);
            
            this.nextWord();
        } else {
            // Wrong
            playSound('wrong');
            
            this.ui.wordDisp.classList.add('wrong-flash', 'shake');
            setTimeout(() => this.ui.wordDisp.classList.remove('wrong-flash', 'shake'), 500);
            
            this.gameOver("Wrong Color!");
        }
    },

    gameOver(reason) {
        this.ui.goMsg.textContent = reason;
        this.ui.fScore.textContent = this.state.score;
        this.ui.fLvl.textContent = this.state.level;
        
        this.ui.newHs.classList.add('hidden');
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('cognixCCHighScore', this.state.highScore);
            this.ui.newHs.classList.remove('hidden');
            const desktopCCHS = document.getElementById('desktop-cc-hs');
            if (desktopCCHS) desktopCCHS.textContent = this.state.highScore;
            updateCognitiveMetrics();
        }
        updateBackgroundEffects(0);
        setTimeout(() => {
            switchScreen('ccGameOver');
            playSound('gameover');
        }, 500);
    }
};

function updateBackgroundEffects(streak) {
    const root = document.documentElement;
    if (currentGame === null) {
        // Main Menu - calm gold/platinum/emerald theme
        root.style.setProperty('--orb-scale', '1');
        root.style.setProperty('--orb-opacity', '0.08');
        root.style.setProperty('--orb-color-1', 'rgba(217, 170, 30, 0.25)');
        root.style.setProperty('--orb-color-2', 'rgba(71, 85, 105, 0.15)');
        root.style.setProperty('--orb-color-3', 'rgba(5, 150, 105, 0.2)');
        
        root.style.setProperty('--orb-duration-1', '20s');
        root.style.setProperty('--orb-duration-2', '25s');
        root.style.setProperty('--orb-duration-3', '30s');
        
        root.style.setProperty('--grid-opacity', '0.7');
        root.style.setProperty('--grid-size', '28px');
        root.style.setProperty('--grid-pulse-speed', '6s');
        root.style.setProperty('--grid-color', 'rgba(71, 85, 105, 0.07)');
    } else {
        // Active gameplay - background becomes an active visual distractor based on streak (focus)
        // As streak grows, orbs grow larger (up to 1.8x) and glow brighter (up to 0.45 opacity)
        const scale = Math.min(1.8, 1 + (streak * 0.08));
        const opacity = Math.min(0.45, 0.15 + (streak * 0.03));
        
        root.style.setProperty('--orb-scale', scale);
        root.style.setProperty('--orb-opacity', opacity);
        
        // Speed up the orb drift cycles (durations decrease) as streak increases
        const factor = 1 + (streak * 0.3); // rapid acceleration factor
        const duration1 = Math.max(2.5, 20 / factor);
        const duration2 = Math.max(3.0, 25 / factor);
        const duration3 = Math.max(3.5, 30 / factor);
        
        root.style.setProperty('--orb-duration-1', `${duration1}s`);
        root.style.setProperty('--orb-duration-2', `${duration2}s`);
        root.style.setProperty('--orb-duration-3', `${duration3}s`);

        // Upgrade grid to pulse rapidly and shrink (denser pattern) to increase distraction
        const gridOpacity = Math.min(0.45, 0.15 + (streak * 0.03));
        const gridSize = Math.max(15, 50 - (streak * 3.5));
        const gridPulseSpeed = Math.max(0.4, 4 / factor);

        root.style.setProperty('--grid-opacity', gridOpacity);
        root.style.setProperty('--grid-size', `${gridSize}px`);
        root.style.setProperty('--grid-pulse-speed', `${gridPulseSpeed}s`);
        
        if (currentGame === 'rr') {
            // Reverse Recall (Memory): Deep blue/purple/teal theme
            root.style.setProperty('--orb-color-1', 'rgba(139, 92, 246, 0.25)'); // Purple
            root.style.setProperty('--orb-color-2', 'rgba(59, 130, 246, 0.2)');  // Blue
            root.style.setProperty('--orb-color-3', 'rgba(20, 184, 166, 0.2)');  // Teal
            root.style.setProperty('--grid-color', 'rgba(139, 92, 246, 0.08)');
        } else if (currentGame === 'cc') {
            // Color Clash (Flexibility): Crimson/amber/green theme
            root.style.setProperty('--orb-color-1', 'rgba(239, 68, 68, 0.25)');  // Crimson
            root.style.setProperty('--orb-color-2', 'rgba(245, 158, 11, 0.2)');   // Amber
            root.style.setProperty('--orb-color-3', 'rgba(16, 185, 129, 0.2)');  // Emerald
            root.style.setProperty('--grid-color', 'rgba(239, 68, 68, 0.08)');
        } else if (currentGame === 'pm') {
            // Pattern Matrix (Spatial Memory): Emerald/cyan/indigo theme
            root.style.setProperty('--orb-color-1', 'rgba(16, 185, 129, 0.25)'); // Emerald
            root.style.setProperty('--orb-color-2', 'rgba(6, 182, 212, 0.2)');   // Cyan
            root.style.setProperty('--orb-color-3', 'rgba(99, 102, 241, 0.2)');  // Indigo
            root.style.setProperty('--grid-color', 'rgba(16, 185, 129, 0.08)');
        } else if (currentGame === 'mb') {
            // Math Blitz (Arithmetic Speed): Orange/yellow/red theme
            root.style.setProperty('--orb-color-1', 'rgba(249, 115, 22, 0.25)'); // Orange
            root.style.setProperty('--orb-color-2', 'rgba(234, 179, 8, 0.2)');   // Yellow
            root.style.setProperty('--orb-color-3', 'rgba(239, 68, 68, 0.2)');   // Red
            root.style.setProperty('--grid-color', 'rgba(249, 115, 22, 0.08)');
        } else if (currentGame === 'tr') {
            // Type Rush (Motor Speed): Pink/indigo/purple theme
            root.style.setProperty('--orb-color-1', 'rgba(236, 72, 153, 0.25)'); // Pink
            root.style.setProperty('--orb-color-2', 'rgba(99, 102, 241, 0.2)');  // Indigo
            root.style.setProperty('--orb-color-3', 'rgba(139, 92, 246, 0.2)');  // Purple
            root.style.setProperty('--grid-color', 'rgba(236, 72, 153, 0.08)');
        }
    }
}

const neuroTips = [
    "The 'Stroop Effect' in Color Clash tests your brain's ability to override an automatic response (reading the word) in favor of a controlled response (naming the ink color).",
    "Working memory in Reverse Recall is like a mental scratchpad. It has a limited capacity, usually holding 4 to 7 items for a short duration.",
    "Dopamine, the reward neurotransmitter, is released when you achieve a new high score. It plays a key role in reinforcement learning and focus.",
    "Neuroplasticity is the brain's ability to reorganize itself by forming new neural connections in response to learning, challenge, or training.",
    "Varying difficulties and switching between games builds cognitive flexibility—the mental ability to switch between thinking about two different concepts.",
    "Distractions test your executive attention. Focus is not just about paying attention to one thing; it is also about actively ignoring everything else!"
];

function displayRandomNeuroTip() {
    const tipEl = document.getElementById('neuro-tip-text');
    if (tipEl) {
        const randomIndex = Math.floor(Math.random() * neuroTips.length);
        tipEl.textContent = neuroTips[randomIndex];
    }
}

function updateCognitiveMetrics() {
    const rrHS = parseInt(localStorage.getItem('cognixRRHighScore') || '0', 10);
    const ccHS = parseInt(localStorage.getItem('cognixCCHighScore') || '0', 10);
    const pmHS = parseInt(localStorage.getItem('cognixPMHighScore') || '0', 10);
    const mbHS = parseInt(localStorage.getItem('cognixMBHighScore') || '0', 10);
    const trHS = parseInt(localStorage.getItem('cognixTRHighScore') || '0', 10);

    // Calculate dynamic percentages from high scores
    const memorySpanVal = Math.min(100, Math.max(40, 40 + (rrHS * 0.4) + (pmHS * 0.3)));
    const processingSpeedVal = Math.min(100, Math.max(40, 40 + (ccHS * 0.3) + (mbHS * 0.2)));
    const focusVal = Math.min(100, Math.max(45, 45 + (trHS * 0.3) + ((rrHS + ccHS + pmHS + mbHS) * 0.08)));

    // Update labels
    const labels = document.querySelectorAll('.metric-val');
    if (labels.length >= 3) {
        labels[0].textContent = `${Math.round(memorySpanVal)}%`;
        labels[1].textContent = `${Math.round(processingSpeedVal)}%`;
        labels[2].textContent = `${Math.round(focusVal)}%`;
    }

    // Update progress fills
    const fills = document.querySelectorAll('.metric-fill');
    if (fills.length >= 3) {
        fills[0].style.width = `${memorySpanVal}%`;
        fills[1].style.width = `${processingSpeedVal}%`;
        fills[2].style.width = `${focusVal}%`;
    }
    
    // Update cognitive level text based on combined high scores of all 5 modules
    const totalScore = rrHS + ccHS + pmHS + mbHS + trHS;
    let trainerLevel = "Novice Trainer";
    let trainerCognition = "Level 1 Cognition";
    let avatar = "🧠";
    
    if (totalScore >= 450) {
        trainerLevel = "Grandmaster Cognition";
        trainerCognition = "Level 5+ Cognition";
        avatar = "🔮";
    } else if (totalScore >= 250) {
        trainerLevel = "Elite Neuro-Trainer";
        trainerCognition = "Level 4 Cognition";
        avatar = "🎖️";
    } else if (totalScore >= 120) {
        trainerLevel = "Cognitive Specialist";
        trainerCognition = "Level 3 Cognition";
        avatar = "⚡";
    } else if (totalScore >= 40) {
        trainerLevel = "Advanced Trainer";
        trainerCognition = "Level 2 Cognition";
        avatar = "🎓";
    }
    
    const trainerNameEl = document.querySelector('.profile-info h3');
    const trainerLvlEl = document.querySelector('.profile-info p');
    const avatarEl = document.querySelector('.avatar');
    if (trainerNameEl) trainerNameEl.textContent = trainerLevel;
    if (trainerLvlEl) trainerLvlEl.textContent = trainerCognition;
    if (avatarEl) avatarEl.textContent = avatar;
}

function updateDailyObjectives() {
    const maxSeq = parseInt(localStorage.getItem('cognixRRMaxSequence') || '0', 10);
    const maxCCStreak = parseInt(localStorage.getItem('cognixCCMaxStreak') || '0', 10);
    const maxPMLvl = parseInt(localStorage.getItem('cognixPMMaxLevel') || '0', 10);
    const maxMBLvl = parseInt(localStorage.getItem('cognixMBMaxLevel') || '0', 10);
    const maxTRWpm = parseInt(localStorage.getItem('cognixTRMaxWPM') || '0', 10);
    
    const objectivesList = document.querySelector('.objectives ul');
    if (objectivesList) {
        objectivesList.innerHTML = '';
        
        // Objective 1: Always completed once they open the app
        const li1 = document.createElement('li');
        li1.className = 'completed';
        li1.innerHTML = '✓ Start Cognix Suite';
        objectivesList.appendChild(li1);
        
        // Objective 2: Memorize 5+ items in Recall
        const li2 = document.createElement('li');
        const rrCompleted = maxSeq >= 5;
        if (rrCompleted) {
            li2.className = 'completed';
            li2.innerHTML = `✓ Memorize 5+ items in Recall (Max: ${maxSeq})`;
        } else {
            li2.innerHTML = `○ Memorize 5+ items in Recall (${maxSeq}/5)`;
        }
        objectivesList.appendChild(li2);
        
        // Objective 3: x10 Streak in Color Clash
        const li3 = document.createElement('li');
        const ccCompleted = maxCCStreak >= 10;
        if (ccCompleted) {
            li3.className = 'completed';
            li3.innerHTML = `✓ Get x10 Streak in Color Clash (Max: ${maxCCStreak})`;
        } else {
            li3.innerHTML = `○ Get x10 Streak in Color Clash (${maxCCStreak}/10)`;
        }
        objectivesList.appendChild(li3);

        // Objective 4: Pattern Matrix Level 4
        const li4 = document.createElement('li');
        const pmCompleted = maxPMLvl >= 4;
        if (pmCompleted) {
            li4.className = 'completed';
            li4.innerHTML = `✓ Reach Lvl 4 in Pattern Matrix (Max: ${maxPMLvl})`;
        } else {
            li4.innerHTML = `○ Reach Lvl 4 in Pattern Matrix (${maxPMLvl}/4)`;
        }
        objectivesList.appendChild(li4);

        // Objective 5: Type Rush WPM speed
        const li5 = document.createElement('li');
        const trCompleted = maxTRWpm >= 40;
        if (trCompleted) {
            li5.className = 'completed';
            li5.innerHTML = `✓ Type 40+ WPM in Type Rush (Max: ${maxTRWpm})`;
        } else {
            li5.innerHTML = `○ Type 40+ WPM in Type Rush (${maxTRWpm}/40)`;
        }
        objectivesList.appendChild(li5);
    }
}
