<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import type { Merchant, Card } from '@/types'
import { authFetch } from '@/utils/authFetch'

// ── Tabs ─────────────────────────────────────────────────────────────────────

const tab = ref<'terminals' | 'cards'>('terminals')

// ── Status toast ─────────────────────────────────────────────────────────────

const status = ref<{ type: 'success' | 'error'; text: string } | null>(null)
let statusTimer: ReturnType<typeof setTimeout> | undefined

function showStatus(type: 'success' | 'error', text: string) {
  status.value = { type, text }
  clearTimeout(statusTimer)
  statusTimer = setTimeout(() => { status.value = null }, 3000)
}

// ── Terminals ────────────────────────────────────────────────────────────────

const terminals = ref<Merchant[]>([])
const loadingTerminals = ref(false)
const showTerminalModal = ref(false)
const editingTerminalIndex = ref<number | null>(null)

const emptyTerminalForm = (): Merchant => ({
  merchantId: '',
  terminalId: '',
  privateKey: '',
  publicKey: '',
  audience: 'BCO',
  description: '',
  wallet: '',
  cryptogramEci: '',
  cryptogram: '',
  isApplePayTransaction: '',
})

const terminalForm = reactive<Merchant>(emptyTerminalForm())

const isTerminalFormValid = computed(() =>
  terminalForm.merchantId.trim() !== '' &&
  terminalForm.terminalId.trim() !== '' &&
  terminalForm.privateKey.trim() !== '' &&
  terminalForm.publicKey.trim() !== '' &&
  terminalForm.audience.trim() !== ''
)

async function loadTerminals() {
  loadingTerminals.value = true
  try {
    const res = await authFetch('/api/config/merchants')
    terminals.value = await res.json()
  } catch (err) {
    showStatus('error', `No se pudieron cargar las terminales: ${(err as Error).message}`)
  } finally {
    loadingTerminals.value = false
  }
}

function openAddTerminal() {
  editingTerminalIndex.value = null
  Object.assign(terminalForm, emptyTerminalForm())
  showTerminalModal.value = true
}

function openEditTerminal(i: number) {
  editingTerminalIndex.value = i
  Object.assign(terminalForm, emptyTerminalForm(), terminals.value[i])
  showTerminalModal.value = true
}

function closeTerminalModal() {
  showTerminalModal.value = false
}

