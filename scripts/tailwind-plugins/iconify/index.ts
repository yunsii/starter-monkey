import { addDynamicIconSelectors } from 'tailwindcss-plugin-iconify'

export default addDynamicIconSelectors({
  prefix: 'i',
  preprocessSets: {
    'bx': '*',
    'svg-spinners': ['180-ring-with-bg'],
  },
})
