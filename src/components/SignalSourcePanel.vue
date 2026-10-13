<script setup lang="ts">
import { experiments } from '../data/lab'

export type InputMode = 'microphone' | 'file' | 'signal'
defineProps<{
  mode: InputMode; frequency: number; signalType: 'sine' | 'square'; amplitude: number
  fileName: string; fileDuration: number; filePosition: number; busy: boolean; paused: boolean
  experiment: string
}>()
const emit = defineEmits<{
  mode: [value: InputMode]; frequency: [value: number]; signalType: [value: 'sine' | 'square']; amplitude: [value: number]
  file: [value: File]; seek: [value: number]; experiment: [value: string]
}>()
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`
function selectFile(event: Event) {
  const element = event.target as HTMLInputElement
  const file = element.files?.[0]
  if (file) emit('file', file)
  element.value = ''
}
</script>

<template>
  <section class="sidebar-section source-section">
    <h2>输入信号</h2>
    <div class="source-options" aria-label="选择输入模式">
      <button v-for="option in [{ id: 'microphone', title: '实时采集', detail: '电脑麦克风', icon: '◉' }, { id: 'file', title: '文件分析', detail: '本地音频', icon: '▤' }, { id: 'signal', title: '信号实验', detail: '生成已知信号', icon: '∿' }]" :key="option.id" :aria-pressed="mode === option.id" :class="{ selected: mode === option.id }" :disabled="busy" @click="emit('mode', option.id as InputMode)">
        <span class="source-icon" aria-hidden="true">{{ option.icon }}</span><span><strong>{{ option.title }}</strong><small>{{ option.detail }}</small></span>
      </button>
    </div>
    <p v-if="mode === 'microphone'" class="source-hint">开始后允许访问麦克风。暂停会冻结分析，停止会释放麦克风。</p>
    <template v-else-if="mode === 'file'">
      <label class="file-picker"><span>{{ fileName || '选择音频文件' }}</span><small>WAV / MP3 / OGG 等浏览器支持的格式</small><input :disabled="busy" type="file" accept="audio/*" aria-label="选择音频文件" @change="selectFile" /></label>
      <div v-if="fileDuration > 0" class="file-transport"><label for="file-progress">{{ paused ? '继续分析后可调整位置' : '文件位置' }}</label><input id="file-progress" :disabled="paused" type="range" :value="filePosition" :max="fileDuration" min="0" step="0.01" @change="emit('seek', Number(($event.target as HTMLInputElement).value))" /><div><span>{{ clock(filePosition) }}</span><span>{{ clock(fileDuration) }}</span></div></div>
      <p class="source-hint">循环分析，可定位到任意时间。本模式静音运行。</p>
    </template>
    <template v-else>
      <label class="field">实验预设<select :value="experiment" @change="emit('experiment', ($event.target as HTMLSelectElement).value)"><option value="custom">自定义信号</option><option v-for="item in experiments" :key="item.id" :value="item.id">{{ item.title }}</option></select></label>
      <label class="field">波形<select :value="signalType" @change="emit('signalType', ($event.target as HTMLSelectElement).value as 'sine' | 'square')"><option value="sine">正弦波</option><option value="square">方波</option></select></label>
      <label class="field">频率 <span class="input-with-unit"><input :value="frequency" type="number" min="20" max="20000" step="10" @input="emit('frequency', Number(($event.target as HTMLInputElement).value))" /><span>Hz</span></span></label>
      <label class="field">振幅 <span class="input-with-unit"><input :value="amplitude" type="number" min="0.01" max="1" step="0.05" @input="emit('amplitude', Number(($event.target as HTMLInputElement).value))" /><span>FS</span></span></label>
      <p class="source-hint">参数可在分析中调节。生成信号静音运行。</p>
    </template>
  </section>
</template>
