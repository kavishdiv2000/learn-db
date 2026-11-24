/* Beginner deep dive: how a NONCLUSTERED index works. Inserted right after "3. Indexes". */
(function () {
  const L = window.L;
  const { h2, h3, p, code, table, er: diagram, tip, warn, note, quiz, ex } = L;
  const anim = (title, frames, o = {}) => ({ type: 'anim', title, frames, ...o });
  const kw = rows => table(['Word', 'What it means, in plain words'], rows, { cls: 'keywords' });

  // ---------- frame helpers (same look as the other beginner lessons) ----------
  const T = (caption, cols, rows, extra = '') =>
    `<table class="mt ${extra}">${caption ? `<caption>${caption}</caption>` : ''}<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows.map(r => {
      const o = Array.isArray(r) ? { c: r } : r;
      return `<tr class="${o.cls || ''}"${o.d ? ` style="--d:${o.d}"` : ''}>${o.c.map(v => `<td>${v}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
  const N = (text, cls = '', sub = '', d = '') => `<div class="node ${cls}${d ? ' pop' : ''}"${d ? ` style="--d:${d}"` : ''}>${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
  const A = (s = '→', d = '') => `<div class="arr ${d ? 'pop' : ''}"${d ? ` style="--d:${d}"` : ''}>${s}</div>`;
  const S = (...parts) => `<div class="scene">${parts.join('')}</div>`;
  const C = s => `<div class="codebox">${s}</div>`;
  const k = s => `<span class="k">${s}</span>`;
  const hl = s => `<span class="h">${s}</span>`;
  const reads = (n, cls = 'purple', d = '') => N(`📖 pages read: ${n}`, cls, '', d);

  // The small example table used by every animation (clustered by OrderId)
  const ROWS = [
    [1, 42, 'Kandy', '3,000'], [2, 7, 'Galle', '9,500'], [3, 15, 'Colombo', '1,200'], [4, 7, 'Kandy', '4,800'],
    [5, 30, 'Matara', '2,000'], [6, 15, 'Galle', '7,700'], [7, 7, 'Colombo', '6,100'], [8, 42, 'Jaffna', '5,300']
  ];
  const tableOf = (marks = {}, caption = 'Orders table = clustered index (sorted by OrderId)') =>
    T(caption, ['OrderId', 'CustomerId', 'City', 'Amount'], ROWS.map((r, i) => ({ c: r.map((v, j) => (j === 0 ? `<b>${v}</b>` : v)), cls: marks[i + 1] || '' })));
  // nonclustered index entries: (CustomerId, OrderId) sorted by CustomerId
  const IDX = [[7, 2], [7, 4], [7, 7], [15, 3], [15, 6], [30, 5], [42, 1], [42, 8]];
  const idxOf = (marks = {}, caption = 'IX_CustomerId (nonclustered)', withAmount = false) =>
    T(caption, withAmount ? ['CustomerId', 'Amount <small>(INCLUDE)</small>', 'OrderId <small>(pointer)</small>'] : ['CustomerId <small>(key)</small>', 'OrderId <small>(pointer)</small>'],
      IDX.map((e, i) => {
        const amount = ROWS[e[1] - 1][3];
        return { c: withAmount ? [`<b>${e[0]}</b>`, amount, e[1]] : [`<b>${e[0]}</b>`, e[1]], cls: marks[i] || '' };
      }));

  const lesson = {
    id: 'b-nonclustered', group: 'Beginner friendly', title: '3b. Nonclustered indexes, deep dive',
    keywords: 'beginner nonclustered index key lookup covering include row locator b-tree tipping point composite',
    intro: '~15 min. What a nonclustered index actually stores, how SQL Server walks through it, and why "key lookups" happen, with animations at every step.',
    blocks: [
      h2('One sentence to remember'),
      p(`A **nonclustered index** is a **separate, sorted list** of the column(s) you choose. Each entry carries a **pointer** back to the full row in the table.

It works just like the index at the back of a textbook. The index is sorted by *topic* (the key), and each topic tells you the **page number** (the pointer). To read the full text, you turn to that page.`),
      table(['Textbook', 'SQL Server'], [
        ['The pages of the book, in page order', '**Clustered index**: the table itself, stored sorted by OrderId'],
        ['The index at the back, sorted A→Z by topic', '**Nonclustered index**: a separate list sorted by CustomerId'],
        ['"Triggers … page 212"', 'An index entry: `CustomerId 7 → OrderId 2`'],
        ['Turning to page 212 to read the paragraph', 'A **key lookup**: following the pointer to fetch the other columns'],
        ['A book can have several indexes (by topic, by author…)', 'A table can have **many** nonclustered indexes (up to 999)']
      ]),
      kw([
        ['Key column(s)', 'The column(s) the index is **sorted by**: `CREATE INDEX … ON Orders (CustomerId)`'],
        ['Row locator / pointer', 'How an index entry finds its full row. In a normal table this is the **clustered key** (OrderId). SQL Server adds it automatically'],
        ['Leaf level', 'The bottom level of the index: one entry per row in the table'],
        ['Root / middle levels', 'The "signposts" above the leaves that tell SQL Server which page to read next'],
        ['Key lookup', 'Jumping from an index entry to the table to fetch columns the index doesn\'t have'],
        ['INCLUDE (cols)', 'Copy extra columns into the leaf level of the index, so no key lookup is needed'],
        ['Covering index', 'An index that contains **every column** a query needs'],
        ['Tipping point', 'When so many rows match that key lookups would cost more than just scanning the table']
      ]),

      h2('1. What is stored inside it?'),
      p('We use a tiny 8-row Orders table in the animations, so you can follow every row. The real BigOrders table works the same way, just with 300,000 rows.'),
      anim('Building IX_CustomerId step by step', [
        { html: S(tableOf()), caption: 'The table is stored sorted by **OrderId** (its clustered index). CustomerId values are all over the place: 42, 7, 15, 7, 30…' },
        { html: S(tableOf(), A('→'), C(`${k('CREATE INDEX')} IX_CustomerId\n  ${k('ON')} Orders (${hl('CustomerId')});`)), caption: 'We run `CREATE INDEX IX_CustomerId ON Orders (CustomerId)`.' },
        {
          html: S(T('Copy 2 things from every row', ['CustomerId', 'OrderId'], ROWS.map((r, i) => ({ c: [`<b>${r[1]}</b>`, r[0]], cls: 'hl fade', d: i * 0.08 + 's' })))),
          caption: 'SQL Server copies the **key column** (CustomerId) from every row, plus the **pointer**: the row\'s clustered key (OrderId). City and Amount are **not** copied.'
        },
        { html: S(idxOf(Object.fromEntries(IDX.map((_, i) => [i, 'ok fade'])))), caption: 'Then it **sorts** the copy by CustomerId. That sorted list is the nonclustered index. All the 7s are now together, then the 15s, and so on.' },
        { html: S(idxOf(), A('⇢'), tableOf({}, 'The table is unchanged')), caption: 'The index is a **separate structure**. The table itself didn\'t move. Each entry points back to its row through OrderId.' }
      ]),
      note('The pointer is added **automatically**. You never list OrderId in the index, but it\'s there in every entry. (On a *heap*, a table with no clustered index, the pointer is a physical address called a **RID** instead.)', 'Hidden bonus column'),
      diagram(`flowchart LR
  subgraph NC["Nonclustered index IX_CustomerId (separate, sorted by CustomerId)"]
    direction TB
    NR["Root page<br/>7–15 ↙ ↘ 30–42"] --> NL1["Leaf page<br/>7→2 · 7→4 · 7→7 · 15→3"]
    NR --> NL2["Leaf page<br/>15→6 · 30→5 · 42→1 · 42→8"]
  end
  subgraph CL["Clustered index = the table itself (sorted by OrderId)"]
    direction TB
    CR["Root page<br/>1–4 ↙ ↘ 5–8"] --> CD1["Data page<br/>rows 1–4, ALL columns"]
    CR --> CD2["Data page<br/>rows 5–8, ALL columns"]
  end
  NL1 -. "pointer: OrderId 2, 4, 7<br/>(key lookup)" .-> CR
  style NC fill:#f2edfb,stroke:#7a4fd0
  style CL fill:#e8eefb,stroke:#2b59c3
  style NL1 fill:#fff3c4,stroke:#c9a227`, 'Two separate B-trees. The nonclustered leaf only holds CustomerId + OrderId. To get City or Amount, SQL Server follows the pointer into the clustered index (the table).'),

      h2('2. How a query uses it: seek + key lookup'),
      p('Query: `SELECT OrderId, Amount FROM Orders WHERE CustomerId = 7`. The index has CustomerId and OrderId, but **not Amount**. Watch the page counter.'),
      anim('WHERE CustomerId = 7 → seek, then key lookups', [
        { html: S(N('Root page', 'purple', '7–15 ↙  ↘ 30–42'), A('→'), idxOf(), reads(1)), caption: '**Seek, step 1:** read the root page. It says 7 is on the left leaf page. (1 page read.)' },
        { html: S(idxOf({ 0: 'ok', 1: 'ok', 2: 'ok', 3: 'dim', 4: 'dim', 5: 'dim', 6: 'dim', 7: 'dim' }), reads(2)), caption: '**Seek, step 2:** read that leaf page. The three 7s sit together: OrderIds **2, 4, 7**. It stops at 15, so the rest are never touched. (2 pages.)' },
        { html: S(idxOf({ 0: 'ok', 1: 'dim', 2: 'dim' }), A('→', '.1s'), tableOf({ 2: 'hl pop', 4: 'dim', 7: 'dim' }), reads('2 + 2 = 4', 'warn')), caption: '**Key lookup #1:** the index has no Amount, so follow pointer **2** into the table (root + data page) and read Amount = 9,500.' },
        { html: S(idxOf({ 0: 'dim', 1: 'ok', 2: 'dim' }), A('→'), tableOf({ 2: 'ok', 4: 'hl pop' }), reads('4 + 2 = 6', 'warn')), caption: '**Key lookup #2:** pointer **4** → Amount 4,800.' },
        { html: S(idxOf({ 0: 'dim', 1: 'dim', 2: 'ok' }), A('→'), tableOf({ 2: 'ok', 4: 'ok', 7: 'hl pop' }), reads('6 + 2 = 8', 'warn')), caption: '**Key lookup #3:** pointer **7** → Amount 6,100. **One lookup per matching row.**' },
        { html: S(T('Result', ['OrderId', 'Amount'], [['2', '9,500'], ['4', '4,800'], ['7', '6,100']].map((r, i) => ({ c: r, cls: 'ok pop', d: i * 0.15 + 's' }))), reads(8, 'ok')), caption: 'Done: 2 pages for the seek + 2 pages × 3 lookups = **8 pages**. A full scan of a big table could be thousands.' }
      ], { interval: 3400 }),

      h2('3. Make it covering: INCLUDE'),
      p('If Amount is **copied into the index**, the answer is already in the leaf, so there are no lookups. `INCLUDE` adds columns to the leaf only. They are not sorted and not part of the key, they just come along for the ride.'),
      anim('INCLUDE (Amount) → the index answers alone', [
        { html: S(C(`${k('CREATE INDEX')} IX_CustomerId_Cover\n  ${k('ON')} Orders (CustomerId)\n  ${hl(k('INCLUDE') + ' (Amount)')};`), A('→'), idxOf({}, 'IX_CustomerId_Cover', true)), caption: 'Every index entry now also carries **Amount**.' },
        { html: S(idxOf({ 0: 'ok', 1: 'ok', 2: 'ok', 3: 'dim', 4: 'dim', 5: 'dim', 6: 'dim', 7: 'dim' }, 'IX_CustomerId_Cover', true), reads(2, 'ok')), caption: 'Seek to the 7s, and Amount is right there. **No trip to the table.**' },
        { html: S(T('Result', ['OrderId', 'Amount'], [['2', '9,500'], ['4', '4,800'], ['7', '6,100']].map((r, i) => ({ c: r, cls: 'ok pop', d: i * 0.15 + 's' }))), reads('2 (was 8)', 'ok')), caption: 'Same result, **2 pages instead of 8**. On big tables this is the difference between 50 reads and 3.' }
      ]),
      table(['', 'Key column `(CustomerId, Amount)`', 'Included column `(CustomerId) INCLUDE (Amount)`'], [
        ['Stored where?', 'Every level of the tree (root, middle, leaf)', 'Leaf level only'],
        ['Sorted?', 'Yes: Amount is sorted *within* each CustomerId', 'No'],
        ['Can SQL Server seek on it?', 'Yes: `WHERE CustomerId = 7 AND Amount > 5000`', 'No, it can only read it once it has found the rows'],
        ['Helps ORDER BY Amount?', 'Yes (no sort needed)', 'No'],
        ['Use it for', 'Columns you **filter or sort** on', 'Columns you only **return** (show)']
      ]),

      h2('4. The tipping point: when SQL Server ignores the index'),
      anim('Few matches vs many matches', [
        { html: S(N('CustomerId = 1234', 'ok', '≈ 15 matching rows'), A('→'), N('Seek + 15 lookups', 'ok', '≈ 2 + 15×3 = 47 pages'), A('→'), N('✔ use the index', 'ok pop', '', '.3s')), caption: 'Customer 1234 has about 15 orders: 15 lookups is cheap, so **use the index**.' },
        { html: S(N('CustomerId = 42', 'bad', '≈ 15,000 matching rows'), A('→'), N('Seek + 15,000 lookups', 'bad', '≈ 45,000 pages'), A('vs'), N('Scan the whole table', 'warn', '≈ 3,000–4,000 pages')), caption: 'Customer 42 has about **15,000** orders. 15,000 lookups × 3 pages each is far more work than reading the whole table once…' },
        { html: S(N('Optimizer chooses: SCAN', 'warn pop', 'the index is ignored on purpose')), caption: '…so the optimizer **chooses a scan**. This is not a bug: it uses statistics to estimate the cheapest route. A **covering** index (INCLUDE) removes the lookups, so it stays fast for both customers.' }
      ]),
      diagram(`flowchart LR
  Q["Query"] --> A{"Uses the index's<br/>1st key column?"}
  A -- "no" --> S1["Scan"]
  A -- "yes" --> B{"Column inside<br/>a function?"}
  B -- "yes" --> S2["Scan"]
  B -- "no" --> C{"Index has every<br/>column needed?"}
  C -- "yes" --> G["Seek only ✔"]
  C -- "no" --> D{"Rows<br/>matching?"}
  D -- "few" --> K["Seek +<br/>key lookups"]
  D -- "many" --> S3["Scan<br/>(tipping point)"]
  style G fill:#d7f2e4,stroke:#1f8a5b
  style K fill:#fff3c4,stroke:#c9a227
  style S1 fill:#fbdcda,stroke:#c23934
  style S2 fill:#fbdcda,stroke:#c23934
  style S3 fill:#fdf3e2,stroke:#b86e00`, 'Will SQL Server use my nonclustered index? Follow the questions from left to right. "Function" means something like `YEAR(col)` or `ISNULL(col, …)`.'),

      h2('5. Indexes on two columns: order matters'),
      p('An index on **(CustomerId, OrderDate)** is sorted like a phone book sorted by **surname, then first name**. You can quickly find everyone called "Perera", or "Perera, Nimal". But you can\'t find everyone whose *first* name is "Nimal": they\'re scattered across every surname.'),
      anim('Index on (CustomerId, OrderDate)', [
        { html: S(T('IX_Cust_Date (sorted by CustomerId, then OrderDate)', ['CustomerId', 'OrderDate', '→ OrderId'], [['7', '2026-01-03', '2'], ['7', '2026-04-11', '4'], ['7', '2026-09-20', '7'], ['15', '2026-02-14', '3'], ['15', '2026-08-01', '6'], ['30', '2026-05-30', '5'], ['42', '2026-01-09', '1'], ['42', '2026-10-02', '8']])), caption: 'Sorted by CustomerId first. **Within** each customer, sorted by date.' },
        { html: S(C(`${k('WHERE')} CustomerId = 7\n  ${k('AND')} OrderDate >= '2026-04-01'`), T('✔ Seek on both columns', ['CustomerId', 'OrderDate', '→ OrderId'], [{ c: ['7', '2026-01-03', '2'], cls: 'dim' }, { c: ['7', '2026-04-11', '4'], cls: 'ok pop' }, { c: ['7', '2026-09-20', '7'], cls: 'ok pop', d: '.2s' }, { c: ['15', '2026-02-14', '3'], cls: 'dim' }, { c: ['15', '2026-08-01', '6'], cls: 'dim' }, { c: ['30', '2026-05-30', '5'], cls: 'dim' }, { c: ['42', '2026-01-09', '1'], cls: 'dim' }, { c: ['42', '2026-10-02', '8'], cls: 'dim' }])), caption: '✔ Jump to customer 7, then to April inside customer 7. Both columns are used.' },
        { html: S(C(`${k('WHERE')} OrderDate >= '2026-08-01'`), T('✘ Dates are scattered', ['CustomerId', 'OrderDate', '→ OrderId'], [{ c: ['7', '2026-01-03', '2'], cls: 'dim' }, { c: ['7', '2026-04-11', '4'], cls: 'dim' }, { c: ['7', '2026-09-20', '7'], cls: 'hl' }, { c: ['15', '2026-02-14', '3'], cls: 'dim' }, { c: ['15', '2026-08-01', '6'], cls: 'hl' }, { c: ['30', '2026-05-30', '5'], cls: 'dim' }, { c: ['42', '2026-01-09', '1'], cls: 'dim' }, { c: ['42', '2026-10-02', '8'], cls: 'hl' }]), N('must check every entry', 'bad', 'SCAN', '.3s')), caption: '✘ Filtering on **OrderDate alone**: the matching dates are spread across every customer, so there is nothing to jump to. This is the **left-most column rule**.' }
      ]),

      h2('6. The cost: every index must be updated'),
      anim('INSERT one order → three structures change', [
        { html: S(C(`${k('INSERT INTO')} Orders\n${k('VALUES')} (9, 15, 'Galle', 800);`), N('Table has 1 clustered + 2 nonclustered indexes', 'purple', 'IX_CustomerId, IX_City')), caption: 'A new order arrives: OrderId 9, customer 15, Galle.' },
        { html: S(T('Clustered (table)', ['OrderId', '…'], [['7', '…'], ['8', '…'], { c: ['<b>9</b>', '15, Galle, 800'], cls: 'ok pop' }])), caption: '① The row is added to the table, at the end because OrderId keeps increasing.' },
        { html: S(T('Clustered (table)', ['OrderId', '…'], [['8', '…'], { c: ['9', '15, Galle, 800'], cls: 'ok' }]), T('IX_CustomerId', ['CustomerId', '→'], [['7', '7'], ['15', '3'], ['15', '6'], { c: ['<b>15</b>', '9'], cls: 'ok pop', d: '.2s' }, ['30', '5']])), caption: '② An entry is added to IX_CustomerId, slotted into its **sorted** position among the 15s.' },
        { html: S(T('IX_CustomerId', ['CustomerId', '→'], [['15', '6'], { c: ['15', '9'], cls: 'ok' }, ['30', '5']]), T('IX_City', ['City', '→'], [['Colombo', '7'], ['Galle', '2'], ['Galle', '6'], { c: ['<b>Galle</b>', '9'], cls: 'ok pop', d: '.2s' }, ['Jaffna', '8']])), caption: '③ And to IX_City. **One INSERT = 3 writes.** With 10 indexes it would be 11. That is why you index columns you *search* by, not every column.' }
      ]),

      h2('Try it on BigOrders (300,000 rows)'),
      tip('Every example below has **Plan** and **IO/Time** turned on and runs in the **sandbox** (the index is removed afterwards). After running, check three places: the **Execution plan** tab (green = seek, orange = scan, red = key lookup), the **Messages** tab (*logical reads* = pages read), and the **Results** tab.'),
      h3('A. See the tree: levels and pages'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
SELECT i.name                    AS IndexName,
       i.type_desc               AS Kind,
       s.index_level             AS Level,          -- 0 = leaf (bottom)
       CASE WHEN s.index_level = 0 THEN 'leaf'
            WHEN s.index_level = s.index_depth - 1 THEN 'root'
            ELSE 'middle' END    AS LevelName,
       s.page_count              AS Pages,
       s.record_count            AS Entries,
       CAST(s.avg_record_size_in_bytes AS INT) AS BytesPerEntry
FROM sys.dm_db_index_physical_stats(DB_ID(), OBJECT_ID('dbo.BigOrders'), NULL, NULL, 'DETAILED') AS s
JOIN sys.indexes AS i ON i.object_id = s.object_id AND i.index_id = s.index_id
WHERE s.alloc_unit_type_desc = 'IN_ROW_DATA'
ORDER BY i.index_id, s.index_level DESC;`, { title: 'Look inside: clustered vs nonclustered size', note: 'The **nonclustered** leaf has 300,000 entries, like the table, but each entry is tiny (CustomerId + OrderId), so it needs **far fewer pages**. Both trees have just **1 root page**. That\'s why a seek reads so few pages.' }),
      h3('B. The hidden pointer: OrderId is already inside'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
-- 1) Only CustomerId + OrderId: both are IN the index → Index Seek, no lookup
SELECT OrderId, CustomerId FROM dbo.BigOrders WHERE CustomerId = 1234;

-- 2) Ask for Amount too → Index Seek + Key Lookup (Amount isn't in the index)
SELECT OrderId, CustomerId, Amount FROM dbo.BigOrders WHERE CustomerId = 1234;`, { title: 'Covered "for free" vs key lookup', plan: true, stats: true, note: 'Plan tab: the first query is just a green **Index Seek**. The second adds a red **Key Lookup**. Messages: about 3 reads vs about 50.' }),
      h3('C. Fix the lookup with INCLUDE'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId_Cover
    ON dbo.BigOrders (CustomerId)         -- key: what you search by
    INCLUDE (OrderDate, Amount);          -- extra: what you only show
GO
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 1234;`, { title: 'Covering index', plan: true, stats: true }),
      h3('D. The tipping point, live'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
-- ~15 rows: SQL Server uses the index (seek + lookups)
SELECT OrderId, Amount FROM dbo.BigOrders WHERE CustomerId = 1234;

-- ~15,000 rows: SQL Server IGNORES the index and scans
SELECT OrderId, Amount FROM dbo.BigOrders WHERE CustomerId = 42;

-- Force the index anyway to see why: compare the logical reads in Messages
SELECT OrderId, Amount FROM dbo.BigOrders WITH (INDEX (IX_BigOrders_CustomerId)) WHERE CustomerId = 42;`, { title: 'Why SQL Server sometimes skips your index', plan: true, stats: true, note: '`WITH (INDEX (name))` is a **hint** that forces an index. It is for experiments only. The forced version reads many times more pages than the scan, which proves the optimizer chose well.' }),
      h3('E. Two-column index: the left-most rule'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_Cust_Date
    ON dbo.BigOrders (CustomerId, OrderDate) INCLUDE (Amount);
GO
-- ✔ uses both key columns → seek
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders
WHERE CustomerId = 42 AND OrderDate >= '2026-10-01';

-- ✘ only the 2nd column → can't seek (scan)
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders
WHERE OrderDate >= '2026-10-31';`, { title: 'Column order in a composite index', plan: true, stats: true }),
      h3('F. Indexes make JOINs fast too'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId) INCLUDE (Amount);
GO
-- For each of 3 customers, SQL Server seeks straight to their orders
SELECT c.CustomerId, COUNT(*) AS Orders, SUM(b.Amount) AS Spend
FROM (VALUES (1234), (4321), (777)) AS c(CustomerId)   -- a tiny inline list of 3 customers
JOIN dbo.BigOrders AS b ON b.CustomerId = c.CustomerId
GROUP BY c.CustomerId;`, { title: 'Index on a JOIN column', plan: true, stats: true, note: 'SQL Server does **not** create indexes on foreign-key columns automatically. Adding one on columns you JOIN on (like Orders.CustomerId) is one of the most common real-world fixes.' }),
      h3('G. The write cost, measured'),
      code(`CREATE TABLE lab.NoIdx  (Id INT PRIMARY KEY, CustomerId INT, City NVARCHAR(50), Amount DECIMAL(18,2));
CREATE TABLE lab.WithIdx(Id INT PRIMARY KEY, CustomerId INT, City NVARCHAR(50), Amount DECIMAL(18,2));
CREATE INDEX IX1 ON lab.WithIdx (CustomerId);
CREATE INDEX IX2 ON lab.WithIdx (City);
CREATE INDEX IX3 ON lab.WithIdx (Amount);
GO
SET STATISTICS TIME ON;
INSERT INTO lab.NoIdx   SELECT TOP (100000) OrderId, CustomerId, ShipCity, Amount FROM dbo.BigOrders;
INSERT INTO lab.WithIdx SELECT TOP (100000) OrderId, CustomerId, ShipCity, Amount FROM dbo.BigOrders;
SET STATISTICS TIME OFF;`, { title: 'Same insert, 0 vs 3 nonclustered indexes', note: 'Compare the two "elapsed time" values in **Messages**: the table with 3 extra indexes takes noticeably longer.' }),

      h2('Your turn'),
      ex({
        id: 'b-nc-cover', title: 'Make this query a single Index Seek',
        prompt: `The login page runs this query constantly:

\`SELECT OrderId, Status FROM dbo.BigOrders WHERE CustomerEmail = 'customer500@mail.com';\`

Create **one nonclustered index** so it becomes an **Index Seek with no Key Lookup**. Tick *Plan* on the query below your index to check.`,
        hint: 'Key column = what you search by (CustomerEmail). INCLUDE = what you show that isn\'t already there (Status). OrderId comes free as the pointer.',
        starter: "-- CREATE NONCLUSTERED INDEX ... ON dbo.BigOrders (...) INCLUDE (...);\n\nGO\nSELECT OrderId, Status FROM dbo.BigOrders WHERE CustomerEmail = 'customer500@mail.com';\n",
        solution: `CREATE NONCLUSTERED INDEX IX_BigOrders_Email
    ON dbo.BigOrders (CustomerEmail)
    INCLUDE (Status);`,
        explain: 'CustomerEmail is the **key** (you search by it). Status is **included** (you only show it). OrderId is the clustered key, so every nonclustered index already has it.',
        grade: {
          mode: 'check', expect: 2, check: `IF @@TRANCOUNT = 0 BEGIN SELECT N'Your code ended the sandbox transaction, so the checks were skipped' AS Test, 0 AS Pass; RETURN; END
;WITH c AS (
    SELECT ic.index_id, col.name, ic.key_ordinal, ic.is_included_column
    FROM sys.index_columns ic
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE ic.object_id = OBJECT_ID('dbo.BigOrders') AND i.type = 2 AND i.has_filter = 0
), lead AS (
    SELECT index_id FROM c WHERE name = 'CustomerEmail' AND key_ordinal = 1 AND is_included_column = 0
)
SELECT N'A nonclustered index on BigOrders has CustomerEmail as its first key column' AS Test,
       CASE WHEN EXISTS (SELECT 1 FROM lead) THEN 1 ELSE 0 END AS Pass
UNION ALL
SELECT N'That index also contains Status (key or INCLUDE), so there is no key lookup',
       CASE WHEN EXISTS (SELECT 1 FROM lead JOIN c ON c.index_id = lead.index_id WHERE c.name = 'Status') THEN 1 ELSE 0 END;`
        }
      }),

      h2('Summary'),
      table(['Remember', 'Why'], [
        ['A nonclustered index = sorted key column(s) + a pointer (the clustered key)', 'It\'s a separate list, like a book\'s index'],
        ['Seek = walk the tree: root → leaf (a few pages)', 'That\'s why it\'s fast even on millions of rows'],
        ['Missing columns cause a **key lookup** per row', 'Fine for a few rows, expensive for thousands'],
        ['`INCLUDE` the columns you only *show*', 'This makes a **covering** index, with no lookups'],
        ['Put columns you *filter or sort* on in the **key**, equality columns first', 'The left-most rule: (A, B) helps `WHERE A` and `WHERE A AND B`, not `WHERE B`'],
        ['Many matching rows → SQL Server may scan instead', 'The tipping point. Covering indexes avoid it'],
        ['Each index slows INSERT/UPDATE/DELETE a little', 'Index the columns you search often, not everything']
      ]),
      quiz('An index is on `(CustomerId)`. The query is `SELECT OrderId, CustomerId FROM Orders WHERE CustomerId = 5`. Is there a key lookup?', ['Yes, always', 'No: OrderId is the clustered key, so it\'s already in every nonclustered index entry', 'Only if OrderId is in INCLUDE', 'It depends on the isolation level'], 1, 'The pointer stored in every nonclustered index entry *is* the clustered key, so the query is covered.'),
      quiz('Query: `SELECT Name, Price FROM Products WHERE Category = @c`. Which index makes it a seek with no key lookup?', ['(Price)', '(Name)', '(Category) INCLUDE (Name, Price)', '(Name, Price) INCLUDE (Category)'], 2, 'Search by Category, so it is the key. Show Name and Price, so they are included.'),
      quiz('Why might SQL Server scan the table even though an index exists on the WHERE column?', ['The index is broken', 'So many rows match that key lookups would cost more than a scan (the tipping point)', 'Nonclustered indexes only work on Sundays', 'The table is too small to have an index'], 1, 'The optimizer compares estimated costs. Make the index covering, and the lookups and the tipping point disappear.'),
      p('Back to: [3. Indexes](#b-indexes) · Next beginner lesson: [4. Triggers →](#b-triggers) · Full lesson: [Indexes](#indexes)')
    ]
  };

  // insert right after "3. Indexes" and link to it from there
  const list = window.LESSONS;
  const at = list.findIndex(l => l.id === 'b-indexes');
  list.splice(at >= 0 ? at + 1 : list.length, 0, lesson);
  const idx = list[at];
  if (idx && idx.id === 'b-indexes') {
    idx.blocks.splice(idx.blocks.length - 1, 0,
      tip('**Want to really understand nonclustered indexes?** Open [3b. Nonclustered indexes, deep dive](#b-nonclustered): what is stored inside, how key lookups work, INCLUDE, the tipping point and two-column indexes, all animated.'));
  }
  const full = list.find(l => l.id === 'indexes');
  if (full) full.blocks.splice(1, 0, tip('Deep dive with animations: [Nonclustered indexes, step by step](#b-nonclustered).'));
})();
