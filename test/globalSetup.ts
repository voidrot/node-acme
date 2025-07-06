import type { TestProject } from 'vitest/node'
import { DockerComposeEnvironment, StartedDockerComposeEnvironment, Wait } from 'testcontainers'

const composeFilePath = './'
const composeFile = 'compose.yml'

let startedComposeEnvironment: StartedDockerComposeEnvironment | undefined = undefined

export async function setup(project: TestProject) {
  const composeEnvironment: DockerComposeEnvironment = await new DockerComposeEnvironment(composeFilePath, composeFile)
    .withWaitStrategy('pebble-1', Wait.forLogMessage('ACME directory available at: https://0.0.0.0:14000/dir'))
    .withWaitStrategy('challtestsrv-1', Wait.forLogMessage('Starting challenge servers'))
  startedComposeEnvironment = await composeEnvironment.up()

  project.provide('ACME_API', 'https://localhost:14000/dir')
  project.provide('ACME_MGMT_API', 'https://localhost:15000')
  project.provide('ACME_CHALLENGE_API', 'http://localhost:8055')
}

export async function teardown() {
  await startedComposeEnvironment?.down()
}

declare module 'vitest' {
  export interface ProvidedContext {
    ACME_API: string
    ACME_MGMT_API: string
    ACME_CHALLENGE_API: string
  }
}
