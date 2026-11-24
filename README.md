# SQL Lab: learn SQL & Microsoft SQL Server

A local web app for learning SQL and SQL Server. It has lessons, ER diagrams, quizzes,
graded exercises and interview flashcards. Every code box runs **real T-SQL** against
your own SQL Server and shows the results, the messages and the **execution plan**.

## What's inside

| Section | Topics |
|---|---|
| Database design | Keys, data types, ER modelling (entities, attributes, cardinality, crow's foot), **1:1, 1:N, M:N, self-referencing** patterns, 4 ER case studies (hospital, library, food delivery, course platform), **normalization 1NF → BCNF** |
| SQL language | DDL, DML, MERGE, joins, GROUP BY/HAVING, subqueries, NULL traps, CTEs, window functions, transactions & isolation |
| SQL Server internals | **Indexes** (clustered, nonclustered, covering, composite, filtered, unique, columnstore, maintenance), **triggers** (audit, stock, soft delete, DDL, the multi-row bug), **stored procedures & functions**, **optimization** (SARGability, parameter sniffing, statistics, batching, DMVs) |
| Practice | 19 auto-graded exercises, 60 interview flashcards, a free-form Playground |

Key features:
- **Sandbox mode** (on by default): your code runs inside `BEGIN TRAN … ROLLBACK`, so you
  can create tables, triggers and indexes or delete data without breaking anything.
- **Plan** toggle: the actual execution plan as a tree, with seeks, scans, key lookups,
  cost %, estimated vs actual rows, implicit-conversion warnings and missing-index suggestions.
- **IO/Time** toggle: `SET STATISTICS IO, TIME ON` output, so you can prove an optimization worked.
- A practice database **ShopDB**, including a 300,000-row `BigOrders` table for performance demos.
- Works offline: the editor (CodeMirror) and diagram library (Mermaid) are bundled in `public/vendor`.

## Requirements

1. **SQL Server** 2019 or newer. **SQL Server 2025 Developer** is free:
   https://www.microsoft.com/sql-server/sql-server-downloads. The *Basic* install is fine.
2. **Node.js 22 LTS or newer**: https://nodejs.org

## Run it

Double-click **`start.bat`**. On the first run it installs the packages (`npm install`),
then starts the server and opens **http://localhost:5080**.

Or from a terminal in this folder:

```
npm install
npm start
```

Then, in the app, click **Set up practice database** (top bar). Click it again at any time
to reset ShopDB to its original state.

Keep the start.bat window open while you use the app. Close it (or press Ctrl+C) to stop.

## Run everything in Docker (alternative)

No local SQL Server or Node.js needed, only **Docker Desktop** (Windows: WSL 2 backend).

1. *(Optional)* Copy `.env.example` to `.env` and choose your own `sa` password
   **before the first start**. The password is stored in the database volume.
2. Double-click **`docker-start.bat`**, or run:

   ```
   docker compose up -d --build
   ```

   This starts two containers:
   - **sql2025**: SQL Server 2025 Developer, on `localhost,1433`, with data kept in the `sqldata` volume
   - **sqllab**: this web app, on http://localhost:5080. It waits until SQL Server is healthy.
3. Open http://localhost:5080 and click **Set up practice database**.

| Task | Command |
|---|---|
| Stop (keep data) | `docker compose down` or `docker-stop.bat` |
| Start again | `docker compose up -d` |
| Logs | `docker compose logs -f` |
| Delete everything, including databases | `docker compose down -v` |
| Command-line SQL inside the container | `docker exec -it sql2025 /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "<password>" -C` |

**Connect SSMS (or VS Code mssql) to the Docker SQL Server:** Server `localhost`,
Authentication **SQL Server Authentication**, Login `sa`, your password, and tick
**Trust server certificate**. Windows Authentication does not work with a Linux container.

**SQL Server in Docker, app with start.bat:** run `docker compose up -d sqlserver`, then set
`"auth": "sql"`, `"user": "sa"` and `"password": "<your password>"` in **config.json** and run `start.bat`.

## Connecting to SQL Server

### Option A: Windows authentication (default)

Nothing to configure. The app uses the `msnodesqlv8` driver (ODBC) and connects to `localhost`
as your Windows user, exactly like SSMS does. It tries *ODBC Driver 18*, then *17*, then the
built-in *SQL Server* driver. SQL Server setup normally installs one of them already.

If the console says **"msnodesqlv8 is not installed"**, the native driver failed to install.
Check you are on Node 22+ and run `npm install` again. If it still fails, use Option B.

### Option B: SQL authentication (pure JavaScript driver)

1. In SSMS: right-click the server → **Properties → Security** → choose
   **SQL Server and Windows Authentication mode**.
2. Open **SQL Server Configuration Manager** → *SQL Server Network Configuration* →
   *Protocols for MSSQLSERVER* → enable **TCP/IP**.
3. Restart the **SQL Server (MSSQLSERVER)** service.
4. In SSMS, create a login for the app:

   ```sql
   CREATE LOGIN sqllab WITH PASSWORD = 'Use-A-Strong-P4ssword!';
   ALTER SERVER ROLE dbcreator ADD MEMBER sqllab;   -- lets it create ShopDB
   GRANT VIEW SERVER STATE TO sqllab;               -- for the DMV lessons
   ```

   If ShopDB already exists (created by another login), also run:

   ```sql
   USE ShopDB; CREATE USER sqllab FOR LOGIN sqllab; ALTER ROLE db_owner ADD MEMBER sqllab;
   ```

5. Edit **config.json**:

   ```json
   { "auth": "sql", "user": "sqllab", "password": "Use-A-Strong-P4ssword!" }
   ```

   Keep the other keys as they are.

### Named instance (e.g. SQLEXPRESS)

Set `"server": "localhost\\SQLEXPRESS"` in **config.json**. With Option B, make sure the
**SQL Server Browser** service is running, or set a fixed port.

## config.json

| Key | Default | Meaning |
|---|---|---|
| `port` | `5080` | Web app port |
| `host` | `127.0.0.1` | Address the web app listens on (Docker uses `0.0.0.0`) |
| `server` | `localhost` | SQL Server instance |
| `database` | `ShopDB` | Practice database name |
| `auth` | `windows` | `windows` or `sql` |
| `user` / `password` | | SQL login for `auth: "sql"` |
| `sqlPort` | `1433` | TCP port for `auth: "sql"` |
| `maxRows` | `1000` | Max rows returned per result set |
| `timeoutSec` | `120` | Query timeout |
| `odbcDriver` | *(auto)* | Force an ODBC driver name, e.g. `ODBC Driver 17 for SQL Server` |

## Project layout

```
learn-db/
├─ start.bat          one-click start (Windows, local SQL Server)
├─ docker-start.bat   one-click start in Docker (SQL Server 2025 + app)
├─ docker-stop.bat    stop the containers (data kept)
├─ docker-compose.yml SQL Server 2025 + SQL Lab containers
├─ Dockerfile         image for the web app
├─ .env.example       sa password for Docker (copy to .env)
├─ server.js          Express server: serves the app, runs T-SQL (GO batches, sandbox, plans)
├─ setup.sql          creates/resets ShopDB
├─ config.json        connection settings
└─ public/
   ├─ index.html, styles.css
   ├─ app.js          editor, results grid, plan viewer, quizzes, exercise grader
   ├─ lessons/        lesson content (plain JS objects – easy to edit or extend)
   └─ vendor/         CodeMirror 5 + Mermaid (bundled, MIT licence)
```

### Adding your own lesson

Create `public/lessons/06-mine.js`, add a `<script>` tag for it in `index.html` before `app.js`, and push a lesson:

```js
(function () {
  const { h2, p, code, er, quiz, ex } = window.L;
  window.LESSONS.push({
    id: 'my-lesson', group: 'My notes', title: 'My lesson',
    blocks: [
      h2('Heading'),
      p('Text with **bold** and `code`.'),
      code('SELECT * FROM dbo.Customers;', { title: 'Runnable', plan: true }),
      quiz('Question?', ['A', 'B'], 1, 'Why B is right.')
    ]
  });
})();
```

## Safety

- The server binds to `127.0.0.1` only, so other machines can't reach it. In Docker, the port is also published on 127.0.0.1 only.
- Settings can also come from environment variables: `PORT`, `HOST`, `SQL_SERVER`, `SQL_PORT`, `SQL_DATABASE`, `SQL_AUTH`, `SQL_USER`, `SQL_PASSWORD`.
- It runs whatever SQL you type, with your login's permissions. Use it on a development
  SQL Server, not a production one.
