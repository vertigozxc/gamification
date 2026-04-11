const SAVE_KEY = 'rpg_save';
const CHARACTER_NAME_KEY = 'rpg_character_name';
function createDefaultState() {
    return {
        lvl: 1,
        xp: 0,
        xpNext: 100,
        stats: { str: 0, int: 0, sta: 0 },
        completed: [],
        logs: [],
        lastReset: Date.now()
    };
}

const DEFAULT_STATE = createDefaultState();

function cloneState(state) {
    try {
        return structuredClone(state);
    } catch {
        return JSON.parse(JSON.stringify(state));
    }
}

function normalizeState(state) {
    const normalized = cloneState(DEFAULT_STATE);
    if (!state || typeof state !== 'object') return normalized;

    normalized.lvl = typeof state.lvl === 'number' ? state.lvl : normalized.lvl;
    normalized.xp = typeof state.xp === 'number' ? state.xp : normalized.xp;
    normalized.xpNext = typeof state.xpNext === 'number' ? state.xpNext : normalized.xpNext;
    
    // Handle stats - preserve existing stats and add any custom ones
    if (typeof window.loadCustomStats === 'function') {
        const allStats = window.loadCustomStats();
        normalized.stats = {};
        allStats.forEach(stat => {
            normalized.stats[stat] = typeof state.stats?.[stat] === 'number' ? state.stats[stat] : 0;
        });
    } else {
        normalized.stats = {
            str: typeof state.stats?.str === 'number' ? state.stats.str : normalized.stats.str,
            int: typeof state.stats?.int === 'number' ? state.stats.int : normalized.stats.int,
            sta: typeof state.stats?.sta === 'number' ? state.stats.sta : normalized.stats.sta
        };
    }
    
    normalized.completed = Array.isArray(state.completed) ? state.completed : normalized.completed;
    normalized.logs = Array.isArray(state.logs) ? state.logs : normalized.logs;
    normalized.lastReset = typeof state.lastReset === 'number' ? state.lastReset : Date.now();
    return normalized;
}

window.loadState = function() {
    const saved = localStorage.getItem(SAVE_KEY);
    if (!saved) return normalizeState(null);

    try {
        const parsed = JSON.parse(saved);
        return normalizeState(parsed);
    } catch {
        return normalizeState(null);
    }
};

window.saveState = function(state) {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
};

window.saveCharacterName = function(name) {
    localStorage.setItem(CHARACTER_NAME_KEY, name);
};

window.loadCharacterName = function() {
    return localStorage.getItem(CHARACTER_NAME_KEY) || 'Warrior';
};

window.resetAll = function() {
    return createDefaultState();
};

window.resetDaily = function() {
    return {
        completed: [],
        lastReset: Date.now()
    };
};
