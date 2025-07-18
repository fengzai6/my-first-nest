import { DefaultTheme } from 'vitepress';

const nav: DefaultTheme.NavItem[] = [
  {
    text: '首页',
    link: '/',
  },
  { text: '指南', link: '/guide/index', activeMatch: '/guide/' },
  { text: '开发笔记', link: '/notes/index', activeMatch: '/notes/' },
];

export default nav;
