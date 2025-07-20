<template>
  <div ref="chart" style="width: 100%; height: 400px"></div>
</template>

<script setup>
import { GraphChart } from 'echarts/charts';
import {
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onMounted, ref } from 'vue';

echarts.use([
  GraphChart,
  TitleComponent,
  TooltipComponent,
  LegendComponent,
  CanvasRenderer,
]);

const chart = ref(null);

const nodes = [
  {
    id: 'client',
    name: '客户端',
    x: 100,
    y: 300,
    symbolSize: 80,
    category: 0,
  },
  {
    id: 'server',
    name: '服务端',
    x: 400,
    y: 300,
    symbolSize: 80,
    category: 1,
  },
  { id: 'db', name: '数据库', x: 700, y: 300, symbolSize: 80, category: 2 },
];

const links = [
  // Login Flow (Outbound: positive curveness)
  {
    source: 'client',
    target: 'server',
    label: { show: true, formatter: '1. 登录请求 (账号密码)' },
    lineStyle: { curveness: 0.1 },
  },
  {
    source: 'server',
    target: 'db',
    label: { show: true, formatter: '2. 校验用户信息' },
    lineStyle: { curveness: 0.1 },
  },
  {
    source: 'server',
    target: 'server',
    label: { show: true, position: 'top', formatter: '4. 生成双Token' },
  },
  {
    source: 'server',
    target: 'db',
    label: { show: true, formatter: '5. 存储RefreshToken' },
    lineStyle: { curveness: 0.2 },
  },

  // Login Flow (Inbound: negative curveness)
  {
    source: 'db',
    target: 'server',
    label: { show: true, formatter: '3. 返回用户信息' },
    lineStyle: { curveness: -0.1 },
  },
  {
    source: 'server',
    target: 'client',
    label: { show: true, formatter: '6. 返回双Token' },
    lineStyle: { curveness: -0.1 },
  },

  // API Request Flow
  {
    source: 'client',
    target: 'server',
    label: { show: true, formatter: '7. 携带AccessToken访问' },
    lineStyle: { curveness: 0.3, color: '#31a354' },
  },
  {
    source: 'server',
    target: 'client',
    label: { show: true, formatter: '8. 返回数据' },
    lineStyle: { curveness: -0.3, color: '#31a354' },
  },

  // Refresh Token Flow (Outbound)
  {
    source: 'client',
    target: 'server',
    label: { show: true, formatter: '9. AT过期, 携带RT刷新' },
    lineStyle: { curveness: 0.4, color: '#de4d4d' },
  },
  {
    source: 'server',
    target: 'db',
    label: { show: true, formatter: '10. 校验RefreshToken' },
    lineStyle: { curveness: 0.3, color: '#de4d4d' },
  },
  {
    source: 'server',
    target: 'server',
    label: { show: true, position: 'bottom', formatter: '12. 生成新双Token' },
  },
  {
    source: 'server',
    target: 'db',
    label: { show: true, formatter: '13. 更新RefreshToken' },
    lineStyle: { curveness: 0.4, color: '#de4d4d' },
  },

  // Refresh Token Flow (Inbound)
  {
    source: 'db',
    target: 'server',
    label: { show: true, formatter: '11. 返回校验结果' },
    lineStyle: { curveness: -0.2, color: '#de4d4d' },
  },
  {
    source: 'server',
    target: 'client',
    label: { show: true, formatter: '14. 返回新双Token' },
    lineStyle: { curveness: -0.4, color: '#de4d4d' },
  },
];

const categories = [{ name: '客户端' }, { name: '服务端' }, { name: '数据库' }];

onMounted(() => {
  const myChart = echarts.init(chart.value);
  myChart.setOption({
    title: {
      text: '用户认证与双Token刷新流程',
      left: 'center',
    },
    tooltip: {},
    legend: [{ data: categories.map((a) => a.name), top: 'bottom' }],
    series: [
      {
        type: 'graph',
        layout: 'none',
        data: nodes,
        links: links,
        categories: categories,
        roam: true,
        label: {
          show: true,
          position: 'inside',
          fontSize: 14,
        },
        edgeSymbol: ['circle', 'arrow'],
        edgeSymbolSize: [4, 10],
        edgeLabel: {
          show: true,
          fontSize: 10,
        },
        lineStyle: {
          opacity: 0.9,
          width: 2,
        },
      },
    ],
  });
});
</script>
