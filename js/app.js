let state = null;

function completeQuest(quest, event) {
    if (state.completed.includes(quest.id)) return;

    state.xp += quest.xp;
    
    // Initialize stat if it doesn't exist
    if (!(quest.stat in state.stats)) {
        state.stats[quest.stat] = 0;
    }
    state.stats[quest.stat] += 1;
    state.completed.push(quest.id);

    window.spawnFloatingText(event.clientX, event.clientY, `+${quest.xp} XP`, 'text-yellow-300 text-lg');
    window.spawnFloatingText(event.clientX + 50, event.clientY - 20, `+1 ${quest.stat.toUpperCase()}`, 'text-purple-300 text-sm');

    if (state.xp >= state.xpNext) {
        state.lvl += 1;
        state.xp -= state.xpNext;
        state.xpNext = Math.floor(state.xpNext * 1.2);
        addLog(`🎉 ⭐ LEVEL UP! You reached level ${state.lvl}! ⭐ 🎉`, 'text-yellow-400 font-bold cinzel');
        triggerLevelUpAnimation();
        window.showLevelUpPopup(state.lvl);
        window.spawnFloatingText(window.innerWidth / 2, window.innerHeight / 2, 'LEVEL UP!', 'text-yellow-300 text-2xl cinzel');
    }

    addLog(`✔️ Finished: ${quest.title} (+${quest.xp} XP)`);
    saveAndRefreshQuests();
}

function triggerLevelUpAnimation() {
    const lvlDisplay = document.getElementById('lvl-display-big');
    if (lvlDisplay) {
        lvlDisplay.style.animation = 'none';
        setTimeout(() => {
            lvlDisplay.style.animation = 'levelUpPulse 0.6s ease-out';
        }, 10);
    }
}

function resetAllProgress() {
    if (!confirm('Are you sure? This will erase ALL progress including level, stats, and logs!')) return;
    state = window.resetAll();
    state.logs.push({
        msg: '🔄 Complete reset! Starting fresh from level 1...',
        classes: 'text-red-400 font-bold',
        timestamp: window.getTimestamp()
    });
    window.renderLogs(state);
    saveAndRefresh();
}

function saveAndRefresh() {
    window.saveState(state);
    window.renderQuests(state, completeQuest);
    window.updateUI(state);
    window.renderLogs(state);
}

function saveAndRefreshQuests() {
    window.saveState(state);
    window.renderQuests(state, completeQuest);
    window.updateStatsQuietly(state);
    window.renderLogs(state);
}

function addLog(msg, classes = 'text-slate-400') {
    const timestamp = window.getTimestamp();
    state.logs.push({ msg, classes, timestamp });
    window.renderLogs(state);
    window.saveState(state);
}

// Character Name Functions
function displayCharacterName() {
    const nameElement = document.getElementById('character-name');
    if (nameElement) {
        const savedName = window.loadCharacterName();
        nameElement.textContent = savedName;
    }
}

window.editCharacterName = function() {
    const nameElement = document.getElementById('character-name');
    if (!nameElement) return;

    const currentName = nameElement.textContent;
    
    // Create input field
    const input = document.createElement('input');
    input.type = 'text';
    input.value = currentName;
    input.className = 'character-name-input bg-slate-700 text-yellow-300 cinzel text-sm tracking-wider uppercase text-center border border-yellow-500 rounded px-2 py-1';
    input.style.width = '120px';
    input.maxLength = 15;
    
    // Replace text with input
    nameElement.innerHTML = '';
    nameElement.appendChild(input);
    input.focus();
    input.select();
    
    // Handle saving
    const saveName = function() {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            window.saveCharacterName(newName);
            nameElement.textContent = newName;
            addLog(`Character name changed to "${newName}"!`, 'text-yellow-400 font-bold');
        } else {
            nameElement.textContent = currentName;
        }
    };
    
    // Save on Enter or blur
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveName();
        } else if (e.key === 'Escape') {
            nameElement.textContent = currentName;
        }
    });
    
    input.addEventListener('blur', saveName);
};

function handlePortraitUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imageData = e.target.result;
            localStorage.setItem('rpg_portrait', imageData);
            displayPortraitImage(imageData);
            if (state) {
                addLog('✨ Character portrait updated!', 'text-yellow-400 font-bold');
            }
            event.target.value = '';
        } catch (error) {
            console.error('Error loading portrait:', error);
            alert('Error uploading portrait. File might be too large.');
        }
    };
    reader.onerror = function() {
        console.error('FileReader error');
        alert('Error reading the file. Please try another image.');
    };
    reader.readAsDataURL(file);
}

