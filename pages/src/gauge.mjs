import * as Sauce from '../../shared/sauce/index.mjs';
import * as Common from './common.mjs';
import {cssColor, getTheme} from './echarts-sauce-theme.mjs';

Common.enableSentry();
Common.RAFThrottlePatcher.singleton().setFPSLimit(12);

const doc = document.documentElement;
const page = window.location.pathname.split('/').at(-1).split('.')[0];
const type = (new URLSearchParams(window.location.search)).get('t') || page || 'power';
const L = Sauce.locale;
const H = L.human;
let settings; // eslint-disable-line prefer-const
let powerZones;
let hrZones;
let sport = 'cycling';

const defaultAxisColorBands = [[1, cssColor('fg', 1, 0.2)]];


let _wPrime;
function getWBalValue(x) {
    _wPrime = x.athlete && x.athlete.wPrime;
    if (!_wPrime) {
        return;
    }
    return x.wBal / _wPrime * 100;
}


function wBalDetailFormatter(x) {
    return x != null ? `{value|${H.number((x / 100) * _wPrime / 1000, {precision: 1})}}\n{unit|kJ}` : '';
}


const gaugeConfigs = {
    power: {
        name: 'Power',
        defaultSettings: {
            min: 0,
            max: 700,
        },
        defaultColor: '#35e',
        getValue: x => settings.dataSmoothing ? x.stats.power.smooth[settings.dataSmoothing] : x.state.power,
        getAvgValue: x =>
            (settings.currentLap ? x.stats.laps.at(-1).power : x.stats.power).avg,
        getMaxValue: x =>
            (settings.currentLap ? x.stats.laps.at(-1).power : x.stats.power).max,
        getLabel: H.number,
        detailFormatter: x => `{value|${H.number(x)}}\n{unit|watts}`,
        axisColorBands: data => {
            if (powerZones === undefined) {
                powerZones = null;
                Common.rpc.getPowerZones(1).then(zones => powerZones = zones);
                return;
            }
            if (!powerZones || !data.athlete || !data.athlete.ftp) {
                return;
            }
            const min = settings.min;
            const delta = settings.max - min;
            const power = gaugeConfigs.power.getValue(data);
            const normZones = powerZones.filter(x => !x.overlap);
            if (normZones[0].from > 0) {
                // Always pad in case of non zero offset (i.e. fake active recovery zone)
                normZones.unshift({zone: '', from: 0, to: normZones[0].from});
            }
            const zoneColors = Common.getPowerZoneColors(normZones);
            const bands = normZones.map(x => [
                Math.min(1, Math.max(0, ((x.to || Infinity) * data.athlete.ftp - min) / delta)),
                zoneColors[x.zone] + (power / data.athlete.ftp < (x.from || 0) ? '3' : '')
            ]);
            if (bands[bands.length - 1][0] < 1) {
                // Unlikely custom zones with none Infinite final zone
                bands.push([1, '#0005']);
            }
            return bands;
        },
    },
    hr: {
        name: 'Heart Rate',
        defaultColor: '#d22',
        ticks: 8,
        defaultSettings: {
            min: 70,
            max: 190,
        },
        getValue: x => settings.dataSmoothing ? x.stats.hr.smooth[settings.dataSmoothing] : x.state.heartrate,
        getLabel: H.number,
        detailFormatter: x => `{value|${H.number(x)}}\n{unit|bpm}`,
        axisColorBands: data => {
            if (hrZones === undefined) {
                hrZones = null;
                Common.rpc.getHeartRateZones(1).then(zones => hrZones = zones);
                return;
            }
            if (!hrZones || !data.athlete || !data.athlete.maxHeartRate) {
                return;
            }
            const min = settings.min;
            const delta = settings.max - min;
            const hr = gaugeConfigs.hr.getValue(data);
            const normZones = hrZones.filter(x => !x.overlap);
            if (normZones[0].from > 0) {
                normZones.unshift({zone: '', from: 0, to: normZones[0].from});
            }
            const hrZoneColors = {
                '': '#888',
                Z1: '#888',
                Z2: '#29e',
                Z3: '#2a3',
                Z4: '#ea2',
                Z5: '#c22',
            };
            const bands = normZones.map(x => [
                Math.min(1, Math.max(0, ((x.to || Infinity) * data.athlete.maxHeartRate - min) / delta)),
                (hrZoneColors[x.zone] || '#888') + (hr / data.athlete.maxHeartRate < (x.from || 0) ? '3' : '')
            ]);
            if (bands[bands.length - 1][0] < 1) {
                bands.push([1, '#0005']);
            }
            return bands;
        },
        longPeriods: true,
    },
    pace: {
        name: 'Speed',
        defaultColor: '#273',
        ticks: Common.imperialUnits ? 6 : 10,
        defaultSettings: {
            min: 0,
            max: 100,
        },
        getValue: x => settings.dataSmoothing ? x.stats.speed.smooth[settings.dataSmoothing] : x.state.speed,
        getLabel: x => H.pace(x, {precision: 0, sport}),
        detailFormatter: x => {
            const unit = sport === 'running' ?
                (Common.imperialUnits ? '/mi' : '/km') :
                (Common.imperialUnits ? 'mph' : 'kph');
            return `{value|${H.pace(x, {precision: 1, sport})}}\n{unit|${unit}}`;
        },
        longPeriods: true,
    },
    cadence: {
        name: 'Cadence',
        defaultColor: '#ee3',
        ticks: 10,
        defaultSettings: {
            min: 40,
            max: 140,
        },
        getValue: x => x.state.cadence,
        getLabel: H.number,
        detailFormatter: x => `{value|${H.number(x)}}\n{unit|rpm}`,
        longPeriods: true,
    },
    draft: {
        name: 'Draft',
        defaultColor: '#930',
        ticks: 6,
        defaultSettings: {
            min: 0,
            max: 300,
        },
        getValue: x => settings.dataSmoothing ? x.stats.draft.smooth[settings.dataSmoothing] : x.state.draft,
        getLabel: H.number,
        detailFormatter: x => `{value|${H.number(x)}}\n{unit|w savings}`,
        longPeriods: true,
    },
    wbal: {
        name: 'W\'bal',
        defaultColor: '#ff9900',
        ticks: 10,
        defaultSettings: {
            min: 0,
            max: 100,
        },
        getValue: getWBalValue,
        getLabel: x => H.number(x / 100000 * _wPrime),
        detailFormatter: wBalDetailFormatter,
        visualMap: [{
            show: false,
            type: 'continuous',
            hoverLink: false,
            seriesIndex: 0,
            min: 0,
            max: 100,
            inRange: {
                color: ['#b01010', '#dad00c', '#9da665', '#16ff18'],
                colorAlpha: [0.5, 0.9],
            },
        }],
        noSmoothing: true,
    },
};

