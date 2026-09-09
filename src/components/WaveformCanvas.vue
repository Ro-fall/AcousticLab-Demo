<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{ analyser: AnalyserNode | null; active: boolean; durationMs: number; showEnvelope: boolean }>()
const canvas = ref<HTMLCanvasElement | null>(null)
let frame = 0
let envelope = new Float32Array(0)
let lastEnvelopeUpdate = 0

function transform(real: Float64Array, imaginary: Float64Array, inverse = false) {
  const size = real.length
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1
    for (; reversed & bit; bit >>= 1) reversed ^= bit
    reversed ^= bit
    if (index < reversed) {
      const temporaryReal = real[index]; real[index] = real[reversed]; real[reversed] = temporaryReal
      const temporaryImaginary = imaginary[index]; imaginary[index] = imaginary[reversed]; imaginary[reversed] = temporaryImaginary
    }
  }
  for (let block = 2; block <= size; block <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / block
    const stepReal = Math.cos(angle); const stepImaginary = Math.sin(angle)
    for (let start = 0; start < size; start += block) {
      let rotationReal = 1; let rotationImaginary = 0
      for (let offset = 0; offset < block / 2; offset += 1) {
        const even = start + offset; const odd = even + block / 2
        const oddReal = real[odd] * rotationReal - imaginary[odd] * rotationImaginary
        const oddImaginary = real[odd] * rotationImaginary + imaginary[odd] * rotationReal
        real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImaginary
        real[even] += oddReal; imaginary[even] += oddImaginary
        const nextReal = rotationReal * stepReal - rotationImaginary * stepImaginary
        rotationImaginary = rotationReal * stepImaginary + rotationImaginary * stepReal
        rotationReal = nextReal
      }
    }
  }
  if (inverse) for (let index = 0; index < size; index += 1) { real[index] /= size; imaginary[index] /= size }
}

function calculateHilbertEnvelope(samples: Float32Array) {
  const real = new Float64Array(samples)
  const imaginary = new Float64Array(samples.length)
  transform(real, imaginary)
  const half = samples.length / 2
  for (let index = 1; index < half; index += 1) { real[index] *= 2; imaginary[index] *= 2 }
  for (let index = half + 1; index < samples.length; index += 1) { real[index] = 0; imaginary[index] = 0 }
  transform(real, imaginary, true)
  envelope = new Float32Array(samples.length)
  for (let index = 0; index < samples.length; index += 1) envelope[index] = Math.hypot(real[index], imaginary[index])
}

function draw(now: number) {
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
  const data = new Float32Array(points)
  props.analyser?.getFloatTimeDomainData(data)
  if (props.showEnvelope && props.active && (envelope.length !== points || now - lastEnvelopeUpdate > 50)) {
    calculateHilbertEnvelope(data)
    lastEnvelopeUpdate = now
  }
  ctx.beginPath(); ctx.strokeStyle = props.active ? '#55e6bd' : '#6c7c94'; ctx.lineWidth = 2
  const columns = Math.max(2, Math.floor(width))
  for (let column = 0; column < columns; column += 1) {
    const index = Math.min(points - 1, Math.floor((column / (columns - 1)) * (points - 1)))
    const x = (column / (columns - 1)) * width
    const y = props.active ? data[index] * (height * 0.42) + height / 2 : height / 2
    column === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()

  if (props.showEnvelope && props.active) {
    ctx.beginPath(); ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 1.25
    for (let column = 0; column < columns; column += 1) {
      const index = Math.min(points - 1, Math.floor((column / (columns - 1)) * (points - 1)))
      const x = (column / (columns - 1)) * width
      const y = height / 2 - envelope[index] * (height * 0.42)
      column === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.beginPath()
    for (let column = 0; column < columns; column += 1) {
      const index = Math.min(points - 1, Math.floor((column / (columns - 1)) * (points - 1)))
      const x = (column / (columns - 1)) * width
      const y = height / 2 + envelope[index] * (height * 0.42)
      column === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  frame = requestAnimationFrame(draw)
}

onMounted(() => { frame = requestAnimationFrame(draw) })
onBeforeUnmount(() => cancelAnimationFrame(frame))
watch(() => props.durationMs, () => undefined)
</script>

<template><canvas ref="canvas" class="waveform" aria-label="实时音频时域波形"></canvas></template>
