import type {SidebarsConfig} from '@docusaurus/plugin-content-docs';

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: 'category',
      label: 'Getting Started',
      items: [
        'introduction',
        'why-native',
        'quick-start',
        'enhancer-pipeline',
      ],
    },
    {
      type: 'category',
      label: 'Core API',
      items: [
        'ai-stream',
        'abort-signal',
        'error-mapping',
        'stream-formats',
        'api-reference',
      ],
    },
    'migration',
    {
      type: 'category',
      label: 'Production',
      items: [
        'production-patterns',
        'security',
        'adapters',
      ],
    },
    {
      type: 'category',
      label: 'Samples',
      items: [
        'samples/index',
        'samples/catalog',
      ],
    },
    {
      type: 'category',
      label: 'Project Reference',
      items: [
        'support-policy',
        'quality-and-ci',
        'release',
        'contributing',
        'roadmap',
      ],
    },
  ],
};

export default sidebars;
