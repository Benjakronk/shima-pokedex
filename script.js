// Constants
const TYPE_COLORS = {
    normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
    grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
    ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
    rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
    steel: '#B8B8D0', fairy: '#EE99AC'
};
const IMAGE_BASE_URL = 'https://raw.githubusercontent.com/Benjakronk/shima-pokedex/main/images/';
const IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'jfif'];
const REGISTERED_POKEMON_URL = 'https://raw.githubusercontent.com/Benjakronk/shima-pokedex/main/registered_pokemon.json';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const ITEMS_PER_PAGE = 5;
const RESULTS_PER_PAGE = 5;

// Global variables
let isSoundEnabled = true;
let pokemonData = [];
let moveData = [];
let registeredPokemon = { names: new Set(), lastFetched: 0 };
let filterOptions = {
    types: new Set(), sizes: new Set(), behaviors: new Set(),
    activities: new Set(), rarities: new Set(), habitats: new Set()
};
let filteredPokemon = [];
let currentPage = 1;
let currentResults = [];
let currentFilteredPage = 1;

// Utility functions
function setAudioVolume(volume) {
    const audioElements = document.querySelectorAll('audio');
    audioElements.forEach(audio => {
        audio.volume = volume;
    });
}

function getTypeColor(type) {
    return TYPE_COLORS[type.toLowerCase()] || '#68A090';
}

function playLoadingCompleteSound() {
    if (isSoundEnabled) {
        const sound = document.getElementById('loadingCompleteSound');
        if (sound) {
            sound.play()
                .then(() => {
                    console.log('Sound played successfully');
                })
                .catch(error => console.error('Error playing sound:', error));
        } else {
            console.warn('Loading complete sound element not found');
        }
    }
}

function playSearchSelectSound() {
    if (isSoundEnabled) {
        const sound = document.getElementById('searchSelect');
        if (sound) {
            sound.play()
                .then(() => {
                    console.log('Sound played successfully');
                })
                .catch(error => console.error('Error playing sound:', error));
        } else {
            console.warn('Search select sound element not found');
        }
    }
}

function sanitizeFileName(name) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function showError(message) {
    const errorElement = document.createElement('div');
    errorElement.textContent = `Error: ${message}`;
    errorElement.style.color = 'red';
    errorElement.style.marginTop = '10px';
    document.body.appendChild(errorElement);
    setTimeout(() => errorElement.remove(), 5000);
}

function showLoading() {
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loadingIndicator';
    loadingIndicator.textContent = 'Loading...';
    loadingIndicator.style.position = 'fixed';
    loadingIndicator.style.top = '50%';
    loadingIndicator.style.left = '50%';
    loadingIndicator.style.transform = 'translate(-50%, -50%)';
    loadingIndicator.style.padding = '20px';
    loadingIndicator.style.background = 'rgba(0, 0, 0, 0.7)';
    loadingIndicator.style.color = 'white';
    loadingIndicator.style.borderRadius = '5px';
    loadingIndicator.style.zIndex = '1000';
    document.body.appendChild(loadingIndicator);
}

function hideLoading() {
    const loadingIndicator = document.getElementById('loadingIndicator');
    if (loadingIndicator) {
        loadingIndicator.textContent = 'Loading complete. Click to dismiss.';
        loadingIndicator.style.cursor = 'pointer';
        loadingIndicator.onclick = function() {
            loadingIndicator.remove();
            playLoadingCompleteSound();
        };
    }
}

function showPokemonSearch() {
    document.getElementById('pokemonSearch').style.display = 'block';
    document.getElementById('moveSearch').style.display = 'none';
    playSearchSelectSound();
    document.getElementById('moveResults').innerHTML = '';
    document.getElementById('moveSearchInput').value = '';
}

function showMoveSearch() {
    document.getElementById('pokemonSearch').style.display = 'none';
    document.getElementById('moveSearch').style.display = 'block';
    playSearchSelectSound();
    document.getElementById('results').innerHTML = '';
    document.getElementById('searchInput').value = '';
    currentResults = [];
    currentPage = 1;
}

