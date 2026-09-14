# Middleware

Goryu ships with a rich set of built-in middleware for security, AI/LLM workloads, traffic control, observability, and everyday utilities. Every middleware follows the same shape, so applying one is always the same two-line change.

## Applying middleware

Attach middleware globally with `app.Use`, or scope it to a route group.

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/limiter"
    "github.com/arthurlch/goryu/middleware/logger"
)

app := goryu.New()

// Global: runs for every request
app.Use(logger.Default())
app.Use(limiter.Default())

// Group-scoped: runs only for routes in the group
api := app.Group("/api/v1")
api.Use(limiter.New(limiter.Config{Max: 100}))
```

## The standard middleware shape

Each middleware package exposes two constructors:

- `New(config ...Config)` — build with an explicit configuration.
- `Default()` — build with sensible defaults (equivalent to `New()`).

```go
// Zero-config, sensible defaults
app.Use(limiter.Default())

// Explicit configuration
app.Use(limiter.New(limiter.Config{
    Max:        100,
    Expiration: time.Minute,
}))
```

Every `Config` embeds `base.BaseConfig`, which provides cross-cutting hooks shared by all middleware:

```go
type BaseConfig struct {
    Skip         func(c *goryuctx.Context) bool                       // skip this middleware for matching requests
    Logger       Logger                                               // custom logger
    ErrorHandler func(c *goryuctx.Context, err error, name string)    // custom error handling
}
```

Configs that implement the `ConfigurableMiddleware` interface expose:

- `Configure(base *base.BaseConfig)` — merge in shared base configuration.
- `Validate() error` — validate the configuration before the middleware runs.

Unset fields fall back to defaults (`base.DefaultLogger` and `base.DefaultErrorHandler`), so you only set what you need.

## Catalog

### Security

| Middleware | Description | Docs |
|------------|-------------|------|
| auth | Token/session-based authentication guard | [/middleware/auth](/middleware/auth) |
| basicauth | HTTP Basic authentication | [/middleware/basicauth](/middleware/basicauth) |
| cors | Cross-Origin Resource Sharing headers | [/middleware/cors](/middleware/cors) |
| csrf | Cross-Site Request Forgery protection | [/middleware/csrf](/middleware/csrf) |
| secure | Security response headers (HSTS, X-Frame-Options, etc.) | [/middleware/secure](/middleware/secure) |
| secure_cookie | Signed/encrypted cookie handling | [/middleware/secure_cookie](/middleware/secure_cookie) |
| tls_redirect | Redirect HTTP requests to HTTPS | [/middleware/tls_redirect](/middleware/tls_redirect) |
| trustproxy | Trust and parse proxy headers for real client IPs | [/middleware/trustproxy](/middleware/trustproxy) |
| session | Server-side session management | [/middleware/session](/middleware/session) |
| RBAC | Per-route role-based access control | [/security/rbac](/security/rbac) |
| Audit log | Access-audit trail: who did what, when, and the outcome | [/security/audit-log](/security/audit-log) |

### AI/LLM

| Middleware | Description | Docs |
|------------|-------------|------|
| aimeter | Token and cost accounting for LLM endpoints | [/middleware/aimeter](/middleware/aimeter) |
| promptcache | Response cache keyed on the request body (prompt) rather than the URL | [/middleware/promptcache](/middleware/promptcache) |
| recorder | Record request/response pairs for replay, evals, and debugging | [/middleware/recorder](/middleware/recorder) |

### Traffic & Reliability

| Middleware | Description | Docs |
|------------|-------------|------|
| limiter | Fixed-window rate limiting | [/middleware/limiter](/middleware/limiter) |
| circuitbreaker | Trip and recover around failing downstreams | [/middleware/circuitbreaker](/middleware/circuitbreaker) |
| timeout | Enforce per-request deadlines | [/middleware/timeout](/middleware/timeout) |
| recovery | Recover from panics and return a safe error response | [/middleware/recovery](/middleware/recovery) |
| graceful | Graceful shutdown / connection draining | [/middleware/graceful](/middleware/graceful) |
| compress | Response compression (gzip/deflate) | [/middleware/compress](/middleware/compress) |
| cache | HTTP response caching | [/middleware/cache](/middleware/cache) |

### Observability

| Middleware | Description | Docs |
|------------|-------------|------|
| logger | Request logging | [/middleware/logger](/middleware/logger) |
| structlog | Structured (JSON) request logging | [/middleware/structlog](/middleware/structlog) |
| metrics | Application/request metrics collection | [/middleware/metrics](/middleware/metrics) |
| expvar | Expose runtime metrics via `expvar` | [/middleware/expvar](/middleware/expvar) |
| tracing | Distributed tracing spans | [/middleware/tracing](/middleware/tracing) |
| requestid | Attach a unique ID to each request | [/middleware/requestid](/middleware/requestid) |
| healthcheck | Liveness/readiness endpoints | [/middleware/healthcheck](/middleware/healthcheck) |
| errors | Centralized error handling and formatting | [/middleware/errors](/middleware/errors) |

### Utilities

| Middleware | Description | Docs |
|------------|-------------|------|
| base | Shared base config and helpers for all middleware | [/middleware/base](/middleware/base) |
| builder | Fluent builder for composing middleware | [/middleware/builder](/middleware/builder) |
| envvar | Environment-variable driven configuration | [/middleware/envvar](/middleware/envvar) |
| favicon | Serve a favicon and short-circuit `/favicon.ico` | [/middleware/favicon](/middleware/favicon) |
| fileserver | Serve static files from a directory | [/middleware/fileserver](/middleware/fileserver) |
