<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import MerchantSelector from '@/components/MerchantSelector.vue'
import TokenDisplay from '@/components/TokenDisplay.vue'
import SdkSourceSelector from '@/components/SdkSourceSelector.vue'
import type { Merchant, ResponseAuth } from '@/types'
import { getToken, generateOrderId, decodeJwtPayload } from '@/utils/jwt'
import imgVisa from '@/assets/img/VISA.png'
import imgMC   from '@/assets/img/MC.png'
import imgAmex from '@/assets/img/AMEX.png'
import { doubleToIso, formatCurrency, generateInvoice } from '@/utils/currency'
import { useSdkSource, loadSdkUrl, resolvedSdkUrl } from '@/composables/useSdkSource'
import merchantsConfig from '@/config/merchants.config.json'

// ─── Random data helpers ───────────────────────────────────────────────────────

const FIRST_NAMES = ['Andrés', 'María', 'José', 'Ana', 'Luis', 'Laura', 'Diego', 'Sofía', 'Fabián', 'Daniela', 'Miguel', 'Gabriela', 'Roberto', 'Valeria', 'Esteban']
const LAST_NAMES = ['Ramírez', 'Soto', 'Mora', 'Jiménez', 'Vargas', 'Castillo', 'Rojas', 'Arias', 'Chaves', 'Solís', 'Quesada', 'Vega', 'Méndez', 'Brenes', 'Herrera']
const ADDRESSES = [
  'Barrio Escalante, San José',
  'Desamparados, San José',
  'Curridabat, San José',
  'Heredia Centro, Heredia',
  'Alajuela Centro, Alajuela',
  'Cartago Centro, Cartago',
  'Liberia, Guanacaste',
  'Pérez Zeledón, San José',
  'San Carlos, Alajuela',
  'Limón Centro, Limón',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomFullName(): string {
  return `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
}

function randomPhone(): string {
  const prefix = pick(['6', '7', '8'])
  const rest = String(Math.floor(Math.random() * 10000000)).padStart(7, '0')
  return `+506${prefix}${rest}`
}

function randomEmail(name: string): string {
  const domains = ['gmail.com', 'hotmail.com', 'yahoo.com', 'outlook.com']
  const slug = name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '.')
  return `${slug}${Math.floor(Math.random() * 900) + 100}@${pick(domains)}`
}

function randomAmount(): number {
  return Math.floor(Math.random() * 901) + 100
}

// ─── State ────────────────────────────────────────────────────────────────────

const router = useRouter()
const merchants = ref<Merchant[]>(merchantsConfig.merchants as Merchant[])
const selectedMerchant = ref<Merchant | null>(null)
const currentToken = ref('')
const isGeneratingToken = ref(false)
const isPaying = ref(false)
const sdkReady = ref(false)
const error = ref('')
const errorDetails = ref<{ code?: number; url?: string; message: string } | null>(null)
const orderId = ref(generateOrderId())

// Form state
const _initialName = randomFullName()
const form = ref({
  creditCard: '4000000000002503',
  expirationMonth: '01',
  expirationYear: '2027',
  cvv: '123',
  fullName: _initialName,
  address: pick(ADDRESSES),
  mobilePhone: randomPhone(),
  email: randomEmail(_initialName),
  invoice: generateInvoice(),
  amount: randomAmount(),
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const totalIso = computed(() => doubleToIso(form.value.amount))

const isAmex = computed(() => form.value.creditCard.startsWith('3'))
const isVisa = computed(() => form.value.creditCard.startsWith('4'))

const cardBrand = computed(() => {
  if (isAmex.value) return 'AMEX'
  if (isVisa.value) return 'VISA'
  if (form.value.creditCard.startsWith('5') || form.value.creditCard.startsWith('2')) return 'MC'
  return 'CARD'
})

useSdkSource() // initialize composable

// ─── Watchers ─────────────────────────────────────────────────────────────────

watch(() => form.value.creditCard, (card) => {
  // Amex uses 4-digit CVV, others use 3
  form.value.cvv = card.startsWith('3') ? '1234' : '123'
})

// Reset SDK when source changes so it reloads on next pay()
watch(resolvedSdkUrl, () => { sdkReady.value = false })

// Format card number display with spaces every 4 digits
const formattedCardNumber = computed(() => {
  const cleaned = form.value.creditCard.replace(/\s/g, '')
  const parts = cleaned.match(/.{1,4}/g) || []
  return parts.join(' ')
})

function handleCardInput(event: Event) {
  const input = event.target as HTMLInputElement
  const cleaned = input.value.replace(/\s/g, '')
  form.value.creditCard = cleaned
  // Set cursor position after formatting
  const cursorPos = input.selectionStart || 0
  const spacesBeforeCursor = input.value.substring(0, cursorPos).split(' ').length - 1
  setTimeout(() => {
    const newCursorPos = Math.min(cursorPos + (formattedCardNumber.value.split(' ').length - 1 - spacesBeforeCursor), formattedCardNumber.value.length)
    input.setSelectionRange(newCursorPos, newCursorPos)
  }, 0)
}

// ─── Network Error Monitoring ─────────────────────────────────────────────────

function startNetworkMonitoring() {
  // Monitor failed network requests
  if ('PerformanceObserver' in window) {
    try {
      const observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          const resourceEntry = entry as PerformanceResourceTiming
          // Check for failed requests (status 4xx or 5xx would show as failed transfers)
          if (resourceEntry.transferSize === 0 && resourceEntry.decodedBodySize === 0 && resourceEntry.name.includes('api')) {
            console.error('Network request failed:', {
              url: resourceEntry.name,
              duration: resourceEntry.duration,
              initiatorType: resourceEntry.initiatorType,
            })
          }
        }
      })
      observer.observe({ entryTypes: ['resource'] })
    } catch (e) {
      console.warn('Could not start network monitoring:', e)
    }
  }

  // Intercept global fetch errors
  const originalFetch = window.fetch
  window.fetch = async function(...args) {
    try {
      const response = await originalFetch(...args)
      if (!response.ok) {
        const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
        console.error('HTTP Error:', {
          status: response.status,
          statusText: response.statusText,
          url,
        })

        // If it's a 401, update error details
        if (response.status === 401) {
          errorDetails.value = {
            code: 401,
            url,
            message: 'No autorizado - Verifique las credenciales del comercio',
          }
          error.value = `Error ${response.status}: ${response.statusText}`
        }
      }
      return response
    } catch (err) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      console.error('Fetch error:', err, 'URL:', url)
      errorDetails.value = {
        url,
        message: (err as Error).message,
      }
      throw err
    }
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function generateToken() {
  if (!selectedMerchant.value) return
  isGeneratingToken.value = true
  error.value = ''
  errorDetails.value = null

  try {
    const tk = await getToken(
      orderId.value,
      totalIso.value,
      selectedMerchant.value.terminalId,
      selectedMerchant.value,
      form.value.invoice,
    )
    currentToken.value = tk
    sdkReady.value = false // Reset SDK when token changes
  } catch (err) {
    error.value = `Error generando token: ${(err as Error).message}`
    errorDetails.value = { message: (err as Error).message }
  } finally {
    isGeneratingToken.value = false
  }
}

async function onMerchantSelected(merchant: Merchant | null) {
  selectedMerchant.value = merchant
  if (merchant) await generateToken()
}

async function load3DSSDK() {
  sdkReady.value = false
  error.value = ''
  errorDetails.value = null

  try {
    await loadSdkUrl(resolvedSdkUrl.value, 'safekeyjs')
    sdkReady.value = true
  } catch (err) {
    error.value = `Error cargando 3DS SDK: ${(err as Error).message}`
    errorDetails.value = { message: (err as Error).message, url: resolvedSdkUrl.value }
  }
}

function handlePaymentResponse(responseToken: string) {
  if (responseToken === 'FAILURE') {
    error.value = 'El pago fue rechazado. Intente con otro medio de pago.'
    errorDetails.value = { message: 'Pago rechazado por el procesador' }
    isPaying.value = false
    return
  }

  const decoded = decodeJwtPayload<{ Response?: ResponseAuth }>(responseToken)
  const result: ResponseAuth = decoded?.Response ?? {}

  router.push({
    name: 'result',
    query: {
      data: JSON.stringify(result),
      source: 'safekey',
    },
  })
}

async function pay() {
  if (!selectedMerchant.value || !currentToken.value) return
  if (!sdkReady.value) await load3DSSDK()
  if (!window.BacSecurePay) {
    error.value = 'SDK no disponible. Verifique la fuente del script.'
    errorDetails.value = { message: 'SDK no cargado', url: resolvedSdkUrl.value }
    return
  }

  isPaying.value = true
  error.value = ''
  errorDetails.value = null

  try {
    window.BacSecurePay.Init({
      Token: currentToken.value,
      PublicKey: selectedMerchant.value.publicKey,
      LoadSongBird: false,
      Continue: () => {
        window.BacSecurePay?.Pay()
      },
      callback: (data) => {
        handlePaymentResponse(data.Token)
      },
    })
  } catch (err) {
    error.value = `Error al inicializar el pago: ${(err as Error).message}`
    errorDetails.value = { message: (err as Error).message }
    isPaying.value = false
  }
}

async function refreshToken() {
  orderId.value = generateOrderId()
  if (selectedMerchant.value) await generateToken()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  load3DSSDK()
  startNetworkMonitoring()
})
</script>

<template>
  <div class="space-y-6 animate-fade-up">
    <!-- Page header -->
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <h1 class="text-xl font-semibold text-slate-800 dark:text-slate-100">Cliente</h1>
        </div>
        <p class="text-sm text-slate-500 dark:text-slate-400">
          Formulario de pago con credenciales — <span class="font-mono text-slate-600 dark:text-slate-300">3DS</span>
        </p>
      </div>
      <button @click="refreshToken" class="btn-secondary text-xs flex items-center gap-2">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
        Nueva Orden
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Left: Card Form -->
      <div class="lg:col-span-3 space-y-4">
        <div class="card p-5">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Datos del Pago</h2>
            <div class="flex items-center gap-2">
              <span
                class="badge text-[10px]"
                :class="{
                  'badge-amber': cardBrand === 'AMEX',
                  'badge-cyan': cardBrand === 'VISA',
                  'badge-emerald': cardBrand === 'MC',
                  'badge-cyan': cardBrand === 'CARD',
                }"
              >
                {{ cardBrand }}
              </span>
              <span class="font-mono text-xs text-slate-500 dark:text-slate-400">#{{ orderId }}</span>
            </div>
          </div>

          <div class="space-y-4">
            <!-- Amount & Invoice row -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Monto</label>
                <div class="relative">
                  <span class="absolute left-3 top-1/2 -translate-y-1/2 text-cyan-600 dark:text-cyan-400 text-sm font-semibold">₡</span>
                  <input
                    v-model.number="form.amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    class="input-field pl-7"
                    dpmp-field="Amount"
                    @change="generateToken"
                  />
                </div>
              </div>

              <div>
                <label class="label">N° Factura</label>
                <input
                  v-model="form.invoice"
                  type="text"
                  class="input-field"
                  dpmp-field="Invoice"
                  @change="generateToken"
                />
              </div>
            </div>

            <!-- Card Number & CVV -->
            <div class="grid grid-cols-3 gap-4">
              <div class="col-span-2">
                <label class="label">Número de Tarjeta</label>
                <div class="relative">
                  <input
                    :value="formattedCardNumber"
                    @input="handleCardInput"
                    type="text"
                    class="input-field pr-14"
                    placeholder="0000 0000 0000 0000"
                    maxlength="19"
                  />
                  <!-- Card brand icon -->
                  <div v-if="cardBrand !== 'CARD'" class="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <img
                      :src="cardBrand === 'VISA' ? imgVisa : cardBrand === 'MC' ? imgMC : imgAmex"
                      :alt="cardBrand"
                      class="h-6 w-auto object-contain"
                    />
                  </div>
                </div>
                <!-- Hidden input with clean value (no spaces) for SDK reading -->
                <input
                  :value="form.creditCard"
                  type="hidden"
                  dpmp-field="CardNumber"
                  data-cardinal-field="AccountNumber"
                />
              </div>
              <div>
                <label class="label">CVV</label>
                <input
                  v-model="form.cvv"
                  type="text"
                  class="input-field"
                  dpmp-field="Cvv"
                  :maxlength="isAmex ? 4 : 3"
                />
              </div>
            </div>

            <!-- Expiry -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Mes de Expiración</label>
                <input
                  v-model="form.expirationMonth"
                  type="text"
                  maxlength="2"
                  placeholder="MM"
                  class="input-field"
                  dpmp-field="CardExpMonth"
                />
              </div>
              <div>
                <label class="label">Año de Expiración</label>
                <input
                  v-model="form.expirationYear"
                  type="text"
                  maxlength="4"
                  placeholder="YYYY"
                  class="input-field"
                  dpmp-field="CardExpYear"
                />
              </div>
            </div>

            <!-- Cardholder -->
            <div>
              <label class="label">Nombre Completo</label>
              <input
                v-model="form.fullName"
                type="text"
                class="input-field"
                dpmp-field="BillingFullName"
              />
            </div>

            <!-- Address -->
            <div>
              <label class="label">Dirección de Entrega</label>
              <input
                v-model="form.address"
                type="text"
                class="input-field"
                dpmp-field="BillingAddress1"
              />
            </div>

            <!-- Phone & Email -->
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="label">Teléfono</label>
                <input
                  v-model="form.mobilePhone"
                  type="tel"
                  class="input-field"
                  dpmp-field="MobilePhone"
                  data-cardinal-field="MobilePhone"
                />
              </div>
              <div>
                <label class="label">Correo Electrónico</label>
                <input
                  v-model="form.email"
                  type="email"
                  class="input-field"
                  dpmp-field="Email"
                  data-cardinal-field="Email"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Token display -->
        <div v-if="currentToken" class="card p-4">
          <TokenDisplay :token="currentToken" />
        </div>
      </div>

      <!-- Right: Controls -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Total -->
        <div class="card p-4 bg-gradient-radial from-amber-50 dark:from-amber-950/40 to-white dark:to-slate-900">
          <p class="label">Total a Pagar</p>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold font-mono text-amber-600 dark:text-amber-400">{{ formatCurrency(form.amount) }}</span>
          </div>
        </div>

        <!-- Merchant -->
        <div class="card p-4">
          <MerchantSelector
            :merchants="merchants"
            :model-value="selectedMerchant"
            :loading="isGeneratingToken"
            @update:modelValue="onMerchantSelected"
          />
        </div>

        <!-- Pay button -->
        <div class="card p-4 space-y-3">
          <div v-if="isGeneratingToken" class="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <div class="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            Generando JWT...
          </div>

          <button
            @click="pay"
            :disabled="!selectedMerchant || !currentToken || isPaying || isGeneratingToken"
            class="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl font-semibold text-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            :class="
              selectedMerchant && currentToken && !isPaying
                ? 'bg-amber-500 hover:bg-amber-400 text-white shadow-glow-emerald'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'
            "
          >
            <div v-if="isPaying" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
              <line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            {{ isPaying ? 'Procesando...' : 'Pagar con 3DS' }}
          </button>

          <p v-if="!selectedMerchant" class="text-xs text-slate-400 text-center font-mono">
            ← Seleccione una terminal
          </p>
        </div>

        <!-- Error -->
        <Transition name="slide-down">
          <div v-if="error" class="card p-4 border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40">
            <div class="flex items-start gap-3">
              <svg class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <div class="flex-1 space-y-2">
                <p class="text-xs text-red-600 dark:text-red-400 font-semibold">{{ error }}</p>
                <div v-if="errorDetails" class="text-[10px] font-mono text-red-500 dark:text-red-400 space-y-1 bg-red-100/50 dark:bg-red-900/20 p-2 rounded border border-red-200 dark:border-red-800/50">
                  <div v-if="errorDetails.code" class="flex items-center gap-2">
                    <span class="text-red-400 dark:text-red-500">Código:</span>
                    <span class="font-semibold">{{ errorDetails.code }}</span>
                  </div>
                  <div v-if="errorDetails.url" class="flex items-start gap-2">
                    <span class="text-red-400 dark:text-red-500 flex-shrink-0">URL:</span>
                    <span class="break-all">{{ errorDetails.url }}</span>
                  </div>
                  <div v-if="errorDetails.message" class="flex items-start gap-2">
                    <span class="text-red-400 dark:text-red-500 flex-shrink-0">Detalle:</span>
                    <span>{{ errorDetails.message }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>

        <!-- SDK source config -->
        <div class="card p-4 space-y-3">
          <div class="flex items-center justify-between">
            <p class="label mb-0">Fuente del SDK</p>
            <div class="flex items-center gap-1.5">
              <span class="badge-amber text-[10px]">{{ merchantsConfig.environment }}</span>
              <span :class="sdkReady ? 'badge-emerald' : 'badge-cyan'" class="badge text-[10px]">
                {{ sdkReady ? 'Listo' : 'Pendiente' }}
              </span>
            </div>
          </div>
          <SdkSourceSelector />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
