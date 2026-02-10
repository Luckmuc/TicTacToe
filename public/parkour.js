// Parkour Game
// Use global socket from game.js
const socket = window.socket;

const parkourSearchingScreen = document.getElementById('parkourSearchingScreen');
const parkourScreen = document.getElementById('parkourScreen');
const parkourCanvas = document.getElementById('parkourCanvas');
const ctx = parkourCanvas ? parkourCanvas.getContext('2d') : null;
const playParkourBtn = document.getElementById('playParkourBtn');
const cancelParkourSearchBtn = document.getElementById('cancelParkourSearchBtn');
const leaveParkourBtn = document.getElementById('leaveParkourBtn');
const parkourPlayer1El = document.getElementById('parkourPlayer1');
const parkourPlayer2El = document.getElementById('parkourPlayer2');
const parkourTimeEl = document.getElementById('parkourTime');
const parkourLevelEl = document.getElementById('parkourLevel');

let parkourGameId = null;
let parkourPlayers = {};
let myPlayerId = null;
let teammateId = null;
let currentLevel = 1;
let gameStartTime = 0;
let animationId = null;

// Game Constants
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const GRAVITY = 0.8;
const JUMP_FORCE = -15;
const MOVE_SPEED = 5;
const MAX_FALL_SPEED = 15;

// Player object
class Player {
    constructor(id, x, y, color) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = PLAYER_SIZE;
        this.height = PLAYER_SIZE;
        this.velocityX = 0;
        this.velocityY = 0;
        this.onGround = false;
        this.color = color;
        this.keys = {};
    }

    update(platforms, otherPlayers = []) {
        // Gravity
        this.velocityY += GRAVITY;
        if (this.velocityY > MAX_FALL_SPEED) {
            this.velocityY = MAX_FALL_SPEED;
        }

        // Movement
        this.velocityX = 0;
        if (this.keys.left) this.velocityX = -MOVE_SPEED;
        if (this.keys.right) this.velocityX = MOVE_SPEED;

        // Apply velocity
        this.x += this.velocityX;
        this.y += this.velocityY;

        // Collision with platforms
        this.onGround = false;
        platforms.forEach(platform => {
            if (this.checkCollision(platform)) {
                // Bottom collision
                if (this.velocityY > 0 && this.y + this.height - this.velocityY <= platform.y) {
                    this.y = platform.y - this.height;
                    this.velocityY = 0;
                    this.onGround = true;
                }
                // Top collision
                else if (this.velocityY < 0 && this.y - this.velocityY >= platform.y + platform.height) {
                    this.y = platform.y + platform.height;
                    this.velocityY = 0;
                }
                // Side collisions
                else {
                    if (this.velocityX > 0) {
                        this.x = platform.x - this.width;
                    } else if (this.velocityX < 0) {
                        this.x = platform.x + platform.width;
                    }
                }
            }
        });

        // Collision with other players (can stand on each other)
        otherPlayers.forEach(player => {
            if (player && player.id !== this.id) {
                if (this.checkCollision(player)) {
                    // Bottom collision - can stand on other player
                    if (this.velocityY > 0 && this.y + this.height - this.velocityY <= player.y) {
                        this.y = player.y - this.height;
                        this.velocityY = 0;
                        this.onGround = true;
                    }
                    // Top collision
                    else if (this.velocityY < 0 && this.y - this.velocityY >= player.y + player.height) {
                        this.y = player.y + player.height;
                        this.velocityY = 0;
                    }
                    // Side collisions
                    else {
                        if (this.velocityX > 0) {
                            this.x = player.x - this.width;
                        } else if (this.velocityX < 0) {
                            this.x = player.x + player.width;
                        }
                    }
                }
            }
        });

        // Canvas boundaries
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > CANVAS_WIDTH) this.x = CANVAS_WIDTH - this.width;
        if (this.y + this.height > CANVAS_HEIGHT) {
            this.y = CANVAS_HEIGHT - this.height;
            this.velocityY = 0;
            this.onGround = true;
        }
    }

    checkCollision(platform) {
        return this.x < platform.x + platform.width &&
               this.x + this.width > platform.x &&
               this.y < platform.y + platform.height &&
               this.y + this.height > platform.y;
    }

    jump() {
        if (this.onGround) {
            this.velocityY = JUMP_FORCE;
        }
    }

    draw(ctx, isMe) {
        // Draw player
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw border if it's me
        if (isMe) {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 3;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        }

        // Draw eyes
        ctx.fillStyle = '#000';
        ctx.fillRect(this.x + 8, this.y + 8, 5, 5);
        ctx.fillRect(this.x + 17, this.y + 8, 5, 5);
    }
}

