// ============================================
// SHIMA POKÉDEX - MAIN SCRIPT v2
// With caching, admin mode, and visibility controls
// ============================================

// ===========================================
// CONSTANTS
// ===========================================

const TYPE_COLORS = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC', cosmic: '#2E1F5E'
};

const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/Benjakronk/shima-pokedex/main/images/';
const SPLASH_BASE_URL = 'https://raw.githubusercontent.com/Benjakronk/shima-pokedex/main/images/splashes/';
const DEFAULT_SPLASH_COUNT = 9; // Fallback if not in config
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'jfif'];
const CONFIG_URL = 'https://raw.githubusercontent.com/Benjakronk/shima-pokedex/main/pokedex_config.json';

const CACHE_KEYS = {
    POKEMON_DATA: 'shima_pokemon_data',
    MOVE_DATA: 'shima_move_data',
    CONFIG: 'shima_pokedex_config',
    CACHE_TIME: 'shima_cache_timestamp',
    ADMIN_SESSION: 'shima_admin_session'
};

const DATA_CACHE_DURATION = 24 * 60 * 60 * 1000;
const CONFIG_CACHE_DURATION = 5 * 60 * 1000;
const RESULTS_PER_PAGE = 5;
const ADMIN_PASSWORD = 'shimamaster';

const DEFAULT_VISIBILITY = {
    // Types (granular)
    primaryType: true,
    secondaryType: true,
    
    // Description
    description: true,
    
    // Characteristics (granular)
    charSize: true,
    charRarity: true,
    charBehavior: true,
    charHabitat: true,
    charActivity: true,
    
    // Stats (granular)
    statAC: false,
    statHD: false,
    statVD: false,
    statSpeed: false,
    statSTR: false,
    statDEX: false,
    statCON: false,
    statINT: false,
    statWIS: false,
    statCHA: false,
    statSaves: false,
    statSkills: false,
    
    // Abilities
    primaryAbility: false,
    secondaryAbility: false,
    hiddenAbility: false,
    
    // Senses (granular)
    senseDarkvision: false,
    senseBlindsight: false,
    senseTremorsense: false,
    senseTrillsense: false,
    senseMindsense: false,
    
    // Evolution (granular)
    evoFrom: false,
    evoTo: false,
    
    // Moves
    moves: false,
    movesMaxLevel: 1,
    extraVisibleMoves: []
};

// Default config structure
const DEFAULT_CONFIG = {
    registered: [],
    visibility: {},
    defaults: { ...DEFAULT_VISIBILITY },
    extraSearchableMoves: [],
    splashCount: DEFAULT_SPLASH_COUNT
};

// ===========================================
// GLOBAL STATE
// ===========================================

let state = {
    pokemonData: [],
    moveData: [],
    config: {
        registered: [],
        visibility: {},
        defaults: { ...DEFAULT_VISIBILITY },
        extraSearchableMoves: [],
        splashCount: DEFAULT_SPLASH_COUNT
    },
    isAdminMode: false,
    currentView: 'pokedex',
    currentResults: [],
    currentPage: 1,
    editingPokemonName: null,
    expandedAdminRows: new Set()
};

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function getTypeColor(type) {
    return TYPE_COLORS[type?.toLowerCase()] || '#68A090';
}

function getBrightness(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
}

function sanitizeFileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} visible`;
    setTimeout(() => toast.classList.remove('visible'), 3000);
}

function formatDate(timestamp) {
    if (!timestamp) return 'Never';
    return new Date(timestamp).toLocaleString();
}

// ===========================================
// EVOLUTION PARSER
// ===========================================

function parseEvolutionData(evolutionReq) {
    if (!evolutionReq || evolutionReq === '-' || evolutionReq.trim() === '') {
        return { evolvesTo: [], evolvesFrom: null };
    }
    
    const result = { evolvesTo: [], evolvesFrom: null };
    const parts = evolutionReq.split(';').map(p => p.trim()).filter(p => p);
    
    for (const part of parts) {
        // Check for "Evolves: TARGET @ REQUIREMENT"
        const evolvesMatch = part.match(/^Evolves:\s*(.+?)\s*@\s*(.+)$/i);
        if (evolvesMatch) {
            result.evolvesTo.push({
                target: evolvesMatch[1].trim(),
                requirement: evolvesMatch[2].trim()
            });
            continue;
        }
        
        // Check for "From: PREV + OTHER @ REQUIREMENT" (fusion)
        const fusionMatch = part.match(/^From:\s*(.+?)\s*\+\s*(.+?)\s*@\s*(.+)$/i);
        if (fusionMatch) {
            result.evolvesFrom = {
                type: 'fusion',
                pokemon1: fusionMatch[1].trim(),
                pokemon2: fusionMatch[2].trim(),
                requirement: fusionMatch[3].trim()
            };
            continue;
        }
        
        // Check for simple "From: PREVIOUS"
        const fromMatch = part.match(/^From:\s*(.+)$/i);
        if (fromMatch) {
            result.evolvesFrom = {
                type: 'standard',
                pokemon: fromMatch[1].trim()
            };
            continue;
        }
    }
    
    return result;
}

// ===========================================
// LOADING SCREEN
// ===========================================

function setRandomSplash() {
    // Try to get splash count from cached config, fall back to default
    const cachedConfig = getCachedData(CACHE_KEYS.CONFIG);
    const splashCount = cachedConfig?.splashCount || DEFAULT_SPLASH_COUNT;
    
    // Get or initialize the splash bag (shuffle bag approach)
    let splashBag = JSON.parse(localStorage.getItem('shimaSplashBag') || '[]');
    const savedCount = parseInt(localStorage.getItem('shimaSplashCount') || '0');
    
    // Reset bag if splash count changed or bag is empty
    if (splashBag.length === 0 || savedCount !== splashCount) {
        splashBag = Array.from({ length: splashCount }, (_, i) => i + 1);
        localStorage.setItem('shimaSplashCount', splashCount.toString());
    }
    
    // Pick random index from remaining bag
    const randomIndex = Math.floor(Math.random() * splashBag.length);
    const splashNumber = splashBag[randomIndex];
    
    // Remove selected splash from bag and save
    splashBag.splice(randomIndex, 1);
    localStorage.setItem('shimaSplashBag', JSON.stringify(splashBag));
    
    const splashUrl = `${SPLASH_BASE_URL}splash-${splashNumber}.png`;
    const splashEl = document.getElementById('splashImage');
    if (splashEl) {
        splashEl.style.backgroundImage = `url('${splashUrl}')`;
    }
}

function updateLoadingProgress(percent, text) {
    const progressBar = document.getElementById('progressBar');
    const loadingText = document.getElementById('loadingText');
    const loadingPercent = document.getElementById('loadingPercent');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (loadingText && text) loadingText.textContent = text;
    if (loadingPercent) loadingPercent.textContent = `${Math.round(percent)}%`;
}

function isMobileDevice() {
    return window.innerWidth <= 768 || 'ontouchstart' in window;
}

function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (!overlay) return;
    
    updateLoadingProgress(100, 'Ready!');
    
    if (isMobileDevice()) {
        // On mobile, wait for user tap
        setTimeout(() => {
            const loadingText = document.getElementById('loadingText');
            if (loadingText) loadingText.textContent = 'Tap to enter';
            
            overlay.classList.add('ready');
            overlay.addEventListener('click', dismissLoading, { once: true });
        }, 300);
    } else {
        // On desktop, auto-hide after short delay
        setTimeout(() => overlay.classList.add('hidden'), 300);
    }
}

function dismissLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) {
        overlay.classList.add('hidden');
    }
}

// ===========================================
// CACHING SYSTEM
// ===========================================

function getCachedData(key) {
    try {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    } catch (e) {
        console.warn('Cache read error:', e);
        return null;
    }
}

function setCachedData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn('Cache write error:', e);
    }
}

function isCacheValid(key, duration) {
    const timestamp = getCachedData(CACHE_KEYS.CACHE_TIME);
    if (!timestamp || !timestamp[key]) return false;
    return (Date.now() - timestamp[key]) < duration;
}

function updateCacheTimestamp(key) {
    let timestamps = getCachedData(CACHE_KEYS.CACHE_TIME) || {};
    timestamps[key] = Date.now();
    setCachedData(CACHE_KEYS.CACHE_TIME, timestamps);
}

function clearCacheAndReload() {
    Object.values(CACHE_KEYS).forEach(key => localStorage.removeItem(key));
    showToast('Cache cleared, reloading...', 'success');
    setTimeout(() => location.reload(), 1000);
}

function updateLastCacheTime() {
    const timestamps = getCachedData(CACHE_KEYS.CACHE_TIME);
    const lastTime = timestamps ? Math.max(...Object.values(timestamps)) : null;
    const el = document.getElementById('lastCacheTime');
    if (el) el.textContent = formatDate(lastTime);
}

// ===========================================
// DATA LOADING
// ===========================================

async function loadPokemonData() {
    if (isCacheValid(CACHE_KEYS.POKEMON_DATA, DATA_CACHE_DURATION)) {
        const cached = getCachedData(CACHE_KEYS.POKEMON_DATA);
        if (cached?.length > 0) {
            console.log('Using cached Pokémon data');
            return cached;
        }
    }

    console.log('Fetching fresh Pokémon data...');
    const response = await fetch('https://script.google.com/macros/s/AKfycbwIT3OS2bdCv2kkDPh6IjRRirv17iPnuttlPcY47LCHBbpNPuHF_IjVq0mCt7TkkWoW/exec?action=pokemon');
    if (!response.ok) throw new Error('Failed to fetch Pokémon data');
    
    const values = await response.json();
    const processed = await Promise.all(values.map(processPokemonRow));
    
    setCachedData(CACHE_KEYS.POKEMON_DATA, processed);
    updateCacheTimestamp(CACHE_KEYS.POKEMON_DATA);
    
    return processed;
}

async function loadMoveData() {
    if (isCacheValid(CACHE_KEYS.MOVE_DATA, DATA_CACHE_DURATION)) {
        const cached = getCachedData(CACHE_KEYS.MOVE_DATA);
        if (cached?.length > 0) {
            console.log('Using cached Move data');
            return cached;
        }
    }

    console.log('Fetching fresh Move data...');
    const response = await fetch('https://script.google.com/macros/s/AKfycbwIT3OS2bdCv2kkDPh6IjRRirv17iPnuttlPcY47LCHBbpNPuHF_IjVq0mCt7TkkWoW/exec?action=moves');
    if (!response.ok) throw new Error('Failed to fetch Move data');
    
    const values = await response.json();
    const processed = values.map(row => ({
        name: row[0],
        type: row[1],
        power: row[2],
        time: row[3],
        vp: row[4],
        duration: row[5],
        range: row[6],
        description: row[7],
        higher: row[8] ? row[8].trim() : ''
    }));
    
    setCachedData(CACHE_KEYS.MOVE_DATA, processed);
    updateCacheTimestamp(CACHE_KEYS.MOVE_DATA);
    
    return processed;
}

async function loadConfig() {
    // Always try to fetch fresh config from GitHub first
    try {
        const response = await fetch(CONFIG_URL + '?t=' + Date.now());
        if (response.ok) {
            const config = await response.json();
            // Ensure all required fields exist
            const fullConfig = {
                registered: config.registered || [],
                visibility: config.visibility || {},
                defaults: config.defaults || { ...DEFAULT_VISIBILITY },
                extraSearchableMoves: config.extraSearchableMoves || [],
                splashCount: config.splashCount || DEFAULT_SPLASH_COUNT
            };
            setCachedData(CACHE_KEYS.CONFIG, fullConfig);
            updateCacheTimestamp(CACHE_KEYS.CONFIG);
            console.log('Loaded config from GitHub');
            return fullConfig;
        }
    } catch (e) {
        console.warn('Could not fetch remote config:', e);
    }
    
    // Fall back to cached config if GitHub fetch fails
    const cached = getCachedData(CACHE_KEYS.CONFIG);
    if (cached) {
        console.log('Using cached config');
        return {
            registered: cached.registered || [],
            visibility: cached.visibility || {},
            defaults: cached.defaults || { ...DEFAULT_VISIBILITY },
            extraSearchableMoves: cached.extraSearchableMoves || [],
            splashCount: cached.splashCount || DEFAULT_SPLASH_COUNT
        };
    }
    
    // Return default config if nothing else available
    console.log('Using default config');
    return { ...DEFAULT_CONFIG };
}

async function processPokemonRow(row) {
    const imageUrl = await getImageUrl(row[2], row[1]);
    return {
        image: imageUrl,
        id: row[1],
        name: row[2],
        classification: row[5],
        flavorText: row[6],
        primaryType: row[7],
        secondaryType: row[8],
        size: row[9],
        rarity: row[10],
        habitat: row[11],
        behavior: row[12],
        activityTime: row[13],
        evolutionReq: row[14],
        primaryAbility: { name: row[15], description: row[62] ?? "No description available" },
        secondaryAbility: row[16] ? { name: row[16], description: row[63] ?? "No description available" } : null,
        hiddenAbility: row[17] ? { name: row[17], description: row[64] ?? "No description available" } : null,
        catchDifficulty: row[18],
        level: row[19],
        ac: row[20],
        hitDice: row[21],
        hp: row[22],
        vitalityDice: row[23],
        vp: row[24],
        speed: row[25],
        strength: row[27],
        dexterity: row[28],
        constitution: row[29],
        intelligence: row[30],
        wisdom: row[31],
        charisma: row[32],
        savingThrows: row[33],
        skills: row[34],
        moves: {
            starting: sanitizeMoves(row[35], 4),
            level2: sanitizeMoves(row[36], 4),
            level6: sanitizeMoves(row[37], 4),
            level10: sanitizeMoves(row[38], 4),
            level14: sanitizeMoves(row[39], 3),
            level18: sanitizeMoves(row[40], 3)
        },
        movePool: row.slice(41, 62).filter(move => move !== ""),
        senses: {
            sight: row[71],
            hearing: row[72],
            smell: row[73],
            tremorsense: row[74],
            echolocation: row[75],
            telepathy: row[76],
            blindsight: row[77],
            darkvision: row[78],
            truesight: row[79]
        }
    };
}

function sanitizeMoves(moveString, maxMoves) {
    if (!moveString) return '';
    return moveString.split(',').map(m => m.trim()).filter(m => m).slice(0, maxMoves).join(', ');
}

async function getImageUrl(pokemonName, pokemonId) {
    const paddedId = pokemonId.toString().padStart(3, '0');
    const sanitizedName = sanitizeFileName(pokemonName);
    const baseFileName = `${paddedId}-${sanitizedName}`;
    
    for (const format of IMAGE_FORMATS) {
        const url = `${IMAGE_BASE_URL}${baseFileName}.${format}`;
        if (await imageExists(url)) return url;
    }
    return null;
}

function imageExists(url) {
    return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// ===========================================
// VIEW MANAGEMENT
// ===========================================

function showView(viewName) {
    state.currentView = viewName;
    
    document.querySelectorAll('.nav-tab').forEach(tab => tab.classList.remove('active'));
    document.getElementById(`${viewName}Tab`)?.classList.add('active');
    
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.getElementById(`${viewName}View`)?.classList.add('active');
}

// ===========================================
// FILTER SYSTEM
// ===========================================

function populateFilters() {
    const filterOptions = {
        types: new Set(),
        sizes: new Set(),
        behaviors: new Set(),
        activities: new Set(),
        rarities: new Set(),
        habitats: new Set()
    };
    
    state.pokemonData.forEach(pokemon => {
        if (isRegistered(pokemon.name)) {
            filterOptions.types.add(pokemon.primaryType);
            if (pokemon.secondaryType) filterOptions.types.add(pokemon.secondaryType);
            if (pokemon.size) filterOptions.sizes.add(pokemon.size);
            if (pokemon.behavior) filterOptions.behaviors.add(pokemon.behavior);
            if (pokemon.activityTime) filterOptions.activities.add(pokemon.activityTime);
            if (pokemon.rarity) filterOptions.rarities.add(pokemon.rarity);
            if (pokemon.habitat) filterOptions.habitats.add(pokemon.habitat);
        }
    });
    
    populateSelect('typeFilter', filterOptions.types, 'All Types');
    populateSelect('sizeFilter', filterOptions.sizes, 'All Sizes');
    populateSelect('behaviorFilter', filterOptions.behaviors, 'All Behaviors');
    populateSelect('activityFilter', filterOptions.activities, 'All Activities');
    populateSelect('rarityFilter', filterOptions.rarities, 'All Rarities');
    populateSelect('habitatFilter', filterOptions.habitats, 'All Habitats');
}

function populateSelect(id, options, defaultText) {
    const select = document.getElementById(id);
    if (!select) return;
    
    select.innerHTML = `<option value="">${defaultText}</option>`;
    [...options].sort().forEach(option => {
        if (option) {
            const opt = document.createElement('option');
            opt.value = option;
            opt.textContent = option;
            select.appendChild(opt);
        }
    });
}

// ===========================================
// REGISTRATION HELPERS
// ===========================================

function isRegistered(pokemonName) {
    return state.config.registered.some(name => name.toLowerCase() === pokemonName.toLowerCase());
}

function getVisibility(pokemonName) {
    const key = pokemonName.toLowerCase();
    const vis = state.config.visibility[key];
    if (vis) return { ...DEFAULT_VISIBILITY, ...vis };
    return { ...state.config.defaults };
}

// ===========================================
// POKEMON SEARCH & DISPLAY
// ===========================================

function searchPokemon() {
    const searchTerm = document.getElementById('searchInput').value.trim().toLowerCase();
    const typeFilter = document.getElementById('typeFilter').value;
    const sizeFilter = document.getElementById('sizeFilter').value;
    const behaviorFilter = document.getElementById('behaviorFilter').value;
    const activityFilter = document.getElementById('activityFilter').value;
    const rarityFilter = document.getElementById('rarityFilter').value;
    const habitatFilter = document.getElementById('habitatFilter').value;
    
    state.currentResults = state.pokemonData.filter(pokemon => {
        if (!pokemon || typeof pokemon !== 'object') return false;
        if (!isRegistered(pokemon.name)) return false;
        
        if (typeFilter && pokemon.primaryType !== typeFilter && pokemon.secondaryType !== typeFilter) return false;
        if (sizeFilter && pokemon.size !== sizeFilter) return false;
        if (behaviorFilter && pokemon.behavior !== behaviorFilter) return false;
        if (activityFilter && pokemon.activityTime !== activityFilter) return false;
        if (rarityFilter && pokemon.rarity !== rarityFilter) return false;
        if (habitatFilter && pokemon.habitat !== habitatFilter) return false;
        
        if (!searchTerm) return true;
        
        if (!isNaN(searchTerm) && searchTerm !== "") {
            return pokemon.id === searchTerm;
        }
        
        const vis = getVisibility(pokemon.name);
        if (pokemon.name.toLowerCase().includes(searchTerm)) return true;
        
        if (vis.primaryType && pokemon.primaryType.toLowerCase().includes(searchTerm)) return true;
        if (vis.secondaryType && pokemon.secondaryType?.toLowerCase().includes(searchTerm)) return true;
        
        return false;
    });
    
    state.currentPage = 1;
    displayPokemonResults();
}

function displayPokemonResults() {
    const container = document.getElementById('pokemonResults');
    container.innerHTML = '';
    
    if (state.currentResults.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No Pokémon found. Try different search terms or filters.</p>';
        return;
    }
    
    const totalPages = Math.ceil(state.currentResults.length / RESULTS_PER_PAGE);
    const startIndex = (state.currentPage - 1) * RESULTS_PER_PAGE;
    const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, state.currentResults.length);
    
    const info = document.createElement('p');
    info.className = 'results-info';
    info.textContent = `Showing ${startIndex + 1}-${endIndex} of ${state.currentResults.length} results`;
    container.appendChild(info);
    
    for (let i = startIndex; i < endIndex; i++) {
        container.appendChild(createPokemonCard(state.currentResults[i]));
    }
    
    if (totalPages > 1) {
        container.appendChild(createPagination(totalPages));
    }
}

function createPokemonCard(pokemon) {
    const visibility = getVisibility(pokemon.name);
    const card = document.createElement('div');
    card.className = 'pokemon-card';
    card.dataset.pokemon = pokemon.name;
    
    const primaryColor = getTypeColor(pokemon.primaryType);
    const secondaryColor = pokemon.secondaryType ? getTypeColor(pokemon.secondaryType) : primaryColor;
    
    // Determine header background based on visible types
    const showPrimary = visibility.primaryType;
    const showSecondary = visibility.secondaryType && pokemon.secondaryType;
    
    let headerBg = 'var(--bg-elevated)';
    if (showPrimary && showSecondary) {
        headerBg = `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)`;
    } else if (showPrimary) {
        headerBg = primaryColor;
    } else if (showSecondary) {
        headerBg = secondaryColor;
    }
    
    let html = '';
    
    // Header with type-colored border/frame
    html += `<div class="card-header" style="background: ${headerBg}">`;
    
    // Image side (in the colored area)
    html += '<div class="card-header-image">';
    if (pokemon.image) {
        html += `<img src="${pokemon.image}" alt="${pokemon.name}" class="header-image">`;
    } else {
        html += '<div class="header-no-image">?</div>';
    }
    html += '</div>';
    
    // Recessed dark panel for data
    html += '<div class="card-header-info">';
    
    // Admin edit button
    if (state.isAdminMode) {
        html += `<button class="card-edit-btn" data-pokemon="${pokemon.name}">✏️</button>`;
    }
    
    html += `<span class="card-number">#${pokemon.id}</span>`;
    html += `<h2 class="card-name">${pokemon.name}</h2>`;
    
    // Types with original colors (granular)
    html += '<div class="card-types">';
    if (showPrimary) {
        html += `<span class="type-pill" style="background:${primaryColor}">${pokemon.primaryType}</span>`;
    }
    if (showSecondary) {
        html += `<span class="type-pill" style="background:${secondaryColor}">${pokemon.secondaryType}</span>`;
    }
    if (!showPrimary && !showSecondary) {
        html += '<span class="type-pill unknown">Unknown</span>';
    }
    html += '</div>';
    
    // Classification
    if (visibility.description && pokemon.classification) {
        html += `<p class="card-classification">${pokemon.classification}</p>`;
    }
    
    html += '</div></div>';
    
    // Flavor text (if enabled)
    if (visibility.description && pokemon.flavorText) {
        html += `<p class="card-flavor">${pokemon.flavorText}</p>`;
    }
    
    // Tabbed sections
    const tabs = [];
    const tabContents = [];
    
    // Characteristics tab (granular)
    const hasAnyChar = (visibility.charSize && pokemon.size) || 
                       (visibility.charRarity && pokemon.rarity) || 
                       (visibility.charBehavior && pokemon.behavior) || 
                       (visibility.charHabitat && pokemon.habitat) || 
                       (visibility.charActivity && pokemon.activityTime);
    if (hasAnyChar) {
        tabs.push({ id: 'chars', label: 'Info', icon: '📋' });
        let content = '<div class="tab-content-inner"><div class="char-grid">';
        if (visibility.charSize && pokemon.size) content += `<div class="char-item"><span class="char-label">Size</span><span class="char-value">${pokemon.size}</span></div>`;
        if (visibility.charRarity && pokemon.rarity) content += `<div class="char-item"><span class="char-label">Rarity</span><span class="char-value">${pokemon.rarity}</span></div>`;
        if (visibility.charBehavior && pokemon.behavior) content += `<div class="char-item"><span class="char-label">Behavior</span><span class="char-value">${pokemon.behavior}</span></div>`;
        if (visibility.charHabitat && pokemon.habitat) content += `<div class="char-item"><span class="char-label">Habitat</span><span class="char-value">${pokemon.habitat}</span></div>`;
        if (visibility.charActivity && pokemon.activityTime) content += `<div class="char-item"><span class="char-label">Activity</span><span class="char-value">${pokemon.activityTime}</span></div>`;
        content += '</div></div>';
        tabContents.push({ id: 'chars', content });
    }
    
    // Stats tab (granular)
    const hasAnyCombatStat = visibility.statAC || visibility.statHD || visibility.statVD || visibility.statSpeed;
    const hasAnyAbilityStat = visibility.statSTR || visibility.statDEX || visibility.statCON || 
                              visibility.statINT || visibility.statWIS || visibility.statCHA;
    const hasAnyExtraStat = (visibility.statSaves && pokemon.savingThrows) || (visibility.statSkills && pokemon.skills);
    
    if (hasAnyCombatStat || hasAnyAbilityStat || hasAnyExtraStat) {
        tabs.push({ id: 'stats', label: 'Stats', icon: '📊' });
        let content = '<div class="tab-content-inner">';
        
        // Combat stats row
        if (hasAnyCombatStat) {
            content += '<div class="combat-stats">';
            if (visibility.statAC) content += `<div class="combat-stat"><span class="combat-value">${pokemon.ac}</span><span class="combat-label">AC</span></div>`;
            if (visibility.statHD) content += `<div class="combat-stat"><span class="combat-value">${pokemon.hitDice}</span><span class="combat-label">Hit Dice</span></div>`;
            if (visibility.statVD) content += `<div class="combat-stat"><span class="combat-value">${pokemon.vitalityDice}</span><span class="combat-label">Vitality</span></div>`;
            if (visibility.statSpeed) content += `<div class="combat-stat"><span class="combat-value">${pokemon.speed}</span><span class="combat-label">Speed</span></div>`;
            content += '</div>';
        }
        
        // Ability scores
        if (hasAnyAbilityStat) {
            content += '<div class="stat-hexagon">';
            if (visibility.statSTR) content += `<div class="hex-stat"><span class="hex-value">${pokemon.strength}</span><span class="hex-label">STR</span></div>`;
            if (visibility.statDEX) content += `<div class="hex-stat"><span class="hex-value">${pokemon.dexterity}</span><span class="hex-label">DEX</span></div>`;
            if (visibility.statCON) content += `<div class="hex-stat"><span class="hex-value">${pokemon.constitution}</span><span class="hex-label">CON</span></div>`;
            if (visibility.statINT) content += `<div class="hex-stat"><span class="hex-value">${pokemon.intelligence}</span><span class="hex-label">INT</span></div>`;
            if (visibility.statWIS) content += `<div class="hex-stat"><span class="hex-value">${pokemon.wisdom}</span><span class="hex-label">WIS</span></div>`;
            if (visibility.statCHA) content += `<div class="hex-stat"><span class="hex-value">${pokemon.charisma}</span><span class="hex-label">CHA</span></div>`;
            content += '</div>';
        }
        
        if (visibility.statSaves && pokemon.savingThrows) content += `<p class="stat-extra"><strong>Saves:</strong> ${pokemon.savingThrows}</p>`;
        if (visibility.statSkills && pokemon.skills) content += `<p class="stat-extra"><strong>Skills:</strong> ${pokemon.skills}</p>`;
        content += '</div>';
        tabContents.push({ id: 'stats', content });
    }
    
    // Abilities tab
    const hasAnyAbility = visibility.primaryAbility || visibility.secondaryAbility || visibility.hiddenAbility;
    if (hasAnyAbility) {
        tabs.push({ id: 'abilities', label: 'Abilities', icon: '✨' });
        let content = '<div class="tab-content-inner"><div class="ability-list">';
        if (visibility.primaryAbility && pokemon.primaryAbility) {
            content += `<div class="ability-card">
                <div class="ability-header"><span class="ability-name">${pokemon.primaryAbility.name}</span></div>
                <p class="ability-desc">${pokemon.primaryAbility.description}</p>
            </div>`;
        }
        if (visibility.secondaryAbility && pokemon.secondaryAbility) {
            content += `<div class="ability-card">
                <div class="ability-header"><span class="ability-name">${pokemon.secondaryAbility.name}</span></div>
                <p class="ability-desc">${pokemon.secondaryAbility.description}</p>
            </div>`;
        }
        if (visibility.hiddenAbility && pokemon.hiddenAbility) {
            content += `<div class="ability-card hidden">
                <div class="ability-header"><span class="ability-name">${pokemon.hiddenAbility.name}</span><span class="ability-tag">Hidden</span></div>
                <p class="ability-desc">${pokemon.hiddenAbility.description}</p>
            </div>`;
        }
        content += '</div></div>';
        tabContents.push({ id: 'abilities', content });
    }
    
    // Senses tab (granular)
    const senseMap = {
        'Darkvision': 'senseDarkvision',
        'Blindsight': 'senseBlindsight', 
        'Tremorsense': 'senseTremorsense',
        'Trillsense': 'senseTrillsense',
        'Mindsense': 'senseMindsense'
    };
    const visibleSenses = Object.entries(pokemon.senses)
        .filter(([k, v]) => {
            if (!v || v === "0" || v.toLowerCase() === "no" || v === "-") return false;
            const visKey = senseMap[k];
            return visKey ? visibility[visKey] : false;
        });
    
    if (visibleSenses.length > 0) {
        tabs.push({ id: 'senses', label: 'Senses', icon: '👁️' });
        let content = '<div class="tab-content-inner"><div class="sense-list">';
        visibleSenses.forEach(([k, v]) => {
            content += `<div class="sense-row"><span class="sense-name">${k}</span><span class="sense-value">${v}</span></div>`;
        });
        content += '</div></div>';
        tabContents.push({ id: 'senses', content });
    }
    
    // Evolution tab (granular)
    if (pokemon.evolutionReq && (visibility.evoFrom || visibility.evoTo)) {
        const evoData = parseEvolutionData(pokemon.evolutionReq);
        const showFrom = visibility.evoFrom && evoData.evolvesFrom;
        const showTo = visibility.evoTo && evoData.evolvesTo.length > 0;
        
        if (showFrom || showTo) {
            tabs.push({ id: 'evo', label: 'Evolution', icon: '🔄' });
            let content = '<div class="tab-content-inner"><div class="evo-chain">';
            if (showFrom) {
                if (evoData.evolvesFrom.type === 'fusion') {
                    content += `<div class="evo-item evo-from"><span class="evo-label">Fusion from</span><span class="evo-name">${evoData.evolvesFrom.pokemon1} + ${evoData.evolvesFrom.pokemon2}</span></div>`;
                } else {
                    content += `<div class="evo-item evo-from"><span class="evo-label">Evolves from</span><span class="evo-name">${evoData.evolvesFrom.pokemon}</span></div>`;
                }
            }
            if (showTo) {
                evoData.evolvesTo.forEach(evo => {
                    content += `<div class="evo-item evo-to"><span class="evo-label">Evolves to</span><span class="evo-name">${evo.target}</span></div>`;
                });
            }
            content += '</div></div>';
            tabContents.push({ id: 'evo', content });
        }
    }
    
    // Moves tab
    if (visibility.moves) {
        const movesContent = createMovesTabContent(pokemon, visibility.movesMaxLevel || 1, visibility.extraVisibleMoves || []);
        if (movesContent) {
            tabs.push({ id: 'moves', label: 'Moves', icon: '⚔️' });
            tabContents.push({ id: 'moves', content: movesContent });
        }
    }
    
    // Build tabs UI (no tab selected by default)
    if (tabs.length > 0) {
        html += '<div class="card-tabs">';
        html += '<div class="tab-bar">';
        tabs.forEach((tab) => {
            html += `<button class="tab-btn" data-tab="${tab.id}"><span class="tab-icon">${tab.icon}</span><span class="tab-label">${tab.label}</span></button>`;
        });
        html += '</div>';
        html += '<div class="tab-panels">';
        tabContents.forEach((tc) => {
            html += `<div class="tab-panel" data-panel="${tc.id}">${tc.content}</div>`;
        });
        html += '</div>';
        html += '</div>';
    }
    
    card.innerHTML = html;
    return card;
}

