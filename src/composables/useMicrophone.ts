import { ref, shallowRef } from 'vue'

export function useMicrophone() {
  const analyser = shallowRef<AnalyserNode | null>(null)
  const isListening = ref(false)
  const error = ref('')
  const sampleRate = ref(0)
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let observationMs = 80

  function setObservationWindow(milliseconds: number) {
    observationMs = milliseconds
    if (!context || !analyser.value) return
    const requiredSamples = (context.sampleRate * observationMs) / 1000
    const fftSize = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384]
      .find((size) => size >= requiredSamples) ?? 32768
    analyser.value.fftSize = fftSize
  }

  async function start() {
    error.value = ''
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      context = new AudioContext()
      const source = context.createMediaStreamSource(stream)
      const nextAnalyser = context.createAnalyser()
      nextAnalyser.smoothingTimeConstant = 0
      source.connect(nextAnalyser)
      analyser.value = nextAnalyser
      sampleRate.value = context.sampleRate
      setObservationWindow(observationMs)
      isListening.value = true
    } catch (cause) {
      error.value = cause instanceof Error ? `麦克风开启失败：${cause.message}` : '麦克风开启失败，请检查浏览器权限。'
      stop()
    }
  }

  function stop() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    analyser.value = null
    if (context && context.state !== 'closed') void context.close()
    context = null
    isListening.value = false
    sampleRate.value = 0
  }

  return { analyser, error, isListening, sampleRate, setObservationWindow, start, stop }
}
