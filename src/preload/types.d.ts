export {};

declare global {
  interface Window {
    desktop: {
      connectTally: (
        port: number,
      ) => Promise<{
        connected: boolean;
        host?: string;
        port?: number;
        companies?: string[];
        error?: string;
      }>;
      fetchSalesReport: (input: {
        company: string;
        port: number;
        fromDate: string;
        toDate: string;
      }) => Promise<{
        ok: boolean;
        error?: string;
        count?: number;
        receiptsCount?: number;
        fromDate?: string;
        toDate?: string;
        rows?: Array<{
          date: string;
          number: string;
          party: string;
          amount: number;
          received: number;
          balance: number;
        }>;
      }>;
      checkForUpdates: () => Promise<{ status: string; detail?: string }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (
        callback: (event: { status: string; detail?: string }) => void,
      ) => () => void;
    };
  }
}