// Level platforms - 10 verschiedene Levels
const levels = {
    1: [
        { x: 0, y: 570, width: 400, height: 30 },
        { x: 500, y: 470, width: 200, height: 30 },
        { x: 800, y: 370, width: 200, height: 30 },
        { x: 1050, y: 270, width: 150, height: 30 },
        { x: 300, y: 350, width: 150, height: 30 },
        { x: 550, y: 250, width: 100, height: 30 },
        { x: 100, y: 150, width: 200, height: 30 },
        { x: 900, y: 150, width: 300, height: 30, finish: true }
    ],
    2: [
        { x: 0, y: 570, width: 200, height: 30 },
        { x: 300, y: 500, width: 100, height: 30 },
        { x: 500, y: 430, width: 100, height: 30 },
        { x: 700, y: 360, width: 100, height: 30 },
        { x: 500, y: 290, width: 100, height: 30 },
        { x: 300, y: 220, width: 100, height: 30 },
        { x: 100, y: 150, width: 100, height: 30 },
        { x: 300, y: 80, width: 100, height: 30 },
        { x: 800, y: 200, width: 400, height: 30, finish: true }
    ],
    3: [
        { x: 0, y: 570, width: 150, height: 30 },
        { x: 250, y: 570, width: 100, height: 30 },
        { x: 450, y: 570, width: 100, height: 30 },
        { x: 650, y: 470, width: 100, height: 30 },
        { x: 850, y: 370, width: 100, height: 30 },
        { x: 650, y: 270, width: 100, height: 30 },
        { x: 450, y: 170, width: 100, height: 30 },
        { x: 250, y: 70, width: 100, height: 30 },
        { x: 950, y: 100, width: 250, height: 30, finish: true }
    ],
    4: [
        { x: 0, y: 570, width: 100, height: 30 },
        { x: 200, y: 500, width: 80, height: 30 },
        { x: 380, y: 430, width: 80, height: 30 },
        { x: 560, y: 360, width: 80, height: 30 },
        { x: 740, y: 290, width: 80, height: 30 },
        { x: 920, y: 220, width: 80, height: 30 },
        { x: 740, y: 150, width: 80, height: 30 },
        { x: 560, y: 80, width: 80, height: 30 },
        { x: 900, y: 80, width: 300, height: 30, finish: true }
    ],
    5: [
        { x: 0, y: 570, width: 300, height: 30 },
        { x: 400, y: 470, width: 100, height: 30 },
        { x: 600, y: 370, width: 100, height: 30 },
        { x: 350, y: 270, width: 100, height: 30 },
        { x: 550, y: 170, width: 100, height: 30 },
        { x: 750, y: 270, width: 100, height: 30 },
        { x: 950, y: 370, width: 100, height: 30 },
        { x: 850, y: 100, width: 350, height: 30, finish: true }
    ],
    6: [
        { x: 0, y: 570, width: 150, height: 30 },
        { x: 250, y: 520, width: 80, height: 30 },
        { x: 430, y: 470, width: 80, height: 30 },
        { x: 610, y: 420, width: 80, height: 30 },
        { x: 790, y: 370, width: 80, height: 30 },
        { x: 970, y: 320, width: 80, height: 30 },
        { x: 790, y: 270, width: 80, height: 30 },
        { x: 610, y: 220, width: 80, height: 30 },
        { x: 430, y: 170, width: 80, height: 30 },
        { x: 250, y: 120, width: 80, height: 30 },
        { x: 900, y: 50, width: 300, height: 30, finish: true }
    ],
    7: [
        { x: 0, y: 570, width: 200, height: 30 },
        { x: 300, y: 470, width: 150, height: 30 },
        { x: 150, y: 370, width: 150, height: 30 },
        { x: 400, y: 270, width: 150, height: 30 },
        { x: 250, y: 170, width: 150, height: 30 },
        { x: 500, y: 70, width: 150, height: 30 },
        { x: 750, y: 170, width: 150, height: 30 },
        { x: 900, y: 270, width: 150, height: 30 },
        { x: 1000, y: 100, width: 200, height: 30, finish: true }
    ],
    8: [
        { x: 0, y: 570, width: 100, height: 30 },
        { x: 180, y: 520, width: 70, height: 30 },
        { x: 330, y: 470, width: 70, height: 30 },
        { x: 480, y: 420, width: 70, height: 30 },
        { x: 630, y: 370, width: 70, height: 30 },
        { x: 780, y: 320, width: 70, height: 30 },
        { x: 930, y: 270, width: 70, height: 30 },
        { x: 1080, y: 220, width: 70, height: 30 },
        { x: 930, y: 170, width: 70, height: 30 },
        { x: 780, y: 120, width: 70, height: 30 },
        { x: 630, y: 70, width: 70, height: 30 },
        { x: 850, y: 50, width: 350, height: 30, finish: true }
    ],
    9: [
        { x: 0, y: 570, width: 250, height: 30 },
        { x: 350, y: 500, width: 100, height: 30 },
        { x: 550, y: 430, width: 100, height: 30 },
        { x: 350, y: 360, width: 100, height: 30 },
        { x: 150, y: 290, width: 100, height: 30 },
        { x: 350, y: 220, width: 100, height: 30 },
        { x: 550, y: 150, width: 100, height: 30 },
        { x: 750, y: 220, width: 100, height: 30 },
        { x: 950, y: 290, width: 100, height: 30 },
        { x: 850, y: 100, width: 350, height: 30, finish: true }
    ],
    10: [
        { x: 0, y: 570, width: 120, height: 30 },
        { x: 180, y: 510, width: 80, height: 30 },
        { x: 330, y: 450, width: 80, height: 30 },
        { x: 480, y: 390, width: 80, height: 30 },
        { x: 630, y: 330, width: 80, height: 30 },
        { x: 780, y: 270, width: 80, height: 30 },
        { x: 930, y: 210, width: 80, height: 30 },
        { x: 1080, y: 150, width: 80, height: 30 },
        { x: 930, y: 90, width: 80, height: 30 },
        { x: 780, y: 30, width: 80, height: 30 },
        { x: 950, y: 30, width: 250, height: 30, finish: true }
    ]
};

