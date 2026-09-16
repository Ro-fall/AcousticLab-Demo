<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AnalysisFrame } from '../composables/useAnalysisFrames'

const props = defineProps<{ frame: AnalysisFrame | null }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const coefficientCount = 13
let frame = 0

function draw() {
  const element = canvas.value
  if (!element) return
  const ratio = window.devicePixelRatio || 1; const width = element.clientWidth; const height = element.clientHeight
  if (element.width !== width * ratio || element.height !== height * ratio) { element.width = width * ratio; element.height = height * ratio }
  const ctx = element.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = '#081226'; ctx.fillRect(0, 0, width, height)
  const values = props.frame ? Array.from(props.frame.mfcc) : Array(coefficientCount).fill(0)
  const extent = Math.max(1, ...values.map((value) => Math.abs(value)))
  const baseline = height / 2; ctx.strokeStyle = 'rgba(152,177,211,.25)'; ctx.beginPath(); ctx.moveTo(0, baseline); ctx.lineTo(width, baseline); ctx.stroke()
  const barWidth = width / coefficientCount
  values.forEach((value, index) => { const barHeight = (Math.abs(value) / extent) * height * .42; ctx.fillStyle = value >= 0 ? '#58e5bd' : '#f38b7b'; ctx.fillRect(index * barWidth + 2, value >= 0 ? baseline - barHeight : baseline, Math.max(2, barWidth - 4), barHeight) })
  frame = requestAnimationFrame(draw)
}
onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
</script>

<template><canvas ref="canvas" class="signal-canvas mfcc" aria-label="MFCC 系数"></canvas></template>
