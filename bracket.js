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

// Round positions stay fixed; the API supplies the pairs in each draw slot.
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

const BRACKET_API_URL = 'https://srsbckndbzns.eu.pythonanywhere.com/api/bracket';
let bracketLoaded = false;
let bracketRequestPending = false;
let lastBracketSnapshot = '';

function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
}

function participantRow(seed, source, teams, winnerSeed, scoreText = '') {
    const row = element('div', 'bracket-entry');
    if (seed === null) {
        const link = element('a', 'entry-source', `Pobjednik ${source}`);
        link.href = `#game-${source}`;
        row.appendChild(link);
        return row;
    }
    const team = teams.get(seed);
    row.dataset.seed = seed;
    row.classList.toggle('is-winner', seed === winnerSeed);
    row.appendChild(element('span', 'entry-seed', String(seed)));
    const copy = element('div', 'entry-copy');
    copy.appendChild(element('span', 'entry-name', team.name));
    if (scoreText) copy.appendChild(element('small', 'entry-score', scoreText));
    if (team.tied) {
        copy.title = 'Izjednačeni bodovi. Raspored je privremen.';
        copy.appendChild(element('span', 'sr-only', 'Izjednačeni bodovi. Raspored je privremen.'));
    }
    if (seed === winnerSeed) copy.appendChild(element('span', 'sr-only', 'Pobjednik utakmice'));
    row.appendChild(copy);
    return row;
}

function renderSide(side, teams, matches) {
    const container = document.getElementById(side.target);
    const positions = new Map();
    side.rounds.forEach((round, roundIndex) => {
        const column = element('section', 'bracket-round');
        column.style.setProperty('--round', roundIndex);
        column.setAttribute('aria-label', round.title);
        column.appendChild(element('h3', '', round.title));
        round.games.forEach(game => {
            const match = element('article', 'bracket-match');
            match.dataset.match = game.id;
            match.style.setProperty('--match-y', `${game.y}px`);
            match.style.setProperty('--compact-y', `${game.y * 0.7 - 20}px`);
            const gameTitle = element('h4', 'match-id', game.id);
            gameTitle.id = `game-${game.id}`;
            match.setAttribute('aria-labelledby', gameTitle.id);
            match.appendChild(gameTitle);
            matches.get(game.id).sources.forEach(entry => match.appendChild(participantRow(
                typeof entry === 'number' ? entry : null, entry, teams, null)));
            column.appendChild(match);
            positions.set(game.id, { roundIndex, y: game.y });
        });
        container.appendChild(column);
    });
    for (const compact of [false, true]) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.classList.add('bracket-lines');
        svg.classList.add(compact ? 'bracket-lines-mobile' : 'bracket-lines-desktop');
        svg.setAttribute('viewBox', `0 0 1000 ${compact ? 500 : 720}`);
        svg.setAttribute('preserveAspectRatio', 'none');
        svg.setAttribute('aria-hidden', 'true');
        side.rounds.forEach((round, i) => round.games.forEach(game => {
            game.entries.forEach((entry, j) => {
                if (typeof entry !== 'string') return;
                const child = positions.get(entry);
                const startX = child.roundIndex * 250 + 235;
                const endX = i * 250 + 15;
                const centerY = compact ? game.y * 0.7 - 20 : game.y;
                const startY = compact ? child.y * 0.7 - 20 : child.y;
                const endY = centerY + (j === 0 ? -1 : 1) * (compact ? 36 : 40);
                const midX = (startX + endX) / 2;
                const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                path.setAttribute('d', `M ${startX} ${startY} H ${midX} V ${endY} H ${endX}`);
                svg.appendChild(path);
            });
        }));
        container.appendChild(svg);
    }
}

function scoreLines(score) {
    if (!score.trim()) return ['', ''];
    const sets = score.trim().split(/\s*[,;]\s*|\s+(?=\d+(?:\(\d+\))?\s*[:-])/)
        .map(set => set.match(/^\s*(\d+(?:\(\d+\))?)\s*[:-]\s*(\d+(?:\(\d+\))?)\s*$/));
    // Scores follow the editor's Par A : Par B order. Keep free-text results intact.
    return sets.every(Boolean)
        ? [sets.map(set => set[1]).join('  ·  '), sets.map(set => set[2]).join('  ·  ')]
        : [`Rezultat: ${score}`, ''];
}

