// Global socket connection (accessible by parkour.js and other modules)
window.socket = io();
var socket = window.socket;

// State
let username = '';
let currentGameId = null;
let currentLobbyId = null;
let mySymbol = null;
let opponentSymbol = null;
let opponentName = '';
let yourUsername = '';
let gameMode = 'bot';
let isMyTurn = false;
let gameOptions = null;
let isPlayer1 = false;
let isReady = false;

// Screens
const screens = {
    username: document.getElementById('usernameScreen'),
    menu: document.getElementById('menuScreen'),
    ticTacToeMenu: document.getElementById('ticTacToeMenuScreen'),
    options: document.getElementById('optionsScreen'),
    searching: document.getElementById('searchingScreen'),
    lobby: document.getElementById('lobbyScreen'),
    game: document.getElementById('gameScreen'),
    chessMenu: document.getElementById('chessMenuScreen'),
    chat: document.getElementById('chatScreen')
};

// Elements
const usernameInput = document.getElementById('usernameInput');
const submitUsername = document.getElementById('submitUsername');
const usernameDisplay = document.getElementById('usernameDisplay');
const playTicTacToeBtn = document.getElementById('playTicTacToeBtn');
const playBotBtn = document.getElementById('playBotBtn');
const playMultiplayerBtn = document.getElementById('playMultiplayerBtn');
const playChessBtn = document.getElementById('playChessBtn');
const openChatBtn = document.getElementById('openChatBtn');
const backFromTicTacToeMenuBtn = document.getElementById('backFromTicTacToeMenuBtn');
const backFromChessMenuBtn = document.getElementById('backFromChessMenuBtn');
const startSearchBtn = document.getElementById('startSearchBtn');
const backToMenuBtn = document.getElementById('backToMenuBtn');
const cancelSearchBtn = document.getElementById('cancelSearchBtn');

// Lobby Elements
const lobbyOpponentName = document.getElementById('lobbyOpponentName');
const lobbyMatchCountSlider = document.getElementById('lobbyMatchCount');
const lobbyMatchCountValue = document.getElementById('lobbyMatchCountValue');
const settingsUpdateNotice = document.getElementById('settingsUpdateNotice');
const settingsUpdater = document.getElementById('settingsUpdater');
const player1NameReady = document.getElementById('player1NameReady');
const player2NameReady = document.getElementById('player2NameReady');
const player1ReadyStatus = document.getElementById('player1ReadyStatus');
const player2ReadyStatus = document.getElementById('player2ReadyStatus');
const readyBtn = document.getElementById('readyBtn');
const leaveLobbyBtn = document.getElementById('leaveLobbyBtn');

// Game Elements
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

// Game End Elements
const gameEndOverlay = document.getElementById('gameEndOverlay');
const gameEndTitle = document.getElementById('gameEndTitle');
const gameEndSubtitle = document.getElementById('gameEndSubtitle');
const seriesScoresOverlay = document.getElementById('seriesScores');
const continueBtn = document.getElementById('continueBtn');
const backToMenuFromOverlay = document.getElementById('backToMenuFromOverlay');
const gameEndModal = document.getElementById('gameEndModal');
const finalTitle = document.getElementById('finalTitle');
const finalMessage = document.getElementById('finalMessage');
const finalScores = document.getElementById('finalScores');
const backToMenuFromGame = document.getElementById('backToMenuFromGame');

// Helper Functions
function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
        if (screen) screen.classList.remove('active');
    });
    // Also hide game-specific screens
    const otherScreens = ['parkourSearchingScreen', 'parkourScreen', 'chessSearchingScreen', 'chessScreen'];
    otherScreens.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('active');
    });
    // Show requested screen
    if (screens[screenName]) {
        screens[screenName].classList.add('active');
    }
}

function showGameEndOverlay() {
    gameEndOverlay.classList.add('active');
}

function hideGameEndOverlay() {
    gameEndOverlay.classList.remove('active');
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
    }
});

usernameInput.addEventListener('keydown', (e) => {
    e.stopPropagation();
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        submitUsername.click();
    }
});

// Handle username validation responses
socket.on('usernameAccepted', () => {
    usernameDisplay.textContent = username;
    showScreen('menu');
    // Request chat history now that we're registered
    socket.emit('getChatHistory');
});

socket.on('usernameError', (message) => {
    alert(message);
    usernameInput.focus();
});

// Menu Screen
if (playTicTacToeBtn) {
    playTicTacToeBtn.addEventListener('click', () => {
        showScreen('ticTacToeMenu');
    });
}

