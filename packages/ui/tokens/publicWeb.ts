import { dark } from '../src/tokens/colors';
import { space } from '../src/tokens/space';
import { radius } from '../src/tokens/radius';

/** Public web layout values stay in the shared token layer. */
export const publicWeb = {
  colors: dark,
  space,
  radius,
  width: 1080,
  readingWidth: 760,
  touch: 48,
  border: 1,
  logo: 48,
  title: 64,
  titleSmall: 36,
  body: 18,
  heading: 26,
  mobile: 680,
  uiFont: 'Figtree',
  titleFont: 'Bricolage Grotesque',
} as const;
