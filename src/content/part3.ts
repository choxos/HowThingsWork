import type {Topic} from '../topics.ts';

/** Part 3 of the book: working with waves. */
export const part3: Topic[] = [
  {
    id: 'light-and-images',
    index: 16,
    part: 3,
    name: 'Light and images',
    category: 'Working with waves',
    tagline: 'Rays bent into a picture',
    blurb: 'Bend every ray from a point back to a point and you have an image.',
    summary:
      'Light travels in straight lines until something makes it turn. Light goes more slowly in glass than in air, and a lens is thicker at the middle than the edge, so a ray through the middle is held up longer than one through the rim. A spreading bundle from one point is bent back together at another. Gather that for every point of a scene at once and what you have is a picture.',
    principle:
      'One equation covers the lot: the reciprocal of the focal length equals the reciprocal of the object distance plus the reciprocal of the image distance. Far away and the image forms close to the focal plane, small and upside down, which is what a camera and an eye both do. Bring the object toward the focal point and the image runs away and grows, until at the focal point itself the rays leave parallel and there is no image at all. Inside the focal point the arithmetic turns the other way: the rays still spread when they leave, so no image can be caught on a screen, but the eye traces them back to a large upright one behind the glass. That is a magnifying glass. A curved mirror obeys the same equation, folding the image back to the side it came from.',
    legend: {effort: 'the object', delivered: 'the image', note: 'Arrow length is size; direction is which way up.'},
    parts: [
      {
        id: 'lens',
        name: 'The lens',
        role: 'What bends the light',
        description:
          'A disc of glass thicker at the middle than the edge. Its focal length is where it brings parallel light to a point, and that is the only property of it that matters here.',
        principle:
          'Light goes more slowly in glass, so a ray meeting the surface at an angle turns toward the thicker part. A shape curved just so turns every ray from one point back through very nearly a single point, which is what makes a picture rather than a smear.',
      },
      {
        id: 'object',
        name: 'The object',
        role: 'Where the light comes from',
        description:
          'Anything lit. Every point of it throws light in all directions, and only the small cone of it that reaches the lens is used.',
        principle:
          'How far it stands from the lens is the one thing this study varies. Everything about the image follows from that distance and the focal length, and from nothing else.',
      },
      {
        id: 'rays',
        name: 'The construction rays',
        role: 'How to find the image',
        description:
          'Three rays are enough. One arrives parallel to the axis and leaves through the far focus; one passes straight through the middle unbent; one goes through the near focus and leaves parallel.',
        principle:
          'Where those three meet is where every other ray from that point meets too, as long as the rays stay near the axis and the lens is thin against its focal length. Drawing them is the equation done with a ruler, and it inherits the same idealization: a real lens brings neither every ray nor every color to quite one point.',
      },
      {
        id: 'image',
        name: 'The image',
        role: 'What comes out',
        description:
          'Real when the rays actually cross and could fall on a film or a sensor; virtual when they only appear to come from somewhere.',
        principle:
          'For the single converging lens or concave mirror here, a real image is inverted and can be projected. Its virtual image is upright and cannot be caught on a screen. Other optical systems can form images with different orientations. The switch between them happens exactly at the focal point, and nowhere else.',
      },
    ],
    applications: [
      {name: 'Camera and eye', note: 'Both put a real, inverted image on a light sensitive surface. The eye focuses by squeezing the lens fatter; a camera focuses by moving it.'},
      {name: 'Magnifying glass', note: 'The object held inside the focal length, so the eye sees a large upright virtual image behind the glass.'},
      {name: 'Telescope', note: 'A large lens or mirror makes a small real image of something far away, and an eyepiece is a magnifying glass held up to that image.'},
      {name: 'Microscope', note: 'The same two stages, the other way round: a very short lens close to the specimen makes a large real image, and the eyepiece enlarges that.'},
      {name: 'Optical disc', note: 'A lens focuses a laser to a spot a fraction of a thousandth of a millimeter across; pits in the track scatter the reflection and a photodiode reads the difference.'},
    ],
    facts: [
      ['Chapter', 'Part 3 · Working with waves'],
      ['Family', 'Optics'],
      ['Set by', 'Focal length and object distance'],
      ['Trades', 'Size against distance'],
    ],
  },
  {
    id: 'photography',
    index: 17,
    part: 3,
    name: 'Photography',
    category: 'Working with waves',
    tagline: 'Three settings, one exposure',
    blurb: 'Open wider and you need less time; you also get less in focus.',
    summary:
      'The lens opening and shutter time control how much light reaches a camera’s film or sensor. ISO changes the film sensitivity or how a digital camera turns its captured signal into picture brightness. These settings can give similar brightness with different blur, depth of field and noise.',
    principle:
      'The opening is quoted as an f number, the focal length divided by the diameter of the hole. Light gets in through an area, so it goes with the square of that diameter and therefore with one over the square of the f number. That is why the familiar series climbs by the square root of two: every step halves the light and is called a stop. Halve the light and the shutter must stay open twice as long, or the sensitivity must double. Nothing is free: a long shutter blurs anything moving, a high sensitivity brings noise, and a wide opening leaves only a thin slice of the scene sharp.',
    legend: 'none',
    parts: [
      {
        id: 'aperture',
        name: 'The aperture',
        role: 'How wide the hole is',
        description:
          'An iris of overlapping blades inside the lens, quoted as an f number: the focal length divided by the width of the opening, so a larger number is a smaller hole.',
        principle:
          'Light enters through an area, so closing down one stop cuts it in half. The same change deepens the zone that comes out sharp, because a narrower cone of rays from an out of focus point lands as a smaller blur.',
      },
      {
        id: 'shutter',
        name: 'The shutter',
        role: 'How long it stays open',
        description:
          'A blind or a pair of curtains that uncovers the sensor for a set time.',
        principle:
          'Time and area trade one for one: a stop lost at the aperture is a doubling of the time. What time buys you, or costs you, is movement. A thousandth of a second freezes a bird; a second turns a river to fog.',
      },
      {
        id: 'sensor',
        name: 'The sensor',
        role: 'How sensitive the surface is',
        description:
          'Film of a given speed, or an image sensor with its amplification set. Quoted as an ISO number, where twice the number is twice the sensitivity.',
        principle:
          'At fixed aperture and shutter time, raising digital ISO brightens the recorded image without capturing more light. It changes neither depth of field nor motion blur by itself. Using high ISO to allow a shorter exposure captures fewer photons, often making noise more visible.',
      },
      {
        id: 'field',
        name: 'The depth of field',
        role: 'What comes out sharp',
        description:
          'The band of distances, in front of and behind the point focused on, that the eye accepts as sharp.',
        principle:
          'Only one plane is truly in focus. Everything else lands as a small disc, and while that disc stays under about a thirtieth of a millimeter on a full frame, the eye reads it as a point. A smaller opening shrinks every one of those discs at once.',
      },
    ],
    applications: [
      {name: 'Single lens reflex', note: 'A mirror sends the view up to a pentaprism so the eye looks through the taking lens itself, and flips up out of the way when the shutter fires.'},
      {name: 'Portraits', note: 'A wide opening on a long lens, so the subject is sharp and the background is a wash of color.'},
      {name: 'Landscape', note: 'A small opening focused at the hyperfocal distance, so everything from a few meters to the horizon falls inside the accepted blur.'},
      {name: 'Sport', note: 'A short shutter time bought with a wide opening and a high sensitivity, accepting thin focus and some noise to stop the movement.'},
      {name: 'Video', note: 'The same three controls, with the shutter usually pinned near half the frame interval so movement blurs the way the eye expects.'},
    ],
    facts: [
      ['Chapter', 'Part 3 · Working with waves'],
      ['Family', 'Optics in practice'],
      ['Set by', 'Aperture, time and sensitivity'],
      ['Trades', 'Light against depth, movement and noise'],
    ],
  },
  {
    id: 'printing',
    index: 18,
    part: 3,
    name: 'Printing',
    category: 'Working with waves',
    tagline: 'Four inks, no shades',
    blurb: 'A press lays solid dots and lets the eye do the mixing.',
    summary:
      'The press this study is about can put ink on paper or leave it bare, and has no way to lay down a pale version of a color. Every shade in the picture is solid ink in dots too small to make out, with white paper showing between them, averaged by the eye into a tint. Other processes work differently: gravure really can vary how much ink it lays.',
    principle:
      'The tint is the average of the paper and the ink, weighted by how much of the area each covers. Cover a tenth and you get a pale wash; cover nine tenths and you get nearly solid. Three inks that each subtract one third of the spectrum, cyan, magenta and yellow, will between them make most colors, and black is added because three inks together give a muddy brown and because text wants a single crisp impression. The four screens are laid at different angles, thirty degrees apart where they can be, because screens at similar angles interfere and throw up a coarse pattern of their own.',
    legend: 'none',
    parts: [
      {
        id: 'screen',
        name: 'The screen',
        role: 'Dots on a grid',
        description:
          'A regular lattice of dots, quoted in lines per inch. A newspaper runs at eighty five, a book at a hundred and fifty, fine art work at three hundred.',
        principle:
          'The spacing decides whether the eye sees dots or tone. At arm’s length the eye separates details about a minute of arc apart, which is about a tenth of a millimeter, so a screen finer than roughly two hundred and fifty lines an inch disappears.',
      },
      {
        id: 'dots',
        name: 'The dots',
        role: 'Tone without shades',
        description:
          'Solid ink, always the same strength, varying only in size. A pale tint is small dots; a dark one is large dots nearly touching.',
        principle:
          'Since the ink is always the same, the only thing that changes is how much of the paper it hides. The tint follows the covered area directly, which is why a printer can talk about a forty percent tint and mean something exact.',
      },
      {
        id: 'angles',
        name: 'The screen angles',
        role: 'Why the inks do not clash',
        description:
          'Each ink is laid on its own lattice, turned to its own angle: black at forty five degrees, magenta at seventy five, cyan at fifteen, yellow at zero.',
        principle:
          'Two lattices at a small angle to each other beat against one another and produce a coarse pattern, called moiré, far bigger than either. Thirty degrees apart is far enough that the pattern shrinks to the tight rosette that printers accept. Yellow, being the faintest, gets the awkward remaining angle.',
      },
      {
        id: 'sheet',
        name: 'The sheet',
        role: 'What shows through',
        description:
          'White paper. It supplies every light tone in the picture, because there is no white ink.',
        principle:
          'This kind of printing is subtractive: each ink takes something away from the light the paper reflects, and the lightest tone available is the bare sheet. That is the opposite of a screen, which adds colored light to blackness, and it is why the same picture needs different numbers for print and for display. Presses that do carry a white ink exist, for printing onto dark or clear material.',
      },
    ],
    applications: [
      {name: 'Offset lithography', note: 'The image area of a plate takes ink and rejects water, the rest the reverse. The plate never touches the paper: it prints onto a rubber blanket, which prints onto the sheet.'},
      {name: 'Newspapers', note: 'A coarse screen on absorbent paper, run at enormous speed from reels rather than sheets.'},
      {name: 'Gravure', note: 'Cells cut into the cylinder hold the ink, so the amount of ink really can vary. Expensive to make, and used for very long runs.'},
      {name: 'Inkjet', note: 'The same idea with the dots sprayed rather than pressed, and placed irregularly rather than on a lattice, which can reduce regular screen interference; the exact dot pattern depends on the printer.'},
      {name: 'Screens', note: 'A display works the other way, adding red, green and blue light. A printed page and a screen showing the same picture are solving opposite problems.'},
    ],
    facts: [
      ['Chapter', 'Part 3 · Working with waves'],
      ['Family', 'Color reproduction'],
      ['Set by', 'Screen ruling and dot area'],
      ['Trades', 'Detail against the visibility of the dots'],
    ],
  },
  {
    id: 'sound-and-music',
    index: 19,
    part: 3,
    name: 'Sound and music',
    category: 'Working with waves',
    tagline: 'Air squeezed and released',
    blurb: 'Shorten a stretched string and it vibrates faster, making a higher note.',
    summary:
      'Sound is air being squeezed and let go, over and over, traveling outward at about a third of a kilometer a second. How often the squeezing happens is the pitch; how hard is the loudness. An instrument is a device for making that happen at a rate you can choose.',
    principle:
      'A stretched string has one lowest way of vibrating: the whole length swinging as a unit, with the ends held. Its rate rises as the string is shortened, in exact proportion, and as it is pulled tighter, with the square root. Halve the length and the pitch rises an octave. A column of air does the same, and the length that matters depends on the ends: open at both, the pipe holds half a wavelength; stopped at one, only a quarter, so it sounds an octave lower for the same tube. Above the lowest note, they vibrate in parts as well as as a whole. A string and a pipe open at both ends take the whole series, halves and thirds and quarters together; a pipe stopped at one end can only take the odd members of it, which is why a clarinet sounds hollow beside a flute. The mixture is what makes two instruments at the same pitch sound like different things.',
    legend: 'none',
    parts: [
      {
        id: 'string',
        name: 'String or air column',
        role: 'What vibrates',
        description:
          'Choose a stretched string or the air inside a pipe. String pitch depends on length, tension and weight per length. Pipe pitch depends on its length and whether its ends are open or closed.',
        principle:
          'The string stays still at both ends. Air can move most at an open pipe end and stays still at a closed one. The curves show these different standing-wave patterns; for air, sideways height on the diagram represents movement along the pipe.',
      },
      {
        id: 'bridge',
        name: 'The stop',
        role: 'What sets the length',
        description:
          'A finger on a fingerboard, a fret, a bridge, or in a wind instrument the first open hole.',
        principle:
          'Only the part free to vibrate counts. Move the stop halfway along and the free length halves, so the pitch doubles: that interval is an octave, and it is the same interval however long the string was to begin with.',
      },
      {
        id: 'body',
        name: 'The body',
        role: 'What makes it audible',
        description:
          'The soundboard, the belly, the horn. A bare string moves almost no air and can barely be heard.',
        principle:
          'For the string, a soundboard transfers vibration to a larger surface and moves more air. For a pipe, sound radiates from its openings. The shared bench is a support for this comparison, not a complete musical instrument.',
      },
      {
        id: 'air',
        name: 'The wave',
        role: 'What reaches you',
        description:
          'Bands of squeezed and thinned air moving outward at about three hundred and forty three meters a second.',
        principle:
          'The wave carries the rate unchanged, so pitch survives the journey. Its length is the speed divided by the rate, which is why a low note is measured in meters and a high one in centimeters, and why bass generally bends around the same obstacle more readily than treble.',
      },
    ],
    applications: [
      {name: 'Violin family', note: 'Four strings of different weights, all the same length, stopped by the fingers. The body is carved to answer evenly across the range.'},
      {name: 'Brass', note: 'The player picks a member of the harmonic series with their lips; valves or a slide add tubing to move the whole series down.'},
      {name: 'Woodwind', note: 'Holes shorten the working length of the air column. Keys let one hand cover holes too far apart to reach.'},
      {name: 'Microphone and loudspeaker', note: 'The same conversion in both directions: a diaphragm moved by air makes a current, and a current moves a diaphragm to make air move.'},
      {name: 'Rooms', note: 'Sound reflects, so a hall adds its own tail to every note. Too little and the music is dry; too much and it turns to mud.'},
    ],
    facts: [
      ['Chapter', 'Part 3 · Working with waves'],
      ['Family', 'Vibration'],
      ['Set by', 'Length, tension and weight'],
      ['Trades', 'Pitch against length'],
    ],
  },
  {
    id: 'telecommunications',
    index: 20,
    part: 3,
    name: 'Telecommunications',
    category: 'Working with waves',
    tagline: 'A message riding a wave',
    blurb: 'A radio wave can carry a message by changing its strength or rhythm.',
    summary:
      'A sound signal is hopeless to radiate directly: at those rates an efficient antenna would be kilometers long, and a short one gives out almost nothing of what it is fed. So a fast, steady wave is generated instead, and something about it is varied in step with the signal. The wave travels; at the far end the variation is read back off it and the signal is recovered.',
    principle:
      'The steady wave is the carrier, and its frequency decides everything about how the message travels. Wavelength is the speed of light divided by that frequency, and an efficient antenna is a quarter of a wavelength, so long wave needs a mast and a phone needs a few centimeters. Low frequencies follow the curve of the ground; medium ones bounce off the ionosphere at night and reach across continents; very high ones go in straight lines and stop at the horizon, which is why they need a network of masts. Vary the height of the carrier and you have amplitude modulation, simple and vulnerable to every spark and storm. Vary its rate instead and you have frequency modulation, whose receiver can reject many changes in strength, though weak signals and interference can still cause noise.',
    legend: 'none',
    parts: [
      {
        id: 'carrier',
        name: 'The carrier',
        role: 'The wave that travels',
        description:
          'A steady oscillation at a chosen frequency, carrying no information at all until something is done to it.',
        principle:
          'Its frequency is the whole of the choice. It fixes the wavelength, the antenna, how the wave gets from one place to another, and how many other stations can share the air without colliding.',
      },
      {
        id: 'signal',
        name: 'The signal',
        role: 'What is being sent',
        description:
          'The speech, music or data, as a voltage that rises and falls thousands of times a second rather than millions.',
        principle:
          'At those rates an antenna of any practical size radiates almost nothing of what it is given. This radio study shows how to put the signal onto a carrier wave and recover it at the other end. Communication can also use electric cables or optical fibers.',
      },
      {
        id: 'modulated',
        name: 'The modulated wave',
        role: 'The two joined',
        description:
          'The carrier with the signal written into it, either as a changing height or as a changing rate.',
        principle:
          'Amplitude modulation puts the signal in the height of the wave, so anything that changes the height on the way, lightning, engines, a passing bridge, arrives as noise. Frequency modulation puts it in the rate instead, and a receiver can reject many unwanted changes in height. FM still has limits when a signal is weak or other signals interfere.',
      },
      {
        id: 'antenna',
        name: 'The antenna',
        role: 'Where it leaves and arrives',
        description:
          'A conductor cut to suit the wavelength. A quarter of a wavelength is the usual choice, working against a ground plane.',
        principle:
          'Current pushed up and down it launches the wave; the arriving wave pushes current up and down it again. The size is not a matter of taste: a conductor much shorter than the wave it is cut for radiates very little of what it is given.',
      },
    ],
    applications: [
      {name: 'Broadcast radio', note: 'Amplitude modulation on the long and medium bands for range, frequency modulation on the very high band for quality, and digital coding on top of either.'},
      {name: 'Mobile phones', note: 'Low power and high frequency, so each mast covers a small cell and the same frequencies can be used again a few cells away.'},
      {name: 'Satellites', note: 'A mast in geostationary orbit, high enough that a third of the planet is in line of sight, at frequencies that pass through the atmosphere.'},
      {name: 'Optical fiber', note: 'The same idea with light as the carrier, guided down a glass thread by total internal reflection, and modulated at rates no radio band could carry.'},
      {name: 'Radio telescopes', note: 'The receiving half alone, pointed outward. A dish gathers a very weak natural signal, and several linked together behave as one much larger.'},
    ],
    facts: [
      ['Chapter', 'Part 3 · Working with waves'],
      ['Family', 'Signal transmission'],
      ['Set by', 'Carrier frequency'],
      ['Trades', 'Range against bandwidth and antenna size'],
    ],
  },
];
