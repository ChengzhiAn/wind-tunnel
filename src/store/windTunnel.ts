import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

type Esp32Telemetry = {
  armed: boolean
  timeout: boolean
  pulse_us: number
}

export const useWindTunnelStore = defineStore('windTunnel', () => {
  const isFanOn = ref(false)
  // UI 输入：0-100% 油门（用于真实 ESP32 控制）
  const targetThrottlePct = ref(0)
  // UI 显示/模拟：0-200 km/h（未连接 ESP32 时用于模拟物理与图表）
  const targetSpeedKmh = computed(() => Math.round(targetThrottlePct.value * 2))
  const actualSpeedMs = ref(0)
  const testTime = ref(0)
  let timer: number | null = null

  const airDensity = ref(1.15)
  const staticPress = ref(101325)
  const frontalArea = 2.34

  const dragForce = ref(0)
  const downForce = ref(0)

  // ESP32连接相关
  const isEsp32Connected = ref(false)
  const esp32Ip = ref('192.168.4.1')
  const esp32ConnectionStatus = ref<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected')
  const lastConnectionError = ref('')
  const esp32Telemetry = ref<Esp32Telemetry | null>(null)
  const lastTelemetryAt = ref<number | null>(null)
  let telemetryTimer: number | null = null
  let keepAliveTimer: number | null = null

  const dynamicPressure = computed(() => {
    return 0.5 * airDensity.value * Math.pow(actualSpeedMs.value, 2)
  })
  
  const dragCoef = computed(() => {
    if (dynamicPressure.value < 10) return 0.0
    return dragForce.value / (dynamicPressure.value * frontalArea)
  })

  const reynoldsNumber = computed(() => {
    return Math.floor(actualSpeedMs.value * 100000) 
  })

  const historyTime = ref<string[]>([])
  const historyWindSpeed = ref<number[]>([])
  const historyDragForce = ref<number[]>([])

  const historyData = computed(() => ({
    time: historyTime.value,
    windSpeed: historyWindSpeed.value,
    dragForce: historyDragForce.value
  }))

  let tickCount = 0

  const updatePhysics = () => {
    const targetMs = targetSpeedKmh.value / 3.6
    actualSpeedMs.value += (targetMs - actualSpeedMs.value) * 0.05
    
    if (!isFanOn.value) targetThrottlePct.value = 0

    if (actualSpeedMs.value > 1) {
      const theoreticalDrag = dynamicPressure.value * 0.24 * frontalArea
      dragForce.value = theoreticalDrag + (Math.random() - 0.5) * 5
      downForce.value = theoreticalDrag * 0.3 + (Math.random() - 0.5) * 2
    } else {
      dragForce.value = 0
      downForce.value = 0
    }

    testTime.value += 0.1

    tickCount++
    if (tickCount % 3 === 0) {
      const d = new Date()
      const ts = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0')
      historyTime.value.push(ts)
      historyWindSpeed.value.push(Number((actualSpeedMs.value * 3.6).toFixed(1)))
      historyDragForce.value.push(Number(dragForce.value.toFixed(0)))

      if (historyTime.value.length > 50) {
        historyTime.value.shift()
        historyWindSpeed.value.shift()
        historyDragForce.value.shift()
      }
    }
  }

  const stopTelemetryLoop = () => {
    if (telemetryTimer) {
      window.clearInterval(telemetryTimer)
      telemetryTimer = null
    }
  }

  const stopKeepAliveLoop = () => {
    if (keepAliveTimer) {
      window.clearInterval(keepAliveTimer)
      keepAliveTimer = null
    }
  }

  const startKeepAliveLoop = () => {
    stopKeepAliveLoop()
    keepAliveTimer = window.setInterval(() => {
      if (isEsp32Connected.value && isFanOn.value) {
        sendControlCommand(targetThrottlePct.value).catch(() => {})
      }
    }, 500)
  }

  const pollTelemetryOnce = async () => {
    if (!isEsp32Connected.value) return
    try {
      const response = await fetch(`http://${esp32Ip.value}/telemetry`, { method: 'GET' })
      if (!response.ok) throw new Error('telemetry http error')
      const json = (await response.json()) as Esp32Telemetry
      esp32Telemetry.value = json
      lastTelemetryAt.value = Date.now()
    } catch {
      // 不强制断开；让 UI 显示遥测过期即可
    }
  }

  const startTelemetryLoop = () => {
    stopTelemetryLoop()
    pollTelemetryOnce()
    telemetryTimer = window.setInterval(pollTelemetryOnce, 500)
  }

  const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit & { timeoutMs?: number } = {}) => {
    const { timeoutMs = 3000, ...rest } = init
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(input, { ...rest, signal: controller.signal })
    } finally {
      window.clearTimeout(timeout)
    }
  }

  const connectToEsp32 = async () => {
    esp32ConnectionStatus.value = 'connecting'
    lastConnectionError.value = ''
    
    try {
      // 1) health probe (gives clearer error than POST)
      const healthUrl = `http://${esp32Ip.value}/health`
      const healthResp = await fetchWithTimeout(healthUrl, { method: 'GET', timeoutMs: 3000 })
      if (!healthResp.ok) {
        throw new Error(`health ${healthResp.status}`)
      }

      // 2) send a safe 0% command
      const controlUrl = `http://${esp32Ip.value}/control`
      const response = await fetchWithTimeout(controlUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'speed=0',
        timeoutMs: 3000
      })
      if (response.ok) {
        isEsp32Connected.value = true
        esp32ConnectionStatus.value = 'connected'
        startTelemetryLoop()
        return true
      } else {
        throw new Error(`control ${response.status}`)
      }
    } catch (error) {
      isEsp32Connected.value = false
      esp32ConnectionStatus.value = 'error'
      if (error instanceof DOMException && error.name === 'AbortError') {
        lastConnectionError.value = '请求超时'
      } else {
        lastConnectionError.value = error instanceof Error ? error.message : '连接失败'
      }
      stopTelemetryLoop()
      return false
    }
  }

  const disconnectFromEsp32 = () => {
    isEsp32Connected.value = false
    esp32ConnectionStatus.value = 'disconnected'
    stopTelemetryLoop()
    stopKeepAliveLoop()
  }

  // speed: 0-100 (%)
  const sendControlCommand = async (speed: number) => {
    if (!isEsp32Connected.value) {
      return false
    }
    try {
      const response = await fetch(`http://${esp32Ip.value}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `speed=${speed}`
      })
      if (response.ok) {
        return true
      } else {
          disconnectFromEsp32()
          return false
      }
    } catch (error) {
      disconnectFromEsp32()
      return false
    }
  }

  const toggleFan = async () => {
    isFanOn.value = !isFanOn.value
    
    if (isEsp32Connected.value) {
      if (isFanOn.value) {
        if (targetThrottlePct.value === 0) {
          targetThrottlePct.value = 20
        }
        await sendControlCommand(targetThrottlePct.value)
        startKeepAliveLoop()
      } else {
        stopKeepAliveLoop()
        await sendControlCommand(0)
      }
    } else {
      if (isFanOn.value && targetThrottlePct.value === 0) {
        targetThrottlePct.value = 20
      }
      if (!timer) timer = window.setInterval(updatePhysics, 100)
    }
  }

  const formatTime = computed(() => {
    const s = Math.floor(testTime.value)
    const mm = String(Math.floor(s / 60)).padStart(2, '0')
    const ss = String(s % 60).padStart(2, '0')
    return `${mm}:${ss}`
  })

  return {
    isFanOn, targetThrottlePct, targetSpeedKmh, actualSpeedMs, testTime,
    airDensity, staticPress, dynamicPressure,
    dragForce, downForce, dragCoef, reynoldsNumber,
    historyData, formatTime, toggleFan,
    isEsp32Connected, esp32Ip, esp32ConnectionStatus, lastConnectionError,
    esp32Telemetry, lastTelemetryAt,
    connectToEsp32, disconnectFromEsp32, sendControlCommand
  }
})