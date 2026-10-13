import { onBeforeUnmount, ref, shallowRef } from 'vue'

/** Owns the audio session; views never create or stop audio nodes. */
export function useAudioInput() {
  const timeAnalyser = shallowRef<AnalyserNode | null>(null)
  const frequencyAnalyser = shallowRef<AnalyserNode | null>(null)
  const isListening = ref(false)
  const isPaused = ref(false)
  const isLoading = ref(false)
  const error = ref('')
  const sampleRate = ref(0)
  const fileDuration = ref(0)
  const filePosition = ref(0)
  const revision = ref(0)
  let context: AudioContext | null = null
  let stream: MediaStream | null = null
  let source: AudioScheduledSourceNode | null = null
  let oscillator: OscillatorNode | null = null
  let amplitude: GainNode | null = null
  let buffer: AudioBuffer | null = null
  let startedAt = 0
  let offset = 0
  let observationMs = 80
  let fftSize = 4096
  let session = 0
  let timer = 0

  function setObservationWindow(milliseconds: number) {
    observationMs = milliseconds
    if (!context || !timeAnalyser.value) return
    const required = context.sampleRate * milliseconds / 1000
    timeAnalyser.value.fftSize = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768].find(n => n >= required) ?? 32768
  }

  function setFftSize(size: number) {
    fftSize = size
    if (frequencyAnalyser.value) frequencyAnalyser.value.fftSize = size
  }

  function stop() {
    session += 1
    cancelAnimationFrame(timer)
    stream?.getTracks().forEach(track => track.stop())
    stream = null
    source?.stop()
    source = oscillator = null
    amplitude = null
    buffer = null
    timeAnalyser.value = frequencyAnalyser.value = null
    if (context && context.state !== 'closed') void context.close()
    context = null
    isListening.value = isPaused.value = isLoading.value = false
    sampleRate.value = fileDuration.value = filePosition.value = 0
  }

  async function prepare() {
    stop()
    error.value = ''
    isLoading.value = true
    const token = session
    const nextContext = new AudioContext()
    context = nextContext
    await nextContext.resume()
    if (token !== session) return null
    timeAnalyser.value = nextContext.createAnalyser()
    frequencyAnalyser.value = nextContext.createAnalyser()
    timeAnalyser.value.smoothingTimeConstant = frequencyAnalyser.value.smoothingTimeConstant = 0
    const silent = nextContext.createGain()
    silent.gain.value = 0
    frequencyAnalyser.value.connect(silent).connect(nextContext.destination)
    sampleRate.value = nextContext.sampleRate
    setObservationWindow(observationMs)
    setFftSize(fftSize)
    return { context: nextContext, token }
  }

  function connect(node: AudioNode) {
    node.connect(timeAnalyser.value!)
    node.connect(frequencyAnalyser.value!)
  }

  function ready() {
    isLoading.value = false
    isListening.value = true
    revision.value += 1
  }

  function fail(cause: unknown) {
    error.value = cause instanceof Error ? cause.message : '无法读取输入，请重试。'
    stop()
  }

  async function startMicrophone() {
    const token = session + 1
    try {
      const current = await prepare()
      if (!current) return
      const nextStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
      if (current.token !== session) { nextStream.getTracks().forEach(track => track.stop()); return }
      stream = nextStream
      connect(current.context.createMediaStreamSource(nextStream))
      ready()
    } catch (cause) { if (token === session) fail(cause) }
  }

  function setSignal(frequency: number, type: 'sine' | 'square', gain: number) {
    if (!context || !oscillator || !amplitude) return
    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, context.currentTime)
    amplitude.gain.setValueAtTime(gain, context.currentTime)
  }

  async function startSignal(frequency: number, type: 'sine' | 'square', gain: number) {
    const token = session + 1
    try {
      const current = await prepare()
      if (!current) return
      oscillator = current.context.createOscillator()
      amplitude = current.context.createGain()
      oscillator.connect(amplitude)
      connect(amplitude)
      setSignal(frequency, type, gain)
      source = oscillator
      oscillator.start()
      ready()
    } catch (cause) { if (token === session) fail(cause) }
  }

  function updatePosition() {
    if (context && buffer) {
      filePosition.value = (offset + context.currentTime - startedAt) % buffer.duration
      timer = requestAnimationFrame(updatePosition)
    }
  }

  function seek(seconds: number) {
    if (!context || !buffer) return
    source?.stop()
    source?.disconnect()
    const nextSource = context.createBufferSource()
    nextSource.buffer = buffer
    nextSource.loop = true
    connect(nextSource)
    offset = Math.max(0, Math.min(seconds, buffer.duration - 0.001))
    startedAt = context.currentTime
    nextSource.start(0, offset)
    source = nextSource
    filePosition.value = offset
    revision.value += 1
  }

  async function startFile(file: File) {
    const token = session + 1
    try {
      const current = await prepare()
      if (!current) return
      const decoded = await current.context.decodeAudioData(await file.arrayBuffer())
      if (current.token !== session) return
      buffer = decoded
      fileDuration.value = decoded.duration
      seek(0)
      ready()
      updatePosition()
    } catch (cause) { if (token === session) fail(cause) }
  }

  async function togglePause() {
    if (!context || !isListening.value) return
    const current = context
    try {
      if (isPaused.value) { await current.resume(); if (context === current) isPaused.value = false }
      else { await current.suspend(); if (context === current) isPaused.value = true }
    } catch (cause) { error.value = cause instanceof Error ? cause.message : '暂停失败，请重试。' }
  }

  onBeforeUnmount(stop)
  return { timeAnalyser, frequencyAnalyser, isListening, isPaused, isLoading, error, sampleRate, fileDuration, filePosition, revision, setObservationWindow, setFftSize, setSignal, startMicrophone, startSignal, startFile, seek, togglePause, stop }
}
