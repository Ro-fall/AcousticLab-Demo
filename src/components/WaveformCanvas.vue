<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; durationMs: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0

function draw() {
  const element = canvas.value
  if (!element) return
  const ratio = window.devicePixelRatio || 1
  const width = element.clientWidth
  const height = element.clientHeight
  if (element.width !== width * ratio || element.height !== height * ratio) {
    element.width = width * ratio; element.height = height * ratio
  }
  const ctx = element.getContext('2d')!
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#0a1323'; ctx.fillRect(0, 0, width, height)
  ctx.strokeStyle = 'rgba(152, 177, 211, .14)'; ctx.lineWidth = 1
  for (let x = 0; x <= width; x += width / 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke() }
  for (let y = 0; y <= height; y += height / 4) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke() }
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.beginPath(); ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2); ctx.stroke()

  const points = props.analyser?.fftSize ?? 2048
  const data = new Uint8Array(points)
  props.analyser?.getByteTimeDomainData(data)
  ctx.beginPath(); ctx.strokeStyle = props.active ? '#55e6bd' : '#6c7c94'; ctx.lineWidth = 2
  const columns = Math.max(2, Math.floor(width))
  for (let column = 0; column < columns; column += 1) {
    const index = Math.min(points - 1, Math.floor((column / (columns - 1)) * (points - 1)))
    const x = (column / (columns - 1)) * width
    const y = props.active ? ((data[index] - 128) / 128) * (height * 0.42) + height / 2 : height / 2
    column === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  frame = requestAnimationFrame(draw)
}

onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
watch(() => props.durationMs, () => undefined)
</script>

<template><canvas ref="canvas" class="waveform" aria-label="实时音频时域波形"></canvas></template>
