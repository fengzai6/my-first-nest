import { DefaultTheme } from 'vitepress';

const guide: DefaultTheme.SidebarMulti = {
  '/guide/': [
    {
      text: '介绍',
      link: '/guide/intro',
    },
    {
      text: '指南',
      items: [
        { text: '快速开始', link: '/guide/getting-started' },
        { text: '项目结构', link: '/guide/project-structure' },
        { text: '项目路线图', link: '/guide/roadmap' },
      ],
    },
  ],
};

export default guide;
