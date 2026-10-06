import assert from 'node:assert/strict';
import { CD_EFM_WORDS } from './cd-efm-table.js';
import { cdCircEncode, cdCircDecode, cdRestoreErasures, cdEfmEncode, cdEfmDecode, cdNrziLevels, cdDetectTransitions, cdEraseSymbols, cdPcmFrames, cdRecoveredPcm } from './cd-codec.js';

const rows = frames => frames.map(frame => Array.from(frame));
let checks = 0;
function check(test, message) { assert.ok(test, message); checks++; }
function same(actual, expected, message) { assert.deepEqual(actual, expected, message); checks++; }

// Independent polynomial arithmetic, without the encoder's logarithm tables,
// matrix solver, syndrome implementation or word-order helper.
function times(a, b) {
  let value = 0;
  while (b) { if (b & 1) value ^= a; b >>= 1; a <<= 1; if (a & 256) a ^= 0x11d; }
  return value;
}
function remainder(word) {
  const result = Array.from(word), generator = [1, 15, 54, 120, 64];
  for (let i = 0; i < result.length - 4; i++) {
    const factor = result[i];
    generator.forEach((g, j) => { result[i + j] ^= times(factor, g); });
  }
  return result.slice(-4);
}
function systematic(data) {
  const parity = remainder([...data, 0, 0, 0, 0]); return [...data, ...parity];
}

check(CD_EFM_WORDS.length === 256 && new Set(CD_EFM_WORDS).size === 256, 'EFM is a one-to-one table');
// Values transcribed independently from the rendered Annex D pages, including
// the exceptions to the visible patterns in the table.
const known = { 0:'01001000100000',5:'00000100010000',13:'00000001000000',32:'00000000100000',35:'00100100100000',48:'00000100000000',51:'10000100010000',69:'00000000100100',98:'10010000100010',102:'01000000100100',121:'00001001001000',153:'10000010010000',156:'01000010010000',159:'00100010010000',162:'01000100010000',176:'00000100100000',179:'00100100010000',192:'01000100100000',195:'00001000100100',200:'00001001000001',202:'00001001000100',208:'00000100100100',211:'10000100100000',224:'01000100000010',226:'10000100010010',232:'10000100000010',233:'10000100000100',234:'00001001001001',240:'00000100100010',243:'00001000100010',255:'00100000010010' };
for (const [byte, word] of Object.entries(known)) same(CD_EFM_WORDS[byte], word, `Annex D byte ${byte}`);
for (const word of CD_EFM_WORDS) check(/^0*1(?:0{2,10}1)*0*$/.test(word) && word.length === 14, 'Each EFM word obeys run lengths');

const input = Array.from({length:256}, (_, n) => Uint8Array.from({length:24}, (_, j) => (n * 31 + j * 17 + (n >>> 2)) & 255));
const encoded = cdCircEncode(input);
for (const word of encoded.c1) same(remainder(word), [0,0,0,0], 'C1 is divisible by independent RS generator');
for (const word of encoded.c2) same(remainder(word), [0,0,0,0], 'C2 is divisible by independent RS generator');
for (const word of encoded.c1) same(Array.from(word), systematic(Array.from(word.slice(0,28))), 'Independent polynomial-division C1 parity');

// Figure C.4 describes the recorded data bytes directly as source-word indices.
const recordedWords = [0,0,4,4,8,8,1,1,5,5,9,9,null,null,null,null,2,2,6,6,10,10,3,3,7,7,11,11];
for (let n = 0; n < encoded.frames.length; n++) for (let j = 0; j < 28; j++) if (recordedWords[j] !== null) {
  const firstDelay = j < 12 ? 2 : 0, lastDelay = j % 2 === 0 ? 1 : 0;
  const sourceFrame = n - (4 * j + firstDelay + lastDelay);
  const expected = input[sourceFrame]?.[2 * recordedWords[j] + j % 2] ?? 0;
  same(encoded.frames[n][j], expected, `Figure C.4 data mapping at ${n}:${j}`);
}
same(rows(cdCircDecode(encoded.frames).frames), rows(input), 'Complete CIRC round trip including first and last input frames');

for (const length of [28,32]) {
  const word = systematic(Array.from({length:length-4}, (_, i) => (i*53+19)&255));
  for (let count = 1; count <= 4; count++) for (let start = 0; start < length; start++) {
    const received = [...word];
    for (let j = 0; j < count; j++) received[(start+j*5)%length] = -1;
    const restored = cdRestoreErasures(received);
    check(restored.ok && restored.repaired === count, 'One to four known erasures repaired');
    same(Array.from(restored.bytes), word, 'Repair reconstructs exact bytes');
  }
  const beyond = [...word]; beyond.fill(-1,0,5);
  check(!cdRestoreErasures(beyond).ok, 'Five erasures explicitly unresolved');
  const unknownError = [...word]; unknownError[8] ^= 128;
  check(!cdRestoreErasures(unknownError).ok, 'Unlocated corruption is not silently called repaired');
}