function updateMatches(matches, teams) {
    matches.forEach(game => {
        const card = document.querySelector(`[data-match="${game.id}"]`);
        let title = card.querySelector('.match-id');
        if (!title) {
            title = element('h3', 'match-id');
            title.id = `game-${game.id}`;
            card.prepend(title);
            card.setAttribute('aria-labelledby', title.id);
        }
        title.replaceChildren(document.createTextNode(game.id));
        if (game.scheduled_at) {
            const [date, clock] = game.scheduled_at.split('T');
            const [, month, day] = date.split('-');
            const court = game.court ? ` · ${game.court}` : '';
            const time = element('time', 'match-time', `${day}.${month}. ${clock}${court}`);
            time.dateTime = game.scheduled_at;
            time.title = `${date} ${clock}${court} · Europe/Zagreb`;
            title.append(document.createTextNode(' · '), time);
        }
        card.querySelectorAll('.bracket-entry, .match-result').forEach(node => node.remove());
        const scores = scoreLines(game.score);
        game.participants.forEach((seed, i) => card.appendChild(participantRow(
            seed, game.sources[i], teams, game.winner_seed, scores[i])));
    });
}

function validateMatches(matches, teams) {
    const expected = new Map(drawSides.flatMap(side => side.rounds.flatMap(round =>
        round.games.map(game => [game.id, game.entries]))));
    expected.set('F-1', ['SF-1', 'SF-2']);
    if (!Array.isArray(matches) || matches.length !== expected.size ||
        new Set(matches.map(game => game.id)).size !== expected.size) return false;
    const byId = new Map(matches.map(game => [game.id, game]));
    const seededEntries = matches.flatMap(game => Array.isArray(game.sources)
        ? game.sources.filter(source => typeof source === 'number') : []);
    if (seededEntries.length !== 16 || new Set(seededEntries).size !== 16) return false;
    return matches.every(game => {
        const expectedSources = expected.get(game.id);
        const sources = game.sources;
        if (!expectedSources || !Array.isArray(sources) || sources.length !== 2 ||
            !sources.every((source, index) => typeof expectedSources[index] === 'number'
                ? Number.isInteger(source) && teams.has(source) : source === expectedSources[index]) ||
            !Array.isArray(game.participants) || game.participants.length !== 2 ||
            typeof game.score !== 'string' || typeof game.scheduled_at !== 'string' ||
            (game.scheduled_at && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(game.scheduled_at))) return false;
        if (!game.participants.every((seed, index) =>
            (seed === null || teams.has(seed)) && seed === (typeof sources[index] === 'number'
                ? sources[index] : byId.get(sources[index])?.winner_seed))) return false;
        return game.winner_seed === null || (!game.participants.includes(null) && game.participants.includes(game.winner_seed));
    });
}

async function loadBracket() {
    if (bracketRequestPending) return;
    bracketRequestPending = true;
    try {
        const response = await fetch(BRACKET_API_URL, { cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(10000) });
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
        if (!validateMatches(data.matches, teams)) throw new Error('Invalid matches');
        if (!bracketLoaded) {
            const matches = new Map(data.matches.map(game => [game.id, game]));
            drawSides.forEach(side => renderSide(side, teams, matches));
        }
        const snapshot = JSON.stringify({ teams: data.teams, matches: data.matches });
        if (snapshot !== lastBracketSnapshot) {
            updateMatches(data.matches, teams);
            lastBracketSnapshot = snapshot;
        }
        bracketLoaded = true;
        document.getElementById('tournamentBracket').hidden = false;
        document.getElementById('bracketError').hidden = true;
    } catch (error) {
        document.getElementById('bracketError').textContent = bracketLoaded
            ? 'Osvježavanje nije uspjelo. Prikazani su posljednji dostupni rezultati.'
            : 'Ždrijeb trenutačno nije dostupan. Pokušajte osvježiti stranicu.';
        document.getElementById('bracketError').hidden = false;
        console.error('Unable to load bracket:', error);
    } finally {
        document.getElementById('bracketLoading').hidden = true;
        bracketRequestPending = false;
    }
}
loadBracket();
setInterval(() => { if (!document.hidden) loadBracket(); }, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) loadBracket(); });