// TicTacToe Menu Screen
if (playBotBtn) {
    playBotBtn.addEventListener('click', () => {
        gameMode = 'bot';
        socket.emit('playBot');
    });
}

if (playMultiplayerBtn) {
    playMultiplayerBtn.addEventListener('click', () => {
        gameMode = 'multiplayer';
        showScreen('options');
    });
}

if (backFromTicTacToeMenuBtn) {
    backFromTicTacToeMenuBtn.addEventListener('click', () => {
        showScreen('menu');
    });
}

// Chess Menu
if (playChessBtn) {
    playChessBtn.addEventListener('click', () => {
        showScreen('chessMenu');
    });
}

const playChessBotBtn = document.getElementById('playChessBotBtn');
if (playChessBotBtn) {
    playChessBotBtn.addEventListener('click', () => {
        socket.emit('playChessBot');
    });
}

const playChessMultiplayerBtn = document.getElementById('playChessMultiplayerBtn');
if (playChessMultiplayerBtn) {
    playChessMultiplayerBtn.addEventListener('click', () => {
        socket.emit('searchChessMatch');
        showScreen('searching');
    });
}

if (backFromChessMenuBtn) {
    backFromChessMenuBtn.addEventListener('click', () => {
        showScreen('menu');
    });
}

// Open Chat
if (openChatBtn) {
    openChatBtn.addEventListener('click', () => {
        showScreen('chat');
        const chatInputEl = document.getElementById('chatInput');
        if (chatInputEl) {
            chatInputEl.focus();
        }
    });
}

// Options Screen
startSearchBtn.addEventListener('click', () => {
    socket.emit('searchMatch');
    showScreen('searching');
});

backToMenuBtn.addEventListener('click', () => {
    showScreen('menu');
});

cancelSearchBtn.addEventListener('click', () => {
    socket.emit('cancelSearch');
    showScreen('menu');
});

// Lobby Screen
lobbyMatchCountSlider.addEventListener('input', (e) => {
    lobbyMatchCountValue.textContent = e.target.value;
    updateLobbySettings();
});

document.querySelectorAll('input[name="lobbyGameMode"]').forEach(radio => {
    radio.addEventListener('change', () => {
        updateLobbySettings();
    });
});

function updateLobbySettings() {
    if (!currentLobbyId) return;
    
    const matchCount = parseInt(lobbyMatchCountSlider.value);
    const competitive = document.querySelector('input[name="lobbyGameMode"]:checked').value === 'competitive';
    
    socket.emit('updateSettings', {
        lobbyId: currentLobbyId,
        settings: {
            matchCount: matchCount,
            competitive: competitive
        }
    });
}

readyBtn.addEventListener('click', () => {
    isReady = !isReady;
    
    if (isReady) {
        readyBtn.textContent = 'Nicht bereit';
        readyBtn.classList.remove('btn-primary');
        readyBtn.classList.add('btn-secondary');
    } else {
        readyBtn.textContent = 'Bereit';
        readyBtn.classList.remove('btn-secondary');
        readyBtn.classList.add('btn-primary');
    }
    
    socket.emit('setReady', {
        lobbyId: currentLobbyId,
        ready: isReady
    });
});

leaveLobbyBtn.addEventListener('click', () => {
    socket.emit('leaveLobby', { lobbyId: currentLobbyId });
    currentLobbyId = null;
    isReady = false;
    showScreen('menu');
});

leaveGameBtn.addEventListener('click', () => {
    hideGameEndOverlay();
    resetGame();
    showScreen('menu');
});

backToMenuFromGame.addEventListener('click', () => {
    hideModal();
    hideGameEndOverlay();
    resetGame();
    showScreen('menu');
});

continueBtn.addEventListener('click', () => {
    hideGameEndOverlay();
});

