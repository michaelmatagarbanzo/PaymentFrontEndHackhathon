<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import MerchantSelector from '@/components/MerchantSelector.vue'
import SdkSourceSelector from '@/components/SdkSourceSelector.vue'
import type { Merchant } from '@/types'
import merchantsConfig from '@/config/merchants.config.json'
import { useSdkSource, resolvedSdkUrl } from '@/composables/useSdkSource'
import { authFetch } from '@/utils/authFetch'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CaseConfig {
  id: number
  card: string
  month: string
  year: string
  amount: number
  merchant: Merchant | null
}

type ResultStatus = 'waiting' | 'running' | 'challenge' | 'success' | 'failure' | 'timeout' | 'error'

interface CaseResult {
  status: ResultStatus
  hadChallenge: boolean
  message?: string
  response?: Record<string, unknown>
  startedAt?: number
  duration?: number
}

interface IterationRecord {
  n: number
  cases: Array<{
    id: number
    card: string
    merchant: string
    status: ResultStatus
    hadChallenge: boolean
    duration?: number
    response?: Record<string, unknown>
    message?: string
  }>
}

// ── State ─────────────────────────────────────────────────────────────────────

useSdkSource()

const merchants  = ref<Merchant[]>(merchantsConfig.merchants as Merchant[])
const caseCount  = ref(2)
const staggerMs  = ref(0)
const phase      = ref<'setup' | 'running'>('setup')
const iteration  = ref(0)
const cumulative = ref({ success: 0, failure: 0, challenge: 0 })
const isLooping  = ref(false)
const history    = ref<IterationRecord[]>([])
const showModal  = ref(false)
const modalTab   = ref(0)

const cases = ref<CaseConfig[]>([
  { id: 1, card: '4000000000002503', month: '01', year: '2027', amount: 500, merchant: null },
  { id: 2, card: '4000000000002503', month: '01', year: '2027', amount: 500, merchant: null },
])

const results = ref(new Map<number, CaseResult>())

watch(caseCount, (n) => {
  if (n > cases.value.length) {
    for (let i = cases.value.length; i < n; i++) {
      cases.value.push({ id: i + 1, card: '4000000000002503', month: '01', year: '2027', amount: 500, merchant: null })
    }
  } else {
    cases.value = cases.value.slice(0, n)
  }
})

// ── Computed ──────────────────────────────────────────────────────────────────

const allMerchantsSelected = computed(() => cases.value.every(c => c.merchant !== null))

const doneCount = computed(() => {
  let n = 0
  for (const r of results.value.values()) {
    if (['success', 'failure', 'timeout', 'error'].includes(r.status)) n++
  }
  return n
})

const successCount = computed(() => {
  let n = 0
  for (const r of results.value.values()) {
    if (r.status === 'success') n++
  }
  return n
})

// ── Playwright-based case runner ───────────────────────────────────────────────

function setResult(id: number, patch: Partial<CaseResult>) {
  const existing = results.value.get(id) ?? { status: 'waiting' as ResultStatus, hadChallenge: false }
  results.value.set(id, { ...existing, ...patch })
  results.value = new Map(results.value)
}

async function runCase(tc: CaseConfig): Promise<void> {
  setResult(tc.id, { status: 'running', startedAt: Date.now() })
  try {
    const res = await authFetch('/api/run-case', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caseId:  tc.id,
        card:    tc.card,
        month:   tc.month,
        year:    tc.year,
        cvv:     tc.card.startsWith('3') ? '1234' : '123',
        amount:  tc.amount,
        merchant: tc.merchant,
        sdkUrl:  resolvedSdkUrl.value,
      }),
    })
    const data = await res.json() as {
      status: string; hadChallenge: boolean
      response?: Record<string, unknown>; message?: string
    }
    const r = results.value.get(tc.id)
    const duration = r?.startedAt ? Date.now() - r.startedAt : undefined
    const finalStatus = (data.status?.toLowerCase() ?? 'error') as ResultStatus

    // Briefly show challenge indicator if challenge occurred
    if (data.hadChallenge) {
      setResult(tc.id, { status: 'challenge', hadChallenge: true })
      await new Promise(r => setTimeout(r, 400))
    }

    setResult(tc.id, {
      status:       finalStatus,
      hadChallenge: data.hadChallenge,
      response:     data.response,
      message:      data.message,
      duration,
    })
  } catch (err) {
    const r = results.value.get(tc.id)
    const duration = r?.startedAt ? Date.now() - r.startedAt : undefined
    setResult(tc.id, { status: 'error', hadChallenge: false, message: String(err), duration })
  }
}

