const TrayInstance = { setContextMenu: vi.fn() };

const MenuInstance = {
  getMenuItemById: vi.fn()
};

const MenuItemInstance = {
  submenu: {
    items: [{}],
    append: vi.fn()
  }
};

const BrowserWindowInstance = {
  hide: vi.fn(),
  loadURL: vi.fn(),
  on: vi.fn(),
  show: vi.fn(),
  isVisible: vi.fn().mockReturnValueOnce(true).mockReturnValue(false),
  webContents: {
    openDevTools: vi.fn(),
    send: vi.fn()
  }
};

export const BrowserWindow: any = vi.fn(() => BrowserWindowInstance);
BrowserWindow.getAllWindows = vi.fn();

export const Menu: any = vi.fn(() => MenuInstance);
Menu.buildFromTemplate = vi.fn(() => MenuInstance);

export const MenuItem = vi.fn(() => MenuItemInstance);

export const Tray = vi.fn(() => TrayInstance);

export const app = {
  getPath: vi.fn(),
  on: vi.fn(),
  quit: vi.fn(),
  isReady: vi.fn()
};

export const ipcMain = {
  emit: vi.fn(),
  on: vi.fn(),
  once: vi.fn()
};

export const ipcRenderer = {
  on: vi.fn(),
  once: vi.fn(),
  send: vi.fn()
};
