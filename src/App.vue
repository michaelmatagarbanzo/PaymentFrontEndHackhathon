<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useAzureAuth } from '@/composables/useAzureAuth'

const route = useRoute()
const {
  account,
  isLoading: isAuthLoading,
  isAuthenticating,
  authError,
  hasConfig,
  configError,
  login,
  logout,
} = useAzureAuth()

const navLinks = [
  { name: 'Cliente',       path: '/',              icon: '⬢' },
  { name: 'Auto QA',       path: '/auto-test',      icon: '⚡' },
  { name: 'Mantenimiento', path: '/mantenimiento',  icon: '⚙' },
]

// ─── Theme ────────────────────────────────────────────────────────────────────

const isDark = ref(false)

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark)
  localStorage.setItem('theme', dark ? 'dark' : 'light')
}

function toggleTheme() {
  isDark.value = !isDark.value
  applyTheme(isDark.value)
}

const accountLabel = computed(() => account.value?.username ?? '')

async function onLogin() {
  await login()
}

async function onLogout() {
  await logout()
}

onMounted(() => {
  const stored = localStorage.getItem('theme')
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  isDark.value = stored ? stored === 'dark' : prefersDark
  applyTheme(isDark.value)
})
</script>

<template>
  <!-- Headless runner mode — rendered inside a hidden iframe, no chrome needed -->
  <RouterView v-if="route.name === 'runner'" />

  <!-- Normal app chrome -->
  <div v-else class="min-h-screen flex flex-col">

    <!-- Animated gradient background -->
    <div class="gradient-canvas" aria-hidden="true">
      <div class="g-orb g-orb-1" />
      <div class="g-orb g-orb-2" />
      <div class="g-orb g-orb-3" />
      <div class="g-orb g-orb-4" />
    </div>

    <!-- Header -->
    <header class="app-header">
      <div class="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">

        <!-- Logo -->
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/15 to-cyan-600/5 dark:from-cyan-500/20 dark:to-cyan-600/10 border border-cyan-200 dark:border-cyan-800/60 flex items-center justify-center shadow-sm">
            <svg class="w-4 h-4 text-cyan-600 dark:text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="5" width="20" height="14" rx="3" />
              <path d="M2 10h20" />
            </svg>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">3DS Tester</span>
            <span class="badge-cyan text-[9px] px-1.5 py-0.5 font-bold">v1.0</span>
          </div>
        </div>

        <!-- Nav -->
        <nav class="flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
          <RouterLink
            v-for="link in navLinks"
            :key="link.path"
            :to="link.path"
            class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
            :class="
              route.path === link.path
                ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-600'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            "
          >
            <span class="text-[11px]">{{ link.icon }}</span>
            {{ link.name }}
          </RouterLink>
        </nav>

        <!-- Right: auth + theme switch + status -->
        <div class="flex items-center gap-4">

          <!-- Azure auth -->
          <div class="flex items-center gap-2">
            <template v-if="hasConfig">
              <span
                v-if="accountLabel"
                class="text-[11px] font-mono text-slate-500 dark:text-slate-400 max-w-[180px] truncate"
                :title="accountLabel"
              >
                {{ accountLabel }}
              </span>
              <button
                v-if="accountLabel"
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                :disabled="isAuthenticating"
                @click="onLogout"
              >
                Cerrar sesion
              </button>
              <button
                v-else
                type="button"
                class="px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-600 text-white hover:bg-cyan-500 transition-colors disabled:opacity-60"
                :disabled="isAuthenticating || isAuthLoading"
                @click="onLogin"
              >
                Iniciar sesion
              </button>
            </template>
            <span
              v-else
              class="text-[11px] font-mono text-amber-600 dark:text-amber-400"
              :title="configError"
            >
              Azure no configurado
            </span>
          </div>

          <!-- Theme switch -->
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 transition-colors duration-200" :class="isDark ? 'text-slate-500' : 'text-amber-400'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
            <button
              @click="toggleTheme"
              role="switch"
              :aria-checked="isDark"
              :title="isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'"
              class="relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-300 ease-in-out focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900"
              :class="isDark ? 'bg-cyan-600' : 'bg-slate-300'"
            >
              <span
                class="pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow ring-0 transition-transform duration-300 ease-in-out"
                :class="isDark ? 'translate-x-4' : 'translate-x-0'"
              />
            </button>
            <svg class="w-3.5 h-3.5 transition-colors duration-200" :class="isDark ? 'text-cyan-400' : 'text-slate-400'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
            </svg>
          </div>

          <!-- Status dot -->
          <div class="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500 font-mono">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            ONLINE
          </div>
        </div>
      </div>
    </header>

    <div v-if="authError && hasConfig" class="max-w-5xl mx-auto w-full px-6 pt-4">
      <div class="rounded-lg border border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-300 px-4 py-2 text-xs">
        {{ authError }}
      </div>
    </div>

    <!-- Main -->
    <main class="flex-1 max-w-5xl mx-auto w-full px-6 py-8">
      <RouterView v-slot="{ Component }">
        <Transition name="fade-slide" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>

    <!-- Footer -->
    <footer class="border-t border-slate-200/70 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 backdrop-blur-sm py-4 px-6">
      <div class="max-w-5xl mx-auto flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-600 font-mono">
        <span class="flex items-center gap-2">
          <span class="w-1 h-1 rounded-full bg-cyan-400 dark:bg-cyan-700" />
          3DS Payment Tester
        </span>
        <div class="flex items-center gap-3">
          <span>BCO / SafeKey</span>
          <span class="text-slate-300 dark:text-slate-700">·</span>
          <span>eCSP CheckOut</span>
        </div>
      </div>
    </footer>
  </div>
</template>

<style>
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 0.2s ease;
}
.fade-slide-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
