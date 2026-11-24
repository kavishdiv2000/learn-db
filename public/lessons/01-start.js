/* Block helpers shared by every lesson file */
window.LESSONS = [];
window.L = {
  h2: (text, id) => ({ type: 'h2', text, id }),
  h3: text => ({ type: 'h3', text }),
  p: text => ({ type: 'p', text }),
  html: html => ({ type: 'html', html }),
  code: (sql, o = {}) => ({ type: 'code', sql: sql.replace(/^\n/, '').replace(/\s+$/, ''), ...o }),
  table: (head, rows, o = {}) => ({ type: 'table', head, rows, ...o }),
  er: (diagram, caption) => ({ type: 'er', diagram, caption }),
  erPair: (left, leftCaption, right, rightCaption) => ({ type: 'erPair', left, leftCaption, right, rightCaption }),
  tip: text => ({ type: 'callout', kind: 'tip', text }),
  warn: text => ({ type: 'callout', kind: 'warn', text }),
  note: (text, label) => ({ type: 'callout', kind: '', text, label }),
  interview: text => ({ type: 'callout', kind: 'interview', text }),
  quiz: (q, options, answer, explain) => ({ type: 'quiz', q, options, answer, explain }),
  reveal: (label, blocks) => ({ type: 'reveal', label, blocks }),
  flash: cards => ({ type: 'flash', cards }),
  ex: o => ({ type: 'exercise', ...o, solution: o.solution.replace(/^\n/, '').replace(/\s+$/, '') })
};

