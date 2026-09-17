// Tema
function updateThemeButton(theme) {
    const button = document.getElementById('themeBtn');
    button.textContent = theme === 'dark' ? '☀' : '☾';
    button.setAttribute('aria-label', theme === 'dark' ? 'Uključi svijetli način' : 'Uključi tamni način');
}
(function () {
    const t = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', t);
    document.addEventListener('DOMContentLoaded', function () {
        updateThemeButton(t);
    });
})();
function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeButton(next);
}

function switchLeague(selectEl) {
    if (!selectEl || !selectEl.value) return;
    window.location.href = selectEl.value;
}

// The ETL output is the single source of truth for the table and calculator.
let rounds = [];
let PLAYERS = {};
let sortedPlayers = [];
let ALL_PLAYERS = [];
let KOLO_LABELS = [];
let standingsRows = [];
const formatDate = date => new Intl.DateTimeFormat('hr-HR', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC'
}).format(new Date(`${date}T00:00:00Z`));

function validStandings(data) {
    const idPlayers = Array.isArray(data?.players) && data.players.length > 0 && data.players.every(player =>
        player && typeof player === 'object' && !Array.isArray(player) &&
        (typeof player.id === 'string' || typeof player.id === 'number') &&
        String(player.id).trim() && typeof player.name === 'string' && player.name.trim());
    const legacyPlayers = Array.isArray(data?.players) &&
        data.players.every(name => typeof name === 'string' && name.trim());
    const ids = idPlayers ? data.players.map(player => String(player.id)) : [];
    if (idPlayers && (new Set(ids).size !== ids.length ||
        data.rounds?.some(round => Object.keys(round?.scores || {}).some(id => !ids.includes(id))))) return false;
    return data && typeof data.competition === 'string' &&
        typeof data.brandSeason === 'string' && typeof data.pageTitle === 'string' &&
        typeof data.footerText === 'string' && (idPlayers || legacyPlayers) &&
        Array.isArray(data.rounds) && data.rounds.length > 0 &&
        data.rounds.every(round => /^\d{4}-\d{2}-\d{2}$/.test(round.date) &&
            !Number.isNaN(Date.parse(`${round.date}T00:00:00Z`)) &&
            round.scores && !Array.isArray(round.scores) &&
            Object.values(round.scores).every(score => Number.isFinite(score) && score >= 0));
}

