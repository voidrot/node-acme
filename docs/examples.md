# ACME Client Examples

## Register an Account

````ts
import { AcmeClient } from '../src/acmeClient'

async function main() {
  const acme = new AcmeClient('https://acme-staging-v02.api.letsencrypt.org/directory')
  const accountUrl = await acme.createAccount('your@email.com')
  console.log('Account URL:', accountUrl)
}

main().catch(console.error)
````

## Fetch Directory

````ts
import { AcmeClient } from '../src/acmeClient'

async function main() {
  const acme = new AcmeClient('https://acme-staging-v02.api.letsencrypt.org/directory')
  const dir = await acme.getDirectory()
  console.log('Directory:', dir)
}

main().catch(console.error)
````
