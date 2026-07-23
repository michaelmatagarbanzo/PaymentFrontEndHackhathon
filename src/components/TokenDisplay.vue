<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  token: string
  label?: string
}>()

const copied = ref(false)

async function copy() {
  await navigator.clipboard.writeText(props.token)
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div v-if="token" class="space-y-2">
    <div class="flex items-center justify-between">
      <label class="label mb-0">{{ label ?? 'JWT Token Generado' }}</label>
      <button
        @click="copy"
        class="flex items-center gap-1.5 text-xs font-mono transition-colors duration-200"
        :class="copied ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400'"
      >
        <svg v-if="!copied" class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
          <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {{ copied ? 'Copiado!' : 'Copiar' }}
      </button>
    </div>
    <div class="bg-slate-800 dark:bg-slate-950 border border-slate-700 dark:border-slate-800 rounded-lg p-3 overflow-x-auto">
      <p class="text-[11px] font-mono text-slate-300 break-all leading-relaxed">
        <span class="text-amber-300">{{ token.split('.')[0] }}</span>
        <span class="text-slate-500">.</span>
        <span class="text-cyan-300">{{ token.split('.')[1] }}</span>
        <span class="text-slate-500">.</span>
        <span class="text-emerald-300">{{ token.split('.')[2] }}</span>
      </p>
    </div>
  </div>
</template>
