// ==========================================
// PATTERN MATRIX GAME
// ==========================================
const PatternMatrix = {
    state: {
        score: 0, streak: 0, level: 1, difficulty: 'medium',
        highScore: parseInt(localStorage.getItem('cognixPMHighScore') || '0', 10),
        pattern: [], playerPattern: [], isShowingPattern: false, isInputPhase: false,
        gridSize: 4, cellsToRemember: 3
    },

    diffMap: {
        easy:   { gridSize: 3, cellsStart: 2, cellsGrowth: 0.5 },
        medium: { gridSize: 4, cellsStart: 3, cellsGrowth: 0.5 },
        hard:   { gridSize: 5, cellsStart: 4, cellsGrowth: 0.5 }
    },

    ui: {},

    init() {
        this.ui = {
            grid: document.getElementById('pm-grid'),
            status: document.getElementById('pm-status'),
            lvl: document.getElementById('pm-level'),
            score: document.getElementById('pm-score'),
            streak: document.getElementById('pm-streak'),
            hs: document.getElementById('pm-high-score'),
            startBtn: document.getElementById('pm-start-btn'),
            restartBtn: document.getElementById('pm-restart-btn'),
            diffBtns: document.querySelectorAll('#pm-difficulty .diff-btn'),
            goMsg: document.getElementById('pm-game-over-msg'),
            fScore: document.getElementById('pm-final-score'),
            fLvl: document.getElementById('pm-final-level'),
            newHs: document.getElementById('pm-new-high-score')
        };

        this.ui.hs.textContent = this.state.highScore;
        const desktopPMHS = document.getElementById('desktop-pm-hs');
        if (desktopPMHS) desktopPMHS.textContent = this.state.highScore;

        this.ui.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.difficulty = e.target.dataset.diff;
            });
        });

        this.ui.startBtn.addEventListener('click', () => this.startGame());
        this.ui.restartBtn.addEventListener('click', () => this.startGame());
    },

    cleanup() {
        this.state.isShowingPattern = false;
        this.state.isInputPhase = false;
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
        switchScreen('pmGame');
        playSound('start');
        setTimeout(() => this.nextLevel(), 500);
    },

    nextLevel() {
        const settings = this.diffMap[this.state.difficulty];
        this.state.gridSize = settings.gridSize;
        const cellCount = Math.min(
            settings.gridSize * settings.gridSize - 1,
            Math.floor(settings.cellsStart + (this.state.level - 1) * settings.cellsGrowth)
        );

        // Build grid
        this.ui.grid.innerHTML = '';
        this.ui.grid.style.gridTemplateColumns = `repeat(${this.state.gridSize}, 1fr)`;
        const totalCells = this.state.gridSize * this.state.gridSize;

        for (let i = 0; i < totalCells; i++) {
            const cell = document.createElement('div');
            cell.className = 'pm-cell';
            cell.dataset.index = i;
            cell.addEventListener('click', () => this.handleCellClick(i));
            this.ui.grid.appendChild(cell);
        }

        // Generate random pattern
        this.state.pattern = [];
        while (this.state.pattern.length < cellCount) {
            const idx = Math.floor(Math.random() * totalCells);
            if (!this.state.pattern.includes(idx)) {
                this.state.pattern.push(idx);
            }
        }

        this.state.playerPattern = [];
        this.state.isInputPhase = false;

        this.showPattern();
    },

    async showPattern() {
        this.state.isShowingPattern = true;
        this.ui.status.textContent = 'Watch the pattern...';

        // Flash cells
        const cells = this.ui.grid.querySelectorAll('.pm-cell');
        this.state.pattern.forEach(idx => cells[idx].classList.add('flash'));

        // Show for a duration based on difficulty
        const showTime = this.state.difficulty === 'easy' ? 1000 : this.state.difficulty === 'medium' ? 600 : 300;
        await new Promise(r => setTimeout(r, showTime));

        if (currentGame !== 'pm') return; // Safety exit

        this.state.pattern.forEach(idx => cells[idx].classList.remove('flash'));
        this.state.isShowingPattern = false;
        this.state.isInputPhase = true;
        this.ui.status.textContent = `Select ${this.state.pattern.length} cells`;
    },

    handleCellClick(index) {
        if (!this.state.isInputPhase || this.state.isShowingPattern) return;
        if (this.state.playerPattern.includes(index)) return; // Already selected

        const cells = this.ui.grid.querySelectorAll('.pm-cell');
        this.state.playerPattern.push(index);
        cells[index].classList.add('selected');
        playSound('beep');

        if (this.state.playerPattern.length === this.state.pattern.length) {
            this.state.isInputPhase = false;
            this.checkPattern();
        }
    },

    checkPattern() {
        const cells = this.ui.grid.querySelectorAll('.pm-cell');
        const sortedPlayer = [...this.state.playerPattern].sort((a, b) => a - b);
        const sortedPattern = [...this.state.pattern].sort((a, b) => a - b);

        const isCorrect = sortedPlayer.every((val, i) => val === sortedPattern[i]);

        if (isCorrect) {
            playSound('correct');
            this.state.streak++;
            this.state.score += (this.state.level * 15) + (this.state.streak * 5);
            
            // Track max pattern matrix level reached for Objectives
            const currentMaxPMLvl = parseInt(localStorage.getItem('cognixPMMaxLevel') || '0', 10);
            if (this.state.level > currentMaxPMLvl) {
                localStorage.setItem('cognixPMMaxLevel', this.state.level);
                updateDailyObjectives();
            }

            this.state.level++;
            this.updateUI();
            updateBackgroundEffects(this.state.streak);

            // Flash correct
            this.state.pattern.forEach(idx => cells[idx].classList.add('correct'));
            this.ui.status.textContent = '✓ Correct!';

            setTimeout(() => {
                if (currentGame !== 'pm') return;
                this.nextLevel();
            }, 1000);
        } else {
            playSound('wrong');
            // Show what was correct vs wrong
            this.state.playerPattern.forEach(idx => {
                if (!this.state.pattern.includes(idx)) {
                    cells[idx].classList.add('wrong');
                }
            });
            this.state.pattern.forEach(idx => cells[idx].classList.add('correct'));
            this.ui.status.textContent = '✗ Wrong pattern!';

            setTimeout(() => this.gameOver('Wrong Pattern!'), 1500);
        }
    },

    gameOver(reason) {
        this.ui.goMsg.textContent = reason;
        this.ui.fScore.textContent = this.state.score;
        this.ui.fLvl.textContent = this.state.level;

        this.ui.newHs.classList.add('hidden');
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('cognixPMHighScore', this.state.highScore);
            this.ui.newHs.classList.remove('hidden');
            const desktopPMHS = document.getElementById('desktop-pm-hs');
            if (desktopPMHS) desktopPMHS.textContent = this.state.highScore;
            updateCognitiveMetrics();
        }
        updateBackgroundEffects(0);
        switchScreen('pmGameOver');
        playSound('gameover');
    }
};

