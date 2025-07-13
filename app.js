document.addEventListener('DOMContentLoaded', () => {
    // --- Global State & DB ---
    const dbName = "HabitTrackerDB_v11"; // Version incremented for safety
    let db;
    let habitFilter = 'all'; // 'all' or 'incomplete'

    // --- DOM Elements ---
    const dom = {
        headerDate: document.querySelector('.header-date'),
        addHabitPopup: document.getElementById('add-habit-popup'),
        settingsPopup: document.getElementById('settings-popup'),
        backdrop: document.getElementById('backdrop'),
        habitsContainer: document.getElementById('habits-container'),
        addHabitForm: document.getElementById('add-habit-form'),
        toast: document.getElementById('toast-notification'),
        themeSwitch: document.getElementById('theme-switch'),
        languageSelect: document.getElementById('language-select'),
        progressRing: document.querySelector('.progress-ring__circle'),
        progressPercentage: document.querySelector('.progress-percentage'),
        progressTitle: document.querySelector('.progress-title'),
        progressCount: document.querySelector('.progress-count'),
    };

    const radius = dom.progressRing.r.baseVal.value;
    const circumference = 2 * Math.PI * radius;
    
    // --- Language Translations ---
    const lang = {
        de: {
            greeting: "Lass uns zusammen<br>Gewohnheiten schaffen 🙌",
            progressTitle: "Tagesziele fast erreicht! 🔥",
            progressCount: (c, t) => `${c} von ${t} erledigt`,
            todayHabits: "Heutige Gewohnheiten",
            newHabitBtn: "Neue Gewohnheit +",
            newHabitTitle: "Neue Gewohnheit",
            habitNamePlaceholder: "Name der Gewohnheit",
            habitDescPlaceholder: "z.B. 10 Min. lesen",
            repeatDaily: "Täglich",
            repeat2Days: "Alle 2 Tage",
            repeat3Days: "Alle 3 Tage",
            repeatWeekly: "Wöchentlich",
            addHabitSubmit: "Gewohnheit hinzufügen",
            settingsTitle: "Einstellungen",
            theme: "Light/Dark Modus",
            language: "Sprache",
            deleteData: "Alle Daten löschen",
            streakText: (d) => `🔥 ${d} Tage Serie`,
            habitAdded: "Gewohnheit hinzugefügt!",
            habitCompleted: "Super! Weiter so!",
            habitDeleted: "Gewohnheit gelöscht.",
            dataDeleted: "Alle Daten wurden gelöscht.",
            noHabits: "Noch keine Gewohnheiten.",
            addFirstHabit: "Füge deine erste hinzu, um zu starten!",
            confirmDeleteHabit: "Möchtest du diese Gewohnheit wirklich löschen?",
            confirmDeleteAll: "Bist du sicher, dass du ALLE Daten löschen möchtest? Dies kann nicht rückgängig gemacht werden.",
            filterAll: "Zeige alle",
            filterIncomplete: "Zeige unerledigte"
        },
        en: {
            greeting: "Let's make a<br>habits together 🙌",
            progressTitle: "Your daily goals almost done! 🔥",
            progressCount: (c, t) => `${c} of ${t} completed`,
            todayHabits: "Today Habits",
            newHabitBtn: "New Habits +",
            newHabitTitle: "New Habit",
            habitNamePlaceholder: "Habit Name",
            habitDescPlaceholder: "e.g. Read for 10 mins",
            repeatDaily: "Daily",
            repeat2Days: "Every 2 days",
            repeat3Days: "Every 3 days",
            repeatWeekly: "Weekly",
            addHabitSubmit: "Add Habit",
            settingsTitle: "Settings",
            theme: "Light/Dark Mode",
            language: "Language",
            deleteData: "Delete All Data",
            streakText: (d) => `🔥 ${d} day streak`,
            habitAdded: "Habit added!",
            habitCompleted: "Awesome! Keep it up!",
            habitDeleted: "Habit deleted.",
            dataDeleted: "All data has been deleted.",
            noHabits: "No habits yet.",
            addFirstHabit: "Add your first one to get started!",
            confirmDeleteHabit: "Do you really want to delete this habit?",
            confirmDeleteAll: "Are you sure you want to delete ALL data? This action cannot be undone.",
            filterAll: "Showing all",
            filterIncomplete: "Showing incomplete"
        }
    };

    // --- Initialization ---
    function init() {
        setupEventListeners();
        applyInitialSettings();
        setLanguage(localStorage.getItem('habitTrackerLang') || 'de');
        initDB().then(loadHabits).catch(err => console.error("Initialization failed:", err));
    }

    // --- Event Listeners ---
    function setupEventListeners() {
        document.getElementById('show-add-habit-popup-btn').addEventListener('click', () => showPopup('add-habit-popup'));
        document.getElementById('settings-btn').addEventListener('click', () => showPopup('settings-popup'));
        document.getElementById('filter-btn').addEventListener('click', toggleFilter);
        document.getElementById('delete-data-btn').addEventListener('click', deleteAllData);
        document.querySelectorAll('.close-popup-btn').forEach(btn => btn.addEventListener('click', hideAllPopups));
        
        dom.backdrop.addEventListener('click', hideAllPopups);
        dom.addHabitForm.addEventListener('submit', addHabit);
        dom.themeSwitch.addEventListener('change', toggleTheme);
        dom.languageSelect.addEventListener('change', (e) => setLanguage(e.target.value));
        
        dom.habitsContainer.addEventListener('click', handleHabitCardClick);
    }
    
    function handleHabitCardClick(e) {
        const card = e.target.closest('.habit-card');
        if (!card) return;

        const habitId = parseInt(card.dataset.habitId, 10);
        
        if (e.target.closest('.delete-habit-btn')) {
            e.stopPropagation(); // Prevent card click when deleting
            deleteHabit(habitId);
        } else {
            toggleHabitCompletion(habitId);
        }
    }

    // --- Popup Navigation ---
    function showPopup(popupId) {
        dom.backdrop.classList.remove('hidden');
        document.getElementById(popupId)?.classList.add('visible');
    }

    function hideAllPopups() {
        dom.backdrop.classList.add('hidden');
        document.querySelectorAll('.popup').forEach(p => p.classList.remove('visible'));
    }
    
    // --- IndexedDB ---
    async function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(dbName, 1);
            request.onerror = e => reject("DB Error: " + e.target.errorCode);
            request.onupgradeneeded = e => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('habits')) {
                    db.createObjectStore('habits', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('entries')) {
                    const entryStore = db.createObjectStore('entries', { keyPath: 'id', autoIncrement: true });
                    entryStore.createIndex('habitId_date', ['habitId', 'date'], { unique: true });
                    entryStore.createIndex('habitId', 'habitId', { unique: false });
                }
            };
            request.onsuccess = e => { db = e.target.result; resolve(); };
        });
    }

    // --- Habit Functions ---
    async function addHabit(e) {
        e.preventDefault();
        const newHabit = {
            name: document.getElementById('habit-name').value,
            description: document.getElementById('habit-description').value,
            repeatType: document.getElementById('habit-repeat').value,
            createdAt: new Date().toISOString()
        };
        const tx = db.transaction(['habits'], 'readwrite');
        tx.objectStore('habits').add(newHabit);
        tx.oncomplete = () => { 
            dom.addHabitForm.reset(); 
            hideAllPopups(); 
            loadHabits(); 
            showToast(lang[currentLanguage()].habitAdded); 
        };
        tx.onerror = (e) => console.error("Error adding habit:", e.target.error);
    }

    async function loadHabits() {
        if (!db) return;
        const tx = db.transaction(['habits', 'entries'], 'readonly');
        const habits = await getAllFromStore(tx, 'habits');
        const allEntries = await getAllFromStore(tx, 'entries');
        
        dom.habitsContainer.innerHTML = '';
        
        let completedCount = 0;
        const todayStr = new Date().toISOString().split('T')[0];
        
        for (const habit of habits) {
            const habitEntries = allEntries.filter(e => e.habitId === habit.id);
            const isCompletedToday = habitEntries.some(e => e.date === todayStr);
            if (isCompletedToday) completedCount++;

            if (habitFilter === 'all' || !isCompletedToday) {
                 renderHabitCard(habit, isCompletedToday, habitEntries);
            }
        }

        if (habits.length === 0) {
            const langKey = currentLanguage();
            dom.habitsContainer.innerHTML = `<div class="placeholder-card"><h3>${lang[langKey].noHabits}</h3><p>${lang[langKey].addFirstHabit}</p></div>`;
        }
        updateProgress(completedCount, habits.length);
    }
    
    async function toggleHabitCompletion(habitId) {
        const todayStr = new Date().toISOString().split('T')[0];
        const tx = db.transaction(['entries'], 'readwrite');
        const store = tx.objectStore('entries');
        const index = store.index('habitId_date');
        const request = index.get([habitId, todayStr]);

        request.onsuccess = () => {
            if (request.result) {
                store.delete(request.result.id);
            } else {
                store.add({ habitId, date: todayStr });
                showToast(lang[currentLanguage()].habitCompleted);
                if (window.confetti) confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
        };

        tx.oncomplete = loadHabits;
    }

    async function deleteHabit(habitId) {
        if (!confirm(lang[currentLanguage()].confirmDeleteHabit)) return;
        const tx = db.transaction(['habits', 'entries'], 'readwrite');
        tx.objectStore('habits').delete(habitId);
        
        const entryStore = tx.objectStore('entries');
        const entryIndex = entryStore.index('habitId');
        const request = entryIndex.openCursor(IDBKeyRange.only(habitId));
        
        request.onsuccess = e => { 
            const cursor = e.target.result; 
            if (cursor) { 
                cursor.delete(); 
                cursor.continue(); 
            } 
        };
        tx.oncomplete = () => { 
            loadHabits(); 
            showToast(lang[currentLanguage()].habitDeleted); 
        };
    }
    
    /**
     * Calculates the current streak for a habit based on its entries and repetition type.
     * This function is robust and handles all specified intervals.
     */
    function calculateStreak(entries, repeatType) {
        if (entries.length === 0) return 0;

        const intervalMap = { daily: 1, every2days: 2, every3days: 3, weekly: 7 };
        const interval = intervalMap[repeatType] || 1;
        const oneDay = 1000 * 60 * 60 * 24;

        // Create a sorted, unique list of completion timestamps (set to midnight).
        const sortedDates = entries.map(e => new Date(e.date).setHours(0,0,0,0)).sort((a,b) => b-a);
        const uniqueDates = [...new Set(sortedDates)];
        
        const today = new Date().setHours(0,0,0,0);
        
        // Check if the most recent completion is within the allowed interval to maintain the streak.
        // If the last completion is older than the interval, the streak is broken.
        const daysSinceLast = (today - uniqueDates[0]) / oneDay;
        if (daysSinceLast > interval) {
            return 0; // Streak is broken.
        }

        // If the streak is active, calculate its length.
        let streak = 0;
        if (uniqueDates.length > 0) {
            streak = 1;
            for (let i = 0; i < uniqueDates.length - 1; i++) {
                const diff = (uniqueDates[i] - uniqueDates[i+1]) / oneDay;
                if (diff <= interval) {
                    streak++;
                } else {
                    // A gap larger than the interval was found, so the streak ends here.
                    break;
                }
            }
        }
        return streak;
    }

    // --- Rendering ---
    function renderHabitCard(habit, isCompletedToday, habitEntries) {
    const card = document.createElement('div');
    card.className = `habit-card ${isCompletedToday ? 'completed' : ''}`;
    card.dataset.habitId = habit.id;

    const iconClass = habit.name.toLowerCase().includes('shop') ? 'shopping' :
                      habit.name.toLowerCase().includes('cycl') ? 'cycling' :
                      habit.name.toLowerCase().includes('read') ? 'reading' : 'default';

    const iconContent = habit.name.toLowerCase().includes('shop') ? '🛍️' : habit.name.toLowerCase().includes('cycl') ? '🚲' : habit.name.toLowerCase().includes('read') ? '📚' : '🚩';
    
    const currentStreak = calculateStreak(habitEntries, habit.repeatType);
    
    let descriptionText = habit.description || lang[currentLanguage()][`repeat${habit.repeatType.charAt(0).toUpperCase() + habit.repeatType.slice(1)}`];
    if (currentStreak > 0) {
        descriptionText += ` • ${lang[currentLanguage()].streakText(currentStreak)}`;
    }

    // --- ANPASSUNG START ---
    // Die Reihenfolge von Button und Checkmark wurde hier getauscht.
    card.innerHTML = `
        <div class="habit-icon ${iconClass}">${iconContent}</div>
        <div class="habit-info">
            <h3>${habit.name}</h3>
            <p>${descriptionText}</p>
        </div>
        <div class="habit-controls">
             <button class="delete-habit-btn" aria-label="Delete habit">🗑️</button>
             ${isCompletedToday ? '<div class="complete-checkmark">✔</div>' : ''}
        </div>
    `;
    // --- ANPASSUNG ENDE ---
    
    dom.habitsContainer.appendChild(card);
}

    // --- UI & Helper Functions ---
    function updateProgress(completed, total) {
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        const offset = circumference - (percentage / 100) * circumference;
        
        dom.progressRing.style.strokeDashoffset = offset;
        dom.progressPercentage.textContent = `${percentage}%`;
        dom.progressCount.textContent = lang[currentLanguage()].progressCount(completed, total);
    }

    function updateDateHeader() {
        const now = new Date();
        const langCode = currentLanguage() === 'de' ? 'de-DE' : 'en-US';
        const options = { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' };
        dom.headerDate.textContent = now.toLocaleDateString(langCode, options);
    }
    
    function showToast(message) {
        dom.toast.textContent = message;
        dom.toast.classList.add('show');
        setTimeout(() => dom.toast.classList.remove('show'), 3000);
    }
    
    function getAllFromStore(tx, storeName) {
        return new Promise((resolve, reject) => {
            const request = tx.objectStore(storeName).getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    function currentLanguage() { return localStorage.getItem('habitTrackerLang') || 'de'; }

    // --- Settings & Actions ---
    function applyInitialSettings() {
        const theme = localStorage.getItem('habitTrackerTheme') || 'light';
        document.documentElement.setAttribute('data-theme', theme);
        dom.themeSwitch.checked = theme === 'dark';
        
        dom.progressRing.style.strokeDasharray = `${circumference} ${circumference}`;
        dom.progressRing.style.strokeDashoffset = circumference;
    }
    
    function setLanguage(langCode) {
        localStorage.setItem('habitTrackerLang', langCode);
        document.documentElement.lang = langCode;
        dom.languageSelect.value = langCode;
        
        document.querySelectorAll('[data-lang-key]').forEach(el => {
            const key = el.getAttribute('data-lang-key');
            const translation = lang[langCode]?.[key];
            if (translation) {
                if (typeof translation !== 'function') {
                    el.innerHTML = translation;
                }
            }
        });
        document.querySelectorAll('[data-lang-placeholder]').forEach(el => {
            const key = el.getAttribute('data-lang-placeholder');
            if (lang[langCode]?.[key]) el.placeholder = lang[langCode][key];
        });
        
        updateDateHeader();
        loadHabits();
    }
    
    function toggleTheme() {
        const newTheme = dom.themeSwitch.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('habitTrackerTheme', newTheme);
    }

    function toggleFilter() {
        habitFilter = habitFilter === 'all' ? 'incomplete' : 'all';
        loadHabits();
        const toastMessage = habitFilter === 'all' ? lang[currentLanguage()].filterAll : lang[currentLanguage()].filterIncomplete;
        showToast(toastMessage);
    }

    async function deleteAllData() {
        if (!confirm(lang[currentLanguage()].confirmDeleteAll)) return;
        if (!db) return;
        const tx = db.transaction(['habits', 'entries'], 'readwrite');
        tx.objectStore('habits').clear();
        tx.objectStore('entries').clear();
        tx.oncomplete = () => { 
            loadHabits(); 
            showToast(lang[currentLanguage()].dataDeleted); 
            hideAllPopups(); 
        };
    }
    
    // --- Start the App ---
    init();
});
