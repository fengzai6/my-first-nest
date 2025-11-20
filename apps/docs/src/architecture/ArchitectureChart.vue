<template>
  <div ref="chart" style="width: 100%; height: 600px"></div>
</template>

<script setup>
import { TreeChart } from 'echarts/charts';
import { TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { onMounted, ref } from 'vue';

echarts.use([TreeChart, TooltipComponent, CanvasRenderer]);

const chart = ref(null);

const data = {
  name: 'my-first-nest',
  children: [
    {
      name: 'src',
      children: [
        {
          name: 'common',
          children: [
            { name: 'constants' },
            { name: 'decorators' },
            { name: 'exceptions' },
            { name: 'filters' },
            { name: 'guards' },
            { name: 'interceptors' },
          ],
        },
        { name: 'config' },
        {
          name: 'modules',
          children: [
            { name: 'auth' },
            { name: 'users' },
            { name: 'roles' },
            { name: 'permissions' },
            { name: 'groups' },
            { name: 'cats' },
          ],
        },
        {
          name: 'shared',
          children: [
            { name: 'database' },
            { name: 'entity' },
            { name: 'utils' },
          ],
        },
      ],
    },
    {
      name: 'client',
      children: [
        {
          name: 'src',
          children: [
            { name: 'components' },
            { name: 'pages' },
            { name: 'router' },
            { name: 'services' },
            { name: 'stores' },
          ],
        },
      ],
    },
    {
      name: 'database',
      children: [{ name: 'migrations' }, { name: 'seeds' }],
    },
    {
      name: 'docs',
    },
  ],
};

onMounted(() => {
  const myChart = echarts.init(chart.value);
  myChart.setOption({
    tooltip: {
      trigger: 'item',
      triggerOn: 'mousemove',
    },
    series: [
      {
        type: 'tree',
        data: [data],
        top: '1%',
        left: '15%',
        bottom: '1%',
        right: '20%',
        symbolSize: 10,
        label: {
          position: 'left',
          verticalAlign: 'middle',
          align: 'right',
          fontSize: 14,
        },
        leaves: {
          label: {
            position: 'right',
            verticalAlign: 'middle',
            align: 'left',
          },
        },
        emphasis: {
          focus: 'descendant',
        },
        expandAndCollapse: true,
        animationDuration: 550,
        animationDurationUpdate: 750,
      },
    ],
  });
});
</script>
