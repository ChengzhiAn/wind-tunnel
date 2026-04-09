<template>
  <div class="hud-container font-mono">
    <!-- 1. 3D 背景层 (风洞场景) -->
    <div class="scene-layer">
      <WindTunnelScene />
    </div>

    <!-- 2. UI 覆盖层 -->
    <div class="hud-overlay pointer-events-none">
      
      <!-- [顶部] 全局任务状态 -->
      <header class="hud-header pointer-events-auto">
        <div class="mission-timer text-cyan-400">
          <span class="text-gray-500 mr-2 text-[1vh]">TEST DURATION</span>
          T+ {{ wtStore.formatTime }}
        </div>
        
        <div class="system-title-container">
          <div class="system-title text-shadow-glow">
            冷湖智能风洞测试系统 <span class="text-cyan-500">V3.0</span>
          </div>
          <div class="system-subtitle-en">
            LENGHU SMART WIND TUNNEL DIGITAL TWIN
          </div>
        </div>

        <div class="header-right-area">
          <div class="real-clock text-gray-400 mr-4">{{ realTime }}</div>
          <div class="status-led flex items-center">
            <span :class="['w-2 h-2 rounded-full mr-2', wtStore.isFanOn ? 'bg-green-400 shadow-[0_0_8px_#4ade80]' : 'bg-red-600']"></span>
            <span class="text-[1vh] text-cyan-500/80">LINK: 10Hz</span>
          </div>
          <!-- 预留全屏按钮 -->
          <div class="fullscreen-btn" @click="toggleFullscreen">🔳 全屏</div>
        </div>
      </header>

      <!--[主体] 左右数据面板 -->
      <main class="hud-main">
        
        <!-- ================= 左侧：流场动力 (FLOW & FACILITY) ================= -->
        <aside class="hud-side-left pointer-events-auto">
          <div class="section-label">FLOW DYNAMICS / 流场动力</div>
          
          <!-- 核心：风速 -->
          <div class="data-item mt-2">
            <div class="label flex justify-between">
              <span>WIND SPEED (km/h)</span>
              <span class="text-cyan-500">{{ wtStore.actualSpeedMs.toFixed(1) }} m/s</span>
            </div>
            <div class="value text-4xl text-white font-black text-shadow-glow">
              {{ (wtStore.actualSpeedMs * 3.6).toFixed(1) }}
            </div>
            <!-- 风速进度条 -->
            <div class="progress-bg mt-2 h-1.5">
              <div class="progress-bar bg-cyan-400" :style="{ width: Math.min((wtStore.actualSpeedMs * 3.6 / 200) * 100, 100) + '%' }"></div>
            </div>
          </div>

          <!-- 环境网格数据 -->
          <div class="data-item mt-4">
            <div class="label">TEST SECTION ENV / 测试段环境</div>
            <div class="grid grid-cols-2 gap-2 mt-1">
              <div class="env-cell">
                <div class="env-cell-title">AIR DENSITY (ρ)</div>
                <div class="env-cell-val">{{ wtStore.airDensity.toFixed(3) }} <span class="text-[1vh]">kg/m³</span></div>
              </div>
              <div class="env-cell">
                <div class="env-cell-title">DYNAMIC PRESS (q)</div>
                <div class="env-cell-val text-yellow-400">{{ wtStore.dynamicPressure.toFixed(1) }} <span class="text-[1vh]">Pa</span></div>
              </div>
            </div>
          </div>

          <!-- 风速曲线图占位 -->
          <div class="data-item flex-1 border-t border-cyan-500/20 mt-4 pt-4 flex flex-col">
            <div class="label">WIND PROFILE / 气流稳定性</div>
            <!-- 这里可以放一个 ECharts 折线图，目前用工业风网格占位 -->
            <div class="chart-placeholder flex-1 w-full mt-2 border border-cyan-900/30 relative">
               <div class="absolute inset-0 flex items-center justify-center text-cyan-800/50 text-[1vh]">CHART AREA</div>
            </div>
          </div>
        </aside>

        <!-- ================= 中间：交互与控制 (CONTROL DECK) ================= -->
        <section class="hud-center">
          
          <!-- 瞄准框 -->
          <div class="targeting-reticle">
            <div class="reticle-bracket bracket-tl"></div><div class="reticle-bracket bracket-tr"></div>
            <div class="reticle-bracket bracket-bl"></div><div class="reticle-bracket bracket-br"></div>
            <div class="center-cross"></div>
          </div>

          <!-- 底部控制台 -->
          <div class="control-console pointer-events-auto">
            <button class="power-btn" @click="wtStore.toggleFan" :class="wtStore.isFanOn ? 'active' : ''">
              {{ wtStore.isFanOn ? 'STOP FAN / 停机' : 'START FAN / 启动风机' }}
            </button>
            
            <!-- 风速滑动条 (仅在启动时可用) -->
            <div class="slider-container" :class="{'opacity-30 pointer-events-none': !wtStore.isFanOn}">
              <div class="flex justify-between text-[1vh] text-cyan-400 mb-1 font-bold">
                <span>TARGET: {{ wtStore.targetSpeedKmh }} km/h</span>
                <span>MAX: 200</span>
              </div>
              <input 
                type="range" min="0" max="200" step="5" 
                v-model="wtStore.targetSpeedKmh" 
                class="industrial-slider"
              >
            </div>
          </div>
        </section>

        <!-- ================= 右侧：空气动力学 (AERODYNAMICS) ================= -->
        <aside class="hud-side-right pointer-events-auto">
          <div class="section-label text-right">AERODYNAMICS / 气动测力</div>

          <!-- 阻力数据 -->
          <div class="data-item text-right mt-2">
            <div class="label">DRAG FORCE (Fx) / 风阻力</div>
            <div class="value text-4xl text-red-400 font-black" style="text-shadow: 0 0 15px rgba(248, 113, 113, 0.6);">
              {{ wtStore.dragForce.toFixed(1) }} <span class="text-xl text-red-500/80">N</span>
            </div>
          </div>

          <!-- 气动系数网格 -->
          <div class="data-item mt-4 text-right">
            <div class="label">COEFFICIENTS / 气动系数</div>
            <div class="grid grid-cols-2 gap-2 mt-1 text-left">
              <div class="env-cell border-red-900/30">
                <div class="env-cell-title text-red-400/80">DOWNFORCE (Fz)</div>
                <div class="env-cell-val text-red-300">{{ wtStore.downForce.toFixed(1) }} <span class="text-[1vh]">N</span></div>
              </div>
              <div class="env-cell border-green-900/30">
                <div class="env-cell-title text-green-400/80">DRAG COEF (Cd)</div>
                <div class="env-cell-val text-green-300">{{ wtStore.dragCoef.toFixed(3) }}</div>
              </div>
            </div>
          </div>

          <!-- 高级物理参数 -->
          <div class="data-item text-right mt-4">
            <div class="label">REYNOLDS NUMBER / 雷诺数</div>
            <div class="value text-xl text-purple-400">{{ (wtStore.reynoldsNumber).toLocaleString() }}</div>
          </div>

          <!-- 受力曲线图占位 -->
          <div class="data-item flex-1 border-t border-cyan-500/20 mt-4 pt-4 flex flex-col">
            <div class="label text-right">FORCE TREND / 测力曲线</div>
            <div class="chart-placeholder flex-1 w-full mt-2 border border-red-900/30 relative">
               <div class="absolute inset-0 flex items-center justify-center text-red-800/50 text-[1vh]">CHART AREA</div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import WindTunnelScene from './components/WindTunnelScene.vue' // 确保你的3D组件名叫这个
