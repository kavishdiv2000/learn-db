/* Beginner-friendly track: short lessons that use only basic SQL, explain every new keyword,
   and use diagrams + step-by-step animations. Inserted right after "Start here" in the menu. */
(function () {
  const L = window.L;
  const { h2, h3, p, code, table, er: diagram, tip, warn, note, quiz } = L;
  const anim = (title, frames, o = {}) => ({ type: 'anim', title, frames, ...o });
  const kw = rows => table(['Keyword', 'What it means, in plain words'], rows, { cls: 'keywords' });
  const GROUP = 'Beginner friendly';

  // ---------- tiny HTML helpers for animation frames ----------
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // rows: [..cells] or { c: [..cells], cls: 'hl|ok|bad|dim|strike fade', d: '0.2s' }
  const T = (caption, cols, rows, extra = '') =>
    `<table class="mt ${extra}">${caption ? `<caption>${caption}</caption>` : ''}<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>${rows.map(r => {
      const o = Array.isArray(r) ? { c: r } : r;
      return `<tr class="${o.cls || ''}"${o.d ? ` style="--d:${o.d}"` : ''}>${o.c.map(v => `<td>${v}</td>`).join('')}</tr>`;
    }).join('')}</table>`;
  const N = (text, cls = '', sub = '', d = '') => `<div class="node ${cls}"${d ? ` style="--d:${d}"` : ''}>${text}${sub ? `<small>${sub}</small>` : ''}</div>`;
  const A = (s = '→', d = '') => `<div class="arr ${d ? 'pop' : ''}"${d ? ` style="--d:${d}"` : ''}>${s}</div>`;
  const S = (...parts) => `<div class="scene">${parts.join('')}</div>`;
  const SC = (...parts) => `<div class="scene col">${parts.join('')}</div>`;
  const C = s => `<div class="codebox">${s}</div>`;       // s may contain <span class="k|c|h">
  const k = s => `<span class="k">${s}</span>`;           // keyword colour
  const h = s => `<span class="h">${s}</span>`;           // highlighted part
  const chip = s => `<span class="note-chip">${s}</span>`;

  const lessons = [];

  // ===========================================================================
  // 0. WARM-UP
  // ===========================================================================
  lessons.push({
    id: 'b-basics', group: GROUP, title: '0. SQL warm-up (start here)',
    keywords: 'beginner basics select where order by group by join',
    intro: '~8 min. The handful of basic SQL words every other beginner lesson uses. If you already know SELECT, WHERE, GROUP BY and JOIN, skip to lesson 1.',
    blocks: [
      note('Each beginner lesson takes **about 10 minutes**: read the explanation, press **▶ Play** on the animations (or click **Next ▶** at your own pace), run the examples, then answer the quiz at the end.', 'Your 1-hour plan'),
      table(['Time', 'Lesson'], [
        ['0:00', '0. SQL warm-up (this page)'], ['0:08', '1. CTEs & window functions'], ['0:20', '2. Transactions & locking'],
        ['0:30', '3. Indexes'], ['0:40', '4. Triggers'], ['0:48', '5. Stored procedures & functions'], ['0:56', '6. Query optimization']
      ], { caption: 'All examples run safely: **Sandbox** undoes any change after it runs.' }),

      h2('A table is just a grid'),
      p('A **table** looks like a spreadsheet. Each **row** is one thing (one customer). Each **column** is one fact about it (their city). SQL is how you *ask questions* of these tables.'),
      h2('The words you need'),
      kw([
        ['SELECT', 'Which **columns** do you want to see?'],
        ['FROM', 'Which **table** are they in?'],
        ['WHERE', 'Keep only the **rows** that match a condition'],
        ['ORDER BY', 'Sort the result (`ASC` = A→Z / small→big, `DESC` = the reverse)'],
        ['GROUP BY', 'Put rows into **groups** (e.g. per city) so you can count or add them up'],
        ['JOIN … ON', 'Combine two tables by matching a column (e.g. CustomerId)'],
        ['AS', 'Give a column or table a nickname: `COUNT(*) AS Orders`'],
        ['COUNT / SUM / AVG', 'Count rows / add numbers / average numbers']
      ]),
      anim('How SQL Server reads a query', [
        {
          html: S(C(`${k('SELECT')} FullName\n${k('FROM')} Customers\n${k('WHERE')} City = 'Colombo'\n${k('ORDER BY')} FullName;`),
            T('Customers', ['FullName', 'City'], [['Nimal Perera', 'Colombo'], ['Kumari Silva', 'Kandy'], ['Ruwan Fernando', 'Galle'], ['Kasun Wickrama', 'Colombo'], ['Dilan Jayasuriya', 'Colombo'], ['Priya Rajan', 'Jaffna']])),
          caption: 'Here is the query and the table. You **write** SELECT first, but SQL Server **starts** with FROM.'
        },
        {
          html: S(C(`${k('SELECT')} FullName\n${h(k('FROM') + ' Customers')}\n${k('WHERE')} City = 'Colombo'\n${k('ORDER BY')} FullName;`),
            T('1. FROM: take every row', ['FullName', 'City'], [['Nimal Perera', 'Colombo'], ['Kumari Silva', 'Kandy'], ['Ruwan Fernando', 'Galle'], ['Kasun Wickrama', 'Colombo'], ['Dilan Jayasuriya', 'Colombo'], ['Priya Rajan', 'Jaffna']].map((r, i) => ({ c: r, cls: 'hl fade', d: i * 0.08 + 's' })))),
          caption: '**Step 1, FROM:** pick up the whole Customers table.'
        },
        {
          html: S(C(`${k('SELECT')} FullName\n${k('FROM')} Customers\n${h(k('WHERE') + " City = 'Colombo'")}\n${k('ORDER BY')} FullName;`),
            T('2. WHERE: keep only Colombo', ['FullName', 'City'], [
              { c: ['Nimal Perera', 'Colombo'], cls: 'ok' }, { c: ['Kumari Silva', 'Kandy'], cls: 'dim' }, { c: ['Ruwan Fernando', 'Galle'], cls: 'dim' },
              { c: ['Kasun Wickrama', 'Colombo'], cls: 'ok' }, { c: ['Dilan Jayasuriya', 'Colombo'], cls: 'ok' }, { c: ['Priya Rajan', 'Jaffna'], cls: 'dim' }])),
          caption: '**Step 2, WHERE:** check each row. Rows that are not Colombo are thrown away (greyed out).'
        },
        {
          html: S(C(`${h(k('SELECT') + ' FullName')}\n${k('FROM')} Customers\n${k('WHERE')} City = 'Colombo'\n${k('ORDER BY')} FullName;`),
            T('3. SELECT: keep only the FullName column', ['FullName'], [['Nimal Perera'], ['Kasun Wickrama'], ['Dilan Jayasuriya']].map(r => ({ c: r, cls: 'fade' })))),
          caption: '**Step 3, SELECT:** keep only the columns you asked for.'
        },
        {
          html: S(C(`${k('SELECT')} FullName\n${k('FROM')} Customers\n${k('WHERE')} City = 'Colombo'\n${h(k('ORDER BY') + ' FullName')};`),
            T('4. ORDER BY: sort A → Z', ['FullName'], [['Dilan Jayasuriya'], ['Kasun Wickrama'], ['Nimal Perera']].map((r, i) => ({ c: r, cls: 'ok slide', d: i * 0.15 + 's' })))),
          caption: '**Step 4, ORDER BY:** sort the rows. Done! The order is **FROM → WHERE → SELECT → ORDER BY**.'
        }
      ]),
      code(`SELECT FullName
FROM dbo.Customers
WHERE City = N'Colombo'
ORDER BY FullName;`, { title: 'Run the query from the animation', note: '`dbo.` is the default "folder" (schema) tables live in. The `N` before a text value means Unicode text, which works with any language.' }),

      h2('GROUP BY: squash rows into groups'),
      anim('GROUP BY Status → count orders per status', [
        {
          html: S(T('Orders (15 rows, some shown)', ['OrderId', 'Status'], [['1', 'Shipped'], ['2', 'Paid'], ['3', 'Pending'], ['4', 'Paid'], ['5', 'Shipped'], ['6', 'Cancelled'], ['7', 'Paid'], ['…', '…']])),
          caption: 'Each order has a Status. Question: **how many orders are there per status?**'
        },
        {
          html: S(
            T('Shipped', ['OrderId'], [['1'], ['5'], ['8'], ['12'], ['15']].map(r => ({ c: r, cls: 'ok fade' }))),
            T('Paid', ['OrderId'], [['2'], ['4'], ['7'], ['9'], ['11'], ['13']].map(r => ({ c: r, cls: 'hl fade', d: '.2s' }))),
            T('Pending', ['OrderId'], [['3'], ['10'], ['14']].map(r => ({ c: r, cls: 'fade', d: '.4s' }))),
            T('Cancelled', ['OrderId'], [{ c: ['6'], cls: 'bad fade', d: '.6s' }])),
          caption: '`GROUP BY Status` sorts the rows into piles: one pile per status.'
        },
        {
          html: S(T('Result', ['Status', 'Orders'], [['Shipped', '5'], ['Paid', '6'], ['Pending', '3'], ['Cancelled', '1']].map((r, i) => ({ c: r, cls: 'ok pop', d: i * 0.15 + 's' })))),
          caption: '`COUNT(*)` then counts each pile. **Each group becomes one row.**'
        }
      ]),
      code(`SELECT Status, COUNT(*) AS Orders
FROM dbo.Orders
GROUP BY Status;`, { title: 'Count orders per status' }),

      h2('JOIN: combine two tables'),
      anim('JOIN Orders to Customers using CustomerId', [
        {
          html: S(T('Orders', ['OrderId', 'CustomerId'], [['1', '1'], ['3', '2'], ['4', '3']]), T('Customers', ['CustomerId', 'FullName'], [['1', 'Nimal'], ['2', 'Kumari'], ['3', 'Ruwan']])),
          caption: 'An order only stores the customer\'s **number** (CustomerId). The name lives in Customers.'
        },
        {
          html: S(T('Orders', ['OrderId', 'CustomerId'], [{ c: ['1', '<b>1</b>'], cls: 'hl' }, ['3', '2'], ['4', '3']]), A('⇄'), T('Customers', ['CustomerId', 'FullName'], [{ c: ['<b>1</b>', 'Nimal'], cls: 'hl' }, ['2', 'Kumari'], ['3', 'Ruwan']])),
          caption: '`ON o.CustomerId = c.CustomerId`: for each order, find the customer with the **same number**.'
        },
        {
          html: S(T('Result', ['OrderId', 'FullName'], [['1', 'Nimal'], ['3', 'Kumari'], ['4', 'Ruwan']].map((r, i) => ({ c: r, cls: 'ok pop', d: i * 0.2 + 's' })))),
          caption: 'Matching rows are glued together into one wider row.'
        }
      ]),
      code(`SELECT o.OrderId, c.FullName, o.Status
FROM dbo.Orders AS o              -- "o" is a short nickname for Orders
JOIN dbo.Customers AS c           -- "c" is a short nickname for Customers
  ON o.CustomerId = c.CustomerId; -- match rows with the same CustomerId`, { title: 'Order + customer name' }),
      quiz('In which order does SQL Server process these clauses?', ['SELECT → FROM → WHERE', 'FROM → WHERE → SELECT → ORDER BY', 'WHERE → FROM → SELECT', 'ORDER BY → SELECT → FROM'], 1, 'First get the table (FROM), filter rows (WHERE), pick columns (SELECT), then sort (ORDER BY).'),
      p('Next: [1. CTEs & window functions →](#b-cte-window)')
    ]
  });

  // ===========================================================================
  // 1. CTEs & WINDOW FUNCTIONS
  // ===========================================================================
  lessons.push({
    id: 'b-cte-window', group: GROUP, title: '1. CTEs & window functions',
    keywords: 'beginner cte with window over partition row_number rank running total',
    intro: '~12 min. A CTE lets you solve a problem in named steps. A window function adds a calculation to every row without squashing the rows.',
    blocks: [
      h2('Part A: CTE (Common Table Expression)'),
      p(`**Idea:** a CTE is a **temporary result with a name** that you create at the top of a query, then use underneath it like a normal table.

Think of solving a maths problem on paper: you work out the middle step, write it in a box labelled "Totals", then use that box for the final answer. The CTE is the labelled box. It only exists while this one query runs.`),
      kw([
        ['WITH', 'Starts a CTE: "first, let me make a named result…"'],
        ['name AS ( … )', 'The name you choose, and the query that fills it (inside brackets)'],
        ['SUM(a * b)', 'Multiply then add up, e.g. quantity × price for every line'],
        ['GROUP BY OrderId', 'One result row per order']
      ]),
      diagram(`flowchart LR
  A["OrderItems table<br/>(one row per product line)"] -->|"step 1: add up lines per order"| B["CTE: OrderTotals<br/>(one row per order)"]
  B -->|"step 2: keep totals > 100,000"| C["Final result"]`, 'A CTE splits a question into two easy steps.'),
      anim('Find orders worth more than 100,000', [
        {
          html: S(T('OrderItems', ['OrderId', 'Qty', 'UnitPrice'], [['1', '1', '250,000'], ['1', '2', '3,500'], ['3', '1', '3,500'], ['3', '10', '450'], ['4', '1', '250,000'], ['4', '2', '65,000']])),
          caption: 'An order has several lines. To know an order\'s total, we must add up its lines.'
        },
        {
          html: S(T('OrderItems', ['OrderId', 'Qty × Price'], [{ c: ['1', '250,000'], cls: 'hl' }, { c: ['1', '7,000'], cls: 'hl' }, ['3', '3,500'], ['3', '4,500'], { c: ['4', '250,000'], cls: 'ok' }, { c: ['4', '130,000'], cls: 'ok' }]), A('→', '.3s'),
            T('CTE "OrderTotals"', ['OrderId', 'Total'], [{ c: ['1', '257,000'], cls: 'hl pop', d: '.5s' }, { c: ['3', '8,000'], cls: 'pop', d: '.7s' }, { c: ['4', '380,000'], cls: 'ok pop', d: '.9s' }])),
          caption: '**Step 1 (inside WITH):** group the lines by OrderId and SUM them. We name this result **OrderTotals**.'
        },
        {
          html: S(T('CTE "OrderTotals"', ['OrderId', 'Total'], [{ c: ['1', '257,000'], cls: 'ok' }, { c: ['3', '8,000'], cls: 'dim' }, { c: ['4', '380,000'], cls: 'ok' }]), A('→'),
            T('Final result', ['OrderId', 'Total'], [{ c: ['1', '257,000'], cls: 'ok pop' }, { c: ['4', '380,000'], cls: 'ok pop', d: '.2s' }])),
          caption: '**Step 2 (the main query):** `SELECT … FROM OrderTotals WHERE Total > 100000`, used just like a normal table.'
        }
      ]),
      code(`WITH OrderTotals AS (                         -- step 1: make a named result
    SELECT OrderId, SUM(Quantity * UnitPrice) AS Total
    FROM dbo.OrderItems
    GROUP BY OrderId
)
SELECT OrderId, Total                         -- step 2: use it like a table
FROM OrderTotals
WHERE Total > 100000
ORDER BY Total DESC;`, { title: 'Your first CTE' }),
      tip('Why not just one query? `WHERE` runs **before** `GROUP BY`, so you can\'t write `WHERE SUM(...) > 100000`. The CTE does the adding first, then you filter. It also makes long queries readable, like naming variables in C#.'),
      p('You can chain several CTEs, separated by commas: `WITH a AS (...), b AS (SELECT ... FROM a) SELECT ... FROM b`.'),

      h2('Part B: Window functions'),
      p(`**Idea:** \`GROUP BY\` **squashes** many rows into one row per group. A **window function** does a group calculation but **keeps every row** and writes the answer next to it.

Example: show every employee **and** the average salary of their department, on the same line.`),
      kw([
        ['OVER ( )', 'Turns a function into a window function: "calculate this, but keep all the rows"'],
        ['PARTITION BY col', 'Split the rows into groups (*windows*) by this column. Like GROUP BY, but nothing is squashed'],
        ['ORDER BY (inside OVER)', 'The order to walk through the rows *inside each window*'],
        ['ROW_NUMBER()', 'Number the rows 1, 2, 3… in each window'],
        ['RANK()', 'Like ROW_NUMBER, but ties share a number and the next number is skipped: 1, 2, 2, 4'],
        ['DENSE_RANK()', 'Ties share a number, nothing skipped: 1, 2, 2, 3'],
        ['SUM(x) OVER (ORDER BY …)', 'A running total: add as you go down the rows']
      ]),
      anim('GROUP BY squashes rows, OVER keeps them', [
        {
          html: S(T('Employees', ['Name', 'Dept', 'Salary'], [['Chamari', 'Eng', '850,000'], ['Isuru', 'Eng', '520,000'], ['Hasini', 'Eng', '380,000'], ['Lahiru', 'Sales', '700,000'], ['Oshadi', 'Sales', '310,000']])),
          caption: 'Five employees in two departments.'
        },
        {
          html: S(C(`${k('SELECT')} Dept, ${k('AVG')}(Salary)\n${k('FROM')} Employees\n${h(k('GROUP BY') + ' Dept')}`), A(),
            T('GROUP BY result', ['Dept', 'AvgSalary'], [{ c: ['Eng', '583,333'], cls: 'hl pop' }, { c: ['Sales', '505,000'], cls: 'hl pop', d: '.2s' }])),
          caption: 'With **GROUP BY**, the 5 rows are squashed into **2 rows**. The names are gone.'
        },
        {
          html: S(C(`${k('SELECT')} Name, Dept, Salary,\n  ${k('AVG')}(Salary) ${h(k('OVER') + ' (' + k('PARTITION BY') + ' Dept)')}\n${k('FROM')} Employees`), A(),
            T('Window function result', ['Name', 'Dept', 'Salary', 'DeptAvg'], [
              { c: ['Chamari', 'Eng', '850,000', '<b>583,333</b>'], cls: 'ok fade' }, { c: ['Isuru', 'Eng', '520,000', '<b>583,333</b>'], cls: 'ok fade', d: '.15s' }, { c: ['Hasini', 'Eng', '380,000', '<b>583,333</b>'], cls: 'ok fade', d: '.3s' },
              { c: ['Lahiru', 'Sales', '700,000', '<b>505,000</b>'], cls: 'hl fade', d: '.45s' }, { c: ['Oshadi', 'Sales', '310,000', '<b>505,000</b>'], cls: 'hl fade', d: '.6s' }])),
          caption: 'With **OVER (PARTITION BY Dept)**, all 5 rows stay, and each row gets its department\'s average next to it.'
        }
      ]),
      code(`SELECT e.FullName, d.Name AS Department, e.Salary,
       AVG(e.Salary) OVER (PARTITION BY e.DepartmentId) AS DeptAverage
FROM dbo.Employees AS e
JOIN dbo.Departments AS d ON d.DepartmentId = e.DepartmentId;`, { title: 'Every employee + their department average' }),

      h3('ROW_NUMBER: number the rows inside each group'),
      anim('ROW_NUMBER() OVER (PARTITION BY Dept ORDER BY Salary DESC)', [
        {
          html: S(T('Split into windows by Dept', ['Name', 'Dept', 'Salary'], [{ c: ['Chamari', 'Eng', '850,000'], cls: 'ok' }, { c: ['Isuru', 'Eng', '520,000'], cls: 'ok' }, { c: ['Hasini', 'Eng', '380,000'], cls: 'ok' }, { c: ['Lahiru', 'Sales', '700,000'], cls: 'hl' }, { c: ['Oshadi', 'Sales', '310,000'], cls: 'hl' }])),
          caption: '`PARTITION BY Dept`: Engineering is one window (green), Sales is another (yellow). `ORDER BY Salary DESC`: highest salary first inside each window.'
        },
        {
          html: S(T('Number the rows: Eng', ['Name', 'Dept', 'Salary', 'RowNum'], [{ c: ['Chamari', 'Eng', '850,000', '<b>1</b>'], cls: 'ok pop' }, { c: ['Isuru', 'Eng', '520,000', '<b>2</b>'], cls: 'ok pop', d: '.3s' }, { c: ['Hasini', 'Eng', '380,000', '<b>3</b>'], cls: 'ok pop', d: '.6s' }, { c: ['Lahiru', 'Sales', '700,000', ''], cls: 'dim' }, { c: ['Oshadi', 'Sales', '310,000', ''], cls: 'dim' }])),
          caption: 'Counting starts at 1 and goes down the Engineering window…'
        },
        {
          html: S(T('…then starts again for Sales', ['Name', 'Dept', 'Salary', 'RowNum'], [{ c: ['Chamari', 'Eng', '850,000', '1'], cls: 'ok' }, { c: ['Isuru', 'Eng', '520,000', '2'], cls: 'ok' }, { c: ['Hasini', 'Eng', '380,000', '3'], cls: 'ok' }, { c: ['Lahiru', 'Sales', '700,000', '<b>1</b>'], cls: 'hl pop' }, { c: ['Oshadi', 'Sales', '310,000', '<b>2</b>'], cls: 'hl pop', d: '.3s' }])),
          caption: '**The numbering restarts at 1 for every new window.** Add `WHERE RowNum = 1` (via a CTE) and you get the top earner of each department.'
        }
      ]),
      code(`WITH Ranked AS (
    SELECT e.FullName, d.Name AS Department, e.Salary,
           ROW_NUMBER() OVER (PARTITION BY e.DepartmentId ORDER BY e.Salary DESC) AS RowNum
    FROM dbo.Employees AS e
    JOIN dbo.Departments AS d ON d.DepartmentId = e.DepartmentId
)
SELECT Department, FullName, Salary
FROM Ranked
WHERE RowNum = 1;          -- the top earner in each department`, { title: 'Top earner per department (CTE + window function together)' }),
      table(['Salary', 'ROW_NUMBER', 'RANK', 'DENSE_RANK'], [['850,000', '1', '1', '1'], ['520,000', '2', '2', '2'], ['380,000', '3', '3', '3'], ['380,000', '4', '**3**', '**3**'], ['260,000', '5', '**5**', '**4**']], { caption: 'With a tie (two people on 380,000): ROW_NUMBER still gives unique numbers. RANK gives both 3 and skips 4. DENSE_RANK gives both 3 and doesn\'t skip.' }),
      code(`SELECT FullName, Salary,
       ROW_NUMBER() OVER (ORDER BY Salary DESC) AS RowNum,
       RANK()       OVER (ORDER BY Salary DESC) AS Rnk,
       DENSE_RANK() OVER (ORDER BY Salary DESC) AS DenseRnk
FROM dbo.Employees
WHERE DepartmentId = 1;      -- Engineering (Hasini and Yasith both earn 380,000)`, { title: 'See the three numbering functions side by side' }),

      h3('Running total'),
      anim('SUM(Total) OVER (ORDER BY OrderDate): a running total', [
        { html: S(T("Nimal's orders", ['Date', 'Total', 'RunningTotal'], [['2026-01-05', '257,000', ''], ['2026-02-11', '89,000', ''], ['2026-05-22', '10,200', '']])), caption: 'Nimal has 3 orders. We want a running total, like a bank statement balance.' },
        { html: S(T("Nimal's orders", ['Date', 'Total', 'RunningTotal'], [{ c: ['2026-01-05', '257,000', '<b>257,000</b>'], cls: 'ok' }, ['2026-02-11', '89,000', ''], ['2026-05-22', '10,200', '']])), caption: 'Row 1: nothing before it, so the total is just 257,000.' },
        { html: S(T("Nimal's orders", ['Date', 'Total', 'RunningTotal'], [{ c: ['2026-01-05', '257,000', '257,000'], cls: 'dim' }, { c: ['2026-02-11', '89,000', '<b>346,000</b>'], cls: 'ok' }, ['2026-05-22', '10,200', '']])), caption: 'Row 2: 257,000 + 89,000 = **346,000**.' },
        { html: S(T("Nimal's orders", ['Date', 'Total', 'RunningTotal'], [{ c: ['2026-01-05', '257,000', '257,000'], cls: 'dim' }, { c: ['2026-02-11', '89,000', '346,000'], cls: 'dim' }, { c: ['2026-05-22', '10,200', '<b>356,200</b>'], cls: 'ok' }])), caption: 'Row 3: 346,000 + 10,200 = **356,200**. Each row adds itself to everything before it.' }
      ], { interval: 2600 }),
      code(`SELECT OrderId, OrderDate, Total,
       SUM(Total) OVER (ORDER BY OrderDate) AS RunningTotal
FROM dbo.vw_OrderTotals          -- a saved query (view) that gives each order's total
WHERE CustomerId = 1;`, { title: 'Running total of Nimal\'s spending' }),
      quiz('What is the main difference between `GROUP BY` and `OVER (PARTITION BY …)`?', ['There is no difference', 'GROUP BY squashes each group into one row. OVER keeps every row and adds the group\'s result next to it', 'OVER is faster', 'GROUP BY can only count'], 1, 'Window functions keep the detail rows. That\'s why they\'re great for rankings and running totals.'),
      quiz('How long does a CTE exist?', ['Forever, like a table', 'Until you restart SQL Server', 'Only for the single query that comes right after it', 'Until you DROP it'], 2, 'A CTE is temporary and belongs to one statement. To keep a query, save it as a **view**.'),
      p('Ready for more? Full lesson: [CTEs & window functions](#cte-window). Next beginner lesson: [2. Transactions & locking →](#b-transactions)')
    ]
  });

  // ===========================================================================
  // 2. TRANSACTIONS
  // ===========================================================================
  lessons.push({
    id: 'b-transactions', group: GROUP, title: '2. Transactions & locking',
    keywords: 'beginner transaction commit rollback acid lock isolation dirty read',
    intro: '~10 min. A transaction groups several changes into **all or nothing**, like a bank transfer.',
    blocks: [
      h2('The problem'),
      p(`Moving 5,000 from Nimal to Kumari is **two** changes: take 5,000 from Nimal, then add 5,000 to Kumari.

What if the power cuts out after the first step? Nimal loses 5,000 and Kumari never gets it: **money disappears**. A **transaction** says: "these steps belong together. Either **all** of them happen, or **none** of them do."`),
      kw([
        ['BEGIN TRANSACTION', 'Start the group. From here on, changes are "pending"'],
        ['COMMIT', 'Save all the pending changes permanently ("yes, keep it")'],
        ['ROLLBACK', 'Undo **everything** since BEGIN TRANSACTION ("cancel")'],
        ['BEGIN TRY … END TRY', 'Run this code. If an error happens, jump to the CATCH part'],
        ['BEGIN CATCH … END CATCH', 'What to do when something went wrong, usually ROLLBACK'],
        ['ERROR_MESSAGE()', 'The text of the error that happened (used inside CATCH)'],
        ['PRINT', 'Show a message in the Messages tab'],
        ['@@TRANCOUNT', 'How many transactions are open right now (0 = none)']
      ]),
      anim('A transfer that works: COMMIT', [
        { html: S(T('Accounts', ['Owner', 'Balance'], [['Nimal', '50,000'], ['Kumari', '20,000']]), N('BEGIN TRANSACTION', 'purple pop')), caption: '**BEGIN TRANSACTION:** start the all-or-nothing group.' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal', '<b>45,000</b> ⏳'], cls: 'hl' }, ['Kumari', '20,000']]), N('UPDATE: Nimal − 5,000', 'warn pop', 'pending, not saved yet')), caption: 'Step 1: take 5,000 from Nimal. ⏳ means the change is **pending**, not saved yet.' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal', '<b>45,000</b> ⏳'], cls: 'hl' }, { c: ['Kumari', '<b>25,000</b> ⏳'], cls: 'hl' }]), N('UPDATE: Kumari + 5,000', 'warn pop', 'pending, not saved yet')), caption: 'Step 2: give 5,000 to Kumari. Still pending.' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal', '<b>45,000</b> ✔'], cls: 'ok' }, { c: ['Kumari', '<b>25,000</b> ✔'], cls: 'ok' }]), N('COMMIT', 'ok pop', 'both changes saved together')), caption: '**COMMIT:** both changes are saved permanently **at the same moment**. Total money is still 70,000. ✔' }
      ]),
      anim('A transfer that fails: ROLLBACK', [
        { html: S(T('Accounts', ['Owner', 'Balance'], [['Kumari', '20,000'], ['Ruwan', '0']]), N('BEGIN TRANSACTION', 'purple pop')), caption: 'Kumari tries to send **30,000** to Ruwan, but she only has 20,000.' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [['Kumari', '20,000'], { c: ['Ruwan', '<b>30,000</b> ⏳'], cls: 'hl' }]), N('UPDATE: Ruwan + 30,000', 'warn pop', 'pending')), caption: 'Step 1 works: Ruwan gets +30,000 (pending).' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [{ c: ['Kumari', '−10,000 ✘'], cls: 'bad' }, { c: ['Ruwan', '30,000 ⏳'], cls: 'hl' }]), N('ERROR!', 'bad pop', 'balance can\'t go below 0')), caption: 'Step 2 fails: a rule (a CHECK constraint) says a balance can\'t be negative. **Error!**' },
        { html: S(T('Accounts', ['Owner', 'Balance'], [{ c: ['Kumari', '20,000'], cls: 'ok' }, { c: ['Ruwan', '0'], cls: 'ok' }]), N('ROLLBACK', 'ok pop', 'everything undone')), caption: '**ROLLBACK:** step 1 is undone too. Nobody gained or lost money, as if nothing ever happened. ✔' },
        { html: S(T('Without a transaction…', ['Owner', 'Balance'], [{ c: ['Kumari', '20,000'], cls: '' }, { c: ['Ruwan', '<b>30,000</b>'], cls: 'bad' }]), N('30,000 created from nothing!', 'bad pop')), caption: 'Without a transaction, step 1 would stay saved, and **30,000 would appear from nowhere**. That is why banks use transactions.' }
      ]),
      h2('Try it'),
      code(`BEGIN TRANSACTION;                                                   -- start the group
    UPDATE dbo.Accounts SET Balance = Balance - 5000 WHERE AccountId = 1;  -- Nimal −5,000
    UPDATE dbo.Accounts SET Balance = Balance + 5000 WHERE AccountId = 2;  -- Kumari +5,000
COMMIT;                                                              -- save both

SELECT * FROM dbo.Accounts;`, { title: '1. A transfer that commits', note: 'The **Sandbox** undoes it afterwards, so you can run it as often as you like.' }),
      code(`BEGIN TRANSACTION;
    UPDATE dbo.Accounts SET Balance = 0 WHERE AccountId = 1;     -- oops: wiped Nimal's money!
    SELECT 'Inside the transaction' AS Moment, * FROM dbo.Accounts;
ROLLBACK;                                                        -- undo it
SELECT 'After ROLLBACK' AS Moment, * FROM dbo.Accounts;          -- Nimal has 50,000 again`, { title: '2. ROLLBACK as an "undo button"', sandbox: false, note: 'Sandbox is off because the code undoes itself with ROLLBACK.' }),
      code(`BEGIN TRY
    BEGIN TRANSACTION;
        UPDATE dbo.Accounts SET Balance = Balance + 30000 WHERE AccountId = 3;  -- Ruwan +30,000
        UPDATE dbo.Accounts SET Balance = Balance - 30000 WHERE AccountId = 2;  -- Kumari −30,000 → ERROR
    COMMIT;
    PRINT 'Transfer done';
END TRY
BEGIN CATCH
    ROLLBACK;                                            -- undo the whole transfer
    PRINT 'Transfer cancelled: ' + ERROR_MESSAGE();      -- see the Messages tab
END CATCH;

SELECT * FROM dbo.Accounts;                              -- nothing changed`, { title: '3. Automatic undo with TRY / CATCH', sandbox: false, note: 'This is the pattern used in real code: try the steps, and if any fails, roll everything back.' }),
      tip('The 4 promises of a transaction are called **ACID**. **A**tomic (all or nothing), **C**onsistent (rules like "no negative balance" always hold), **I**solated (others don\'t see your half-done work), **D**urable (once committed, it survives a crash).'),

      h2('Locking: one person edits a row at a time'),
      p(`Many people use the database at the same time. While your transaction is changing a row, SQL Server puts a **lock** 🔒 on it, like the "occupied" sign on a toilet door. Anyone else who wants to change or read that row **waits** until you COMMIT or ROLLBACK.

Keep transactions **short**: the longer you hold a lock, the longer others wait. This waiting is called **blocking**.`),
      anim('Two users, one row', [
        { html: S(`<div class="lane"><b>User A</b>${N('BEGIN TRAN', 'purple pop')}</div>`, T('Accounts', ['Owner', 'Balance'], [['Nimal', '50,000']]), `<div class="lane"><b>User B</b></div>`), caption: 'User A starts a transaction.' },
        { html: S(`<div class="lane"><b>User A</b>${N('UPDATE Nimal → 45,000', 'warn')}</div>`, T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal 🔒', '45,000 ⏳'], cls: 'hl pop' }]), `<div class="lane"><b>User B</b></div>`), caption: 'User A changes Nimal\'s row. SQL Server **locks** that row 🔒.' },
        { html: S(`<div class="lane"><b>User A</b>${N('…still working', 'warn')}</div>`, T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal 🔒', '45,000 ⏳'], cls: 'hl' }]), `<div class="lane"><b>User B</b>${N('SELECT Nimal\'s balance', 'bad pop', '⏸ waiting for the lock…')}</div>`), caption: 'User B wants to read Nimal\'s balance, but the row is locked, so **User B waits**. It won\'t see half-finished data.' },
        { html: S(`<div class="lane"><b>User A</b>${N('COMMIT', 'ok pop')}</div>`, T('Accounts', ['Owner', 'Balance'], [{ c: ['Nimal', '45,000 ✔'], cls: 'ok' }]), `<div class="lane"><b>User B</b>${N('gets 45,000', 'ok pop', 'lock released, B continues', '.4s')}</div>`), caption: 'User A commits, the lock is released, and User B immediately gets the **saved** value: 45,000.' }
      ]),
      h2('Isolation levels: how much of others\' unfinished work can you see?'),
      table(['Level', 'In plain words'], [
        ['**READ COMMITTED** (the default)', 'You only ever see **saved** (committed) data. If a row is being changed, you wait.'],
        ['**READ UNCOMMITTED** / `WITH (NOLOCK)`', 'You don\'t wait, and you may see **unsaved drafts** that could still be rolled back. This is called a **dirty read**.'],
        ['**SNAPSHOT**', 'You see the last saved version without waiting. SQL Server keeps old copies of rows for you.']
      ]),
      anim('A dirty read with NOLOCK', [
        { html: S(`<div class="lane"><b>User A</b>${N('UPDATE price 3,500 → 1', 'warn pop', 'a typo, not committed')}</div>`, `<div class="lane"><b>User B (NOLOCK)</b></div>`), caption: 'User A accidentally sets the Mouse price to 1 and hasn\'t committed yet.' },
        { html: S(`<div class="lane"><b>User A</b>${N('UPDATE price 3,500 → 1', 'warn', 'not committed')}</div>`, `<div class="lane"><b>User B (NOLOCK)</b>${N('reads price = 1', 'bad pop', 'doesn\'t wait, sees the draft')}</div>`), caption: 'User B reads with NOLOCK. It doesn\'t wait, so it sees the **unsaved** price of 1.' },
        { html: S(`<div class="lane"><b>User A</b>${N('ROLLBACK', 'ok pop', 'price is 3,500 again')}</div>`, `<div class="lane"><b>User B (NOLOCK)</b>${N('already used price = 1 😬', 'bad', 'a value that never really existed')}</div>`), caption: 'User A rolls back. The price is 3,500 again, but User B already used a price that **never really existed**. That is why NOLOCK is risky.' }
      ]),
      quiz('A transaction runs 3 UPDATEs. The 3rd one fails and the code calls ROLLBACK. What happens to the first two?', ['They stay saved', 'They are undone too: all or nothing', 'Only the 2nd is undone', 'SQL Server asks you'], 1, 'ROLLBACK undoes everything since BEGIN TRANSACTION.'),
      quiz('Why should transactions be kept short?', ['They use more disk space', 'Other users wait (are blocked) while your locks are held', 'SQL Server deletes long ones', 'They can\'t contain SELECT'], 1, 'Locks are released only at COMMIT or ROLLBACK. Never wait for user input inside a transaction.'),
      p('Ready for more? Full lesson: [Transactions, locking & isolation](#transactions). Next: [3. Indexes →](#b-indexes)')
    ]
  });

  // ===========================================================================
  // 3. INDEXES
  // ===========================================================================
  const unsorted = [12, 3, 7, 25, 7, 18, 1, 30, 9, 7, 14, 22];
  const scanFrame = (upto, caption) => ({
    html: S(T('BigOrders (not sorted by CustomerId)', ['Row', 'CustomerId'], unsorted.map((v, i) => ({
      c: [i + 1, v === 7 && i < upto ? `<b>${v}</b> ✔` : v],
      cls: i < upto ? (v === 7 ? 'ok' : 'dim') : ''
    }))), N(`checked ${upto} of 12 rows`, upto === 12 ? 'warn pop' : 'purple', upto === 12 ? 'found 3 matches' : 'looking for CustomerId = 7')),
    caption
  });
  const sorted = [1, 3, 7, 7, 7, 9, 12, 14, 18, 22, 25, 30];
  const seekFrame = (marks, caption, label, cls = 'purple') => ({
    html: S(T('Index on CustomerId (sorted)', ['Pos', 'CustomerId'], sorted.map((v, i) => ({ c: [i + 1, marks[i] === 'ok' ? `<b>${v}</b> ✔` : v], cls: marks[i] || '' }))), N(label, cls + ' pop')),
    caption
  });
  const m = (o) => { const a = Array(12).fill('dim'); Object.entries(o).forEach(([i, v]) => { a[i] = v; }); return a; };

  lessons.push({
    id: 'b-indexes', group: GROUP, title: '3. Indexes',
    keywords: 'beginner index seek scan clustered nonclustered b-tree phone book',
    intro: '~10 min. An index is like the index at the back of a book: it lets SQL Server jump straight to the right rows instead of reading the whole table.',
    blocks: [
      h2('The idea: a phone book'),
      p(`Imagine finding everyone called "Perera" in a pile of 300,000 **unsorted** papers. You'd have to read **every** paper. That is a **scan**.

Now imagine a **phone book sorted by surname**. You open it near the middle, see "M", go forward to "P"… and you're there after a few jumps. That is a **seek**. An **index** is SQL Server's sorted phone book for a column.`),
      kw([
        ['Index', 'A sorted copy of one or more columns, with pointers back to the full rows'],
        ['Scan', 'Read every row, top to bottom (slow on big tables)'],
        ['Seek', 'Jump straight to the matching rows using the index (fast)'],
        ['CREATE INDEX name ON table (column)', 'Build an index on that column'],
        ['Clustered index', 'The table *itself*, stored sorted by this column (usually the ID). Only **one** per table'],
        ['Nonclustered index', 'A separate sorted list that points to the rows. You can have **many**'],
        ['INCLUDE (cols)', 'Also store these extra columns in the index, so SQL Server doesn\'t need to go back to the table'],
        ['Logical reads', 'How many 8 KB pages SQL Server read. **Smaller = less work**']
      ]),
      anim('Without an index: a SCAN reads every row', [
        scanFrame(0, 'Question: find the orders of **customer 7**. The rows are in no particular order.'),
        scanFrame(4, 'SQL Server checks rows 1, 2, 3, 4… one by one. Row 3 matches ✔.'),
        scanFrame(8, 'It must keep going. Another 7 could be anywhere! Row 5 matches.'),
        scanFrame(12, 'It reached the end: **12 rows read to find 3**. With 300,000 rows, that is 300,000 checks.')
      ], { interval: 2400 }),
      anim('With an index: a SEEK jumps to the answer', [
        seekFrame(Array(12).fill(''), 'The index keeps CustomerId **sorted**, like a phone book.', 'looking for 7'),
        seekFrame(m({ 6: 'hl' }), 'Jump to the **middle**: position 7 holds 12. 7 is smaller than 12, so the answer is in the **top half**. Ignore the rest.', '7 < 12 → go up'),
        seekFrame(m({ 2: 'hl', 6: 'dim' }), 'Middle of the top half: position 3 holds **7**. Found the start!', 'found 7!'),
        seekFrame(m({ 2: 'ok', 3: 'ok', 4: 'ok', 5: 'hl' }), 'Read forward while it\'s still 7: positions 3, 4, 5. Position 6 is 9, so **stop**. Only **5 rows touched** instead of 12.', 'done: 5 checks', 'ok')
      ], { interval: 3000 }),
      h2('How an index is stored: a tree'),
      p('Real indexes are stored as a **B-tree** (balanced tree). The top page says which page to go to next, like the letter tabs on a dictionary. Even with millions of rows, SQL Server only reads 3–4 pages to find a value.'),
      diagram(`flowchart TD
  R["Root page<br/>CustomerId 1–10,000 → left<br/>10,001–20,000 → right"]
  R --> A["Page: 1–5,000"]
  R --> B["Page: 5,001–10,000"]
  R --> C["Page: 10,001–15,000"]
  R --> D["Page: 15,001–20,000"]
  B --> L1["Leaf: …, 7,410, 7,411, 7,412, …<br/>(pointers to the rows)"]
  style R fill:#e8eefb,stroke:#2b59c3
  style B fill:#fff3c4,stroke:#c9a227
  style L1 fill:#d7f2e4,stroke:#1f8a5b`, 'Finding CustomerId 7,411: root → the "5,001–10,000" page → leaf. Three page reads.'),
      h2('Clustered vs nonclustered: the book analogy'),
      table(['', 'Clustered index', 'Nonclustered index'], [
        ['Book analogy', 'The **pages of the book**, in page-number order', 'The **index at the back**: "Triggers … page 212"'],
        ['What it is', 'The table itself, sorted by this column', 'A separate sorted list + a pointer to the row'],
        ['How many?', '**One** (a book has one page order)', '**Many** (index by topic, by author…)'],
        ['Usually on', 'The primary key (OrderId)', 'Columns you search by (CustomerId, Email)']
      ]),
      anim('Nonclustered index → key lookup → full row', [
        { html: S(T('Index on City', ['City', '→ OrderId'], [['Colombo', '4'], ['Galle', '2'], { c: ['Kandy', '7'], cls: 'hl pop' }, ['Matara', '1']]), T('Table (clustered by OrderId)', ['OrderId', 'City', 'Amount', 'Date'], [['1', 'Matara', '3,000', '…'], ['2', 'Galle', '9,500', '…'], ['…', '', '', ''], ['7', 'Kandy', '12,000', '…']])), caption: 'Query: `SELECT Amount FROM Orders WHERE City = \'Kandy\'`. Step 1: **seek** in the City index and find Kandy → OrderId 7.' },
        { html: S(T('Index on City', ['City', '→ OrderId'], [['Colombo', '4'], ['Galle', '2'], { c: ['Kandy', '7'], cls: 'hl' }, ['Matara', '1']]), A('→', '.1s'), T('Table (clustered by OrderId)', ['OrderId', 'City', 'Amount', 'Date'], [['1', 'Matara', '3,000', '…'], ['2', 'Galle', '9,500', '…'], ['…', '', '', ''], { c: ['7', 'Kandy', '<b>12,000</b>', '…'], cls: 'ok pop', d: '.3s' }])), caption: 'Step 2: the index doesn\'t contain Amount, so SQL Server follows the pointer to row 7 in the table. This extra trip is a **key lookup**.' },
        { html: S(T('Index on City INCLUDE (Amount)', ['City', 'Amount', '→ OrderId'], [['Colombo', '5,000', '4'], ['Galle', '9,500', '2'], { c: ['Kandy', '<b>12,000</b>', '7'], cls: 'ok pop' }, ['Matara', '3,000', '1']])), caption: 'Better: `INCLUDE (Amount)` stores Amount **inside the index**. The answer is right there, so there is no trip to the table. This is called a **covering index**.' }
      ]),
      h2('See it for real on 300,000 rows'),
      p('Tick **Plan** and **IO/Time** (already on below), run each example, and compare: the **Execution plan** tab shows *Scan* (orange) vs *Seek* (green), and the **Messages** tab shows the *logical reads*.'),
      code(`SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'A. No index → scan', plan: true, stats: true, note: 'Look for **Clustered Index Scan** and a few **thousand** logical reads.' }),
      code(`CREATE INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'B. With an index → seek', plan: true, stats: true, note: '**Index Seek** + **Key Lookup**: about **50** logical reads. `GO` means "run the part above first".' }),
      code(`CREATE INDEX IX_BigOrders_CustomerId_Cover ON dbo.BigOrders (CustomerId) INCLUDE (OrderDate, Amount);
GO
SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'C. Covering index → seek only', plan: true, stats: true, note: 'Just one **Index Seek** and about **3** logical reads. Thousands → 3!' }),
      h2('The catch: indexes cost something'),
      table(['👍 Indexes make faster…', '👎 Indexes make slower / bigger…'], [
        ['SELECT … WHERE column = value', 'INSERT, UPDATE, DELETE: every index must be updated too'],
        ['JOIN … ON column', 'Disk and memory: each index is an extra copy of some columns'],
        ['ORDER BY column', ''],
      ], { caption: 'Like a book: adding a page means updating the index at the back too. So index the columns you **search by often**, not every column.' }),
      quiz('A query on a 1-million-row table filters `WHERE Email = \'a@b.com\'` and there is no index on Email. What does SQL Server do?', ['A seek', 'A scan: it reads every row', 'It refuses to run', 'It creates an index automatically'], 1, 'With no sorted list to jump into, it has to check every row. `CREATE INDEX IX_Email ON Users(Email)` turns this into a seek.'),
      quiz('How many clustered indexes can a table have?', ['One', 'Two', 'Up to 999', 'Unlimited'], 0, 'The clustered index is the table\'s own sort order, like a book\'s page order, so there can only be one.'),
      p('Ready for more? Full lesson: [Indexes](#indexes). Next: [4. Triggers →](#b-triggers)')
    ]
  });

  // ===========================================================================
  // 4. TRIGGERS
  // ===========================================================================
  lessons.push({
    id: 'b-triggers', group: GROUP, title: '4. Triggers',
    keywords: 'beginner trigger after insert update delete inserted deleted audit',
    intro: '~8 min. A trigger is code that runs **automatically** when data changes, like a motion-sensor light that switches on by itself.',
    blocks: [
      h2('The idea'),
      p(`A trigger is a rule: **"WHEN this happens to this table → automatically DO that."**

- *When* a new order is inserted → write it to a log.
- *When* a price is updated → save the old price in a history table.
- *When* someone deletes a customer → mark them as deleted instead.

You never run a trigger yourself. SQL Server runs it every time the event happens, no matter which app or person made the change.`),
      diagram(`flowchart LR
  A["You run:<br/>UPDATE Products<br/>SET Price = 4000"] --> B["SQL Server<br/>changes the row"]
  B --> C{{"Trigger fires<br/>automatically ⚡"}}
  C --> D["Trigger code runs:<br/>INSERT INTO PriceHistory"]
  D --> E["Done ✔<br/>(both saved together)"]
  style C fill:#f2edfb,stroke:#7a4fd0`, 'The trigger runs in the same transaction as your UPDATE: if the trigger fails, your UPDATE is undone too.'),
      kw([
        ['CREATE TRIGGER name', 'Make a new trigger and give it a name'],
        ['ON table', 'Which table it watches'],
        ['AFTER INSERT / UPDATE / DELETE', 'Which event wakes it up. It runs *after* the change happens'],
        ['AS BEGIN … END', 'The code the trigger runs, between BEGIN and END'],
        ['inserted', 'A temporary table holding the **new** version of the changed rows ("after photo")'],
        ['deleted', 'A temporary table holding the **old** version of the changed rows ("before photo")'],
        ['SET NOCOUNT ON', 'Don\'t print "(1 row affected)" messages from inside the trigger. Just tidier'],
        ['GO', 'Ends a batch. CREATE TRIGGER must be alone in its batch']
      ]),
      h2('inserted and deleted: before and after photos'),
      table(['When you run…', 'deleted (before)', 'inserted (after)'], [
        ['INSERT', 'empty (nothing existed before)', 'the new rows'],
        ['DELETE', 'the rows that were removed', 'empty'],
        ['UPDATE', 'the rows **before** the change', 'the rows **after** the change']
      ]),
      anim('A price-history trigger in action', [
        { html: S(C(`${k('UPDATE')} Products\n${k('SET')} Price = 4000\n${k('WHERE')} Name = 'Mouse';`), T('Products', ['ProductId', 'Name', 'Price'], [{ c: ['2', 'Mouse', '3,500'], cls: 'hl' }])), caption: 'Someone raises the Mouse price from 3,500 to 4,000.' },
        { html: S(T('Products', ['ProductId', 'Name', 'Price'], [{ c: ['2', 'Mouse', '<b>4,000</b>'], cls: 'ok' }]), A('⚡', '.2s'), N('Trigger fires!', 'purple pop', 'trg_Products_PriceHistory', '.4s')), caption: 'SQL Server changes the row, then **wakes the trigger up** automatically.' },
        { html: S(T('deleted (before photo)', ['ProductId', 'Price'], [{ c: ['2', '3,500'], cls: 'bad pop' }]), T('inserted (after photo)', ['ProductId', 'Price'], [{ c: ['2', '4,000'], cls: 'ok pop', d: '.3s' }])), caption: 'Inside the trigger, **deleted** holds the old row and **inserted** holds the new row.' },
        { html: S(C(`${k('INSERT INTO')} PriceHistory\n${k('SELECT')} d.ProductId, d.Price, i.Price\n${k('FROM')} inserted i\n${k('JOIN')} deleted d\n  ${k('ON')} d.ProductId = i.ProductId;`), A(), T('PriceHistory', ['ProductId', 'OldPrice', 'NewPrice'], [{ c: ['2', '3,500', '4,000'], cls: 'ok pop', d: '.3s' }])), caption: 'The trigger JOINs the before and after photos and writes one history row. Nobody had to remember to do it!' }
      ]),
      h2('Try it: log every new order'),
      code(`-- 1) A table to write the log into
CREATE TABLE lab.NewOrderLog (
    LogId    INT IDENTITY PRIMARY KEY,         -- IDENTITY = numbered automatically 1, 2, 3…
    OrderId  INT,
    LoggedAt DATETIME2 DEFAULT SYSDATETIME()   -- filled with the current time automatically
);
GO
-- 2) The trigger: AFTER INSERT on Orders
CREATE TRIGGER trg_Orders_LogNew
ON dbo.Orders
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO lab.NewOrderLog (OrderId)
    SELECT OrderId FROM inserted;        -- "inserted" = the new order rows
END;
GO
-- 3) Insert two orders… we never touch NewOrderLog ourselves
INSERT INTO dbo.Orders (CustomerId, Status) VALUES (4, 'Pending');
INSERT INTO dbo.Orders (CustomerId, Status) VALUES (7, 'Pending');

-- 4) …but the trigger filled it in
SELECT * FROM lab.NewOrderLog;`, { title: 'AFTER INSERT trigger', note: 'Runs in the **Sandbox**, so the table, trigger and orders all disappear afterwards.' }),
      h2('Try it: price history (uses before + after)'),
      code(`CREATE TABLE lab.PriceHistory (ProductId INT, OldPrice DECIMAL(18,2), NewPrice DECIMAL(18,2), ChangedAt DATETIME2 DEFAULT SYSDATETIME());
GO
CREATE TRIGGER trg_Products_PriceHistory
ON dbo.Products
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    INSERT INTO lab.PriceHistory (ProductId, OldPrice, NewPrice)
    SELECT d.ProductId, d.Price, i.Price
    FROM inserted AS i                         -- after photo
    JOIN deleted  AS d ON d.ProductId = i.ProductId   -- before photo, matched by ProductId
    WHERE i.Price <> d.Price;                  -- <> means "not equal": only real price changes
END;
GO
UPDATE dbo.Products SET Price = 4000 WHERE Name = N'Mouse';
UPDATE dbo.Products SET Price = Price * 1.10 WHERE Category = N'Furniture';   -- 3 rows at once
SELECT * FROM lab.PriceHistory;`, { title: 'AFTER UPDATE trigger with inserted + deleted' }),
      warn('A trigger runs **once per statement, not once per row**. The second UPDATE above changes 3 furniture rows, so the trigger runs once with **3 rows** in inserted and deleted. That\'s why we use `INSERT … SELECT FROM inserted` (which handles any number of rows) and never store just one row in a variable.'),
      quiz('You run one UPDATE that changes 50 rows. How many times does an AFTER UPDATE trigger run?', ['50 times', 'Once, with 50 rows in inserted/deleted', 'Never', 'Twice'], 1, 'Once per statement. Always write trigger code that works for many rows.'),
      quiz('Inside an UPDATE trigger, where do you find the price *before* the change?', ['In inserted', 'In deleted', 'In the Products table', 'You can\'t'], 1, 'deleted = before photo, inserted = after photo.'),
      p('Ready for more? Full lesson: [Triggers](#triggers). Next: [5. Stored procedures & functions →](#b-procedures)')
    ]
  });

  // ===========================================================================
  // 5. STORED PROCEDURES & FUNCTIONS
  // ===========================================================================
  lessons.push({
    id: 'b-procedures', group: GROUP, title: '5. Stored procedures & functions',
    keywords: 'beginner stored procedure function parameter exec variable declare',
    intro: '~8 min. A stored procedure is a saved piece of SQL with a name, like a method in C#. A function calculates a value you can use inside a SELECT.',
    blocks: [
      h2('The idea: a saved recipe'),
      p(`Instead of typing the same query again and again, you **save it once with a name**, then just call the name. Like a C# method, it can take **parameters** (inputs):

- C#: \`GetCustomerOrders(1)\`
- SQL: \`EXEC lab.GetCustomerOrders @CustomerId = 1;\`

Your app calls the procedure by name, and SQL Server runs the saved steps.`),
      diagram(`flowchart LR
  A["Your app / you"] -->|"EXEC lab.GetCustomerOrders @CustomerId = 1"| B["Stored procedure<br/>(saved SQL in the database)"]
  B --> C["Runs its steps<br/>with CustomerId = 1"]
  C -->|"result rows"| A
  style B fill:#f2edfb,stroke:#7a4fd0`),
      kw([
        ['CREATE PROCEDURE name', 'Save a new procedure under this name'],
        ['@Name TYPE', 'A **parameter** (an input). Every variable or parameter name starts with **@**'],
        ['@Name TYPE = value', 'A parameter with a **default**: you may leave it out when calling'],
        ['AS BEGIN … END', 'The saved steps'],
        ['EXEC name @Param = value', 'Run (execute) the procedure, giving values for the parameters'],
        ['DECLARE @x INT = 5', 'Make a variable called @x that holds a number'],
        ['CREATE FUNCTION … RETURNS type', 'Save a calculation that **returns** a value'],
        ['RETURN', 'Send the answer back from a function']
      ]),
      anim('One procedure, different inputs', [
        { html: S(C(`${k('CREATE PROCEDURE')} lab.GetCustomerOrders\n    ${h('@CustomerId INT')}\n${k('AS')}\n${k('SELECT')} OrderId, Status\n${k('FROM')} Orders\n${k('WHERE')} CustomerId = ${h('@CustomerId')};`)), caption: 'The procedure is saved once. **@CustomerId** is a blank to be filled in when it\'s called.' },
        { html: S(C(`${k('EXEC')} lab.GetCustomerOrders ${h('@CustomerId = 1')};`), A(), C(`${k('WHERE')} CustomerId = ${h('1')}`), A(), T('Result', ['OrderId', 'Status'], [['1', 'Shipped'], ['2', 'Paid'], ['9', 'Paid']].map((r, i) => ({ c: r, cls: 'ok pop', d: i * 0.15 + 's' })))), caption: 'Call it with **1**: the blank becomes 1, and you get Nimal\'s orders.' },
        { html: S(C(`${k('EXEC')} lab.GetCustomerOrders ${h('@CustomerId = 2')};`), A(), C(`${k('WHERE')} CustomerId = ${h('2')}`), A(), T('Result', ['OrderId', 'Status'], [['3', 'Pending'], ['6', 'Cancelled']].map((r, i) => ({ c: r, cls: 'hl pop', d: i * 0.15 + 's' })))), caption: 'Same procedure, called with **2**: Kumari\'s orders. Write once, reuse with any input.' }
      ]),
      h2('Try it'),
      code(`CREATE PROCEDURE lab.GetCustomerOrders
    @CustomerId INT                 -- the input
AS
BEGIN
    SELECT OrderId, OrderDate, Status
    FROM dbo.Orders
    WHERE CustomerId = @CustomerId; -- use the input like a value
END;
GO
EXEC lab.GetCustomerOrders @CustomerId = 1;
EXEC lab.GetCustomerOrders @CustomerId = 2;`, { title: '1. A procedure with one parameter', note: 'Two EXEC calls give two result grids in the Results tab.' }),
      code(`CREATE PROCEDURE lab.FindProducts
    @Category NVARCHAR(50),
    @MaxPrice DECIMAL(18,2) = 1000000      -- default: if you don't pass it, 1,000,000 is used
AS
BEGIN
    SELECT Name, Price
    FROM dbo.Products
    WHERE Category = @Category AND Price <= @MaxPrice
    ORDER BY Price;
END;
GO
EXEC lab.FindProducts @Category = N'Electronics';                     -- uses the default max price
EXEC lab.FindProducts @Category = N'Electronics', @MaxPrice = 10000;  -- only cheap ones`, { title: '2. Two parameters, one with a default' }),
      code(`CREATE PROCEDURE lab.Restock
    @ProductId INT,
    @Qty       INT
AS
BEGIN
    UPDATE dbo.Products SET StockQty = StockQty + @Qty WHERE ProductId = @ProductId;   -- step 1: change
    SELECT ProductId, Name, StockQty FROM dbo.Products WHERE ProductId = @ProductId;    -- step 2: show
END;
GO
EXEC lab.Restock @ProductId = 7, @Qty = 20;     -- the Chair had 0 in stock`, { title: '3. A procedure that does a job (changes data)' }),
      h2('Variables'),
      code(`DECLARE @Vat DECIMAL(4,2) = 0.18;                 -- make a variable and give it a value
DECLARE @Cheapest DECIMAL(18,2);
SELECT @Cheapest = MIN(Price) FROM dbo.Products;  -- store a query result in it
SELECT @Cheapest AS CheapestPrice, @Cheapest * (1 + @Vat) AS WithVat;`, { title: 'DECLARE and use variables' }),
      h2('Functions: a calculator you can use inside SELECT'),
      p('A **function** takes inputs and **returns** a value. Unlike a procedure, you can use it *inside* a SELECT, just like the built-in `UPPER()` or `ROUND()`.'),
      code(`CREATE FUNCTION lab.AddVat (@Price DECIMAL(18,2))
RETURNS DECIMAL(18,2)            -- what type of answer it gives back
AS
BEGIN
    RETURN @Price * 1.18;        -- the answer
END;
GO
SELECT Name, Price, lab.AddVat(Price) AS PriceWithVat   -- used right inside SELECT
FROM dbo.Products;`, { title: 'Your first function' }),
      table(['', 'Stored procedure', 'Function'], [
        ['Think of it as', 'A **job**: "place this order", "restock this product"', 'A **calculation**: "price with VAT"'],
        ['How to run it', '`EXEC name …`', 'Inside a query: `SELECT name(…)`'],
        ['Can change data (INSERT/UPDATE/DELETE)?', '✔ Yes', '✘ No'],
        ['Gives back', 'Result tables (and optional output values)', 'Exactly one value (or one table)'],
        ['C# comparison', 'A `void` method that does work', 'A method that `return`s a value']
      ]),
      quiz('Which can you use inside a SELECT, like `SELECT x(Price) FROM Products`?', ['A stored procedure', 'A function', 'A trigger', 'All of them'], 1, 'Functions return values you can use in a query. Procedures are run on their own with EXEC.'),
      quiz('What does the `@` in `@CustomerId` tell you?', ['It is a column', 'It is a table', 'It is a variable or parameter', 'It is a comment'], 2, 'In T-SQL, variable and parameter names always start with @.'),
      p('Ready for more? Full lesson: [Stored procedures & functions](#procedures). Next: [6. Query optimization →](#b-optimization)')
    ]
  });

  // ===========================================================================
  // 6. QUERY OPTIMIZATION
  // ===========================================================================
  const dates = ['2025-11-28', '2025-11-30', '2025-12-01', '2025-12-02', '2025-12-15', '2025-12-31', '2026-01-01', '2026-01-04'];
  lessons.push({
    id: 'b-optimization', group: GROUP, title: '6. Query optimization',
    keywords: 'beginner optimization performance fast slow execution plan logical reads sargable',
    intro: '~10 min. Optimization means getting the **same answer with less work**. Five simple habits fix most slow queries.',
    blocks: [
      h2('How SQL Server runs your query'),
      p('You say **what** you want. SQL Server\'s **optimizer** decides **how** to get it, like Google Maps choosing a route. It looks at which indexes exist and how many rows it expects (its *statistics*), then makes an **execution plan**.'),
      diagram(`flowchart LR
  A["Your SQL<br/>(what you want)"] --> B["Optimizer<br/>(looks at indexes + statistics)"]
  B --> C["Execution plan<br/>(the chosen route:<br/>seek? scan? join type?)"]
  C --> D["Run it"] --> E["Results"]
  style B fill:#f2edfb,stroke:#7a4fd0
  style C fill:#fff3c4,stroke:#c9a227`),
      kw([
        ['Execution plan', 'The step-by-step route SQL Server chose. See it with the **Plan** toggle'],
        ['Logical reads', 'Number of 8 KB pages read (see it with **IO/Time**). This is the main measure of work: **lower is better**'],
        ['Seek (green)', 'Jumped straight to the rows using an index: good'],
        ['Scan (orange)', 'Read the whole table or index: OK for small tables, slow for big ones'],
        ['SARGable', 'A WHERE condition that *can* use an index seek (the column is left "bare")']
      ]),
      tip('**Always measure.** Run the slow version with **Plan** + **IO/Time**, change one thing, then run it again and compare the *logical reads*. Every example below has both toggles on.'),

      h2('Habit 1: only ask for the columns you need'),
      p('`SELECT *` means "give me every column". It reads more data and stops SQL Server from answering from a small index.'),
      code(`CREATE INDEX IX_Cust ON dbo.BigOrders (CustomerId) INCLUDE (OrderDate, Amount);
GO
SELECT *                          FROM dbo.BigOrders WHERE CustomerId = 4321;   -- ✘ every column
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 4321;   -- ✔ just what's needed`, { title: 'SELECT * vs named columns', plan: true, stats: true, note: 'Compare the two "logical reads" lines in **Messages**. The second query is answered entirely from the index.' }),

      h2('Habit 2: index the columns you search by'),
      p('If you often run `WHERE CustomerId = …` or `JOIN … ON CustomerId`, CustomerId deserves an index. See [3. Indexes](#b-indexes): thousands of reads became 3.'),

      h2('Habit 3: don\'t wrap the column in a function'),
      p('This is the most common beginner mistake. If you write `WHERE YEAR(OrderDate) = 2025`, SQL Server must **calculate YEAR() for every single row** before it can compare, so it can\'t jump through the sorted index. Compare the date **range** directly instead.'),
      anim('Why YEAR(OrderDate) = … forces a scan', [
        { html: S(T('Index on OrderDate (sorted)', ['OrderDate'], dates.map(d => [d]))), caption: 'Goal: find all **December 2025** orders. The index has the dates sorted.' },
        {
          html: S(C(`${k('WHERE')} ${h('MONTH(OrderDate) = 12')}\n  ${k('AND')} YEAR(OrderDate) = 2025`), T('Must calculate every row', ['OrderDate', 'MONTH()'], dates.map((d, i) => ({ c: [d, d.slice(5, 7)], cls: (d.startsWith('2025-12') ? 'ok' : 'bad') + ' fade', d: i * 0.12 + 's' }))), N('8 of 8 rows calculated', 'warn pop', 'SCAN', '1s')),
          caption: '✘ With a function, SQL Server has to run MONTH() and YEAR() on **every row** to see whether it matches: a **scan**.'
        },
        {
          html: S(C(`${k('WHERE')} ${h("OrderDate >= '2025-12-01'")}\n  ${k('AND')} ${h("OrderDate <  '2026-01-01'")}`), T('Jump to the range', ['OrderDate'], dates.map(d => ({ c: [d], cls: d.startsWith('2025-12') ? 'ok pop' : 'dim' }))), N('jumped to 2025-12-01, stopped at 2026', 'ok pop', 'SEEK', '.6s')),
          caption: '✔ With a plain range, SQL Server **jumps** to 2025-12-01 and reads until it reaches 2026: a **seek**. Same answer, far less work.'
        }
      ]),
      code(`CREATE INDEX IX_Date ON dbo.BigOrders (OrderDate);
GO
-- ✘ function on the column → scan
SELECT COUNT(*) AS Orders FROM dbo.BigOrders WHERE YEAR(OrderDate) = 2025 AND MONTH(OrderDate) = 12;
-- ✔ plain range → seek (same answer)
SELECT COUNT(*) AS Orders FROM dbo.BigOrders WHERE OrderDate >= '2025-12-01' AND OrderDate < '2026-01-01';`, { title: 'Function vs range', plan: true, stats: true }),
      table(['✘ Slow (can\'t seek)', '✔ Fast (can seek)'], [
        ['`WHERE YEAR(OrderDate) = 2025`', '`WHERE OrderDate >= \'2025-01-01\' AND OrderDate < \'2026-01-01\'`'],
        ['`WHERE Price * 1.18 > 59000`', '`WHERE Price > 59000 / 1.18`'],
        ['`WHERE Email LIKE \'%@mail.com\'` (starts with %)', '`WHERE Email LIKE \'nimal%\'` (ends with %)'],
        ['`WHERE ISNULL(City, \'\') = \'Kandy\'`', '`WHERE City = \'Kandy\'`']
      ], { caption: 'Rule: keep the column **alone** on one side of the comparison. A phone book can find names *starting* with "Per", but not names *ending* in "-era".' }),

      h2('Habit 4: one statement instead of a loop'),
      p('Changing rows **one at a time** in a loop is like carrying shopping from the car one item per trip. One `UPDATE` handles all the rows in a single trip.'),
      code(`CREATE TABLE lab.Prices (Id INT PRIMARY KEY, Price DECIMAL(18,2));
INSERT INTO lab.Prices SELECT TOP (5000) OrderId, Amount FROM dbo.BigOrders;
GO
SET STATISTICS TIME ON;
-- ✘ a loop: 5,000 separate UPDATEs
DECLARE @id INT = 1;
WHILE @id <= 5000
BEGIN
    UPDATE lab.Prices SET Price = Price * 1.05 WHERE Id = @id;
    SET @id = @id + 1;
END;
-- ✔ one UPDATE for all rows
UPDATE lab.Prices SET Price = Price * 1.05;
SET STATISTICS TIME OFF;`, { title: 'Loop vs one statement', note: '`WHILE` repeats the code between BEGIN and END while the condition is true. Compare the two "elapsed time" values in **Messages**.' }),

      h2('Habit 5: filter early and ask for less'),
      p('Use `WHERE` to get only the rows you need, and `TOP (n)` or paging when you only show a few rows on screen. Fewer rows means less to read, sort and send.'),
      code(`-- ✔ the latest 10 orders for one customer, not all 300,000 rows
SELECT TOP (10) OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 42
ORDER BY OrderDate DESC;`, { title: 'Only what the screen needs', plan: true, stats: true }),
      h2('Checklist for a slow query'),
      p(`1. Turn on **Plan** + **IO/Time** and note the logical reads.
2. Any **Scan** (orange) on a big table? Add an index on the WHERE/JOIN column.
3. Any **function** wrapped around a column in WHERE? Rewrite it as a range.
4. Using \`SELECT *\`? Name the columns instead.
5. A **loop**? Turn it into one statement.
6. Run it again and compare the numbers.`),
      quiz('Which WHERE clause can use an index on OrderDate?', ['WHERE YEAR(OrderDate) = 2026', 'WHERE OrderDate >= \'2026-01-01\' AND OrderDate < \'2027-01-01\'', 'WHERE CONVERT(DATE, OrderDate) = \'2026-01-01\'', 'None of them'], 1, 'The range leaves OrderDate bare, so SQL Server can seek. The others wrap the column in a function.'),
      quiz('What is the best single number to compare before and after an optimization?', ['The number of columns', 'Logical reads (pages read)', 'The length of the query', 'The number of JOINs'], 1, 'Logical reads show how much work SQL Server did. Elapsed time is useful too, but it varies more between runs.'),
      p('Ready for more? Full lesson: [Query optimization](#optimization). Then test yourself with the [graded exercises](#exercises).')
    ]
  });

  // ---------------------------------------------------------------------------
  // Insert the track right after "Start here", and link the advanced lessons back to it
  // ---------------------------------------------------------------------------
  const list = window.LESSONS;
  const at = list.findIndex(l => l.id === 'getting-started');
  list.splice(at >= 0 ? at + 1 : list.length, 0, ...lessons);

  const links = { 'cte-window': 'b-cte-window', transactions: 'b-transactions', indexes: 'b-indexes', triggers: 'b-triggers', procedures: 'b-procedures', optimization: 'b-optimization' };
  for (const [adv, beg] of Object.entries(links)) {
    const lesson = list.find(l => l.id === adv);
    const b = lessons.find(l => l.id === beg);
    if (lesson && b) lesson.blocks.unshift(tip(`**New to this topic?** Start with the beginner version, [${b.title.replace(/^\d+\.\s*/, '')} (beginner friendly)](#${beg}), with simple explanations and animations. Then come back here.`));
  }
  const welcome = list.find(l => l.id === 'welcome');
  if (welcome && welcome.blocks[0] && welcome.blocks[0].type === 'html') {
    welcome.blocks[0].html = welcome.blocks[0].html.replace('<div class="cards">',
      '<div class="cards"><a class="card" href="#b-basics" style="border-color:#7a4fd0;background:#f7f3ff"><b>🌱 Beginner friendly</b><span>New to SQL? A 1-hour track with animations: CTEs, transactions, indexes, triggers, procedures, optimization</span></a>');
  }
})();
