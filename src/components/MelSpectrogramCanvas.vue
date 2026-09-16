<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AnalysisFrame } from '../composables/useAnalysisFrames'

const props = defineProps<{ frame: AnalysisFrame | null }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const bands = 48
let frame = 0
let lastUpdate = 0
let history = new Uint8Array(0)
let historyWidth = 0
let writeColumn = 0
let lastAnalysisFrame: AnalysisFrame | null = null

const colors = new Uint8ClampedArray(256 * 3)
const stops = [[8, 18, 38], [47, 34, 131], [49, 110, 204], [33, 204, 190], [224, 245, 103], [255, 183, 56]]
for (let value = 0; value < 256; value += 1) {
  const position = (value / 255) * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(position))
  const fraction = position - index
  for (let channel = 0; channel < 3; channel += 1) colors[value * 3 + channel] = Math.round(stops[index][channel] + (stops[index + 1][channel] - stops[index][channel]) * fraction)
}

function reset(width: number) { historyWidth = width; history = new Uint8Array(width * bands); writeColumn = 0 }

function store() {
  const values = props.frame?.melDb ?? new Float32Array(bands).fill(-100)
  for (let band = 0; band < bands; band += 1) {
    const normalized = Math.max(0, Math.min(1, (values[band] + 90) / 78))
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
  if (now - lastUpdate > 48) {
    // Store only new shared frames, so Mel and STFT advance on the same data.
    if (props.frame && props.frame !== lastAnalysisFrame) { store(); lastAnalysisFrame = props.frame }
    render(element.getContext('2d')!, width, height); lastUpdate = now
  }
  frame = requestAnimationFrame(draw)
}
onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><canvas ref="canvas" class="signal-canvas mel-spectrogram" aria-label="Mel 声谱图"></canvas></template>
