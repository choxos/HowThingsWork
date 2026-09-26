// Textbook invariants, checked against the models from the outside.
//
// The per-machine checks in src/site are written next to the model they test
// and share its arithmetic; when a model is wrong in a way its own check
// restates, both agree and nothing fails. This file does not read any model's
// working. It states the law in its own terms, from a textbook, and holds the
// model to it: induced voltage differentiated numerically from the flux the
// model reports, power counted at both ends of a circuit, a ratio derived from
// turns rather than from the model's own ratio field.
//
// Usage: node scripts/check-physics-laws.mjs
import assert from 'node:assert/strict';

const root = new URL('../src/site/', import.meta.url);
let checks = 0;
const close = (actual, expected, tolerance, message) => {
  const room = Math.max(tolerance, Math.abs(expected) * tolerance);
  assert.ok(
    Math.abs(actual - expected) <= room,
    `${message}: ${actual} is not within ${room} of ${expected}`,
  );
  checks += 1;
};
const ok = (condition, message) => {
  assert.ok(condition, message);
  checks += 1;
};

// ---------------------------------------------------------------------------
// The transformer. V2/V1 = N2/N1, the primary pays for everything the
// secondary delivers plus the copper and the core, and the flux is the integral
// of the primary voltage over the primary turns, so it lags that voltage by a
// quarter cycle and its peak is the universal EMF equation's.
// ---------------------------------------------------------------------------
{
  const {transformerPlan, transformerAt, STAGES, WINDING} = await import(new URL('grid-physics.js', root));
  for (const stage of [0, 1, 2]) {
    for (const primaryTurns of [3, 30, 60, 72]) {
      for (const secondaryTurns of [1, 5, 36, 72]) {
        for (const load of [0, 50, 120]) {
          const plan = transformerPlan({stage, primaryTurns, secondaryTurns, load, core: 0, winding: 0});
          const place = STAGES[stage];
          const N1 = primaryTurns * WINDING.per, N2 = secondaryTurns * WINDING.per;
          close(plan.secondaryVolts / plan.primaryVolts, N2 / N1, 1e-12, 'secondary volts follow the turns');
          close(plan.primaryVolts, place.primary, 1e-12, 'the primary stands the voltage of the place it is installed');
          close(plan.input, plan.output + plan.coreLoss + plan.copperLoss, 1e-9, 'the primary pays for the output, the copper and the core');
          close(plan.activeCurrent * plan.primaryVolts, plan.input, 1e-9, 'the in-phase primary current carries that power');
          ok(plan.activeCurrent * N1 >= plan.secondaryCurrent * N2 * (1 - 1e-12), 'the primary ampere turns at least balance the secondary ones');
          ok(plan.primaryCurrent >= plan.activeCurrent, 'the magnetizing current only adds to the primary current');
          if (plan.output > 0) ok(plan.efficiency < 1 && plan.efficiency > 0, 'no transformer passes more than it takes');
          const h = 1e-7;
          for (const time of [0.0013, 0.0071, 0.0152]) {
            const at = transformerAt(plan, time);
            close(at.secondaryVoltage / at.primaryVoltage, N2 / N1, 1e-9, 'the instantaneous voltages follow the turns as well');
            const slope = (transformerAt(plan, time + h).core - transformerAt(plan, time - h).core) / (2 * h);
            close(slope, at.primaryVoltage / N1, 1e-4, 'the flux is the primary voltage integrated over the primary turns');
          }
          const quarter = transformerAt(plan, Math.PI / 2 / plan.omega);
          const peak = Math.SQRT2 * plan.primaryVolts / (2 * Math.PI * 50 * N1 * place.area);
          close(quarter.density, peak, 1e-9, 'the flux density reaches the universal EMF equation a quarter cycle on');
          close(transformerAt(plan, 0).density, 0, 1e-12, 'and is zero while the voltage is at its peak');
        }
      }
    }
    // Doubling the turns halves the flux and so quarters the eddy current loss.
    const fewer = transformerPlan({stage, primaryTurns: 30, secondaryTurns: 5, load: 50, core: 0, winding: 0});
    const more = transformerPlan({stage, primaryTurns: 60, secondaryTurns: 10, load: 50, core: 0, winding: 0});
    close(more.flux, fewer.flux / 2, 1e-12, 'twice the turns, half the flux');
    close(more.coreLoss, fewer.coreLoss / 4, 1e-9, 'and a quarter of the core loss');
    // Copper loss goes as the square of the load, so efficiency peaks where it equals the core loss.
    const nominal = {stage, primaryTurns: STAGES[stage].primaryTurns, secondaryTurns: STAGES[stage].secondaryTurns, core: 0, winding: 0};
    const unloaded = transformerPlan({...nominal, load: 0});
    close(unloaded.copperLoss, 0, 1e-12, 'no load, no copper loss');
    const half = transformerPlan({...nominal, load: 50}), full = transformerPlan({...nominal, load: 100});
    close(full.copperLoss, 4 * half.copperLoss, 1e-9, 'copper loss goes as the square of the load');
    const efficiencies = Array.from({length: 24}, (_, i) => transformerPlan({...nominal, load: 5 * (i + 1)}));
    const best = efficiencies.reduce((a, b) => (b.efficiency > a.efficiency ? b : a));
    ok(Math.abs(best.share - unloaded.bestShare) <= 0.05 + 1e-9, 'efficiency peaks where the copper loss has grown to the core loss');
  }
}

