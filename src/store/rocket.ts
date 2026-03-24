import { defineStore } from 'pinia'
import { ref, reactive, computed } from 'vue'
import * as THREE from 'three'

export const useRocketStore = defineStore('rocket', () => {
  // --- 1. 基础任务状态 ---
  const isLaunched = ref(false)
  const flightTime = ref(0)
  let timer: number | null = null

  const stopMission = () => {
    if (timer) {
        clearInterval(timer)
        timer = null
    }
    isLaunched.value = false
  }

  // 【新增】数据源模式开关，默认开启演示模式，方便公网展示
  const isDemoMode = ref(true)

  // --- 2. 原始传感器数据 ---
  const acc = reactive({ x: 0, y: 0, z: 0 })
  const gyro = reactive({ x: 0, y: 0, z: 0 })
  const mag = reactive({ x: 0, y: 0, z: 0 })
  const quat_raw = reactive({ w: 1, x: 0, y: 0, z: 0 })
  
  const altitude = ref(0)
  const temperature = ref(20)
  const pressure = ref(101325)
  const pitch = ref(0)
  const yaw = ref(0)
  const roll = ref(0)

  // --- 3. 高级推导指标 ---
  const gForce = ref(1.0)
  const verticalSpeed = ref(0)
  const velocity = ref(0)
  const thrust = ref(0)
  const fuel = ref(100)
  const quaternion = reactive(new THREE.Quaternion())

  let lastHeight = 0
  let lastUpdateTime = Date.now()

  const historyData = reactive({
    time: [] as string[],
    altitude: [] as number[],
    velocity: [] as number[],
    temperature: [] as number[],
    pressure: [] as number[]
  })

  const formattedTime = computed(() => {
    const s = Math.floor(flightTime.value)
    const hh = String(Math.floor(s / 3600)).padStart(2, '0')
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
  })

  // 【新增】切换模式函数
  const toggleMode = () => {
    isDemoMode.value = !isDemoMode.value
    console.log("当前数据模式:", isDemoMode.value ? "SIMULATION" : "REAL TELEMETRY")
  }

  // 【核心修改】数据分发引擎
  const dataTick = async () => {
    const now = Date.now()
    const dt = (now - lastUpdateTime) / 1000

    if (isDemoMode.value) {
      // ===== 演示模式：纯算法模拟物理动态 =====
      if (isLaunched.value) {
        flightTime.value += dt
        verticalSpeed.value += 9.8 * dt * 0.5 // 模拟加速度
        altitude.value += (verticalSpeed.value * dt) / 1000 // 转为 km
        
        // 模拟环境变化
        temperature.value = Math.max(-50, 20 - altitude.value * 6.5) // 高度每升1km降6.5度
        pressure.value = Math.max(0, 101325 * Math.pow(1 - altitude.value / 44.3, 5.25))

        // --- 1. 修正姿态模拟逻辑 ---
        // 起飞初始 Pitch 为 90 (垂直)，随着高度上升，慢慢减小（重力转弯过程）
        pitch.value = Math.max(0, 90 - altitude.value * 3) 
        yaw.value = (Math.random() - 0.5) * 0.5   // 减小随机抖动，让它飞得更稳
        roll.value += 0.1                         // 让火箭有一点点自旋感

        // --- 2. 核心修正：将航天角度转换为 Three.js 弧度 ---
        // 公式：3D旋转弧度 = (90 - 航天俯仰角) * (PI / 180)
        // 当 pitch 为 90 时，xRot 为 0，火箭垂直向上
        // 当 pitch 减小时，xRot 变大，火箭向前方倾斜
        const xRot = (90 - pitch.value) * (Math.PI / 180)
        const yRot = yaw.value * (Math.PI / 180)
        const zRot = roll.value * (Math.PI / 180)

        // 使用 YXZ 顺序，先处理自旋(Z)，再处理俯仰(X)，最后处理偏航(Y)
        const euler = new THREE.Euler(xRot, yRot, zRot, 'YXZ')
        quaternion.setFromEuler(euler)
        
        // 模拟过载
        gForce.value = 1.2 + Math.random() * 0.3 + (verticalSpeed.value / 500)
        thrust.value = 7500 + Math.random() * 100
        fuel.value = Math.max(0, fuel.value - 0.05)
      }
    } else {
      // ===== 真实模式：从传感器获取 =====
      try {
        const response = await fetch('/api/getData', { signal: AbortSignal.timeout(1000) })
        const data = await response.json()

        acc.x = data.acc_x; acc.y = data.acc_y; acc.z = data.acc_z
        gyro.x = data.gyro_x; gyro.y = data.gyro_y; gyro.z = data.gyro_z
        mag.x = data.mag_x; mag.y = data.mag_y; mag.z = data.mag_z
        quat_raw.w = data.quat_w; quat_raw.x = data.quat_x; quat_raw.y = data.quat_y; quat_raw.z = data.quat_z
        
        altitude.value = data.height
        temperature.value = data.temperature
        pressure.value = data.pressure
        
        const radToDeg = 180 / Math.PI
        pitch.value = data.euler_pitch * radToDeg
        yaw.value = data.euler_yaw * radToDeg
        roll.value = data.euler_roll * radToDeg

        quaternion.set(data.quat_x, data.quat_y, data.quat_z, data.quat_w)

        gForce.value = Math.sqrt(acc.x**2 + acc.y**2 + acc.z**2) / 9.8
        verticalSpeed.value = dt > 0 ? (data.height - lastHeight) / dt : 0
        thrust.value = isLaunched.value ? 7500 + (Math.random() * 200) : 0
        if (isLaunched.value) {
          fuel.value = Math.max(0, fuel.value - 0.01)
          flightTime.value += dt
        }
      } catch (error) {
        console.warn('Telemetry lost, please check sensor connection.')
      }
    }

    velocity.value = Math.abs(verticalSpeed.value)
    lastHeight = altitude.value
    lastUpdateTime = now

    // ===== 统一抽取记录逻辑 =====
    const timeTag = new Date().toLocaleTimeString().split(' ')[0] || ''
    historyData.time.push(timeTag)
    historyData.altitude.push(Number(altitude.value.toFixed(3)))
    historyData.velocity.push(Number(verticalSpeed.value.toFixed(2)))
    historyData.temperature.push(Number(temperature.value.toFixed(1)))
    historyData.pressure.push(pressure.value)

    if (historyData.time.length > 50) {
      historyData.time.shift(); historyData.altitude.shift();
      historyData.velocity.shift(); historyData.temperature.shift();
      historyData.pressure.shift();
    }
  }

  const startLaunch = () => {
    if (isLaunched.value) return
    isLaunched.value = true
    lastUpdateTime = Date.now()
    lastHeight = altitude.value
    timer = window.setInterval(dataTick, 100) // 统一切换为 dataTick
  }

  return {
    stopMission,
    isLaunched, isDemoMode, toggleMode, // 导出新状态和方法
    flightTime, acc, gyro, mag, quat_raw, altitude, temperature, pressure,
    pitch, yaw, roll, gForce, verticalSpeed, velocity, thrust, fuel,
    quaternion, historyData, formattedTime, startLaunch
  }
})