backToMenuFromOverlay.addEventListener('click', () => {
    hideGameEndOverlay();
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
    opponentName = data.opponentUsername;
    yourUsername = data.yourUsername;
    
    // Für Multiplayer: isPlayer1 bestimmen (Bot hat das nicht)
    if (data.mode === 'multiplayer') {
        // Bei Multiplayer kommt das vom Server in der Lobby
        // isPlayer1 bleibt wie es ist
    } else {
        // Bei Bot-Spielen ist der Spieler immer "Player 1"
        isPlayer1 = true;
    }
    
    gameOptions = {
        matchCount: data.matchCount || 1,
        competitive: data.competitive || false
    };

    playerNameEl.textContent = yourUsername;
    playerSymbolEl.textContent = mySymbol;
    playerSymbolEl.className = `player-symbol ${mySymbol.toLowerCase()}`;
    
    opponentNameEl.textContent = opponentName;
    opponentSymbolEl.textContent = opponentSymbol;
    opponentSymbolEl.className = `player-symbol ${opponentSymbol.toLowerCase()}`;

    if (gameOptions.matchCount > 1) {
        matchInfo.textContent = `Spiel 1 von ${gameOptions.matchCount}`;
        if (gameOptions.competitive) {
            scoreBoard.classList.remove('hidden');
            yourScore.textContent = '0';
            drawScore.textContent = '0';
            opponentScore.textContent = '0';
        } else {
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
    if (cell.classList.contains('filled')) return; // Bereits gefüllt
    
    cell.classList.add('filled');
    cell.innerHTML = ''; // Vorherigen Inhalt löschen
    
    const content = document.createElement('div');
    content.className = `cell-content ${symbol.toLowerCase()}`;
    content.textContent = symbol;
    
    // Kleine Verzögerung für bessere Animation
    requestAnimationFrame(() => {
        cell.appendChild(content);
    });
}

function highlightWinningLine(line) {
    if (line) {
        line.forEach(index => {
            cells[index].classList.add('winner');
        });
    }
}

// Socket Events
socket.on('searching', () => {
    showScreen('searching');
});

socket.on('searchCancelled', () => {
    showScreen('menu');
});

socket.on('lobbyJoined', (data) => {
    currentLobbyId = data.lobbyId;
    isPlayer1 = data.isPlayer1;
    yourUsername = data.yourUsername;
    
    lobbyOpponentName.textContent = data.opponent;
    
    // Settings auf Standardwerte setzen
    lobbyMatchCountSlider.value = data.settings.matchCount;
    lobbyMatchCountValue.textContent = data.settings.matchCount;
    
    const modeRadio = document.querySelector(`input[name="lobbyGameMode"][value="${data.settings.competitive ? 'competitive' : 'normal'}"]`);
    if (modeRadio) modeRadio.checked = true;
    
    // Ready Status zurücksetzen
    isReady = false;
    readyBtn.textContent = 'Bereit';
    readyBtn.classList.remove('btn-secondary');
    readyBtn.classList.add('btn-primary');
    
    player1NameReady.textContent = isPlayer1 ? yourUsername : data.opponent;
    player2NameReady.textContent = isPlayer1 ? data.opponent : yourUsername;
    player1ReadyStatus.textContent = 'Nicht bereit';
    player1ReadyStatus.className = 'status-badge not-ready';
    player2ReadyStatus.textContent = 'Nicht bereit';
    player2ReadyStatus.className = 'status-badge not-ready';
    
    settingsUpdateNotice.classList.add('hidden');
    
    showScreen('lobby');
});

socket.on('settingsUpdated', (data) => {
    // Settings aktualisieren
    lobbyMatchCountSlider.value = data.settings.matchCount;
    lobbyMatchCountValue.textContent = data.settings.matchCount;
    
    const modeRadio = document.querySelector(`input[name="lobbyGameMode"][value="${data.settings.competitive ? 'competitive' : 'normal'}"]`);
    if (modeRadio) modeRadio.checked = true;
    
    // Benachrichtigung anzeigen
    if (data.updatedBy !== username) {
        settingsUpdater.textContent = data.updatedBy;
        settingsUpdateNotice.classList.remove('hidden');
        setTimeout(() => {
            settingsUpdateNotice.classList.add('hidden');
        }, 3000);
    }
    
    // Ready-Status zurücksetzen
    isReady = false;
    readyBtn.textContent = 'Bereit';
    readyBtn.classList.remove('btn-secondary');
    readyBtn.classList.add('btn-primary');
});

socket.on('readyStatusUpdated', (data) => {
    player1NameReady.textContent = data.player1Name;
    player2NameReady.textContent = data.player2Name;
    
    player1ReadyStatus.textContent = data.player1Ready ? 'Bereit' : 'Nicht bereit';
    player1ReadyStatus.className = data.player1Ready ? 'status-badge ready' : 'status-badge not-ready';
    
    player2ReadyStatus.textContent = data.player2Ready ? 'Bereit' : 'Nicht bereit';
    player2ReadyStatus.className = data.player2Ready ? 'status-badge ready' : 'status-badge not-ready';
});

socket.on('opponentLeftLobby', () => {
    alert('Dein Gegner hat die Lobby verlassen.');
    currentLobbyId = null;
    isReady = false;
    showScreen('menu');
});

socket.on('gameStart', (data) => {
    // Username setzen falls nicht schon gesetzt
    if (!yourUsername) {
        yourUsername = username;
    }
    
    // Unterscheide zwischen Schach und TicTacToe
    if (data.mode === 'chessBot' || data.mode === 'chessMultiplayer') {
        // Schach-Spiel
        showScreen('chessScreen');
        // TODO: Schach-Logik initialisieren
        console.log('Schach-Spiel gestartet:', data);
    } else {
        // TicTacToe
        initGame(data);
    }
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
        let title = '';
        let subtitle = '';
        let titleClass = '';
        
        if (data.draw) {
            title = 'Unentschieden!';
            subtitle = 'Gut gespielt!';
            titleClass = 'draw';
        } else if (data.winnerName === yourUsername) {
            title = yourUsername + ' hat gewonnen!';
            subtitle = 'Herzlichen Glückwunsch!';
            titleClass = 'winner';
        } else {
            title = data.winnerName + ' hat gewonnen!';
            subtitle = 'Besser beim nächsten Mal!';
            titleClass = '';
        }
        
        gameEndTitle.textContent = title;
        gameEndTitle.className = 'game-end-title ' + titleClass;
        gameEndSubtitle.textContent = subtitle;
        
        // Continue Button nur bei Serie anzeigen
        if (gameOptions && gameOptions.matchCount > 1) {
            continueBtn.style.display = 'block';
        } else {
            continueBtn.style.display = 'none';
        }
        
        showGameEndOverlay();
    }, 1500);
});

socket.on('nextMatch', (data) => {
    mySymbol = data.symbol;
    opponentSymbol = data.symbol === 'X' ? 'O' : 'X';
    
    // isPlayer1 aktualisieren falls im Multiplayer
    if (data.isPlayer1 !== undefined) {
        isPlayer1 = data.isPlayer1;
    }
    
    playerSymbolEl.textContent = mySymbol;
    playerSymbolEl.className = `player-symbol ${mySymbol.toLowerCase()}`;
    opponentSymbolEl.textContent = opponentSymbol;
    opponentSymbolEl.className = `player-symbol ${opponentSymbol.toLowerCase()}`;

    matchInfo.textContent = `Spiel ${data.matchNumber} von ${gameOptions.matchCount}`;
    
    if (data.scores) {
        // Scores richtig zuordnen basierend auf isPlayer1
        if (isPlayer1) {
            yourScore.textContent = data.scores.player1;
            opponentScore.textContent = data.scores.player2;
        } else {
            yourScore.textContent = data.scores.player2;
            opponentScore.textContent = data.scores.player1;
        }
        drawScore.textContent = data.scores.draws;
    }

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'winner');
        cell.innerHTML = '';
    });

    hideGameEndOverlay();
    updateTurnIndicator('X');
});

