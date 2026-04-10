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

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent])

const wtStore = useWindTunnelStore()

const chartOption = computed(() => {
  return {
    // 🌟 关闭动画
    animation: false, 
    tooltip: { 
      trigger: 'axis',
      backgroundColor: 'rgba(30, 0, 0, 0.8)',
      borderColor: 'rgba(248, 113, 113, 0.3)',
      textStyle: { color: '#fff', fontSize: 12 }
    },
    grid: { 
      // 🌟 用固定百分比，解决布局崩溃
      left: '15%',   // 右侧因为数值可能比较大(几千N)，左侧留多一点空间
      right: '5%', 
      bottom: '15%', 
      top: '15%'
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: wtStore.historyData.time,
      axisLine: { lineStyle: { color: 'rgba(248, 113, 113, 0.2)' } },
      axisLabel: { color: '#6b7280', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      name: 'N (牛顿)',
      nameTextStyle: { color: '#f87171', fontSize: 10, align: 'right' },
      splitLine: { lineStyle: { color: 'rgba(248, 113, 113, 0.05)', type: 'dashed' } },
      axisLabel: { color: '#f87171', fontSize: 11, fontWeight: 'bold' } 
    },
    series:[
      {
        name: '气动阻力',
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#f87171' },
        lineStyle: { width: 2, shadowColor: 'rgba(248,113,113,0.5)', shadowBlur: 5 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops:[
              { offset: 0, color: 'rgba(248,113,113,0.4)' }, 
              { offset: 1, color: 'rgba(248,113,113,0.0)' }
            ]
          }
        },
        data: wtStore.historyData.dragForce
      }
    ]
  }
})
</script>