/* SQL Lab – front-end engine.
   Lessons live in /lessons/*.js and push objects into window.LESSONS.
   Block types: h2, h3, p, list, code, table, er, erPair, callout, quiz, exercise, flash, reveal, html */
(function () {
  'use strict';

  const LESSONS = window.LESSONS || [];
  const $ = (sel, root = document) => root.querySelector(sel);
  const el = (tag, attrs = {}, ...children) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'html') n.innerHTML = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const c of children.flat()) {
      if (c === null || c === undefined || c === false) continue;
      n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    }
    return n;
  };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // ---------------------------------------------------------------------------
  // Tiny markdown: paragraphs, "- " lists, "1. " lists, **bold**, *em*, `code`, [text](url)
  // ---------------------------------------------------------------------------
  function inline(s) {
    let out = esc(s);
    out = out.replace(/`([^`]+)`/g, (_, c) => `<code>${c}</code>`);
    out = out.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    out = out.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, u) => `<a href="${u}"${u.startsWith('#') ? '' : ' target="_blank" rel="noopener"'}>${t}</a>`);
    return out;
  }
  function md(text) {
    if (!text) return '';
    const lines = String(text).replace(/^\n+|\s+$/g, '').split('\n');
    const html = [];
    let para = [], list = null;
    const flushPara = () => { if (para.length) { html.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
    const flushList = () => { if (list) { html.push(`<${list.tag}>${list.items.map(i => `<li>${inline(i)}</li>`).join('')}</${list.tag}>`); list = null; } };
    for (const raw of lines) {
      const line = raw.trim();
      const ul = /^[-•]\s+(.*)$/.exec(line);
      const ol = /^\d+[.)]\s+(.*)$/.exec(line);
      if (!line) { flushPara(); flushList(); continue; }
      if (ul || ol) {
        flushPara();
        const tag = ul ? 'ul' : 'ol';
        if (!list || list.tag !== tag) { flushList(); list = { tag, items: [] }; }
        list.items.push((ul || ol)[1]);
      } else if (list && /^\s{2,}/.test(raw)) {
        list.items[list.items.length - 1] += ' ' + line;
      } else {
        flushList();
        para.push(line);
      }
    }
    flushPara(); flushList();
    return html.join('');
  }

  // ---------------------------------------------------------------------------
  // Progress (localStorage, best effort)
  // ---------------------------------------------------------------------------
  const store = {
    load() { try { return JSON.parse(localStorage.getItem('sqllab.progress')) || {}; } catch { return {}; } },
    save(p) { try { localStorage.setItem('sqllab.progress', JSON.stringify(p)); } catch { /* ignore */ } }
  };
  const progress = Object.assign({ visited: {}, passed: {}, quiz: {} }, store.load());
  function markVisited(id) { progress.visited[id] = true; store.save(progress); updateProgressPill(); }
  function markPassed(id) { progress.passed[id] = true; store.save(progress); updateProgressPill(); renderNav(); }
  function totalExercises() { let n = 0; for (const l of LESSONS) for (const b of l.blocks || []) if (b.type === 'exercise') n++; return n; }
  function updateProgressPill() {
    const visited = LESSONS.filter(l => progress.visited[l.id]).length;
    const passed = Object.keys(progress.passed).length;
    $('#progressPill').textContent = `${visited}/${LESSONS.length} lessons · ${passed}/${totalExercises()} exercises`;
  }

  // ---------------------------------------------------------------------------
  // API
  // ---------------------------------------------------------------------------
  let serverState = { connected: false };
  async function api(path, body) {
    const res = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }
  async function runSql(opts) {
    try {
      return await api('/api/query', opts);
    } catch (e) {
      return { ok: false, items: [{ type: 'error', message: location.protocol === 'file:' ? 'Open the app through the server: run start.bat, then go to http://localhost:5080' : 'Could not reach the SQL Lab server. Is start.bat (node server.js) still running? ' + e.message }] };
    }
  }

  async function refreshStatus() {
    const box = $('#status');
    const txt = $('#statusText');
    try {
      const s = await api('/api/status');
      serverState = s;
      box.className = 'status ' + (s.connected ? (s.seeded ? 'ok' : 'warn') : 'bad');
      if (!s.connected) {
        txt.textContent = 'Not connected to SQL Server – see Getting started';
        txt.title = s.error || '';
      } else {
        const ver = (s.versionText || '').replace(/\(.*/, '').trim();
        txt.textContent = `${ver || 'SQL Server'} · ${s.edition || ''} · ${s.seeded ? s.database + ' ready' : s.database + ' not set up yet'}`;
        txt.title = `${s.versionText}\nDriver: ${s.driver}${s.odbcDriver ? ' / ' + s.odbcDriver : ''}`;
      }
      $('#setupBtn').classList.toggle('btn-primary', s.connected && !s.seeded);
      $('#setupBtn').classList.toggle('btn-ghost', !(s.connected && !s.seeded));
    } catch (e) {
      box.className = 'status bad';
      txt.textContent = location.protocol === 'file:' ? 'Open via http://localhost:5080 (run start.bat)' : 'SQL Lab server is not running – run start.bat';
    }
  }

  function openModal(title, body) {
    $('#modalTitle').textContent = title;
    const mb = $('#modalBody');
    mb.innerHTML = '';
    mb.append(body);
    $('#modal').hidden = false;
  }
  $('#modalClose').addEventListener('click', () => { $('#modal').hidden = true; });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') $('#modal').hidden = true; });

  async function setupDatabase() {
    const body = el('div', {}, el('p', {}, 'Creating ShopDB and loading sample data (including 300,000 rows in BigOrders). This takes 5–30 seconds…'));
    openModal('Set up practice database', body);
    const btn = $('#setupBtn');
    btn.disabled = true;
    try {
      const r = await api('/api/setup', {});
      body.innerHTML = '';
      body.append(el('p', { class: r.ok ? '' : 'error-banner' }, r.ok ? `Done in ${(r.elapsedMs / 1000).toFixed(1)} s. You can run every example now.` : 'Setup reported errors:'));
      const log = el('pre', { class: 'msg-log' });
      for (const it of r.items) {
        if (it.type === 'message') log.append(el('span', {}, it.text + '\n'));
        if (it.type === 'error') log.append(el('span', { class: 'err' }, formatError(it) + '\n'));
      }
      body.append(log);
    } catch (e) {
      body.innerHTML = '';
      body.append(el('p', { class: 'error-banner' }, 'Could not reach the server: ' + e.message));
    } finally {
      btn.disabled = false;
      refreshStatus();
    }
  }
  $('#setupBtn').addEventListener('click', setupDatabase);

  // ---------------------------------------------------------------------------
  // Editor (CodeMirror 5, falls back to a textarea if the CDN is unreachable)
  // ---------------------------------------------------------------------------
  function makeEditor(host, value, onRun, { minLines = 1 } = {}) {
    if (window.CodeMirror) {
      const cm = window.CodeMirror(host, {
        value: value || '',
        mode: 'text/x-mssql',
        lineNumbers: true,
        matchBrackets: true,
        indentUnit: 4,
        tabSize: 4,
        viewportMargin: Infinity,
        lineWrapping: false,
        extraKeys: { 'Ctrl-Enter': () => onRun && onRun(), 'Cmd-Enter': () => onRun && onRun(), F5: () => onRun && onRun() }
      });
      if (minLines > 1) cm.getScrollerElement().style.minHeight = (minLines * 20 + 10) + 'px';   // grows with content
      return { getValue: () => cm.getValue(), setValue: v => cm.setValue(v), focus: () => cm.focus(), refresh: () => cm.refresh(), getSelection: () => cm.getSelection() };
    }
    const ta = el('textarea', { class: 'fallback-editor', spellcheck: 'false' });
    ta.value = value || '';
    ta.rows = Math.max(minLines, String(value || '').split('\n').length + 1);
    ta.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onRun && onRun(); } });
    host.append(ta);
    return { getValue: () => ta.value, setValue: v => { ta.value = v; }, focus: () => ta.focus(), refresh: () => {}, getSelection: () => ta.value.substring(ta.selectionStart, ta.selectionEnd) };
  }

  // ---------------------------------------------------------------------------
  // Results rendering (Results | Messages | Execution plan tabs, like SSMS)
  // ---------------------------------------------------------------------------
  function formatError(e) {
    if (e.number == null) return e.message;
    return `Msg ${e.number}, Level ${e.severity ?? '?'}, State ${e.state ?? '?'}${e.line != null ? ', Line ' + e.line : ''}${e.batch ? ' (batch ' + e.batch + ')' : ''}\n${e.message}`;
  }
  const isNum = v => typeof v === 'number';

  function renderGrid(rs) {
    const wrap = el('div', { class: 'grid-wrap' });
    const t = el('table', { class: 'grid' });
    t.append(el('thead', {}, el('tr', {}, el('th', { class: 'rn' }, ''), rs.columns.map(c => el('th', {}, c)))));
    const tb = el('tbody');
    rs.rows.forEach((r, i) => {
      tb.append(el('tr', {}, el('td', { class: 'rn' }, i + 1), r.map(v => v === null ? el('td', { class: 'null' }, 'NULL') : el('td', { class: isNum(v) ? 'num' : '' }, String(v)))));
    });
    t.append(tb);
    wrap.append(t);
    return wrap;
  }

  function renderResults(host, resp, { meta = '' } = {}) {
    host.innerHTML = '';
    const items = resp.items || [];
    const sets = items.filter(i => i.type === 'resultset');
    const plans = items.filter(i => i.type === 'plan');
    const errors = items.filter(i => i.type === 'error');

    const tabs = el('div', { class: 'res-tabs' });
    const panes = {};
    const tabBtns = {};
    const addTab = (key, label, count, isErr) => {
      const b = el('button', { class: 'res-tab', onclick: () => select(key) }, label, count != null ? el('span', { class: 'n' + (isErr ? ' err' : '') }, count) : null);
      tabBtns[key] = b;
      tabs.append(b);
      panes[key] = el('div', { class: 'res-pane', hidden: true });
    };
    const select = key => {
      for (const k of Object.keys(panes)) { panes[k].hidden = k !== key; tabBtns[k].classList.toggle('active', k === key); }
    };
    addTab('results', 'Results', sets.length);
    addTab('messages', 'Messages', errors.length || null, errors.length > 0);
    if (plans.length) addTab('plan', 'Execution plan', plans.length);
    tabs.append(el('span', { class: 'res-meta' }, meta || (resp.elapsedMs != null ? `${resp.elapsedMs} ms` : '')));

    // Results pane
    const rp = panes.results;
    if (resp.committedWarning) rp.append(el('div', { class: 'info-banner' }, 'Heads-up: your code ended the sandbox transaction (COMMIT or ROLLBACK), so later statements were NOT rolled back automatically.'));
    for (const e of errors) rp.append(el('div', { class: 'error-banner', html: `<b>${esc(formatError(e).split('\n')[0])}</b><br>${esc(e.message)}` }));
    for (const rs of sets) {
      rp.append(renderGrid(rs));
      rp.append(el('div', { class: 'grid-foot' }, `${rs.rowCount} row${rs.rowCount === 1 ? '' : 's'}${rs.truncated ? ` (showing first ${rs.rows.length})` : ''}`));
    }
    if (!sets.length && !errors.length) {
      const msgs = items.filter(i => i.type === 'message').map(i => i.text);
      rp.append(el('div', { class: 'empty-note' }, msgs.length ? 'No result sets. ' + msgs.slice(-3).join('  ') : 'Commands completed successfully.'));
    }

    // Messages pane
    const log = el('pre', { class: 'msg-log' });
    for (const it of items) {
      if (it.type === 'message') log.append(el('span', {}, it.text + '\n'));
      else if (it.type === 'error') log.append(el('span', { class: 'err' }, formatError(it) + '\n'));
      else if (it.type === 'resultset') log.append(el('span', { class: 'ok' }, `(${it.rowCount} row${it.rowCount === 1 ? '' : 's'} returned)\n`));
    }
    if (!errors.length) log.append(el('span', { class: 'ok' }, '\nCompletion time: ' + new Date().toLocaleTimeString() + (resp.elapsedMs != null ? ` (${resp.elapsedMs} ms)` : '')));
    panes.messages.append(log);

    // Plan pane
    if (plans.length) {
      panes.plan.append(el('div', { class: 'plan-legend' }, el('span', { class: 'l-seek' }, 'Seek (good)'), el('span', { class: 'l-scan' }, 'Scan'), el('span', { class: 'l-lookup' }, 'Key/RID lookup'), el('span', { class: 'l-sort' }, 'Sort / spill risk'), el('span', {}, 'Read top-down: the top operator returns rows to you; children feed their parent.')));
      for (const p of plans) panes.plan.append(renderPlan(p.xml));
    }

    host.append(tabs, ...Object.values(panes));
    select(errors.length && !sets.length ? 'results' : sets.length ? 'results' : plans.length ? 'plan' : 'messages');
    if (!sets.length && !errors.length && plans.length) select('plan');
    return { select };
  }

  // ---------------------------------------------------------------------------
  // Execution plan viewer (parses showplan XML from SET STATISTICS XML ON)
  // ---------------------------------------------------------------------------
  const childEls = n => Array.from(n.children || []);
  function directRelOps(node) {
    const out = [];
    const walk = n => { for (const c of childEls(n)) { if (c.localName === 'RelOp') out.push(c); else walk(c); } };
    walk(node);
    return out;
  }
  function findOwn(node, name) {
    // first descendant called `name` that is not inside a nested RelOp
    let found = null;
    const walk = n => { for (const c of childEls(n)) { if (found) return; if (c.localName === 'RelOp') continue; if (c.localName === name) { found = c; return; } walk(c); } };
    walk(node);
    return found;
  }
  function renderPlan(xml) {
    const box = el('div');
    let doc;
    try { doc = new DOMParser().parseFromString(xml, 'application/xml'); } catch { doc = null; }
    if (!doc || doc.getElementsByTagName('parsererror').length) { box.append(el('pre', { class: 'msg-log' }, xml.slice(0, 4000))); return box; }
    const stmts = Array.from(doc.getElementsByTagName('*')).filter(n => n.localName === 'StmtSimple' && childEls(n).some(c => c.localName === 'QueryPlan'));
    for (const st of stmts) {
      const qp = childEls(st).find(c => c.localName === 'QueryPlan');
      const root = childEls(qp).find(c => c.localName === 'RelOp');
      if (!root) continue;
      const rootCost = parseFloat(root.getAttribute('EstimatedTotalSubtreeCost')) || 0;
      const card = el('div', { class: 'plan-stmt' });
      const sqlText = (st.getAttribute('StatementText') || '').trim();
      card.append(el('div', { class: 'plan-stmt-head' }, el('span', { class: 'sql' }, sqlText), el('span', { class: 'cost' }, `Estimated subtree cost: ${rootCost.toFixed(4)}${st.getAttribute('StatementOptmEarlyAbortReason') ? ' · ' + st.getAttribute('StatementOptmEarlyAbortReason') : ''}`)));

      const tree = el('div', { class: 'plan-tree' });
      const ul = el('ul');
      ul.append(renderRelOp(root, rootCost));
      tree.append(ul);
      card.append(tree);

      // warnings
      const warns = [];
      for (const w of Array.from(qp.getElementsByTagName('*')).filter(n => n.localName === 'PlanAffectingConvert')) {
        warns.push(`Implicit conversion may stop an index seek: ${w.getAttribute('Expression')} (${w.getAttribute('ConvertIssue')})`);
      }
      for (const w of Array.from(qp.getElementsByTagName('*')).filter(n => n.localName === 'SpillToTempDb')) warns.push('A sort or hash spilled to tempdb (not enough memory granted).');
      for (const w of Array.from(qp.getElementsByTagName('*')).filter(n => n.localName === 'NoJoinPredicate')) warns.push('No join predicate: this join produces a cartesian product.');
      for (const w of new Set(warns)) card.append(el('div', { class: 'plan-warn' }, '⚠ ' + w));

      // missing indexes
      for (const g of Array.from(qp.getElementsByTagName('*')).filter(n => n.localName === 'MissingIndexGroup')) {
        const impact = parseFloat(g.getAttribute('Impact')) || 0;
        const mi = Array.from(g.getElementsByTagName('*')).find(n => n.localName === 'MissingIndex');
        if (!mi) continue;
        const cols = { EQUALITY: [], INEQUALITY: [], INCLUDE: [] };
        for (const cg of childEls(mi).filter(c => c.localName === 'ColumnGroup')) {
          const usage = cg.getAttribute('Usage');
          for (const c of childEls(cg)) cols[usage] && cols[usage].push(c.getAttribute('Name'));
        }
        const keys = [...cols.EQUALITY, ...cols.INEQUALITY];
        const table = `${mi.getAttribute('Schema')}.${mi.getAttribute('Table')}`;
        const name = 'IX_' + mi.getAttribute('Table').replace(/[[\]]/g, '') + '_' + keys.map(k => k.replace(/[[\]]/g, '')).join('_');
        const stmt = `CREATE NONCLUSTERED INDEX ${name}\n    ON ${table} (${keys.join(', ')})${cols.INCLUDE.length ? `\n    INCLUDE (${cols.INCLUDE.join(', ')})` : ''};`;
        card.append(el('div', { class: 'plan-missing' }, `SQL Server suggests a missing index (estimated ${impact.toFixed(0)}% improvement). Treat it as a hint, not an order:`, el('code', {}, stmt)));
      }
      box.append(card);
    }
    if (!box.children.length) box.append(el('div', { class: 'empty-note' }, 'This statement had no query plan (e.g. a trivial SET or DDL statement).'));
    return box;
  }
  function renderRelOp(op, rootCost) {
    const phys = op.getAttribute('PhysicalOp') || '';
    const logical = op.getAttribute('LogicalOp') || '';
    const kids = directRelOps(op);
    const subtree = parseFloat(op.getAttribute('EstimatedTotalSubtreeCost')) || 0;
    const kidsCost = kids.reduce((s, k) => s + (parseFloat(k.getAttribute('EstimatedTotalSubtreeCost')) || 0), 0);
    const own = Math.max(0, subtree - kidsCost);
    const pct = rootCost > 0 ? (own / rootCost) * 100 : 0;
    const estRows = parseFloat(op.getAttribute('EstimateRows'));
    let actual = null, reads = null;
    const rti = childEls(op).find(c => c.localName === 'RunTimeInformation');
    if (rti) {
      actual = 0;
      for (const t of childEls(rti)) {
        actual += parseInt(t.getAttribute('ActualRows') || '0', 10);
        if (t.getAttribute('ActualLogicalReads') != null) reads = (reads || 0) + parseInt(t.getAttribute('ActualLogicalReads'), 10);
      }
    }
    const obj = findOwn(op, 'Object');
    let objText = '';
    if (obj) {
      const tbl = obj.getAttribute('Table'), idx = obj.getAttribute('Index');
      objText = [tbl, idx].filter(Boolean).join('.');
    }
    const lookup = /Lookup/i.test(phys) || (phys === 'Clustered Index Seek' && /Lookup/i.test(logical)) || childEls(op).some(c => c.getAttribute && c.getAttribute('Lookup') === 'true');
    let cls = 'plan-node';
    if (lookup || /RID Lookup|Key Lookup/.test(logical)) cls += ' lookup';
    else if (/Seek/.test(phys)) cls += ' seek';
    else if (/Scan/.test(phys)) cls += ' scan';
    else if (/Sort|Spool|Hash Match/.test(phys)) cls += ' sort';
    if (pct >= 40) cls += ' hot';
    const label = lookup && phys === 'Clustered Index Seek' ? 'Key Lookup (Clustered)' : phys;
    const node = el('div', { class: cls },
      el('span', { class: 'op' }, label + (logical && logical !== phys && !lookup ? ` (${logical})` : '')),
      objText ? el('span', { class: 'obj' }, objText) : null,
      el('span', { class: 'pct' }, `${pct.toFixed(0)}%`),
      el('span', { class: 'st' }, `est. rows ${isNaN(estRows) ? '?' : Math.round(estRows).toLocaleString()}${actual != null ? ` · actual ${actual.toLocaleString()}` : ''}${reads != null ? ` · reads ${reads.toLocaleString()}` : ''}`)
    );
    const li = el('li', {}, node);
    if (kids.length) {
      const ul = el('ul');
      for (const k of kids) ul.append(renderRelOp(k, rootCost));
      li.append(ul);
    }
    return li;
  }

  // ---------------------------------------------------------------------------
  // Runnable snippet
  // ---------------------------------------------------------------------------
  let snippetSeq = 0;
  function renderSnippet(b, { playground = false } = {}) {
    const id = 'snip' + (++snippetSeq);
    const opts = { sandbox: b.sandbox !== false, plan: !!b.plan, stats: !!b.stats };
    const box = el('div', { class: 'snippet', id });
    const head = el('div', { class: 'snippet-head' });
    const results = el('div', { class: 'results' });
    let editor;
    const run = async () => {
      const text = (editor.getSelection && editor.getSelection().trim()) || editor.getValue();
      runBtn.disabled = true;
      runBtn.textContent = 'Running…';
      results.innerHTML = '<div class="res-pane"><span class="empty-note">Executing…</span></div>';
      const resp = await runSql({ sql: text, sandbox: opts.sandbox, plan: opts.plan, stats: opts.stats });
      renderResults(results, resp);
      runBtn.disabled = false;
      runBtn.innerHTML = '&#9654; Run <span class="kbd">Ctrl+Enter</span>';
    };
    const runBtn = el('button', { class: 'btn btn-primary', onclick: run, html: '&#9654; Run <span class="kbd">Ctrl+Enter</span>' });
    const mkToggle = (key, label, title) => {
      const cb = el('input', { type: 'checkbox' });
      cb.checked = opts[key];
      cb.addEventListener('change', () => { opts[key] = cb.checked; updateBadge(); });
      return el('label', { class: 'toggle', title }, cb, label);
    };
    const badge = el('span', { class: 'badge' });
    const updateBadge = () => {
      badge.className = 'badge ' + (opts.sandbox ? 'sandbox' : 'keep');
      badge.textContent = opts.sandbox ? 'Sandbox: rolled back' : 'Changes are kept';
      badge.title = opts.sandbox ? 'Runs inside BEGIN TRAN … ROLLBACK, so the database is unchanged afterwards.' : 'Runs for real. Use "Set up practice database" to reset ShopDB at any time.';
    };
    updateBadge();
    head.append(
      el('span', { class: 'snippet-title' }, b.title || (playground ? 'Query editor' : 'T-SQL')),
      badge,
      mkToggle('sandbox', 'Sandbox', 'Wrap in a transaction and roll back'),
      mkToggle('plan', 'Plan', 'Include actual execution plan (SET STATISTICS XML ON)'),
      mkToggle('stats', 'IO/Time', 'SET STATISTICS IO, TIME ON – see the Messages tab'),
      !playground ? el('button', { class: 'btn btn-ghost', title: 'Open in the Playground', onclick: () => { sessionStorage.setItem('sqllab.pg', editor.getValue()); location.hash = 'playground'; } }, 'Playground ↗') : null,
      el('button', { class: 'btn', onclick: () => { editor.setValue(b.sql); results.innerHTML = ''; }, title: 'Restore the original code' }, 'Reset'),
      runBtn
    );
    const host = el('div');
    box.append(head, host);
    if (b.note) box.append(el('div', { class: 'snippet-note', html: inline(b.note) }));
    box.append(results);
    editor = makeEditor(host, b.sql, run, { minLines: playground ? 14 : 1 });
    box._editor = editor;
    box._run = run;
    return box;
  }

  // ---------------------------------------------------------------------------
  // Other blocks
  // ---------------------------------------------------------------------------
  function renderTable(b) {
    const wrap = el('div', { class: 'tbl-wrap' });
    const t = el('table', { class: 'prose' + (b.cls ? ' ' + b.cls : '') });
    if (b.head) t.append(el('thead', {}, el('tr', {}, b.head.map(h => el('th', { html: inline(h) })))));
    const tb = el('tbody');
    (b.rows || []).forEach(r => {
      tb.append(el('tr', {}, r.map((c, ci) => {
        let cls = '';
        let text = c;
        if (typeof c === 'object' && c !== null) { cls = c.cls || ''; text = c.v; }
        const mark = b.pk && b.pk.includes(ci) ? 'pk' : b.fk && b.fk.includes(ci) ? 'fk' : '';
        return el('td', { class: [cls, mark].filter(Boolean).join(' '), html: inline(text == null ? '' : String(text)) });
      })));
    });
    t.append(tb);
    wrap.append(t);
    const frag = el('div');
    if (b.title) frag.append(el('div', { style: 'font-weight:600;font-size:14px;margin-top:14px' }, b.title));
    frag.append(wrap);
    if (b.caption) frag.append(el('div', { class: 'tbl-caption', html: inline(b.caption) }));
    return frag;
  }

  let erSeq = 0;
  function erBox(diagram, caption) {
    const box = el('div', { class: 'er' });
    box.dataset.diagram = diagram;
    box.append(el('div', { class: 'er-body' }, 'Drawing diagram…'));
    if (caption) box.append(el('div', { class: 'er-caption', html: inline(caption) }));
    return box;
  }
  async function drawDiagrams(root) {
    const boxes = root.querySelectorAll('.er[data-diagram]');
    if (!boxes.length) return;
    if (!window.mermaid) {
      boxes.forEach(b => { b.querySelector('.er-body').replaceWith(el('pre', { class: 'msg-log', style: 'text-align:left' }, b.dataset.diagram)); });
      return;
    }
    for (const b of boxes) {
      const body = b.querySelector('.er-body');
      try {
        const { svg } = await window.mermaid.render('er' + (++erSeq), b.dataset.diagram.trim());
        body.innerHTML = svg;
      } catch (e) {
        body.replaceWith(el('pre', { class: 'msg-log', style: 'text-align:left' }, 'Diagram error: ' + e.message + '\n\n' + b.dataset.diagram));
      }
    }
  }

  function renderQuiz(b, lessonId, idx) {
    const key = `${lessonId}#${idx}`;
    const box = el('div', { class: 'quiz' });
    box.append(el('div', { class: 'q', html: `<span class="label">Check yourself</span>${inline(b.q)}` }));
    const explain = el('div', { class: 'explain' });
    const btns = b.options.map((o, i) => el('button', {
      class: 'opt', html: inline(o), onclick: () => {
        btns.forEach((x, j) => { x.disabled = true; if (j === b.answer) x.classList.add('right'); });
        if (i !== b.answer) btns[i].classList.add('wrong');
        explain.innerHTML = (i === b.answer ? '<b>Correct.</b> ' : '<b>Not quite.</b> ') + inline(b.explain || '');
        progress.quiz[key] = i === b.answer; store.save(progress);
      }
    }));
    box.append(...btns, explain);
    return box;
  }

  // ---------------------------------------------------------------------------
  // Step-by-step animation: frames stacked in one grid cell, fading between steps.
  // Elements with class "pop" inside a frame animate each time the frame is shown
  // (use style="--d:.4s" to delay one element).
  // ---------------------------------------------------------------------------
  const animTimers = new Set();
  function stopAllAnimations() { for (const t of animTimers) clearInterval(t); animTimers.clear(); }
  function renderAnim(b) {
    const n = b.frames.length;
    const box = el('div', { class: 'anim' });
    const stage = el('div', { class: 'anim-stage' });
    const frames = b.frames.map(f => el('div', { class: 'anim-frame', html: f.html }));
    frames.forEach(f => stage.append(f));
    const caption = el('div', { class: 'anim-caption' });
    const counter = el('span', { class: 'anim-count' });
    let idx = 0, timer = null;
    const show = i => {
      idx = Math.max(0, Math.min(n - 1, i));
      frames.forEach((f, j) => { f.classList.toggle('active', j === idx); f.classList.remove('play'); });
      void frames[idx].offsetWidth;            // restart CSS animations
      frames[idx].classList.add('play');
      caption.innerHTML = md(b.frames[idx].caption || '');
      counter.textContent = `Step ${idx + 1} of ${n}`;
      dots.forEach((d, j) => d.classList.toggle('on', j === idx));
      prevBtn.disabled = idx === 0;
      nextBtn.disabled = idx === n - 1;
    };
    const stop = () => {
      if (timer) { clearInterval(timer); animTimers.delete(timer); timer = null; }
      playBtn.innerHTML = '&#9654; Play';
    };
    const play = () => {
      if (timer) return stop();
      if (idx === n - 1) show(0);
      playBtn.innerHTML = '&#10074;&#10074; Pause';
      timer = setInterval(() => { if (idx >= n - 1) stop(); else show(idx + 1); }, b.interval || 3200);
      animTimers.add(timer);
    };
    const prevBtn = el('button', { class: 'btn', onclick: () => { stop(); show(idx - 1); } }, '◀ Back');
    const playBtn = el('button', { class: 'btn btn-primary', onclick: play, html: '&#9654; Play' });
    const nextBtn = el('button', { class: 'btn', onclick: () => { stop(); show(idx + 1); } }, 'Next ▶');
    const dots = b.frames.map((_, i) => el('button', { class: 'anim-dot', title: 'Step ' + (i + 1), onclick: () => { stop(); show(i); } }));
    box.append(
      el('div', { class: 'anim-head' }, el('span', { class: 'anim-title' }, '🎬 ' + (b.title || 'Animation')), counter),
      stage,
      caption,
      el('div', { class: 'anim-controls' }, prevBtn, playBtn, nextBtn, el('div', { class: 'anim-dots' }, dots))
    );
    show(0);
    return box;
  }

  function renderFlash(b) {
    const frag = el('div');
    const grid = el('div', { class: 'flash-grid' });
    const cards = b.cards.map(c => el('div', { class: 'flash', onclick: e => e.currentTarget.classList.toggle('open') },
      el('div', { class: 'fq', html: inline(c.q) }),
      el('div', { class: 'fa', html: md(c.a) }),
      el('div', { class: 'hint' }, 'Answer out loud, then click to reveal')));
    grid.append(...cards);
    frag.append(el('div', { class: 'flash-tools' },
      el('button', { class: 'btn', onclick: () => cards.forEach(c => c.classList.add('open')) }, 'Show all answers'),
      el('button', { class: 'btn', onclick: () => cards.forEach(c => c.classList.remove('open')) }, 'Hide all'),
      el('button', { class: 'btn', onclick: () => { cards.sort(() => Math.random() - 0.5).forEach(c => grid.append(c)); } }, 'Shuffle')), grid);
    return frag;
  }

  // ---------------------------------------------------------------------------
  // Graded exercises
  // ---------------------------------------------------------------------------
  const norm = v => {
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return (Math.round(v * 100) / 100).toString();
    const s = String(v).trim();
    if (/^-?\d+(\.\d+)?$/.test(s)) return (Math.round(parseFloat(s) * 100) / 100).toString();
    return s;
  };
  const lastSet = resp => [...(resp.items || [])].reverse().find(i => i.type === 'resultset');

  function compareSets(got, want, ordered) {
    if (!got) return { ok: false, why: 'Your query did not return a result set.' };
    if (got.columns.length !== want.columns.length) return { ok: false, why: `Expected ${want.columns.length} column(s) (${want.columns.join(', ')}), got ${got.columns.length} (${got.columns.join(', ')}).` };
    if (got.rowCount !== want.rowCount) return { ok: false, why: `Expected ${want.rowCount} row(s), got ${got.rowCount}.` };
    const g = got.rows.map(r => r.map(norm).join(' | '));
    const w = want.rows.map(r => r.map(norm).join(' | '));
    if (!ordered) { g.sort(); w.sort(); }
    for (let i = 0; i < w.length; i++) {
      if (g[i] !== w[i]) return { ok: false, why: `Row ${i + 1}${ordered ? '' : ' (after sorting)'} differs.\nExpected: ${w[i]}\nGot:      ${g[i]}` };
    }
    return { ok: true };
  }

  function renderExercise(b) {
    const passed = !!progress.passed[b.id];
    const box = el('div', { class: 'exercise' + (passed ? ' passed' : ''), id: 'ex-' + b.id });
    const titleEl = el('h4', {}, b.title, passed ? el('span', { class: 'pass-badge' }, 'Passed') : null);
    box.append(el('div', { class: 'ex-head' }, titleEl), el('div', { class: 'ex-prompt', html: md(b.prompt) }));
    const host = el('div', { class: 'snippet', style: 'margin:0;border-radius:0;border-left:0;border-right:0' });
    const edHost = el('div');
    host.append(edHost);
    const results = el('div', { class: 'results' });
    const grade = el('div', { class: 'grade' });
    const solBox = el('div', { class: 'ex-solution' });
    let editor;

    const check = async () => {
      checkBtn.disabled = true; checkBtn.textContent = 'Checking…';
      grade.className = 'grade'; grade.textContent = '';
      const userSql = editor.getValue();
      let verdict;
      if (b.grade && b.grade.mode === 'check') {
        const r = await runSql({ sql: userSql, sandbox: true, check: b.grade.check });
        r.committedWarning = false;
        renderResults(results, r);
        const errs = (r.items || []).filter(i => i.type === 'error');
        // every result set with Test + Pass columns counts (each check batch reports its own rows)
        const sets = (r.check || []).filter(i => i.type === 'resultset' && i.columns.some(c => /^test$/i.test(c)) && i.columns.some(c => /^pass$/i.test(c)));
        const checkErr = r.check ? r.check.find(i => i.type === 'error') : null;
        if (!sets.length) {
          verdict = { ok: false, why: errs.length ? 'Your code raised an error: ' + errs[0].message : checkErr ? 'The checker could not run: ' + checkErr.message : 'The checker returned nothing.' };
        } else {
          const tests = [];
          for (const cs of sets) {
            const ti = cs.columns.findIndex(c => /^test$/i.test(c));
            const pi = cs.columns.findIndex(c => /^pass$/i.test(c));
            for (const row of cs.rows) tests.push({ name: row[ti], pass: row[pi] === 1 || row[pi] === true || row[pi] === '1' });
          }
          if (b.grade.expect && tests.length < b.grade.expect) tests.push({ name: 'Some checks did not run (a batch was aborted). Look at the Messages tab.', pass: false });
          if (errs.length) tests.unshift({ name: 'Your code ran without errors (first error: ' + errs[0].message + ')', pass: false });
          verdict = { ok: tests.length > 0 && tests.every(t => t.pass), tests };
        }
      } else {
        const r = await runSql({ sql: userSql, sandbox: true });
        renderResults(results, r);
        const errs = (r.items || []).filter(i => i.type === 'error');
        const code = userSql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
        const forbidden = (b.grade && b.grade.forbid || []).find(f => new RegExp(f.re, 'i').test(code));
        const missing = (b.grade && b.grade.require || []).find(f => !new RegExp(f.re, 'i').test(code));
        if (errs.length) verdict = { ok: false, why: 'Your query raised an error: ' + errs[0].message };
        else if (forbidden) verdict = { ok: false, why: forbidden.msg };
        else if (missing) verdict = { ok: false, why: missing.msg };
        else {
          const s = await runSql({ sql: b.solution, sandbox: true });
          const want = lastSet(s);
          if (!want) verdict = { ok: false, why: 'Could not run the reference solution. Is ShopDB set up?' };
          else verdict = compareSets(lastSet(r), want, b.grade && b.grade.ordered);
        }
      }
      grade.className = 'grade ' + (verdict.ok ? 'pass' : 'fail');
      if (verdict.tests) {
        grade.innerHTML = `<b>${verdict.ok ? 'All checks passed.' : 'Some checks failed.'}</b><ul>${verdict.tests.map(t => `<li>${t.pass ? '✔' : '✘'} ${esc(t.name)}</li>`).join('')}</ul>`;
      } else {
        grade.innerHTML = verdict.ok ? '<b>Correct!</b> Your result matches the expected output.' : `<b>Not yet.</b> <span style="white-space:pre-wrap">${esc(verdict.why)}</span>`;
      }
      if (verdict.ok) {
        markPassed(b.id);
        box.classList.add('passed');
        if (!titleEl.querySelector('.pass-badge')) titleEl.append(el('span', { class: 'pass-badge' }, 'Passed'));
      }
      checkBtn.disabled = false; checkBtn.textContent = 'Check answer';
    };
    const runOnly = async () => {
      const r = await runSql({ sql: editor.getValue(), sandbox: true });
      renderResults(results, r);
    };
    const checkBtn = el('button', { class: 'btn btn-good', onclick: check }, 'Check answer');
    const bar = el('div', { class: 'ex-bar' },
      el('button', { class: 'btn btn-primary', onclick: runOnly, html: '&#9654; Run <span class="kbd">Ctrl+Enter</span>' }),
      checkBtn,
      b.hint ? el('button', { class: 'btn btn-ghost', onclick: e => { e.currentTarget.replaceWith(el('span', { style: 'font-size:13.5px;color:var(--ink-2)', html: '💡 ' + inline(b.hint) })); } }, 'Hint') : null,
      el('button', {
        class: 'btn btn-ghost', onclick: e => {
          if (solBox.childNodes.length) { solBox.innerHTML = ''; e.currentTarget.textContent = 'Show solution'; return; }
          e.currentTarget.textContent = 'Hide solution';
          const sn = renderSnippet({ sql: b.solution, title: 'Reference solution', sandbox: true });
          sn.style.margin = '0'; sn.style.border = '0'; sn.style.borderRadius = '0';
          solBox.append(sn);
          requestAnimationFrame(() => sn._editor.refresh());
          if (b.explain) solBox.append(el('div', { class: 'snippet-note', html: md(b.explain) }));
        }
      }, 'Show solution'),
      el('span', { class: 'badge sandbox', style: 'margin-left:auto' }, 'Always runs in a sandbox'));
    box.append(host, bar, results, grade, solBox);
    editor = makeEditor(edHost, b.starter || '-- write your query here\n', runOnly, { minLines: 5 });
    host._editor = editor;
    return box;
  }

  // ---------------------------------------------------------------------------
  // Lesson rendering
  // ---------------------------------------------------------------------------
  function renderBlock(b, lesson, idx) {
    switch (b.type) {
      case 'h2': return el('h2', { id: b.id || null, html: inline(b.text) });
      case 'h3': return el('h3', { html: inline(b.text) });
      case 'p': return el('div', { html: md(b.text) });
      case 'html': return el('div', { html: b.html });
      case 'code': return renderSnippet(b);
      case 'table': return renderTable(b);
      case 'er': return erBox(b.diagram, b.caption);
      case 'erPair': return el('div', { class: 'two-col' }, erBox(b.left, b.leftCaption), erBox(b.right, b.rightCaption));
      case 'callout': return el('div', { class: 'callout ' + (b.kind || ''), html: `<span class="label">${esc(b.label || { tip: 'Tip', warn: 'Watch out', interview: 'Interview angle' }[b.kind] || 'Note')}</span>${md(b.text)}` });
      case 'quiz': return renderQuiz(b, lesson.id, idx);
      case 'exercise': return renderExercise(b);
      case 'flash': return renderFlash(b);
      case 'anim': return renderAnim(b);
      case 'reveal': {
        const d = el('details', { class: 'reveal' }, el('summary', {}, b.label || 'Show answer'));
        const body = el('div', { class: 'reveal-body' });
        let rendered = false;
        d.addEventListener('toggle', () => {
          if (d.open && !rendered) {
            rendered = true;
            (b.blocks || []).forEach((x, i) => body.append(renderBlock(x, lesson, idx + '.' + i)));
            drawDiagrams(body);
            body.querySelectorAll('.snippet').forEach(s => s._editor && s._editor.refresh());
          }
        });
        d.append(body);
        return d;
      }
      default: return el('div', { class: 'error-banner' }, 'Unknown block type: ' + b.type);
    }
  }

  function renderPlayground() {
    const wrap = el('div', { class: 'lesson playground' });
    wrap.append(el('div', { class: 'lesson-head' }, el('div', { class: 'crumb' }, 'Playground'), el('h1', {}, 'Query editor'),
      el('p', { class: 'intro', html: inline('Write any T-SQL against **ShopDB**. Select part of the code to run only that part. `GO` separates batches, like in SSMS. Turn **Sandbox** off to keep your changes (you can always reset with "Set up practice database").') })));
    const saved = sessionStorage.getItem('sqllab.pg');
    sessionStorage.removeItem('sqllab.pg');
    let last = '';
    try { last = localStorage.getItem('sqllab.pgLast') || ''; } catch { /* ignore */ }
    const sn = renderSnippet({ sql: saved || last || "-- Try anything here. Ctrl+Enter runs it.\nSELECT TOP (10) * FROM dbo.Customers;\n", sandbox: true }, { playground: true });
    wrap.append(sn);
    setInterval(() => { try { localStorage.setItem('sqllab.pgLast', sn._editor.getValue()); } catch { /* ignore */ } }, 3000);

    wrap.append(el('h2', {}, 'Tables in ShopDB'));
    const schema = el('div', { class: 'schema-browser' }, el('span', { class: 'empty-note' }, 'Loading…'));
    wrap.append(schema);
    runSql({ sql: `SELECT s.name + '.' + t.name AS tbl, c.name + ' ' + ty.name AS col
FROM sys.tables t JOIN sys.schemas s ON s.schema_id = t.schema_id
JOIN sys.columns c ON c.object_id = t.object_id JOIN sys.types ty ON ty.user_type_id = c.user_type_id
WHERE t.name <> 'SetupInfo'
ORDER BY s.name, t.name, c.column_id;` }).then(r => {
      schema.innerHTML = '';
      const rs = lastSet(r);
      if (!rs) { schema.append(el('span', { class: 'empty-note' }, 'Connect and set up ShopDB to see its tables.')); return; }
      const groups = {};
      for (const [t, c] of rs.rows) (groups[t] = groups[t] || []).push(c);
      for (const [t, cols] of Object.entries(groups)) {
        schema.append(el('div', {}, el('b', {}, t), cols.map(c => el('span', {}, c))));
      }
    });
    wrap.append(el('h2', {}, 'Handy snippets'));
    const handy = [
      ['List every table with row counts', "SELECT s.name AS SchemaName, t.name AS TableName, SUM(p.rows) AS [Rows]\nFROM sys.tables t\nJOIN sys.schemas s ON s.schema_id = t.schema_id\nJOIN sys.partitions p ON p.object_id = t.object_id AND p.index_id IN (0,1)\nGROUP BY s.name, t.name\nORDER BY [Rows] DESC;"],
      ['Indexes on a table', "EXEC sp_helpindex 'dbo.BigOrders';"],
      ['Definition of a view, procedure or trigger', "EXEC sp_helptext 'dbo.vw_OrderTotals';"],
      ['Columns of a table', "EXEC sp_columns 'Orders';"]
    ];
    for (const [title, sql] of handy) wrap.append(renderSnippet({ title, sql, sandbox: true }));
    return wrap;
  }

  function renderLesson(lesson) {
    const wrap = el('div', { class: 'lesson' });
    wrap.append(el('div', { class: 'lesson-head' },
      el('div', { class: 'crumb' }, lesson.group),
      el('h1', {}, lesson.title),
      lesson.intro ? el('p', { class: 'intro', html: inline(lesson.intro) }) : null));
    (lesson.blocks || []).forEach((b, i) => wrap.append(renderBlock(b, lesson, i)));
    const i = LESSONS.indexOf(lesson);
    const prev = LESSONS[i - 1], next = LESSONS[i + 1];
    wrap.append(el('div', { class: 'lesson-nav' },
      prev ? el('a', { class: 'btn', href: '#' + prev.id }, '← ' + prev.title) : el('span'),
      next ? el('a', { class: 'btn btn-primary', href: '#' + next.id }, next.title + ' →') : el('a', { class: 'btn btn-primary', href: '#playground' }, 'Open the playground →')));
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Navigation / routing
  // ---------------------------------------------------------------------------
  function renderNav(filter = $('#search').value.trim().toLowerCase()) {
    const nav = $('#nav');
    nav.innerHTML = '';
    const current = location.hash.slice(1) || 'welcome';
    let group = null;
    for (const l of LESSONS) {
      const hay = (l.title + ' ' + l.group + ' ' + (l.keywords || '')).toLowerCase();
      if (filter && !hay.includes(filter)) continue;
      if (l.group !== group) { group = l.group; nav.append(el('div', { class: 'nav-group' }, group)); }
      const exIds = (l.blocks || []).filter(b => b.type === 'exercise').map(b => b.id);
      const done = exIds.length ? exIds.every(id => progress.passed[id]) : progress.visited[l.id];
      nav.append(el('a', { class: 'nav-link' + (l.id === current ? ' active' : ''), href: '#' + l.id }, l.title,
        exIds.length ? el('span', { class: 'tick', title: 'exercises passed' }, `${exIds.filter(id => progress.passed[id]).length}/${exIds.length}`) : done ? el('span', { class: 'tick' }, '✓') : null));
    }
    if (!filter || 'playground'.includes(filter)) {
      nav.append(el('div', { class: 'nav-group' }, 'Tools'));
      nav.append(el('a', { class: 'nav-link' + (current === 'playground' ? ' active' : ''), href: '#playground' }, 'Playground'));
    }
  }
  $('#search').addEventListener('input', () => renderNav());
  $('#navToggle').addEventListener('click', () => document.body.classList.toggle('nav-open'));

  function route() {
    const id = location.hash.slice(1) || 'welcome';
    const content = $('#content');
    content.innerHTML = '';
    document.body.classList.remove('nav-open');
    stopAllAnimations();
    snippetSeq = 0;
    if (id === 'playground') {
      content.append(renderPlayground());
    } else {
      const lesson = LESSONS.find(l => l.id === id) || LESSONS[0];
      if (!lesson) { content.append(el('p', {}, 'No lessons found.')); return; }
      content.append(renderLesson(lesson));
      markVisited(lesson.id);
      document.title = lesson.title + ' · SQL Lab';
    }
    renderNav();
    window.scrollTo(0, 0);
    drawDiagrams(content);
    // CodeMirror needs a refresh once it is in the DOM
    requestAnimationFrame(() => content.querySelectorAll('.snippet').forEach(s => s._editor && s._editor.refresh()));
  }
  window.addEventListener('hashchange', route);

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------
  if (window.mermaid) {
    window.mermaid.initialize({
      startOnLoad: false,
      theme: 'base',
      securityLevel: 'strict',
      themeVariables: {
        primaryColor: '#e8eefb', primaryBorderColor: '#2b59c3', primaryTextColor: '#1d2433',
        lineColor: '#4a5468', fontFamily: 'Segoe UI, system-ui, Arial', fontSize: '14px',
        attributeBackgroundColorOdd: '#ffffff', attributeBackgroundColorEven: '#f6f7f9'
      },
      er: { useMaxWidth: false, layoutDirection: 'LR' }
    });
  }
  updateProgressPill();
  route();
  refreshStatus();
  window.SQLLAB = { refreshStatus, progress };
})();
