# Binding & Validation

Goryu turns an incoming request into a typed Go value with a single call. `goryu.Bind[T]` reads the request body (or query string), decodes it into your struct based on the `Content-Type`, and then runs your validation logic if the struct implements the `Validator` interface.

## Features

- **Generic binding**: `goryu.Bind[T]` returns a fully typed `T`, no manual allocation.
- **Content-Type aware**: automatically picks a JSON parser or a form/query parser.
- **Self-validating structs**: implement `Validate() error` and it runs after every successful parse.
- **Safe by default**: JSON bodies are capped at 1MB and unknown fields are rejected.
- **Query & form support**: `GET`/`DELETE` requests and form submissions bind from the query string using `query` tags.

## Usage

### Basic Binding

Use `goryu.Bind[T]` to decode the request into a struct:

```go
import "github.com/arthurlch/goryu"

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

app.Post("/users", func(c *goryu.Ctx) {
    user, err := goryu.Bind[CreateUser](c)
    if err != nil {
        c.Status(http.StatusBadRequest).JSON(map[string]string{"error": err.Error()})
        return
    }

    c.Status(http.StatusCreated).JSON(user)
})
```

`Bind[T]` is a thin wrapper around `c.BodyParser`:

```go
func Bind[T any](c *goryu.Ctx) (T, error) {
    var v T
    err := c.BodyParser(&v)
    return v, err
}
```

If you already have a value to fill, you can call `c.BodyParser(&v)` directly instead.

### How BodyParser Picks a Parser

`BodyParser` chooses the decoding strategy from the request's `Content-Type` header (and, as a fallback, the HTTP method):

| Content-Type / Method | Parser used | Reads from |
|-----------------------|-------------|------------|
| `application/json` | `BindJSON` | request body (JSON) |
| `application/x-www-form-urlencoded` | `QueryParser` | form values |
| `multipart/form-data` | `QueryParser` | form values |
| `GET` or `DELETE` (any/no Content-Type) | `QueryParser` | query string |
| anything else | — | returns `unsupported content-type` error |

The JSON path (`BindJSON`) decodes using struct `json` tags. The form and query paths (`QueryParser`) decode using struct `query` tags:

```go
type ListParams struct {
    Page    int    `query:"page"`
    Limit   int    `query:"limit"`
    Search  string `query:"q"`
    Active  bool   `query:"active"`
}

app.Get("/users", func(c *goryu.Ctx) {
    params, err := goryu.Bind[ListParams](c)
    if err != nil {
        c.Status(http.StatusBadRequest).JSON(map[string]string{"error": err.Error()})
        return
    }
    // GET /users?page=2&limit=20&q=alice&active=true
    c.JSON(params)
})
```

::: tip
`QueryParser` supports `string`, integer types, and `bool` fields. Integers are parsed at the field's real width, so an out-of-range value is rejected rather than silently wrapping. Empty query values are skipped, leaving the field at its zero value.
:::

### The Validator Interface

Any struct that implements the `Validator` interface has its `Validate()` method called automatically after a successful parse — for **every** content type, not just JSON:

```go
type Validator interface {
    Validate() error
}
```

Implement it on your struct to enforce business rules:

```go
import (
    "errors"
    "strings"
)

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

func (u CreateUser) Validate() error {
    if strings.TrimSpace(u.Name) == "" {
        return errors.New("name is required")
    }
    if !strings.Contains(u.Email, "@") {
        return errors.New("email is invalid")
    }
    if u.Age < 0 {
        return errors.New("age must be positive")
    }
    return nil
}
```

If `Validate()` returns an error, that error is returned from `Bind` / `BodyParser`, and no further processing happens.

### Full Request Handler

Putting it together — bind, validate, and respond:

```go
import (
    "errors"
    "net/http"
    "strings"

    "github.com/arthurlch/goryu"
)

type CreateUser struct {
    Name  string `json:"name"`
    Email string `json:"email"`
    Age   int    `json:"age"`
}

func (u CreateUser) Validate() error {
    if strings.TrimSpace(u.Name) == "" {
        return errors.New("name is required")
    }
    if !strings.Contains(u.Email, "@") {
        return errors.New("email is invalid")
    }
    return nil
}

func main() {
    app := goryu.New()

    app.Post("/users", func(c *goryu.Ctx) {
        // Parses JSON, then runs CreateUser.Validate().
        user, err := goryu.Bind[CreateUser](c)
        if err != nil {
            c.Status(http.StatusBadRequest).JSON(map[string]string{
                "error": err.Error(),
            })
            return
        }

        // user is fully populated and validated here.
        c.Status(http.StatusCreated).JSON(map[string]any{
            "message": "user created",
            "user":    user,
        })
    })

    app.Listen(":8080")
}
```

## JSON Safety Limits

The JSON parser applies two protections automatically:

- **1MB body limit** — JSON payloads larger than 1MB are rejected. This guards against memory-exhaustion (DoS) attacks. Larger, non-JSON bodies use the framework's separate 10MB reader.
- **`DisallowUnknownFields`** — any field in the JSON body that does not map to a struct field causes a decode error. This catches typos and prevents clients from smuggling unexpected data.

::: warning
Because unknown fields are rejected, a request will fail if it contains keys your struct does not declare. Make sure every field a client may send has a matching `json`-tagged field on your struct (or the client omits it).
:::

::: tip
`BindJSON` requires the `Content-Type` to start with `application/json`. A JSON body sent without that header will not be parsed as JSON — it falls through to the form/query path or returns an unsupported-content-type error.
:::

## See Also

- [JSON Schema](/ja/core/schema) — generate a JSON Schema from the same structs for validation docs, `/schema` endpoints, and LLM structured output.
- [Context](/ja/core/context) — the request/response object powering `BodyParser`, `QueryParser`, and `BindJSON`.
