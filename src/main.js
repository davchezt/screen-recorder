const {app, BrowserWindow, ipcMain} = require('electron')

let mainWindow
let pickerDialog

app.on('ready', () => {
  mainWindow = new BrowserWindow({
    height: 565,
    width: 655,
    frame: false,
    resizable: false
  });

  pickerDialog = new BrowserWindow({
    parent: mainWindow,
    skipTaskbar: true,
    modal: true,
    show: false,
    height: 565,
    width: 655,
    frame: false,
    resizable: false
  })
  mainWindow.loadURL('file://' + __dirname + '/index.html')
  // mainWindow.webContents.openDevTools({mode:'undocked'})
  pickerDialog.loadURL('file://' + __dirname + '/picker.html')
  // pickerDialog.webContents.openDevTools({mode:'undocked'})
});

ipcMain.on('show-picker', (event, options) => {
  pickerDialog.show()
  pickerDialog.webContents.send('get-sources', options)
})

ipcMain.on('source-id-selected', (event, sourceId) => {
  pickerDialog.hide()
  mainWindow.webContents.send('source-id-selected', sourceId)
})
