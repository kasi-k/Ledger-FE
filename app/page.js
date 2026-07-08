"use client";

import {
  useEffect,
  useState,
  useCallback,
  useRef,
  createContext,
  useContext,
} from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "https://ledger-be-jlva.onrender.com";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const currentMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

const todayIso = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD
const firstOfMonthIso = () => `${currentMonth()}-01`;

const currentYear = () => new Date().getFullYear();

// Calendar-year months (Jan–Dec) of `year`, newest first. For the current year
// it stops at the current month (no future months).
function yearMonths(year) {
  const now = new Date();
  const curIdx = now.getFullYear() * 12 + now.getMonth();
  const out = [];
  for (let m = 0; m < 12; m++) {
    const idx = year * 12 + m;
    if (idx > curIdx) break;
    out.push(`${year}-${String(m + 1).padStart(2, "0")}`);
  }
  return out.reverse();
}

const monthLabel = (m) =>
  new Date(`${m}-01T00:00:00`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

const monthChip = (m) => {
  const [y, mo] = m.split("-");
  return `${MONTHS[Number(mo) - 1]} ${y}`;
};

const money = (n) =>
  Number(n).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

// "2026-07-01" -> "01Jul26"
const formatDate = (d) => {
  if (!d) return "";
  const [y, m, day] = d.split("-");
  return `${day}${MONTHS[Number(m) - 1]}${y.slice(2)}`;
};

// The brought-forward opening balance is shown as a credit (money in) or, when
// negative, a debit (money owed) — and it counts in the statement totals.
const openingCredit = (o) => (Number(o) >= 0 ? Number(o) : 0);
const openingDebit = (o) => (Number(o) < 0 ? -Number(o) : 0);

const blankRow = (date = "", added = false) => ({
  date,
  particulars: "",
  debit: "",
  credit: "",
  added,
});

const rowHasContent = (r) =>
  r.particulars.trim() !== "" || r.debit !== "" || r.credit !== "";

// Keep only digits and a single decimal point (strict number, no type="number").
const numericOnly = (v) => {
  let s = String(v).replace(/[^\d.]/g, "");
  const parts = s.split(".");
  if (parts.length > 2) s = parts[0] + "." + parts.slice(1).join("");
  return s;
};

// Particulars start with a capital letter by default.
const capFirst = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "https://ledger-be-jlva.onrender.com";
// Full URL for a stored invoice image (backend serves /uploads statically).
const invoiceUrl = (u) => (u ? `${API_BASE}${u}` : "");

const daysInMonth = (m) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo, 0).getDate();
};

function buildSheet(month, entries) {
  const saved = (entries || []).map((e) => ({
    date: e.date || "",
    particulars: e.particulars || "",
    debit: e.debit ? String(e.debit) : "",
    credit: e.credit ? String(e.credit) : "",
    claimed: !!e.claimed,
    invoices: e.invoices || [],
  }));
  const savedDates = new Set(saved.map((r) => r.date));

  const scaffold = [];
  for (let d = 1; d <= daysInMonth(month); d++) {
    const date = `${month}-${String(d).padStart(2, "0")}`;
    if (!savedDates.has(date)) scaffold.push(blankRow(date));
  }

  return [...saved, ...scaffold].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0
  );
}

// ============================ Toasts ============================
const ToastContext = createContext(() => {});
const useToast = () => useContext(ToastContext);

const TOAST_ICON = { success: "✓", error: "✕", info: "ℹ" };

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const remove = useCallback(
    (id) => setToasts((list) => list.filter((t) => t.id !== id)),
    []
  );

  // toast(message, type) — type: "success" | "error" | "info" (default).
  const toast = useCallback(
    (message, type = "info") => {
      if (!message) return;
      const id = ++idRef.current;
      setToasts((list) => [...list, { id, message, type }]);
      // Errors linger a little longer so they can be read.
      setTimeout(() => remove(id), type === "error" ? 6000 : 3500);
      return id;
    },
    [remove]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-wrap no-print" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={"toast toast-" + t.type}
            role="status"
            onClick={() => remove(t.id)}
          >
            <span className="toast-icon">{TOAST_ICON[t.type] || TOAST_ICON.info}</span>
            <span className="toast-msg">{t.message}</span>
            <span className="toast-close" aria-hidden="true">×</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ============================ Auth gate ============================
export default function Home() {
  const [token, setToken] = useState(null);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(localStorage.getItem("ledgerToken"));
    setUsername(localStorage.getItem("ledgerUser") || "");
    setRole(localStorage.getItem("ledgerRole") || "");
    setReady(true);
  }, []);

  function login(t, u, r) {
    localStorage.setItem("ledgerToken", t);
    localStorage.setItem("ledgerUser", u);
    localStorage.setItem("ledgerRole", r || "");
    setToken(t);
    setUsername(u);
    setRole(r || "");
  }

  function logout() {
    localStorage.removeItem("ledgerToken");
    localStorage.removeItem("ledgerUser");
    localStorage.removeItem("ledgerRole");
    setToken(null);
    setUsername("");
    setRole("");
  }

  if (!ready) return null;
  return (
    <ToastProvider>
      {!token ? (
        <Login onLogin={login} />
      ) : (
        <Ledger
          token={token}
          username={username}
          role={role}
          onLogout={logout}
        />
      )}
    </ToastProvider>
  );
}

