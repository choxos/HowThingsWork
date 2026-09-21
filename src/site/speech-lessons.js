import {SPEECH_DEFAULTS} from './speech-physics.js';

const trial = (defaults, part, view = 'front') => (title, instruction, observe, values = {}) => ({title, instruction, observe, values: {...defaults, ...values}, reset: true, part, isolate: false, view});

export const sources = {
  speechRecognition: {title: 'Wikipedia: Speech recognition', url: 'https://en.wikipedia.org/wiki/Speech_recognition'},
  phoneme: {title: 'Wikipedia: Phoneme', url: 'https://en.wikipedia.org/wiki/Phoneme'},
  englishPhonology: {title: 'Wikipedia: English phonology', url: 'https://en.wikipedia.org/wiki/English_phonology'},
  languageModel: {title: 'Wikipedia: Language model', url: 'https://en.wikipedia.org/wiki/Language_model'},
  formant: {title: 'Wikipedia: Formant', url: 'https://en.wikipedia.org/wiki/Formant'},
  vowel: {title: 'Wikipedia: Vowel', url: 'https://en.wikipedia.org/wiki/Vowel'},
  sourceFilter: {title: 'Wikipedia: Source-filter model', url: 'https://en.wikipedia.org/wiki/Source%E2%80%93filter_model'},
  sawtooth: {title: 'Wikipedia: Sawtooth wave', url: 'https://en.wikipedia.org/wiki/Sawtooth_wave'},
  harmonics: {title: 'Wikipedia: Harmonic series (music)', url: 'https://en.wikipedia.org/wiki/Harmonic_series_(music)'},
  qFactor: {title: 'Wikipedia: Q factor', url: 'https://en.wikipedia.org/wiki/Q_factor'},
  sampling: {title: 'Wikipedia: Sampling (signal processing)', url: 'https://en.wikipedia.org/wiki/Sampling_(signal_processing)'},
  nyquist: {title: 'Wikipedia: Nyquist-Shannon sampling theorem', url: 'https://en.wikipedia.org/wiki/Nyquist%E2%80%93Shannon_sampling_theorem'},
  voiceFrequency: {title: 'Wikipedia: Voice frequency', url: 'https://en.wikipedia.org/wiki/Voice_frequency'},
  window: {title: 'Wikipedia: Window function', url: 'https://en.wikipedia.org/wiki/Window_function'},
  leakage: {title: 'Wikipedia: Spectral leakage', url: 'https://en.wikipedia.org/wiki/Spectral_leakage'},
  dft: {title: 'Wikipedia: Discrete Fourier transform', url: 'https://en.wikipedia.org/wiki/Discrete_Fourier_transform'},
  stft: {title: 'Wikipedia: Short-time Fourier transform', url: 'https://en.wikipedia.org/wiki/Short-time_Fourier_transform'},
  spectrogram: {title: 'Wikipedia: Spectrogram', url: 'https://en.wikipedia.org/wiki/Spectrogram'},
  mel: {title: 'Wikipedia: Mel scale', url: 'https://en.wikipedia.org/wiki/Mel_scale'},
  mfcc: {title: 'Wikipedia: Mel-frequency cepstrum', url: 'https://en.wikipedia.org/wiki/Mel-frequency_cepstrum'},
  arpabet: {title: 'Wikipedia: ARPABET', url: 'https://en.wikipedia.org/wiki/ARPABET'},
  kaldiFeatures: {title: 'Kaldi: Feature extraction', url: 'https://kaldi-asr.org/doc/feat.html'},
  kaldiWindow: {title: 'Kaldi: feature-window.cc, frames and windows', url: 'https://kaldi-asr.org/doc/feature-window_8cc_source.html'},
  kaldiMel: {title: 'Kaldi: mel-computations.cc, the mel filter bank', url: 'https://kaldi-asr.org/doc/mel-computations_8cc_source.html'},
  psf: {title: 'python_speech_features: base.py', url: 'https://github.com/jameslyons/python_speech_features/blob/master/python_speech_features/base.py'},
  petersonBarney: {title: 'Peterson and Barney (1952): Control methods used in a study of the vowels, a course copy', url: 'https://www.ling.upenn.edu/courses/Fall_2013/ling520/PetersonBarney52.pdf'},
  pbData: {title: 'CMU Artificial Intelligence Repository: Peterson and Barney vowel formant database', url: 'https://www.cs.cmu.edu/Groups/AI/areas/speech/database/pb/0.html'},
};

