<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AnalysisFrame } from '../composables/useAnalysisFrames'
import { intensityColors } from '../lib/chartTheme'

const props = defineProps<{ frame: AnalysisFrame | null; kind: 'stft' | 'mel'; sampleRate?: number; minFrequency?: number; maxFrequency?: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
// Keep actual frames, not screen pixels: resizing or enlarging preserves history.
const capacity = 240
let history: Float32Array[] = []
let version = 0
let renderedVersion = -1
let animation = 0
watch(() => props.frame, next => {
  if (!next) history = []
  else {
    history.push(props.kind === 'mel' ? next.melDb : next.spectrumDb)
    if (history.length > capacity) history.shift()
  }
  version += 1
}, { immediate: true })
watch(() => [props.sampleRate, props.minFrequency, props.maxFrequency], () => { version += 1 })

function draw() {
  const element = canvas.value
  if (!element) return
  animation = requestAnimationFrame(draw)
  if (element.clientWidth < 1 || element.clientHeight < 1) return
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.round(element.clientWidth * ratio)
  const height = Math.round(element.clientHeight * ratio)
  const resized = element.width !== width || element.height !== height
  if (!resized && renderedVersion === version) return
  if (resized) { element.width = width; element.height = height }
  const ctx = element.getContext('2d')!
  const pixels = ctx.createImageData(width, height)
  for (let x = 0; x < width; x += 1) {
    const index = Math.floor(x / width * capacity) - (capacity - history.length)
    const values = history[index]
    for (let y = 0; y < height; y += 1) {
      const progress = (height - 1 - y) / Math.max(1, height - 1)
      let value = -100
      if (values) {
        const nyquist = (props.sampleRate || 48000) / 2
        const frequency = (props.minFrequency || 0) + progress * ((props.maxFrequency || nyquist) - (props.minFrequency || 0))
        const bin = props.kind === 'mel' ? Math.round(progress * (values.length - 1)) : Math.round(frequency / nyquist * values.length)
        value = values[Math.min(values.length - 1, Math.max(0, bin))]
      }
      const color = Math.round(Math.max(0, Math.min(1, (value + 100) / 100)) * 255) * 3
      const pixel = (y * width + x) * 4
      pixels.data[pixel] = intensityColors[color]
      pixels.data[pixel + 1] = intensityColors[color + 1]
      pixels.data[pixel + 2] = intensityColors[color + 2]
      pixels.data[pixel + 3] = 255
    }
  }
  ctx.putImageData(pixels, 0, 0)
  renderedVersion = version
}
onMounted(() => { animation = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(animation))
</script>
<template><canvas ref="canvas" class="signal-canvas" :aria-label="kind === 'mel' ? 'Mel 声谱图' : '实时声谱图'"></canvas></template>
