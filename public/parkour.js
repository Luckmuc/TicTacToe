// Parkour Game
// Use global socket from game.js
var socket = window.socket;

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
let iAmAtFinish = false;
let teammateAtFinish = false;
let ropeState = {
    active: false,
    fromId: null,
    toId: null,
    fromX: 0,
    fromY: 0,
    expiresAt: 0
};
let ropeGrabbed = false;
let finishSignalInterval = null;

// Game Constants
const EASY_MODE = true;
const CANVAS_WIDTH = 1200;
const CANVAS_HEIGHT = 600;
const PLAYER_SIZE = 30;
const GRAVITY = EASY_MODE ? 0.6 : 0.8;
const JUMP_FORCE = EASY_MODE ? -16 : -15;
const MOVE_SPEED = EASY_MODE ? 5.5 : 5;
const MAX_FALL_SPEED = 15;
const DEATH_ZONE_Y = 650; // Below canvas = death

const ROPE_RANGE_X = 200;
const ROPE_RANGE_Y = 260;
const ROPE_DURATION_MS = 4500;
const ROPE_CLIMB_SPEED = 4.2;
const ROPE_PULL_STRENGTH = 0.06;

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

// Level platforms - 10 verschiedene Levels with moving platforms and spikes
const levelDefinitions = {
    1: {
        platforms: [
            { x: 0, y: 570, width: 400, height: 30 },
            { x: 500, y: 470, width: 200, height: 30 },
            { x: 800, y: 370, width: 200, height: 30 },
            { x: 1050, y: 270, width: 150, height: 30 },
            { x: 300, y: 350, width: 150, height: 30 },
            { x: 550, y: 250, width: 100, height: 30 },
            { x: 100, y: 150, width: 200, height: 30 },
            { x: 900, y: 150, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [],
        spikes: []
    },
    2: {
        platforms: [
            { x: 0, y: 570, width: 200, height: 30 },
            { x: 500, y: 430, width: 100, height: 30 },
            { x: 300, y: 220, width: 100, height: 30 },
            { x: 100, y: 150, width: 100, height: 30 },
            { x: 800, y: 200, width: 400, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 300, y: 500, width: 100, height: 30, startX: 300, endX: 400, speed: 1 },
            { x: 700, y: 360, width: 100, height: 30, startX: 650, endX: 800, speed: 1.5 }
        ],
        spikes: []
    },
    3: {
        platforms: [
            { x: 0, y: 570, width: 150, height: 30 },
            { x: 250, y: 570, width: 100, height: 30 },
            { x: 650, y: 470, width: 100, height: 30 },
            { x: 850, y: 370, width: 100, height: 30 },
            { x: 450, y: 170, width: 100, height: 30 },
            { x: 950, y: 100, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 450, y: 570, width: 100, height: 30, startX: 400, endX: 550, speed: 2 },
            { x: 650, y: 270, width: 100, height: 30, startY: 200, endY: 350, speed: 1, vertical: true }
        ],
        spikes: [
            { x: 380, y: 555, width: 60, height: 15 }
        ]
    },
    4: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 200, y: 500, width: 80, height: 30 },
            { x: 560, y: 360, width: 80, height: 30 },
            { x: 920, y: 220, width: 80, height: 30 },
            { x: 900, y: 80, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 380, y: 430, width: 80, height: 30, startX: 300, endX: 480, speed: 2 },
            { x: 740, y: 290, width: 80, height: 30, startY: 220, endY: 360, speed: 1.5, vertical: true },
            { x: 560, y: 80, width: 80, height: 30, startX: 500, endX: 700, speed: 2.5 }
        ],
        spikes: [
            { x: 140, y: 555, width: 50, height: 15 },
            { x: 850, y: 65, width: 40, height: 15 }
        ]
    },
    5: {
        platforms: [
            { x: 0, y: 570, width: 200, height: 30 },
            { x: 600, y: 370, width: 100, height: 30 },
            { x: 300, y: 200, width: 150, height: 30 },
            { x: 850, y: 100, width: 350, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 350, y: 470, width: 100, height: 30, startX: 280, endX: 500, speed: 2 },
            { x: 750, y: 270, width: 80, height: 30, startY: 200, endY: 350, speed: 1.5, vertical: true },
            { x: 550, y: 150, width: 100, height: 30, startX: 450, endX: 680, speed: 2.5 }
        ],
        spikes: [
            { x: 690, y: 355, width: 80, height: 15 },
            { x: 200, y: 555, width: 100, height: 15 }
        ]
    },
    6: {
        platforms: [
            { x: 0, y: 570, width: 150, height: 30 },
            { x: 430, y: 470, width: 80, height: 30 },
            { x: 790, y: 370, width: 80, height: 30 },
            { x: 430, y: 170, width: 80, height: 30 },
            { x: 900, y: 50, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 250, y: 520, width: 80, height: 30, startX: 180, endX: 350, speed: 2.5 },
            { x: 610, y: 420, width: 80, height: 30, startY: 350, endY: 480, speed: 1.5, vertical: true },
            { x: 610, y: 270, width: 80, height: 30, startX: 550, endX: 720, speed: 2 },
            { x: 680, y: 100, width: 100, height: 30, startX: 550, endX: 800, speed: 3 }
        ],
        spikes: [
            { x: 520, y: 455, width: 60, height: 15 },
            { x: 880, y: 355, width: 60, height: 15 }
        ]
    },
    7: {
        platforms: [
            { x: 0, y: 570, width: 200, height: 30 },
            { x: 300, y: 470, width: 100, height: 30 },
            { x: 500, y: 70, width: 150, height: 30 },
            { x: 1000, y: 100, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 370, width: 100, height: 30, startY: 300, endY: 450, speed: 1.5, vertical: true },
            { x: 400, y: 270, width: 80, height: 30, startX: 350, endX: 500, speed: 2.5 },
            { x: 250, y: 170, width: 80, height: 30, startX: 200, endX: 350, speed: 2 },
            { x: 750, y: 170, width: 100, height: 30, startY: 100, endY: 250, speed: 2, vertical: true },
            { x: 850, y: 200, width: 80, height: 30, startX: 800, endX: 950, speed: 2.5 }
        ],
        spikes: [
            { x: 410, y: 455, width: 80, height: 15 },
            { x: 350, y: 55, width: 50, height: 15 },
            { x: 660, y: 55, width: 50, height: 15 }
        ]
    },
    8: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 480, y: 420, width: 70, height: 30 },
            { x: 930, y: 270, width: 70, height: 30 },
            { x: 850, y: 50, width: 350, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 180, y: 520, width: 70, height: 30, startX: 130, endX: 280, speed: 2 },
            { x: 330, y: 470, width: 70, height: 30, startY: 400, endY: 520, speed: 1.5, vertical: true },
            { x: 630, y: 370, width: 70, height: 30, startX: 580, endX: 750, speed: 2.5 },
            { x: 780, y: 320, width: 70, height: 30, startY: 250, endY: 380, speed: 2, vertical: true },
            { x: 780, y: 150, width: 70, height: 30, startX: 700, endX: 850, speed: 3 },
            { x: 630, y: 100, width: 70, height: 30, startX: 550, endX: 720, speed: 2.5 }
        ],
        spikes: [
            { x: 120, y: 555, width: 50, height: 15 },
            { x: 560, y: 405, width: 60, height: 15 },
            { x: 1010, y: 255, width: 50, height: 15 }
        ]
    },
    9: {
        platforms: [
            { x: 0, y: 570, width: 150, height: 30 },
            { x: 550, y: 430, width: 80, height: 30 },
            { x: 150, y: 290, width: 80, height: 30 },
            { x: 850, y: 100, width: 350, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 250, y: 500, width: 100, height: 30, startX: 200, endX: 400, speed: 2.5 },
            { x: 350, y: 360, width: 80, height: 30, startY: 300, endY: 420, speed: 2, vertical: true },
            { x: 350, y: 220, width: 80, height: 30, startX: 280, endX: 450, speed: 2 },
            { x: 550, y: 180, width: 80, height: 30, startY: 120, endY: 230, speed: 1.5, vertical: true },
            { x: 700, y: 180, width: 80, height: 30, startX: 650, endX: 800, speed: 3 }
        ],
        spikes: [
            { x: 160, y: 555, width: 80, height: 15 },
            { x: 640, y: 415, width: 60, height: 15 },
            { x: 240, y: 275, width: 50, height: 15 }
        ]
    },
    10: {
        platforms: [
            { x: 0, y: 570, width: 120, height: 30 },
            { x: 1050, y: 50, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 180, y: 520, width: 80, height: 30, startX: 150, endX: 300, speed: 3 },
            { x: 380, y: 450, width: 80, height: 30, startY: 380, endY: 500, speed: 2.5, vertical: true },
            { x: 550, y: 380, width: 80, height: 30, startX: 480, endX: 650, speed: 3.5 },
            { x: 700, y: 300, width: 80, height: 30, startY: 230, endY: 370, speed: 2, vertical: true },
            { x: 550, y: 220, width: 80, height: 30, startX: 480, endX: 650, speed: 3 },
            { x: 380, y: 150, width: 80, height: 30, startX: 300, endX: 460, speed: 3.5 },
            { x: 600, y: 100, width: 80, height: 30, startY: 50, endY: 150, speed: 2, vertical: true },
            { x: 850, y: 80, width: 100, height: 30, startX: 780, endX: 950, speed: 4 }
        ],
        spikes: [
            { x: 130, y: 555, width: 40, height: 15 },
            { x: 310, y: 555, width: 60, height: 15 },
            { x: 660, y: 505, width: 60, height: 15 },
            { x: 470, y: 135, width: 50, height: 15 },
            { x: 960, y: 35, width: 80, height: 15 }
        ]
    },
    11: {
        platforms: [
            { x: 0, y: 570, width: 180, height: 30 },
            { x: 350, y: 480, width: 100, height: 30 },
            { x: 600, y: 380, width: 100, height: 30 },
            { x: 200, y: 280, width: 100, height: 30 },
            { x: 900, y: 120, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 500, y: 250, width: 90, height: 30, startX: 400, endX: 600, speed: 2.5 },
            { x: 700, y: 200, width: 90, height: 30, startY: 130, endY: 280, speed: 2, vertical: true }
        ],
        spikes: [
            { x: 190, y: 555, width: 80, height: 15 },
            { x: 710, y: 365, width: 60, height: 15 }
        ]
    },
    12: {
        platforms: [
            { x: 0, y: 570, width: 150, height: 30 },
            { x: 400, y: 500, width: 80, height: 30 },
            { x: 700, y: 420, width: 80, height: 30 },
            { x: 300, y: 300, width: 80, height: 30 },
            { x: 600, y: 200, width: 80, height: 30 },
            { x: 950, y: 80, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 200, y: 480, width: 80, height: 30, startX: 150, endX: 330, speed: 2.5 },
            { x: 550, y: 350, width: 80, height: 30, startY: 280, endY: 420, speed: 2, vertical: true },
            { x: 780, y: 140, width: 80, height: 30, startX: 700, endX: 880, speed: 3 }
        ],
        spikes: [
            { x: 490, y: 485, width: 50, height: 15 },
            { x: 790, y: 405, width: 50, height: 15 }
        ]
    },
    13: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 250, y: 450, width: 100, height: 30 },
            { x: 550, y: 350, width: 100, height: 30 },
            { x: 800, y: 250, width: 80, height: 30 },
            { x: 1000, y: 100, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 130, y: 520, width: 80, height: 30, startX: 100, endX: 220, speed: 3 },
            { x: 400, y: 400, width: 80, height: 30, startY: 330, endY: 450, speed: 2.5, vertical: true },
            { x: 680, y: 300, width: 80, height: 30, startX: 620, endX: 750, speed: 3 },
            { x: 900, y: 170, width: 80, height: 30, startY: 100, endY: 230, speed: 2, vertical: true }
        ],
        spikes: [
            { x: 360, y: 435, width: 50, height: 15 },
            { x: 660, y: 335, width: 50, height: 15 },
            { x: 890, y: 235, width: 50, height: 15 }
        ]
    },
    14: {
        platforms: [
            { x: 0, y: 570, width: 130, height: 30 },
            { x: 500, y: 400, width: 70, height: 30 },
            { x: 200, y: 250, width: 70, height: 30 },
            { x: 900, y: 80, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 250, y: 500, width: 80, height: 30, startX: 180, endX: 380, speed: 3 },
            { x: 350, y: 350, width: 70, height: 30, startX: 300, endX: 450, speed: 2.5 },
            { x: 550, y: 250, width: 70, height: 30, startY: 180, endY: 330, speed: 2, vertical: true },
            { x: 700, y: 150, width: 80, height: 30, startX: 600, endX: 800, speed: 3.5 }
        ],
        spikes: [
            { x: 140, y: 555, width: 60, height: 15 },
            { x: 580, y: 385, width: 50, height: 15 },
            { x: 280, y: 235, width: 50, height: 15 }
        ]
    },
    15: {
        platforms: [
            { x: 0, y: 570, width: 120, height: 30 },
            { x: 350, y: 520, width: 70, height: 30 },
            { x: 650, y: 440, width: 70, height: 30 },
            { x: 350, y: 330, width: 70, height: 30 },
            { x: 650, y: 220, width: 70, height: 30 },
            { x: 950, y: 100, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 170, y: 540, width: 80, height: 30, startX: 130, endX: 280, speed: 3 },
            { x: 500, y: 480, width: 70, height: 30, startY: 420, endY: 530, speed: 2.5, vertical: true },
            { x: 500, y: 280, width: 70, height: 30, startX: 420, endX: 580, speed: 3 },
            { x: 800, y: 160, width: 80, height: 30, startY: 100, endY: 220, speed: 2, vertical: true }
        ],
        spikes: [
            { x: 430, y: 505, width: 50, height: 15 },
            { x: 730, y: 425, width: 50, height: 15 },
            { x: 430, y: 315, width: 50, height: 15 }
        ]
    },
    16: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 600, y: 470, width: 80, height: 30 },
            { x: 250, y: 350, width: 80, height: 30 },
            { x: 700, y: 200, width: 80, height: 30 },
            { x: 1000, y: 70, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 200, y: 520, width: 70, height: 30, startX: 130, endX: 350, speed: 3 },
            { x: 400, y: 420, width: 70, height: 30, startY: 350, endY: 480, speed: 2.5, vertical: true },
            { x: 450, y: 270, width: 70, height: 30, startX: 350, endX: 550, speed: 3.5 },
            { x: 550, y: 150, width: 70, height: 30, startY: 80, endY: 200, speed: 2, vertical: true },
            { x: 850, y: 130, width: 80, height: 30, startX: 780, endX: 940, speed: 3 }
        ],
        spikes: [
            { x: 110, y: 555, width: 50, height: 15 },
            { x: 690, y: 455, width: 60, height: 15 },
            { x: 340, y: 335, width: 50, height: 15 }
        ]
    },
    17: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 300, y: 500, width: 60, height: 30 },
            { x: 550, y: 420, width: 60, height: 30 },
            { x: 800, y: 340, width: 60, height: 30 },
            { x: 550, y: 220, width: 60, height: 30 },
            { x: 200, y: 130, width: 60, height: 30 },
            { x: 900, y: 60, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 540, width: 70, height: 30, startX: 110, endX: 240, speed: 3 },
            { x: 420, y: 460, width: 70, height: 30, startY: 400, endY: 500, speed: 2.5, vertical: true },
            { x: 680, y: 380, width: 70, height: 30, startX: 620, endX: 750, speed: 3.5 },
            { x: 400, y: 170, width: 60, height: 30, startX: 300, endX: 500, speed: 3 },
            { x: 650, y: 100, width: 70, height: 30, startX: 550, endX: 800, speed: 3.5 }
        ],
        spikes: [
            { x: 370, y: 485, width: 50, height: 15 },
            { x: 620, y: 405, width: 50, height: 15 },
            { x: 870, y: 325, width: 50, height: 15 }
        ]
    },
    18: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 400, y: 480, width: 70, height: 30 },
            { x: 800, y: 380, width: 70, height: 30 },
            { x: 1050, y: 250, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 180, y: 530, width: 70, height: 30, startX: 120, endX: 300, speed: 3.5 },
            { x: 550, y: 430, width: 70, height: 30, startY: 370, endY: 490, speed: 2.5, vertical: true },
            { x: 600, y: 330, width: 70, height: 30, startX: 520, endX: 720, speed: 3 },
            { x: 900, y: 310, width: 70, height: 30, startY: 250, endY: 380, speed: 2, vertical: true }
        ],
        spikes: [
            { x: 110, y: 555, width: 60, height: 15 },
            { x: 480, y: 465, width: 60, height: 15 },
            { x: 880, y: 365, width: 60, height: 15 }
        ]
    },
    19: {
        platforms: [
            { x: 0, y: 570, width: 110, height: 30 },
            { x: 350, y: 480, width: 60, height: 30 },
            { x: 100, y: 350, width: 60, height: 30 },
            { x: 500, y: 250, width: 60, height: 30 },
            { x: 900, y: 100, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 200, y: 530, width: 70, height: 30, startX: 130, endX: 300, speed: 3 },
            { x: 230, y: 420, width: 60, height: 30, startY: 350, endY: 480, speed: 2.5, vertical: true },
            { x: 300, y: 300, width: 60, height: 30, startX: 200, endX: 420, speed: 3 },
            { x: 650, y: 200, width: 70, height: 30, startX: 580, endX: 750, speed: 3.5 },
            { x: 800, y: 150, width: 60, height: 30, startY: 100, endY: 200, speed: 2, vertical: true }
        ],
        spikes: [
            { x: 120, y: 555, width: 50, height: 15 },
            { x: 420, y: 465, width: 50, height: 15 },
            { x: 170, y: 335, width: 50, height: 15 },
            { x: 570, y: 235, width: 50, height: 15 }
        ]
    },
    20: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 1050, y: 50, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 160, y: 520, width: 70, height: 30, startX: 120, endX: 280, speed: 3 },
            { x: 350, y: 450, width: 70, height: 30, startY: 380, endY: 500, speed: 2.5, vertical: true },
            { x: 500, y: 370, width: 70, height: 30, startX: 420, endX: 600, speed: 3.5 },
            { x: 650, y: 290, width: 70, height: 30, startY: 220, endY: 350, speed: 2, vertical: true },
            { x: 500, y: 200, width: 70, height: 30, startX: 400, endX: 600, speed: 3 },
            { x: 350, y: 130, width: 70, height: 30, startX: 280, endX: 440, speed: 3.5 },
            { x: 600, y: 80, width: 70, height: 30, startY: 40, endY: 130, speed: 2, vertical: true },
            { x: 830, y: 70, width: 90, height: 30, startX: 760, endX: 940, speed: 4 }
        ],
        spikes: [
            { x: 110, y: 555, width: 40, height: 15 },
            { x: 290, y: 555, width: 50, height: 15 },
            { x: 610, y: 455, width: 50, height: 15 },
            { x: 440, y: 115, width: 50, height: 15 },
            { x: 950, y: 35, width: 80, height: 15 }
        ]
    },
    21: {
        platforms: [
            { x: 0, y: 570, width: 150, height: 30 },
            { x: 400, y: 450, width: 80, height: 30 },
            { x: 100, y: 300, width: 80, height: 30 },
            { x: 600, y: 200, width: 80, height: 30 },
            { x: 950, y: 90, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 250, y: 510, width: 70, height: 30, startX: 170, endX: 350, speed: 3 },
            { x: 300, y: 380, width: 70, height: 30, startY: 300, endY: 440, speed: 2.5, vertical: true },
            { x: 350, y: 250, width: 70, height: 30, startX: 250, endX: 480, speed: 3 },
            { x: 780, y: 150, width: 70, height: 30, startY: 90, endY: 200, speed: 2.5, vertical: true }
        ],
        spikes: [
            { x: 160, y: 555, width: 70, height: 15 },
            { x: 490, y: 435, width: 50, height: 15 },
            { x: 190, y: 285, width: 50, height: 15 }
        ]
    },
    22: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 300, y: 520, width: 60, height: 30 },
            { x: 600, y: 450, width: 60, height: 30 },
            { x: 900, y: 380, width: 60, height: 30 },
            { x: 600, y: 280, width: 60, height: 30 },
            { x: 300, y: 180, width: 60, height: 30 },
            { x: 900, y: 80, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 550, width: 70, height: 30, startX: 110, endX: 250, speed: 3.5 },
            { x: 450, y: 490, width: 60, height: 30, startY: 430, endY: 530, speed: 2.5, vertical: true },
            { x: 750, y: 420, width: 60, height: 30, startX: 680, endX: 850, speed: 3 },
            { x: 750, y: 330, width: 60, height: 30, startY: 260, endY: 380, speed: 2, vertical: true },
            { x: 450, y: 230, width: 60, height: 30, startX: 370, endX: 550, speed: 3 },
            { x: 600, y: 130, width: 70, height: 30, startX: 500, endX: 750, speed: 3.5 }
        ],
        spikes: [
            { x: 370, y: 505, width: 40, height: 15 },
            { x: 670, y: 435, width: 40, height: 15 },
            { x: 970, y: 365, width: 40, height: 15 },
            { x: 670, y: 265, width: 40, height: 15 }
        ]
    },
    23: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 500, y: 400, width: 60, height: 30 },
            { x: 1000, y: 200, width: 60, height: 30 },
            { x: 1050, y: 60, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 180, y: 520, width: 70, height: 30, startX: 120, endX: 320, speed: 3.5 },
            { x: 350, y: 460, width: 60, height: 30, startY: 380, endY: 520, speed: 2.5, vertical: true },
            { x: 650, y: 350, width: 60, height: 30, startX: 570, endX: 750, speed: 3 },
            { x: 800, y: 280, width: 60, height: 30, startY: 200, endY: 350, speed: 2.5, vertical: true },
            { x: 850, y: 130, width: 70, height: 30, startX: 750, endX: 960, speed: 3.5 }
        ],
        spikes: [
            { x: 110, y: 555, width: 50, height: 15 },
            { x: 570, y: 385, width: 50, height: 15 },
            { x: 1070, y: 185, width: 50, height: 15 }
        ]
    },
    24: {
        platforms: [
            { x: 0, y: 570, width: 90, height: 30 },
            { x: 250, y: 490, width: 70, height: 30 },
            { x: 550, y: 390, width: 70, height: 30 },
            { x: 250, y: 270, width: 70, height: 30 },
            { x: 550, y: 160, width: 70, height: 30 },
            { x: 900, y: 60, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 540, width: 60, height: 30, startX: 90, endX: 200, speed: 3 },
            { x: 400, y: 440, width: 60, height: 30, startY: 370, endY: 490, speed: 2.5, vertical: true },
            { x: 400, y: 330, width: 60, height: 30, startX: 320, endX: 480, speed: 3.5 },
            { x: 400, y: 210, width: 60, height: 30, startY: 150, endY: 270, speed: 2, vertical: true },
            { x: 720, y: 110, width: 70, height: 30, startX: 630, endX: 830, speed: 3.5 }
        ],
        spikes: [
            { x: 100, y: 555, width: 50, height: 15 },
            { x: 330, y: 475, width: 45, height: 15 },
            { x: 630, y: 375, width: 45, height: 15 },
            { x: 330, y: 255, width: 45, height: 15 }
        ]
    },
    25: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 1050, y: 40, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 520, width: 65, height: 30, startX: 100, endX: 260, speed: 3.5 },
            { x: 320, y: 450, width: 65, height: 30, startY: 380, endY: 510, speed: 3, vertical: true },
            { x: 480, y: 380, width: 65, height: 30, startX: 400, endX: 580, speed: 4 },
            { x: 640, y: 300, width: 65, height: 30, startY: 230, endY: 360, speed: 2.5, vertical: true },
            { x: 480, y: 220, width: 65, height: 30, startX: 380, endX: 580, speed: 3.5 },
            { x: 320, y: 140, width: 65, height: 30, startX: 240, endX: 400, speed: 4 },
            { x: 580, y: 80, width: 65, height: 30, startY: 40, endY: 130, speed: 2.5, vertical: true },
            { x: 800, y: 60, width: 80, height: 30, startX: 720, endX: 950, speed: 4.5 }
        ],
        spikes: [
            { x: 90, y: 555, width: 50, height: 15 },
            { x: 270, y: 555, width: 40, height: 15 },
            { x: 590, y: 505, width: 40, height: 15 },
            { x: 410, y: 125, width: 50, height: 15 },
            { x: 960, y: 25, width: 70, height: 15 }
        ]
    },
    26: {
        platforms: [
            { x: 0, y: 570, width: 100, height: 30 },
            { x: 350, y: 470, width: 70, height: 30 },
            { x: 700, y: 370, width: 70, height: 30 },
            { x: 350, y: 250, width: 70, height: 30 },
            { x: 950, y: 100, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 170, y: 520, width: 70, height: 30, startX: 120, endX: 280, speed: 3.5 },
            { x: 520, y: 420, width: 70, height: 30, startY: 350, endY: 470, speed: 3, vertical: true },
            { x: 550, y: 310, width: 60, height: 30, startX: 450, endX: 650, speed: 3.5 },
            { x: 600, y: 180, width: 70, height: 30, startX: 480, endX: 700, speed: 3 },
            { x: 800, y: 140, width: 60, height: 30, startY: 90, endY: 200, speed: 2.5, vertical: true }
        ],
        spikes: [
            { x: 110, y: 555, width: 50, height: 15 },
            { x: 430, y: 455, width: 50, height: 15 },
            { x: 780, y: 355, width: 50, height: 15 },
            { x: 430, y: 235, width: 50, height: 15 }
        ]
    },
    27: {
        platforms: [
            { x: 0, y: 570, width: 90, height: 30 },
            { x: 400, y: 500, width: 60, height: 30 },
            { x: 200, y: 400, width: 60, height: 30 },
            { x: 700, y: 300, width: 60, height: 30 },
            { x: 400, y: 180, width: 60, height: 30 },
            { x: 1000, y: 70, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 200, y: 540, width: 65, height: 30, startX: 120, endX: 320, speed: 3.5 },
            { x: 300, y: 450, width: 60, height: 30, startY: 380, endY: 500, speed: 3, vertical: true },
            { x: 450, y: 350, width: 60, height: 30, startX: 350, endX: 580, speed: 3 },
            { x: 550, y: 240, width: 60, height: 30, startY: 170, endY: 300, speed: 2.5, vertical: true },
            { x: 700, y: 130, width: 70, height: 30, startX: 600, endX: 850, speed: 4 }
        ],
        spikes: [
            { x: 100, y: 555, width: 60, height: 15 },
            { x: 470, y: 485, width: 40, height: 15 },
            { x: 270, y: 385, width: 40, height: 15 },
            { x: 770, y: 285, width: 40, height: 15 }
        ]
    },
    28: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 350, y: 450, width: 60, height: 30 },
            { x: 700, y: 350, width: 60, height: 30 },
            { x: 1050, y: 200, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 130, y: 520, width: 65, height: 30, startX: 90, endX: 250, speed: 3.5 },
            { x: 500, y: 400, width: 60, height: 30, startY: 340, endY: 450, speed: 3, vertical: true },
            { x: 550, y: 300, width: 60, height: 30, startX: 450, endX: 650, speed: 4 },
            { x: 850, y: 280, width: 60, height: 30, startY: 200, endY: 350, speed: 2.5, vertical: true },
            { x: 950, y: 250, width: 60, height: 30, startX: 880, endX: 1020, speed: 3.5 }
        ],
        spikes: [
            { x: 90, y: 555, width: 50, height: 15 },
            { x: 420, y: 435, width: 50, height: 15 },
            { x: 770, y: 335, width: 50, height: 15 }
        ]
    },
    29: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 250, y: 480, width: 55, height: 30 },
            { x: 550, y: 380, width: 55, height: 30 },
            { x: 250, y: 280, width: 55, height: 30 },
            { x: 550, y: 180, width: 55, height: 30 },
            { x: 900, y: 60, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 530, width: 60, height: 30, startX: 80, endX: 200, speed: 3.5 },
            { x: 400, y: 430, width: 55, height: 30, startY: 370, endY: 480, speed: 3, vertical: true },
            { x: 400, y: 330, width: 55, height: 30, startX: 330, endX: 480, speed: 3.5 },
            { x: 400, y: 230, width: 55, height: 30, startY: 170, endY: 280, speed: 2.5, vertical: true },
            { x: 720, y: 120, width: 65, height: 30, startX: 630, endX: 830, speed: 4 }
        ],
        spikes: [
            { x: 90, y: 555, width: 50, height: 15 },
            { x: 315, y: 465, width: 40, height: 15 },
            { x: 615, y: 365, width: 40, height: 15 },
            { x: 315, y: 265, width: 40, height: 15 },
            { x: 615, y: 165, width: 40, height: 15 }
        ]
    },
    30: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 1050, y: 40, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 140, y: 520, width: 60, height: 30, startX: 100, endX: 250, speed: 4 },
            { x: 300, y: 450, width: 60, height: 30, startY: 380, endY: 500, speed: 3, vertical: true },
            { x: 460, y: 370, width: 60, height: 30, startX: 380, endX: 560, speed: 4 },
            { x: 620, y: 290, width: 60, height: 30, startY: 220, endY: 350, speed: 3, vertical: true },
            { x: 460, y: 210, width: 60, height: 30, startX: 360, endX: 560, speed: 4.5 },
            { x: 300, y: 130, width: 60, height: 30, startX: 220, endX: 380, speed: 4 },
            { x: 560, y: 70, width: 60, height: 30, startY: 30, endY: 120, speed: 2.5, vertical: true },
            { x: 780, y: 55, width: 80, height: 30, startX: 700, endX: 940, speed: 4.5 }
        ],
        spikes: [
            { x: 90, y: 555, width: 40, height: 15 },
            { x: 260, y: 555, width: 30, height: 15 },
            { x: 570, y: 455, width: 40, height: 15 },
            { x: 390, y: 115, width: 50, height: 15 },
            { x: 950, y: 25, width: 80, height: 15 }
        ]
    },
    31: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 300, y: 500, width: 55, height: 30 },
            { x: 600, y: 400, width: 55, height: 30 },
            { x: 900, y: 300, width: 55, height: 30 },
            { x: 600, y: 180, width: 55, height: 30 },
            { x: 950, y: 70, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 540, width: 60, height: 30, startX: 100, endX: 240, speed: 3.5 },
            { x: 450, y: 450, width: 55, height: 30, startY: 390, endY: 500, speed: 3, vertical: true },
            { x: 750, y: 350, width: 55, height: 30, startX: 680, endX: 850, speed: 3.5 },
            { x: 750, y: 240, width: 55, height: 30, startY: 170, endY: 300, speed: 2.5, vertical: true },
            { x: 800, y: 120, width: 60, height: 30, startX: 700, endX: 900, speed: 4 }
        ],
        spikes: [
            { x: 90, y: 555, width: 50, height: 15 },
            { x: 365, y: 485, width: 40, height: 15 },
            { x: 665, y: 385, width: 40, height: 15 },
            { x: 965, y: 285, width: 40, height: 15 }
        ]
    },
    32: {
        platforms: [
            { x: 0, y: 570, width: 80, height: 30 },
            { x: 500, y: 450, width: 50, height: 30 },
            { x: 150, y: 300, width: 50, height: 30 },
            { x: 700, y: 180, width: 50, height: 30 },
            { x: 1000, y: 60, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 200, y: 520, width: 60, height: 30, startX: 120, endX: 350, speed: 4 },
            { x: 350, y: 400, width: 55, height: 30, startY: 330, endY: 450, speed: 3, vertical: true },
            { x: 300, y: 250, width: 55, height: 30, startX: 200, endX: 450, speed: 3.5 },
            { x: 500, y: 190, width: 55, height: 30, startY: 130, endY: 250, speed: 2.5, vertical: true },
            { x: 850, y: 120, width: 60, height: 30, startX: 770, endX: 950, speed: 4 }
        ],
        spikes: [
            { x: 90, y: 555, width: 50, height: 15 },
            { x: 560, y: 435, width: 50, height: 15 },
            { x: 210, y: 285, width: 50, height: 15 },
            { x: 760, y: 165, width: 50, height: 15 }
        ]
    },
    33: {
        platforms: [
            { x: 0, y: 570, width: 70, height: 30 },
            { x: 300, y: 470, width: 50, height: 30 },
            { x: 600, y: 370, width: 50, height: 30 },
            { x: 300, y: 250, width: 50, height: 30 },
            { x: 600, y: 140, width: 50, height: 30 },
            { x: 900, y: 50, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 130, y: 520, width: 55, height: 30, startX: 80, endX: 220, speed: 4 },
            { x: 450, y: 420, width: 50, height: 30, startY: 360, endY: 470, speed: 3, vertical: true },
            { x: 450, y: 310, width: 50, height: 30, startX: 370, endX: 540, speed: 4 },
            { x: 450, y: 200, width: 50, height: 30, startY: 130, endY: 250, speed: 2.5, vertical: true },
            { x: 750, y: 100, width: 60, height: 30, startX: 670, endX: 850, speed: 4.5 }
        ],
        spikes: [
            { x: 80, y: 555, width: 50, height: 15 },
            { x: 360, y: 455, width: 40, height: 15 },
            { x: 660, y: 355, width: 40, height: 15 },
            { x: 360, y: 235, width: 40, height: 15 },
            { x: 660, y: 125, width: 40, height: 15 }
        ]
    },
    34: {
        platforms: [
            { x: 0, y: 570, width: 70, height: 30 },
            { x: 400, y: 430, width: 50, height: 30 },
            { x: 800, y: 280, width: 50, height: 30 },
            { x: 1050, y: 100, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 510, width: 55, height: 30, startX: 90, endX: 280, speed: 4 },
            { x: 280, y: 470, width: 50, height: 30, startY: 410, endY: 520, speed: 3, vertical: true },
            { x: 550, y: 360, width: 55, height: 30, startX: 460, endX: 670, speed: 4 },
            { x: 650, y: 320, width: 50, height: 30, startY: 260, endY: 380, speed: 3, vertical: true },
            { x: 900, y: 200, width: 55, height: 30, startX: 830, endX: 1000, speed: 4 },
            { x: 950, y: 150, width: 50, height: 30, startY: 100, endY: 200, speed: 2.5, vertical: true }
        ],
        spikes: [
            { x: 80, y: 555, width: 50, height: 15 },
            { x: 460, y: 415, width: 40, height: 15 },
            { x: 860, y: 265, width: 40, height: 15 }
        ]
    },
    35: {
        platforms: [
            { x: 0, y: 570, width: 70, height: 30 },
            { x: 250, y: 490, width: 50, height: 30 },
            { x: 550, y: 410, width: 50, height: 30 },
            { x: 850, y: 310, width: 50, height: 30 },
            { x: 550, y: 200, width: 50, height: 30 },
            { x: 200, y: 100, width: 50, height: 30 },
            { x: 950, y: 50, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 540, width: 55, height: 30, startX: 80, endX: 200, speed: 4 },
            { x: 400, y: 450, width: 50, height: 30, startY: 400, endY: 490, speed: 3, vertical: true },
            { x: 700, y: 360, width: 50, height: 30, startX: 630, endX: 800, speed: 4 },
            { x: 700, y: 260, width: 50, height: 30, startY: 190, endY: 310, speed: 2.5, vertical: true },
            { x: 350, y: 150, width: 50, height: 30, startX: 270, endX: 450, speed: 4 },
            { x: 550, y: 80, width: 60, height: 30, startX: 450, endX: 700, speed: 4.5 }
        ],
        spikes: [
            { x: 80, y: 555, width: 50, height: 15 },
            { x: 310, y: 475, width: 40, height: 15 },
            { x: 610, y: 395, width: 40, height: 15 },
            { x: 910, y: 295, width: 40, height: 15 },
            { x: 260, y: 85, width: 40, height: 15 }
        ]
    },
    36: {
        platforms: [
            { x: 0, y: 570, width: 70, height: 30 },
            { x: 400, y: 400, width: 50, height: 30 },
            { x: 100, y: 250, width: 50, height: 30 },
            { x: 1050, y: 80, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 500, width: 55, height: 30, startX: 90, endX: 280, speed: 4 },
            { x: 250, y: 450, width: 50, height: 30, startY: 380, endY: 500, speed: 3, vertical: true },
            { x: 250, y: 330, width: 50, height: 30, startX: 150, endX: 370, speed: 4 },
            { x: 350, y: 200, width: 50, height: 30, startY: 140, endY: 260, speed: 2.5, vertical: true },
            { x: 550, y: 170, width: 55, height: 30, startX: 450, endX: 680, speed: 4.5 },
            { x: 800, y: 120, width: 55, height: 30, startX: 720, endX: 920, speed: 4 }
        ],
        spikes: [
            { x: 80, y: 555, width: 50, height: 15 },
            { x: 460, y: 385, width: 50, height: 15 },
            { x: 160, y: 235, width: 50, height: 15 }
        ]
    },
    37: {
        platforms: [
            { x: 0, y: 570, width: 60, height: 30 },
            { x: 300, y: 480, width: 50, height: 30 },
            { x: 650, y: 380, width: 50, height: 30 },
            { x: 300, y: 260, width: 50, height: 30 },
            { x: 700, y: 140, width: 50, height: 30 },
            { x: 1000, y: 50, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 530, width: 55, height: 30, startX: 70, endX: 230, speed: 4 },
            { x: 470, y: 430, width: 50, height: 30, startY: 370, endY: 480, speed: 3.5, vertical: true },
            { x: 480, y: 320, width: 50, height: 30, startX: 370, endX: 580, speed: 4 },
            { x: 500, y: 200, width: 50, height: 30, startY: 130, endY: 260, speed: 3, vertical: true },
            { x: 850, y: 100, width: 55, height: 30, startX: 770, endX: 940, speed: 4.5 }
        ],
        spikes: [
            { x: 70, y: 555, width: 50, height: 15 },
            { x: 360, y: 465, width: 40, height: 15 },
            { x: 710, y: 365, width: 40, height: 15 },
            { x: 360, y: 245, width: 40, height: 15 },
            { x: 760, y: 125, width: 40, height: 15 }
        ]
    },
    38: {
        platforms: [
            { x: 0, y: 570, width: 60, height: 30 },
            { x: 500, y: 450, width: 45, height: 30 },
            { x: 200, y: 320, width: 45, height: 30 },
            { x: 800, y: 200, width: 45, height: 30 },
            { x: 1050, y: 70, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 180, y: 520, width: 55, height: 30, startX: 100, endX: 320, speed: 4 },
            { x: 350, y: 400, width: 50, height: 30, startY: 330, endY: 450, speed: 3.5, vertical: true },
            { x: 400, y: 270, width: 50, height: 30, startX: 280, endX: 530, speed: 4 },
            { x: 600, y: 200, width: 50, height: 30, startY: 130, endY: 260, speed: 3, vertical: true },
            { x: 900, y: 130, width: 55, height: 30, startX: 830, endX: 1000, speed: 4.5 }
        ],
        spikes: [
            { x: 70, y: 555, width: 50, height: 15 },
            { x: 555, y: 435, width: 40, height: 15 },
            { x: 255, y: 305, width: 40, height: 15 },
            { x: 855, y: 185, width: 40, height: 15 }
        ]
    },
    39: {
        platforms: [
            { x: 0, y: 570, width: 60, height: 30 },
            { x: 250, y: 500, width: 45, height: 30 },
            { x: 550, y: 420, width: 45, height: 30 },
            { x: 250, y: 320, width: 45, height: 30 },
            { x: 550, y: 220, width: 45, height: 30 },
            { x: 250, y: 120, width: 45, height: 30 },
            { x: 900, y: 50, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 110, y: 540, width: 55, height: 30, startX: 70, endX: 200, speed: 4 },
            { x: 400, y: 460, width: 45, height: 30, startY: 410, endY: 500, speed: 3.5, vertical: true },
            { x: 400, y: 370, width: 45, height: 30, startX: 330, endX: 480, speed: 4 },
            { x: 400, y: 270, width: 45, height: 30, startY: 210, endY: 320, speed: 3, vertical: true },
            { x: 400, y: 170, width: 45, height: 30, startX: 320, endX: 480, speed: 4.5 },
            { x: 600, y: 80, width: 55, height: 30, startX: 500, endX: 750, speed: 4.5 }
        ],
        spikes: [
            { x: 70, y: 555, width: 50, height: 15 },
            { x: 305, y: 485, width: 35, height: 15 },
            { x: 605, y: 405, width: 35, height: 15 },
            { x: 305, y: 305, width: 35, height: 15 },
            { x: 605, y: 205, width: 35, height: 15 },
            { x: 305, y: 105, width: 35, height: 15 }
        ]
    },
    40: {
        platforms: [
            { x: 0, y: 570, width: 60, height: 30 },
            { x: 1050, y: 40, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 520, width: 55, height: 30, startX: 80, endX: 230, speed: 4.5 },
            { x: 280, y: 450, width: 55, height: 30, startY: 380, endY: 500, speed: 3.5, vertical: true },
            { x: 440, y: 370, width: 55, height: 30, startX: 360, endX: 540, speed: 4.5 },
            { x: 600, y: 290, width: 55, height: 30, startY: 220, endY: 350, speed: 3, vertical: true },
            { x: 440, y: 210, width: 55, height: 30, startX: 340, endX: 540, speed: 5 },
            { x: 280, y: 140, width: 55, height: 30, startX: 200, endX: 360, speed: 4.5 },
            { x: 540, y: 70, width: 55, height: 30, startY: 30, endY: 120, speed: 3, vertical: true },
            { x: 760, y: 50, width: 70, height: 30, startX: 680, endX: 920, speed: 5 }
        ],
        spikes: [
            { x: 70, y: 555, width: 40, height: 15 },
            { x: 240, y: 555, width: 30, height: 15 },
            { x: 550, y: 455, width: 40, height: 15 },
            { x: 370, y: 125, width: 50, height: 15 },
            { x: 930, y: 25, width: 80, height: 15 }
        ]
    },
    41: {
        platforms: [
            { x: 0, y: 570, width: 60, height: 30 },
            { x: 350, y: 470, width: 45, height: 30 },
            { x: 700, y: 350, width: 45, height: 30 },
            { x: 350, y: 220, width: 45, height: 30 },
            { x: 950, y: 80, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 140, y: 520, width: 55, height: 30, startX: 80, endX: 260, speed: 4.5 },
            { x: 520, y: 410, width: 50, height: 30, startY: 340, endY: 470, speed: 3.5, vertical: true },
            { x: 520, y: 290, width: 50, height: 30, startX: 420, endX: 640, speed: 4 },
            { x: 600, y: 160, width: 55, height: 30, startX: 480, endX: 720, speed: 4.5 },
            { x: 800, y: 120, width: 50, height: 30, startY: 70, endY: 180, speed: 3, vertical: true }
        ],
        spikes: [
            { x: 70, y: 555, width: 50, height: 15 },
            { x: 405, y: 455, width: 40, height: 15 },
            { x: 755, y: 335, width: 40, height: 15 },
            { x: 405, y: 205, width: 40, height: 15 }
        ]
    },
    42: {
        platforms: [
            { x: 0, y: 570, width: 55, height: 30 },
            { x: 300, y: 490, width: 45, height: 30 },
            { x: 600, y: 400, width: 45, height: 30 },
            { x: 900, y: 300, width: 45, height: 30 },
            { x: 600, y: 180, width: 45, height: 30 },
            { x: 950, y: 60, width: 250, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 120, y: 540, width: 55, height: 30, startX: 70, endX: 230, speed: 4.5 },
            { x: 450, y: 450, width: 45, height: 30, startY: 390, endY: 490, speed: 3.5, vertical: true },
            { x: 750, y: 350, width: 45, height: 30, startX: 670, endX: 850, speed: 4 },
            { x: 750, y: 240, width: 45, height: 30, startY: 170, endY: 300, speed: 3, vertical: true },
            { x: 780, y: 110, width: 55, height: 30, startX: 680, endX: 900, speed: 4.5 }
        ],
        spikes: [
            { x: 65, y: 555, width: 50, height: 15 },
            { x: 355, y: 475, width: 35, height: 15 },
            { x: 655, y: 385, width: 35, height: 15 },
            { x: 955, y: 285, width: 35, height: 15 },
            { x: 655, y: 165, width: 35, height: 15 }
        ]
    },
    43: {
        platforms: [
            { x: 0, y: 570, width: 55, height: 30 },
            { x: 400, y: 430, width: 45, height: 30 },
            { x: 100, y: 280, width: 45, height: 30 },
            { x: 700, y: 150, width: 45, height: 30 },
            { x: 1050, y: 50, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 160, y: 510, width: 50, height: 30, startX: 80, endX: 300, speed: 4.5 },
            { x: 250, y: 370, width: 45, height: 30, startY: 280, endY: 430, speed: 3.5, vertical: true },
            { x: 350, y: 220, width: 45, height: 30, startX: 200, endX: 500, speed: 4.5 },
            { x: 500, y: 150, width: 45, height: 30, startY: 90, endY: 210, speed: 3, vertical: true },
            { x: 880, y: 100, width: 55, height: 30, startX: 800, endX: 1000, speed: 5 }
        ],
        spikes: [
            { x: 65, y: 555, width: 50, height: 15 },
            { x: 455, y: 415, width: 40, height: 15 },
            { x: 155, y: 265, width: 40, height: 15 },
            { x: 755, y: 135, width: 40, height: 15 }
        ]
    },
    44: {
        platforms: [
            { x: 0, y: 570, width: 55, height: 30 },
            { x: 250, y: 500, width: 40, height: 30 },
            { x: 550, y: 420, width: 40, height: 30 },
            { x: 250, y: 330, width: 40, height: 30 },
            { x: 550, y: 240, width: 40, height: 30 },
            { x: 250, y: 150, width: 40, height: 30 },
            { x: 900, y: 50, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 100, y: 540, width: 50, height: 30, startX: 60, endX: 190, speed: 4.5 },
            { x: 400, y: 460, width: 40, height: 30, startY: 410, endY: 500, speed: 3.5, vertical: true },
            { x: 400, y: 380, width: 40, height: 30, startX: 320, endX: 490, speed: 4.5 },
            { x: 400, y: 290, width: 40, height: 30, startY: 230, endY: 330, speed: 3, vertical: true },
            { x: 400, y: 200, width: 40, height: 30, startX: 310, endX: 480, speed: 5 },
            { x: 600, y: 90, width: 55, height: 30, startX: 470, endX: 750, speed: 5 }
        ],
        spikes: [
            { x: 65, y: 555, width: 50, height: 15 },
            { x: 300, y: 485, width: 35, height: 15 },
            { x: 600, y: 405, width: 35, height: 15 },
            { x: 300, y: 315, width: 35, height: 15 },
            { x: 600, y: 225, width: 35, height: 15 },
            { x: 300, y: 135, width: 35, height: 15 }
        ]
    },
    45: {
        platforms: [
            { x: 0, y: 570, width: 55, height: 30 },
            { x: 1050, y: 40, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 110, y: 520, width: 50, height: 30, startX: 70, endX: 210, speed: 5 },
            { x: 260, y: 450, width: 50, height: 30, startY: 380, endY: 500, speed: 3.5, vertical: true },
            { x: 410, y: 370, width: 50, height: 30, startX: 330, endX: 510, speed: 5 },
            { x: 560, y: 290, width: 50, height: 30, startY: 220, endY: 340, speed: 3.5, vertical: true },
            { x: 410, y: 210, width: 50, height: 30, startX: 310, endX: 510, speed: 5 },
            { x: 260, y: 130, width: 50, height: 30, startX: 180, endX: 350, speed: 5 },
            { x: 520, y: 70, width: 55, height: 30, startY: 30, endY: 110, speed: 3, vertical: true },
            { x: 740, y: 50, width: 65, height: 30, startX: 660, endX: 900, speed: 5.5 }
        ],
        spikes: [
            { x: 65, y: 555, width: 35, height: 15 },
            { x: 220, y: 555, width: 30, height: 15 },
            { x: 520, y: 455, width: 35, height: 15 },
            { x: 350, y: 115, width: 45, height: 15 },
            { x: 920, y: 25, width: 70, height: 15 }
        ]
    },
    46: {
        platforms: [
            { x: 0, y: 570, width: 50, height: 30 },
            { x: 350, y: 470, width: 40, height: 30 },
            { x: 700, y: 370, width: 40, height: 30 },
            { x: 350, y: 250, width: 40, height: 30 },
            { x: 700, y: 130, width: 40, height: 30 },
            { x: 1000, y: 50, width: 200, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 130, y: 520, width: 50, height: 30, startX: 60, endX: 250, speed: 5 },
            { x: 520, y: 420, width: 45, height: 30, startY: 360, endY: 470, speed: 3.5, vertical: true },
            { x: 520, y: 310, width: 45, height: 30, startX: 420, endX: 640, speed: 5 },
            { x: 520, y: 190, width: 45, height: 30, startY: 120, endY: 250, speed: 3, vertical: true },
            { x: 850, y: 90, width: 50, height: 30, startX: 760, endX: 950, speed: 5 }
        ],
        spikes: [
            { x: 60, y: 555, width: 50, height: 15 },
            { x: 400, y: 455, width: 35, height: 15 },
            { x: 750, y: 355, width: 35, height: 15 },
            { x: 400, y: 235, width: 35, height: 15 },
            { x: 750, y: 115, width: 35, height: 15 }
        ]
    },
    47: {
        platforms: [
            { x: 0, y: 570, width: 50, height: 30 },
            { x: 400, y: 450, width: 40, height: 30 },
            { x: 100, y: 300, width: 40, height: 30 },
            { x: 700, y: 170, width: 40, height: 30 },
            { x: 1050, y: 50, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 510, width: 50, height: 30, startX: 70, endX: 300, speed: 5 },
            { x: 250, y: 380, width: 45, height: 30, startY: 290, endY: 440, speed: 3.5, vertical: true },
            { x: 350, y: 240, width: 45, height: 30, startX: 200, endX: 520, speed: 5 },
            { x: 500, y: 160, width: 45, height: 30, startY: 90, endY: 220, speed: 3, vertical: true },
            { x: 880, y: 100, width: 50, height: 30, startX: 790, endX: 1000, speed: 5.5 }
        ],
        spikes: [
            { x: 60, y: 555, width: 50, height: 15 },
            { x: 450, y: 435, width: 40, height: 15 },
            { x: 150, y: 285, width: 40, height: 15 },
            { x: 750, y: 155, width: 40, height: 15 }
        ]
    },
    48: {
        platforms: [
            { x: 0, y: 570, width: 50, height: 30 },
            { x: 300, y: 490, width: 40, height: 30 },
            { x: 600, y: 400, width: 40, height: 30 },
            { x: 300, y: 300, width: 40, height: 30 },
            { x: 600, y: 200, width: 40, height: 30 },
            { x: 300, y: 100, width: 40, height: 30 },
            { x: 900, y: 40, width: 300, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 100, y: 540, width: 50, height: 30, startX: 60, endX: 220, speed: 5 },
            { x: 450, y: 450, width: 40, height: 30, startY: 390, endY: 490, speed: 3.5, vertical: true },
            { x: 450, y: 350, width: 40, height: 30, startX: 370, endX: 540, speed: 5 },
            { x: 450, y: 250, width: 40, height: 30, startY: 190, endY: 300, speed: 3, vertical: true },
            { x: 450, y: 150, width: 40, height: 30, startX: 360, endX: 530, speed: 5.5 },
            { x: 650, y: 70, width: 55, height: 30, startX: 520, endX: 800, speed: 5.5 }
        ],
        spikes: [
            { x: 60, y: 555, width: 50, height: 15 },
            { x: 350, y: 475, width: 30, height: 15 },
            { x: 650, y: 385, width: 30, height: 15 },
            { x: 350, y: 285, width: 30, height: 15 },
            { x: 650, y: 185, width: 30, height: 15 },
            { x: 350, y: 85, width: 30, height: 15 }
        ]
    },
    49: {
        platforms: [
            { x: 0, y: 570, width: 50, height: 30 },
            { x: 400, y: 420, width: 40, height: 30 },
            { x: 100, y: 260, width: 40, height: 30 },
            { x: 800, y: 130, width: 40, height: 30 },
            { x: 1050, y: 40, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 150, y: 500, width: 50, height: 30, startX: 60, endX: 300, speed: 5 },
            { x: 250, y: 350, width: 45, height: 30, startY: 260, endY: 420, speed: 4, vertical: true },
            { x: 350, y: 200, width: 45, height: 30, startX: 180, endX: 530, speed: 5.5 },
            { x: 600, y: 130, width: 45, height: 30, startY: 60, endY: 200, speed: 3, vertical: true },
            { x: 920, y: 80, width: 50, height: 30, startX: 830, endX: 1010, speed: 5.5 }
        ],
        spikes: [
            { x: 60, y: 555, width: 50, height: 15 },
            { x: 450, y: 405, width: 40, height: 15 },
            { x: 150, y: 245, width: 40, height: 15 },
            { x: 850, y: 115, width: 40, height: 15 }
        ]
    },
    50: {
        platforms: [
            { x: 0, y: 570, width: 50, height: 30 },
            { x: 1050, y: 30, width: 150, height: 30, finish: true }
        ],
        movingPlatforms: [
            { x: 100, y: 520, width: 50, height: 30, startX: 60, endX: 200, speed: 5.5 },
            { x: 250, y: 450, width: 50, height: 30, startY: 380, endY: 500, speed: 4, vertical: true },
            { x: 400, y: 370, width: 50, height: 30, startX: 310, endX: 500, speed: 5.5 },
            { x: 550, y: 290, width: 50, height: 30, startY: 220, endY: 340, speed: 3.5, vertical: true },
            { x: 400, y: 210, width: 50, height: 30, startX: 300, endX: 500, speed: 5.5 },
            { x: 250, y: 140, width: 50, height: 30, startX: 170, endX: 340, speed: 5.5 },
            { x: 500, y: 70, width: 50, height: 30, startY: 20, endY: 110, speed: 3.5, vertical: true },
            { x: 720, y: 40, width: 60, height: 30, startX: 640, endX: 900, speed: 6 }
        ],
        spikes: [
            { x: 60, y: 555, width: 30, height: 15 },
            { x: 210, y: 555, width: 30, height: 15 },
            { x: 510, y: 455, width: 30, height: 15 },
            { x: 340, y: 125, width: 40, height: 15 },
            { x: 910, y: 15, width: 70, height: 15 },
            { x: 160, y: 515, width: 30, height: 15 }
        ]
    }
};

