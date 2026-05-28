import * as Common from './common.mjs';
import * as Fields from './fields.mjs';

Common.enableSentry();

const puEl = document.querySelector('[data-call="powerup"]');
const puFieldEl = puEl.querySelector('.field');
const puLabelEl = puEl.querySelector('.label');
const powerupField = new Fields.PowerUpField();


function updateConnStatus(status) {
    document.documentElement.classList.toggle('connected', status.connected);
    document.querySelector('.status').textContent = status.state;
}


function onGameState(gameState) {
    Common.softInnerHTML(puFieldEl, powerupField.format({gameState}));
    Common.softInnerHTML(puLabelEl, Fields.PowerUpField.titles[powerupField.presentingType] || 'None');
    puEl.classList.toggle('disabled', !(gameState.availablePowerUp || gameState.activePowerUp));
}


let autoRideOnInterval;
const autoRideOnGiven = new Set();

function toggleAutoRideOn(btn) {
    const active = btn.classList.toggle('active');
    btn.classList.toggle('primary', active);
    if (active) {
        autoRideOnGiven.clear();
        autoRideOnInterval = setInterval(async () => {
            const nearby = await Common.rpc.getNearbyData();
            for (const {athleteId} of nearby || []) {
                if (!autoRideOnGiven.has(athleteId)) {
                    autoRideOnGiven.add(athleteId);
                    Common.rpc.giveRideon(athleteId).catch(console.warn);
                    Common.spawnRideOnIcon();
                    await new Promise(r => setTimeout(r, 500)); // Rate limit API calls
                }
            }
        }, 5000);
    } else {
        clearInterval(autoRideOnInterval);
    }
}


export async function main() {
    Common.initInteractionListeners();
    Common.subscribe('status', updateConnStatus, {source: 'gameConnection', persistent: true});
    Common.subscribe('game-state', onGameState, {persistent: true});
    document.querySelector('#content').addEventListener('click', ev => {
        const btn = ev.target.closest('.button');
        if (!btn) {
            return;
        }
        if (btn.dataset.action === 'auto-rideon') {
            toggleAutoRideOn(btn);
            return;
        }
        const args = btn.dataset.args ? JSON.parse(btn.dataset.args) : [];
        Common.rpc[btn.dataset.call](...args);
        if (btn.dataset.call === 'say' && args[0] === 'rideon') {
            Common.spawnRideOnIcon();
        }
    });
    document.addEventListener('sauce-ws-status', async ({detail}) => {
        if (detail === 'connected') {
            updateConnStatus(await Common.rpc.getGameConnectionStatus());
        } else {
            updateConnStatus({connected: false, state: 'not running'});
            updateConnStatus(await Common.rpc.getGameConnectionStatus());
        }
    });
    updateConnStatus(await Common.rpc.getGameConnectionStatus());
    const gameState = await Common.rpc.getGameState();
    if (gameState) {
        onGameState(gameState);
    }
}


export async function settingsMain() {
    Common.initInteractionListeners();
    await Common.initSettingsForm('form')();
}