// Pokémon data functions
async function fetchRegisteredPokemon() {
    const now = Date.now();
    if (now - registeredPokemon.lastFetched < CACHE_DURATION) {
        console.log('Using cached registered Pokémon');
        return;
    }

    try {
        const response = await fetch(REGISTERED_POKEMON_URL);
        if (!response.ok) throw new Error('Failed to fetch registered Pokémon');
        const data = await response.json();
        registeredPokemon.names = new Set(data.registered.map(name => name.toLowerCase()));
        registeredPokemon.lastFetched = now;
    } catch (error) {
        console.error('Error fetching registered Pokémon:', error);
    }
    updateFilterOptions();
}

async function loadPokemonData() {
    showLoading();
    try {
        await loadMoveData();
        await fetchRegisteredPokemon();
        const response = await fetch('https://script.google.com/macros/s/AKfycbxyw5f5sPKP2cBDk7tnGO3vH-Ql2dRJCxHtu4X7Tdwp-X2VYRnWr-s9IrVXAsAtrCNd/exec?action=pokemon');
        if (!response.ok) throw new Error('Failed to fetch Pokémon data');
        const values = await response.json();
        pokemonData = await Promise.all(values.map(processPokemonRow));
        console.log('Pokémon data processed:', pokemonData.length, 'Pokémon');
    } catch (error) {
        console.error('Error loading Pokémon data:', error);
        showError('Failed to load Pokémon data. Please try again later.');
    } finally {
        hideLoading();
    }
    updateFilterOptions();
    document.getElementById('pokedex_button').style.display = 'inline-block';
    document.getElementById('move_button').style.display = 'inline-block';
}

function updateFilterOptions() {
    filterOptions = {
        types: new Set(), sizes: new Set(), behaviors: new Set(),
        activities: new Set(), rarities: new Set(), habitats: new Set()
    };

    pokemonData.forEach(pokemon => {
        if (registeredPokemon.names.has(pokemon.name.toLowerCase())) {
            filterOptions.types.add(pokemon.primaryType);
            if (pokemon.secondaryType) filterOptions.types.add(pokemon.secondaryType);
            filterOptions.sizes.add(pokemon.size);
            filterOptions.behaviors.add(pokemon.behavior);
            filterOptions.activities.add(pokemon.activityTime);
            filterOptions.rarities.add(pokemon.rarity);
            filterOptions.habitats.add(pokemon.habitat);
        }
    });

    populateFilterDropdowns();
}

function populateFilterDropdowns() {
    populateSelect('typeFilter', filterOptions.types);
    populateSelect('sizeFilter', filterOptions.sizes);
    populateSelect('behaviorFilter', filterOptions.behaviors);
    populateSelect('activityFilter', filterOptions.activities);
    populateSelect('rarityFilter', filterOptions.rarities);
    populateSelect('habitatFilter', filterOptions.habitats);
}

function populateSelect(id, options) {
    const select = document.getElementById(id);
    let allText = `All ${id.replace('Filter', 's')}`;
    if (id === 'rarityFilter') allText = 'All rarities';
    else if (id === 'activityFilter') allText = 'All activities';
    select.innerHTML = `<option value="">${allText}</option>`;
    options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option;
        optionElement.textContent = option;
        select.appendChild(optionElement);
    });
}

function applyFilters() {
    // This function will now trigger the search
    searchPokemon();
}

function createFilterPaginationControls(totalItems, itemsPerPage, currentPage, onPageChange) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const controls = document.createElement('div');
    controls.className = 'pagination-controls';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.onclick = () => {
        if (currentPage > 1) {
            onPageChange(currentPage - 1);
        }
    };
    prevButton.disabled = currentPage === 1;
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            onPageChange(currentPage + 1);
        }
    };
    nextButton.disabled = currentPage === totalPages;
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    controls.appendChild(prevButton);
    controls.appendChild(pageInfo);
    controls.appendChild(nextButton);
    
    return controls;
}

