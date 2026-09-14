import { defineConfig, type DefaultTheme } from 'vitepress'

/* ------------------------------------------------------------------ *
 * English (root locale)
 * ------------------------------------------------------------------ */
const enNav: DefaultTheme.NavItem[] = [
  { text: 'Guide', link: '/guide/getting-started', activeMatch: '/guide/' },
  { text: 'Core', link: '/core/context', activeMatch: '/core/' },
  { text: 'Streaming', link: '/streaming/', activeMatch: '/streaming/' },
  { text: 'AI / LLM', link: '/ai/', activeMatch: '/ai/' },
  { text: 'Auth & Security', link: '/security/', activeMatch: '/security/' },
  { text: 'Middleware', link: '/middleware/', activeMatch: '/middleware/' },
  {
    text: 'More',
    items: [
      { text: 'Router', link: '/router/' },
      { text: 'Monitoring', link: '/monitoring/' },
      { text: 'Plugins', link: '/plugins/' },
      { text: 'CLI', link: '/cli' },
    ],
  },
]

const enSidebar: DefaultTheme.Sidebar = {
  '/guide/': [
    {
      text: 'Introduction',
      items: [
        { text: 'Why Goryu', link: '/guide/why-goryu' },
        { text: 'Installation', link: '/guide/installation' },
        { text: 'Getting Started', link: '/guide/getting-started' },
        { text: 'Tutorial', link: '/guide/tutorial' },
      ],
    },
  ],
  '/core/': [
    {
      text: 'Core',
      items: [
        { text: 'Context', link: '/core/context' },
        { text: 'Binding & Validation', link: '/core/binding' },
        { text: 'JSON Schema', link: '/core/schema' },
        { text: 'Config', link: '/core/config' },
        { text: 'HTTP Client', link: '/core/client' },
        { text: 'Database', link: '/core/db' },
      ],
    },
  ],
  '/streaming/': [
    {
      text: 'Streaming & Realtime',
      items: [
        { text: 'Overview', link: '/streaming/' },
        { text: 'SSE & Streaming', link: '/streaming/sse' },
        { text: 'Typed Streaming', link: '/streaming/typed' },
        { text: 'WebSocket', link: '/streaming/websocket' },
      ],
    },
  ],
  '/ai/': [
    {
      text: 'AI / LLM Backends',
      items: [
        { text: 'Overview', link: '/ai/' },
        { text: 'Token & Cost Metering', link: '/ai/metering' },
        { text: 'Prompt Cache', link: '/ai/prompt-cache' },
        { text: 'Provider Proxy', link: '/ai/provider-proxy' },
        { text: 'Eval Recording', link: '/ai/recording' },
        { text: 'AI Scaffolds', link: '/ai/scaffolds' },
      ],
    },
    {
      text: 'LLM-friendly DX',
      items: [
        { text: 'llms.txt & API Reference', link: '/ai/llms-txt' },
        { text: 'MCP Server', link: '/ai/mcp' },
      ],
    },
  ],
  '/security/': [
    {
      text: 'Auth & Security',
      items: [
        { text: 'Overview', link: '/security/' },
        { text: 'JWT Auth', link: '/middleware/auth' },
        { text: 'Sessions', link: '/middleware/session' },
        { text: 'OAuth2 / OIDC', link: '/security/oidc' },
        { text: 'Passkeys / WebAuthn', link: '/security/passkeys' },
        { text: 'RBAC', link: '/security/rbac' },
        { text: 'Audit Log', link: '/security/audit-log' },
        { text: 'security.txt', link: '/security/security-txt' },
      ],
    },
  ],
  '/middleware/': [
    { text: 'Middleware', items: [{ text: 'Overview', link: '/middleware/' }] },
    {
      text: 'Security',
      collapsed: false,
      items: [
        { text: 'Auth (JWT)', link: '/middleware/auth' },
        { text: 'Basic Auth', link: '/middleware/basicauth' },
        { text: 'RBAC', link: '/security/rbac' },
        { text: 'Audit Log', link: '/security/audit-log' },
        { text: 'CORS', link: '/middleware/cors' },
        { text: 'CSRF', link: '/middleware/csrf' },
        { text: 'Secure Headers', link: '/middleware/secure' },
        { text: 'Secure Cookie', link: '/middleware/secure_cookie' },
        { text: 'Session', link: '/middleware/session' },
        { text: 'TLS Redirect', link: '/middleware/tls_redirect' },
        { text: 'Trust Proxy', link: '/middleware/trustproxy' },
      ],
    },
    {
      text: 'AI / LLM',
      collapsed: false,
      items: [
        { text: 'AI Meter', link: '/middleware/aimeter' },
        { text: 'Prompt Cache', link: '/middleware/promptcache' },
        { text: 'Recorder', link: '/middleware/recorder' },
      ],
    },
    {
      text: 'Traffic & Reliability',
      collapsed: true,
      items: [
        { text: 'Cache', link: '/middleware/cache' },
        { text: 'Circuit Breaker', link: '/middleware/circuitbreaker' },
        { text: 'Compress', link: '/middleware/compress' },
        { text: 'Limiter', link: '/middleware/limiter' },
        { text: 'Timeout', link: '/middleware/timeout' },
        { text: 'Graceful', link: '/middleware/graceful' },
      ],
    },
    {
      text: 'Observability',
      collapsed: true,
      items: [
        { text: 'Logger', link: '/middleware/logger' },
        { text: 'Struct Log', link: '/middleware/structlog' },
        { text: 'Metrics', link: '/middleware/metrics' },
        { text: 'Tracing', link: '/middleware/tracing' },
        { text: 'Request ID', link: '/middleware/requestid' },
        { text: 'Health Check', link: '/middleware/healthcheck' },
        { text: 'Expvar', link: '/middleware/expvar' },
        { text: 'Recovery', link: '/middleware/recovery' },
        { text: 'Errors', link: '/middleware/errors' },
      ],
    },
    {
      text: 'Utilities',
      collapsed: true,
      items: [
        { text: 'Builder', link: '/middleware/builder' },
        { text: 'Base', link: '/middleware/base' },
        { text: 'Env Var', link: '/middleware/envvar' },
        { text: 'Favicon', link: '/middleware/favicon' },
        { text: 'File Server', link: '/middleware/fileserver' },
      ],
    },
  ],
  '/router/': [
    {
      text: 'Router',
      items: [
        { text: 'Overview', link: '/router/' },
        { text: 'Builder', link: '/router/builder' },
        { text: 'Route', link: '/router/route' },
      ],
    },
  ],
  '/monitoring/': [
    {
      text: 'Monitoring',
      items: [
        { text: 'Overview', link: '/monitoring/' },
        { text: 'UI', link: '/monitoring/ui' },
      ],
    },
  ],
  '/plugins/': [{ text: 'Plugins', items: [{ text: 'Overview', link: '/plugins/' }] }],
  '/cli': [{ text: 'CLI', items: [{ text: 'Overview', link: '/cli' }] }],
}

