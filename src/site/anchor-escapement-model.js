import { createPendulumClockModel } from './pendulum-clock-model.js';
import { clockPlan } from './pendulum-clock-physics.js';
import { ESCAPEMENT } from './clock-escapement.js';
import { reading as r } from './house-model-kit.js';
import { fixed } from './format.js';
export function createAnchorEscapementModel() {
    const model = createPendulumClockModel();
    model.root.name = model.root.userData.machine = 'Anchor escapement';
    model.topology.dial.visible = false;
    model.topology.dial.userData.explosionExcluded = true;
    model.parts = model.parts.filter(part => !['dial', 'motion-work'].includes(part.id));
    model.parts.push({ id: 'escape-wheel', name: 'Escape wheel', description: 'Thirty teeth advance clockwise by half a tooth space at each beat. The shaft is driven by the train behind it.', object: model.topology.escapeWheel, parentId: 'escapement' }, { id: 'anchor-body', name: 'Anchor and crutch', description: 'The rigid anchor carries both pallets. Its shaft and rear crutch pass each impulse to the pendulum rod.', object: model.topology.anchor, parentId: 'escapement' });
    for (const part of model.parts.filter(part => part.id.endsWith('-pallet')))
        part.parentId = 'anchor-body';
    model.initialPart = 'escapement';
    const rawState = model.getState;
    function readings() {
        const s = rawState(), side = s.contactSide === 0 ? 'Entry' : 'Exit';
        const contact = !s.running ? 'Stopped' : s.stage === 'Drop' ? 'Free drop' : `${side} pallet ${s.stage === 'Impulse' ? 'impulse' : 'locked'}`;
        const inherited = label => s.readings.find(item => item.label === label);
        return [
            r('Your result', contact, !s.running ? 'The supported swing cannot sustain repeated releases. Choose a clean movement or increase the driving weight.' : s.stage === 'Drop' ? 'Neither pallet touches a tooth during this gap. The opposite locking face is next.' : s.stage === 'Impulse' ? 'A tooth still touches the sloping face and pushes the anchor in its direction of motion.' : 'A tooth holds the wheel still on a concentric face while the pendulum continues swinging.'),
            r('Completed beats', String(s.beats), 'One completed release is a half swing. Two beats advance one tooth space.'),
            r('Wheel turn', `${fixed(s.escape * 180 / Math.PI, 2)}°`, 'Clockwise from the initial entry lock: four degrees during impulse, two more during drop, six per completed beat.'),
            r('Time per beat', s.running ? `${fixed(s.period / 2, 6)} s` : 'Unavailable while stopped', 'Half the full pendulum period. Sixty beats turn this 30-tooth wheel once.'),
            inherited('Supported swing'),
            inherited('Energy per beat'),
            r('Average delivered power', `${fixed(s.power * 1e6, 2)} µW`, 'Average work reaching the bob per real second of settled operation; zero when stopped.'),
            inherited('Actual pendulum length'),
            r('Clock rate', inherited('Your result').value, 'The fixed train counts beats. Its designed rate assumes a two-second full pendulum period.'),
            s.running ? inherited('Weight travel') : r('Weight travel', inherited('Weight travel').value, 'Static contact position relative to the initial entry lock. There is no continuing descent while stopped.'),
        ];
    }
    const wrap = fn => (...args) => { fn(...args); return readings(); };
    for (const name of ['update', 'advance', 'animate', 'reset'])
        model[name] = wrap(model[name]);
    model.getState = () => ({ ...rawState(), readings: readings() });
    model.actions = model.actions.filter(action => action.part !== 'motion-work').map(action => ({ ...action, run: wrap(action.run) }));
    const inspectPhase = phase => {
        const values = rawState().values;
        model.reset({ phase });
        return model.update(values);
    };
    for (const [side, offset] of [['entry', 0], ['exit', .5]])
        model.actions.push({
            label: `Inspect: ${side} drop`, part: `${side}-pallet`, isolate: false, view: 'front', replay: false,
            run() {
                const s = clockPlan(rawState().values);
                if (!s.running)
                    return readings();
                const angle = ESCAPEMENT.lift + ESCAPEMENT.dropTravel / 2;
                return inspectPhase(offset + Math.acos(-angle / s.theta) / (2 * Math.PI));
            },
        });
    model.actions.push({ label: 'Inspect: drive and pendulum', part: 'system', isolate: false, view: 'front', replay: false, run: () => model.update() });
    model.playback = { ...model.playback, label: 'Run to the one-minute checkpoint', description: 'Runs to the 60-second mark of this settled-motion demonstration. Preset start times vary. Step advances one beat. Reset restores default settings.', advance: model.advance, step: wrap(model.playback.step) };
    return model;
}
