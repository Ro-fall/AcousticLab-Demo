<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import WaveformCanvas from './components/WaveformCanvas.vue'
import { useMicrophone } from './composables/useMicrophone'

const { analyser, error, isListening, sampleRate, setObservationWindow, start, stop } = useMicrophone()
const duration = ref(80)
const status = computed(() => {
  if (error.value) return '无法访问麦克风'
  return isListening.value ? '正在采集' : '等待采集'
})

watch(duration, setObservationWindow, { immediate: true })

onBeforeUnmount(stop)
</script>

<template>
  <main class="app-shell">
    <header class="hero">
      <div>
        <p class="eyebrow">ACOUSTICLAB / 01</p>
        <h1>时域观测台</h1>
        <p class="subtitle">从电脑麦克风捕获声音，并实时查看最近的波形。</p>
      </div>
      <div class="status" :class="{ active: isListening, danger: error }">
        <span class="status-dot"></span>{{ status }}
      </div>
    </header>

    <section class="workspace">
      <div class="visualizer-card">
        <div class="card-header">
          <div>
            <p class="section-kicker">LIVE SIGNAL</p>
            <h2>实时波形</h2>
          </div>
          <span class="unit">Amplitude / Time</span>
        </div>
        <WaveformCanvas :analyser="analyser" :active="isListening" :duration-ms="duration" />
        <div class="axis-labels"><span>−{{ duration }} ms</span><span>现在</span></div>
      </div>

      <aside class="control-panel">
        <div>
          <p class="section-kicker">INPUT</p>
          <h2>麦克风</h2>
        </div>
        <button class="record-button" :class="{ stop: isListening }" @click="isListening ? stop() : start()">
          <span class="record-icon"></span>
          {{ isListening ? '停止采集' : '开启麦克风' }}
        </button>
        <p v-if="error" class="error-message">{{ error }}</p>
        <p v-else class="help-text">首次点击后，浏览器会请求麦克风使用权限。音频仅在本机处理，不会上传。</p>

        <label class="range-field">
          <span>观测窗口</span><strong>{{ duration }} ms</strong>
          <input v-model="duration" type="range" min="20" max="200" step="10" />
        </label>
        <dl class="signal-meta">
          <div><dt>采样率</dt><dd>{{ sampleRate ? `${(sampleRate / 1000).toFixed(1)} kHz` : '—' }}</dd></div>
          <div><dt>显示模式</dt><dd>过去时域</dd></div>
        </dl>
      </aside>
    </section>

    <footer>AcousticLab Demo · 本地实时声学信号观测工具</footer>
  </main>
</template>
