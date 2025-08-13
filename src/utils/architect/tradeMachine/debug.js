export const debug = {
  enabled: process.env.NODE_ENV !== 'production',
  log: (...args) => {
    if (debug.enabled) {
      console.log(...args);
    }
  },
};

export default debug;