/** What the synthesized voice and the recognizer take without a source, shared by both lessons. */
export const voiceLimits = 'The voice is built, not recorded: each vowel is Table II’s average pitch as a sawtooth, as the Formant page says the vocal folds’ vibration resembles, with only the harmonics below half the sample rate, standing in for the filter before sampling, through three resonances at Table II’s first three formants. Not from a source: the resonances’ bandwidths of 80, 100 and 150 Hz, nothing above the third formant, 50 ms of silence either side of two vowels of 250 ms each joined abruptly, and the loudness scaled so the largest sample is 1. Real vowels also carry breath noise, higher formants and a pitch that moves.';

/** What the recognizer takes without a source. */
export const recognizerLimits = 'Not from a source: a frame counts as silence when it is more than 30 dB quieter than the loudest, a phoneme is a run of at least 3 frames matching one vowel, and every logarithm has a floor. The stored patterns are the mean features of the same synthesized vowels, so a voice built from the averages the patterns come from matches almost perfectly; real recognizers train statistical models or neural networks on many speakers. Kaldi’s pre-emphasis, dither, offset removal and liftering are left out, and so are consonants and the language model that turns phonemes into words.';

// ---------------------------------------------------------------------------
// Speech recognition.
// ---------------------------------------------------------------------------

const heard = trial(SPEECH_DEFAULTS, 'recognizer'), spectrumView = trial(SPEECH_DEFAULTS, 'spectrum'), gram = trial(SPEECH_DEFAULTS, 'spectrogram'), filters = trial(SPEECH_DEFAULTS, 'features');