function createMovesTabContent(pokemon, maxLevel, extraVisibleMoves = []) {
    const moveLevels = [
        { level: 1, title: "Starting Moves", moves: pokemon.moves.starting },
        { level: 2, title: "Level 2", moves: pokemon.moves.level2 },
        { level: 6, title: "Level 6", moves: pokemon.moves.level6 },
        { level: 10, title: "Level 10", moves: pokemon.moves.level10 },
        { level: 14, title: "Level 14", moves: pokemon.moves.level14 },
        { level: 18, title: "Level 18", moves: pokemon.moves.level18 }
    ];
    
    const extraLower = extraVisibleMoves.map(m => m.toLowerCase());
    let html = '<div class="tab-content-inner"><div class="moves-container">';
    let hasAnyMoves = false;
    
    moveLevels.forEach(section => {
        const allMoves = section.moves.split(', ').filter(m => m);
        if (allMoves.length === 0) return;
        
        const visibleMoves = allMoves.filter(m => section.level <= maxLevel || extraLower.includes(m.toLowerCase()));
        if (visibleMoves.length === 0) return;
        
        hasAnyMoves = true;
        const hiddenCount = allMoves.length - visibleMoves.length;
        
        html += `<div class="move-group">`;
        html += `<div class="move-group-header">${section.title}${hiddenCount > 0 ? ` <span class="move-hidden-count">+${hiddenCount}</span>` : ''}</div>`;
        
        visibleMoves.forEach(moveName => {
            const move = state.moveData.find(m => m.name === moveName);
            if (!move) return;
            const typeColor = getTypeColor(move.type);
            
            html += `<div class="move-entry" data-move="${moveName}">
                <div class="move-summary">
                    <span class="move-name">${move.name}</span>
                    <div class="move-tags">
                        <span class="move-type-tag" style="background:${typeColor}">${move.type}</span>
                        <span class="move-vp-tag">${move.vp} VP</span>
                    </div>
                </div>
                <div class="move-expand">
                    <div class="move-stats">
                        ${move.power ? `<span><b>Power:</b> ${move.power}</span>` : ''}
                        <span><b>Time:</b> ${move.time}</span>
                        <span><b>Range:</b> ${move.range}</span>
                        <span><b>Duration:</b> ${move.duration}</span>
                    </div>
                    <p class="move-description">${move.description}</p>
                    ${move.higher ? `<p class="move-higher"><b>Higher Levels:</b> ${move.higher}</p>` : ''}
                </div>
            </div>`;
        });
        
        html += '</div>';
    });
    
    html += '</div></div>';
    return hasAnyMoves ? html : null;
}