/* ------------------------------------------------------------------ *
 * Japanese (ja) — derived from the English tree
 * ------------------------------------------------------------------ */
const ja: Record<string, string> = {
  Guide: 'ガイド',
  Core: 'コア',
  Streaming: 'ストリーミング',
  'AI / LLM': 'AI / LLM',
  'Auth & Security': '認証とセキュリティ',
  Middleware: 'ミドルウェア',
  More: 'その他',
  Router: 'ルーター',
  Monitoring: 'モニタリング',
  Plugins: 'プラグイン',
  CLI: 'CLI',
  Introduction: 'はじめに',
  'Why Goryu': 'なぜ Goryu か',
  Installation: 'インストール',
  'Getting Started': 'はじめかた',
  Tutorial: 'チュートリアル',
  Context: 'コンテキスト',
  'Binding & Validation': 'バインディングと検証',
  'JSON Schema': 'JSON スキーマ',
  Config: '設定',
  'HTTP Client': 'HTTP クライアント',
  Database: 'データベース',
  'Streaming & Realtime': 'ストリーミングとリアルタイム',
  Overview: '概要',
  'SSE & Streaming': 'SSE とストリーミング',
  'Typed Streaming': '型付きストリーミング',
  WebSocket: 'WebSocket',
  'AI / LLM Backends': 'AI / LLM バックエンド',
  'Token & Cost Metering': 'トークン・コスト計測',
  'Prompt Cache': 'プロンプトキャッシュ',
  'Provider Proxy': 'プロバイダープロキシ',
  'Eval Recording': '評価用レコーディング',
  'AI Scaffolds': 'AI スキャフォールド',
  'LLM-friendly DX': 'LLM フレンドリーな DX',
  'llms.txt & API Reference': 'llms.txt と API リファレンス',
  'MCP Server': 'MCP サーバー',
  'JWT Auth': 'JWT 認証',
  Sessions: 'セッション',
  'OAuth2 / OIDC': 'OAuth2 / OIDC',
  'Passkeys / WebAuthn': 'パスキー / WebAuthn',
  RBAC: 'RBAC',
  'Audit Log': '監査ログ',
  Security: 'セキュリティ',
  'AI Meter': 'AI メーター',
  Recorder: 'レコーダー',
  'Traffic & Reliability': 'トラフィックと信頼性',
  Observability: 'オブザーバビリティ',
  Utilities: 'ユーティリティ',
  'Health Check': 'ヘルスチェック',
}

