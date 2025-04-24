import path from 'path-browserify';

export const normalizePath = (p) => path.normalize(p).replace(/\\/g, '/');

export const getBasename = (p) => path.basename(p);

export const joinPaths = (...parts) => normalizePath(path.join(...parts));

export const getDisplayName = (item) => {
  if (!item) return '';
  if (item.displayName) return getBasename(item.displayName);
  if (item.name) return getBasename(item.name);
  if (item.path) return getBasename(item.path);
  return '';
};

export const getDirname = (p) => path.dirname(p);

export default { normalizePath, getBasename, joinPaths, getDisplayName, getDirname };