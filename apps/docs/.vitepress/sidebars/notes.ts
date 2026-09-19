import { DefaultTheme } from 'vitepress';

const notes: DefaultTheme.SidebarMulti = {
  '/notes/': [
    {
      text: '介绍',
      link: '/notes/intro',
    },
    {
      text: '开发笔记',
      items: [
        { text: '用户认证', link: '/notes/user-auth' },
        { text: '用户权限', link: '/notes/user-permission' },
        { text: 'Redis 缓存', link: '/notes/redis-cache' },
        { text: '日志系统', link: '/notes/logging' },
        { text: '附件上传', link: '/notes/attachments' },
      ],
    },
  ],
};

export default notes;
