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
        mode?: "receivables" | "ledger-outstandings" | "party-vouchers" | "party-ledger-movements";
        party?: string;
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
          voucherType?: string;
          items?: Array<{ name: string; quantity: string }>;
        }>;
      }>;
      fetchDayBook: (input: {
        company: string;
        port: number;
        fromDate: string;
        toDate: string;
      }) => Promise<{
        ok: boolean;
        error?: string;
        sales?: Array<{
          date: string;
          party: string;
          amount: number;
          items: Array<{ name: string; quantity: string }>;
        }>;
        payments?: Array<{ date: string; party: string; amount: number }>;
        salesCount?: number;
        paymentsCount?: number;
      }>;
      fetchDashboardSummary: (input: { company: string; port: number; date: string }) => Promise<{
        ok: boolean;
        error?: string;
        asOf?: string;
        stockItems?: Array<{ name: string; quantity: string }>;
        receivables?: number;
        payables?: number;
        salesEntriesToday?: number;
        purchaseEntriesToday?: number;
        paymentEntriesToday?: number;
      }>;
      fetchOrders: (input: {
        company: string;
        port: number;
        party: string;
        kind: "sales" | "purchase";
      }) => Promise<{
        ok: boolean;
        error?: string;
        rows?: Array<{
          date: string;
          number: string;
          party: string;
          reference: string;
          isPreClosed: boolean;
          items: Array<{ name: string; ordered: string; fulfilled: string; remaining: string }>;
        }>;
      }>;
      fetchOrderParties: (input: {
        company: string;
        port: number;
        kind: "sales" | "purchase";
        status: "open" | "closed" | "all";
      }) => Promise<{ ok: boolean; error?: string; parties?: string[] }>;
      checkForUpdates: () => Promise<{ status: string; detail?: string }>;
      installUpdate: () => Promise<void>;
      onUpdateStatus: (
        callback: (event: { status: string; detail?: string }) => void,
      ) => () => void;
    };
  }
}
