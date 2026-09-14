# Audit Log

The `auditlog` middleware records an access-audit trail — who did what, when, and
with what outcome. Each request becomes an `Event` written to a `Sink` (a JSON
logger by default).

## Features

- **Structured events** — time, method, path, status, latency, user ID, and IP per request.
- **Pluggable sink** — write to the default JSON logger, a database, a file, or a SIEM.
- **Identity aware** — reads the `user_id` context key set by auth / session middleware, or a custom extractor.
- **Skippable** — exclude health checks or noisy paths with `Skip`.
- **Zero-config default** — `auditlog.Default()` logs JSON events out of the box.

## Usage

### Default JSON trail

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/auditlog"
)

func main() {
    app := goryu.New()

    app.Use(auditlog.Default()) // JSON events to the default logger

    log.Fatal(app.Listen(":8080"))
}
```

Each event carries `time`, `method`, `path`, `status`, `latency_ms`, `user_id`, and
`ip`. The `user_id` comes from the `user_id` context key set by the auth or session
middleware, so audited requests are automatically attributed once a user is
authenticated.

### Custom sink and identity extractor

Send events to your own destination and override how the caller's identity is
resolved:

```go
app.Use(auditlog.New(auditlog.Config{
    Sink:       mySink,
    UserIDFunc: func(c *goryu.Ctx) string { return currentUser(c) },
}))
```

### Implementing a Sink

A `Sink` receives each event. Implementations must be safe for concurrent use:

```go
type Sink interface {
    Write(auditlog.Event) error
}

type dbSink struct{ db *sql.DB }

func (s dbSink) Write(e auditlog.Event) error {
    _, err := s.db.Exec(
        `INSERT INTO audit_log (time, method, path, status, latency_ms, user_id, ip)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        e.Time, e.Method, e.Path, e.Status, e.LatencyMS, e.UserID, e.IP,
    )
    return err
}

app.Use(auditlog.New(auditlog.Config{Sink: dbSink{db: db}}))
```

If a sink write fails, the error is logged (the request is not affected).

### Skipping requests

Exclude noisy or irrelevant paths from the trail:

```go
app.Use(auditlog.New(auditlog.Config{
    Skip: func(c *goryu.Ctx) bool {
        return c.Request.URL.Path == "/healthz"
    },
}))
```

## The Event

```go
type Event struct {
    Time      time.Time // when the request started
    Method    string    // HTTP method
    Path      string    // request path
    Status    int       // response status code
    LatencyMS int64     // handler latency in milliseconds
    UserID    string    // caller identity (omitted if empty)
    IP        string    // client IP
}
```

## Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| Sink | `Sink` | Where events go | JSON to the logger |
| UserIDFunc | `func(c *goryu.Ctx) string` | Extract the caller identity | `user_id` context key |
| Skip | `func(c *goryu.Ctx) bool` | Skip auditing a request | none |

::: tip Place it early
Register the audit middleware early in the chain so it captures the final status
code and latency of the whole request, including work done by inner middleware.
Because it reads the `user_id` context key, it composes cleanly with
[JWT Auth](/middleware/auth), [Sessions](/middleware/session), and
[OAuth2 / OIDC](/security/oidc), which all set that key.
:::

::: warning Concurrency
`Sink` implementations must be safe for concurrent use — requests are audited
concurrently.
:::

## Next steps

- Attribute events by wiring identity with [JWT Auth](/middleware/auth) or [Sessions](/middleware/session).
- Record authorization decisions alongside access with [RBAC](/security/rbac).
