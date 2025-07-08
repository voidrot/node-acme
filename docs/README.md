# ACME Client Documentation

This project provides a TypeScript ACME client for interacting with ACME servers (such as Let's Encrypt) to automate certificate issuance.

## Features
- ACME directory discovery
- Account registration (with JWS/JWK)
- (Planned) Order creation, challenge handling, certificate download

## Usage Example

```
ts
import { AcmeClient } from '../src/acmeClient'

async function main() {
  const acme = new AcmeClient('https://acme-v02.api.letsencrypt.org/directory')
  const accountUrl = await acme.createAccount('your@email.com')
  console.log('Account URL:', accountUrl)
}

main().catch(console.error)
```

## API

### `AcmeClient`
- `constructor(directoryUrl: string)`
- `getDirectory(): Promise<AcmeDirectory>`
- `createAccount(email: string): Promise<string>`

See the source for more details.
