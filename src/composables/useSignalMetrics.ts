import { onBeforeUnmount, ref, watch, type Ref } from 'vue'

export function useSignalMetrics(analyser: Ref<AnalyserNode | null>, sampleRate: Ref<number>) {
  const rms = ref<number | null>(null)
  const peak = ref<number | null>(null)
  const level = ref<number | null>(null)
  const dominantFrequency = ref<number | null>(null)
  let frame = 0

  function reset() {
    rms.value = null
    peak.value = null
    level.value = null
    dominantFrequency.value = null
  }

  function update() {
    const source = analyser.value
    if (source) {
      const samples = new Float32Array(source.fftSize)
      source.getFloatTimeDomainData(samples)
      let squaredTotal = 0
      let max = 0
      for (const sample of samples) {
        squaredTotal += sample * sample
        max = Math.max(max, Math.abs(sample))
      }
      const nextRms = Math.sqrt(squaredTotal / samples.length)
      rms.value = nextRms
      peak.value = max
      level.value = 20 * Math.log10(Math.max(nextRms, 0.000_001))

      const bins = new Float32Array(source.frequencyBinCount)
      source.getFloatFrequencyData(bins)
      let strongestBin = 1
      for (let index = 2; index < bins.length; index += 1) {
        if (bins[index] > bins[strongestBin]) strongestBin = index
      }
      dominantFrequency.value = (strongestBin * sampleRate.value) / source.fftSize
    }
    frame = requestAnimationFrame(update)
  }

  watch(analyser, (next) => {
    if (!next) reset()
  })
  frame = requestAnimationFrame(update)
  onBeforeUnmount(() => cancelAnimationFrame(frame))

  return { rms, peak, level, dominantFrequency }
}
