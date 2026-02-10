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
const parkourGames = new Map();
const waitingParkourPlayers = [];

io.on('connection', (socket) => {
    console.log(`Neuer Spieler verbunden: ${socket.id}`);

    // Spieler-Registrierung
    socket.on('register', (username) => {
        players.set(socket.id, {
            id: socket.id,
            username: username,
            socket: socket
        });
        console.log(`Spieler registriert: ${username} (${socket.id})`);
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
        if (!player) return;

        // Check if already waiting
        if (waitingParkourPlayers.includes(socket.id)) return;

        // Add to waiting list
        waitingParkourPlayers.push(socket.id);
        socket.emit('parkourSearching');
        
        console.log(`Parkour search: ${player.username}, Queue size: ${waitingParkourPlayers.length}`);

        // Try to match immediately if 2+ players
        if (waitingParkourPlayers.length >= 2) {
            const player1Id = waitingParkourPlayers.shift();
            const player2Id = waitingParkourPlayers.shift();

            const player1 = players.get(player1Id);
            const player2 = players.get(player2Id);

            if (!player1 || !player2) {
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

            // Notify both players
            player1.socket.emit('parkourGameStart', {
                gameId: gameId,
                player1Id: player1Id,
                player2Id: player2Id,
                player1Name: player1.username,
                player2Name: player2.username,
                teammate: player2Id
            });

            player2.socket.emit('parkourGameStart', {
                gameId: gameId,
                player1Id: player1Id,
                player2Id: player2Id,
                player1Name: player1.username,
                player2Name: player2.username,
                teammate: player1Id
            });

            console.log(`Parkour game started: ${gameId}`);
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
        const opponent = players.get(opponentId);
        if (opponent) {
            opponent.socket.emit('parkourPlayerMove', {
                playerId: socket.id,
                x: data.x,
                y: data.y,
                velocityX: data.velocityX,
                velocityY: data.velocityY
            });
        }
    });

    // Level complete
    socket.on('parkourLevelComplete', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;

        // Increment level
        game.currentLevel++;

        // Check if all levels complete (max 3 levels)
        if (game.currentLevel > 3) {
            game.player1.socket.emit('parkourGameComplete');
            game.player2.socket.emit('parkourGameComplete');
            parkourGames.delete(data.gameId);
        } else {
            // Start next level
            game.player1.socket.emit('parkourNextLevel', { level: game.currentLevel });
            game.player2.socket.emit('parkourNextLevel', { level: game.currentLevel });
        }
    });

    // Leave parkour game
    socket.on('leaveParkour', (data) => {
        const game = parkourGames.get(data.gameId);
        if (!game) return;

        const opponent = game.player1.id === socket.id ? game.player2 : game.player1;
        opponent.socket.emit('parkourOpponentLeft');
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
                    const opponent = lobby.player1.id === socket.id ? lobby.player2 : lobby.player1;
                    opponent.socket.emit('opponentLeftLobby');
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
                    const opponent = game.player1.id === socket.id ? game.player2 : game.player1;
                    opponent.socket.emit('opponentDisconnected');
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
                const opponent = game.player1.id === socket.id ? game.player2 : game.player1;
                opponent.socket.emit('parkourOpponentLeft');
                parkourGames.delete(gameId);
            }
        });

        players.delete(socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Server läuft auf Port ${PORT}`);
});