// ==========================================
// MATH BLITZ GAME
// ==========================================
const MathBlitz = {
    state: {
        score: 0, streak: 0, level: 0, difficulty: 'medium',
        highScore: parseInt(localStorage.getItem('cognixMBHighScore') || '0', 10),
        correctAnswer: 0, isPlaying: false
    },

    diffMap: {
        easy:   { maxNum: 12, ops: ['+', '-'], timeSec: 8 },
        medium: { maxNum: 25, ops: ['+', '-', '×'], timeSec: 6 },
        hard:   { maxNum: 50, ops: ['+', '-', '×'], timeSec: 4 }
    },

    timerInterval: null,
    totalTimeMs: 0,
    remainingTimeMs: 0,
    ui: {},

    init() {
        this.ui = {
            problem: document.getElementById('mb-problem'),
            answers: document.getElementById('mb-answers'),
            lvl: document.getElementById('mb-level'),
            score: document.getElementById('mb-score'),
            streak: document.getElementById('mb-streak'),
            timerBar: document.getElementById('mb-timer-bar'),
            hs: document.getElementById('mb-high-score'),
            startBtn: document.getElementById('mb-start-btn'),
            restartBtn: document.getElementById('mb-restart-btn'),
            diffBtns: document.querySelectorAll('#mb-difficulty .diff-btn'),
            goMsg: document.getElementById('mb-game-over-msg'),
            fScore: document.getElementById('mb-final-score'),
            fLvl: document.getElementById('mb-final-level'),
            newHs: document.getElementById('mb-new-high-score')
        };

        this.ui.hs.textContent = this.state.highScore;
        const desktopMBHS = document.getElementById('desktop-mb-hs');
        if (desktopMBHS) desktopMBHS.textContent = this.state.highScore;

        this.ui.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.difficulty = e.target.dataset.diff;
            });
        });

        this.ui.startBtn.addEventListener('click', () => this.startGame());
        this.ui.restartBtn.addEventListener('click', () => this.startGame());
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
        switchScreen('mbGame');
        playSound('start');
        this.nextProblem();
    },

    nextProblem() {
        this.state.level++;
        this.updateUI();

        const settings = this.diffMap[this.state.difficulty];
        const op = settings.ops[Math.floor(Math.random() * settings.ops.length)];
        let a, b, answer;

        if (op === '+') {
            a = Math.floor(Math.random() * settings.maxNum) + 1;
            b = Math.floor(Math.random() * settings.maxNum) + 1;
            answer = a + b;
        } else if (op === '-') {
            a = Math.floor(Math.random() * settings.maxNum) + 1;
            b = Math.floor(Math.random() * a) + 1; // Ensure non-negative result
            answer = a - b;
        } else {
            a = Math.floor(Math.random() * 12) + 1;
            b = Math.floor(Math.random() * 12) + 1;
            answer = a * b;
        }

        this.state.correctAnswer = answer;
        this.ui.problem.textContent = `${a} ${op} ${b} = ?`;

        // Generate 4 answer choices
        const answers = [answer];
        while (answers.length < 4) {
            const offset = Math.floor(Math.random() * 10) - 5;
            const distractor = answer + (offset === 0 ? 1 : offset);
            if (!answers.includes(distractor) && distractor >= 0) {
                answers.push(distractor);
            }
        }

        // Shuffle
        for (let i = answers.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [answers[i], answers[j]] = [answers[j], answers[i]];
        }

        // Render buttons
        this.ui.answers.innerHTML = '';
        answers.forEach(ans => {
            const btn = document.createElement('button');
            btn.className = 'mb-answer-btn';
            btn.textContent = ans;
            btn.addEventListener('click', () => this.handleAnswer(ans, btn));
            this.ui.answers.appendChild(btn);
        });

        this.startTimer();
    },

    startTimer() {
        this.state.isPlaying = true;
        const settings = this.diffMap[this.state.difficulty];
        const speedMultiplier = Math.max(0.6, 1 - (this.state.streak * 0.02));
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

    handleAnswer(answer, btn) {
        if (!this.state.isPlaying || isPaused) return;
        this.state.isPlaying = false;
        clearInterval(this.timerInterval);

        if (answer === this.state.correctAnswer) {
            playSound('beep');
            btn.classList.add('correct-flash');
            this.state.streak++;
            
            // Track max solved questions for Objectives
            const currentMaxMBLvl = parseInt(localStorage.getItem('cognixMBMaxLevel') || '0', 10);
            if (this.state.level > currentMaxMBLvl) {
                localStorage.setItem('cognixMBMaxLevel', this.state.level);
                updateDailyObjectives();
            }

            // Speed bonus: faster answers get more points
            const timeBonus = Math.floor((this.remainingTimeMs / this.totalTimeMs) * 15);
            this.state.score += 10 + (this.state.streak * 2) + timeBonus;
            this.updateUI();
            updateBackgroundEffects(this.state.streak);

            setTimeout(() => this.nextProblem(), 400);
        } else {
            playSound('wrong');
            btn.classList.add('wrong-flash');
            // Highlight correct answer
            const allBtns = this.ui.answers.querySelectorAll('.mb-answer-btn');
            allBtns.forEach(b => {
                if (parseInt(b.textContent) === this.state.correctAnswer) {
                    b.classList.add('correct-flash');
                }
            });

            setTimeout(() => this.gameOver('Wrong Answer!'), 1000);
        }
    },

    gameOver(reason) {
        this.ui.goMsg.textContent = reason;
        this.ui.fScore.textContent = this.state.score;
        this.ui.fLvl.textContent = this.state.level;

        this.ui.newHs.classList.add('hidden');
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('cognixMBHighScore', this.state.highScore);
            this.ui.newHs.classList.remove('hidden');
            const desktopMBHS = document.getElementById('desktop-mb-hs');
            if (desktopMBHS) desktopMBHS.textContent = this.state.highScore;
            updateCognitiveMetrics();
        }
        updateBackgroundEffects(0);
        setTimeout(() => {
            switchScreen('mbGameOver');
            playSound('gameover');
        }, 500);
    }
};

