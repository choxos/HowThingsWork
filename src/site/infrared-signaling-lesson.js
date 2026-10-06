import {SIGNAL_DEFAULTS as D,signalTrialTime} from './infrared-signaling-physics.js';

const trial=(title,instruction,observe,settings={},part='system',start='beginning')=>{
  const values={...D,...settings},time=start==='bit'?signalTrialTime(values,values.bit):typeof start==='number'?start:0;
  return {title,instruction,observe,values,reset:true,initialState:{settings:{...values},time},part,isolate:true,view:'front'};
};

export const infraredSignalingLesson={
  simple:'How can invisible flashes carry a digital command?',
  overview:'The light carries a pattern in time. In this NEC example, every data burst has the same length, while the quiet gap after it changes. A short gap means zero; a long gap means one. Follow the message across the room, then magnify any of its 32 bits. The powered receiver removes the fast carrier, and the television times the recovered pulses before deciding whether to act.',
  steps:[
    {title:'Turn a key into bytes',body:'The encoder prepares a device address and a command. Each byte is followed by its bitwise inverse. The named keys have example codes; the question-mark key represents any other selected code.'},
    {title:'Send the lowest-weight bit first',body:'Each byte leaves least-significant bit first. Numeric command 26 is written 00011010 in usual binary notation, but travels as 01011000 from left to right on this timeline.'},
    {title:'Put fast flashes inside each burst',body:'The infrared LED switches at 38 kHz. A 562.5 microsecond data mark contains 22 on-pulses in the assigned one-third-duty carrier. Purple makes the otherwise invisible beam visible.'},
    {title:'Put information in the gap',body:'After the mark, zero has 562.5 microseconds of quiet; one has 1687.5 microseconds. Measured from one mark’s start to the next, those intervals are 1.125 and 2.25 milliseconds.'},
    {title:'Recover the burst envelope',body:'The receiver’s PIN photodiode, amplifier, filter and demodulator turn detected light bursts into low electrical pulses. Receiver power comes from the television. A hand, insufficient light or a mismatched carrier can prevent these pulses.'},
    {title:'Check before changing the television',body:'The next falling edge lets the decoder read a bit. The closing mark supplies that edge for the final bit. Only after the complete frame passes timing, inverse-byte and address checks can a recognized command change the screen or volume.'},
  ],
  parts:[
    {name:'Key, encoder and emitter',role:'Prepare a byte sequence and gate infrared current into timed bursts.'},
    {name:'Direct light path',role:'Carries the burst pattern from the handset to the receiving window.'},
    {name:'Complete-frame inspection',role:'Shows the entire outgoing envelope, received output and 32 chronological bits. A gold outline marks the inspected bit.'},
    {name:'Selected-bit inspection',role:'Enlarges one mark, its quiet gap and the next mark on a common time scale. Its separate lower trace enlarges the carrier.'},
    {name:'Receiver and decoder',role:'Recover pulse timing and test the complete message before applying an action.'},
    {name:'Television',role:'Shows a changed channel or volume only when the decoded address and command are accepted.'},
  ],
  tryIt:[
    trial('Watch a frame','Press Play and follow the message to the television.','The selected key closes; light bursts reach the receiver; channel 2 becomes channel 3 only after the complete frame.'),
    trial('Read the address','Inspect the first address bit, then press Play.','Numeric address 55 travels 11101100. Its first bit is one, with a 2.25 ms start-to-start interval.',{bit:0},'bit','bit'),
    trial('A zero in the command','Inspect command bit 0, then use Step or Play.','The 562.5 μs burst is followed by 562.5 μs of quiet. The receiver reads zero at the next falling edge.',{bit:16},'bit','bit'),
    trial('A one in the command','Inspect command bit 1, then use Step or Play.','The burst length stays 562.5 μs. The quiet grows to 1687.5 μs, so the next falling edge identifies one.',{bit:17},'bit','bit'),
    trial('A different command','Press Play with command 170 prepared.','The command travels 01010101 and its inverse 10101010. All 32 bits decode, but this example TV has no action assigned to 170.',{command:170},'signal'),
    trial('A command that raises volume','Press Play with code 18.','The command bits change to 01001000. Volume rises from 4 to 5 after validation; channel stays at 2.',{command:18}),
    trial('Zero is a whole byte too','Press Play with command 0.','Eight zeros are followed by eight ones in the command pair. This example assigns code 0 to Power, so the screen switches off.',{command:0},'signal'),
    trial('Eight ones in a byte','Press Play with command 255.','The command is 11111111 and its inverse 00000000. Timing and inverse checks pass, but there is no assigned TV action.',{command:255},'signal'),
    trial('Inspect the inverse address','Inspect the first inverse-address bit.','Address 55 is followed by 200, its byte complement. Their chronological words are 11101100 and 00010011.',{bit:8},'bit','bit'),
    trial('The last bit needs a closing mark','Use Step to reach the next falling edge, then continue.','The last inverse-command bit is one. The closing burst supplies its timing edge; the TV still waits for that final burst to finish.',{bit:31},'bit','bit'),
    trial('An unfinished message','Inspect the partly received frame, then press Play.','The signal clock starts at 28 ms. Some bits are known, but the TV remains on channel 2 until the rest arrives.',{},'signal',4.8),
    trial('A different device address','Press Play with address 56.','The complete frame is well formed, but this television accepts 55. Channel and volume stay unchanged.',{address:56},'signal'),
    trial('One damaged inverse bit','Press Play with the inverse-command fault.','The first bit of the last byte disagrees with its expected complement. The decoder rejects the message.',{fault:1,bit:24},'signal'),
    trial('The wrong carrier','Press Play with the 56 kHz carrier.','The envelope still encodes the same bits. This assigned 38 kHz receiver produces no output pulses.',{carrier:56},'bit'),
    trial('Out of range','Press Play with the receiver at 30 meters.','The same timed bursts leave the emitter, but irradiance falls below the model’s threshold. No command is recovered.',{distance:30},'photo'),
    trial('Blocked','Press Play with a hand in the beam.','The emitter keeps sending. The direct beam stops at the hand, the receiver output stays high, and channel 2 remains.',{blocked:1}),
    trial('Tired cells','Press Play with 1.6 V across the two cells.','Peak infrared current falls. The bit timing stays the same, and at 5 meters enough light remains for the channel command.',{battery:1.6}),
    trial('Tired cells farther away','Press Play with the same weak cells at 20 meters.','Now the weaker bursts arrive below threshold. The decoder receives no complete frame and the TV stays unchanged.',{battery:1.6,distance:20},'photo'),
  ],
  deeper:[
    {title:'Pulse distance is not burst brightness',body:'The mark always lasts 562.5 μs. The two gaps are 562.5 and 1687.5 μs, giving 1.125 and 2.25 ms between starts. The model compares received falling edges with those two distances using an assigned ±0.25 ms window. An arbitrary halfway split would not establish that malformed timing is valid. Weak light can stop reception; it does not turn a correctly timed zero into a one in this model.'},
    {title:'Written binary and transmitted order',body:'Ordinary binary notation puts the highest weight on the left. This protocol transmits the lowest weight first: 1, 2, 4, 8, 16, 32, 64, 128. For 55 the transmitted 11101100 means 1 + 2 + 4 + 16 + 32. The selected-bit control highlights one of those weights while preserving the existing physical clock and TV result.'},
    {title:'What the inverse bytes check',body:'A byte XOR its bitwise inverse equals 255. The two pairs contain sixteen zeros and sixteen ones, so every normal frame lasts 9 + 4.5 + 16 × 1.125 + 16 × 2.25 + 0.5625 = 68.0625 ms. Flipping one bit can change that duration and fails the inverse check. Complement checks detect the shown single-bit error; they are not protection against every possible corruption.'},
    {title:'Why the closing mark matters',body:'A bit is measured between two mark starts. Without another edge, the receiver cannot tell whether the final quiet gap was short or long. A final 562.5 μs mark closes that interval. In this decoder, the last bit becomes readable at its falling edge, but full validation waits until the closing low interval ends.'},
    {title:'Carrier pulses and carrier periods',body:'At 38 kHz, one carrier period is about 26.316 μs. A 562.5 μs mark spans 21.375 periods. Starting an on-pulse at the beginning of each period gives 22 on-pulses inside that mark at one-third duty. Counting on-pulses is not the same as counting complete periods. Carrier and envelope time use separate magnifications in the inspection diagram.'},
    {title:'RC5 uses a different timing rule',body:'RC5 is a comparison, not another simulated mode here. Vishay describes a 36 kHz carrier and biphase coding: each bit has one quiet half and one burst half, and their order carries the value. A half bit of 32 carrier cycles calculates to 888.889 μs, a bit to 1.77778 ms and a 14-bit word to 24.88889 ms. The source rounds the word to 24.9 ms and the repeat interval to 114 ms. Its figure’s 868 μs half-bit label is inconsistent with its stated 32 cycles at 36 kHz.'},
    {title:'The receiver removes the carrier',body:'A real receiver combines a PIN detector, gain control, bandpass filtering and envelope demodulation. Its output is active low. The cited test gives a delay between 7 and 13 carrier cycles; this model assigns 10 cycles, about 263.158 μs at 38 kHz, with no pulse-width distortion. The discrete 38/56 kHz comparison demonstrates matching, without claiming an infinitely narrow filter or simulating ambient-light rejection.'},
    {title:'Address first, command second',body:'This example television accepts numeric address 55 and a small assigned set of commands. A different address can be well formed and still be ignored. Code 170 can be recovered exactly and still have no assigned action. Real protocols, device codes and key mappings vary; NEC is one working example of infrared signaling, not a claim that all remotes share one format.'},
    {title:'Why weak cells and distance affect reception',body:'The two LED branches share the loaded cell voltage. The assigned infrared fit, resistor and ideal switch determine peak light output. For the aligned path, irradiance is intensity divided by distance squared; an opaque hand makes direct irradiance zero. A typical NEC sensitivity of 0.12 mW/m² is used as a sharp teaching cutoff. The manufacturer’s separate 30 m test uses a different pulse pattern and is not a calibration of this example.'},
  ],
  misconception:'The bit is not an individual flash of the carrier. Every data mark contains many flashes; the gap to the next mark distinguishes zero from one.',
  limits:'One normal NEC-style frame, with example TV address 55 and assigned commands. The TV begins on channel 2 at volume 4, unmuted. Holding a key, repeat frames, reflections, ambient interference, analog gain control and pulse distortion are excluded. Receiver threshold, timing windows, fixed delay and discrete carrier acceptance are assigned simplifications. The current estimate reuses typical LED fits and fixed cell resistance; logic power, heating and capacitor transients are omitted. The receiving-element current diagram is a BPW34-like analogy, not a specification of the PIN diode inside the TSOP receiver. The direct path is aligned, and mechanical sizes and light spacing are illustrative. Purple depicts invisible infrared. Envelope time runs 150 times slower after a 0.6 second illustrated key press. Gray traces show the selected plan; colored traces show elapsed transmission. The two marks in the bit view show the selected interval and its next edge. Bit inspection preserves time; changing the message or link restarts it.',
  sources:[
    {title:'Microchip AN2933: NEC protocol, section 3.2',url:'https://ww1.microchip.com/downloads/en/Appnotes/AN2933-DC-Motor-Control-with-Touch-Interface-and-IR00002933A.pdf'},
    {title:'Vishay: Data Formats for IR Remote Control',url:'https://www.vishay.com/docs/80071/dataform.pdf'},
    {title:'Vishay: TSOP382 and TSOP384 receiver modules',url:'https://www.vishay.com/docs/82491/tsop382.pdf'},
    {title:'Vishay: TSAL6200 infrared LED',url:'https://www.vishay.com/docs/81010/tsal6200.pdf'},
    {title:'Vishay: BPW34 PIN photodiode',url:'https://www.vishay.com/docs/81521/bpw34.pdf'},
    {title:'Energizer: E92 AAA cell',url:'https://data.energizer.com/pdfs/e92.pdf'},
  ],
  quiz:{question:'Two data bursts have equal brightness and equal length. Their next bursts start 1.125 ms and 2.25 ms later. Which bits were sent?',options:['Zero, then one: the pulse distance carries the value.','Both zero: the brightness is equal.','Both one: each mark contains many flashes.'],answer:0,explanation:'Equal 562.5 μs marks have different quiet gaps. Those gaps produce the two start-to-start distances. At 38 kHz each mark contains 22 on-pulses, so that pulse count does not distinguish these bits.'},
};
