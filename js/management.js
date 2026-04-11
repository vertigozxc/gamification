// Quest and Stats Management System

const CUSTOM_QUESTS_KEY = 'rpg_custom_quests';
const CUSTOM_STATS_KEY = 'rpg_custom_stats';

// Load custom quests from localStorage
window.loadCustomQuests = function() {
    try {
        const saved = localStorage.getItem(CUSTOM_QUESTS_KEY);
        if (!saved) return [];
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Error loading custom quests:', error);
        return [];
    }
};

// Save custom quests to localStorage
window.saveCustomQuests = function(quests) {
    localStorage.setItem(CUSTOM_QUESTS_KEY, JSON.stringify(quests));
};

// Load custom stats from localStorage
window.loadCustomStats = function() {
    try {
        const saved = localStorage.getItem(CUSTOM_STATS_KEY);
        if (!saved) return ['str', 'int', 'sta'];
        const parsed = JSON.parse(saved);
        if (!Array.isArray(parsed)) return ['str', 'int', 'sta'];

        const sanitized = parsed
            .filter((item) => typeof item === 'string')
            .map((item) => item.toLowerCase().trim())
            .filter((item) => /^[a-z]{1,3}$/.test(item));

        if (sanitized.length === 0) return ['str', 'int', 'sta'];
        return Array.from(new Set(sanitized));
    } catch (error) {
        console.error('Error loading custom stats:', error);
        return ['str', 'int', 'sta'];
    }
};

// Save custom stats to localStorage
window.saveCustomStats = function(stats) {
    localStorage.setItem(CUSTOM_STATS_KEY, JSON.stringify(stats));
};

// Get next quest ID
function getNextQuestId() {
    const allQuests = window.QUESTS_DATA.concat(window.loadCustomQuests());
    return allQuests.length > 0 ? Math.max(...allQuests.map(q => q.id)) + 1 : 1;
}

// Add new quest
window.addQuest = function(title, desc, xp, stat) {
    const customQuests = window.loadCustomQuests();
    const newQuest = {
        id: getNextQuestId(),
        title,
        desc,
        xp: parseInt(xp),
        stat,
        icon: '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3 7h7l-5.5 4.5L18 22 12 16l-6 6 1.5-8.5L2 9h7z"/></svg>'
    };
    customQuests.push(newQuest);
    window.saveCustomQuests(customQuests);
    return newQuest;
};

// Edit quest
window.editQuest = function(id, title, desc, xp, stat) {
    const customQuests = window.loadCustomQuests();
    const questIndex = customQuests.findIndex(q => q.id === id);
    if (questIndex !== -1) {
        customQuests[questIndex] = {
            ...customQuests[questIndex],
            title,
            desc,
            xp: parseInt(xp),
            stat
        };
        window.saveCustomQuests(customQuests);
        return true;
    }
    return false;
};

// Remove quest
window.removeQuest = function(id) {
    const customQuests = window.loadCustomQuests();
    const filtered = customQuests.filter(q => q.id !== id);
    window.saveCustomQuests(filtered);
    return true;
};

// Add custom stat
window.addStat = function(statCode) {
    const customStats = window.loadCustomStats();
    if (!customStats.includes(statCode.toLowerCase())) {
        customStats.push(statCode.toLowerCase());
        window.saveCustomStats(customStats);
        
        // Update state with new stat
        if (window.state && window.state.stats) {
            window.state.stats[statCode.toLowerCase()] = 0;
            window.saveState(window.state);
        }
        
        return true;
    }
    return false;
};

// Remove custom stat
window.removeStat = function(statCode) {
    const customStats = window.loadCustomStats();
    const defaultStats = ['str', 'int', 'sta'];
    
    if (!defaultStats.includes(statCode) && customStats.includes(statCode)) {
        const filtered = customStats.filter(s => s !== statCode);
        window.saveCustomStats(filtered);
        return true;
    }
    return false;
};

// Get all quests (default + custom)
window.getAllQuests = function() {
    const customQuests = window.loadCustomQuests();
    return window.QUESTS_DATA.concat(customQuests);
};

// Get all stats
window.getAllStats = function() {
    return window.loadCustomStats();
};

