import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  connectTally: (port: number) => ipcRenderer.invoke("tally:connect", port),
  fetchSalesReport: (input: {
    company: string;
    port: number;
    fromDate: string;
    toDate: string;
  }) => ipcRenderer.invoke("tally:fetch-sales-report", input),
  checkForUpdates: () => ipcRenderer.invoke("updater:check"),
  installUpdate: () => ipcRenderer.invoke("updater:install"),
  onUpdateStatus: (
    callback: (event: { status: string; detail?: string }) => void,
  ) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      payload: { status: string; detail?: string },
    ) => callback(payload);
    ipcRenderer.on("updater:status", listener);
    return () => ipcRenderer.removeListener("updater:status", listener);
  },
});
