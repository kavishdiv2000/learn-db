// SQL Lab – a local learning app for Microsoft SQL Server.
// Serves the web app from ./public and runs T-SQL against your local SQL Server.
// Start with:  npm install   then   npm start   (or double-click start.bat)

const express = require('express');
const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Config (config.json, overridable with env vars)
// ---------------------------------------------------------------------------
const CONFIG_PATH = path.join(__dirname, 'config.json');
const fileConfig = fs.existsSync(CONFIG_PATH) ? JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')) : {};
const config = {
  port: Number(process.env.PORT || fileConfig.port || 5080),
  host: process.env.HOST || fileConfig.host || '127.0.0.1',   // Docker sets HOST=0.0.0.0
  server: process.env.SQL_SERVER || fileConfig.server || 'localhost',
  database: process.env.SQL_DATABASE || fileConfig.database || 'ShopDB',
  auth: (process.env.SQL_AUTH || fileConfig.auth || 'windows').toLowerCase(), // 'windows' | 'sql'
  user: process.env.SQL_USER || fileConfig.user || 'sa',
  password: process.env.SQL_PASSWORD || fileConfig.password || '',
  sqlPort: Number(process.env.SQL_PORT || fileConfig.sqlPort || 1433),
  maxRows: Number(fileConfig.maxRows || 1000),
  timeoutSec: Number(fileConfig.timeoutSec || 120),
  odbcDriver: fileConfig.odbcDriver || '' // leave empty to auto-detect
};

// ---------------------------------------------------------------------------
// Driver selection
//   Windows auth -> msnodesqlv8 (ODBC, works with SQL Server's default setup)
//   SQL auth     -> tedious (pure JS, needs TCP/IP enabled + a SQL login)
// ---------------------------------------------------------------------------
let sql;
let driverName;
if (config.auth === 'windows') {
  try {
    sql = require('mssql/msnodesqlv8');
    driverName = 'msnodesqlv8 (Windows authentication)';
  } catch (e) {
    console.warn('\n[!] msnodesqlv8 is not installed, so Windows authentication is unavailable.');
    console.warn('    Falling back to SQL authentication (tedious). See README.md "Option B".\n');
    config.auth = 'sql';
  }
}
if (!sql) {
  sql = require('mssql');
  driverName = 'tedious (SQL authentication)';
}

const ODBC_DRIVERS = ['ODBC Driver 18 for SQL Server', 'ODBC Driver 17 for SQL Server', 'SQL Server Native Client 11.0', 'SQL Server'];
let workingOdbcDriver = config.odbcDriver || null;

function buildConfig(odbcDriver) {
  const base = {
    requestTimeout: config.timeoutSec * 1000,
    connectionTimeout: 15000,
    pool: { max: 1, min: 0, idleTimeoutMillis: 1000 }
  };
  if (config.auth === 'windows') {
    return {
      ...base,
      driver: 'msnodesqlv8',
      connectionString:
        `Driver={${odbcDriver}};Server=${config.server};Database=master;` +
        `Trusted_Connection=Yes;Encrypt=no;TrustServerCertificate=Yes;APP=SQL Lab;`
    };
  }
  const [host, instance] = config.server.split('\\');
  return {
    ...base,
    server: host,
    port: instance ? undefined : config.sqlPort,
    database: 'master',
    user: config.user,
    password: config.password,
    options: { encrypt: false, trustServerCertificate: true, instanceName: instance, appName: 'SQL Lab' }
  };
}