async function loadStandings() {
    try {
        const response = await fetch('data/standings.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!validStandings(data)) throw new Error('Invalid standings data');

        rounds = data.rounds;
        const idPlayers = data.players.length > 0 && typeof data.players[0] === 'object';
        const playerList = idPlayers
            ? data.players.map(player => ({ id: String(player.id), name: player.name }))
            : [...new Set([...data.players, ...rounds.flatMap(round => Object.keys(round.scores))])]
                .map(name => ({ id: name, name }));
        PLAYERS = Object.fromEntries(playerList.map(player => {
            const kolo = rounds.map(round => Object.hasOwn(round.scores, player.id) ? round.scores[player.id] : null);
            return [player.id, { ...player, kolo, total: kolo.reduce((sum, score) => sum + (score || 0), 0) }];
        }));
        sortedPlayers = playerList.map((player, order) => ({ ...PLAYERS[player.id], order }))
            .sort((a, b) => b.total - a.total || a.order - b.order);
        ALL_PLAYERS = [...playerList].sort((a, b) => a.name.localeCompare(b.name, 'hr'));
        KOLO_LABELS = rounds.map((round, index) => `Kolo ${index + 1} · ${formatDate(round.date)}`);

        renderStandings();
        standingsRows = [...document.querySelectorAll('#tableBody tr')];
        document.title = data.pageTitle;
        document.querySelector('.brand').setAttribute('aria-label', `Modesto ${data.brandSeason}`);
        document.getElementById('brandSeason').textContent = data.brandSeason;
        document.getElementById('competitionLabel').textContent = data.competition;
        document.getElementById('calculatorCompetition').textContent = data.competition;
        document.getElementById('footerText').textContent = data.footerText;
        document.querySelector('table').setAttribute('aria-label', `Poredak igrača ${data.competition} Modesto`);
        const playerCount = `${standingsRows.length} ${standingsRows.length === 1 ? 'igrač' : 'igrača'}`;
        document.getElementById('playerCount').textContent = playerCount;
        document.getElementById('standingsCount').textContent = playerCount;
        document.getElementById('roundCount').textContent = `${rounds.length} ${rounds.length === 1 ? 'kolo' : 'kola'}`;
        document.getElementById('lastUpdated').textContent = formatDate(rounds.at(-1).date);
        document.getElementById('loadingState').hidden = true;
        document.querySelector('table').hidden = false;
        document.getElementById('playerSearch').disabled = false;
        document.querySelector('.header-actions .primary').disabled = false;
    } catch (error) {
        console.error('Unable to load standings:', error);
        document.getElementById('loadingState').hidden = true;
        document.getElementById('loadError').hidden = false;
    }
}

function makeCell(tag, className, text) {
    const cell = document.createElement(tag);
    if (className) cell.className = className;
    cell.textContent = text;
    if (tag === 'th') cell.scope = 'col';
    return cell;
}

function renderStandings() {
    const head = document.getElementById('tableHead');
    head.replaceChildren(makeCell('th', '', 'Mjesto'), makeCell('th', '', 'Igrač'));
    rounds.forEach((round, index) => {
        const cell = makeCell('th', '', `Kolo ${index + 1}`);
        const date = document.createElement('small');
        date.textContent = formatDate(round.date);
        cell.appendChild(date);
        head.appendChild(cell);
    });
    head.appendChild(makeCell('th', '', 'Ukupno'));

    const fragment = document.createDocumentFragment();
    sortedPlayers.forEach((player, index) => {
        const row = document.createElement('tr');
        if (index < 3) row.classList.add('top3');
        row.dataset.name = player.name;
        row.dataset.playerId = player.id;
        row.appendChild(makeCell('td', 'rang', String(index + 1)));
        const nameCell = makeCell('td', 'name', player.name);
        const mobileRounds = document.createElement('div');
        mobileRounds.className = 'mobile-rounds';
        player.kolo.forEach((score, roundIndex) => {
            const round = document.createElement('span');
            round.textContent = `K${roundIndex + 1} ${score === null ? '—' : score}`;
            mobileRounds.appendChild(round);
        });
        nameCell.appendChild(mobileRounds);
        row.appendChild(nameCell);
        player.kolo.forEach(score => row.appendChild(makeCell('td', 'round-score', score === null ? '—' : String(score))));
        row.appendChild(makeCell('td', 'total', String(player.total)));
        fragment.appendChild(row);
        PLAYERS[player.id].rang = index + 1;
    });
    document.getElementById('tableBody').replaceChildren(fragment);
}

// Odabrani igrači
let selected = { 1: null, 2: null };

// Stavke popisa igrača
function buildList(n, filter) {
    const list = document.getElementById('list' + n);
    const q = filter.toLowerCase();
    const matches = ALL_PLAYERS.filter(player => player.name.toLowerCase().includes(q));
    list.replaceChildren();
    if (matches.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'dropdown-item no-results';
        empty.textContent = 'Nema rezultata';
        list.appendChild(empty);
    } else {
        matches.forEach((player, index) => {
            const item = document.createElement('div');
            item.className = `dropdown-item${player.id === selected[n] ? ' active' : ''}`;
            item.id = `option-${n}-${index}`;
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(player.id === selected[n]));
            item.dataset.playerId = player.id;
            item.textContent = player.name;
            item.addEventListener('mousedown', event => event.preventDefault());
            item.addEventListener('click', () => selectPlayer(n, player.id));
            list.appendChild(item);
        });
    }
}

