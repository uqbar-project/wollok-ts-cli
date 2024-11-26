import latestVersion from '@badisi/latest-version'
import { cyan, greenBright, red, yellow } from 'chalk'
import Box from 'cli-box'
import { compareVersions } from 'compare-versions'
import pkg from '../package.json'
import { logger } from './logger'


export default async (): Promise<void> => {
  const publishedPackage = await latestVersion('wollok-ts-cli')
  if(publishedPackage.latest){
    if(compareVersions(publishedPackage.latest, pkg.version) === 1) {
      const box = Box(
        {
          h: 10,
          w: 72,
          marks: {
            nw: '╔', n: '═', ne: '╗',
            e: '║', se: '╝', s: '═',
            sw: '╚', w: '║', b: ' ',
          },
        },
        { text: content(publishedPackage.latest), stretch: true, autoEOL: true, hAlign: 'middle', vAlign: 'center' }
      )
      process.stdout._write(box + '\n\n\n', 'utf-8', (_) => {
        logger.debug('Update notifier failed to print')
      })
    }
  }
}

const content = (publishedVersion: string) => [
  'You are using an old version of Wollok CLI.',
  `${red(pkg.version)} → ${greenBright(publishedVersion)}`,
  'to update it run',
  yellow('npm upgrade -g wollok-ts-cli'),
  'or',
  `Visit ${cyan('https://github.com/uqbar-project/wollok-ts-cli/releases/latest')}`,
  'to download the latest version',
].join('\n')