function searchPokemon() {
    const searchTerm = document.getElementById('searchInput').value.trim();
    
    // Get filter values
    const typeFilter = document.getElementById('typeFilter').value;
    const sizeFilter = document.getElementById('sizeFilter').value;
    const behaviorFilter = document.getElementById('behaviorFilter').value;
    const activityFilter = document.getElementById('activityFilter').value;
    const rarityFilter = document.getElementById('rarityFilter').value;
    const habitatFilter = document.getElementById('habitatFilter').value;

    currentResults = pokemonData.filter(pokemon => {
        if (!pokemon || typeof pokemon !== 'object') return false;

        const isRegistered = registeredPokemon.names.has(pokemon.name.toLowerCase());
        if (!isRegistered) return false;

        // Apply filters
        if (typeFilter && pokemon.primaryType !== typeFilter && pokemon.secondaryType !== typeFilter) return false;
        if (sizeFilter && pokemon.size !== sizeFilter) return false;
        if (behaviorFilter && pokemon.behavior !== behaviorFilter) return false;
        if (activityFilter && pokemon.activityTime !== activityFilter) return false;
        if (rarityFilter && pokemon.rarity !== rarityFilter) return false;
        if (habitatFilter && pokemon.habitat !== habitatFilter) return false;

        // If searchTerm is empty, return true to show all filtered results
        if (!searchTerm) return true;

        // If searchTerm is a number, treat it as an exact ID match
        if (!isNaN(searchTerm) && searchTerm !== "") {
            return pokemon.id === searchTerm;
        }

        // Otherwise, search across name, type, and abilities
        const lowerSearchTerm = searchTerm.toLowerCase();
        return pokemon.name.toLowerCase().includes(lowerSearchTerm) || 
            pokemon.primaryType.toLowerCase().includes(lowerSearchTerm) ||
            (pokemon.secondaryType && pokemon.secondaryType.toLowerCase().includes(lowerSearchTerm)) ||
            pokemon.primaryAbility.name.toLowerCase().includes(lowerSearchTerm) ||
            (pokemon.secondaryAbility && pokemon.secondaryAbility.name.toLowerCase().includes(lowerSearchTerm)) ||
            (pokemon.hiddenAbility && pokemon.hiddenAbility.name.toLowerCase().includes(lowerSearchTerm));
    });

    currentPage = 1;
    displayResults();
}

function displayResults() {
    const resultsContainer = document.getElementById('results');
    resultsContainer.innerHTML = '';
    
    if (currentResults.length === 0) {
        resultsContainer.innerHTML = '<p>No Pokémon found. Try different search terms or filters.</p>';
    } else {
        const totalPages = Math.ceil(currentResults.length / RESULTS_PER_PAGE);
        const startIndex = (currentPage - 1) * RESULTS_PER_PAGE;
        const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, currentResults.length);
        
        const resultsInfo = document.createElement('p');
        resultsInfo.textContent = `Showing ${startIndex + 1}-${endIndex} of ${currentResults.length} results`;
        resultsContainer.appendChild(resultsInfo);
        
        for (let i = startIndex; i < endIndex; i++) {
            const pokemonCard = createPokemonCard(currentResults[i]);
            resultsContainer.appendChild(pokemonCard);
        }
        
        if (currentResults.length > RESULTS_PER_PAGE) {
            resultsContainer.appendChild(createPaginationControls());
        }
    }
}

