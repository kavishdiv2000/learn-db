(function () {
  const { h2, h3, p, html, code, table, er, erPair, tip, warn, note, interview, quiz, reveal } = window.L;

  // ===========================================================================
  window.LESSONS.push({
    id: 'basics',
    group: 'Database design',
    title: 'Relational basics & keys',
    keywords: 'ddl dml dcl tcl primary foreign key data types nvarchar',
    intro: 'Tables, rows, keys and the four families of SQL commands. Almost every interview starts here.',
    blocks: [
      h2('Tables, rows and columns'),
      p(`A **relational database** stores data in **tables**, also called *relations*. Each **row** (a *tuple* or *record*) is one thing, such as one customer. Each **column** (an *attribute*) is one fact about it, such as an email address. Tables are linked by **keys**, not by position, so you combine them with joins.

**SQL** is the standard language. **T-SQL** (Transact-SQL) is Microsoft's dialect. It adds variables, \`IF\`/\`WHILE\`, \`TRY…CATCH\`, stored procedures and triggers.`),
      h2('The four command families'),
      table(['Family', 'Stands for', 'Commands', 'What it does'], [
        ['**DDL**', 'Data Definition Language', '`CREATE`, `ALTER`, `DROP`, `TRUNCATE`', 'Defines structure: tables, indexes, views, procedures'],
        ['**DML**', 'Data Manipulation Language', '`SELECT`, `INSERT`, `UPDATE`, `DELETE`, `MERGE`', 'Reads and changes rows'],
        ['**DCL**', 'Data Control Language', '`GRANT`, `REVOKE`, `DENY`', 'Permissions'],
        ['**TCL**', 'Transaction Control Language', '`BEGIN TRAN`, `COMMIT`, `ROLLBACK`, `SAVE TRAN`', 'Groups changes into all-or-nothing units']
      ], { caption: 'Some textbooks put SELECT in its own family, DQL (Data Query Language).' }),
      quiz('Which family does `TRUNCATE TABLE` belong to?', ['DML, because it removes rows', 'DDL, because it deallocates the table\'s pages instead of deleting rows one by one', 'TCL', 'DCL'], 1, 'TRUNCATE is DDL. It does not log each row, it does not fire DELETE triggers, and it resets IDENTITY. That is also why it is much faster than DELETE.'),
      h2('Keys'),
      table(['Key', 'Meaning', 'ShopDB example'], [
        ['**Super key**', 'Any set of columns that uniquely identifies a row', '{CustomerId}, {CustomerId, Email}, {Email}'],
        ['**Candidate key**', 'A *minimal* super key (remove any column and it stops being unique)', '{CustomerId} and {Email}'],
        ['**Primary key (PK)**', 'The candidate key you pick as the main identifier. NOT NULL, one per table', '`Customers.CustomerId`'],
        ['**Alternate / unique key**', 'A candidate key that was not chosen as the PK, enforced with UNIQUE', '`Customers.Email`'],
        ['**Foreign key (FK)**', 'A column whose value must exist in another table\'s PK (or unique key)', '`Orders.CustomerId → Customers.CustomerId`'],
        ['**Composite key**', 'A key made of two or more columns', '`OrderItems (OrderId, ProductId)`'],
        ['**Surrogate key**', 'An artificial ID with no business meaning', '`INT IDENTITY`, `UNIQUEIDENTIFIER`'],
        ['**Natural key**', 'A real-world value that is already unique', 'NIC number, ISBN, email']
      ]),
      p('See the keys and constraints SQL Server stores for ShopDB:'),
      code(`SELECT t.name AS TableName, kc.name AS ConstraintName, kc.type_desc
FROM sys.key_constraints kc
JOIN sys.tables t ON t.object_id = kc.parent_object_id
UNION ALL
SELECT OBJECT_NAME(fk.parent_object_id), fk.name, 'FOREIGN_KEY -> ' + OBJECT_NAME(fk.referenced_object_id)
FROM sys.foreign_keys fk
ORDER BY TableName;`, { title: 'All keys in ShopDB' }),
      p('A foreign key protects you from orphan rows. This insert fails because customer 999 does not exist:'),
      code(`INSERT INTO dbo.Orders (CustomerId, Status) VALUES (999, 'Pending');`, { title: 'Referential integrity in action' }),
      interview('**"Primary key vs unique key?"** A PK cannot be NULL, a table has only one, and by default SQL Server builds the **clustered index** on it. A UNIQUE constraint allows **one NULL** in SQL Server, a table can have many, and it builds a **nonclustered** index by default.'),
      h2('Data types you will actually use'),
      table(['Type', 'Use for', 'Notes'], [
        ['`INT` / `BIGINT`', 'IDs, counts', 'INT goes up to about 2.1 billion. Use BIGINT for big log tables'],
        ['`DECIMAL(18,2)`', 'Money, quantities that must be exact', 'Never use FLOAT for money (it has rounding errors)'],
        ['`VARCHAR(n)`', 'ASCII text: emails, codes', '1 byte per character'],
        ['`NVARCHAR(n)`', 'Unicode text: names, Sinhala/Tamil text', '2 bytes per character. Prefix literals with N: `N\'නිමල්\'`'],
        ['`DATE` / `DATETIME2(0..7)`', 'Dates and timestamps', 'Prefer DATETIME2 to the old DATETIME'],
        ['`BIT`', 'Yes/no flags', '0, 1 or NULL'],
        ['`UNIQUEIDENTIFIER`', 'GUIDs', 'A random GUID makes a poor clustered key (fragmentation)'],
        ['`VARCHAR(MAX)` / `NVARCHAR(MAX)`', 'Large text up to 2 GB', 'Cannot be an index key column']
      ]),
      code(`SELECT DATALENGTH('Kandy')  AS VarcharBytes,     -- 5
       DATALENGTH(N'Kandy') AS NvarcharBytes,    -- 10
       CAST(0.1 AS FLOAT) + CAST(0.2 AS FLOAT) AS FloatSum,     -- 0.30000000000000004
       CAST(0.1 AS DECIMAL(10,2)) + CAST(0.2 AS DECIMAL(10,2)) AS DecimalSum; -- 0.30`, { title: 'VARCHAR vs NVARCHAR, FLOAT vs DECIMAL' })
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'er-basics',
    group: 'Database design',
    title: 'ER modelling: entities, attributes, cardinality',
    keywords: 'entity relationship diagram crow foot chen cardinality participation weak entity',
    intro: 'An Entity–Relationship (ER) diagram is the blueprint you draw before writing any CREATE TABLE.',
    blocks: [
      h2('The three building blocks'),
      table(['Concept', 'What it is', 'Becomes in SQL', 'Example'], [
        ['**Entity**', 'A "thing" you store data about: a person, object, event or concept', 'A table', 'Student, Course, Order'],
        ['**Attribute**', 'A property of an entity', 'A column', 'Student.Name, Course.Credits'],
        ['**Relationship**', 'How entities are associated', 'A foreign key, or a junction table', 'Student *enrolls in* Course']
      ]),
      p(`How to find them in a requirement: **nouns** are usually entities or attributes, and **verbs** are relationships.

*"A **customer** places **orders**. Each order contains one or more **products**."* gives the entities Customer, Order and Product, and the relationships *places* and *contains*.`),
      h2('Kinds of attributes'),
      table(['Kind', 'Meaning', 'Example', 'How you store it'], [
        ['Simple', 'Cannot be split', '`Age`', 'One column'],
        ['Composite', 'Made of parts', '`Address` → Street, City, PostalCode', 'One column per part'],
        ['Multivalued', 'Can hold several values', 'A person\'s phone numbers', '**A separate table** (never Phone1, Phone2, Phone3)'],
        ['Derived', 'Can be calculated', '`Age` from `DateOfBirth`, order total', 'Usually not stored: compute it, or use a computed column'],
        ['Key', 'Identifies the entity', '`StudentId`', 'Primary key']
      ]),
      h2('Cardinality and participation'),
      p(`**Cardinality** is the *maximum* number of related rows: **one** or **many**.
**Participation** (or *optionality*) is the *minimum*: **zero** (optional) or **one** (mandatory).

Read each end of a relationship separately: "one customer places **zero or many** orders" and "each order is placed by **exactly one** customer."`),
      table(['Crow\'s-foot symbol', 'Mermaid code', 'Means'], [
        ['`||`  two bars', '`||`', 'exactly one (mandatory)'],
        ['`o|`  circle + bar', '`|o` / `o|`', 'zero or one (optional)'],
        ['`|<`  bar + crow\'s foot', '`|{` / `}|`', 'one or many'],
        ['`o<`  circle + crow\'s foot', '`o{` / `}o`', 'zero or many']
      ]),
      er(`erDiagram
  CUSTOMER ||--o{ ORDER : places
  ORDER ||--|{ ORDER_LINE : contains
  PRODUCT ||--o{ ORDER_LINE : "is ordered in"
  CUSTOMER {
    int CustomerId PK
    string Name
    string Email UK
  }
  ORDER {
    int OrderId PK
    int CustomerId FK
    date OrderDate
  }
  ORDER_LINE {
    int OrderId PK,FK
    int ProductId PK,FK
    int Quantity
  }
  PRODUCT {
    int ProductId PK
    string Name
    decimal Price
  }`, 'Read it as: a CUSTOMER places zero or many ORDERs. An ORDER belongs to exactly one CUSTOMER and contains one or many ORDER_LINEs.'),
      quiz('In `CUSTOMER ||--o{ ORDER`, what does the `o{` next to ORDER mean?', ['Each order has zero or many customers', 'A customer can have zero, one or many orders', 'A customer must have at least one order', 'It is a one-to-one relationship'], 1, 'The symbol next to ORDER describes how many ORDERs one CUSTOMER can have: `o` = minimum zero, `{` = maximum many. A new customer with no orders yet is allowed.'),
      h2('Strong vs weak entities'),
      p(`A **weak entity** cannot be identified on its own. Its key includes the key of its *owner*. **OrderLine** is weak: line 1 only means something inside Order 1001, so its PK is **(OrderId, LineNo)**. Other examples are a hotel **Room** inside a Hotel (HotelId, RoomNo) and a **Dependent** of an Employee.

In SQL, a weak entity has a **composite primary key that contains the owner's FK**, usually with \`ON DELETE CASCADE\`, because a line cannot exist without its order.`),
      h2('Chen notation vs crow\'s foot'),
      p('University courses often use **Chen notation**: rectangles for entities, diamonds for relationships, ovals for attributes, and 1 / N / M on the lines. Industry tools (SSMS diagrams, dbdiagram.io, Lucidchart, ERwin) use **crow\'s foot**, which this app draws. Both describe the same thing. If an interviewer draws one, answer in the same notation.'),
      interview('A good way to talk through a design question: **1)** list the entities, **2)** list each relationship with its cardinality in words, **3)** pick the primary keys, **4)** resolve every many-to-many with a junction table, **5)** check the result is in 3NF, **6)** mention which indexes the main queries need.')
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'relationships',
    group: 'Database design',
    title: 'Relationship patterns: 1:1, 1:N, M:N, self',
    keywords: 'one to one one to many many to many junction bridge associative table self referencing recursive',
    intro: 'Each relationship type maps to a specific table pattern. Learn the pattern, see the diagram, then run the DDL.',
    blocks: [
      table(['Relationship', 'Rule for turning it into tables', 'Example'], [
        ['**One-to-many (1:N)**', 'Put the FK on the **many** side', 'Department → Employees'],
        ['**One-to-one (1:1)**', 'Put the FK on either side and make it **UNIQUE** (or share the same PK)', 'Employee → ParkingPermit, User → UserProfile'],
        ['**Many-to-many (M:N)**', 'Create a **junction table** holding both FKs. Its PK is usually the pair', 'Student ↔ Course through Enrollment'],
        ['**Self-referencing (recursive)**', 'An FK pointing to the **same table**', 'Employee → Manager, Category → ParentCategory']
      ]),
      tip('All DDL on this page runs in the **sandbox**: the tables are created, used and rolled back. Untick Sandbox if you want to keep them.'),

      // ---------------- 1:N
      h2('One-to-many (1:N), the most common relationship', 'one-to-many'),
      p('*"A department employs many employees. Each employee works in exactly one department."* The FK goes on the **many** side (Employee), because each employee row points to its single department.'),
      er(`erDiagram
  DEPARTMENT ||--o{ EMPLOYEE : employs
  DEPARTMENT {
    int DepartmentId PK
    string Name
  }
  EMPLOYEE {
    int EmployeeId PK
    string FullName
    int DepartmentId FK
  }`, 'One department, zero or many employees.'),
      code(`CREATE TABLE lab.Department (
    DepartmentId INT IDENTITY PRIMARY KEY,
    Name         NVARCHAR(50) NOT NULL UNIQUE
);
CREATE TABLE lab.Employee (
    EmployeeId   INT IDENTITY PRIMARY KEY,
    FullName     NVARCHAR(100) NOT NULL,
    DepartmentId INT NOT NULL                       -- NOT NULL = mandatory participation
        REFERENCES lab.Department(DepartmentId)     -- the FK lives on the MANY side
);
INSERT INTO lab.Department (Name) VALUES (N'Engineering'), (N'Sales');
INSERT INTO lab.Employee (FullName, DepartmentId) VALUES
  (N'Isuru', 1), (N'Hasini', 1), (N'Pradeep', 2);

SELECT d.Name, COUNT(e.EmployeeId) AS Headcount
FROM lab.Department d
LEFT JOIN lab.Employee e ON e.DepartmentId = d.DepartmentId
GROUP BY d.Name;`, { title: '1:N in SQL' }),
      warn('Why not put a list of employee IDs in the Department table? A cell would have to hold many values, which breaks **1NF**, and you could not enforce FKs or index them. The FK always goes on the many side.'),

      // ---------------- 1:1
      h2('One-to-one (1:1)', 'one-to-one'),
      p(`*"Each employee may have at most one parking permit, and each permit belongs to exactly one employee."*

Use a 1:1 table split when part of the data is **optional**, **large**, **sensitive** or **used rarely**. Examples: \`UserProfile\` (avatar, bio) next to \`Users\`, or \`EmployeeSalary\` kept separate for security.`),
      er(`erDiagram
  EMPLOYEE ||--o| PARKING_PERMIT : "is issued"
  EMPLOYEE {
    int EmployeeId PK
    string FullName
  }
  PARKING_PERMIT {
    int PermitId PK
    int EmployeeId FK,UK
    string Slot
    date ValidUntil
  }`, 'The `o|` means zero or one permit per employee. The UNIQUE on the FK is what makes it 1:1 rather than 1:N.'),
      code(`CREATE TABLE lab.Emp (EmployeeId INT PRIMARY KEY, FullName NVARCHAR(100) NOT NULL);

-- Option A: separate PK + UNIQUE foreign key
CREATE TABLE lab.ParkingPermit (
    PermitId   INT IDENTITY PRIMARY KEY,
    EmployeeId INT NOT NULL UNIQUE REFERENCES lab.Emp(EmployeeId),   -- UNIQUE => one-to-one
    Slot       VARCHAR(10) NOT NULL
);

-- Option B: shared primary key (the child's PK *is* the FK)
CREATE TABLE lab.EmpProfile (
    EmployeeId INT PRIMARY KEY REFERENCES lab.Emp(EmployeeId),
    Bio        NVARCHAR(500),
    PhotoUrl   VARCHAR(300)
);

INSERT INTO lab.Emp VALUES (1, N'Isuru'), (2, N'Hasini');
INSERT INTO lab.ParkingPermit (EmployeeId, Slot) VALUES (1, 'B-12');
GO
-- This fails: employee 1 already has a permit (violates UNIQUE)
INSERT INTO lab.ParkingPermit (EmployeeId, Slot) VALUES (1, 'C-04');`, { title: '1:1 two ways', note: 'The second INSERT fails on purpose. Look at the error in the Results tab.' }),
      quiz('You must model **Person ↔ Passport** where every passport belongs to one person and a person has at most one *current* passport. Where is the FK, and what makes it 1:1?', ['FK on Person, no constraint', 'FK `PersonId` on Passport, with a UNIQUE constraint on it', 'A junction table PersonPassport', 'FK on both tables pointing to each other'], 1, 'Put the FK on the dependent/optional side (Passport) and add UNIQUE. FKs on both sides create a circular dependency and make inserts painful.'),

      // ---------------- M:N
      h2('Many-to-many (M:N) and the junction table', 'many-to-many'),
      p(`*"A student enrolls in many courses, and a course has many students."* A relational table **cannot** store M:N directly. Neither side can hold a single FK, because each row would need *many* values.

The fix is to **resolve** it into two 1:N relationships through a **junction table**, also called a *bridge*, *associative* or *link* table. The relationship often has its own attributes, such as the **grade** and **enrolment date**, and they belong in the junction table.`),
      erPair(`erDiagram
  STUDENT }o--o{ COURSE : "enrolls in"
  STUDENT {
    int StudentId PK
    string Name
  }
  COURSE {
    string CourseCode PK
    string Title
  }`, '**Conceptual:** M:N as the business describes it', `erDiagram
  STUDENT ||--o{ ENROLLMENT : has
  COURSE ||--o{ ENROLLMENT : has
  STUDENT {
    int StudentId PK
    string Name
  }
  ENROLLMENT {
    int StudentId PK,FK
    string CourseCode PK,FK
    date EnrolledOn
    string Grade
  }
  COURSE {
    string CourseCode PK
    string Title
  }`, '**Physical:** resolved with the ENROLLMENT junction table'),
      code(`CREATE TABLE uni.Student (
    StudentId INT IDENTITY PRIMARY KEY,
    Name      NVARCHAR(100) NOT NULL
);
CREATE TABLE uni.Course (
    CourseCode CHAR(6) PRIMARY KEY,
    Title      NVARCHAR(100) NOT NULL,
    Credits    TINYINT NOT NULL CHECK (Credits BETWEEN 1 AND 30)
);
CREATE TABLE uni.Enrollment (                      -- the junction table
    StudentId  INT     NOT NULL REFERENCES uni.Student(StudentId),
    CourseCode CHAR(6) NOT NULL REFERENCES uni.Course(CourseCode),
    EnrolledOn DATE    NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    Grade      CHAR(2) NULL,                       -- attribute OF THE RELATIONSHIP
    CONSTRAINT PK_Enrollment PRIMARY KEY (StudentId, CourseCode)  -- no duplicate enrolments
);
CREATE INDEX IX_Enrollment_Course ON uni.Enrollment(CourseCode);   -- for "students in a course"

INSERT INTO uni.Student (Name) VALUES (N'Kavish'), (N'Nimali'), (N'Ravi');
INSERT INTO uni.Course VALUES ('SE5001', N'Databases', 20), ('SE5002', N'Algorithms', 20), ('SE5003', N'Cloud', 10);
INSERT INTO uni.Enrollment (StudentId, CourseCode, Grade) VALUES
  (1,'SE5001','A'), (1,'SE5002','B+'), (2,'SE5001','A-'), (3,'SE5003',NULL);

-- Who takes Databases?
SELECT c.Title, s.Name, e.Grade
FROM uni.Course c
JOIN uni.Enrollment e ON e.CourseCode = c.CourseCode
JOIN uni.Student s    ON s.StudentId  = e.StudentId
WHERE c.CourseCode = 'SE5001';

-- Course list per student
SELECT s.Name, STRING_AGG(c.Title, ', ') AS Courses, SUM(c.Credits) AS TotalCredits
FROM uni.Student s
JOIN uni.Enrollment e ON e.StudentId = s.StudentId
JOIN uni.Course c     ON c.CourseCode = e.CourseCode
GROUP BY s.Name;`, { title: 'M:N in SQL: Student ↔ Course' }),
      note(`**Composite PK or surrogate PK on the junction table?**
- **Composite (StudentId, CourseCode):** this stops duplicates for free, and it is the classic textbook answer.
- **Surrogate (EnrollmentId IDENTITY) + UNIQUE(StudentId, CourseCode):** this is useful when other tables must reference an enrolment (e.g. AssessmentResults), or when the same pair can legitimately repeat (a student retaking a course in a different semester: then make it UNIQUE(StudentId, CourseCode, Semester)).`, 'Design choice'),
      p('More real M:N examples: **Order ↔ Product** (OrderItems, with Quantity and UnitPrice), **Doctor ↔ Patient** (Appointment, with a date and time), **Actor ↔ Movie** (Cast, with a role name), **User ↔ Role** (UserRoles, for permissions), **Post ↔ Tag** (PostTags).'),
      quiz('A **Book** can have several **Authors** and an author writes several books. We also need each author\'s position on the cover (1st author, 2nd author). Where does `AuthorOrder` go?', ['In Book', 'In Author', 'In the BookAuthor junction table', 'In a separate AuthorOrder table'], 2, 'The position describes one *book–author pair*, not the book or the author alone, so it is an attribute of the relationship. It goes in the junction table.'),

      // ---------------- self
      h2('Self-referencing (recursive) relationships', 'self-referencing'),
      p('*"Each employee may report to one manager, who is also an employee."* The FK points back to the same table. NULL means no manager (the CEO). Other uses are category trees, folder structures, bill of materials and comment replies.'),
      er(`erDiagram
  EMPLOYEE |o--o{ EMPLOYEE : manages
  EMPLOYEE {
    int EmployeeId PK
    string FullName
    int ManagerId FK
  }`, 'One manager manages zero or many employees. An employee has zero or one manager.'),
      code(`-- ShopDB already has this: dbo.Employees.ManagerId -> dbo.Employees.EmployeeId
-- Self join: each employee with their manager's name
SELECT e.FullName AS Employee, e.Title, m.FullName AS Manager
FROM dbo.Employees e
LEFT JOIN dbo.Employees m ON m.EmployeeId = e.ManagerId
ORDER BY m.FullName, e.FullName;`, { title: 'Self join' }),
      code(`-- Recursive CTE: the whole reporting chain below the Head of Engineering
WITH Chain AS (
    SELECT EmployeeId, FullName, Title, ManagerId, 0 AS Lvl,
           CAST(FullName AS NVARCHAR(400)) AS Path
    FROM dbo.Employees WHERE Title = N'Head of Engineering'
    UNION ALL
    SELECT e.EmployeeId, e.FullName, e.Title, e.ManagerId, c.Lvl + 1,
           CAST(c.Path + N' > ' + e.FullName AS NVARCHAR(400))
    FROM dbo.Employees e
    JOIN Chain c ON e.ManagerId = c.EmployeeId
)
SELECT REPLICATE(N'    ', Lvl) + FullName AS OrgChart, Title, Lvl, Path
FROM Chain
ORDER BY Path;`, { title: 'Walk the hierarchy with a recursive CTE' }),

      h2('Summary'),
      table(['If the requirement says…', 'Cardinality', 'Implement with'], [
        ['"each X has one Y, a Y has many X"', '1:N', 'FK in X (the many side)'],
        ['"each X has at most one Y and vice versa"', '1:1', 'FK + UNIQUE, or a shared PK'],
        ['"X has many Y and Y has many X"', 'M:N', 'Junction table XY(XId, YId) + attributes of the relationship'],
        ['"X relates to another X"', 'Recursive', 'FK to the same table (nullable for the root)'],
        ['"X has many phone numbers / emails / skills"', '1:N multivalued attribute', 'Child table XPhone(XId, Phone)']
      ])
    ]
  });

  // ===========================================================================
  window.LESSONS.push({
    id: 'er-scenarios',
    group: 'Database design',
    title: 'ER case studies (practice)',
    keywords: 'scenario case study hospital library food delivery design exercise',
    intro: 'Real-world requirements, turned step by step into entities, cardinalities, an ER diagram and SQL. Try each one yourself before opening the answer.',
    blocks: [
      // ------------- Hospital
      h2('Case 1: Hospital appointments'),
      p(`**Requirements**
- The hospital has **departments** (Cardiology, Paediatrics…). Each **doctor** belongs to exactly one department.
- A **patient** can book many **appointments**. Each appointment is with one doctor, on a date and time.
- A doctor can see many patients, and a patient can see many doctors.
- During an appointment the doctor may write **prescriptions**. One appointment can have many prescribed **medicines**, each with a dosage. A medicine can appear in many prescriptions.`),
      p('**Your turn:** list the entities and the cardinality of each relationship, then open the answer.'),
      reveal('Show the answer: entities, cardinalities and diagram', [
        table(['Relationship', 'Cardinality', 'Implementation'], [
          ['Department – Doctor', '1:N', 'Doctor.DepartmentId FK'],
          ['Doctor ↔ Patient', 'M:N', 'Resolved by **Appointment**, which is a junction table *and* an entity in its own right (date, status)'],
          ['Patient – Appointment', '1:N', 'Appointment.PatientId FK'],
          ['Doctor – Appointment', '1:N', 'Appointment.DoctorId FK'],
          ['Appointment ↔ Medicine', 'M:N', 'Junction **PrescriptionItem**(AppointmentId, MedicineId, Dosage, Days)']
        ]),
        er(`erDiagram
  DEPARTMENT ||--o{ DOCTOR : has
  DOCTOR ||--o{ APPOINTMENT : attends
  PATIENT ||--o{ APPOINTMENT : books
  APPOINTMENT ||--o{ PRESCRIPTION_ITEM : includes
  MEDICINE ||--o{ PRESCRIPTION_ITEM : "is prescribed in"
  DEPARTMENT {
    int DepartmentId PK
    string Name UK
  }
  DOCTOR {
    int DoctorId PK
    string FullName
    string SlmcRegNo UK
    int DepartmentId FK
  }
  PATIENT {
    int PatientId PK
    string FullName
    string Nic UK
    date DateOfBirth
  }
  APPOINTMENT {
    int AppointmentId PK
    int PatientId FK
    int DoctorId FK
    datetime StartsAt
    string Status
  }
  MEDICINE {
    int MedicineId PK
    string Name UK
  }
  PRESCRIPTION_ITEM {
    int AppointmentId PK,FK
    int MedicineId PK,FK
    string Dosage
    int Days
  }`, 'Appointment resolves the Doctor ↔ Patient M:N. PrescriptionItem resolves Appointment ↔ Medicine.'),
        code(`CREATE TABLE hosp.Department (DepartmentId INT IDENTITY PRIMARY KEY, Name NVARCHAR(60) NOT NULL UNIQUE);
CREATE TABLE hosp.Doctor (
    DoctorId INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    SlmcRegNo VARCHAR(20) NOT NULL UNIQUE,
    DepartmentId INT NOT NULL REFERENCES hosp.Department(DepartmentId)
);
CREATE TABLE hosp.Patient (
    PatientId INT IDENTITY PRIMARY KEY,
    FullName NVARCHAR(100) NOT NULL,
    Nic VARCHAR(12) NOT NULL UNIQUE,
    DateOfBirth DATE NOT NULL
);
CREATE TABLE hosp.Appointment (
    AppointmentId INT IDENTITY PRIMARY KEY,
    PatientId INT NOT NULL REFERENCES hosp.Patient(PatientId),
    DoctorId  INT NOT NULL REFERENCES hosp.Doctor(DoctorId),
    StartsAt  DATETIME2(0) NOT NULL,
    Status    VARCHAR(12) NOT NULL DEFAULT 'Booked' CHECK (Status IN ('Booked','Completed','NoShow','Cancelled')),
    CONSTRAINT UQ_Doctor_Slot UNIQUE (DoctorId, StartsAt)     -- a doctor can't be double-booked
);
CREATE TABLE hosp.Medicine (MedicineId INT IDENTITY PRIMARY KEY, Name NVARCHAR(100) NOT NULL UNIQUE);
CREATE TABLE hosp.PrescriptionItem (
    AppointmentId INT NOT NULL REFERENCES hosp.Appointment(AppointmentId) ON DELETE CASCADE,
    MedicineId    INT NOT NULL REFERENCES hosp.Medicine(MedicineId),
    Dosage        NVARCHAR(50) NOT NULL,
    Days          TINYINT NOT NULL,
    PRIMARY KEY (AppointmentId, MedicineId)
);

INSERT INTO hosp.Department (Name) VALUES (N'Cardiology'), (N'Paediatrics');
INSERT INTO hosp.Doctor (FullName, SlmcRegNo, DepartmentId) VALUES (N'Dr. Perera','SLMC1001',1), (N'Dr. Fonseka','SLMC2040',2);
INSERT INTO hosp.Patient (FullName, Nic, DateOfBirth) VALUES (N'Saman', '199012345678', '1990-04-01'), (N'Mala', '200156789012', '2001-09-12');
INSERT INTO hosp.Appointment (PatientId, DoctorId, StartsAt, Status) VALUES
  (1,1,'2026-11-25 09:00','Completed'), (2,1,'2026-11-25 09:30','Booked'), (1,2,'2026-11-26 10:00','Booked');
INSERT INTO hosp.Medicine (Name) VALUES (N'Aspirin 75mg'), (N'Atorvastatin 20mg');
INSERT INTO hosp.PrescriptionItem VALUES (1,1,N'1 tablet daily',30), (1,2,N'1 tablet at night',30);

-- Tomorrow's schedule for Cardiology
SELECT d.FullName AS Doctor, a.StartsAt, p.FullName AS Patient, a.Status
FROM hosp.Appointment a
JOIN hosp.Doctor d  ON d.DoctorId = a.DoctorId
JOIN hosp.Department dep ON dep.DepartmentId = d.DepartmentId
JOIN hosp.Patient p ON p.PatientId = a.PatientId
WHERE dep.Name = N'Cardiology'
ORDER BY a.StartsAt;
GO
-- Try to double-book Dr. Perera at 09:00: fails on UQ_Doctor_Slot
INSERT INTO hosp.Appointment (PatientId, DoctorId, StartsAt) VALUES (2, 1, '2026-11-25 09:00');`, { title: 'Hospital schema (sandbox)' }),
        tip('Interview bonus: the UNIQUE (DoctorId, StartsAt) constraint turns a business rule ("no double booking") into something the database guarantees, even when two receptionists click Save at the same moment.')
      ]),

      // ------------- Library
      h2('Case 2: Library management'),
      p(`**Requirements**
- The library holds **books** (title, ISBN, year). A book can have several **authors**, and an author can write several books.
- Each book belongs to one **publisher**.
- The library owns several physical **copies** of the same book. Each copy has a barcode and a shelf location.
- **Members** borrow **copies** (not books). A loan records the borrowed date, the due date and the returned date. A member can have many loans, and over time a copy is loaned many times.
- A member can have at most one **membership card**.`),
      reveal('Show the answer', [
        table(['Relationship', 'Cardinality', 'Note'], [
          ['Publisher – Book', '1:N', 'Book.PublisherId'],
          ['Book ↔ Author', 'M:N', 'Junction **BookAuthor**(BookId, AuthorId, AuthorOrder)'],
          ['Book – Copy', '1:N', 'Copy is a separate entity, because each physical item has its own barcode'],
          ['Member ↔ Copy', 'M:N over time', 'Resolved by **Loan**, an entity with dates. It needs a surrogate PK because the same member can borrow the same copy twice'],
          ['Member – MembershipCard', '1:1', 'Card.MemberId UNIQUE']
        ]),
        er(`erDiagram
  PUBLISHER ||--o{ BOOK : publishes
  BOOK ||--o{ BOOK_AUTHOR : "written by"
  AUTHOR ||--o{ BOOK_AUTHOR : writes
  BOOK ||--|{ COPY : "has copies"
  COPY ||--o{ LOAN : "is loaned in"
  MEMBER ||--o{ LOAN : makes
  MEMBER ||--o| MEMBERSHIP_CARD : holds
  BOOK {
    int BookId PK
    string Isbn UK
    string Title
    int PublisherId FK
  }
  AUTHOR {
    int AuthorId PK
    string Name
  }
  BOOK_AUTHOR {
    int BookId PK,FK
    int AuthorId PK,FK
    int AuthorOrder
  }
  COPY {
    int CopyId PK
    string Barcode UK
    int BookId FK
  }
  LOAN {
    int LoanId PK
    int CopyId FK
    int MemberId FK
    date LoanedOn
    date DueOn
    date ReturnedOn
  }
  MEMBER {
    int MemberId PK
    string FullName
  }
  MEMBERSHIP_CARD {
    int CardId PK
    int MemberId FK,UK
    date ExpiresOn
  }
  PUBLISHER {
    int PublisherId PK
    string Name
  }`),
        code(`CREATE TABLE lib.Publisher (PublisherId INT IDENTITY PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
CREATE TABLE lib.Book (
    BookId INT IDENTITY PRIMARY KEY, Isbn CHAR(13) NOT NULL UNIQUE, Title NVARCHAR(200) NOT NULL,
    PublisherId INT NOT NULL REFERENCES lib.Publisher(PublisherId));
CREATE TABLE lib.Author (AuthorId INT IDENTITY PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
CREATE TABLE lib.BookAuthor (
    BookId INT REFERENCES lib.Book(BookId), AuthorId INT REFERENCES lib.Author(AuthorId),
    AuthorOrder TINYINT NOT NULL DEFAULT 1, PRIMARY KEY (BookId, AuthorId));
CREATE TABLE lib.Copy (CopyId INT IDENTITY PRIMARY KEY, Barcode VARCHAR(20) NOT NULL UNIQUE,
    BookId INT NOT NULL REFERENCES lib.Book(BookId), Shelf VARCHAR(10));
CREATE TABLE lib.Member (MemberId INT IDENTITY PRIMARY KEY, FullName NVARCHAR(100) NOT NULL);
CREATE TABLE lib.Loan (
    LoanId INT IDENTITY PRIMARY KEY,
    CopyId INT NOT NULL REFERENCES lib.Copy(CopyId),
    MemberId INT NOT NULL REFERENCES lib.Member(MemberId),
    LoanedOn DATE NOT NULL, DueOn DATE NOT NULL, ReturnedOn DATE NULL,
    CHECK (DueOn > LoanedOn));
-- Business rule: a copy can be on loan to only one person at a time
CREATE UNIQUE INDEX UX_Loan_OpenCopy ON lib.Loan(CopyId) WHERE ReturnedOn IS NULL;

INSERT INTO lib.Publisher (Name) VALUES (N'Pearson'), (N'O''Reilly');
INSERT INTO lib.Book (Isbn, Title, PublisherId) VALUES ('9780133970777', N'Database Systems', 1), ('9781492040347', N'Designing Data-Intensive Apps', 2);
INSERT INTO lib.Author (Name) VALUES (N'Elmasri'), (N'Navathe'), (N'Kleppmann');
INSERT INTO lib.BookAuthor VALUES (1,1,1), (1,2,2), (2,3,1);
INSERT INTO lib.Copy (Barcode, BookId, Shelf) VALUES ('LIB-0001',1,'A1'), ('LIB-0002',1,'A1'), ('LIB-0003',2,'B4');
INSERT INTO lib.Member (FullName) VALUES (N'Kavish'), (N'Nimali');
INSERT INTO lib.Loan (CopyId, MemberId, LoanedOn, DueOn, ReturnedOn) VALUES
  (1,1,'2026-10-01','2026-10-15','2026-10-12'), (1,2,'2026-11-01','2026-11-15',NULL), (3,1,'2026-11-10','2026-11-24',NULL);

-- Overdue loans with book title and authors
SELECT m.FullName, b.Title,
       STRING_AGG(a.Name, ', ') WITHIN GROUP (ORDER BY ba.AuthorOrder) AS Authors,
       l.DueOn, DATEDIFF(DAY, l.DueOn, '2026-11-24') AS DaysLate
FROM lib.Loan l
JOIN lib.Copy c ON c.CopyId = l.CopyId
JOIN lib.Book b ON b.BookId = c.BookId
JOIN lib.BookAuthor ba ON ba.BookId = b.BookId
JOIN lib.Author a ON a.AuthorId = ba.AuthorId
JOIN lib.Member m ON m.MemberId = l.MemberId
WHERE l.ReturnedOn IS NULL AND l.DueOn < '2026-11-24'
GROUP BY m.FullName, b.Title, l.DueOn;
GO
-- Copy 1 is already out to Nimali, so this fails thanks to the filtered unique index
INSERT INTO lib.Loan (CopyId, MemberId, LoanedOn, DueOn) VALUES (1, 1, '2026-11-20', '2026-12-04');`, { title: 'Library schema (sandbox)' }),
        note('**Book vs Copy** is a classic trap. If you link Loan straight to Book, you cannot tell *which* physical copy is missing, and you cannot handle five copies of the same title. Separate "the thing in the catalogue" from "the physical item".', 'Common mistake')
      ]),

      // ------------- Food delivery
      h2('Case 3: Food delivery app (PickMe Food / Uber Eats style)'),
      p(`**Requirements**
- **Customers** have several saved **addresses**.
- **Restaurants** have **menu items** grouped into **categories** (e.g. Rice & Curry, Drinks). Each menu item is in one category of one restaurant.
- A customer places an **order** at **one** restaurant, delivered to one of their addresses. An order contains many menu items, each with a quantity and the **price at the time of ordering**.
- A **rider** delivers an order. A rider makes many deliveries, and an order has at most one rider.
- After delivery the customer can leave **one review per order**.`),
      reveal('Show the answer', [
        er(`erDiagram
  CUSTOMER ||--o{ ADDRESS : saves
  CUSTOMER ||--o{ FOOD_ORDER : places
  ADDRESS ||--o{ FOOD_ORDER : "delivered to"
  RESTAURANT ||--o{ MENU_CATEGORY : has
  MENU_CATEGORY ||--o{ MENU_ITEM : groups
  RESTAURANT ||--o{ FOOD_ORDER : receives
  FOOD_ORDER ||--|{ ORDER_LINE : contains
  MENU_ITEM ||--o{ ORDER_LINE : "ordered as"
  RIDER |o--o{ FOOD_ORDER : delivers
  FOOD_ORDER ||--o| REVIEW : "reviewed in"
  CUSTOMER {
    int CustomerId PK
    string Phone UK
  }
  ADDRESS {
    int AddressId PK
    int CustomerId FK
    string Label
  }
  RESTAURANT {
    int RestaurantId PK
    string Name
  }
  MENU_CATEGORY {
    int CategoryId PK
    int RestaurantId FK
    string Name
  }
  MENU_ITEM {
    int MenuItemId PK
    int CategoryId FK
    decimal CurrentPrice
  }
  FOOD_ORDER {
    int OrderId PK
    int CustomerId FK
    int RestaurantId FK
    int AddressId FK
    int RiderId FK
    string Status
  }
  ORDER_LINE {
    int OrderId PK,FK
    int MenuItemId PK,FK
    int Qty
    decimal UnitPrice
  }
  RIDER {
    int RiderId PK
    string VehicleNo
  }
  REVIEW {
    int OrderId PK,FK
    int Stars
  }`, 'REVIEW uses a shared PK (OrderId) to make it 1:1 with the order. RiderId is nullable until a rider accepts.'),
        table(['Decision', 'Why'], [
          ['`ORDER_LINE.UnitPrice` copied from the menu', 'Menu prices change. The order must keep the price the customer actually paid. This is **historical data**, not redundancy.'],
          ['`FOOD_ORDER.RiderId` is NULL until assigned', 'This is optional participation (`|o`). A new order has no rider yet.'],
          ['Address in its own table', 'It is a multivalued attribute of Customer, and orders must point to the exact address used.'],
          ['`REVIEW` PK = OrderId', 'This enforces at most one review per order, with no extra UNIQUE needed.'],
          ['Restaurant is reachable from MenuItem *and* stored on the order', 'An order must come from one restaurant. A CHECK or trigger can make sure all lines belong to that restaurant. That is a good discussion point.']
        ]),
        code(`CREATE TABLE food.Restaurant (RestaurantId INT IDENTITY PRIMARY KEY, Name NVARCHAR(100) NOT NULL);
CREATE TABLE food.MenuCategory (CategoryId INT IDENTITY PRIMARY KEY,
    RestaurantId INT NOT NULL REFERENCES food.Restaurant(RestaurantId), Name NVARCHAR(50) NOT NULL);
CREATE TABLE food.MenuItem (MenuItemId INT IDENTITY PRIMARY KEY,
    CategoryId INT NOT NULL REFERENCES food.MenuCategory(CategoryId),
    Name NVARCHAR(100) NOT NULL, CurrentPrice DECIMAL(10,2) NOT NULL);
CREATE TABLE food.Customer (CustomerId INT IDENTITY PRIMARY KEY, Phone VARCHAR(15) NOT NULL UNIQUE);
CREATE TABLE food.Address (AddressId INT IDENTITY PRIMARY KEY,
    CustomerId INT NOT NULL REFERENCES food.Customer(CustomerId), Label NVARCHAR(30), Line1 NVARCHAR(150));
CREATE TABLE food.Rider (RiderId INT IDENTITY PRIMARY KEY, VehicleNo VARCHAR(12) NOT NULL);
CREATE TABLE food.FoodOrder (OrderId INT IDENTITY PRIMARY KEY,
    CustomerId INT NOT NULL REFERENCES food.Customer(CustomerId),
    RestaurantId INT NOT NULL REFERENCES food.Restaurant(RestaurantId),
    AddressId INT NOT NULL REFERENCES food.Address(AddressId),
    RiderId INT NULL REFERENCES food.Rider(RiderId),
    Status VARCHAR(15) NOT NULL DEFAULT 'Placed', PlacedAt DATETIME2(0) NOT NULL DEFAULT SYSUTCDATETIME());
CREATE TABLE food.OrderLine (OrderId INT REFERENCES food.FoodOrder(OrderId),
    MenuItemId INT REFERENCES food.MenuItem(MenuItemId), Qty INT NOT NULL CHECK (Qty > 0),
    UnitPrice DECIMAL(10,2) NOT NULL, PRIMARY KEY (OrderId, MenuItemId));
CREATE TABLE food.Review (OrderId INT PRIMARY KEY REFERENCES food.FoodOrder(OrderId),
    Stars TINYINT NOT NULL CHECK (Stars BETWEEN 1 AND 5), Comment NVARCHAR(300));

INSERT INTO food.Restaurant (Name) VALUES (N'Colombo Kitchen');
INSERT INTO food.MenuCategory (RestaurantId, Name) VALUES (1, N'Rice & Curry'), (1, N'Drinks');
INSERT INTO food.MenuItem (CategoryId, Name, CurrentPrice) VALUES (1, N'Chicken Rice & Curry', 950), (1, N'Kottu', 1200), (2, N'Iced Milo', 450);
INSERT INTO food.Customer (Phone) VALUES ('0771234567');
INSERT INTO food.Address (CustomerId, Label, Line1) VALUES (1, N'Home', N'12 Galle Rd, Panadura');
INSERT INTO food.Rider (VehicleNo) VALUES ('WP-BCD-1234');
INSERT INTO food.FoodOrder (CustomerId, RestaurantId, AddressId, RiderId, Status) VALUES (1, 1, 1, 1, 'Delivered');
INSERT INTO food.OrderLine VALUES (1, 2, 2, 1200), (1, 3, 2, 450);
INSERT INTO food.Review VALUES (1, 5, N'Hot and fast!');

UPDATE food.MenuItem SET CurrentPrice = 1400 WHERE MenuItemId = 2;   -- price rise later

-- The order total still uses the price paid at the time
SELECT o.OrderId, SUM(l.Qty * l.UnitPrice) AS PaidTotal,
       SUM(l.Qty * m.CurrentPrice) AS TotalAtTodaysPrices
FROM food.FoodOrder o
JOIN food.OrderLine l ON l.OrderId = o.OrderId
JOIN food.MenuItem m ON m.MenuItemId = l.MenuItemId
GROUP BY o.OrderId;`, { title: 'Food delivery schema (sandbox)' })
      ]),

      // ------------- Design-it-yourself
      h2('Case 4: Design it yourself. Online course platform'),
      p(`**Requirements:** instructors create **courses**. A course can have several instructors. A course has ordered **lessons**. Students **enroll** in courses and pay a price, which can be discounted with a **coupon**. Students mark lessons as completed and can earn a **certificate** per course (at most one). Lessons can have many **tags**, and a tag is used on many lessons.

Write your CREATE TABLE statements in the editor below. It runs in the sandbox, so experiment freely, then compare with the model answer.`),
      code(`-- Your design here (uses the lab schema). Example start:
CREATE TABLE lab.Instructor (
    InstructorId INT IDENTITY PRIMARY KEY,
    FullName     NVARCHAR(100) NOT NULL
);
`, { title: 'Your design' }),
      reveal('Show a model answer', [
        er(`erDiagram
  INSTRUCTOR ||--o{ COURSE_INSTRUCTOR : teaches
  COURSE ||--|{ COURSE_INSTRUCTOR : "taught by"
  COURSE ||--o{ LESSON : contains
  LESSON ||--o{ LESSON_TAG : tagged
  TAG ||--o{ LESSON_TAG : labels
  STUDENT ||--o{ ENROLLMENT : makes
  COURSE ||--o{ ENROLLMENT : has
  COUPON |o--o{ ENROLLMENT : "applied to"
  ENROLLMENT ||--o{ LESSON_PROGRESS : tracks
  LESSON ||--o{ LESSON_PROGRESS : "completed in"
  ENROLLMENT ||--o| CERTIFICATE : earns
  COURSE {
    int CourseId PK
    string Title
    decimal ListPrice
  }
  LESSON {
    int LessonId PK
    int CourseId FK
    int Position
  }
  ENROLLMENT {
    int EnrollmentId PK
    int StudentId FK
    int CourseId FK
    int CouponId FK
    decimal PricePaid
  }
  LESSON_PROGRESS {
    int EnrollmentId PK,FK
    int LessonId PK,FK
    datetime CompletedAt
  }
  CERTIFICATE {
    int EnrollmentId PK,FK
    string Code UK
  }`, 'Three M:N relationships (Course–Instructor, Lesson–Tag, Enrollment–Lesson progress), two 1:1 or optional relationships (Certificate, Coupon).'),
        p(`Key points an interviewer looks for:
- **COURSE_INSTRUCTOR** resolves Instructor ↔ Course M:N. You could add a \`Role\` column (lead, assistant).
- **LESSON** has \`UNIQUE (CourseId, Position)\`, so two lessons cannot share a position.
- **ENROLLMENT** gets a surrogate PK because Certificate and LessonProgress reference it. Add \`UNIQUE (StudentId, CourseId)\`.
- **PricePaid** is stored on the enrolment, because list prices and coupons change over time.
- **CERTIFICATE**'s PK is the EnrollmentId, so there is at most one certificate per enrolment.
- **LESSON_PROGRESS** references the enrolment, not just the student, so progress is tied to that course purchase.`)
      ])
    ]
  });

  // ===========================================================================
  const T = (v, cls) => ({ v, cls });
  window.LESSONS.push({
    id: 'normalization',
    group: 'Database design',
    title: 'Normalization: 1NF → 2NF → 3NF → BCNF',
    keywords: 'normal form anomaly functional dependency partial transitive denormalization',
    intro: 'Normalization removes duplicated facts so every fact is stored once. Follow one messy spreadsheet all the way to 3NF.',
    blocks: [
      h2('Why normalize? The three anomalies'),
      p('Imagine a shop that keeps every order in one spreadsheet. Duplicated data causes three classic problems, which interviewers call **anomalies**:'),
      table(['Anomaly', 'What goes wrong'], [
        ['**Update anomaly**', 'A customer moves city. You must change it on every one of their rows. Miss one and the data contradicts itself.'],
        ['**Insert anomaly**', 'You cannot add a new product until someone orders it, because there is no row to put it on.'],
        ['**Delete anomaly**', 'Delete the only order for the Desk and you lose the fact that a Desk costs 45,000.']
      ]),
      h2('Step 0: Unnormalized form (UNF)'),
      table(['OrderId', 'OrderDate', 'Customer', 'CustomerCity', 'Products'], [
        ['1001', '2026-03-01', 'Nimal Perera', 'Colombo', T('Laptop (250000) x1, Mouse (3500) x2', 'dup')],
        ['1002', '2026-03-04', 'Kumari Silva', 'Kandy', 'Desk (45000) x1'],
        ['1003', '2026-03-09', 'Nimal Perera', 'Colombo', T('Mouse (3500) x1, Notebook (450) x10', 'dup')]
      ], { caption: 'The **Products** cell holds a list. You cannot index it, sum it or enforce rules on it.' }),
      h2('Step 1: First Normal Form (1NF)'),
      p(`**Rule:** every cell holds a **single (atomic) value**, there are no repeating groups (no Product1, Product2…), and each row is unique (it has a primary key).

**Fix:** give each product on an order its own row. The key becomes **(OrderId, Product)**.`),
      table(['OrderId', 'Product', 'OrderDate', 'Customer', 'CustomerCity', 'UnitPrice', 'Qty'], [
        ['1001', 'Laptop', '2026-03-01', T('Nimal Perera', 'dup'), T('Colombo', 'dup'), '250000', '1'],
        ['1001', 'Mouse', T('2026-03-01', 'dup'), T('Nimal Perera', 'dup'), T('Colombo', 'dup'), T('3500', 'dup'), '2'],
        ['1002', 'Desk', '2026-03-04', 'Kumari Silva', 'Kandy', '45000', '1'],
        ['1003', 'Mouse', '2026-03-09', T('Nimal Perera', 'dup'), T('Colombo', 'dup'), T('3500', 'dup'), '1'],
        ['1003', 'Notebook', '2026-03-09', T('Nimal Perera', 'dup'), T('Colombo', 'dup'), '450', '10']
      ], { pk: [0, 1], caption: 'In 1NF, but the highlighted cells repeat the same fact again and again. PK = (OrderId, Product), underlined.' }),
      quiz('A `Students` table has a column `PhoneNumbers` containing "0771234567, 0712345678". Which normal form does it break?', ['1NF', '2NF', '3NF', 'None, it is fine'], 0, 'A list in one cell is not atomic. Move the phones to a `StudentPhone(StudentId, Phone)` table.'),
      h2('Step 2: Second Normal Form (2NF)'),
      p(`**Rule:** be in 1NF, **and** every non-key column must depend on the **whole** primary key, not just part of it. This only matters when the PK is **composite**. Depending on part of the key is called a **partial dependency**.

Look at the 1NF table with key (OrderId, Product):
- \`Qty\` depends on (OrderId, Product). That is fine, because it needs both.
- \`OrderDate\`, \`Customer\` and \`CustomerCity\` depend on **OrderId only**. These are partial dependencies.
- \`UnitPrice\` depends on **Product only**. This is also a partial dependency.

**Fix:** move each partial dependency into a table keyed by the part it depends on.`),
      table(['OrderId', 'OrderDate', 'Customer', 'CustomerCity'], [
        ['1001', '2026-03-01', 'Nimal Perera', T('Colombo', 'dup')], ['1002', '2026-03-04', 'Kumari Silva', 'Kandy'], ['1003', '2026-03-09', 'Nimal Perera', T('Colombo', 'dup')]
      ], { title: 'Orders', pk: [0] }),
      table(['Product', 'UnitPrice'], [['Laptop', '250000'], ['Mouse', '3500'], ['Desk', '45000'], ['Notebook', '450']], { title: 'Products', pk: [0] }),
      table(['OrderId', 'Product', 'Qty'], [['1001', 'Laptop', '1'], ['1001', 'Mouse', '2'], ['1002', 'Desk', '1'], ['1003', 'Mouse', '1'], ['1003', 'Notebook', '10']], { title: 'OrderItems', pk: [0, 1], fk: [] }),
      p('Better: the Mouse price is now stored once. But **Orders** still repeats "Nimal Perera, Colombo" for every order Nimal places.'),
      h2('Step 3: Third Normal Form (3NF)'),
      p(`**Rule:** be in 2NF, **and** no non-key column may depend on **another non-key column**. That is called a **transitive dependency**: OrderId → Customer → CustomerCity. City is a fact about the *customer*, not about the order.

A popular way to remember it: every non-key attribute must depend on *"the key, the whole key, and nothing but the key"*.

**Fix:** move customer facts into a Customers table and keep only \`CustomerId\` on the order.`),
      table(['CustomerId', 'Name', 'City'], [['1', 'Nimal Perera', 'Colombo'], ['2', 'Kumari Silva', 'Kandy']], { title: 'Customers', pk: [0] }),
      table(['OrderId', 'OrderDate', 'CustomerId'], [['1001', '2026-03-01', '1'], ['1002', '2026-03-04', '2'], ['1003', '2026-03-09', '1']], { title: 'Orders', pk: [0], fk: [2] }),
      table(['ProductId', 'Name', 'UnitPrice'], [['1', 'Laptop', '250000'], ['2', 'Mouse', '3500'], ['3', 'Desk', '45000'], ['4', 'Notebook', '450']], { title: 'Products', pk: [0] }),
      table(['OrderId', 'ProductId', 'Qty', 'UnitPrice'], [['1001', '1', '1', '250000'], ['1001', '2', '2', '3500'], ['1002', '3', '1', '45000'], ['1003', '2', '1', '3500'], ['1003', '4', '10', '450']], { title: 'OrderItems', pk: [0, 1], fk: [0, 1], caption: '**UnitPrice is back on OrderItems, but on purpose.** It is the price *paid at that time*, which is a different fact from today\'s catalogue price, so it is not a 3NF violation. This is exactly what ShopDB does.' }),
      er(`erDiagram
  CUSTOMERS ||--o{ ORDERS : places
  ORDERS ||--|{ ORDER_ITEMS : contains
  PRODUCTS ||--o{ ORDER_ITEMS : "sold as"
  CUSTOMERS {
    int CustomerId PK
    string Name
    string City
  }
  ORDERS {
    int OrderId PK
    date OrderDate
    int CustomerId FK
  }
  PRODUCTS {
    int ProductId PK
    string Name
    decimal UnitPrice
  }
  ORDER_ITEMS {
    int OrderId PK,FK
    int ProductId PK,FK
    int Qty
    decimal UnitPrice
  }`, 'The 3NF result. Each fact lives in exactly one place.'),
      p('Now prove nothing was lost: a JOIN rebuilds the original spreadsheet.'),
      code(`CREATE TABLE lab.Customers (CustomerId INT PRIMARY KEY, Name NVARCHAR(100), City NVARCHAR(50));
CREATE TABLE lab.Products  (ProductId INT PRIMARY KEY, Name NVARCHAR(100), UnitPrice DECIMAL(18,2));
CREATE TABLE lab.Orders    (OrderId INT PRIMARY KEY, OrderDate DATE, CustomerId INT REFERENCES lab.Customers);
CREATE TABLE lab.OrderItems(OrderId INT REFERENCES lab.Orders, ProductId INT REFERENCES lab.Products,
                            Qty INT, UnitPrice DECIMAL(18,2), PRIMARY KEY (OrderId, ProductId));
INSERT INTO lab.Customers VALUES (1, N'Nimal Perera', N'Colombo'), (2, N'Kumari Silva', N'Kandy');
INSERT INTO lab.Products  VALUES (1, N'Laptop', 250000), (2, N'Mouse', 3500), (3, N'Desk', 45000), (4, N'Notebook', 450);
INSERT INTO lab.Orders    VALUES (1001, '2026-03-01', 1), (1002, '2026-03-04', 2), (1003, '2026-03-09', 1);
INSERT INTO lab.OrderItems VALUES (1001,1,1,250000), (1001,2,2,3500), (1002,3,1,45000), (1003,2,1,3500), (1003,4,10,450);

-- Update anomaly gone: Nimal moves to Galle with ONE row changed
UPDATE lab.Customers SET City = N'Galle' WHERE CustomerId = 1;

-- Rebuild the "spreadsheet" view with joins
SELECT o.OrderId, o.OrderDate, c.Name AS Customer, c.City,
       STRING_AGG(CONCAT(p.Name, ' (', oi.UnitPrice, ') x', oi.Qty), ', ') AS Products,
       SUM(oi.Qty * oi.UnitPrice) AS OrderTotal
FROM lab.Orders o
JOIN lab.Customers c   ON c.CustomerId = o.CustomerId
JOIN lab.OrderItems oi ON oi.OrderId = o.OrderId
JOIN lab.Products p    ON p.ProductId = oi.ProductId
GROUP BY o.OrderId, o.OrderDate, c.Name, c.City;`, { title: '3NF tables + rebuild with JOIN' }),
      h2('BCNF (Boyce–Codd Normal Form)'),
      p(`**Rule:** for every functional dependency X → Y, **X must be a candidate key**. It is a stricter 3NF that only matters when a table has **overlapping candidate keys**.

**Example:** \`TutorBooking(Student, Subject, Tutor)\`. Each tutor teaches only one subject (Tutor → Subject), and a student has one tutor per subject. The candidate key is (Student, Subject). The table is in 3NF, because Subject is part of a key, but it is **not BCNF**, because Tutor is not a candidate key. **Fix:** split into \`TutorSubject(Tutor PK, Subject)\` and \`StudentTutor(Student, Tutor)\`.`),
      note('4NF (multivalued dependencies) and 5NF exist, but they rarely come up outside university exams. For most interviews, know 1NF–3NF well and be able to define BCNF.', 'Beyond BCNF'),
      h2('Denormalization: breaking the rules on purpose'),
      p(`Normalized designs are best for **OLTP** (many small writes). Sometimes you *deliberately* add redundancy to make reads faster:

- **Reporting / data warehouse:** star schemas with wide, denormalized dimension tables.
- **Pre-computed totals:** \`Orders.TotalAmount\`, kept up to date by the application or a trigger, so the order list doesn't sum the lines every time.
- **Indexed views** in SQL Server, or a cache (Redis) in front of the database.

The cost: you must keep the copies in sync (triggers, application code, jobs), and writes get slower. Always say **why** you denormalized.`),
      interview('**"What is normalization and why would you denormalize?"** Normalization organizes data so each fact is stored once, which removes update, insert and delete anomalies. 1NF: atomic values. 2NF: no partial dependency on a composite key. 3NF: no transitive dependency between non-key columns. I denormalize only for a measured read-performance need, such as reporting tables or stored totals, and I accept the extra cost of keeping the copies in sync.'),
      h2('Practice: spot the normal form'),
      quiz('`Enrollment(StudentId, CourseId, StudentName, Grade)` with PK (StudentId, CourseId). Which normal form is violated?', ['1NF', '2NF: StudentName depends only on StudentId (partial dependency)', '3NF', 'BCNF only'], 1, 'StudentName depends on part of the composite key. Move it to Students(StudentId, StudentName).'),
      quiz('`Employees(EmployeeId PK, Name, DepartmentId, DepartmentName)`. Which normal form is violated?', ['1NF', '2NF', '3NF: DepartmentName depends on DepartmentId, which is not the key (transitive dependency)', 'It is fully normalized'], 2, 'EmployeeId → DepartmentId → DepartmentName. Move DepartmentName to Departments(DepartmentId, DepartmentName).'),
      quiz('`Orders(OrderId PK, CustomerId, OrderDate, Item1, Item2, Item3)`. Which normal form is violated?', ['1NF: repeating group of columns', '2NF', '3NF', 'BCNF'], 0, 'Item1/Item2/Item3 is a repeating group. Use an OrderItems child table instead.'),
      quiz('A table has a **single-column** primary key and is in 1NF. What can you say about 2NF?', ['It cannot be in 2NF', 'It is automatically in 2NF, because a partial dependency needs a composite key', 'You must still check transitive dependencies for 2NF', 'It depends on the data types'], 1, 'A partial dependency means depending on *part* of the key. A single-column key has no parts. You still need to check 3NF.')
    ]
  });
})();
