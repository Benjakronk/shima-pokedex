# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

A static, client-side Pokédex web app for a custom D&D Pokémon variant ("Shima"). Zero build tooling — open `index.html` directly in a browser to run it.

## Running Locally

No build step. Open `index.html` in any modern browser. For data updates from the Google Sheets backend:

```bash
cd old-version/data-downloader
python download.py
```

## Architecture

**Three core files**: `index.html`, `script.js` (~2300 lines), `styles.css` (~1600 lines)

**Data flow**:
1. On load, fetches Pokémon/move data from a Google Apps Script web app endpoint
2. Data is cached in `localStorage` (24-hour TTL for Pokémon/moves, 5-minute TTL for config)
3. `pokedex_config.json` (hosted on GitHub raw) controls per-Pokémon field visibility
4. `registered_pokemon.json` lists which Pokémon are visible in the Pokédex

**State**: A single global `state` object in `script.js` holds all runtime state (pokemonData, moveData, config, isAdminMode, currentView, currentPage, etc.)

**Views**: Pokédex browser, Move Library, and Admin panel. Navigation is purely DOM manipulation — no router.

**Admin mode**: Password-protected (`shimamaster`), toggles visibility for each field per Pokémon, writes changes back to `pokedex_config.json` via GitHub API.

## Key Config Files

- `pokedex_config.json`: Per-Pokémon visibility toggles for types, stats, abilities, moves, etc. Each Pokémon entry has granular field-level show/hide controls.
- `registered_pokemon.json`: Simple list of Pokémon names currently shown in the Pokédex.

## Images

- `images/` — 466+ Pokémon images (PNG/JPG), referenced by lowercase Pokémon name
- `images/splashes/` — 51 splash screen images shown during loading
- Supports multiple formats: tried in order `['png', 'jpg', 'jpeg', 'jfif']`

## No Tests or Linter

There is no automated test suite or linter. Manual browser testing is the only validation method.
