import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

const config: Config = {
  title: '@nest-native/ai-sdk',
  tagline:
    'Decorator-first NestJS streaming primitive for the Vercel AI SDK that preserves the full Nest enhancer pipeline',
  favicon: 'img/logo.svg',

  future: {
    v4: true,
  },

  url: 'https://nest-native.github.io',
  baseUrl: '/ai-sdk/',

  organizationName: 'nest-native',
  projectName: 'ai-sdk',

  onBrokenLinks: 'throw',

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          editUrl: 'https://github.com/nest-native/ai-sdk/tree/main/website/',
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/social-card.png',
    colorMode: {
      respectPrefersColorScheme: true,
    },
    navbar: {
      title: '@nest-native/ai-sdk',
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          href: 'https://www.npmjs.com/package/@nest-native/ai-sdk',
          label: 'npm',
          position: 'right',
        },
        {
          href: 'https://github.com/nest-native/ai-sdk',
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Docs',
          items: [
            {label: 'Introduction', to: '/docs/introduction'},
            {label: 'Quick Start', to: '/docs/quick-start'},
            {label: 'API Reference', to: '/docs/api-reference'},
          ],
        },
        {
          title: 'More',
          items: [
            {
              label: 'GitHub',
              href: 'https://github.com/nest-native/ai-sdk',
            },
            {
              label: 'npm',
              href: 'https://www.npmjs.com/package/@nest-native/ai-sdk',
            },
          ],
        },
      ],
      copyright: `Copyright © ${new Date().getFullYear()} @nest-native/ai-sdk contributors. Built with Docusaurus.`,
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ['bash', 'json'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