// ===========================================
// MOVE SEARCH
// ===========================================

function getSearchableMoves() {
    // Build set of all searchable move names
    const searchable = new Set();
    
    // Add moves from registered Pokémon up to their visibility level
    state.pokemonData.forEach(pokemon => {
        if (!isRegistered(pokemon.name)) return;
        const vis = getVisibility(pokemon.name);
        if (!vis.moves) return;
        
        const maxLevel = vis.movesMaxLevel || 1;
        const extraMoves = vis.extraVisibleMoves || [];
        
        const moveLevels = [
            { level: 1, moves: pokemon.moves.starting },
            { level: 2, moves: pokemon.moves.level2 },
            { level: 6, moves: pokemon.moves.level6 },
            { level: 10, moves: pokemon.moves.level10 },
            { level: 14, moves: pokemon.moves.level14 },
            { level: 18, moves: pokemon.moves.level18 }
        ];
        
        moveLevels.forEach(({ level, moves }) => {
            if (level <= maxLevel) {
                moves.split(', ').filter(m => m).forEach(m => searchable.add(m));
            }
        });
        
        // Add extra visible moves for this Pokémon
        extraMoves.forEach(m => searchable.add(m));
    });
    
    // Add globally searchable moves from config
    (state.config.extraSearchableMoves || []).forEach(m => searchable.add(m));
    
    return searchable;
}

function searchMoves() {
    const searchTerm = document.getElementById('moveSearchInput').value.toLowerCase().trim();
    const level = parseInt(document.getElementById('pokemonLevelInput').value) || 20;
    const container = document.getElementById('moveResults');
    container.innerHTML = '';
    
    if (!searchTerm) {
        container.innerHTML = '<p class="placeholder-text">Enter a move name or Pokémon name to search</p>';
        return;
    }
    
    const searchableMoves = getSearchableMoves();
    
    // Check if searching for a Pokémon's moves
    const pokemon = state.pokemonData.find(p => p.name.toLowerCase() === searchTerm);
    
    if (pokemon) {
        if (!isRegistered(pokemon.name)) {
            container.innerHTML = `<p class="placeholder-text"><strong>${pokemon.name}</strong> is not registered in the Pokédex.</p>`;
            return;
        }
        
        const vis = getVisibility(pokemon.name);
        if (!vis.moves) {
            container.innerHTML = `<p class="placeholder-text">Move data for <strong>${pokemon.name}</strong> has not been discovered yet.</p>`;
            return;
        }
        
        const maxLevel = Math.min(level, vis.movesMaxLevel || 1);
        const availableMoves = getMovesUpToLevel(pokemon, maxLevel);
        
        // Also include extra visible moves
        const extraMoves = vis.extraVisibleMoves || [];
        extraMoves.forEach(m => {
            if (!availableMoves.includes(m)) availableMoves.push(m);
        });
        
        const results = state.moveData.filter(m => availableMoves.includes(m.name));
        
        container.innerHTML = `<h3 class="results-title">Moves for ${pokemon.name} (up to Level ${maxLevel})</h3>`;
        
        if (results.length === 0) {
            container.innerHTML += '<p class="placeholder-text">No moves available at this level.</p>';
        } else {
            const grid = document.createElement('div');
            grid.className = 'move-results-grid';
            results.forEach(move => grid.appendChild(createMoveCard(move)));
            container.appendChild(grid);
        }
    } else {
        // Search for moves by name/type - only show searchable moves
        const results = state.moveData.filter(move => {
            if (!searchableMoves.has(move.name)) return false;
            return move.name.toLowerCase().includes(searchTerm) ||
                   move.type.toLowerCase().includes(searchTerm);
        });
        
        if (results.length === 0) {
            container.innerHTML = '<p class="placeholder-text">No moves found matching that search.</p>';
        } else {
            container.innerHTML = `<p class="results-info">${results.length} move(s) found</p>`;
            const grid = document.createElement('div');
            grid.className = 'move-results-grid';
            results.slice(0, 50).forEach(move => grid.appendChild(createMoveCard(move)));
            container.appendChild(grid);
        }
    }
}

