export const chartTheme = {
  background: '#f8fafc', grid: '#e5eaf0', baseline: '#bac7d3', signal: '#315f86', envelope: '#a45140', muted: '#95a3af',
}

// The same sequential scale is used for STFT, Mel and the displayed color key.
const stops = [[248, 250, 252], [221, 233, 241], [151, 190, 205], [72, 128, 160], [29, 64, 95]]
export const intensityColors = new Uint8ClampedArray(256 * 3)
for (let value = 0; value < 256; value += 1) {
  const position = value / 255 * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(position))
  for (let channel = 0; channel < 3; channel += 1) {
    intensityColors[value * 3 + channel] = Math.round(stops[index][channel] + (stops[index + 1][channel] - stops[index][channel]) * (position - index))
  }
}
