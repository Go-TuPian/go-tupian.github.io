/** Tailwind 构建配置：只用于产出 assets/app.css，运行时不参与。 */
module.exports = {
  content: ['./index.html', './kills.html', './assets/*.js'],
  theme: {
    extend: {
      colors: {
        ink: '#0a0e14',
        panel: '#0e1117',
        ember: '#fbbf24',
        rust: '#c8492a',
      },
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};
