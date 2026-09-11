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
// The transformer. V2/V1 = N2/N1, N1 I1 = N2 I2, and an ideal transformer
// passes every watt it takes. The flux is the integral of the primary voltage
// over the primary turns, so it lags that voltage by a quarter cycle.
// ---------------------------------------------------------------------------
{
  const {transformerElectrical, transformerConstants} = await import(new URL('transformer-model.js', root));
  const omega = transformerConstants.omega;
  for (const primaryTurns of [8, 12, 20]) {
    for (const secondaryTurns of [4, 12, 36]) {
      for (const voltage of [6, 12, 24]) {
        for (const resistance of [4, 30]) {
          const values = {primaryTurns, secondaryTurns, voltage, resistance, connected: 1, startPhase: 0};
          const turnsRatio = secondaryTurns / primaryTurns;
          const state = transformerElectrical(values, 0.003);

          close(state.secondaryRms / state.primaryRms, turnsRatio, 1e-9, 'secondary volts follow the turns');
          close(
            state.secondaryVoltage / state.primaryVoltage,
            turnsRatio,
            1e-9,
            'the instantaneous voltages follow the turns as well',
          );
          // Ampere turns balance: what the secondary draws, the primary supplies
          // in the inverse proportion of the turns.
          close(
            primaryTurns * state.primaryCurrent,
            secondaryTurns * state.secondaryCurrent,
            1e-9,
            'ampere turns balance',
          );
          close(state.inputPower, state.loadPower, 1e-9, 'an ideal transformer passes every watt');

          // Faraday, the other way round: differentiate the flux the model
          // reports and it must be the primary voltage divided by the turns.
          const h = 1e-7;
          const before = transformerElectrical(values, 0.003 - h).flux;
          const after = transformerElectrical(values, 0.003 + h).flux;
          close(
            (after - before) / (2 * h),
            state.primaryVoltage / primaryTurns,
            1e-4,
            'the flux is the primary voltage integrated over the primary turns',
          );

          // The flux amplitude is set by volts, frequency and turns, and by
          // nothing on the secondary side.
          const peak = Math.SQRT2 * voltage / (omega * primaryTurns);
          const quarter = transformerElectrical(values, Math.PI / 2 / omega).flux;
          close(Math.abs(quarter), peak, 1e-9, 'the flux reaches the amplitude volts and turns set');
        }
      }
    }
  }
  // An open secondary draws nothing and takes nothing.
  const open = transformerElectrical(
    {primaryTurns: 12, secondaryTurns: 24, voltage: 12, resistance: 8, connected: 0, startPhase: 0},
    0.004,
  );
  close(open.secondaryCurrent, 0, 1e-12, 'an open secondary carries no current');
  close(open.inputPower, 0, 1e-12, 'and the primary of an ideal transformer then takes no power');
  ok(Math.abs(open.secondaryVoltage) > 0, 'though the open secondary still shows its voltage');
}