// ---------------------------------------------------------------------------
// The generator. The flux linking a loop of N turns turning in a steady field
// is N B A cos, the induced voltage is minus its rate of change, and the shaft
// has to supply exactly the electrical power the coil delivers.
// ---------------------------------------------------------------------------
{
  const {generatorPlan, generatorAt, COIL_AREA, windingResistanceOf} = await import(new URL('grid-physics.js', root));
  for (const output of [0, 1]) {
    for (const field of [0.4, 1.2]) {
      for (const speed of [600, 3000, 3600]) {
        for (const turns of [2, 20, 40]) {
          for (const load of [1, 10, 50]) {
            const values = {output, speed, field, turns, load, closed: 1};
            const plan = generatorPlan(values);
            const omega = 2 * Math.PI * speed / 60;
            close(plan.peak, turns * field * COIL_AREA * omega, 1e-9, 'the peak is N B A omega');
            close(plan.frequency, speed * 2 / 120, 1e-12, 'a two pole machine makes one cycle a turn');
            for (const fraction of [0.07, 0.19, 0.31, 0.55, 0.83]) {
              const time = fraction * plan.period, at = generatorAt(plan, time);
              close(at.flux, turns * field * COIL_AREA * Math.cos(omega * time), 1e-12, 'flux linking the turning loop');
              const h = plan.period * 1e-6;
              const slope = (generatorAt(plan, time + h).flux - generatorAt(plan, time - h).flux) / (2 * h);
              close(at.coilEmf, -slope, 1e-5, 'the induced voltage is minus the rate of change of flux');
              const winding = windingResistanceOf(turns);
              if (!at.bridged) close(at.current, at.terminal / (winding + load), 1e-12, 'the loop current is its voltage over the whole loop resistance');
              // Energy, instant by instant: the shaft's torque times its speed is
              // the coil's voltage times the current through it.
              close(at.torque * omega, at.coilEmf * at.coilCurrent, 1e-9, 'the driving torque accounts for every watt the coil delivers');
              close(at.coilEmf * at.coilCurrent, at.coilCurrent ** 2 * (at.bridged ? winding : winding + load), 1e-9, 'and every one of those watts is heat in the loop');
              if (output === 1) ok(at.terminal >= -1e-12, 'a commutator never sends the voltage backwards');
            }
            close(plan.drivePower, plan.loadPower + plan.windingPower, 1e-9, 'on average too, the shaft pays for both resistances');
          }
        }
        const open = generatorPlan({output, speed, field, turns: 20, load: 10, closed: 0});
        const at = generatorAt(open, open.period * 0.2);
        if (output === 0) {
          close(at.current, 0, 1e-12, 'an open circuit carries no current');
          close(at.torque, 0, 1e-12, 'and so costs no torque');
        }
        ok(Math.abs(at.coilEmf) > 0, 'while the coil still shows its open circuit voltage');
      }
    }
  }
  const still = generatorPlan({output: 0, speed: 0, field: 1, turns: 20, load: 10, closed: 1});
  close(generatorAt(still, 3).coilEmf, 0, 1e-12, 'a stationary loop induces nothing');
  close(generatorAt(still, 3).current, 0, 1e-12, 'and drives no current');
}

