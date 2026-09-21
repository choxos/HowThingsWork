import {READ_DEFAULTS} from './optical-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  ecma130: {title: 'Ecma International: ECMA-130, Data interchange on read-only 120 mm optical data disks (CD-ROM)', url: 'https://www.ecma-international.org/publications-and-standards/standards/ecma-130/'},
  ecma267: {title: 'Ecma International: ECMA-267, 120 mm DVD, read-only disk', url: 'https://www.ecma-international.org/publications-and-standards/standards/ecma-267/'},
  compactDisc: {title: 'Wikipedia: Compact disc', url: 'https://en.wikipedia.org/wiki/Compact_disc'},
  audio: {title: 'Wikipedia: Compact Disc Digital Audio', url: 'https://en.wikipedia.org/wiki/Compact_Disc_Digital_Audio'},
  cdRom: {title: 'Wikipedia: CD-ROM', url: 'https://en.wikipedia.org/wiki/CD-ROM'},
  efm: {title: 'Wikipedia: Eight-to-fourteen modulation', url: 'https://en.wikipedia.org/wiki/Eight-to-fourteen_modulation'},
  circ: {title: 'Wikipedia: Cross-interleaved Reed-Solomon coding', url: 'https://en.wikipedia.org/wiki/Cross-interleaved_Reed%E2%80%93Solomon_coding'},
  clv: {title: 'Wikipedia: Constant linear velocity', url: 'https://en.wikipedia.org/wiki/Constant_linear_velocity'},
  dvd: {title: 'Wikipedia: DVD', url: 'https://en.wikipedia.org/wiki/DVD'},
  bluRay: {title: 'Wikipedia: Blu-ray', url: 'https://en.wikipedia.org/wiki/Blu-ray'},
  bluRayJapanese: {title: 'Wikipedia, in Japanese: Blu-ray Disc', url: 'https://ja.wikipedia.org/wiki/Blu-ray_Disc'},
  bluRayGerman: {title: 'Wikipedia, in German: Blu-ray Disc', url: 'https://de.wikipedia.org/wiki/Blu-ray_Disc'},
  drive: {title: 'Wikipedia: Optical disc drive', url: 'https://en.wikipedia.org/wiki/Optical_disc_drive'},
  disc: {title: 'Wikipedia: Optical disc', url: 'https://en.wikipedia.org/wiki/Optical_disc'},
  laser: {title: 'Wikipedia: Laser diode', url: 'https://en.wikipedia.org/wiki/Laser_diode'},
  aperture: {title: 'Wikipedia: Numerical aperture', url: 'https://en.wikipedia.org/wiki/Numerical_aperture'},
  airy: {title: 'Wikipedia: Airy disk', url: 'https://en.wikipedia.org/wiki/Airy_disk'},
  limit: {title: 'Wikipedia: Diffraction-limited system', url: 'https://en.wikipedia.org/wiki/Diffraction-limited_system'},
};

/** What every lesson on this model leaves out or takes without a source. */
export const readoutLimits = 'The light sent back is illustrative: the pits blurred along the track by the lens, dimmed at most as far as two equal halves of the light, one off a pit and one off the land, cancel. Real pits are narrower than the spot and dim the light only partly, which is why the CD-ROM standard asks only that the longest runs swing the light by 60% of its top level; the pits’ width and the neighboring tracks are left out, and the setting of a sixth of a wavelength comes nearest a real disc. Pits are drawn 5/16 of a pitch wide, the CD’s 500 nm, and the runs around the ladder are drawn at random within each code’s limits. Not from a source: a Blu-ray Disc’s data radii and plastic, taken as a DVD’s 24 to 58 mm and a refractive index of 1.55, and its 1-7PP code read as runs of 2 to 8 channel bits. Focusing and tracking, the laser’s power and the decoding after the channel bits are left out.';

export const bluRayLimits = `A CD, a DVD and a Blu-ray Disc each read at its base speed, a CD at 1.2 m/s, the slowest scanning speed its standard allows. The disc and its rails are drawn at true size; the sled and its lens are illustrative. The track passes the spot at 10 channel bits a second and the disc drawn turns 100 times slower than a disc does. ${readoutLimits}`;

// ---------------------------------------------------------------------------
// Blu-ray player.
// ---------------------------------------------------------------------------

const playTrack = trial(READ_DEFAULTS, 'track'), playSignal = trial(READ_DEFAULTS, 'signal'), playSpin = trial(READ_DEFAULTS, 'spin');

