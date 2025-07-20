import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitepress';
import nav from './nav';
import sidebars from './siderbars';

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: 'My Fires Nest',
  description: '一个全栈 NestJs 项目',
  srcDir: 'src',
  base: '/docs/',

  themeConfig: {
    // https://vitepress.dev/reference/default-theme-config
    logo: './nestjs.svg',

    nav,
    sidebar: sidebars,

    search: {
      provider: 'local',
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/fengzai6/my-first-nest' },
    ],

    editLink: {
      pattern: 'https://github.com/fengzai6/my-first-nest/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },

    lastUpdated: {
      text: '更新时间',
      formatOptions: {
        dateStyle: 'long',
        timeStyle: 'short',
      },
    },

    footer: {
      message: '基于 MIT 许可发布',
      copyright: `Copyright © 2025 - Present by fengzai6`,
    },
  },

  head: [
    [
      'link',
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: './vitepress-logo.svg',
      },
    ],
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
