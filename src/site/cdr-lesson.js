const experiment = (title, instruction, observe, part, settings = {}, time = 0) => {
  const values = { high: 10, low: 5, medium: 0, power: 0, readLight: 1, ...settings };
  return { title, instruction, observe, values, reset: true, part, isolate: true, cutaway: true, view: 'front', initialState: { settings: { ...values }, time } };
};

export const cdrLesson = {
  simple: 'How can a recordable disc store new bits and later return them?',
  overview: 'A CD-R stores new information by permanently changing a thin dye layer. Choose eight bits, then press Play: the computer codes them, the writer forms marks, and a later read returns the stored byte to the screen. Low reading light cannot write. An already recorded region keeps its old information. Reset, replay and changed controls prepare another experiment with the chosen starting region.',
  steps: [
    { title: 'Choose the byte', body: 'Two four-bit controls choose any eight-bit pattern. The computer places this byte in a data sector and adds the coding needed to record and check it.' },
    { title: 'Change the dye', body: 'The pickup follows a preformed groove. Matched recording exposure changes dye into permanent marks of different lengths; reading light alone does not.' },
    { title: 'Read the same region', body: 'The pickup returns with low-power light. Marked and unmarked regions return different optical signals, letting the reader recover transitions without changing the dye.' },
    { title: 'Check what came back', body: 'The decoder restores the byte and checks the complete sector. The lower row shows the recovered pattern, or stays unavailable if no valid recording can be read.' },
  ],
  parts: [
    { name: 'Complete writer and computer', role: 'Follow your byte through the connected recording and reading path.' },
    { name: 'Recordable disc and clamp', role: 'Hold a disc whose dye can be changed permanently.' },
    { name: 'Recording laser and collimator', role: 'Supply recording exposure or much lower reading light.' },
    { name: 'Sliding optical pickup', role: 'Follow the groove and return to the same recorded region.' },
    { name: 'Watch the dye change', role: 'See actual encoded marks form, persist and supply later transitions.' },
    { name: 'Encoder, decoder and connections', role: 'Convert the input to a coded pattern and check the retrieved sector.' },
    { name: 'Requested byte and readback monitor', role: 'Compare the chosen bits with the bits recovered from stored marks.' },
  ],
  tryIt: [
    experiment('Write it, then read it', 'Press Play with the complete writer and computer in view.', 'The requested 10100101 becomes permanent dye marks. After the pickup returns and reads the sector, the lower row shows the same checked byte.', 'player'),
    experiment('Write eight zeros', 'Press Play with both input halves set to 0000.', 'Readback is 00000000, but the disc still contains many marks: framing, parity, scrambling and EFM encode more than the eight input bits.', 'readback', { high: 0, low: 0 }),
    experiment('Write eight ones', 'Press Play with both input halves set to 1111.', 'Readback is 11111111. The coded marks still have varied lengths; eight input ones do not make one solid dark stripe.', 'readback', { high: 15, low: 15 }),
    experiment('Watch marks form', 'Press Play or Step from the start of the magnified track patch.', 'Each completed dark run remains behind the recording spot. The gold underline identifies the actual 14-cell word carrying the selected byte.', 'track', {}, 1),
    experiment('Reading keeps the marks', 'Press Play from the end of the writing pass.', 'Marks persist while the pickup returns. Reading adds received-transition dots but does not alter the dye pattern.', 'track', {}, 5),
    experiment('Can reading light write?', 'Press Play with only reading light during the writing pass.', 'The blank region stays blank. The final read finds no valid sector and reports the byte unavailable.', 'track', { power: 1 }),
    experiment('Turn off writing light', 'Press Play with the writing laser off.', 'No recording beam reaches the dye during writing. Later reading light finds no recorded byte.', 'optics', { power: 2 }),
    experiment('Store it without reading it', 'Press Play with readback light off.', 'Recording still forms permanent marks. The dark read cannot recover a byte, and those marks remain visible.', 'readback', { readLight: 0 }),
    experiment('Try to replace an old byte', 'Press Play while requesting 10101010 from a region already storing 01010101.', 'The writer blocks replacement. Low-power reading returns the original 01010101, not the newly requested pattern.', 'readback', { high: 10, low: 10, medium: 1 }),
    experiment('Read the opposite old byte', 'Press Play while requesting 01010101 from a region already storing 10101010.', 'The previous 10101010 comes back. Which byte is returned depends on the stored medium, not the input controls.', 'readback', { high: 5, low: 5, medium: 2 }),
    experiment('Follow the actual byte', 'Press Play with the coding view open.', 'The selected byte is scrambled, interleaved and represented by its actual 14-cell EFM word. Readback reverses the codes; the user byte waits for complete sector checks.', 'codec', {}, 1),
    experiment('Compare pulse and mark', 'Press Play or Step through the magnified recording patch.', 'The 4× reference pulses start later than their nominal marks. The diagram reports pulse width and relative height without pretending one power works for every disc.', 'pulses', {}, 1),
    experiment('Look through the layers', 'Press Play with the layer cutaway open.', 'Light passes through clear plastic to dye beside the reflector. Changed dye remains after recording; later reading does not erase it.', 'layers', {}, 1),
    experiment('A guide before recording', 'Press Play and follow the marker along the preformed groove.', 'The guide exists even on a blank disc. Its wobble helps a real drive control speed and locate recording positions; the shown groove is greatly enlarged.', 'pregroove'),
    experiment('One path, two light levels', 'Press Play with the optical route open.', 'Recording exposures change the dye. After returning, low-power light follows the same pickup route and sends the stored signal toward the detector.', 'optics'),
  ],
  deeper: [
    { title: 'Write-once does not mean every region is already full', body: 'CD-R recording changes organic dye permanently. A drive cannot erase an occupied region and replace its bytes. Unused regions may still accept additional recording when the recording format and session state allow it. CD-RW is different: it uses a phase-change recording material that supports rewriting.' },
    { title: 'The groove exists before the data', body: 'A manufacturer molds a spiral pregroove into the substrate before applying the dye and reflective layers. Its wobble provides a speed reference and carries absolute-time information, called ATIP. Blank dye therefore does not mean a featureless or unformatted piece of plastic.' },
    { title: 'A mark is not an input one', body: 'This example places the chosen byte first in a Mode 1 sector with 2,047 zero padding bytes. Sector overhead, scrambling, CIRC and EFM turn those bytes into constrained runs. A channel one marks a transition between recorded and unrecorded regions. Decoding reverses that chain before returning the chosen byte.' },
    { title: 'Good writing requires calibration', body: 'Dye, speed, laser wavelength and the drive optics affect the exposure that forms readable marks. Real drives use power calibration. The separate 4× reference diagram shows a specified test pulse, including a half-cell start delay and an extra sixteenth-cell delay after a 3T land. Its relative heights are not universal drive settings.' },
    { title: 'Reading uses light without rewriting', body: 'Recorded marks modify the light returned through the objective. Both regions can reflect; the model does not claim that dark material absorbs every photon. The physical pickup produces an analog signal. Here, ideal transition detection is the boundary between that optical process and the actual digital decoder.' },
  ],
  misconception: 'A CD-R does not burn one pit for each input one. Recording changes dye into a coded pattern of marks. Reading light can retrieve those marks, but it cannot undo them or turn a blank region into a recording.',
  limits: [
    'This is one guarded Mode 1 sector excerpt: one selected user byte and 2,047 zero padding bytes, plus real sector and channel coding. The 111 CIRC tail frames are finite decoding guards, not added user capacity.',
    'It is not a complete recorded disc image. Lead-in, lead-out, table of contents, session management, ATIP decoding and physical recording metadata are outside the example.',
    'Matched recording exposure commits each completed ideal mark. Dye chemistry, heat flow, mark-shape growth, power calibration, wear and analog optical response are not solved numerically. The 4× pulse view is a stated media-test reference, not a measured recording strategy for a particular drive.',
    'Transition detection is ideal. The receiver performs EFM, CIRC, descrambling and sector validation using only stored marks. No source byte replaces failed or dark readback.',
    'The drive layout is illustrative. Disc dimensions and reference speeds are stated; tracking uses a thin-spiral approximation. Focus and tracking servos are not simulated. Groove wobble, layers and beam widths are enlarged for teaching.',
    'Each on-screen pass spends one second before the selected 40-cell patch, three seconds crossing it and one second finishing the channel. The one-second return is illustrative. Actual channel time is reported separately.',
    'Reset, replay and changed controls prepare a new comparison with the selected starting medium. These controls do not imply that existing CD-R marks can be erased.',
  ].join(' '),
  sources: [
    { title: 'ECMA-394 (2010): recordable compact disc systems, material states and reference write strategies', url: 'https://ecma-international.org/wp-content/uploads/ECMA-394_1st_edition_december_2010.pdf' },
    { title: 'NIST and CLIR (2003): Care and Handling of CDs and DVDs, recordable and rewritable layers', url: 'https://www.clir.org/wp-content/uploads/sites/6/pub121.pdf' },
    { title: 'ECMA-130 (1996): CD-ROM sectors, EFM and CIRC', url: 'https://ecma-international.org/wp-content/uploads/ECMA-130_2nd_edition_june_1996.pdf' },
  ],
  quiz: {
    question: 'A region already stores 01010101. You request 10101010 on this CD-R. What should happen?',
    options: ['Replacement is blocked; reading returns the original 01010101.', 'Reading light erases the old byte and writes the new one.', 'The computer should display the requested new byte even though it was never stored.'],
    answer: 0,
    explanation: 'The changed dye cannot be erased for reuse. The reader returns the actual previous recording. Unused disc space could still accept other recording when the format allows it.',
  },
};