function loadPortraitImage() {
    try {
        const portraitData = localStorage.getItem('rpg_portrait');
        if (portraitData) {
            displayPortraitImage(portraitData);
        }
    } catch (error) {
        console.error('Error loading portrait:', error);
    }
}

function displayPortraitImage(imageData) {
    const container = document.getElementById('portrait-container');
    if (!container) return;

    const existingImg = container.querySelector('img');
    if (existingImg) {
        existingImg.remove();
    }

    const img = document.createElement('img');
    img.src = imageData;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    img.style.borderRadius = '1.125rem';
    img.style.display = 'block';
    img.style.position = 'relative';
    img.style.zIndex = '10';
    
    const svg = container.querySelector('svg');
    if (svg) {
        svg.style.display = 'none';
    }
    
    container.insertBefore(img, container.firstChild);
}

function init() {
    state = window.loadState();
    state.logs = Array.isArray(state.logs) ? state.logs : [];
    state.completed = Array.isArray(state.completed) ? state.completed : [];

    // Attach button handlers early so controls remain usable even if later UI rendering fails.
    const hardResetBtn = document.getElementById('hard-reset');
    const customizeBtn = document.getElementById('customize-btn');

    if (hardResetBtn) {
        hardResetBtn.addEventListener('click', resetAllProgress);
    }
    if (customizeBtn) {
        customizeBtn.addEventListener('click', window.openCustomizeModal);
    }

    window.completeQuestGlobal = completeQuest;
    window.renderQuests(state, completeQuest);
    window.updateUI(state);
    window.renderLogs(state);
    loadPortraitImage();
    displayCharacterName();

    // Render management panel if available
    try {
        if (typeof window.renderManagementPanel === 'function') {
            window.renderManagementPanel();
        }
    } catch (error) {
        console.error('Error rendering management panel:', error);
    }

    if (state.logs.length === 0) {
        state.logs.push({
            msg: 'Welcome back, Player. Your journey continues...',
            classes: 'text-slate-500 italic',
            timestamp: window.getTimestamp()
        });
        window.saveState(state);
        window.renderLogs(state);
    }

    // Set up portrait upload
    const portraitUpload = document.getElementById('portrait-upload');
    const portraitContainer = document.getElementById('portrait-container');
    
    if (portraitUpload) {
        portraitUpload.addEventListener('change', handlePortraitUpload);
    }
    
    if (portraitContainer) {
        portraitContainer.addEventListener('click', function() {
            if (portraitUpload) {
                portraitUpload.click();
            }
        });
    }
    
    // Check if a new day has started
    checkDailyRollover();
    
    // Update timer display immediately and every second
    updateDailyResetTimer();
    setInterval(updateDailyResetTimer, 1000);
}

// Daily Reset Functions
function formatTwoDigits(num) {
    return String(num).padStart(2, '0');
}

function getNextMidnightMs() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now.getTime();
}

function updateDailyResetTimer() {
    const timerEl = document.getElementById('reset-timer');
    if (!timerEl) return;
    
    try {
        const msLeft = getNextMidnightMs();
        const totalSecs = Math.floor(msLeft / 1000);
        const hrs = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        
        const timeStr = `${formatTwoDigits(hrs)}:${formatTwoDigits(mins)}:${formatTwoDigits(secs)}`;
        timerEl.textContent = timeStr;
    } catch (error) {
        console.error('Error updating timer:', error);
        timerEl.textContent = 'ERROR';
    }
}

function checkDailyRollover() {
    if (!state) return;
    
    const now = Date.now();
    const lastResetDate = new Date(state.lastReset).toDateString();
    const todayDate = new Date(now).toDateString();
    
    if (lastResetDate !== todayDate) {
        autoResetDaily();
    }
}

function autoResetDaily() {
    if (!state) return;
    
    const dailyReset = window.resetDaily();
    state.completed = dailyReset.completed;
    state.lastReset = dailyReset.lastReset;
    
    addLog('🌅 A new day dawns! Daily tasks have been refreshed!', 'text-cyan-400 font-bold cinzel');
    saveAndRefresh();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