export const bluRayLesson = {
  simple: 'How does a Blu-ray player read a disc with light?',
  overview: 'A Blu-ray player spins a disc over a laser. A lens focuses the laser through the disc’s clear plastic to a spot on a spiral track of pits, and a photodetector measures how much light comes back. Light off a pit comes back out of step with light off the land around it and partly cancels, so every edge of a pit shows as a change in the light. Choose a CD, a DVD or a Blu-ray Disc, move the pickup, change how deep the pits are, and press Play to read a ladder of every pit length.',
  steps: [
    {title: 'Spin the disc', body: 'A motor turns the disc faster when the pickup reads near the middle, so the track always passes the spot at the same speed.'},
    {title: 'Focus the laser', body: 'The objective lens focuses the laser through the disc’s clear plastic to a spot on the track.'},
    {title: 'Dim at the pits', body: 'Light off a pit comes back out of step with light off the land around it, and the two partly cancel.'},
    {title: 'Read the edges', body: 'A photodetector turns the light into a signal. Every change from pit to land or land to pit reads as a one, and the lengths of the runs between them carry the data.'},
    {title: 'Follow the track', body: 'Servos keep the spot focused and on the track, and move the pickup outward along the spiral.'},
  ],
  parts: [
    {name: 'Disc, spindle and sled', role: 'The disc turning over the sled that carries the lens along its radius.'},
    {name: 'Laser pickup, opened out', role: 'The laser, lenses and beam splitter that send light to the disc and the returning light to a photodetector.'},
    {name: 'Spot on the track, close up', role: 'The focused spot over the pits and the tracks around it.'},
    {name: 'Light sent back', role: 'How much light returns as the spot reads a ladder of every pit length.'},
    {name: 'A pit, cut open', role: 'Why light off a pit cancels light off the land.'},
    {name: 'Spin speed across the disc', role: 'How fast the disc turns at each read position.'},
  ],
  tryIt: [
    playTrack('Read the track', 'Press Play and watch the spot on the track.', 'The violet spot is 581 nm across and the tracks lie 320 nm apart, so the spot covers the track it reads and spills onto its neighbors. The pits run from 149 nm to 596 nm long. The Blu-ray page gives the spot as 580 nm and the shortest pits as 150 nm.'),
    playSignal('Short pits dim the light least', 'Press Play and watch the light sent back.', 'The shortest pits dim the light only to 46%, because pits and lands that short repeat every 298 nm, close to the finest pattern the lens sends back, 238 nm. The longest pits dim it to 8%.'),
    playTrack('A CD', 'Choose a CD and press Play.', 'A CD’s near-infrared spot is 2.11 μm across, over tracks 1.6 μm apart, and its pits run from 833 nm to 3.05 μm long.', {format: 0}),
    playTrack('A DVD', 'Choose a DVD and press Play.', 'A DVD’s red spot is 1.32 μm across, over tracks 0.74 μm apart, and its pits run from 400 nm to 1.47 μm long.', {format: 1}),
    playSpin('Out at the rim', 'Set the read position to 58 mm.', 'Out at 58 mm the disc turns 810 rpm, against 1,878 rpm at 25 mm, so the track still passes the spot at 4.917 m/s. The Blu-ray page lists 810 rpm for a drive at its base speed.', {radius: 58}),
    playSignal('A pit half a wavelength deep', 'Set the pit depth to half a wavelength and press Play.', 'Light off the pits now comes back a whole wavelength behind the light off the land, in step with it, so the light never dims and there is nothing to read.', {depth: 3}),
    playSignal('A pit a sixth of a wavelength deep', 'Set the pit depth to a sixth of a wavelength and press Play.', 'Pits 43.5 nm deep send their light back a third of a wavelength out of step, so even the longest pits dim the light only to 31%. Real pits lie between a quarter and a sixth of the wavelength deep.', {depth: 1}),
  ],
  deeper: [
    {title: 'Why the spot must be small', body: 'A lens cannot focus light to a point. The smallest spot it makes is an Airy pattern whose bright middle is 1.22 λ/NA across to its first dark ring, where λ is the wavelength and NA the numerical aperture. Blu-ray made the spot smaller both ways: violet light of 405 nm instead of a DVD’s 650 nm, and a lens of 0.85 instead of 0.60. Its spot is 581 nm across, which the Blu-ray page gives as 580 nm. The German Blu-ray page gives the same figure as the spot’s diameter: 2.1 μm for a CD, 1.3 μm for a DVD and 0.6 μm for a Blu-ray Disc.'},
    {title: 'The finest pattern the lens sends back', body: 'A pattern of pits and lands repeating finer than λ/(2NA) sends no change in light back at all, because the lens’s transfer function falls to zero there: 238 nm for a Blu-ray Disc. Its shortest pits and lands, 149 nm each, repeat every 298 nm and swing the light by only 13% of what a long pit does. A DVD’s shortest repeat every 801 nm against its 542 nm, and a CD’s every 1.67 μm against 867 nm.'},
    {title: 'Constant linear velocity', body: 'A disc read at a steady rate must pass its track at a steady speed, so it turns 60 v / (2π r) times a minute, faster near the middle. A Blu-ray Disc read at its base speed turns 1,956 rpm at 24 mm, where a DVD’s data starts, and 810 rpm at 58 mm. The track spirals outward from the middle, so a disc played from start to end slows down.'},
    {title: 'Light that cancels', body: 'Seen from the laser, a pit is a bump. Light off the top of a bump travels less far than light off the land around it, by twice the bump’s height, in plastic where the light’s wavelength is its wavelength in air over the refractive index, 1.55. A bump a quarter of that wavelength high sends its light back half a wavelength out of step, and where half the light comes off the bump and half off the land, the two cancel. At half a wavelength high the two come back a whole wavelength apart, in step, and the pit cannot be seen.'},
    {title: 'How much a disc holds', body: 'The spiral is as long as the area it covers over its pitch. If a Blu-ray Disc’s data runs from 24 mm to 58 mm, as a DVD’s does, its 320 nm pitch makes 27.37 km of track: 367 billion channel bits of 74.5 nm. It is read at 66 million channel bits a second to give 36 million bits of data, so its track holds 25.05 GB, the Blu-ray page’s 25 GB.'},
    {title: 'Two slowed clocks', body: 'Nothing on a disc can be watched at its real speed. The close up passes the track at 10 channel bits a second; a Blu-ray Disc is really read at 66 million a second, 6,600,000 times as fast, so the ladder read here really passes in 1.06 μs. The disc drawn turns 100 times slower than a disc does.'},
  ],
  misconception: 'The laser does not read pits as ones and land as zeros. A one is an edge, where pit turns to land or land to pit, and the lengths of the runs between the edges carry the data.',
  limits: bluRayLimits,
  sources: [sources.bluRay, sources.bluRayJapanese, sources.bluRayGerman, sources.dvd, sources.compactDisc, sources.ecma130, sources.ecma267, sources.drive, sources.disc, sources.airy, sources.aperture, sources.limit, sources.clv, sources.efm],
  quiz: {
    question: 'Why does a Blu-ray Disc hold more than a DVD?',
    options: ['Its violet light and wider lens focus a smaller spot, so its tracks and pits can be packed closer.', 'It spins faster, so more data fits on each turn.', 'Its pits are deeper, so each one holds more data.'],
    answer: 0,
    explanation: 'The spot is 1.22 λ/NA across: 581 nm for a Blu-ray Disc against 1.32 μm for a DVD, so its tracks lie 320 nm apart instead of 740 nm.',
  },
};

