const socket = io();

// State
let username = '';
let currentGameId = null;
let mySymbol = null;
let opponentSymbol = null;
let opponentName = '';
let gameMode = 'bot';
let isMyTurn = false;
let gameOptions = null;

// Screens
const screens = {
    username: document.getElementById('usernameScreen'),
    menu: document.getElementById('menuScreen'),
    options: document.getElementById('optionsScreen'),
    searching: document.getElementById('searchingScreen'),
    game: document.getElementById('gameScreen')
};

// Elements
const usernameInput = document.getElementById('usernameInput');
const submitUsername = document.getElementById('submitUsername');
const usernameDisplay = document.getElementById('usernameDisplay');
const playBotBtn = document.getElementById('playBotBtn');
const playMultiplayerBtn = document.getElementById('playMultiplayerBtn');
const matchCountSlider = document.getElementById('matchCount');
const matchCountValue = document.getElementById('matchCountValue');
const startSearchBtn = document.getElementById('startSearchBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const cancelSearchBtn = document.getElementById('cancelSearchBtn');
const board = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const turnIndicator = document.getElementById('turnIndicator');
const playerNameEl = document.getElementById('playerName');
const playerSymbolEl = document.getElementById('playerSymbol');
const opponentNameEl = document.getElementById('opponentName');
const opponentSymbolEl = document.getElementById('opponentSymbol');
const matchInfo = document.getElementById('matchInfo');
const scoreBoard = document.getElementById('scoreBoard');
const yourScore = document.getElementById('yourScore');
const drawScore = document.getElementById('drawScore');
const opponentScore = document.getElementById('opponentScore');
const leaveGameBtn = document.getElementById('leaveGameBtn');
const gameEndModal = document.getElementById('gameEndModal');
const gameEndTitle = document.getElementById('gameEndTitle');
const gameEndMessage = document.getElementById('gameEndMessage');
const seriesScores = document.getElementById('seriesScores');
const backToMenuFromGame = document.getElementById('backToMenuFromGame');

// Helper Functions
function showScreen(screenName) {
    Object.values(screens).forEach(screen => screen.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function showModal() {
    gameEndModal.classList.add('active');
}

function hideModal() {
    gameEndModal.classList.remove('active');
}

// Username Screen
submitUsername.addEventListener('click', () => {
    const name = usernameInput.value.trim();
    if (name) {
        username = name;
        socket.emit('register', username);
        usernameDisplay.textContent = username;
        showScreen('menu');
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitUsername.click();
    }
});

// Menu Screen
playBotBtn.addEventListener('click', () => {
    gameMode = 'bot';
    socket.emit('playBot');
});

playMultiplayerBtn.addEventListener('click', () => {
    gameMode = 'multiplayer';
    showScreen('options');
});

// Options Screen
matchCountSlider.addEventListener('input', (e) => {
    matchCountValue.textContent = e.target.value;
});

startSearchBtn.addEventListener('click', () => {
    const matchCount = parseInt(matchCountSlider.value);
    const competitive = document.querySelector('input[name="gameMode"]:checked').value === 'competitive';
    
    gameOptions = {
        matchCount: matchCount,
        competitive: competitive
    };

    socket.emit('searchMatch', gameOptions);
    showScreen('searching');
});

backToMenuBtn.addEventListener('click', () => {
    showScreen('menu');
});

cancelSearchBtn.addEventListener('click', () => {
    socket.emit('cancelSearch');
    showScreen('menu');
});

leaveGameBtn.addEventListener('click', () => {
    resetGame();
    showScreen('menu');
});

backToMenuFromGame.addEventListener('click', () => {
    hideModal();
    resetGame();
    showScreen('menu');
});

// Game Logic
function resetGame() {
    currentGameId = null;
    mySymbol = null;
    opponentSymbol = null;
    opponentName = '';
    isMyTurn = false;
    gameOptions = null;
    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'winner');
        cell.innerHTML = '';
    });
}

function initGame(data) {
    currentGameId = data.gameId;
    mySymbol = data.symbol;
    opponentSymbol = data.symbol === 'X' ? 'O' : 'X';
    opponentName = data.opponent;
    gameOptions = data.options;

    playerNameEl.textContent = username;
    playerSymbolEl.textContent = mySymbol;
    playerSymbolEl.className = `player-symbol ${mySymbol.toLowerCase()}`;
    
    opponentNameEl.textContent = opponentName;
    opponentSymbolEl.textContent = opponentSymbol;
    opponentSymbolEl.className = `player-symbol ${opponentSymbol.toLowerCase()}`;

    if (gameOptions) {
        if (gameOptions.matchCount > 1) {
            matchInfo.textContent = `Spiel 1 von ${gameOptions.matchCount}`;
            if (gameOptions.competitive) {
                scoreBoard.classList.remove('hidden');
                yourScore.textContent = '0';
                drawScore.textContent = '0';
                opponentScore.textContent = '0';
            }
        } else {
            matchInfo.textContent = '';
            scoreBoard.classList.add('hidden');
        }
    } else {
        matchInfo.textContent = '';
        scoreBoard.classList.add('hidden');
    }

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'winner');
        cell.innerHTML = '';
    });

    updateTurnIndicator('X');
    showScreen('game');
}