// ==========================================
// TYPE RUSH GAME
// ==========================================
const TypeRush = {
    state: {
        score: 0, streak: 0, wordsCompleted: 0, difficulty: 'medium',
        highScore: parseInt(localStorage.getItem('cognixTRHighScore') || '0', 10),
        currentWord: '', correctChars: 0, totalChars: 0,
        startTime: 0, isPlaying: false
    },

    wordBank: {
        easy: [
            'focus', 'brain', 'think', 'learn', 'speed', 'smart', 'logic',
            'nerve', 'mind', 'idea', 'plan', 'goal', 'code', 'type', 'fast',
            'skill', 'sharp', 'calm', 'react', 'pulse', 'boost', 'flow',
            'spark', 'power', 'train', 'score', 'level', 'mode', 'test'
        ],
        medium: [
            'memory span', 'brain power', 'quick react', 'deep focus',
            'nerve signal', 'think fast', 'sharp mind', 'code logic',
            'boost speed', 'calm focus', 'train hard', 'stay sharp',
            'high score', 'next level', 'mind boost', 'fast type',
            'key stroke', 'word count', 'rapid fire', 'full speed'
        ],
        hard: [
            'cognitive flexibility improves daily',
            'neuroplasticity shapes the brain',
            'working memory holds key data',
            'executive function guides choices',
            'attention filtering blocks noise',
            'dopamine drives reinforcement',
            'spatial memory maps locations',
            'processing speed measures reaction',
            'mental agility requires practice',
            'brain training builds new pathways'
        ]
    },

    diffMap: {
        easy:   { timeSec: 30 },
        medium: { timeSec: 45 },
        hard:   { timeSec: 60 }
    },

    timerInterval: null,
    totalTimeMs: 0,
    remainingTimeMs: 0,
    ui: {},

    init() {
        this.ui = {
            prompt: document.getElementById('tr-prompt'),
            input: document.getElementById('tr-input'),
            lvl: document.getElementById('tr-level'),
            score: document.getElementById('tr-score'),
            wpm: document.getElementById('tr-wpm'),
            streak: document.getElementById('tr-streak'),
            accuracy: document.getElementById('tr-accuracy'),
            timerBar: document.getElementById('tr-timer-bar'),
            hs: document.getElementById('tr-high-score'),
            startBtn: document.getElementById('tr-start-btn'),
            restartBtn: document.getElementById('tr-restart-btn'),
            diffBtns: document.querySelectorAll('#tr-difficulty .diff-btn'),
            goMsg: document.getElementById('tr-game-over-msg'),
            fScore: document.getElementById('tr-final-score'),
            fWpm: document.getElementById('tr-final-wpm'),
            fAccuracy: document.getElementById('tr-final-accuracy'),
            fLvl: document.getElementById('tr-final-level'),
            newHs: document.getElementById('tr-new-high-score')
        };

        this.ui.hs.textContent = this.state.highScore;
        const desktopTRHS = document.getElementById('desktop-tr-hs');
        if (desktopTRHS) desktopTRHS.textContent = this.state.highScore;

        this.ui.diffBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.ui.diffBtns.forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.state.difficulty = e.target.dataset.diff;
            });
        });

        this.ui.startBtn.addEventListener('click', () => this.startGame());
        this.ui.restartBtn.addEventListener('click', () => this.startGame());

        // Input handler
        this.ui.input.addEventListener('keydown', (e) => {
            if (!this.state.isPlaying) return;
            if (e.key === 'Enter' || (e.key === ' ' && this.state.difficulty === 'easy')) {
                e.preventDefault();
                this.submitWord();
            }
        });
    },

    cleanup() {
        clearInterval(this.timerInterval);
        this.state.isPlaying = false;
        this.ui.hs.textContent = this.state.highScore;
    },

    updateUI() {
        this.ui.lvl.textContent = this.state.wordsCompleted;
        this.ui.score.textContent = this.state.score;
        this.ui.streak.textContent = this.state.streak;

        // Calculate WPM
        const elapsed = (Date.now() - this.state.startTime) / 1000 / 60; // minutes
        const wpm = elapsed > 0 ? Math.round(this.state.wordsCompleted / elapsed) : 0;
        this.ui.wpm.textContent = wpm;

        // Calculate accuracy
        const accuracy = this.state.totalChars > 0
            ? Math.round((this.state.correctChars / this.state.totalChars) * 100)
            : 100;
        this.ui.accuracy.textContent = accuracy;
    },

    startGame() {
        this.cleanup();
        this.state.score = 0;
        this.state.streak = 0;
        this.state.wordsCompleted = 0;
        this.state.correctChars = 0;
        this.state.totalChars = 0;
        this.state.startTime = Date.now();
        this.updateUI();
        updateBackgroundEffects(0);
        switchScreen('trGame');
        playSound('start');
        this.nextWord();
        this.startTimer();

        // Focus the input
        setTimeout(() => this.ui.input.focus(), 300);
    },

    nextWord() {
        const words = this.wordBank[this.state.difficulty];
        this.state.currentWord = words[Math.floor(Math.random() * words.length)];
        this.ui.prompt.textContent = this.state.currentWord;
        this.ui.input.value = '';
        this.ui.input.focus();
    },

    submitWord() {
        const typed = this.ui.input.value.trim().toLowerCase();
        const target = this.state.currentWord.toLowerCase();

        if (typed.length === 0) return;

        this.state.totalChars += target.length;

        // Count correct characters
        let correct = 0;
        for (let i = 0; i < target.length; i++) {
            if (typed[i] === target[i]) correct++;
        }
        this.state.correctChars += correct;

        const isExactMatch = typed === target;

        if (isExactMatch) {
            playSound('beep');
            this.state.streak++;
            this.state.wordsCompleted++;
            this.state.score += 10 + (this.state.streak * 3);
            updateBackgroundEffects(this.state.streak);

            this.ui.input.classList.add('correct-flash');
            setTimeout(() => this.ui.input.classList.remove('correct-flash'), 200);
        } else {
            playSound('wrong');
            this.state.streak = 0;
            this.state.wordsCompleted++;
            // Partial credit based on character accuracy
            const charAccuracy = correct / target.length;
            this.state.score += Math.floor(charAccuracy * 5);
            updateBackgroundEffects(0);

            this.ui.input.classList.add('wrong-flash');
            setTimeout(() => this.ui.input.classList.remove('wrong-flash'), 300);
        }

        this.updateUI();
        this.nextWord();
    },

    startTimer() {
        this.state.isPlaying = true;
        const settings = this.diffMap[this.state.difficulty];
        this.totalTimeMs = settings.timeSec * 1000;
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
                this.gameOver();
            }
        }, 50);
    },

    gameOver() {
        const elapsed = (Date.now() - this.state.startTime) / 1000 / 60;
        const finalWPM = elapsed > 0 ? Math.round(this.state.wordsCompleted / elapsed) : 0;
        const finalAccuracy = this.state.totalChars > 0
            ? Math.round((this.state.correctChars / this.state.totalChars) * 100)
            : 100;

        // Save max WPM reached for Objectives
        const currentMaxWPM = parseInt(localStorage.getItem('cognixTRMaxWPM') || '0', 10);
        if (finalWPM > currentMaxWPM) {
            localStorage.setItem('cognixTRMaxWPM', finalWPM);
            updateDailyObjectives();
        }

        let message = 'Keep practicing!';
        if (finalWPM >= 50) message = 'Incredible speed! 🔥';
        else if (finalWPM >= 30) message = 'Great typing! ⚡';
        else if (finalWPM >= 15) message = 'Good effort! 💪';

        this.ui.goMsg.textContent = message;
        this.ui.fScore.textContent = this.state.score;
        this.ui.fWpm.textContent = finalWPM;
        this.ui.fAccuracy.textContent = finalAccuracy;
        this.ui.fLvl.textContent = this.state.wordsCompleted;

        this.ui.newHs.classList.add('hidden');
        if (this.state.score > this.state.highScore) {
            this.state.highScore = this.state.score;
            localStorage.setItem('cognixTRHighScore', this.state.highScore);
            this.ui.newHs.classList.remove('hidden');
            const desktopTRHS = document.getElementById('desktop-tr-hs');
            if (desktopTRHS) desktopTRHS.textContent = this.state.highScore;
            updateCognitiveMetrics();
        }
        updateBackgroundEffects(0);
        switchScreen('trGameOver');
        playSound('gameover');
    }
};