function getMovesUpToLevel(pokemon, level) {
    const moveLevels = { 1: pokemon.moves.starting, 2: pokemon.moves.level2, 6: pokemon.moves.level6, 10: pokemon.moves.level10, 14: pokemon.moves.level14, 18: pokemon.moves.level18 };
    const moves = new Set();
    for (const [moveLevel, moveStr] of Object.entries(moveLevels)) {
        if (level >= parseInt(moveLevel)) {
            moveStr.split(', ').filter(m => m).forEach(m => moves.add(m));
        }
    }
    return Array.from(moves);
}

function createMoveCard(move) {
    const card = document.createElement('div');
    card.className = 'move-card';
    const typeColor = getTypeColor(move.type);
    
    card.innerHTML = `
        <div class="move-card-header" style="background:${typeColor}">
            <span class="move-card-name">${move.name}</span>
            <span class="move-card-type">${move.type}</span>
        </div>
        <div class="move-card-body">
            <div class="move-card-stats">
                <div class="move-card-stat"><span>VP</span><span>${move.vp}</span></div>
                <div class="move-card-stat"><span>Power</span><span>${move.power || '-'}</span></div>
                <div class="move-card-stat"><span>Time</span><span>${move.time || '-'}</span></div>
                <div class="move-card-stat"><span>Range</span><span>${move.range || '-'}</span></div>
            </div>
            <div class="move-card-desc">${move.description}</div>
            ${move.higher ? `<div class="move-card-higher"><strong>Higher:</strong> ${move.higher}</div>` : ''}
        </div>
    `;
    return card;
}

// ===========================================
// PAGINATION
// ===========================================

function createPagination(totalPages) {
    const pagination = document.createElement('div');
    pagination.className = 'pagination';
    pagination.innerHTML = `
        <button class="btn btn-secondary" ${state.currentPage === 1 ? 'disabled' : ''} data-page="prev">← Prev</button>
        <span class="pagination-info">Page ${state.currentPage} of ${totalPages}</span>
        <button class="btn btn-secondary" ${state.currentPage === totalPages ? 'disabled' : ''} data-page="next">Next →</button>
    `;
    return pagination;
}

// ===========================================
// ADMIN MODE
// ===========================================

function toggleAdminMode() {
    if (state.isAdminMode) {
        openAdminPanel();
    } else {
        document.getElementById('adminLoginModal').classList.add('active');
        document.getElementById('adminPassword').focus();
    }
}

function attemptAdminLogin() {
    const password = document.getElementById('adminPassword').value;
    if (password === ADMIN_PASSWORD) {
        state.isAdminMode = true;
        document.body.classList.add('admin-mode');
        setCachedData(CACHE_KEYS.ADMIN_SESSION, { loggedIn: true, timestamp: Date.now() });
        closeAdminLogin();
        openAdminPanel();
        showToast('Admin mode activated', 'success');
    } else {
        document.getElementById('loginError').style.display = 'block';
        document.getElementById('adminPassword').value = '';
    }
}

function closeAdminLogin() {
    document.getElementById('adminLoginModal').classList.remove('active');
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginError').style.display = 'none';
}

function openAdminPanel() {
    populateAdminPokemonList();
    updateRegistrationStats();
    populateDefaultsTab();
    populateSearchableMovesTab();
    document.getElementById('adminModal').classList.add('active');
}

function closeAdminPanel() {
    document.getElementById('adminModal').classList.remove('active');
    if (state.currentResults.length > 0) displayPokemonResults();
}

function logoutAdmin() {
    state.isAdminMode = false;
    document.body.classList.remove('admin-mode');
    localStorage.removeItem(CACHE_KEYS.ADMIN_SESSION);
    closeAdminPanel();
    if (state.currentResults.length > 0) displayPokemonResults();
    showToast('Logged out', 'success');
}

function restoreAdminSession() {
    const session = getCachedData(CACHE_KEYS.ADMIN_SESSION);
    if (session?.loggedIn) {
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - (session.timestamp || 0) < maxAge) {
            state.isAdminMode = true;
            document.body.classList.add('admin-mode');
        } else {
            localStorage.removeItem(CACHE_KEYS.ADMIN_SESSION);
        }
    }
}

// ===========================================
// ADMIN - POKEMON LIST
// ===========================================

function populateAdminPokemonList() {
    const container = document.getElementById('adminPokemonList');
    const searchTerm = document.getElementById('adminPokemonSearch')?.value.toLowerCase() || '';
    
    const filtered = state.pokemonData.filter(p => 
        p.name.toLowerCase().includes(searchTerm) ||
        p.id.toString().includes(searchTerm) ||
        p.primaryType.toLowerCase().includes(searchTerm)
    );
    
    container.innerHTML = filtered.map(pokemon => {
        const registered = isRegistered(pokemon.name);
        const isExpanded = state.expandedAdminRows.has(pokemon.name);
        const primaryColor = getTypeColor(pokemon.primaryType);
        const secondaryColor = pokemon.secondaryType ? getTypeColor(pokemon.secondaryType) : null;
        
        return `
            <div class="admin-pokemon-row ${registered ? 'registered' : ''} ${isExpanded ? 'expanded' : ''}" data-pokemon="${pokemon.name}">
                <div class="admin-pokemon-header" data-pokemon="${pokemon.name}">
                    <input type="checkbox" class="pokemon-select" data-name="${pokemon.name}">
                    <span class="pokemon-id">#${pokemon.id}</span>
                    <span class="pokemon-name">${pokemon.name}</span>
                    <div class="pokemon-types">
                        <span class="mini-badge" style="background:${primaryColor}">${pokemon.primaryType.substring(0,3)}</span>
                        ${secondaryColor ? `<span class="mini-badge" style="background:${secondaryColor}">${pokemon.secondaryType.substring(0,3)}</span>` : ''}
                    </div>
                    <span class="status-badge ${registered ? 'registered' : ''}">${registered ? '✓' : '○'}</span>
                    <span class="expand-arrow">${isExpanded ? '▲' : '▼'}</span>
                </div>
                ${isExpanded ? createAdminExpandedContent(pokemon) : ''}
            </div>
        `;
    }).join('');
}

function createAdminExpandedContent(pokemon) {
    const registered = isRegistered(pokemon.name);
    const vis = registered ? getVisibility(pokemon.name) : DEFAULT_VISIBILITY;
    
    // Count visible fields for summary
    const visibleCount = Object.entries(vis).filter(([k, v]) => 
        typeof v === 'boolean' && v && k !== 'movesMaxLevel'
    ).length;
    
    return `
        <div class="admin-pokemon-body">
            <div class="admin-controls-row">
                <button class="btn btn-small ${registered ? 'btn-danger' : 'btn-success'}" data-action="toggle-register" data-pokemon="${pokemon.name}">
                    ${registered ? 'Unregister' : 'Register'}
                </button>
                ${registered ? `
                    <button class="btn btn-small btn-primary" onclick="openPokemonEditModal('${pokemon.name}')">✏️ Edit Visibility</button>
                    <button class="btn btn-small btn-secondary" data-action="show-all" data-pokemon="${pokemon.name}">Show All</button>
                    <button class="btn btn-small btn-secondary" data-action="hide-all" data-pokemon="${pokemon.name}">Hide All</button>
                ` : ''}
            </div>
            ${registered ? `
                <div class="visibility-summary">
                    <p><strong>${visibleCount}</strong> fields visible · Moves up to Lv ${vis.movesMaxLevel || 1}${(vis.extraVisibleMoves || []).length > 0 ? ` · +${vis.extraVisibleMoves.length} extra moves` : ''}</p>
                    <button class="btn btn-small btn-secondary" data-action="edit-moves" data-pokemon="${pokemon.name}">Edit Moves</button>
                </div>
            ` : '<p class="register-hint">Register this Pokémon to configure visibility settings</p>'}
        </div>
    `;
}

function toggleAdminRow(pokemonName) {
    if (state.expandedAdminRows.has(pokemonName)) {
        state.expandedAdminRows.delete(pokemonName);
    } else {
        state.expandedAdminRows.add(pokemonName);
    }
    populateAdminPokemonList();
}

