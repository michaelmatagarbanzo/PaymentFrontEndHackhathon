<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import type { Merchant } from '@/types'

const props = defineProps<{
  merchants: Merchant[]
  modelValue: Merchant | null
  loading?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [merchant: Merchant | null]
}>()

const CUSTOM_VALUE = '__custom__'
const showCustomForm = ref(false)

const customForm = reactive<{
  merchantId: string
  terminalId: string
  privateKey: string
  publicKey: string
  audience: string
  description: string
  wallet: string
  cryptogramEci: string
  cryptogram: string
  isApplePayTransaction: string
}>({
  merchantId: '',
  terminalId: '',
  privateKey: '',
  publicKey: '',
  audience: 'BCO',
  description: 'Custom',
  wallet: '',
  cryptogramEci: '',
  cryptogram: '',
  isApplePayTransaction: '',
})

const isCustomFormValid = computed(() =>
  customForm.merchantId.trim() !== '' &&
  customForm.terminalId.trim() !== '' &&
  customForm.privateKey.trim() !== '' &&
  customForm.publicKey.trim() !== '' &&
  customForm.audience.trim() !== ''
)

function onSelect(e: Event) {
  const val = (e.target as HTMLSelectElement).value
  if (val === CUSTOM_VALUE) {
    showCustomForm.value = true
    emit('update:modelValue', null)
    return
  }
  showCustomForm.value = false
  const found = props.merchants.find((m) => m.terminalId === val) ?? null
  emit('update:modelValue', found)
}

function applyCustom() {
  if (!isCustomFormValid.value) return
  const merchant: Merchant = {
    merchantId: customForm.merchantId.trim(),
    terminalId: customForm.terminalId.trim(),
    privateKey: customForm.privateKey.trim(),
    publicKey: customForm.publicKey.trim(),
    audience: customForm.audience.trim(),
    description: customForm.description.trim() || 'Custom',
    ...(customForm.wallet.trim() && { wallet: customForm.wallet.trim() }),
    ...(customForm.cryptogramEci.trim() && { cryptogramEci: customForm.cryptogramEci.trim() }),
    ...(customForm.cryptogram.trim() && { cryptogram: customForm.cryptogram.trim() }),
    ...(customForm.isApplePayTransaction.trim() && { isApplePayTransaction: customForm.isApplePayTransaction.trim() }),
  }
  emit('update:modelValue', merchant)
}

const selectValue = computed(() => {
  if (showCustomForm.value) return CUSTOM_VALUE
  return props.modelValue?.terminalId ?? ''
})
</script>

