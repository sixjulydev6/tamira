import { local } from './timeline.js';
// Preserve the source's story units so geometry, camera and room images share one clock.
export const finaleU = p => local(p, 'room') > 0 ? 7.06 + local(p, 'room') * .88 : 6.06 + local(p, 'finale');
export const ROOM_BEATS = { pull: [7.08,7.7], steps: [[7.1,7.125],[7.2,7.225],[7.3,7.325],[7.4,7.425],[7.5,7.525]] };
