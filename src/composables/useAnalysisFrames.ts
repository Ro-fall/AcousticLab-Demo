import { onBeforeUnmount, shallowRef, watch, type Ref } from 'vue'

export type AnalysisFrame = {
  spectrumDb: Float32Array
  melDb: Float32Array
  mfcc: Float32Array
  rms: number
  peak: number
  dominantFrequency: number
  level: number
}

function fft(real: Float64Array, imaginary: Float64Array) {
  const size = real.length
  for (let index = 1, reversed = 0; index < size; index += 1) {
    let bit = size >> 1
    for (; reversed & bit; bit >>= 1) reversed ^= bit
    reversed ^= bit
    if (index < reversed) {
      const tempReal = real[index]; real[index] = real[reversed]; real[reversed] = tempReal
      const tempImaginary = imaginary[index]; imaginary[index] = imaginary[reversed]; imaginary[reversed] = tempImaginary
    }
  }
  for (let block = 2; block <= size; block <<= 1) {
    const angle = -2 * Math.PI / block; const stepReal = Math.cos(angle); const stepImaginary = Math.sin(angle)
    for (let start = 0; start < size; start += block) {
      let rotationReal = 1; let rotationImaginary = 0
      for (let offset = 0; offset < block / 2; offset += 1) {
        const even = start + offset; const odd = even + block / 2
        const oddReal = real[odd] * rotationReal - imaginary[odd] * rotationImaginary
        const oddImaginary = real[odd] * rotationImaginary + imaginary[odd] * rotationReal
        real[odd] = real[even] - oddReal; imaginary[odd] = imaginary[even] - oddImaginary
        real[even] += oddReal; imaginary[even] += oddImaginary
        const nextReal = rotationReal * stepReal - rotationImaginary * stepImaginary
        rotationImaginary = rotationReal * stepImaginary + rotationImaginary * stepReal; rotationReal = nextReal
      }
    }
  }
}

const toMel = (hertz: number) => 2595 * Math.log10(1 + hertz / 700)
const toHertz = (mel: number) => 700 * (10 ** (mel / 2595) - 1)

export function useAnalysisFrames(analyser: Ref<AnalyserNode | null>, sampleRate: Ref<number>, minFrequency: Readonly<Ref<number>>, maxFrequency: Readonly<Ref<number>>) {
  const frame = shallowRef<AnalysisFrame | null>(null)
  let animation = 0; let lastUpdate = 0

  function calculate(source: AnalyserNode) {
    const size = source.fftSize
    const samples = new Float32Array(size)
    source.getFloatTimeDomainData(samples)
    const real = new Float64Array(size); const imaginary = new Float64Array(size)
    let squaredTotal = 0; let peak = 0
    for (let index = 0; index < size; index += 1) {
      const sample = samples[index]
      squaredTotal += sample * sample; peak = Math.max(peak, Math.abs(sample))
      // Hann window: all spectral products below use this exact frame.
      real[index] = sample * (.5 - .5 * Math.cos((2 * Math.PI * index) / (size - 1)))
    }
    fft(real, imaginary)
    const bins = size / 2
    const spectrumDb = new Float32Array(bins)
    const nyquist = sampleRate.value / 2 || 22050
    let strongest = 1
    for (let bin = 0; bin < bins; bin += 1) {
      const magnitude = Math.hypot(real[bin], imaginary[bin]) * 2 / size
      spectrumDb[bin] = 20 * Math.log10(Math.max(magnitude, 1e-8))
      if (bin > 0 && spectrumDb[bin] > spectrumDb[strongest]) strongest = bin
    }
    const melBands = 48; const melDb = new Float32Array(melBands)
    const lowMel = toMel(Math.max(0, minFrequency.value)); const highMel = toMel(Math.min(nyquist, maxFrequency.value))
    const melPoints = Array.from({ length: melBands + 2 }, (_, index) => toHertz(lowMel + ((highMel - lowMel) * index) / (melBands + 1)))
    for (let band = 0; band < melBands; band += 1) {
      const left = melPoints[band]; const center = melPoints[band + 1]; const right = melPoints[band + 2]
      let energy = 0
      const start = Math.max(0, Math.floor((left / nyquist) * bins)); const end = Math.min(bins - 1, Math.ceil((right / nyquist) * bins))
      for (let bin = start; bin <= end; bin += 1) {
        const frequency = (bin / bins) * nyquist
        const weight = frequency <= center ? (frequency - left) / Math.max(center - left, 1) : (right - frequency) / Math.max(right - center, 1)
        energy += Math.max(0, weight) * 10 ** (spectrumDb[bin] / 10)
      }
      melDb[band] = 10 * Math.log10(Math.max(energy, 1e-12))
    }
    const mfcc = new Float32Array(13)
    for (let coefficient = 0; coefficient < mfcc.length; coefficient += 1) {
      for (let band = 0; band < melBands; band += 1) mfcc[coefficient] += melDb[band] * Math.cos((Math.PI * coefficient * (band + .5)) / melBands)
    }
    const rms = Math.sqrt(squaredTotal / size)
    return { spectrumDb, melDb, mfcc, rms, peak, dominantFrequency: strongest * sampleRate.value / size, level: 20 * Math.log10(Math.max(rms, 1e-6)) }
  }

  function update(now: number) {
    if (analyser.value && now - lastUpdate >= 40) { frame.value = calculate(analyser.value); lastUpdate = now }
    animation = requestAnimationFrame(update)
  }
  watch(analyser, (next) => { if (!next) frame.value = null })
  animation = requestAnimationFrame(update)
  onBeforeUnmount(() => cancelAnimationFrame(animation))
  return { frame }
}