function createPaginationControls() {
    const totalPages = Math.ceil(currentResults.length / RESULTS_PER_PAGE);
    const controls = document.createElement('div');
    controls.className = 'pagination-controls';
    
    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.onclick = () => {
        if (currentPage > 1) {
            currentPage--;
            displayResults();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    prevButton.disabled = currentPage === 1;
    
    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.onclick = () => {
        if (currentPage < totalPages) {
            currentPage++;
            displayResults();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };
    nextButton.disabled = currentPage === totalPages;
    
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    
    controls.appendChild(prevButton);
    controls.appendChild(pageInfo);
    controls.appendChild(nextButton);
    
    return controls;
}

function getBrightness(color) {
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    return (r * 299 + g * 587 + b * 114) / 1000;
}

function createPokemonCard(pokemon) {
    const pokemonCard = document.createElement('div');
    pokemonCard.className = 'pokemon-card';
    
    const primaryColor = getTypeColor(pokemon.primaryType);
    const secondaryColor = pokemon.secondaryType ? getTypeColor(pokemon.secondaryType) : primaryColor;
    
    let backgroundStyle = pokemon.secondaryType 
        ? `linear-gradient(135deg, ${primaryColor} 50%, ${secondaryColor} 50%)`
        : primaryColor;
    
    pokemonCard.style.background = backgroundStyle;
    
    const brightness = getBrightness(primaryColor);
    const textColor = brightness > 128 ? '#000' : '#fff';
    const boxColor = brightness > 128 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
    
    // Styles for expandable sections
    const sectionStyle = brightness > 128 ? 
        'background-color: rgba(255,255,255,0.7); color: #000;' :
        'background-color: transparent; color: #fff;';
    const tableHeaderStyle = brightness > 128 ?
        'background-color: rgba(0,0,0,0.1); color: #000;' :
        'background-color: rgba(255,255,255,0.2); color: #fff;';
    
    const moveSections = [
        { level: 1, title: "Starting Moves", moves: pokemon.moves.starting.split(', ').filter(move => move !== '') },
        { level: 2, title: "Level 2 Moves", moves: pokemon.moves.level2.split(', ').filter(move => move !== '') },
        { level: 6, title: "Level 6 Moves", moves: pokemon.moves.level6.split(', ').filter(move => move !== '') },
        { level: 10, title: "Level 10 Moves", moves: pokemon.moves.level10.split(', ').filter(move => move !== '') },
        { level: 14, title: "Level 14 Moves", moves: pokemon.moves.level14.split(', ').filter(move => move !== '') },
        { level: 18, title: "Level 18 Moves", moves: pokemon.moves.level18.split(', ').filter(move => move !== '') }
    ];

    let moveListHTML = moveSections.map(section => {
        if (section.moves.length === 0) return '';
        return `
            <h4 style="${sectionStyle}">${section.title}</h4>
            <table class="moves-table" style="color: inherit; background-color: inherit;">
                <tr>
                    <th>Move</th>
                    <th>Type</th>
                    <th>VP Cost</th>
                </tr>
                ${section.moves.map(moveName => {
                    const move = moveData.find(m => m.name === moveName);
                    return move ? `
                        <tr class="move-row" onclick="toggleMoveDetails(this, ${JSON.stringify(move).replace(/"/g, '&quot;')}, '${sectionStyle}')">
                            <td>${move.name}</td>
                            <td>${move.type}</td>
                            <td>${move.vp}</td>
                        </tr>
                    ` : '';
                }).join('')}
            </table>
        `;
    }).join('');

    const sensesHtml = Object.entries(pokemon.senses)
        .filter(([_, value]) => value && value !== "0" && value.toLowerCase() !== "no" && value !== "-")
        .map(([sense, value]) => `<li><strong>${sense.charAt(0).toUpperCase() + sense.slice(1)}:</strong> ${value}</li>`)
        .join('');

    pokemonCard.innerHTML = `
        <div class="card-content" style="color: ${textColor}; background-color: ${boxColor};">
            <h2>${pokemon.name} (#${pokemon.id})</h2>
            ${pokemon.image ? `
                <div class="image-container" style="background: ${backgroundStyle};">
                    <img src="${pokemon.image}" alt="${pokemon.name}">
                </div>
            ` : ''}
            <div class="expandable-section">
                <h3 class="section-toggle" onclick="toggleSection('characteristics_${pokemon.id}')" style="${sectionStyle}">Characteristics ▼</h3>
                <div id="characteristics_${pokemon.id}" class="section-content" style="display: none;">
                <p><strong>Classification:</strong> ${pokemon.classification}</p>
                <p><strong>Description:</strong> ${pokemon.flavorText}</p>
                <p><strong>Types:</strong> ${pokemon.primaryType}${pokemon.secondaryType ? '/' + pokemon.secondaryType : ''}</p>
                    <p><strong>Size:</strong> ${pokemon.size}</p>
                    <p><strong>Rarity:</strong> ${pokemon.rarity}</p>
                    <p><strong>Behavior:</strong> ${pokemon.behavior}</p>
                    <p><strong>Habitat:</strong> ${pokemon.habitat}</p>
                    </div>
                    </div>
                    <div class="expandable-section">
                    <h3 class="section-toggle" onclick="toggleSection('abilities_${pokemon.id}')" style="${sectionStyle}">Abilities ▼</h3>
                    <div id="abilities_${pokemon.id}" class="section-content" style="display: none;">
                    <ul>
                    <li><strong>${pokemon.primaryAbility.name}:</strong> ${pokemon.primaryAbility.description}</li>
                    ${pokemon.secondaryAbility ? `<li><strong>${pokemon.secondaryAbility.name}:</strong> ${pokemon.secondaryAbility.description}</li>` : ''}
                    ${pokemon.hiddenAbility ? `<li><strong>${pokemon.hiddenAbility.name} (Hidden):</strong> ${pokemon.hiddenAbility.description}</li>` : ''}
                    </ul>
                    </div>
                    </div>
                    <div class="expandable-section">
                    <h3 class="section-toggle" onclick="toggleSection('stats_${pokemon.id}')" style="${sectionStyle}">Stats ▼</h3>
                    <div id="stats_${pokemon.id}" class="section-content" style="display: none;">
                    <ul>
                    <li><strong>AC:</strong> ${pokemon.ac}</li>
                    <li><strong>Hit Dice:</strong> ${pokemon.hitDice}</li>
                    <li><strong>Vitality Dice:</strong> ${pokemon.vitalityDice}</li>
                    <li><strong>Strength:</strong> ${pokemon.strength}</li>
                    <li><strong>Dexterity:</strong> ${pokemon.dexterity}</li>
                    <li><strong>Constitution:</strong> ${pokemon.constitution}</li>
                    <li><strong>Intelligence:</strong> ${pokemon.intelligence}</li>
                    <li><strong>Wisdom:</strong> ${pokemon.wisdom}</li>
                    <li><strong>Charisma:</strong> ${pokemon.charisma}</li>
                    <li><strong>Saving Throw Proficiencies:</strong> ${pokemon.savingThrows || 'None'}</li>
                    <li><strong>Skill Proficiencies:</strong> ${pokemon.skills || 'None'}</li>
                    <li><strong>Speed:</strong> ${pokemon.speed}</li>
                    ${sensesHtml ? `
                        <li><strong>Senses:</strong></li>
                        <ul>${sensesHtml}</ul>
                    ` : ''}
                    </ul>
                </div>
            </div>
            <div class="expandable-section">
                <h3 class="section-toggle" onclick="toggleSection('moves_${pokemon.id}')" style="${sectionStyle}">Available Moves ▼</h3>
                <div id="moves_${pokemon.id}" class="section-content" style="display: none;">
                    ${moveListHTML}
                </div>
            </div>
        </div>
    `;
    
    return pokemonCard;
}

