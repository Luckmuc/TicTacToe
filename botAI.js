class BotAI {
    static getMove(board, botSymbol = 'O', playerSymbol = 'X') {
        // Minimax-Algorithmus für intelligente Bot-Züge
        
        // Zuerst prüfen ob Bot gewinnen kann
        const winningMove = this.findWinningMove(board, botSymbol);
        if (winningMove !== null) return winningMove;

        // Dann prüfen ob Spieler blockiert werden muss
        const blockingMove = this.findWinningMove(board, playerSymbol);
        if (blockingMove !== null) return blockingMove;

        // Zentrum bevorzugen
        if (board[4] === null) return 4;

        // Ecken bevorzugen
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(pos => board[pos] === null);
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }

        // Sonst irgendein freies Feld
        const availableMoves = board
            .map((cell, index) => cell === null ? index : null)
            .filter(index => index !== null);

        if (availableMoves.length > 0) {
            return availableMoves[Math.floor(Math.random() * availableMoves.length)];
        }

        return null;
    }

    static findWinningMove(board, symbol) {
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
            const values = [board[a], board[b], board[c]];
            const symbolCount = values.filter(v => v === symbol).length;
            const nullCount = values.filter(v => v === null).length;

            if (symbolCount === 2 && nullCount === 1) {
                if (board[a] === null) return a;
                if (board[b] === null) return b;
                if (board[c] === null) return c;
            }
        }

        return null;
    }
}

module.exports = BotAI;
