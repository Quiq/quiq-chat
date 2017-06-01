import flow from 'rollup-plugin-flow';
import babel from 'rollup-plugin-babel';

export default {
  entry: 'src/index.js',
  plugins: [flow({pretty: true}), babel({exclude: 'node_modules/**'})],
  external: ['isomorphic-fetch'],
  format: 'cjs',
  dest: 'build/quiq-chat.js',
};