export const speechRecognitionLesson = {
  simple: 'How does a computer tell which sounds you said?',
  overview: 'A recognizer never hears words as you do. It samples the voice thousands of times a second, cuts the samples into short overlapping frames and turns each frame into a spectrum: how much of the sound lies at each frequency. It sums each spectrum into a few numbers and compares them, frame by frame, with patterns stored for each sound, then joins the frames that agree into phonemes. Press Play to listen to two vowels, then change the speaker, the stored patterns, the sample rate and the window.',
  steps: [
    {title: 'Sample the voice', body: 'A microphone turns the changing air pressure into a voltage, and the recognizer measures it at a steady rate, many thousand times a second.'},
    {title: 'Cut it into frames', body: 'It takes a short stretch of samples at a time, moving on by less than a frame so that neighbors overlap, and tapers each stretch with a window.'},
    {title: 'Take the spectrum', body: 'A discrete Fourier transform turns each frame into its power at each frequency: the voice’s harmonics, strongest near its formants.'},
    {title: 'Sum it into features', body: 'Triangular filters spaced on the mel scale add up the power, and a cosine transform of their logarithms leaves a short list of numbers for each frame.'},
    {title: 'Match and join', body: 'Each frame is compared with a stored pattern for every sound, and runs of frames that agree become phonemes, which a language model turns into likely words.'},
  ],
  parts: [
    {name: 'The voice, sampled', role: 'The whole utterance as samples, with the frame being analyzed in a box.'},
    {name: 'One frame, windowed', role: 'Samples close up, and the frame tapered by its window.'},
    {name: 'Its spectrum', role: 'The frame’s power at each frequency.'},
    {name: 'Mel filters and features', role: 'The filters that sum the spectrum, and the numbers made from them.'},
    {name: 'Spectrogram', role: 'Every frame’s spectrum in the order heard.'},
    {name: 'Matching the patterns', role: 'Each frame’s distance to every stored pattern, and what was heard.'},
    {name: 'Vowel chart', role: 'Where measured vowels sit by their first two formants.'},
  ],
  tryIt: [
    heard('Listen', 'Press Play and watch the frames being matched.', 'A man says [ɑ] as in hod, then [i] as in heed. Of the 58 frames, 6 are silence, and 45 of the 46 frames wholly inside a vowel match it. One frame near the end of [i] is nearest [ɪ], too short a run to count, so the recognizer hears [ɑ] then [i].'),
    gram('The spectrogram', 'Press Play and watch the spectrogram fill in.', 'The dark bands are the formants: [ɑ]’s first two, at 730 and 1,090 Hz, lie close together, and then they jump apart to [i]’s 270 and 2,290 Hz.'),
    spectrumView('A telephone’s samples', 'Choose 8 kHz and press Play.', 'Each frame now holds 200 samples, padded to 256, still a line every 31.25 Hz but only up to 4,000 Hz. [i]’s third formant, at 3,010 Hz, still fits below that, and all 46 frames inside a vowel match it.', {rate: 8}),
    spectrumView('No window', 'Choose the rectangular window and press Play.', 'Cut off square, a frame’s strongest sidelobe is only 13.3 dB below its main lobe, against 42.7 dB for the Hamming window, so each harmonic smears across the spectrum.', {window: 2}),
    filters('A Hann window', 'Choose the Hann window and press Play.', 'Hann’s window falls to zero at its ends, so its sidelobes fade fast, and the top filters, which hold almost none of the voice, no longer wander from frame to frame: all 46 frames inside a vowel now match it.', {window: 1}),
    heard('A child’s voice', 'Choose a child, [ɛ] as in head and [u] as in who’d, and press Play.', 'A child’s formants lie higher than a man’s: [ɛ]’s first is at 690 Hz against 530. Against patterns from men not one of the 46 frames inside a vowel matches, and the recognizer hears [æ] then [ʊ].', {speaker: 2, first: 2, second: 7}),
    heard('Patterns that fit', 'Keep the child’s [ɛ] and [u], choose patterns from children, and press Play.', 'Against patterns from children all 46 frames inside a vowel match, and the recognizer hears [ɛ] then [u]. Real recognizers adapt to the speaker instead, for example by stretching the filters’ frequencies.', {speaker: 2, templates: 2, first: 2, second: 7}),
  ],
  deeper: [
    {title: 'How often to sample', body: 'Kaldi, a widely used recognition toolkit, expects 16,000 samples a second, which the Sampling page calls wideband; telephones take 8,000, enough for speech though an s then sounds like an f. A sample rate keeps only frequencies below half of it, so 16,000 samples a second keep the voice up to 8,000 Hz, and the filter before sampling removes the rest.'},
    {title: 'Frames and windows', body: 'Over a short time, about 10 ms by the Speech recognition page, speech can be taken as unchanging, so Kaldi takes 25 ms frames every 10 ms. Cutting a frame out of the voice smears each harmonic across the spectrum, and a window softens the cut: Hamming’s 0.54 − 0.46 cos(2πn/(N − 1)) keeps its strongest sidelobe 42.7 dB down but stops at 0.08 at its ends, so its far sidelobes fade slowly, while Hann’s 0.5 − 0.5 cos(2πn/(N − 1)) reaches zero and they fade fast.'},
    {title: 'The transform', body: 'The discrete Fourier transform of N samples is X_k = Σ x_n e^(−i2πkn/N), one line for each k. Padded with zeros to 512, the 400 samples of a frame give lines 31.25 Hz apart: the padding adds no detail, only lines closer together. Its power at a line is the square of the transform’s size there.'},
    {title: 'The mel scale', body: 'Listeners judge pitches on the mel scale to be equally far apart, and it grows more slowly above about 500 Hz. Kaldi uses m = 1127 ln(1 + f/700), the same as the Mel scale page’s 2595 log10(1 + f/700): 440 Hz is 549.64 mels either way. Its 23 filters are spaced evenly in mels, so the first spans 20 to 186 Hz and the last 6,369 to 8,000 Hz.'},
    {title: 'Cepstral coefficients', body: 'The Mel-frequency cepstrum page lists the steps: the Fourier transform of a windowed frame, the powers summed onto the mel scale with triangular windows, their logarithms, and a cosine transform. A logarithm turns the source’s harmonics times the vocal tract’s resonances into a sum, and the cosine transform gathers the resonances’ smooth outline into the first few numbers. Kaldi keeps 13; the zeroth follows only loudness, so the model matches on the other 12.'},
    {title: 'From phonemes to words', body: 'The English phonology page puts English’s consonant phonemes at 24 and Received Pronunciation’s vowels at 20, 44 in all, though General American has 14 to 16 vowels. A recognizer joins its phonemes into words, and a language model, which predicts likely sequences of words, settles between words that sound alike. Here two vowels stand in for a word, with no language model.'},
  ],
  misconception: 'A recognizer does not hear whole words the way you do. It sees only numbers: short frames of the voice turned into spectra and then into features, compared with stored patterns one frame at a time.',
  limits: `The charts are not to scale, and the recognizer takes the voice in 20 times slower than speech. ${voiceLimits} ${recognizerLimits}`,
  sources: [sources.speechRecognition, sources.kaldiFeatures, sources.kaldiWindow, sources.kaldiMel, sources.psf, sources.sampling, sources.nyquist, sources.voiceFrequency, sources.window, sources.leakage, sources.dft, sources.stft, sources.spectrogram, sources.mel, sources.mfcc, sources.formant, sources.petersonBarney, sources.pbData, sources.englishPhonology, sources.languageModel, sources.sawtooth, sources.qFactor],
  quiz: {
    question: 'Why does a recognizer cut the voice into short frames?',
    options: ['Over a short stretch a voice holds still enough for one spectrum to describe it.', 'Short frames need less microphone.', 'The transform works only on the silence between words.'],
    answer: 0,
    explanation: 'Kaldi takes 25 ms frames every 10 ms: over about 10 ms, the Speech recognition page says, speech can be taken as unchanging.',
  },
};

