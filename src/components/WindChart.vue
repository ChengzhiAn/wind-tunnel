<template>
  <v-chart style="width: 100%; height: 100%;" :option="chartOption" autoresize />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useWindTunnelStore } from '../store/windTunnel'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import VChart from 'vue-echarts'

// 注册必须的 ECharts 组件
use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const wtStore = useWindTunnelStore()

const chartOption = computed(() => {
  return {
    // 🌟 核心修复 1：关闭动画，解决 10Hz 高频刷新导致的 setOption 进程冲突报错
    animation: false, 
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(0, 20, 30, 0.8)',
      borderColor: 'rgba(0, 255, 255, 0.3)',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    grid: { 
      // 🌟 核心修复 2：删掉 outerBounds 和 containLabel，直接用固定百分比留出边距
      left: '12%',   // 给左侧 Y 轴数字留出空间
      right: '5%', 
      bottom: '15%', // 给底部时间留出空间
      top: '15%'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: wtStore.historyData.time,
      axisLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.2)' } },
      axisLabel: { color: '#6b7280', fontSize: 10 } 
    },
    yAxis: {
      type: 'value',
      name: 'km/h',
      nameTextStyle: { color: '#22d3ee', fontSize: 10, align: 'right' },
      splitLine: { lineStyle: { color: 'rgba(0, 255, 255, 0.05)', type: 'dashed' } },
      axisLabel: { color: '#22d3ee', fontSize: 11, fontWeight: 'bold' }
    },
    series:[
      {
        name: '实际风速',
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#22d3ee' },
        lineStyle: { width: 2, shadowColor: 'rgba(34,211,238,0.5)', shadowBlur: 5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops:[
              { offset: 0, color: 'rgba(34,211,238,0.4)' }, 
              { offset: 1, color: 'rgba(34,211,238,0.0)' }
            ]
          }
        },
        data: wtStore.historyData.windSpeed
      }
    ]
  }
})
</script>