import { useWindTunnelStore } from './store/windTunnel'

const wtStore = useWindTunnelStore()

// 时钟与全屏逻辑
const realTime = ref('')
let clockTimer: number

const updateClock = () => {
  const now = new Date()
  realTime.value = now.toTimeString().split(' ')[0]
}

const isFullscreen = ref(false)
const toggleFullscreen = () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen()
    isFullscreen.value = true
  } else if (document.exitFullscreen) {
    document.exitFullscreen()
    isFullscreen.value = false
  }
}

onMounted(() => {
  updateClock()
  clockTimer = window.setInterval(updateClock, 1000)
})

onBeforeUnmount(() => {
  window.clearInterval(clockTimer)
})
</script>

<style scoped>
/* 基础适配 */
.hud-container {
  @apply relative w-screen bg-black overflow-hidden text-white selection:bg-cyan-500/30;
  height: 100vh; height: 100dvh; 
}
.scene-layer { @apply absolute inset-0 z-0; }
.hud-overlay { @apply absolute inset-0 z-10 flex flex-col; }

/* 顶部 */
.hud-header {
  @apply flex justify-between items-center px-8 h-[8vh];
  background: linear-gradient(to bottom, rgba(0, 255, 255, 0.1) 0%, transparent 100%);
  border-bottom: 1px solid rgba(0, 255, 255, 0.2);
}
.system-title-container { @apply absolute left-1/2 -translate-x-1/2 flex flex-col items-center pointer-events-none; }
.system-title { @apply text-[2.5vh] font-black tracking-[0.3em] leading-tight text-shadow-glow; }
.system-subtitle-en { font-size: 0.9vh; @apply font-bold tracking-[0.5em] text-cyan-500 uppercase mt-0.5 opacity-70; }
.mission-timer, .real-clock { font-size: 1.8vh; @apply font-bold tabular-nums; }
.header-right-area { @apply flex items-center ml-auto z-10; }
.fullscreen-btn { @apply px-2 py-0.5 border border-cyan-500/50 text-[1vh] text-cyan-400 cursor-pointer hover:bg-cyan-500/20 ml-4 rounded; }

