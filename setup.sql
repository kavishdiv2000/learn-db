/* =====================================================================
   SQL Lab – practice database
   Creates (or resets) ShopDB with:
     - small tables for learning queries (Customers, Products, Orders, OrderItems...)
     - HR tables for self-joins / recursive CTEs (Departments, Employees)
     - Accounts for transaction demos
     - BigOrders (300,000 rows, no secondary indexes) for index / optimization demos
     - empty schemas uni, hosp, lib, food for ER-modelling exercises
   Safe to run again: it drops and rebuilds everything.
   ===================================================================== */
USE master;
GO
IF DB_ID('ShopDB') IS NULL
    CREATE DATABASE ShopDB;
GO
USE ShopDB;
GO
ALTER DATABASE ShopDB SET RECOVERY SIMPLE;
GO

/* ---------- drop everything this script creates (reverse dependency order) ---------- */
IF EXISTS (SELECT 1 FROM sys.triggers WHERE parent_class = 0)
BEGIN
    DECLARE @ddl NVARCHAR(MAX) = N'';
    SELECT @ddl += N'DROP TRIGGER ' + QUOTENAME(name) + N' ON DATABASE;' FROM sys.triggers WHERE parent_class = 0;
    EXEC sp_executesql @ddl;
END;
GO
DECLARE @sql NVARCHAR(MAX) = N'';
-- triggers on tables
SELECT @sql += N'DROP TRIGGER ' + QUOTENAME(SCHEMA_NAME(o.schema_id)) + N'.' + QUOTENAME(t.name) + N';'
FROM sys.triggers t JOIN sys.objects o ON o.object_id = t.parent_id WHERE t.parent_class = 1;
-- procedures, functions, views
SELECT @sql += N'DROP ' + CASE type WHEN 'P' THEN N'PROCEDURE ' WHEN 'V' THEN N'VIEW '
                ELSE N'FUNCTION ' END + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
FROM sys.objects WHERE type IN ('P','V','FN','IF','TF') AND is_ms_shipped = 0;
-- foreign keys
SELECT @sql += N'ALTER TABLE ' + QUOTENAME(SCHEMA_NAME(t.schema_id)) + N'.' + QUOTENAME(t.name)
             + N' DROP CONSTRAINT ' + QUOTENAME(f.name) + N';'
FROM sys.foreign_keys f JOIN sys.tables t ON t.object_id = f.parent_object_id;
-- tables
SELECT @sql += N'DROP TABLE ' + QUOTENAME(SCHEMA_NAME(schema_id)) + N'.' + QUOTENAME(name) + N';'
FROM sys.tables WHERE is_ms_shipped = 0;
EXEC sp_executesql @sql;
GO
IF SCHEMA_ID('uni')  IS NULL EXEC('CREATE SCHEMA uni');
IF SCHEMA_ID('hosp') IS NULL EXEC('CREATE SCHEMA hosp');
IF SCHEMA_ID('lib')  IS NULL EXEC('CREATE SCHEMA lib');
IF SCHEMA_ID('food') IS NULL EXEC('CREATE SCHEMA food');
IF SCHEMA_ID('lab')  IS NULL EXEC('CREATE SCHEMA lab');
GO

/* ---------- core e-commerce tables ---------- */
CREATE TABLE dbo.Customers (
    CustomerId   INT IDENTITY(1,1) CONSTRAINT PK_Customers PRIMARY KEY,
    FullName     NVARCHAR(100) NOT NULL,
    Email        VARCHAR(150)  NOT NULL CONSTRAINT UQ_Customers_Email UNIQUE,
    City         NVARCHAR(50)  NULL,
    CreatedAt    DATETIME2(0)  NOT NULL CONSTRAINT DF_Customers_CreatedAt DEFAULT SYSUTCDATETIME()
);

CREATE TABLE dbo.Products (
    ProductId    INT IDENTITY(1,1) CONSTRAINT PK_Products PRIMARY KEY,
    Name         NVARCHAR(100) NOT NULL,
    Category     NVARCHAR(50)  NOT NULL,
    Price        DECIMAL(18,2) NOT NULL CONSTRAINT CK_Products_Price CHECK (Price >= 0),
    StockQty     INT           NOT NULL CONSTRAINT DF_Products_Stock DEFAULT 0
);

