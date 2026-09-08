<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; sampleRate: number; minFrequency: number; maxFrequency: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0

function draw() {
  const element = canvas.value
  if (!element) return
  const ratio = window.devicePixelRatio || 1
  const width = element.clientWidth
  const height = element.clientHeight
  if (element.width !== width * ratio || element.height !== height * ratio) { element.width = width * ratio; element.height = height * ratio }
  const ctx = element.getContext('2d')!
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.fillStyle = '#0a1323'; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(152, 177, 211, .14)'; ctx.lineWidth = 1
  for (let x = 0; x <= width; x += width / 6) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = 0; y <= height; y += height / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
  const bins = new Float32Array(props.analyser?.frequencyBinCount ?? 1024)
  props.analyser?.getFloatFrequencyData(bins)
  const nyquist = props.sampleRate / 2 || 22050
  const startBin = Math.max(0, Math.floor((props.minFrequency / nyquist) * bins.length))
  const endBin = Math.min(bins.length, Math.max(startBin + 1, Math.ceil((props.maxFrequency / nyquist) * bins.length)))
  const barWidth = width / (endBin - startBin)
  for (let bin = startBin; bin < endBin; bin += 1) {
    const normalized = props.active ? Math.max(0, Math.min(1, (bins[bin] + 100) / 100)) : 0
    const barHeight = normalized * height
    const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight)
    gradient.addColorStop(0, '#2cae91'); gradient.addColorStop(1, '#8ef0d4')
    ctx.fillStyle = gradient
    ctx.fillRect((bin - startBin) * barWidth, height - barHeight, Math.max(1, barWidth - .5), barHeight)
  }
  frame = requestAnimationFrame(draw)
}
onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><canvas ref="canvas" class="signal-canvas spectrum" aria-label="实时频谱"></canvas></template>
