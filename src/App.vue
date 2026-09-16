<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WaveformCanvas from './components/WaveformCanvas.vue'
import SpectrumCanvas from './components/SpectrumCanvas.vue'
import SpectrogramCanvas from './components/SpectrogramCanvas.vue'
import MelSpectrogramCanvas from './components/MelSpectrogramCanvas.vue'
import MfccCanvas from './components/MfccCanvas.vue'
import { useMicrophone } from './composables/useMicrophone'
import { useAnalysisFrames } from './composables/useAnalysisFrames'

const { timeAnalyser, frequencyAnalyser, error, isListening, sampleRate, setObservationWindow, setFftSize, startMicrophone, startSine, startSquare, startFile, stop } = useMicrophone()
const duration = ref(80)
const showEnvelope = ref(true)
const activeTab = ref<'analysis' | 'glossary'>('analysis')
const fftSize = ref(4096)
const inputMode = ref<'microphone' | 'signal'>('microphone')
const signalMode = ref<'sine' | 'square' | 'file'>('sine')
const sineFrequency = ref(1000)
const fileName = ref('')
const frequencyMin = ref(0)
const frequencyMax = ref(10_000)
const nyquist = computed(() => Math.floor((sampleRate.value || 48_000) / 2))
const displayMin = computed(() => Math.max(0, Math.min(frequencyMin.value, frequencyMax.value - 100)))
const displayMax = computed(() => Math.min(nyquist.value, Math.max(frequencyMax.value, displayMin.value + 100)))
const spectrumTicks = computed(() => Array.from({ length: 6 }, (_, index) => displayMin.value + ((displayMax.value - displayMin.value) * index) / 5))
const spectrogramTicks = computed(() => [...spectrumTicks.value].reverse())
const frameDuration = computed(() => ((fftSize.value / (sampleRate.value || 48_000)) * 1000).toFixed(1))
const frequencyResolution = computed(() => ((sampleRate.value || 48_000) / fftSize.value).toFixed(2))
const status = computed(() => {
  if (error.value) return '输入错误'
  if (!isListening.value) return '等待输入'
  return inputMode.value === 'microphone' ? '麦克风采集中' : '信号分析中'
})