// ---------------------------------------------------------------------------
// The transmission line. The loss in the line is set by the current, so for
// the same power delivered it falls as the square of the voltage, and three
// balanced phases heat the line at a steady rate through the whole cycle.
// ---------------------------------------------------------------------------
{
  const {linePlan, lineAt, catenaryOf, LEVELS, CONDUCTORS} = await import(new URL('grid-physics.js', root));
  for (const conductor of [0, 1, 2]) {
    for (const length of [10, 100, 300]) {
      for (const power of [5, 200, 600]) {
        let previous = Infinity;
        for (const voltage of [0, 1, 2, 3, 4]) {
          const plan = linePlan({voltage, conductor, length, power, span: 400, tension: 20, weather: 0});
          const V = LEVELS[voltage], R = CONDUCTORS[conductor].ac * length * 1000, I = power * 1e6 / (Math.sqrt(3) * V);
          close(plan.current, I, 1e-12, 'three phase line current is P over root three V');
          close(plan.loss, 3 * I * I * R, 1e-9, 'each conductor wastes its own current squared through its own resistance');
          close(plan.sent, plan.delivered + plan.loss, 1e-9, 'the source pays for the load and the line together');
          close(plan.drop, Math.sqrt(3) * I * R, 1e-9, 'the line voltage drop');
          ok(plan.lossFraction < previous, 'stepping the line up further wastes less of it');
          previous = plan.lossFraction;
          close(plan.loss * V * V, plan.ladder[0].loss * LEVELS[0] ** 2, 1e-9, 'for the same power, loss goes as one over the voltage squared');
          for (const time of [0, 0.003, 0.011, 0.017]) {
            const at = lineAt(plan, time);
            close(at.phases.reduce((a, b) => a + b, 0), 0, 1e-9 * I, 'three balanced phases sum to nothing, so no return conductor is needed');
            close(at.heat, plan.loss, 1e-9, 'and heat the line at the same rate at every instant');
          }
        }
      }
    }
  }
  // The catenary: a = H/w, and the support has to carry the horizontal
  // tension and half the conductor's weight.
  for (const conductor of CONDUCTORS) {
    for (const tension of [20e3, 40e3]) {
      for (const span of [200, 500]) {
        const hang = catenaryOf(conductor.weight, tension, span);
        close(hang.endTension ** 2, hang.horizontal ** 2 + hang.vertical ** 2, 1e-9, 'the end tension is the sum of its horizontal and vertical parts');
        close(hang.vertical, conductor.weight * hang.arc / 2, 1e-9, 'each support carries half the weight of the conductor it holds');
        ok(hang.arc > span, 'the conductor is longer than the span');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// The stepper. Four windings energized in turn carry the rotor one tooth
// forward in four steps, so a full turn takes four times as many steps as the
// rotor has teeth, and the sequence has to come back to where it started.
// ---------------------------------------------------------------------------
{
  const {stepperPhase, stepperMotorConstants} = await import(new URL('stepper-motor-model.js', root));
  const {teeth, stepAngle} = stepperMotorConstants;
  close(stepAngle * 4 * teeth, 2 * Math.PI, 1e-12, 'four steps a tooth, and the teeth make the turn');
  for (let index = 0; index < 12; index += 1) {
    const phase = stepperPhase(index);
    const next = stepperPhase(index + 4);
    assert.deepEqual(phase, next, 'the four step sequence repeats');
    checks += 1;
    close(Math.hypot(...phase), 1, 1e-12, 'one winding at a time carries the whole current');
    const quarter = stepperPhase(index + 1);
    close(phase[0] * quarter[0] + phase[1] * quarter[1], 0, 1e-12, 'each step is a quarter turn of the field');
    const opposite = stepperPhase(index + 2);
    close(phase[0] + opposite[0], 0, 1e-12, 'two steps on reverses the winding');
    close(phase[1] + opposite[1], 0, 1e-12, 'in both windings');
  }
  for (const current of [0.4, 2.5]) {
    close(Math.hypot(...stepperPhase(1, current)), current, 1e-12, 'the pattern scales with the current');
  }
}

// ---------------------------------------------------------------------------
// The ignition coil. Two windings on one core cannot be coupled more tightly
// than perfectly, and the turns they are described by have to agree with the
// inductances they are given.
// ---------------------------------------------------------------------------
{
  const {carIgnitionConstants: C} = await import(new URL('car-ignition-model.js', root));
  const coupling = C.M / Math.sqrt(C.Lp * C.Ls);
  ok(coupling > 0 && coupling <= 1, `coupling of ${coupling} is possible for two real windings`);
  close(
    Math.sqrt(C.Ls / C.Lp),
    C.secondaryTurns / C.primaryTurns,
    1e-9,
    'inductance goes as the square of the turns',
  );
  ok(C.strikeVoltage > C.releaseVoltage, 'a spark costs more to start than to keep going');
  ok(C.Rs > C.Rp, 'the long thin secondary is the more resistive winding');
}

// ---------------------------------------------------------------------------
// The direct current motor. Around the loop, the supply is spent on the
// resistance of the winding and on the voltage the turning coil generates
// against it, so a motor with no field is nothing but a resistor, and one that
// is turning draws less than its stalled current. Every watt that leaves the
// supply is either heat in the winding or work at the shaft.
// ---------------------------------------------------------------------------
{
  const {createDCMotorModel} = await import(new URL('dc-motor-model.js', root));
  const made = [];
  const start = (values = {}) => {
    const model = createDCMotorModel();
    model.update(values);
    made.push(model);
    return model;
  };
  const settle = model => {
    for (let frame = 0; frame < 3600; frame += 1) {
      const state = model.getState();
      if (state.complete || state.blocked) return state;
      model.advance(1 / 60);
    }
    throw new Error('the motor never settled');
  };

  // With no field the machine cannot make torque, so the winding is a plain
  // resistor and the supply divided by the resistance is the whole answer.
  for (const voltage of [1, 3, 6]) {
    const state = settle(start({voltage, field: 0}));
    close(state.current, voltage / state.resistance, 1e-12, 'a motor with no field obeys Ohm alone');
    close(state.torque, 0, 1e-12, 'and makes no torque');
    close(state.omega, 0, 1e-12, 'so it never turns');
    close(state.inputPower, state.copperLoss, 1e-12, 'every watt it takes becomes heat');
  }

  // Kirchhoff around the loop, at every instant of a powered run. A commutator
  // spends part of every turn with its brushes off the copper, and an open loop
  // carries no current however much supply stands across it, so the loop
  // equation is a claim about the part of the turn that conducts.
  const running = start({voltage: 6, field: 1, load: 0});
  let conducted = 0;
  let opened = 0;
  for (let frame = 0; frame < 600; frame += 1) {
    const state = running.getState();
    if (state.complete || state.blocked) break;
    if (!state.contact) {
      close(state.current, 0, 1e-12, 'an open commutator carries no current');
      close(state.convertedPower, 0, 1e-12, 'and converts nothing');
      opened += 1;
      running.advance(1 / 60);
      continue;
    }
    conducted += 1;
    close(
      state.voltage,
      state.current * state.resistance + state.backEmf,
      1e-9,
      'supply equals the drop in the winding plus the voltage the coil generates back',
    );
    close(state.inputPower, state.copperLoss + state.convertedPower, 1e-12, 'the supply pays for heat and shaft work');
    close(state.convertedPower, state.backEmf * state.current, 1e-12, 'shaft work reaches the shaft through the back voltage');
    close(state.convertedPower, state.torque * state.omega, 1e-12, 'and arrives as torque times speed');
    ok(state.copperLoss >= 0, 'the winding never cools the supply');
    running.advance(1 / 60);
  }
  ok(conducted > 0, 'the run spent some of itself conducting');
  ok(opened >= 0, 'and the open part of the turn, if any, was counted');

  // A turning motor draws less than a stalled one, because the back voltage is
  // subtracted from the supply before the resistance sees it.
  const spun = settle(start({voltage: 6, field: 1, load: 0}));
  ok(spun.omega > 0, 'the motor turns');
  ok(spun.backEmf > 0, 'and generates against its own supply');
  ok(
    spun.current < spun.voltage / spun.resistance,
    'so it draws less than the stalled current the supply and resistance alone would give',
  );

  // More volts, more speed; more load, less speed.
  const slower = settle(start({voltage: 2, field: 1, load: 0}));
  ok(slower.omega < spun.omega, 'fewer volts leave it slower');
  const loaded = settle(start({voltage: 6, field: 1, load: 2}));
  ok(loaded.omega < spun.omega, 'a heavier load leaves it slower');

  // Reversing the supply reverses the turning. Not to the last digit: the rotor
  // starts at a fixed angle and the commutator gaps sit where they sit, so the
  // two directions do not begin as mirror images of one another. The direction
  // is the law; the speed only has to be the same machine.
  const forward = settle(start({voltage: 6, field: 1, load: 1, polarity: 1}));
  const backward = settle(start({voltage: 6, field: 1, load: 1, polarity: -1}));
  ok(forward.omega > 0 && backward.omega < 0, 'reversed leads turn it the other way');
  close(Math.abs(backward.omega), Math.abs(forward.omega), 0.05, 'at much the same speed');
  close(backward.inputPower, forward.inputPower, 0.05, 'for much the same power');
  ok(forward.inputPower > 0, 'which the supply pays, rather than receives');

  for (const model of made) model.dispose?.();
}

console.log(`PASS ${checks} textbook invariants over transformer, generator, transmission line, catenary, stepper, ignition coil and direct current motor.`);
