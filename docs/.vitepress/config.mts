import { defineConfig } from 'vitepress'

export default defineConfig({
  title: "Goryu",
  description: "Production-ready Go web framework",
  lastUpdated: true,
  cleanUrls: true,

  head: [
    ['link', { rel: 'icon', href: 'https://i.ibb.co/YBfgFnG0/goryu-v3.png' }],
    ['meta', { name: 'theme-color', content: '#3eaf7c' }],
  ],

  themeConfig: {
    logo: 'https://i.ibb.co/YBfgFnG0/goryu-v3.png',
    
    nav: [
      { text: 'Getting started', link: '/guide/getting-started' },
      { text: 'Core', link: '/core/context' },
      { text: 'Middleware', link: '/middleware/' },
      { text: 'Router', link: '/router/' },
      { text: 'Monitoring', link: '/monitoring/' },
      { text: 'Plugins', link: '/plugins/' },
      { text: 'CLI', link: '/cli' },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Introduction',
          items: [
            { text: 'Installation', link: '/guide/installation' },
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Tutorial', link: '/guide/tutorial' },
          ]
        }
      ],
      '/core/': [
        {
          text: 'Core Components',
          items: [
            { text: 'Context', link: '/core/context' },
            { text: 'Client', link: '/core/client' },
            { text: 'Config', link: '/core/config' },
            { text: 'Database', link: '/core/db' },
          ]
        }
      ],
      '/monitoring/': [
        {
          text: 'Monitoring',
          items: [
            { text: 'Overview', link: '/monitoring/' },
            { text: 'UI', link: '/monitoring/ui' },
          ]
        }
      ],
      '/plugins/': [
        {
          text: 'Plugins',
          items: [
            { text: 'Overview', link: '/plugins/' },
          ]
        }
      ],
      '/middleware/': [
        {
          text: 'Middleware',
          items: [
            { text: 'Overview', link: '/middleware/' },
            { text: 'Auth', link: '/middleware/auth' },
            { text: 'Base', link: '/middleware/base' },
            { text: 'Basicauth', link: '/middleware/basicauth' },
            { text: 'Builder', link: '/middleware/builder' },
            { text: 'Cache', link: '/middleware/cache' },
            { text: 'Circuitbreaker', link: '/middleware/circuitbreaker' },
            { text: 'Compress', link: '/middleware/compress' },
            { text: 'Cors', link: '/middleware/cors' },
            { text: 'Csrf', link: '/middleware/csrf' },
            { text: 'Envvar', link: '/middleware/envvar' },
            { text: 'Errors', link: '/middleware/errors' },
            { text: 'Expvar', link: '/middleware/expvar' },
            { text: 'Favicon', link: '/middleware/favicon' },
            { text: 'Fileserver', link: '/middleware/fileserver' },
            { text: 'Graceful', link: '/middleware/graceful' },
            { text: 'Healthcheck', link: '/middleware/healthcheck' },
            { text: 'Limiter', link: '/middleware/limiter' },
            { text: 'Logger', link: '/middleware/logger' },
            { text: 'Metrics', link: '/middleware/metrics' },
            { text: 'Recovery', link: '/middleware/recovery' },
            { text: 'Requestid', link: '/middleware/requestid' },
            { text: 'Secure', link: '/middleware/secure' },
            { text: 'Secure Cookie', link: '/middleware/secure_cookie' },
            { text: 'Session', link: '/middleware/session' },
            { text: 'Structlog', link: '/middleware/structlog' },
            { text: 'Timeout', link: '/middleware/timeout' },
            { text: 'Tls Redirect', link: '/middleware/tls_redirect' },
            { text: 'Tracing', link: '/middleware/tracing' },
            { text: 'Trustproxy', link: '/middleware/trustproxy' }
          ]
        }
      ],
      '/router/': [
         {
            text: 'Router',
             items: [
                 { text: 'Overview', link: '/router/' },
                 { text: 'Builder', link: '/router/builder' },
                 { text: 'Route', link: '/router/route' },
             ]
         }
      ],
       '/cli': [
         {
             text: 'CLI',
             items: [
                 { text: 'Overview', link: '/cli' }
             ]
         }
        ],
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/arthurlch/goryu' }
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024 Arthur Luch'
    },
    
    search: {
      provider: 'local'
    }
  }
})