let currentPlatforms = [];

// Setup canvas
function setupCanvas() {
    if (!parkourCanvas) return;
    parkourCanvas.width = CANVAS_WIDTH;
    parkourCanvas.height = CANVAS_HEIGHT;
}

// Initialize level
function initLevel(level) {
    currentLevel = level;
    currentPlatforms = levels[level] || levels[1];
    parkourLevelEl.textContent = level;
    
    // Reset player positions
    if (parkourPlayers[myPlayerId]) {
        parkourPlayers[myPlayerId].x = 50;
        parkourPlayers[myPlayerId].y = 400;
        parkourPlayers[myPlayerId].velocityX = 0;
        parkourPlayers[myPlayerId].velocityY = 0;
    }
    if (parkourPlayers[teammateId]) {
        parkourPlayers[teammateId].x = 50;
        parkourPlayers[teammateId].y = 400;
        parkourPlayers[teammateId].velocityX = 0;
        parkourPlayers[teammateId].velocityY = 0;
    }
}

// Check if level complete
function checkLevelComplete() {
    const finishPlatform = currentPlatforms.find(p => p.finish);
    if (!finishPlatform) return false;
    
    const player1OnFinish = parkourPlayers[myPlayerId] && 
        parkourPlayers[myPlayerId].checkCollision(finishPlatform) &&
        parkourPlayers[myPlayerId].onGround;
    
    const player2OnFinish = parkourPlayers[teammateId] && 
        parkourPlayers[teammateId].checkCollision(finishPlatform) &&
        parkourPlayers[teammateId].onGround;
    
    return player1OnFinish && player2OnFinish;
}

