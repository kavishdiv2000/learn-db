(function () {
  const { h2, p, tip, note, ex, flash } = window.L;

  // Every check batch starts with this guard. If the user's code ended the sandbox
  // transaction (COMMIT/ROLLBACK), we stop instead of changing ShopDB for real.
  const GUARD = "IF @@TRANCOUNT = 0 BEGIN SELECT N'Your code ended the sandbox transaction (COMMIT/ROLLBACK), so the remaining checks were skipped' AS Test, 0 AS Pass; RETURN; END\n";

  window.LESSONS.push({
    id: 'exercises',
    group: 'Practice',
    title: 'Graded exercises',
    keywords: 'practice exercise challenge test',
    intro: 'Write the SQL, then click **Check answer**. Queries are compared with a reference result. Design, index, trigger and procedure tasks are checked by inspecting what you built. Everything runs in a sandbox.',
    blocks: [
      tip('Stuck? Use **Hint** first, and **Show solution** only after a real attempt. Your progress is saved in this browser.'),

      // ---------------------------------------------------------------- queries
      h2('Queries'),
      ex({
        id: 'q-colombo', title: '1. Customers in Colombo',
        prompt: 'Return `FullName` and `Email` of every customer whose City is Colombo, sorted by `FullName` A→Z.',
        starter: 'SELECT \nFROM dbo.Customers\n',
        solution: `SELECT FullName, Email
FROM dbo.Customers
WHERE City = N'Colombo'
ORDER BY FullName;`,
        grade: { mode: 'result', ordered: true }
      }),
      ex({
        id: 'q-status-count', title: '2. Orders per status',
        prompt: 'Return each order `Status` and the number of orders with that status (column `OrderCount`).',
        hint: 'GROUP BY Status with COUNT(*).',
        solution: `SELECT Status, COUNT(*) AS OrderCount
FROM dbo.Orders
GROUP BY Status;`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-order-count-all', title: '3. Order count for every customer',
        prompt: 'Return `FullName` and `OrderCount` for **every** customer, including customers with zero orders.',
        hint: 'LEFT JOIN, then COUNT a column from the right table (COUNT(*) would count 1 for customers without orders).',
        solution: `SELECT c.FullName, COUNT(o.OrderId) AS OrderCount
FROM dbo.Customers c
LEFT JOIN dbo.Orders o ON o.CustomerId = c.CustomerId
GROUP BY c.CustomerId, c.FullName;`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-never-ordered', title: '4. Customers who never ordered',
        prompt: 'Return `CustomerId` and `FullName` of customers who have never placed an order.',
        hint: 'NOT EXISTS, or LEFT JOIN … WHERE o.OrderId IS NULL.',
        solution: `SELECT c.CustomerId, c.FullName
FROM dbo.Customers c
WHERE NOT EXISTS (SELECT 1 FROM dbo.Orders o WHERE o.CustomerId = c.CustomerId);`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-category-revenue', title: '5. Revenue per category',
        prompt: 'Return `Category` and `Revenue` (sum of Quantity × UnitPrice) per product category, **excluding cancelled orders**, highest revenue first.',
        solution: `SELECT p.Category, SUM(oi.Quantity * oi.UnitPrice) AS Revenue
FROM dbo.OrderItems oi
JOIN dbo.Orders o   ON o.OrderId = oi.OrderId
JOIN dbo.Products p ON p.ProductId = oi.ProductId
WHERE o.Status <> 'Cancelled'
GROUP BY p.Category
ORDER BY Revenue DESC;`,
        grade: { mode: 'result', ordered: true }
      }),
      ex({
        id: 'q-laptop-mouse', title: '6. Bought both a Laptop and a Mouse',
        prompt: 'Return `CustomerId` and `FullName` of customers who have bought **both** a Laptop and a Mouse (in any orders).',
        hint: 'Filter to the two product names, GROUP BY customer, then HAVING COUNT(DISTINCT product name) = 2.',
        solution: `SELECT c.CustomerId, c.FullName
FROM dbo.Customers c
JOIN dbo.Orders o      ON o.CustomerId = c.CustomerId
JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
JOIN dbo.Products p    ON p.ProductId = oi.ProductId
WHERE p.Name IN (N'Laptop', N'Mouse')
GROUP BY c.CustomerId, c.FullName
HAVING COUNT(DISTINCT p.Name) = 2;`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-above-dept-avg', title: '7. Paid above the department average',
        prompt: 'Return `FullName`, `Department` (the department name) and `Salary` of employees who earn **more than the average salary of their own department**.',
        hint: 'AVG(Salary) OVER (PARTITION BY DepartmentId) in a CTE, or a correlated subquery.',
        solution: `WITH x AS (
    SELECT e.FullName, d.Name AS Department, e.Salary,
           AVG(e.Salary) OVER (PARTITION BY e.DepartmentId) AS DeptAvg
    FROM dbo.Employees e
    JOIN dbo.Departments d ON d.DepartmentId = e.DepartmentId
)
SELECT FullName, Department, Salary FROM x WHERE Salary > DeptAvg;`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-second-price', title: '8. Second highest price',
        prompt: 'Return the second highest **distinct** product price as a single value (one row, one column).',
        solution: `SELECT MAX(Price) AS SecondHighest
FROM dbo.Products
WHERE Price < (SELECT MAX(Price) FROM dbo.Products);`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-top-per-category', title: '9. Best seller in each category',
        prompt: 'For each category, return the product with the highest total quantity sold (all orders): `Category`, `Name`, `TotalQty`.',
        hint: 'Aggregate per product, then ROW_NUMBER() OVER (PARTITION BY Category ORDER BY SUM(Quantity) DESC) and keep rn = 1.',
        solution: `WITH s AS (
    SELECT p.Category, p.Name, SUM(oi.Quantity) AS TotalQty,
           ROW_NUMBER() OVER (PARTITION BY p.Category ORDER BY SUM(oi.Quantity) DESC) AS rn
    FROM dbo.Products p
    JOIN dbo.OrderItems oi ON oi.ProductId = p.ProductId
    GROUP BY p.Category, p.Name
)
SELECT Category, Name, TotalQty FROM s WHERE rn = 1;`,
        grade: { mode: 'result' }
      }),
      ex({
        id: 'q-running-total', title: '10. Running total of order value',
        prompt: 'Using `dbo.vw_OrderTotals`, return `OrderId`, `OrderDate`, `Total` and `RunningTotal` for **non-cancelled** orders, in order date order. RunningTotal is the cumulative sum of Total up to and including that order.',
        solution: `SELECT OrderId, OrderDate, Total,
       SUM(Total) OVER (ORDER BY OrderDate, OrderId ROWS UNBOUNDED PRECEDING) AS RunningTotal
FROM dbo.vw_OrderTotals
WHERE Status <> 'Cancelled'
ORDER BY OrderDate, OrderId;`,
        grade: { mode: 'result', ordered: true }
      }),
      ex({
        id: 'q-sargable', title: '11. Make it SARGable',
        prompt: 'This query counts December 2025 orders but cannot use an index on OrderDate:\n\n`SELECT COUNT(*) AS Orders FROM dbo.BigOrders WHERE YEAR(OrderDate) = 2025 AND MONTH(OrderDate) = 12;`\n\nRewrite it so it returns the same count **without wrapping OrderDate in any function**.',
        hint: 'A half-open range: >= the first day, < the first day of the next month.',
        starter: 'SELECT COUNT(*) AS Orders\nFROM dbo.BigOrders\nWHERE YEAR(OrderDate) = 2025 AND MONTH(OrderDate) = 12;\n',
        solution: `SELECT COUNT(*) AS Orders
FROM dbo.BigOrders
WHERE OrderDate >= '2025-12-01' AND OrderDate < '2026-01-01';`,
        explain: 'Avoid `BETWEEN \'2025-12-01\' AND \'2025-12-31\'`: with a time part it misses everything after midnight on the 31st. The half-open range `>= start AND < next start` is always correct.',
        grade: {
          mode: 'result',
          forbid: [{ re: '(YEAR|MONTH|DATEPART|DATENAME|CONVERT|CAST|FORMAT|EOMONTH)\\s*\\(\\s*OrderDate', msg: 'OrderDate is still wrapped in a function, so the predicate is not SARGable.' }],
          require: [{ re: 'OrderDate', msg: 'Filter on the OrderDate column.' }]
        }
      }),

      // ---------------------------------------------------------------- design
      h2('Design (ER → tables)'),
      ex({
        id: 'd-junction', title: '12. Many-to-many: product tags',
        prompt: `A product can have many tags ("gaming", "wireless", "office") and a tag can be on many products. Create:
- \`lab.Tag\` with \`TagId\` (primary key) and \`Name\` (unique)
- the junction table \`lab.ProductTag\` with \`ProductId\` and \`TagId\`, a **composite primary key**, and foreign keys to \`dbo.Products\` and \`lab.Tag\``,
        starter: 'CREATE TABLE lab.Tag (\n    \n);\n\nCREATE TABLE lab.ProductTag (\n    \n);\n',
        solution: `CREATE TABLE lab.Tag (
    TagId INT IDENTITY PRIMARY KEY,
    Name  NVARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE lab.ProductTag (
    ProductId INT NOT NULL REFERENCES dbo.Products(ProductId),
    TagId     INT NOT NULL REFERENCES lab.Tag(TagId),
    CONSTRAINT PK_ProductTag PRIMARY KEY (ProductId, TagId)
);`,
        grade: {
          mode: 'check', expect: 5, check: GUARD + `
SELECT N'lab.Tag exists' AS Test, CASE WHEN OBJECT_ID('lab.Tag', 'U') IS NOT NULL THEN 1 ELSE 0 END AS Pass
UNION ALL SELECT N'lab.Tag.Name is unique',
  CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i
                    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
                    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                    WHERE i.object_id = OBJECT_ID('lab.Tag') AND i.is_unique = 1 AND c.name = 'Name'
                      AND (SELECT COUNT(*) FROM sys.index_columns x WHERE x.object_id = i.object_id AND x.index_id = i.index_id AND x.is_included_column = 0) = 1)
       THEN 1 ELSE 0 END
UNION ALL SELECT N'lab.ProductTag has a 2-column primary key (ProductId, TagId)',
  CASE WHEN (SELECT COUNT(*) FROM sys.indexes i
             JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
             JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
             WHERE i.object_id = OBJECT_ID('lab.ProductTag') AND i.is_primary_key = 1 AND c.name IN ('ProductId','TagId')) = 2
        AND (SELECT COUNT(*) FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
             WHERE i.object_id = OBJECT_ID('lab.ProductTag') AND i.is_primary_key = 1) = 2
       THEN 1 ELSE 0 END
UNION ALL SELECT N'Foreign key from ProductTag to dbo.Products',
  CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('lab.ProductTag') AND referenced_object_id = OBJECT_ID('dbo.Products')) THEN 1 ELSE 0 END
UNION ALL SELECT N'Foreign key from ProductTag to lab.Tag',
  CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('lab.ProductTag') AND referenced_object_id = OBJECT_ID('lab.Tag')) THEN 1 ELSE 0 END;`
        }
      }),
      ex({
        id: 'd-one-to-one', title: '13. One-to-one: customer profile',
        prompt: 'Each customer may have **at most one** profile holding `Bio NVARCHAR(500)` and `AvatarUrl VARCHAR(300)`. Create `lab.CustomerProfile` so the database itself guarantees the 1:1 rule. It needs a `CustomerId` column referencing `dbo.Customers`.',
        hint: 'Either make CustomerId the primary key (shared PK), or give the table its own PK and add UNIQUE on CustomerId.',
        solution: `CREATE TABLE lab.CustomerProfile (
    CustomerId INT PRIMARY KEY REFERENCES dbo.Customers(CustomerId),   -- shared primary key
    Bio        NVARCHAR(500) NULL,
    AvatarUrl  VARCHAR(300)  NULL
);`,
        grade: {
          mode: 'check', expect: 3, check: GUARD + `
SELECT N'lab.CustomerProfile exists' AS Test, CASE WHEN OBJECT_ID('lab.CustomerProfile', 'U') IS NOT NULL THEN 1 ELSE 0 END AS Pass
UNION ALL SELECT N'CustomerId is a foreign key to dbo.Customers',
  CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_key_columns fkc JOIN sys.columns c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
                    WHERE fkc.parent_object_id = OBJECT_ID('lab.CustomerProfile') AND fkc.referenced_object_id = OBJECT_ID('dbo.Customers') AND c.name = 'CustomerId')
       THEN 1 ELSE 0 END
UNION ALL SELECT N'CustomerId is unique on its own (PRIMARY KEY or UNIQUE), so it is 1:1 and not 1:N',
  CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i
                    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.is_included_column = 0
                    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                    WHERE i.object_id = OBJECT_ID('lab.CustomerProfile') AND i.is_unique = 1 AND c.name = 'CustomerId'
                      AND i.has_filter = 0
                      AND (SELECT COUNT(*) FROM sys.index_columns x WHERE x.object_id = i.object_id AND x.index_id = i.index_id AND x.is_included_column = 0) = 1)
       THEN 1 ELSE 0 END;`
        }
      }),
      ex({
        id: 'd-normalize', title: '14. Normalize to 3NF',
        prompt: `A spreadsheet has the columns:

\`StudentId, StudentName, CourseCode, CourseTitle, Grade\`

StudentName depends only on StudentId, CourseTitle depends only on CourseCode, and Grade depends on the student **and** the course. Create a 3NF design in the **uni** schema:
- \`uni.Student\` (StudentId PK, StudentName)
- \`uni.Course\` (CourseCode PK, CourseTitle)
- \`uni.Grade\` (StudentId, CourseCode, Grade) with a composite PK and FKs to the other two tables. It must **not** repeat StudentName or CourseTitle.`,
        solution: `CREATE TABLE uni.Student (StudentId INT PRIMARY KEY, StudentName NVARCHAR(100) NOT NULL);
CREATE TABLE uni.Course  (CourseCode CHAR(6) PRIMARY KEY, CourseTitle NVARCHAR(100) NOT NULL);
CREATE TABLE uni.Grade (
    StudentId  INT     NOT NULL REFERENCES uni.Student(StudentId),
    CourseCode CHAR(6) NOT NULL REFERENCES uni.Course(CourseCode),
    Grade      CHAR(2) NULL,
    PRIMARY KEY (StudentId, CourseCode)
);`,
        grade: {
          mode: 'check', expect: 6, check: GUARD + `
SELECT N'uni.Student, uni.Course and uni.Grade exist' AS Test,
  CASE WHEN OBJECT_ID('uni.Student','U') IS NOT NULL AND OBJECT_ID('uni.Course','U') IS NOT NULL AND OBJECT_ID('uni.Grade','U') IS NOT NULL THEN 1 ELSE 0 END AS Pass
UNION ALL SELECT N'uni.Grade has a composite primary key (StudentId, CourseCode)',
  CASE WHEN (SELECT COUNT(*) FROM sys.indexes i JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
             JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
             WHERE i.object_id = OBJECT_ID('uni.Grade') AND i.is_primary_key = 1 AND c.name IN ('StudentId','CourseCode')) = 2 THEN 1 ELSE 0 END
UNION ALL SELECT N'uni.Grade references uni.Student',
  CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('uni.Grade') AND referenced_object_id = OBJECT_ID('uni.Student')) THEN 1 ELSE 0 END
UNION ALL SELECT N'uni.Grade references uni.Course',
  CASE WHEN EXISTS (SELECT 1 FROM sys.foreign_keys WHERE parent_object_id = OBJECT_ID('uni.Grade') AND referenced_object_id = OBJECT_ID('uni.Course')) THEN 1 ELSE 0 END
UNION ALL SELECT N'No partial dependencies: uni.Grade has no StudentName or CourseTitle column',
  CASE WHEN COL_LENGTH('uni.Grade','StudentName') IS NULL AND COL_LENGTH('uni.Grade','CourseTitle') IS NULL AND OBJECT_ID('uni.Grade','U') IS NOT NULL THEN 1 ELSE 0 END
UNION ALL SELECT N'StudentName lives in uni.Student and CourseTitle in uni.Course',
  CASE WHEN COL_LENGTH('uni.Student','StudentName') IS NOT NULL AND COL_LENGTH('uni.Course','CourseTitle') IS NOT NULL THEN 1 ELSE 0 END;`
        }
      }),

      // ---------------------------------------------------------------- indexes
      h2('Indexes'),
      ex({
        id: 'i-covering', title: '15. Cover a hot query',
        prompt: `The order-history API runs this thousands of times a minute:

\`SELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = @c AND Status = 'Paid';\`

Create **one** nonclustered index on \`dbo.BigOrders\` that lets it do a single **index seek with no key lookup**. Add the query below your index with the Plan toggle on to check.`,
        hint: 'Key columns: the two equality filters. INCLUDE: the columns you only return. OrderId comes free, because it is the clustered key.',
        starter: '-- CREATE NONCLUSTERED INDEX ...\n\nGO\nSELECT OrderId, OrderDate, Amount FROM dbo.BigOrders WHERE CustomerId = 1234 AND Status = \'Paid\';\n',
        solution: `CREATE NONCLUSTERED INDEX IX_BigOrders_Customer_Status
    ON dbo.BigOrders (CustomerId, Status)
    INCLUDE (OrderDate, Amount);`,
        grade: {
          mode: 'check', expect: 2, check: GUARD + `
;WITH c AS (
    SELECT ic.index_id, col.name, ic.key_ordinal, ic.is_included_column
    FROM sys.index_columns ic
    JOIN sys.columns col ON col.object_id = ic.object_id AND col.column_id = ic.column_id
    JOIN sys.indexes i ON i.object_id = ic.object_id AND i.index_id = ic.index_id
    WHERE ic.object_id = OBJECT_ID('dbo.BigOrders') AND i.type = 2 AND i.has_filter = 0
), k AS (
    SELECT index_id FROM c
    WHERE is_included_column = 0 AND key_ordinal IN (1, 2) AND name IN ('CustomerId', 'Status')
    GROUP BY index_id HAVING COUNT(*) = 2
), cov AS (
    SELECT k.index_id FROM k JOIN c ON c.index_id = k.index_id
    WHERE c.name IN ('OrderDate', 'Amount')
    GROUP BY k.index_id HAVING COUNT(DISTINCT c.name) = 2
)
SELECT N'A nonclustered index has CustomerId and Status as its first two key columns' AS Test,
       CASE WHEN EXISTS (SELECT 1 FROM k) THEN 1 ELSE 0 END AS Pass
UNION ALL
SELECT N'The same index also contains OrderDate and Amount (key or INCLUDE), so there is no key lookup',
       CASE WHEN EXISTS (SELECT 1 FROM cov) THEN 1 ELSE 0 END;`
        }
      }),
      ex({
        id: 'i-filtered', title: '16. Filtered index for the pending queue',
        prompt: 'A dashboard lists the oldest **Pending** orders (`WHERE Status = \'Pending\' ORDER BY OrderDate`). Only about 2% of BigOrders are pending. Create a **filtered** nonclustered index on `dbo.BigOrders` keyed on `OrderDate` that only contains pending orders.',
        solution: `CREATE NONCLUSTERED INDEX IX_BigOrders_PendingQueue
    ON dbo.BigOrders (OrderDate)
    INCLUDE (CustomerId, Amount)
    WHERE Status = 'Pending';`,
        grade: {
          mode: 'check', expect: 2, check: GUARD + `
SELECT N'A filtered index on BigOrders contains only Pending orders' AS Test,
  CASE WHEN EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.BigOrders') AND has_filter = 1 AND filter_definition LIKE '%Status%Pending%') THEN 1 ELSE 0 END AS Pass
UNION ALL
SELECT N'Its first key column is OrderDate',
  CASE WHEN EXISTS (SELECT 1 FROM sys.indexes i
                    JOIN sys.index_columns ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id AND ic.key_ordinal = 1
                    JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
                    WHERE i.object_id = OBJECT_ID('dbo.BigOrders') AND i.has_filter = 1 AND i.filter_definition LIKE '%Pending%' AND c.name = 'OrderDate')
       THEN 1 ELSE 0 END;`
        }
      }),

      // ---------------------------------------------------------------- triggers
      h2('Triggers'),
      ex({
        id: 't-no-unship', title: '17. Shipped orders can\'t go back to Pending',
        prompt: 'Create an `AFTER UPDATE` trigger on `dbo.Orders` that **rejects** any update changing an order from `Shipped` to `Pending` (raise an error with THROW). Other status changes must still work. It must handle **multi-row** updates.',
        hint: 'JOIN inserted to deleted on OrderId, look for d.Status = \'Shipped\' AND i.Status = \'Pending\', and THROW if any row matches.',
        starter: 'CREATE TRIGGER trg_Orders_NoUnship ON dbo.Orders\nAFTER UPDATE\nAS\nBEGIN\n    SET NOCOUNT ON;\n    \nEND;\n',
        solution: `CREATE TRIGGER trg_Orders_NoUnship ON dbo.Orders
AFTER UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (SELECT 1
               FROM inserted i
               JOIN deleted d ON d.OrderId = i.OrderId
               WHERE d.Status = 'Shipped' AND i.Status = 'Pending')
        THROW 50020, 'A shipped order cannot be moved back to Pending.', 1;
END;`,
        grade: {
          mode: 'check', expect: 3, check: GUARD + `
SELECT N'An AFTER UPDATE trigger exists on dbo.Orders' AS Test,
  CASE WHEN EXISTS (SELECT 1 FROM sys.triggers t JOIN sys.trigger_events e ON e.object_id = t.object_id
                    WHERE t.parent_id = OBJECT_ID('dbo.Orders') AND e.type_desc = 'UPDATE') THEN 1 ELSE 0 END AS Pass;
GO
${GUARD}BEGIN TRY
    UPDATE dbo.Orders SET Status = 'Paid' WHERE OrderId IN (3, 10);      -- Pending -> Paid (2 rows)
    SELECT N'Pending -> Paid still works (2 rows at once)' AS Test,
           CASE WHEN (SELECT COUNT(*) FROM dbo.Orders WHERE OrderId IN (3, 10) AND Status = 'Paid') = 2 THEN 1 ELSE 0 END AS Pass;
END TRY
BEGIN CATCH
    SELECT N'Pending -> Paid still works (it raised: ' + ERROR_MESSAGE() + N')' AS Test, 0 AS Pass;
END CATCH;
GO
${GUARD}BEGIN TRY
    UPDATE dbo.Orders SET Status = 'Pending' WHERE OrderId IN (1, 5, 3);  -- two Shipped + one Paid, in one statement
    SELECT N'Shipped -> Pending is rejected in a multi-row update' AS Test,
           CASE WHEN (SELECT COUNT(*) FROM dbo.Orders WHERE OrderId IN (1, 5) AND Status = 'Shipped') = 2 THEN 1 ELSE 0 END AS Pass;
END TRY
BEGIN CATCH
    SELECT N'Shipped -> Pending is rejected in a multi-row update (error raised: ' + ERROR_MESSAGE() + N')' AS Test,
           CASE WHEN ERROR_NUMBER() IN (3609, 266) OR ERROR_NUMBER() >= 50000 THEN 1 ELSE 0 END AS Pass;
END CATCH;`
        }
      }),

      // ---------------------------------------------------------------- procedures
      h2('Stored procedures'),
      ex({
        id: 'p-summary', title: '18. Customer summary procedure',
        prompt: 'Create `lab.usp_CustomerSummary @CustomerId INT` that returns **one row** with `FullName`, `OrderCount` and `TotalSpend`, counting only **non-cancelled** orders. A customer with no orders must return `0` and `0`, not NULL.',
        hint: 'Start FROM dbo.Customers and LEFT JOIN the orders and items. Use COUNT(DISTINCT o.OrderId) and ISNULL(SUM(...), 0). Put the Cancelled filter in the ON clause.',
        starter: 'CREATE PROCEDURE lab.usp_CustomerSummary\n    @CustomerId INT\nAS\nBEGIN\n    SET NOCOUNT ON;\n    \nEND;\nGO\nEXEC lab.usp_CustomerSummary @CustomerId = 1;\n',
        solution: `CREATE PROCEDURE lab.usp_CustomerSummary
    @CustomerId INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.FullName,
           COUNT(DISTINCT o.OrderId)                   AS OrderCount,
           ISNULL(SUM(oi.Quantity * oi.UnitPrice), 0)  AS TotalSpend
    FROM dbo.Customers c
    LEFT JOIN dbo.Orders o      ON o.CustomerId = c.CustomerId AND o.Status <> 'Cancelled'
    LEFT JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
    WHERE c.CustomerId = @CustomerId
    GROUP BY c.FullName;
END;`,
        grade: {
          mode: 'check', expect: 4, check: GUARD + `
IF OBJECT_ID('lab.usp_CustomerSummary', 'P') IS NULL
BEGIN SELECT N'Procedure lab.usp_CustomerSummary exists' AS Test, 0 AS Pass; RETURN; END;
DECLARE @r TABLE (n INT IDENTITY, FullName NVARCHAR(100), OrderCount INT, TotalSpend DECIMAL(18,2));
BEGIN TRY
    INSERT INTO @r (FullName, OrderCount, TotalSpend) EXEC lab.usp_CustomerSummary @CustomerId = 2;
    INSERT INTO @r (FullName, OrderCount, TotalSpend) EXEC lab.usp_CustomerSummary @CustomerId = 4;
END TRY
BEGIN CATCH
    SELECT N'Returns exactly 3 columns: FullName, OrderCount, TotalSpend (' + ERROR_MESSAGE() + N')' AS Test, 0 AS Pass; RETURN;
END CATCH;
DECLARE @cnt INT, @sum DECIMAL(18,2);
SELECT @cnt = COUNT(DISTINCT o.OrderId), @sum = SUM(oi.Quantity * oi.UnitPrice)
FROM dbo.Orders o JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
WHERE o.CustomerId = 2 AND o.Status <> 'Cancelled';
SELECT N'Returns one row per call' AS Test, CASE WHEN (SELECT COUNT(*) FROM @r) = 2 THEN 1 ELSE 0 END AS Pass
UNION ALL SELECT N'Customer 2 (Kumari): OrderCount excludes the cancelled order',
    CASE WHEN EXISTS (SELECT 1 FROM @r WHERE FullName = N'Kumari Silva' AND OrderCount = @cnt) THEN 1 ELSE 0 END
UNION ALL SELECT N'Customer 2 (Kumari): TotalSpend is correct',
    CASE WHEN EXISTS (SELECT 1 FROM @r WHERE FullName = N'Kumari Silva' AND TotalSpend = @sum) THEN 1 ELSE 0 END
UNION ALL SELECT N'Customer 4 (no orders) returns 0 orders and 0 spend, not NULL or no row',
    CASE WHEN EXISTS (SELECT 1 FROM @r WHERE FullName = N'Ayesha Khan' AND OrderCount = 0 AND TotalSpend = 0) THEN 1 ELSE 0 END;`
        }
      }),
      ex({
        id: 'p-transfer', title: '19. Safe money transfer',
        prompt: 'Create `lab.usp_Transfer @FromAccountId INT, @ToAccountId INT, @Amount DECIMAL(18,2)` that moves money between rows of `dbo.Accounts` **atomically**. If the source doesn\'t have enough money, it must raise an error and change **nothing**.',
        hint: 'SET XACT_ABORT ON; BEGIN TRY / BEGIN TRAN / check the balance / two UPDATEs / COMMIT; END TRY BEGIN CATCH IF @@TRANCOUNT > 0 ROLLBACK; THROW; END CATCH',
        starter: 'CREATE PROCEDURE lab.usp_Transfer\n    @FromAccountId INT,\n    @ToAccountId   INT,\n    @Amount        DECIMAL(18,2)\nAS\nBEGIN\n    SET NOCOUNT ON;\n    \nEND;\n',
        solution: `CREATE PROCEDURE lab.usp_Transfer
    @FromAccountId INT,
    @ToAccountId   INT,
    @Amount        DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;
    BEGIN TRY
        IF @Amount <= 0 THROW 50030, 'Amount must be positive.', 1;
        BEGIN TRAN;
            UPDATE dbo.Accounts SET Balance = Balance - @Amount
            WHERE AccountId = @FromAccountId AND Balance >= @Amount;
            IF @@ROWCOUNT = 0 THROW 50031, 'Insufficient funds or unknown account.', 1;

            UPDATE dbo.Accounts SET Balance = Balance + @Amount WHERE AccountId = @ToAccountId;
            IF @@ROWCOUNT = 0 THROW 50032, 'Unknown destination account.', 1;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        THROW;
    END CATCH
END;`,
        explain: 'The debit `UPDATE … WHERE Balance >= @Amount` checks the balance and changes it in **one atomic statement**, so two simultaneous transfers cannot both pass a separate SELECT check (a race condition).',
        grade: {
          mode: 'check', expect: 4, check: GUARD + `
IF OBJECT_ID('lab.usp_Transfer', 'P') IS NULL
BEGIN SELECT N'Procedure lab.usp_Transfer exists' AS Test, 0 AS Pass; RETURN; END;
BEGIN TRY
    EXEC lab.usp_Transfer @FromAccountId = 1, @ToAccountId = 2, @Amount = 5000;
    SELECT N'Valid transfer of 5,000 from account 1 to 2 updates both balances' AS Test,
           CASE WHEN (SELECT Balance FROM dbo.Accounts WHERE AccountId = 1) = 45000
                 AND (SELECT Balance FROM dbo.Accounts WHERE AccountId = 2) = 25000 THEN 1 ELSE 0 END AS Pass;
END TRY
BEGIN CATCH
    SELECT N'Valid transfer of 5,000 works (it raised: ' + ERROR_MESSAGE() + N')' AS Test, 0 AS Pass;
END CATCH;
GO
${GUARD}DECLARE @before DECIMAL(18,2) = (SELECT SUM(Balance) FROM dbo.Accounts), @raised INT = 0;
BEGIN TRY
    EXEC lab.usp_Transfer @FromAccountId = 3, @ToAccountId = 1, @Amount = 1000;   -- account 3 has 0
END TRY
BEGIN CATCH
    SET @raised = 1;
END CATCH;
SELECT N'Insufficient funds raises an error' AS Test, @raised AS Pass
UNION ALL SELECT N'No money is created or lost', CASE WHEN (SELECT SUM(Balance) FROM dbo.Accounts) = @before THEN 1 ELSE 0 END
UNION ALL SELECT N'Account 3 is not overdrawn', CASE WHEN (SELECT Balance FROM dbo.Accounts WHERE AccountId = 3) >= 0 THEN 1 ELSE 0 END;`
        }
      })
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'interview',
    group: 'Practice',
    title: 'Interview questions',
    keywords: 'interview questions flashcards answers',
    intro: 'Say each answer out loud first, then click the card to compare. The answers are short on purpose: lead with a crisp definition, then give an example.',
    blocks: [
      h2('Fundamentals & design'),
      flash([
        { q: 'DDL vs DML vs DCL vs TCL?', a: 'DDL defines structure (CREATE, ALTER, DROP, TRUNCATE). DML works with rows (SELECT, INSERT, UPDATE, DELETE, MERGE). DCL handles permissions (GRANT, REVOKE, DENY). TCL controls transactions (BEGIN TRAN, COMMIT, ROLLBACK, SAVE).' },
        { q: 'Primary key vs unique key?', a: 'PK: unique, NOT NULL, one per table, clustered index by default. UNIQUE: allows one NULL in SQL Server, many per table, nonclustered by default.' },
        { q: 'What is a foreign key? What do ON DELETE CASCADE / SET NULL do?', a: 'A column whose value must exist as a PK or unique value in the referenced table (referential integrity). CASCADE deletes child rows with the parent. SET NULL sets the FK to NULL. NO ACTION (the default) blocks the delete.' },
        { q: 'Candidate, super, composite, surrogate and natural keys?', a: 'Super key: any unique column set. Candidate key: a minimal super key. Composite: more than one column. Surrogate: an artificial ID (IDENTITY/GUID). Natural: a real-world unique value (NIC, ISBN).' },
        { q: 'How do you implement a many-to-many relationship?', a: 'With a junction (bridge) table holding both FKs, usually with a composite PK (A_Id, B_Id). Attributes of the relationship (grade, quantity, role) go in the junction table.' },
        { q: 'How do you implement one-to-one?', a: 'Put an FK on the dependent table and make it UNIQUE, or use a shared primary key (the child\'s PK is also the FK). Used to split optional, large or sensitive columns.' },
        { q: 'Explain 1NF, 2NF, 3NF.', a: '1NF: atomic values, no repeating groups, a PK. 2NF: 1NF + no partial dependency on part of a composite key. 3NF: 2NF + no transitive dependency (non-key column depending on another non-key column). "The key, the whole key, and nothing but the key."' },
        { q: 'What is BCNF?', a: 'Every determinant (left side of a functional dependency) must be a candidate key. It is a stricter 3NF that matters with overlapping candidate keys.' },
        { q: 'When would you denormalize?', a: 'For a measured read-performance need: reporting or data-warehouse tables, stored totals, indexed views or caches. You accept the cost of keeping the copies in sync.' },
        { q: 'What are update, insert and delete anomalies?', a: 'Problems caused by duplicated data: updating a fact in one place but not another, being unable to insert a fact without unrelated data, and losing a fact when deleting an unrelated row.' },
        { q: 'CHAR vs VARCHAR vs NVARCHAR?', a: 'CHAR: fixed length, padded. VARCHAR: variable length, 1 byte per character. NVARCHAR: variable-length Unicode, 2 bytes per character, needed for Sinhala or Tamil text. Prefix literals with N.' },
        { q: 'What is a weak entity?', a: 'An entity that cannot be identified without its owner. Its PK includes the owner\'s key, e.g. OrderLine (OrderId, LineNo).' }
      ]),
      h2('Querying'),
      flash([
        { q: 'WHERE vs HAVING?', a: 'WHERE filters rows before grouping. HAVING filters groups after aggregation, so it can use aggregates like SUM(x) > 100.' },
        { q: 'Logical order of a SELECT?', a: 'FROM/JOIN → WHERE → GROUP BY → HAVING → SELECT → DISTINCT → ORDER BY → TOP/OFFSET. That is why aliases work in ORDER BY but not in WHERE.' },
        { q: 'INNER vs LEFT vs FULL vs CROSS JOIN?', a: 'INNER: matching rows only. LEFT: all left rows, plus matches or NULLs. FULL: all rows from both sides. CROSS: every combination.' },
        { q: 'DELETE vs TRUNCATE vs DROP?', a: 'DELETE: DML, row by row, WHERE allowed, fires triggers, keeps the identity value. TRUNCATE: DDL, deallocates pages, minimal logging, resets identity, no triggers, blocked by referencing FKs. DROP removes the table itself. All three can be rolled back inside a transaction in SQL Server.' },
        { q: 'UNION vs UNION ALL?', a: 'UNION removes duplicates (an extra sort or hash). UNION ALL keeps every row and is faster. Use UNION ALL unless you need de-duplication.' },
        { q: 'Why can NOT IN return no rows?', a: 'If the subquery returns a NULL, `x NOT IN (…, NULL)` is never TRUE. Use NOT EXISTS.' },
        { q: 'ROW_NUMBER vs RANK vs DENSE_RANK?', a: 'For tied values: ROW_NUMBER gives 1,2,3,4. RANK gives 1,2,2,4 (with gaps). DENSE_RANK gives 1,2,2,3 (no gaps).' },
        { q: 'How do you get the top N rows per group?', a: 'ROW_NUMBER() OVER (PARTITION BY group ORDER BY metric DESC) in a CTE and filter rn <= N, or CROSS APPLY (SELECT TOP N …). Support it with an index on (group, metric).' },
        { q: 'What is a CTE? When would you use a temp table instead?', a: 'A CTE is a named result set for one statement, inlined like a view, and it supports recursion. Use a #temp table for large intermediate results that are reused or need indexes and statistics.' },
        { q: 'Temp table vs table variable?', a: '#temp: in tempdb, has statistics, any index, affected by rollback. @table: limited statistics, best for small sets, NOT affected by rollback.' },
        { q: 'How do you find duplicates? Delete them?', a: 'GROUP BY the key columns with HAVING COUNT(*) > 1. To delete: ROW_NUMBER() OVER (PARTITION BY key ORDER BY Id) in a CTE, then DELETE WHERE rn > 1.' },
        { q: 'What does COALESCE do vs ISNULL?', a: 'Both replace NULL. COALESCE is ANSI-standard and takes many arguments. ISNULL is T-SQL, takes two, and returns the first argument\'s data type.' }
      ]),
      h2('Indexes'),
      flash([
        { q: 'Clustered vs nonclustered index?', a: 'Clustered: the table itself, sorted by the key. The leaf level holds the data rows. One per table. Nonclustered: a separate B-tree of the key columns plus a pointer (the clustered key or a RID). Up to 999 per table.' },
        { q: 'Why only one clustered index per table?', a: 'It defines the physical order of the rows, and rows can be stored in only one order.' },
        { q: 'What is a covering index? What is INCLUDE for?', a: 'An index containing every column a query needs, so no key lookup is required. INCLUDE adds columns at the leaf level only. They are not part of the key, so they do not widen the B-tree.' },
        { q: 'Index seek vs scan vs key lookup?', a: 'Seek: navigates the B-tree to matching rows. Scan: reads every leaf page. Key lookup: an extra trip to the clustered index per row, for columns missing from the nonclustered index.' },
        { q: 'Does column order in a composite index matter?', a: 'Yes. The index is sorted by the first column, then the second. It can seek only on a left-most prefix. Put equality columns first, then range or sort columns.' },
        { q: 'Why might SQL Server not use your index?', a: 'Low selectivity (the tipping point), a non-SARGable predicate, an implicit conversion, stale statistics, or the index not leading with the filtered column.' },
        { q: 'What is a filtered index?', a: 'A nonclustered index with a WHERE clause, covering a subset of rows (e.g. Status = \'Pending\'). It is smaller and cheaper. It can also enforce "unique where not null".' },
        { q: 'When would you use a columnstore index?', a: 'For analytics and aggregates over millions of rows. It stores columns separately, compresses them heavily and runs in batch mode. Not for single-row lookups.' },
        { q: 'How do indexes hurt?', a: 'Every INSERT, UPDATE and DELETE must maintain every index. They use disk and memory. Too many overlapping indexes slow down OLTP writes.' },
        { q: 'REBUILD vs REORGANIZE?', a: 'REORGANIZE defragments the leaf level in place. It is light and always online (traditionally used at 5–30% fragmentation). REBUILD recreates the index and updates its statistics (>30%). It can run ONLINE on Enterprise/Developer editions.' },
        { q: 'What makes a good clustered key?', a: 'Narrow, unique, static and ever-increasing (INT/BIGINT IDENTITY). Random GUIDs cause page splits and fragmentation.' },
        { q: 'Heap vs clustered table?', a: 'A heap has no clustered index, so rows are unordered and found via RIDs. A clustered table is stored in key order. Most OLTP tables should be clustered.' }
      ]),
      h2('Triggers, procedures, transactions'),
      flash([
        { q: 'What are the inserted and deleted tables?', a: 'Virtual tables available inside a trigger. INSERT: inserted = new rows. DELETE: deleted = old rows. UPDATE: deleted = before, inserted = after.' },
        { q: 'AFTER vs INSTEAD OF trigger?', a: 'AFTER runs once the statement and its constraints have succeeded (audit, sync). INSTEAD OF replaces the statement (soft delete, updatable views).' },
        { q: 'Does a trigger fire per row?', a: 'No, once per statement. Write set-based code that joins to inserted and deleted. Never assign them to scalar variables.' },
        { q: 'Trigger pros and cons?', a: 'Pros: enforced for every writer, good for auditing, same transaction. Cons: hidden logic, harder debugging, slower writes, longer locks, cascading. Alternatives: constraints, procedures, temporal tables, CDC.' },
        { q: 'Advantages of stored procedures?', a: 'Plan reuse, security (EXECUTE-only permission), protection from SQL injection through parameters, less network traffic, one place for logic.' },
        { q: 'Stored procedure vs function?', a: 'A procedure can change data, use transactions and TRY/CATCH, return several result sets and OUTPUT params, and runs with EXEC. A function returns a scalar or a table, can be used in SELECT/WHERE/JOIN, and cannot change table data.' },
        { q: 'SCOPE_IDENTITY vs @@IDENTITY vs IDENT_CURRENT?', a: 'SCOPE_IDENTITY: the last identity in your scope and session (the safe one). @@IDENTITY: any scope in your session, so it can return a trigger\'s insert. IDENT_CURRENT(\'t\'): the last value for a table from any session.' },
        { q: 'THROW vs RAISERROR?', a: 'THROW (2012+) re-raises the original error, always aborts the batch, and needs a preceding semicolon. RAISERROR is older, supports formatting and severities, and doesn\'t abort by default.' },
        { q: 'What is ACID?', a: 'Atomicity (all or nothing), Consistency (constraints hold), Isolation (concurrent transactions don\'t interfere), Durability (committed data survives a crash, through the transaction log).' },
        { q: 'Isolation levels in SQL Server?', a: 'READ UNCOMMITTED, READ COMMITTED (the default), REPEATABLE READ, SERIALIZABLE, plus SNAPSHOT and READ COMMITTED SNAPSHOT (row versioning: readers don\'t block writers).' },
        { q: 'What is a deadlock and how do you reduce them?', a: 'Two sessions each hold a lock the other needs. SQL Server kills one (error 1205). Reduce them with a consistent access order, short transactions, good indexes, snapshot isolation, and a retry on 1205.' },
        { q: 'Why is NOLOCK risky?', a: 'It means READ UNCOMMITTED: dirty reads, plus skipped or double-read rows during page splits, so totals can be wrong. Prefer RCSI or SNAPSHOT.' },
        { q: 'What does SET XACT_ABORT ON do?', a: 'Any runtime error rolls back the whole transaction and aborts the batch. This is recommended in procedures with explicit transactions.' },
        { q: 'How do you prevent SQL injection?', a: 'Parameterize everything (SqlParameter, sp_executesql with parameters, EF/Dapper parameters). Never concatenate input. Use QUOTENAME and a whitelist for dynamic identifiers. Use least-privilege logins.' }
      ]),
      h2('Optimization'),
      flash([
        { q: 'A query went from 1 s to 30 s. How do you investigate?', a: 'Measure first: Query Store or DMVs to find it, then STATISTICS IO/TIME and the actual plan. Look for scans, lookups, sorts, spills, estimate-vs-actual gaps and plan changes (parameter sniffing, stale statistics). Fix the biggest cost and measure again.' },
        { q: 'What does SARGable mean? Give examples.', a: 'The predicate can use an index seek. These are non-SARGable: YEAR(Date) = 2026, LIKE \'%x\', Col * 1.1 > 5, ISNULL(Col, \'\') = \'x\', implicit conversions. Rewrite them so the column stands alone, e.g. as a date range.' },
        { q: 'What is parameter sniffing? Fixes?', a: 'The cached plan was compiled for the first parameter values and is reused for very different ones. Fixes: OPTION (RECOMPILE), OPTIMIZE FOR, a covering index, Query Store plan forcing, splitting procedures, or PSP optimization in 2022+.' },
        { q: 'What are statistics?', a: 'Histograms of data distribution that the optimizer uses to estimate row counts. Stale statistics give bad estimates and bad plans. Run UPDATE STATISTICS after large changes.' },
        { q: 'Estimated vs actual execution plan?', a: 'Estimated: what the optimizer plans to do, without running the query. Actual: what really happened, with actual row counts. Compare estimated and actual rows to spot bad estimates.' },
        { q: 'Why avoid SELECT *?', a: 'It reads extra columns, cannot be covered by an index (so key lookups or scans), sends more data over the network, and breaks code when the schema changes.' },
        { q: 'Why are cursors slow?', a: 'They process one row at a time, so N statements, N round-trips through the engine, and long-held locks. A set-based statement does it in one pass.' },
        { q: 'What is lock escalation?', a: 'SQL Server swaps many row or page locks (about 5,000) for one table lock to save memory, which blocks other users. Batch large changes to stay under the threshold.' },
        { q: 'What is Query Store?', a: 'A database feature that records query plans and runtime statistics over time. Use it to find regressions and force a known-good plan.' },
        { q: 'EXISTS vs IN vs JOIN?', a: 'EXISTS stops at the first match and is NULL-safe. It is usually the best choice for "has any". IN is fine for small, non-NULL lists. A JOIN can duplicate rows when the right side has many matches.' }
      ]),
      note('Practise talking through **one real example from your own work**, e.g. *"In my project the API generated a query through EF Core that did a key lookup per row. I added an INCLUDE index and the endpoint went from X ms to Y ms."* A concrete story beats a textbook definition.', 'Final tip')
    ]
  });
})();
