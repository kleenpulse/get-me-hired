// The animation features motion needs for the one animation the app has: the
// tile that slides between nav items (layoutId, so domMax). Loaded after the
// first paint by LazyMotion in App.tsx, so the first page load doesn't pay for
// them. Until they arrive the tile just moves without sliding.

import { domMax } from 'motion/react';

export default domMax;
