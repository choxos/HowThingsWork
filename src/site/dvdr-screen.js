import { CDROM_SCREEN_WIDTH as WIDTH, CDROM_SCREEN_HEIGHT as HEIGHT } from './cdrom-screen.js';
import { dvdVideoRgba, DVD_VIDEO_WIDTH, DVD_VIDEO_HEIGHT } from './dvd-video.js';
import { DVDR_CHANNEL_CELLS } from './dvdr-medium.js';

export function paintDvdrScreen(surface, s) {
  const key = [s.requestedName, s.storedName, s.phase, s.values.medium, s.values.power, s.values.readLight,
    s.available, s.available ? s.frameIndex : -1, Math.floor(s.writeCells / DVDR_CHANNEL_CELLS * 100), Math.floor(s.readCells / DVDR_CHANNEL_CELLS * 100)].join(':');
  if (surface.key === key) return;
  surface.key = key; surface.paintCount++;
  surface.rendered = { requested: s.requestedName, stored: s.storedName, available: s.available, frame: s.available ? s.frameIndex : null,
    bytes: s.entry?.size ?? 0, phase: s.phase, occupied: s.values.medium !== 0 };
  const c = surface.context;
  if (!c) return;
  c.fillStyle = '#f5f3ea'; c.fillRect(0, 0, WIDTH, HEIGHT);
  c.fillStyle = '#263f40'; c.fillRect(0, 0, WIDTH, 64);
  c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 27px sans-serif';
  c.fillText(s.available ? s.storedName : 'DVD-R · WRITE, RETRIEVE, PLAY', 28, 33);
  if (s.available) {
    if (!surface.movie) {
      const canvas = document.createElement('canvas'); canvas.width = DVD_VIDEO_WIDTH; canvas.height = DVD_VIDEO_HEIGHT;
      const context = canvas.getContext('2d');
      surface.movie = { canvas, context, pixels: context.createImageData(DVD_VIDEO_WIDTH, DVD_VIDEO_HEIGHT) };
    }
    const movie = surface.movie;
    movie.pixels.data.set(dvdVideoRgba(s.picture)); movie.context.putImageData(movie.pixels, 0, 0);
    c.imageSmoothingEnabled = false; c.drawImage(movie.canvas, 96, 88, 576, 432);
    c.fillStyle = '#263f40'; c.font = '16px sans-serif';
    c.fillText(s.values.medium ? `Requested ${s.requestedName}; this occupied region kept ${s.storedName}` : `${s.entry.size.toLocaleString('en-US')} retrieved bytes supply this movie`, 28, 76);
  } else {
    if (surface.movie) {
      surface.movie.context.clearRect(0, 0, DVD_VIDEO_WIDTH, DVD_VIDEO_HEIGHT);
      surface.movie.pixels.data.fill(0);
    }
    c.fillStyle = '#263f40'; c.font = 'bold 27px sans-serif'; c.fillText(`Requested: ${s.requestedName}`, 34, 112);
    const steps = [['1', 'Change dye with recording pulses', s.time >= 5 && s.canWrite],
      ['2', 'Read and check stored sectors', false], ['3', 'Find the file; decode its pictures', false]];
    steps.forEach(([number, title, ready], i) => {
      const y = 172 + 76 * i;
      c.fillStyle = ready ? '#d5e5d4' : '#e5e5dc'; c.fillRect(34, y - 23, 700, 57);
      c.fillStyle = '#263f40'; c.font = '23px sans-serif'; c.fillText(`${number}  ${title}`, 49, y + 6);
    });
    const finished = s.time >= 11;
    const lines = finished ? !s.values.readLight ? ['Reading light is off; no movie can be retrieved.', s.storedMarks ? 'The recorded file remains in the dye marks.' : 'The starting region is still blank.'] :
      ['No file recovered from this blank region.', 'Reading exposure alone cannot create a recording.'] : s.seeking ?
      ['Return to the same region without erasing its marks.', s.values.readLight ? 'Next: retrieve the file using low-power reading light.' : 'Next: a dark scan cannot retrieve a file.'] : s.reading ?
      s.values.readLight ? ['Returned transitions supply checked sectors.', 'Playback waits for the complete directory and file.'] :
      ['Reading light is off. No transitions arrive.', 'Any marks written earlier remain on the disc.'] : s.values.medium ?
      ['This region already stores a file. Writing is blocked.', s.values.readLight ? 'The read pass can retrieve its previous file.' : 'Reading light is off; its file will remain unavailable.'] : s.values.power === 0 ?
      ['Recording pulses change the dye permanently.', 'The file becomes coded marks, not one mark per bit.'] :
      ['No recording exposure; blank dye stays unchanged.', 'Reading light cannot write a file.'];
    c.font = '21px sans-serif'; lines.forEach((line, i) => c.fillText(line, 34, 376 + i * 29));
    for (const [name, cells, y, color] of [['Write pass', s.writeCells, 459, '#ac7942'], ['Read pass', s.readCells, 507, '#397b94']]) {
      c.fillStyle = '#263f40'; c.font = '17px sans-serif'; c.fillText(name, 34, y - 16);
      c.fillStyle = '#dfdfd4'; c.fillRect(34, y, 700, 10); c.fillStyle = color; c.fillRect(34, y, 700 * cells / DVDR_CHANNEL_CELLS, 10);
    }
  }
  c.fillStyle = '#e1e7dc'; c.fillRect(0, 544, WIDTH, 32); c.fillStyle = '#263f40'; c.font = '17px sans-serif';
  c.fillText(s.available ? `Recovered MPEG-2 · picture ${s.frameIndex + 1} / 50 · 25 fps · 4:3 display` :
    s.time >= 11 ? 'File unavailable; no source movie is substituted' : 'Only the retrieved file can supply the movie', 25, 561);
  surface.texture.needsUpdate = true;
}
