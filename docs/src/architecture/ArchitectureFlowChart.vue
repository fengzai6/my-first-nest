<template>
  <div ref="chart" style="width: 100%; height: 400px"></div>
</template>

<script setup>
import { GraphChart } from 'echarts/charts';
import { TitleComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onMounted, ref } from 'vue';

echarts.use([GraphChart, TitleComponent, TooltipComponent, CanvasRenderer]);

const chart = ref(null);

onMounted(() => {
  const myChart = echarts.init(chart.value);
  const option = {
    tooltip: {},
    series: [
      {
        type: 'graph',
        layout: 'none',
        symbolSize: 80,
        roam: false,
        label: {
          show: true,
          fontSize: 16,
          color: '#333',
        },
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [4, 10],
        edgeLabel: {
          fontSize: 14,
        },
        data: [
          {
            name: '客户端\n(Client)',
            x: 100,
            y: 200,
            itemStyle: {
              color: '#D5E8D4',
              borderColor: '#82B366',
              borderWidth: 2,
            },
          },
          {
            name: '服务端\n(Server)',
            x: 400,
            y: 200,
            itemStyle: {
              color: '#DAE8FC',
              borderColor: '#6C8EBF',
              borderWidth: 2,
            },
          },
          {
            name: '数据库\n(Database)',
            x: 700,
            y: 200,
            itemStyle: {
              color: '#F8CECC',
              borderColor: '#B85450',
              borderWidth: 2,
            },
          },
        ],
        links: [
          {
            source: '客户端\n(Client)',
            target: '服务端\n(Server)',
            label: {
              show: true,
              formatter: 'HTTP/HTTPS',
            },
            lineStyle: {
              width: 2,
              curveness: 0,
            },
          },
          {
            source: '服务端\n(Server)',
            target: '数据库\n(Database)',
            label: {
              show: true,
              formatter: 'TCP/IP',
            },
            lineStyle: {
              width: 2,
              curveness: 0,
            },
          },
        ],
        lineStyle: {
          opacity: 0.9,
          width: 2,
          curveness: 0,
        },
      },
    ],
  };
  myChart.setOption(option);
});
</script>
