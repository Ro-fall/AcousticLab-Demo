<script setup lang="ts">
defineProps<{ title: string; detail?: string; expanded?: boolean }>()
defineEmits<{ expand: [] }>()
</script>
<template>
  <section class="analysis-panel" :class="{ expanded }">
    <header class="panel-heading"><h2>{{ title }}</h2><div><span v-if="detail" class="panel-detail">{{ detail }}</span><button class="icon-button" :aria-label="`${expanded ? '收起' : '放大'}${title}`" :aria-pressed="!!expanded" @click="$emit('expand')">{{ expanded ? '收起' : '放大' }}</button></div></header>
    <slot />
  </section>
</template>
