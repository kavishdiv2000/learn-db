(function () {
  const { h2, h3, p, code, table, er, tip, warn, note, interview, quiz, reveal } = window.L;

  // ===========================================================================
  window.LESSONS.push({
    id: 'ddl',
    group: 'SQL language',
    title: 'DDL: CREATE, ALTER, DROP, TRUNCATE',
    keywords: 'constraint check default identity computed column view truncate delete drop',
    intro: 'DDL defines structure. In SQL Server most DDL is transactional, so every example here rolls back safely.',
    blocks: [
      h2('CREATE TABLE with every common constraint'),
      code(`CREATE TABLE lab.Invoice (
    InvoiceId     INT IDENTITY(1000, 1)  CONSTRAINT PK_Invoice PRIMARY KEY,   -- starts at 1000, +1
    InvoiceNo     AS ('INV-' + CAST(InvoiceId AS VARCHAR(10))) PERSISTED,      -- computed column
    CustomerId    INT          NOT NULL CONSTRAINT FK_Invoice_Customer REFERENCES dbo.Customers(CustomerId),
    Amount        DECIMAL(18,2) NOT NULL CONSTRAINT CK_Invoice_Amount CHECK (Amount > 0),
    Currency      CHAR(3)      NOT NULL CONSTRAINT DF_Invoice_Currency DEFAULT 'LKR',
    IssuedOn      DATE         NOT NULL CONSTRAINT DF_Invoice_IssuedOn DEFAULT CAST(GETDATE() AS DATE),
    DueOn         DATE         NOT NULL,
    Reference     VARCHAR(30)  NULL     CONSTRAINT UQ_Invoice_Reference UNIQUE,
    CONSTRAINT CK_Invoice_Dates CHECK (DueOn >= IssuedOn)                      -- table-level CHECK
);

INSERT INTO lab.Invoice (CustomerId, Amount, DueOn) VALUES (1, 15000, DATEADD(DAY, 30, GETDATE()));
SELECT * FROM lab.Invoice;`, { title: 'Constraints: PK, FK, CHECK, DEFAULT, UNIQUE, IDENTITY, computed' }),
      tip('**Always name your constraints** (`CONSTRAINT CK_Invoice_Amount …`). Unnamed ones get random names like `CK__Invoice__Amoun__3B75D760`, which are painful to drop in a deployment script.'),
      h2('ALTER TABLE'),
      code(`ALTER TABLE dbo.Customers ADD Phone VARCHAR(15) NULL;                         -- add a column
ALTER TABLE dbo.Customers ALTER COLUMN Phone VARCHAR(20) NULL;                -- change type/size
ALTER TABLE dbo.Customers ADD CONSTRAINT CK_Customers_Phone CHECK (Phone LIKE '0%');
EXEC sp_rename 'dbo.Customers.Phone', 'MobileNo', 'COLUMN';                    -- rename

-- Adding a NOT NULL column to a table with rows needs a DEFAULT
ALTER TABLE dbo.Customers ADD IsVip BIT NOT NULL CONSTRAINT DF_Customers_IsVip DEFAULT 0;
GO   -- a new column can only be used by a LATER batch (columns are resolved at compile time)
SELECT TOP (3) CustomerId, FullName, MobileNo, IsVip FROM dbo.Customers;

ALTER TABLE dbo.Customers DROP CONSTRAINT CK_Customers_Phone;
ALTER TABLE dbo.Customers DROP COLUMN MobileNo;`, { title: 'Change a table (rolled back afterwards)' }),
      h2('DELETE vs TRUNCATE vs DROP'),
      table(['', 'DELETE', 'TRUNCATE', 'DROP'], [
        ['Category', 'DML', 'DDL', 'DDL'],
        ['WHERE clause', 'Yes', 'No', 'No'],
        ['Removes', 'Chosen rows', 'All rows', 'The table itself (data, indexes, triggers, permissions)'],
        ['Logging', 'Every row', 'Only page deallocations (minimal)', 'Metadata'],
        ['Speed on millions of rows', 'Slow', 'Instant', 'Instant'],
        ['Fires DELETE triggers', 'Yes', 'No', 'No'],
        ['Resets IDENTITY', 'No', 'Yes', 'n/a'],
        ['Works when another table has an FK to it', 'Yes', 'No', 'No'],
        ['Can be rolled back in a transaction', 'Yes', '**Yes** (in SQL Server)', 'Yes']
      ]),
      code(`CREATE TABLE lab.Demo (Id INT IDENTITY PRIMARY KEY, Val VARCHAR(10));
INSERT INTO lab.Demo (Val) VALUES ('a'), ('b'), ('c');

DELETE FROM lab.Demo;                     -- removes rows, identity keeps counting
INSERT INTO lab.Demo (Val) VALUES ('d');
SELECT 'after DELETE' AS Step, * FROM lab.Demo;   -- Id = 4

TRUNCATE TABLE lab.Demo;                  -- identity resets to the seed
INSERT INTO lab.Demo (Val) VALUES ('e');
SELECT 'after TRUNCATE' AS Step, * FROM lab.Demo; -- Id = 1
GO
TRUNCATE TABLE dbo.Customers;             -- fails: Orders has a FOREIGN KEY to it`, { title: 'See the difference', note: 'The last statement fails on purpose (Msg 4712).' }),
      quiz('You need to empty a 50-million-row staging table every night before a load. Nothing references it. Best choice?', ['DELETE FROM Staging', 'TRUNCATE TABLE Staging', 'DROP TABLE Staging then CREATE it again', 'UPDATE every row to NULL'], 1, 'TRUNCATE deallocates pages with minimal logging and resets identity. DROP + CREATE also works, but it loses permissions and indexes and makes deployments harder.'),
      h2('Views'),
      p('A **view** is a saved SELECT. It stores no data (unless it is an *indexed view*). Use views to hide complex joins, to give a stable shape to applications, and for security (grant SELECT on the view, not on the tables).'),
      code(`CREATE OR ALTER VIEW lab.vw_CustomerSpend AS
SELECT c.CustomerId, c.FullName, c.City,
       COUNT(DISTINCT o.OrderId)            AS Orders,
       ISNULL(SUM(oi.Quantity * oi.UnitPrice), 0) AS TotalSpend
FROM dbo.Customers c
LEFT JOIN dbo.Orders o      ON o.CustomerId = c.CustomerId AND o.Status <> 'Cancelled'
LEFT JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
GROUP BY c.CustomerId, c.FullName, c.City;
GO
SELECT * FROM lab.vw_CustomerSpend ORDER BY TotalSpend DESC;`, { title: 'Create and query a view' }),
      h2('Temporary tables and table variables'),
      table(['', '#Temp table', '@Table variable', 'CTE'], [
        ['Lives in', 'tempdb', 'tempdb (memory first)', 'Nowhere: inlined into the query'],
        ['Scope', 'Session / procedure', 'Batch / procedure', 'One statement'],
        ['Statistics', 'Yes, so good row estimates', 'Limited (better since 2019)', 'Uses the base tables'],
        ['Indexes', 'Any', 'PK / UNIQUE / inline indexes', 'n/a'],
        ['Affected by ROLLBACK', 'Yes', '**No**, data survives a rollback', 'n/a'],
        ['Best for', 'Large intermediate results', 'Small sets, a few hundred rows', 'Readability, recursion']
      ]),
      code(`DECLARE @t TABLE (Msg VARCHAR(30));
CREATE TABLE #t (Msg VARCHAR(30));

BEGIN TRAN;
    INSERT INTO @t VALUES ('table variable row');
    INSERT INTO #t VALUES ('temp table row');
ROLLBACK;

SELECT 'table variable' AS Kind, COUNT(*) AS RowsLeft FROM @t     -- 1: survives rollback!
UNION ALL
SELECT 'temp table', COUNT(*) FROM #t;                           -- 0
DROP TABLE #t;`, { title: 'Table variables ignore ROLLBACK', sandbox: false, note: 'Sandbox is off here because the example manages its own transaction. Nothing is kept: #t is dropped at the end.' }),
      interview('**"Is DDL transactional?"** In SQL Server, yes. CREATE, ALTER, DROP and even TRUNCATE can be rolled back inside an explicit transaction. In Oracle and MySQL, DDL commits automatically. This app\'s sandbox only works because of this.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'dml',
    group: 'SQL language',
    title: 'DML: INSERT, UPDATE, DELETE, MERGE',
    keywords: 'insert update delete merge output upsert scope_identity',
    intro: 'Changing data safely: OUTPUT, joins in UPDATE/DELETE, and upserts with MERGE.',
    blocks: [
      h2('INSERT'),
      code(`-- Single and multi-row insert, returning the new IDs with OUTPUT
INSERT INTO dbo.Products (Name, Category, Price, StockQty)
OUTPUT inserted.ProductId, inserted.Name
VALUES (N'Webcam', N'Electronics', 12000, 25),
       (N'Desk Lamp', N'Furniture', 5500, 40);

-- INSERT … SELECT: copy rows from a query
INSERT INTO dbo.Products (Name, Category, Price, StockQty)
SELECT Name + N' (refurb)', Category, Price * 0.7, 2
FROM dbo.Products WHERE Category = N'Electronics' AND Price > 50000;

SELECT * FROM dbo.Products ORDER BY ProductId DESC;`, { title: 'INSERT with OUTPUT and INSERT…SELECT' }),
      note('`SCOPE_IDENTITY()` returns the last identity created **in your scope**. `@@IDENTITY` can return an ID created by a **trigger** on another table, which is a classic bug. `IDENT_CURRENT(\'table\')` returns the last value from **any session**. For multi-row inserts use **OUTPUT**.', 'Getting new IDs'),
      h2('UPDATE'),
      code(`-- Simple update
UPDATE dbo.Products SET Price = Price * 1.10 WHERE Category = N'Furniture';

-- UPDATE with a JOIN: mark Paid orders as Shipped for Colombo customers
UPDATE o
SET    o.Status = 'Shipped'
OUTPUT deleted.OrderId, deleted.Status AS OldStatus, inserted.Status AS NewStatus
FROM dbo.Orders o
JOIN dbo.Customers c ON c.CustomerId = o.CustomerId
WHERE c.City = N'Colombo' AND o.Status = 'Paid';`, { title: 'UPDATE, UPDATE…FROM…JOIN, and OUTPUT deleted/inserted' }),
      warn('An UPDATE or DELETE without WHERE changes **every row**. A habit from industry: write the `SELECT` first, check the rows, then turn it into the UPDATE. Wrap risky changes in `BEGIN TRAN` and check `@@ROWCOUNT` before you COMMIT.'),
      h2('DELETE'),
      code(`-- Delete with a join: cancelled orders' items, then the orders
DELETE oi
FROM dbo.OrderItems oi
JOIN dbo.Orders o ON o.OrderId = oi.OrderId
WHERE o.Status = 'Cancelled';

DELETE FROM dbo.Orders
OUTPUT deleted.*
WHERE Status = 'Cancelled';`, { title: 'DELETE with JOIN' }),
      h2('MERGE (upsert)'),
      p('MERGE syncs a **source** into a **target** in one statement: update the matches, insert the new rows and, optionally, delete the missing ones. A typical job loads a supplier\'s price list into a staging table, then MERGEs it into Products.'),
      code(`SELECT * FROM dbo.ProductStaging;   -- Mouse (new price), Webcam and Desk Lamp (new)

MERGE dbo.Products AS tgt
USING dbo.ProductStaging AS src
   ON tgt.Name = src.Name
WHEN MATCHED AND (tgt.Price <> src.Price OR tgt.StockQty <> src.StockQty) THEN
    UPDATE SET tgt.Price = src.Price, tgt.StockQty = src.StockQty
WHEN NOT MATCHED BY TARGET THEN
    INSERT (Name, Category, Price, StockQty) VALUES (src.Name, src.Category, src.Price, src.StockQty)
OUTPUT $action AS Action, inserted.Name, deleted.Price AS OldPrice, inserted.Price AS NewPrice;`, { title: 'MERGE staging into Products' }),
      note('MERGE has a history of edge-case bugs and needs `WITH (HOLDLOCK)` to be safe under concurrency. Many teams prefer a separate `UPDATE … ; INSERT … WHERE NOT EXISTS` inside one transaction. It is worth mentioning in an interview.', 'Industry caution'),
      quiz('After `UPDATE dbo.Products SET Price = 0 WHERE ProductId = 999` (no such product), what is `@@ROWCOUNT`?', ['1', '0', 'NULL', 'An error is raised'], 1, 'No error. The update simply touched zero rows. Check @@ROWCOUNT when you expect exactly one row, e.g. an optimistic-concurrency update.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'querying',
    group: 'SQL language',
    title: 'Querying: joins, grouping, subqueries',
    keywords: 'select join inner left right full cross group by having subquery exists in union case null',
    intro: 'The SELECT skills interviewers test most: logical order, every join type, GROUP BY/HAVING, EXISTS and NULL traps.',
    blocks: [
      h2('Logical processing order'),
      p('You *write* SELECT first, but SQL Server *evaluates* it in this order. It explains why a column alias works in ORDER BY but not in WHERE.'),
      table(['Step', 'Clause', 'What happens'], [
        ['1', '`FROM` / `JOIN`', 'Build the row set'], ['2', '`WHERE`', 'Filter rows'], ['3', '`GROUP BY`', 'Make groups'],
        ['4', '`HAVING`', 'Filter groups'], ['5', '`SELECT`', 'Compute columns and aliases'], ['6', '`DISTINCT`', 'Remove duplicates'],
        ['7', '`ORDER BY`', 'Sort (can use aliases)'], ['8', '`TOP` / `OFFSET…FETCH`', 'Limit']
      ]),
      code(`-- Works: alias used in ORDER BY (step 7 comes after SELECT at step 5)
SELECT Name, Price * 1.18 AS PriceWithVat FROM dbo.Products ORDER BY PriceWithVat DESC;
GO
-- Fails: WHERE (step 2) runs before the alias exists
SELECT Name, Price * 1.18 AS PriceWithVat FROM dbo.Products WHERE PriceWithVat > 50000;`, { title: 'Why aliases fail in WHERE' }),
      h2('Joins'),
      table(['Join', 'Returns'], [
        ['`INNER JOIN`', 'Only rows that match on both sides'],
        ['`LEFT [OUTER] JOIN`', 'Every row on the left, with NULLs where the right has no match'],
        ['`RIGHT [OUTER] JOIN`', 'Every row on the right (usually rewritten as a LEFT JOIN)'],
        ['`FULL [OUTER] JOIN`', 'Every row from both sides'],
        ['`CROSS JOIN`', 'Every combination: rows(A) × rows(B)'],
        ['Self join', 'A table joined to itself, using aliases'],
        ['`CROSS APPLY` / `OUTER APPLY`', 'Runs a correlated subquery or table function per row (e.g. "top 2 orders per customer")']
      ]),
      code(`-- INNER: only customers that have orders
SELECT c.FullName, o.OrderId, o.Status
FROM dbo.Customers c
INNER JOIN dbo.Orders o ON o.CustomerId = c.CustomerId;

-- LEFT: every customer, NULL OrderId when they never ordered
SELECT c.FullName, o.OrderId
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON o.CustomerId = c.CustomerId
ORDER BY o.OrderId;`, { title: 'INNER vs LEFT' }),
      code(`-- Customers who never ordered: LEFT JOIN + IS NULL ...
SELECT c.CustomerId, c.FullName
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON o.CustomerId = c.CustomerId
WHERE o.OrderId IS NULL;

-- ... or NOT EXISTS (preferred: clear intent, NULL-safe)
SELECT c.CustomerId, c.FullName
FROM dbo.Customers c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.CustomerId = c.CustomerId);`, { title: 'Anti-join: rows with no match' }),
      warn('Putting a right-table filter in **WHERE** turns a LEFT JOIN into an INNER JOIN. `LEFT JOIN Orders o ON … WHERE o.Status = \'Paid\'` drops customers without orders. Put the filter in the **ON** clause instead: `ON o.CustomerId = c.CustomerId AND o.Status = \'Paid\'`.'),
      code(`-- Top 2 most recent orders per customer with CROSS APPLY
SELECT c.FullName, x.OrderId, x.OrderDate
FROM dbo.Customers c
CROSS APPLY (SELECT TOP (2) o.OrderId, o.OrderDate
             FROM dbo.Orders o
             WHERE o.CustomerId = c.CustomerId
             ORDER BY o.OrderDate DESC) x
ORDER BY c.FullName, x.OrderDate DESC;`, { title: 'CROSS APPLY' }),
      h2('GROUP BY and HAVING'),
      code(`SELECT c.City,
       COUNT(DISTINCT o.OrderId)          AS Orders,
       SUM(oi.Quantity * oi.UnitPrice)    AS Revenue,
       AVG(oi.Quantity * oi.UnitPrice)    AS AvgLineValue
FROM dbo.Customers c
JOIN dbo.Orders o      ON o.CustomerId = c.CustomerId
JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
WHERE o.Status <> 'Cancelled'          -- filters ROWS (before grouping)
GROUP BY c.City
HAVING SUM(oi.Quantity * oi.UnitPrice) > 100000   -- filters GROUPS (after grouping)
ORDER BY Revenue DESC;`, { title: 'WHERE vs HAVING' }),
      code(`SELECT Category,
       COUNT(*)                                   AS Products,
       SUM(CASE WHEN StockQty = 0 THEN 1 ELSE 0 END) AS OutOfStock,   -- conditional aggregation
       MIN(Price) AS Cheapest, MAX(Price) AS Dearest
FROM dbo.Products
GROUP BY Category;

-- ROLLUP adds subtotal and grand-total rows
SELECT ISNULL(Category, N'** ALL **') AS Category, COUNT(*) AS Products, SUM(Price * StockQty) AS StockValue
FROM dbo.Products
GROUP BY ROLLUP (Category);`, { title: 'Conditional aggregation and ROLLUP' }),
      h2('Subqueries'),
      code(`-- Scalar subquery: products priced above the average
SELECT Name, Price FROM dbo.Products
WHERE Price > (SELECT AVG(Price) FROM dbo.Products);

-- Correlated subquery: most expensive product in each category
SELECT p.Category, p.Name, p.Price
FROM dbo.Products p
WHERE p.Price = (SELECT MAX(p2.Price) FROM dbo.Products p2 WHERE p2.Category = p.Category);

-- IN with a subquery: customers who bought a Laptop
SELECT FullName FROM dbo.Customers
WHERE CustomerId IN (SELECT o.CustomerId FROM dbo.Orders o
                     JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
                     JOIN dbo.Products p ON p.ProductId = oi.ProductId
                     WHERE p.Name = N'Laptop');`, { title: 'Scalar, correlated and IN subqueries' }),
      h2('NULL: the source of many trick questions'),
      code(`SELECT
  CASE WHEN NULL = NULL  THEN 'true' ELSE 'not true' END AS [NULL = NULL],     -- not true!
  CASE WHEN NULL IS NULL THEN 'true' ELSE 'not true' END AS [NULL IS NULL],
  COUNT(*)    AS CountStar,         -- counts rows
  COUNT(City) AS CountCity          -- ignores NULLs
FROM dbo.Customers;

-- NOT IN with a NULL in the list returns NOTHING
SELECT FullName FROM dbo.Customers WHERE City NOT IN (N'Colombo', NULL);

-- ISNULL / COALESCE replace NULLs
SELECT FullName, ISNULL(City, N'(unknown)') AS City, COALESCE(City, N'n/a') AS City2 FROM dbo.Customers;`, { title: 'NULL behaviour' }),
      quiz('`SELECT * FROM T WHERE Col NOT IN (SELECT X FROM S)` returns no rows, even though some values clearly don\'t match. Why?', ['NOT IN is not supported in SQL Server', 'S.X contains a NULL. `Col <> NULL` is UNKNOWN, so the whole NOT IN is never TRUE', 'The subquery needs DISTINCT', 'An index is missing'], 1, 'Use NOT EXISTS, or filter `WHERE X IS NOT NULL` in the subquery.'),
      h2('Set operators'),
      code(`SELECT City FROM dbo.Customers WHERE City IS NOT NULL
UNION        -- removes duplicates (extra sort/hash work)
SELECT ShipCity FROM (VALUES (N'Matara'), (N'Colombo')) v(ShipCity);

SELECT City FROM dbo.Customers WHERE City IS NOT NULL
UNION ALL    -- keeps duplicates, faster
SELECT N'Colombo';

SELECT CustomerId FROM dbo.Customers
EXCEPT       -- in the first set but not the second
SELECT CustomerId FROM dbo.Orders;

SELECT CustomerId FROM dbo.Customers
INTERSECT    -- in both
SELECT CustomerId FROM dbo.Orders WHERE Status = 'Pending';`, { title: 'UNION, UNION ALL, EXCEPT, INTERSECT' }),
      h2('Paging'),
      code(`DECLARE @Page INT = 2, @PageSize INT = 5;
SELECT OrderId, CustomerId, OrderDate
FROM dbo.Orders
ORDER BY OrderDate DESC, OrderId DESC        -- paging needs a deterministic order
OFFSET (@Page - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;`, { title: 'OFFSET / FETCH (what EF Core\'s Skip/Take generates)' })
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'cte-window',
    group: 'SQL language',
    title: 'CTEs & window functions',
    keywords: 'cte with row_number rank dense_rank lag lead running total partition over ntile top n per group duplicates',
    intro: 'The "hard" interview queries: top-N per group, second highest, running totals, de-duplication and gaps.',
    blocks: [
      h2('Common Table Expressions (CTEs)'),
      p('A CTE (`WITH name AS (…)`) is a named, temporary result set for **one statement**. It makes long queries readable and supports **recursion**. It is not stored or cached: SQL Server inlines it, like a view.'),
      code(`WITH OrderTotals AS (
    SELECT o.OrderId, o.CustomerId, SUM(oi.Quantity * oi.UnitPrice) AS Total
    FROM dbo.Orders o JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
    WHERE o.Status <> 'Cancelled'
    GROUP BY o.OrderId, o.CustomerId
),
CustomerTotals AS (
    SELECT CustomerId, COUNT(*) AS Orders, SUM(Total) AS Spend FROM OrderTotals GROUP BY CustomerId
)
SELECT c.FullName, ct.Orders, ct.Spend
FROM CustomerTotals ct JOIN dbo.Customers c ON c.CustomerId = ct.CustomerId
ORDER BY ct.Spend DESC;`, { title: 'Chained CTEs' }),
      h2('Window functions: OVER (PARTITION BY … ORDER BY …)'),
      p('A window function calculates across a set of related rows **without collapsing them** the way GROUP BY does. `PARTITION BY` splits rows into groups, `ORDER BY` sets the order within each group, and the frame (`ROWS BETWEEN …`) limits which rows are included.'),
      code(`SELECT Name, Category, Price,
       ROW_NUMBER() OVER (PARTITION BY Category ORDER BY Price DESC) AS RowNum,
       RANK()       OVER (PARTITION BY Category ORDER BY Price DESC) AS Rnk,
       DENSE_RANK() OVER (PARTITION BY Category ORDER BY Price DESC) AS DenseRnk,
       COUNT(*)     OVER (PARTITION BY Category)                     AS InCategory,
       AVG(Price)   OVER (PARTITION BY Category)                     AS CategoryAvg,
       Price - AVG(Price) OVER (PARTITION BY Category)               AS DiffFromAvg
FROM dbo.Products
ORDER BY Category, Price DESC;`, { title: 'Ranking and aggregate windows' }),
      table(['Values', 'ROW_NUMBER', 'RANK', 'DENSE_RANK'], [['500', '1', '1', '1'], ['400', '2', '2', '2'], ['400', '3', '2', '2'], ['300', '4', '4', '3']], { caption: 'Ties: ROW_NUMBER always gives unique numbers, RANK leaves a gap, DENSE_RANK has no gap.' }),
      h3('Top N per group'),
      code(`WITH ranked AS (
    SELECT e.FullName, d.Name AS Department, e.Salary,
           DENSE_RANK() OVER (PARTITION BY e.DepartmentId ORDER BY e.Salary DESC) AS r
    FROM dbo.Employees e JOIN dbo.Departments d ON d.DepartmentId = e.DepartmentId
)
SELECT Department, FullName, Salary FROM ranked WHERE r <= 2 ORDER BY Department, Salary DESC;`, { title: 'Top 2 salaries in each department' }),
      h3('Nth highest value'),
      code(`-- 2nd highest salary (ties handled by DENSE_RANK)
SELECT DISTINCT Salary FROM (
    SELECT Salary, DENSE_RANK() OVER (ORDER BY Salary DESC) AS r FROM dbo.Employees
) x WHERE r = 2;

-- Classic alternative without window functions
SELECT MAX(Salary) AS SecondHighest FROM dbo.Employees
WHERE Salary < (SELECT MAX(Salary) FROM dbo.Employees);

-- OFFSET version
SELECT DISTINCT Salary FROM dbo.Employees ORDER BY Salary DESC OFFSET 1 ROW FETCH NEXT 1 ROW ONLY;`, { title: 'Second highest salary: three ways' }),
      h3('Running totals, LAG and LEAD'),
      code(`WITH monthly AS (
    SELECT DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1) AS Month,
           SUM(oi.Quantity * oi.UnitPrice) AS Revenue
    FROM dbo.Orders o JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
    WHERE o.Status <> 'Cancelled'
    GROUP BY DATEFROMPARTS(YEAR(o.OrderDate), MONTH(o.OrderDate), 1)
)
SELECT Month, Revenue,
       SUM(Revenue) OVER (ORDER BY Month ROWS UNBOUNDED PRECEDING) AS RunningTotal,
       LAG(Revenue)  OVER (ORDER BY Month) AS PrevMonth,
       Revenue - LAG(Revenue) OVER (ORDER BY Month) AS Change,
       AVG(Revenue) OVER (ORDER BY Month ROWS BETWEEN 2 PRECEDING AND CURRENT ROW) AS Moving3MonthAvg
FROM monthly
ORDER BY Month;`, { title: 'Month-over-month report' }),
      h3('Find and delete duplicates'),
      code(`-- Create some duplicate emails first
INSERT INTO dbo.Customers (FullName, Email, City)
SELECT FullName + N' (dup)', Email + '.dup', City FROM dbo.Customers WHERE CustomerId <= 3;
UPDATE dbo.Customers SET Email = REPLACE(Email, '.dup', '') WHERE Email LIKE '%.dup';
GO
-- Hmm, the UNIQUE constraint stopped us. Real dirty data often has no constraint, so use a copy:
SELECT FullName, Email INTO #c FROM dbo.Customers;
INSERT INTO #c SELECT FullName + N' (dup)', Email FROM dbo.Customers WHERE CustomerId <= 3;

WITH d AS (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY Email ORDER BY FullName) AS rn FROM #c
)
DELETE FROM d WHERE rn > 1;          -- deleting through a CTE deletes from #c

SELECT Email, COUNT(*) AS Copies FROM #c GROUP BY Email HAVING COUNT(*) > 1;   -- none left
DROP TABLE #c;`, { title: 'De-duplicate with ROW_NUMBER', note: 'The first UPDATE fails on the UNIQUE constraint on purpose: constraints stop dirty data getting in at all.' }),
      h3('Gaps and islands (bonus)'),
      code(`-- Find consecutive runs of order dates for customer 42 in BigOrders (first 2 weeks of 2026)
WITH d AS (
    SELECT DISTINCT CAST(OrderDate AS DATE) AS Dt FROM dbo.BigOrders
    WHERE CustomerId = 42 AND OrderDate >= '2026-01-01' AND OrderDate < '2026-01-15'
), g AS (
    SELECT Dt, DATEADD(DAY, -CAST(ROW_NUMBER() OVER (ORDER BY Dt) AS INT), Dt) AS Grp FROM d
)
SELECT MIN(Dt) AS StreakStart, MAX(Dt) AS StreakEnd, COUNT(*) AS Days
FROM g GROUP BY Grp ORDER BY StreakStart;`, { title: 'Islands of consecutive days' }),
      interview('If asked to "find the 3 latest orders per customer", say: *"I\'d use ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate DESC) in a CTE and filter rn <= 3, or CROSS APPLY with TOP 3. Both benefit from an index on (CustomerId, OrderDate DESC)."* Mentioning the index shows you think about performance as well as correctness.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'transactions',
    group: 'SQL language',
    title: 'Transactions, locking & isolation',
    keywords: 'acid begin commit rollback savepoint xact_abort try catch isolation level nolock deadlock blocking snapshot',
    intro: 'ACID, TRY/CATCH patterns, isolation levels, blocking and deadlocks.',
    blocks: [
      h2('ACID'),
      table(['Property', 'Meaning', 'How SQL Server delivers it'], [
        ['**Atomicity**', 'All statements succeed, or none do', 'Transaction log + rollback'],
        ['**Consistency**', 'Constraints always hold before and after', 'PK, FK, CHECK, triggers'],
        ['**Isolation**', 'Concurrent transactions don\'t see each other\'s half-finished work', 'Locks or row versions (isolation levels)'],
        ['**Durability**', 'Once committed, the data survives a crash', 'Write-ahead logging to the .ldf file']
      ]),
      h2('The standard pattern'),
      code(`SET XACT_ABORT ON;    -- any runtime error dooms and rolls back the transaction
BEGIN TRY
    BEGIN TRAN;
        UPDATE dbo.Accounts SET Balance = Balance - 30000 WHERE AccountId = 2;  -- Kumari has 20,000 → CHECK fails
        UPDATE dbo.Accounts SET Balance = Balance + 30000 WHERE AccountId = 3;
    COMMIT;
    PRINT 'Transfer committed';
END TRY
BEGIN CATCH
    IF @@TRANCOUNT > 0 ROLLBACK;
    PRINT 'Transfer failed: ' + ERROR_MESSAGE();
    -- in a real procedure: log it, then THROW; to tell the caller
END CATCH;
SELECT * FROM dbo.Accounts;   -- balances unchanged`, { title: 'Bank transfer with TRY/CATCH', sandbox: false, note: 'Sandbox is off because this code manages its own transaction. It always rolls back, so nothing changes.' }),
      p('Change 30000 to 5000 and run again. With Sandbox **on**, the successful transfer is still rolled back afterwards.'),
      h3('Without a transaction'),
      code(`UPDATE dbo.Accounts SET Balance = Balance + 30000 WHERE AccountId = 3;   -- succeeds
UPDATE dbo.Accounts SET Balance = Balance - 30000 WHERE AccountId = 2;   -- fails CHECK
SELECT * FROM dbo.Accounts;   -- money appeared from nowhere!`, { title: 'Why you need atomicity', note: 'Runs in the sandbox, so the damage is undone afterwards.' }),
      h3('Savepoints and @@TRANCOUNT'),
      code(`BEGIN TRAN;
    UPDATE dbo.Products SET StockQty = StockQty + 10 WHERE ProductId = 1;
    SAVE TRAN BeforeRisky;
    UPDATE dbo.Products SET StockQty = 0;               -- oops, no WHERE
    ROLLBACK TRAN BeforeRisky;                          -- undo just the risky part
    SELECT @@TRANCOUNT AS OpenTransactions, ProductId, StockQty FROM dbo.Products WHERE ProductId <= 3;
ROLLBACK;`, { title: 'SAVE TRAN', sandbox: false }),
      note('Nested BEGIN TRAN does **not** create a real nested transaction. It only increments @@TRANCOUNT. A single ROLLBACK (without a savepoint name) undoes **everything** and sets @@TRANCOUNT to 0.', 'Nested transactions'),
      h2('Isolation levels'),
      table(['Level', 'Dirty read', 'Non-repeatable read', 'Phantom', 'Notes'], [
        ['READ UNCOMMITTED', 'Yes', 'Yes', 'Yes', 'Same as `WITH (NOLOCK)`. Can read rows twice or skip them'],
        ['**READ COMMITTED** (default)', 'No', 'Yes', 'Yes', 'Readers wait for writers (locking)'],
        ['REPEATABLE READ', 'No', 'No', 'Yes', 'Holds shared locks until the end of the transaction'],
        ['SERIALIZABLE', 'No', 'No', 'No', 'Range locks. Safest, most blocking'],
        ['SNAPSHOT', 'No', 'No', 'No', 'Row versions in tempdb. Readers never block writers'],
        ['READ COMMITTED SNAPSHOT (RCSI)', 'No', 'Yes', 'Yes', 'Database option. Default in Azure SQL Database']
      ]),
      p(`- **Dirty read:** reading data another transaction hasn't committed, and might roll back.
- **Non-repeatable read:** reading the same row twice in one transaction and getting different values.
- **Phantom:** running the same range query twice and getting *new rows* the second time.`),
      code(`SELECT name, is_read_committed_snapshot_on, snapshot_isolation_state_desc
FROM sys.databases WHERE name = DB_NAME();

DBCC USEROPTIONS;   -- shows the current session's isolation level`, { title: 'Check isolation settings' }),
      h2('Blocking and deadlocks'),
      p(`**Blocking** means session A holds a lock and session B waits for it. That is normal, but long transactions make it painful.

A **deadlock** means A holds lock 1 and wants lock 2, while B holds lock 2 and wants lock 1. SQL Server detects the cycle and kills one session, the *victim*, with **error 1205**.

**How to reduce deadlocks:** access tables in the **same order** everywhere, keep transactions **short** (no user input or HTTP calls inside them), add **indexes** so fewer rows are locked, consider **RCSI/SNAPSHOT**, and **retry** on error 1205 in the application.`),
      code(`-- Who is blocking whom right now (run from a second SSMS window during a test)
SELECT r.session_id, r.blocking_session_id, r.wait_type, r.wait_time, t.text
FROM sys.dm_exec_requests r
CROSS APPLY sys.dm_exec_sql_text(r.sql_handle) t
WHERE r.session_id <> @@SPID;`, { title: 'Spot blocking' }),
      tip('To *see* blocking yourself: in SSMS window 1 run `BEGIN TRAN; UPDATE dbo.Products SET Price = Price WHERE ProductId = 1;` and leave it open. In window 2 run `SELECT * FROM dbo.Products WHERE ProductId = 1;`: it waits. Run the query above from a third window, then ROLLBACK in window 1.'),
      quiz('A report uses `WITH (NOLOCK)` everywhere "for speed". What is the real risk?', ['None, it only reads', 'It can return uncommitted data and can skip rows or read them twice during page splits, so totals can be wrong', 'It locks the whole table', 'It is slower than READ COMMITTED'], 1, 'NOLOCK = READ UNCOMMITTED. For reports that must not block writers, use RCSI or SNAPSHOT isolation, which give consistent data without blocking.')
    ]
  });
})();
