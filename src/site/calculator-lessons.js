import {CALC_DEFAULTS} from './calculator-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  calculator: {title: 'Wikipedia: Calculator', url: 'https://en.wikipedia.org/wiki/Calculator'},
  bcd: {title: 'Wikipedia: Binary-coded decimal', url: 'https://en.wikipedia.org/wiki/Binary-coded_decimal'},
  adder: {title: 'Wikipedia: Adder (electronics)', url: 'https://en.wikipedia.org/wiki/Adder_(electronics)'},
  hp35: {title: 'Wikipedia: HP-35', url: 'https://en.wikipedia.org/wiki/HP-35'},
  segments: {title: 'Wikipedia: Seven-segment display', url: 'https://en.wikipedia.org/wiki/Seven-segment_display'},
  matrix: {title: 'Wikipedia: Keyboard matrix circuit', url: 'https://en.wikipedia.org/wiki/Keyboard_matrix_circuit'},
  keyboard: {title: 'Wikipedia: Keyboard technology', url: 'https://en.wikipedia.org/wiki/Keyboard_technology'},
  switch: {title: 'Wikipedia: Switch', url: 'https://en.wikipedia.org/wiki/Switch'},
  lcd: {title: 'Wikipedia: Liquid-crystal display', url: 'https://en.wikipedia.org/wiki/Liquid-crystal_display'},
  solar: {title: 'Wikipedia: Solar-powered calculator', url: 'https://en.wikipedia.org/wiki/Solar-powered_calculator'},
  buttonCell: {title: 'Wikipedia: Button cell', url: 'https://en.wikipedia.org/wiki/Button_cell'},
  lux: {title: 'Wikipedia: Lux', url: 'https://en.wikipedia.org/wiki/Lux'},
  empcd: {title: 'ELAN Microelectronics: EMPCD081A calculator chip, product specification (copy at datasheet.live)', url: 'https://pdf.datasheet.live/8d2521d5/emc.com.tw/EMPCD081A.html'},
  amorton: {title: 'Panasonic: Amorton solar cells', url: 'https://panasonic.net/electricworks/amorton/assets/pdf/Brochures_Amorton_E_2.pdf'},
  a76: {title: 'Energizer: A76 (LR44) product datasheet', url: 'https://data.energizer.com/pdfs/a76.pdf'},
  an3407: {title: 'Microchip AN3407: Using a matrix keypad with AVR devices', url: 'https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ApplicationNotes/ApplicationNotes/00003407A.pdf'},
  keyscan: {title: 'Infineon AN214818: Keyscan matrix', url: 'https://www.infineon.com/dgdl/Infineon-AN214818_Keyscan_Matrix-ApplicationNotes-v03_00-EN.pdf?fileId=8ac78c8c7cdc391c017d0d27cb0d62f5'},
};

/** What the calculator takes without a source or leaves out. */
export const calculatorLimits = 'The calculator is drawn at true size with an illustrative body and its display twice true size; the key matrix, the adder, the drive and the power are diagrams, not to scale, and the power chart uses logarithmic scales. The chip runs 100 times slower here than it does. Not from a source: the supply held at 1.5 V; the solar cell’s current in proportion to the light, and the chip running only when the cell covers its current, with the display’s own current and the sheet’s optional capacitor left out; one polling line driven every 0.25 ms, so = is read every 2 ms, the interval of Microchip’s note borrowed because the chip’s sheet gives no scan timing; the press landing at the start of a scan and the key held down to the end; the contact springing open four times, at fixed shares of the bounce time; the adder’s clock of 1 kHz, inside the few hundred hertz to kilohertz the Calculator page gives, where the chip’s oscillator runs at 200 kHz; 8 ticks for every digit; the adder running once however many presses the chip takes; the registers drawn as rows of cells rather than shifting; which segments share which segment line; the display holding the entry until the answer is ready; and the button cell’s capacity, measured at a far heavier drain. Only addition is modeled: the other keys, the memory, subtraction and the sign are left out.';

const adder = trial(CALC_DEFAULTS, 'adder'), keys = trial(CALC_DEFAULTS, 'keypad'), screen = trial(CALC_DEFAULTS, 'display'), power = trial(CALC_DEFAULTS, 'power'), body = trial(CALC_DEFAULTS, 'calculator');

