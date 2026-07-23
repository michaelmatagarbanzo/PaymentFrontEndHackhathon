<script setup lang="ts">
import { ref } from 'vue'
import { useSdkSource, type SdkSource } from '@/composables/useSdkSource'

const { source, customUrl, localFileName, configUrl, pickLocalFile } = useSdkSource()

const fileInput = ref<HTMLInputElement | null>(null)

const options: { value: SdkSource; label: string }[] = [
  { value: 'config', label: 'Config' },
  { value: 'url',    label: 'URL'    },
  { value: 'local',  label: 'Local'  },
]
</script>

<template>
  <div class="space-y-2">
    <!-- Source toggle -->
    <div class="flex gap-1 p-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
      <button
        v-for="opt in options"
        :key="opt.value"
        @click="source = opt.value"
        class="flex-1 py-1 px-2 rounded-md text-xs font-medium transition-all duration-150"
        :class="source === opt.value
          ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Config: show URL read-only -->
    <p v-if="source === 'config'" class="text-[11px] font-mono text-slate-400 dark:text-slate-500 truncate px-1 py-1">
      {{ configUrl }}
    </p>

    <!-- URL: custom input -->
    <input
      v-if="source === 'url'"
      v-model="customUrl"
      type="url"
      class="input-field text-xs"
      placeholder="https://cdn.example.com/safekey.js"
    />

    <!-- Local: file picker -->
    <div v-if="source === 'local'">
      <input ref="fileInput" type="file" accept=".js" class="sr-only" @change="pickLocalFile" />
      <button
        @click="fileInput?.click()"
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500 dark:text-slate-400 hover:border-cyan-400 dark:hover:border-cyan-600 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors"
      >
        <svg class="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
        <span class="truncate">{{ localFileName || 'Seleccionar archivo .js' }}</span>
      </button>
    </div>
  </div>
</template>
