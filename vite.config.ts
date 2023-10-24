import { join } from 'node:path';

import react from '@vitejs/plugin-react-swc';
import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vite';
import lingui from '@lingui/vite-plugin';
import svgr from 'vite-plugin-svgr';
import { manualChunksPlugin } from 'vite-plugin-webpackchunkname';

const GOOGLE_ANALYTICS_SCRIPT = `
<script async src="https://www.googletagmanager.com/gtag/js?id=G-MW95W6NHVC"></script>
<script>
var ramp = {
  passiveMode: true,
  que: [],
  onReady: function () {
    window.refreshAds();
  },
};
</script>
<script
  async
  src="//cdn.intergient.com/1024476/73270/ramp.js"
  onerror="window.adScriptFailed=true;"
></script>
<script>
window._pwGA4PageviewId = ''.concat(Date.now());
window.dataLayer = window.dataLayer || [];
window.gtag =
  window.gtag ||
  function () {
    dataLayer.push(arguments);
  };
gtag('js', new Date());
gtag('config', 'G-MW95W6NHVC', { send_page_view: false });
gtag('config', 'G-E0TKKBEXVD', { send_page_view: false });
gtag('event', 'ramp_js', { send_to: 'G-E0TKKBEXVD', pageview_id: window._pwGA4PageviewId });
</script>
</head>
`.trim();

// https://vitejs.dev/config/
export default defineConfig((env) => ({
  plugins: [
    react({
      plugins: [
        ['@lingui/swc-plugin', {}],
        ['@swc/plugin-emotion', {}],
      ],
    }),
    tsconfigPaths(),
    {
      name: 'vite-plugin-wowanalyzer-index-html-inject-ga',
      transformIndexHtml: (html) =>
        process.env.VITE_ENABLE_GA === 'true'
          ? html.replace('</head>', GOOGLE_ANALYTICS_SCRIPT)
          : html,
    },
    lingui(),
    svgr(),
    manualChunksPlugin(),
  ],
  resolve: {
    alias: {
      analysis: join(__dirname, 'src', 'analysis'),
      common: join(__dirname, 'src', 'common'),
      game: join(__dirname, 'src', 'game'),
      interface: join(__dirname, 'src', 'interface'),
      localization: join(__dirname, 'src', 'localization'),
      parser: join(__dirname, 'src', 'parser'),
    },
  },
  server: {
    port: 3000,
  },
  test: {
    environment: 'jsdom',
    restoreMocks: true,
    unstubEnvs: true,
    unstubGlobals: true,
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/e2e/**',
      '**/.{idea,git,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build}.config.*',
    ],
    setupFiles: ['./src/vitest.setup.ts'],
    deps: {
      optimizer: {
        web: {
          include: ['vitest-canvas-mock'],
        },
      },
    },
    // For this config, check https://github.com/vitest-dev/vitest/issues/740
    threads: false,
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    resolveSnapshotPath: (testPath: string, snapExtension: string) => testPath + snapExtension,
  },
}));