// Pack all 65,536 ordered pairs inside frame boundaries, so every possible
// adjacent EFM data-symbol boundary gets an actual encoder run.
const pairs = [];
for (let a = 0; a < 256; a++) for (let b = 0; b < 256; b++) pairs.push(a,b);
const pairFrames = Array.from({length:pairs.length/32}, (_, i) => Uint8Array.from(pairs.slice(i*32,i*32+32)));
const channel = cdEfmEncode(pairFrames), serial = Array.from(channel.bits).join('');
same(channel.bits.length, pairFrames.length*588, '588 cells in every channel frame');
same(rows(cdEfmDecode(channel.bits).frames), rows(pairFrames), 'Every ordered pair decodes correctly');
let previous = -1, headers = 0;
for (let i = 0; i < channel.bits.length; i++) if (channel.bits[i]) {
  if (previous >= 0) check(i-previous >= 3 && i-previous <= 11, 'Whole recording has only 3T-11T runs');
  previous = i;
}
for (let p = serial.indexOf('100000000001000000000010'); p >= 0; p = serial.indexOf('100000000001000000000010',p+1)) {
  check(p % 588 === 0, 'No false frame sync'); headers++;
}
same(headers,pairFrames.length,'Exactly one header per frame');
same(Array.from(cdDetectTransitions(cdNrziLevels(channel.bits))),Array.from(channel.bits),'NRZI pit/land levels preserve transition bits');
const controls = cdEfmDecode(channel.bits).controls;
controls.forEach((x, n) => same(x,n%98<2?`SYNC${n%98}`:0,'Section-control sync and placeholder control bytes'));

let digitalLevel = 1, digitalTotal = 0, digitalCursor = 0;
for (let n = 0; n < pairFrames.length; n++) for (let j = 0; j < 34; j++) {
  const p = n*588+24+j*17, headerNext = j === 33;
  while (digitalCursor < p) { if (channel.bits[digitalCursor++]) digitalLevel *= -1; digitalTotal += digitalLevel; }
  const chosen = serial.slice(p,p+3), word = headerNext ? '100000000001000000000010' : serial.slice(p+3,p+17);
  const candidates = [];
  for (const merge of headerNext ? ['000','100'] : ['000','001','010','100']) {
    const context = serial.slice(p-23,p)+merge+word;
    if (/10{0,1}1|10{11,}1/.test(context)) continue;
    const sync = context.indexOf('100000000001000000000010');
    if (sync >= 0 && !(headerNext && sync === 26)) continue;
    let level = digitalLevel, total = digitalTotal;
    for (const bit of merge+(headerNext?'':word)) { if (bit==='1') level *= -1; total += level; }
    candidates.push({merge,score:Math.abs(total)});
  }
  const minimum = Math.min(...candidates.map(x=>x.score)), best = candidates.filter(x=>x.score===minimum);
  check(best.some(x=>x.merge===chosen),'Every merge minimizes absolute NRZI digital sum among legal choices');
  if (best.some(x=>x.merge!=='000')) check(chosen!=='000','Equal-score merge prefers a transition');
}
while (digitalCursor < channel.bits.length) { if (channel.bits[digitalCursor++]) digitalLevel *= -1; digitalTotal += digitalLevel; }
same(digitalTotal,channel.dsv,'Independent full-recording digital sum');

const stereo = [Int16Array.from({length:2400},(_,i)=>(i*401)%65536-32768),Int16Array.from({length:2400},(_,i)=>32767-(i*311)%65536)];
const audioFrames = cdPcmFrames(stereo), audioEncoded = cdCircEncode(audioFrames), audioChannel = cdEfmEncode(audioEncoded.frames);
same(Array.from(audioFrames[0].slice(0,4)),[128,0,127,255],'PCM signed full scale and channel byte order');
for (const length of [0,1,8,196]) {
  const positions = [];
  if (length === 1) positions.push([140,7]);
  else for (let n = 140; n < 140 + length; n++) for (let j = 0; j < 32; j++) positions.push([n,j]);
  const damaged = cdEraseSymbols(audioChannel.bits,positions);
  const observed = cdDetectTransitions(cdNrziLevels(damaged)), demodulated = cdEfmDecode(observed), corrected = cdCircDecode(demodulated.frames), recovered = cdRecoveredPcm(corrected.frames);
  same(demodulated.invalidSymbols,positions.length,'Only the erased EFM words are flagged');
  if (length < 196) { same(rows(recovered.pcm),rows(stereo),'Recovered stereo equals original after correctable loss'); same(recovered.missingSamples,0,'Correctable loss leaves no missing samples'); }
  else { check(recovered.missingSamples>0,'Long loss leaves explicit unresolved samples'); check(recovered.pcm.some(c=>c.some(x=>x!==0)),'Long loss preserves unaffected audio'); }
  if (length === 1) check(corrected.stats.c1Repaired === 1 && corrected.stats.c2Repaired === 0,'One symbol repaired by C1');
  if (length === 8) check(corrected.stats.c1Failed > 0 && corrected.stats.c2Repaired > 0,'Burst needs deinterleaving and C2');
  console.log(JSON.stringify({loss:length,erased:positions.length,...corrected.stats,missingSamples:recovered.missingSamples}));
}
console.log(`CD codec: ${checks} checks passed, including all 65,536 EFM pairs, independent polynomial parity, source delay mapping, exact stereo recovery and explicit failure.`);