let currentPlatforms = [];
let currentMovingPlatforms = [];
let currentSpikes = [];

function applyEasyMode(levelData) {
    if (!EASY_MODE) return levelData;

    const widenedPlatforms = levelData.platforms.map(platform => {
        const newWidth = Math.min(platform.width * 1.35, CANVAS_WIDTH - platform.x);
        return {
            ...platform,
            width: newWidth
        };
    });

    const easedMovingPlatforms = levelData.movingPlatforms.map(platform => {
        const newWidth = Math.min(platform.width * 1.3, CANVAS_WIDTH - platform.x);
        return {
            ...platform,
            width: newWidth,
            speed: Math.max(0.8, platform.speed * 0.6)
        };
    });

    return {
        platforms: widenedPlatforms,
        movingPlatforms: easedMovingPlatforms,
        spikes: []
    };
}

function resetRopeState() {
    ropeState = {
        active: false,
        fromId: null,
        toId: null,
        fromX: 0,
        fromY: 0,
        expiresAt: 0
    };
    ropeGrabbed = false;
}

function setRopeState(data) {
    ropeState = {
        active: true,
        fromId: data.fromId,
        toId: data.toId,
        fromX: data.fromX,
        fromY: data.fromY,
        expiresAt: data.expiresAt
    };
}

