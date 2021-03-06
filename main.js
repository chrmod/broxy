const electron = require('electron');

// Module to control application life.
const app = electron.app;
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

const ipcMain = electron.ipcMain;

const path = require('path');
const url = require('url');

// Run Cliqz in Electron!
const cliqz = require('browser-core');

const cliqzApp = new cliqz.App();
console.log(cliqzApp);
cliqzApp.start();

// const cliqz = require('browser-core');
// console.log('cliqz', cliqz);

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;


function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: 'hidden-inset', // macOS only
    frame: process.platform === 'darwin',
  });

  // and load the index.html of the app.
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, 'index.html'),
    protocol: 'file:',
    slashes: true,
  }));

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', () => {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);


// Listen for async message from renderer process
ipcMain.on('getCliqzInfo', (event, arg) => {
  // Print 1
  console.log('ASYNC MESSAGE', event, arg);
  // Reply on async message from renderer process
  // TODO - expose an action in proxy-peer background
  const info = cliqzApp.modules['proxy-peer'].background.proxyPeer.httpLifeCycleHijack.socksProxy.server;
  event.sender.send('cliqzInfo', info.address());
});


// Listen for sync message from renderer process
// ipcMain.on('sync', (event, arg) => {
//   console.log('SYNC MESSAGE', arg);
//   // Send value synchronously back to renderer process
//   event.returnValue = 4;
//   // Send async message to renderer process
//   mainWindow.webContents.send('ping', 5);
// });


// Quit when all windows are closed.
app.on('window-all-closed', () => {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