function toggleRegistration(pokemonName) {
    const index = state.config.registered.findIndex(n => n.toLowerCase() === pokemonName.toLowerCase());
    
    if (index >= 0) {
        state.config.registered.splice(index, 1);
        delete state.config.visibility[pokemonName.toLowerCase()];
        showToast(`${pokemonName} unregistered`, 'success');
    } else {
        state.config.registered.push(pokemonName);
        state.config.visibility[pokemonName.toLowerCase()] = { ...state.config.defaults };
        showToast(`${pokemonName} registered`, 'success');
    }
    
    saveConfigLocally();
    populateAdminPokemonList();
    updateRegistrationStats();
    populateFilters();
}

function updateVisibilityField(pokemonName, field, value) {
    const key = pokemonName.toLowerCase();
    if (!state.config.visibility[key]) {
        state.config.visibility[key] = { ...state.config.defaults };
    }
    state.config.visibility[key][field] = value;
    saveConfigLocally();
}

function setAllVisibility(pokemonName, visible) {
    const key = pokemonName.toLowerCase();
    const pokemon = state.pokemonData.find(p => p.name === pokemonName);
    
    state.config.visibility[key] = {
        // Types
        primaryType: visible,
        secondaryType: visible && !!pokemon?.secondaryType,
        
        // Description
        description: visible,
        
        // Characteristics
        charSize: visible,
        charRarity: visible,
        charBehavior: visible,
        charHabitat: visible,
        charActivity: visible,
        
        // Combat stats
        statAC: visible,
        statHD: visible,
        statVD: visible,
        statSpeed: visible,
        
        // Ability scores
        statSTR: visible,
        statDEX: visible,
        statCON: visible,
        statINT: visible,
        statWIS: visible,
        statCHA: visible,
        statSaves: visible,
        statSkills: visible,
        
        // Abilities
        primaryAbility: visible,
        secondaryAbility: visible && !!pokemon?.secondaryAbility,
        hiddenAbility: visible && !!pokemon?.hiddenAbility,
        
        // Senses
        senseDarkvision: visible,
        senseBlindsight: visible,
        senseTremorsense: visible,
        senseTrillsense: visible,
        senseMindsense: visible,
        
        // Evolution
        evoFrom: visible,
        evoTo: visible,
        
        // Moves
        moves: visible,
        movesMaxLevel: visible ? 20 : 1,
        extraVisibleMoves: []
    };
    
    saveConfigLocally();
    populateAdminPokemonList();
    showToast(visible ? 'All fields shown' : 'All fields hidden', 'success');
}

function selectAllVisible() {
    document.querySelectorAll('.admin-pokemon-list .pokemon-select').forEach(cb => cb.checked = true);
}

function registerSelected() {
    let count = 0;
    document.querySelectorAll('.admin-pokemon-list .pokemon-select:checked').forEach(cb => {
        const name = cb.dataset.name;
        if (!isRegistered(name)) {
            state.config.registered.push(name);
            state.config.visibility[name.toLowerCase()] = { ...state.config.defaults };
            count++;
        }
        cb.checked = false;
    });
    
    if (count > 0) {
        saveConfigLocally();
        populateAdminPokemonList();
        updateRegistrationStats();
        populateFilters();
        showToast(`${count} Pokémon registered`, 'success');
    }
}

function unregisterSelected() {
    let count = 0;
    document.querySelectorAll('.admin-pokemon-list .pokemon-select:checked').forEach(cb => {
        const name = cb.dataset.name;
        const index = state.config.registered.findIndex(n => n.toLowerCase() === name.toLowerCase());
        if (index >= 0) {
            state.config.registered.splice(index, 1);
            delete state.config.visibility[name.toLowerCase()];
            count++;
        }
        cb.checked = false;
    });
    
    if (count > 0) {
        saveConfigLocally();
        populateAdminPokemonList();
        updateRegistrationStats();
        populateFilters();
        showToast(`${count} Pokémon unregistered`, 'success');
    }
}

function updateRegistrationStats() {
    const total = state.pokemonData.length;
    const registered = state.config.registered.length;
    document.getElementById('registeredCount').textContent = registered;
    document.getElementById('unregisteredCount').textContent = total - registered;
}

// ===========================================
// MOVE EDIT MODAL
// ===========================================

function openMoveEditModal(pokemonName) {
    state.editingPokemonName = pokemonName;
    const pokemon = state.pokemonData.find(p => p.name === pokemonName);
    const vis = getVisibility(pokemonName);
    
    document.getElementById('moveEditPokemonName').textContent = pokemonName;
    document.getElementById('moveEditLevel').value = vis.movesMaxLevel || 1;
    
    populateMoveEditList(pokemon, vis);
    document.getElementById('moveEditModal').classList.add('active');
}

function closeMoveEditModal() {
    document.getElementById('moveEditModal').classList.remove('active');
    state.editingPokemonName = null;
    populateAdminPokemonList();
}

function populateMoveEditList(pokemon, visibility) {
    const container = document.getElementById('moveEditList');
    const maxLevel = visibility.movesMaxLevel || 1;
    const extraMoves = visibility.extraVisibleMoves || [];
    const extraLower = extraMoves.map(m => m.toLowerCase());
    
    const moveLevels = [
        { level: 1, moves: pokemon.moves.starting },
        { level: 2, moves: pokemon.moves.level2 },
        { level: 6, moves: pokemon.moves.level6 },
        { level: 10, moves: pokemon.moves.level10 },
        { level: 14, moves: pokemon.moves.level14 },
        { level: 18, moves: pokemon.moves.level18 }
    ];
    
    const allMoves = [];
    moveLevels.forEach(({ level, moves }) => {
        moves.split(', ').filter(m => m).forEach(name => allMoves.push({ name, level }));
    });
    
    container.innerHTML = allMoves.map(move => {
        const withinLevel = move.level <= maxLevel;
        const manuallyAdded = extraLower.includes(move.name.toLowerCase());
        
        return `
            <label class="move-check-item ${withinLevel ? 'within-level' : ''}">
                <input type="checkbox" ${withinLevel || manuallyAdded ? 'checked' : ''} ${withinLevel ? 'disabled' : ''} data-move="${move.name}">
                <span class="move-check-name">${move.name}</span>
                <span class="move-check-level">Lv${move.level}</span>
            </label>
        `;
    }).join('');
}

function updateMoveEditLevel() {
    if (!state.editingPokemonName) return;
    
    const level = parseInt(document.getElementById('moveEditLevel').value) || 1;
    const key = state.editingPokemonName.toLowerCase();
    
    if (!state.config.visibility[key]) {
        state.config.visibility[key] = { ...state.config.defaults };
    }
    state.config.visibility[key].movesMaxLevel = level;
    
    const pokemon = state.pokemonData.find(p => p.name === state.editingPokemonName);
    populateMoveEditList(pokemon, state.config.visibility[key]);
    saveConfigLocally();
}

function toggleExtraMove(moveName, isChecked) {
    if (!state.editingPokemonName) return;
    
    const key = state.editingPokemonName.toLowerCase();
    if (!state.config.visibility[key]) {
        state.config.visibility[key] = { ...state.config.defaults };
    }
    if (!state.config.visibility[key].extraVisibleMoves) {
        state.config.visibility[key].extraVisibleMoves = [];
    }
    
    const extra = state.config.visibility[key].extraVisibleMoves;
    const idx = extra.findIndex(m => m.toLowerCase() === moveName.toLowerCase());
    
    if (isChecked && idx === -1) {
        extra.push(moveName);
    } else if (!isChecked && idx !== -1) {
        extra.splice(idx, 1);
    }
    
    saveConfigLocally();
}

// ===========================================
// POKEMON EDIT MODAL (from card)
// ===========================================

function openPokemonEditModal(pokemonName) {
    state.editingPokemonName = pokemonName;
    const pokemon = state.pokemonData.find(p => p.name === pokemonName);
    const vis = getVisibility(pokemonName);
    
    document.getElementById('editModalPokemonName').textContent = pokemonName;
    
    // Types
    document.getElementById('cardEdit_primaryType').checked = vis.primaryType;
    document.getElementById('cardEdit_secondaryType').checked = vis.secondaryType;
    document.getElementById('cardEdit_secondaryType_row').style.display = pokemon?.secondaryType ? 'flex' : 'none';
    
    // Description
    document.getElementById('cardEdit_description').checked = vis.description;
    
    // Characteristics
    document.getElementById('cardEdit_charSize').checked = vis.charSize;
    document.getElementById('cardEdit_charRarity').checked = vis.charRarity;
    document.getElementById('cardEdit_charBehavior').checked = vis.charBehavior;
    document.getElementById('cardEdit_charHabitat').checked = vis.charHabitat;
    document.getElementById('cardEdit_charActivity').checked = vis.charActivity;
    
    // Combat stats
    document.getElementById('cardEdit_statAC').checked = vis.statAC;
    document.getElementById('cardEdit_statHD').checked = vis.statHD;
    document.getElementById('cardEdit_statVD').checked = vis.statVD;
    document.getElementById('cardEdit_statSpeed').checked = vis.statSpeed;
    
    // Ability scores
    document.getElementById('cardEdit_statSTR').checked = vis.statSTR;
    document.getElementById('cardEdit_statDEX').checked = vis.statDEX;
    document.getElementById('cardEdit_statCON').checked = vis.statCON;
    document.getElementById('cardEdit_statINT').checked = vis.statINT;
    document.getElementById('cardEdit_statWIS').checked = vis.statWIS;
    document.getElementById('cardEdit_statCHA').checked = vis.statCHA;
    document.getElementById('cardEdit_statSaves').checked = vis.statSaves;
    document.getElementById('cardEdit_statSkills').checked = vis.statSkills;
    
    // Abilities
    document.getElementById('cardEdit_primaryAbility').checked = vis.primaryAbility;
    document.getElementById('cardEdit_secondaryAbility').checked = vis.secondaryAbility;
    document.getElementById('cardEdit_hiddenAbility').checked = vis.hiddenAbility;
    document.getElementById('cardEdit_secondaryAbility_row').style.display = pokemon?.secondaryAbility ? 'flex' : 'none';
    document.getElementById('cardEdit_hiddenAbility_row').style.display = pokemon?.hiddenAbility ? 'flex' : 'none';
    
    // Senses
    document.getElementById('cardEdit_senseDarkvision').checked = vis.senseDarkvision;
    document.getElementById('cardEdit_senseBlindsight').checked = vis.senseBlindsight;
    document.getElementById('cardEdit_senseTremorsense').checked = vis.senseTremorsense;
    document.getElementById('cardEdit_senseTrillsense').checked = vis.senseTrillsense;
    document.getElementById('cardEdit_senseMindsense').checked = vis.senseMindsense;
    
    // Evolution
    document.getElementById('cardEdit_evoFrom').checked = vis.evoFrom;
    document.getElementById('cardEdit_evoTo').checked = vis.evoTo;
    
    // Moves
    document.getElementById('cardEdit_moves').checked = vis.moves;
    document.getElementById('cardEdit_movesMaxLevel').value = vis.movesMaxLevel || 1;
    
    document.getElementById('pokemonEditModal').classList.add('active');
}

