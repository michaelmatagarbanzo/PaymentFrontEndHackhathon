<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import MerchantSelector from '@/components/MerchantSelector.vue'
import ProductTable from '@/components/ProductTable.vue'
import TokenDisplay from '@/components/TokenDisplay.vue'
import type { Merchant, Product, ResponseAuth } from '@/types'
import { getToken, generateOrderId, decodeJwtPayload } from '@/utils/jwt'
import { doubleToIso, formatCurrency, getRandomProductIds } from '@/utils/currency'
import { loadScript } from '@/utils/scriptLoader'
import merchantsConfig from '@/config/merchants.config.json'

// ─── State ────────────────────────────────────────────────────────────────────

const router = useRouter()

const merchants = ref<Merchant[]>(merchantsConfig.merchants as Merchant[])
const selectedMerchant = ref<Merchant | null>(null)
const products = ref<Product[]>([])
const orderId = ref('')
const currentToken = ref('')
const isGeneratingToken = ref(false)
const isClave = ref(false)
const sdkReady = ref(false)
const sdkLoading = ref(false)
const error = ref('')

// ─── Computed ─────────────────────────────────────────────────────────────────

const total = computed(() =>
  products.value.reduce((acc, p) => acc + p.subTotal, 0)
)

const totalIso = computed(() => doubleToIso(total.value))