async function runIteration() {
  if (!isLooping.value) return
  iteration.value++
  cases.value.forEach(tc => results.value.set(tc.id, { status: 'waiting', hadChallenge: false }))
  results.value = new Map(results.value)

  // Launch all cases concurrently (with optional stagger)
  await Promise.all(cases.value.map((tc, i) =>
    new Promise<void>(resolve => {
      setTimeout(async () => {
        if (isLooping.value) await runCase(tc)
        resolve()
      }, i * staggerMs.value)
    })
  ))

  if (!isLooping.value) return

  // Snapshot iteration into history
  const record: IterationRecord = {
    n: iteration.value,
    cases: cases.value.map(tc => {
      const r = results.value.get(tc.id)!
      return {
        id:           tc.id,
        card:         tc.card,
        merchant:     tc.merchant?.terminalId ?? '',
        status:       r.status,
        hadChallenge: r.hadChallenge,
        duration:     r.duration,
        response:     r.response,
        message:      r.message,
      }
    }),
  }
  history.value.unshift(record)
  modalTab.value = 0

  for (const r of results.value.values()) {
    if (r.status === 'success') cumulative.value.success++
    else cumulative.value.failure++
    if (r.hadChallenge) cumulative.value.challenge++
  }

  setTimeout(runIteration, 1200)
}

function startTests() {
  if (!allMerchantsSelected.value) return
  phase.value = 'running'
  isLooping.value = true
  iteration.value = 0
  cumulative.value = { success: 0, failure: 0, challenge: 0 }
  runIteration()
}

function reset() {
  isLooping.value = false
  results.value.clear()
  iteration.value = 0
  cumulative.value = { success: 0, failure: 0, challenge: 0 }
  history.value = []
  showModal.value = false
  phase.value = 'setup'
}

// ── Display helpers ───────────────────────────────────────────────────────────

const RESPONSE_FIELDS = [
  'responseCode', 'responseCodeDescription',
  'authorizationNumber', 'transactionId',
  'referenceNumber', 'orderId',
]

function filteredResponse(resp: Record<string, unknown>): [string, unknown][] {
  return RESPONSE_FIELDS
    .filter(k => resp[k] != null && resp[k] !== '')
    .map(k => [k, resp[k]])
}

function maskCard(card: string): string {
  if (card.length < 8) return card
  return card.slice(0, 4) + ' •••• ' + card.slice(-4)
}