CREATE TABLE dbo.Orders (
    OrderId      INT IDENTITY(1,1) CONSTRAINT PK_Orders PRIMARY KEY,
    CustomerId   INT NOT NULL CONSTRAINT FK_Orders_Customers REFERENCES dbo.Customers(CustomerId),
    OrderDate    DATETIME2(0) NOT NULL CONSTRAINT DF_Orders_OrderDate DEFAULT SYSUTCDATETIME(),
    Status       VARCHAR(20) NOT NULL CONSTRAINT DF_Orders_Status DEFAULT 'Pending'
                 CONSTRAINT CK_Orders_Status CHECK (Status IN ('Pending','Paid','Shipped','Cancelled'))
);

CREATE TABLE dbo.OrderItems (
    OrderId      INT NOT NULL CONSTRAINT FK_OrderItems_Orders REFERENCES dbo.Orders(OrderId),
    ProductId    INT NOT NULL CONSTRAINT FK_OrderItems_Products REFERENCES dbo.Products(ProductId),
    Quantity     INT NOT NULL CONSTRAINT CK_OrderItems_Qty CHECK (Quantity > 0),
    UnitPrice    DECIMAL(18,2) NOT NULL,
    CONSTRAINT PK_OrderItems PRIMARY KEY (OrderId, ProductId)
);

CREATE TABLE dbo.ProductStaging (
    Name      NVARCHAR(100) NOT NULL,
    Category  NVARCHAR(50)  NOT NULL,
    Price     DECIMAL(18,2) NOT NULL,
    StockQty  INT           NOT NULL
);

INSERT INTO dbo.Customers (FullName, Email, City, CreatedAt) VALUES
 (N'Nimal Perera',     'nimal@mail.com',    N'Colombo',  '2025-01-10'),
 (N'Kumari Silva',     'kumari@mail.com',   N'Kandy',    '2025-02-14'),
 (N'Ruwan Fernando',   'ruwan@mail.com',    N'Galle',    '2025-03-03'),
 (N'Ayesha Khan',      'ayesha@mail.com',   NULL,        '2025-03-21'),
 (N'Dilan Jayasuriya', 'dilan@mail.com',    N'Colombo',  '2025-05-02'),
 (N'Shehani de Mel',   'shehani@mail.com',  N'Negombo',  '2025-06-18'),
 (N'Tharindu Bandara', 'tharindu@mail.com', N'Kandy',    '2025-08-09'),
 (N'Priya Rajan',      'priya@mail.com',    N'Jaffna',   '2025-09-30'),
 (N'Kasun Wickrama',   'kasun@mail.com',    N'Colombo',  '2026-01-12'),
 (N'Malini Herath',    'malini@mail.com',   N'Galle',    '2026-02-20');

INSERT INTO dbo.Products (Name, Category, Price, StockQty) VALUES
 (N'Laptop',      N'Electronics', 250000, 10),
 (N'Mouse',       N'Electronics',   3500, 100),
 (N'Keyboard',    N'Electronics',   6500, 50),
 (N'Monitor',     N'Electronics',  65000, 15),
 (N'Headphones',  N'Electronics',  18000, 30),
 (N'Desk',        N'Furniture',    45000, 5),
 (N'Chair',       N'Furniture',    22000, 0),
 (N'Bookshelf',   N'Furniture',    30000, 8),
 (N'Notebook',    N'Stationery',     450, 500),
 (N'Pen Set',     N'Stationery',    1200, 200);

