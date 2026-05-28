import * as Common from './common.mjs';

Common.enableSentry();


function updateConnStatus(s) {
    if (!s) {
        s = {connected: false, state: 'disabled'};
    }
    document.documentElement.classList.toggle('connected', s.connected);
    const statusEl = document.querySelector('.status');
    statusEl.textContent = s.state;
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
}


export async function settingsMain() {
    Common.initInteractionListeners();
    await Common.initSettingsForm('form')();
}
