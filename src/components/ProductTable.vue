<script setup lang="ts">
import type { Product } from '@/types'
import { formatCurrency } from '@/utils/currency'

defineProps<{
  products: Product[]
  total: number
}>()

const ICONS: Record<string, string> = {
  'Audífonos': '🎧',
  'Laptop': '💻',
  'Billetera': '👜',
  'Teléfono Celular': '📱',
  'Mouse': '🖱️',
  'Memoria RAM': '💾',
  'Monitor': '🖥️',
  'Micro SD': '💿',
  'Kingston A400 120GB': '🗄️',
  'Teamgroup T183 USB': '📦',
}

function getIcon(name: string): string {
  return ICONS[name] ?? '📦'
}
</script>

<template>
  <div class="overflow-hidden rounded-xl border border-slate-700/60">
    <!-- Table header -->
    <div class="grid grid-cols-12 gap-4 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
      <span class="col-span-5 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest">Producto</span>
      <span class="col-span-2 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest text-right">Precio</span>
      <span class="col-span-2 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest text-center">Cant.</span>
      <span class="col-span-3 text-[10px] font-mono font-medium text-slate-400 uppercase tracking-widest text-right">Subtotal</span>
    </div>

    <!-- Rows -->
    <div class="divide-y divide-slate-100">
      <div
        v-for="product in products"
        :key="product.id"
        class="grid grid-cols-12 gap-4 px-4 py-3 hover:bg-slate-50 transition-colors duration-150"
      >
        <div class="col-span-5 flex items-center gap-3">
          <span class="text-lg leading-none">{{ getIcon(product.nombre) }}</span>
          <div>
            <p class="text-sm text-slate-700 font-medium">{{ product.nombre }}</p>
            <p v-if="product.descripcion" class="text-xs text-slate-400 mt-0.5">{{ product.descripcion }}</p>
          </div>
        </div>
        <div class="col-span-2 flex items-center justify-end">
          <span class="text-sm font-mono text-slate-600">{{ formatCurrency(product.valor) }}</span>
        </div>
        <div class="col-span-2 flex items-center justify-center">
          <span class="badge-cyan text-xs">× {{ product.cantidadPedido }}</span>
        </div>
        <div class="col-span-3 flex items-center justify-end">
          <span class="text-sm font-mono font-semibold text-cyan-700">{{ formatCurrency(product.subTotal) }}</span>
        </div>
      </div>
    </div>

    <!-- Total -->
    <div class="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
      <span class="text-xs font-mono text-slate-400 uppercase tracking-widest">Total del Pedido</span>
      <span class="text-lg font-mono font-bold text-cyan-700">{{ formatCurrency(total) }}</span>
    </div>
  </div>
</template>