<template>
  <div>
    <label class="label">Terminal / Merchant</label>
    <div class="relative">
      <select
        :value="selectValue"
        :disabled="loading"
        class="input-field appearance-none pr-10 cursor-pointer"
        @change="onSelect"
      >
        <option value="" disabled>Seleccione una terminal...</option>
        <option
          v-for="m in merchants"
          :key="m.terminalId"
          :value="m.terminalId"
        >
          [{{ m.terminalId }}] {{ m.description }}
        </option>
        <option :value="CUSTOM_VALUE">— Terminal personalizada —</option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-3 flex items-center">
        <svg class="w-4 h-4 text-slate-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
        </svg>
      </div>
    </div>

    <!-- Custom merchant form -->
    <Transition name="slide-down">
      <div v-if="showCustomForm" class="mt-3 space-y-2">
        <p class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Datos requeridos</p>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label text-[10px]">Merchant ID</label>
            <input v-model="customForm.merchantId" type="text" class="input-field text-xs" placeholder="60001002" />
          </div>
          <div>
            <label class="label text-[10px]">Terminal ID</label>
            <input v-model="customForm.terminalId" type="text" class="input-field text-xs" placeholder="60001002" />
          </div>
        </div>
        <div>
          <label class="label text-[10px]">Private Key</label>
          <input v-model="customForm.privateKey" type="text" class="input-field text-xs font-mono" placeholder="CnDPUk4L..." />
        </div>
        <div>
          <label class="label text-[10px]">Public Key</label>
          <input v-model="customForm.publicKey" type="text" class="input-field text-xs font-mono" placeholder="jyY8pQu/..." />
        </div>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label text-[10px]">Audience</label>
            <input v-model="customForm.audience" type="text" class="input-field text-xs" placeholder="BCO" />
          </div>
          <div>
            <label class="label text-[10px]">Descripción</label>
            <input v-model="customForm.description" type="text" class="input-field text-xs" placeholder="Custom" />
          </div>
        </div>

        <p class="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide pt-1">Campos opcionales (Request)</p>
        <div class="grid grid-cols-2 gap-2">
          <div>
            <label class="label text-[10px]">Wallet</label>
            <input v-model="customForm.wallet" type="text" class="input-field text-xs" placeholder="C" />
          </div>
          <div>
            <label class="label text-[10px]">CryptogramEci</label>
            <input v-model="customForm.cryptogramEci" type="text" class="input-field text-xs" placeholder="42" />
          </div>
        </div>
        <div>
          <label class="label text-[10px]">Cryptogram</label>
          <input v-model="customForm.cryptogram" type="text" class="input-field text-xs font-mono" placeholder="TESTING_CRYPTO" />
        </div>
        <div>
          <label class="label text-[10px]">IsApplePayTransaction</label>
          <input v-model="customForm.isApplePayTransaction" type="text" class="input-field text-xs" placeholder="N" maxlength="1" />
        </div>

        <button
          @click="applyCustom"
          :disabled="!isCustomFormValid"
          class="w-full py-2 rounded-lg text-xs font-semibold transition-all"
          :class="isCustomFormValid
            ? 'bg-cyan-500 hover:bg-cyan-400 text-white'
            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed border border-slate-200 dark:border-slate-700'"
        >
          Aplicar terminal
        </button>
      </div>
    </Transition>

    <!-- Selected merchant info (preset) -->
    <Transition name="slide-down">
      <div
        v-if="modelValue && !showCustomForm"
        class="mt-2 p-3 rounded-lg bg-cyan-50 dark:bg-cyan-950/50 border border-cyan-200 dark:border-cyan-800 text-xs font-mono space-y-1"
      >
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400">Merchant ID</span>
          <span class="text-cyan-700 dark:text-cyan-300">{{ modelValue.merchantId }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400">Terminal ID</span>
          <span class="text-cyan-700 dark:text-cyan-300">{{ modelValue.terminalId }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400">Public Key</span>
          <span class="text-slate-600 dark:text-slate-300 truncate max-w-[180px]">{{ modelValue.publicKey }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400">Audience</span>
          <span class="badge-cyan text-[10px]">{{ modelValue.audience }}</span>
        </div>
      </div>
    </Transition>

    <!-- Applied custom merchant info -->
    <Transition name="slide-down">
      <div
        v-if="modelValue && showCustomForm"
        class="mt-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs font-mono space-y-1"
      >
        <div class="flex items-center justify-between">
          <span class="text-slate-500">Merchant ID</span>
          <span class="text-emerald-700 dark:text-emerald-300">{{ modelValue.merchantId }}</span>
        </div>
        <div class="flex items-center justify-between">
          <span class="text-slate-500 dark:text-slate-400">Terminal ID</span>
          <span class="text-emerald-700 dark:text-emerald-300">{{ modelValue.terminalId }}</span>
        </div>
        <div class="flex items-center gap-1">
          <span class="text-emerald-600 dark:text-emerald-400 font-semibold">✓</span>
          <span class="text-emerald-600 dark:text-emerald-400">Terminal personalizada aplicada</span>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.slide-down-enter-active,
.slide-down-leave-active {
  transition: all 0.2s ease;
}
.slide-down-enter-from,
.slide-down-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
