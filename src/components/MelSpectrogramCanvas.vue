<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; sampleRate: number; minFrequency: number; maxFrequency: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const bands = 48
let frame = 0
let lastUpdate = 0
let history = new Uint8Array(0)
let historyWidth = 0
let writeColumn = 0

const colors = new Uint8ClampedArray(256 * 3)
const stops = [[8, 18, 38], [47, 34, 131], [49, 110, 204], [33, 204, 190], [224, 245, 103], [255, 183, 56]]
for (let value = 0; value < 256; value += 1) {
  const position = (value / 255) * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(position))
  const fraction = position - index
  for (let channel = 0; channel < 3; channel += 1) colors[value * 3 + channel] = Math.round(stops[index][channel] + (stops[index + 1][channel] - stops[index][channel]) * fraction)
}
const toMel = (hertz: number) => 2595 * Math.log10(1 + hertz / 700)
const toHertz = (mel: number) => 700 * (10 ** (mel / 2595) - 1)

function reset(width: number) { historyWidth = width; history = new Uint8Array(width * bands); writeColumn = 0 }

function store() {
  const values = new Float32Array(props.analyser?.frequencyBinCount ?? 1024)
  props.analyser?.getFloatFrequencyData(values)
  const nyquist = props.sampleRate / 2 || 22050
  const minMel = toMel(Math.max(0, props.minFrequency))
  const maxMel = toMel(Math.min(nyquist, props.maxFrequency))
  for (let band = 0; band < bands; band += 1) {
    const start = toHertz(minMel + ((maxMel - minMel) * band) / bands)
    const end = toHertz(minMel + ((maxMel - minMel) * (band + 1)) / bands)
    const startBin = Math.max(0, Math.floor((start / nyquist) * values.length))
    const endBin = Math.min(values.length, Math.max(startBin + 1, Math.ceil((end / nyquist) * values.length)))
    let power = 0
    for (let bin = startBin; bin < endBin; bin += 1) power += 10 ** (values[bin] / 10)
    const decibels = 10 * Math.log10(Math.max(power, 1e-12))
    const normalized = props.active ? Math.max(0, Math.min(1, (decibels + 90) / 78)) : 0
    history[writeColumn * bands + band] = Math.round(normalized * 255)
  }
  writeColumn = (writeColumn + 1) % historyWidth
}

function render(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#081226'; ctx.fillRect(0, 0, width, height)
  const columnWidth = width / historyWidth
  const bandHeight = height / bands
  for (let x = 0; x < historyWidth; x += 1) {
    const source = (writeColumn + x) % historyWidth
    for (let band = 0; band < bands; band += 1) {
      const color = history[source * bands + band] * 3
      ctx.fillStyle = `rgb(${colors[color]} ${colors[color + 1]} ${colors[color + 2]})`
      ctx.fillRect(x * columnWidth, height - (band + 1) * bandHeight, Math.ceil(columnWidth), Math.ceil(bandHeight))
    }
  }
}

function draw(now: number) {
  const element = canvas.value
  if (!element) return
  const width = Math.max(1, Math.floor(element.clientWidth))
  const height = Math.max(1, Math.floor(element.clientHeight))
  if (element.width !== width || element.height !== height) { element.width = width; element.height = height; reset(width) }
  if (now - lastUpdate > 48) { store(); render(element.getContext('2d')!, width, height); lastUpdate = now }
  frame = requestAnimationFrame(draw)
}
onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><canvas ref="canvas" class="signal-canvas mel-spectrogram" aria-label="Mel 声谱图"></canvas></template>
