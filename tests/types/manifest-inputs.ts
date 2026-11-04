/**
 * Compile-time guards over the `./manifest` input types. The SDK's own
 * `DriverManifest` — what `homey.manifest.drivers` holds since the SDK
 * types 1.x — must fit `ManifestDriver`, so an app passes its manifest
 * straight through with no hand-written manifest type in between; and
 * the kit's type must stay the wider one, since it names no SDK type and
 * describes only the fields it reads. Each annotation resolves to `false`
 * the moment that stops holding, and assigning `true` to `false` stops
 * `tsc`: checked by `typecheck`, not by the test run — the types erase.
 */
import type { DriverManifest } from 'homey/types/manifest.js'

import type { ManifestDriver } from '../../src/manifest/index.ts'

export const canSdkDriverPass: DriverManifest extends ManifestDriver
  ? true
  : false = true

export const isKitDriverWider: ManifestDriver extends DriverManifest
  ? false
  : true = true