const scriptUrl = computed(() => {
  const env = merchantsConfig.environment as keyof typeof merchantsConfig.checkoutScripts
  return merchantsConfig.checkoutScripts[env] ?? merchantsConfig.checkoutScripts.production
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildCart(): Product[] {
  const ALL = [
    { id: 1, nombre: 'Audífonos',    descripcion: 'Audífonos inalámbricos',  valor: 1.02, cantidadDisponible: 10 },
    { id: 2, nombre: 'Laptop',       descripcion: 'Laptop ultrabook',         valor: 2.04, cantidadDisponible: 10 },
    { id: 3, nombre: 'Billetera',    descripcion: 'Billetera de cuero',       valor: 3.00, cantidadDisponible: 10 },
  ]
  const ids = getRandomProductIds()
  return ALL.filter((p) => ids.includes(p.id)).map((p) => {
    const cantidadPedido = Math.floor(Math.random() * 3) + 1
    return { ...p, cantidadPedido, subTotal: cantidadPedido * p.valor }
  })
}

async function generateToken() {
  if (!selectedMerchant.value) return
  isGeneratingToken.value = true
  error.value = ''

  try {
    const tk = await getToken(
      orderId.value,
      totalIso.value,
      selectedMerchant.value.terminalId,
      selectedMerchant.value,
    )
    currentToken.value = tk

    // Update SDK if already initialized
    if (window.checkout) {
      window.checkout.UpdateTokenToPay(tk)
      window.checkout.accessKey = selectedMerchant.value.publicKey
    }
  } catch (err) {
    error.value = `Error generando token: ${(err as Error).message}`
  } finally {
    isGeneratingToken.value = false
  }
}

async function initCheckoutSDK() {
  if (!selectedMerchant.value || !currentToken.value) return
  sdkLoading.value = true
  error.value = ''

  try {
    await loadScript(scriptUrl.value, 'baccheckout')
    sdkReady.value = true

    window.checkout?.init({
      PublicKey: selectedMerchant.value.publicKey,
      Token: currentToken.value,
      callback: (data) => {
        handlePaymentResponse(data.token)
      },
      renderButton: true,
      buttonText: 'Pagar Ahora',
      buttonContainerId: 'checkoutButtonContainer',
      buttonCustomCSS: 'btn-primary w-full',
    })
  } catch (err) {
    error.value = `Error cargando SDK: ${(err as Error).message}`
  } finally {
    sdkLoading.value = false
  }
}

function handlePaymentResponse(responseJwt: string) {
  if (responseJwt === 'FAILURE') {
    error.value = 'El pago fue rechazado. Intente con otro medio de pago.'
    return
  }

  // Decode the response JWT (BAC signs it, we just read the payload)
  const decoded = decodeJwtPayload<{ Response?: ResponseAuth }>(responseJwt)
  const result: ResponseAuth = decoded?.Response ?? {}

  router.push({
    name: 'result',
    query: {
      data: JSON.stringify(result),
      source: 'checkout',
    },
  })
}

function handleClaveToggle() {
  window.checkout?.isClave(isClave.value)
}

async function onMerchantSelected(merchant: Merchant | null) {
  selectedMerchant.value = merchant
  if (merchant) {
    await generateToken()
  }
}

function refreshCart() {
  products.value = buildCart()
  orderId.value = generateOrderId()
  currentToken.value = ''
  sdkReady.value = false
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  products.value = buildCart()
  orderId.value = generateOrderId()
})
</script>

<template>
  <div class="space-y-6 animate-fade-up">
    <!-- Page header -->
    <div class="flex items-start justify-between">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <span class="badge-cyan">BCO</span>
          <h1 class="text-xl font-semibold text-slate-800">Checkout Modal</h1>
        </div>
        <p class="text-sm text-slate-500">
          Flujo de pago con modal externo — <span class="font-mono text-slate-600">checkout.js</span>
        </p>
      </div>
      <button @click="refreshCart" class="btn-secondary text-xs flex items-center gap-2">
        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="23 4 23 10 17 10" />
          <path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" />
        </svg>
        Nuevo Carrito
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <!-- Left column: Cart -->
      <div class="lg:col-span-3 space-y-4">
        <!-- Order info -->
        <div class="card p-4">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-sm font-semibold text-slate-700">Orden de Compra</h2>
            <span class="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md border border-slate-200">
              #{{ orderId }}
            </span>
          </div>
          <ProductTable :products="products" :total="total" />
        </div>

        <!-- Token display -->
        <div v-if="currentToken" class="card p-4">
          <TokenDisplay :token="currentToken" />
        </div>
      </div>

      <!-- Right column: Controls -->
      <div class="lg:col-span-2 space-y-4">
        <!-- Total card -->
        <div class="card p-4 bg-gradient-radial from-cyan-50 to-white">
          <p class="label">Total a Pagar</p>
          <div class="flex items-baseline gap-2">
            <span class="text-3xl font-bold font-mono text-cyan-700">{{ formatCurrency(total) }}</span>
            <span class="text-xs font-mono text-slate-400">ISO: {{ totalIso }}</span>
          </div>
        </div>

        <!-- Merchant selector -->
        <div class="card p-4">
          <MerchantSelector
            :merchants="merchants"
            :model-value="selectedMerchant"
            :loading="isGeneratingToken"
            @update:modelValue="onMerchantSelected"
          />
        </div>

        <!-- Token generation status -->
        <div class="card p-4 space-y-4">
          <!-- Generating indicator -->
          <div v-if="isGeneratingToken" class="flex items-center gap-3 text-sm text-slate-500">
            <div class="w-4 h-4 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            Generando JWT...
          </div>

          <!-- Clave toggle -->
          <div v-if="currentToken" class="flex items-center justify-between">
            <label class="text-sm text-slate-600 cursor-pointer" for="claveToggle">
              Pagar con Clave
            </label>
            <button
              id="claveToggle"
              role="switch"
              :aria-checked="isClave"
              @click="() => { isClave = !isClave; handleClaveToggle() }"
              class="relative w-10 h-5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
              :class="isClave ? 'bg-cyan-500' : 'bg-slate-200'"
            >
              <span
                class="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200"
                :class="isClave ? 'translate-x-5' : 'translate-x-0'"
              />
            </button>
          </div>

          <!-- Init SDK Button -->
          <button
            v-if="currentToken && !sdkReady"
            @click="initCheckoutSDK"
            :disabled="sdkLoading"
            class="btn-primary w-full flex items-center justify-center gap-2"
          >
            <div v-if="sdkLoading" class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <svg v-else class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            {{ sdkLoading ? 'Cargando SDK...' : 'Inicializar Checkout' }}
          </button>

          <!-- SDK Button Container -->
          <div
            v-if="sdkReady"
            id="checkoutButtonContainer"
            class="min-h-[48px] flex items-center justify-center"
          />

          <!-- No merchant selected hint -->
          <p v-if="!selectedMerchant && !isGeneratingToken" class="text-xs text-slate-400 text-center font-mono">
            ← Seleccione una terminal para continuar
          </p>
        </div>

        <!-- Error -->
        <Transition name="slide-down">
          <div
            v-if="error"
            class="card p-4 border-red-200 bg-red-50"
          >
            <div class="flex items-start gap-3">
              <svg class="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p class="text-xs text-red-600 font-mono">{{ error }}</p>
            </div>
          </div>
        </Transition>

        <!-- SDK Info -->
        <div class="card p-3">
          <p class="label mb-2">Configuración SDK</p>
          <div class="space-y-1 text-xs font-mono">
            <div class="flex justify-between">
              <span class="text-slate-500">Entorno</span>
              <span class="badge-amber text-[10px]">{{ merchantsConfig.environment }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-slate-500">Script</span>
              <span class="text-slate-400 truncate max-w-[160px] text-right" :title="scriptUrl">
                ...{{ scriptUrl.split('/').slice(-1)[0] }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from,
.slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