// Render management panel
window.renderManagementPanel = function() {
    const container = document.getElementById('management-panel');
    if (!container) return;

    const customQuests = window.loadCustomQuests();
    const allStats = window.getAllStats();

    let html = `
        <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <!-- Quest Management -->
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-purple-600 rounded-2xl p-6">
                <h3 class="cinzel text-xl text-purple-400 mb-4">⚔️ Manage Quests</h3>
                
                <div class="mb-4 p-4 bg-slate-700 rounded-lg">
                    <input type="text" id="quest-title" placeholder="Quest title" class="w-full px-3 py-2 bg-slate-600 text-white rounded mb-2 text-sm">
                    <textarea id="quest-desc" placeholder="Quest description" class="w-full px-3 py-2 bg-slate-600 text-white rounded mb-2 text-sm" rows="2"></textarea>
                    <div class="grid grid-cols-3 gap-2 mb-2">
                        <input type="number" id="quest-xp" placeholder="XP" min="1" value="10" class="px-3 py-2 bg-slate-600 text-white rounded text-sm">
                        <select id="quest-stat" class="px-3 py-2 bg-slate-600 text-white rounded text-sm">
                            ${allStats.map(s => `<option value="${s}">${s.toUpperCase()}</option>`).join('')}
                        </select>
                        <button onclick="window.createNewQuest()" class="bg-green-700 hover:bg-green-600 text-white text-xs font-normal px-2 py-1 rounded transition" style="font-family:sans-serif;font-size:11px">
                            Add
                        </button>
                    </div>
                </div>

                <div class="space-y-2 max-h-[400px] overflow-y-auto">
                    ${customQuests.length === 0 ? '<p class="text-slate-400 text-sm">No custom quests yet</p>' : ''}
                    ${customQuests.map(q => `
                        <div class="bg-slate-700 p-3 rounded flex justify-between items-start">
                            <div class="flex-1">
                                <p class="text-white font-bold text-sm">${q.title}</p>
                                <p class="text-slate-300 text-xs">${q.desc}</p>
                                <p class="text-yellow-400 text-xs mt-1">${q.xp} XP • ${q.stat.toUpperCase()}</p>
                            </div>
                            <button onclick="window.removeQuestFromUI(${q.id})" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-bold transition">
                                ✕
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>

            <!-- Stats Management -->
            <div class="bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-blue-600 rounded-2xl p-6">
                <h3 class="cinzel text-xl text-blue-400 mb-4">📊 Manage Stats</h3>
                
                <div class="mb-4 p-4 bg-slate-700 rounded-lg">
                    <p class="text-slate-300 text-xs mb-2">Current Stats: ${allStats.map(s => s.toUpperCase()).join(', ')}</p>
                    <div class="flex gap-2">
                        <input type="text" id="new-stat" placeholder="New stat code (e.g. 'def', 'agi')" maxlength="3" class="flex-1 px-3 py-2 bg-slate-600 text-white rounded text-sm">
                        <button onclick="window.createNewStat()" class="bg-green-700 hover:bg-green-600 text-white text-xs font-normal px-2 py-1 rounded transition" style="font-family:sans-serif;font-size:11px">
                            Add
                        </button>
                    </div>
                </div>

                <div class="space-y-2">
                    ${allStats.map(s => {
                        const isDefault = ['str', 'int', 'sta'].includes(s);
                        return `
                            <div class="bg-slate-700 p-3 rounded flex justify-between items-center">
                                <span class="text-white font-bold">${s.toUpperCase()}</span>
                                <span class="text-slate-400 text-xs">${isDefault ? 'Default' : ''}</span>
                                ${!isDefault ? `
                                    <button onclick="window.removeStatFromUI('${s}')" class="bg-red-600 hover:bg-red-500 text-white px-2 py-1 rounded text-xs font-bold transition">
                                        ✕
                                    </button>
                                ` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    container.innerHTML = html;
};

// UI helper functions
window.createNewQuest = function() {
    const title = document.getElementById('quest-title')?.value?.trim();
    const desc = document.getElementById('quest-desc')?.value?.trim();
    const xp = document.getElementById('quest-xp')?.value;
    const stat = document.getElementById('quest-stat')?.value;

    if (!title || !desc || !xp || !stat) {
        alert('Please fill in all quest fields');
        return;
    }

    window.addQuest(title, desc, xp, stat);
    
    // Clear inputs
    document.getElementById('quest-title').value = '';
    document.getElementById('quest-desc').value = '';
    document.getElementById('quest-xp').value = '10';
    
    // Re-render panel and quests
    window.renderManagementPanel();
    if (window.state) {
        window.renderQuests(window.state, window.completeQuestGlobal);
    }
};

window.removeQuestFromUI = function(questId) {
    if (confirm('Remove this quest?')) {
        window.removeQuest(questId);
        window.renderManagementPanel();
        if (window.state) {
            window.renderQuests(window.state, window.completeQuestGlobal);
        }
    }
};

window.createNewStat = function() {
    const stat = document.getElementById('new-stat')?.value?.trim().toLowerCase();
    
    if (!stat || stat.length === 0) {
        alert('Please enter a stat code');
        return;
    }

    if (!/^[a-z]{1,3}$/.test(stat)) {
        alert('Stat code must be 1-3 lowercase letters');
        return;
    }

    if (window.addStat(stat)) {
        document.getElementById('new-stat').value = '';
        window.renderManagementPanel();
        
        // Re-render stats display
        if (window.state && typeof window.renderStats === 'function') {
            window.renderStats(window.state);
        }
    } else {
        alert('Stat already exists');
    }
};

window.removeStatFromUI = function(stat) {
    if (confirm(`Remove stat "${stat.toUpperCase()}"? This will not affect quests, but you may want to update them.`)) {
        if (window.removeStat(stat)) {
            window.renderManagementPanel();
            
            // Re-render stats display
            if (window.state && typeof window.renderStats === 'function') {
                window.renderStats(window.state);
            }
        }
    }
};