function updateTurnIndicator(currentPlayer) {
    isMyTurn = currentPlayer === mySymbol;
    
    if (isMyTurn) {
        turnIndicator.textContent = 'Dein Zug';
        turnIndicator.classList.add('active');
    } else {
        turnIndicator.textContent = 'Gegner am Zug';
        turnIndicator.classList.remove('active');
    }
}

function makeMove(position) {
    if (!isMyTurn) return;
    
    const cell = cells[position];
    if (cell.classList.contains('filled')) return;

    socket.emit('makeMove', {
        gameId: currentGameId,
        position: position
    });
}

function renderMove(position, symbol) {
    const cell = cells[position];
    cell.classList.add('filled');
    
    const content = document.createElement('div');
    content.className = `cell-content ${symbol.toLowerCase()}`;
    content.textContent = symbol;
    cell.appendChild(content);
}

function highlightWinningLine(line) {
    if (line) {
        line.forEach(index => {
            cells[index].classList.add('winner');
        });
    }
}

// Socket Events
socket.on('gameStart', (data) => {
    initGame(data);
});

socket.on('moveMade', (data) => {
    renderMove(data.position, data.symbol);
    
    // Nächster Spieler bestimmen
    const nextPlayer = data.symbol === 'X' ? 'O' : 'X';
    updateTurnIndicator(nextPlayer);
});

socket.on('gameEnd', (data) => {
    if (data.winningLine) {
        highlightWinningLine(data.winningLine);
    }

    setTimeout(() => {
        if (data.winner) {
            if (data.winner === mySymbol) {
                gameEndTitle.textContent = '🎉 Du hast gewonnen!';
                gameEndMessage.textContent = 'Herzlichen Glückwunsch!';
            } else {
                gameEndTitle.textContent = '😔 Du hast verloren';
                gameEndMessage.textContent = 'Nächstes Mal klappt es bestimmt!';
            }
        } else if (data.draw) {
            gameEndTitle.textContent = '🤝 Unentschieden';
            gameEndMessage.textContent = 'Gut gespielt!';
        }

        seriesScores.classList.add('hidden');
        
        // Nur Modal zeigen wenn es kein Series-Spiel ist
        if (!gameOptions || gameOptions.matchCount === 1) {
            showModal();
        }
    }, 1500);
});

socket.on('nextMatch', (data) => {
    mySymbol = data.symbol;
    opponentSymbol = data.symbol === 'X' ? 'O' : 'X';
    
    playerSymbolEl.textContent = mySymbol;
    playerSymbolEl.className = `player-symbol ${mySymbol.toLowerCase()}`;
    opponentSymbolEl.textContent = opponentSymbol;
    opponentSymbolEl.className = `player-symbol ${opponentSymbol.toLowerCase()}`;

    matchInfo.textContent = `Spiel ${data.matchNumber} von ${data.totalMatches}`;
    
    if (data.scores) {
        yourScore.textContent = data.scores.player1;
        drawScore.textContent = data.scores.draws;
        opponentScore.textContent = data.scores.player2;
    }

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'winner');
        cell.innerHTML = '';
    });

    updateTurnIndicator('X');
});

socket.on('seriesEnd', (data) => {
    const scores = data.scores;
    let finalMessage = '';
    
    if (scores.player1 > scores.player2) {
        gameEndTitle.textContent = '🏆 Serie gewonnen!';
        finalMessage = 'Du hast die Serie gewonnen!';
    } else if (scores.player1 < scores.player2) {
        gameEndTitle.textContent = '😔 Serie verloren';
        finalMessage = 'Du hast die Serie verloren.';
    } else {
        gameEndTitle.textContent = '🤝 Serie unentschieden';
        finalMessage = 'Die Serie endet unentschieden.';
    }

    gameEndMessage.textContent = finalMessage;
    
    seriesScores.innerHTML = `
        <h3>Endergebnis</h3>
        <p>Du: ${scores.player1} Siege</p>
        <p>Unentschieden: ${scores.draws}</p>
        <p>Gegner: ${scores.player2} Siege</p>
    `;
    seriesScores.classList.remove('hidden');

    showModal();
});

socket.on('opponentDisconnected', () => {
    gameEndTitle.textContent = '⚠️ Gegner getrennt';
    gameEndMessage.textContent = 'Dein Gegner hat das Spiel verlassen.';
    seriesScores.classList.add('hidden');
    showModal();
});

socket.on('searching', () => {
    showScreen('searching');
});

socket.on('searchCancelled', () => {
    showScreen('menu');
});

// Cell Click Events
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        makeMove(index);
    });
});

// Initial load
showScreen('username');