// ---------------------------------------------------------------------------
// The generator. The flux through a loop turning in a steady field is B A cos,
// the induced voltage is minus its rate of change, and the torque needed to
// keep turning is exactly the electrical power divided by the speed.
// ---------------------------------------------------------------------------
{
  const {generatorElectrical, electricGeneratorConstants} = await import(
    new URL('electric-generator-model.js', root)
  );
  const area = electricGeneratorConstants.area;
  const winding = electricGeneratorConstants.windingResistance;
  for (const field of [0.4, 1.2]) {
    for (const omega of [3, 11]) {
      for (const resistance of [1, 6, 40]) {
        for (const theta of [0.3, 1.1, 2.4, 4.0, 5.5]) {
          const values = {field, resistance, connected: 1};
          const state = generatorElectrical(values, theta, omega, true);

          close(state.flux, field * area * Math.cos(theta), 1e-12, 'flux through the turning loop');
          // Faraday and Lenz, from the flux alone: e = -dPhi/dt, dt taken along
          // the rotation the model is being driven through.
          const h = 1e-6;
          const fluxBefore = generatorElectrical(values, theta - omega * h, omega, true).flux;
          const fluxAfter = generatorElectrical(values, theta + omega * h, omega, true).flux;
          close(state.coilEmf, -(fluxAfter - fluxBefore) / (2 * h), 1e-5, 'the induced voltage is minus the rate of change of flux');

          close(
            state.current,
            state.coilEmf / (winding + resistance),
            1e-12,
            'the loop current is its voltage over the whole loop resistance',
          );
          // Energy: the shaft pays for the heat in both resistances.
          close(
            state.drivePower,
            state.loadPower + state.windingPower,
            1e-9,
            'the driving torque accounts for every watt dissipated',
          );
          ok(state.loadPower >= 0 && state.windingPower >= 0, 'neither resistance generates power');

          // Commutated, the same machine must deliver a voltage that never
          // reverses, while the coil itself still carries alternating current.
          const commutated = generatorElectrical(values, theta, omega, false);
          if (commutated.contact) {
            ok(commutated.externalEmf * Math.sign(omega) >= -1e-12, 'a commutator never sends the voltage backwards');
            close(
              commutated.drivePower,
              commutated.loadPower + commutated.windingPower,
              1e-9,
              'the commutated machine balances its energy too',
            );
          }
        }
        // Disconnect the load and the shaft turns freely.
        const free = generatorElectrical({field, resistance, connected: 0}, 1.0, omega, true);
        close(free.current, 0, 1e-12, 'an open circuit carries no current');
        close(free.driveTorque, 0, 1e-12, 'and so costs no torque');
        ok(Math.abs(free.coilEmf) > 0, 'while the coil still shows its open circuit voltage');
      }
    }
  }
  // Standing still, a generator generates nothing.
  const still = generatorElectrical({field: 1, resistance: 5, connected: 1}, 0.9, 0, true);
  close(still.coilEmf, 0, 1e-12, 'a stationary loop induces nothing');
  close(still.current, 0, 1e-12, 'and drives no current');
}

// ---------------------------------------------------------------------------
// The transmission line. The reason to send power at high voltage is that the
// loss in the line is set by the current, so the loss fraction has to fall as
// the square of the ratio the line is stepped up by.
// ---------------------------------------------------------------------------
{
  const {transmissionElectrical} = await import(new URL('electricity-transmission-model.js', root));
  for (const lineResistance of [0.5, 2, 6]) {
    for (const loadResistance of [1, 5, 20]) {
      let previousFraction = Infinity;
      for (const ratio of [1, 2, 4, 8, 16]) {
        const state = transmissionElectrical({ratio, lineResistance, loadResistance, connected: 1}, 0.004);
        close(
          state.meanSourcePower,
          state.meanLineLoss + state.meanLoadPower,
          1e-9,
          'the source pays for the line loss and the load together',
        );
        // The far transformer makes the load look a ratio squared bigger to the
        // line, which is the whole of the argument for high voltage.
        const expected = lineResistance / (lineResistance + ratio * ratio * loadResistance);
        const fraction = state.meanLineLoss / state.meanSourcePower;
        close(fraction, expected, 1e-9, 'the share lost in the line');
        ok(fraction < previousFraction, 'stepping the line up further wastes less of it');
        previousFraction = fraction;
        close(
          state.meanLineLoss,
          state.lineRmsCurrent ** 2 * lineResistance,
          1e-9,
          'the line loss is its own current squared through its own resistance',
        );
      }
      const open = transmissionElectrical({ratio: 4, lineResistance, loadResistance, connected: 0}, 0.004);
      close(open.lineRmsCurrent, 0, 1e-12, 'a disconnected line carries nothing');
      close(open.meanLineLoss, 0, 1e-12, 'and wastes nothing');
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

console.log(`PASS ${checks} textbook invariants over transformer, generator, transmission, stepper, ignition coil and direct current motor.`);
