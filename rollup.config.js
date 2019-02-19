import json from 'rollup-plugin-json';
import includePaths from 'rollup-plugin-includepaths';
import typescript from 'rollup-plugin-typescript';
import sourceMaps from 'rollup-plugin-sourcemaps';
import commonjs from 'rollup-plugin-commonjs';
import nodeResolve from 'rollup-plugin-node-resolve';

const {dependencies} = require('./package.json');

export default {
  input: 'src/quiq-chat.ts',
  plugins: [
    json(),
    typescript(),
    commonjs(),
    nodeResolve(),
    includePaths({paths:['src']}),
    sourceMaps(),
  ],
  external: Object.keys(dependencies),
  output: {
    name: "QuiqChatClient",
    file: 'dist/quiq-chat.js',
    format: 'umd',
    sourcemap: true,
  },
  watch: {
    include: 'src/**',
  },
};
