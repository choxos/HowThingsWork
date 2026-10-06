const experiment = (title, instruction, observe, part, settings = {}, time = 0) => {
  const values = { content: 0, radius: 24, loss: 0, laser: 1, format: 1, depth: 0, ...settings };
  return { title, instruction, observe, values, reset: true, part, isolate: true, cutaway: true, view: 'front', initialState: { settings: { ...values }, time } };
};

export const dvdLesson = {
  simple: 'How can tiny marks on a DVD become a moving picture?',
  overview: 'A red laser follows the DVD’s spiral track. Changes in the reflected signal lead to channel transitions, then bytes. Parity can repair some missing bytes; sector checks reject data that still cannot be trusted. The recovered compressed bytes finally become pictures on the connected screen. Change the stored clip or block some reads to see that whole chain work.',
  steps: [
    { title: 'Follow the spiral', body: 'The spindle turns while a rail-mounted pickup moves outward. At the 3.49 m/s reference track speed, the inner track needs more revolutions per minute than the outer track.' },
    { title: 'Recover the bytes', body: 'A channel one means a change of pit or land level. EFMplus converts sixteen channel cells into an eight-bit byte; it sometimes needs the next word to distinguish the answer.' },
    { title: 'Repair, then check', body: 'Sixteen sectors share a grid of parity bytes. Rows and columns can repair known erasures. The sector ID and error-detection check decide which 2,048-byte payloads reach the video buffer.' },
    { title: 'Decode a moving picture', body: 'The buffer supplies actual MPEG-2 bytes. This short teaching movie uses fifty independent, flat-block pictures at 25 frames per second. A missing picture is shown as unavailable.' },
  ],
  parts: [
    { name: 'Complete disc player', role: 'Follow the connected drive, decoder board and video display.' },
    { name: 'Spindle motor and hub', role: 'Support and turn the disc at the required speed.' },
    { name: 'Rails and carriage drive', role: 'Move the optical pickup along the spiral.' },
    { name: 'Sliding optical pickup', role: 'Send light to the reflective pattern and collect the return.' },
    { name: 'Channel words into bytes', role: 'Reverse EFMplus using the received words and their neighbors.' },
    { name: 'PI and PO repair', role: 'Recover known erasures or leave them explicitly unavailable.' },
    { name: 'Inside a DVD sector', role: 'Check the sector address and its descrambled payload.' },
    { name: 'Decoder board and connections', role: 'Feed checked compressed bytes through the buffer and video decoder.' },
    { name: 'Recovered video display', role: 'Show pictures reconstructed from retrieved data.' },
    { name: 'Compare optical formats', role: 'Compare CD, DVD and Blu-ray reference features.' },
  ],
  tryIt: [
    experiment('From disc to moving picture', 'Press Play with the complete player in view.', 'The first transitions slow down for inspection. The excerpt is then retrieved, checked and shown as a two-second bouncing-ball movie.', 'player'),
    experiment('The spot and the track', 'Press Play, or step through individual cells.', 'The actual DVD pattern moves beneath a 1.32 µm spot-size reference. Track pitch is 0.74 µm, and ordinary marks span 3 to 11 channel cells.', 'track'),
    experiment('Read the pits into bytes', 'Press Play and watch the received word appear.', 'Sixteen channel cells recover a byte using EFMplus and lookahead. This is a digital readout; a toy blur is not used to claim a measured detector contrast.', 'codec'),
    experiment('Just too fine?', 'Compare the highlighted DVD features with CD and Blu-ray.', 'A hypothetical 2T DVD run is below its allowed 3T data-run minimum. The optical spot circle alone cannot prove that a pattern would be invisible.', 'comparison'),
    experiment('Thinner plastic, a wider cone', 'Compare the DVD layer with CD using Optical comparison.', 'The DVD reads through 0.6 mm of plastic. Its half-angle is 36.9° in air and about 22.6° in reference plastic, so the air angle must not be labeled as the angle inside the disc.', 'layers'),
    experiment('Spin at the rim', 'Press Play at the prepared outer position.', 'At about 58 mm the spindle turns about 575 rpm, compared with about 1,389 rpm at 24 mm. The same track speed is maintained while the pickup advances outward.', 'spin', { radius: 58 }),
    experiment('How much it holds', 'Follow the calculation from spiral length to user bytes.', 'A geometric estimate gives about 11.84 km of track and 4.70 decimal GB after sector overhead. Spinning faster cannot add more recorded sectors.', 'capacity'),
    experiment('A different stored movie', 'Press Play with the rocket’s bytes already retrieved.', 'The screen plays a rocket flight reconstructed from a different compressed byte stream and disc pattern.', 'video', { content: 1 }, 6),
    experiment('Decode the sunrise', 'Press Play with the sunrise’s bytes already retrieved.', 'Fifty independent pictures show the sun rising. The output still comes from sectors read through the same DVD coding chain.', 'video', { content: 2 }, 6),
    experiment('Repair one row', 'Press Play and watch red cells become green.', 'Eight selected words are unreadable. A possible extra lookahead erasure still fits within ten known erasures per inner-parity row; all fifty pictures are recovered.', 'errors', { loss: 1 }),
    experiment('Use the outer parity', 'Press Play with the wider loss already selected.', 'The damaged rows exceed the inner limit, but each affected column fits within the sixteen-erasure outer limit. Outer parity recovers all fifty pictures.', 'errors', { loss: 2 }),
    experiment('Beyond both repair limits', 'The prepared frame is unavailable. Step once to inspect the next frame.', 'A rectangle spanning seventeen rows exceeds both limits. Failed sectors leave a visible gap; the next independent picture can return without inventing the missing one.', 'video', { loss: 3 }, 7),
    experiment('Turn off the read laser', 'Press Play with the laser already off.', 'The spindle still turns, but no optical signal, recovered sectors or movie reaches the screen.', 'optics', { laser: 0 }),
    experiment('Open one sector', 'Press Play until the example sector is checked.', 'ID parity protects its address, and EDC checks the complete descrambled frame. The payload is admitted to the video decoder only after those checks pass.', 'sectors'),
    experiment('A separate wave experiment', 'Change Separate wave-depth example and watch the waves add.', 'Changing optical height changes the relative phase of two equal waves. This illustrates interference without claiming a real disc’s detector contrast or altering the DVD movie.', 'phase'),
  ],
  deeper: [
    { title: 'Smaller features and different overhead', body: 'The DVD reference uses 650 nm light and numerical aperture 0.60, compared with 780 nm and 0.45 for CD. Its 0.74 µm pitch and roughly 133.4 nm channel cells pack more track information into an area. A physical sector uses 38,688 channel cells for 2,048 user bytes, a useful-data fraction of about 42.35%.' },
    { title: 'Why a word can need its neighbor', body: 'EFMplus has four states and alternative words chosen to control the digital sum. Some words are ambiguous by themselves. The next word’s pattern distinguishes the possible states, so losing one word can also obscure its predecessor.' },
    { title: 'Two directions of protection', body: 'Sixteen scrambled data frames occupy 192 rows of 172 bytes. Sixteen outer-parity rows and ten inner-parity columns make a 208 by 182 grid. One outer-parity row is then placed after each group of twelve data rows. Known erasures are a limited failure model; unknown-error correction is not implemented here.' },
    { title: 'Video is another decoding step', body: 'Sector recovery does not itself make pixels. The MPEG-2 parser reads sequence, picture and slice headers, decodes differential DC values, and reconstructs flat 8 by 8 blocks. Four luma blocks and two chroma blocks form each 4:2:0 macroblock. The 720 by 576 samples are displayed at a 4:3 aspect ratio.' },
    { title: 'Reading and showing have different clocks', body: 'The short excerpt is read into a buffer before its two-second movie begins. The first 64 channel cells take four on-screen seconds; the remaining read takes two. The spindle follows the corresponding actual channel time. Movie playback then uses its original 25 frames per second.' },
  ],
  misconception: 'Pits are not holes that return no light, and channel ones are not already video-pixel bits. Both pits and lands reflect; several decoding and checking stages stand between the track and the screen.',
  limits: [
    'This is a finite, single-sided, single-layer DVD data-zone excerpt carrying an MPEG-2 elementary video stream. It is not a complete DVD-Video filesystem, VOB/menu system or certified authored disc image.',
    'The MPEG-2 implementation supports this declared flat-block, progressive I-picture subset only. It has no P/B motion prediction, general movie decoding or audio.',
    'Ideal transition detection is the boundary of the optical model. Analog HF voltage, diffraction readout, PLL noise and focus/tracking control loops are not simulated. A scalar Airy reference is especially limited at Blu-ray’s high aperture.',
    'Injected unreadable words are known erasures, not measured scratches. PI/PO parity, ID parity and EDC operate on actual bytes; unrecoverable sectors and pictures stay unavailable.',
    'The connected mechanism is an illustrative player layout. Disc dimensions and reference rates follow the stated format; spindle radius uses a thin-spiral approximation, and enlarged inspection diagrams state their scales.',
    'The format and depth controls affect separate comparison diagrams. Plastic half-angles use stated reference refractive indices; equal-wave intensity is not a prediction of detector contrast or an optical read/no-read test.',
  ].join(' '),
  sources: [
    { title: 'ECMA-267: 120 mm read-only optical discs, third edition', url: 'https://ecma-international.org/publications-and-standards/standards/ecma-267/' },
    { title: 'ITU-T H.262 (2000): MPEG-2 video syntax and decoding', url: 'https://www.itu.int/rec/T-REC-H.262-200002-S/en' },
    { title: 'ECMA-130: CD-ROM reference optics and track geometry', url: 'https://ecma-international.org/publications-and-standards/standards/ecma-130/' },
    { title: 'Blu-ray Disc Association: BD-ROM physical format white paper (2010, archived copy)', url: 'https://blog.ligos.net/images/The-Reliability-Of-Optical-Disks/BD-ROM_physical_format_specifications-18327.pdf' },
  ],
  quiz: {
    question: 'A sector still fails its check after parity repair. What should this player do with its movie data?',
    options: ['Keep it unavailable and show a missing picture where needed.', 'Show the intended picture from a separate copy.', 'Spin faster to invent the missing bytes.'],
    answer: 0,
    explanation: 'The picture must come from recovered compressed bytes. If a sector remains invalid, the affected independent picture stays unavailable; a later intact picture can still be decoded.',
  },
};
