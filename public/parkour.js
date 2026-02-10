// Parkour Game
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

    update(platforms) {
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

// Level platforms
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
        parkourPlayers[myPlayerId].update(currentPlatforms);
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
        parkourPlayers[teammateId].update(currentPlatforms);
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
        socket.emit('searchParkour');
        showParkourScreen('searching');
    });
}

if (cancelParkourSearchBtn) {
    cancelParkourSearchBtn.addEventListener('click', () => {
        socket.emit('cancelParkourSearch');
        showParkourScreen('menu');
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
    showParkourScreen('searching');
});

socket.on('parkourGameStart', (data) => {
    parkourGameId = data.gameId;
    myPlayerId = socket.id;
    teammateId = data.teammate;
    
    parkourPlayer1El.textContent = data.player1Name;
    parkourPlayer2El.textContent = data.player2Name;
    
    // Initialize players
    parkourPlayers[data.player1Id] = new Player(data.player1Id, 50, 400, '#667eea');
    parkourPlayers[data.player2Id] = new Player(data.player2Id, 100, 400, '#f56565');
    
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