function stopFinishSignal() {
    if (finishSignalInterval) {
        clearInterval(finishSignalInterval);
        finishSignalInterval = null;
    }
}

function startFinishSignal() {
    stopFinishSignal();
    finishSignalInterval = setInterval(() => {
        if (!iAmAtFinish || !parkourGameId) return;
        socket.emit('parkourLevelComplete', {
            gameId: parkourGameId,
            level: currentLevel
        });
    }, 1500);
}

function handleRopeAction() {
    if (ropeState.active && ropeState.toId === myPlayerId) {
        ropeGrabbed = true;
        return;
    }
    tryThrowRope();
}

function tryThrowRope() {
    if (!parkourGameId || !parkourPlayers[myPlayerId] || !parkourPlayers[teammateId]) return;
    if (ropeState.active) return; // Don't throw if rope already active

    const me = parkourPlayers[myPlayerId];
    const mate = parkourPlayers[teammateId];
    const dx = Math.abs(mate.x - me.x);
    const dy = Math.abs(mate.y - me.y);

    if (dx <= ROPE_RANGE_X && dy <= ROPE_RANGE_Y) {
        const expiresAt = Date.now() + ROPE_DURATION_MS;
        socket.emit('parkourRope', {
            gameId: parkourGameId,
            fromId: myPlayerId,
            toId: teammateId,
            fromX: me.x + me.width / 2,
            fromY: me.y,
            expiresAt: expiresAt
        });
    }
}