// ---------------------------------------------------------------------------
// CD.
// ---------------------------------------------------------------------------

const CD_DEFAULTS = {...READ_DEFAULTS, format: 0};
const cdTrack = trial(CD_DEFAULTS, 'track'), cdSignal = trial(CD_DEFAULTS, 'signal'), cdSpin = trial(CD_DEFAULTS, 'spin'), cdPit = trial(CD_DEFAULTS, 'pit'), cdDisc = trial(CD_DEFAULTS, 'disc');

export const cdLimits = `A CD read at 1.2 m/s, the slowest scanning speed its standard allows, with its music from 25 mm to 58 mm. The track passes the spot at 10 channel bits a second, 432,180 times slower than a CD plays. ${readoutLimits}`;

export const cdLesson = {
  simple: 'How does a CD store music as pits?',
  overview: 'A compact disc stores sound as a spiral of pits in clear plastic, read through the plastic by a near-infrared laser. The music is measured 44,100 times a second, grouped into frames, and coded so that every pit and every land runs between 3 and 11 channel bits long. Look at the spot and the track, how fast the disc turns, how deep its pits must be, and read the light its pits send back.',
  steps: [
    {title: 'Sample the sound', body: 'The music is measured 44,100 times a second in each of 2 channels, as 16 bit numbers.'},
    {title: 'Group into frames', body: 'Every 6 stereo samples make a frame of 24 bytes. Error correction adds 8 bytes and a subcode byte makes 33.'},
    {title: 'Code the bytes', body: 'Each byte becomes 14 channel bits, with 3 merging bits between, so that ones always lie 2 to 10 zeros apart.'},
    {title: 'Cut the pits', body: 'Every one is an edge between pit and land, so pits and lands run 3 to 11 channel bits long.'},
    {title: 'Turn at a steady track speed', body: 'The disc turns to pass its track at 1.2 m/s, 4,321,800 channel bits a second.'},
  ],
  parts: [
    {name: 'Spot on the track, close up', role: 'The CD’s spot over its pits and tracks.'},
    {name: 'Light sent back', role: 'How much light returns as the spot reads every pit length.'},
    {name: 'A pit, cut open', role: 'Why a quarter wavelength deep.'},
    {name: 'Spin speed across the disc', role: 'How fast a CD turns at each read position.'},
    {name: 'Disc, spindle and sled', role: 'The disc and the sled that carries the lens.'},
  ],
  tryIt: [
    cdTrack('The spot and the track', 'Look at the track close up.', 'The spot of 780 nm light is 2.11 μm across, wider than the 1.6 μm between tracks, and the pits run from 833 nm to 3.05 μm long. The compact disc page gives them as 830 nm to 3,000 nm.'),
    cdSpin('Spin at the start', 'Look at the spin chart with the pickup at 25 mm, where the music starts.', 'The disc turns 458 rpm here to pass its track at 1.2 m/s, and out at 58 mm it slows to 198 rpm. The compact disc page gives about 500 and 200 rpm.'),
    cdSignal('Read the pits', 'Press Play and watch the light sent back.', 'The shortest pits and lands swing the light by 50% of its top level, inside the 30% to 70% the CD-ROM standard asks, and the longest by 94%, above the 60% it asks.'),
    cdPit('A quarter wavelength deep', 'Look at the pit cut open.', 'In the plastic the light’s wavelength is 503 nm, so a pit a quarter of that deep, 126 nm, sends its light back half a wavelength behind the land’s, and the average of the two returning waves is flat. The compact disc page gives the pits as about 100 nm deep in one place and 150 nm in another.'),
    cdSignal('An eighth of a wavelength', 'Set the pit depth to an eighth of a wavelength and press Play.', 'Now the longest pits swing the light by only 46% of its top level, short of the 60% the CD-ROM standard asks, and the shortest by 24%, short of its 30%.', {depth: 2}),
    cdDisc('The spiral', 'Look at the disc.', 'From 25 mm to 58 mm, 1.6 μm apart, the track turns 20,625 times and runs 5.38 km, passing in 74.7 minutes at 1.2 m/s. The compact disc page gives 5.38 km and 74 minutes.'),
  ],
  deeper: [
    {title: 'From music to channel bits', body: 'The music is 44,100 samples a second of 16 bits in each of 2 channels: 1,411,200 bits a second. Six stereo samples, 24 bytes, make a frame; error correction adds 8 bytes and the subcode 1, making 33. Each byte becomes 14 channel bits and 3 merging bits, 561 channel bits, and a sync pattern of 24 channel bits with its own 3 merging bits starts the frame: 588 channel bits. There are 7,350 frames a second, so 4,321,800 channel bits a second, the 4.3218 Mbit/s the CD-ROM standard gives.'},
    {title: 'How long a channel bit is', body: 'At 1.2 m/s a channel bit is 277.7 nm of track. Ones lie 2 to 10 zeros apart, so every pit and land is 3 to 11 channel bits long: 833 nm to 3.05 μm, which the compact disc page gives as 830 nm to 3,000 nm. Its other figure, up to 3.5 μm, is near what the longest runs reach at 1.4 m/s, the fastest scanning speed the standard allows: 3.56 μm. The standard’s highest and lowest signal frequencies, 720 kHz and 196 kHz, are the shortest and the longest runs repeating: 4,321,800 channel bits a second over 6 and over 22.'},
    {title: 'Edges are ones', body: 'A channel bit that is one is written as a change from pit to land or land to pit, and a zero as no change. Two zeros between ones make a pit or a land three channel bits long. The merging bits keep that rule across the joins between bytes, and keep pits and lands in balance, which the tracking needs.'},
    {title: 'Spin and spiral', body: 'The disc turns 458 rpm at 25 mm and 198 rpm at 58 mm to pass its track at 1.2 m/s. The compact disc page gives about 500 and 200 rpm, and the constant linear velocity page 495 to 212 rpm. The music covers 86.05 cm², and 86.05 cm² over a pitch of 1.6 μm is 5.38 km of track: 74.7 minutes at 1.2 m/s, which the compact disc page gives as 74 minutes.'},
    {title: 'Why a quarter wavelength', body: 'Near-infrared light of 780 nm has a wavelength of 503 nm in the disc’s plastic, whose refractive index is 1.55. A bump 126 nm high sends its light back half of that wavelength out of step. The compact disc page gives the pits as about 100 nm deep in one paragraph and 150 nm in another, and the optical disc drive page as a quarter to a sixth of the wavelength.'},
  ],
  misconception: 'A CD is not read from its label side. The laser reads the pits through the 1.2 mm of clear plastic on the other side, where they are bumps, and dust on that surface is far out of focus.',
  limits: cdLimits,
  sources: [sources.compactDisc, sources.audio, sources.ecma130, sources.efm, sources.clv, sources.drive, sources.disc, sources.airy, sources.limit],
  quiz: {
    question: 'Why is every pit on a CD at least three channel bits long?',
    options: ['Its code puts at least two zeros between ones, and each one is an edge between pit and land.', 'The laser needs three flashes to see a pit.', 'Shorter pits would be too deep to cut.'],
    answer: 0,
    explanation: 'A one is a change between pit and land, and two zeros between ones make a run of three: 833 nm at 1.2 m/s, repeating every 1.67 μm, well above the finest pattern the lens sends back, 867 nm.',
  },
};

