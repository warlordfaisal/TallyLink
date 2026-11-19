import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  connectTally: (port: number) => ipcRenderer.invoke("tally:connect", port),
  fetchSalesReport: (input: {
    company: string;
    port: number;
    fromDate: string;
    toDate: string;
    mode?: "receivables" | "ledger-outstandings" | "party-vouchers" | "party-ledger-movements";
    party?: string;
  }) => ipcRenderer.invoke("tally:fetch-sales-report", input),
  fetchDayBook: (input: {
    company: string;
    port: number;
    fromDate: string;
    toDate: string;
  }) => ipcRenderer.invoke("tally:fetch-day-book", input),
  fetchDashboardSummary: (input: { company: string; port: number; date: string }) =>
    ipcRenderer.invoke("tally:fetch-dashboard-summary", input),
  fetchOrders: (input: {
    company: string;
    port: number;
    party: string;
    kind: "sales" | "purchase";
  }) => ipcRenderer.invoke("tally:fetch-orders", input),
  fetchOrderParties: (input: {
    company: string;
    port: number;
    kind: "sales" | "purchase";
    status: "open" | "closed" | "all";
  }) => ipcRenderer.invoke("tally:fetch-order-parties", input),
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
