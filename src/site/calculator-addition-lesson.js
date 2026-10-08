import {ADD_DEFAULTS} from './calculator-addition-physics.js';

const trial=(title,instruction,observe,settings={})=>({title,instruction,observe,values:{...ADD_DEFAULTS,...settings},reset:true,initialState:{settings:{...ADD_DEFAULTS,...settings},time:0},part:'calculator',isolate:true,view:'front'});

export const calculatorAdditionLesson={
  simple:'How do the numbers you enter become a result on a calculator display?',
  overview:'Choose two numbers and press Play. Each digit key connects a row and a column, so the controller can recognize the entry. The + and = keys store the operands and start addition. Follow each decimal carry, then watch the result replace the last entry on the reflective LCD. Turn off room light to hide the screen without interrupting a powered calculation. This teaching calculator adds two integers from 0 to 99.',
  steps:[
    {title:'Make a key connection',body:'A key lowers a conductive contact onto two pads. One pad belongs to a row and the other to a column. The selected operands set the sequence of digit keys, + and =; they are not already stored as a completed calculation.'},
    {title:'Scan and accept the key',body:'The controller drives one row low at a time. If the pressed key lies on that row, its column is pulled low too. The row and column identify the key. A stable-key check accepts it once, then the controller waits for release before accepting another press.'},
    {title:'Keep the entered operands',body:'Accepted digits build the current number on the display. The + key stores the first number as A. The following digits form the second entry; = stores it as B. The original entry remains on the screen while addition runs.'},
    {title:'Pass a decimal carry',body:'Start at the ones column. Add the two digits and any incoming carry. Keep the units digit of that total and pass any ten into the next column. For 25 + 9, the ones total is 14, so keep 4 and carry 1; the tens total becomes 3.'},
    {title:'Decode each result digit',body:'After all columns are ready, the result is transferred to the display register. Each decimal digit has a four-bit binary-coded decimal, or BCD, representation. A decoder maps that digit to the needed segments a through g. Unused leading positions remain blank.'},
    {title:'Control reflected light',body:'Alternating drive changes the liquid crystal under selected segments. In the normally bright reflective arrangement shown here, those segments become dark against a light background. Crossed polarizers and a rear reflector control which light returns toward you. The LCD does not make its own light.'},
  ],
  parts:[
    {name:'Case and key supports',role:'Hold the keys, board and display; the cutaway exposes their connections.'},
    {name:'Battery and switch',role:'Supply the active electronics and repeating LCD drive.'},
    {name:'Keys and contact matrix',role:'Connect one row and column so the controller can identify an entered key.'},
    {name:'Controller and operand registers',role:'Accept digit entries and store the two numbers when + and = arrive.'},
    {name:'Decimal addition and carry',role:'Form the result one decimal column at a time in the teaching sequence.'},
    {name:'BCD decoder and LCD driver',role:'Select seven-segment shapes and alternate electrode polarity relative to the common electrode.'},
    {name:'Reflective display stack',role:'Use glass, transparent electrodes, liquid crystal, crossed polarizers and a reflector to show dark digits.'},
  ],
  tryIt:[
    trial('Carry from ones to tens','Press Play to enter 25 + 9.','The display follows 2, 25 and 9. The ones column keeps 4 and carries 1; the final display reads 34.'),
    trial('Add without a carry','Press Play with 23 + 14 prepared.','Neither column makes ten. The final digits are 37, and both completed carry outputs are zero.',{first:23,second:14}),
    trial('Carry into hundreds','Press Play with 99 + 1 prepared.','The ones and tens each pass a carry. The three-digit result is 100.',{first:99,second:1}),
    trial('Reach the largest result','Press Play with 99 + 99 prepared.','The result is 198. All three display positions are used, with different segment selections for 1, 9 and 8.',{first:99,second:99}),
    trial('Show zero without leading zeros','Press Play with 0 + 0 prepared.','The final display shows one 0. Its middle segment stays unselected, and the two leading digit positions stay blank.',{first:0,second:0}),
    trial('Compare segment shapes','Press Play with 6 + 3, then inspect BCD and LCD drive.','Entry 6, entry 3 and result 9 use different segments. Result 9 has BCD 1001 and selects a, b, c, d, f and g.',{first:6,second:3}),
    trial('Remove device power','Device power starts Off. Turn it On, then press Play.','With power Off the display is blank and no keys are accepted. Power On starts a fresh entry sequence; 34 appears only after addition.',{power:0}),
    trial('Calculate in darkness','Press Play with Ambient light Off. After completion, turn Ambient light On.','The powered registers and segment selections reach 34 while the physical screen stays dark. Restoring light reveals 34 immediately without another calculation.',{ambient:0}),
  ],
  deeper:[
    {title:'Why a matrix saves connections',body:'A separate wire for every key is unnecessary. Four row connections and three column connections identify the 12 positions in this teaching keypad. Scanning determines the intersection. The model presses one ideal stable key at a time; it does not simulate simultaneous-key ghosting or contact-bounce waveforms.'},
    {title:'Decimal digits and BCD',body:'BCD gives each decimal digit its own four-bit code. For example, decimal 34 becomes 0011 for 3 and 0100 for 4. That differs from encoding the entire number 34 as one binary integer. The displayed BCD codes belong to the current display register, including intermediate entry digits.'},
    {title:'What a decimal carry means',body:'A total of 14 in the ones column means four ones and one ten. Keeping 4 and carrying 1 preserves the value. The same rule applies to tens carrying into hundreds. Real calculator chips can implement arithmetic with different serial or parallel logic; the visible columns are an explanatory algorithm.'},
    {title:'Why the LCD drive alternates',body:'A segment responds to voltage across its liquid-crystal layer. In the static-drive example, a selected segment is opposite in phase to the common electrode, so the difference alternates between +V and −V. An unselected segment follows the common signal and has zero difference. The two repeated half-cycles have zero mean. Finishing addition does not stop this drive.'},
    {title:'How the light returns',body:'In the chosen normally bright twisted-nematic arrangement, the undriven liquid crystal rotates polarization between crossed filters, allowing light to reach the reflector and return. Drive changes the alignment under a selected segment so the rear polarizer blocks that path. The enlarged view follows segment a of the ones digit and compares it with the unselected background.'},
    {title:'Light and power do different jobs',body:'Ambient light lets you see a reflective LCD. The battery supplies the electronics and electrode drive. Removing room light can leave a powered calculation running, while removing device power clears this model’s volatile state. Other calculators may use solar cells, batteries or both; this lesson makes no solar-output or battery-duration prediction.'},
  ],
  misconception:'A seven-segment LCD digit does not glow. The electronics choose a pattern of dark segments, and ambient light makes that pattern visible by reflection.',
  limits:'An addition-only teaching calculator for two nonnegative integers from 0 through 99, with a three-digit result. Key entry, stable-key checks, decimal columns and display transfer use illustrative scene time. Geometry, layer thicknesses, contacts and trace separation are enlarged. Decimal column arithmetic and the static BCD-to-segment driver explain function without reproducing a commercial calculator chip. The keypad allows one ideal stable key at a time; bounce, ghosting, other operations and fractional or negative inputs are omitted. LCD drive is normalized to symbolic V and shown as two repeating half-cycles, without a voltage, frequency, multiplexing, threshold or response-time prediction. The normally bright reflective optical path is qualitative. Power removal clears volatile state and relaxes the display immediately in this model. No battery lifetime, solar output or electrical power is calculated. Hardware and electrical diagrams stay lit for inspection when the physical screen is dark. Inspections preserve calculation state.',
  sources:[
    {title:'Microchip AN3407: matrix scanning, stable presses and key release',url:'https://ww1.microchip.com/downloads/aemDocuments/documents/MCU08/ApplicationNotes/ApplicationNotes/00003407A.pdf'},
    {title:'Texas Instruments CD4543B: BCD truth table and phased LCD drive',url:'https://www.ti.com/lit/ds/symlink/cd4543b.pdf'},
  ],
  quiz:{question:'A battery-powered calculation finishes while room light is off. What reveals the result without entering the numbers again?',options:['Restore ambient light while leaving device power on.','Remove device power so the LCD can generate light.','Select all seven segments in every digit.'],answer:0,explanation:'The powered register and LCD drive can hold the result in darkness. Ambient light reveals the reflective digit pattern. Turning power off clears this model’s volatile state.'},
};