// Setup canvas
function setupCanvas() {
    if (!parkourCanvas) return;
    parkourCanvas.width = CANVAS_WIDTH;
    parkourCanvas.height = CANVAS_HEIGHT;
}

// Initialize level
function initLevel(level) {
    currentLevel = level;
    const levelData = applyEasyMode(levelDefinitions[level] || levelDefinitions[1]);
    currentPlatforms = [...levelData.platforms];
    currentMovingPlatforms = levelData.movingPlatforms.map(mp => ({
        ...mp,
        currentX: mp.x,
        currentY: mp.y,
        direction: 1
    }));
    currentSpikes = [...levelData.spikes];
    parkourLevelEl.textContent = level;
    resetRopeState();
    stopFinishSignal();
    iAmAtFinish = false;
    teammateAtFinish = false;
    
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
    
    const player = parkourPlayers[myPlayerId];
    if (!player || !player.onGround) return false;
    
    // Tolerance-based check: player's feet at or near platform top, horizontally overlapping
    const horizontalOverlap = player.x + player.width > finishPlatform.x && 
                               player.x < finishPlatform.x + finishPlatform.width;
    const feetY = player.y + player.height;
    const verticalOnPlatform = feetY >= finishPlatform.y - 2 && feetY <= finishPlatform.y + finishPlatform.height + 2;
    
    return horizontalOverlap && verticalOnPlatform;
}