// ---------------------------------------------------------------------------
// DVD.
// ---------------------------------------------------------------------------

const DVD_DEFAULTS = {...READ_DEFAULTS, format: 1};
const dvdTrack = trial(DVD_DEFAULTS, 'track'), dvdSignal = trial(DVD_DEFAULTS, 'signal'), dvdSpin = trial(DVD_DEFAULTS, 'spin'), dvdPickup = trial(DVD_DEFAULTS, 'pickup'), dvdDisc = trial(DVD_DEFAULTS, 'disc');

export const dvdLimits = `A single-layer DVD read at 3.49 m/s, its base speed, with its data from 24 mm to 58 mm. The track passes the spot at 10 channel bits a second, 2,615,625 times slower than a DVD plays. ${readoutLimits}`;

export const dvdLesson = {
  simple: 'How does a DVD hold nearly seven times as much as a CD?',
  overview: 'A DVD reads with red light of 650 nm through a lens of numerical aperture 0.60, so its spot, its track pitch and its pits are all about half a CD’s. Its data lies under only 0.6 mm of plastic, one half of a disc glued to another. Look at its spot and track, read its pits, and see how far its track runs and how much it holds.',
  steps: [
    {title: 'Redder light, a wider lens', body: 'Light of 650 nm through a lens of 0.60 focuses a spot 1.32 μm across, against a CD’s 2.11 μm.'},
    {title: 'Closer tracks, shorter pits', body: 'Tracks lie 0.74 μm apart and pits run from 400 nm to 1.47 μm long.'},
    {title: 'Thinner plastic', body: 'The wider cone of light focuses through 0.6 mm of plastic, half a CD’s 1.2 mm, so a DVD is two 0.6 mm halves glued together.'},
    {title: 'A faster track', body: 'The track passes at 3.49 m/s, 26,156,250 channel bits a second.'},
  ],
  parts: [
    {name: 'Spot on the track, close up', role: 'The DVD’s spot over its pits and tracks.'},
    {name: 'Light sent back', role: 'How much light returns as the spot reads every pit length.'},
    {name: 'Laser pickup, opened out', role: 'The cone of light and the plastic it focuses through.'},
    {name: 'Spin speed across the disc', role: 'How fast a DVD turns at each read position.'},
    {name: 'Disc, spindle and sled', role: 'The disc and the sled that carries the lens.'},
  ],
  tryIt: [
    dvdTrack('The spot and the track', 'Look at the track close up.', 'The spot of 650 nm light is 1.32 μm across, the tracks lie 0.74 μm apart and the pits run from 400 nm to 1.47 μm long. The Blu-ray page gives a DVD’s pits as 400 nm.'),
    dvdSignal('Read the pits', 'Press Play and watch the light sent back.', 'The shortest pits and lands swing the light 30% as far as the longest runs a DVD writes do, twice the 15% the DVD standard asks.'),
    dvdTrack('Just too fine', 'Look at the spot on the track.', 'Pits and lands a channel bit shorter than the shortest would repeat every 534 nm, finer than the 542 nm the lens sends back, so they would send no change in light back at all.'),
    dvdPickup('Thinner plastic, a wider cone', 'Look at the laser pickup.', 'A DVD’s lens focuses through 0.6 mm of plastic in a cone 36.9° to each side, where a CD’s goes through 1.2 mm at 26.7°.'),
    dvdSpin('Spin at the rim', 'Set the read position to 58 mm.', 'A DVD turns 575 rpm out here and 1,333 rpm at 25 mm, passing its track at 3.49 m/s. The DVD page gives 580 rpm at the outer edge, which is 57.5 mm at 3.49 m/s.', {radius: 58}),
    dvdDisc('How much it holds', 'Look at the disc.', 'From 24 mm to 58 mm, 0.74 μm apart, the track runs 11.84 km, and at a DVD’s data rate its channel bits hold 4.70 GB. The DVD page gives 4.7 GB.'),
  ],
  deeper: [
    {title: 'Eight bits as sixteen', body: 'A DVD writes each byte as 16 channel bits, with 2 to 10 zeros between ones as on a CD, so its pits and lands run 3 to 11 channel bits long, and 14 in its sync patterns. At 3.49 m/s and 26,156,250 channel bits a second a channel bit is 133.4 nm, inside the 133.3 nm the DVD standard gives with its tolerance of 1.4 nm.'},
    {title: 'A sector', body: 'A DVD sector is 26 sync frames, each a sync code of 32 channel bits and 1,456 channel bits more: 38,688 channel bits for 2,048 bytes of data. At 26,156,250 channel bits a second that is 11.08 Mbit/s of data, the rate the DVD standard gives for a DVD video player.'},
    {title: 'How much a DVD holds', body: 'From 24 mm to 58 mm, 0.74 μm apart, a DVD’s track runs 11.84 km: 88.7 billion channel bits. Of every 38,688 channel bits, 16,384 are data, so the track holds 4.70 GB, the DVD page’s 4.7 GB. The DVD page’s spin speeds at its base speed, 1,400 rpm inside and 580 rpm outside, are 1,389 rpm at 24 mm and 580 rpm at 57.5 mm.'},
    {title: 'Half a CD in every direction', body: 'A DVD packs about 4.5 times as many channel bits into each square millimeter as a CD: its tracks are 0.74 μm apart against 1.6 μm, and its channel bits 133.4 nm long against 277.7 nm. Its data is 4.7 GB against a CD-ROM’s 650 MiB, 6.89 times as much.'},
  ],
  misconception: 'A DVD does not hold more by spinning faster. It holds more because its smaller spot lets its tracks and pits lie closer together.',
  limits: dvdLimits,
  sources: [sources.dvd, sources.ecma267, sources.bluRay, sources.compactDisc, sources.cdRom, sources.airy, sources.aperture, sources.limit, sources.clv],
  quiz: {
    question: 'What lets a DVD’s tracks lie 0.74 μm apart, against a CD’s 1.6 μm?',
    options: ['A smaller spot, from red light and a wider lens.', 'A thicker disc.', 'A slower spin.'],
    answer: 0,
    explanation: 'Light of 650 nm through a lens of 0.60 makes a spot 1.32 μm across, against a CD’s 2.11 μm from 780 nm light through 0.45.',
  },
};

