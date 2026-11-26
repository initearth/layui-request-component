import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts',
  output: {
    file: 'dist/request.js',
    format: 'iife',
    sourcemap: true,
    strict: true,
    banner: '/* @initearth/layui-request-component v1.0.0 */'
  },
  plugins: [
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        noEmit: false,
        declaration: false,
        declarationMap: false,
        sourceMap: true
      }
    })
  ]
};