// Each request gets its own single connection, so SET options and
// transactions carry across GO-separated batches like they do in SSMS.
async function openConnection() {
  if (config.auth !== 'windows') {
    const pool = new sql.ConnectionPool(buildConfig());
    await pool.connect();
    return pool;
  }
  const candidates = workingOdbcDriver ? [workingOdbcDriver] : ODBC_DRIVERS;
  let lastErr;
  for (const d of candidates) {
    try {
      const pool = new sql.ConnectionPool(buildConfig(d));
      await pool.connect();
      workingOdbcDriver = d;
      return pool;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// ---------------------------------------------------------------------------
// Batch execution
// ---------------------------------------------------------------------------
const SHOWPLAN_COL = 'Microsoft SQL Server 2005 XML Showplan';

function splitBatches(text) {
  // Split on lines that contain only GO, optionally followed by ; and/or a -- comment
  // (like SSMS: "GO", "go;", "GO   -- next batch"). "GO 5" (repeat count) is not supported.
  return text
    .split(/^[ \t]*GO[ \t]*;?[ \t]*(?:--[^\n]*)?$/gim)
    .map(s => s.replace(/^\s*\n/, '').replace(/\s+$/, ''))
    .filter(s => s.trim().length > 0);
}

function serialize(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().replace('T', ' ').replace('Z', '');
  if (Buffer.isBuffer(v)) return '0x' + v.toString('hex').toUpperCase();
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

function runBatch(pool, text, out, batchIndex) {
  return new Promise(resolve => {
    const req = new sql.Request(pool);
    req.stream = true;
    req.arrayRowMode = true;
    let current = null;
    const seenErrors = new Set();
    let finished = false;

    const closeRecordset = () => {
      if (!current) return;
      if (current.columns.length === 1 && current.columns[0] === SHOWPLAN_COL) {
        for (const r of current.rows) out.push({ type: 'plan', xml: String(r[0]) });
      } else {
        out.push(current);
      }
      current = null;
    };

    req.on('recordset', cols => {
      closeRecordset();
      const list = Array.isArray(cols) ? cols : Object.values(cols).sort((a, b) => a.index - b.index);
      current = {
        type: 'resultset',
        columns: list.map(c => (c.name === '' || c.name == null ? '(No column name)' : c.name)),
        rows: [],
        rowCount: 0,
        truncated: false
      };
    });
    req.on('row', row => {
      if (!current) return;
      current.rowCount++;
      if (current.rows.length < config.maxRows) current.rows.push(row.map(serialize));
      else current.truncated = true;
    });
    req.on('rowsaffected', n => {
      closeRecordset();
      out.push({ type: 'message', text: `(${n} row${n === 1 ? '' : 's'} affected)` });
    });
    req.on('info', m => {
      closeRecordset();
      out.push({ type: 'message', text: m.message });
    });
    req.on('error', err => {
      const errs = err.precedingErrors && err.precedingErrors.length ? [...err.precedingErrors, err] : [err];
      for (const e of errs) {
        const key = `${e.number}|${e.lineNumber}|${e.message}`;
        if (seenErrors.has(key)) continue;
        seenErrors.add(key);
        closeRecordset();
        out.push({
          type: 'error',
          number: e.number ?? null,
          severity: e.class ?? null,
          state: e.state ?? null,
          line: e.lineNumber ?? null,
          batch: batchIndex + 1,
          message: (e.originalError && e.originalError.message && !e.number ? e.originalError.message : e.message) || String(e)
        });
      }
    });
    req.on('done', () => {
      if (finished) return;
      finished = true;
      closeRecordset();
      resolve();
    });

    req.batch(text, () => {});
  });
}

async function runScript(pool, script, out, { firstBatchIndex = 0 } = {}) {
  const batches = splitBatches(script);
  for (let i = 0; i < batches.length; i++) {
    await runBatch(pool, batches[i], out, firstBatchIndex + i);
  }
  return batches.length;
}

// ---------------------------------------------------------------------------
// HTTP API
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/status', async (_req, res) => {
  let pool;
  try {
    pool = await openConnection();
    const r = await pool.request().query(
      `SELECT @@VERSION AS v, SERVERPROPERTY('Edition') AS e, CAST(SERVERPROPERTY('ProductVersion') AS varchar(30)) AS pv,
              DB_ID('${config.database}') AS dbid`
    );
    const row = r.recordset[0];
    let seeded = false;
    if (row.dbid) {
      const s = await pool.request().query(`SELECT OBJECT_ID('${config.database}.dbo.SetupInfo') AS o`);
      seeded = !!s.recordset[0].o;
    }
    res.json({
      connected: true,
      driver: driverName,
      odbcDriver: config.auth === 'windows' ? workingOdbcDriver : null,
      server: config.server,
      database: config.database,
      databaseExists: !!row.dbid,
      seeded,
      edition: row.e,
      version: row.pv,
      versionText: String(row.v).split('\n')[0]
    });
  } catch (e) {
    res.json({ connected: false, driver: driverName, server: config.server, error: e.message });
  } finally {
    if (pool) pool.close().catch(() => {});
  }
});

app.post('/api/setup', async (_req, res) => {
  const started = Date.now();
  const out = [];
  let pool;
  try {
    pool = await openConnection();
    const script = fs.readFileSync(path.join(__dirname, 'setup.sql'), 'utf8');
    await runScript(pool, script, out);
    const errors = out.filter(o => o.type === 'error');
    res.json({ ok: errors.length === 0, items: out, elapsedMs: Date.now() - started });
  } catch (e) {
    res.json({ ok: false, items: [{ type: 'error', message: e.message }], elapsedMs: Date.now() - started });
  } finally {
    if (pool) pool.close().catch(() => {});
  }
});

/*
  POST /api/query
  {
    sql:      "T-SQL text, GO separates batches",
    sandbox:  true  -> wrapped in BEGIN TRAN ... ROLLBACK (nothing is kept)
    plan:     true  -> SET STATISTICS XML ON (actual execution plans)
    stats:    true  -> SET STATISTICS IO, TIME ON
    check:    "optional T-SQL run after the user's SQL (inside the same sandbox) to grade it"
  }
*/
app.post('/api/query', async (req, res) => {
  const { sql: text = '', sandbox = false, plan = false, stats = false, check = null } = req.body || {};
  const started = Date.now();
  const items = [];
  const checkItems = [];
  let pool;
  try {
    pool = await openConnection();
    const silent = [];
    await runBatch(pool, `USE [${config.database}];`, silent, -1);
    const useErr = silent.find(s => s.type === 'error');
    if (useErr) {
      return res.json({
        ok: false,
        items: [{ type: 'error', message: `Database ${config.database} not found. Click "Set up practice database" in the top bar first.` }]
      });
    }
    if (sandbox) await runBatch(pool, 'SET XACT_ABORT OFF; BEGIN TRANSACTION;', silent, -1);
    if (stats) await runBatch(pool, 'SET STATISTICS IO ON; SET STATISTICS TIME ON;', silent, -1);
    if (plan) await runBatch(pool, 'SET STATISTICS XML ON;', silent, -1);

    await runScript(pool, text, items);

    if (plan) await runBatch(pool, 'SET STATISTICS XML OFF;', silent, -1);
    if (stats) await runBatch(pool, 'SET STATISTICS IO OFF; SET STATISTICS TIME OFF;', silent, -1);
    if (check) await runScript(pool, check, checkItems);

    let committedWarning = false;
    if (sandbox) {
      const t = [];
      await runBatch(pool, 'SELECT @@TRANCOUNT AS tc;', t, -1);
      const rs = t.find(x => x.type === 'resultset');
      committedWarning = rs && rs.rows[0] && rs.rows[0][0] === 0;
      await runBatch(pool, 'IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;', silent, -1);
    }
    res.json({ ok: !items.some(i => i.type === 'error'), items, check: check ? checkItems : null, committedWarning, elapsedMs: Date.now() - started });
  } catch (e) {
    res.json({ ok: false, items: [...items, { type: 'error', message: e.message }], elapsedMs: Date.now() - started });
  } finally {
    if (pool) pool.close().catch(() => {});
  }
});

app.listen(config.port, config.host, () => {
  console.log('');
  console.log('  SQL Lab is running');
  console.log(`  Open:     http://localhost:${config.port}`);
  console.log(`  Server:   ${config.server}   Database: ${config.database}`);
  console.log(`  Driver:   ${driverName}`);
  console.log('  Stop:     Ctrl+C');
  console.log('');
});
