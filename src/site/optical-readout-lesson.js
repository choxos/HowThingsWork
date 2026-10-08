import {READOUT_DEFAULTS as D} from './optical-readout-physics.js';

const experiment=(title,instruction,observe,values={},part='assembly')=>({title,instruction,observe,values:{...D,...values},reset:true,initialState:{settings:{...D,...values},time:0},part,isolate:true,view:'front'});

export const opticalReadoutLesson={
  simple:'How does an optical pickup turn a moving track into a stream of bits?',
  overview:'Follow one connected path: laser light reaches the disc, returned light makes current in a photodiode, and a receiver estimates the recorded sequence from voltage samples. Press Play to build the recovered bit stream. Then block the return or add noise and see what the receiver can still recover.',
  steps:[
    {title:'Put light on the track',body:'The collimator shapes the laser beam. Light passes the polarizing splitter and quarter-wave plate, turns at the fold mirror, and reaches the objective. The objective focuses it on the reflective data layer while the track moves past.'},
    {title:'Separate the returning light',body:'Both pits and lands reflect light. Their relief changes the phase pattern and the collected signal. The return retraces the folded path. After two passages through the quarter-wave plate, its polarization lets the splitter direct it toward the detector.'},
    {title:'Turn light into current',body:'Absorbed light creates mobile charge in the photodiode. The four detector areas contribute current to one data signal. More collected light gives more photocurrent; blocking the return removes that signal.'},
    {title:'Read a sequence of samples',body:'An amplifier converts current to voltage. A real receiver also maintains timing and equalizes the response. Here those settings are already known. The sequence detector compares possible track-level sequences with the received samples and keeps the best fit.'},
    {title:'Recover transitions, then check them',body:'A change between two estimated levels becomes a channel 1; no change becomes a 0. The known track row checks those estimates. A real disc still needs modulation decoding and error correction before its original files, sound or pictures can be recovered.'},
  ],
  tryIt:[
    experiment('Follow the complete light path','Press Play with a clear return path and no added noise. Watch the gold return reach the detector and the board fill with bits.','A connected route from light to photocurrent to recovered channel bits.'),
    experiment('See current become samples','Press Play in the signal view. Each step acquires one sample. Compare the current trace, sampled voltage and recovered row.','The first estimates appear after two look-ahead samples. The clean result matches all 26 reference cells.',{},'signal'),
    experiment('Read a different track','Read Track B with the same clean receiver.','The changed pit/land pattern produces a different 28-bit channel sequence.',{pattern:1},'signal'),
    experiment('Use neighboring samples','Read Track B with moderate noise and sequence detection.','This fixed noisy example still recovers all 28 channel bits. The result depends on the samples, not the reference row.',{pattern:1,noise:1},'signal'),
    experiment('Try one-sample decisions','Read the same Track B and the same noise using the one-sample slicer.','Two channel bits differ from the known track. Looking at a sequence helped in the preceding experiment.',{pattern:1,noise:1,decoder:1},'signal'),
    experiment('Reduce light, keep the noise','Read Track B at 20% light with the same moderate receiver noise.','The photocurrent swing shrinks while noise stays fixed. Ten channel bits differ in this particular example.',{pattern:1,power:20,noise:1},'signal'),
    experiment('Block only the return','Press Play with the shutter inserted between splitter and detector.','The disc still receives violet light. Gold return reaches the shutter; photocurrent and recovered bits disappear.',{blocked:1}),
    experiment('Turn off the light','Press Play with read-light level at 0%.','No outgoing beam, no returned light and no channel estimates.',{power:0}),
    experiment('Overwhelm the receiver','Read Track A with strong added noise and sequence detection.','Eight channel bits differ in this fixed example. A best-fitting sequence is not guaranteed to be correct.',{noise:2},'signal'),
  ],
  parts:[
    {name:'Laser and collimator',role:'Send a shaped beam toward the objective.'},
    {name:'Polarizing beam splitter',role:'Route outgoing and returning polarizations along different branches.'},
    {name:'Quarter-wave plate',role:'Change polarization on the round trip so the return can reach the detector.'},
    {name:'Fold mirror and objective',role:'Turn and focus the beam onto the data layer.'},
    {name:'Reflective track',role:'Carry a sequence of pits and lands whose optical response changes as they pass the focus.'},
    {name:'Segmented photodiode',role:'Convert absorbed optical power to current. Summed currents provide the data signal.'},
    {name:'Amplifier and sampler',role:'Produce voltage samples from photocurrent, with the selected test noise added.'},
    {name:'Sequence detector',role:'Infer track levels from received samples; transitions then give channel bits.'},
  ],
  deeper:[
    {title:'Why neighboring samples matter',body:'A small feature affects several samples because an optical receiver has a limited response bandwidth. The teaching response is y[n] = (a[n] + 2a[n−1] + a[n−2])/4 for binary track levels a. This assigned three-cell response is not the Blu-ray optical transfer function. A four-state Viterbi calculation finds the path with the smallest sum of squared sample errors. The alternate slicer uses the midpoint of one delayed sample.'},
    {title:'What the detector measures',body:'Photocurrent follows I = RP in the linear model. The assigned responsivity is 0.20 A/W; the full-light collected power spans 10–30 μW, giving 2–6 μA before added noise. A 100 kΩ transimpedance gives 0.2–0.6 V. These are illustrative receiver values, not measurements of a specific pickup. Equal detector-area currents represent a centered spot, not simulated focus or tracking servos.'},
    {title:'Channel bits are not file bits',body:'Ordinary Blu-ray 17PP runs last 2–8 channel cells. These two short patterns fit those local run-length limits, but do not implement the complete 17PP code, synchronization, addressing or payload format. After channel detection, an actual player removes modulation coding, corrects errors and interprets content. The result shown here stops at the recovered channel stream.'},
    {title:'Where this model begins to approximate',body:'The pickup layout shows the light route, but the receiver response is supplied as a test model. High-numerical-aperture Blu-ray diffraction cannot be replaced by a two-ray cancellation rule or by declaring pits dark. The lesson makes no claim about actual pit depth, optical contrast, focus tolerance or real disc readability.'},
  ],
  misconception:'A pit is not automatically a 1 or a 0, and it does not absorb all the light. The receiver measures a changing signal. In the recovered channel stream, 1 means a transition and 0 means no transition.',
  quiz:{question:'Two successive estimated track levels are the same. What channel bit is recovered?',options:['1, because light is still coming back.','0, because no level transition occurred.','A movie pixel, because every pit stores a pixel.'],answer:1,explanation:'A channel 0 marks no transition. Those channel bits still need further decoding before they become the original content.'},
  limits:'Enlarged optical-pickup cutaway with exaggerated relief and schematic moving-light markers. One 405 nm Blu-ray context; no optical diffraction, automatic focus/tracking, clock acquisition or calibrated read-error prediction. The collected-power waveform uses an assigned PR(1,2,1)/4 response, not a diffraction calculation. No adaptive equalizer is simulated. Optical power, responsivity and amplifier gain are illustrative. Clock, gain, offset and initial land level are known. Gaussian test noise is repeatable and added in the electronics, not inferred from the disc. Four-state sequence detection and transition decoding run on received samples; estimates can change as more samples arrive. Two trailing land samples provide look-ahead. No complete 17PP modulation decoding, error-correcting code or media payload is modeled.',
  sources:[
    {title:'Blu-ray Disc Association: BD-ROM physical format white paper',url:'https://blog.ligos.net/images/The-Reliability-Of-Optical-Disks/BD-ROM_physical_format_specifications-18327.pdf'},
    {title:'Hamamatsu: Silicon photodiode principles and amplifier circuits',url:'https://www.hamamatsu.com/content/dam/hamamatsu-photonics/sites/documents/99_SALES_LIBRARY/ssd/si_pd_kspd9001e.pdf'},
    {title:'Thorlabs: Quarter-wave plate operating principles',url:'https://www.thorlabs.com/mounted-zero-order-quarter-wave-plates?tabName=Tutorial'},
  ],
};