function fmtDuration(ms?: number): string {
  if (ms == null) return '—'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

const FIELD_LABELS: Record<string, string> = {
  responseCode:              'Cód.',
  responseCodeDescription:   'Descripción',
  authorizationNumber:       'Auth #',
  transactionId:             'Txn ID',
  referenceNumber:           'Referencia',
  orderId:                   'Order ID',
}
</script>

<template>
  <div class="space-y-6 animate-fade-up">

    <!-- Page header -->
    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-xl font-semibold text-slate-800 dark:text-slate-100">Auto QA Runner</h1>
        <p class="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          Ejecuta múltiples casos en paralelo para pruebas de carga y sincronización
        </p>
      </div>
      <div v-if="phase !== 'setup'" class="flex items-center gap-2">
        <button
          v-if="history.length > 0"
          @click="showModal = true"
          class="btn-secondary text-xs flex items-center gap-2"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
          Ver resultados
          <span class="badge-cyan text-[9px] px-1.5 py-0.5">{{ history.length }}</span>
        </button>
        <button @click="reset" class="btn-secondary text-xs flex items-center gap-2 border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40">
          <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
          </svg>
          Detener QA
        </button>
      </div>
    </div>

    <!-- ── SETUP PHASE ────────────────────────────────────────────────────── -->
    <template v-if="phase === 'setup'">

      <!-- Controls -->
      <div class="card p-5">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Configuración de ejecución</h2>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <!-- Case count -->
          <div>
            <label class="label">Cantidad de casos</label>
            <div class="flex items-center gap-3">
              <button
                @click="caseCount = Math.max(1, caseCount - 1)"
                class="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xl font-medium transition-colors"
              >−</button>
              <span class="w-8 text-center font-mono text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums">
                {{ caseCount }}
              </span>
              <button
                @click="caseCount = Math.min(10, caseCount + 1)"
                class="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-xl font-medium transition-colors"
              >+</button>
            </div>
          </div>

          <!-- Stagger delay -->
          <div>
            <label class="label">Delay entre inicios</label>
            <div class="flex items-center gap-3">
              <input
                v-model.number="staggerMs"
                type="number"
                min="0"
                max="5000"
                step="100"
                class="input-field w-28"
              />
              <span class="text-xs text-slate-500 dark:text-slate-400">
                ms
                <span class="ml-1 text-[10px]">
                  {{ staggerMs === 0 ? '— simultáneo' : `— ${staggerMs}ms por caso` }}
                </span>
              </span>
            </div>
          </div>
        </div>

        <!-- SDK source -->
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <p class="label mb-2">Fuente del SDK</p>
          <SdkSourceSelector />
        </div>

        <!-- Start button -->
        <div class="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
          <button
            @click="startTests"
            :disabled="!allMerchantsSelected"
            class="btn-primary w-full flex items-center justify-center gap-2"
          >
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            Ejecutar {{ caseCount }} {{ caseCount === 1 ? 'caso' : 'casos' }}
            {{ staggerMs === 0 ? 'en paralelo' : `(cada ${staggerMs}ms)` }}
          </button>
          <p v-if="!allMerchantsSelected" class="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
            Seleccione una terminal en cada caso para continuar
          </p>
        </div>
      </div>

      <!-- Case cards -->
      <div class="space-y-3">
        <div
          v-for="(tc, i) in cases"
          :key="tc.id"
          class="card p-5"
        >
          <div class="flex items-center justify-between mb-4">
            <div class="flex items-center gap-2">
              <span class="w-6 h-6 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-500 dark:text-slate-400">
                {{ i + 1 }}
              </span>
              <h3 class="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                Caso {{ tc.id }}
              </h3>
            </div>
            <span
              class="text-[10px] font-mono px-2 py-0.5 rounded-full border"
              :class="tc.merchant
                ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'"
            >
              {{ tc.merchant ? `[${tc.merchant.terminalId}]` : 'Sin terminal' }}
            </span>
          </div>

          <!-- Terminal selector -->
          <MerchantSelector
            :merchants="merchants"
            :model-value="tc.merchant"
            @update:model-value="tc.merchant = $event"
          />

          <!-- Card + expiry + amount -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
            <div class="sm:col-span-2">
              <label class="label">Número de tarjeta</label>
              <input
                v-model="tc.card"
                type="text"
                class="input-field"
                placeholder="4000000000002503"
                maxlength="19"
              />
            </div>
            <div>
              <label class="label">Mes exp.</label>
              <input
                v-model="tc.month"
                type="text"
                class="input-field"
                placeholder="MM"
                maxlength="2"
              />
            </div>
            <div>
              <label class="label">Año exp.</label>
              <input
                v-model="tc.year"
                type="text"
                class="input-field"
                placeholder="YYYY"
                maxlength="4"
              />
            </div>
          </div>
          <div class="mt-3">
            <label class="label">Monto ₡</label>
            <input
              v-model.number="tc.amount"
              type="number"
              min="1"
              class="input-field"
              placeholder="500"
            />
          </div>
        </div>
      </div>
    </template>

    <!-- ── RUNNING PHASE ──────────────────────────────────────────────────── -->
    <template v-else>

      <!-- Progress card -->
      <div class="card p-5 space-y-3">
        <!-- Header row -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2.5">
            <span class="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">Ejecutando...</span>
            <span class="badge-cyan text-[10px]">Iteración {{ iteration }}</span>
          </div>
          <div class="flex items-center gap-2 text-xs font-mono">
            <span class="text-slate-400 dark:text-slate-500">{{ doneCount }}/{{ cases.length }}</span>
            <span class="badge-emerald text-[10px]">{{ successCount }} OK</span>
            <span class="badge-red text-[10px]">{{ doneCount - successCount }} fallos</span>
          </div>
        </div>
        <!-- Progress bar -->
        <div class="h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
          <div
            class="h-full bg-cyan-500 rounded-full transition-all duration-500"
            :style="{ width: `${(doneCount / cases.length) * 100}%` }"
          />
        </div>
        <!-- Cumulative stats (visible from iteración 2) -->
        <div v-if="iteration > 1 || cumulative.success + cumulative.failure > 0" class="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[11px] font-mono text-slate-500 dark:text-slate-400">
          <span>Acumulado — {{ iteration - 1 }} iter. completadas:</span>
          <span class="text-emerald-600 dark:text-emerald-400">✓ {{ cumulative.success }}</span>
          <span class="text-red-500 dark:text-red-400">✗ {{ cumulative.failure }}</span>
          <span v-if="cumulative.challenge > 0" class="text-amber-500 dark:text-amber-400">⚡ {{ cumulative.challenge }} con challenge</span>
        </div>
      </div>

      <!-- Result rows -->
      <div class="space-y-2">
        <div
          v-for="tc in cases"
          :key="tc.id"
          class="card p-4 transition-all duration-300"
          :class="{
            'border-emerald-300 dark:border-emerald-800': results.get(tc.id)?.status === 'success',
            'border-red-300    dark:border-red-800':     results.get(tc.id)?.status === 'failure',
            'border-amber-300  dark:border-amber-800':   results.get(tc.id)?.status === 'challenge',
          }"
        >
          <!-- Header row -->
          <div class="flex items-center justify-between gap-3">
            <div class="flex items-center gap-3 min-w-0">
              <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500 shrink-0">
                #{{ tc.id }}
              </span>
              <span class="font-mono text-xs text-slate-700 dark:text-slate-200 truncate">
                {{ maskCard(tc.card) }}
              </span>
              <span class="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                ₡{{ tc.amount }}
              </span>
              <span v-if="tc.merchant" class="text-[10px] font-mono text-slate-400 dark:text-slate-500 truncate">
                [{{ tc.merchant.terminalId }}]
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <span class="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                {{ fmtDuration(results.get(tc.id)?.duration) }}
              </span>

              <!-- Challenge indicator (persists after final result) -->
              <span v-if="results.get(tc.id)?.hadChallenge && !['waiting','running','challenge'].includes(results.get(tc.id)?.status ?? '')" class="badge-amber text-[10px]">
                ⚡ 3DS
              </span>

              <!-- Status badge -->
              <span
                v-if="!results.has(tc.id) || results.get(tc.id)?.status === 'waiting'"
                class="badge text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700"
              >En espera</span>

              <span v-else-if="results.get(tc.id)?.status === 'running'" class="badge-cyan text-[10px] animate-pulse">
                ⟳ Ejecutando
              </span>

              <span v-else-if="results.get(tc.id)?.status === 'challenge'" class="badge-amber text-[10px]">
                ⚡ Challenge → 1234
              </span>

              <span v-else-if="results.get(tc.id)?.status === 'success'" class="badge-emerald text-[10px]">
                ✓ OK
              </span>

              <span v-else-if="results.get(tc.id)?.status === 'failure'" class="badge-red text-[10px]">
                ✗ Fallo
              </span>

              <span
                v-else-if="results.get(tc.id)?.status === 'timeout'"
                class="badge text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-700"
              >⏱ Timeout</span>

              <span v-else-if="results.get(tc.id)?.status === 'error'" class="badge-amber text-[10px]">
                ⚠ Error
              </span>
            </div>
          </div>

          <!-- Response fields (SUCCESS) -->
          <div
            v-if="results.get(tc.id)?.status === 'success' && results.get(tc.id)?.response"
            class="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5"
          >
            <div
              v-for="[key, val] in filteredResponse(results.get(tc.id)!.response!)"
              :key="key"
              class="flex flex-col gap-0.5"
            >
              <span class="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">
                {{ FIELD_LABELS[key] ?? key }}
              </span>
              <span class="text-[11px] font-mono text-slate-700 dark:text-slate-200 truncate">
                {{ val }}
              </span>
            </div>
          </div>

          <!-- Error / failure message -->
          <p
            v-if="results.get(tc.id)?.message"
            class="mt-2 text-[11px] font-mono text-red-600 dark:text-red-400"
          >
            {{ results.get(tc.id)?.message }}
          </p>
        </div>
      </div>
    </template>

    <!-- ── Results modal ──────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div
          v-if="showModal"
          class="fixed inset-0 z-50 flex items-center justify-center p-4"
          @click.self="showModal = false"
        >
          <!-- Backdrop -->
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="showModal = false" />

          <!-- Panel -->
          <div class="relative w-full max-w-3xl max-h-[85vh] flex flex-col card overflow-hidden">

            <!-- Header -->
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div class="flex items-center gap-3">
                <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">Resultados por iteración</h2>
                <span class="badge-cyan text-[10px]">{{ history.length }} iter.</span>
              </div>
              <button @click="showModal = false" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <!-- Iteration tabs -->
            <div class="flex gap-1 px-5 pt-3 overflow-x-auto">
              <button
                v-for="(iter, idx) in history"
                :key="iter.n"
                @click="modalTab = idx"
                class="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-mono font-medium transition-all"
                :class="modalTab === idx
                  ? 'bg-cyan-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'"
              >
                Iter. {{ iter.n }}
                <span
                  class="ml-1"
                  :class="iter.cases.every(c => c.status === 'success') ? 'text-emerald-300' : 'text-red-300'"
                >
                  {{ iter.cases.filter(c => c.status === 'success').length }}/{{ iter.cases.length }}
                </span>
              </button>
            </div>

            <!-- Case results -->
            <div class="flex-1 overflow-y-auto px-5 py-3 space-y-3">
              <div
                v-for="c in history[modalTab]?.cases ?? []"
                :key="c.id"
                class="rounded-xl border p-4 space-y-2"
                :class="{
                  'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20': c.status === 'success',
                  'border-red-200    dark:border-red-800    bg-red-50/50    dark:bg-red-950/20':    c.status === 'failure',
                  'border-slate-200  dark:border-slate-700  bg-slate-50/50  dark:bg-slate-800/20':  c.status === 'timeout' || c.status === 'error',
                }"
              >
                <!-- Row header -->
                <div class="flex items-center justify-between gap-2 flex-wrap">
                  <div class="flex items-center gap-2">
                    <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500">#{{ c.id }}</span>
                    <span class="font-mono text-xs text-slate-700 dark:text-slate-200">{{ maskCard(c.card) }}</span>
                    <span class="text-[10px] text-slate-400 font-mono">[{{ c.merchant }}]</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <span v-if="c.hadChallenge" class="badge-amber text-[10px]">⚡ 3DS Challenge</span>
                    <span class="text-[10px] font-mono text-slate-400">{{ fmtDuration(c.duration) }}</span>
                    <span v-if="c.status === 'success'"  class="badge-emerald text-[10px]">✓ OK</span>
                    <span v-else-if="c.status === 'failure'" class="badge-red text-[10px]">✗ Fallo</span>
                    <span v-else-if="c.status === 'timeout'" class="badge text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-600">⏱ Timeout</span>
                    <span v-else class="badge-amber text-[10px]">⚠ {{ c.status }}</span>
                  </div>
                </div>

                <!-- Response fields -->
                <div v-if="c.response && Object.keys(c.response).length" class="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 pt-1">
                  <div
                    v-for="[key, val] in Object.entries(c.response).filter(([, v]) => v != null && v !== '')"
                    :key="key"
                    class="flex flex-col gap-0.5"
                  >
                    <span class="text-[9px] uppercase tracking-wider text-slate-400 dark:text-slate-500">{{ FIELD_LABELS[key] ?? key }}</span>
                    <span class="text-[11px] font-mono text-slate-700 dark:text-slate-200 break-all">{{ val }}</span>
                  </div>
                </div>

                <!-- Error / message -->
                <p v-if="c.message" class="text-[11px] font-mono text-red-600 dark:text-red-400 break-all">
                  {{ c.message }}
                </p>
                <p v-else-if="c.status === 'failure'" class="text-[11px] font-mono text-red-500 dark:text-red-400">
                  El SDK retornó FAILURE — tarjeta rechazada o error 3DS.
                </p>
                <p v-else-if="c.status === 'timeout'" class="text-[11px] font-mono text-slate-500">
                  Sin respuesta en 45 segundos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.97); }
</style>
