'use strict';
const STRINGS = {
    'zh-CN': [
        '从 Ovi 获取更多游戏', 
        'Delete previous game?', 
        '新游戏', 
        '操作说明', 
        '操作说明', 
        '最高分', 
        '最高分', 
        '游戏结束', 
        '退出', 
        'YYYY.MM.DD', 
        '继续', 
        '返回', 
        '智力方块', 
        '按数字键%0U和%1U可以旋转障碍块。\n按数字键%2U和%3U可以上下移动障碍块。\n按数字键%4U可以发射障碍块。\n需要构建矩形区域，并向从右侧靠近的形状发射障碍块。当前的障碍块显示在左栏中。底栏中显示后面可使用的障碍块和分数。当右侧的一块区域与屏幕左侧连成一片时，游戏便结束。消除的地方越大，得分就越高。' 
    ],
    'en-US': [
        'Get more games', 
        'Delete previous game?', 
        'New game', 
        'Instructions', 
        'Instructions', 
        'High scores', 
        'High scores', 
        'Game over', 
        'Exit', 
        'MM/DD/YYYY', 
        'Continue', 
        'Back', 
        'Puzzle', 
        'Keys %0U and %1U rotate the block.\nKeys %2U and %3U move the block up and down.\nKey %4U launches the block.\nForm rectangular areas and launch blocks at the shapes approaching you from the right. The current block is shown in the left side bar. The bottom bar displays the following blocks and the score. The game is over when one of the areas on the right reaches the left side of the display. The bigger the areas you remove, the better your score.' 
    ]
};
let currentLang = 'zh-CN';
function getString(idx, params) {
    const list = STRINGS[currentLang] || STRINGS['zh-CN'];
    let str = list[idx] || '';
    if (params && params.length > 0) {
        if (params.length === 1) {
            str = str.replace(/%U/g, params[0]);
        } else {
            for (let i = 0; i < params.length; i++) {
                str = str.replace(new RegExp('%' + i + 'U', 'g'), params[i]);
            }
        }
    }
    return str;
}
class HallOfFame {
    constructor() {
        this.records = [];
        this.load();
    }
    load() {
        try {
            const data = localStorage.getItem('Staq_HallOfFame');
            if (data) {
                this.records = JSON.parse(data);
                if (Array.isArray(this.records) && this.records.length === 6) {
                    return;
                }
            }
        } catch (e) {}
        this.records = [];
        const today = this.formatDate(new Date());
        for (let i = 0; i < 6; i++) {
            this.records.push({ score: 0, date: today });
        }
    }
    save() {
        try {
            localStorage.setItem('Staq_HallOfFame', JSON.stringify(this.records));
        } catch (e) {}
    }
    formatDate(d) {
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const pattern = getString(9);
        return pattern.replace('YYYY', yyyy).replace('MM', mm).replace('DD', dd);
    }
    getHighest() {
        return this.records[0] ? this.records[0].score : 0;
    }
    getLowest() {
        return this.records[5] ? this.records[5].score : 0;
    }
    addScore(score) {
        if (score <= this.getLowest()) return -1;
        const entry = { score: score, date: this.formatDate(new Date()) };
        let insertIdx = -1;
        for (let i = 0; i < 6; i++) {
            if (score > this.records[i].score) {
                insertIdx = i;
                break;
            }
        }
        if (insertIdx !== -1) {
            this.records.splice(insertIdx, 0, entry);
            this.records.pop();
            this.save();
        }
        return insertIdx;
    }
}
class AudioManager {
    constructor() {
        this.muted = false;
        this.audioCtx = null;
        this.bgmAudio = new Audio('audio/bgm.wav');
        this.bgmAudio.loop = true;
        this.sounds = {
            end: new Audio('audio/end1.wav'),
            fx1: new Audio('audio/fx1.wav'),
            fx2: new Audio('audio/fx2.wav'),
            fx3: new Audio('audio/fx3.wav'),
            fx4: new Audio('audio/fx4.wav')
        };
        this.unlocked = false;
    }
    initContext() {
        if (!this.audioCtx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.audioCtx = new AudioContext();
            }
        }
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }
        this.unlocked = true;
    }
    playBGM() {
        if (this.muted) return;
        this.bgmAudio.currentTime = 0;
        this.bgmAudio.play().catch(() => {});
    }
    stopBGM() {
        this.bgmAudio.pause();
        this.bgmAudio.currentTime = 0;
    }
    playEnd() {
        if (this.muted) return;
        this.stopBGM();
        this.sounds.end.currentTime = 0;
        this.sounds.end.play().catch(() => {});
    }
    playRandomFX() {
        if (this.muted) return;
        const idx = Math.floor(Math.random() * 4) + 1;
        const snd = this.sounds['fx' + idx];
        if (snd) {
            snd.currentTime = 0;
            snd.play().catch(() => {});
        }
    }
    toggleMute() {
        this.muted = !this.muted;
        if (this.muted) {
            this.bgmAudio.pause();
        }
        return this.muted;
    }
}
const SCREEN = {
    TITLE: 0,
    MENU: 1,
    PLAYING: 2,
    INSTRUCTIONS: 3,
    HIGH_SCORES: 4,
    CONFIRM_NEW: 5
};
class StaqGame {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.canvas.width = 240;
        this.canvas.height = 320;
        this.bgCanvas = document.createElement('canvas');
        this.bgCanvas.width = 240;
        this.bgCanvas.height = 320;
        this.bgCtx = this.bgCanvas.getContext('2d');
        this.audio = new AudioManager();
        this.hallOfFame = new HallOfFame();
        this.images = {};
        this.shotsFrames = []; 
        this.digits = []; 
        this.currentScreen = SCREEN.TITLE;
        this.titleTimer = 0;
        this.menuSelection = 0;
        this.menuItems = [];
        this.lastNewScoreIndex = -1;
        this.kCols = 20; 
        this.gridCols = 17; 
        this.gridRows = 18;
        this.board = new Uint8Array(this.gridCols * this.gridRows); 
        this.queue = new Uint8Array(5); 
        this.currentQueueIdx = 0; 
        this.shooterY = 8; 
        this.shooterRot = 0; 
        this.projectiles = [
            { x: 10000, y: 0, type: 0, rot: 0 },
            { x: 10000, y: 0, type: 0, rot: 0 }
        ]; 
        this.scrollOffset = 0; 
        this.scrollTimer = 0; 
        this.scrollThreshold = 5000; 
        this.clearedRectsCount = 0; 
        this.flashingActive = false; 
        this.flashingTimer = 0; 
        this.flashingFlashTimer = 0; 
        this.flashingFrame = 0; 
        this.score = 0; 
        this.scorePopupActive = false; 
        this.scorePopupValue = 0; 
        this.scorePopupTimer = 0; 
        this.scorePopupX = 0; 
        this.scorePopupY = 0; 
        this.penaltyPopupActive = false; 
        this.penaltyPopupValue = 0; 
        this.penaltyPopupY = 0; 
        this.gameOverTextActive = false; 
        this.gameOverTextTimer = 0; 
        this.gameOverAnimActive = false; 
        this.gameOverAnimTimer = 0; 
        this.gameOverTier = 0; 
        this.gameOverFrame = 1; 
        this.gameOverFrameTimer = 0; 
        this.gameInProgress = false; 
        this.lastShotMoveTime = -1;
        this.scratch16 = new Uint8Array(16);
        this.pendingAction = -1; 
        this.lastFrameTime = performance.now();
        this.touchStartX = 0;
        this.touchStartY = 0;
        this.touchDragged = false;
        this.loaded = false;
        this.loadAssets();
    }
    loadAssets() {
        const imageNames = [
            'gamebg', 'grid', 'tiles', 'shots', 'title', 'icon', 'rsk',
            'cry1', 'cry2', 'thumbup1', 'thumbup2', 'jump1', 'jump2',
            'travolta1', 'travolta2',
            '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'
        ];
        let loadedCount = 0;
        const total = imageNames.length;
        imageNames.forEach(name => {
            const img = new Image();
            img.src = `assets/${name}.png`;
            img.onload = () => {
                this.images[name] = img;
                loadedCount++;
                if (loadedCount === total) {
                    this.onAssetsLoaded();
                }
            };
            img.onerror = () => {
                console.warn(`Could not load assets/${name}.png`);
                loadedCount++;
                if (loadedCount === total) {
                    this.onAssetsLoaded();
                }
            };
        });
    }
    onAssetsLoaded() {
        if (this.images.gamebg) {
            this.bgCtx.drawImage(this.images.gamebg, 0, 0, 240, 320);
        }
        if (this.images.grid) {
            this.bgCtx.drawImage(this.images.grid, 0, 0, 240, 320);
        }
        if (this.images.shots) {
            for (let i = 0; i < 4; i++) {
                const c = document.createElement('canvas');
                c.width = 13;
                c.height = 19;
                const ctx = c.getContext('2d');
                ctx.drawImage(this.images.shots, i * 13, 0, 13, 19, 0, 0, 13, 19);
                this.shotsFrames.push(c);
            }
        }
        for (let i = 0; i <= 9; i++) {
            this.digits.push(this.images[String(i)]);
        }
        this.loaded = true;
        this.initGameSession();
        requestAnimationFrame(this.mainLoop.bind(this));
    }
    initGameSession() {
        this.currentScreen = SCREEN.TITLE;
        this.titleTimer = 0;
        this.gameInProgress = false;
    }
    startNewGame() {
        this.gameInProgress = true;
        this.score = 0;
        this.clearedRectsCount = 0;
        this.flashingActive = false;
        this.flashingTimer = 0;
        this.flashingFrame = 0;
        this.scorePopupActive = false;
        this.penaltyPopupActive = false;
        this.gameOverTextActive = false;
        this.gameOverTextTimer = 0;
        this.gameOverAnimActive = false;
        this.gameOverAnimTimer = 0;
        this.shooterY = 8;
        this.shooterRot = 0;
        this.currentQueueIdx = 0;
        this.scrollOffset = 0;
        this.scrollThreshold = 5000;
        this.scrollTimer = this.scrollThreshold - 1000; 
        this.lastShotMoveTime = -1;
        this.projectiles[0].x = 10000;
        this.projectiles[1].x = 10000;
        for (let i = 0; i < 5; i++) {
            this.queue[i] = Math.floor(Math.random() * 4);
        }
        this.board.fill(0);
        this.currentScreen = SCREEN.PLAYING;
        this.audio.playBGM();
    }
    generateObstacle() {
        const kCols = this.kCols; 
        const gridW = this.gridCols; 
        const width = Math.floor(Math.random() * 3) + 2; 
        const height = (Math.floor(Math.random() * 5) === 0) ? 2 : (Math.floor(Math.random() * 2) + 3); 
        this.scratch16.fill(0);
        this.scratch16[3] = 2;
        this.scratch16[7] = 2;
        let var6 = 0;
        let var7 = 0;
        let var8 = false;
        switch (height) {
            case 2: {
                const var4 = Math.floor(Math.random() * 2);
                for (let var5 = 2; var5 >= 4 - width; --var5) {
                    this.scratch16[(var4 << 2) + var5] = 2;
                }
                break;
            }
            case 3: {
                this.scratch16[11] = 2;
                let var4 = Math.floor(Math.random() * width) + 1;
                if (var4 === 1) {
                    var6 = 1;
                } else {
                    if (var4 === width) var7 = 1;
                    for (let var5 = 2; var5 >= 4 - var4; --var5) {
                        this.scratch16[var5] = 2;
                    }
                }
                if (var6 !== 0) {
                    var4 = Math.floor(Math.random() * width) + 1;
                    if (var4 === width) {
                        var7 = 1;
                        var8 = true;
                    }
                    for (let var5 = 2; var5 >= 4 - var4; --var5) {
                        this.scratch16[var5 + 4] = 2;
                    }
                } else if (var7 !== 0) {
                    var4 = Math.floor(Math.random() * (width - 1)) + 1;
                    if (var4 !== 1) {
                        for (let var5 = 2; var5 >= 4 - var4; --var5) {
                            this.scratch16[var5 + 4] = 2;
                        }
                    } else {
                        var6 = 1;
                    }
                } else {
                    if (Math.floor(Math.random() * 2) === 0) {
                        var7 = 1;
                        var8 = true;
                        for (let var5 = 2; var5 >= 4 - width; --var5) {
                            this.scratch16[var5 + 4] = 2;
                        }
                    } else {
                        var6 = 1;
                    }
                }
                if (var7 === 0) {
                    for (let var5 = 2; var5 >= 4 - width; --var5) {
                        this.scratch16[var5 + 8] = 2;
                    }
                } else {
                    if (var6 !== 0) {
                        var4 = var8 ? (Math.floor(Math.random() * (width - 1)) + 1) : (Math.floor(Math.random() * width) + 1);
                        for (let var5 = 2; var5 >= 4 - var4; --var5) {
                            this.scratch16[var5 + 8] = 2;
                        }
                    }
                }
                break;
            }
            case 4: {
                this.scratch16[11] = 2;
                this.scratch16[15] = 2;
                let var4 = Math.floor(Math.random() * width) + 1;
                if (var4 === 1) {
                    var6 = 1;
                } else {
                    if (var4 === width) var7 = 1;
                    for (let var5 = 2; var5 >= 4 - var4; --var5) {
                        this.scratch16[var5] = 2;
                    }
                }
                if (var7 !== 0) {
                    var4 = Math.floor(Math.random() * (width - 1)) + 1;
                } else {
                    var4 = Math.floor(Math.random() * width) + 1;
                    if (var4 === width) {
                        var7 = 1;
                        var8 = true;
                    }
                }
                if (var4 === 1) {
                    var6 = 1;
                } else {
                    for (let var5 = 2; var5 >= 4 - var4; --var5) {
                        this.scratch16[var5 + 4] = 2;
                    }
                }
                if (var6 !== 0 || var7 !== 0) {
                    if (var8) {
                        var4 = Math.floor(Math.random() * (width - 1)) + 1;
                    } else {
                        var4 = Math.floor(Math.random() * width) + 1;
                        if (var4 === width) {
                            var7 = 1;
                            var8 = true;
                        }
                    }
                    if (var4 !== 1) {
                        for (let var5 = 2; var5 >= 4 - var4; --var5) {
                            this.scratch16[var5 + 8] = 2;
                        }
                    } else {
                        var6 = 1;
                    }
                } else {
                    if (Math.floor(Math.random() * 2) === 0) {
                        var7 = 1;
                        var8 = true;
                        for (let var5 = 2; var5 >= 4 - width; --var5) {
                            this.scratch16[var5 + 8] = 2;
                        }
                    } else {
                        var6 = 1;
                    }
                }
                if (var7 === 0) {
                    for (let var5 = 2; var5 >= 4 - width; --var5) {
                        this.scratch16[var5 + 12] = 2;
                    }
                } else {
                    if (var6 !== 0) {
                        var4 = var8 ? (Math.floor(Math.random() * (width - 1)) + 1) : (Math.floor(Math.random() * width) + 1);
                        for (let var5 = 2; var5 >= 4 - var4; --var5) {
                            this.scratch16[var5 + 12] = 2;
                        }
                    }
                }
                break;
            }
        }
        for (let attempt = 0; attempt < 10; attempt++) {
            const startRow = Math.floor(Math.random() * (18 - (height - 1)));
            let canPlace = true;
            block20: for (let r = 0; r < height; r++) {
                for (let c = 0; c < 4; c++) {
                    const colIdx = (this.scrollOffset + (gridW - 4 - 1 + c)) % gridW;
                    const curRow = startRow + r;
                    if (this.scratch16[(r << 2) + c] === 2) {
                        const cellEmpty = (this.board[curRow * gridW + colIdx] === 0);
                        const aboveEmpty = (curRow <= 0 || this.board[(curRow - 1) * gridW + colIdx] === 0);
                        const belowEmpty = (curRow >= 17 || this.board[(curRow + 1) * gridW + colIdx] === 0);
                        if (!cellEmpty || !aboveEmpty || !belowEmpty) {
                            canPlace = false;
                            break block20;
                        }
                    }
                }
            }
            if (canPlace) {
                let firstMatchCol = -1;
                block22: for (let r = 0; r < height; r++) {
                    let found = 0;
                    for (let c = gridW - 2; c >= 0; c--) {
                        const colIdx = (this.scrollOffset + c) % gridW;
                        if (this.board[(startRow + r) * gridW + colIdx] === 2) {
                            found = 1;
                            if (r === 0) {
                                firstMatchCol = c;
                                break;
                            }
                            if (firstMatchCol === c) break;
                            canPlace = false;
                            break block22;
                        }
                    }
                    if (firstMatchCol < 0 || found !== 0) continue;
                    canPlace = false;
                    break;
                }
                if (canPlace && firstMatchCol < 0) {
                    if (startRow > 0) {
                        for (let c = gridW - 2; c >= 0; c--) {
                            const colIdx = (this.scrollOffset + c) % gridW;
                            if (this.board[(startRow - 1) * gridW + colIdx] === 2) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    if (canPlace && startRow + height - 1 < 17) {
                        for (let c = gridW - 2; c >= 0; c--) {
                            const colIdx = (this.scrollOffset + c) % gridW;
                            if (this.board[(startRow + height) * gridW + colIdx] === 2) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                }
                if (canPlace && height === 2 && firstMatchCol >= 0) {
                    if (startRow > 0) {
                        for (let c = gridW - 2; c >= 0; c--) {
                            const colIdx = (this.scrollOffset + c) % gridW;
                            if (this.board[(startRow - 1) * gridW + colIdx] === 2 && c !== firstMatchCol) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                    if (canPlace && startRow + height - 1 < 17) {
                        for (let c = gridW - 2; c >= 0; c--) {
                            const colIdx = (this.scrollOffset + c) % gridW;
                            if (this.board[(startRow + height) * gridW + colIdx] === 2 && c !== firstMatchCol) {
                                canPlace = false;
                                break;
                            }
                        }
                    }
                }
            }
            if (canPlace) {
                for (let s = 0; s < 2; s++) {
                    const p = this.projectiles[s];
                    const minX = (kCols - width) * 12;
                    const minY = startRow * 12;
                    const maxY = (startRow + height) * 12;
                    if (p.x < 240 && p.x >= minX - 24 && p.y >= minY - 24 && p.y <= maxY) {
                        canPlace = false;
                        break;
                    }
                }
            }
            if (canPlace) {
                for (let r = 0; r < height; r++) {
                    for (let c = 0; c < 4; c++) {
                        if (this.scratch16[(r << 2) + c] === 2) {
                            const colIdx = (this.scrollOffset + (gridW - 4 + c)) % gridW;
                            this.board[(startRow + r) * gridW + colIdx] = 2;
                        }
                    }
                }
                return;
            }
        }
    }
    fireShot() {
        const gridW = this.gridCols;
        const headCol = this.scrollOffset;
        const nextCol = (headCol + 1) % gridW;
        const curShape = this.queue[this.currentQueueIdx];
        const rot = this.shooterRot;
        const row = this.shooterY;
        let clear = true;
        if ((curShape !== 1 || rot !== 3) && this.board[row * gridW + headCol] !== 0) {
            clear = false;
        }
        if (clear && curShape !== 3 && (curShape !== 2 || (rot !== 0 && rot !== 2)) && (curShape !== 1 || rot !== 0) && this.board[row * gridW + nextCol] !== 0) {
            clear = false;
        }
        if (clear && curShape !== 3 && (curShape !== 2 || (rot !== 1 && rot !== 3)) && (curShape !== 1 || rot !== 2) && this.board[(row + 1) * gridW + headCol] !== 0) {
            clear = false;
        }
        if (clear && curShape !== 3 && curShape !== 2 && (curShape !== 1 || rot !== 1) && this.board[(row + 1) * gridW + nextCol] !== 0) {
            clear = false;
        }
        let overrideRotMode = 0;
        if (!clear && curShape === 1) {
            if (rot === 2 && this.board[row * gridW + headCol] === 0 && this.board[row * gridW + nextCol] === 0 && this.board[(row + 1) * gridW + headCol] === 0) {
                clear = true;
                overrideRotMode = 1;
            } else if (rot === 3 && this.board[row * gridW + headCol] === 0 && this.board[(row + 1) * gridW + headCol] === 0 && this.board[(row + 1) * gridW + nextCol] === 0) {
                clear = true;
                overrideRotMode = 2;
            }
        }
        if (!clear) return;
        let slot = null;
        if (this.projectiles[0].x >= 240 && this.projectiles[1].x > 72) {
            slot = this.projectiles[0];
        } else if (this.projectiles[1].x >= 240 && this.projectiles[0].x > 72) {
            slot = this.projectiles[1];
        }
        if (!slot) return;
        slot.x = 36;
        slot.y = row * 12;
        slot.type = curShape;
        if (overrideRotMode === 0) {
            slot.rot = rot;
        } else if (overrideRotMode === 1) {
            slot.rot = 1;
        } else if (overrideRotMode === 2) {
            slot.rot = 0;
        }
        this.queue[this.currentQueueIdx] = Math.floor(Math.random() * 4);
        this.currentQueueIdx = (this.currentQueueIdx + 1) % 5;
        this.shooterRot = 0;
        const nextShape = this.queue[this.currentQueueIdx];
        if (this.shooterY === 17 && (nextShape === 0 || nextShape === 1 || nextShape === 2)) {
            this.shooterY = 16;
        }
    }
    checkProjectileCollision(p) {
        const kCols = this.kCols; 
        const gridW = this.gridCols; 
        const shape = p.type;
        const rot = p.rot;
        let colTop = Math.floor((p.x + 12 - 1) / 12) + 1;
        const rowTop = Math.floor(p.y / 12);
        let widthTop = 2;
        if (shape === 3 || (shape === 2 && (rot === 0 || rot === 2)) || (shape === 1 && rot === 0)) {
            colTop--;
            widthTop = 1;
        }
        let isScoreEligible = true;
        let collideTop = false;
        if (colTop < kCols) {
            let bufferCol = (this.scrollOffset + colTop - 3) % gridW;
            if (this.board[rowTop * gridW + bufferCol] === 2) {
                collideTop = true;
                if (colTop > widthTop + 2) {
                    if (widthTop === 1) {
                        bufferCol = (bufferCol === 0 ? gridW - 1 : bufferCol - 1);
                    } else {
                        bufferCol = (bufferCol === 1 ? gridW - 1 : (bufferCol === 0 ? gridW - 2 : bufferCol - 2));
                    }
                    if (shape !== 1 || rot !== 3) {
                        this.board[rowTop * gridW + bufferCol] = 2;
                    }
                    bufferCol = (bufferCol + 1) % gridW;
                    if (widthTop === 2) {
                        this.board[rowTop * gridW + bufferCol] = 2;
                    }
                }
            } else if (this.board[rowTop * gridW + bufferCol] === 4) {
                collideTop = true;
                isScoreEligible = false;
            }
        }
        let colBot = Math.floor((p.x + 12 - 1) / 12) + 1;
        const rowBot = rowTop + 1;
        let widthBot = 2;
        let collideBot = false;
        if (shape !== 3 && (shape !== 2 || (rot !== 1 && rot !== 3))) {
            if ((shape === 2 && (rot === 0 || rot === 2)) || (shape === 1 && rot === 1)) {
                colBot--;
                widthBot = 1;
            }
            if (colBot < kCols) {
                let bufferCol = (this.scrollOffset + colBot - 3) % gridW;
                if (this.board[rowBot * gridW + bufferCol] === 2) {
                    collideBot = true;
                    if (colBot > widthBot + 2) {
                        if (widthBot === 1) {
                            bufferCol = (bufferCol === 0 ? gridW - 1 : bufferCol - 1);
                        } else {
                            bufferCol = (bufferCol === 1 ? gridW - 1 : (bufferCol === 0 ? gridW - 2 : bufferCol - 2));
                        }
                        if (shape !== 1 || rot !== 2) {
                            this.board[rowBot * gridW + bufferCol] = 2;
                        }
                        bufferCol = (bufferCol + 1) % gridW;
                        if (widthBot === 2) {
                            this.board[rowBot * gridW + bufferCol] = 2;
                        }
                    }
                } else if (this.board[rowBot * gridW + bufferCol] === 4) {
                    collideBot = true;
                    isScoreEligible = false;
                }
            }
        }
        if (collideTop && collideBot) {
            if (isScoreEligible) {
                this.checkRectangleFormation(colTop - widthTop, rowTop);
            }
            p.x = 240;
            return true;
        }
        if (collideTop) {
            if (isScoreEligible) {
                if (shape === 1 && rot === 3) {
                    this.checkRectangleFormation(colTop - widthTop + 1, rowTop);
                } else {
                    this.checkRectangleFormation(colTop - widthTop, rowTop);
                }
            }
            if (shape === 3 || (shape === 2 && (rot === 1 || rot === 3))) {
                p.x = 240;
                return true;
            }
            if (shape === 2 || (shape === 1 && rot === 1)) {
                p.type = 3;
                p.y += 12;
            } else if (shape === 1 && rot === 2) {
                p.type = 3;
                p.x += 12;
                p.y += 12;
            } else {
                p.type = 2;
                p.rot = 1;
                p.y += 12;
            }
        }
        if (collideBot) {
            if (isScoreEligible) {
                if (shape === 1 && rot === 2) {
                    this.checkRectangleFormation(colBot - widthBot + 1, rowBot);
                } else {
                    this.checkRectangleFormation(colBot - widthBot, rowBot);
                }
            }
            if ((shape === 2 && (rot === 0 || rot === 2)) || (shape === 1 && rot === 0)) {
                p.type = 3;
            } else if (shape === 1 && rot === 3) {
                p.type = 3;
                p.x += 12;
            } else {
                p.type = 2;
                p.rot = 1;
            }
        }
        return false;
    }
    checkRectangleFormation(colCoord, rowCoord) {
        const gridW = this.gridCols; 
        let n4 = colCoord;
        let n5 = (this.scrollOffset + colCoord - 3) % gridW;
        let n6 = rowCoord;
        let n7 = (n5 === 0 ? gridW - 1 : n5 - 1);
        let n8 = 1;
        while (n6 !== 0) {
            if (this.board[(n6 - 1) * gridW + n5] !== 2) break;
            n6--; 
            if (n5 === this.scrollOffset) continue;
            if (this.board[n6 * gridW + n7] !== 2) continue;
            n8 = 0;
            break;
        }
        if (n8 === 0) return;
        const topRow = n6;
        n7 = (this.scrollOffset === 0 ? gridW - 1 : this.scrollOffset - 1);
        while (true) {
            const nextCol = (n5 + 1) % gridW;
            if (n5 === n7) break;
            if (this.board[n6 * gridW + nextCol] !== 2) break;
            n5 = nextCol;
            n4++;
            if (n6 === 0) continue;
            if (this.board[(n6 - 1) * gridW + n5] !== 2) continue;
            n8 = 0;
            break;
        }
        if (n8 === 0) return;
        n7 = (this.scrollOffset === 0 ? gridW - 1 : this.scrollOffset - 1);
        while (n6 !== 17) {
            if (this.board[(n6 + 1) * gridW + n5] !== 2) break;
            n6++; 
            const nextCol = (n5 + 1) % gridW;
            if (n5 === n7) continue;
            if (this.board[n6 * gridW + nextCol] !== 2) continue;
            n8 = 0;
            break;
        }
        if (n8 === 0) return;
        const bottomRow = n6;
        while (true) {
            const leftCol = (n5 === 0 ? gridW - 1 : n5 - 1);
            if (n5 === this.scrollOffset) break;
            if (this.board[n6 * gridW + leftCol] !== 2) break;
            n5 = leftCol;
            if (n6 === 17) continue;
            if (this.board[(n6 + 1) * gridW + n5] !== 2) continue;
            n8 = 0;
            break;
        }
        if (n8 === 0) return;
        const startCol = (this.scrollOffset + colCoord - 3) % gridW;
        if (n5 !== startCol) {
            n8 = 0;
        } else {
            while (n6 !== rowCoord) {
                if (n6 === 0) {
                    n8 = 0;
                    break;
                }
                if (this.board[(n6 - 1) * gridW + n5] !== 2) {
                    n8 = 0;
                    break;
                }
                n6--; 
                if (n5 === this.scrollOffset) continue;
                const leftCol = (n5 === 0 ? gridW - 1 : n5 - 1);
                if (this.board[n6 * gridW + leftCol] !== 2) continue;
                n8 = 0;
                break;
            }
        }
        if (n8 === 0) return;
        this.flashingActive = true;
        this.flashingTimer = 0;
        this.flashingFlashTimer = 0;
        let basePoints = 10;
        let totalAdded = 0;
        for (let r = topRow; r <= bottomRow; r++) {
            for (let c = colCoord; c <= n4; c++) {
                const bc = (this.scrollOffset + c - 3) % gridW;
                if (this.board[r * gridW + bc] === 2) {
                    this.board[r * gridW + bc] = 4; 
                    totalAdded += basePoints;
                    basePoints++;
                    this.scorePopupX = (c + 1) * 12;
                    this.scorePopupY = (r + 2) * 12;
                }
            }
        }
        this.score += totalAdded;
        this.scorePopupValue = totalAdded;
        this.scorePopupActive = true;
        this.scorePopupTimer = 0;
        this.audio.playRandomFX();
    }
    triggerGameOver() {
        this.gameOverTextActive = true;
        this.gameOverTextTimer = 0;
        this.gameOverAnimActive = false;
        this.gameInProgress = false;
        const highestScore = this.hallOfFame.getHighest();
        if (this.score > highestScore + 1000) {
            this.gameOverTier = 3; 
        } else if (this.score > highestScore) {
            this.gameOverTier = 2; 
        } else if (this.score > highestScore / 2) {
            this.gameOverTier = 1; 
        } else {
            this.gameOverTier = 0; 
        }
        this.lastNewScoreIndex = this.hallOfFame.addScore(this.score);
        this.audio.playEnd();
    }
    update(dt) {
        if (this.currentScreen === SCREEN.TITLE) {
            this.titleTimer += dt;
            if (this.titleTimer >= 3000) {
                this.openMenu();
            }
            return;
        }
        if (this.currentScreen !== SCREEN.PLAYING) {
            return;
        }
        if (this.pendingAction >= 0 && !this.gameOverTextActive && !this.gameOverAnimActive) {
            const action = this.pendingAction;
            this.pendingAction = -1;
            switch (action) {
                case 0: 
                    this.fireShot();
                    break;
                case 1: 
                    if (this.shooterY > 0) this.shooterY--;
                    break;
                case 2: { 
                    const curShape = this.queue[this.currentQueueIdx];
                    const rot = this.shooterRot;
                    if (curShape === 3 || (curShape === 2 && (rot === 1 || rot === 3))) {
                        if (this.shooterY < 17) this.shooterY++;
                    } else {
                        if (this.shooterY < 16) this.shooterY++;
                    }
                    break;
                }
                case 3: 
                    if (this.shooterY === 17 && this.queue[this.currentQueueIdx] === 2) {
                        this.shooterY--;
                    }
                    this.shooterRot = (this.shooterRot === 0 ? 3 : this.shooterRot - 1);
                    break;
                case 4: 
                    if (this.shooterY === 17 && this.queue[this.currentQueueIdx] === 2) {
                        this.shooterY--;
                    }
                    this.shooterRot = (this.shooterRot + 1) % 4;
                    break;
            }
        }
        if (this.gameOverTextActive) {
            this.gameOverTextTimer += dt;
            if (this.gameOverTextTimer > 1500) {
                this.gameOverTextActive = false;
                this.gameOverAnimActive = true;
                this.gameOverAnimTimer = 0;
                this.gameOverFrame = 1;
                this.gameOverFrameTimer = 0;
            }
            return;
        }
        if (this.gameOverAnimActive) {
            this.gameOverAnimTimer += dt;
            let duration = 9200;
            switch (this.gameOverTier) {
                case 0: duration = 9200; break;
                case 1: duration = 6400; break;
                case 2: duration = 7400; break;
                case 3: duration = 9600; break;
            }
            this.gameOverFrameTimer += dt;
            if (this.gameOverFrameTimer > 600) {
                this.gameOverFrameTimer = 0;
                this.gameOverFrame = (this.gameOverFrame === 1 ? 2 : 1);
            }
            if (this.gameOverAnimTimer >= duration) {
                this.gameOverAnimActive = false;
                this.openHighScores();
            }
            return;
        }
        if (!this.flashingActive) {
            this.scrollTimer += dt;
        } else {
            this.flashingTimer += dt;
            this.flashingFlashTimer += dt;
        }
        if (!this.flashingActive && this.scrollTimer >= this.scrollThreshold) {
            this.scrollTimer = 0;
            for (let r = 0; r < 18; r++) {
                if (this.board[r * this.gridCols + this.scrollOffset] === 2) {
                    this.triggerGameOver();
                    return;
                }
            }
            this.scrollOffset = (this.scrollOffset + 1) % this.gridCols;
            this.generateObstacle();
        }
        if (this.flashingActive) {
            if (this.flashingTimer >= 1000) {
                this.flashingActive = false;
                for (let i = 0; i < this.board.length; i++) {
                    if (this.board[i] === 4) this.board[i] = 0;
                }
                this.clearedRectsCount++;
                if (this.clearedRectsCount >= 5) {
                    this.clearedRectsCount = 0;
                    if (this.scrollThreshold >= 330) {
                        this.scrollThreshold -= 300;
                    }
                }
            }
            if (this.flashingFlashTimer >= 100) {
                this.flashingFlashTimer = 0;
                this.flashingFrame = (this.flashingFrame + 1) % 2;
            }
        }
        let pixelsToMove = 0;
        let anyActive = false;
        for (let s = 0; s < 2; s++) {
            if (this.projectiles[s].x < 240) {
                anyActive = true;
                break;
            }
        }
        if (anyActive) {
            const now = performance.now();
            if (this.lastShotMoveTime < 0) {
                this.lastShotMoveTime = now;
            } else {
                pixelsToMove = Math.floor((now - this.lastShotMoveTime) * 120 / 1000);
                if (pixelsToMove > 0) {
                    this.lastShotMoveTime += (pixelsToMove * 1000 / 120);
                }
            }
        } else {
            this.lastShotMoveTime = -1;
        }
        for (let s = 0; s < 2; s++) {
            const p = this.projectiles[s];
            if (p.x >= 240) continue;
            let stopped = false;
            let remaining = pixelsToMove;
            while (remaining > 0) {
                const step = Math.min(remaining, 4);
                p.x += step;
                remaining -= step;
                if (p.x < 240) {
                    stopped = this.checkProjectileCollision(p);
                } else {
                    stopped = true;
                    let penalty = 50;
                    switch (p.type) {
                        case 0: penalty = 400; break;
                        case 1: penalty = 200; break;
                        case 2: penalty = 100; break;
                        case 3: penalty = 50; break;
                    }
                    this.score = Math.max(0, this.score - penalty);
                    this.penaltyPopupValue = -penalty;
                    this.penaltyPopupY = p.y + 48;
                    this.penaltyPopupActive = true;
                    this.scorePopupTimer = 0;
                    if (navigator.vibrate) {
                        navigator.vibrate(150);
                    }
                }
                if (stopped) break;
            }
        }
        if (this.scorePopupActive || this.penaltyPopupActive) {
            this.scorePopupTimer += dt;
            if (this.scorePopupTimer >= 1000) {
                this.scorePopupActive = false;
                this.penaltyPopupActive = false;
            }
        }
    }
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, 240, 320);
        if (!this.loaded) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 240, 320);
            ctx.fillStyle = '#ffffff';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Loading...', 120, 160);
            return;
        }
        switch (this.currentScreen) {
            case SCREEN.TITLE:
                this.renderTitle(ctx);
                break;
            case SCREEN.MENU:
                this.renderMenu(ctx);
                break;
            case SCREEN.INSTRUCTIONS:
                this.renderInstructions(ctx);
                break;
            case SCREEN.HIGH_SCORES:
                this.renderHighScores(ctx);
                break;
            case SCREEN.CONFIRM_NEW:
                this.renderConfirmNew(ctx);
                break;
            case SCREEN.PLAYING:
                this.renderPlaying(ctx);
                break;
        }
    }
    renderTitle(ctx) {
        if (this.images.title) {
            ctx.drawImage(this.images.title, 0, 0, 240, 320);
        }
        this.renderSoftKeys(ctx, getString(12), getString(8));
    }
    renderMenu(ctx) {
        ctx.drawImage(this.bgCanvas, 0, 0);
        ctx.fillStyle = 'rgba(230, 238, 245, 0.95)';
        ctx.fillRect(15, 45, 210, 230);
        ctx.strokeStyle = '#499EB3';
        ctx.lineWidth = 2;
        ctx.strokeRect(15, 45, 210, 230);
        ctx.fillStyle = '#1B3B4B';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getString(12), 120, 75);
        this.menuItems = [];
        if (this.gameInProgress) {
            this.menuItems.push({ id: 'continue', text: getString(10) });
        }
        this.menuItems.push({ id: 'new', text: getString(2) });
        this.menuItems.push({ id: 'instructions', text: getString(4) });
        this.menuItems.push({ id: 'high_scores', text: getString(6) });
        this.menuItems.push({ id: 'exit', text: getString(8) });
        if (this.menuSelection >= this.menuItems.length) {
            this.menuSelection = 0;
        }
        const startY = 105;
        const itemH = 28;
        ctx.font = '14px sans-serif';
        this.menuItems.forEach((item, idx) => {
            const y = startY + idx * itemH;
            if (idx === this.menuSelection) {
                ctx.fillStyle = '#499EB3';
                ctx.fillRect(25, y - 18, 190, 24);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 14px sans-serif';
            } else {
                ctx.fillStyle = '#1B3B4B';
                ctx.font = '14px sans-serif';
            }
            ctx.textAlign = 'left';
            ctx.fillText(item.text, 40, y);
        });
        this.renderSoftKeys(ctx, '选择', getString(11));
    }
    renderInstructions(ctx) {
        ctx.drawImage(this.bgCanvas, 0, 0);
        ctx.fillStyle = 'rgba(235, 242, 248, 0.95)';
        ctx.fillRect(10, 30, 220, 260);
        ctx.strokeStyle = '#499EB3';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 30, 220, 260);
        ctx.fillStyle = '#1B3B4B';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getString(3), 120, 55);
        const text = getString(13, ['4', '6', '2', '8', '5']);
        ctx.fillStyle = '#222222';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'left';
        this.wrapText(ctx, text, 20, 80, 200, 16);
        this.renderSoftKeys(ctx, '', getString(11));
    }
    renderHighScores(ctx) {
        ctx.drawImage(this.bgCanvas, 0, 0);
        ctx.fillStyle = 'rgba(235, 242, 248, 0.95)';
        ctx.fillRect(10, 30, 220, 260);
        ctx.strokeStyle = '#499EB3';
        ctx.lineWidth = 2;
        ctx.strokeRect(10, 30, 220, 260);
        ctx.fillStyle = '#1B3B4B';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getString(5), 120, 60);
        const records = this.hallOfFame.records;
        for (let i = 0; i < 6; i++) {
            const rec = records[i] || { score: 0, date: '' };
            const y = 95 + i * 28;
            if (i === this.lastNewScoreIndex) {
                ctx.fillStyle = '#499EB3';
                ctx.fillRect(18, y - 18, 204, 24);
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 13px sans-serif';
            } else {
                ctx.fillStyle = '#222222';
                ctx.font = '13px sans-serif';
            }
            ctx.textAlign = 'left';
            ctx.fillText(`${i + 1}. ${rec.score}  (${rec.date})`, 25, y);
        }
        this.renderSoftKeys(ctx, '', getString(11));
    }
    renderConfirmNew(ctx) {
        ctx.drawImage(this.bgCanvas, 0, 0);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        this.roundRect(ctx, 16, 95, 208, 130, 10);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(getString(1), 120, 135);
        ctx.fillStyle = '#0284c7';
        this.roundRect(ctx, 30, 162, 78, 34, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        ctx.fillText(getString(10), 69, 184);
        ctx.fillStyle = '#475569';
        this.roundRect(ctx, 132, 162, 78, 34, 6);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(getString(11), 171, 184);
        this.renderSoftKeys(ctx, getString(10), getString(11));
    }
    renderPlaying(ctx) {
        ctx.drawImage(this.bgCanvas, 0, 0);
        if (this.gameOverAnimActive) {
            ctx.drawImage(this.images.gamebg, 0, 0, 240, 320);
            let frameImg = null;
            let offsetY = 118;
            switch (this.gameOverTier) {
                case 0:
                    frameImg = (this.gameOverFrame === 1 ? this.images.cry1 : this.images.cry2);
                    break;
                case 1:
                    frameImg = (this.gameOverFrame === 1 ? this.images.thumbup1 : this.images.thumbup2);
                    break;
                case 2:
                    frameImg = (this.gameOverFrame === 1 ? this.images.jump1 : this.images.jump2);
                    offsetY = (this.gameOverFrame === 1 ? 108 : 118);
                    break;
                case 3:
                    frameImg = (this.gameOverFrame === 1 ? this.images.travolta1 : this.images.travolta2);
                    break;
            }
            if (frameImg) {
                ctx.drawImage(frameImg, 59, offsetY);
            }
            return;
        }
        const curShape = this.queue[this.currentQueueIdx];
        this.drawShape(ctx, 0, this.shooterY * 12, curShape, this.shooterRot, true);
        if (this.flashingActive && this.flashingFrame === 0) {
            for (let r = 0; r < 18; r++) {
                for (let c = 0; c < this.gridCols; c++) {
                    const bc = (this.scrollOffset + c) % this.gridCols;
                    if (this.board[r * this.gridCols + bc] === 4) {
                        this.drawTile(ctx, (c + 3) * 12, r * 12, 4, false);
                    }
                }
            }
        }
        this.drawTargetIndicator(ctx);
        for (let s = 0; s < 2; s++) {
            const p = this.projectiles[s];
            if (p.x < 240) {
                this.drawShape(ctx, p.x, p.y, p.type, p.rot, true);
            }
        }
        for (let r = 0; r < 18; r++) {
            for (let c = 0; c < this.gridCols; c++) {
                const bc = (this.scrollOffset + c) % this.gridCols;
                if (this.board[r * this.gridCols + bc] === 2) {
                    this.drawTile(ctx, 36 + c * 12, r * 12, 2, false);
                }
            }
        }
        if (this.scorePopupActive) {
            this.drawPopupText(ctx, `+${this.scorePopupValue}`, '#5BF020', this.scorePopupX, this.scorePopupY);
        }
        if (this.penaltyPopupActive) {
            this.drawPopupText(ctx, `${this.penaltyPopupValue}`, '#FF2020', 230, this.penaltyPopupY);
        }
        this.drawQueuePreview(ctx);
        this.drawScoreDigits(ctx, this.score);
        if (this.gameOverTextActive) {
            const text = getString(7);
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#000000';
            ctx.fillText(text, 122, 162);
            ctx.fillStyle = '#FAFAFA';
            ctx.fillText(text, 120, 160);
        }
        this.renderSoftKeys(ctx, getString(12), '');
    }
    drawTile(ctx, x, y, tileIdx, flipped) {
        if (!this.images.tiles) return;
        const screenX = x + 2;
        const screenY = y + 45;
        ctx.save();
        if (flipped) {
            ctx.translate(screenX + 12, screenY);
            ctx.scale(-1, 1);
            ctx.drawImage(this.images.tiles, tileIdx * 12, 0, 12, 12, 0, 0, 12, 12);
        } else {
            ctx.drawImage(this.images.tiles, tileIdx * 12, 0, 12, 12, screenX, screenY, 12, 12);
        }
        ctx.restore();
    }
    drawShape(ctx, x, y, shapeType, rot, flipped) {
        switch (shapeType) {
            case 0: 
                this.drawTile(ctx, x, y, 2, flipped);
                this.drawTile(ctx, x + 12, y, 2, flipped);
                this.drawTile(ctx, x, y + 12, 2, flipped);
                this.drawTile(ctx, x + 12, y + 12, 2, flipped);
                break;
            case 1: 
                switch (rot) {
                    case 0:
                        this.drawTile(ctx, x, y, 2, flipped);
                        this.drawTile(ctx, x, y + 12, 2, flipped);
                        this.drawTile(ctx, x + 12, y + 12, 2, flipped);
                        break;
                    case 1:
                        this.drawTile(ctx, x, y, 2, flipped);
                        this.drawTile(ctx, x + 12, y, 2, flipped);
                        this.drawTile(ctx, x, y + 12, 2, flipped);
                        break;
                    case 2:
                        this.drawTile(ctx, x, y, 2, flipped);
                        this.drawTile(ctx, x + 12, y, 2, flipped);
                        this.drawTile(ctx, x + 12, y + 12, 2, flipped);
                        break;
                    case 3:
                        this.drawTile(ctx, x + 12, y, 2, flipped);
                        this.drawTile(ctx, x, y + 12, 2, flipped);
                        this.drawTile(ctx, x + 12, y + 12, 2, flipped);
                        break;
                }
                break;
            case 2: 
                if (rot === 0 || rot === 2) {
                    this.drawTile(ctx, x, y, 2, flipped);
                    this.drawTile(ctx, x, y + 12, 2, flipped);
                } else {
                    this.drawTile(ctx, x, y, 2, flipped);
                    this.drawTile(ctx, x + 12, y, 2, flipped);
                }
                break;
            case 3: 
                this.drawTile(ctx, x, y, 2, flipped);
                break;
        }
    }
    drawTargetIndicator(ctx) {
        const kCols = this.kCols;
        const gridW = this.gridCols;
        const curShape = this.queue[this.currentQueueIdx];
        const rot = this.shooterRot;
        const row = this.shooterY;
        let activeTop = true;
        let activeBot = true;
        for (let s = 0; s < 2; s++) {
            const p = this.projectiles[s];
            if (p.x >= 240) continue;
            const pType = p.type;
            const pRot = p.rot;
            if (p.y === (row - 1) * 12) {
                if (pType !== 3 && (pType !== 2 || (pRot !== 1 && pRot !== 3))) {
                    activeTop = false;
                }
            } else if (p.y === row * 12) {
                activeTop = false;
                if (pType !== 3 && (pType !== 2 || (pRot !== 1 && pRot !== 3))) {
                    activeBot = false;
                }
            } else if (p.y === (row + 1) * 12) {
                activeBot = false;
            }
        }
        let targetColTop = kCols - 1;
        if (activeTop) {
            for (let c = 0; c < gridW; c++) {
                const bc = (this.scrollOffset + c) % gridW;
                if (this.board[row * gridW + bc] === 0) continue;
                targetColTop = (this.board[row * gridW + bc] === 2 ? c + 3 - 1 : -1);
                break;
            }
            if (targetColTop >= 3) {
                this.drawTile(ctx, targetColTop * 12, row * 12, 3, false);
            }
            if ((curShape === 2 && (rot === 1 || rot === 3)) || (curShape === 1 && (rot === 1 || rot === 2)) || curShape === 0) {
                if (targetColTop >= 4) {
                    this.drawTile(ctx, (targetColTop - 1) * 12, row * 12, 3, false);
                }
            }
        }
        let targetColBot = kCols - 1;
        if (activeBot && curShape !== 3 && (curShape !== 2 || (rot !== 1 && rot !== 3))) {
            for (let c = 0; c < gridW; c++) {
                const bc = (this.scrollOffset + c) % gridW;
                if (this.board[(row + 1) * gridW + bc] === 0) continue;
                targetColBot = (this.board[(row + 1) * gridW + bc] === 2 ? c + 3 - 1 : -1);
                break;
            }
            if (targetColBot >= 3) {
                this.drawTile(ctx, targetColBot * 12, (row + 1) * 12, 3, false);
            }
            if ((curShape === 1 && (rot === 0 || rot === 3)) || curShape === 0) {
                if (targetColBot >= 4) {
                    this.drawTile(ctx, (targetColBot - 1) * 12, (row + 1) * 12, 3, false);
                }
            }
        }
    }
    drawQueuePreview(ctx) {
        ctx.strokeStyle = '#499EB3';
        ctx.lineWidth = 1;
        ctx.strokeRect(9, 9, 56, 23);
        ctx.strokeRect(10, 10, 54, 21);
        let qIdx = this.currentQueueIdx;
        let x = 11;
        for (let i = 0; i < 4; i++) {
            qIdx = (qIdx + 1) % 5;
            const shape = this.queue[qIdx];
            const frame = this.shotsFrames[shape];
            if (frame) {
                ctx.drawImage(frame, x, 11);
            }
            x += 13;
        }
    }
    drawScoreDigits(ctx, val) {
        const str = String(val);
        let rightX = 170;
        const y = 277;
        for (let i = str.length - 1; i >= 0; i--) {
            const digit = parseInt(str[i], 10);
            const img = this.digits[digit];
            if (img) {
                rightX -= img.width;
                ctx.drawImage(img, rightX, y);
            }
        }
    }
    drawPopupText(ctx, text, color, x, y) {
        ctx.save();
        ctx.font = 'bold 12px sans-serif';
        ctx.fillStyle = color;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'bottom';
        ctx.fillText(text, x, y);
        ctx.restore();
    }
    roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }
    renderSoftKeys(ctx, leftLabel, rightLabel) {
        ctx.save();
        ctx.font = '11px sans-serif';
        ctx.fillStyle = '#FFFFFF';
        if (leftLabel) {
            ctx.textAlign = 'left';
            ctx.fillText(leftLabel, 8, 314);
        }
        if (rightLabel) {
            ctx.textAlign = 'right';
            ctx.fillText(rightLabel, 232, 314);
        }
        ctx.restore();
    }
    wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const paragraphs = text.split('\n');
        let currentY = y;
        paragraphs.forEach(p => {
            let line = '';
            for (let i = 0; i < p.length; i++) {
                const testLine = line + p[i];
                const metrics = ctx.measureText(testLine);
                if (metrics.width > maxWidth && i > 0) {
                    ctx.fillText(line, x, currentY);
                    line = p[i];
                    currentY += lineHeight;
                } else {
                    line = testLine;
                }
            }
            ctx.fillText(line, x, currentY);
            currentY += lineHeight * 1.2;
        });
    }
    openMenu() {
        this.currentScreen = SCREEN.MENU;
        this.menuSelection = 0;
    }
    openInstructions() {
        this.currentScreen = SCREEN.INSTRUCTIONS;
    }
    openHighScores() {
        this.currentScreen = SCREEN.HIGH_SCORES;
    }
    handleLeftSoftKey() {
        switch (this.currentScreen) {
            case SCREEN.TITLE:
                this.openMenu();
                break;
            case SCREEN.MENU:
                this.executeMenuSelection();
                break;
            case SCREEN.PLAYING:
                this.openMenu();
                break;
            case SCREEN.CONFIRM_NEW:
                this.startNewGame();
                break;
        }
    }
    handleRightSoftKey() {
        switch (this.currentScreen) {
            case SCREEN.TITLE:
                break;
            case SCREEN.MENU:
                if (this.gameInProgress) {
                    this.currentScreen = SCREEN.PLAYING;
                } else {
                    this.currentScreen = SCREEN.TITLE;
                    this.titleTimer = 0;
                }
                break;
            case SCREEN.INSTRUCTIONS:
            case SCREEN.HIGH_SCORES:
                this.openMenu();
                break;
            case SCREEN.CONFIRM_NEW:
                this.openMenu();
                break;
        }
    }
    executeMenuSelection() {
        if (!this.menuItems[this.menuSelection]) return;
        const item = this.menuItems[this.menuSelection];
        switch (item.id) {
            case 'continue':
                if (this.gameInProgress) {
                    this.currentScreen = SCREEN.PLAYING;
                }
                break;
            case 'new':
                if (this.gameInProgress) {
                    this.currentScreen = SCREEN.CONFIRM_NEW;
                } else {
                    this.startNewGame();
                }
                break;
            case 'instructions':
                this.openInstructions();
                break;
            case 'high_scores':
                this.openHighScores();
                break;
            case 'exit':
                this.currentScreen = SCREEN.TITLE;
                this.titleTimer = 0;
                break;
        }
    }
    handleKeyInput(key) {
        this.audio.initContext();
        if (this.currentScreen === SCREEN.TITLE) {
            this.openMenu();
            return;
        }
        if (this.currentScreen === SCREEN.MENU) {
            if (key === '2' || key === 'ArrowUp') {
                if (this.menuSelection > 0) this.menuSelection--;
            } else if (key === '8' || key === 'ArrowDown') {
                if (this.menuSelection < this.menuItems.length - 1) this.menuSelection++;
            } else if (key === '5' || key === 'Enter' || key === ' ') {
                this.executeMenuSelection();
            } else if (key === 'SoftRight' || key === 'Escape' || key === 'Backspace') {
                this.handleRightSoftKey();
            }
            return;
        }
        if (this.gameOverAnimActive || this.gameOverTextActive) {
            this.gameOverTextActive = false;
            this.gameOverAnimActive = false;
            this.openHighScores();
            return;
        }
        if (this.currentScreen === SCREEN.INSTRUCTIONS || this.currentScreen === SCREEN.HIGH_SCORES) {
            this.openMenu();
            return;
        }
        if (this.currentScreen === SCREEN.CONFIRM_NEW) {
            if (key === 'SoftLeft' || key === '5' || key === 'Enter' || key === ' ' || key === 'y' || key === 'Y' || key === '1') {
                this.startNewGame();
            } else {
                this.openMenu();
            }
            return;
        }
        if (this.currentScreen === SCREEN.PLAYING) {
            if (key === '5' || key === ' ' || key === 'Enter') {
                this.pendingAction = 0; 
            } else if (key === '2' || key === 'ArrowUp') {
                this.pendingAction = 1; 
            } else if (key === '8' || key === 'ArrowDown') {
                this.pendingAction = 2; 
            } else if (key === '4' || key === 'ArrowLeft') {
                this.pendingAction = 3; 
            } else if (key === '6' || key === 'ArrowRight') {
                this.pendingAction = 4; 
            } else if (key === 'SoftLeft' || key === 'Escape') {
                this.openMenu();
            }
        }
    }
    handlePointerDown(x, y) {
        this.audio.initContext();
        this.isPointerDown = true;
        this.touchStartX = x;
        this.touchStartY = y;
        this.touchDragged = false;
    }
    handlePointerMove(x, y) {
        if (!this.isPointerDown) return;
        if (this.currentScreen !== SCREEN.PLAYING) return;
        if (Math.abs(this.touchStartX - x) > 43) {
            this.touchDragged = true;
            this.pendingAction = (this.touchStartX > x ? 3 : 4); 
            this.touchStartX = x;
        }
        if (Math.abs(this.touchStartY - y) > 15) {
            this.touchDragged = true;
            this.pendingAction = (this.touchStartY > y ? 1 : 2); 
            this.touchStartY = y;
        }
    }
    handlePointerUp(x, y) {
        if (!this.isPointerDown) return;
        this.isPointerDown = false;
        if (this.gameOverAnimActive || this.gameOverTextActive) {
            this.gameOverTextActive = false;
            this.gameOverAnimActive = false;
            this.openHighScores();
            return;
        }
        if (x < 90 && y > 270) {
            this.handleLeftSoftKey();
            return;
        }
        if (x > 150 && y > 270) {
            this.handleRightSoftKey();
            return;
        }
        if (this.currentScreen === SCREEN.CONFIRM_NEW) {
            if (x < 120) {
                this.startNewGame();
            } else {
                this.openMenu();
            }
            return;
        }
        if (this.currentScreen === SCREEN.INSTRUCTIONS || this.currentScreen === SCREEN.HIGH_SCORES) {
            this.openMenu();
            return;
        }
        if (this.currentScreen === SCREEN.TITLE) {
            this.openMenu();
            return;
        }
        if (this.currentScreen === SCREEN.MENU) {
            const startY = 105;
            const itemH = 28;
            const clickedIdx = Math.floor((y - (startY - 18)) / itemH);
            if (clickedIdx >= 0 && clickedIdx < this.menuItems.length) {
                this.menuSelection = clickedIdx;
                this.executeMenuSelection();
            }
            return;
        }
        if (this.currentScreen === SCREEN.PLAYING) {
            if (!this.touchDragged && Math.abs(this.touchStartX - x) < 15 && Math.abs(this.touchStartY - y) < 15) {
                this.pendingAction = 0;
            }
        }
        this.touchDragged = false;
    }
    mainLoop(timestamp) {
        const dt = Math.min(timestamp - this.lastFrameTime, 100);
        this.lastFrameTime = timestamp;
        this.update(dt);
        this.render();
        requestAnimationFrame(this.mainLoop.bind(this));
    }
}
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new StaqGame(canvas);
    window.addEventListener('keydown', (e) => {
        let key = null;
        if (e.key >= '0' && e.key <= '9') {
            key = e.key;
        } else if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
            key = 'ArrowUp';
        } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
            key = 'ArrowDown';
        } else if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
            key = 'ArrowLeft';
        } else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
            key = 'ArrowRight';
        } else if (e.key === ' ' || e.key === 'Enter') {
            key = 'Enter';
        } else if (e.key === 'Escape' || e.key === 'Backspace') {
            key = 'Escape';
        } else if (e.key === 'F1') {
            key = 'SoftLeft';
        } else if (e.key === 'F2') {
            key = 'SoftRight';
        } else if (e.key === 'm' || e.key === 'M') {
            const muted = game.audio.toggleMute();
            updateMuteButton(muted);
            return;
        }
        if (key) {
            e.preventDefault();
            game.handleKeyInput(key);
        }
    });
    function getCanvasCoords(evt) {
        const rect = canvas.getBoundingClientRect();
        const clientX = evt.touches ? evt.touches[0].clientX : evt.clientX;
        const clientY = evt.touches ? evt.touches[0].clientY : evt.clientY;
        const scaleX = 240 / rect.width;
        const scaleY = 320 / rect.height;
        return {
            x: (clientX - rect.left) * scaleX,
            y: (clientY - rect.top) * scaleY
        };
    }
    canvas.addEventListener('mousedown', (e) => {
        const { x, y } = getCanvasCoords(e);
        game.handlePointerDown(x, y);
    });
    canvas.addEventListener('mousemove', (e) => {
        const { x, y } = getCanvasCoords(e);
        game.handlePointerMove(x, y);
        if (game.currentScreen === SCREEN.MENU || game.currentScreen === SCREEN.CONFIRM_NEW ||
            game.currentScreen === SCREEN.TITLE || game.currentScreen === SCREEN.INSTRUCTIONS ||
            game.currentScreen === SCREEN.HIGH_SCORES || y > 270) {
            canvas.style.cursor = 'pointer';
        } else {
            canvas.style.cursor = 'default';
        }
    });
    canvas.addEventListener('mouseup', (e) => {
        const { x, y } = getCanvasCoords(e);
        game.handlePointerUp(x, y);
    });
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        game.handlePointerDown(x, y);
    }, { passive: false });
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        const { x, y } = getCanvasCoords(e);
        game.handlePointerMove(x, y);
    }, { passive: false });
    canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (e.changedTouches.length > 0) {
            const rect = canvas.getBoundingClientRect();
            const clientX = e.changedTouches[0].clientX;
            const clientY = e.changedTouches[0].clientY;
            const x = (clientX - rect.left) * (240 / rect.width);
            const y = (clientY - rect.top) * (320 / rect.height);
            game.handlePointerUp(x, y);
        }
    }, { passive: false });
    const btnMute = document.getElementById('btnMute');
    const btnLang = document.getElementById('btnLang');
    const btnRestart = document.getElementById('btnRestart');
    const btnHelp = document.getElementById('btnHelp');
    const helpDrawer = document.getElementById('helpDrawer');
    function updateMuteButton(muted) {
        if (btnMute) {
            btnMute.textContent = muted ? '🔇 静音' : '🔊 声音';
        }
    }
    if (btnMute) {
        btnMute.addEventListener('click', () => {
            const muted = game.audio.toggleMute();
            updateMuteButton(muted);
        });
    }
    if (btnLang) {
        btnLang.addEventListener('click', () => {
            currentLang = (currentLang === 'zh-CN' ? 'en-US' : 'zh-CN');
            btnLang.textContent = (currentLang === 'zh-CN' ? '🌐 中文' : '🌐 EN');
        });
    }
    if (btnRestart) {
        btnRestart.addEventListener('click', () => {
            game.startNewGame();
        });
    }
    if (btnHelp && helpDrawer) {
        btnHelp.addEventListener('click', () => {
            helpDrawer.classList.toggle('active');
        });
    }
});