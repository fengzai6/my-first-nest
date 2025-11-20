import { DefaultTheme } from 'vitepress';

const nav: DefaultTheme.NavItem[] = [
  {
    text: '首页',
    link: '/',
  },
  { text: '指南', link: '/guide/intro', activeMatch: '/guide/' },
  {
    text: '项目架构',
    link: '/architecture/index',
    activeMatch: '/architecture/',
  },
  { text: '开发笔记', link: '/notes/intro', activeMatch: '/notes/' },
];

export default nav;
