# node-acme

ACME client for Node.js. Easily interact with ACME-compatible Certificate Authorities (such as Let's Encrypt) to automate certificate issuance and management.

## Features
- Written in TypeScript
- Fetch ACME directory metadata
- Register new accounts
- Issue and revoke certificates
- Utility functions for certificate handling

## Installation

```sh
pnpm add node-acme
# or
npm install node-acme
```

## Usage

```ts
import { AcmeClient } from 'node-acme'

const acme = new AcmeClient('https://acme-staging-v02.api.letsencrypt.org/directory')
await acme.init()
// Register account, create orders, etc.
```

See [docs/examples.md](docs/examples.md) for more usage examples.

## Scripts
- `pnpm build` — Build the project
- `pnpm test` — Run tests with Vitest
- `pnpm lint` — Lint and fix code

## Development
- Source code: [`src/`](src/)
- Tests: [`test/`](test/)
- Examples: [`docs/examples.md`](docs/examples.md)

## License
MIT

---

> Author: Buck Brady (<development@buckbrady.com>)
> 
> [GitHub](https://github.com/voidrot/node-acme)