// ---------------------------------------------------------------------------
// Phonemes.
// ---------------------------------------------------------------------------

const chart = trial(SPEECH_DEFAULTS, 'vowels'), heardSpectrum = trial(SPEECH_DEFAULTS, 'spectrum'), heardGram = trial(SPEECH_DEFAULTS, 'spectrogram');

export const phonemesLesson = {
  simple: 'What makes one vowel sound different from another?',
  overview: 'Your vocal folds buzz at one pitch whatever vowel you say. Your jaw, tongue and lips shape the tube above them, and its resonances, the formants, strengthen some of the buzz’s harmonics and weaken others. Each vowel has its own formants, and so its own spectrum, which is how a listener or a recognizer tells it apart. Change the vowels and the speaker and watch the vowel chart, the spectrum and the spectrogram.',
  steps: [
    {title: 'A buzz', body: 'The vocal folds open and close many times a second, making a buzz rich in harmonics at whole multiples of its pitch.'},
    {title: 'A shaped tube', body: 'The jaw, tongue and lips shape the vocal tract, and its resonances are the formants.'},
    {title: 'Open and close', body: 'The first formant rises as the mouth opens: low for [i] as in heed and [u] as in who’d, high for [ɑ] as in hod.'},
    {title: 'Front and back', body: 'The second formant falls as the tongue moves back and the lips round: high for [i], low for [u].'},
    {title: 'A category, not a sound', body: 'Men, women and children say the same vowel with different formants, and listeners still hear one phoneme.'},
  ],
  parts: [
    {name: 'Vowel chart', role: 'Measured vowels by their first two formants.'},
    {name: 'Its spectrum', role: 'The harmonics of one frame, strongest near the formants.'},
    {name: 'Spectrogram', role: 'The formants as dark bands through time.'},
    {name: 'The voice, sampled', role: 'The two vowels as sound.'},
  ],
  tryIt: [
    chart('Open against close', 'Look at the vowel chart.', 'A man’s [ɑ] as in hod has its first formant at 730 Hz and his [i] as in heed at 270 Hz, so the open vowel sits low on the chart and the close one high.'),
    chart('Front against back', 'Choose [i] as in heed, then [u] as in who’d.', '[i]’s second formant is at 2,290 Hz and [u]’s at 870 Hz, so front [i] sits at the left of the chart and back, rounded [u] at the right.', {first: 0, second: 7}),
    heardSpectrum('Formants in the spectrum', 'Choose [i] as in heed, then [u] as in who’d, and press Play.', 'Watch the marks above the spectrum: in [i] the strong harmonics gather near 270 Hz and again near 2,290 Hz, and in [u] near 300 Hz and 870 Hz.', {first: 0, second: 7}),
    chart('A child’s vowels', 'Choose a child.', 'A child’s [ɑ] has its first formant at 1,030 Hz against a man’s 730 Hz, half an octave higher, and a pitch of 256 Hz against 124 Hz.', {speaker: 2}),
    heardGram('[ɝ] as in heard', 'Choose [ɝ] as in heard, and press Play.', 'Its third formant, at 1,690 Hz, sits just above its second at 1,350 Hz and far below every other vowel’s, the lowest of which is 2,240 Hz.', {first: 9}),
    chart('Many speakers, one vowel', 'Look at the small dots.', 'Each dot is one vowel one speaker said. Of the 1,520, 1,210 lie nearer their own vowel’s average for their own speakers than any other’s, in the first two formants; measured against men’s averages, only 69 of the children’s 300 do.'),
    heardGram('Close vowels', 'Choose [ɑ] as in hod, then [ɔ] as in hawed, and press Play.', 'Their formants lie close together: 730 and 1,090 Hz against 570 and 840 Hz. Peterson and Barney’s listeners heard [ɑ] as [ɔ] 1,013 times out of 10,273.', {first: 4, second: 5}),
  ],
  deeper: [
    {title: 'Source and filter', body: 'The Source-filter model page describes speech as a sound source, such as the vocal cords, passed through a linear filter, the vocal tract. The Formant page says the vocal folds’ vibration resembles a sawtooth wave, rich in harmonics, and the model’s voice is a sawtooth’s harmonics passed through three resonances at the measured formants.'},
    {title: 'Measured vowels', body: 'Peterson and Barney recorded 33 men, 28 women and 15 children, each reading heed, hid, head, had, hod, hawed, hood, who’d, hud and heard twice: 1,520 words. Table II gives their average formants. The dots are the single measurements, from a later verified copy of the data whose averages differ from Table II by up to 83 Hz.'},
    {title: 'Height and backness', body: 'The Vowel page says the first formant corresponds to how open a vowel is, higher for open vowels, and the second to how far back it is, higher for front vowels, with rounding lowering it further. The position of the jaw, lips and tongue sets the resonances.'},
    {title: 'Larger speakers, lower formants', body: 'Peterson and Barney found children’s formants highest, women’s in between and men’s lowest, with children’s first formants about half an octave above men’s: [ɑ]’s 1,030 Hz against 730 Hz is 0.50 octave.'},
    {title: 'What listeners heard', body: 'Peterson and Barney played the words to 70 listeners. Of their 102,780 judgments 94.4% named the vowel the speaker meant; the commonest mix-ups were [ɑ] heard as [ɔ], 1,013 times, and [ɛ] heard as [æ], 949 times.'},
    {title: 'How many phonemes', body: 'A phoneme is a set of similar sounds that speakers hear as one sound and that tells one word from another, as the Phoneme page puts it. The English phonology page counts 24 consonant phonemes and 20 vowels in Received Pronunciation, 44 in all, though General American has 14 to 16 vowels.'},
  ],
  misconception: 'A vowel is not set by its pitch. A child says [ɑ] about an octave above a man, yet it is the same vowel, because the formants the mouth shapes, not the pitch, make the vowel.',
  limits: `Only the ten vowels Peterson and Barney measured are modeled, each held steady, and consonants are left out. ${voiceLimits}`,
  sources: [sources.phoneme, sources.englishPhonology, sources.vowel, sources.formant, sources.sourceFilter, sources.sawtooth, sources.harmonics, sources.petersonBarney, sources.pbData, sources.arpabet, sources.spectrogram],
  quiz: {
    question: 'Why do a man and a child saying heed sound like the same vowel?',
    options: ['Their formants fall in the same pattern for that vowel, though a child’s are higher.', 'They say it at the same pitch.', 'Every speaker’s vowel has exactly the same spectrum.'],
    answer: 0,
    explanation: 'Table II gives [i] its first two formants at 270 and 2,290 Hz for men and at 370 and 3,200 Hz for children: a low first formant and a high second for both.',
  },
};
