import { BrowserWindow, ipcMain, ipcRenderer, type IpcMainEvent, type IpcRendererEvent } from 'electron';

type IPCHandler = ((event: IpcRendererEvent, ...args: any[]) => void) & ((event: IpcMainEvent, ...args: any[]) => void);

export default class PluginRelay {
  constructor() {
    if (this.isMain) {
      //TODO Determine if this is necessary for OTHER windows
      /**
       * If so, consider a modified data structure that indicates originating window
       * ie: { originalRelay: { msg, payload }, originatingWindow: id }
       * When iterating check for this format, and skip originating window to avoid recursive relays
       */
      // ipcMain.on('renderer:relay', (event: any, msg: any, payload: any) => {
      //   this.send(msg, payload);
      // });
    }
  }

  get isMain() {
    return process.type !== 'renderer';
  }

  listen(msg: string, handler: IPCHandler, isOnce: boolean = false) {
    const emitter = this.isMain ? ipcMain : ipcRenderer;
    const emitType = isOnce ? emitter.once.bind(emitter) : emitter.on.bind(emitter);

    emitType(msg as any, handler);
  }

  on(msg: string, handler: IPCHandler) {
    return this.listen(msg, handler);
  }

  once(msg: string, handler: IPCHandler) {
    return this.listen(msg, handler, true);
  }

  send(msg: string, payload?: any) {
    if (this.isMain) {
      // Send to all open windows
      BrowserWindow.getAllWindows().forEach((bw: BrowserWindow) => {
        bw.webContents.send(msg as any, payload);
      });

      // Send internally to Main process
      ipcMain.emit(msg as any, payload);
    } else {
      ipcRenderer.send(msg as any, payload);
      // ipcRenderer.send('renderer:relay', msg as any, payload);
    }
  }
}
