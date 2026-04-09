import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'

export const useWindTunnelStore = defineStore('windTunnel', () => {
  // 1. 设备控制状态
  const isFanOn = ref(false)         // 风机是否启动
  const targetSpeedKmh = ref(0)      // 目标风速 (用户在面板设置的, km/h)
  const actualSpeedMs = ref(0)       // 实际风速 (m/s, 模拟风机加速延迟)
  const testTime = ref(0)            // 测试时长
  let timer: number | null = null

  // 2. 基础物理常数 (针对冷湖当地环境模拟)
  const airDensity = ref(1.15)       // 空气密度 ρ (kg/m³, 稍微稀薄的高原环境)
  const staticPress = ref(101325)    // 静压 (Pa)
  const frontalArea = 2.34           // 特斯拉 Model S 迎风面积 (m²)

  // 3. 传感器核心数据 (模拟值)
  const dragForce = ref(0)           // 风阻力 Fd (N)
  const downForce = ref(0)           // 下压力 Fz (N)

  // 4. 高级空气动力学推导数据
  // 动压 q = 0.5 * ρ * v²
  const dynamicPressure = computed(() => {
    return 0.5 * airDensity.value * Math.pow(actualSpeedMs.value, 2)
  })
  
  // 风阻系数 Cd = Fd / (q * A)
  const dragCoef = computed(() => {
    if (dynamicPressure.value < 10) return 0.0 // 风速太小时不计算，防止除以0
    return dragForce.value / (dynamicPressure.value * frontalArea)
  })

  // 雷诺数模拟 (体现气流状态)
  const reynoldsNumber = computed(() => {
    return Math.floor(actualSpeedMs.value * 100000) 
  })

  // 5. 历史曲线数据 (用于 ECharts)
  const historyData = reactive({
    time: [] as string[],
    windSpeed: [] as number[],
    dragForce: [] as number[]
  })

  // 6. 核心物理引擎循环 (10Hz)
  const updatePhysics = () => {
    // A. 模拟风机加减速的平滑过渡 (一阶惯性滞后)
    const targetMs = targetSpeedKmh.value / 3.6
    actualSpeedMs.value += (targetMs - actualSpeedMs.value) * 0.05
    
    // 如果关停风机，目标风速强制为 0
    if (!isFanOn.value) targetSpeedKmh.value = 0

    // B. 模拟拉力传感器数据 (阻力与速度平方成正比 + 传感器白噪声)
    if (actualSpeedMs.value > 1) {
      // 假设真实 Model S Cd 约为 0.24，反推阻力
      const theoreticalDrag = dynamicPressure.value * 0.24 * frontalArea
      dragForce.value = theoreticalDrag + (Math.random() - 0.5) * 5 // 增加 5N 的传感器震荡
      downForce.value = theoreticalDrag * 0.3 + (Math.random() - 0.5) * 2
    } else {
      dragForce.value = 0
      downForce.value = 0
    }

    testTime.value += 0.1

    // C. 记录图表历史数据
    const now = new Date().toLocaleTimeString().split(' ')[0] || ''
    historyData.time.push(now)
    historyData.windSpeed.push(Number((actualSpeedMs.value * 3.6).toFixed(1)))
    historyData.dragForce.push(Number(dragForce.value.toFixed(0)))

    // 限制数组长度，防止内存溢出
    if (historyData.time.length > 50) {
      historyData.time.shift()
      historyData.windSpeed.shift()
      historyData.dragForce.shift()
    }
  }

  // 7. 控制指令
  const toggleFan = () => {
    isFanOn.value = !isFanOn.value
    if (isFanOn.value && targetSpeedKmh.value === 0) {
      targetSpeedKmh.value = 60 // 默认启动给个 60km/h
    }
    if (!timer) timer = window.setInterval(updatePhysics, 100)
  }

  const formatTime = computed(() => {
    const s = Math.floor(testTime.value)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })

  return {
    isFanOn, targetSpeedKmh, actualSpeedMs, testTime,
    airDensity, staticPress, dynamicPressure,
    dragForce, downForce, dragCoef, reynoldsNumber,
    historyData, formatTime, toggleFan
  }
})