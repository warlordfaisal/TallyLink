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
    title: `TallyLink v${app.getVersion()}`,
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

function parseOutstandingAmount(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const numeric = Number(match[0]);
  if (!Number.isFinite(numeric)) return null;
  // Tally exports party debits (receivables) as negative amounts and credits
  // as positive amounts. Preserve the sign so credits cannot become dues.
  if (/\bcr\b/i.test(value)) return Math.abs(numeric);
  if (/\bdr\b/i.test(value)) return -Math.abs(numeric);
  return numeric;
}

function parseSignedTallyAmount(value: string) {
  const match = value.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  const amount = Number(match[0]);
  return Number.isFinite(amount) ? amount : null;
}

function parseTallyQuantityParts(value: string) {
  const parsePart = (part: string) => {
    const normalized = part.replace(/,/g, "").trim();
    const match = normalized.match(/-?\d+(?:\.\d+)?/);
    if (!match || match.index === undefined) return null;
    const quantity = Number(match[0]);
    return Number.isFinite(quantity)
      ? { quantity, unit: normalized.slice(match.index + match[0].length).trim() }
      : null;
  };
  const [primaryRaw, alternateRaw] = value.split("=", 2);
  const primary = parsePart(primaryRaw);
  if (!primary) return null;
  return { ...primary, alternate: alternateRaw ? parsePart(alternateRaw) : null };
}

function formatTallyQuantityLike(template: string, quantity: number) {
  const parts = parseTallyQuantityParts(template);
  if (!parts) return String(quantity);
  const rounded = (value: number) => String(Math.round(value * 1000) / 1000);
  let result = `${rounded(quantity)}${parts.unit ? ` ${parts.unit}` : ""}`;
  if (parts.alternate && parts.quantity !== 0) {
    result += ` = ${rounded(quantity * parts.alternate.quantity / parts.quantity)}${parts.alternate.unit ? ` ${parts.alternate.unit}` : ""}`;
  }
  return result;
}

function normalizeTallyDate(value: string) {
  const raw = decodeXmlText(value).trim();
  if (/^\d{8}$/.test(raw))
    return `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const namedMonth = raw.match(/^(\d{1,2})[-/ ]([A-Za-z]{3})[-/ ](\d{2,4})$/);
  if (namedMonth) {
    const month = new Date(`${namedMonth[2]} 1, 2000`).getMonth() + 1;
    let year = Number(namedMonth[3]);
    if (year < 100) year += year < 50 ? 2000 : 1900;
    if (month) return `${year}-${String(month).padStart(2, "0")}-${namedMonth[1].padStart(2, "0")}`;
  }
  const numeric = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (numeric) return `${numeric[3]}-${numeric[2].padStart(2, "0")}-${numeric[1].padStart(2, "0")}`;
  return raw;
}

function parseOutstandingBillRows(xml: string, fallbackParty = "", side: "receivable" | "payable" = "receivable") {
  const rows: Array<{ date: string; number: string; voucherNumber?: string; party: string; amount: number; received: number; balance: number }> = [];
  const matches = [...xml.matchAll(/<BILLFIXED\b[^>]*>([\s\S]*?)<\/BILLFIXED>/gi)];
  let incompleteRows = 0;
  for (let index = 0; index < matches.length; index += 1) {
    const fixed = matches[index][1];
    const billRef = decodeXmlText(getXmlTag(fixed, "BILLREF"));
    const party = decodeXmlText(getXmlTag(fixed, "BILLPARTY")) || fallbackParty;
    const start = matches[index].index ?? 0;
    const end = matches[index + 1]?.index ?? xml.length;
    const rowXml = xml.slice(start, end);
    const rawDate = getXmlTag(fixed, "BILLDATE") || getXmlTag(rowXml, "BILLDATE") || getXmlTag(rowXml, "DATE") || getXmlTag(rowXml, "VOUCHERDATE") || getXmlTag(rowXml, "DSPVCHDATE");
    const date = normalizeTallyDate(rawDate);
    const voucherNumber = decodeXmlText(
      getXmlTag(fixed, "VOUCHERNUMBER") || getXmlTag(rowXml, "VOUCHERNUMBER") || getXmlTag(rowXml, "DSPVOUCHERNUMBER") || getXmlTag(rowXml, "DSPVCHNO"),
    );
    const pending = getXmlTag(rowXml, "BILLFINAL") || getXmlTag(rowXml, "BILLCL");
    const signedBalance = parseOutstandingAmount(pending);
    if (!party || signedBalance === null) {
      incompleteRows += 1;
      continue;
    }
    // Tally exports debit balances as negative and credit balances as positive.
    // Keep the requested side so credits cannot be shown as receivables.
    if (side === "receivable" ? signedBalance >= -0.005 : signedBalance <= 0.005) continue;
    const balance = Math.abs(signedBalance);
    rows.push({ date, number: billRef || voucherNumber || "On Account", voucherNumber, party, amount: balance, received: 0, balance });
  }
  return { rows, sourceRows: matches.length, incompleteRows };
}

function parseVoucherRows(xml: string, kind: "sales" | "receipts" | "payments" | "purchases" | "all", fallbackParty = "") {
  const voucherBlocks = getXmlBlocks(xml, "VOUCHER");
  const rows: Array<{
    date: string;
    number: string;
    party: string;
    voucherType: string;
    amount: number;
    items: Array<{ name: string; quantity: string }>;
    allocations: Array<{ name: string; type: string; amount: number }>;
  }> = [];

  for (const voucher of voucherBlocks) {
    const type = decodeXmlText(getXmlTag(voucher, "VOUCHERTYPENAME"));
    if (!type) continue;
    const deleted = getXmlTag(voucher, "ISDELETED").toLowerCase() === "yes";
    const cancelled = getXmlTag(voucher, "ISCANCELLED").toLowerCase() === "yes";
    if (deleted || cancelled) continue;

    const declaredParty = decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME"));
    const number = decodeXmlText(getXmlTag(voucher, "VOUCHERNUMBER"));
    const rawDate = getXmlTag(voucher, "DATE");
    const date = /^\d{8}$/.test(rawDate)
      ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6)}`
      : rawDate;
    const ledgerEntries = getXmlBlocks(voucher, "ALLLEDGERENTRIES.LIST");
    const legacyLedgerEntries = getXmlBlocks(voucher, "LEDGERENTRIES.LIST");
    const effectiveLedgerEntries = ledgerEntries.length ? ledgerEntries : legacyLedgerEntries;
    const partyLedger = effectiveLedgerEntries.find(
      (ledger) => getXmlTag(ledger, "ISPARTYLEDGER").toLowerCase() === "yes",
    );
    const party = declaredParty || decodeXmlText(getXmlTag(partyLedger ?? "", "LEDGERNAME")) || fallbackParty;
    const inventoryEntries = getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST");
    const legacyInventoryEntries = getXmlBlocks(
      voucher,
      "INVENTORYENTRIES.LIST",
    );
    const ledgerInventoryEntries = effectiveLedgerEntries.flatMap((ledger) =>
      getXmlBlocks(ledger, "INVENTORYALLOCATIONS.LIST"),
    );
    const itemEntries = inventoryEntries.length
      ? inventoryEntries
      : legacyInventoryEntries.length
        ? legacyInventoryEntries
        : ledgerInventoryEntries;
    const items = itemEntries
      .map((entry) => ({
        name: decodeXmlText(
          getXmlTag(entry, "STOCKITEMNAME") || getXmlTag(entry, "ITEMNAME"),
        ),
        quantity: decodeXmlText(
          getXmlTag(entry, "BILLEDQTY") || getXmlTag(entry, "ACTUALQTY"),
        ),
      }))
      .filter((item) => item.name || item.quantity);
    const allocations: Array<{ name: string; type: string; amount: number }> =
      [];
    let partyAmount = 0;

    for (const ledger of effectiveLedgerEntries) {
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
    const isPurchase = /purchase/i.test(type);
    const isReceipt = /receipt/i.test(type);
    const isPayment = /payment/i.test(type) && !isReceipt;
    if (
      (kind === "sales" && !isSale) ||
      (kind === "purchases" && !isPurchase) ||
      (kind === "receipts" && !isReceipt) ||
      (kind === "payments" && !isPayment)
    )
      continue;
    rows.push({
      date,
      number,
      party,
      voucherType: type,
      amount: partyAmount || parseTallyAmount(getXmlTag(voucher, "AMOUNT")),
      items,
      allocations,
    });
  }

  return rows;
}

