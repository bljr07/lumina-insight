import { nodeResolve } from '@rollup/plugin-node-resolve';
import alias from '@rollup/plugin-alias';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const aliasPlugin = alias({
  entries: [
    { find: '@shared', replacement: path.resolve(__dirname, 'src/shared') },
    { find: '@content', replacement: path.resolve(__dirname, 'src/content') },
    { find: '@background', replacement: path.resolve(__dirname, 'src/background') },
    { find: '@offscreen', replacement: path.resolve(__dirname, 'src/offscreen') },
    { find: '@popup', replacement: path.resolve(__dirname, 'src/popup') },
    { find: '@sidepanel', replacement: path.resolve(__dirname, 'src/sidepanel') },
  ],
});

const plugins = [aliasPlugin, nodeResolve()];

export default [
  // Content Script bundle
  {
    input: 'src/content/main.js',
    output: {
      file: 'content/content.js',
      format: 'iife', // Content scripts need IIFE (no module support)
      name: 'LuminaContent',
    },
    plugins,
  },
  // Service Worker bundle
  {
    input: 'src/background/main.js',
    output: {
      file: 'background/service-worker.js',
      format: 'iife',
      name: 'LuminaBackground',
    },
    plugins,
  },
  // Popup bundle
  {
    input: 'src/popup/main.js',
    output: {
      file: 'popup/popup.js',
      format: 'iife',
      name: 'LuminaPopup',
    },
    plugins,
  },
  // Side Panel bundle
  {
    input: 'src/sidepanel/main.js',
    output: {
      file: 'sidepanel/sidepanel.js',
      format: 'iife',
      name: 'LuminaSidePanel',
    },
    plugins,
  },
];
