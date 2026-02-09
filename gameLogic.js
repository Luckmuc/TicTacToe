class GameLogic {
    constructor(gameId, player1, player2, isBot = false, options = null) {
        this.gameId = gameId;
        this.player1 = player1;
        this.player2 = player2;
        this.isBot = isBot;
        this.options = options;
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
        this.currentMatch = 0;
        this.scores = {
            player1: 0,
            player2: 0,
            draws: 0
        };
    }

    reset() {
        this.board = Array(9).fill(null);
        this.currentPlayer = 'X';
    }

    makeMove(position, symbol, isPlayer1 = true) {
        if (this.board[position] !== null) {
            return { valid: false };
        }

        this.board[position] = symbol;
        
        const winner = this.checkWinner();
        const draw = !winner && this.board.every(cell => cell !== null);

        if (winner) {
            // Punkte aktualisieren
            if (this.options && this.options.competitive) {
                if (this.isBot) {
                    // Bei Bot: player1 ist immer der Mensch
                    if (winner === this.playerSymbol) {
                        this.scores.player1++;
                    } else {
                        this.scores.player2++;
                    }
                } else {
                    // Bei Multiplayer: Korrekt nach player1/player2 zuordnen
                    if (winner === this.player1Symbol) {
                        this.scores.player1++;
                    } else if (winner === this.player2Symbol) {
                        this.scores.player2++;
                    }
                }
            }
            return {
                valid: true,
                winner: winner,
                winningLine: this.getWinningLine()
            };
        }

        if (draw) {
            if (this.options && this.options.competitive) {
                this.scores.draws++;
            }
            return {
                valid: true,
                draw: true
            };
        }

        // Nächster Spieler
        this.currentPlayer = this.currentPlayer === 'X' ? 'O' : 'X';

        return { valid: true };
    }

    checkWinner() {
        const lines = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];

        for (const line of lines) {
            const [a, b, c] = line;
            if (this.board[a] && 
                this.board[a] === this.board[b] && 
                this.board[a] === this.board[c]) {
                this.winningLine = line;
                return this.board[a];
            }
        }

        return null;
    }

    getWinningLine() {
        return this.winningLine || null;
    }
}

module.exports = GameLogic;
