<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import AnalysisPanel from './components/AnalysisPanel.vue'
import SignalSourcePanel, { type InputMode } from './components/SignalSourcePanel.vue'
import LabReference from './components/LabReference.vue'
import WaveformCanvas from './components/WaveformCanvas.vue'
import SpectrumCanvas from './components/SpectrumCanvas.vue'
import HeatmapCanvas from './components/HeatmapCanvas.vue'
import MfccCanvas from './components/MfccCanvas.vue'
import { useAudioInput } from './composables/useAudioInput'
import { useAnalysisFrames } from './composables/useAnalysisFrames'
import { experiments } from './data/lab'

const audio = useAudioInput()
const { timeAnalyser, frequencyAnalyser, isListening, isPaused, isLoading, error, sampleRate, fileDuration, filePosition, revision } = audio
const page = ref<'workspace' | 'reference'>('workspace')
const mode = ref<InputMode>('microphone')
const signalType = ref<'sine' | 'square'>('sine')
const frequency = ref(1000)
const amplitude = ref(0.8)
const experiment = ref('custom')
const selectedFile = shallowRef<File | null>(null)
const duration = ref(40)
const showEnvelope = ref(true)
const showFeatures = ref(true)
const fftSize = ref(4096)
const frequencyMin = ref(0)
const frequencyMax = ref(10000)
const melMin = ref(0)
const melMax = ref(10000)
const expanded = ref<string | null>(null)
const exportMessage = ref('')
const nyquist = computed(() => (sampleRate.value || 48000) / 2)
const displayMin = computed(() => Math.max(0, Math.min(Number(frequencyMin.value) || 0, nyquist.value - 100)))
const displayMax = computed(() => Math.min(nyquist.value, Math.max(Number(frequencyMax.value) || 10000, displayMin.value + 100)))
const analysisMin = computed(() => Math.max(0, Math.min(Number(melMin.value) || 0, nyquist.value - 100)))
const analysisMax = computed(() => Math.min(nyquist.value, Math.max(Number(melMax.value) || 10000, analysisMin.value + 100)))
const frameDuration = computed(() => (1000 * fftSize.value / (sampleRate.value || 48000)).toFixed(1))
const resolution = computed(() => ((sampleRate.value || 48000) / fftSize.value).toFixed(2))
const ticks = computed(() => Array.from({ length: 5 }, (_, i) => displayMin.value + i * (displayMax.value - displayMin.value) / 4))
const guide = computed(() => experiments.find(item => item.id === experiment.value)?.guide)
const validSignal = computed(() => Number.isFinite(frequency.value) && frequency.value >= 20 && frequency.value <= Math.min(20000, nyquist.value) && Number.isFinite(amplitude.value) && amplitude.value > 0 && amplitude.value <= 1)
const sourceTitle = computed(() => mode.value === 'microphone' ? '实时采集' : mode.value === 'file' ? '文件分析' : '信号实验')
const sourceDetail = computed(() => mode.value === 'microphone' ? '电脑麦克风' : mode.value === 'file' ? selectedFile.value?.name || '尚未选择文件' : `${signalType.value === 'sine' ? '正弦波' : '方波'} / ${frequency.value} Hz`)
const status = computed(() => isLoading.value ? '准备输入' : error.value ? '输入错误' : isPaused.value ? '分析已暂停' : isListening.value ? '分析中' : '待开始')
const { frame } = useAnalysisFrames(frequencyAnalyser, sampleRate, analysisMin, analysisMax, isPaused)
const historyKey = computed(() => `${revision.value}-${fftSize.value}`)
const axisFrequency = (value: number) => value >= 1000 ? `${Number((value / 1000).toFixed(1))} kHz` : `${Math.round(value)} Hz`
const readoutFrequency = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`
const toggleExpanded = (id: string) => { expanded.value = expanded.value === id ? null : id }

watch(duration, audio.setObservationWindow, { immediate: true })
watch(fftSize, audio.setFftSize, { immediate: true })
watch([frequency, signalType, amplitude], () => { if (validSignal.value) audio.setSignal(frequency.value, signalType.value, amplitude.value) })
watch([mode, frequency, signalType, fftSize, amplitude], () => { exportMessage.value = '' })

function changeMode(next: InputMode) {
  if (mode.value === next) return
  audio.stop()
  mode.value = next
}
function applyExperiment(id: string) {
  experiment.value = id
  const item = experiments.find(entry => entry.id === id)
  if (!item) return
  changeMode('signal')
  frequency.value = item.frequency
  signalType.value = item.type
  fftSize.value = item.fftSize
  frequencyMin.value = 0
  frequencyMax.value = item.maxFrequency
  page.value = 'workspace'
}
async function start() {
  exportMessage.value = ''
  if (mode.value === 'microphone') await audio.startMicrophone()
  else if (mode.value === 'file' && selectedFile.value) await audio.startFile(selectedFile.value)
  else if (mode.value === 'signal' && validSignal.value) await audio.startSignal(frequency.value, signalType.value, amplitude.value)
}
async function selectFile(file: File) {
  selectedFile.value = file
  await audio.startFile(file)
}
function exportFrame() {
  if (!frame.value) return
  const current = frame.value
  const rows = [
    'parameter,value',
    `sample_rate_hz,${sampleRate.value}`, `fft_size,${fftSize.value}`, 'window,Hann', 'update_limit_hz,25',
    `mel_min_hz,${analysisMin.value}`, `mel_max_hz,${analysisMax.value}`, 'mel_bands,48', 'mfcc_method,DCT-II unnormalized on log10 power dB',
    `rms,${current.rms}`, `peak,${current.peak}`, `dominant_frequency_hz,${current.dominantFrequency}`, `level_dbfs,${current.level}`,
    '', 'frequency_hz,amplitude_dbfs', ...Array.from(current.spectrumDb, (value, i) => `${i * sampleRate.value / fftSize.value},${value}`),
    '', 'mel_band,energy_db', ...Array.from(current.melDb, (value, i) => `${i},${value}`),
    '', 'mfcc_coefficient,value', ...Array.from(current.mfcc, (value, i) => `${i},${value}`),
  ]
  const url = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `acousticlab-frame-${Date.now()}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  exportMessage.value = '已导出当前帧与分析参数'
}
function onKey(event: KeyboardEvent) { if (event.key === 'Escape') expanded.value = null }
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="lab-app">
    <header class="app-header">
      <a class="brand" href="#" @click.prevent="page = 'workspace'"><span class="brand-mark" aria-hidden="true">∿</span><span>AcousticLab <small>Demo</small></span></a>
      <nav aria-label="主导航"><button :class="{ active: page === 'workspace' }" :aria-current="page === 'workspace' ? 'page' : undefined" @click="page = 'workspace'">分析台</button><button :class="{ active: page === 'reference' }" :aria-current="page === 'reference' ? 'page' : undefined" @click="page = 'reference'">名词与实验</button></nav>
      <span class="local-note">浏览器本地处理</span>
    </header>

    <main v-show="page === 'workspace'" class="lab-layout">
      <aside class="lab-sidebar" aria-label="输入与分析设置">
        <SignalSourcePanel :mode="mode" :frequency="frequency" :signal-type="signalType" :amplitude="amplitude" :file-name="selectedFile?.name || ''" :file-duration="fileDuration" :file-position="filePosition" :busy="isLoading" :paused="isPaused" :experiment="experiment" @mode="changeMode" @frequency="frequency = $event; experiment = 'custom'" @signal-type="signalType = $event; experiment = 'custom'" @amplitude="amplitude = $event" @file="selectFile" @seek="audio.seek" @experiment="applyExperiment" />
        <section class="sidebar-section">
          <h2>显示与分析</h2>
          <label class="field">FFT 点数<select v-model.number="fftSize" :disabled="isPaused"><option v-for="size in [1024, 2048, 4096, 8192, 16384]" :key="size" :value="size">{{ size.toLocaleString() }}</option></select></label>
          <div class="range-pair"><span>显示频率范围 / Hz</span><label><span class="sr-only">显示最低频率</span><input v-model.number="frequencyMin" type="number" min="0" :max="nyquist - 100" step="100" /></label><span>—</span><label><span class="sr-only">显示最高频率</span><input v-model.number="frequencyMax" type="number" :min="displayMin + 100" :max="nyquist" step="100" /></label></div>
          <label class="field window-field">时域窗口<span>{{ duration }} ms</span><input v-model.number="duration" :disabled="isPaused" type="range" min="20" max="200" step="10" /></label>
          <label class="check-field"><input v-model="showEnvelope" type="checkbox" />Hilbert 包络<span class="legend-line envelope-line"></span></label>
          <label class="check-field"><input v-model="showFeatures" type="checkbox" />显示 Mel 与 MFCC</label>
          <details class="advanced-settings"><summary>特征参数与方法</summary><div class="range-pair"><span>Mel 分析范围 / Hz</span><label><span class="sr-only">Mel 最低频率</span><input v-model.number="melMin" :disabled="isPaused" type="number" min="0" :max="nyquist - 100" step="100" /></label><span>—</span><label><span class="sr-only">Mel 最高频率</span><input v-model.number="melMax" :disabled="isPaused" type="number" :min="analysisMin + 100" :max="nyquist" step="100" /></label></div><dl><div><dt>窗函数</dt><dd>Hann</dd></div><div><dt>分析帧长</dt><dd>{{ frameDuration }} ms</dd></div><div><dt>频率间隔</dt><dd>{{ resolution }} Hz</dd></div><div><dt>更新上限</dt><dd>25 Hz</dd></div><div><dt>Mel 滤波器</dt><dd>48 个</dd></div><div><dt>MFCC</dt><dd>DCT-II / 13 维</dd></div></dl><p>显示范围只改变图形。特征参数决定 Mel 与 MFCC 的计算结果。当前使用实时帧读取。</p></details>
        </section>
        <div class="sidebar-foot"><span>采样率</span><strong>{{ sampleRate ? `${sampleRate / 1000} kHz` : '等待输入' }}</strong></div>
      </aside>

      <div class="workspace">
        <header class="workspace-toolbar"><div class="session-title"><h1>{{ sourceTitle }}</h1><span>{{ sourceDetail }}</span></div><div class="session-actions"><span class="session-status" :class="{ running: isListening && !isPaused, paused: isPaused, danger: error }" role="status"><i></i>{{ status }}</span><button v-if="isLoading" @click="audio.stop">取消</button><template v-else-if="isListening"><button @click="audio.togglePause">{{ isPaused ? '继续分析' : '暂停分析' }}</button><button @click="audio.stop">停止</button></template><button v-else class="primary-button" :disabled="(mode === 'file' && !selectedFile) || (mode === 'signal' && !validSignal)" @click="start">{{ mode === 'microphone' ? '开启麦克风' : '开始分析' }}</button></div></header>
        <p v-if="error" class="feedback error-feedback" role="alert">{{ error }} <span>检查输入文件或浏览器麦克风权限后重试。</span></p>
        <p v-if="mode === 'signal' && !validSignal" class="feedback error-feedback">频率应在 20–{{ Math.min(20000, nyquist) }} Hz 之间，振幅应大于 0 且不超过 1。</p>
        <div v-if="!isListening && !isLoading" class="welcome-strip"><span class="welcome-icon" aria-hidden="true">∿</span><div><strong>{{ mode === 'microphone' ? '从一段声音开始' : mode === 'file' ? '带入你的录音' : '用已知信号验证分析结果' }}</strong><p>{{ mode === 'microphone' ? '开启麦克风后，波形、频谱与声谱图会同步显示。也可以先试试左侧的信号实验。' : mode === 'file' ? '在左侧选择音频，随后可暂停分析、调整位置并导出当前帧。' : '选择预设或调节波形与频率，然后开始分析。' }}</p></div></div>
        <div v-if="mode === 'signal' && guide" class="experiment-guide"><span>观察提示</span><p>{{ guide }}</p></div>

        <section class="readout-strip" aria-label="当前分析帧读数"><div><span>有效幅度 <small>RMS</small></span><strong>{{ frame ? frame.rms.toFixed(3) : '—' }}</strong></div><div><span>峰值 <small>Peak</small></span><strong>{{ frame ? frame.peak.toFixed(3) : '—' }}</strong></div><div><span>主频</span><strong>{{ frame ? readoutFrequency(frame.dominantFrequency) : '—' }}</strong></div><div><span>数字电平 <small>dBFS</small></span><strong>{{ frame ? frame.level.toFixed(1) : '—' }}</strong></div><button :disabled="!frame" @click="exportFrame">导出当前帧 ↓</button></section>
        <p v-if="exportMessage" class="export-feedback" role="status">{{ exportMessage }}</p>

        <section class="waveform-panel"><header class="panel-heading"><h2>时域波形</h2><div class="waveform-legend"><span><i class="legend-line"></i>原始信号</span><span v-if="showEnvelope"><i class="legend-line envelope-line"></i>包络</span></div></header><WaveformCanvas :analyser="timeAnalyser" :active="isListening" :paused="isPaused" :sample-rate="sampleRate" :duration-ms="duration" :show-envelope="showEnvelope" /><div class="axis-row"><span>−{{ duration }} ms</span><span>当前时刻</span></div></section>

        <div class="plots-grid" :class="{ 'has-expanded': expanded }">
          <AnalysisPanel title="频谱" :detail="`${axisFrequency(displayMin)} – ${axisFrequency(displayMax)}`" :expanded="expanded === 'spectrum'" @expand="toggleExpanded('spectrum')"><div class="spectrum-chart"><div class="vertical-axis"><span>0 dBFS</span><span>−50</span><span>−100</span></div><div class="plot-body"><SpectrumCanvas :frame="frame" :sample-rate="sampleRate" :min-frequency="displayMin" :max-frequency="displayMax" /><div class="axis-row"><span v-for="tick in ticks" :key="tick">{{ axisFrequency(tick) }}</span></div></div></div></AnalysisPanel>
          <AnalysisPanel title="声谱图" detail="STFT / 最近 240 帧" :expanded="expanded === 'stft'" @expand="toggleExpanded('stft')"><div class="spectrogram-chart"><div class="vertical-axis"><span v-for="tick in [...ticks].reverse()" :key="tick">{{ axisFrequency(tick) }}</span></div><div class="plot-body"><HeatmapCanvas :key="historyKey" kind="stft" :frame="frame" :sample-rate="sampleRate" :min-frequency="displayMin" :max-frequency="displayMax" /><div class="axis-row"><span>过去</span><span>分析帧</span><span>现在</span></div></div></div><div class="intensity-legend"><span>−100 dB</span><i></i><span>0 dB</span></div></AnalysisPanel>
          <AnalysisPanel v-show="showFeatures" title="Mel 声谱图" :detail="`${axisFrequency(analysisMin)} – ${axisFrequency(analysisMax)}`" :expanded="expanded === 'mel'" @expand="toggleExpanded('mel')"><div class="spectrogram-chart"><div class="vertical-axis"><span>47</span><span>Mel 带</span><span>0</span></div><div class="plot-body"><HeatmapCanvas :key="`${historyKey}-${analysisMin}-${analysisMax}`" kind="mel" :frame="frame" /><div class="axis-row"><span>过去</span><span>48 个滤波器</span><span>现在</span></div></div></div></AnalysisPanel>
          <AnalysisPanel v-show="showFeatures" title="MFCC" detail="13 维 / 当前帧" :expanded="expanded === 'mfcc'" @expand="toggleExpanded('mfcc')"><MfccCanvas :frame="frame" /><div class="axis-row"><span>C0</span><span>C6</span><span>C12</span></div><p class="plot-note">柱高按当前帧缩放；精确数值可导出。</p></AnalysisPanel>
        </div>
        <footer class="workspace-footer"><span>Hann 窗 · {{ fftSize.toLocaleString() }} 点 FFT · {{ resolution }} Hz / bin</span><span>数字电平未经声压校准</span></footer>
      </div>
    </main>
    <LabReference v-show="page === 'reference'" @experiment="applyExperiment" />
  </div>
</template>