socket.on('seriesEnd', (data) => {
    const scores = data.scores;
    let title = '';
    let message = '';
    
    if (scores.player1 > scores.player2) {
        title = data.player1Name + ' hat die Serie gewonnen!';
    } else if (scores.player1 < scores.player2) {
        title = data.player2Name + ' hat die Serie gewonnen!';
    } else {
        title = 'Serie unentschieden!';
    }

    finalTitle.textContent = title;
    finalMessage.textContent = '';
    
    finalScores.innerHTML = `
        <h3>Endergebnis</h3>
        <p>${data.player1Name}: ${scores.player1} Siege</p>
        <p>Unentschieden: ${scores.draws}</p>
        <p>${data.player2Name}: ${scores.player2} Siege</p>
    `;
    finalScores.classList.remove('hidden');

    hideGameEndOverlay();
    setTimeout(() => {
        showModal();
    }, 500);
});

socket.on('opponentDisconnected', () => {
    finalTitle.textContent = 'Gegner getrennt';
    finalMessage.textContent = 'Dein Gegner hat das Spiel verlassen.';
    finalScores.classList.add('hidden');
    hideGameEndOverlay();
    setTimeout(() => {
        showModal();
    }, 300);
});

// Cell Click Events
cells.forEach((cell, index) => {
    cell.addEventListener('click', () => {
        makeMove(index);
    });
});

// Initial load
showScreen('username');