function closePokemonEditModal() {
    document.getElementById('pokemonEditModal').classList.remove('active');
    state.editingPokemonName = null;
    if (state.currentResults.length > 0) displayPokemonResults();
}

function updateCardEditField(field) {
    if (!state.editingPokemonName) return;
    
    const key = state.editingPokemonName.toLowerCase();
    if (!state.config.visibility[key]) {
        state.config.visibility[key] = { ...state.config.defaults };
    }
    
    if (field === 'movesMaxLevel') {
        state.config.visibility[key].movesMaxLevel = parseInt(document.getElementById('cardEdit_movesMaxLevel').value) || 1;
    } else {
        state.config.visibility[key][field] = document.getElementById(`cardEdit_${field}`).checked;
    }
    
    saveConfigLocally();
}

function cardEditShowAll() {
    if (!state.editingPokemonName) return;
    setAllVisibility(state.editingPokemonName, true);
    closePokemonEditModal();
    openPokemonEditModal(state.editingPokemonName);
}

function cardEditHideAll() {
    if (!state.editingPokemonName) return;
    setAllVisibility(state.editingPokemonName, false);
    closePokemonEditModal();
    openPokemonEditModal(state.editingPokemonName);
}

// ===========================================
// CONFIG IMPORT/EXPORT
// ===========================================

function saveConfigLocally() {
    setCachedData(CACHE_KEYS.CONFIG, state.config);
    updateCacheTimestamp(CACHE_KEYS.CONFIG);
}

function exportConfig() {
    const blob = new Blob([JSON.stringify(state.config, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pokedex_config.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Config exported!', 'success');
}

function importConfig() {
    document.getElementById('configFileInput').click();
}

function handleConfigImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const config = JSON.parse(e.target.result);
            if (!config.registered || !Array.isArray(config.registered)) {
                throw new Error('Invalid config');
            }
            
            state.config = {
                registered: config.registered || [],
                visibility: config.visibility || {},
                defaults: config.defaults || { ...DEFAULT_VISIBILITY },
                extraSearchableMoves: config.extraSearchableMoves || [],
                splashCount: config.splashCount || DEFAULT_SPLASH_COUNT
            };
            
            saveConfigLocally();
            populateAdminPokemonList();
            updateRegistrationStats();
            populateFilters();
            populateDefaultsTab();
            populateSearchableMovesTab();
            showToast('Config imported', 'success');
        } catch (err) {
            showToast('Error: ' + err.message, 'error');
        }
    };
    reader.readAsText(file);
    event.target.value = '';
}

// ===========================================
// ADMIN - DEFAULTS TAB
// ===========================================

function populateDefaultsTab() {
    const defaults = state.config.defaults || DEFAULT_VISIBILITY;
    
    // Types
    document.getElementById('default_primaryType').checked = defaults.primaryType;
    document.getElementById('default_secondaryType').checked = defaults.secondaryType;
    
    // Description
    document.getElementById('default_description').checked = defaults.description;
    
    // Characteristics
    document.getElementById('default_charSize').checked = defaults.charSize;
    document.getElementById('default_charRarity').checked = defaults.charRarity;
    document.getElementById('default_charBehavior').checked = defaults.charBehavior;
    document.getElementById('default_charHabitat').checked = defaults.charHabitat;
    document.getElementById('default_charActivity').checked = defaults.charActivity;
    
    // Combat stats
    document.getElementById('default_statAC').checked = defaults.statAC;
    document.getElementById('default_statHD').checked = defaults.statHD;
    document.getElementById('default_statVD').checked = defaults.statVD;
    document.getElementById('default_statSpeed').checked = defaults.statSpeed;
    
    // Ability scores
    document.getElementById('default_statSTR').checked = defaults.statSTR;
    document.getElementById('default_statDEX').checked = defaults.statDEX;
    document.getElementById('default_statCON').checked = defaults.statCON;
    document.getElementById('default_statINT').checked = defaults.statINT;
    document.getElementById('default_statWIS').checked = defaults.statWIS;
    document.getElementById('default_statCHA').checked = defaults.statCHA;
    document.getElementById('default_statSaves').checked = defaults.statSaves;
    document.getElementById('default_statSkills').checked = defaults.statSkills;
    
    // Abilities
    document.getElementById('default_primaryAbility').checked = defaults.primaryAbility;
    document.getElementById('default_secondaryAbility').checked = defaults.secondaryAbility;
    document.getElementById('default_hiddenAbility').checked = defaults.hiddenAbility;
    
    // Senses
    document.getElementById('default_senseDarkvision').checked = defaults.senseDarkvision;
    document.getElementById('default_senseBlindsight').checked = defaults.senseBlindsight;
    document.getElementById('default_senseTremorsense').checked = defaults.senseTremorsense;
    document.getElementById('default_senseTrillsense').checked = defaults.senseTrillsense;
    document.getElementById('default_senseMindsense').checked = defaults.senseMindsense;
    
    // Evolution
    document.getElementById('default_evoFrom').checked = defaults.evoFrom;
    document.getElementById('default_evoTo').checked = defaults.evoTo;
    
    // Moves
    document.getElementById('default_moves').checked = defaults.moves;
    document.getElementById('default_movesMaxLevel').value = defaults.movesMaxLevel || 1;
    
    // App settings
    document.getElementById('splashCountInput').value = state.config.splashCount || DEFAULT_SPLASH_COUNT;
}

function updateDefault(field) {
    if (!state.config.defaults) {
        state.config.defaults = { ...DEFAULT_VISIBILITY };
    }
    
    if (field === 'movesMaxLevel') {
        state.config.defaults.movesMaxLevel = parseInt(document.getElementById('default_movesMaxLevel').value) || 1;
    } else {
        state.config.defaults[field] = document.getElementById(`default_${field}`).checked;
    }
    
    saveConfigLocally();
    showToast('Defaults updated', 'success');
}

function updateSplashCount() {
    const count = parseInt(document.getElementById('splashCountInput').value) || DEFAULT_SPLASH_COUNT;
    state.config.splashCount = Math.max(1, Math.min(99, count));
    document.getElementById('splashCountInput').value = state.config.splashCount;
    saveConfigLocally();
    showToast('Splash count updated', 'success');
}

// ===========================================
// ADMIN - SEARCHABLE MOVES TAB
// ===========================================

function populateSearchableMovesTab() {
    const container = document.getElementById('searchableMoveslist');
    const searchTerm = document.getElementById('searchableMoveSearch')?.value?.toLowerCase() || '';
    const extraMoves = state.config.extraSearchableMoves || [];
    const extraLower = extraMoves.map(m => m.toLowerCase());
    
    // Get moves that are already searchable via Pokémon
    const pokemonMoves = new Set();
    state.pokemonData.forEach(pokemon => {
        if (!isRegistered(pokemon.name)) return;
        const vis = getVisibility(pokemon.name);
        if (!vis.moves) return;
        
        const maxLevel = vis.movesMaxLevel || 1;
        const moveLevels = [
            { level: 1, moves: pokemon.moves.starting },
            { level: 2, moves: pokemon.moves.level2 },
            { level: 6, moves: pokemon.moves.level6 },
            { level: 10, moves: pokemon.moves.level10 },
            { level: 14, moves: pokemon.moves.level14 },
            { level: 18, moves: pokemon.moves.level18 }
        ];
        
        moveLevels.forEach(({ level, moves }) => {
            if (level <= maxLevel) {
                moves.split(', ').filter(m => m).forEach(m => pokemonMoves.add(m));
            }
        });
        
        (vis.extraVisibleMoves || []).forEach(m => pokemonMoves.add(m));
    });
    
    // Filter moves by search term
    const filteredMoves = state.moveData.filter(move => {
        if (!searchTerm) return true;
        return move.name.toLowerCase().includes(searchTerm) ||
               move.type.toLowerCase().includes(searchTerm);
    });
    
    container.innerHTML = filteredMoves.map(move => {
        const isFromPokemon = pokemonMoves.has(move.name);
        const isExtra = extraLower.includes(move.name.toLowerCase());
        const typeColor = getTypeColor(move.type);
        
        return `
            <label class="searchable-move-item ${isFromPokemon ? 'from-pokemon' : ''} ${isExtra ? 'extra' : ''}">
                <input type="checkbox" 
                       ${isFromPokemon || isExtra ? 'checked' : ''} 
                       ${isFromPokemon ? 'disabled' : ''}
                       data-move="${move.name}">
                <span class="move-type-dot" style="background:${typeColor}"></span>
                <span class="move-name">${move.name}</span>
                ${isFromPokemon ? '<span class="from-pokemon-tag">via Pokémon</span>' : ''}
            </label>
        `;
    }).join('');
    
    // Update count
    const totalSearchable = pokemonMoves.size + extraMoves.filter(m => !pokemonMoves.has(m)).length;
    document.getElementById('searchableMoveCount').textContent = totalSearchable;
}

