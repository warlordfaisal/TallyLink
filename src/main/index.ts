import { app, BrowserWindow, ipcMain } from "electron";
import { autoUpdater } from "electron-updater";
import { join } from "node:path";

let mainWindow: BrowserWindow | null = null;

function sendUpdateStatus(status: string, detail?: string) {
  mainWindow?.webContents.send("updater:status", { status, detail });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 980,
    minHeight: 680,
    backgroundColor: "#f8fafc",
    title: "TallyLink",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void mainWindow.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

function configureUpdater() {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => sendUpdateStatus("checking"));
  autoUpdater.on("update-available", (info) =>
    sendUpdateStatus("available", info.version),
  );
  autoUpdater.on("update-not-available", () => sendUpdateStatus("current"));
  autoUpdater.on("download-progress", (progress) => {
    sendUpdateStatus("downloading", `${Math.round(progress.percent)}%`);
  });
  autoUpdater.on("update-downloaded", (info) =>
    sendUpdateStatus("downloaded", info.version),
  );
  autoUpdater.on("error", (error) => sendUpdateStatus("error", error.message));

  ipcMain.handle("updater:check", async () => {
    if (!app.isPackaged) return { status: "development" };
    try {
      await autoUpdater.checkForUpdates();
      return { status: "checking" };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      sendUpdateStatus("error", detail);
      return { status: "error", detail };
    }
  });
  ipcMain.handle("updater:install", () => autoUpdater.quitAndInstall());

  if (app.isPackaged) {
    setTimeout(
      () =>
        void autoUpdater.checkForUpdates().catch((error: unknown) => {
          sendUpdateStatus(
            "error",
            error instanceof Error ? error.message : String(error),
          );
        }),
      2500,
    );
  }
}

