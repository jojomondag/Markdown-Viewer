/**
 * Environment detection utilities
 */

/**
 * Check if the app is running in Electron
 * @returns {boolean} True if running in Electron
 */
export const isElectron = () => {
  return window?.electron !== undefined;
};

/**
 * Detect if running in development mode
 * @returns {boolean} True if in development mode
 */
export const isDevelopment = () => {
  return import.meta.env.DEV === true;
};

/**
 * Detect operating system
 * @returns {string} 'windows', 'mac', 'linux', or 'unknown'
 */
export const getOS = () => {
  const userAgent = window.navigator.userAgent;
  
  if (userAgent.indexOf('Windows') !== -1) return 'windows';
  if (userAgent.indexOf('Mac') !== -1) return 'mac';
  if (userAgent.indexOf('Linux') !== -1) return 'linux';
  
  return 'unknown';
};

export default {
  isElectron,
  isDevelopment,
  getOS
};