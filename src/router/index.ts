import { createRouter, createWebHistory } from 'vue-router'
import PaymentView from '@/views/PaymentView.vue'
import AutoTestView from '@/views/AutoTestView.vue'
import AutoRunnerView from '@/views/AutoRunnerView.vue'
import CheckoutView from '@/views/CheckoutView.vue'
import ResultView from '@/views/ResultView.vue'
import MaintenanceView from '@/views/MaintenanceView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'payment',
      component: PaymentView,
      meta: { title: 'Cliente' },
    },
    {
      path: '/auto-test',
      name: 'auto-test',
      component: AutoTestView,
      meta: { title: 'Auto QA' },
    },
    {
      // Headless runner — loaded inside hidden iframes, no nav link
      path: '/runner',
      name: 'runner',
      component: AutoRunnerView,
    },
    {
      path: '/checkout',
      name: 'checkout',
      component: CheckoutView,
      meta: { title: 'BCO Checkout' },
    },
    {
      path: '/result',
      name: 'result',
      component: ResultView,
      meta: { title: 'Resultado' },
    },
    {
      path: '/mantenimiento',
      name: 'maintenance',
      component: MaintenanceView,
      meta: { title: 'Mantenimiento' },
    },
  ],
})

router.afterEach((to) => {
  const title = to.meta.title as string | undefined
  document.title = title ? `${title} — 3DS Tester` : '3DS Payment Tester'
})

export default router