export const calculatorLesson = {
  simple: 'How does a calculator add the numbers you type?',
  overview: 'A pocket calculator is a keypad, a display and one chip. The chip finds a pressed key by scanning a grid of wires, keeps each number as decimal digits of four bits, adds them a bit at a time with a carry, and lights seven segments for each digit, all on a few microamps from a strip of solar cells or a button cell. Press Play to press =, then change the numbers, the key’s bounce and the light.',
  steps: [
    {title: 'Scan the keys', body: 'The chip drives its polling lines one at a time and reads its strobe lines, so a pressed key shows up on one strobe line while one polling line is driven.'},
    {title: 'Wait out the bounce', body: 'A key’s contact bounces as it closes, so the chip takes the key only when several reads in a row agree.'},
    {title: 'Add a bit at a time', body: 'The digits of the two registers go through a full adder one bit at a time, with the carry kept from each bit for the next.'},
    {title: 'Correct each digit', body: 'A digit whose sum passes nine gets six more, which keeps it a decimal digit and carries one into the next.'},
    {title: 'Light the digits', body: 'A decoder turns each digit’s four bits into seven segments, and the chip drives them with alternating voltages, powered by a solar cell or a button cell.'},
  ],
  parts: [
    {name: 'Calculator, true size', role: 'The keys, the display, and the solar cell or button cell that powers them.'},
    {name: 'Key matrix', role: 'The polling and strobe lines the chip scans to find a pressed key, with a chart of one press.'},
    {name: 'Bit serial adder', role: 'Two registers, two full adders and a buffer that add the numbers a digit and a bit at a time.'},
    {name: 'Display and decoder', role: 'The digits shown, each with its four bits and the seven bits that light its segments.'},
    {name: 'Display drive', role: 'The voltages on the display’s commons and segment lines, and what a lit and a dark segment feel.'},
    {name: 'Power', role: 'The solar cell’s current against the light, and the current the chip draws.'},
  ],
  tryIt: [
    adder('Press =', 'Press Play and watch the adder.', 'The Y register holds 25 and the X register 9. In the units digit 5 and 9 make 14, past 9, so the right full adder adds 6: the four bits wrap to 4 and 1 carries into the tens, where 2 and the carry make 3. The display shows 34, 73.4 ms after the press.'),
    adder('Nine and eight', 'Set the first number to 9 and the second to 8, and press Play.', 'The Binary-coded decimal page’s example. The bits of 9 and 8 carry out of the buffer, leaving 1: a five-bit sum of 17, past 9, so the adder adds 6 and the digit becomes 7, while the carry makes the tens 1. The display shows 17.', {first: 9, second: 8}),
    screen('More digits than the display', 'Set the first number to 99,999,999 and the second to 1, and press Play.', 'Every digit makes 10, so the adder corrects all 8 digits to 0 and a ninth carry is left over. The chip shows E in the sign digit and the high 8 digits of 100,000,000, with the point where the answer times 10⁻⁸ puts it: 1.0000000.', {first: 99999999, second: 1}),
    keys('A bouncing key read twice', 'Set the key bounce to 10 ms and the debounce to 1 read, and press Play.', 'Reading = every 2 ms and trusting each read, the chip takes the key down at 3.375 ms, up again at 5.375 ms as the contact springs open, and down again at 11.375 ms: 2 presses for one.', {bounce: 10, debounce: 1}),
    keys('Four reads in a row', 'Set the key bounce to 10 ms and press Play.', 'The read at 3.375 ms finds the contact closed, but the one at 5.375 ms finds it open and the count starts again. After 4 closed reads in a row the chip takes the key once, at 17.375 ms, 8 ms later than after a bounce of 2.6 ms.', {bounce: 10}),
    power('Too dim to add', 'Set the room light to 100 lx and press Play.', 'At 100 lx, a very dark overcast day on the Lux page, the cell gives 6.65 μA: more than the 3.0 μA the chip needs to wait, so the display keeps 9 and the key is taken, but less than the 13 μA it needs to add, so 34 never comes. Waiting takes 45 lx and adding 195 lx.', {light: 100}),
    body('A button cell in the dark', 'Choose the button cell, set the room light to 0 lx and press Play.', 'The LR44 runs the chip with no light at all, though an LCD needs light to be seen. It holds 150 mAh to 0.9 V, but the chip stops at 1.20 V, when 80% is used: 120 mAh, which last 40,000 hours at the 3.0 μA the chip draws waiting, about 4.6 years.', {source: 1, light: 0}),
  ],
  deeper: [
    {title: 'Reading a key matrix', body: 'The EMPCD081A reads 49 keys on 11 lines. It drives its polling lines K0 to K7 high one at a time and reads its strobe lines K3 to K10, each held low through 180 kΩ, and a key joins a strobe line to a polling line that starts above it: = joins K8 to K5. Pressed while K5 is driven, = lifts K8 to 1.35 V through up to 20 kΩ of driver and contact, above the 1.1 V the chip needs to read a 1; at its lowest supply of 1.2 V, with the lowest pull-down of 100 kΩ, K8 still reaches 1.0 V against 0.8 V. The Keyboard matrix circuit page says calculators use such matrices, and that without a diode at each key some keys held together make others look pressed.'},
    {title: 'One press, not three', body: 'The Switch page shows a contact bouncing for 2.6 ms before it settles, and the Keyboard technology page says bounce can register several keystrokes, so a keyboard’s processor debounces them into one. Microchip’s note on keypads checks a key ten times, 2 ms apart; Infineon’s key scanner checks one to four times. Here the chip reads = every 2 ms and takes it after 4 reads in a row agree, so a bounce of 2.6 ms is taken at 9.375 ms. More reads reject longer bounces but take the key later.'},
    {title: 'A bit at a time', body: 'A full adder adds two bits and a carry: the Adder page gives its sum as A ⊕ B ⊕ C and its carry as A·B + C·(A ⊕ B), two XOR gates, two AND gates and an OR gate. The Calculator page says calculators favor bit serial designs, which pass every bit through one adder in turn, because they keep the chip simple at the cost of many more clock cycles. Here each digit takes 8 ticks, 4 to add its bits into the buffer and 4 to add the correction, so 8 digits take 64: 64 ms at the model’s 1 kHz. The HP-35 kept its numbers as 56-bit words of BCD for its serial processors.'},
    {title: 'Why add 6', body: 'Four bits count to 15, but a decimal digit stops at 9, so 6 of their patterns are never a digit. When a digit’s five-bit sum passes 9, adding 6 skips those patterns and carries 1 into the next digit. The Binary-coded decimal page’s example is 9 + 8: 1001 + 1000 = 10001, and 10001 + 0110 gives 0001 0111, a 1 and a 7. The Calculator page says most pocket calculators do all their arithmetic in BCD, so a digit never needs converting from binary to be shown.'},
    {title: 'Lighting the segments', body: 'The decoder turns a digit’s 4 bits into 7, one for each segment a to g. In the Seven-segment display page’s gfedcba order, where segment a is the lowest bit, 0 lights abcdef, 0x3F, and 1 lights b and c, 0x06, as the page says; 3 is 0x4F, 4 is 0x66, and the E the chip shows for an error lights adefg, 0x79. The chip drives its display from 3 commons: each common takes a turn at 3.0 V or 0 V while the others rest at 1.5 V, and each segment line sits at 0 or 3.0 V. A lit segment feels 3.0 V in its own slot and a dark one nothing, and both feel 1.5 V in the others: 2.12 V rms lit against 1.22 V dark. The polarity flips every frame, as the Liquid-crystal display page says these displays need, 93.8 times a second while the chip waits.'},
    {title: 'Power from a strip of glass', body: 'Panasonic’s AM-1417, 35.0 by 13.9 mm, gives 13.3 μA at 1.5 V under 200 lx of fluorescent light, and its 2.5 V open circuit at 0.63 V a cell suggests 4 cells in series. Its current follows the light, so the EMPCD081A’s 3.0 μA of waiting takes 45 lx and its 13 μA of adding 195 lx, just under the cell’s rating; even shorted, the cell’s 14.1 μA at 200 lx needs 184.4 lx to cover 13 μA. The Calculator page says a CMOS chip draws appreciable power only when its transistors change state, which is why so little is enough. An LR44 instead holds 150 mAh to 0.9 V, and the chip stops at 1.20 V, when 80% of it is used.'},
  ],
  misconception: 'A calculator does not work its answers out in plain binary and then convert them. Most pocket calculators keep every digit as four bits of binary coded decimal and correct each digit as they add.',
  limits: calculatorLimits,
  sources: [sources.calculator, sources.bcd, sources.adder, sources.segments, sources.matrix, sources.keyboard, sources.switch, sources.lcd, sources.solar, sources.buttonCell, sources.lux, sources.hp35, sources.empcd, sources.amorton, sources.a76, sources.an3407, sources.keyscan],
  quiz: {
    question: 'Why does the adder add six to a digit whose sum passes nine?',
    options: ['Four bits can count past nine, and adding six skips the patterns that are not decimal digits and carries one into the next digit.', 'The display needs six more segments lit for a larger digit.', 'Six is how many polling lines the chip reads for each digit.'],
    answer: 0,
    explanation: 'Four bits count to 15 but a digit stops at 9, so 6 patterns go unused. In 5 + 9 = 14 the adder adds 6 to make 20, whose four low bits hold 4, and 1 carries into the tens.',
  },
};