// Game loop
function gameLoop() {
    if (!ctx) return;
    
    // Clear canvas
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw platforms
    currentPlatforms.forEach(platform => {
        if (platform.finish) {
            ctx.fillStyle = '#48bb78'; // Green for finish
        } else {
            ctx.fillStyle = '#4a5568';
        }
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
    });
    
    // Update and draw players
    if (parkourPlayers[myPlayerId]) {
        const otherPlayers = [parkourPlayers[teammateId]].filter(p => p);
        parkourPlayers[myPlayerId].update(currentPlatforms, otherPlayers);
        parkourPlayers[myPlayerId].draw(ctx, true);
        
        // Send position to server
        socket.emit('parkourMove', {
            gameId: parkourGameId,
            x: parkourPlayers[myPlayerId].x,
            y: parkourPlayers[myPlayerId].y,
            velocityX: parkourPlayers[myPlayerId].velocityX,
            velocityY: parkourPlayers[myPlayerId].velocityY
        });
    }
    
    if (parkourPlayers[teammateId]) {
        const otherPlayers = [parkourPlayers[myPlayerId]].filter(p => p);
        parkourPlayers[teammateId].update(currentPlatforms, otherPlayers);
        parkourPlayers[teammateId].draw(ctx, false);
    }
    
    // Update timer
    if (gameStartTime > 0) {
        const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        parkourTimeEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    }
    
    // Check level complete
    if (checkLevelComplete()) {
        socket.emit('parkourLevelComplete', {
            gameId: parkourGameId,
            level: currentLevel
        });
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Keyboard controls
const keys = {};

document.addEventListener('keydown', (e) => {
    if (!parkourPlayers[myPlayerId]) return;
    
    keys[e.key] = true;
    
    // WASD controls
    if (e.key === 'w' || e.key === 'W' || e.key === ' ') {
        parkourPlayers[myPlayerId].jump();
        e.preventDefault();
    }
    if (e.key === 'a' || e.key === 'A') {
        parkourPlayers[myPlayerId].keys.left = true;
    }
    if (e.key === 'd' || e.key === 'D') {
        parkourPlayers[myPlayerId].keys.right = true;
    }
    
    // Arrow keys
    if (e.key === 'ArrowUp') {
        parkourPlayers[myPlayerId].jump();
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
        parkourPlayers[myPlayerId].keys.left = true;
    }
    if (e.key === 'ArrowRight') {
        parkourPlayers[myPlayerId].keys.right = true;
    }
});

document.addEventListener('keyup', (e) => {
    if (!parkourPlayers[myPlayerId]) return;
    
    keys[e.key] = false;
    
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        parkourPlayers[myPlayerId].keys.left = false;
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        parkourPlayers[myPlayerId].keys.right = false;
    }
});

// Event listeners
if (playParkourBtn) {
    playParkourBtn.addEventListener('click', () => {
        console.log('[Parkour Client] Searching for parkour game...');\n        socket.emit('searchParkour');\n        showParkourScreen('searching');\n    });\n}

if (cancelParkourSearchBtn) {
    cancelParkourSearchBtn.addEventListener('click', () => {
        socket.emit('cancelParkourSearch');
        showParkourScreen('menu');
    });
}

// Touch Controls
const touchLeftBtn = document.getElementById('touchLeftBtn');
const touchRightBtn = document.getElementById('touchRightBtn');
const touchJumpBtn = document.getElementById('touchJumpBtn');

if (touchLeftBtn) {
    touchLeftBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.left = true;
        }
    });
    touchLeftBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.left = false;
        }
    });
}

if (touchRightBtn) {
    touchRightBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.right = true;
        }
    });
    touchRightBtn.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.right = false;
        }
    });
}

if (touchJumpBtn) {
    touchJumpBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].jump();
        }
    });
}

if (leaveParkourBtn) {
    leaveParkourBtn.addEventListener('click', () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        socket.emit('leaveParkour', { gameId: parkourGameId });
        parkourGameId = null;
        parkourPlayers = {};
        showParkourScreen('menu');
    });
}

function showParkourScreen(screen) {
    screens.username.classList.remove('active');
    screens.menu.classList.remove('active');
    screens.options.classList.remove('active');
    screens.searching.classList.remove('active');
    screens.lobby.classList.remove('active');
    screens.game.classList.remove('active');
    parkourSearchingScreen.classList.remove('active');
    parkourScreen.classList.remove('active');
    
    if (screen === 'menu') {
        screens.menu.classList.add('active');
    } else if (screen === 'searching') {
        parkourSearchingScreen.classList.add('active');
    } else if (screen === 'parkour') {
        parkourScreen.classList.add('active');
    }
}

// Socket events
socket.on('parkourSearching', () => {
    console.log('[Parkour Client] Received parkourSearching event');
    showParkourScreen('searching');
});

socket.on('parkourGameStart', (data) => {
    console.log('[Parkour Client] Game starting!', data);
    parkourGameId = data.gameId;
    myPlayerId = socket.id;
    teammateId = data.teammate;
    
    parkourPlayer1El.textContent = data.player1Name;
    parkourPlayer2El.textContent = data.player2Name;
    
    // Initialize players with green and blue colors
    parkourPlayers[data.player1Id] = new Player(data.player1Id, 50, 400, '#48bb78'); // Green
    parkourPlayers[data.player2Id] = new Player(data.player2Id, 100, 400, '#667eea'); // Blue
    
    setupCanvas();
    initLevel(1);
    gameStartTime = Date.now();
    
    showParkourScreen('parkour');
    gameLoop();
});

socket.on('parkourPlayerMove', (data) => {
    if (parkourPlayers[data.playerId] && data.playerId !== myPlayerId) {
        parkourPlayers[data.playerId].x = data.x;
        parkourPlayers[data.playerId].y = data.y;
        parkourPlayers[data.playerId].velocityX = data.velocityX;
        parkourPlayers[data.playerId].velocityY = data.velocityY;
    }
});

socket.on('parkourNextLevel', (data) => {
    initLevel(data.level);
});

socket.on('parkourGameComplete', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    
    alert('Herzlichen Glückwunsch! Ihr habt alle Level gemeistert!');
    showParkourScreen('menu');
});

socket.on('parkourOpponentLeft', () => {
    if (animationId) {
        cancelAnimationFrame(animationId);
        animationId = null;
    }
    alert('Dein Teammate hat das Spiel verlassen.');
    showParkourScreen('menu');
});
