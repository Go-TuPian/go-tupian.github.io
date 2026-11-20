/* ===================================================================
 * TACZ 数据面板 · 静态版配置
 *
 * 这是整个站点唯一需要改的文件。改完直接刷新页面，不需要构建。
 * =================================================================== */
window.TACZ_CONFIG = {
  /* Go 后端地址，不要以斜杠结尾。
     GitHub Pages 是 HTTPS，这里必须也是 HTTPS，否则浏览器会按混合内容拦截。 */
  apiBase: 'https://pvp.676168.xyz',

  /* 后端 config.json 里 apiToken 非空时，这里要填一样的值 */
  apiToken: 'pvp-webui-token',

  /* 站点文案 */
  siteName: 'TACZ PVP',
  serverName: 'TACZ PVP 战场',

  /* 皮肤代理，留空即自动用 `${apiBase}/api/skin`（后端会代拉 Mojang 并缓存到磁盘）。
     仍部署着 PHP 版时，也可以填它的 skin.php 地址。
     例：'https://panel.example.com/skin.php' */
  skinProxy: '',

  /* 允许联网取皮肤时使用的第三方源，按顺序尝试，留空数组表示只用本地 skins/ */
  skinSources: [
    'https://mc-heads.net/skin/{name}',
    'https://minotar.net/skin/{name}',
  ],

  /* 击杀流水刷新间隔（秒）与默认条数 */
  refreshSeconds: 20,
  killsLimit: 120,

  /* 时区，留空则用浏览器本地时区；填 'Asia/Shanghai' 可强制北京时间 */
  timezone: 'Asia/Shanghai',

  /* 强制演示数据（调试用） */
  forceMock: false,
};