function toggleSearchableMove(moveName, isChecked) {
    if (!state.config.extraSearchableMoves) {
        state.config.extraSearchableMoves = [];
    }
    
    const extra = state.config.extraSearchableMoves;
    const idx = extra.findIndex(m => m.toLowerCase() === moveName.toLowerCase());
    
    if (isChecked && idx === -1) {
        extra.push(moveName);
    } else if (!isChecked && idx !== -1) {
        extra.splice(idx, 1);
    }
    
    saveConfigLocally();
    
    // Update the count
    const pokemonMoves = new Set();
    state.pokemonData.forEach(pokemon => {
        if (!isRegistered(pokemon.name)) return;
        const vis = getVisibility(pokemon.name);
        if (!vis.moves) return;
        const maxLevel = vis.movesMaxLevel || 1;
        const moveLevels = [
            { level: 1, moves: pokemon.moves.starting },
            { level: 2, moves: pokemon.moves.level2 },
            { level: 6, moves: pokemon.moves.level6 },
            { level: 10, moves: pokemon.moves.level10 },
            { level: 14, moves: pokemon.moves.level14 },
            { level: 18, moves: pokemon.moves.level18 }
        ];
        moveLevels.forEach(({ level, moves }) => {
            if (level <= maxLevel) {
                moves.split(', ').filter(m => m).forEach(m => pokemonMoves.add(m));
            }
        });
        (vis.extraVisibleMoves || []).forEach(m => pokemonMoves.add(m));
    });
    
    const totalSearchable = pokemonMoves.size + extra.filter(m => !pokemonMoves.has(m)).length;
    document.getElementById('searchableMoveCount').textContent = totalSearchable;
}

// ===========================================
// EVENT DELEGATION
// ===========================================

function showAdminTab(tabName) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.admin-tab-content').forEach(c => c.classList.remove('active'));
    
    document.querySelector(`.admin-tab[data-tab="${tabName}"]`)?.classList.add('active');
    document.getElementById(`${tabName}Tab`)?.classList.add('active');
}

function setupEventDelegation() {
    // Global click handler
    document.addEventListener('click', function(e) {
        const target = e.target;
        
        // Pokemon card edit button
        if (target.classList.contains('card-edit-btn') || target.closest('.card-edit-btn')) {
            const btn = target.classList.contains('card-edit-btn') ? target : target.closest('.card-edit-btn');
            const pokemonName = btn.dataset.pokemon;
            if (pokemonName) {
                e.preventDefault();
                e.stopPropagation();
                openPokemonEditModal(pokemonName);
            }
            return;
        }
        
        // Card tab switching (toggle off if clicking active tab)
        if (target.classList.contains('tab-btn') || target.closest('.tab-btn')) {
            const btn = target.classList.contains('tab-btn') ? target : target.closest('.tab-btn');
            const tabId = btn.dataset.tab;
            const card = btn.closest('.pokemon-card');
            if (card && tabId) {
                const isActive = btn.classList.contains('active');
                const tabPanels = card.querySelector('.tab-panels');
                
                // Deactivate all tabs
                card.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
                card.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
                
                if (isActive) {
                    // Close tabs
                    tabPanels.classList.remove('open');
                } else {
                    // Open new tab
                    btn.classList.add('active');
                    card.querySelector(`.tab-panel[data-panel="${tabId}"]`)?.classList.add('active');
                    tabPanels.classList.add('open');
                }
            }
            return;
        }
        
        // Move entry expansion
        if (target.closest('.move-summary')) {
            const entry = target.closest('.move-entry');
            if (entry) {
                entry.classList.toggle('expanded');
            }
            return;
        }
        
        // Pagination
        if (target.dataset.page) {
            const totalPages = Math.ceil(state.currentResults.length / RESULTS_PER_PAGE);
            if (target.dataset.page === 'prev' && state.currentPage > 1) {
                state.currentPage--;
                displayPokemonResults();
                document.getElementById('pokemonResults').scrollIntoView({ behavior: 'smooth' });
            } else if (target.dataset.page === 'next' && state.currentPage < totalPages) {
                state.currentPage++;
                displayPokemonResults();
                document.getElementById('pokemonResults').scrollIntoView({ behavior: 'smooth' });
            }
            return;
        }
        
        // Admin tab switching
        if (target.classList.contains('admin-tab') && target.dataset.tab) {
            showAdminTab(target.dataset.tab);
            return;
        }
        
        // Admin row expand
        if (target.classList.contains('admin-pokemon-header') || target.closest('.admin-pokemon-header')) {
            const header = target.classList.contains('admin-pokemon-header') ? target : target.closest('.admin-pokemon-header');
            // Don't expand if clicking checkbox
            if (target.classList.contains('pokemon-select')) return;
            const pokemonName = header.dataset.pokemon;
            if (pokemonName) toggleAdminRow(pokemonName);
            return;
        }
        
        // Admin action buttons
        if (target.dataset.action) {
            const action = target.dataset.action;
            const pokemonName = target.dataset.pokemon;
            
            if (action === 'toggle-register') toggleRegistration(pokemonName);
            else if (action === 'show-all') setAllVisibility(pokemonName, true);
            else if (action === 'hide-all') setAllVisibility(pokemonName, false);
            else if (action === 'edit-moves') openMoveEditModal(pokemonName);
            return;
        }
    });
    
    // Change handler for checkboxes and inputs
    document.addEventListener('change', function(e) {
        const target = e.target;
        
        // Visibility toggle in admin (pokemon-specific)
        if (target.dataset.field && target.dataset.pokemon) {
            const field = target.dataset.field;
            const pokemon = target.dataset.pokemon;
            
            if (field === 'movesMaxLevel') {
                updateVisibilityField(pokemon, field, parseInt(target.value) || 1);
            } else {
                updateVisibilityField(pokemon, field, target.checked);
            }
            return;
        }
        
        // Default visibility toggles
        if (target.id && target.id.startsWith('default_')) {
            const field = target.id.replace('default_', '');
            updateDefault(field);
            return;
        }
        
        // Move checkbox in move edit modal
        if (target.dataset.move && target.closest('#moveEditList')) {
            toggleExtraMove(target.dataset.move, target.checked);
            return;
        }
        
        // Searchable move checkbox
        if (target.dataset.move && target.closest('#searchableMoveslist')) {
            toggleSearchableMove(target.dataset.move, target.checked);
            return;
        }
    });
}

// ===========================================
// INITIALIZATION
// ===========================================

async function init() {
    // Show random splash image immediately
    setRandomSplash();
    
    try {
        updateLoadingProgress(5, 'Loading configuration...');
        state.config = await loadConfig();
        
        updateLoadingProgress(20, 'Loading move data...');
        state.moveData = await loadMoveData();
        
        updateLoadingProgress(40, 'Loading Pokémon data...');
        state.pokemonData = await loadPokemonData();
        
        updateLoadingProgress(90, 'Initializing...');
        
        restoreAdminSession();
        populateFilters();
        setupEventListeners();
        setupEventDelegation();
        updateLastCacheTime();
        
        hideLoading();
        
        console.log(`Loaded ${state.pokemonData.length} Pokémon, ${state.moveData.length} moves`);
        console.log(`${state.config.registered.length} registered`);
        
    } catch (error) {
        console.error('Init error:', error);
        showToast('Failed to load: ' + error.message, 'error');
    }
}

function setupEventListeners() {
    document.getElementById('searchButton')?.addEventListener('click', searchPokemon);
    document.getElementById('searchInput')?.addEventListener('keyup', e => {
        if (e.key === 'Enter') searchPokemon();
    });
    
    document.getElementById('moveSearchButton')?.addEventListener('click', searchMoves);
    document.getElementById('moveSearchInput')?.addEventListener('keyup', e => {
        if (e.key === 'Enter') searchMoves();
    });
    
    ['typeFilter', 'sizeFilter', 'behaviorFilter', 'activityFilter', 'rarityFilter', 'habitatFilter'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', searchPokemon);
    });
    
    document.getElementById('adminPokemonSearch')?.addEventListener('input', populateAdminPokemonList);
    document.getElementById('searchableMoveSearch')?.addEventListener('input', populateSearchableMovesTab);
    document.getElementById('adminPassword')?.addEventListener('keyup', e => {
        if (e.key === 'Enter') attemptAdminLogin();
    });
    
    document.getElementById('moveEditLevel')?.addEventListener('change', updateMoveEditLevel);
    document.getElementById('splashCountInput')?.addEventListener('change', updateSplashCount);
}

document.addEventListener('DOMContentLoaded', init);
