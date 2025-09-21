import { description } from '../../package.json'

const _localesMeta = {
  name: {
    'en': 'Starter Monkey',
    'zh-CN': 'Starter Monkey',
  },
  description: {
    'en': description,
    'zh-CN': '适用于 Tampermonkey、Violentmonkey、Greasemonkey、ScriptCat 等 userscript 引擎的起始模板，由 vite-plugin-monkey 强力驱动。',
  },
}

export const localesMeta = {
  name: {
    ..._localesMeta.name,
    '': _localesMeta.name.en,
  },
  description: {
    ..._localesMeta.description,
    '': _localesMeta.description.en,
  },
}
