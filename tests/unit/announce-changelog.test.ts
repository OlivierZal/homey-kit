import { type Mock, describe, expect, it, vi } from 'vitest'

import {
  type ChangelogAnnouncementOptions,
  announceChangelog,
  NOTIFICATION_DELAY_MS,
} from '../../src/announce-changelog.ts'
import { getMockCallArg } from '../../src/testing/helpers.ts'

const changelog = {
  '1.0.0': { en: 'one' },
  '1.1.0': { en: 'one-one', fr: 'un-un' },
  '1.2.0': { en: 'one-two' },
}

interface Harness {
  createNotification: Mock<Notifier>
  set: Mock<ChangelogAnnouncementOptions['settings']['set']>
  setTimeout: Mock<Scheduler>
  runScheduled: () => Promise<void>
}

type Notifier =
  ChangelogAnnouncementOptions['notifications']['createNotification']

type Scheduler = ChangelogAnnouncementOptions['homey']['setTimeout']

const install = ({
  language = 'en',
  notified,
  version = '1.2.0',
}: {
  notified: unknown
  language?: string
  version?: string
}): Harness => {
  const setTimeout = vi.fn<Scheduler>()
  const createNotification = vi.fn<Notifier>().mockResolvedValue(undefined)
  const set = vi.fn<ChangelogAnnouncementOptions['settings']['set']>()
  announceChangelog({
    changelog,
    homey: { setTimeout },
    language,
    notifications: { createNotification },
    settings: { set, get: () => notified },
    version,
  })
  return {
    createNotification,
    set,
    setTimeout,
    runScheduled: async (): Promise<void> => {
      await getMockCallArg<() => Promise<void>>(setTimeout, 0, 0)()
    },
  }
}

describe(announceChangelog, () => {
  it('should schedule the announcement after the delay, then post every excerpt and record the version', async () => {
    const { createNotification, runScheduled, set, setTimeout } = install({
      notified: '1.0.0',
    })

    expect(setTimeout).toHaveBeenCalledExactlyOnceWith(
      expect.any(Function),
      NOTIFICATION_DELAY_MS,
    )
    expect(createNotification).not.toHaveBeenCalled()

    await runScheduled()

    expect(createNotification).toHaveBeenNthCalledWith(1, {
      excerpt: 'one-one',
    })
    expect(createNotification).toHaveBeenNthCalledWith(2, {
      excerpt: 'one-two',
    })
    expect(set).toHaveBeenCalledExactlyOnceWith('notifiedVersion', '1.2.0')
  })

  it('should post the excerpts one at a time', async () => {
    const { createNotification, runScheduled } = install({ notified: '1.0.0' })
    const { promise: first, resolve } = Promise.withResolvers<undefined>()
    createNotification.mockReturnValueOnce(first)

    const scheduled = runScheduled()
    await Promise.resolve()

    expect(createNotification).toHaveBeenCalledTimes(1)

    resolve(undefined)
    await scheduled

    expect(createNotification).toHaveBeenCalledTimes(2)
  })

  it('should announce in the given language', async () => {
    const { createNotification, runScheduled } = install({
      language: 'fr',
      notified: '1.0.0',
      version: '1.1.0',
    })

    await runScheduled()

    expect(createNotification).toHaveBeenCalledExactlyOnceWith({
      excerpt: 'un-un',
    })
  })

  it.each([
    { kind: 'no stored version', notified: undefined },
    { kind: 'a null stored version', notified: null },
    { kind: 'a stored value that is not a string', notified: 42 },
  ])(
    'should announce only the running version on $kind',
    async ({ notified }) => {
      const { createNotification, runScheduled } = install({ notified })

      await runScheduled()

      expect(createNotification).toHaveBeenCalledExactlyOnceWith({
        excerpt: 'one-two',
      })
    },
  )

  it('should schedule nothing when the running version was already announced', () => {
    const { setTimeout } = install({ notified: '1.2.0' })

    expect(setTimeout).not.toHaveBeenCalled()
  })

  it('should leave the version unrecorded when a notification fails to post', async () => {
    const { createNotification, runScheduled, set } = install({
      notified: '1.0.0',
    })
    createNotification.mockRejectedValueOnce(new Error('offline'))

    await expect(runScheduled()).resolves.toBeUndefined()

    expect(createNotification).toHaveBeenCalledTimes(1)
    expect(set).not.toHaveBeenCalled()
  })
})