INSERT INTO dbo.Orders (CustomerId, OrderDate, Status) VALUES
 (1,'2026-01-05','Shipped'), (1,'2026-02-11','Paid'),     (2,'2026-02-15','Pending'),
 (3,'2026-03-01','Paid'),    (5,'2026-03-09','Shipped'),  (2,'2026-04-02','Cancelled'),
 (6,'2026-04-18','Paid'),    (7,'2026-05-05','Shipped'),  (1,'2026-05-22','Paid'),
 (9,'2026-06-14','Pending'), (5,'2026-07-01','Paid'),     (8,'2026-07-19','Shipped'),
 (3,'2026-08-08','Paid'),    (10,'2026-09-02','Pending'), (6,'2026-10-10','Shipped');

INSERT INTO dbo.OrderItems (OrderId, ProductId, Quantity, UnitPrice) VALUES
 (1,1,1,250000),(1,2,2,3500),
 (2,6,1,45000),(2,7,2,22000),
 (3,2,1,3500),(3,9,10,450),
 (4,1,1,250000),(4,4,2,65000),
 (5,5,1,18000),(5,3,1,6500),
 (6,8,1,30000),
 (7,2,3,3500),(7,10,2,1200),
 (8,4,1,65000),
 (9,9,20,450),(9,10,1,1200),
 (10,1,1,250000),
 (11,6,1,45000),(11,2,1,3500),
 (12,5,2,18000),
 (13,3,2,6500),(13,2,2,3500),
 (14,8,2,30000),
 (15,4,1,65000),(15,5,1,18000);

INSERT INTO dbo.ProductStaging (Name, Category, Price, StockQty) VALUES
 (N'Mouse', N'Electronics', 3200, 150),      -- existing product, new price + stock
 (N'Webcam', N'Electronics', 12000, 25),     -- new product
 (N'Desk Lamp', N'Furniture', 5500, 40);     -- new product
GO

CREATE VIEW dbo.vw_OrderTotals AS
SELECT o.OrderId, o.CustomerId, o.OrderDate, o.Status, SUM(oi.Quantity * oi.UnitPrice) AS Total
FROM dbo.Orders o
JOIN dbo.OrderItems oi ON oi.OrderId = o.OrderId
GROUP BY o.OrderId, o.CustomerId, o.OrderDate, o.Status;
GO

/* ---------- HR tables (self-referencing relationship) ---------- */
CREATE TABLE dbo.Departments (
    DepartmentId INT IDENTITY(1,1) CONSTRAINT PK_Departments PRIMARY KEY,
    Name         NVARCHAR(50) NOT NULL CONSTRAINT UQ_Departments_Name UNIQUE
);
CREATE TABLE dbo.Employees (
    EmployeeId   INT IDENTITY(1,1) CONSTRAINT PK_Employees PRIMARY KEY,
    FullName     NVARCHAR(100) NOT NULL,
    Title        NVARCHAR(60)  NOT NULL,
    DepartmentId INT NULL CONSTRAINT FK_Employees_Departments REFERENCES dbo.Departments(DepartmentId),
    ManagerId    INT NULL CONSTRAINT FK_Employees_Manager REFERENCES dbo.Employees(EmployeeId),
    Salary       DECIMAL(18,2) NOT NULL,
    HireDate     DATE NOT NULL
);
INSERT INTO dbo.Departments (Name) VALUES (N'Engineering'), (N'Sales'), (N'Finance'), (N'HR');
INSERT INTO dbo.Employees (FullName, Title, DepartmentId, ManagerId, Salary, HireDate) VALUES
 (N'Anura Senanayake', N'CEO',                 NULL, NULL, 1200000, '2015-01-01'),
 (N'Chamari Atapattu', N'Head of Engineering', 1,    1,     850000, '2016-03-15'),
 (N'Lahiru Gamage',    N'Head of Sales',       2,    1,     700000, '2017-06-01'),
 (N'Sanduni Peiris',   N'Finance Manager',     3,    1,     650000, '2018-02-10'),
 (N'Isuru Udana',      N'Senior Engineer',     1,    2,     520000, '2019-09-01'),
 (N'Hasini Ranasinghe',N'Software Engineer',   1,    5,     380000, '2022-01-17'),
 (N'Yasith Mendis',    N'Software Engineer',   1,    5,     380000, '2023-07-03'),
 (N'Nadeesha Kumari',  N'Associate Engineer',  1,    5,     260000, '2025-06-02'),
 (N'Pradeep Silva',    N'Sales Executive',     2,    3,     300000, '2020-04-20'),
 (N'Oshadi Fernando',  N'Sales Executive',     2,    3,     310000, '2021-11-11'),
 (N'Kamal Dias',       N'Accountant',          3,    4,     340000, '2019-12-01'),
 (N'Ruwani Jayawardena',N'HR Executive',       4,    1,     290000, '2020-08-15');
