# JSON Schema

Goryu can generate a [JSON Schema](https://json-schema.org/) (draft 2020-12) directly from your Go types using reflection. This is useful for documenting your API, serving a `/schema` endpoint, and producing the structured-output / function-calling schemas that LLMs expect — all from the same structs you already bind requests into.

## Features

- **Generated from Go types**: `goryu.Schema[T]()` builds a schema from any struct with no hand-written JSON.
- **Draft 2020-12**: `Schema[T]` includes the `$schema` dialect identifier.
- **Rich constraints**: describe fields with a `jsonschema` struct tag (description, format, enum, ranges, lengths, patterns, and more).
- **Smart `required`**: derived from `omitempty` and pointer-ness, with explicit overrides.
- **Handles real types**: nested structs, embedded structs, slices, maps, pointers, `time.Time`, and `[]byte`, with recursion protection.

## Usage

### Generating a Schema

`goryu.Schema[T]()` returns a `map[string]any` you can serialize as JSON:

```go
import "github.com/arthurlch/goryu"

type User struct {
    Name  string `json:"name"`
    Email string `json:"email" jsonschema:"format=email"`
    Age   int    `json:"age" jsonschema:"minimum=0,maximum=130"`
}

schema := goryu.Schema[User]()
```

This produces:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "name":  { "type": "string" },
    "email": { "type": "string", "format": "email" },
    "age":   { "type": "integer", "minimum": 0, "maximum": 130 }
  },
  "required": ["name", "email", "age"]
}
```

If you have a `reflect.Type` instead of a compile-time type parameter, use `goryu.SchemaOf(t)`. It returns the same map **without** the `$schema` key:

```go
import "reflect"

schema := goryu.SchemaOf(reflect.TypeOf(User{}))
```

### Type Mapping

Go types map to JSON Schema types as follows:

| Go type | JSON Schema |
|---------|-------------|
| `bool` | `{"type": "boolean"}` |
| integer types | `{"type": "integer"}` |
| `float32` / `float64` | `{"type": "number"}` |
| `string` | `{"type": "string"}` |
| slice / array | `{"type": "array", "items": ...}` |
| `[]byte` | `{"type": "string", "contentEncoding": "base64"}` |
| `map` | `{"type": "object", "additionalProperties": ...}` |
| `struct` | `{"type": "object", "properties": ...}` |
| `time.Time` | `{"type": "string", "format": "date-time"}` |
| pointer | schema of the pointed-to type (and marks the field optional) |

### Constraint Tags

Add constraints with a `jsonschema` struct tag. Constraints are comma-separated `key=value` pairs. The following keys are supported:

| Tag key | Applies to | Example tag | Resulting schema |
|---------|-----------|-------------|------------------|
| `description` | any | `jsonschema:"description=User email address"` | `"description": "User email address"` |
| `title` | any | `jsonschema:"title=Email"` | `"title": "Email"` |
| `format` | strings | `jsonschema:"format=email"` | `"format": "email"` |
| `pattern` | strings | `jsonschema:"pattern=^[a-z]+$"` | `"pattern": "^[a-z]+$"` |
| `default` | any | `jsonschema:"default=active"` | `"default": "active"` |
| `enum` | any | `jsonschema:"enum=red\|green\|blue"` | `"enum": ["red", "green", "blue"]` |
| `minimum` | numbers | `jsonschema:"minimum=0"` | `"minimum": 0` |
| `maximum` | numbers | `jsonschema:"maximum=100"` | `"maximum": 100` |
| `multipleOf` | numbers | `jsonschema:"multipleOf=5"` | `"multipleOf": 5` |
| `minLength` | strings | `jsonschema:"minLength=3"` | `"minLength": 3` |
| `maxLength` | strings | `jsonschema:"maxLength=64"` | `"maxLength": 64` |
| `minItems` | arrays | `jsonschema:"minItems=1"` | `"minItems": 1` |
| `maxItems` | arrays | `jsonschema:"maxItems=10"` | `"maxItems": 10` |
| `required` | any | `jsonschema:"required"` | forces the field into `required` |
| `optional` | any | `jsonschema:"optional"` | removes the field from `required` |

Combine several constraints in one tag:

```go
type Product struct {
    SKU      string   `json:"sku" jsonschema:"description=Stock keeping unit,pattern=^[A-Z0-9-]+$,minLength=3"`
    Price    float64  `json:"price" jsonschema:"minimum=0,multipleOf=0.01"`
    Status   string   `json:"status" jsonschema:"enum=draft|published|archived,default=draft"`
    Tags     []string `json:"tags" jsonschema:"minItems=1,maxItems=20"`
}
```

::: warning
A description must not contain a comma. The comma is the separator between constraints in the tag, so a comma inside a value would be read as the start of a new constraint. For multiple allowed values in `enum`, use `|` as the separator instead of a comma.
:::

### How `required` Is Determined

For each exported field the schema decides whether it belongs in the `required` list, in this order:

1. A bare `required` in the `jsonschema` tag always marks it required.
2. A bare `optional` in the `jsonschema` tag always marks it optional.
3. Otherwise, if the `json` tag has `omitempty`, the field is optional.
4. Otherwise, a pointer field is optional and a non-pointer field is required.

```go
type Account struct {
    ID       string  `json:"id"`                              // required (non-pointer, no omitempty)
    Nickname string  `json:"nickname,omitempty"`              // optional (omitempty)
    Manager  *string `json:"manager"`                         // optional (pointer)
    Country  string  `json:"country" jsonschema:"optional"`   // optional (explicit override)
    Token    *string `json:"token" jsonschema:"required"`     // required (explicit override)
}
```

::: tip
Embedded structs are flattened: the embedded type's properties and `required` entries are merged into the parent object. Recursive types are guarded — a struct that references itself resolves to a bare `{"type": "object"}` to avoid infinite loops.
:::

### Serving a `/schema` Endpoint

Because `Schema[T]()` returns a plain map, you can hand it straight to `c.JSON`:

```go
import "github.com/arthurlch/goryu"

type CreateUser struct {
    Name  string `json:"name" jsonschema:"description=Full name"`
    Email string `json:"email" jsonschema:"format=email"`
}

app.Get("/schema/user", func(c *goryu.Ctx) {
    c.JSON(goryu.Schema[CreateUser]())
})
```

Clients, front-end forms, and validation tools can then fetch the schema to understand your request shape. Pair this with [Binding & Validation](/ja/core/binding) so the same struct both validates incoming requests and describes them.

### LLM Structured Output & Function Calling

Most LLM APIs accept a JSON Schema to constrain model output or to declare a callable tool. `Schema[T]()` produces exactly that shape from your Go type, so your function-calling definitions stay in sync with your code:

```go
type WeatherQuery struct {
    City string `json:"city" jsonschema:"description=City name to look up"`
    Unit string `json:"unit" jsonschema:"enum=celsius|fahrenheit,default=celsius"`
}

// Use as the parameters schema of an LLM tool / function definition.
tool := map[string]any{
    "name":        "get_weather",
    "description": "Look up the current weather for a city",
    "parameters":  goryu.Schema[WeatherQuery](),
}
```

The generated `description`, `enum`, and `format` constraints give the model the guidance it needs, and you can then `goryu.Bind[WeatherQuery]` the model's response back into the same struct.

## See Also

- [Binding & Validation](/ja/core/binding) — parse and validate requests into the same structs you generate schemas from.
- [Context](/ja/core/context) — the request/response object used to serve schemas via `c.JSON`.
