const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const GameLogic = require('./gameLogic');
const BotAI = require('./botAI');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = process.env.PORT || 6575;

// Dienst für statische Dateien
app.use(express.static(path.join(__dirname, 'public')));

// Speichert aktive Spiele, Spieler und Lobbys
const games = new Map();
const players = new Map();
const lobbies = new Map();
const waitingPlayers = [];
const waitingChessPlayers = [];
const parkourGames = new Map();
const waitingParkourPlayers = [];
const chessGames = new Map();

// ── Chess helpers ─────────────────────────────────────────────────────────────
const CHESS_INITIAL_BOARD = [
    ['r','n','b','q','k','b','n','r'],
    ['p','p','p','p','p','p','p','p'],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    [null,null,null,null,null,null,null,null],
    ['P','P','P','P','P','P','P','P'],
    ['R','N','B','Q','K','B','N','R']
];

function cloneBoard(b) { return b.map(r => [...r]); }

function applyChessMove(board, from, to) {
    const nb = cloneBoard(board);
    const piece = nb[from.row][from.col];
    // Promotion
    if (piece === 'P' && to.row === 0) nb[to.row][to.col] = 'Q';
    else if (piece === 'p' && to.row === 7) nb[to.row][to.col] = 'q';
    else nb[to.row][to.col] = piece;
    nb[from.row][from.col] = null;
    return nb;
}

function isPathClearServer(board, fr, fc, tr, tc) {
    const dr = Math.sign(tr - fr), dc = Math.sign(tc - fc);
    let r = fr + dr, c = fc + dc;
    while (r !== tr || c !== tc) {
        if (board[r][c]) return false;
        r += dr; c += dc;
    }
    return true;
}

/** Generate all legal moves for the piece at (fr,fc) */
function getLegalMovesServer(board, fr, fc) {
    const piece = board[fr][fc];
    if (!piece) return [];
    const isWhite = piece === piece.toUpperCase();
    const t = piece.toUpperCase();
    const moves = [];

    const tryAdd = (tr, tc) => {
        if (tr < 0 || tr > 7 || tc < 0 || tc > 7) return false;
        const target = board[tr][tc];
        if (target && (target === target.toUpperCase()) === isWhite) return false; // own piece
        const nb = applyChessMove(board, { row: fr, col: fc }, { row: tr, col: tc });
        if (!isInCheckServer(nb, isWhite)) moves.push({ from: { row: fr, col: fc }, to: { row: tr, col: tc } });
        return !!target; // true = stop sliding
    };

    switch (t) {
        case 'P': {
            const dir = isWhite ? -1 : 1;
            const startRow = isWhite ? 6 : 1;
            const nr = fr + dir;
            if (nr >= 0 && nr < 8) {
                if (!board[nr][fc]) {
                    tryAdd(nr, fc);
                    if (fr === startRow && !board[nr + dir]?.[fc]) tryAdd(nr + dir, fc);
                }
                [-1, 1].forEach(dc => {
                    const nc = fc + dc;
                    if (nc >= 0 && nc < 8) {
                        const tgt = board[nr][nc];
                        if (tgt && (tgt === tgt.toUpperCase()) !== isWhite) tryAdd(nr, nc);
                    }
                });
            }
            break;
        }
        case 'N':
            [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]
                .forEach(([dr,dc]) => tryAdd(fr+dr, fc+dc));
            break;
        case 'K':
            for (let dr=-1;dr<=1;dr++) for (let dc=-1;dc<=1;dc++)
                if (dr||dc) tryAdd(fr+dr, fc+dc);
            break;
        case 'R':
            [[0,1],[0,-1],[1,0],[-1,0]].forEach(([dr,dc]) => {
                let r=fr+dr, c=fc+dc;
                while (r>=0&&r<8&&c>=0&&c<8) { if (tryAdd(r,c)) break; r+=dr; c+=dc; }
            });
            break;
        case 'B':
            [[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => {
                let r=fr+dr, c=fc+dc;
                while (r>=0&&r<8&&c>=0&&c<8) { if (tryAdd(r,c)) break; r+=dr; c+=dc; }
            });
            break;
        case 'Q':
            [[0,1],[0,-1],[1,0],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]].forEach(([dr,dc]) => {
                let r=fr+dr, c=fc+dc;
                while (r>=0&&r<8&&c>=0&&c<8) { if (tryAdd(r,c)) break; r+=dr; c+=dc; }
            });
            break;
    }
    return moves;
}

