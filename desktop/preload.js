const { contextBridge } = require('electron');

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('desktopApp', {
  isDesktop: true,
  platform: process.platform,
  version: require('./package.json').version,
});