(function () {
  const { h2, h3, p, html, code, table, er, tip, warn, note, interview, quiz } = window.L;

  window.LESSONS.push({
    id: 'welcome',
    group: 'Start here',
    title: 'Welcome to SQL Lab',
    intro: 'Learn SQL and Microsoft SQL Server by running real T-SQL against your own SQL Server, with lessons, diagrams, quizzes and graded exercises.',
    blocks: [
      html(`<div class="cards">
        <a class="card" href="#er-basics"><b>Design</b><span>ER diagrams, 1:1, 1:N, M:N, case studies and normalization</span></a>
        <a class="card" href="#ddl"><b>SQL language</b><span>DDL, DML, joins, CTEs, window functions, transactions</span></a>
        <a class="card" href="#indexes"><b>SQL Server internals</b><span>Indexes, triggers, stored procedures, execution plans</span></a>
        <a class="card" href="#optimization"><b>Optimization</b><span>SARGable queries, parameter sniffing, statistics, batching</span></a>
        <a class="card" href="#exercises"><b>Practice</b><span>Graded exercises that check your answer automatically</span></a>
        <a class="card" href="#interview"><b>Interview prep</b><span>Flashcards with model answers</span></a>
      </div>`),
      h2('How this app works'),
      p(`Every grey code box is a live **T-SQL editor**. Change the code and press **Run** (or **Ctrl+Enter**). The result appears underneath in three tabs, just like SQL Server Management Studio: **Results**, **Messages** and **Execution plan**.

- **Sandbox** (on by default) wraps your code in \`BEGIN TRAN … ROLLBACK\`. You can create tables, triggers and indexes, or delete rows, and the database goes back to how it was afterwards. This works because DDL is transactional in SQL Server.
- **Plan** turns on \`SET STATISTICS XML ON\` and shows the actual execution plan as a tree: seeks, scans, key lookups, cost % and row counts.
- **IO/Time** turns on \`SET STATISTICS IO, TIME ON\`. Logical reads and CPU time appear in the Messages tab. This is how you prove an optimization worked.
- Select part of the code to run only that part. \`GO\` splits batches, as in SSMS.`),
      p('Try it now. Run this, then run it again with **Plan** ticked:'),
      code(`SELECT TOP (5) CustomerId, FullName, City
FROM dbo.Customers
ORDER BY CreatedAt DESC;`, { title: 'Your first query' }),
      tip('If the status at the top says **ShopDB not set up yet**, click **Set up practice database**. It creates ShopDB with sample data, including a 300,000-row `BigOrders` table for index and performance demos. Click it again at any time to reset everything.'),
      h2('The practice database (ShopDB)'),
      p('Most lessons use this small e-commerce schema. The diagram uses crow\'s-foot notation, explained in the ER lessons.'),
      er(`erDiagram
  Customers ||--o{ Orders : places
  Orders ||--|{ OrderItems : contains
  Products ||--o{ OrderItems : "appears in"
  Departments ||--o{ Employees : employs
  Employees |o--o{ Employees : manages
  Customers {
    int CustomerId PK
    nvarchar FullName
    varchar Email UK
    nvarchar City
    datetime2 CreatedAt
  }
  Orders {
    int OrderId PK
    int CustomerId FK
    datetime2 OrderDate
    varchar Status
  }
  OrderItems {
    int OrderId PK,FK
    int ProductId PK,FK
    int Quantity
    decimal UnitPrice
  }
  Products {
    int ProductId PK
    nvarchar Name
    nvarchar Category
    decimal Price
    int StockQty
  }
  Departments {
    int DepartmentId PK
    nvarchar Name UK
  }
  Employees {
    int EmployeeId PK
    nvarchar FullName
    int DepartmentId FK
    int ManagerId FK
    decimal Salary
  }`, 'ShopDB core tables. Also included: **Accounts** (transactions), **BigOrders** (300k rows, performance), **ProductStaging** (MERGE) and the view **vw_OrderTotals**.'),
      table(['Table', 'Rows', 'Used for'], [
        ['`Customers`, `Products`, `Orders`, `OrderItems`', '10 / 10 / 15 / 25', 'Queries, joins, grouping, triggers, procedures'],
        ['`Departments`, `Employees`', '4 / 12', 'Self-joins, recursive CTEs, window functions'],
        ['`Accounts`', '3', 'Transactions and error handling'],
        ['`BigOrders`', '300,000', 'Indexes, execution plans, optimization (only a clustered PK, on purpose)'],
        ['`ProductStaging`', '3', 'MERGE / upsert'],
        ['Schemas `uni`, `hosp`, `lib`, `food`, `lab`', 'empty', 'Your ER-modelling and design exercises']
      ]),
      h2('Suggested path for interview prep'),
      p(`1. **Day 1:** Getting started → Relational basics → ER modelling → Relationship patterns
2. **Day 2:** ER case studies → Normalization
3. **Day 3:** DDL → DML → Querying & joins
4. **Day 4:** CTEs & window functions → Transactions
5. **Day 5:** Indexes (take your time and use the Plan toggle a lot)
6. **Day 6:** Triggers → Stored procedures → Optimization
7. **Day 7:** All graded exercises, then the interview flashcards out loud`)
    ]
  });

  window.LESSONS.push({
    id: 'getting-started',
    group: 'Start here',
    title: 'Getting started & troubleshooting',
    keywords: 'install setup connect error odbc tcp',
    intro: 'Connect SQL Lab to your local SQL Server and fix the common problems.',
    blocks: [
      h2('Checklist'),
      p(`1. Install **SQL Server 2025 Developer** (free). Choose the *Basic* install. It creates the default instance, \`MSSQLSERVER\`, which you reach as \`localhost\`.
2. Install **Node.js LTS (version 22 or newer)** from [nodejs.org](https://nodejs.org).
3. Double-click **start.bat** in the learn-db folder. The first time, it runs \`npm install\`, then opens http://localhost:5080.
4. The status dot at the top turns amber. Click **Set up practice database**, and it turns green.`),
      h2('Or: run everything in Docker'),
      p(`No local install needed, only **Docker Desktop**. Double-click **docker-start.bat**. It runs \`docker compose up -d --build\`, which starts **SQL Server 2025** (container \`sql2025\`, port 1433) and this app (container \`sqllab\`), then opens the browser.

- The \`sa\` password is \`Str0ng!Passw0rd\`, unless you set your own in a **.env** file before the first start (see .env.example).
- **SSMS → Docker:** Server \`localhost\`, **SQL Server Authentication**, Login \`sa\`, tick *Trust server certificate*. Windows Authentication can't be used with a Linux container.
- \`docker compose down\` stops everything (data is kept). \`docker compose down -v\` also deletes the databases.`),
      h2('Is it working?'),
      code(`SELECT @@VERSION AS Version,
       SERVERPROPERTY('Edition') AS Edition,
       DB_NAME() AS CurrentDatabase,
       SUSER_SNAME() AS LoggedInAs;`, { title: 'Server information' }),
      h2('Common problems'),
      table(['Symptom', 'Fix'], [
        ['"SQL Lab server is not running"', 'Keep the black start.bat window open. Closing it stops the app.'],
        ['"Not connected" with an ODBC / login error', 'Open the **Services** app and check that **SQL Server (MSSQLSERVER)** is *Running*. If you installed a named instance (e.g. SQLEXPRESS), set `"server": "localhost\\\\SQLEXPRESS"` in **config.json** and restart start.bat.'],
        ['"msnodesqlv8 is not installed" in the console', 'The Windows-authentication driver failed to install. Use Node 22 or newer and run `npm install` again, or use SQL authentication (see README, Option B).'],
        ['"Data source name not found"', 'No ODBC driver was found. Install **Microsoft ODBC Driver 18 for SQL Server** from Microsoft, then restart start.bat.'],
                ['You broke ShopDB', 'Click **Set up practice database**. It drops and rebuilds everything.']
      ]),
      note('SQL Lab only listens on 127.0.0.1, so nobody else on your network can reach it. Your login needs to be able to create a database. On a Developer install, the person who installed SQL Server is a sysadmin.', 'Security'),
      h2('Shortcuts'),
      table(['Key', 'Action'], [['Ctrl + Enter or F5', 'Run the editor (or only the selected text)'], ['Ctrl + Z', 'Undo inside an editor'], ['Reset button', 'Restore the original example code']])
    ]
  });
})();