watch(duration, setObservationWindow, { immediate: true })
watch(fftSize, setFftSize, { immediate: true })
const { frame: analysisFrame } = useAnalysisFrames(frequencyAnalyser, sampleRate, displayMin, displayMax)
const formatAmplitude = (value: number | null) => value === null ? '—' : value.toFixed(3)
const formatFrequency = (value: number | null) => value === null ? '—' : value >= 1000 ? `${(value / 1000).toFixed(2)} kHz` : `${Math.round(value)} Hz`
const formatLevel = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} dBFS`
const formatAxisFrequency = (value: number) => value >= 1000 ? `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)} kHz` : `${Math.round(value)} Hz`
async function startInput() {
  if (inputMode.value === 'microphone') await startMicrophone()
  else if (signalMode.value === 'sine') await startSine(sineFrequency.value)
  else if (signalMode.value === 'square') await startSquare(sineFrequency.value)
}
function changeInputMode(nextMode: 'microphone' | 'signal') {
  if (inputMode.value !== nextMode && isListening.value) stop()
  inputMode.value = nextMode
}
function changeSignalMode() {
  if (isListening.value) stop()
}
async function handleFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  inputMode.value = 'signal'
  signalMode.value = 'file'
  await startFile(file)
}

onBeforeUnmount(stop)
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">ACOUSTICLAB / 01</p>
        <h1>声学分析台</h1>
        <p class="subtitle">{{ activeTab === 'analysis' ? '从电脑麦克风捕获声音，并在时域与频域中实时观测它。' : '把当前分析台中出现的声学与信号处理概念放在一处。' }}</p>
      </div>
      <div v-if="activeTab === 'analysis'" class="status" :class="{ active: isListening, danger: error }">
        <span class="status-dot"></span>{{ status }}
      </div>
    </header>

    <nav class="app-tabs" aria-label="页面切换"><button :class="{ active: activeTab === 'analysis' }" @click="activeTab = 'analysis'">分析台</button><button :class="{ active: activeTab === 'glossary' }" @click="activeTab = 'glossary'">名词解释</button></nav>

    <template v-if="activeTab === 'analysis'">
    <section class="dashboard">
      <div class="analysis-column">
        <div class="visualizer-card time-card">
        <div class="card-header">
          <div>
            <p class="section-kicker">LIVE SIGNAL</p>
            <h2>实时波形</h2>
          </div>
          <span class="unit">实时输入监视 · Amplitude / Time</span>
        </div>
        <WaveformCanvas :analyser="timeAnalyser" :active="isListening" :duration-ms="duration" :show-envelope="showEnvelope" />
        <div class="axis-labels"><span>−{{ duration }} ms</span><span>现在</span></div>
        </div>
        <section class="analysis-grid">
      <div class="visualizer-card compact-card">
        <div class="card-header"><div><p class="section-kicker">FFT / FREQUENCY</p><h2>实时频谱</h2></div><span class="unit">{{ formatAxisFrequency(displayMin) }}–{{ formatAxisFrequency(displayMax) }}</span></div>
        <SpectrumCanvas :frame="analysisFrame" :sample-rate="sampleRate" :min-frequency="displayMin" :max-frequency="displayMax" />
        <div class="chart-axis horizontal-axis spectrum-axis"><span v-for="tick in spectrumTicks" :key="tick">{{ formatAxisFrequency(tick) }}</span></div>
      </div>
      <div class="visualizer-card compact-card">
        <div class="card-header"><div><p class="section-kicker">STFT / HISTORY</p><h2>声谱图</h2></div><span class="unit">Time →</span></div>
        <div class="spectrogram-chart">
          <div class="chart-axis vertical-axis"><span v-for="tick in spectrogramTicks" :key="tick">{{ formatAxisFrequency(tick) }}</span></div>
          <div class="spectrogram-plot"><SpectrogramCanvas :frame="analysisFrame" :sample-rate="sampleRate" :min-frequency="displayMin" :max-frequency="displayMax" /><div class="chart-axis horizontal-axis"><span>过去</span><span>时间 →</span><span>现在</span></div></div>
        </div>
      </div>
      <div class="visualizer-card compact-card">
        <div class="card-header"><div><p class="section-kicker">MEL / PERCEPTUAL</p><h2>Mel 声谱图</h2></div><span class="unit">48 Mel bands</span></div>
        <MelSpectrogramCanvas :frame="analysisFrame" />
        <div class="chart-axis horizontal-axis"><span>过去</span><span>Mel frequency</span><span>现在</span></div>
      </div>
      <div class="visualizer-card compact-card">
        <div class="card-header"><div><p class="section-kicker">MFCC / FEATURES</p><h2>MFCC 系数</h2></div><span class="unit">13 coefficients</span></div>
        <MfccCanvas :frame="analysisFrame" />
        <div class="chart-axis horizontal-axis"><span>C0</span><span>C6</span><span>C12</span></div>
      </div>
        </section>
        <section class="metric-section">
      <div class="metric-heading"><p class="section-kicker">SIGNAL FEATURES</p><h2>实时特征</h2><span>基于当前分析帧计算</span></div>
      <div class="metrics">
        <div class="metric"><span>RMS</span><strong>{{ formatAmplitude(analysisFrame?.rms ?? null) }}</strong><small>均方根幅度</small></div>
        <div class="metric"><span>PEAK</span><strong>{{ formatAmplitude(analysisFrame?.peak ?? null) }}</strong><small>峰值幅度</small></div>
        <div class="metric"><span>DOMINANT</span><strong>{{ formatFrequency(analysisFrame?.dominantFrequency ?? null) }}</strong><small>主频</small></div>
        <div class="metric"><span>LEVEL</span><strong>{{ formatLevel(analysisFrame?.level ?? null) }}</strong><small>相对声压级（未校准）</small></div>
      </div>
        </section>
      </div>

      <aside class="control-panel">
        <div><p class="section-kicker">INPUT SOURCE</p><h2>输入源</h2></div>
        <div class="mode-tabs"><button :class="{ selected: inputMode === 'microphone' }" @click="changeInputMode('microphone')">实时采集</button><button :class="{ selected: inputMode === 'signal' }" @click="changeInputMode('signal')">测试/导入</button></div>
        <div v-if="inputMode === 'signal'" class="signal-controls">
          <label class="select-field"><span>信号类型</span><select v-model="signalMode" @change="changeSignalMode"><option value="sine">生成正弦波</option><option value="square">生成方波</option><option value="file">导入音频文件</option></select></label>
          <label v-if="signalMode !== 'file'" class="select-field number-field"><span>频率</span><input v-model.number="sineFrequency" type="number" min="20" max="20000" step="10" /><em>Hz</em></label>
          <label v-else class="file-field"><span>{{ fileName || '选择 WAV / MP3 / OGG 文件' }}</span><input type="file" accept="audio/*" @change="handleFile" /></label>
        </div>
        <button class="record-button" :class="{ stop: isListening }" :disabled="!isListening && inputMode === 'signal' && signalMode === 'file'" @click="isListening ? stop() : startInput()"><span class="record-icon"></span>{{ isListening ? '停止分析' : inputMode === 'microphone' ? '开启麦克风' : signalMode === 'file' ? '选择文件开始' : '开始信号分析' }}</button>
        <p v-if="error" class="error-message">{{ error }}</p>
        <p v-else class="help-text">实时采集会请求麦克风权限；测试信号与导入文件均只在浏览器本机分析，不上传。</p>
        <label class="range-field"><span>观测窗口</span><strong>{{ duration }} ms</strong><input v-model="duration" type="range" min="20" max="200" step="10" /></label>
        <label class="toggle-field"><span>显示 Hilbert 包络</span><input v-model="showEnvelope" type="checkbox" /><i></i></label>
        <div class="frequency-fields"><span class="field-title">显示频率范围</span><label><span>低频</span><input v-model.number="frequencyMin" type="number" min="0" :max="displayMax - 100" step="100" /><em>Hz</em></label><label><span>高频</span><input v-model.number="frequencyMax" type="number" :min="displayMin + 100" :max="nyquist" step="100" /><em>Hz</em></label></div>
        <label class="select-field"><span>FFT 点数</span><select v-model.number="fftSize"><option :value="1024">1,024</option><option :value="2048">2,048</option><option :value="4096">4,096</option><option :value="8192">8,192</option><option :value="16384">16,384</option></select></label>
        <dl class="analysis-meta"><div><dt>分析方法</dt><dd>STFT · Hann 窗</dd></div><div><dt>帧长 / 更新</dt><dd>{{ frameDuration }} ms / 25 Hz</dd></div><div><dt>频率分辨率</dt><dd>{{ frequencyResolution }} Hz/bin</dd></div><div><dt>Mel / MFCC</dt><dd>48 三角滤波器 / DCT-II 13 维</dd></div></dl>
        <dl class="signal-meta"><div><dt>采样率</dt><dd>{{ sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : '—' }}</dd></div><div><dt>显示模式</dt><dd>过去时域</dd></div></dl>
      </aside>
    </section>
    </template>

    <section v-else class="glossary">
      <div class="glossary-intro"><p class="section-kicker">ACOUSTIC GLOSSARY</p><h2>从波形到特征</h2><p>这些名词与分析台中的每一张图、每一个读数一一对应。</p></div>
      <div class="glossary-grid">
        <article><b>时域波形</b><p>信号振幅随时间变化的曲线，用来观察周期、瞬态和振幅起伏。</p></article>
        <article><b>Hilbert 包络</b><p>由解析信号的复幅值获得，表示信号的瞬时振幅轮廓。</p></article>
        <article><b>FFT</b><p>快速傅里叶变换；把时域信号分解为不同频率分量。</p></article>
        <article><b>频谱</b><p>各频率分量的幅度或能量分布。方波会呈现基频及奇次谐波。</p></article>
        <article><b>STFT / 声谱图</b><p>对连续短时窗逐帧做 FFT；横轴时间、纵轴频率、颜色表示能量。</p></article>
        <article><b>Mel 声谱图</b><p>将线性频率映射到更接近人耳感知的 Mel 频率尺度。</p></article>
        <article><b>MFCC</b><p>对对数 Mel 能量做余弦变换得到的特征，常用于语音和音色分析。</p></article>
        <article><b>RMS</b><p>均方根幅度，反映一段信号的整体有效强度。</p></article>
        <article><b>Peak</b><p>当前分析帧中的最大绝对振幅，对瞬态与削波尤其敏感。</p></article>
        <article><b>dBFS</b><p>相对数字满刻度的电平；0 dBFS 为数字系统最大值，并非物理声压级。</p></article>
        <article><b>奈奎斯特频率</b><p>采样率的一半；高于它的频率无法被当前数字采样正确表示。</p></article>
        <article><b>FFT 点数</b><p>决定频率分辨率；点数越大，频率刻度越细，但更新响应略慢。</p></article>
      </div>
    </section>

    <footer>AcousticLab Demo · 本地实时声学信号观测工具 · 声压级以 dBFS 表示，未作麦克风校准</footer>
  </main>
</template>
