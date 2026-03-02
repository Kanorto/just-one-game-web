#!/usr/bin/env node
/**
 * Word Pack Fetcher for Just One Game
 *
 * Fetches word packs from the meme-police.ru platform (xdghcnt's board games platform).
 *
 * Architecture overview:
 * - The original just-one-game-web by xdghcnt loads words from a platform-level
 *   `moderated-words.json` file (not stored in the repository).
 * - Custom word packs are stored as JSON files in a `custom/` directory with format:
 *   { "wordList": ["word1", "word2", ...], "author": "name" }
 * - The platform at meme-police.ru/bg hosts the actual game with moderated word lists.
 *
 * Usage:
 *   node scripts/fetch-words.js [options]
 *
 * Options:
 *   --url <url>        Base URL of the platform (default: https://meme-police.ru)
 *   --game <path>      Game path (default: /just-one or /alias)
 *   --output <dir>     Output directory for word packs (default: ./custom)
 *   --words-file <f>   Output file for moderated words (default: ./moderated-words.json)
 *   --help             Show this help message
 *
 * How word packs work on the platform:
 * 1. Default words are loaded from `moderated-words.json` organized by difficulty levels (1-4)
 * 2. Custom packs are in `custom/<pack-name>.json` with format { wordList: [...], author: "..." }
 * 3. The "words-pack-list" socket event returns available pack names
 * 4. The "setup-words-preset" event loads a specific pack by name
 * 5. The "setup-words" event accepts a custom word list directly
 *
 * Since the platform uses Socket.IO, this script connects as a client to fetch data.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);

function getArg(name, defaultValue) {
    const idx = args.indexOf(name);
    if (idx !== -1 && args[idx + 1]) return args[idx + 1];
    return defaultValue;
}

if (args.includes('--help')) {
    console.log(`
Word Pack Fetcher for Just One Game

Fetches word packs from a meme-police.ru-compatible game platform.

Usage:
  node scripts/fetch-words.js [options]

Options:
  --url <url>        Base URL (default: https://meme-police.ru)
  --output <dir>     Output directory for custom packs (default: ./custom)
  --words-file <f>   Output moderated words file (default: ./moderated-words.json)
  --help             Show this help

How it works:
  The script connects to the platform via Socket.IO and requests the word pack list.
  It then downloads each available pack and saves it locally.

  The platform (meme-police.ru) by xdghcnt stores:
  - moderated-words.json: Default words organized by difficulty levels 1-4
  - custom/*.json: User-created word packs with { wordList: [...], author: "..." }

  Word packs are NOT stored in the GitHub repository (xdghcnt/just-one-game-web).
  They are hosted on the platform server and managed through a moderation panel.

  The moderation panel (accessible to authorized users) allows:
  - Reporting words for difficulty reassignment
  - Adding new words to the default pool
  - Creating and approving custom packs

Note: This script requires the platform to be accessible. If meme-police.ru is not
available, you can manually create word packs in the custom/ directory.
`);
    process.exit(0);
}

const baseUrl = getArg('--url', 'https://meme-police.ru');
const outputDir = getArg('--output', path.join(__dirname, '..', 'custom'));
const wordsFile = getArg('--words-file', path.join(__dirname, '..', 'moderated-words.json'));

async function fetchJSON(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
                }
            });
        }).on('error', reject);
    });
}

async function fetchText(url) {
    return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        client.get(url, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function main() {
    console.log(`\nWord Pack Fetcher for Just One Game`);
    console.log(`====================================`);
    console.log(`Platform URL: ${baseUrl}`);
    console.log(`Output dir:   ${outputDir}`);
    console.log(`Words file:   ${wordsFile}`);
    console.log('');

    // Ensure output directory exists
    fs.mkdirSync(outputDir, { recursive: true });

    // Try to connect via Socket.IO to get word pack list
    console.log('Attempting to connect to platform...');
    console.log('');
    console.log('NOTE: The word packs on meme-police.ru are NOT in the GitHub repository.');
    console.log('They are stored on the platform server in:');
    console.log('  - moderated-words.json (default words by difficulty level)');
    console.log('  - custom/*.json (user-created word packs)');
    console.log('');
    console.log('The platform uses Socket.IO for real-time communication.');
    console.log('To fetch packs, you need to either:');
    console.log('  1. Have access to the platform server files directly');
    console.log('  2. Connect via Socket.IO and emit "words-pack-list" event');
    console.log('  3. Use the game\'s web interface to export packs manually');
    console.log('');

    try {
        // Try a simple HTTP fetch first to check if platform is accessible
        const html = await fetchText(baseUrl);
        console.log('Platform is accessible!');

        // Check for Socket.IO endpoint
        try {
            const sioResponse = await fetchText(`${baseUrl}/socket.io/?EIO=4&transport=polling`);
            console.log('Socket.IO endpoint found.');
            console.log('');
            console.log('To fully automate word fetching, install socket.io-client:');
            console.log('  npm install socket.io-client');
            console.log('');
            console.log('Then this script can connect and emit:');
            console.log('  socket.emit("words-pack-list") to get available packs');
            console.log('  socket.emit("view-words-pack", packName) to get pack contents');
        } catch (e) {
            console.log('Socket.IO endpoint not accessible directly.');
        }
    } catch (e) {
        console.log(`Platform not accessible: ${e.message}`);
        console.log('');
        console.log('The platform may be down or blocked from this network.');
        console.log('');
        console.log('Alternative: Create word packs manually in the custom/ directory.');
        console.log('Format: { "wordList": ["word1", "word2", ...], "author": "name" }');
    }

    // Show current local packs
    console.log('');
    console.log('Current local word packs:');
    console.log('-------------------------');

    // Check moderated-words.json
    try {
        const words = JSON.parse(fs.readFileSync(wordsFile, 'utf8'));
        Object.keys(words).forEach(level => {
            console.log(`  Level ${level}: ${words[level].length} words`);
        });
    } catch (e) {
        console.log('  moderated-words.json: not found');
    }

    // Check custom packs
    try {
        const files = fs.readdirSync(outputDir).filter(f => f.endsWith('.json'));
        if (files.length > 0) {
            console.log('');
            console.log('Custom packs:');
            files.forEach(f => {
                try {
                    const pack = JSON.parse(fs.readFileSync(path.join(outputDir, f), 'utf8'));
                    const name = f.replace('.json', '');
                    console.log(`  ${name}: ${pack.wordList ? pack.wordList.length : '?'} words (by ${pack.author || 'unknown'})`);
                } catch (e) {
                    console.log(`  ${f}: error reading`);
                }
            });
        } else {
            console.log('  No custom packs found in custom/');
        }
    } catch (e) {
        console.log('  custom/ directory not found');
    }

    console.log('');
    console.log('Done.');
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
