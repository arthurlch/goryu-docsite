# Goryu CLI

The `goryu` command-line tool provides project scaffolding, code generation, development helpers, and AI/agent tooling for Goryu applications. Run it without arguments to launch an interactive TUI, or pass a command directly.

## Installation

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
```

Or build from source:

```bash
go build ./cmd/goryu
```

## Quick Start

```bash
goryu init my-app
cd my-app
go mod tidy
go run cmd/server/main.go
```

Your app will be running at `http://localhost:8080`.

## Command Groups

| Group | Commands |
|-------|----------|
| Project | [`init`](#init) |
| Code generation | [`generate`](#generate-g) / [`g`](#generate-g) |
| Scaffolding | [`scaffold`](#scaffold) |
| Development | [`dev`](#dev), [`build`](#build) |
| AI & tooling | [`scaffold ai`](#scaffold-ai), [`mcp`](#mcp) |
| Management | [`routes`](#routes), [`middleware`](#middleware), [`config`](#config), [`validate`](#validate), [`version`](#version) |

Every subcommand supports `--help`. Long flags use `--flag`; where a shorthand exists it is shown as `-x, --flag`.

## Project

### `init`

Initialize a new Goryu project from a template.

```bash
goryu init <name> [flags]
```

**Flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --template` | Project template: `basic`, `api`, `web`, `db` | `basic` |
| `-p, --path` | Project path | `.` |
| `-m, --module` | Go module name | derived from name |
| `--git` | Initialize git repository | `true` |
| `--docker` | Include Docker files | `false` |
| `--ci` | Include CI/CD configs | `false` |
| `--db-tool` | Database tool for the `db` template: `sqlc`, `ent`, `gorm` | `sqlc` |

**Templates:**

- `basic` — minimal web application.
- `api` — REST API with an enhanced project structure.
- `web` — web application with static assets and views.
- `db` — application wired to a database layer (`--db-tool` selects the toolkit).

**Examples:**

```bash
# Minimal project
goryu init my-app

# REST API with Docker and CI
goryu init my-api --template=api --docker --ci

# Database project using ent, under a custom module path
goryu init billing --template=db --db-tool=ent --module=github.com/acme/billing
```

```text
Creating project 'my-api' (template: api)...
  created cmd/server/main.go
  created internal/handlers/
  created config/config.json
  initialized git repository
Done. Next: cd my-api && go mod tidy
```

## Code generation

### `generate` / `g`

Generate boilerplate code from templates. `g` is an alias for `generate`.

```bash
goryu generate <type> <name> [flags]
goryu g <type> <name> [flags]
```

Types: `handler`, `middleware`, `model`, `route`, `config`.

#### `generate handler`

```bash
goryu generate handler <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type` | Handler type: `basic`, `crud`, `api`, `ai` | `basic` |
| `--kind` | AI handler kind (only for `--type=ai`): `chat`, `rag`, `agent` | `chat` |
| `-p, --path` | Output path | `internal/handlers` |
| `--model` | Associated model name | — |
| `--middleware` | Middleware to apply (comma-separated) | — |
| `--route` | Route pattern | `/{name}` |

The `ai` type scaffolds a streaming LLM handler wired to Goryu's AI batteries: typed `Bind[T]` + `Validate`, `Schema[T]` for JSON Schema, SSE token streaming via `SSEJSON`, and token/cost accounting via the [aimeter](/middleware/aimeter) middleware. Pair it with [promptcache](/middleware/promptcache) and [recorder](/middleware/recorder), and see [AI & agents](/ai/) for the full workflow.

```bash
# CRUD handler bound to a model
goryu g handler user --type=crud --model=User

# API handler behind auth + rate limiting
goryu g handler orders --type=api --middleware=auth,limiter

# Streaming AI chat handler
goryu g handler assistant --type=ai --kind=chat
```

#### `generate middleware`

```bash
goryu generate middleware <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type` | Middleware type: `standard`, `builder`, `plugin` | `builder` |
| `-p, --path` | Output path | `internal/middleware` |
| `--global` | Register as global middleware | `false` |

```bash
goryu g middleware requestlog --type=builder --global
```

#### `generate model`

```bash
goryu generate model <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type` | Model type: `basic`, `db` | `basic` |
| `--db-tool` | Database tool: `gorm`, `sqlc`, `ent` | `gorm` |
| `-f, --fields` | Model fields (comma-separated) | — |
| `-p, --path` | Output path | `internal/models` |

```bash
goryu g model product --type=db --fields="name:string,price:float64,in_stock:bool"
```

#### `generate route`

```bash
goryu generate route <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-b, --builder` | Use the route builder pattern | `true` |
| `-g, --group` | Route group prefix | — |
| `-m, --middleware` | Route middleware (comma-separated) | — |
| `--methods` | HTTP methods (comma-separated) | `GET,POST,PUT,DELETE` |

```bash
goryu g route user --group=/api/v1 --middleware=auth,limiter --methods=GET,POST
```

#### `generate config`

```bash
goryu generate config <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-b, --builder` | Use the config builder pattern | `true` |
| `-t, --type` | Config type: `server`, `database`, `cache` | `server` |
| `-f, --format` | Config format: `json`, `yaml`, `toml`, `env` | `json` |

```bash
goryu g config database --type=database --format=yaml
```

## Scaffolding

### `scaffold`

Scaffold complete features or services in one command.

```bash
goryu scaffold <feature> <name> [flags]
```

Features: `api`, `service`, `ai`.

#### `scaffold api`

Scaffold a complete REST API resource with handlers, model, database layer, validation, and tests.

```bash
goryu scaffold api <resource> --fields=<fields> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --fields` | Resource fields (comma-separated) — **required** | — |
| `--db` | Include database layer | `true` |
| `--auth` | Add authentication | `false` |
| `--validation` | Add validation | `true` |
| `--tests` | Generate tests | `true` |

```bash
goryu scaffold api product --fields="name:string,price:float64" --auth
```

```text
Scaffolding REST API 'product'...
  internal/models/product.go
  internal/handlers/product_handler.go
  internal/handlers/product_handler_test.go
  internal/routes/product_routes.go
Done. 4 files created.
```

#### `scaffold service`

Scaffold a microservice with transport and monitoring wiring.

```bash
goryu scaffold service <name> [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--grpc` | Include gRPC support | `false` |
| `--http` | Include HTTP support | `true` |
| `--kafka` | Include Kafka support | `false` |
| `--monitoring` | Include monitoring | `true` |

```bash
goryu scaffold service payments --grpc --kafka
```

#### `scaffold ai`

Scaffold an AI/LLM endpoint wired to Goryu's AI batteries.

```bash
goryu scaffold ai <name> [--kind=chat|rag|agent] [--path=...]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-k, --kind` | Endpoint kind: `chat` (streaming chat), `rag` (retrieval-augmented answer), `agent` (typed tool endpoint with a function-calling schema) | `chat` |
| `-p, --path` | Output path | `internal/handlers` |

```bash
goryu scaffold ai assistant --kind=chat
goryu scaffold ai docs-search --kind=rag
goryu scaffold ai booking --kind=agent
```

See [AI & agents](/ai/) for how the generated endpoints combine with the metering, prompt-cache, and recording middleware.

## Development

### `dev`

Start a development server with hot reload.

```bash
goryu dev [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-p, --port` | Server port | `3000` |
| `--hot-reload` | Enable hot reload | `true` |
| `-d, --debug` | Enable debug mode | `false` |

```bash
goryu dev --port=8080 --debug
```

### `build`

Build the application binary.

```bash
goryu build [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `-o, --output` | Output binary name | `server` |
| `-t, --target` | Build target: `development`, `production` | `production` |
| `--compress` | Compress the binary | `false` |
| `--static` | Build a static binary | `true` |

```bash
goryu build --output=api --target=production --compress
```

## AI & tooling

### `mcp`

Run a stdio MCP (Model Context Protocol) server that exposes Goryu's project tools to AI agents over JSON-RPC. It advertises `list_routes`, `scaffold_handler`, and `run_dev_server`.

```bash
goryu mcp
```

Point an MCP client (Claude Code, an IDE agent, etc.) at `goryu mcp` running in your project directory. See [MCP server](/ai/mcp) for client configuration and the full tool schema.

## Management

### `routes`

Inspect and test the application's routes.

```bash
goryu routes list [--format=table|json] [--filter=<pattern>]
goryu routes test <path> [method]
```

**`routes list` flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --format` | Output format: `table`, `json` | `table` |
| `--filter` | Filter routes by pattern | — |

```bash
goryu routes list --format=table
goryu routes test /api/v1/users GET
```

```text
METHOD  PATH                 HANDLER
GET     /api/v1/users        ListUsers
POST    /api/v1/users        CreateUser
GET     /api/v1/users/{id}   GetUser
```

### `middleware`

List and inspect available middleware.

```bash
goryu middleware list
goryu middleware info <name>
```

```bash
goryu middleware info limiter
```

```text
limiter — fixed-window rate limiting
  New(config...) / Default()
  Config: Max, Expiration, KeyGenerator, LimitReached
```

See the [middleware catalog](/middleware/) for the full list.

### `config`

Manage application configuration.

```bash
goryu config init [--type=server] [--format=json]
goryu config validate [--file=config.json]
goryu config migrate --from=<format> --to=<format>
```

**`config init` flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-t, --type` | Config type | `server` |
| `-f, --format` | Config format | `json` |

**`config validate` flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `-f, --file` | Config file | `config.json` |

**`config migrate` flags:**

| Flag | Description | Default |
|------|-------------|---------|
| `--from` | Source format — **required** | — |
| `--to` | Target format — **required** | — |

```bash
goryu config init --type=server --format=yaml
goryu config validate --file=config/config.json
goryu config migrate --from=json --to=yaml
```

### `validate`

Validate project structure and configuration.

```bash
goryu validate [flags]
```

| Flag | Description | Default |
|------|-------------|---------|
| `--config` | Configuration file path | `config/config.json` |
| `--project` | Validate project structure | `true` |
| `--fix` | Auto-fix issues | `false` |

```bash
goryu validate --fix
```

### `version`

Show version information.

```bash
goryu version
```

## Example: build an API project

```bash
# Initialize with the API template
goryu init my-api --template=api
cd my-api

# Generate resources
goryu g model user --type=db --fields="name:string,email:string"
goryu g handler user --type=api --model=User
goryu g route user --group=/api/v1 --middleware=auth,limiter

# Run and inspect
goryu dev --port=8080
goryu routes list
```