// ============================ Login page ============================
function Login({ onLogin }) {
  const toast = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch(`${API}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Login failed");
      }
      const data = await res.json();
      toast(`Welcome, ${data.username}.`, "success");
      onLogin(data.token, data.username, data.role);
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/maarrlogo.jpeg" alt="Maarr Smart" />
        <h1 className="login-title">Monthly Ledger</h1>
        <p className="login-sub">Sign in to continue</p>

        <label className="login-field">
          <span>Username</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoComplete="username"
          />
        </label>
        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>

        <button className="btn-primary login-btn" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

// ============================ Ledger ============================
function Ledger({ token, username, role, onLogout }) {
  const toast = useToast();
  const isAdmin = role === "admin";
  const [view, setView] = useState("ledger"); // "ledger" | "audit"
  const [month, setMonth] = useState(currentMonth());
  const [months, setMonths] = useState([]);
  const [unlockedMonths, setUnlockedMonths] = useState([]);
  const [opening, setOpening] = useState(0);
  const [editable, setEditable] = useState(true);
  const [rows, setRows] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);

  // Date-range download ("statement for accounts") — lives on the ledger itself.
  const [dlFrom, setDlFrom] = useState(firstOfMonthIso());
  const [dlTo, setDlTo] = useState(todayIso());
  const [reports, setReports] = useState([]);
  const [pendingDownload, setPendingDownload] = useState(null); // { data, count }
  const [pendingDeleteRow, setPendingDeleteRow] = useState(null); // row index awaiting confirm
  const [pendingDeleteInvoice, setPendingDeleteInvoice] = useState(null); // { id, name } awaiting confirm

  // fetch wrapper that attaches the token and signs out on 401.
  const authFetch = useCallback(
    async (url, opts = {}) => {
      const res = await fetch(url, {
        ...opts,
        headers: { ...(opts.headers || {}), Authorization: `Bearer ${token}` },
      });
      if (res.status === 401) {
        onLogout();
        throw new Error("Session expired — please sign in again.");
      }
      return res;
    },
    [token, onLogout]
  );

  const loadMonths = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/api/months`);
      if (res.ok) setMonths(await res.json());
      const s = await authFetch(`${API}/api/settings`);
      if (s.ok) setUnlockedMonths((await s.json()).unlockedMonths || []);
    } catch {
      /* handled elsewhere */
    }
  }, [authFetch]);

  // Saved claimed-report snapshots (admin only).
  const loadReports = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await authFetch(`${API}/api/reports`);
      if (res.ok) setReports(await res.json());
    } catch {
      /* handled elsewhere */
    }
  }, [authFetch, isAdmin]);

  const loadLedger = useCallback(
    async (m) => {
      setLoading(true);
      try {
        const res = await authFetch(`${API}/api/ledger?month=${m}`);
        if (!res.ok) throw new Error("Failed to load ledger");
        const data = await res.json();
        setOpening(data.opening || 0);
        setEditable(data.editable !== false);
        setRows(buildSheet(m, data.entries));
        setDirty(false);
      } catch (err) {
        toast(err.message, "error");
      } finally {
        setLoading(false);
      }
    },
    [authFetch, toast]
  );

  useEffect(() => {
    loadLedger(month);
  }, [month, loadLedger]);

  useEffect(() => {
    loadMonths();
  }, [loadMonths]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  // Returning to the ledger (e.g. after changing opening balance or month locks
  // in Controls) reloads fresh data so changes show without a page refresh.
  useEffect(() => {
    if (view !== "ledger") return;
    loadLedger(month);
    loadMonths();
    loadReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  function handleMonthChange(e) {
    setMonth(e.target.value || currentMonth());
  }

  function setCell(index, field, value) {
    setDirty(true);
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, [field]: value } : r))
    );
  }

  function addSameDate(index) {
    setDirty(true);
    setRows((prev) => {
      const next = [...prev];
      next.splice(index + 1, 0, blankRow(prev[index].date, true));
      return next;
    });
    toast("Row added — enter details and Save sheet.", "info");
  }

  function deleteRow(index) {
    setDirty(true);
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  // Confirmed from the delete-row dialog (see the modal below).
  function confirmDeleteRow() {
    if (pendingDeleteRow === null) return;
    deleteRow(pendingDeleteRow);
    setPendingDeleteRow(null);
    toast("Row removed — click Save sheet to make it permanent.", "info");
  }

  // Confirmed from the delete-invoice dialog (see the modal below).
  function confirmDeleteInvoice() {
    if (!pendingDeleteInvoice) return;
    deleteInvoice(pendingDeleteInvoice.id);
    setPendingDeleteInvoice(null);
  }

  // Attach an invoice image to a saved entry (base64 upload — no page reload).
  async function uploadInvoice(row, fileList) {
    const file = fileList && fileList[0];
    if (!file) return;
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast("Please choose an image (JPG/PNG) or a PDF for the invoice.", "error");
      return;
    }
    // If this row has unsaved edits its entry isn't in the backend yet — the
    // POST will 404 with a clear "save first" message, so no pre-block needed.
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Could not read the file"));
        reader.readAsDataURL(file);
      });
      const res = await authFetch(`${API}/api/invoice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          month,
          date: row.date,
          particulars: row.particulars,
          debit: row.debit || 0,
          credit: row.credit || 0,
          name: file.name,
          dataUrl,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to attach the invoice");
      }
      toast("Invoice attached.", "success");
      loadLedger(month);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function deleteInvoice(id) {
    try {
      const res = await authFetch(`${API}/api/invoice/${id}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to remove the invoice");
      }
      toast("Invoice removed.", "success");
      loadLedger(month);
    } catch (err) {
      toast(err.message, "error");
    }
  }

  async function saveSheet() {
    const entries = rows.filter(rowHasContent).map((r) => ({
      date: r.date || `${month}-01`,
      particulars: r.particulars,
      debit: r.debit || 0,
      credit: r.credit || 0,
    }));
    try {
      const res = await authFetch(`${API}/api/months/${month}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save sheet");
      }
      const data = await res.json();
      toast(`Saved ${data.count} row(s).`, "success");
      loadLedger(month);
      loadMonths();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // Download the statement for the chosen date range. Fetches the pending
  // entries, then opens a modal to confirm the action (see runDownload).
  async function prepareDownload() {
    if (!dlFrom || !dlTo) {
      toast("Pick a From date and a To date to download.", "error");
      return;
    }
    if (dlFrom > dlTo) {
      toast("'From' date must be on or before 'To' date.", "error");
      return;
    }
    try {
      const res = await authFetch(`${API}/api/report?from=${dlFrom}&to=${dlTo}`);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Failed to build the statement");
      }
      const data = await res.json();
      const n = data.entries.length;
      if (n === 0) {
        toast(
          "No pending entries in that date range — nothing new to download.",
          "info"
        );
        return;
      }
      setPendingDownload({ data, count: n });
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // Fetch a PDF from the backend (with the auth header) and save it as a file.
  async function downloadPdf(url, filename) {
    const res = await authFetch(url);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || "Failed to generate the PDF");
    }
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
  }

  // Triggered by the download modal. Downloads the server-generated PDF (with
  // invoices merged in), then — if `lock` — claims the range and saves it.
  async function runDownload(lock) {
    if (!pendingDownload) return;
    setPendingDownload(null);
    try {
      await downloadPdf(
        `${API}/api/statement.pdf?from=${dlFrom}&to=${dlTo}`,
        `Maarr Expenses ${formatDate(dlFrom)} to ${formatDate(dlTo)}.pdf`
      );
      toast("Expenses downloaded.", "success");
      if (lock) {
        const res = await authFetch(`${API}/api/claim-range`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ from: dlFrom, to: dlTo }),
        });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error || "Downloaded, but claiming failed");
        }
        const d = await res.json();
        const n = d.count || 0;
        toast(
          `Claimed ${n} entr${n === 1 ? "y" : "ies"} — saved as a report.`,
          "success"
        );
        loadLedger(month);
        loadReports();
      }
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // Re-download a saved report as a PDF (no re-claiming).
  async function downloadStoredReport(id, from, to) {
    try {
      const name =
        from && to
          ? `Maarr Expenses ${formatDate(from)} to ${formatDate(to)}.pdf`
          : `Maarr Expenses ${id}.pdf`;
      await downloadPdf(`${API}/api/reports/${id}/pdf`, name);
      toast("Expenses downloaded.", "success");
    } catch (err) {
      toast(err.message, "error");
    }
  }

  // Show a date only on the FIRST line of each date; group the rest below it.
  const firstFilledByDate = {};
  const firstAnyByDate = {};
  rows.forEach((r, i) => {
    if (firstAnyByDate[r.date] === undefined) firstAnyByDate[r.date] = i;
    if (rowHasContent(r) && firstFilledByDate[r.date] === undefined) {
      firstFilledByDate[r.date] = i;
    }
  });
  const showsDate = (r, i) => {
    if (!r.date) return false;
    if (rowHasContent(r)) return firstFilledByDate[r.date] === i;
    if (firstFilledByDate[r.date] !== undefined) return false;
    return firstAnyByDate[r.date] === i;
  };

  let running = opening;
  let serial = 0;
  // Opening b/f counts as the first credit (or debit if negative).
  let totalDebit = openingDebit(opening);
  let totalCredit = openingCredit(opening);
  const meta = rows.map((r, i) => {
    const showDate = showsDate(r, i);
    if (!rowHasContent(r)) return { filled: false, balance: null, no: null, showDate };
    const d = Number(r.debit) || 0;
    const c = Number(r.credit) || 0;
    totalDebit += d;
    totalCredit += c;
    running += c - d;
    let no = null;
    if (showDate) {
      serial += 1;
      no = serial;
    }
    return { filled: true, balance: running, no, showDate };
  });
  const closing = running;

  // Admin is read-only; employee may edit within the month-lock window.
  const canEdit = !isAdmin && editable;
  const lockReason = isAdmin ? "admin" : !editable ? "closed" : null;

  const viewTitle =
    view === "audit"
      ? "Audit Log"
      : view === "reports"
      ? "Claimed Reports"
      : view === "controls"
      ? "Admin Controls"
      : "Monthly Ledger";

  return (
    <div className="app-shell">
      {/* Sidebar navigation */}
      <aside className="sidebar no-print">
        <div className="side-logo">
          <img className="side-logo-img" src="/maarrlogo.jpeg" alt="Maarr Smart" />
        </div>
        <nav className="side-nav">
          <button
            className={"side-link" + (view === "ledger" ? " side-link-active" : "")}
            onClick={() => setView("ledger")}
          >
            📒 Ledger
          </button>
          {isAdmin && (
            <button
              className={"side-link" + (view === "reports" ? " side-link-active" : "")}
              onClick={() => setView("reports")}
            >
              📄 Reports
            </button>
          )}
          {isAdmin && (
            <button
              className={"side-link" + (view === "audit" ? " side-link-active" : "")}
              onClick={() => setView("audit")}
            >
              🧾 Audit
            </button>
          )}
          {isAdmin && (
            <button
              className={"side-link" + (view === "controls" ? " side-link-active" : "")}
              onClick={() => setView("controls")}
            >
              ⚙️ Controls
            </button>
          )}
        </nav>
      </aside>

      {/* Main content */}
      <main className="main">
        <div className="main-head">
          <img className="print-brand" src="/maarrlogo.jpeg" alt="Maarr Smart" />
          <div className="brand-meta">
            <div className="brand-title">{viewTitle}</div>
            <div className="brand-period">{monthLabel(month)}</div>
          </div>
          <div className="user-box no-print">
            <span className="user-name">
              👤 {username}
              <span className={"role-badge " + (isAdmin ? "role-admin" : "role-emp")}>
                {isAdmin ? "Admin" : "Accounts"}
              </span>
            </span>
            <button className="btn-secondary" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </div>

        {view === "audit" ? (
        <Audit authFetch={authFetch} />
      ) : view === "reports" && isAdmin ? (
        <ReportsView
          reports={reports}
          onDownload={downloadStoredReport}
          authFetch={authFetch}
        />
      ) : view === "controls" && isAdmin ? (
        <AdminControls authFetch={authFetch} />
      ) : (
        <>
          <div className="controls no-print">
            <div className="month-picker">
              <label htmlFor="monthFilter">Filter by month</label>
              <select
                id="monthFilter"
                className="month-select"
                value={month}
                onChange={handleMonthChange}
              >
                {Array.from(
                  new Set([month, currentMonth(), ...unlockedMonths])
                )
                  .sort()
                  .reverse()
                  .map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
              </select>
            </div>
            <div className="controls-actions">
              {canEdit ? (
                <button
                  className={dirty ? "btn-primary" : "btn-secondary"}
                  onClick={saveSheet}
                >
                  💾 Save sheet
                </button>
              ) : (
                <span className="lock-pill">
                  🔒 {isAdmin ? "Read-only" : "Locked"}
                </span>
              )}
            </div>
          </div>

          {/* Claim & download a statement for any date range — admin only */}
          {isAdmin && (
            <div className="dl-bar no-print">
              <span className="dl-title">Claim &amp; download expenses</span>
              <label className="dl-field">
                <span>From</span>
                <input
                  type="date"
                  value={dlFrom}
                  onChange={(e) => setDlFrom(e.target.value)}
                />
              </label>
              <label className="dl-field">
                <span>To</span>
                <input
                  type="date"
                  value={dlTo}
                  onChange={(e) => setDlTo(e.target.value)}
                />
              </label>
              <button className="btn-primary" onClick={prepareDownload}>
                ⬇ Download &amp; claim expenses
              </button>
            </div>
          )}

          {/* Quick jump — only the current + admin-unlocked months (Controls) */}
          {months.some(
            (m) => m === currentMonth() || unlockedMonths.includes(m)
          ) && (
            <div className="month-chips no-print">
              <span className="chips-label">Months:</span>
              {months
                .filter(
                  (m) => m === currentMonth() || unlockedMonths.includes(m)
                )
                .map((m) => (
                  <button
                    key={m}
                    className={"chip" + (m === month ? " chip-active" : "")}
                    onClick={() => setMonth(m)}
                  >
                    {monthChip(m)}
                  </button>
                ))}
            </div>
          )}

          <div className="month-print">
            <LedgerTable
              loading={loading}
              rows={rows}
              meta={meta}
              opening={opening}
              totalDebit={totalDebit}
              totalCredit={totalCredit}
              closing={closing}
              month={month}
              editable={canEdit}
              lockReason={lockReason}
              dirty={dirty}
              setCell={setCell}
              addSameDate={addSameDate}
              deleteRow={(i) => setPendingDeleteRow(i)}
              onUploadInvoice={uploadInvoice}
              onDeleteInvoice={(id, name) => setPendingDeleteInvoice({ id, name })}
            />
          </div>
        </>
      )}

      {/* Download & claim confirmation modal (replaces the browser confirm). */}
      {pendingDownload && (
        <div
          className="modal-overlay no-print"
          onClick={() => setPendingDownload(null)}
        >
          <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Download &amp; claim expenses</h3>
            <p className="modal-text">
              Preview of <strong>{pendingDownload.count}</strong> entr
              {pendingDownload.count === 1 ? "y" : "ies"} ({formatDate(dlFrom)} to{" "}
              {formatDate(dlTo)}). <strong>Download expenses only</strong> saves the
              PDF without changing anything. <strong>Download &amp; claim expenses</strong>{" "}
              also locks these entries and saves them as a report — they won’t
              appear on a future download.
            </p>
            <div className="modal-preview">
              <StatementTable report={pendingDownload.data} />
            </div>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setPendingDownload(null)}
              >
                Cancel
              </button>
              <button
                className="btn-secondary"
                onClick={() => runDownload(false)}
              >
                ⬇ Download expenses only
              </button>
              <button className="btn-primary" onClick={() => runDownload(true)}>
                ⬇ Download &amp; claim expenses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-row confirmation — deletion is unrecoverable once the sheet is saved. */}
      {pendingDeleteRow !== null && rows[pendingDeleteRow] && (
        <div
          className="modal-overlay no-print"
          onClick={() => setPendingDeleteRow(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Delete this row?</h3>
            <div className="modal-item">
              <strong>
                {rows[pendingDeleteRow].date
                  ? formatDate(rows[pendingDeleteRow].date)
                  : "—"}
              </strong>
              {rows[pendingDeleteRow].particulars?.trim()
                ? ` · ${rows[pendingDeleteRow].particulars.trim()}`
                : ""}
              {rows[pendingDeleteRow].debit
                ? ` · Dr ${money(rows[pendingDeleteRow].debit)}`
                : ""}
              {rows[pendingDeleteRow].credit
                ? ` · Cr ${money(rows[pendingDeleteRow].credit)}`
                : ""}
            </div>
            <p className="modal-text">
              Once you delete this row <strong>and click Save sheet</strong>, the
              entry is permanently removed and <strong>cannot be recovered</strong>.
              Any invoice attached to it is lost too.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setPendingDeleteRow(null)}
              >
                Cancel
              </button>
              <button className="btn-danger-solid" onClick={confirmDeleteRow}>
                🗑 Delete row
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete-invoice confirmation — the file is removed from the server immediately. */}
      {pendingDeleteInvoice && (
        <div
          className="modal-overlay no-print"
          onClick={() => setPendingDeleteInvoice(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Remove this invoice?</h3>
            <div className="modal-item">
              📎 {pendingDeleteInvoice.name || "invoice"}
            </div>
            <p className="modal-text">
              This deletes the file from the server <strong>right away</strong>. It
              <strong> cannot be recovered</strong> — you’d have to re-upload it.
            </p>
            <div className="modal-actions">
              <button
                className="btn-secondary"
                onClick={() => setPendingDeleteInvoice(null)}
              >
                Cancel
              </button>
              <button className="btn-danger-solid" onClick={confirmDeleteInvoice}>
                🗑 Remove invoice
              </button>
            </div>
          </div>
        </div>
      )}
      </main>
    </div>
  );
}

// ============================ Ledger table (extracted) ============================
function LedgerTable({
  loading,
  rows,
  meta,
  opening,
  totalDebit,
  totalCredit,
  closing,
  dirty,
  month,
  editable,
  lockReason,
  setCell,
  addSameDate,
  deleteRow,
  onUploadInvoice,
  onDeleteInvoice,
}) {
  return (
    <>
      <div className="card">
        <div className="ledger-title">
          <h2>{monthLabel(month)}</h2>
          <div className="status-line no-print">
            {dirty && <span className="dirty">● Unsaved changes</span>}
          </div>
        </div>

        {!loading && lockReason === "admin" && (
          <div className="lock-banner no-print">
            🔒 <strong>Admin view — read-only.</strong> Data entry is done by
            employees. You can view, download, and check the audit log.
          </div>
        )}
        {!loading && lockReason === "closed" && (
          <div className="lock-banner no-print">
            🔒 This month is <strong>closed for edits</strong>. Only the current
            month is open — ask an admin to unlock a previous month if a
            correction is needed. You can still view and download it.
          </div>
        )}

        {loading ? (
          <div className="empty">Loading…</div>
        ) : (
          <table className="sheet">
            <thead>
              <tr>
                <th className="num-col">#</th>
                <th className="date-col">Date</th>
                <th>Particulars</th>
                <th className="amount">Debit</th>
                <th className="amount">Credit</th>
                <th className="amount">Balance</th>
                <th className="no-print act-col"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="opening">
                <td></td>
                <td></td>
                <td>
                  <em>Opening balance (b/f)</em>
                </td>
                <td className="amount">
                  {opening < 0 ? money(-opening) : ""}
                </td>
                <td className="amount">
                  {opening > 0 ? money(opening) : ""}
                </td>
                <td className="amount balance-cell">{money(opening)}</td>
                <td className="no-print"></td>
              </tr>

              {rows.map((r, i) => {
                const m = meta[i];
                const locked = !editable || r.claimed; // claimed rows never editable
                return (
                  <tr
                    key={i}
                    className={
                      (m.filled ? "" : "blank-row") +
                      (m.filled && !m.showDate ? " same-date" : "") +
                      (r.claimed ? " claimed-row" : "")
                    }
                  >
                    <td className="num-col">{m.no ?? ""}</td>
                    <td className="date-col">
                      <span className="date-text">
                        {m.showDate ? formatDate(r.date) : ""}
                      </span>
                    </td>
                    <td>
                      <input
                        className="cell-input"
                        type="text"
                        title={r.particulars}
                        value={r.particulars}
                        disabled={locked}
                        onChange={(e) =>
                          setCell(i, "particulars", capFirst(e.target.value))
                        }
                      />
                    </td>
                    <td className="amount">
                      <input
                        className="cell-input amount-input"
                        type="text"
                        inputMode="decimal"
                        value={r.debit}
                        disabled={locked}
                        onChange={(e) =>
                          setCell(i, "debit", numericOnly(e.target.value))
                        }
                      />
                    </td>
                    <td className="amount">
                      <input
                        className="cell-input amount-input"
                        type="text"
                        inputMode="decimal"
                        value={r.credit}
                        disabled={locked}
                        onChange={(e) =>
                          setCell(i, "credit", numericOnly(e.target.value))
                        }
                      />
                    </td>
                    <td className="amount balance-cell">
                      {m.balance === null ? "" : money(m.balance)}
                    </td>
                    <td className="no-print act-col">
                      {r.claimed ? (
                        <span className="claim-tag" title="Claimed — locked">
                          ✓ Claimed
                        </span>
                      ) : editable ? (
                        <>
                          <button
                            className="btn-mini"
                            title="Add another entry on this date"
                            onClick={() => addSameDate(i)}
                          >
                            ＋
                          </button>
                          {(m.filled || r.added) && (
                            <button
                              className="btn-danger"
                              title="Delete row"
                              onClick={() => deleteRow(i)}
                            >
                              ✕
                            </button>
                          )}
                        </>
                      ) : null}

                      {/* Invoices: view each; remove until claimed */}
                      {m.filled &&
                        r.invoices &&
                        r.invoices.map((inv) => (
                          <span key={inv.id} className="inv-item">
                            <a
                              className="inv-badge"
                              href={invoiceUrl(inv.url)}
                              target="_blank"
                              rel="noreferrer"
                              title={"View: " + inv.name}
                            >
                              📎
                            </a>
                            {!r.claimed && (
                              <button
                                className="inv-x"
                                title="Remove invoice"
                                onClick={() => onDeleteInvoice(inv.id, inv.name)}
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      {/* Attach an invoice (always available until claimed) */}
                      {m.filled && !r.claimed && (
                        <label
                          className="btn-mini inv-upload"
                          title="Attach invoice (image or PDF)"
                        >
                          ＋📎
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            hidden
                            onChange={(e) => {
                              onUploadInvoice(r, e.target.files);
                              e.target.value = "";
                            }}
                          />
                        </label>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td></td>
                <td></td>
                <td>Totals</td>
                <td className="amount">{money(totalDebit)}</td>
                <td className="amount">{money(totalCredit)}</td>
                <td className="amount"></td>
                <td className="no-print"></td>
              </tr>
              <tr className="closing">
                <td></td>
                <td></td>
                <td>Closing balance (c/f)</td>
                <td className="amount"></td>
                <td className="amount"></td>
                <td className="amount">{money(closing)}</td>
                <td className="no-print"></td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>
    </>
  );
}

// ============================ Audit log ============================
const AUDIT_LABELS = {
  login: "Signed in",
  login_failed: "Login failed",
  save_month: "Saved sheet",
  delete_entry: "Deleted entry",
  set_starting_balance: "Opening balance",
  set_opening_balance: "Opening balance",
  set_grace_day: "Grace period",
  unlock_month: "Unlocked month",
  lock_month: "Re-locked month",
  claim_entry: "Claimed entry",
  unclaim_entry: "Unclaimed entry",
  claim_range: "Claimed statement",
  upload_invoice: "Attached invoice",
  delete_invoice: "Removed invoice",
};

const fmtTs = (ts) => {
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return ts;
  }
};

const rowText = (x) =>
  `${x.particulars} (${formatDate(x.date)})` +
  (x.debit ? ` · Dr ${money(x.debit)}` : "") +
  (x.credit ? ` · Cr ${money(x.credit)}` : "");

function auditDetails(e) {
  switch (e.action) {
    case "save_month": {
      const added = e.added || [];
      const removed = e.removed || [];
      if (!added.length && !removed.length) {
        return (
          <span className="audit-muted">{monthLabel(e.month)} — saved, no changes</span>
        );
      }
      return (
        <div className="audit-changes">
          <div className="audit-month">{monthLabel(e.month)}</div>
          {added.map((x, i) => (
            <div key={"a" + i} className="chg chg-add">
              + {rowText(x)}
            </div>
          ))}
          {removed.map((x, i) => (
            <div key={"r" + i} className="chg chg-rem">
              − {rowText(x)}
            </div>
          ))}
        </div>
      );
    }
    case "delete_entry":
      return e.entry ? `Deleted: ${rowText(e.entry)}` : "";
    case "set_starting_balance":
      return `${money(e.from || 0)} → ${money(e.to || 0)}`;
    case "set_opening_balance":
      return `${monthLabel(e.month)}: ${money(e.from || 0)} → ${money(e.to || 0)}`;
    case "set_grace_day":
      return `Previous month open until day ${e.from} → ${e.to}`;
    case "unlock_month":
      return `Unlocked ${monthLabel(e.month)} for corrections`;
    case "lock_month":
      return `Re-locked ${monthLabel(e.month)}`;
    case "claim_entry":
    case "unclaim_entry":
      return e.entry ? rowText(e.entry) : "";
    case "claim_range": {
      const n = e.count || 0;
      const noun = n === 1 ? "entry" : "entries";
      return `${formatDate(e.from)} to ${formatDate(e.to)} — ${n} ${noun}`;
    }
    case "upload_invoice":
      return e.entry ? `${e.name || "invoice"} → ${rowText(e.entry)}` : e.name || "";
    case "delete_invoice":
      return e.name || "";
    default:
      return "";
  }
}

function Audit({ authFetch }) {
  const [log, setLog] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch(`${API}/api/audit`);
      if (!res.ok) throw new Error("Failed to load audit log");
      setLog(await res.json());
    } catch (err) {
      setError(err.message);
    }
  }, [authFetch]);

  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div className="card">
        <div className="empty">{error}</div>
      </div>
    );
  if (!log)
    return (
      <div className="card">
        <div className="empty">Loading…</div>
      </div>
    );

  return (
    <div className="card">
      <div className="ledger-title">
        <h2>Audit log</h2>
        <div className="status-line">
          <span className="chips-label">{log.length} events</span>
          <button className="btn-secondary" onClick={load}>
            ↻ Refresh
          </button>
        </div>
      </div>
      {log.length === 0 ? (
        <div className="empty">No activity recorded yet.</div>
      ) : (
        <table className="sheet audit-table">
          <thead>
            <tr>
              <th className="when-col">When</th>
              <th className="user-col">User</th>
              <th className="action-col">Action</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {log.map((e, i) => (
              <tr key={i}>
                <td className="when-col">{fmtTs(e.ts)}</td>
                <td className="user-col">{e.user}</td>
                <td className="action-col">
                  <span className={"audit-tag audit-" + e.action}>
                    {AUDIT_LABELS[e.action] || e.action}
                  </span>
                </td>
                <td>{auditDetails(e)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ============================ Admin Controls ============================
// Only the current month is naturally open; everything else is locked.
function naturallyOpen(month) {
  return month === currentMonth() ? "current" : null;
}

function AdminControls({ authFetch }) {
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [year, setYear] = useState(currentYear());
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async () => {
    try {
      const s = await authFetch(`${API}/api/settings`).then((r) => r.json());
      setSettings(s);
    } catch (err) {
      setLoadError(err.message);
      toast(err.message, "error");
    }
  }, [authFetch, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function post(url, body, okMsg) {
    try {
      const res = await authFetch(url, {
        method: body && body._method === "PUT" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Request failed");
      }
      toast(okMsg, "success");
      load();
    } catch (err) {
      toast(err.message, "error");
    }
  }

  if (!settings)
    return (
      <div className="card">
        <div className="empty">{loadError || "Loading…"}</div>
      </div>
    );

  const unlocked = settings.unlockedMonths || [];
  // Months of the SELECTED calendar year, newest first.
  const monthList = yearMonths(year);
  // Years to choose from: current back to 5 years.
  const yearOptions = [];
  for (let i = 0; i < 6; i++) yearOptions.push(currentYear() - i);

  return (
    <div className="admin-grid">
      <div className="card admin-card admin-card-wide">
        <div className="lock-head">
          <div>
            <h2>Month locks</h2>
            <p className="admin-hint">
              Reopen a closed month for corrections, then lock it again. Every
              change is recorded in the audit log.
            </p>
          </div>
          <div className="month-picker">
            <label htmlFor="yr">Year</label>
            <select
              id="yr"
              className="month-select"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>
        <table className="lock-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {monthList.map((m) => {
              const nat = naturallyOpen(m);
              const isUnlocked = unlocked.includes(m);
              let label, cls;
              if (nat === "current") {
                label = "Open (current)";
                cls = "st-open";
              } else if (isUnlocked) {
                label = "Unlocked";
                cls = "st-unlocked";
              } else {
                label = "Locked";
                cls = "st-locked";
              }
              return (
                <tr key={m}>
                  <td>{monthLabel(m)}</td>
                  <td>
                    <span className={"lock-status " + cls}>{label}</span>
                  </td>
                  <td className="lock-action">
                    {nat ? (
                      <span className="admin-muted">—</span>
                    ) : isUnlocked ? (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          post(`${API}/api/months/${m}/lock`, null, `${monthLabel(m)} re-locked.`)
                        }
                      >
                        Re-lock
                      </button>
                    ) : (
                      <button
                        className="btn-secondary"
                        onClick={() =>
                          post(`${API}/api/months/${m}/unlock`, null, `${monthLabel(m)} unlocked.`)
                        }
                      >
                        Unlock
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================ Claimed reports module ============================
function ReportsView({ reports, onDownload, authFetch }) {
  const [openId, setOpenId] = useState(null); // single-open accordion
  const [details, setDetails] = useState({}); // id -> full snapshot (lazy)
  const [loadingId, setLoadingId] = useState(null);
  const [error, setError] = useState("");

  async function toggle(id) {
    if (openId === id) {
      setOpenId(null);
      return;
    }
    setOpenId(id);
    if (details[id]) return; // already cached
    setLoadingId(id);
    setError("");
    try {
      const res = await authFetch(`${API}/api/reports/${id}`);
      if (!res.ok) throw new Error("Failed to load the saved report");
      const full = await res.json();
      setDetails((d) => ({ ...d, [id]: full }));
    } catch (e) {
      setError(e.message);
      setOpenId(null);
    } finally {
      setLoadingId(null);
    }
  }

  return (
    <div className="card">
      <div className="ledger-title">
        <h2>Claimed reports</h2>
        <div className="status-line no-print">
          <span className="chips-label">{reports.length} saved</span>
        </div>
      </div>
      {error && <div className="error-inline no-print">{error}</div>}
      {reports.length === 0 ? (
        <div className="empty">
          No claimed reports yet. Claim a date range from the Ledger to create one.
        </div>
      ) : (
        <div className="report-accordion">
          {reports.map((r) => {
            const open = openId === r.id;
            return (
              <div
                key={r.id}
                className={"report-card" + (open ? " report-card-open" : "")}
              >
                <div
                  className="report-head"
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggle(r.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggle(r.id);
                    }
                  }}
                >
                  <span className={"report-chevron" + (open ? " open" : "")}>
                    ▸
                  </span>
                  <div className="report-headmain">
                    <span className="report-range">
                      {formatDate(r.from)} – {formatDate(r.to)}
                    </span>
                    <span className="report-sub">
                      claimed {fmtTs(r.claimedAt)}
                      {r.claimedBy ? ` · ${r.claimedBy}` : ""}
                    </span>
                  </div>
                  <span className="report-badge">
                    {r.count} entr{r.count === 1 ? "y" : "ies"}
                  </span>
                  <span className="report-closing">
                    Closing {money(r.totals?.closing || 0)}
                  </span>
                  <button
                    className="btn-secondary btn-mini report-dl"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDownload(r.id, r.from, r.to);
                    }}
                  >
                    ⬇ Download
                  </button>
                </div>
                {open && (
                  <div className="report-body">
                    {loadingId === r.id ? (
                      <div className="empty">Loading…</div>
                    ) : details[r.id] ? (
                      <StatementTable report={details[r.id]} />
                    ) : null}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// The statement table itself — reused by the printable card and by the
// expanded rows of the Reports accordion, so both stay identical.
function StatementTable({ report }) {
  const entries = report?.entries || [];
  const opening = report?.opening || 0;

  // Fold the opening b/f into the credit/debit totals (recomputed here so old
  // saved snapshots stay consistent too).
  const entryDebit = entries.reduce((s, e) => s + (Number(e.debit) || 0), 0);
  const entryCredit = entries.reduce((s, e) => s + (Number(e.credit) || 0), 0);
  const totalDebit = entryDebit + openingDebit(opening);
  const totalCredit = entryCredit + openingCredit(opening);
  const closing = opening + entryCredit - entryDebit;

  const invoiceItems = entries.flatMap((e) =>
    (e.invoices || []).map((inv) => ({ e, inv }))
  );

  return (
    <>
    <table className="sheet">
      <thead>
        <tr>
          <th className="num-col">#</th>
          <th className="date-col">Date</th>
          <th>Particulars</th>
          <th className="amount">Debit</th>
          <th className="amount">Credit</th>
          <th className="amount">Balance</th>
        </tr>
      </thead>
      <tbody>
        <tr className="opening">
          <td></td>
          <td></td>
          <td>
            <em>Opening balance (b/f)</em>
          </td>
          <td className="amount">{opening < 0 ? money(-opening) : ""}</td>
          <td className="amount">{opening > 0 ? money(opening) : ""}</td>
          <td className="amount balance-cell">{money(opening)}</td>
        </tr>
        {entries.map((e, i) => (
          <tr key={e.id}>
            <td className="num-col">{i + 1}</td>
            <td className="date-col">
              <span className="date-text">{formatDate(e.date)}</span>
            </td>
            <td>
              <span className="cell-text">{e.particulars}</span>
            </td>
            <td className="amount balance-cell">
              {e.debit ? money(e.debit) : ""}
            </td>
            <td className="amount balance-cell">
              {e.credit ? money(e.credit) : ""}
            </td>
            <td className="amount balance-cell">{money(e.balance)}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td></td>
          <td></td>
          <td>Totals</td>
          <td className="amount">{money(totalDebit)}</td>
          <td className="amount">{money(totalCredit)}</td>
          <td className="amount"></td>
        </tr>
        <tr className="closing">
          <td></td>
          <td></td>
          <td>Closing balance (c/f)</td>
          <td className="amount"></td>
          <td className="amount"></td>
          <td className="amount">{money(closing)}</td>
        </tr>
      </tfoot>
    </table>

    {invoiceItems.length > 0 && (
      <div className="statement-invoices">
        <h3 className="statement-invoices-title">
          Invoices ({invoiceItems.length})
        </h3>
        {invoiceItems.map(({ e, inv }) => (
          <figure key={inv.id} className="invoice-fig">
            <figcaption>
              {formatDate(e.date)} · {e.particulars} —{" "}
              {e.debit ? "Dr " + money(e.debit) : "Cr " + money(e.credit)}
            </figcaption>
            {inv.mime && inv.mime.startsWith("image/") ? (
              <img src={invoiceUrl(inv.url)} alt={inv.name} />
            ) : (
              <a
                className="invoice-pdf-link"
                href={invoiceUrl(inv.url)}
                target="_blank"
                rel="noreferrer"
              >
                📎 {inv.name} (PDF — opens in a new tab)
              </a>
            )}
          </figure>
        ))}
      </div>
    )}
    </>
  );
}