// Game loop
function gameLoop() {
    if (!ctx) return;
    
    // Update moving platforms
    currentMovingPlatforms.forEach(mp => {
        if (mp.vertical) {
            mp.currentY += mp.speed * mp.direction;
            if (mp.currentY >= mp.endY || mp.currentY <= mp.startY) {
                mp.direction *= -1;
            }
            mp.y = mp.currentY;
        } else {
            mp.currentX += mp.speed * mp.direction;
            if (mp.currentX >= mp.endX || mp.currentX <= mp.startX) {
                mp.direction *= -1;
            }
            mp.x = mp.currentX;
        }
    });
    
    // Combine static and moving platforms for collision
    const allPlatforms = [...currentPlatforms, ...currentMovingPlatforms];
    
    // Clear canvas
    ctx.fillStyle = '#1a202c';
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    
    // Draw background grid pattern
    ctx.strokeStyle = '#2d3748';
    ctx.lineWidth = 1;
    for (let x = 0; x < CANVAS_WIDTH; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
    }
    for (let y = 0; y < CANVAS_HEIGHT; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
    }
    
    // Draw static platforms
    currentPlatforms.forEach(platform => {
        if (platform.finish) {
            // Animated finish platform
            const gradient = ctx.createLinearGradient(platform.x, platform.y, platform.x + platform.width, platform.y);
            gradient.addColorStop(0, '#48bb78');
            gradient.addColorStop(0.5, '#68d391');
            gradient.addColorStop(1, '#48bb78');
            ctx.fillStyle = gradient;
        } else {
            ctx.fillStyle = '#4a5568';
        }
        ctx.fillRect(platform.x, platform.y, platform.width, platform.height);
        
        // Platform edge highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fillRect(platform.x, platform.y, platform.width, 3);
        
        // Show "FINISH" text on finish platform
        if (platform.finish) {
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('FINISH', platform.x + platform.width / 2, platform.y + 20);
        }
    });
    
    // Draw moving platforms
    currentMovingPlatforms.forEach(mp => {
        const gradient = ctx.createLinearGradient(mp.x, mp.y, mp.x + mp.width, mp.y);
        gradient.addColorStop(0, '#667eea');
        gradient.addColorStop(0.5, '#7c3aed');
        gradient.addColorStop(1, '#667eea');
        ctx.fillStyle = gradient;
        ctx.fillRect(mp.x, mp.y, mp.width, mp.height);
        
        // Platform edge highlight
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(mp.x, mp.y, mp.width, 3);
        
        // Direction arrows
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        if (mp.vertical) {
            ctx.fillText('↕', mp.x + mp.width / 2, mp.y + 18);
        } else {
            ctx.fillText('↔', mp.x + mp.width / 2, mp.y + 18);
        }
    });
    
    // Draw spikes
    currentSpikes.forEach(spike => {
        ctx.fillStyle = '#f56565';
        // Draw triangle spikes
        const spikeCount = Math.floor(spike.width / 15);
        const spikeWidth = spike.width / spikeCount;
        for (let i = 0; i < spikeCount; i++) {
            ctx.beginPath();
            ctx.moveTo(spike.x + i * spikeWidth, spike.y + spike.height);
            ctx.lineTo(spike.x + i * spikeWidth + spikeWidth / 2, spike.y);
            ctx.lineTo(spike.x + (i + 1) * spikeWidth, spike.y + spike.height);
            ctx.closePath();
            ctx.fill();
        }
    });

    // Rope handling and draw
    if (ropeState.active) {
        if (Date.now() > ropeState.expiresAt) {
            resetRopeState();
        }
    }

    if (ropeState.active && parkourPlayers[ropeState.fromId] && parkourPlayers[ropeState.toId]) {
        const fromPlayer = parkourPlayers[ropeState.fromId];
        const toPlayer = parkourPlayers[ropeState.toId];

        ropeState.fromX = fromPlayer.x + fromPlayer.width / 2;
        ropeState.fromY = fromPlayer.y;

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(ropeState.fromX, ropeState.fromY);
        ctx.lineTo(toPlayer.x + toPlayer.width / 2, toPlayer.y + toPlayer.height / 2);
        ctx.stroke();

        if (myPlayerId === ropeState.toId && parkourPlayers[myPlayerId] && ropeGrabbed) {
            const climber = parkourPlayers[myPlayerId];
            if (keys.up) {
                climber.velocityY = -ROPE_CLIMB_SPEED;
            } else if (keys.down) {
                climber.velocityY = ROPE_CLIMB_SPEED;
            }

            const anchorX = ropeState.fromX - climber.width / 2;
            climber.x += (anchorX - climber.x) * ROPE_PULL_STRENGTH;

            if (climber.y <= ropeState.fromY - climber.height) {
                resetRopeState();
            }
        }
    }
    
    // Show waiting message if I'm at finish but teammate isn't
    if (iAmAtFinish && !teammateAtFinish) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(CANVAS_WIDTH / 2 - 150, 20, 300, 40);
        ctx.fillStyle = '#48bb78';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Warte auf Teammate...', CANVAS_WIDTH / 2, 47);
    }
    
    // Show message if teammate is waiting
    if (!iAmAtFinish && teammateAtFinish) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(CANVAS_WIDTH / 2 - 150, 20, 300, 40);
        ctx.fillStyle = '#f6ad55';
        ctx.font = 'bold 18px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('Teammate wartet am Ziel!', CANVAS_WIDTH / 2, 47);
    }
    
    // Check for death (spikes or fall)
    let playerDied = false;
    if (parkourPlayers[myPlayerId]) {
        // Check spike collision
        currentSpikes.forEach(spike => {
            if (parkourPlayers[myPlayerId].checkCollision({ 
                x: spike.x, 
                y: spike.y, 
                width: spike.width, 
                height: spike.height 
            })) {
                playerDied = true;
            }
        });
        
        // Check fall death
        if (parkourPlayers[myPlayerId].y > DEATH_ZONE_Y) {
            playerDied = true;
        }
        
        if (playerDied && !iAmAtFinish) {
            // Reset player position
            parkourPlayers[myPlayerId].x = 50;
            parkourPlayers[myPlayerId].y = 400;
            parkourPlayers[myPlayerId].velocityX = 0;
            parkourPlayers[myPlayerId].velocityY = 0;
            socket.emit('parkourRespawn', { gameId: parkourGameId });
        }
    }
    
    // Update and draw players
    if (parkourPlayers[myPlayerId]) {
        const otherPlayers = [parkourPlayers[teammateId]].filter(p => p);
        parkourPlayers[myPlayerId].update(allPlatforms, otherPlayers);
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
    if (checkLevelComplete() && !iAmAtFinish) {
        iAmAtFinish = true;
        socket.emit('parkourLevelComplete', {
            gameId: parkourGameId,
            level: currentLevel
        });
        startFinishSignal();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Keyboard controls
const keys = {};

document.addEventListener('keydown', (e) => {
    // Don't capture keys when typing in input fields
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (!parkourPlayers[myPlayerId]) return;
    
    keys[e.key] = true;
    const isClimbing = ropeState.active && ropeState.toId === myPlayerId;
    
    // WASD controls
    if (e.key === 'w' || e.key === 'W') {
        keys.up = true;
        if (!isClimbing) {
            parkourPlayers[myPlayerId].jump();
        }
        e.preventDefault();
    }
    if (e.key === ' ') {
        if (!isClimbing) {
            parkourPlayers[myPlayerId].jump();
        }
        e.preventDefault();
    }
    if (e.key === 'a' || e.key === 'A') {
        parkourPlayers[myPlayerId].keys.left = true;
    }
    if (e.key === 'd' || e.key === 'D') {
        parkourPlayers[myPlayerId].keys.right = true;
    }
    if (e.key === 's' || e.key === 'S') {
        keys.down = true;
    }
    if (e.key === 'r' || e.key === 'R') {
        tryThrowRope();
    }
    if (e.key === 'e' || e.key === 'E') {
        if (ropeState.active && ropeState.toId === myPlayerId) {
            ropeGrabbed = true;
        }
    }
    
    // Arrow keys
    if (e.key === 'ArrowUp') {
        keys.up = true;
        if (!isClimbing) {
            parkourPlayers[myPlayerId].jump();
        }
        e.preventDefault();
    }
    if (e.key === 'ArrowLeft') {
        parkourPlayers[myPlayerId].keys.left = true;
    }
    if (e.key === 'ArrowRight') {
        parkourPlayers[myPlayerId].keys.right = true;
    }
    if (e.key === 'ArrowDown') {
        keys.down = true;
    }
});

document.addEventListener('keyup', (e) => {
    // Don't capture keys when typing in input fields
    if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
    if (!parkourPlayers[myPlayerId]) return;
    
    keys[e.key] = false;
    
    if (e.key === 'a' || e.key === 'A' || e.key === 'ArrowLeft') {
        parkourPlayers[myPlayerId].keys.left = false;
    }
    if (e.key === 'd' || e.key === 'D' || e.key === 'ArrowRight') {
        parkourPlayers[myPlayerId].keys.right = false;
    }
    if (e.key === 'w' || e.key === 'W' || e.key === 'ArrowUp') {
        keys.up = false;
    }
    if (e.key === 's' || e.key === 'S' || e.key === 'ArrowDown') {
        keys.down = false;
    }
    if (e.key === 'e' || e.key === 'E') {
        ropeGrabbed = false;
    }
});

// Event listeners
if (playParkourBtn) {
    playParkourBtn.addEventListener('click', () => {
        console.log('[Parkour Client] Searching for parkour game...');
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

// Touch Controls
const touchLeftBtn = document.getElementById('touchLeftBtn');
const touchRightBtn = document.getElementById('touchRightBtn');
const touchJumpBtn = document.getElementById('touchJumpBtn');
const touchRopeBtn = document.getElementById('touchRopeBtn');

function bindHoldButton(button, onPress, onRelease) {
    if (!button) return;

    const handleDown = (e) => {
        if (e.cancelable) e.preventDefault();
        onPress();
    };

    const handleUp = (e) => {
        if (e.cancelable) e.preventDefault();
        onRelease();
    };

    button.addEventListener('pointerdown', handleDown);
    button.addEventListener('pointerup', handleUp);
    button.addEventListener('pointercancel', handleUp);
    button.addEventListener('pointerleave', handleUp);
    button.addEventListener('touchstart', handleDown, { passive: false });
    button.addEventListener('touchend', handleUp, { passive: false });
}

function bindTapButton(button, onTap) {
    if (!button) return;
    const handleTap = (e) => {
        if (e.cancelable) e.preventDefault();
        onTap();
    };
    button.addEventListener('pointerdown', handleTap);
    button.addEventListener('touchstart', handleTap, { passive: false });
}

bindHoldButton(touchLeftBtn,
    () => {
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.left = true;
        }
    },
    () => {
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.left = false;
        }
    }
);

bindHoldButton(touchRightBtn,
    () => {
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.right = true;
        }
    },
    () => {
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].keys.right = false;
        }
    }
);