const t = (s: string) => ja[s] ?? s

function localize<T extends DefaultTheme.NavItem | DefaultTheme.SidebarItem>(items: T[]): T[] {
  return items.map((item) => {
    const next: any = { ...item }
    if (next.text) next.text = t(next.text)
    if (typeof next.link === 'string' && next.link.startsWith('/')) next.link = '/ja' + next.link
    if (Array.isArray(next.items)) next.items = localize(next.items)
    if (typeof next.activeMatch === 'string') next.activeMatch = '/ja' + next.activeMatch
    return next
  })
}

const jaSidebar: DefaultTheme.Sidebar = Object.fromEntries(
  Object.entries(enSidebar).map(([key, group]) => ['/ja' + key, localize(group as any[])])
)

export default defineConfig({
  title: "Goryu",
  description: "The batteries-included Go framework for REST and AI backends — productive for humans, easy for LLMs.",
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://i.ibb.co/YBfgFnG0/goryu-v3.png' }],
    ['meta', { name: 'theme-color', content: '#00add8' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:title', content: 'Goryu — Go framework for REST & AI backends' }],
    ['meta', { property: 'og:description', content: 'Batteries-included Go framework: streaming, AI primitives, secure by default. As fast as Gin, with 10x more built in.' }],
    ['meta', { property: 'og:image', content: 'https://i.ibb.co/YBfgFnG0/goryu-v3.png' }],
  ],

  themeConfig: {
    logo: 'https://i.ibb.co/YBfgFnG0/goryu-v3.png',
    socialLinks: [{ icon: 'github', link: 'https://github.com/arthurlch/goryu' }],
    search: { provider: 'local' },
  },

  locales: {
    root: {
      label: 'English',
      lang: 'en',
      themeConfig: {
        nav: enNav,
        sidebar: enSidebar,
        editLink: {
          pattern: 'https://github.com/arthurlch/goryu-docsite/edit/main/docs/:path',
          text: 'Edit this page on GitHub',
        },
        footer: {
          message: 'Released under the MIT License.',
          copyright: 'Copyright © 2025-present Arthur Lachat',
        },
      },
    },
    ja: {
      label: '日本語',
      lang: 'ja-JP',
      link: '/ja/',
      themeConfig: {
        nav: localize(enNav),
        sidebar: jaSidebar,
        outline: { label: '目次', level: [2, 3] },
        docFooter: { prev: '前のページ', next: '次のページ' },
        darkModeSwitchLabel: '外観',
        lightModeSwitchTitle: 'ライトモードに切り替え',
        darkModeSwitchTitle: 'ダークモードに切り替え',
        sidebarMenuLabel: 'メニュー',
        returnToTopLabel: 'トップに戻る',
        langMenuLabel: '言語を変更',
        editLink: {
          pattern: 'https://github.com/arthurlch/goryu-docsite/edit/main/docs/:path',
          text: 'GitHub でこのページを編集',
        },
        footer: {
          message: 'MIT ライセンスの下で公開されています。',
          copyright: 'Copyright © 2025-present Arthur Lachat',
        },
      },
    },
  },
})