function isInCheckServer(board, isWhite) {
    const kp = isWhite ? 'K' : 'k';
    let kr = -1, kc = -1;
    outer: for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (board[r][c] === kp) { kr = r; kc = c; break outer; }
    if (kr === -1) return true;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        if ((p === p.toUpperCase()) === isWhite) continue;
        // Use fast attack check (no full legal move gen needed here)
        const t = p.toUpperCase();
        const dr = kr - r, dc = kc - c;
        const isW = p === p.toUpperCase();
        let attacks = false;
        switch (t) {
            case 'P': attacks = dr === (isW ? -1 : 1) && Math.abs(dc) === 1; break;
            case 'N': attacks = (Math.abs(dr)===2&&Math.abs(dc)===1)||(Math.abs(dr)===1&&Math.abs(dc)===2); break;
            case 'K': attacks = Math.abs(dr)<=1&&Math.abs(dc)<=1; break;
            case 'R': attacks = (dr===0||dc===0)&&isPathClearServer(board,r,c,kr,kc); break;
            case 'B': attacks = Math.abs(dr)===Math.abs(dc)&&isPathClearServer(board,r,c,kr,kc); break;
            case 'Q': attacks = ((dr===0||dc===0)||Math.abs(dr)===Math.abs(dc))&&isPathClearServer(board,r,c,kr,kc); break;
        }
        if (attacks) return true;
    }
    return false;
}

function getChessGameStatus(board, isWhiteTurn) {
    for (let fr = 0; fr < 8; fr++) for (let fc = 0; fc < 8; fc++) {
        const piece = board[fr][fc];
        if (!piece || (piece === piece.toUpperCase()) !== isWhiteTurn) continue;
        if (getLegalMovesServer(board, fr, fc).length > 0) return 'ongoing';
    }
    return isInCheckServer(board, isWhiteTurn) ? 'checkmate' : 'stalemate';
}

function getRandomBotMove(board) {
    const allMoves = [];
    for (let fr = 0; fr < 8; fr++) for (let fc = 0; fc < 8; fc++) {
        const piece = board[fr][fc];
        if (!piece || piece === piece.toUpperCase()) continue; // bot plays black (lowercase)
        getLegalMovesServer(board, fr, fc).forEach(m => allMoves.push(m));
    }
    if (!allMoves.length) return null;
    // Prefer captures
    const captures = allMoves.filter(m => board[m.to.row][m.to.col]);
    if (captures.length > 0 && Math.random() < 0.65) return captures[Math.floor(Math.random() * captures.length)];
    return allMoves[Math.floor(Math.random() * allMoves.length)];
}

// Chat-Historie
const chatMessages = [];

