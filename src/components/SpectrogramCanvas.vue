<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; sampleRate: number; minFrequency: number; maxFrequency: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0
let lastUpdate = 0
let history = new Uint8Array(0)
let historyWidth = 0
let historyHeight = 0
let writeColumn = 0

const stops = [[10, 19, 35], [37, 36, 128], [37, 102, 204], [25, 201, 207], [183, 239, 112], [255, 198, 72]]
const colorLut = new Uint8ClampedArray(256 * 3)

for (let value = 0; value < 256; value += 1) {
  const position = (value / 255) * (stops.length - 1)
  const index = Math.min(stops.length - 2, Math.floor(position))
  const fraction = position - index
  for (let component = 0; component < 3; component += 1) {
    colorLut[value * 3 + component] = Math.round(stops[index][component] + (stops[index + 1][component] - stops[index][component]) * fraction)
  }
}

function reset(width: number, height: number) {
  historyWidth = width
  historyHeight = height
  history = new Uint8Array(width * height)
  writeColumn = 0
}

function render(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const pixels = ctx.createImageData(width, height)
  for (let x = 0; x < width; x += 1) {
    const sourceColumn = (writeColumn + x) % width
    for (let y = 0; y < height; y += 1) {
      const color = history[sourceColumn * height + y] * 3
      const pixel = (y * width + x) * 4
      pixels.data[pixel] = colorLut[color]; pixels.data[pixel + 1] = colorLut[color + 1]; pixels.data[pixel + 2] = colorLut[color + 2]; pixels.data[pixel + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
}

function storeSpectrum() {
  const bins = new Float32Array(props.analyser?.frequencyBinCount ?? 1024)
  props.analyser?.getFloatFrequencyData(bins)
  for (let y = 0; y < historyHeight; y += 1) {
    const progress = (historyHeight - 1 - y) / Math.max(1, historyHeight - 1)
    const frequency = props.minFrequency + progress * (props.maxFrequency - props.minFrequency)
    const bin = Math.min(bins.length - 1, Math.max(0, Math.round((frequency / (props.sampleRate / 2 || 22050)) * bins.length)))
    const normalized = props.active ? Math.max(0, Math.min(1, (bins[bin] + 92) / 70)) : 0
    history[writeColumn * historyHeight + y] = Math.round(normalized * 255)
  }
  writeColumn = (writeColumn + 1) % historyWidth
}

function draw(now: number) {
  const element = canvas.value
  if (!element) return
  const ratio = window.devicePixelRatio || 1
  const width = Math.max(1, Math.round(element.clientWidth * ratio))
  const height = Math.max(1, Math.round(element.clientHeight * ratio))
  if (element.width !== width || element.height !== height) { element.width = width; element.height = height; reset(width, height) }
  if (now - lastUpdate > 45) { storeSpectrum(); render(element.getContext('2d')!, width, height); lastUpdate = now }
  frame = requestAnimationFrame(draw)
}

watch(() => props.active, (active) => { if (!active && historyWidth && historyHeight) reset(historyWidth, historyHeight) })
onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><canvas ref="canvas" class="signal-canvas spectrogram" aria-label="实时声谱图"></canvas></template>