// Add this new function to handle toggling sections
function toggleSection(sectionId) {
    const section = document.getElementById(sectionId);
    const toggle = section.previousElementSibling;
    if (section.style.display === 'none') {
        section.style.display = 'block';
        toggle.innerHTML = toggle.innerHTML.replace('▼', '▲');
    } else {
        section.style.display = 'none';
        toggle.innerHTML = toggle.innerHTML.replace('▲', '▼');
    }
}

// Update the existing toggleMoveList function to use the new toggleSection function
function toggleMoveList(pokemonId) {
    toggleSection(`moves_${pokemonId}`);
}

function getLevelAppropriateMoves(pokemon, level) {
    const availableMoves = new Set();

    Object.entries(pokemon.moves).forEach(([moveLevel, moves]) => {
        if (level >= parseInt(moveLevel)) {
            moves.split(', ').forEach(move => availableMoves.add(move));
        }
    });

    return Array.from(availableMoves).filter(move => move !== '');
}

function toggleMoveList(pokemonId) {
    const moveList = document.getElementById(`moveList_${pokemonId}`);
    const toggleButton = moveList.previousElementSibling;
    if (moveList.style.display === 'none') {
        moveList.style.display = 'block';
        toggleButton.innerHTML = 'Available Moves ▲';
    } else {
        moveList.style.display = 'none';
        toggleButton.innerHTML = 'Available Moves ▼';
    }
}