function openList(n) {
    buildList(n, document.getElementById('search' + n).value);
    document.getElementById('list' + n).classList.add('open');
    document.getElementById('search' + n).setAttribute('aria-expanded', 'true');
}

function closeList(n) {
    setTimeout(() => {
        if (document.activeElement === document.getElementById('search' + n)) return;
        document.getElementById('list' + n).classList.remove('open');
        document.getElementById('search' + n).setAttribute('aria-expanded', 'false');
    }, 150);
}

function updateClearButton(n) {
    document.getElementById('clear' + n).hidden = !document.getElementById('search' + n).value;
}

function filterList(n) {
    const val = document.getElementById('search' + n).value;
    if (selected[n] && val !== PLAYERS[selected[n]].name) {
        selected[n] = null;
        document.getElementById('search' + n).classList.remove('selected');
        calculate();
    }
    updateClearButton(n);
    buildList(n, val);
    document.getElementById('list' + n).classList.add('open');
    document.getElementById('search' + n).setAttribute('aria-expanded', 'true');
}

function selectPlayer(n, id) {
    selected[n] = id;
    document.getElementById('search' + n).value = PLAYERS[id].name;
    document.getElementById('search' + n).classList.add('selected');
    document.getElementById('list' + n).classList.remove('open');
    document.getElementById('search' + n).setAttribute('aria-expanded', 'false');
    document.getElementById('search' + n).removeAttribute('aria-activedescendant');
    updateClearButton(n);
    calculate();
}

function clearPlayer(n) {
    const input = document.getElementById('search' + n);
    input.value = '';
    input.classList.remove('selected');
    input.removeAttribute('aria-activedescendant');
    selected[n] = null;
    updateClearButton(n);
    calculate();
    input.focus();
    openList(n);
}

[1, 2].forEach(n => {
    document.getElementById('search' + n).addEventListener('keydown', event => {
        const input = event.currentTarget;
        const list = document.getElementById('list' + n);
        if (event.key === 'Escape') {
            list.classList.remove('open');
            input.setAttribute('aria-expanded', 'false');
            input.removeAttribute('aria-activedescendant');
            return;
        }
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            if (!list.classList.contains('open')) openList(n);
            const options = [...list.querySelectorAll('[role="option"]')];
            if (!options.length) return;
            const current = options.findIndex(option => option.id === input.getAttribute('aria-activedescendant'));
            const next = event.key === 'ArrowDown' ? (current + 1) % options.length : (current - 1 + options.length) % options.length;
            options.forEach(option => option.classList.remove('active'));
            options[next].classList.add('active');
            options[next].scrollIntoView({ block: 'nearest' });
            input.setAttribute('aria-activedescendant', options[next].id);
        } else if (event.key === 'Enter' && list.classList.contains('open')) {
            const active = list.querySelector('.dropdown-item.active[role="option"]') || list.querySelector('[role="option"]');
            if (active) { event.preventDefault(); selectPlayer(n, active.dataset.playerId); }
        }
    });
});

function toggleCalc() {
    const dialog = document.getElementById('calculatorDialog');
    if (dialog.open) return;
    dialog.showModal();
    document.getElementById('search1').focus();
}
function closeCalc() {
    document.getElementById('calculatorDialog').close();
}
const calculatorDialog = document.getElementById('calculatorDialog');
calculatorDialog.addEventListener('cancel', event => event.preventDefault());

