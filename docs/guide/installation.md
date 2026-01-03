# Installation

Getting started with Goryu is easy. You can install the framework and the CLI tool using standard Go tools.

## Prerequisites

- **Go 1.21+**: Goryu requires a recent version of Go. [Download Go](https://go.dev/dl/).

## Install Framework

To add the Goryu framework to your existing project:

```bash
go get github.com/arthurlch/goryu
```

## Install CLI

The Goryu CLI (`goryu`) is the recommended way to create and manage projects.

```bash
go install github.com/arthurlch/goryu/cmd/goryu@latest
```

Verify the installation:

```bash
goryu version
```

## Using the Makefile

Goryu projects often come with a `Makefile` to simplify common tasks.

### Common Commands

```bash
# Run the application in development mode
make dev

# Build the binary
make build

# Run tests
make test

# clean build artifacts
make clean
```

> [!TIP]
> You can check the contents of your `Makefile` to see all available commands.

## Next Steps

- Follow the [Tutorial](/guide/tutorial) to build your first app.
- Check out the [CLI Reference](/cli) for all commands.
