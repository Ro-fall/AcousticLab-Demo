<script setup lang="ts">
import { experiments, glossary } from '../data/lab'
defineEmits<{ experiment: [id: string] }>()
</script>
<template>
  <div class="reference-page">
    <header><h1>理解你看到的信号</h1><p>从一段已知信号开始，把概念与分析结果对应起来。</p></header>
    <section class="reference-experiments"><h2>动手实验</h2><div class="experiment-list"><button v-for="item in experiments" :key="item.id" @click="$emit('experiment', item.id)"><strong>{{ item.title }}</strong><span>{{ item.description }}</span><small>打开实验 ↗</small></button></div></section>
    <section><h2>名词与方法</h2><div class="glossary-grid"><article v-for="term in glossary" :key="term.title"><span>{{ term.group }}</span><h3>{{ term.title }}</h3><p>{{ term.body }}</p></article></div></section>
  </div>
</template>