io.on('connection', (socket) => {
    console.log(`Neuer Spieler verbunden: ${socket.id}`);

    // Spieler-Registrierung
    socket.on('register', (username) => {
        // Validate username
        if (!username || username.trim().length === 0) {
            socket.emit('usernameError', 'Benutzername ist erforderlich');
            return;
        }

        if (username.length > 20) {
            socket.emit('usernameError', 'Benutzername ist zu lang (max. 20 Zeichen)');
            return;
        }

        players.set(socket.id, {
            id: socket.id,
            username: username,
            socket: socket
        });
        console.log(`Spieler registriert: ${username} (${socket.id})`);
        socket.emit('usernameAccepted');
    });

    // Chat History anfordern
    socket.on('getChatHistory', () => {
        socket.emit('chatHistory', chatMessages);
    });

    // Bot-Spiel starten
    socket.on('playBot', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const gameId = `bot_${socket.id}_${Date.now()}`;
        const game = new GameLogic(gameId, player, null, true);
        games.set(gameId, game);

        // Zufällig X oder O zuweisen
        const playerSymbol = Math.random() < 0.5 ? 'X' : 'O';
        game.playerSymbol = playerSymbol;
        game.botSymbol = playerSymbol === 'X' ? 'O' : 'X';

        socket.emit('gameStart', {
            gameId: gameId,
            symbol: playerSymbol,
            mode: 'bot',
            opponent: 'Bot',
            opponentUsername: 'Bot',
            yourUsername: player.username,
            matchCount: 1,
            competitive: false
        });

        // Wenn Bot anfängt
        if (game.botSymbol === 'X') {
            setTimeout(() => {
                const botMove = BotAI.getMove(game.board, game.botSymbol, game.playerSymbol);
                if (botMove !== null) {
                    game.makeMove(botMove, game.botSymbol, false);
                    socket.emit('moveMade', {
                        position: botMove,
                        symbol: game.botSymbol,
                        board: game.board
                    });
                }
            }, 500);
        }
    });

    // Chess Bot spielen
    socket.on('playChessBot', () => {
        const player = players.get(socket.id);
        if (!player) return;

        const gameId = `chess_bot_${socket.id}_${Date.now()}`;
        const board = cloneBoard(CHESS_INITIAL_BOARD);
        chessGames.set(gameId, {
            id: gameId,
            isBot: true,
            player1: player,   // human = white
            player2: null,     // bot   = black
            board,
            currentTurn: 'white'
        });

        socket.emit('chessGameStart', {
            gameId,
            color: 'white',
            board,
            player1Name: player.username,
            player2Name: 'Schach-Bot'
        });
    });

    // Multiplayer-Suche
    socket.on('searchMatch', () => {
        const player = players.get(socket.id);
        if (!player) return;

        // Prüfen ob bereits ein wartender Spieler existiert
        if (waitingPlayers.length > 0) {
            // Gegner gefunden, Lobby erstellen
            const opponent = waitingPlayers.shift();
            const lobbyId = `lobby_${Date.now()}`;

            const lobby = {
                id: lobbyId,
                player1: opponent,
                player2: player,
                settings: {
                    matchCount: 1,
                    competitive: false
                },
                ready: {
                    player1: false,
                    player2: false
                }
            };

            lobbies.set(lobbyId, lobby);

            // Beide Spieler zur Lobby hinzufügen
            opponent.socket.join(lobbyId);
            player.socket.join(lobbyId);

            // Beide Spieler informieren
            opponent.socket.emit('lobbyJoined', {
                lobbyId: lobbyId,
                opponent: player.username,
                yourUsername: opponent.username,
                settings: lobby.settings,
                isPlayer1: true
            });

            player.socket.emit('lobbyJoined', {
                lobbyId: lobbyId,
                opponent: opponent.username,
                yourUsername: player.username,
                settings: lobby.settings,
                isPlayer1: false
            });
        } else {
            // Kein Gegner gefunden, in Queue einfügen
            waitingPlayers.push(player);
            socket.emit('searching');
        }
    });

    // Matchmaking abbrechen
    socket.on('cancelSearch', () => {
        const player = players.get(socket.id);
        if (player) {
            const index = waitingPlayers.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                waitingPlayers.splice(index, 1);
            }
            socket.emit('searchCancelled');
        }
    });

    // Chess Multiplayer-Suche (client emits 'searchChess')
    function handleChessSearch(socket) {
        const player = players.get(socket.id);
        if (!player) return;

        if (waitingChessPlayers.some(p => p.id === socket.id)) return; // already queued

        if (waitingChessPlayers.length > 0) {
            const opponent = waitingChessPlayers.shift();
            const gameId = `chess_mp_${Date.now()}`;
            const board = cloneBoard(CHESS_INITIAL_BOARD);

            chessGames.set(gameId, {
                id: gameId,
                isBot: false,
                player1: opponent, // white
                player2: player,   // black
                board,
                currentTurn: 'white'
            });

            opponent.socket.join(gameId);
            socket.join(gameId);

            opponent.socket.emit('chessGameStart', {
                gameId,
                color: 'white',
                board,
                player1Name: opponent.username,
                player2Name: player.username
            });
            socket.emit('chessGameStart', {
                gameId,
                color: 'black',
                board,
                player1Name: opponent.username,
                player2Name: player.username
            });
        } else {
            waitingChessPlayers.push(player);
            socket.emit('chessSearching');
        }
    }

    socket.on('searchChess', () => handleChessSearch(socket));
    socket.on('searchChessMatch', () => handleChessSearch(socket));

    // Cancel chess search
    socket.on('cancelChessSearch', () => {
        const idx = waitingChessPlayers.findIndex(p => p.id === socket.id);
        if (idx !== -1) waitingChessPlayers.splice(idx, 1);
    });

    // Leave chess game
    socket.on('leaveChess', (data) => {
        const game = chessGames.get(data && data.gameId);
        if (!game) return;
        const opponentId = game.player1.id === socket.id
            ? (game.player2 ? game.player2.id : null)
            : game.player1.id;
        if (opponentId) io.to(opponentId).emit('chessOpponentLeft');
        chessGames.delete(data.gameId);
    });

    // Chess move
    socket.on('chessMove', (data) => {
        const game = chessGames.get(data.gameId);
        if (!game) return;

        const isWhitePlayer = game.player1.id === socket.id;
        const myColor = isWhitePlayer ? 'white' : 'black';
        if (game.currentTurn !== myColor) return; // not your turn

        const newBoard = applyChessMove(game.board, data.from, data.to);
        game.board = newBoard;

        const nextColor = myColor === 'white' ? 'black' : 'white';
        const nextIsWhite = nextColor === 'white';
        const status = getChessGameStatus(newBoard, nextIsWhite);
        const inCheck = isInCheckServer(newBoard, nextIsWhite);

        let statusStr = 'ongoing';
        let winner = null;
        if (status === 'checkmate') { statusStr = 'checkmate'; winner = myColor; }
        else if (status === 'stalemate') { statusStr = 'stalemate'; }
        else if (inCheck) { statusStr = 'check'; }

        if (statusStr !== 'checkmate' && statusStr !== 'stalemate') game.currentTurn = nextColor;

        const moveData = {
            board: newBoard,
            from: data.from,
            to: data.to,
            currentTurn: nextColor,
            status: statusStr,
            winner
        };

        if (game.isBot) {
            // Send move result to human
            socket.emit('chessMoveMade', moveData);

            if (statusStr === 'checkmate' || statusStr === 'stalemate') {
                chessGames.delete(data.gameId);
                return;
            }

            // Bot responds
            setTimeout(() => {
                const botMove = getRandomBotMove(game.board);
                if (!botMove) {
                    // No legal moves for bot: checkmate or stalemate
                    const noMovesStatus = isInCheckServer(game.board, false) ? 'checkmate' : 'stalemate';
                    const noMovesWinner = noMovesStatus === 'checkmate' ? 'white' : null;
                    socket.emit('chessMoveMade', { board: game.board, currentTurn: 'black', status: noMovesStatus, winner: noMovesWinner });
                    chessGames.delete(data.gameId);
                    return;
                }
                const botBoard = applyChessMove(game.board, botMove.from, botMove.to);
                game.board = botBoard;
                game.currentTurn = 'white';

                const botStatus = getChessGameStatus(botBoard, true);
                const botInCheck = isInCheckServer(botBoard, true);
                let botStatusStr = 'ongoing';
                let botWinner = null;
                if (botStatus === 'checkmate') { botStatusStr = 'checkmate'; botWinner = 'black'; }
                else if (botStatus === 'stalemate') { botStatusStr = 'stalemate'; }
                else if (botInCheck) { botStatusStr = 'check'; }

                socket.emit('chessMoveMade', {
                    board: botBoard,
                    from: botMove.from,
                    to: botMove.to,
                    currentTurn: 'white',
                    status: botStatusStr,
                    winner: botWinner
                });
                if (botStatusStr === 'checkmate' || botStatusStr === 'stalemate') {
                    chessGames.delete(data.gameId);
                }
            }, 400);
        } else {
            // Multiplayer - send to both via room
            io.to(data.gameId).emit('chessMoveMade', moveData);
            if (statusStr === 'checkmate' || statusStr === 'stalemate') {
                chessGames.delete(data.gameId);
            }
        }
    });

    // Settings in Lobby ändern
    socket.on('updateSettings', (data) => {
        const lobby = lobbies.get(data.lobbyId);
        if (!lobby) return;

        const player = players.get(socket.id);
        if (!player) return;

        // Prüfen ob Spieler in dieser Lobby ist
        if (lobby.player1.id !== socket.id && lobby.player2.id !== socket.id) return;

        // Settings aktualisieren
        lobby.settings = data.settings;

        // Ready-Status zurücksetzen bei Änderung
        lobby.ready.player1 = false;
        lobby.ready.player2 = false;

        // An beide Spieler senden
        io.to(data.lobbyId).emit('settingsUpdated', {
            settings: lobby.settings,
            updatedBy: player.username
        });
    });

    // Ready Status in Lobby
    socket.on('setReady', (data) => {
        const lobby = lobbies.get(data.lobbyId);
        if (!lobby) return;

        const player = players.get(socket.id);
        if (!player) return;

        // Ready-Status setzen
        if (lobby.player1.id === socket.id) {
            lobby.ready.player1 = data.ready;
        } else if (lobby.player2.id === socket.id) {
            lobby.ready.player2 = data.ready;
        }

        // An beide Spieler senden
        io.to(data.lobbyId).emit('readyStatusUpdated', {
            player1Ready: lobby.ready.player1,
            player2Ready: lobby.ready.player2,
            player1Name: lobby.player1.username,
            player2Name: lobby.player2.username
        });

        // Wenn beide ready sind, Spiel starten
        if (lobby.ready.player1 && lobby.ready.player2) {
            startGame(lobby);
        }
    });

    function startGame(lobby) {
        const gameId = `game_${Date.now()}`;
        const game = new GameLogic(
            gameId,
            lobby.player1,
            lobby.player2,
            false,
            lobby.settings
        );
        games.set(gameId, game);

        // Zufällig X und O zuweisen
        const p1Symbol = Math.random() < 0.5 ? 'X' : 'O';
        const p2Symbol = p1Symbol === 'X' ? 'O' : 'X';

        game.player1Symbol = p1Symbol;
        game.player2Symbol = p2Symbol;
        game.currentPlayer = 'X';

        lobby.player1.socket.emit('gameStart', {
            gameId: gameId,
            symbol: p1Symbol,
            mode: 'multiplayer',
            opponent: lobby.player2.username,
            opponentUsername: lobby.player2.username,
            yourUsername: lobby.player1.username,
            matchCount: lobby.settings.matchCount,
            competitive: lobby.settings.competitive
        });

        lobby.player2.socket.emit('gameStart', {
            gameId: gameId,
            symbol: p2Symbol,
            mode: 'multiplayer',
            opponent: lobby.player1.username,
            opponentUsername: lobby.player1.username,
            yourUsername: lobby.player2.username,
            matchCount: lobby.settings.matchCount,
            competitive: lobby.settings.competitive
        });

        // Lobby entfernen
        lobbies.delete(lobby.id);
    }

    // Lobby verlassen
    socket.on('leaveLobby', (data) => {
        const lobby = lobbies.get(data.lobbyId);
        if (!lobby) return;

        const opponent = lobby.player1.id === socket.id ? lobby.player2 : lobby.player1;
        opponent.socket.emit('opponentLeftLobby');

        lobbies.delete(data.lobbyId);
    });

    // Zug machen
    socket.on('makeMove', (data) => {
        const game = games.get(data.gameId);
        if (!game) return;

        const player = players.get(socket.id);
        if (!player) return;

        // Prüfen ob Spieler an der Reihe ist
        let playerSymbol;
        let isPlayer1 = false;
        if (game.isBot) {
            playerSymbol = game.playerSymbol;
            isPlayer1 = true;
        } else {
            if (game.player1.id === socket.id) {
                playerSymbol = game.player1Symbol;
                isPlayer1 = true;
            } else {
                playerSymbol = game.player2Symbol;
                isPlayer1 = false;
            }
        }

        if (game.currentPlayer !== playerSymbol) {
            return; // Nicht an der Reihe
        }

        const result = game.makeMove(data.position, playerSymbol, isPlayer1);
        
        if (result.valid) {
            // Zug an alle Spieler senden
            if (game.isBot) {
                socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });

                // Prüfen auf Spielende
                if (result.winner || result.draw) {
                    const winnerName = result.winner === game.playerSymbol ? player.username : 'Bot';
                    socket.emit('gameEnd', {
                        winner: result.winner,
                        draw: result.draw,
                        winningLine: result.winningLine,
                        winnerName: result.draw ? null : winnerName
                    });
                    games.delete(data.gameId);
                    return;
                }

                // Bot-Zug
                setTimeout(() => {
                    const botMove = BotAI.getMove(game.board, game.botSymbol, game.playerSymbol);
                    if (botMove !== null) {
                        const botResult = game.makeMove(botMove, game.botSymbol, false);
                        socket.emit('moveMade', {
                            position: botMove,
                            symbol: game.botSymbol,
                            board: game.board
                        });

                        if (botResult.winner || botResult.draw) {
                            const winnerName = botResult.winner === game.playerSymbol ? player.username : 'Bot';
                            socket.emit('gameEnd', {
                                winner: botResult.winner,
                                draw: botResult.draw,
                                winningLine: botResult.winningLine,
                                winnerName: botResult.draw ? null : winnerName
                            });
                            games.delete(data.gameId);
                        }
                    }
                }, 500);
            } else {
                // Multiplayer
                game.player1.socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });
                game.player2.socket.emit('moveMade', {
                    position: data.position,
                    symbol: playerSymbol,
                    board: game.board
                });

                if (result.winner || result.draw) {
                    let winnerName = null;
                    if (!result.draw) {
                        winnerName = result.winner === game.player1Symbol ? game.player1.username : game.player2.username;
                    }

                    const endData = {
                        winner: result.winner,
                        draw: result.draw,
                        winningLine: result.winningLine,
                        winnerName: winnerName
                    };

                    game.player1.socket.emit('gameEnd', endData);
                    game.player2.socket.emit('gameEnd', endData);

                    // Wenn Serie, nächstes Spiel starten
                    if (game.options && game.options.matchCount > 1) {
                        game.currentMatch++;
                        
                        if (game.currentMatch < game.options.matchCount) {
                            // Nächstes Spiel in der Serie
                            setTimeout(() => {
                                game.reset();
                                
                                const p1Symbol = Math.random() < 0.5 ? 'X' : 'O';
                                const p2Symbol = p1Symbol === 'X' ? 'O' : 'X';
                                game.player1Symbol = p1Symbol;
                                game.player2Symbol = p2Symbol;
                                game.currentPlayer = 'X';

                                game.player1.socket.emit('nextMatch', {
                                    matchNumber: game.currentMatch + 1,
                                    totalMatches: game.options.matchCount,
                                    scores: game.scores,
                                    symbol: p1Symbol,
                                    isPlayer1: true
                                });

                                game.player2.socket.emit('nextMatch', {
                                    matchNumber: game.currentMatch + 1,
                                    totalMatches: game.options.matchCount,
                                    scores: game.scores,
                                    symbol: p2Symbol,
                                    isPlayer1: false
                                });
                            }, 3000);
                        } else {
                            // Serie beendet
                            setTimeout(() => {
                                game.player1.socket.emit('seriesEnd', {
                                    scores: game.scores,
                                    player1Name: game.player1.username,
                                    player2Name: game.player2.username
                                });
                                game.player2.socket.emit('seriesEnd', {
                                    scores: game.scores,
                                    player1Name: game.player1.username,
                                    player2Name: game.player2.username
                                });
                                games.delete(data.gameId);
                            }, 3000);
                        }
                    } else {
                        games.delete(data.gameId);
                    }
                }
            }
        }
    });

    // Parkour Game - Search for match
    socket.on('searchParkour', () => {
        const player = players.get(socket.id);
        console.log(`[Parkour] Search request from ${socket.id}, player exists: ${!!player}`);
        
        if (!player) {
            console.log(`[Parkour] Player not registered: ${socket.id}`);
            return;
        }

        // Check if already waiting
        if (waitingParkourPlayers.includes(socket.id)) {
            console.log(`[Parkour] Player already in queue: ${player.username}`);
            return;
        }

        // Add to waiting list
        waitingParkourPlayers.push(socket.id);
        socket.emit('parkourSearching');
        
        console.log(`[Parkour] ${player.username} added to queue. Queue size: ${waitingParkourPlayers.length}`);
        console.log(`[Parkour] Current queue: ${waitingParkourPlayers.map(id => players.get(id)?.username || id).join(', ')}`);

        // Try to match immediately if 2+ players
        if (waitingParkourPlayers.length >= 2) {
            console.log(`[Parkour] Attempting to match 2 players...`);
            
            const player1Id = waitingParkourPlayers.shift();
            const player2Id = waitingParkourPlayers.shift();

            const player1 = players.get(player1Id);
            const player2 = players.get(player2Id);

            if (!player1 || !player2) {
                console.log(`[Parkour] Match failed - player disconnected`);
                // One player disconnected, add remaining back to queue
                if (player1) waitingParkourPlayers.unshift(player1Id);
                if (player2) waitingParkourPlayers.unshift(player2Id);
                return;
            }

            // Create parkour game
            const gameId = `parkour_${player1Id}_${player2Id}_${Date.now()}`;
            parkourGames.set(gameId, {
                id: gameId,
                player1: player1,
                player2: player2,
                currentLevel: 1,
                startTime: Date.now()
            });

            console.log(`[Parkour] Game created: ${gameId}`);
            console.log(`[Parkour] Players: ${player1.username} (${player1Id}) vs ${player2.username} (${player2Id})`);

            // Notify both players using io.to()
            const gameData1 = {
                gameId: gameId,
                player1Id: player1Id,
                player2Id: player2Id,
                player1Name: player1.username,
                player2Name: player2.username,
                teammate: player2Id
            };

            const gameData2 = {
                gameId: gameId,
                player1Id: player1Id,
                player2Id: player2Id,
                player1Name: player1.username,
                player2Name: player2.username,
                teammate: player1Id
            };

            io.to(player1Id).emit('parkourGameStart', gameData1);
            io.to(player2Id).emit('parkourGameStart', gameData2);

            console.log(`[Parkour] Game start events sent to both players`);
        }
    });

    // Cancel parkour search
    socket.on('cancelParkourSearch', () => {
        const index = waitingParkourPlayers.indexOf(socket.id);
        if (index > -1) {
            waitingParkourPlayers.splice(index, 1);
        }
    });

    // Parkour player movement
    socket.on('parkourMove', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;

        // Send to opponent
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourPlayerMove', {
            playerId: socket.id,
            x: data.x,
            y: data.y,
            velocityX: data.velocityX,
            velocityY: data.velocityY
        });
    });

    // Parkour rope – forward to opponent
    socket.on('parkourRope', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourRope', data);
    });

    // Parkour rope reset – forward to opponent
    socket.on('parkourRopeReset', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourRopeReset');
    });

    // Level complete – only advance when BOTH players are at the finish
    socket.on('parkourLevelComplete', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;

        if (!game.playersAtFinish) game.playersAtFinish = new Set();

        // Ignore duplicate signals from the same player
        if (game.playersAtFinish.has(socket.id)) return;

        game.playersAtFinish.add(socket.id);

        // Notify the teammate that this player arrived
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourTeammateAtFinish');

        console.log(`[Parkour] Player ${socket.id} at finish. Waiting for teammate. (${game.playersAtFinish.size}/2)`);

        // Only advance when both are there
        if (game.playersAtFinish.has(game.player1.id) && game.playersAtFinish.has(game.player2.id)) {
            game.playersAtFinish.clear();
            game.currentLevel++;

            console.log(`[Parkour] Both at finish! Moving to level ${game.currentLevel}`);

            const MAX_LEVEL = 100;
            if (game.currentLevel > MAX_LEVEL) {
                console.log(`[Parkour] All levels complete! Game ${data.gameId} finished`);
                io.to(game.player1.id).emit('parkourGameComplete');
                io.to(game.player2.id).emit('parkourGameComplete');
                parkourGames.delete(data.gameId);
            } else {
                io.to(game.player1.id).emit('parkourNextLevel', { level: game.currentLevel });
                io.to(game.player2.id).emit('parkourNextLevel', { level: game.currentLevel });
            }
        }
    });

    // Parkour respawn broadcast (so teammate sees it)
    socket.on('parkourRespawn', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourPlayerRespawn', { playerId: socket.id });
    });

    // Leave parkour game
    socket.on('leaveParkour', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;

        console.log(`[Parkour] Player left game ${data.gameId}`);
        const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
        io.to(opponentId).emit('parkourOpponentLeft');
        parkourGames.delete(data.gameId);
    });

    // Trennung
    socket.on('disconnect', () => {
        console.log(`Spieler getrennt: ${socket.id}`);
        
        const player = players.get(socket.id);
        if (player) {
            // Aus Warteliste entfernen
            const index = waitingPlayers.findIndex(p => p.id === socket.id);
            if (index !== -1) {
                waitingPlayers.splice(index, 1);
            }

            // Aus Lobby entfernen
            lobbies.forEach((lobby, lobbyId) => {
                if (lobby.player1.id === socket.id || lobby.player2.id === socket.id) {
                    const opponentId = lobby.player1.id === socket.id ? lobby.player2.id : lobby.player1.id;
                    io.to(opponentId).emit('opponentLeftLobby');
                    lobbies.delete(lobbyId);
                }
            });
        }

        // Spiel beenden wenn Spieler disconnected
        games.forEach((game, gameId) => {
            if (game.isBot && game.player1.id === socket.id) {
                games.delete(gameId);
            } else if (!game.isBot) {
                if (game.player1.id === socket.id || game.player2.id === socket.id) {
                    const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
                    io.to(opponentId).emit('opponentDisconnected');
                    games.delete(gameId);
                }
            }
        });

        // Parkour-Spiel beenden wenn Spieler disconnected
        const parkourWaitingIndex = waitingParkourPlayers.indexOf(socket.id);
        if (parkourWaitingIndex > -1) {
            waitingParkourPlayers.splice(parkourWaitingIndex, 1);
        }

        parkourGames.forEach((game, gameId) => {
            if (game.player1.id === socket.id || game.player2.id === socket.id) {
                const opponentId = game.player1.id === socket.id ? game.player2.id : game.player1.id;
                io.to(opponentId).emit('parkourOpponentLeft');
                parkourGames.delete(gameId);
            }
        });

        // Chess-Spiel beenden wenn Spieler disconnected
        const chessWaitIdx = waitingChessPlayers.findIndex(p => p.id === socket.id);
        if (chessWaitIdx !== -1) waitingChessPlayers.splice(chessWaitIdx, 1);

        chessGames.forEach((game, gameId) => {
            if (game.player1.id === socket.id || (game.player2 && game.player2.id === socket.id)) {
                const opponentSocket = game.player1.id === socket.id
                    ? (game.player2 ? game.player2.socket : null)
                    : game.player1.socket;
                if (opponentSocket) opponentSocket.emit('chessOpponentLeft');
                chessGames.delete(gameId);
            }
        });

        players.delete(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