// ---------------------------------------------------------------------------
// CD-ROM.
// ---------------------------------------------------------------------------

const romSpin = trial(CD_DEFAULTS, 'spin'), romTrack = trial(CD_DEFAULTS, 'track'), romDisc = trial(CD_DEFAULTS, 'disc'), romSignal = trial(CD_DEFAULTS, 'signal');

export const cdRomLimits = `A CD-ROM read at 1.2 m/s with its data in the first sector mode, from 25 mm to 58 mm. The burst the error correction rebuilds takes its second code to rebuild as many missing bytes in a word as it has parity bytes, with its first code marking which are missing. The track passes the spot at 10 channel bits a second. ${readoutLimits}`;

export const cdRomLesson = {
  simple: 'How does a CD-ROM keep computer data exact?',
  overview: 'A CD-ROM is a CD whose sectors carry computer data. Of each sector’s 2,352 bytes it keeps 2,048 for data and spends the rest on finding the sector and correcting errors, on top of the error correction every CD has. See how fast its sectors pass, how long a frame of track is, and how long a scratch it survives.',
  steps: [
    {title: 'Frames', body: 'Every frame carries 24 bytes, with 8 bytes of error correction and a subcode byte.'},
    {title: 'Sectors', body: 'Ninety-eight frames make a sector of 2,352 bytes, and 75 sectors pass every second.'},
    {title: 'Data in the first mode', body: 'A sector gives 2,048 bytes of data; the rest holds a sync pattern, its address and mode, and 288 bytes to detect and correct errors.'},
    {title: 'Interleave', body: 'Error correction spreads each frame’s bytes over many frames, so a scratch damages only a little of each.'},
  ],
  parts: [
    {name: 'Spin speed across the disc', role: 'How fast the disc turns to pass 75 sectors a second.'},
    {name: 'Spot on the track, close up', role: 'The track a frame is written on.'},
    {name: 'Disc, spindle and sled', role: 'The disc and its spiral.'},
    {name: 'Light sent back', role: 'The channel bits the pickup reads.'},
  ],
  tryIt: [
    romSpin('Sectors at a steady rate', 'Look at the spin chart with the pickup at 25 mm.', 'The disc turns 458 rpm here and 198 rpm at the rim, so the track always passes at 1.2 m/s and 75 sectors pass every second: 150 KiB of data.'),
    romTrack('One frame of track', 'Press Play and watch the track.', 'A frame of 588 channel bits takes 163 μm of track, 20 times as long as the close up is wide; the ladder read here is 126 channel bits, about a fifth of a frame.'),
    romDisc('A scratch it survives', 'Look at the disc.', 'The error correction rebuilds a burst 16 frames long: 2.61 mm of track at 1.2 m/s, or 4,096 bits of its bytes. The page on the code gives 2.5 mm and 4,000 bits.'),
    romSignal('The sector', 'Press Play and watch the light sent back.', 'Of a sector’s 2,352 bytes, 2,048 carry data in the first mode, after 12 bytes of sync and 4 of header, and 288 go to detecting and correcting errors.'),
    romDisc('A whole disc', 'Look at the disc.', 'The 74 minutes the CD-ROM page gives are 333,000 sectors, 650.4 MiB of data. The track from 25 mm to 58 mm at 1.2 m/s takes 74.7 minutes: 336,126 sectors and 656.5 MiB.'),
  ],
  deeper: [
    {title: 'The base speed', body: 'At 75 sectors a second and 2,048 bytes of data in each, a CD-ROM gives 153,600 bytes a second, 150 KiB, the speed drives call 1×.'},
    {title: 'Inside a sector', body: 'In the first mode a sector of 2,352 bytes is 12 bytes of sync, 4 of header, 2,048 of data, 4 to detect errors, 8 of zeros, and 172 and 104 of parity to correct them.'},
    {title: 'Surviving a scratch', body: 'The second stage of the CD’s error correction is a Reed-Solomon code of 28 bytes carrying 24, whose bytes are spread 4 frames apart. It can rebuild 4 missing bytes in each word, so a burst that wipes out 16 whole frames still leaves every word with no more than 4 missing. Those 16 frames of 32 bytes are 4,096 bits and, at 1.2 m/s, 2.61 mm of track; the page on the code gives 4,000 bits and 2.5 mm. Beyond that a CD player hides a longer burst in music by filling it in, up to 12,000 bits or 7.5 mm, the page says, but data cannot be filled in: a CD-ROM sector adds its own 276 bytes of parity.'},
    {title: 'A whole disc', body: 'The 74 minutes the CD-ROM page gives are 4,440 s, 333,000 sectors and 650 MiB of data. The program area from 25 mm to 58 mm at 1.2 m/s passes in 74.7 minutes, 336,126 sectors and 656.5 MiB.'},
  ],
  misconception: 'A CD-ROM does not store a byte in each pit or a bit in each pit and land. Each byte becomes 14 channel bits, and only the edges between pits and lands are ones.',
  limits: cdRomLimits,
  sources: [sources.cdRom, sources.ecma130, sources.circ, sources.audio, sources.compactDisc, sources.efm],
  quiz: {
    question: 'How many bytes of data does a CD-ROM give each second at its base speed?',
    options: ['153,600: 75 sectors of 2,048 bytes.', '176,400: 75 sectors of 2,352 bytes.', '1,411,200: the rate of the music.'],
    answer: 0,
    explanation: 'Of each sector’s 2,352 bytes, 2,048 are data, and 75 sectors pass every second.',
  },
};