const config = new Map(Object.entries(gaugeConfigs)).get(type);
const settingsStore = new Common.SettingsStore(`gauge-settings-v1-${type}`);
settings = settingsStore.get(null, {
    refreshInterval: 1,
    dataSmoothing: 0,
    showAverage: false,
    showMax: false,
    currentLap: false,
    boringMode: false,
    gaugeTransparency: 20,
    solidBackground: false,
    backgroundColor: '#00ff00',
    colorOverride: false,
    color: '#7700ff',
    ...config.defaultSettings,
});
Common.themeInit(settingsStore);
Common.localeInit(settingsStore);
doc.classList.remove('hidden-during-load');
config.color = settings.colorOverride ? settings.color : config.defaultColor;

// Fix dataSmoothing bug fixed 01-05-2025
if (typeof settings.dataSmoothing === 'string') {
    console.warn('Fixing dataSmoothing bug');
    settings.dataSmoothing = Number(settings.dataSmoothing);
}


function colorAlpha(color, alpha) {
    if (color.length <= 5) {
        return color.slice(0, 4) + alpha[0];
    } else {
        return color.slice(0, 7) + alpha.padStart(2, alpha[0]);
    }
}




export async function main() {
    Common.addOpenSettingsParam('t', type);
    Common.initInteractionListeners();
    Common.setBackground(settings);
    const content = document.querySelector('#content');

    const valueEl = document.getElementById('gauge-value');
    const fillEl = document.getElementById('gauge-fill');
    if (fillEl) fillEl.style.display = 'none'; // Old linear progress bar

    const labelEl = document.querySelector('.gauge-label');
    if (labelEl) labelEl.textContent = config.name;

        const svgNS = "http://www.w3.org/2000/svg";
        const svg = document.createElementNS(svgNS, "svg");
        svg.setAttribute("viewBox", "0 0 100 100");
        svg.style.position = 'absolute';
        svg.style.top = '50%';
        svg.style.left = '50%';
        svg.style.transform = 'translate(-50%, -40%)';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.zIndex = '-1';
        svg.style.opacity = '0.6';
        
        const uniqueId = Math.random().toString(36).substring(2, 9);
        const maskId = `progress-mask-${uniqueId}`;
        const glowId = `glow-${uniqueId}`;

        const defs = document.createElementNS(svgNS, "defs");
        const mask = document.createElementNS(svgNS, "mask");
        mask.setAttribute("id", maskId);
        mask.setAttribute("maskUnits", "userSpaceOnUse");
        mask.setAttribute("maskContentUnits", "userSpaceOnUse");

        const radius = 36;
        const circumference = 2 * Math.PI * radius;
        const arcAngle = 180;
        const rotation = 90 + (360 - arcAngle) / 2;
        const arcLength = circumference * (arcAngle / 360);

        const maskCircle = document.createElementNS(svgNS, "circle");
        maskCircle.setAttribute("cx", "50");
        maskCircle.setAttribute("cy", "50");
        maskCircle.setAttribute("r", radius.toString());
        maskCircle.setAttribute("fill", "none");
        maskCircle.setAttribute("stroke", "white");
        maskCircle.setAttribute("stroke-width", "16");
        maskCircle.setAttribute("transform", `rotate(${rotation} 50 50)`);
        maskCircle.style.strokeDasharray = `${arcLength}px ${circumference}px`;
        maskCircle.style.strokeDashoffset = `${arcLength}px`;
        maskCircle.style.transition = "stroke-dashoffset 0.5s ease-out";

        mask.appendChild(maskCircle);

        const filter = document.createElementNS(svgNS, "filter");
        filter.setAttribute("id", glowId);
        const feGaussianBlur = document.createElementNS(svgNS, "feGaussianBlur");
        feGaussianBlur.setAttribute("stdDeviation", "1.5");
        feGaussianBlur.setAttribute("result", "coloredBlur");
        const feMerge = document.createElementNS(svgNS, "feMerge");
        const feMergeNode1 = document.createElementNS(svgNS, "feMergeNode");
        feMergeNode1.setAttribute("in", "coloredBlur");
        const feMergeNode2 = document.createElementNS(svgNS, "feMergeNode");
        feMergeNode2.setAttribute("in", "SourceGraphic");
        feMerge.appendChild(feMergeNode1);
        feMerge.appendChild(feMergeNode2);
        filter.appendChild(feGaussianBlur);
        filter.appendChild(feMerge);
        
        defs.appendChild(mask);
        defs.appendChild(filter);
        svg.appendChild(defs);

        const segments = 30;
        const gap = 2;
        const segmentLength = arcLength / segments;
        const dash = segmentLength - gap;
        
        let dashArray = '';
        for (let i = 0; i < segments - 1; i++) {
            dashArray += `${dash} ${gap} `;
        }
        dashArray += `${dash} ${circumference - arcLength + gap}`;

        const bgCircle = document.createElementNS(svgNS, "circle");
        bgCircle.setAttribute("cx", "50");
        bgCircle.setAttribute("cy", "50");
        bgCircle.setAttribute("r", radius.toString());
        bgCircle.setAttribute("fill", "none");
        bgCircle.setAttribute("stroke", "currentColor");
        bgCircle.setAttribute("stroke-width", "10");
        bgCircle.setAttribute("stroke-dasharray", dashArray);
        bgCircle.setAttribute("transform", `rotate(${rotation} 50 50)`);
        bgCircle.style.opacity = '0.15';
        svg.appendChild(bgCircle);

        const progressCircle = document.createElementNS(svgNS, "circle");
        progressCircle.setAttribute("cx", "50");
        progressCircle.setAttribute("cy", "50");
        progressCircle.setAttribute("r", radius.toString());
        progressCircle.setAttribute("fill", "none");
        progressCircle.setAttribute("stroke", config.color);
        progressCircle.setAttribute("stroke-width", "10");
        progressCircle.setAttribute("stroke-dasharray", dashArray);
        progressCircle.setAttribute("transform", `rotate(${rotation} 50 50)`);
        progressCircle.style.transition = "stroke 0.5s ease";

        const progressGroup = document.createElementNS(svgNS, "g");
        progressGroup.setAttribute("mask", `url(#${maskId})`);
        progressGroup.style.filter = `url(#${glowId})`;
        progressGroup.appendChild(progressCircle);
        svg.appendChild(progressGroup);

        if (content) {
            content.style.position = 'relative';
            content.style.zIndex = '0';
            content.appendChild(svg);
        }

    const renderer = new Common.Renderer(content, {fps: 1 / settings.refreshInterval});
    renderer.addCallback(data => {
        if (!data) return;
        const val = config.getValue(data);
        if (val == null) {
            if (valueEl) {
                valueEl.textContent = '--';
                valueEl.style.color = '';
            }
            maskCircle.style.strokeDashoffset = `${arcLength}px`;
            return;
        }
        
        let textVal = '';
        let unitVal = '';
        if (type === 'power') {
            textVal = H.number(val);
            unitVal = 'w';
        } else if (type === 'pace') {
            if (sport === 'cycling') {
                const speed = Common.imperialUnits ? val / 1.609344 : val;
                textVal = H.number(speed, {precision: 1});
                unitVal = Common.imperialUnits ? 'mph' : 'kph';
            } else {
                textVal = H.pace(val, {precision: 1, sport});
                unitVal = Common.imperialUnits ? '/mi' : '/km';
            }
        } else if (type === 'wbal') {
            textVal = H.number((val / 100) * _wPrime / 1000, {precision: 1});
            unitVal = 'kJ';
        } else if (type === 'hr') {
            textVal = H.number(val);
            unitVal = 'bpm';
        } else if (type === 'cadence') {
            textVal = H.number(val);
            unitVal = 'rpm';
        } else if (type === 'draft') {
            textVal = H.number(val);
            unitVal = 'w';
        } else {
            textVal = H.number(val);
        }
        
        if (valueEl) {
            valueEl.innerHTML = `${textVal}<span style="font-size: 0.4em; opacity: 0.8; margin-left: 2px;">${unitVal}</span>`;
            if (config.getTextColor) {
                const color = config.getTextColor(val, data);
                if (color) {
                    valueEl.style.color = color;
                } else {
                    valueEl.style.color = '';
                }
            }
        }
        
        const min = settings.min || 0;
        const max = settings.max || 100;
        const pct = Math.max(0, Math.min(1, (val - min) / (max - min)));

        maskCircle.style.strokeDashoffset = `${arcLength - (pct * arcLength)}px`;
        progressCircle.setAttribute("stroke", config.color);
    });
    addEventListener('resize', () => {
        renderer.render({force: true});
    });
    settingsStore.addEventListener('set', ev => {
        const key = ev.data.key;
        if (key === 'color' || key === 'colorOverride') {
            config.color = settings.colorOverride ? settings.color : config.defaultColor;
        }
        Common.setBackground(settings);
        renderer.fps = 1 / settings.refreshInterval;
        renderer.render({force: true});
    });
    Common.subscribe('athlete/watching', watching => {
        sport = watching.state.sport;
        if (type === 'pace') {
            config.name = sport === 'running' ? 'Pace' : 'Speed';
            if (labelEl) labelEl.textContent = config.name;
        }
        renderer.setData(watching);
        renderer.render();
    });
    renderer.render();
}


export async function settingsMain() {
    Common.initInteractionListeners();
    if (config.noSmoothing) {
        document.querySelector('form [name="dataSmoothing"]').disabled = true;
    }
    if (config.longPeriods) {
        Array.from(document.querySelectorAll('form [name="dataSmoothing"] [data-period="short"]'))
            .map(x => x.disabled = true);
    }
    await Common.initSettingsForm('form', {store: settingsStore})();
}