function parsePartyLedgerMovements(xml: string, requestedParty: string) {
  const rows: Array<{
    date: string;
    number: string;
    party: string;
    voucherType: string;
    amount: number;
    received: number;
    balance: number;
    items: Array<{ name: string; quantity: string }>;
  }> = [];
  let incompleteRows = 0;
  const vouchers = getXmlBlocks(xml, "VOUCHER");
  for (const voucher of vouchers) {
    if (getXmlTag(voucher, "ISDELETED").toLowerCase() === "yes" || getXmlTag(voucher, "ISCANCELLED").toLowerCase() === "yes") continue;
    const voucherType = decodeXmlText(getXmlTag(voucher, "VOUCHERTYPENAME"));
    const declaredParty = decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME"));
    const ledgers = getXmlBlocks(voucher, "ALLLEDGERENTRIES.LIST");
    const effectiveLedgers = ledgers.length ? ledgers : getXmlBlocks(voucher, "LEDGERENTRIES.LIST");
    const partyEntries = effectiveLedgers.filter((ledger) => {
      const ledgerName = decodeXmlText(getXmlTag(ledger, "LEDGERNAME"));
      return ledgerName.toLocaleLowerCase() === requestedParty.toLocaleLowerCase() ||
        // The collection is filtered to this party. Tally may omit its
        // PARTYLEDGERNAME field on vouchers, while still marking the matching
        // ledger entry as the party ledger.
        getXmlTag(ledger, "ISPARTYLEDGER").toLowerCase() === "yes";
    });
    if (!partyEntries.length) {
      // Tally can return extra vouchers for some custom voucher types even
      // when the party-name filter is present. They are not this ledger's
      // movement, so ignore them rather than failing the selected party.
      if (declaredParty.toLocaleLowerCase() === requestedParty.toLocaleLowerCase()) incompleteRows += 1;
      continue;
    }
    const debitCredit = partyEntries.map((ledger) => ({
      amount: parseSignedTallyAmount(getXmlTag(ledger, "AMOUNT")),
      isDebit: getXmlTag(ledger, "ISDEEMEDPOSITIVE").toLowerCase() === "yes",
      polarity: getXmlTag(ledger, "ISDEEMEDPOSITIVE").toLowerCase(),
    }));
    if (debitCredit.some((entry) => entry.amount === null)) { incompleteRows += 1; continue; }
    // IsDeemedPositive is Tally's preferred debit/credit indicator. Some
    // voucher XML omits it, in which case the party ledger AMOUNT remains
    // signed (negative = debit, positive = credit).
    const isDebitEntry = (entry: (typeof debitCredit)[number]) =>
      entry.polarity === "yes" ? true : entry.polarity === "no" ? false : entry.amount! < 0;
    const debit = debitCredit.reduce((sum, entry) => sum + (isDebitEntry(entry) ? Math.abs(entry.amount!) : 0), 0);
    const credit = debitCredit.reduce((sum, entry) => sum + (!isDebitEntry(entry) ? Math.abs(entry.amount!) : 0), 0);
    const voucherValue = debitCredit.reduce((sum, entry) => sum + Math.abs(entry.amount!), 0);
    const salesVoucher = /sales|debit\s*note|payment/i.test(voucherType);
    const receivedVoucher = /receipt|credit\s*note/i.test(voucherType);
    const hasOnAccountAllocation = partyEntries.some((ledger) =>
      getXmlBlocks(ledger, "BILLALLOCATIONS.LIST").some((allocation) =>
        /on\s*account/i.test(decodeXmlText(getXmlTag(allocation, "BILLTYPE"))),
      ),
    );
    // Keep the two dashboard columns tied to transaction meaning, not only
    // the party-ledger polarity. Unallocated/on-account receipts are still
    // receipts and must never inflate the sales column.
    const salesAmount = salesVoucher
      ? (/payment/i.test(voucherType) ? voucherValue : debit)
      : 0;
    const receivedAmount = receivedVoucher || hasOnAccountAllocation ? voucherValue : 0;
    const items = [...getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST"), ...getXmlBlocks(voucher, "INVENTORYENTRIES.LIST")]
      .map((entry) => ({
        name: decodeXmlText(getXmlTag(entry, "STOCKITEMNAME") || getXmlTag(entry, "ITEMNAME")),
        quantity: decodeXmlText(getXmlTag(entry, "BILLEDQTY") || getXmlTag(entry, "ACTUALQTY")),
      })).filter((item) => item.name || item.quantity);
    const date = normalizeTallyDate(getXmlTag(voucher, "DATE"));
    rows.push({
      date,
      number: decodeXmlText(getXmlTag(voucher, "VOUCHERNUMBER")),
      party: declaredParty || requestedParty,
      voucherType,
      amount: salesAmount,
      received: receivedAmount,
      balance: salesAmount - receivedAmount,
      items,
    });
  }
  return { rows, sourceRows: vouchers.length, incompleteRows };
}

ipcMain.handle("tally:fetch-sales-report", async (_event, input: unknown) => {
  const request = input as {
    company?: unknown;
    port?: unknown;
    fromDate?: unknown;
    toDate?: unknown;
    mode?: unknown;
    party?: unknown;
  };
  const company =
    typeof request?.company === "string" ? request.company.trim() : "";
  const port = Number(request?.port ?? 9000);
  const fromDate =
    typeof request?.fromDate === "string" ? request.fromDate : "";
  const toDate = typeof request?.toDate === "string" ? request.toDate : "";
  let mode = request?.mode === "party-vouchers" || request?.mode === "party-ledger-movements" || request?.mode === "ledger-outstandings"
    ? request.mode
    : "receivables";
  // Keep older renderers compatible, but route the toggle through the
  // invoice-centered Sales + allocated Receipts report.
  if (mode === "party-ledger-movements") mode = "party-vouchers";
  const party = typeof request?.party === "string" ? request.party.trim() : "";
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { ok: false, error: "The Tally port is invalid." };
  if (!isoDate.test(fromDate) || !isoDate.test(toDate) || fromDate > toDate) {
    return { ok: false, error: "Choose a valid date range." };
  }

  const toTallyDate = (date: string) => date.replace(/-/g, "");
  const asOfDate = (() => {
    const now = new Date();
    return `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  })();
  const requestTally = async (body: string) => {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body,
      signal: AbortSignal.timeout(60000),
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Tally responded with HTTP ${response.status}.`);
    const status = getXmlTag(xml, "STATUS");
    const lineError = decodeXmlText(getXmlTag(xml, "LINEERROR"));
    if ((status && status !== "1") || lineError) {
      throw new Error(lineError || "Tally could not return report data.");
    }
    return xml;
  };
  if (mode === "ledger-outstandings") {
    if (!party) return { ok: false, error: "Choose a party before loading its outstanding details." };
    try {
      const xml = await requestTally(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Ledger Outstandings</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVFROMDATE TYPE="Date">19000101</SVFROMDATE><SVTODATE TYPE="Date">${asOfDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY><LedgerName TYPE="String">${escapeXml(party)}</LedgerName></STATICVARIABLES></DESC></BODY></ENVELOPE>`);
      const parsed = parseOutstandingBillRows(xml, party);
      if (parsed.incompleteRows > 0) {
        throw new Error(`Tally returned ${parsed.incompleteRows} outstanding row(s) without a readable pending amount. No partial ledger was shown.`);
      }
      let sales: ReturnType<typeof parseVoucherRows> = [];
      if (parsed.rows.length > 0) {
        const datedRows = parsed.rows.map((row) => row.date).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
        const detailFrom = datedRows.length ? datedRows.sort()[0].replace(/-/g, "") : "19000101";
        const detailsCollection = "TallyLinkOutstandingSalesDetails";
        const detailsXml = await requestTally(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${detailsCollection}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVViewName>Invoice Voucher View</SVViewName><SVFROMDATE TYPE="Date">${detailFrom}</SVFROMDATE><SVTODATE TYPE="Date">${asOfDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${detailsCollection}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchTypeSales</CHILDOF><FILTERS>PartyFilter</FILTERS><NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION><SYSTEM TYPE="Formulae" NAME="PartyFilter">$PartyLedgerName = "${escapeXml(party)}"</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`);
        sales = parseVoucherRows(detailsXml, "sales");
        if (sales.some((sale) => sale.party.toLocaleLowerCase() !== party.toLocaleLowerCase())) {
          throw new Error("Tally returned invoice details outside the selected party. The ledger was stopped to avoid mixing data.");
        }
      }
      const rows = parsed.rows.map((row) => {
        const normalizeReference = (value: string) => decodeXmlText(value)
          .trim()
          .toLocaleLowerCase()
          .replace(/\s+/g, " ");
        const referenceKeys = new Set(
          [row.number, row.voucherNumber].filter(Boolean).map((value) => normalizeReference(value!)),
        );
        const matchingSales = sales.filter((sale) =>
          referenceKeys.has(normalizeReference(sale.number)) ||
          sale.allocations.some((allocation) => allocation.type.trim().toLocaleLowerCase() === "new ref" && referenceKeys.has(normalizeReference(allocation.name))),
        );
        const datedMatch = matchingSales.filter((sale) => sale.date === row.date);
        const singleSameDaySale = row.number.toLocaleLowerCase() !== "on account"
          ? sales.filter((sale) => sale.date === row.date)
          : [];
        const sale = datedMatch.length === 1
          ? datedMatch[0]
          : matchingSales.length === 1
            ? matchingSales[0]
            : matchingSales.length === 0 && singleSameDaySale.length === 1
              ? singleSameDaySale[0]
              : undefined;
        return { ...row, date: row.date || sale?.date || "", items: sale?.items ?? [] };
      }).sort((a, b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
      return { ok: true, rows, count: rows.length, fromDate, toDate, mode };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (mode === "receivables") {
    try {
      const xml = await requestTally(`<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>Bills Receivable</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVTODATE TYPE="Date">${asOfDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC></BODY></ENVELOPE>`);
      const parsed = parseOutstandingBillRows(xml);
      if (parsed.incompleteRows > 0) {
        throw new Error(`Tally returned ${parsed.incompleteRows} receivable row(s) without a party or pending amount. No partial report was shown.`);
      }
      const sortedRows = parsed.rows.sort((a,b) => b.date.localeCompare(a.date) || a.number.localeCompare(b.number));
      return { ok: true, rows: sortedRows, count: sortedRows.length, fromDate, toDate, mode };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (mode === "party-ledger-movements") {
    if (!party) return { ok: false, error: "Choose a party before loading its ledger movements." };
    try {
      const voucherTypes = [
        { name: "Sales", child: "Sales", side: "sales", match: /sales|invoice/i },
        { name: "Debit Note", child: "DebitNote", side: "sales", match: /debit\s*note/i },
        { name: "Payment", child: "Payment", side: "sales", match: /payment/i },
        { name: "Receipt", child: "Receipt", side: "received", match: /receipt/i },
        { name: "Credit Note", child: "CreditNote", side: "received", match: /credit\s*note/i },
      ] as const;
      const fetchType = async (entry: (typeof voucherTypes)[number]) => {
        const collection = `TallyLinkPartyMovements${entry.child}`;
        const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${collection}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${entry.name === "Sales" || entry.name === "Debit Note" ? "<SVViewName>Invoice Voucher View</SVViewName>" : ""}<SVFROMDATE TYPE="Date">${toTallyDate(fromDate)}</SVFROMDATE><SVTODATE TYPE="Date">${toTallyDate(toDate)}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${collection}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><FILTERS>PartyMovementFilter</FILTERS><NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION><SYSTEM TYPE="Formulae" NAME="PartyMovementFilter">$PartyLedgerName = "${escapeXml(party)}" AND $VoucherTypeName = "${escapeXml(entry.name)}"</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
        const xml = await requestTally(requestXml);
        return parseVoucherRows(xml, "all", party)
          .filter((row) => row.party.trim().toLocaleLowerCase() === party.toLocaleLowerCase() && entry.match.test(row.voucherType));
      };
      // Keep the requested party on demand; each type collection is restricted
      // by both voucher type and party before it leaves Tally.
      const sales = await fetchType(voucherTypes[0]);
      const debitNotes = await fetchType(voucherTypes[1]);
      const payments = await fetchType(voucherTypes[2]);
      const receipts = await fetchType(voucherTypes[3]);
      const creditNotes = await fetchType(voucherTypes[4]);
      type MovementRow = {
        date: string; number: string; party: string; voucherType: string;
        amount: number; received: number; balance: number;
        items: Array<{ name: string; quantity: string }>;
      };
      const rows: MovementRow[] = sales.map((sale) => ({
        date: sale.date, number: sale.number, party: sale.party, voucherType: sale.voucherType,
        amount: sale.amount, received: 0, balance: sale.amount, items: sale.items,
      }));
      const normalizeBillReference = (value: string) => decodeXmlText(value)
        .trim()
        .toLocaleLowerCase()
        .replace(/\s+/g, " ");
      const invoiceRefs = new Map<string, number[]>();
      rows.forEach((row, index) => {
        const sale = sales[index];
        // Different Tally entry modes may store the bill reference separately
        // from the voucher number. Index both so a receipt against either one
        // lands on this invoice instead of being mislabeled On Account.
        const refs = [
          ...sale.allocations.filter((allocation) => allocation.type.trim().toLocaleLowerCase() === "new ref").map((allocation) => allocation.name),
          sale.number,
        ].filter(Boolean);
        for (const ref of refs) {
          const key = `${normalizeBillReference(sale.party)}|${normalizeBillReference(ref)}`;
          const current = invoiceRefs.get(key) ?? [];
          if (!current.includes(index)) invoiceRefs.set(key, [...current, index]);
        }
      });
      const applyReceivedVouchers = (vouchers: typeof receipts) => {
        for (const voucher of vouchers) {
          let matchedAmount = 0;
          for (const allocation of voucher.allocations.filter((item) => {
            const type = item.type.trim().toLocaleLowerCase().replace(/\s+/g, " ");
            return type === "agst ref" || type === "against ref" || type === "against reference";
          })) {
            const key = `${normalizeBillReference(voucher.party)}|${normalizeBillReference(allocation.name)}`;
            const matches = invoiceRefs.get(key) ?? [];
            if (matches.length !== 1) continue;
            const invoice = rows[matches[0]];
            const receiptAmount = allocation.amount > 0 ? allocation.amount : voucher.amount;
            invoice.received += receiptAmount;
            invoice.balance = invoice.amount - invoice.received;
            matchedAmount += receiptAmount;
          }
          // Fully allocated receipts/credit notes live on their invoice rows.
          // Only the genuinely unallocated remainder gets an On Account row.
          const unallocated = Math.max(0, voucher.amount - matchedAmount);
          if (unallocated > 0.005) rows.push({
            date: voucher.date,
            number: "On Account",
            party: voucher.party,
            voucherType: `${voucher.voucherType}${voucher.number ? ` · ${voucher.number}` : ""}`,
            amount: 0,
            received: unallocated,
            balance: -unallocated,
            items: [],
          });
        }
      };
      applyReceivedVouchers(receipts);
      applyReceivedVouchers(creditNotes);
      for (const adjustment of [...debitNotes, ...payments]) rows.push({
        date: adjustment.date, number: adjustment.number, party: adjustment.party,
        voucherType: adjustment.voucherType, amount: adjustment.amount, received: 0,
        balance: adjustment.amount, items: adjustment.items,
      });
      rows.sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
      return { ok: true, rows, count: rows.length, fromDate, toDate, mode };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  }
  if (!party) return { ok: false, error: "Choose a party to load its sales and payment vouchers." };
  const voucherView = (voucherType: string) =>
    voucherType === "Sales"
      ? "<SVViewName>Invoice Voucher View</SVViewName>"
      : "";
  const buildRequest = (
    collectionName: string,
    voucherType: string,
  ) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${collectionName}</ID></HEADER>
<BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${voucherView(voucherType)}<SVFROMDATE TYPE="Date">${toTallyDate(fromDate)}</SVFROMDATE><SVTODATE TYPE="Date">${toTallyDate(toDate)}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES>
<TDL><TDLMESSAGE><COLLECTION NAME="${collectionName}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF><FILTERS>PartyFilter</FILTERS>
<NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>MasterID</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD>
</COLLECTION><SYSTEM TYPE="Formulae" NAME="PartyFilter">$PartyLedgerName = "${escapeXml(party)}"</SYSTEM></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

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
    const requestedParty = party.toLocaleLowerCase();
    if (sales.some((row) => row.party.toLocaleLowerCase() !== requestedParty) || receipts.some((row) => row.party.toLocaleLowerCase() !== requestedParty)) {
      throw new Error("Tally returned vouchers outside the selected party filter. The report was stopped to avoid loading unrelated company data.");
    }
    const invoices = new Map<
      string,
      Array<{ number: string; amount: number }>
    >();

    for (const sale of sales) {
      const references = [
        ...sale.allocations
          .filter((allocation) => allocation.type.trim().toLocaleLowerCase() === "new ref")
          .map((allocation) => allocation.name),
        sale.number,
      ].filter(Boolean);
      for (const reference of references) {
        const key = `${sale.party.trim().toLocaleLowerCase()}|${reference.trim().toLocaleLowerCase().replace(/\s+/g, " ")}`;
        const linked = invoices.get(key) ?? [];
        if (!linked.some((invoice) => invoice.number === sale.number))
          linked.push({ number: sale.number, amount: sale.amount });
        invoices.set(key, linked);
      }
    }

    const receivedByInvoice = new Map<string, number>();
    for (const receipt of receipts) {
      for (const allocation of receipt.allocations.filter((item) => {
        const type = item.type.trim().toLocaleLowerCase().replace(/\s+/g, " ");
        return type === "agst ref" || type === "against ref" || type === "against reference";
      })) {
        const key = `${receipt.party.trim().toLocaleLowerCase()}|${allocation.name.trim().toLocaleLowerCase().replace(/\s+/g, " ")}`;
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

ipcMain.handle("tally:fetch-day-book", async (_event, input: unknown) => {
  const request = input as {
    company?: unknown;
    port?: unknown;
    fromDate?: unknown;
    toDate?: unknown;
  };
  const company = typeof request?.company === "string" ? request.company.trim() : "";
  const port = Number(request?.port ?? 9000);
  const fromDate = typeof request?.fromDate === "string" ? request.fromDate : "";
  const toDate = typeof request?.toDate === "string" ? request.toDate : "";
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { ok: false, error: "The Tally port is invalid." };
  if (!isoDate.test(fromDate) || !isoDate.test(toDate) || fromDate > toDate)
    return { ok: false, error: "Choose a valid date range." };

  const buildRequest = (name: string, voucherType: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${voucherType === "Sales" ? "<SVViewName>Invoice Voucher View</SVViewName>" : ""}<SVFROMDATE TYPE="Date">${fromDate.replace(/-/g, "")}</SVFROMDATE><SVTODATE TYPE="Date">${toDate.replace(/-/g, "")}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF><NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  const fetchCollection = async (name: string, voucherType: string) => {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: buildRequest(name, voucherType),
      signal: AbortSignal.timeout(60000),
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Tally responded with HTTP ${response.status}.`);
    const status = getXmlTag(xml, "STATUS");
    const lineError = decodeXmlText(getXmlTag(xml, "LINEERROR"));
    if ((status && status !== "1") || lineError)
      throw new Error(lineError || "Tally could not return Day Book data.");
    return xml;
  };

  try {
    const salesXml = await fetchCollection("TallyLinkDayBookSales", "Sales");
    const paymentsXml = await fetchCollection("TallyLinkDayBookPayments", "Payment");
    const sales = parseVoucherRows(salesXml, "sales").map((row) => ({
      date: row.date,
      party: row.party,
      amount: row.amount,
      items: row.items,
    }));
    const payments = parseVoucherRows(paymentsXml, "payments").map((row) => ({
      date: row.date,
      party: row.party,
      amount: row.amount,
    }));
    sales.sort((a, b) => b.date.localeCompare(a.date));
    payments.sort((a, b) => b.date.localeCompare(a.date));
    return { ok: true, sales, payments, salesCount: sales.length, paymentsCount: payments.length };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("tally:fetch-dashboard-summary", async (_event, input: unknown) => {
  const request = input as { company?: unknown; port?: unknown; date?: unknown };
  const company = typeof request?.company === "string" ? request.company.trim() : "";
  const port = Number(request?.port ?? 9000);
  const date = typeof request?.date === "string" ? request.date : "";
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "The Tally port is invalid." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { ok: false, error: "The dashboard date is invalid." };
  const tallyDate = date.replace(/-/g, "");
  const fetchXml = async (body: string) => {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" }, body,
      signal: AbortSignal.timeout(60000),
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Tally responded with HTTP ${response.status}.`);
    const status = getXmlTag(xml, "STATUS");
    const lineError = decodeXmlText(getXmlTag(xml, "LINEERROR"));
    if ((status && status !== "1") || lineError) throw new Error(lineError || "Tally could not return dashboard totals.");
    return xml;
  };
  const outstandingRequest = (report: "Bills Receivable" | "Bills Payable") => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Data</TYPE><ID>${report}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVTODATE TYPE="Date">${tallyDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES></DESC></BODY></ENVELOPE>`;
  const voucherRequest = (name: string, voucherType: string) => `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${name}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${voucherType === "Sales" ? "<SVViewName>Invoice Voucher View</SVViewName>" : ""}<SVFROMDATE TYPE="Date">${tallyDate}</SVFROMDATE><SVTODATE TYPE="Date">${tallyDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${name}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF><NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>AllLedgerEntries</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  const stockRequest = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>TallyLinkStockQuantitySummary</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVTODATE TYPE="Date">${tallyDate}</SVTODATE><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="TallyLinkStockQuantitySummary" ISMODIFY="No"><TYPE>StockItem</TYPE><FETCH>Name, ClosingBalance</FETCH><COMPUTE>DashboardClosingQty:$_ClosingBalance</COMPUTE></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  try {
    const [receivableXml, payableXml] = await Promise.all([
      fetchXml(outstandingRequest("Bills Receivable")),
      fetchXml(outstandingRequest("Bills Payable")),
    ]);
    const receivableRows = parseOutstandingBillRows(receivableXml, "", "receivable");
    const payableRows = parseOutstandingBillRows(payableXml, "", "payable");
    if (receivableRows.incompleteRows || payableRows.incompleteRows) {
      throw new Error("Tally returned outstanding entries without readable balances. No partial dashboard totals were shown.");
    }

    const stockXml = await fetchXml(stockRequest);
    const stockItemBlocks = getXmlBlocks(stockXml, "STOCKITEM");
    const stockItems = stockItemBlocks.map((item) => {
      const name = decodeXmlText(getXmlTag(item, "NAME") || item.match(/\bNAME\s*=\s*["']([^"']*)["']/i)?.[1] || "").trim();
      const quantity = decodeXmlText(getXmlTag(item, "DASHBOARDCLOSINGQTY") || getXmlTag(item, "CLOSINGBALANCE") || getXmlTag(item, "DSPCLQTY")).trim();
      return { name, quantity: quantity || "", numericQuantity: parseSignedTallyAmount(quantity) };
    }).filter((item) => item.name && (item.numericQuantity === null || Math.abs(item.numericQuantity) > 0.000001))
      .map(({ name, quantity }) => ({ name, quantity }));

    const salesXml = await fetchXml(voucherRequest("TallyLinkTodaySales", "Sales"));
    const purchasesXml = await fetchXml(voucherRequest("TallyLinkTodayPurchases", "Purchase"));
    const paymentsXml = await fetchXml(voucherRequest("TallyLinkTodayPayments", "Payment"));
    const sales = parseVoucherRows(salesXml, "sales");
    const purchases = parseVoucherRows(purchasesXml, "purchases");
    const payments = parseVoucherRows(paymentsXml, "payments");
    return {
      ok: true,
      asOf: date,
      stockItems,
      receivables: receivableRows.rows.reduce((sum, row) => sum + row.balance, 0),
      payables: payableRows.rows.reduce((sum, row) => sum + row.balance, 0),
      salesEntriesToday: sales.reduce((sum, row) => sum + row.amount, 0),
      purchaseEntriesToday: purchases.reduce((sum, row) => sum + row.amount, 0),
      paymentEntriesToday: payments.reduce((sum, row) => sum + row.amount, 0),
    };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("tally:fetch-order-parties", async (_event, input: unknown) => {
  const request = input as { company?: unknown; port?: unknown; kind?: unknown; status?: unknown };
  const company = typeof request?.company === "string" ? request.company.trim() : "";
  const port = Number(request?.port ?? 9000);
  const kind = request?.kind === "purchase" ? "purchase" : "sales";
  const filterStatus = request?.status === "closed" || request?.status === "all" ? request.status : "open";
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535) return { ok: false, error: "The Tally port is invalid." };
  const typeName = kind === "sales" ? "Sales Order" : "Purchase Order";
  const voucherType = kind === "sales" ? "SalesOrder" : "PurcOrder";
  const collection = kind === "sales" ? "TallyLinkSalesOrderPartyChoices" : "TallyLinkPurchaseOrderPartyChoices";
  const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${collection}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${collection}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>IsPreClosed</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, { method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" }, body: requestXml, signal: AbortSignal.timeout(60000) });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Tally responded with HTTP ${response.status}.`);
    const lineError = decodeXmlText(getXmlTag(xml, "LINEERROR"));
    const tallyStatus = getXmlTag(xml, "STATUS");
    if ((tallyStatus && tallyStatus !== "1") || lineError) throw new Error(lineError || "Tally could not return order parties.");
    const parties = new Set<string>();
    for (const voucher of getXmlBlocks(xml, "VOUCHER")) {
      if (decodeXmlText(getXmlTag(voucher, "VOUCHERTYPENAME")).trim().toLocaleLowerCase() !== typeName.toLocaleLowerCase()) continue;
      const party = decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME")).trim();
      if (!party) continue;
      const preClosed = getXmlTag(voucher, "ISPRECLOSED").toLowerCase() === "yes";
      const entries = [...getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST"), ...getXmlBlocks(voucher, "INVENTORYENTRIES.LIST")];
      const remaining = entries.map((entry) => {
        const raw = getXmlTag(entry, "PENDINGQTY") || getXmlTag(entry, "BALANCEQTY");
        const value = Number(raw.replace(/,/g, "").match(/-?\d+(?:\.\d+)?/)?.[0]);
        return Number.isFinite(value) ? value : null;
      });
      const open = !preClosed && remaining.some((quantity) => quantity !== null && quantity > 0);
      const closed = preClosed || (remaining.length > 0 && remaining.every((quantity) => quantity === 0));
      if (filterStatus === "all" || (filterStatus === "open" && open) || (filterStatus === "closed" && closed)) parties.add(party);
    }
    return { ok: true, parties: [...parties].sort((a, b) => a.localeCompare(b)) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
});

ipcMain.handle("tally:fetch-orders", async (_event, input: unknown) => {
  const request = input as { company?: unknown; port?: unknown; party?: unknown; kind?: unknown };
  const company = typeof request?.company === "string" ? request.company.trim() : "";
  const party = typeof request?.party === "string" ? request.party.trim() : "";
  const port = Number(request?.port ?? 9000);
  const kind = request?.kind === "purchase" ? "purchase" : "sales";
  if (!company) return { ok: false, error: "Choose a Tally company first." };
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    return { ok: false, error: "The Tally port is invalid." };

  const typeName = kind === "sales" ? "Sales Order" : "Purchase Order";
  const voucherType = kind === "sales" ? "SalesOrder" : "PurcOrder";
  const collection = kind === "sales" ? "TallyLinkPartySalesOrders" : "TallyLinkPartyPurchaseOrders";
  const requestXml = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${collection}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT><SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${collection}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${voucherType}</CHILDOF><NATIVEMETHOD>Date</NATIVEMETHOD><NATIVEMETHOD>MasterID</NATIVEMETHOD><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>VoucherNumber</NATIVEMETHOD><NATIVEMETHOD>Reference</NATIVEMETHOD><NATIVEMETHOD>PartyLedgerName</NATIVEMETHOD><NATIVEMETHOD>IsPreClosed</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" },
      body: requestXml, signal: AbortSignal.timeout(60000),
    });
    const xml = await response.text();
    if (!response.ok) throw new Error(`Tally responded with HTTP ${response.status}.`);
    const status = getXmlTag(xml, "STATUS");
    const lineError = decodeXmlText(getXmlTag(xml, "LINEERROR"));
    if ((status && status !== "1") || lineError) throw new Error(lineError || "Tally could not return order data.");
    const orderVouchers = getXmlBlocks(xml, "VOUCHER").filter((voucher) =>
      decodeXmlText(getXmlTag(voucher, "VOUCHERTYPENAME")).trim().toLocaleLowerCase() === typeName.toLocaleLowerCase()
      && (!party || decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME")).trim().toLocaleLowerCase() === party.toLocaleLowerCase())
    );
    const orderIds = new Set(orderVouchers.flatMap((voucher) =>
      [...getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST"), ...getXmlBlocks(voucher, "INVENTORYENTRIES.LIST")]
        .map((entry) => getXmlTag(entry, "ORDERID").trim()),
    ).filter(Boolean));
    const orderDates = orderVouchers.map((voucher) => normalizeTallyDate(getXmlTag(voucher, "DATE"))).filter(Boolean).sort();
    const fulfillmentVoucherTypes = kind === "sales"
      ? [{ name: "Sales", formula: "Sales" }, { name: "DeliveryNote", formula: "DeliveryNote" }]
      : [{ name: "Purchase", formula: "Purchase" }, { name: "ReceiptNote", formula: "ReceiptNote" }];
    const fulfilledByOrderItem = new Map<string, number>();
    if (orderIds.size) {
      const fulfillmentResponses = await Promise.all(fulfillmentVoucherTypes.map(async ({ name, formula }) => {
        const fulfillmentCollection = `${collection}${name}`;
        const fulfillmentRequest = `<?xml version="1.0" encoding="UTF-8"?>
<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${fulfillmentCollection}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${orderDates.length ? `<SVFROMDATE TYPE="Date">${orderDates[0].replace(/-/g, "")}</SVFROMDATE>` : ""}<SVCURRENTCOMPANY TYPE="String">${escapeXml(company)}</SVCURRENTCOMPANY></STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${fulfillmentCollection}" ISMODIFY="No"><TYPE>Vouchers : VoucherType</TYPE><CHILDOF>$$VchType${formula}</CHILDOF><NATIVEMETHOD>VoucherTypeName</NATIVEMETHOD><NATIVEMETHOD>AllInventoryEntries</NATIVEMETHOD></COLLECTION></TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;
        const fulfillmentResponse = await fetch(`http://127.0.0.1:${port}`, {
          method: "POST", headers: { "Content-Type": "text/xml; charset=utf-8" },
          body: fulfillmentRequest, signal: AbortSignal.timeout(60000),
        });
        const fulfillmentXml = await fulfillmentResponse.text();
        if (!fulfillmentResponse.ok) throw new Error(`Tally responded with HTTP ${fulfillmentResponse.status}.`);
        const fulfillmentStatus = getXmlTag(fulfillmentXml, "STATUS");
        const fulfillmentError = decodeXmlText(getXmlTag(fulfillmentXml, "LINEERROR"));
        if ((fulfillmentStatus && fulfillmentStatus !== "1") || fulfillmentError) throw new Error(fulfillmentError || "Tally could not return linked order quantities.");
        return fulfillmentXml;
      }));
      for (const fulfillmentXml of fulfillmentResponses) {
        for (const voucher of getXmlBlocks(fulfillmentXml, "VOUCHER")) {
          for (const entry of [...getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST"), ...getXmlBlocks(voucher, "INVENTORYENTRIES.LIST")]) {
            const itemName = decodeXmlText(getXmlTag(entry, "STOCKITEMNAME") || getXmlTag(entry, "ITEMNAME")).trim().toLocaleLowerCase();
            if (!itemName) continue;
            for (const allocation of getXmlBlocks(entry, "BATCHALLOCATIONS.LIST")) {
              const orderId = getXmlTag(allocation, "ORDERID").trim();
              const quantity = parseTallyQuantityParts(getXmlTag(allocation, "ACTUALQTY") || getXmlTag(allocation, "BILLEDQTY"));
              if (!orderIds.has(orderId) || !quantity) continue;
              const key = `${orderId}|${itemName}`;
              fulfilledByOrderItem.set(key, (fulfilledByOrderItem.get(key) ?? 0) + quantity.quantity);
            }
          }
        }
      }
    }
    const rows = orderVouchers.map((voucher) => {
      const date = normalizeTallyDate(getXmlTag(voucher, "DATE"));
      const voucherParty = decodeXmlText(getXmlTag(voucher, "PARTYLEDGERNAME"));
      const entries = [...getXmlBlocks(voucher, "ALLINVENTORYENTRIES.LIST"), ...getXmlBlocks(voucher, "INVENTORYENTRIES.LIST")];
      const items = entries.map((entry) => {
        const ordered = getXmlTag(entry, "BILLEDQTY") || getXmlTag(entry, "ACTUALQTY");
        const pending = getXmlTag(entry, "PENDINGQTY") || getXmlTag(entry, "BALANCEQTY");
        const quantity = parseTallyQuantityParts(ordered);
        const orderId = getXmlTag(entry, "ORDERID").trim();
        const fulfilledValue = fulfilledByOrderItem.get(`${orderId}|${decodeXmlText(getXmlTag(entry, "STOCKITEMNAME") || getXmlTag(entry, "ITEMNAME")).trim().toLocaleLowerCase()}`);
        const pendingValue = parseTallyQuantityParts(pending);
        const fulfilled = fulfilledValue ?? (quantity && pendingValue ? Math.max(0, quantity.quantity - pendingValue.quantity) : 0);
        const remaining = quantity ? Math.max(0, quantity.quantity - fulfilled) : pendingValue?.quantity;
        return {
          name: decodeXmlText(getXmlTag(entry, "STOCKITEMNAME") || getXmlTag(entry, "ITEMNAME")),
          ordered: ordered.trim(),
          fulfilled: quantity ? formatTallyQuantityLike(ordered, fulfilled) : "",
          remaining: quantity && remaining !== undefined ? formatTallyQuantityLike(ordered, remaining) : pending.trim(),
        };
      }).filter((item) => item.name || item.ordered);
      return {
        date, number: decodeXmlText(getXmlTag(voucher, "VOUCHERNUMBER")), party: voucherParty,
        reference: decodeXmlText(getXmlTag(voucher, "REFERENCE")),
        isPreClosed: getXmlTag(voucher, "ISPRECLOSED").toLowerCase() === "yes",
        items,
      };
    });
    return { ok: true, rows };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
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