function toggleMoveDetails(row, move, detailStyle) {
    const detailsRow = row.nextElementSibling;
    if (detailsRow && detailsRow.classList.contains('move-details')) {
        detailsRow.remove();
    } else {
        const newRow = row.parentNode.insertRow(row.rowIndex + 1);
        newRow.classList.add('move-details');
        const cell = newRow.insertCell();
        cell.colSpan = 3;
        cell.style = `${detailStyle} background-color: inherit; color: inherit;`;
        cell.innerHTML = `
            <p><strong>Power:</strong> ${move.power}</p>
            <p><strong>Time:</strong> ${move.time}</p>
            <p><strong>Duration:</strong> ${move.duration}</p>
            <p><strong>Range:</strong> ${move.range}</p>
            <p><strong>Description:</strong> ${move.description}</p>
            ${move.higher ? `<p><strong>Higher Levels:</strong> ${move.higher}</p>` : ''}
        `;
    }
}

async function loadMoveData() {
    try {
        const response = await fetch('https://script.google.com/macros/s/AKfycbxyw5f5sPKP2cBDk7tnGO3vH-Ql2dRJCxHtu4X7Tdwp-X2VYRnWr-s9IrVXAsAtrCNd/exec?action=moves');
        if (!response.ok) {
            throw new Error('Failed to fetch move data');
        }
        const values = await response.json();
        moveData = values.map(row => ({
            name: row[0],
            type: row[1],
            power: row[2],
            time: row[3],
            vp: row[4],
            duration: row[5],
            range: row[6],
            description: row[7],
            higher: row[8] ? row[8].trim() : '',
        }));
        console.log('Move data processed:', moveData.length, 'moves');
    } catch (error) {
        console.error('Error loading move data:', error);
    }
}

function searchMoves() {
    const searchInput = document.getElementById('moveSearchInput');
    const pokemonLevelInput = document.getElementById('pokemonLevelInput');

    if (!searchInput || !pokemonLevelInput) {
        console.error("Move search input elements not found");
        return;
    }

    const searchTerm = searchInput.value.toLowerCase().trim();
    const pokemonLevel = parseInt(pokemonLevelInput.value) || 20;

    let results = [];

    // Check if the search term matches a Pokémon name
    const pokemon = pokemonData.find(p => p.name.toLowerCase() === searchTerm);

    if (pokemon) {
        // If it's a Pokémon name, get moves up to the specified level
        const availableMoves = getMovesUpToLevel(pokemon, pokemonLevel);
        results = moveData.filter(move => availableMoves.includes(move.name));
    } else {
        // If it's not a Pokémon name, search all moves
        results = moveData.filter(move => 
            move.name.toLowerCase().includes(searchTerm) ||
            move.type.toLowerCase().includes(searchTerm)
        );
    }

    console.log(`Search results for "${searchTerm}":`, results);
    displayMoveResults(results, pokemon, pokemonLevel);
}

function getMovesUpToLevel(pokemon, level) {
    const moveLevels = {
        1: pokemon.moves.starting.split(', ').filter(move => move !== ''),
        2: pokemon.moves.level2.split(', ').filter(move => move !== ''),
        6: pokemon.moves.level6.split(', ').filter(move => move !== ''),
        10: pokemon.moves.level10.split(', ').filter(move => move !== ''),
        14: pokemon.moves.level14.split(', ').filter(move => move !== ''),
        18: pokemon.moves.level18.split(', ').filter(move => move !== '')
    };

    let availableMoves = new Set();

    for (let [moveLevel, moves] of Object.entries(moveLevels)) {
        if (level >= parseInt(moveLevel)) {
            moves.forEach(move => availableMoves.add(move));
        }
    }

    return Array.from(availableMoves);
}