GO

/* ---------- Accounts (transaction demos) ---------- */
CREATE TABLE dbo.Accounts (
    AccountId  INT CONSTRAINT PK_Accounts PRIMARY KEY,
    Owner      NVARCHAR(100) NOT NULL,
    Balance    DECIMAL(18,2) NOT NULL CONSTRAINT CK_Accounts_Balance CHECK (Balance >= 0)
);
INSERT INTO dbo.Accounts VALUES (1, N'Nimal Perera', 50000), (2, N'Kumari Silva', 20000), (3, N'Ruwan Fernando', 0);
GO

/* ---------- BigOrders: 300,000 rows for index & optimization demos ----------
   Only a clustered primary key – no other indexes on purpose. */
CREATE TABLE dbo.BigOrders (
    OrderId       INT IDENTITY(1,1) CONSTRAINT PK_BigOrders PRIMARY KEY CLUSTERED,
    CustomerId    INT           NOT NULL,
    CustomerEmail VARCHAR(150)  NOT NULL,
    OrderDate     DATETIME2(0)  NOT NULL,
    Status        VARCHAR(20)   NOT NULL,
    Amount        DECIMAL(18,2) NOT NULL,
    ShipCity      NVARCHAR(50)  NOT NULL,
    Notes         NVARCHAR(200) NULL
);
GO
;WITH n AS (
    SELECT TOP (300000) ROW_NUMBER() OVER (ORDER BY (SELECT NULL)) AS i
    FROM sys.all_objects a CROSS JOIN sys.all_objects b CROSS JOIN sys.all_objects c
)
INSERT INTO dbo.BigOrders WITH (TABLOCK) (CustomerId, CustomerEmail, OrderDate, Status, Amount, ShipCity, Notes)
SELECT
    c.CustomerId,
    'customer' + CAST(c.CustomerId AS varchar(10)) + '@mail.com',
    DATEADD(MINUTE, -CAST(i * 7 % 1051200 AS int), CAST('2026-11-01' AS datetime2(0))),   -- spread over ~2 years
    CASE WHEN i % 100 < 2 THEN 'Pending'             -- 2%  pending  (rare → good for filtered index)
         WHEN i % 100 < 10 THEN 'Cancelled'          -- 8%
         WHEN i % 100 < 55 THEN 'Paid'               -- 45%
         ELSE 'Shipped' END,                         -- 45%
    CAST((i * 37 % 50000) + 500 AS decimal(18,2)),
    CASE i % 6 WHEN 0 THEN N'Colombo' WHEN 1 THEN N'Kandy' WHEN 2 THEN N'Galle'
               WHEN 3 THEN N'Negombo' WHEN 4 THEN N'Jaffna' ELSE N'Matara' END,
    CASE WHEN i % 10 = 0 THEN N'Gift wrap please' ELSE NULL END
FROM n
CROSS APPLY (SELECT CASE WHEN i % 20 = 0 THEN 42        -- customer 42 is a "whale": ~15,000 orders
                         ELSE (i * 7919 % 20000) + 1 END AS CustomerId) c;
GO
UPDATE STATISTICS dbo.BigOrders WITH FULLSCAN;
GO

/* ---------- marker so the app knows setup finished ---------- */
CREATE TABLE dbo.SetupInfo (Id INT PRIMARY KEY, CreatedAt DATETIME2(0) DEFAULT SYSUTCDATETIME());
INSERT INTO dbo.SetupInfo (Id) VALUES (1);
GO
PRINT 'ShopDB is ready: 10 customers, 10 products, 15 orders, 12 employees, 300,000 BigOrders.';
