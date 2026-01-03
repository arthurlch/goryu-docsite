<script setup>
import DefaultTheme from 'vitepress/theme'
import { useData } from 'vitepress'
import { ref, onMounted } from 'vue'

const { Layout } = DefaultTheme
const { isDark } = useData()

const toggleAppearance = () => {
  isDark.value = !isDark.value
}
</script>

<template>
  <Layout>
    <template #sidebar-nav-before>
      <div class="sidebar-toggle-container">
        <button class="theme-toggle-btn" @click="toggleAppearance" aria-label="Toggle Theme">
          <span v-if="isDark">☀️ Light</span>
          <span v-else>🌙 Dark</span>
        </button>
      </div>
    </template>
  </Layout>
</template>

<style scoped>
.sidebar-toggle-container {
  padding: 12px 24px;
  display: flex;
  justify-content: flex-start;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 12px;
}

.theme-toggle-btn {
  background-color: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 6px;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.theme-toggle-btn:hover {
  background-color: var(--vp-c-bg-mute);
  border-color: var(--vp-c-brand-1);
}
</style>
