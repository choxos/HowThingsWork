import type {Topic} from '../topics.ts';

/** Part 5 of the book: the digital domain. */
export const part5: Topic[] = [
  {
    id: 'making-bits',
    index: 26,
    part: 5,
    name: 'Making bits',
    category: 'The digital domain',
    tagline: 'A wave measured on a grid',
    blurb: 'Read the height often enough, and round it finely enough, and what is lost stops mattering.',
    summary:
      'A microphone gives a voltage that varies smoothly, and a computer can hold only numbers. Turning one into the other takes two decisions, and only two: how often to look, and how finely to round what you see. Look often enough and the samples pin down every frequency the signal actually contains. Round finely enough and the error left over is quieter than the room, though rounding always loses something: that part is not reversible. Get either decision wrong and the damage is done at that moment, and nothing later can undo it.',
    principle:
      'A wave is captured exactly if it is sampled at more than twice its highest frequency. That is a sharp threshold, not a rule of thumb. Sample more slowly and anything above half the sample rate does not simply vanish: it folds down and arrives as a lower frequency that is indistinguishable from a real one, which is why a real converter filters the input before it samples rather than after. Rounding is the second decision. Each extra bit halves the size of the rounding step, which buys about six decibels of signal to noise ratio for a full scale sine wave, which is the case the figure is quoted for. Sixteen bits give about ninety eight decibels on that measure, which is why a compact disc uses them, and forty four thousand one hundred samples a second, which is a little over twice the top of human hearing.',
    legend: 'none',
    parts: [
      {
        id: 'wave',
        name: 'The incoming wave',
        role: 'What is being measured',
        description:
          'A smooth signal of a fixed frequency, drawn as it arrives at the converter. It exists at every instant, not only at the sample points.',
        principle:
          'Its frequency is fixed here so that the sampling rate is the only thing changing. When the rate falls below twice this frequency, the fold appears and the readout names the false tone it produces.',
      },
      {
        id: 'samples',
        name: 'The samples',
        role: 'When it is looked at',
        description:
          'One reading of the height at each tick of the sampling clock. Between the ticks the converter knows nothing at all.',
        principle:
          'Their spacing is the sample interval and the slider sets it. Samples are instants, not averages: the width they are drawn with is for the eye only.',
      },
      {
        id: 'levels',
        name: 'The quantizer',
        role: 'How finely it is rounded',
        description:
          'A ladder of allowed values across the range. Each sample is snapped to the nearest rung, and the number of that rung is what gets stored.',
        principle:
          'Rounding to the nearest rung leaves an error of at most half a step for any signal that stays inside the ladder, and the spread of that error over many samples is what the noise figure describes. A signal driven to full scale, as this one is, clips against the top rung instead, because the ladder reaches one step further below the middle than above it. Up to five bits the rungs drawn are the real levels; above that there are more of them than the bench can rule, so the ladder becomes a solid band and the readout carries the count.',
      },
      {
        id: 'staircase',
        name: 'The stored values',
        role: 'What the machine actually has',
        description:
          'The rounded samples, held between ticks so that they can be seen. What is stored is the numbers themselves; holding each one until the next is a way of drawing them, and it is also what a converter does on the way back out.',
        principle:
          'The staircase is what is stored, not what comes back out. Reconstruction passes it through a filter that smooths it back toward the original wave, and this bench draws the numbers rather than that final smoothing.',
      },
    ],
    applications: [
      {name: 'Compact disc', note: 'Sixteen bits at 44.1 kHz in two channels, which is 1.41 megabits a second before any error correction is added.'},
      {name: 'Telephone', note: 'Eight thousand samples a second, enough for speech up to about 3.4 kHz and nothing above it.'},
      {name: 'Digital camera', note: 'The same two decisions in two dimensions: how closely to space the pixels, and how finely to grade each one.'},
      {name: 'Medical monitoring', note: 'A pulse or a heartbeat sampled fast enough for the frequencies the signal is known to contain, which is what decides whether a spike can slip between two readings.'},
      {name: 'Anti-aliasing filter', note: 'The analog filter ahead of a converter, whose whole job is to remove what the sampler would otherwise fold down. Systems that already know their input is band limited can leave it out.'},
    ],
    facts: [
      ['Chapter', 'Part 5 · The digital domain'],
      ['Family', 'Conversion'],
      ['Set by', 'Sample rate and bit depth'],
      ['Trades', 'Fidelity against data'],
    ],
  },
  {
    id: 'storing-bits',
    index: 27,
    part: 5,
    name: 'Storing bits',
    category: 'The digital domain',
    tagline: 'Numbers laid out to be found again',
    blurb: 'Capacity is easy. Getting back to the right spot is what costs the time.',
    summary:
      'Persistent storage has to do two things: hold a pattern without power, and let a machine find any part of it again. A disc holds the pattern as magnetized regions on rings called tracks, and finds them by moving a head to the right ring and waiting for the right part to come round. That waiting is the reason storage is described by two quite different numbers, capacity and access time, which improve for entirely different reasons and at entirely different rates.',
    principle:
      'Capacity is arithmetic: the bytes in a sector, times the sectors on a track, times the tracks, times the surfaces. Packing the tracks closer multiplies all of it. Time is mechanics, and mechanics does not improve the way arithmetic does. Once the head is over the right track, the wanted sector is somewhere on a ring that is turning, so on average half a turn has to pass. At seven thousand two hundred revolutions a minute a full turn takes 8.3 milliseconds, so the average wait is a little over four, with any individual wait anywhere between nothing and the full turn. That average is what a stream of requests arriving at no particular moment will see, and no amount of cleverness in the software changes the mechanics underneath it. That single fact shapes everything above it: files kept in one piece rather than scattered, reads asked for in large blocks, caches in memory, and eventually flash memory, which has no moving parts and so has no half turn to wait for.',
    legend: 'none',
    parts: [
      {
        id: 'platter',
        name: 'The platter',
        role: 'What holds the pattern',
        description:
          'A rigid disc coated with a magnetic film, turning at a constant rate. The tracks are concentric rings, not a spiral.',
        principle:
          'Every track passes the head once per revolution. This bench gives every track the same number of sectors, which is the simple scheme and means every track carries the same bytes past the head each turn; real drives put more sectors on the outer tracks, and it is that zoning, not the geometry on its own, that makes the outside faster.',
      },
      {
        id: 'tracks',
        name: 'The tracks',
        role: 'How it is divided',
        description:
          'Rings drawn at the density the slider sets, each divided into sectors of a fixed size. The drawn rings thin and crowd as the density rises.',
        principle:
          'The count is what the capacity is computed from. Ninety rings is as many as can be told apart at this size, so above that the rings stand for many tracks each and it is their thickness, drawn on the logarithm of the spacing, that goes on answering the slider. The readout carries the real count and the real spacing.',
      },
      {
        id: 'head',
        name: 'The head',
        role: 'What reads and writes',
        description:
          'A tiny coil on an arm that swings across the tracks, flying a fraction of a micrometer above the surface without touching it.',
        principle:
          'Writing pushes the film’s magnetization one way or the other; reading senses the change at each boundary. The arm’s swing is the seek, and the wait after it is the rotation.',
      },
      {
        id: 'wait',
        name: 'The wait',
        role: 'Why it takes time',
        description:
          'The wedge sweeping round to the head stands for the rotation still to come before the wanted sector arrives.',
        principle:
          'Averaged over requests arriving at no particular point in the rotation it is half a turn, which depends on the spin rate and on nothing else. Any single wait is anywhere from nothing to a whole turn. It is drawn at the true fraction of a revolution rather than at a convenient one.',
      },
    ],
    applications: [
      {name: 'Hard disc', note: 'Still the cheapest way to keep a great deal of data, and still bound by the half turn.'},
      {name: 'Solid state drive', note: 'Flash cells with no moving parts, so the wait collapses from milliseconds to microseconds while the arithmetic of capacity is unchanged.'},
      {name: 'Optical disc', note: 'One long spiral rather than rings, read by a laser, which is why a disc is read from the middle outward.'},
      {name: 'Tape', note: 'Enormous capacity at a low cost per byte, read in long sequential passes rather than by jumping about, which is what makes it suit archives and backups.'},
      {name: 'Error correction', note: 'Extra bits stored alongside the data so that a scratch or a weak region can be reconstructed rather than lost.'},
    ],
    facts: [
      ['Chapter', 'Part 5 · The digital domain'],
      ['Family', 'Storage'],
      ['Set by', 'Track density and spin rate'],
      ['Trades', 'Capacity against access time'],
    ],
  },
  {
    id: 'processing-bits',
    index: 28,
    part: 5,
    name: 'Processing bits',
    category: 'The digital domain',
    tagline: 'Arithmetic out of switches',
    blurb: 'Two switches and a rule between them will add. Enough of them will do anything.',
    summary:
      'A processor has no idea what a number is. It has switches, arranged so that the state of one depends on the state of others in a fixed way. Three such arrangements are enough for everything: one that is on only when both inputs are, one that is on when either is, and one that reverses. From those you can build a circuit that adds two bits and reports a carry, and from a row of those you can build a circuit that adds two numbers of any width you like.',
    principle:
      'Binary counting is what makes this possible: with n bits you can name two to the n different values, so each bit added doubles the number of patterns available even though the width itself has only gone up by one. Addition is done a column at a time, exactly as on paper, and each column needs the carry from the one below it. That is the catch. In the simplest adder the carry has to ripple through every stage in turn before the top bit is settled, so the time taken grows with the width. Two gate delays per stage is the usual model. Real processors spend a great deal of silicon on not doing it this way, working out the carries in parallel instead, which is the difference between a circuit that is merely correct and one that is fast.',
    legend: 'none',
    parts: [
      {
        id: 'inputs',
        name: 'The inputs',
        role: 'The two numbers',
        description:
          'Two rows of cells, lit for one and dark for zero. The slider sets how many bits wide they are.',
        principle:
          'The values shown are always representable in the current width. Narrowing the adder truncates them rather than silently reporting a number the machine could not hold.',
      },
      {
        id: 'gates',
        name: 'The gates',
        role: 'What does the work',
        description:
          'One full adder per column, each built from a handful of gates: two exclusive ors for the sum, and the rest for the carry.',
        principle:
          'Every column is identical. That is what makes the arrangement extendable: adding a bit means adding a stage, not redesigning anything.',
      },
      {
        id: 'carry',
        name: 'The carry chain',
        role: 'Why width costs time',
        description:
          'The line running from each stage to the next, lit as the carry propagates along it during the animation.',
        principle:
          'The chain is drawn moving at one stage per two gate delays, and the readout reports the total for the current width using the same model, so the picture and the number are the same claim.',
      },
      {
        id: 'sum',
        name: 'The result',
        role: 'What comes out',
        description:
          'The sum, in binary and in decimal, with the final carry shown separately when the answer will not fit.',
        principle:
          'These are unsigned numbers, counted from zero upward, so when the sum exceeds what the width can hold the carry out is the overflow. A machine reading the same bits as signed has a different test again, and the two do not agree: at eight bits, 127 plus 1 overflows as a signed number without any carry out, and 255 plus 1 carries out without being a signed overflow. A program that ignores whichever applies wraps around, which is the source of a whole family of famous failures.',
      },
    ],
    applications: [
      {name: 'Arithmetic logic unit', note: 'The adder at the heart of every processor, extended to subtract, compare and shift with the same hardware.'},
      {name: 'Carry lookahead', note: 'Working out all the carries at once from the inputs, trading a great many more gates for a much shorter wait.'},
      {name: 'Overflow flags', note: 'A bit set when the answer did not fit, which careful software checks and careless software does not.'},
      {name: 'Fixed and floating point', note: 'Two conventions for where the point sits, built on exactly this integer arithmetic underneath.'},
      {name: 'Pipelining', note: 'Splitting the work into stages so that a new sum can start before the last has finished.'},
    ],
    facts: [
      ['Chapter', 'Part 5 · The digital domain'],
      ['Family', 'Logic'],
      ['Set by', 'Word width and gate delay'],
      ['Trades', 'Range against speed'],
    ],
  },
  {
    id: 'sending-bits',
    index: 29,
    part: 5,
    name: 'Sending bits',
    category: 'The digital domain',
    tagline: 'How much a channel will carry',
    blurb: 'Bandwidth and noise set a hard ceiling, and no amount of cleverness gets over it.',
    summary:
      'Sending information means putting it into something physical: a voltage on a wire, light in a fiber, a radio wave. Whatever it is, it has a limited range of frequencies available and some amount of noise mixed in. Those two numbers alone decide how fast information can pass, and the answer is not a matter of engineering skill. It is a limit in the same sense that the speed of light is a limit.',
    principle:
      'For a channel of a given bandwidth carrying a signal of limited average power against steady, evenly spread random noise, the capacity is the bandwidth times the logarithm to base two of one plus the ratio of signal power to noise power. Those conditions matter: a channel that fades, or whose interference is another transmitter rather than noise, is not described by two numbers. Read what the formula says. Doubling the bandwidth doubles the capacity if the ratio is held; at fixed transmitter power it does not, because a wider channel admits proportionally more noise. Doubling the signal power buys at most one more bit per second per hertz, and less than that when the ratio is small: from a ratio of one it buys about six tenths of a bit. Below the limit, codes exist that get the error rate as near zero as you like. Above it, none does, at any price. A telephone line of about three kilohertz at thirty decibels tops out near thirty one thousand bits a second, which is about where modems working over a fully analog connection stopped, and not by coincidence. The later standards that reached higher did so by using a path that was digital for part of its length, which is a different channel.',
    legend: 'none',
    parts: [
      {
        id: 'channel',
        name: 'The channel',
        role: 'What carries it',
        description:
          'The band of frequencies available, drawn as the width of the pipe. The variants change what the pipe is made of.',
        principle:
          'Bandwidth is a width in hertz, not a speed. It sets how quickly the signal is allowed to change, and everything else follows from that. The three channels here differ by six decades, so the drawn width follows the logarithm of the bandwidth rather than the bandwidth itself; drawn in proportion, the telephone line would be invisible.',
      },
      {
        id: 'signal',
        name: 'The signal',
        role: 'What is being sent',
        description:
          'The wave carrying the data, drawn above the noise floor. The slider changes how far above it sits.',
        principle:
          'What matters is the ratio to the noise, not the absolute size. The readout gives the ratio as decibels and as a plain multiple, because the formula needs the multiple.',
      },
      {
        id: 'noise',
        name: 'The noise',
        role: 'What gets in the way',
        description:
          'The floor of the channel: thermal agitation, interference, and everything else that is not the message.',
        principle:
          'It is always there and it can never be removed, only outrun. Its height here is fixed, so raising the signal is the only way to improve the ratio.',
      },
      {
        id: 'packets',
        name: 'The data',
        role: 'What gets through',
        description:
          'Blocks moving along the channel at a rate set by the computed capacity, so a wider or quieter channel visibly passes more of them.',
        principle:
          'Their rate follows the logarithm of the capacity, for the same reason the pipe does: the settings here span eight decades of capacity. The readout carries the real figure, and also the time to send a photograph, which is the same number in a form a person can feel.',
      },
    ],
    applications: [
      {name: 'Dial up modem', note: 'An analog telephone channel worked to within a few percent of its Shannon limit, and then no further without changing the channel itself.'},
      {name: 'Optical fiber', note: 'Enormous bandwidth and very little noise, which is why the limit sits in the terabits.'},
      {name: 'Mobile network', note: 'Each generation buys capacity mostly by taking more bandwidth and reusing it in smaller cells.'},
      {name: 'Deep space link', note: 'Almost no signal power, so the capacity is tiny and elaborate codes are used to reach it.'},
      {name: 'Error correcting codes', note: 'The practical route toward the limit: send a little more than the message so that damage can be repaired rather than retransmitted.'},
    ],
    facts: [
      ['Chapter', 'Part 5 · The digital domain'],
      ['Family', 'Communication'],
      ['Set by', 'Bandwidth and signal to noise ratio'],
      ['Trades', 'Rate against reliability'],
    ],
  },
  {
    id: 'using-bits',
    index: 30,
    part: 5,
    name: 'Using bits',
    category: 'The digital domain',
    tagline: 'Numbers turned back into a picture',
    blurb: 'Three numbers per dot, enough dots, and the eye is satisfied.',
    summary:
      'At the end of all of it the numbers have to become something a person can use, and most often that means a picture. A display is a grid of dots, each made of a red, a green and a blue element too small to resolve separately. Vary their brightnesses and the eye reports a single color. How good the result looks depends on two counts, how many dots and how finely each is graded, and how much data it takes depends on exactly the same two.',
    principle:
      'The pixel count is width times height. Each pixel needs a number for each of three channels, so the colors that can be named are two raised to three times the bits per channel: eight bits each gives sixteen million, which is more than the eye can distinguish and is why eight became standard. The data is unforgiving. A high definition frame at eight bits per channel is about six megabytes, and thirty of those a second is a billion and a half bits a second. The cable from a computer to a monitor usually carries exactly that, uncompressed, over a very short distance, and what is sent across a network usually is not: it is compressed, mostly by sending the differences between frames rather than the frames. Neither is a rule. Broadcast studios move uncompressed video over ordinary networks, and display cables have their own compression when the panel outruns the wire. What is fixed is the raw figure, and the ratio between it and what actually arrives is the measure of how much work the compression is doing.',
    legend: 'none',
    parts: [
      {
        id: 'grid',
        name: 'The pixel grid',
        role: 'How many dots',
        description:
          'A patch of the picture, one fortieth of its width and height, divided into rows and columns. The slider changes how finely, and the drawn grid changes with it.',
        principle:
          'Ruling the whole picture would be finer than the panel can draw at every setting, so the panel would sit still while the numbers moved. Drawing a patch instead means the squares really are the pixels the slider asks for, and the readout gives the count for the whole picture.',
      },
      {
        id: 'subpixels',
        name: 'The subpixels',
        role: 'How a color is made',
        description:
          'The red, green and blue elements inside one enlarged pixel, at the brightnesses that make the color shown beside them.',
        principle:
          'The eye has three kinds of color receptor, so three primaries are enough to fool it. This is addition of light, not the subtraction of inks that a printed page uses.',
      },
      {
        id: 'depth',
        name: 'The depth',
        role: 'How finely graded',
        description:
          'A ramp from black to full brightness at the current bits per channel, showing the steps where they exist.',
        principle:
          'Too few bits and a smooth sky shows as bands. The ramp is drawn as sixty four strips at every depth, each painted with the gray that depth would actually store, so up to six bits the bands are the real steps and above that the strips sample them. The readout carries the true count.',
      },
      {
        id: 'data',
        name: 'The data',
        role: 'What it costs',
        description:
          'A bar for one uncompressed frame and the stream it implies at the current frame rate.',
        principle:
          'These are raw figures with no compression at all. The bar is drawn on the logarithm of the size, because the slider spans three decades of it and a bar in true proportion would be a speck at one end or off the bench at the other: read it as an order of magnitude, and take the size itself from the readout. The readout also gives the compression ratio a common video rate would need, which is how the impossible becomes ordinary.',
      },
    ],
    applications: [
      {name: 'Screens', note: 'Phone, laptop and television, all the same grid of three colored elements at different sizes and distances.'},
      {name: 'Video compression', note: 'Sending mostly the differences between frames, and discarding detail the eye is poor at noticing.'},
      {name: 'Image formats', note: 'Lossless for line art and screenshots, lossy for photographs, chosen by what the picture is rather than by preference.'},
      {name: 'Color management', note: 'The same three numbers mean different colors on different devices unless a profile says what they mean.'},
      {name: 'High dynamic range', note: 'More bits per channel and a wider range of brightness, which is where the extra depth beyond eight bits is actually spent.'},
    ],
    facts: [
      ['Chapter', 'Part 5 · The digital domain'],
      ['Family', 'Display'],
      ['Set by', 'Pixel count and bit depth'],
      ['Trades', 'Detail against data'],
    ],
  },
];
