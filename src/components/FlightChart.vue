<template>
  <div class="chart-container">
    <!-- 数值跳动区 -->
    <div class="data-board">
      <div class="data-item">
        <span class="label">当前速度 (m/s)</span>
        <span class="value text-cyan-400">{{ (rocketStore.velocity || 0).toFixed(0) }}</span>
      </div>
      <div class="data-item">
        <span class="label">当前高度 (km)</span>
        <span class="value text-blue-400">{{ rocketStore.altitude.toFixed(2) }}</span>
      </div>
    </div>
    
    <!-- ECharts 图表区 -->
    <v-chart class="echarts-box" :option="chartOption" autoresize />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRocketStore } from '../store/rocket'

// 引入 ECharts 核心与按需组件
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'

// 注册必须的 ECharts 组件
use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const rocketStore = useRocketStore()

// 使用 computed 动态生成图表配置项，ECharts 会自动监听并平滑重绘
const chartOption = computed(() => {
  return {
    tooltip: { trigger: 'axis' },
    legend: {
      itemWidth: 10,  // 缩小图例图标
      itemHeight: 6,
      textStyle: { 
        color: '#fff',
        fontSize: 10   // 缩小图例字号
      },
      top: '0%'       // 图例置顶，不占用下方空间
    },
    grid: { 
      left: '5%', right: '5%', bottom: '5%', top: '15%', 
      containLabel: true // 防裁剪
    },
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: rocketStore.historyData.time,
      axisLabel: { color: '#888' },
      axisLine: { lineStyle: { color: '#333' } }
    },
    yAxis: [
      {
        type: 'value',
        name: '速度',
        nameTextStyle: { color: '#00ffff' },
        axisLabel: { color: '#00ffff' },
        splitLine: { lineStyle: { color: '#ffffff10' } }
      },
      {
        type: 'value',
        name: '高度',
        nameTextStyle: { color: '#3b82f6' },
        axisLabel: { color: '#3b82f6' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '速度 (m/s)',
        type: 'line',
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#00ffff' },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [{ offset: 0, color: '#00ffff80' }, { offset: 1, color: '#00ffff00' }]
          }
        },
        data: rocketStore.historyData.velocity
      },
      {
        name: '高度 (km)',
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        showSymbol: false,
        itemStyle: { color: '#3b82f6' },
        data: rocketStore.historyData.altitude
      }
    ]
  }
})
</script>

<style scoped>
.chart-container {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.data-board {
  display: flex;
  justify-content: space-around;
  margin-bottom: 10px;
}

.data-item {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.label {
  font-size: 12px;
  color: #aaa;
}

.value {
  font-size: 24px;
  font-weight: bold;
  font-family: monospace;
}

.echarts-box {
  flex: 1;
  width: 100%;
}
</style>