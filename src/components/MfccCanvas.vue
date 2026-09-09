<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; sampleRate: number; minFrequency: number; maxFrequency: number }>()
const canvas = ref<HTMLCanvasElement | null>(null)
const melBands = 32
const coefficientCount = 13
let frame = 0
const toMel = (hertz: number) => 2595 * Math.log10(1 + hertz / 700)
const toHertz = (mel: number) => 700 * (10 ** (mel / 2595) - 1)

function coefficients() {
  const values = new Float32Array(props.analyser?.frequencyBinCount ?? 1024)
  props.analyser?.getFloatFrequencyData(values)
  const nyquist = props.sampleRate / 2 || 22050
  const minMel = toMel(Math.max(0, props.minFrequency)); const maxMel = toMel(Math.min(nyquist, props.maxFrequency))
  const energies = Array.from({ length: melBands }, (_, band) => {
    const start = toHertz(minMel + ((maxMel - minMel) * band) / melBands)
    const end = toHertz(minMel + ((maxMel - minMel) * (band + 1)) / melBands)
    const startBin = Math.max(0, Math.floor((start / nyquist) * values.length)); const endBin = Math.min(values.length, Math.max(startBin + 1, Math.ceil((end / nyquist) * values.length)))
    let power = 0; for (let bin = startBin; bin < endBin; bin += 1) power += 10 ** (values[bin] / 10)
    return Math.log(Math.max(power, 1e-12))
  })
  return Array.from({ length: coefficientCount }, (_, coefficient) => energies.reduce((sum, energy, band) => sum + energy * Math.cos((Math.PI * coefficient * (band + .5)) / melBands), 0))
}

function draw() {
  const element = canvas.value
  if (!element) return
  const ratio = window.devicePixelRatio || 1; const width = element.clientWidth; const height = element.clientHeight
  if (element.width !== width * ratio || element.height !== height * ratio) { element.width = width * ratio; element.height = height * ratio }
  const ctx = element.getContext('2d')!; ctx.setTransform(ratio, 0, 0, ratio, 0, 0); ctx.fillStyle = '#081226'; ctx.fillRect(0, 0, width, height)
  const values = props.active ? coefficients() : Array(coefficientCount).fill(0)
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
