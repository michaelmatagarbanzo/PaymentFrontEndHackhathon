<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { ResponseAuth } from '@/types'

const route = useRoute()
const router = useRouter()
const showRaw = ref(false)

const source = computed(() => (route.query.source as string) ?? 'checkout')

const result = computed<ResponseAuth>(() => {
  try {
    return JSON.parse(route.query.data as string) as ResponseAuth
  } catch {
    return {}
  }
})

const isApproved = computed(() =>
  result.value.status === 'Approved' ||
  result.value.responseCode === '00' ||
  result.value.responseCode === '000'
)

const fields: { key: keyof ResponseAuth; label: string; highlight?: boolean }[] = [
  { key: 'responseCode', label: 'Código Respuesta', highlight: true },
  { key: 'responseCodeDescription', label: 'Descripción', highlight: true },
  { key: 'provider', label: 'Proveedor', highlight: true },
  { key: 'status', label: 'Estado', highlight: true },
  { key: 'providerStatus', label: 'Estado Proveedor' },
  { key: 'providerMessage', label: 'Mensaje Proveedor' },
  { key: 'authorizationNumber', label: 'N° Autorización', highlight: true },
  { key: 'authorizationCode', label: 'Auth Code', highlight: true },
  { key: 'transactionId', label: 'Transaction ID' },
  { key: 'referenceNumber', label: 'N° Referencia' },
  { key: 'referenceCode', label: 'Código Referencia' },
  { key: 'traceId', label: 'Trace ID' },
  { key: 'processedAt', label: 'Procesado En' },
  { key: 'systemTraceNumber', label: 'System Trace' },
  { key: 'invoice', label: 'Factura' },
  { key: 'orderId', label: 'Order ID' },
  { key: 'hostDate', label: 'Fecha Host' },
  { key: 'hostTime', label: 'Hora Host' },
  { key: 'securityCodeValidation', label: 'CVV Validación' },
  { key: 'avsValidation', label: 'AVS Validación' },
  { key: 'addressValidation', label: 'Dirección Validación' },
  { key: 'fraudScore', label: 'Fraud Score' },
  { key: 'clientName', label: 'Nombre Cliente' },
  { key: 'balanceAmount', label: 'Balance' },
  { key: 'confirmNumber', label: 'N° Confirmación' },
  { key: 'detResponseCode', label: 'Det. Código' },
  { key: 'detResponseCodeDescription', label: 'Det. Descripción' },
]

const visibleFields = computed(() =>
  fields.filter((f) => result.value[f.key])
)

function goBack() {
  router.push(source.value === 'safekey' ? '/payment' : '/')
}
</script>

<template>
  <div class="space-y-6 animate-fade-up">
    <!-- Header -->
    <div class="flex items-center gap-4">
      <button @click="goBack" class="btn-secondary !px-3 !py-2">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
      </button>
      <div>
        <div class="flex items-center gap-3 mb-1">
          <span :class="isApproved ? 'badge-emerald' : 'badge-red'">
            {{ isApproved ? '✓ APROBADO' : '✗ RECHAZADO' }}
          </span>
          <h1 class="text-xl font-semibold text-slate-800">Resultado de Transacción</h1>
        </div>
        <p class="text-sm text-slate-500 font-mono">
          Fuente: {{ source === 'checkout' ? 'BCO Checkout' : source === 'appconnector' ? 'AppConnector API' : 'Amex SafeKey' }}
        </p>
      </div>
    </div>

    <!-- Status card -->
    <div
      class="card p-6"
      :class="isApproved ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'"
    >
      <div class="flex items-center gap-5">
        <!-- Status icon -->
        <div
          class="w-16 h-16 rounded-full flex items-center justify-center flex-shrink-0"
          :class="isApproved ? 'bg-emerald-100 border border-emerald-200' : 'bg-red-100 border border-red-200'"
        >
          <svg v-if="isApproved" class="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else class="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>

        <!-- Main info -->
        <div class="flex-1">
          <p class="text-2xl font-bold font-mono" :class="isApproved ? 'text-emerald-700' : 'text-red-600'">
            {{ result.responseCode ?? 'N/A' }}
          </p>
          <p class="text-base text-slate-700 mt-1">
            {{ result.responseCodeDescription ?? 'Sin descripción' }}
          </p>
          <p v-if="result.authorizationNumber" class="text-sm text-slate-500 mt-1 font-mono">
            Auth: <span class="text-slate-700">{{ result.authorizationNumber }}</span>
          </p>
        </div>

        <!-- Toggle raw -->
        <button @click="showRaw = !showRaw" class="btn-secondary !text-xs">
          {{ showRaw ? 'Ver campos' : 'Ver JSON' }}
        </button>
      </div>
    </div>

    <!-- Response details -->
    <Transition name="fade" mode="out-in">
      <!-- Structured fields -->
      <div v-if="!showRaw" key="fields" class="card overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200">
          <h2 class="text-sm font-semibold text-slate-700">Campos de Respuesta</h2>
        </div>

        <div v-if="visibleFields.length > 0" class="divide-y divide-slate-100">
          <div
            v-for="field in visibleFields"
            :key="field.key"
            class="grid grid-cols-2 gap-4 px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <span class="text-xs font-mono text-slate-400 self-center">{{ field.label }}</span>
            <span
              class="text-sm font-mono text-right"
              :class="field.highlight ? 'text-cyan-700 font-semibold' : 'text-slate-600'"
            >
              {{ result[field.key] }}
            </span>
          </div>
        </div>

        <div v-else class="px-4 py-8 text-center">
          <p class="text-slate-400 text-sm font-mono">No hay campos en la respuesta</p>
        </div>
      </div>

      <!-- Raw JSON -->
      <div v-else key="json" class="card overflow-hidden">
        <div class="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-700">JSON Response</h2>
          <button
            @click="navigator.clipboard.writeText(JSON.stringify(result, null, 2))"
            class="text-xs font-mono text-slate-400 hover:text-cyan-600 transition-colors"
          >
            Copiar
          </button>
        </div>
        <pre class="p-4 text-xs font-mono text-slate-600 overflow-x-auto leading-relaxed bg-slate-50">{{ JSON.stringify(result, null, 2) }}</pre>
      </div>
    </Transition>

    <!-- Actions -->
    <div class="flex items-center gap-3">
      <button @click="goBack" class="btn-primary flex items-center gap-2">
        <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Nueva Transacción
      </button>
      <RouterLink to="/" class="btn-secondary">BCO Checkout</RouterLink>
      <RouterLink to="/payment" class="btn-secondary">SafeKey</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
