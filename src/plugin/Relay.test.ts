import { BrowserWindow, ipcMain, ipcRenderer } from 'electron';
import type { SpyInstance } from 'vitest';
import Relay from './Relay.js';

vi.mock('electron');

describe('Plugin Relay', () => {
  let relay: Relay;
  let browserWindowInstance: any;

  beforeEach(() => {
    relay = new Relay();
    browserWindowInstance = new BrowserWindow();

    vi.spyOn(BrowserWindow, 'getAllWindows').mockReturnValue([browserWindowInstance]);
  });

  it.todo('should detect if this is the main process or renderer', () => {
    // FIXME: Needs to be injected into Relay (which will be further abstracted later)
    const spy = vi.spyOn(process, 'type', 'get');

    spy.mockReturnValueOnce('renderer').mockReturnValueOnce('browser');

    expect(relay.isMain).toBeFalsy();
    expect(relay.isMain).toBeTruthy();
  });

  describe('Eventing Methods', () => {
    let spyIsMain: SpyInstance<[], boolean>;

    describe('Main Process', () => {
      beforeEach(() => {
        spyIsMain = vi.spyOn(relay, 'isMain', 'get');
        spyIsMain.mockReturnValue(true);
      });

      it('should listen on ipcMain', () => {
        //prettier-ignore
        relay.listen('msg', () => {/** */});

        expect(ipcMain.on).toHaveBeenCalled();
        expect(ipcMain.once).not.toHaveBeenCalled();
      });

      it('should listen once ipcMain', () => {
        //prettier-ignore
        relay.listen('msg', () => {/** */}, true);

        expect(ipcMain.on).not.toHaveBeenCalled();
        expect(ipcMain.once).toHaveBeenCalled();
      });

      it('should send the relay message to all BrowserWindows', () => {
        relay.send('msg', {});

        expect(BrowserWindow.getAllWindows).toHaveBeenCalled();
        expect(browserWindowInstance.webContents.send).toHaveBeenCalled();
      });

      it('should send the relay message to the rest of the Main Process', () => {
        relay.send('msg', {});

        expect(ipcMain.emit).toHaveBeenCalled();
      });
    });

    describe('Renderer Process', () => {
      beforeEach(() => {
        spyIsMain = vi.spyOn(relay, 'isMain', 'get');
        spyIsMain.mockReturnValue(false);
      });

      it('should listen on ipcRenderer', () => {
        //prettier-ignore
        relay.listen('msg', () => {/** */});

        expect(ipcRenderer.on).toHaveBeenCalled();
        expect(ipcRenderer.once).not.toHaveBeenCalled();
      });

      it('should listen once ipcRenderer', () => {
        //prettier-ignore
        relay.listen('msg', () => {/** */}, true);

        expect(ipcRenderer.on).not.toHaveBeenCalled();
        expect(ipcRenderer.once).toHaveBeenCalled();
      });

      it('should send the relay message to the Main Process', () => {
        relay.send('msg', {});

        expect(ipcRenderer.send).toHaveBeenCalled();
      });
    });

    describe('On/Once Delegates', () => {
      beforeEach(() => {
        vi.spyOn(relay, 'listen').mockImplementation(() => {});
      });

      it('on delegates to "listen"', () => {
        //prettier-ignore
        relay.on('msg', () => {/** */});

        expect(relay.listen).toHaveBeenCalled();
      });

      it('once delegates to "listen"', () => {
        //prettier-ignore
        relay.once('msg', () => {/** */});

        expect(relay.listen).toHaveBeenCalled();
      });
    });
  });
});