function decodeXml(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

ipcMain.handle("tally:connect", async (_event, rawPort: unknown) => {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return {
      connected: false,
      error: "Enter a valid port number between 1 and 65535.",
    };
  }

  const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>List of Companies</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="List of Companies" ISMODIFY="No"><TYPE>Company</TYPE><NATIVEMETHOD>Name</NATIVEMETHOD><NATIVEMETHOD>StartingFrom</NATIVEMETHOD><NATIVEMETHOD>BooksFrom</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL>
</DESC></BODY></ENVELOPE>`;

  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: requestXml,
      signal: AbortSignal.timeout(5000),
    });
    const body = await response.text();
    if (!response.ok) {
      return {
        connected: false,
        error: `Tally responded with HTTP ${response.status}.`,
      };
    }
    if (!/<ENVELOPE\b/i.test(body)) {
      return {
        connected: false,
        error:
          "A service answered on this port, but it did not return a Tally XML response.",
      };
    }

    const companies = [
      ...body.matchAll(/<COMPANY\b[^>]*\bNAME\s*=\s*["']([^"']*)["'][^>]*>/gi),
    ]
      .map((match) => decodeXml(match[1]).trim())
      .filter(Boolean);
    return { connected: true, host: "127.0.0.1", port, companies };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const timedOut = message.toLowerCase().includes("timeout");
    return {
      connected: false,
      error: timedOut
        ? `Tally did not respond on port ${port}. Check that its HTTP server is enabled and the port matches.`
        : `Could not reach Tally on port ${port}. Check that Tally is open and its HTTP server is enabled.`,
    };
  }
});

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getXmlTag(source: string, tag: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(
      `<${escapedTag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${escapedTag}>`,
      "i",
    ),
  );
  return match?.[1]?.replace(/<[^>]+>/g, "").trim() ?? "";
}

function getXmlBlocks(source: string, tag: string) {
  const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return [
    ...source.matchAll(
      new RegExp(`<${escapedTag}\\b[^>]*>([\\s\\S]*?)<\\/${escapedTag}>`, "gi"),
    ),
  ].map((match) => match[1]);
}

function decodeXmlText(value: string) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&#(\d+);/g, (_match, code: string) => {
      const point = Number(code);
      return point >= 32 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : "";
    })
    .replace(/&#x([\da-f]+);/gi, (_match, code: string) => {
      const point = Number.parseInt(code, 16);
      return point >= 32 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : "";
    });
}

function parseTallyAmount(value: string) {
  const numeric = Number(
    value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0] ?? 0,
  );
  return Number.isFinite(numeric) ? Math.abs(numeric) : 0;
}

function parseVoucherRows(xml: string, kind: "sales" | "receipts") {
  const voucherBlocks = getXmlBlocks(xml, "VOUCHER");
  const rows: Array<{
    date: string;
    number: string;
    party: string;
    amount: number;
    allocations: Array<{ name: string; type: string; amount: number }>;
  }> = [];

  for (const voucher of voucherBlocks) {
    const type = decodeXmlText(getXmlTag(voucher, "VOUCHERTYPENAME"));
    if (!type) continue;
    const deleted = getXmlTag(voucher, "ISDELETED").toLowerCase() === "yes";
    const cancelled = getXmlTag(voucher, "ISCANCELLED").toLowerCase() === "yes";
    if (deleted || cancelled) continue;

    const party = decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME"));
    const number = decodeXmlText(getXmlTag(voucher, "VOUCHERNUMBER"));
    const rawDate = getXmlTag(voucher, "DATE");
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6)}`
      : rawDate;
    const ledgerEntries = getXmlBlocks(voucher, "ALLLEDGERENTRIES.LIST");
    const allocations: Array<{ name: string; type: string; amount: number }> =
      [];
    let partyAmount = 0;

    for (const ledger of ledgerEntries) {
      const ledgerName = decodeXmlText(getXmlTag(ledger, "LEDGERNAME"));
      const isParty =
        getXmlTag(ledger, "ISPARTYLEDGER").toLowerCase() === "yes" ||
        ledgerName.toLowerCase() === party.toLowerCase();
      if (isParty) partyAmount += parseTallyAmount(getXmlTag(ledger, "AMOUNT"));

      for (const allocation of getXmlBlocks(ledger, "BILLALLOCATIONS.LIST")) {
        const name = decodeXmlText(getXmlTag(allocation, "NAME"));
        const allocationType = decodeXmlText(getXmlTag(allocation, "BILLTYPE"));
        if (name && allocationType) {
          allocations.push({
            name,
            type: allocationType.toLowerCase(),
            amount: parseTallyAmount(getXmlTag(allocation, "AMOUNT")),
          });
        }
      }
    }

    const isSale = /sales|invoice/i.test(type);
    const isReceipt = /receipt/i.test(type);
    if ((kind === "sales" && !isSale) || (kind === "receipts" && !isReceipt))
      continue;
    rows.push({
      date,
      number,
      party,
      amount: partyAmount || parseTallyAmount(getXmlTag(voucher, "AMOUNT")),
      allocations,
    });
  }

  return rows;
}

ipcMain.handle("tally:fetch-sales-report", async (_event, input: unknown) => {
  const request = input as {
    company?: unknown;
    port?: unknown;
    fromDate?: unknown;
    toDate?: unknown;
  };
  const company =
    typeof request?.company === "string" ? request.company.trim() : "";
  const port = Number(request?.port ?? 9000);
  const fromDate =
    typeof request?.fromDate === "string" ? request.fromDate : "";
  const toDate = typeof request?.toDate === "string" ? request.toDate : "";
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { ok: false, error: "The Tally port is invalid." };
  if (!isoDate.test(fromDate) || !isoDate.test(toDate) || fromDate > toDate) {
    return { ok: false, error: "Choose a valid date range." };
  }

  const toTallyDate = (date: string) => date.replace(/-/g, "");
  const buildRequest = (
    collectionName: string,
    voucherType: string,
  ) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${collectionName}</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE TYPE="Date">${toTallyDate(fromDate)}</SVFROMDATE><SVTODATE TYPE="Date">${toTallyDate(toDate)}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="${collectionName}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF>
<NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>MasterID</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD>
</COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

  const requestCollection = async (name: string, voucherType: string) => {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: buildRequest(name, voucherType),
      signal: AbortSignal.timeout(60000),
    });
    const xml = await response.text();
    if (!response.ok)
      throw new Error(`Tally responded with HTTP ${response.status}.`);
    const status = getXmlTag(xml, "STATUS");
    if (status && status !== "1") {
      const detail = decodeXmlText(
        getXmlTag(xml, "LINEERROR") || getXmlTag(xml, "DESC"),
      );
      throw new Error(
        detail ||
          "Tally could not return voucher data for this company and date range.",
      );
    }
    return xml;
  };

  try {
    const salesXml = await requestCollection("TallyLinkSales", "Sales");
    const receiptsXml = await requestCollection("TallyLinkReceipts", "Receipt");
    const sales = parseVoucherRows(salesXml, "sales");
    const receipts = parseVoucherRows(receiptsXml, "receipts");
    const invoices = new Map<
      string,
      Array<{ number: string; amount: number }>
    >();

    for (const sale of sales) {
      const newRefs = sale.allocations.filter(
        (allocation) => allocation.type === "new ref",
      );
      const references = newRefs.length
        ? newRefs.map((allocation) => allocation.name)
        : [sale.number];
      for (const reference of references) {
        const key = `${sale.party.toLocaleLowerCase()}|${reference.toLocaleLowerCase()}`;
        const linked = invoices.get(key) ?? [];
        linked.push({ number: sale.number, amount: sale.amount });
        invoices.set(key, linked);
      }
    }

    const receivedByInvoice = new Map<string, number>();
    for (const receipt of receipts) {
      for (const allocation of receipt.allocations.filter(
        (item) => item.type === "agst ref",
      )) {
        const key = `${receipt.party.toLocaleLowerCase()}|${allocation.name.toLocaleLowerCase()}`;
        const matches = invoices.get(key) ?? [];
        if (matches.length === 1) {
          const invoiceKey = `${key}|${matches[0].number}`;
          receivedByInvoice.set(
            invoiceKey,
            (receivedByInvoice.get(invoiceKey) ?? 0) + allocation.amount,
          );
        }
      }
    }

    const rows = sales
      .map((sale) => {
        const invoiceRef =
          sale.allocations.find((allocation) => allocation.type === "new ref")
            ?.name || sale.number;
        const invoiceKey = `${sale.party.toLocaleLowerCase()}|${invoiceRef.toLocaleLowerCase()}|${sale.number}`;
        const received = receivedByInvoice.get(invoiceKey) ?? 0;
        return { ...sale, received, balance: sale.amount - received };
      })
      .sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.number.localeCompare(a.number),
      );

    return {
      ok: true,
      rows,
      count: rows.length,
      receiptsCount: receipts.length,
      fromDate,
      toDate,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: message };
  }
});

app.whenReady().then(() => {
  createWindow();
  configureUpdater();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
