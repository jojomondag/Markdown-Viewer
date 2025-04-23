import path from 'path-browserify';

export const normalizePath = (p) => path.normalize(p).replace(/\\/g, '/');

export const getBasename = (p) => path.basename(p);

export const cleanName = (name) => {
  if (!name) return '';
  // Strip any directory parts, return only basename
  return getBasename(name);
};

export const joinPaths = (...parts) => normalizePath(path.join(...parts));

export const getDisplayName = (item) => {
  if (!item) return '';
  if (item.displayName) return cleanName(item.displayName);
  if (item.name) return cleanName(item.name);
  if (item.path) return getBasename(item.path);
  return '';
};

export const getDirname = (p) => path.dirname(p);

export default { normalizePath, getBasename, cleanName, joinPaths, getDisplayName, getDirname };