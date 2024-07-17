import { formIdPathMapping } from './constant.js';

export default function decorate(id) {
  return formIdPathMapping ? formIdPathMapping[id] : null;
}
