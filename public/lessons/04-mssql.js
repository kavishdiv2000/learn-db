(function () {
  const { h2, h3, p, code, table, er, tip, warn, note, interview, quiz, reveal } = window.L;

  // ===========================================================================
  window.LESSONS.push({
    id: 'indexes',
    group: 'SQL Server internals',
    title: 'Indexes',
    keywords: 'clustered nonclustered covering include composite filtered unique columnstore b-tree seek scan key lookup heap fragmentation rebuild reorganize',
    intro: 'How SQL Server finds rows fast. Every demo uses the 300,000-row BigOrders table with the Plan and IO toggles already on, so you can see the difference each index makes.',
    blocks: [
      h2('What an index is'),
      p(`An index is a **sorted copy of some columns** stored as a **B-tree** (balanced tree). A root page points to intermediate pages, which point to leaf pages. To find one row among millions, SQL Server reads 3–4 pages instead of the whole table, just as you use a book's index instead of reading every page.

**The trade-off:** reads get faster, but every INSERT, UPDATE and DELETE must also update every index, and each index takes disk and memory.`),
      table(['Term', 'Meaning'], [
        ['**Heap**', 'A table with no clustered index. Rows are stored in no particular order'],
        ['**Clustered index**', 'The table *itself*, sorted by the key. The leaf level **is** the data rows. **One per table**'],
        ['**Nonclustered index**', 'A separate B-tree of the key columns plus a **row locator**: the clustered key, or a RID on a heap. Up to 999 per table'],
        ['**Index seek**', 'Navigate the B-tree straight to the matching rows. This is what you usually want'],
        ['**Index / table scan**', 'Read every leaf page. Fine for small tables or when you need most of the rows'],
        ['**Key lookup**', 'Found the row in a nonclustered index, but a needed column isn\'t there, so it jumps to the clustered index *for each row*'],
        ['**Covering index**', 'The index contains every column the query needs, so there are no lookups'],
        ['**Selectivity**', 'How few rows a value matches. `CustomerId = 1234` is selective. `Status = \'Shipped\'` (45% of rows) is not']
      ]),
      code(`SELECT i.name AS IndexName, i.type_desc, i.is_primary_key, i.is_unique,
       STRING_AGG(c.name, ', ') WITHIN GROUP (ORDER BY ic.key_ordinal) AS KeyColumns
FROM sys.indexes i
JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE i.object_id = OBJECT_ID('dbo.BigOrders')
GROUP BY i.name, i.type_desc, i.is_primary_key, i.is_unique;

SELECT COUNT(*) AS [Rows], SUM(used_page_count) AS Pages8KB
FROM sys.dm_db_partition_stats WHERE object_id = OBJECT_ID('dbo.BigOrders');`, { title: 'BigOrders starts with only its clustered PK' }),

      h2('Demo 1: no index → clustered index scan'),
      code(`SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'Find one customer\'s orders', plan: true, stats: true, note: 'Look at the **Execution plan** tab: *Clustered Index Scan* reads every row. The **Messages** tab shows thousands of *logical reads* to return about 15 rows.' }),

      h2('Demo 2: nonclustered index → seek + key lookup'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'Add an index on the filter column', plan: true, stats: true, note: 'Now it is an **Index Seek** on IX_BigOrders_CustomerId plus a **Key Lookup**, because OrderDate and Amount aren\'t in the index. Logical reads drop from thousands to about 50.' }),

      h2('Demo 3: covering index with INCLUDE → seek only'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId_Cover
    ON dbo.BigOrders (CustomerId)          -- key: what you search/sort on
    INCLUDE (OrderDate, Amount);           -- leaf-only columns: what you return
GO
SELECT OrderId, OrderDate, Amount
FROM dbo.BigOrders
WHERE CustomerId = 1234;`, { title: 'Cover the query', plan: true, stats: true, note: 'A single **Index Seek**, no lookup, about 3 logical reads. OrderId is free, because the clustered key is stored in every nonclustered index.' }),
      tip('**Key columns vs INCLUDE columns.** Put columns you filter, join or sort on in the **key**, because order matters there. Put columns you only *return* in **INCLUDE**: they live only at the leaf level, do not widen the B-tree, and have no ordering.'),

      h2('Demo 4: the tipping point (why SQL Server ignores your index)'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
-- Customer 1234: ~15 rows -> seek + lookups
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 1234;
-- Customer 42: ~15,000 rows -> 15,000 lookups would cost more than reading the table
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 42;`, { title: 'Same index, two different plans', plan: true, stats: true, note: 'The second query goes back to a **Clustered Index Scan**. The optimizer uses statistics to estimate rows: past roughly 0.5–2% of the table, key lookups cost more than a scan.' }),
      interview('**"I created an index but SQL Server doesn\'t use it. Why?"** 1) The predicate is not selective, so lookups would cost more than a scan (the tipping point). 2) The query is **not SARGable** (a function on the column, a leading wildcard, an implicit conversion). 3) **Statistics are stale**, so the estimates are wrong. 4) The index doesn\'t lead with the filtered column. The fixes: make the index covering, rewrite the predicate, or update statistics.'),

      h2('Demo 5: composite indexes and column order'),
      p('An index on **(CustomerId, OrderDate)** is sorted by CustomerId first, then by OrderDate *within* each customer, like a phone book sorted by surname, then first name. It helps queries that filter on the **leading** column. This is the **left-most prefix rule**.'),
      code(`CREATE NONCLUSTERED INDEX IX_BigOrders_Cust_Date
    ON dbo.BigOrders (CustomerId, OrderDate DESC) INCLUDE (Amount, Status);
GO
-- ✔ Seek: leading column + range on the second column, and no sort needed
SELECT TOP (10) OrderId, OrderDate, Amount, Status
FROM dbo.BigOrders
WHERE CustomerId = 42 AND OrderDate >= '2026-06-01'
ORDER BY OrderDate DESC;

-- ✘ Can't seek: OrderDate alone is not the leading column
SELECT COUNT(*) FROM dbo.BigOrders WHERE OrderDate >= '2026-10-01';`, { title: 'Left-most prefix rule', plan: true, stats: true }),
      note('A rule of thumb for column order: **equality columns first** (`=`), then **range or sort columns** (`>`, `BETWEEN`, `ORDER BY`), then INCLUDE whatever is only returned.', 'Ordering key columns'),

      h2('Demo 6: filtered index'),
      code(`-- Only 2% of orders are Pending, and the dashboard asks for them constantly
CREATE NONCLUSTERED INDEX IX_BigOrders_Pending
    ON dbo.BigOrders (OrderDate) INCLUDE (CustomerId, Amount)
    WHERE Status = 'Pending';
GO
SELECT TOP (20) OrderId, OrderDate, CustomerId, Amount
FROM dbo.BigOrders
WHERE Status = 'Pending'
ORDER BY OrderDate;

SELECT i.name, ps.row_count
FROM sys.indexes i JOIN sys.dm_db_partition_stats ps ON ps.object_id = i.object_id AND ps.index_id = i.index_id
WHERE i.object_id = OBJECT_ID('dbo.BigOrders');`, { title: 'Small index for a hot subset', plan: true, stats: true, note: 'The filtered index holds about 6,000 rows instead of 300,000, so it is smaller and cheaper to maintain. Parameterized queries (`WHERE Status = @s`) may not match it.' }),

      h2('Demo 7: unique index'),
      code(`-- Enforces uniqueness AND speeds up lookups (like a UNIQUE constraint)
CREATE TABLE lab.Users (UserId INT IDENTITY PRIMARY KEY, Email VARCHAR(150) NOT NULL);
CREATE UNIQUE NONCLUSTERED INDEX UX_Users_Email ON lab.Users (Email);
INSERT INTO lab.Users (Email) VALUES ('a@mail.com'), ('b@mail.com');
GO
INSERT INTO lab.Users (Email) VALUES ('a@mail.com');   -- Msg 2601: duplicate key`, { title: 'Unique index' }),

      h2('Demo 8: columnstore for analytics'),
      p('**Rowstore** indexes (B-trees) store whole rows together, which is ideal for "get order 123". **Columnstore** stores each column separately and compresses it heavily, which is ideal for "total revenue per city over millions of rows". It runs in **batch mode**, processing about 900 rows at a time.'),
      code(`-- Rowstore: scans the whole clustered index
SELECT ShipCity, Status, COUNT(*) AS Orders, SUM(Amount) AS Revenue
FROM dbo.BigOrders GROUP BY ShipCity, Status;
GO
DROP INDEX IF EXISTS NCCI_BigOrders ON dbo.BigOrders;
CREATE NONCLUSTERED COLUMNSTORE INDEX NCCI_BigOrders
    ON dbo.BigOrders (ShipCity, Status, Amount, OrderDate);
GO
-- Columnstore: reads only 3 compressed columns
SELECT ShipCity, Status, COUNT(*) AS Orders, SUM(Amount) AS Revenue
FROM dbo.BigOrders GROUP BY ShipCity, Status;
GO
DROP INDEX NCCI_BigOrders ON dbo.BigOrders;   -- clean up`, { title: 'Rowstore vs columnstore aggregate', plan: true, stats: true, sandbox: false, note: 'Runs outside the sandbox and drops the index at the end. Compare **logical reads** and CPU time in Messages: the columnstore version reads compressed segments (lob logical reads) for only 3 columns.' }),

      h2('Clustered key: choosing it well'),
      table(['A good clustered key is…', 'Why'], [
        ['**Narrow** (INT/BIGINT)', 'It is copied into every nonclustered index'],
        ['**Unique**', 'Otherwise SQL Server adds a hidden 4-byte "uniquifier"'],
        ['**Static**', 'Changing it moves the row and updates every index'],
        ['**Ever-increasing** (IDENTITY, sequential)', 'New rows go to the end. A random GUID causes **page splits** and fragmentation']
      ]),
      code(`CREATE TABLE lab.GuidKey (Id UNIQUEIDENTIFIER DEFAULT NEWID() PRIMARY KEY, Filler CHAR(200) DEFAULT 'x');
CREATE TABLE lab.IntKey  (Id INT IDENTITY PRIMARY KEY,                     Filler CHAR(200) DEFAULT 'x');
DECLARE @i INT = 0;
WHILE @i < 10000 BEGIN
    INSERT INTO lab.GuidKey DEFAULT VALUES; INSERT INTO lab.IntKey DEFAULT VALUES; SET @i += 1;
END;
SELECT OBJECT_NAME(object_id) AS TableName, avg_fragmentation_in_percent, page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED')
WHERE object_id IN (OBJECT_ID('lab.GuidKey'), OBJECT_ID('lab.IntKey'));`, { title: 'Random GUID vs IDENTITY fragmentation', note: 'Takes a few seconds. The GUID table ends up heavily fragmented, the INT table barely.' }),

      h2('Index maintenance'),
      code(`-- Fragmentation of every index in the database
SELECT OBJECT_NAME(ips.object_id) AS TableName, i.name AS IndexName,
       ips.index_type_desc, ips.avg_fragmentation_in_percent, ips.page_count
FROM sys.dm_db_index_physical_stats(DB_ID(), NULL, NULL, NULL, 'LIMITED') ips
JOIN sys.indexes i ON i.object_id = ips.object_id AND i.index_id = ips.index_id
WHERE ips.page_count > 100
ORDER BY ips.avg_fragmentation_in_percent DESC;

-- How each index has been used since the last restart: seeks/scans (reads) vs updates (cost)
SELECT OBJECT_NAME(s.object_id) AS TableName, i.name, s.user_seeks, s.user_scans, s.user_lookups, s.user_updates
FROM sys.dm_db_index_usage_stats s
JOIN sys.indexes i ON i.object_id = s.object_id AND i.index_id = s.index_id
WHERE s.database_id = DB_ID()
ORDER BY s.user_updates DESC;`, { title: 'Fragmentation and usage DMVs' }),
      code(`CREATE INDEX IX_BigOrders_ShipCity ON dbo.BigOrders (ShipCity);
ALTER INDEX IX_BigOrders_ShipCity ON dbo.BigOrders REORGANIZE;    -- light, always online, ~5–30%
ALTER INDEX IX_BigOrders_ShipCity ON dbo.BigOrders REBUILD;       -- full rebuild, >30% (ONLINE = ON in Enterprise/Developer)
ALTER INDEX IX_BigOrders_ShipCity ON dbo.BigOrders DISABLE;
ALTER INDEX IX_BigOrders_ShipCity ON dbo.BigOrders REBUILD;       -- re-enables it
EXEC sp_helpindex 'dbo.BigOrders';
DROP INDEX IX_BigOrders_ShipCity ON dbo.BigOrders;`, { title: 'REORGANIZE, REBUILD, DISABLE, DROP' }),
      note('The 5% / 30% thresholds are traditional guidance. On SSD storage, many DBAs now care more about keeping **statistics** up to date than about fragmentation. Regular maintenance jobs (e.g. Ola Hallengren\'s scripts) handle both.', 'Modern view'),

      h2('When indexes hurt'),
      code(`CREATE TABLE lab.NoIdx  (Id INT IDENTITY PRIMARY KEY, A INT, B INT, C INT, D INT);
CREATE TABLE lab.ManyIdx(Id INT IDENTITY PRIMARY KEY, A INT, B INT, C INT, D INT);
CREATE INDEX i1 ON lab.ManyIdx(A); CREATE INDEX i2 ON lab.ManyIdx(B);
CREATE INDEX i3 ON lab.ManyIdx(C); CREATE INDEX i4 ON lab.ManyIdx(D);
CREATE INDEX i5 ON lab.ManyIdx(A, B, C);
GO
SET STATISTICS TIME ON;
INSERT INTO lab.NoIdx  (A,B,C,D) SELECT TOP (100000) OrderId, CustomerId, OrderId % 97, OrderId % 13 FROM dbo.BigOrders;
INSERT INTO lab.ManyIdx(A,B,C,D) SELECT TOP (100000) OrderId, CustomerId, OrderId % 97, OrderId % 13 FROM dbo.BigOrders;
SET STATISTICS TIME OFF;`, { title: 'Insert cost: 1 index vs 6 indexes', note: 'Compare the two "SQL Server Execution Times" lines in the **Messages** tab.' }),
      h2('Check yourself'),
      quiz('Why can a table have only one clustered index?', ['A licensing limit', 'Because the clustered index *is* the table\'s physical row order, and rows can only be stored in one order', 'Because it uses too much memory', 'It can have up to 999'], 1, 'Nonclustered indexes are separate structures, so you can have many of them.'),
      quiz('Query: `SELECT Name, Price FROM Products WHERE Category = @c ORDER BY Price`. Which index is best?', ['(Price)', '(Category) INCLUDE (Name, Price)', '(Category, Price) INCLUDE (Name)', '(Name, Category, Price)'], 2, 'Equality column first, then the sort column, so there is no Sort operator. INCLUDE Name to cover the query. Option B covers it but still needs a sort.'),
      quiz('A table has a nonclustered index on `LastName`. You run `WHERE LEFT(LastName, 3) = \'Per\'`. What happens?', ['Index seek', 'Index scan or table scan: the function hides the column from the seek', 'Error', 'Key lookup only'], 1, 'Rewrite it as `WHERE LastName LIKE \'Per%\'`, which is SARGable and can seek.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'triggers',
    group: 'SQL Server internals',
    title: 'Triggers',
    keywords: 'trigger after instead of inserted deleted audit soft delete ddl trigger nested recursive update()',
    intro: 'Code that fires automatically on INSERT, UPDATE or DELETE. How triggers work, four industry patterns, and the multi-row bug interviewers look for.',
    blocks: [
      h2('How triggers work'),
      p(`- A trigger runs **automatically** when its event happens. You never call it directly.
- It runs **inside the same transaction** as the statement that fired it. If the trigger raises an error or calls ROLLBACK, the original statement is undone too.
- It fires **once per statement, not once per row**. An UPDATE touching 500 rows fires the trigger once, with 500 rows in the special tables.
- Inside it, two virtual tables hold the affected rows: **inserted** and **deleted**.`),
      table(['Statement', '`inserted` contains', '`deleted` contains'], [
        ['INSERT', 'the new rows', '(empty)'], ['DELETE', '(empty)', 'the removed rows'], ['UPDATE', 'rows **after** the change', 'rows **before** the change']
      ]),
      table(['Type', 'Fires', 'Typical use'], [
        ['**AFTER** (= FOR) DML', 'After the statement and its constraint checks succeed', 'Audit logs, keeping related tables in sync, complex business rules'],
        ['**INSTEAD OF** DML', '*Instead of* the statement (which never runs unless the trigger does it)', 'Soft delete, making a multi-table view updatable, validation before write'],
        ['**DDL**', 'On CREATE / ALTER / DROP (database or server level)', 'Blocking or logging schema changes in production'],
        ['**LOGON**', 'When a login connects', 'Restricting connections (be careful: it can lock everyone out)']
      ]),
      h2('See inserted and deleted for yourself'),
      code(`CREATE TRIGGER trg_Products_Peek ON dbo.Products
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    SELECT 'inserted' AS VirtualTable, * FROM inserted;
    SELECT 'deleted'  AS VirtualTable, * FROM deleted;
END;
GO
UPDATE dbo.Products SET Price = Price * 0.9 WHERE Category = N'Furniture';`, { title: 'A trigger that shows its own virtual tables', note: 'Three products changed, but the trigger fired **once**. Each virtual table holds 3 rows: *deleted* has the old prices, *inserted* the new ones. (Returning result sets from a trigger is only for learning. Don\'t do it in production.)' }),

      h2('Pattern 1: audit trail (AFTER UPDATE)'),
      p('Banks, finance systems and e-commerce sites need to answer "who changed this price, and when?". A trigger catches **every** change, including ad-hoc updates from SSMS that bypass the application.'),
      code(`CREATE TABLE lab.ProductPriceAudit (
    AuditId   INT IDENTITY PRIMARY KEY,
    ProductId INT NOT NULL,
    OldPrice  DECIMAL(18,2),
    NewPrice  DECIMAL(18,2),
    ChangedBy SYSNAME      NOT NULL DEFAULT SUSER_SNAME(),
    ChangedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME()
);
GO
CREATE TRIGGER trg_Products_PriceAudit ON dbo.Products
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT UPDATE(Price) RETURN;                 -- Price wasn't in the SET list: nothing to do

    INSERT INTO lab.ProductPriceAudit (ProductId, OldPrice, NewPrice)
    SELECT d.ProductId, d.Price, i.Price
    FROM inserted i
    JOIN deleted  d ON d.ProductId = i.ProductId  -- pair each row's before/after
    WHERE i.Price <> d.Price;                     -- only real changes
END;
GO
UPDATE dbo.Products SET Price = Price * 1.05 WHERE Category = N'Electronics';   -- 5 rows
UPDATE dbo.Products SET StockQty = StockQty + 1 WHERE ProductId = 1;             -- not audited
SELECT * FROM lab.ProductPriceAudit;`, { title: 'Price audit trigger' }),

      h2('Pattern 2: keep stock in sync and block overselling (AFTER INSERT)'),
      code(`CREATE TRIGGER trg_OrderItems_ReduceStock ON dbo.OrderItems
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE p
    SET p.StockQty = p.StockQty - x.Qty
    FROM dbo.Products p
    JOIN (SELECT ProductId, SUM(Quantity) AS Qty FROM inserted GROUP BY ProductId) x   -- multi-row safe
      ON x.ProductId = p.ProductId;

    IF EXISTS (SELECT 1 FROM dbo.Products p JOIN inserted i ON i.ProductId = p.ProductId WHERE p.StockQty < 0)
        THROW 50001, 'Insufficient stock for one or more products.', 1;   -- rolls back the INSERT too
END;
GO
SELECT ProductId, Name, StockQty FROM dbo.Products WHERE ProductId IN (2, 6);
INSERT INTO dbo.Orders (CustomerId, Status) VALUES (1, 'Pending');
INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice)
VALUES (SCOPE_IDENTITY(), 2, 3, 3500);                          -- 3 mice: OK
SELECT ProductId, Name, StockQty FROM dbo.Products WHERE ProductId IN (2, 6);
GO
INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice)
VALUES (IDENT_CURRENT('dbo.Orders'), 6, 50, 45000);             -- 50 desks: only 5 in stock`, { title: 'Stock trigger', note: 'The last insert fails with Msg 50001. Because the error happened inside the trigger, **SQL Server rolled back the whole transaction**, sandbox included. That shows how a trigger error undoes the statement that fired it.' }),

      h2('Pattern 3: soft delete (INSTEAD OF DELETE)'),
      code(`ALTER TABLE dbo.Customers ADD IsDeleted BIT NOT NULL CONSTRAINT DF_Customers_IsDeleted DEFAULT 0;
GO
CREATE TRIGGER trg_Customers_SoftDelete ON dbo.Customers
INSTEAD OF DELETE
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE c SET IsDeleted = 1
    FROM dbo.Customers c JOIN deleted d ON d.CustomerId = c.CustomerId;
END;
GO
DELETE FROM dbo.Customers WHERE CustomerId = 1;     -- would normally fail (FK from Orders)
SELECT CustomerId, FullName, IsDeleted FROM dbo.Customers WHERE CustomerId <= 3;`, { title: 'Delete becomes "mark as deleted"', note: 'The row survives, and so do Nimal\'s orders. Many SaaS products work like this for recovery and compliance.' }),

      h2('Pattern 4: protect production (DDL trigger)'),
      code(`CREATE TRIGGER trg_BlockDropTable ON DATABASE
FOR DROP_TABLE, ALTER_TABLE
AS
BEGIN
    DECLARE @e XML = EVENTDATA();
    PRINT 'Blocked: ' + @e.value('(/EVENT_INSTANCE/TSQLCommand/CommandText)[1]', 'NVARCHAR(MAX)');
    ROLLBACK;
END;
GO
DROP TABLE dbo.ProductStaging;`, { title: 'Stop accidental DROP / ALTER TABLE', note: 'The DROP is rolled back. The ROLLBACK inside the trigger also ends the sandbox transaction, so the trigger itself disappears afterwards.' }),

      h2('The multi-row bug'),
      p('This is the most common trigger mistake, and interviewers ask about it. The code assumes one row:'),
      code(`CREATE TABLE lab.PriceLog (ProductId INT, NewPrice DECIMAL(18,2));
GO
CREATE TRIGGER trg_Bad ON dbo.Products AFTER UPDATE AS
BEGIN
    DECLARE @id INT, @price DECIMAL(18,2);
    SELECT @id = ProductId, @price = Price FROM inserted;   -- ✘ keeps only ONE arbitrary row
    INSERT INTO lab.PriceLog VALUES (@id, @price);
END;
GO
UPDATE dbo.Products SET Price = Price + 1 WHERE Category = N'Electronics';   -- 5 rows updated
SELECT COUNT(*) AS RowsLogged FROM lab.PriceLog;                              -- only 1!`, { title: 'Buggy trigger: variables from inserted' }),
      tip('The fix is always **set-based**: `INSERT … SELECT … FROM inserted [JOIN deleted]`, as in Pattern 1.'),

      h2('Managing triggers'),
      code(`SELECT t.name, OBJECT_NAME(t.parent_id) AS TableName, t.is_disabled, t.is_instead_of_trigger,
       te.type_desc AS FiresOn
FROM sys.triggers t
JOIN sys.trigger_events te ON te.object_id = t.object_id
WHERE t.parent_class = 1;

-- DISABLE TRIGGER trg_Products_PriceAudit ON dbo.Products;
-- ENABLE  TRIGGER trg_Products_PriceAudit ON dbo.Products;
-- DROP TRIGGER IF EXISTS trg_Products_PriceAudit;
-- EXEC sp_settriggerorder 'trg_X', 'First', 'UPDATE';   -- control order of several AFTER triggers`, { title: 'List, disable, enable, drop' }),
      table(['Pros', 'Cons'], [
        ['Enforced for every app, script and ad-hoc query', '"Hidden" logic: developers forget it exists'],
        ['Good for auditing and rules constraints can\'t express', 'Harder to debug and test'],
        ['Runs in the same transaction, so it is always consistent', 'Adds work to every write and lengthens locks'],
        ['', 'Can cascade (nested triggers, up to 32 levels)']
      ]),
      note('**Alternatives:** CHECK/FK constraints for simple rules, stored procedures that own all writes, **Temporal tables** (SQL Server keeps a full row history for you), **Change Data Capture** / **Change Tracking** for syncing data to other systems.', 'Before you write a trigger'),
      quiz('Does `TRUNCATE TABLE dbo.OrderItems` fire an AFTER DELETE trigger?', ['Yes', 'No: TRUNCATE deallocates pages and does not log individual row deletes', 'Only if the trigger is INSTEAD OF', 'Only in SNAPSHOT isolation'], 1, 'This is a common follow-up to DELETE vs TRUNCATE. Bulk loads can also skip triggers unless you specify FIRE_TRIGGERS.'),
      quiz('An UPDATE changes 1,000 rows on a table with an AFTER UPDATE trigger. How many times does the trigger run?', ['1,000', '1', 'It depends on the isolation level', '0 unless you use a cursor'], 1, 'Once per statement. `inserted` and `deleted` each hold 1,000 rows.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'procedures',
    group: 'SQL Server internals',
    title: 'Stored procedures & functions',
    keywords: 'stored procedure parameter output return try catch throw raiserror dynamic sql injection sp_executesql function scalar table valued',
    intro: 'Reusable, precompiled T-SQL: parameters, error handling, OUTPUT values, safe dynamic SQL, and the procedure-vs-function question.',
    blocks: [
      h2('Why teams use stored procedures'),
      table(['Benefit', 'Explanation'], [
        ['**Plan reuse**', 'The plan is compiled once and cached, then reused for each call'],
        ['**Security**', 'GRANT EXECUTE on the procedure without giving SELECT/UPDATE on the tables'],
        ['**SQL injection protection**', 'Parameters are always treated as data, never as code'],
        ['**Less network traffic**', 'One call instead of many statements'],
        ['**One place for logic**', 'Several apps (API, reports, jobs) share the same, tested logic']
      ]),
      h2('A read procedure: optional filter + paging'),
      code(`CREATE PROCEDURE lab.usp_GetCustomerOrders
    @CustomerId INT,
    @Status     VARCHAR(20) = NULL,     -- optional parameter (has a default)
    @PageNumber INT = 1,
    @PageSize   INT = 10
AS
BEGIN
    SET NOCOUNT ON;                      -- no "n rows affected" chatter
    SELECT o.OrderId, o.OrderDate, o.Status, t.Total
    FROM dbo.Orders o
    JOIN dbo.vw_OrderTotals t ON t.OrderId = o.OrderId
    WHERE o.CustomerId = @CustomerId
      AND (@Status IS NULL OR o.Status = @Status)
    ORDER BY o.OrderDate DESC
    OFFSET (@PageNumber - 1) * @PageSize ROWS FETCH NEXT @PageSize ROWS ONLY;
END;
GO
EXEC lab.usp_GetCustomerOrders @CustomerId = 1;
EXEC lab.usp_GetCustomerOrders @CustomerId = 1, @Status = 'Paid';
EXEC lab.usp_GetCustomerOrders 1, NULL, 1, 2;      -- positional parameters`, { title: 'Parameters, defaults, paging' }),

      h2('A write procedure: transaction, validation, OUTPUT parameter, return code'),
      code(`CREATE PROCEDURE lab.usp_PlaceOrder
    @CustomerId INT,
    @ProductId  INT,
    @Quantity   INT,
    @NewOrderId INT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        IF @Quantity <= 0 THROW 50010, 'Quantity must be positive.', 1;

        BEGIN TRAN;
            DECLARE @Price DECIMAL(18,2), @Stock INT;
            SELECT @Price = Price, @Stock = StockQty
            FROM dbo.Products WITH (UPDLOCK, HOLDLOCK)      -- lock the row: two buyers can't both take the last one
            WHERE ProductId = @ProductId;

            IF @Price IS NULL      THROW 50011, 'Product not found.', 1;
            IF @Stock < @Quantity  THROW 50012, 'Not enough stock.', 1;

            INSERT INTO dbo.Orders (CustomerId, Status) VALUES (@CustomerId, 'Pending');
            SET @NewOrderId = SCOPE_IDENTITY();
            INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice)
            VALUES (@NewOrderId, @ProductId, @Quantity, @Price);
            UPDATE dbo.Products SET StockQty = StockQty - @Quantity WHERE ProductId = @ProductId;
        COMMIT;
        RETURN 0;                                           -- success
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;                                              -- re-raise the original error to the caller
    END CATCH
END;
GO
DECLARE @id INT, @rc INT;
EXEC @rc = lab.usp_PlaceOrder @CustomerId = 2, @ProductId = 2, @Quantity = 3, @NewOrderId = @id OUTPUT;
SELECT @rc AS ReturnCode, @id AS NewOrderId;
SELECT * FROM dbo.OrderItems WHERE OrderId = @id;
GO
DECLARE @id INT;
EXEC lab.usp_PlaceOrder 2, 7, 1, @id OUTPUT;      -- Chair has 0 stock → Msg 50012`, { title: 'usp_PlaceOrder', note: 'Inside the sandbox, the procedure\'s COMMIT only decrements @@TRANCOUNT (nested BEGIN TRAN does not create a real nested transaction). The failing second call\'s ROLLBACK then undoes **everything**, so ShopDB stays unchanged. You will also see Msg 266 (mismatched transaction count), which is SQL Server warning about exactly that.' }),
      note('**THROW vs RAISERROR:** `THROW` (SQL Server 2012+) re-raises the original error number and line, always aborts the batch, and needs a `;` before it. `RAISERROR` is older, supports printf-style formatting and severity levels, and does not abort the batch by default. Prefer THROW in new code.', 'Errors'),

      h2('Calling it from C#'),
      p('Interviewers for .NET roles often ask how you call procedures from code. With plain ADO.NET:'),
      code(`/* C# (ADO.NET, Microsoft.Data.SqlClient) – shown for reference, not runnable here

using var conn = new SqlConnection(connectionString);
await conn.OpenAsync();
using var cmd = new SqlCommand("lab.usp_PlaceOrder", conn) { CommandType = CommandType.StoredProcedure };
cmd.Parameters.Add("@CustomerId", SqlDbType.Int).Value = 2;
cmd.Parameters.Add("@ProductId",  SqlDbType.Int).Value = 2;
cmd.Parameters.Add("@Quantity",   SqlDbType.Int).Value = 3;
var newId = cmd.Parameters.Add("@NewOrderId", SqlDbType.Int);
newId.Direction = ParameterDirection.Output;
await cmd.ExecuteNonQueryAsync();
int orderId = (int)newId.Value;

// Dapper:  await conn.ExecuteAsync("lab.usp_PlaceOrder", dynParams, commandType: CommandType.StoredProcedure);
// EF Core: await db.Database.ExecuteSqlInterpolatedAsync($"EXEC lab.usp_PlaceOrder {c}, {p}, {q}, {outParam} OUTPUT");
*/
SELECT 'See the C# in the comment above' AS Info;`, { title: 'ADO.NET / Dapper / EF Core' }),

      h2('Dynamic SQL and SQL injection'),
      code(`DECLARE @userInput NVARCHAR(100) = N''' OR 1 = 1 --';      -- a malicious "city"

-- ✘ UNSAFE: concatenating input into SQL
DECLARE @bad NVARCHAR(MAX) = N'SELECT FullName, Email FROM dbo.Customers WHERE City = ''' + @userInput + N'''';
PRINT @bad;            -- see what actually runs (Messages tab)
EXEC (@bad);           -- returns EVERY customer

-- ✔ SAFE: parameterized dynamic SQL
DECLARE @good NVARCHAR(MAX) = N'SELECT FullName, Email FROM dbo.Customers WHERE City = @city';
EXEC sp_executesql @good, N'@city NVARCHAR(50)', @city = @userInput;   -- returns nothing`, { title: 'SQL injection, live' }),
      tip('When you truly need dynamic *identifiers* (a sortable column name, say), wrap them in `QUOTENAME()` and check them against a whitelist. Parameters can\'t replace table or column names.'),

      h2('Functions'),
      code(`-- Scalar function: one value
CREATE FUNCTION lab.fn_PriceWithVat (@Price DECIMAL(18,2))
RETURNS DECIMAL(18,2)
AS
BEGIN
    RETURN @Price * 1.18;
END;
GO
-- Inline table-valued function (iTVF): a parameterized view, optimized like a view
CREATE FUNCTION lab.fn_OrdersByCustomer (@CustomerId INT)
RETURNS TABLE
AS
RETURN (SELECT OrderId, OrderDate, Status FROM dbo.Orders WHERE CustomerId = @CustomerId);
GO
-- Multi-statement TVF: fills a table variable (poorer row estimates)
CREATE FUNCTION lab.fn_TopProducts (@n INT)
RETURNS @r TABLE (ProductId INT, Name NVARCHAR(100), Revenue DECIMAL(18,2))
AS
BEGIN
    INSERT INTO @r
    SELECT TOP (@n) p.ProductId, p.Name, SUM(oi.Quantity * oi.UnitPrice)
    FROM dbo.Products p JOIN dbo.OrderItems oi ON oi.ProductId = p.ProductId
    GROUP BY p.ProductId, p.Name ORDER BY 3 DESC;
    RETURN;
END;
GO
SELECT Name, Price, lab.fn_PriceWithVat(Price) AS WithVat FROM dbo.Products;
SELECT * FROM lab.fn_OrdersByCustomer(1);
SELECT c.FullName, o.* FROM dbo.Customers c CROSS APPLY lab.fn_OrdersByCustomer(c.CustomerId) o;
SELECT * FROM lab.fn_TopProducts(3);`, { title: 'Scalar, inline TVF, multi-statement TVF' }),
      table(['', 'Stored procedure', 'Function'], [
        ['Returns', '0..n result sets, OUTPUT parameters, an INT return code', 'Exactly one scalar value or one table'],
        ['Use inside SELECT / WHERE / JOIN', 'No', 'Yes'],
        ['Modify data (INSERT/UPDATE/DELETE on tables)', 'Yes', 'No'],
        ['TRY/CATCH, transactions, dynamic SQL, temp tables', 'Yes', 'No'],
        ['Call the other', 'Can call functions', 'Cannot call procedures'],
        ['Typical use', 'Business operations, the app\'s data API', 'Reusable calculations and filters']
      ]),
      warn('**Scalar UDFs in a SELECT over many rows** have historically been slow: they run once per row and blocked parallelism. SQL Server 2019+ can *inline* simple ones automatically. Inline TVFs are usually the faster design.'),
      quiz('You need a reusable "orders for a customer" that other queries can JOIN to. Best choice?', ['Stored procedure', 'Scalar function', 'Inline table-valued function', 'Trigger'], 2, 'You can\'t JOIN to a procedure. An iTVF is expanded into the calling query, so the optimizer sees through it, just like a view with a parameter.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'optimization',
    group: 'SQL Server internals',
    title: 'Query optimization',
    keywords: 'performance tuning sargable execution plan statistics parameter sniffing implicit conversion cursor batching query store dmv',
    intro: 'A repeatable method plus the fixes that solve most slow queries. Every demo has Plan and IO turned on, so you can measure before and after.',
    blocks: [
      h2('The method (say this in interviews)'),
      p(`1. **Find** the slow query with data, not guesses: Query Store, DMVs, Extended Events, or the application's logs and APM.
2. **Measure** a baseline: \`SET STATISTICS IO, TIME ON\`. Note the logical reads and CPU time.
3. **Read the actual execution plan:** look for scans on big tables, key lookups repeated thousands of times, expensive sorts, spills, warnings, and estimated rows far from actual rows.
4. **Fix the biggest cost:** rewrite the predicate (SARGability), add or adjust an index, update statistics, or fix parameter sniffing.
5. **Measure again**, and check that writes didn't get slower.`),
      p('**How SQL Server runs a query:** parse → bind → the **cost-based optimizer** uses **statistics** (row-count estimates) to pick a plan → the plan is **cached** → executed. A bad estimate leads to a bad plan.'),

      h2('SARGability: keep the column "naked"'),
      p('A predicate is **SARGable** (Search-ARGument-able) when SQL Server can use an index **seek** for it. Wrapping the indexed column in a function, calculation or conversion forces a scan. Each demo creates the index it needs, runs the **bad** query and then the **good** one.'),
      code(`CREATE INDEX IX_BigOrders_OrderDate ON dbo.BigOrders (OrderDate);
GO
-- ✘ Function on the column -> scan
SELECT COUNT(*) FROM dbo.BigOrders WHERE YEAR(OrderDate) = 2025 AND MONTH(OrderDate) = 12;
-- ✔ Range on the bare column -> seek
SELECT COUNT(*) FROM dbo.BigOrders WHERE OrderDate >= '2025-12-01' AND OrderDate < '2026-01-01';`, { title: 'YEAR()/MONTH() vs a date range', plan: true, stats: true }),
      code(`CREATE INDEX IX_BigOrders_Email ON dbo.BigOrders (CustomerEmail);
GO
-- ✘ Leading wildcard -> scan
SELECT COUNT(*) FROM dbo.BigOrders WHERE CustomerEmail LIKE '%1234@mail.com';
-- ✔ Trailing wildcard -> seek
SELECT COUNT(*) FROM dbo.BigOrders WHERE CustomerEmail LIKE 'customer1234%';`, { title: 'LIKE \'%x\' vs LIKE \'x%\'', plan: true, stats: true }),
      code(`CREATE INDEX IX_BigOrders_Amount ON dbo.BigOrders (Amount);
GO
-- ✘ Maths on the column -> scan
SELECT COUNT(*) FROM dbo.BigOrders WHERE Amount * 1.18 > 58000;
-- ✔ Maths on the constant -> seek
SELECT COUNT(*) FROM dbo.BigOrders WHERE Amount > 58000 / 1.18;`, { title: 'Calculation on the column vs on the constant', plan: true, stats: true }),
      code(`CREATE INDEX IX_BigOrders_Email ON dbo.BigOrders (CustomerEmail) INCLUDE (Amount);
GO
-- ✘ N'...' is NVARCHAR, the column is VARCHAR -> implicit conversion on the column
SELECT OrderId, Amount FROM dbo.BigOrders WHERE CustomerEmail = N'customer1234@mail.com';
-- ✔ Matching type
SELECT OrderId, Amount FROM dbo.BigOrders WHERE CustomerEmail = 'customer1234@mail.com';`, { title: 'Implicit conversion (VARCHAR column vs NVARCHAR value)', plan: true, stats: true, note: 'Look for the ⚠ implicit-conversion warning under the first plan. With a SQL collation (e.g. `SQL_Latin1_General_CP1_CI_AS`) it becomes a full scan. With a Windows collation SQL Server can still seek, but with extra work. Either way, match the types.' }),
      callout_dotnet(),
      code(`CREATE INDEX IX_BigOrders_ShipCity ON dbo.BigOrders (ShipCity) INCLUDE (Amount);
GO
-- ✘ ISNULL/COALESCE on the column
SELECT SUM(Amount) FROM dbo.BigOrders WHERE ISNULL(ShipCity, N'') = N'Jaffna';
-- ✔ Plain comparison (NULLs never equal 'Jaffna' anyway)
SELECT SUM(Amount) FROM dbo.BigOrders WHERE ShipCity = N'Jaffna';`, { title: 'ISNULL in WHERE', plan: true, stats: true }),

      h2('Return less data'),
      code(`CREATE INDEX IX_BigOrders_Cust_Cover ON dbo.BigOrders (CustomerId) INCLUDE (OrderDate, Amount);
GO
-- ✘ SELECT * can't be covered -> seek + key lookups (or a scan)
SELECT * FROM dbo.BigOrders WHERE CustomerId = 4321;
-- ✔ Only the columns you need -> covered seek
SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 4321;`, { title: 'SELECT * vs named columns', plan: true, stats: true }),
      p('`SELECT *` also sends unused columns over the network, breaks when columns are added or reordered, and blocks covering indexes. EF Core does the same when you materialize whole entities. Use `.Select(x => new { … })` projections in hot paths.'),

      h2('Parameter sniffing'),
      p(`When a procedure first runs, SQL Server builds its plan for the parameter values it **sniffs** and caches that plan for every later call. If the first call was for a small customer, the plan is *seek + lookups*. A later call for customer 42 (15,000 orders) reuses that plan and does 15,000 lookups. Typical symptoms: **"fast in SSMS, slow from the app"**, or **"it was fine yesterday"**.`),
      code(`CREATE INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
CREATE PROCEDURE lab.usp_CustomerOrders @CustomerId INT AS
    SELECT OrderId, OrderDate, Amount, Status FROM dbo.BigOrders WHERE CustomerId = @CustomerId;
GO
EXEC lab.usp_CustomerOrders @CustomerId = 1234;   -- compiles a seek + lookup plan (~15 rows)
EXEC lab.usp_CustomerOrders @CustomerId = 42;     -- REUSES it for ~15,000 rows: many lookups`, { title: 'Reproduce parameter sniffing', plan: true, stats: true, note: 'Compare the two "logical reads" lines in Messages. The second call does far more reads than a plain scan would. The plan tab shows both used the same seek + lookup shape.' }),
      code(`CREATE INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
CREATE PROCEDURE lab.usp_CustomerOrders @CustomerId INT AS
    SELECT OrderId, OrderDate, Amount, Status FROM dbo.BigOrders WHERE CustomerId = @CustomerId
    OPTION (RECOMPILE);           -- fresh plan for every value (costs some CPU per call)
GO
EXEC lab.usp_CustomerOrders @CustomerId = 1234;   -- seek + lookup
EXEC lab.usp_CustomerOrders @CustomerId = 42;     -- scan: the right plan for this value`, { title: 'Fix 1: OPTION (RECOMPILE)', plan: true, stats: true }),
      table(['Fix', 'When to use it'], [
        ['`OPTION (RECOMPILE)`', 'The query isn\'t run thousands of times per second. Gives the best plan per value'],
        ['`OPTION (OPTIMIZE FOR (@p UNKNOWN))`', 'One "average" plan, based on density instead of the sniffed value'],
        ['`OPTION (OPTIMIZE FOR (@p = 1234))`', 'You know the most common value'],
        ['A covering index', 'Removes the lookups, so one plan is good for every value. Often the best fix'],
        ['Query Store → force plan', 'Production emergency: pin the known-good plan with no code change'],
        ['Separate procedures / branches', 'Very different data shapes (e.g. "whale" customers vs normal customers)'],
        ['SQL Server 2022+ PSP optimization', 'Parameter Sensitive Plan: SQL Server can cache several plans automatically (compatibility level 160+)']
      ]),

      h2('Set-based instead of row-by-row'),
      code(`CREATE TABLE lab.Prices (ProductId INT PRIMARY KEY, Price DECIMAL(18,2));
INSERT INTO lab.Prices SELECT TOP (20000) OrderId, Amount FROM dbo.BigOrders;
GO
SET STATISTICS TIME ON;
-- ✘ Cursor: 20,000 separate UPDATE statements
DECLARE @id INT;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT ProductId FROM lab.Prices;
OPEN c; FETCH NEXT FROM c INTO @id;
WHILE @@FETCH_STATUS = 0
BEGIN
    UPDATE lab.Prices SET Price = Price * 1.05 WHERE ProductId = @id;
    FETCH NEXT FROM c INTO @id;
END
CLOSE c; DEALLOCATE c;
-- ✔ One statement
UPDATE lab.Prices SET Price = Price * 1.05;
SET STATISTICS TIME OFF;`, { title: 'Cursor vs one UPDATE', note: 'Compare the elapsed times in the Messages tab: the cursor is usually 50–100× slower.' }),

      h2('Statistics'),
      p('Statistics are histograms of value distribution. The optimizer uses them to estimate row counts. `AUTO_UPDATE_STATISTICS` refreshes them after enough rows change, but after a big load or delete you may need to run `UPDATE STATISTICS` yourself.'),
      code(`CREATE INDEX IX_BigOrders_CustomerId ON dbo.BigOrders (CustomerId);
GO
DBCC SHOW_STATISTICS ('dbo.BigOrders', 'IX_BigOrders_CustomerId') WITH HISTOGRAM;
GO
SELECT s.name, sp.last_updated, sp.rows, sp.rows_sampled, sp.modification_counter
FROM sys.stats s CROSS APPLY sys.dm_db_stats_properties(s.object_id, s.stats_id) sp
WHERE s.object_id = OBJECT_ID('dbo.BigOrders');
-- UPDATE STATISTICS dbo.BigOrders WITH FULLSCAN;   -- most accurate
-- EXEC sp_updatestats;                              -- whole database`, { title: 'Look inside statistics', note: 'In the histogram, find the row for customer 42 (EQ_ROWS ≈ 15,000). That is how the optimizer knows 42 is a "whale".' }),

      h2('Big changes in batches'),
      code(`SELECT COUNT(*) AS OldOrders FROM dbo.BigOrders WHERE OrderDate < '2025-03-01';
DECLARE @deleted INT = 1, @total INT = 0;
WHILE @deleted > 0
BEGIN
    DELETE TOP (4000) FROM dbo.BigOrders WHERE OrderDate < '2025-03-01';
    SET @deleted = @@ROWCOUNT;
    SET @total += @deleted;
    -- in production: COMMIT each batch and WAITFOR DELAY '00:00:01' to let other sessions in
END;
SELECT @total AS DeletedInBatches;`, { title: 'Purge old rows in chunks', note: 'Batches under about 5,000 rows avoid **lock escalation** (row locks → a full table lock) and keep the transaction log small.' }),

      h2('Find the worst queries on a real server'),
      code(`-- Top 10 by total CPU since their plans were cached
SELECT TOP (10)
    qs.execution_count,
    qs.total_worker_time / 1000                      AS TotalCpuMs,
    qs.total_logical_reads / qs.execution_count      AS AvgLogicalReads,
    qs.total_elapsed_time / qs.execution_count / 1000 AS AvgElapsedMs,
    SUBSTRING(st.text, qs.statement_start_offset / 2 + 1,
        (CASE qs.statement_end_offset WHEN -1 THEN DATALENGTH(st.text) ELSE qs.statement_end_offset END
         - qs.statement_start_offset) / 2 + 1)       AS QueryText
FROM sys.dm_exec_query_stats qs
CROSS APPLY sys.dm_exec_sql_text(qs.sql_handle) st
ORDER BY qs.total_worker_time DESC;`, { title: 'Expensive queries DMV' }),
      code(`-- Indexes SQL Server wishes it had (hints only: review before creating!)
SELECT TOP (10) d.statement AS TableName, d.equality_columns, d.inequality_columns, d.included_columns,
       s.user_seeks, CAST(s.avg_user_impact AS INT) AS AvgImpactPct
FROM sys.dm_db_missing_index_details d
JOIN sys.dm_db_missing_index_groups g ON g.index_handle = d.index_handle
JOIN sys.dm_db_missing_index_group_stats s ON s.group_handle = g.index_group_handle
WHERE d.database_id = DB_ID()
ORDER BY s.user_seeks * s.avg_user_impact DESC;

-- Is Query Store on? (it records plan history so you can spot and fix regressions)
SELECT actual_state_desc, desired_state_desc, current_storage_size_mb FROM sys.database_query_store_options;`, { title: 'Missing indexes & Query Store' }),

      h2('Worked example: before and after'),
      p('**Ticket:** "The customer orders page is slow." The page runs this query:'),
      code(`SELECT *
FROM dbo.BigOrders
WHERE CustomerId = 777 AND YEAR(OrderDate) = 2026 AND Status = 'Shipped'
ORDER BY OrderDate DESC;`, { title: 'Before', plan: true, stats: true }),
      p('**Diagnosis:** a clustered index scan of 300k rows, plus a Sort. There is no index on CustomerId, the predicate is non-SARGable (YEAR), and SELECT * makes the query impossible to cover.'),
      code(`CREATE INDEX IX_BigOrders_Cust_Status_Date
    ON dbo.BigOrders (CustomerId, Status, OrderDate DESC) INCLUDE (Amount);
GO
SELECT OrderId, OrderDate, Status, Amount
FROM dbo.BigOrders
WHERE CustomerId = 777 AND Status = 'Shipped'
  AND OrderDate >= '2026-01-01' AND OrderDate < '2027-01-01'
ORDER BY OrderDate DESC;`, { title: 'After', plan: true, stats: true, note: 'A single index seek, no Sort (the index is already in OrderDate DESC order within customer + status), no lookup. Logical reads drop from thousands to single digits.' }),
      interview('Explain an optimization like this: **symptom → measurement → plan finding → fix → measured result**. For example: *"The page took 1.2 s. STATISTICS IO showed 3,000 reads from a clustered index scan. The YEAR() predicate wasn\'t SARGable and there was no supporting index. I rewrote it as a date range and added (CustomerId, Status, OrderDate DESC) INCLUDE (Amount). That gave 4 reads and 5 ms."*'),
      h2('Quick reference'),
      table(['Problem in the plan', 'Typical fix'], [
        ['Clustered index / table scan on a big table', 'Index on the WHERE/JOIN columns. Make the predicate SARGable'],
        ['Key lookup with a high cost %', 'INCLUDE the missing columns (covering index)'],
        ['Sort operator', 'An index already ordered by the ORDER BY columns'],
        ['Estimated rows ≠ actual rows (by 10× or more)', 'Update statistics. Check for parameter sniffing and table variables'],
        ['⚠ Implicit conversion', 'Match parameter and column data types'],
        ['Hash match spill to tempdb', 'Better estimates, or a supporting index, or a smaller row set'],
        ['Many executions of a scalar UDF', 'Inline it (iTVF) or compute it set-based'],
        ['Blocking / deadlocks', 'Shorter transactions, consistent access order, indexes, RCSI']
      ])
    ]
  });

  function callout_dotnet() {
    return window.L.tip('**.NET trap:** `cmd.Parameters.AddWithValue("@email", someString)` sends **NVARCHAR**. Against a VARCHAR column that is exactly this implicit conversion. Use `cmd.Parameters.Add("@email", SqlDbType.VarChar, 150).Value = …`, or in EF Core configure the column with `.IsUnicode(false)`.');
  }
})();
