// Paints the room's surface maps off the page's own thread, while the room
// is built (room-materials.js asks; room-materials-paint.js does the work).
import {paint} from './room-materials-paint.js';

onmessage = ({data: {id, jobs}}) => {
  const {results, ms, transfer} = paint(jobs);
  postMessage({id, results, ms}, transfer);
};
