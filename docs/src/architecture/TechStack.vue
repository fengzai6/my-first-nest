<template>
  <div class="flex flex-wrap justify-center gap-3 py-4">
    <a
      v-for="tech in techs"
      :key="tech.name"
      :href="tech.href"
      target="_blank"
      rel="noopener noreferrer"
      class="transition-all transform rounded-md shadow-sm hover:-translate-y-1 hover:shadow-lg"
      :aria-label="`Link to ${tech.name}`"
    >
      <img :src="tech.badgeSrc" :alt="tech.alt" class="block" />
    </a>
  </div>
</template>

<script setup>
const techs = [
  {
    name: 'NestJS',
    href: 'https://nestjs.com/',
    badgeSrc:
      'https://img.shields.io/badge/NestJS-E0234E?style=for-the-badge&logo=nestjs&logoColor=white',
    alt: 'NestJS',
  },
  {
    name: 'TypeScript',
    href: 'https://www.typescriptlang.org/',
    badgeSrc:
      'https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white',
    alt: 'TypeScript',
  },
  {
    name: 'React',
    href: 'https://react.dev/',
    badgeSrc:
      'https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB',
    alt: 'React',
  },
  {
    name: 'Vite',
    href: 'https://vitejs.dev/',
    badgeSrc:
      'https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white',
    alt: 'Vite',
  },
  {
    name: 'TypeORM',
    href: 'https://typeorm.io/',
    badgeSrc:
      'https://img.shields.io/badge/TypeORM-E0234E?style=for-the-badge&logo=typeorm&logoColor=white',
    alt: 'TypeORM',
  },
  {
    name: 'PostgreSQL',
    href: 'https://www.postgresql.org/',
    badgeSrc:
      'https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white',
    alt: 'PostgreSQL',
  },
  {
    name: 'Tailwind CSS',
    href: 'https://tailwindcss.com/',
    badgeSrc:
      'https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white',
    alt: 'Tailwind CSS',
  },
  {
    name: 'shadcn/ui',
    href: 'https://ui.shadcn.com/',
    badgeSrc:
      'https://img.shields.io/badge/shadcn%2Fui-000000?style=for-the-badge&logo=shadcnui&logoColor=white',
    alt: 'shadcn/ui',
  },
  {
    name: 'Swagger',
    href: 'https://swagger.io/',
    badgeSrc:
      'https://img.shields.io/badge/Swagger-85EA2D?style=for-the-badge&logo=swagger&logoColor=black',
    alt: 'Swagger',
  },
];
</script>
