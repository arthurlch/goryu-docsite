# RBAC

The `rbac` middleware provides per-route role-based access control. Populate the
caller's roles once after authentication, then guard routes with `Require` or
`RequireAll`.

## Features

- **Per-route guards** — attach role checks to individual routes or groups.
- **Any-of and all-of** — `Require` allows any listed role; `RequireAll` demands every one.
- **Pluggable role source** — read roles from the context (default), a JWT, or anywhere via `RolesFunc`.
- **Custom denial** — override the `403` response with `Forbidden`.
- **Deny by default** — a caller with no roles is always denied.

## Usage

### Load roles, then guard routes

Set the caller's roles once after authentication, then guard route groups:

```go
import (
    "github.com/arthurlch/goryu"
    "github.com/arthurlch/goryu/middleware/rbac"
)

func main() {
    app := goryu.New()

    // After auth, load the caller's roles into the context.
    app.Use(func(next goryu.HandlerFunc) goryu.HandlerFunc {
        return func(c *goryu.Ctx) {
            rbac.SetRoles(c, loadRolesFor(c)...)
            next(c)
        }
    })

    // Any of the listed roles.
    app.Group("/admin", rbac.Require("admin"))

    // All of the listed roles.
    app.Group("/billing", rbac.RequireAll("admin", "billing"))

    log.Fatal(app.Listen(":8080"))
}
```

### Reading roles downstream

Handlers can read the stored roles with `GetRoles`:

```go
app.GET("/me", func(c *goryu.Ctx) {
    roles := rbac.GetRoles(c) // []string
    _ = c.JSON(200, map[string]any{"roles": roles})
})
```

### Custom role source and denial response

For finer control, build an `Enforcer` with `New`. This lets you source roles from
somewhere other than the context (for example, decode them from a JWT) and
customize the denial response:

```go
guard := rbac.New(rbac.Config{
    RolesFunc: func(c *goryu.Ctx) []string { return rolesFromJWT(c) },
    Forbidden: func(c *goryu.Ctx) {
        _ = c.Status(403).JSON(403, map[string]string{"error": "insufficient role"})
    },
})

app.Group("/admin", guard.Require("admin"))
app.Group("/reports", guard.RequireAll("admin", "auditor"))
```

## API

| Function | Description |
|----------|-------------|
| `SetRoles(c, roles...)` | Store the caller's roles for downstream checks |
| `GetRoles(c) []string` | Read the stored roles |
| `Require(roles...)` | Allow if the caller has **any** of the roles |
| `RequireAll(roles...)` | Allow only if the caller has **every** role |
| `New(Config) *Enforcer` | Build an enforcer with a custom `RolesFunc` / `Forbidden` |

### Configuration

| Option | Type | Description | Default |
|--------|------|-------------|---------|
| RolesFunc | `func(c *goryu.Ctx) []string` | Where roles come from | `GetRoles` (context key) |
| Forbidden | `func(c *goryu.Ctx)` | Response when the check fails | `403` JSON `{"error":"forbidden"}` |

::: tip
`Require` and `RequireAll` at package level use a default enforcer that reads roles
from the context via `SetRoles`. Reach for `rbac.New` only when you need a custom
role source or denial response.
:::

::: warning Deny by default
A caller with no roles is always denied. Make sure your authentication middleware
runs `SetRoles` (or that your `RolesFunc` returns the roles) **before** the guard,
or every request will be rejected with `403`.
:::

## Next steps

- Establish identity first with [JWT Auth](/ja/middleware/auth), [Sessions](/ja/middleware/session), or [OAuth2 / OIDC](/ja/security/oidc).
- Record authorization outcomes with the [Audit Log](/ja/security/audit-log).
