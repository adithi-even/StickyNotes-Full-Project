const { app, BrowserWindow, ipcMain, dialog, shell, utilityProcess } = require('electron');
const path = require('path');
const fs = require('fs');

let win;
let chatServer;
const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');
const defaultRoot = () => path.join(app.getPath('userData'), 'StickyNotesData');
let dataRoot;

function readSettings() {
  try { return JSON.parse(fs.readFileSync(settingsPath(), 'utf8')); } catch { return {}; }
}
function writeSettings(settings) {
  fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
  fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
}
function notesPath() { return path.join(dataRoot, 'notes.json'); }
function attachmentsPath() { return path.join(dataRoot, 'attachments'); }
function ensureStorage() {
  fs.mkdirSync(dataRoot, { recursive: true });
  fs.mkdirSync(attachmentsPath(), { recursive: true });
  if (!fs.existsSync(notesPath())) fs.writeFileSync(notesPath(), '[]', 'utf8');
}
function createWindow() {
  const theme = readSettings().theme || { r: 255, g: 246, b: 250, a: 0.88 };
  win = new BrowserWindow({
    width: 510, height: 680, minWidth: 340, minHeight: 390,
    alwaysOnTop: true, frame: true, titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: `rgba(${theme.r},${theme.g},${theme.b},${theme.a})`,
      symbolColor: '#514653', height: 38
    },
    transparent: true, backgroundColor: '#00000000', autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false
    }
  });
  const keepOnTop = () => {
    if (!win || win.isDestroyed()) return;
    win.setAlwaysOnTop(true, 'screen-saver');
  };
  keepOnTop();
  win.on('blur', keepOnTop);
  win.on('focus', keepOnTop);
  win.on('show', keepOnTop);
  win.loadFile(path.join(__dirname, 'index.html'));
}
app.whenReady().then(() => {
  dataRoot = readSettings().storagePath || defaultRoot();
  ensureStorage();
  // Start the local temporary-chat server automatically with the desktop app.
  chatServer = utilityProcess.fork(path.join(__dirname, '../../chat-server/server.js'), [], {
    serviceName: 'Soft Sticky Notes Chat Server',
    env: { ...process.env, PORT: '8787' }
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('before-quit', () => { if (chatServer && !chatServer.killed) chatServer.kill(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

ipcMain.handle('notes:load', () => {
  ensureStorage();
  try { return JSON.parse(fs.readFileSync(notesPath(), 'utf8')); } catch { return []; }
});
ipcMain.handle('notes:save', (_event, notes) => {
  if (!Array.isArray(notes)) throw new Error('Invalid notes payload');
  ensureStorage();
  fs.writeFileSync(notesPath(), JSON.stringify(notes, null, 2), 'utf8');
  return true;
});
ipcMain.handle('attachment:pick', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile'],
    filters: [{ name: 'Images and files', extensions: ['png','jpg','jpeg','gif','webp','pdf','txt','doc','docx','xlsx','csv','zip'] }]
  });
  if (result.canceled || !result.filePaths.length) return null;
  const source = result.filePaths[0];
  const storedName = `${Date.now()}-${path.basename(source).replace(/[^\w.-]/g, '_')}`;
  const dest = path.join(attachmentsPath(), storedName);
  fs.copyFileSync(source, dest);
  return { name: path.basename(source), storedName, path: dest, isImage: /\.(png|jpe?g|gif|webp)$/i.test(source) };
});
ipcMain.handle('attachment:save-pasted', (_event, payload) => {
  if (!payload || !Array.isArray(payload.bytes)) throw new Error('Invalid image data');
  const ext = (path.extname(payload.name || 'pasted.png') || '.png').replace(/[^.a-z0-9]/gi, '');
  const storedName = `${Date.now()}-paste${ext}`;
  const dest = path.join(attachmentsPath(), storedName);
  fs.writeFileSync(dest, Buffer.from(payload.bytes));
  return { name: payload.name || 'Pasted image', storedName, path: dest, isImage: true };
});
ipcMain.handle('attachment:open', async (_event, storedName) => {
  const dest = path.join(attachmentsPath(), path.basename(storedName));
  if (fs.existsSync(dest)) await shell.openPath(dest);
});
ipcMain.handle('attachment:delete', (_event, storedName) => {
  const dest = path.join(attachmentsPath(), path.basename(storedName));
  if (fs.existsSync(dest)) fs.unlinkSync(dest);
  return true;
});
ipcMain.handle('storage:choose', async () => {
  const result = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  dataRoot = path.join(result.filePaths[0], 'SoftStickyNotesData');
  ensureStorage();
  writeSettings({ ...readSettings(), storagePath: dataRoot });
  return dataRoot;
});
ipcMain.handle('storage:current', () => dataRoot);
ipcMain.handle('theme:get', () => readSettings().theme || { r:255, g:246, b:250, a:0.88, textColor:'#5d5260', font:'rounded', fontSize:14, radius:18 });
ipcMain.handle('theme:set', (_event, theme) => {
  const safe = {
    r: Math.max(0, Math.min(255, Number(theme.r) || 0)),
    g: Math.max(0, Math.min(255, Number(theme.g) || 0)),
    b: Math.max(0, Math.min(255, Number(theme.b) || 0)),
    a: Math.max(0.15, Math.min(0.98, Number(theme.a) || 0.88)),
    textColor: /^#[0-9a-fA-F]{6}$/.test(String(theme.textColor || '')) ? String(theme.textColor) : '#5d5260',
    font: ['rounded','handwritten','clean'].includes(theme.font) ? theme.font : 'rounded',
    fontSize: Math.max(12, Math.min(22, Number(theme.fontSize) || 14)),
    radius: Math.max(8, Math.min(30, Number(theme.radius) || 18))
  };
  writeSettings({ ...readSettings(), theme: safe });
  if (win && !win.isDestroyed()) {
    win.setTitleBarOverlay({
      color: `rgba(${safe.r},${safe.g},${safe.b},${safe.a})`,
      symbolColor: safe.r + safe.g + safe.b < 350 ? '#ffffff' : '#514653', height: 38
    });
  }
  return safe;
});