bindHoldButton(touchJumpBtn,
    () => {
        if (parkourPlayers[myPlayerId]) {
            parkourPlayers[myPlayerId].jump();
            keys.up = true;
        }
    },
    () => {
        keys.up = false;
    }
);

bindTapButton(touchRopeBtn, () => {
    handleRopeAction();
});

// Down button for rope climbing
const touchDownBtn = document.getElementById('touchDownBtn');
bindHoldButton(touchDownBtn,
    () => {
        keys.down = true;
    },
    () => {
        keys.down = false;
    }
);

if (leaveParkourBtn) {
    leaveParkourBtn.addEventListener('click', () => {
        if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
        }
        stopFinishSignal();
        socket.emit('leaveParkour', { gameId: parkourGameId });
        parkourGameId = null;
        parkourPlayers = {};
        showParkourScreen('menu');
    });
}

function showParkourScreen(screen) {
    // Hide ALL screens
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    
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
    iAmAtFinish = false;
    teammateAtFinish = false;
    
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

socket.on('parkourRope', (data) => {
    if (data.gameId !== parkourGameId) return;
    setRopeState(data);
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
    iAmAtFinish = false;
    teammateAtFinish = false;
    stopFinishSignal();
    initLevel(data.level);
});

socket.on('parkourTeammateAtFinish', () => {
    teammateAtFinish = true;
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
    stopFinishSignal();
    alert('Dein Teammate hat das Spiel verlassen.');
    showParkourScreen('menu');
});
