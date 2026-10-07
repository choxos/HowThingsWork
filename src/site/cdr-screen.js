import { CDROM_SCREEN_WIDTH as WIDTH, CDROM_SCREEN_HEIGHT as HEIGHT } from './cdrom-screen.js';
import { CDR_CHANNEL_CELLS } from './cdr-medium.js';

export function paintCdrScreen(surface, s) {
  const key = [s.inputBits, s.outputBits, s.phase, s.values.medium, s.values.power, s.values.readLight, s.storedMarks,
    Math.floor(s.writeCells / CDR_CHANNEL_CELLS * 100), Math.floor(s.readCells / CDR_CHANNEL_CELLS * 100)].join(':');
  if (surface.key === key) return;
  surface.key = key; surface.paintCount++;
  surface.rendered = { input: s.inputBits, output: s.outputBits, available: s.available, marks: s.storedMarks, phase: s.phase, occupied: s.values.medium !== 0 };
  const c = surface.context;
  if (!c) return;
  c.fillStyle = '#f5f3ea'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.fillStyle = '#263f40'; c.fillRect(0, 0, WIDTH, 64);
  c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 28px sans-serif';
  c.fillText('WRITE A BYTE · READ IT BACK', 28, 33);
  const bits = (value, y, unavailable = false) => {
    for (let i = 0; i < 8; i++) {
      const x = 38 + i * 88, bit = value === null ? null : Number(value[i]);
      c.fillStyle = bit === 1 ? '#398064' : bit === 0 ? '#dde7da' : '#e7dfce'; c.fillRect(x, y, 76, 66);
      c.fillStyle = bit === 1 ? '#ffffff' : '#263f40'; c.font = 'bold 39px monospace'; c.textAlign = 'center';
      c.fillText(bit === null ? unavailable ? '×' : '?' : String(bit), x + 38, y + 35);
    }
    c.textAlign = 'left';
  };
  c.fillStyle = '#263f40'; c.font = 'bold 23px sans-serif'; c.fillText('Requested byte', 38, 100); bits(s.inputBits, 124);
  c.fillStyle = '#263f40'; c.font = 'bold 23px sans-serif'; c.fillText(s.complete ? s.available ? 'Checked readback' : 'Readback unavailable' : 'Readback waits for sector checks', 38, 232);
  bits(s.outputBits, 256, s.complete && !s.available);
  c.fillStyle = '#263f40'; c.font = '22px sans-serif';
  const lines = s.complete ? s.available ? s.values.medium ? ['Existing marks return the OLD byte above.', 'The writer blocked replacement of this region.'] :
    ['The newly recorded region returns your byte.', 'The reader used stored marks, then checked the sector.'] : !s.values.readLight ?
    ['Read light is off, so no byte reaches the computer.', s.storedMarks ? 'The recorded marks remain on the disc.' : 'No marks were written in this blank region.'] :
    ['This blank region never received recording exposure.', 'Reading light alone cannot store new information.'] : s.seeking ?
    ['The dye stays unchanged as the pickup moves back.', s.values.readLight ? 'Next: illuminate the same region with reading light.' : 'Next: scan with read light off; no byte can return.'] : s.reading ?
    s.values.readLight ? ['Returned light is checked for stored transitions.', 'Readback waits for the completed scan and checks.'] :
    ['Read light is off; no transitions reach the receiver.', 'The pickup scans, but no byte can be recovered.'] : s.values.medium ?
    ['This region already contains recorded marks.', 'Write-once media cannot replace that recording.'] : s.values.power === 0 ?
    ['Recording exposure permanently changes the dye.', 'Dark cells are marks, not individual input ones.'] : s.values.power === 1 ?
    ['Reading light does not change blank dye.', 'A later read will have no recorded byte to recover.'] :
    ['Writing laser off: no new marks form.', 'A later read will find this region still blank.'];
  lines.forEach((line, i) => c.fillText(line, 38, 366 + 31 * i));
  for (const [name, amount, y, color] of [['Write pass', s.writeCells, 446, '#ac7942'], ['Read pass', s.readCells, 500, '#397b94']]) {
    c.fillStyle = '#263f40'; c.font = '18px sans-serif'; c.fillText(name, 38, y - 15);
    c.fillStyle = '#dfdfd4'; c.fillRect(38, y, 692, 11); c.fillStyle = color; c.fillRect(38, y, 692 * amount / CDR_CHANNEL_CELLS, 11);
  }
  c.fillStyle = '#e1e7dc'; c.fillRect(0, 544, WIDTH, 32); c.fillStyle = '#263f40'; c.font = '17px sans-serif';
  c.fillText(`${s.storedMarks.toLocaleString('en-US')} marked cells · Reset or control changes prepare another experiment`, 25, 561);
  surface.texture.needsUpdate = true;
}
