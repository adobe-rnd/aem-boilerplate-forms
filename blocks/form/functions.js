import { formIdPathMapping } from './constant.js';

export default function decorate(id) {
  return id ? formIdPathMapping[atob(id)] : null;
}