// ---------------------------------------------------------------------------
// Optical-disc readout.
// ---------------------------------------------------------------------------

const readPickup = trial(READ_DEFAULTS, 'pickup'), readTrack = trial(READ_DEFAULTS, 'track'), readPit = trial(READ_DEFAULTS, 'pit'), readSignal = trial(READ_DEFAULTS, 'signal');

export const opticalReadoutLimits = `The pickup is a diagram in the arrangement of the DVD standard’s test pickup; its cone of light and the plastic above the lens are drawn 40 times larger at their true angles and thicknesses, and its lens and the gap under the disc are illustrative. ${readoutLimits}`;

export const opticalReadoutLesson = {
  simple: 'How does a laser pickup read pits shorter than its light’s wavelength?',
  overview: 'An optical pickup sends laser light through lenses and a beam splitter to a spot on the disc, and sends the light that comes back to a photodetector. It never sees the pits as shapes. It measures how much light comes back, which drops wherever a pit sends its light back out of step with the land around it. Look at the pickup, the spot, a pit cut open and the light sent back.',
  steps: [
    {title: 'Make parallel light', body: 'A collimating lens turns the laser diode’s spreading light into a parallel beam.'},
    {title: 'Pass the beam splitter', body: 'The beam passes a polarizing beam splitter and then a quarter-wave plate.'},
    {title: 'Focus into the disc', body: 'The objective lens focuses the light through the disc’s plastic to a spot on the track.'},
    {title: 'Turn the return aside', body: 'The light coming back passes the quarter-wave plate again, and the beam splitter turns it aside to the photodetector.'},
    {title: 'Keep it on the track', body: 'The photodetector’s four parts feed two servos: one keeps the spot in focus, the other keeps it on the track.'},
  ],
  parts: [
    {name: 'Laser pickup, opened out', role: 'The laser, lenses, beam splitter and photodetector.'},
    {name: 'Spot on the track, close up', role: 'The focused spot and its dark rings over the tracks.'},
    {name: 'A pit, cut open', role: 'Light off a pit and off the land, cancelling.'},
    {name: 'Light sent back', role: 'What the photodetector measures as the pits pass.'},
  ],
  tryIt: [
    readPickup('Follow the light', 'Look at the laser pickup.', 'The objective focuses the violet light into a cone 58.2° to each side in air, narrowing to 33.3° in the plastic, through a cover only 0.1 mm thick.'),
    readPickup('A CD’s gentler cone', 'Choose a CD.', 'A CD’s lens has a numerical aperture of 0.45: its cone is 26.7° to each side and focuses through 1.2 mm of plastic.', {format: 0}),
    readTrack('The spot and its rings', 'Look at the spot on the track.', 'The spot is 581 nm across to its first dark ring, and its second dark ring lies 532 nm from its middle, beyond the tracks 320 nm to either side.'),
    readPit('Cancel the light', 'Look at the pit cut open.', 'The pit is a bump 65.3 nm high toward the laser, a quarter of the light’s 261.3 nm wavelength in the plastic. Light off it returns half a wavelength behind light off the land, and their average is flat.'),
    readPit('A pit half a wavelength deep', 'Set the pit depth to half a wavelength.', 'Now the light off the bump returns a whole wavelength behind, in step with the land’s, and their average swings as far as either: the pit cannot be seen.', {depth: 3}),
    readSignal('Too fine to see', 'Press Play and watch the light sent back.', 'Pits and lands 149 nm long repeat every 298 nm, just coarser than the finest pattern the lens sends back, 238 nm, so they swing the light by only 13% of what a long pit does. Pits half as long would send back no change at all.'),
  ],
  deeper: [
    {title: 'The cone of light', body: 'A lens’s numerical aperture is the sine of the half-angle of its cone of light: 0.85 makes a cone 58.2° to each side in air. Entering plastic of refractive index 1.55 the cone narrows to 33.3°, since the refractive index times the sine stays the same. A CD’s 0.45 makes 26.7° and a DVD’s 0.60 makes 36.9°.'},
    {title: 'A thin cover', body: 'To focus its wide cone cleanly, Blu-ray put the plastic in front of its data only 0.1 mm thick, on a 1.1 mm substrate, where a DVD uses 0.6 mm and a CD 1.2 mm. The Blu-ray page says the thinner cover avoids unwanted optical effects.'},
    {title: 'The spot and its rings', body: 'The focused spot is an Airy pattern: a bright middle 1.22 λ/NA across to its first dark ring, then fainter rings. For a Blu-ray Disc the first dark ring lies 291 nm from the middle and the second 532 nm, so the spot’s light spills onto the tracks 320 nm to either side.'},
    {title: 'Reading below the wavelength', body: 'The shortest Blu-ray pits, 149 nm, are shorter than the violet light’s wavelength in the plastic, 261.3 nm. The pickup does not see them as shapes. It sees the light it gets back drop and rise as they pass, and a lens passes that change only for patterns repeating coarser than λ/(2NA), 238 nm.'},
    {title: 'Two servos and a photodetector in four parts', body: 'One servo keeps the lens at the right distance to focus the spot, and another moves the pickup along the radius to keep the spot on the track. The DVD standard’s test pickup focuses by the astigmatic method onto a photodetector in four parts, after the polarizing beam splitter and the quarter-wave plate.'},
    {title: 'Laser diodes', body: 'The light comes from a laser diode: violet 405 nm indium gallium nitride for Blu-ray, 650 nm to 660 nm red for DVD drives, and 785 nm near-infrared for compact disc drives, the laser diode page gives. The CD-ROM and DVD standards test with 780 nm and 650 nm.'},
  ],
  misconception: 'A pickup does not photograph the pits. It measures one number, how much light comes back, and the pits change that number because light off them cancels light off the land.',
  limits: opticalReadoutLimits,
  sources: [sources.drive, sources.ecma267, sources.ecma130, sources.bluRay, sources.aperture, sources.airy, sources.limit, sources.compactDisc, sources.laser, sources.disc],
  quiz: {
    question: 'Why are pits made about a quarter wavelength deep?',
    options: ['Light off them then returns half a wavelength out of step with light off the land, and the two cancel.', 'Deeper pits would break through the disc.', 'The laser can only focus a quarter wavelength deep.'],
    answer: 0,
    explanation: 'At a quarter wavelength, 65.3 nm for a Blu-ray Disc, the two halves cancel; at half a wavelength they return in step and the pit cannot be seen.',
  },
};
