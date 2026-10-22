const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
const themeButton = document.getElementById('themeBtn');
function updateBracketTheme() {
    const dark = document.documentElement.getAttribute('data-theme') === 'dark';
    themeButton.textContent = dark ? '☀' : '☾';
    themeButton.setAttribute('aria-label', dark ? 'Uključi svijetli način' : 'Uključi tamni način');
}
updateBracketTheme();
themeButton.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateBracketTheme();
});

// Explicit paths keep the draw stable when pair totals are tied.
const drawSides = [
    { target: 'sideARounds', rounds: [
        { title: '1. kolo', games: [{ id: 'R1-1', entries: [9, 16], y: 280 }, { id: 'R1-2', entries: [12, 13], y: 600 }] },
        { title: '2. kolo', games: [{ id: 'R2-1', entries: [8, 'R1-1'], y: 240 }, { id: 'R2-2', entries: [5, 'R1-2'], y: 560 }] },
        { title: 'Četvrtfinale', games: [{ id: 'QF-1', entries: [1, 'R2-1'], y: 160 }, { id: 'QF-2', entries: [4, 'R2-2'], y: 480 }] },
        { title: 'Polufinale', games: [{ id: 'SF-1', entries: ['QF-1', 'QF-2'], y: 320 }] }
    ] },
    { target: 'sideBRounds', rounds: [
        { title: '1. kolo', games: [{ id: 'R1-3', entries: [10, 15], y: 280 }, { id: 'R1-4', entries: [11, 14], y: 600 }] },
        { title: '2. kolo', games: [{ id: 'R2-3', entries: [7, 'R1-3'], y: 240 }, { id: 'R2-4', entries: [6, 'R1-4'], y: 560 }] },
        { title: 'Četvrtfinale', games: [{ id: 'QF-3', entries: [2, 'R2-3'], y: 160 }, { id: 'QF-4', entries: [3, 'R2-4'], y: 480 }] },
        { title: 'Polufinale', games: [{ id: 'SF-2', entries: ['QF-3', 'QF-4'], y: 320 }] }
    ] }
];

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function renderSide(side, teams) {
    const container = document.getElementById(side.target);
    const positions = new Map();
    side.rounds.forEach((round, roundIndex) => {
        const column = element('section', 'bracket-round');
        column.style.setProperty('--round', roundIndex);
        column.setAttribute('aria-label', round.title);
        column.appendChild(element('h3', '', round.title));
        round.games.forEach(game => {
            const match = element('article', 'bracket-match');
            match.style.setProperty('--match-y', `${game.y}px`);
            const gameTitle = element('h4', 'match-id', game.id);
            gameTitle.id = `game-${game.id}`;
            match.setAttribute('aria-labelledby', gameTitle.id);
            match.appendChild(gameTitle);
            game.entries.forEach(entry => {
                const row = element('div', 'bracket-entry');
                if (typeof entry === 'number') {
                    const team = teams.get(entry);
                    row.appendChild(element('span', 'entry-seed', String(entry)));
                    const copy = element('div', 'entry-copy');
                    copy.appendChild(element('span', 'entry-name', team.name));
                    const points = element('small', 'entry-points', `${team.players[0].points} + ${team.players[1].points} = ${team.points}`);
                    points.setAttribute('aria-label', `${team.players[0].name}: ${team.players[0].points} bodova; ${team.players[1].name}: ${team.players[1].points} bodova; ukupno ${team.points}`);
                    copy.appendChild(points);
                    if (team.tied) {
                        copy.title = 'Izjednačeni bodovi. Raspored je privremen.';
                        copy.appendChild(element('span', 'sr-only', 'Izjednačeni bodovi. Raspored je privremen.'));
                    }
                    row.appendChild(copy);
                } else {
                    const link = element('a', 'entry-source', `Pobjednik ${entry}`);
                    link.href = `#game-${entry}`;
                    row.appendChild(link);
                }
                match.appendChild(row);
            });
            column.appendChild(match);
            positions.set(game.id, { roundIndex, y: game.y });
        });
        container.appendChild(column);
    });
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('bracket-lines');
    svg.setAttribute('viewBox', '0 0 1000 720');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    side.rounds.forEach((round, i) => round.games.forEach(game => {
        game.entries.forEach((entry, j) => {
            if (typeof entry !== 'string') return;
            const child = positions.get(entry);
            const startX = child.roundIndex * 250 + 235;
            const endX = i * 250 + 15;
            const endY = game.y + (j === 0 ? -40 : 40);
            const midX = (startX + endX) / 2;
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', `M ${startX} ${child.y} H ${midX} V ${endY} H ${endX}`);
            svg.appendChild(path);
        });
    }));
    container.appendChild(svg);
}

async function loadBracket() {
    try {
        const response = await fetch('data/bracket.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!Array.isArray(data.teams) || data.teams.length !== 16) throw new Error('Invalid draw');
        const teams = new Map(data.teams.map(team => [team.seed, team]));
        if (teams.size !== 16 || !Array.from({ length: 16 }, (_, i) => i + 1).every(seed => {
            const team = teams.get(seed);
            return team && typeof team.name === 'string' && team.players?.length === 2 &&
                team.players.every(player => Number.isFinite(player.points) && player.points >= 0) &&
                team.points === team.players.reduce((sum, player) => sum + player.points, 0);
        })) throw new Error('Invalid teams');
        drawSides.forEach(side => renderSide(side, teams));
        document.getElementById('tournamentBracket').hidden = false;
    } catch (error) {
        document.getElementById('bracketError').hidden = false;
        console.error('Unable to load bracket:', error);
    } finally {
        document.getElementById('bracketLoading').hidden = true;
    }
}
loadBracket();