// Pretraživanje postojeće tablice bez promjene poretka ili bodova.
const normalizeName = value => value.toLocaleLowerCase('hr').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
document.getElementById('playerSearch').addEventListener('input', event => {
    const query = normalizeName(event.target.value.trim());
    let count = 0;
    standingsRows.forEach(row => {
        const match = normalizeName(row.dataset.name).includes(query);
        row.hidden = !match;
        if (match) count++;
    });
    document.getElementById('standingsCount').textContent = `${count} igrača`;
    document.getElementById('emptyState').hidden = count !== 0;
});
// Okvirni pragovi za parove kada konačni parovi još nisu poznati.
function estimatePairStanding(p1, p2, total) {
    const otherScores = Object.entries(PLAYERS)
        .filter(([id]) => id !== p1 && id !== p2)
        .map(([, player]) => player.total);
    const top8 = [];
    const top16 = [];
    const positions = [];
    let inTop8 = 0;
    let inTop16 = 0;
    let seed = 20260731;
    const random = () => {
        seed = (seed + 0x6D2B79F5) | 0;
        let value = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        value = (value + Math.imul(value ^ (value >>> 7), 61 | value)) ^ value;
        return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
    };
    for (let trial = 0; trial < 1000; trial++) {
        const shuffled = otherScores.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        const pairs = [];
        for (let i = 0; i + 1 < shuffled.length; i += 2) {
            pairs.push(shuffled[i] + shuffled[i + 1]);
        }
        pairs.sort((a, b) => b - a);
        top8.push(pairs[7] + 1);
        top16.push(pairs[15] + 1);
        // Kod izjednačenja računamo nepovoljniji plasman.
        const position = 1 + pairs.filter(score => score >= total).length;
        positions.push(position);
        if (position <= 8) inTop8++;
        if (position <= 16) inTop16++;
    }
    const median = values => values.sort((a, b) => a - b)[Math.floor(values.length / 2)];
    return {
        rank: median(positions), top8: median(top8), top16: median(top16),
        top8Chance: Math.round(inTop8 / 10), top16Chance: Math.round(inTop16 / 10),
        pairCount: 1 + Math.floor(otherScores.length / 2)
    };
}

function calculate() {
    const p1 = selected[1];
    const p2 = selected[2];
    const result = document.getElementById('calcResult');
    const error = document.getElementById('calcError');

    document.querySelectorAll('tr.highlighted').forEach(r => r.classList.remove('highlighted'));

    error.hidden = true;
    if (!p1 || !p2) { result.classList.remove('visible'); return; }
    if (p1 === p2) {
        result.classList.remove('visible');
        error.hidden = false;
        return;
    }

    const d1 = PLAYERS[p1];
    const d2 = PLAYERS[p2];
    const combined = d1.total + d2.total;

    document.getElementById('resultNames').textContent = d1.name + ' + ' + d2.name;
    document.getElementById('resultTotal').innerHTML = combined + '<span>bodova ukupno</span>';

    const breakdown = document.getElementById('resultBreakdown');
    breakdown.replaceChildren();
    KOLO_LABELS.forEach((label, i) => {
        const pts = (d1.kolo[i] || 0) + (d2.kolo[i] || 0);
        const item = document.createElement('div');
        item.className = 'breakdown-item';
        const title = document.createElement('div');
        title.className = 'bk-label';
        title.textContent = label;
        const score = document.createElement('div');
        score.textContent = pts;
        item.append(title, score);
        breakdown.appendChild(item);
    });

    const estimate = estimatePairStanding(p1, p2, combined);
    document.getElementById('forecastRank').textContent = `${estimate.rank}. / ${estimate.pairCount}`;
    document.getElementById('top16Target').textContent = `oko ${estimate.top16} bodova`;
    document.getElementById('top8Target').textContent = `oko ${estimate.top8} bodova`;
    document.getElementById('top16Chance').textContent = `Vaš par: u ${estimate.top16Chance} % simulacija`;
    document.getElementById('top8Chance').textContent = `Vaš par: u ${estimate.top8Chance} % simulacija`;

    result.classList.add('visible');

    document.querySelectorAll('#tableBody tr').forEach(row => {
        if (row.dataset.playerId === p1 || row.dataset.playerId === p2) {
            row.classList.add('highlighted');
        }
    });
}

loadStandings();
