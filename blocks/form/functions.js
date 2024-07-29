import { formIdPathMapping } from './constant.js';

export default function getCustomFunctionPath(id) {
  return id ? formIdPathMapping[atob(id)] : null;
}
