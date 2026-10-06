import * as THREE from 'three';

export const CDROM_SCREEN_WIDTH = 768, CDROM_SCREEN_HEIGHT = 576;

export function createCdromScreen() {
  const canvas = typeof document === 'undefined' ? null : document.createElement('canvas');
  if (canvas) { canvas.width = CDROM_SCREEN_WIDTH; canvas.height = CDROM_SCREEN_HEIGHT; }
  const context = canvas?.getContext('2d') ?? null;
  const texture = canvas ? new THREE.CanvasTexture(canvas) : new THREE.DataTexture(Uint8Array.of(245, 243, 234, 255), 1, 1);
  texture.colorSpace = THREE.SRGBColorSpace; texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  return { canvas, context, texture, key: null, rendered: null, paintCount: 0 };
}

export function paintCdromScreen(surface, state) {
  const s = state, key = [s.values.content, s.values.location, s.values.loss, s.values.laser, s.role, s.checkedSectors, s.volumeReady, s.directoryReady, s.fileReady, s.error].join(':');
  if (surface.key === key) return;
  surface.key = key; surface.paintCount++;
  surface.rendered = { available: s.fileReady, name: s.fileReady ? s.entry.name : null, bytes: s.file?.length ?? 0, type: s.output?.type ?? null, error: s.error, role: s.role };
  const c = surface.context;
  if (!c) return;
  c.fillStyle = '#f5f3ea'; c.fillRect(0, 0, CDROM_SCREEN_WIDTH, CDROM_SCREEN_HEIGHT);
  c.fillStyle = '#263f40'; c.fillRect(0, 0, CDROM_SCREEN_WIDTH, 64);
  c.fillStyle = '#ffffff'; c.textAlign = 'left'; c.textBaseline = 'middle'; c.font = 'bold 28px sans-serif';
  c.fillText(s.fileReady ? s.entry.name.replace(';1', '') : 'CD-ROM FILE READER', 28, 33);
  c.fillStyle = '#263f40';
  if (!s.output) {
    c.font = 'bold 29px sans-serif'; c.fillText(!s.values.laser ? 'No light, no retrieved data' : s.error ? 'File unavailable' : s.seeking ? 'Moving to the next address' : 'Reading stored data', 34, 114);
    const stages = [['1', 'Read volume', s.volumeReady], ['2', 'Find directory', s.directoryReady], ['3', 'Retrieve file', s.fileReady]];
    stages.forEach(([number, title, ready], i) => {
      const y = 186 + 93 * i;
      c.fillStyle = ready ? '#d5e5d4' : '#e5e5dc'; c.fillRect(34, y - 28, 700, 70);
      c.fillStyle = '#263f40'; c.font = 'bold 28px sans-serif'; c.fillText(`${number}  ${title}`, 55, y + 7);
      c.textAlign = 'right'; c.font = '23px sans-serif'; c.fillText(ready ? 'Checked' : s.error || !s.values.laser ? 'Unavailable' : 'Waiting', 710, y + 7); c.textAlign = 'left';
    });
    c.font = '21px sans-serif';
    const lines = !s.values.laser ? ['The stored disc pattern remains.', 'The reader cannot recover sectors without light.'] : s.error ?
      (s.directoryReady ? ['At least one file sector failed its checks.', 'No incomplete text, picture or data file is opened.'] : ['The directory cannot supply a reliable file address.', 'No file can be opened from unknown metadata.']) :
      s.directoryReady ? [`Found ${s.entry.name.replace(';1', '')} at sector ${s.entry.extent}.`, `${s.entry.size.toLocaleString('en-US')} bytes across ${s.entry.sectorCount} sector${s.entry.sectorCount === 1 ? '' : 's'}.`] :
      s.volumeReady ? [`${s.volume.name} points to directory sector ${s.volume.root.extent}.`, 'The directory supplies each file name and location.'] : ['Press Play to follow light into a stored file.', 'Only checked, retrieved bytes supply the result.'];
    lines.forEach((line, i) => c.fillText(line, 34, 483 + 31 * i));
  } else if (s.output.type === 'text') {
    c.font = '22px monospace';
    s.output.text.split(/\r?\n/).forEach((line, i) => c.fillText(line, 30, 107 + i * 31));
  } else if (s.output.type === 'picture') {
    const picture = document.createElement('canvas'); picture.width = s.output.width; picture.height = s.output.height;
    const context = picture.getContext('2d'), pixels = context.createImageData(s.output.width, s.output.height); pixels.data.set(s.output.rgba); context.putImageData(pixels, 0, 0);
    c.imageSmoothingEnabled = false; c.drawImage(picture, 96, 104, 576, 384);
    c.font = '20px sans-serif'; c.fillText(`${s.output.width} × ${s.output.height} pixels from recovered BMP bytes`, 96, 513);
  } else if (s.output.type === 'data') {
    const points = s.output.points, xMin = Math.min(...points.map(p => p[0])), xMax = Math.max(...points.map(p => p[0]));
    const yMax = Math.ceil(Math.max(...points.map(p => p[1])) / 10) * 10, px = x => 90 + (x - xMin) / Math.max(1, xMax - xMin) * 598, py = y => 445 - y / Math.max(1, yMax) * 316;
    c.font = '22px sans-serif'; c.fillText('Example temperature data from the CSV', 90, 101);
    c.lineWidth = 2; c.strokeStyle = '#b1c1ba'; c.font = '18px sans-serif';
    for (let value = 0; value <= yMax; value += 10) { c.beginPath(); c.moveTo(90, py(value)); c.lineTo(688, py(value)); c.stroke(); c.fillText(String(value), 50, py(value)); }
    c.strokeStyle = '#347e90'; c.lineWidth = 5; c.beginPath(); points.forEach(([x, y], i) => { if (i) c.lineTo(px(x), py(y)); else c.moveTo(px(x), py(y)); }); c.stroke();
    points.forEach(([x, y]) => { c.fillStyle = '#bd8046'; c.beginPath(); c.arc(px(x), py(y), 6, 0, 2 * Math.PI); c.fill(); c.fillStyle = '#263f40'; c.textAlign = 'center'; c.fillText(String(x), px(x), 470); c.fillText(String(y), px(x), py(y) - 18); });
    c.textAlign = 'left'; c.font = '20px sans-serif'; c.fillText(s.output.yLabel, 36, 78); c.fillText(s.output.xLabel, 350, 512);
  }
  c.fillStyle = '#e1e7dc'; c.fillRect(0, 544, CDROM_SCREEN_WIDTH, 32); c.fillStyle = '#263f40'; c.font = '17px sans-serif'; c.textAlign = 'left';
  c.fillText(s.fileReady ? `${s.file.length.toLocaleString('en-US')} retrieved bytes · all file sectors checked` : `${s.checkedSectors} sectors checked · file waits for complete data`, 25, 561);
  surface.texture.needsUpdate = true;
}