/* 主体左右侧边栏 */
.hud-main { @apply flex-1 relative flex justify-between px-8 py-[3vh]; }
.hud-side-left, .hud-side-right {
  width: 22vw; min-width: 320px;
  @apply flex flex-col gap-[1.5vh];
}
.hud-side-left { @apply border-l border-cyan-500/20 pl-6; }
.hud-side-right { @apply border-r border-cyan-500/20 pr-6; }

/* 数据网格样式 */
.section-label { font-size: 1.3vh; @apply text-cyan-400 font-bold tracking-widest mb-1 opacity-90; }
.data-item .label { font-size: 1.1vh; @apply text-gray-400 uppercase tracking-wider opacity-80; }
.env-cell { @apply bg-cyan-950/30 border border-cyan-500/20 p-2 flex flex-col justify-center; }
.env-cell-title { font-size: 0.9vh; @apply text-gray-400 mb-1 font-bold; }
.env-cell-val { font-size: 2.2vh; @apply font-black tabular-nums text-white; }

/* 进度条 */
.progress-bg { @apply w-full bg-gray-800 rounded-sm overflow-hidden; }
.progress-bar { @apply h-full shadow-[0_0_10px_#22d3ee] transition-all duration-[100ms] ease-linear; }

/* 图表占位符背景 */
.chart-placeholder {
  background: repeating-linear-gradient(0deg, transparent, transparent 19%, rgba(0,255,255,0.05) 20%),
              repeating-linear-gradient(90deg, transparent, transparent 19%, rgba(0,255,255,0.05) 20%);
  background-size: 5vh 5vh;
}

/* ================== 中间控制区 ================== */
.hud-center { @apply flex-1 relative flex justify-center items-center; }

.targeting-reticle {
  @apply absolute top-1/2 left-1/2 flex justify-center items-center pointer-events-none;
  transform: translate(-50%, -55%);
  height: 50vh; width: calc(50vh * 1.5); /* 风洞比较长，框改宽一点 */
}
.reticle-bracket { @apply absolute border-cyan-500/50; width: 4vh; height: 4vh; }
.bracket-tl { @apply top-0 left-0 border-t-2 border-l-2; }
.bracket-tr { @apply top-0 right-0 border-t-2 border-r-2; }
.bracket-bl { @apply bottom-0 left-0 border-b-2 border-l-2; }
.bracket-br { @apply bottom-0 right-0 border-b-2 border-r-2; }
.center-cross { @apply absolute w-4 h-4; background: radial-gradient(circle, #22d3ee 1.5px, transparent 1.5px); }

/* 底部操作台 */
.control-console {
  @apply absolute bottom-[4vh] w-[35vh] flex flex-col gap-3 p-4 bg-black/40 backdrop-blur-md border border-cyan-500/30 rounded-lg shadow-[0_0_20px_rgba(0,255,255,0.1)];
}

.power-btn {
  @apply w-full py-2 border border-cyan-500/50 text-cyan-400 text-[1.5vh] font-black tracking-widest transition-all bg-cyan-900/20;
}
.power-btn.active {
  @apply bg-red-600/80 border-red-400 text-white shadow-[0_0_15px_rgba(220,38,38,0.6)];
}

/* 工业滑块样式 */
.industrial-slider {
  @apply w-full appearance-none bg-gray-700 h-1 rounded outline-none;
}
.industrial-slider::-webkit-slider-thumb {
  @apply appearance-none w-3 h-5 bg-cyan-400 cursor-pointer shadow-[0_0_10px_#22d3ee];
  clip-path: polygon(0 0, 100% 0, 100% 70%, 50% 100%, 0 70%);
}

.text-shadow-glow { text-shadow: 0 0 10px rgba(0, 255, 255, 0.5); }
</style>