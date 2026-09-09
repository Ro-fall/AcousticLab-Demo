import { ref, shallowRef } from 'vue'

export function useMicrophone() {
  const timeAnalyser = shallowRef<AnalyserNode | null>(null)
  const frequencyAnalyser = shallowRef<AnalyserNode | null>(null)
  const isListening = ref(false)
  const error = ref('')
  const sampleRate = ref(0)
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let observationMs = 80
  let fftSize = 4096

  function setObservationWindow(milliseconds: number) {
    observationMs = milliseconds
    if (!context || !timeAnalyser.value) return
    const requiredSamples = (context.sampleRate * observationMs) / 1000
    const size = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384].find((value) => value >= requiredSamples) ?? 32768
    timeAnalyser.value.fftSize = size
  }

  function setFftSize(nextSize: number) {
    fftSize = nextSize
    if (frequencyAnalyser.value) frequencyAnalyser.value.fftSize = fftSize
  }

  async function preparePipeline() {
    stop()
    context = new AudioContext()
    await context.resume()
    const nextTimeAnalyser = context.createAnalyser()
    const nextFrequencyAnalyser = context.createAnalyser()
    nextTimeAnalyser.smoothingTimeConstant = 0
    nextFrequencyAnalyser.smoothingTimeConstant = 0
    timeAnalyser.value = nextTimeAnalyser
    frequencyAnalyser.value = nextFrequencyAnalyser
    sampleRate.value = context.sampleRate
    setObservationWindow(observationMs)
    setFftSize(fftSize)
    return { nextTimeAnalyser, nextFrequencyAnalyser }
  }

  function connectSource(source: AudioNode, pipeline: { nextTimeAnalyser: AnalyserNode; nextFrequencyAnalyser: AnalyserNode }) {
    source.connect(pipeline.nextTimeAnalyser)
    source.connect(pipeline.nextFrequencyAnalyser)
    // Keep generated/file signals active without playing them through speakers.
    const silentOutput = context!.createGain()
    silentOutput.gain.value = 0
    pipeline.nextFrequencyAnalyser.connect(silentOutput)
    silentOutput.connect(context!.destination)
    isListening.value = true
  }

  async function startMicrophone() {
    error.value = ''
    try {
      const pipeline = await preparePipeline()
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      const source = context!.createMediaStreamSource(stream)
      connectSource(source, pipeline)
    } catch (cause) {
      error.value = cause instanceof Error ? `麦克风开启失败：${cause.message}` : '麦克风开启失败，请检查浏览器权限。'
      stop()
    }
  }

  async function startSine(frequency: number) {
    error.value = ''
    try {
      const pipeline = await preparePipeline()
      const oscillator = context!.createOscillator()
      oscillator.type = 'sine'
      oscillator.frequency.value = frequency
      connectSource(oscillator, pipeline)
      oscillator.start()
    } catch (cause) {
      error.value = cause instanceof Error ? `测试信号开启失败：${cause.message}` : '测试信号开启失败。'
      stop()
    }
  }

  async function startFile(file: File) {
    error.value = ''
    try {
      const pipeline = await preparePipeline()
      const data = await file.arrayBuffer()
      const buffer = await context!.decodeAudioData(data)
      const source = context!.createBufferSource()
      source.buffer = buffer
      source.loop = true
      connectSource(source, pipeline)
      source.start()
    } catch (cause) {
      error.value = cause instanceof Error ? `音频文件读取失败：${cause.message}` : '音频文件读取失败。'
      stop()
    }
  }

  function stop() {
    stream?.getTracks().forEach((track) => track.stop())
    stream = null
    timeAnalyser.value = null
    frequencyAnalyser.value = null
    if (context && context.state !== 'closed') void context.close()
    context = null
    isListening.value = false
    sampleRate.value = 0
  }

  return { timeAnalyser, frequencyAnalyser, error, isListening, sampleRate, setObservationWindow, setFftSize, startMicrophone, startSine, startFile, stop }
}
