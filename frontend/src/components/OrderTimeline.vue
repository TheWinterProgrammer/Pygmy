<template>
  <div class="order-timeline">
    <div
      v-for="(step, i) in steps"
      :key="step.key"
      :class="['timeline-step', { completed: step.done, active: step.active, last: i === steps.length - 1 }]"
    >
      <div class="step-connector" v-if="i < steps.length - 1" :class="{ filled: step.done }"></div>
      <div class="step-dot" :class="{ done: step.done, active: step.active }">
        <span v-if="step.done">✓</span>
        <span v-else-if="step.active" class="pulse-ring"></span>
      </div>
      <div class="step-label">
        <div class="step-name">{{ step.label }}</div>
        <div class="step-desc" v-if="step.active || step.done">{{ step.desc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({ status: { type: String, default: 'pending' } })

const ORDER_STEPS = [
  { key: 'pending',    label: 'Order Placed',   desc: 'We\'ve received your order.' },
  { key: 'processing', label: 'Processing',      desc: 'Your order is being prepared.' },
  { key: 'shipped',    label: 'Shipped',         desc: 'Your order is on the way!' },
  { key: 'completed',  label: 'Delivered',       desc: 'Order complete. Enjoy!' },
]

const statusOrder = ['pending', 'processing', 'shipped', 'completed']

const steps = computed(() => {
  const idx = statusOrder.indexOf(props.status)
  return ORDER_STEPS.map((s, i) => ({
    ...s,
    done: i < idx || (idx === -1 && s.key === 'completed'),
    active: i === idx || (idx === -1 && i === 0),
  }))
})
</script>

<style scoped>
.order-timeline {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 1.5rem 0;
  overflow-x: auto;
}

.timeline-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  position: relative;
  min-width: 80px;
}

.step-connector {
  position: absolute;
  top: 14px;
  left: 50%;
  right: -50%;
  height: 2px;
  background: rgba(255,255,255,.12);
  z-index: 0;
}
.timeline-step.last .step-connector { display: none; }
.step-connector.filled { background: var(--accent); }

.step-dot {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: rgba(255,255,255,.1);
  border: 2px solid rgba(255,255,255,.2);
  display: flex; align-items: center; justify-content: center;
  font-size: .8rem;
  position: relative;
  z-index: 1;
  transition: background .3s, border-color .3s;
}
.step-dot.done {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 700;
}
.step-dot.active {
  border-color: var(--accent);
  background: rgba(var(--accent-rgb,204,60,70),.15);
}

.pulse-ring {
  width: 10px; height: 10px;
  border-radius: 50%;
  background: var(--accent);
  animation: pulse-dot 1.5s infinite;
  display: block;
}
@keyframes pulse-dot {
  0% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.4); opacity: .6; }
  100% { transform: scale(1); opacity: 1; }
}

.step-label {
  text-align: center;
  margin-top: .6rem;
  padding: 0 .25rem;
}
.step-name {
  font-size: .78rem;
  font-weight: 600;
  color: rgba(255,255,255,.8);
}
.step-desc {
  font-size: .7rem;
  color: rgba(255,255,255,.45);
  margin-top: .15rem;
  line-height: 1.3;
}

.timeline-step.completed .step-name { color: #fff; }
.timeline-step.active .step-name { color: var(--accent); }
</style>
