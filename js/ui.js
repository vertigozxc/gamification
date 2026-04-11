let questRenderCount = 0;

window.renderQuests = function(state, handleQuestClick) {
    const container = document.getElementById('quest-container');
    container.innerHTML = '';

    const quests = typeof window.getAllQuests === 'function' ? window.getAllQuests() : window.QUESTS_DATA;
    quests.forEach((quest, index) => {
        const isDone = state.completed.includes(quest.id);
        const card = document.createElement('div');
        card.className = `quest-card p-5 rounded-xl flex flex-col justify-between h-48 ${isDone ? 'completed' : ''}`;

        if (!isDone) {
            if (questRenderCount === 0) {
                card.style.animationDelay = `${index * 0.1}s`;
            } else {
                card.style.animation = 'none';
            }
        }

        card.onclick = (event) => handleQuestClick(quest, event);
        card.innerHTML = `
            <div class="flex justify-between items-start gap-3">
                <span class="quest-icon text-3xl ${isDone ? '' : 'animate-bounce'}">${quest.icon}</span>
                <span class="cinzel text-xs md:text-sm font-bold px-3 py-1.5 rounded-full bg-yellow-600 text-yellow-100">+${quest.xp} XP</span>
            </div>
            <div class="flex-grow mt-3">
                <h3 class="cinzel text-lg text-white font-bold mb-1">${quest.title}</h3>
                <p class="text-slate-300 text-sm">${quest.desc}</p>
            </div>
            <div class="mt-3 text-xs cinzel text-slate-400 text-right">
                ${isDone ? '<span class="completed-badge">Completed</span>' : 'Click to complete'}
            </div>
        `;

        container.appendChild(card);
    });

    questRenderCount += 1;
};

window.renderLogs = function(state) {
    const container = document.getElementById('log-container');
    container.innerHTML = '';

    state.logs.forEach((log) => {
        const div = document.createElement('div');
        div.className = `border-l-2 border-slate-600 pl-3 py-2 ${log.classes} animate-slideIn`;
        div.innerHTML = `<span class="text-slate-500 text-[10px] block mb-1">[${log.timestamp}]</span><span class="text-slate-200">» ${log.msg}</span>`;
        container.appendChild(div);
    });

    container.scrollTop = container.scrollHeight;
};

window.updateUI = function(state) {
    document.getElementById('lvl-display-big').innerText = state.lvl;
    
    // Render all stats dynamically
    window.renderStats(state);

    const xpPercent = (state.xp / state.xpNext) * 100;
    document.getElementById('xp-bar').style.width = `${xpPercent}%`;
    document.getElementById('xp-current').innerText = state.xp;
    document.getElementById('xp-next').innerText = state.xpNext;
};

// Update stats without visual refresh (for quest completion)
window.updateStatsQuietly = function(state) {
    // Only update stat numbers without re-rendering
    const allStats = typeof window.getAllStats === 'function' ? window.getAllStats() : ['str', 'int', 'sta'];
    allStats.forEach((stat) => {
        const statId = `stat-${stat}`;
        const el = document.getElementById(statId);
        if (el) {
            el.innerText = state.stats[stat] || 0;
        }
    });
    
    // Update XP silently
    const xpPercent = (state.xp / state.xpNext) * 100;
    const xpBar = document.getElementById('xp-bar');
    const xpCurrent = document.getElementById('xp-current');
    const xpNext = document.getElementById('xp-next');
    
    if (xpBar) xpBar.style.width = `${xpPercent}%`;
    if (xpCurrent) xpCurrent.innerText = state.xp;
    if (xpNext) xpNext.innerText = state.xpNext;
};

// Render stats dynamically based on all available stats
window.renderStats = function(state) {
    const container = document.getElementById('stats-container');
    if (!container) return;
    
    const allStats = typeof window.getAllStats === 'function' ? window.getAllStats() : ['str', 'int', 'sta'];
    const statColors = {
        str: { bg: 'from-orange-900 to-orange-950', border: 'border-orange-600', text: 'text-orange-300', value: 'text-orange-400' },
        int: { bg: 'from-blue-900 to-blue-950', border: 'border-blue-600', text: 'text-blue-300', value: 'text-blue-400' },
        sta: { bg: 'from-green-900 to-green-950', border: 'border-green-600', text: 'text-green-300', value: 'text-green-400' }
    };
    
    // Default colors for custom stats
    const defaultColor = { bg: 'from-purple-900 to-purple-950', border: 'border-purple-600', text: 'text-purple-300', value: 'text-purple-400' };
    
    container.innerHTML = '';
    
    allStats.forEach((stat) => {
        const colors = statColors[stat] || defaultColor;
        const statValue = state.stats[stat] || 0;
        const statId = `stat-${stat}`;
        
        const statBox = document.createElement('div');
        statBox.className = `stat-box bg-gradient-to-br ${colors.bg} px-3 py-2 rounded-xl border-2 ${colors.border} text-center shadow-lg flex flex-col items-center justify-center`;
        statBox.innerHTML = `
            <p class="text-xl cinzel uppercase ${colors.text} tracking-wider text-center font-bold">${stat.toUpperCase()}</p>
            <p id="${statId}" class="stat-number text-2xl font-bold ${colors.value} cinzel mt-1 text-center">${statValue}</p>
            <div style="height: 1.25rem;"></div>
        `;
        
        container.appendChild(statBox);
    });
};

// Modal functions
window.openCustomizeModal = function() {
    const modal = document.getElementById('customize-modal');
    if (modal) {
        modal.classList.remove('hidden');
        modal.classList.add('flex');
        document.body.style.overflow = 'hidden';
    }
};

window.closeCustomizeModal = function() {
    const modal = document.getElementById('customize-modal');
    if (modal) {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = 'auto';
    }
};

let levelUpTimeout = null;
window.showLevelUpPopup = function(level) {
    const popup = document.getElementById('levelup-popup');
    const title = document.getElementById('levelup-number');
    if (!popup || !title) return;

    title.innerText = `LEVEL ${level}`;
    popup.classList.remove('hidden');
    popup.classList.add('show');

    if (levelUpTimeout) {
        clearTimeout(levelUpTimeout);
    }
    levelUpTimeout = setTimeout(window.hideLevelUpPopup, 3000);
};

window.hideLevelUpPopup = function() {
    const popup = document.getElementById('levelup-popup');
    if (!popup) return;
    popup.classList.remove('show');
    setTimeout(() => popup.classList.add('hidden'), 250);
};

window.spawnFloatingText = function(x, y, text, colorClass) {
    const el = document.createElement('div');
    el.className = `floating-text ${colorClass} cinzel`;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.innerText = text;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
};