async function persistTerminals(next: Merchant[]) {
  const res = await authFetch('/api/config/merchants', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  terminals.value = await res.json()
}

async function saveTerminal() {
  if (!isTerminalFormValid.value) return
  const entry: Merchant = {
    merchantId: terminalForm.merchantId.trim(),
    terminalId: terminalForm.terminalId.trim(),
    privateKey: terminalForm.privateKey.trim(),
    publicKey: terminalForm.publicKey.trim(),
    audience: terminalForm.audience.trim(),
    description: terminalForm.description.trim() || terminalForm.terminalId.trim(),
    ...(terminalForm.wallet?.trim() && { wallet: terminalForm.wallet.trim() }),
    ...(terminalForm.cryptogramEci?.trim() && { cryptogramEci: terminalForm.cryptogramEci.trim() }),
    ...(terminalForm.cryptogram?.trim() && { cryptogram: terminalForm.cryptogram.trim() }),
    ...(terminalForm.isApplePayTransaction?.trim() && { isApplePayTransaction: terminalForm.isApplePayTransaction.trim() }),
  }
  const next = [...terminals.value]
  if (editingTerminalIndex.value === null) next.push(entry)
  else next[editingTerminalIndex.value] = entry

  try {
    await persistTerminals(next)
    showStatus('success', editingTerminalIndex.value === null ? 'Terminal agregada.' : 'Terminal actualizada.')
    closeTerminalModal()
  } catch (err) {
    showStatus('error', `No se pudo guardar la terminal: ${(err as Error).message}`)
  }
}

async function deleteTerminal(i: number) {
  const t = terminals.value[i]
  if (!confirm(`¿Eliminar la terminal [${t.terminalId}] ${t.description}?`)) return
  const next = terminals.value.filter((_, idx) => idx !== i)
  try {
    await persistTerminals(next)
    showStatus('success', 'Terminal eliminada.')
  } catch (err) {
    showStatus('error', `No se pudo eliminar la terminal: ${(err as Error).message}`)
  }
}

// ── Cards ────────────────────────────────────────────────────────────────────

const cards = ref<Card[]>([])
const loadingCards = ref(false)
const showCardModal = ref(false)
const editingCardIndex = ref<number | null>(null)

const emptyCardForm = (): Card => ({
  id: '',
  card: '',
  month: '',
  year: '',
  cvv: '123',
  amount: 500,
  description: '',
})

const cardForm = reactive<Card>(emptyCardForm())

const isCardFormValid = computed(() =>
  cardForm.card.trim() !== '' &&
  cardForm.month.trim() !== '' &&
  cardForm.year.trim() !== '' &&
  cardForm.cvv.trim() !== '' &&
  cardForm.amount > 0
)

async function loadCards() {
  loadingCards.value = true
  try {
    const res = await authFetch('/api/config/cards')
    cards.value = await res.json()
  } catch (err) {
    showStatus('error', `No se pudieron cargar las tarjetas: ${(err as Error).message}`)
  } finally {
    loadingCards.value = false
  }
}

function openAddCard() {
  editingCardIndex.value = null
  Object.assign(cardForm, emptyCardForm())
  showCardModal.value = true
}

function openEditCard(i: number) {
  editingCardIndex.value = i
  Object.assign(cardForm, emptyCardForm(), cards.value[i])
  showCardModal.value = true
}

function closeCardModal() {
  showCardModal.value = false
}

async function persistCards(next: Card[]) {
  const res = await authFetch('/api/config/cards', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(next),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  cards.value = await res.json()
}

async function saveCard() {
  if (!isCardFormValid.value) return
  const entry: Card = {
    id: cardForm.id || `card-${Date.now()}`,
    card: cardForm.card.trim(),
    month: cardForm.month.trim(),
    year: cardForm.year.trim(),
    cvv: cardForm.cvv.trim(),
    amount: cardForm.amount,
    description: cardForm.description.trim() || 'Tarjeta personalizada',
  }
  const next = [...cards.value]
  if (editingCardIndex.value === null) next.push(entry)
  else next[editingCardIndex.value] = entry

  try {
    await persistCards(next)
    showStatus('success', editingCardIndex.value === null ? 'Tarjeta agregada.' : 'Tarjeta actualizada.')
    closeCardModal()
  } catch (err) {
    showStatus('error', `No se pudo guardar la tarjeta: ${(err as Error).message}`)
  }
}

async function deleteCard(i: number) {
  const c = cards.value[i]
  if (!confirm(`¿Eliminar la tarjeta ${maskCard(c.card)} (${c.description})?`)) return
  const next = cards.value.filter((_, idx) => idx !== i)
  try {
    await persistCards(next)
    showStatus('success', 'Tarjeta eliminada.')
  } catch (err) {
    showStatus('error', `No se pudo eliminar la tarjeta: ${(err as Error).message}`)
  }
}

function maskCard(card: string): string {
  if (card.length < 8) return card
  return card.slice(0, 4) + ' •••• ' + card.slice(-4)
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  loadTerminals()
  loadCards()
})
</script>

<template>
  <div class="space-y-6 animate-fade-up">
    <!-- Page header -->
    <div>
      <h1 class="text-xl font-semibold text-slate-800 dark:text-slate-100">Mantenimiento</h1>
      <p class="text-sm text-slate-500 dark:text-slate-400">
        Administre las terminales y tarjetas de prueba guardadas
      </p>
    </div>

    <!-- Status toast -->
    <Transition name="slide-down">
      <div
        v-if="status"
        class="card p-3 px-4 text-xs font-medium"
        :class="status!.type === 'success'
          ? 'border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
          : 'border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400'"
      >
        {{ status!.text }}
      </div>
    </Transition>

    <!-- Tabs -->
    <div class="inline-flex items-center gap-1 p-1 rounded-xl bg-slate-100/80 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
      <button
        @click="tab = 'terminals'"
        class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
        :class="tab === 'terminals'
          ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-600'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        Terminales
        <span class="badge-cyan text-[9px] px-1.5 py-0.5 ml-1">{{ terminals.length }}</span>
      </button>
      <button
        @click="tab = 'cards'"
        class="px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
        :class="tab === 'cards'
          ? 'bg-white dark:bg-slate-700 text-cyan-700 dark:text-cyan-300 shadow-sm border border-slate-200/80 dark:border-slate-600'
          : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
      >
        Tarjetas
        <span class="badge-cyan text-[9px] px-1.5 py-0.5 ml-1">{{ cards.length }}</span>
      </button>
    </div>

    <!-- ── Terminals tab ──────────────────────────────────────────────────── -->
    <div v-if="tab === 'terminals'" class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Terminales guardadas</h2>
        <button @click="openAddTerminal" class="btn-primary text-xs py-2 px-4">+ Nueva terminal</button>
      </div>

      <div v-if="loadingTerminals" class="text-xs text-slate-400 font-mono py-6 text-center">Cargando...</div>
      <div v-else-if="terminals.length === 0" class="text-xs text-slate-400 font-mono py-6 text-center">
        No hay terminales guardadas.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-left text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">
              <th class="pb-2 pr-3 font-semibold">Terminal ID</th>
              <th class="pb-2 pr-3 font-semibold">Merchant ID</th>
              <th class="pb-2 pr-3 font-semibold">Descripción</th>
              <th class="pb-2 pr-3 font-semibold">Audience</th>
              <th class="pb-2 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(t, i) in terminals"
              :key="`${t.terminalId}-${i}`"
              class="border-t border-slate-100 dark:border-slate-800"
            >
              <td class="py-2.5 pr-3 font-mono text-slate-700 dark:text-slate-200">{{ t.terminalId }}</td>
              <td class="py-2.5 pr-3 font-mono text-slate-500 dark:text-slate-400">{{ t.merchantId }}</td>
              <td class="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{{ t.description }}</td>
              <td class="py-2.5 pr-3"><span class="badge-cyan text-[10px]">{{ t.audience }}</span></td>
              <td class="py-2.5 text-right whitespace-nowrap">
                <button @click="openEditTerminal(i)" class="text-cyan-600 dark:text-cyan-400 hover:underline font-medium mr-3">Editar</button>
                <button @click="deleteTerminal(i)" class="text-red-500 dark:text-red-400 hover:underline font-medium">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Cards tab ──────────────────────────────────────────────────────── -->
    <div v-if="tab === 'cards'" class="card p-5">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">Tarjetas guardadas</h2>
        <button @click="openAddCard" class="btn-primary text-xs py-2 px-4">+ Nueva tarjeta</button>
      </div>

      <div v-if="loadingCards" class="text-xs text-slate-400 font-mono py-6 text-center">Cargando...</div>
      <div v-else-if="cards.length === 0" class="text-xs text-slate-400 font-mono py-6 text-center">
        No hay tarjetas guardadas.
      </div>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-xs">
          <thead>
            <tr class="text-left text-slate-400 dark:text-slate-500 uppercase tracking-wider text-[10px]">
              <th class="pb-2 pr-3 font-semibold">Tarjeta</th>
              <th class="pb-2 pr-3 font-semibold">Vencimiento</th>
              <th class="pb-2 pr-3 font-semibold">CVV</th>
              <th class="pb-2 pr-3 font-semibold">Monto</th>
              <th class="pb-2 pr-3 font-semibold">Descripción</th>
              <th class="pb-2 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(c, i) in cards"
              :key="c.id"
              class="border-t border-slate-100 dark:border-slate-800"
            >
              <td class="py-2.5 pr-3 font-mono text-slate-700 dark:text-slate-200">{{ maskCard(c.card) }}</td>
              <td class="py-2.5 pr-3 font-mono text-slate-500 dark:text-slate-400">{{ c.month }}/{{ c.year }}</td>
              <td class="py-2.5 pr-3 font-mono text-slate-500 dark:text-slate-400">{{ c.cvv }}</td>
              <td class="py-2.5 pr-3 font-mono text-slate-500 dark:text-slate-400">₡{{ c.amount }}</td>
              <td class="py-2.5 pr-3 text-slate-600 dark:text-slate-300">{{ c.description }}</td>
              <td class="py-2.5 text-right whitespace-nowrap">
                <button @click="openEditCard(i)" class="text-cyan-600 dark:text-cyan-400 hover:underline font-medium mr-3">Editar</button>
                <button @click="deleteCard(i)" class="text-red-500 dark:text-red-400 hover:underline font-medium">Eliminar</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- ── Terminal modal ─────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showTerminalModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeTerminalModal">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeTerminalModal" />
          <div class="relative w-full max-w-lg max-h-[85vh] flex flex-col card overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ editingTerminalIndex === null ? 'Nueva terminal' : 'Editar terminal' }}
              </h2>
              <button @click="closeTerminalModal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label text-[10px]">Merchant ID</label>
                  <input v-model="terminalForm.merchantId" type="text" class="input-field text-xs" placeholder="60001002" />
                </div>
                <div>
                  <label class="label text-[10px]">Terminal ID</label>
                  <input v-model="terminalForm.terminalId" type="text" class="input-field text-xs" placeholder="60001002" />
                </div>
              </div>
              <div>
                <label class="label text-[10px]">Private Key</label>
                <input v-model="terminalForm.privateKey" type="text" class="input-field text-xs font-mono" placeholder="CnDPUk4L..." />
              </div>
              <div>
                <label class="label text-[10px]">Public Key</label>
                <input v-model="terminalForm.publicKey" type="text" class="input-field text-xs font-mono" placeholder="jyY8pQu/..." />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label text-[10px]">Audience</label>
                  <input v-model="terminalForm.audience" type="text" class="input-field text-xs" placeholder="BCO" />
                </div>
                <div>
                  <label class="label text-[10px]">Descripción</label>
                  <input v-model="terminalForm.description" type="text" class="input-field text-xs" placeholder="Terminal de Prueba" />
                </div>
              </div>

              <p class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-1">Campos opcionales (Request)</p>
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="label text-[10px]">Wallet</label>
                  <input v-model="terminalForm.wallet" type="text" class="input-field text-xs" placeholder="C" />
                </div>
                <div>
                  <label class="label text-[10px]">CryptogramEci</label>
                  <input v-model="terminalForm.cryptogramEci" type="text" class="input-field text-xs" placeholder="42" />
                </div>
              </div>
              <div>
                <label class="label text-[10px]">Cryptogram</label>
                <input v-model="terminalForm.cryptogram" type="text" class="input-field text-xs font-mono" placeholder="TESTING_CRYPTO" />
              </div>
              <div>
                <label class="label text-[10px]">IsApplePayTransaction</label>
                <input v-model="terminalForm.isApplePayTransaction" type="text" class="input-field text-xs" placeholder="N" maxlength="1" />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button @click="closeTerminalModal" class="btn-secondary text-xs py-2 px-4">Cancelar</button>
              <button
                @click="saveTerminal"
                :disabled="!isTerminalFormValid"
                class="btn-primary text-xs py-2 px-4"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>

    <!-- ── Card modal ─────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="modal-fade">
        <div v-if="showCardModal" class="fixed inset-0 z-50 flex items-center justify-center p-4" @click.self="closeCardModal">
          <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" @click="closeCardModal" />
          <div class="relative w-full max-w-md flex flex-col card overflow-hidden">
            <div class="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 class="text-sm font-semibold text-slate-800 dark:text-slate-100">
                {{ editingCardIndex === null ? 'Nueva tarjeta' : 'Editar tarjeta' }}
              </h2>
              <button @click="closeCardModal" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="px-5 py-4 space-y-3">
              <div>
                <label class="label text-[10px]">Número de tarjeta</label>
                <input v-model="cardForm.card" type="text" class="input-field text-xs font-mono" placeholder="4000000000002503" maxlength="19" />
              </div>
              <div class="grid grid-cols-3 gap-3">
                <div>
                  <label class="label text-[10px]">Mes exp.</label>
                  <input v-model="cardForm.month" type="text" class="input-field text-xs" placeholder="MM" maxlength="2" />
                </div>
                <div>
                  <label class="label text-[10px]">Año exp.</label>
                  <input v-model="cardForm.year" type="text" class="input-field text-xs" placeholder="YYYY" maxlength="4" />
                </div>
                <div>
                  <label class="label text-[10px]">CVV</label>
                  <input v-model="cardForm.cvv" type="text" class="input-field text-xs" placeholder="123" maxlength="4" />
                </div>
              </div>
              <div>
                <label class="label text-[10px]">Monto ₡</label>
                <input v-model.number="cardForm.amount" type="number" min="1" class="input-field text-xs" placeholder="500" />
              </div>
              <div>
                <label class="label text-[10px]">Descripción</label>
                <input v-model="cardForm.description" type="text" class="input-field text-xs" placeholder="VISA 3DS challenge" />
              </div>
            </div>

            <div class="flex items-center justify-end gap-2 px-5 py-4 border-t border-slate-200 dark:border-slate-700">
              <button @click="closeCardModal" class="btn-secondary text-xs py-2 px-4">Cancelar</button>
              <button
                @click="saveCard"
                :disabled="!isCardFormValid"
                class="btn-primary text-xs py-2 px-4"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.slide-down-enter-active, .slide-down-leave-active { transition: all 0.2s ease; }
.slide-down-enter-from, .slide-down-leave-to { opacity: 0; transform: translateY(-4px); }
.modal-fade-enter-active, .modal-fade-leave-active { transition: all 0.2s ease; }
.modal-fade-enter-from, .modal-fade-leave-to { opacity: 0; transform: scale(0.97); }
</style>