function displayMoveResults(results, pokemon = null, level = null) {
    const resultsContainer = document.getElementById('moveResults');
    if (!resultsContainer) {
        console.error("Move results container not found");
        return;
    }

    resultsContainer.innerHTML = '';
    
    if (pokemon) {
        resultsContainer.innerHTML = `<h3>Moves for ${pokemon.name} (Level ${level})</h3>`;
    }

    if (results.length === 0) {
        resultsContainer.innerHTML += '<p>No moves found. Try a different search term or level.</p>';
    } else {
        results.forEach(move => {
            const moveCard = document.createElement('div');
            moveCard.className = 'move-card';
            
            const moveColor = getTypeColor(move.type);
            moveCard.style.backgroundColor = moveColor;
            
            const brightness = getBrightness(moveColor);
            const textColor = brightness > 128 ? '#000' : '#fff';
            const boxColor = brightness > 128 ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)';
            
            let higherLevelsHtml = '';
            if (move.higher && move.higher.trim() !== '') {
                higherLevelsHtml = `<p><strong>Higher Levels:</strong> ${move.higher}</p>`;
            }
            
            moveCard.innerHTML = `
                <div class="card-content" style="color: ${textColor}; background-color: ${boxColor};">
                    <h3>${move.name}</h3>
                    <p><strong>Type:</strong> ${move.type}</p>
                    <p><strong>VP Cost:</strong> ${move.vp}</p>
                    <p><strong>Move Power:</strong> ${move.power}</p>
                    <p><strong>Time:</strong> ${move.time}</p>
                    <p><strong>Duration:</strong> ${move.duration}</p>
                    <p><strong>Range:</strong> ${move.range}</p>
                    <p><strong>Effect:</strong> ${move.description}</p>
                    ${higherLevelsHtml}
                </div>
            `;
            
            resultsContainer.appendChild(moveCard);
        });
    }
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
    return moveString.split(',')
                    .map(move => move.trim())
                    .filter(move => move !== '')
                    .slice(0, maxMoves)
                    .join(', ');
}

async function getImageUrl(pokemonName, pokemonId) {
    const paddedId = pokemonId.toString().padStart(3, '0');
    const sanitizedName = sanitizeFileName(pokemonName);
    const baseFileName = `${paddedId}-${sanitizedName}`;
    for (const format of IMAGE_FORMATS) {
        const url = `${IMAGE_BASE_URL}${baseFileName}.${format}`;
        if (await imageExists(url)) {
            return url;
        }
    }
    return null;
}

function imageExists(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = url;
    });
}

// Initialize
window.onload = async function() {
    try {
        await loadPokemonData(); // This will also load move data
        console.log('Data loaded successfully');
        
        setAudioVolume(0.3);
        
        // Add event listeners
        const searchButton = document.getElementById('searchButton');
        const searchInput = document.getElementById('searchInput');
        if (searchButton && searchInput) {
            searchButton.addEventListener('click', searchPokemon);
            searchInput.addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    searchPokemon();
                }
            });
        } else {
            console.warn("Search button or input not found");
        }

        const moveSearchButton = document.getElementById('moveSearchButton');
        const moveSearchInput = document.getElementById('moveSearchInput');
        if (moveSearchButton && moveSearchInput) {
            moveSearchButton.addEventListener('click', searchMoves);
            moveSearchInput.addEventListener('keyup', function(event) {
                if (event.key === 'Enter') {
                    searchMoves();
                }
            });
        } else {
            console.warn("Move search button or input not found");
        }
        
        // Add event listeners for filters
        ['typeFilter', 'sizeFilter', 'behaviorFilter', 'activityFilter', 'rarityFilter', 'habitatFilter'].forEach(filterId => {
            const filterElement = document.getElementById(filterId);
            if (filterElement) {
                filterElement.addEventListener('change', searchPokemon);
            } else {
                console.warn(`Filter element ${filterId} not found`);
            }
        });

        // Show the navigation buttons
        document.getElementById('pokedex_button').style.display = 'inline-block';
        document.getElementById('move_button').style.display = 'inline-block';

    } catch (error) {
        console.error('Error loading data:', error);
    }
};