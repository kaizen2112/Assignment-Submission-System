-- Phase 1 verification. Run against a seeded database:
--   psql -U postgres -d assignment_system -f Backend/scripts/verify-db.sql
-- Every check prints PASS or FAIL in the last column. No FAILs = Phase 1 is intact.

\pset footer off

\echo
\echo ===== 1. TABLES (expect 7 + __EFMigrationsHistory) =====
SELECT tablename,
       CASE WHEN tablename IN ('users','classes','subjects','teacher_assignments',
                               'student_enrollments','assignments','submissions',
                               '__EFMigrationsHistory')
            THEN 'PASS' ELSE 'UNEXPECTED' END AS status
FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;

\echo
\echo ===== 2. ENUM COLUMNS STORED AS TEXT, TIMESTAMPS AS timestamptz =====
SELECT table_name, column_name, data_type,
       CASE
         WHEN column_name IN ('Role','Status')      AND data_type = 'character varying'        THEN 'PASS'
         WHEN column_name LIKE '%At' OR column_name = 'Deadline'
              THEN CASE WHEN data_type = 'timestamp with time zone' THEN 'PASS' ELSE 'FAIL' END
         ELSE 'FAIL'
       END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name IN ('Role','Status','Deadline','CreatedAt','UpdatedAt','GradedAt','SubmittedAt',
                       'EnrolledAt','AssignedAt'))
ORDER BY table_name, column_name;

\echo
\echo ===== 3. STRING LENGTH LIMITS =====
SELECT table_name || '.' || column_name AS column, character_maximum_length AS len,
       CASE
         WHEN column_name = 'FullName'     AND character_maximum_length = 200  THEN 'PASS'
         WHEN column_name = 'Email'        AND character_maximum_length = 256  THEN 'PASS'
         WHEN column_name = 'PasswordHash' AND character_maximum_length = 512  THEN 'PASS'
         WHEN column_name = 'AnswerText'   AND character_maximum_length = 5000 THEN 'PASS'
         WHEN column_name = 'Feedback'     AND character_maximum_length = 2000 THEN 'PASS'
         WHEN column_name = 'Title'        AND character_maximum_length = 200  THEN 'PASS'
         WHEN column_name = 'Description'  AND character_maximum_length = 5000 THEN 'PASS'
         ELSE 'FAIL'
       END AS status
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('FullName','Email','PasswordHash','AnswerText','Feedback','Title','Description')
ORDER BY table_name, column_name;

\echo
\echo ===== 4. UNIQUE INDEXES (the 6 correctness constraints) =====
SELECT expected.name,
       CASE WHEN i.indexname IS NULL THEN 'MISSING' ELSE 'PASS' END AS status
FROM (VALUES
        ('IX_users_Email'),
        ('IX_classes_Code'),
        ('IX_subjects_ClassId_Name'),
        ('IX_student_enrollments_StudentId_ClassId'),
        ('IX_submissions_AssignmentId_StudentId'),
        ('IX_teacher_assignments_TeacherId_SubjectId_ClassId')
     ) AS expected(name)
LEFT JOIN pg_indexes i
       ON i.indexname = expected.name AND i.schemaname = 'public' AND i.indexdef LIKE '%UNIQUE%'
ORDER BY expected.name;

\echo
\echo ===== 5. NON-UNIQUE PERFORMANCE INDEXES =====
SELECT expected.name,
       CASE WHEN i.indexname IS NULL THEN 'MISSING' ELSE 'PASS' END AS status
FROM (VALUES ('IX_assignments_ClassId_Status'), ('IX_assignments_Deadline')) AS expected(name)
LEFT JOIN pg_indexes i ON i.indexname = expected.name AND i.schemaname = 'public'
ORDER BY expected.name;

\echo
\echo ===== 6. DEMO USERS WITH BCRYPT-HASHED PASSWORDS =====
SELECT "Email", "Role", left("PasswordHash", 4) AS algo, length("PasswordHash") AS len,
       CASE WHEN "PasswordHash" LIKE '$2%$%' AND length("PasswordHash") = 60
            THEN 'PASS' ELSE 'FAIL - not a bcrypt hash' END AS status
FROM users ORDER BY "Role", "Email";

\echo
\echo ===== 7. SEED DATA SHAPE =====
SELECT 'users total'          AS check, count(*)::text AS actual, '6' AS expected, CASE WHEN count(*)=6 THEN 'PASS' ELSE 'FAIL' END AS status FROM users
UNION ALL SELECT 'admins',      count(*)::text, '1', CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM users WHERE "Role"='Admin'
UNION ALL SELECT 'teachers',    count(*)::text, '2', CASE WHEN count(*)=2 THEN 'PASS' ELSE 'FAIL' END FROM users WHERE "Role"='Teacher'
UNION ALL SELECT 'students',    count(*)::text, '3', CASE WHEN count(*)=3 THEN 'PASS' ELSE 'FAIL' END FROM users WHERE "Role"='Student'
UNION ALL SELECT 'classes',     count(*)::text, '2', CASE WHEN count(*)=2 THEN 'PASS' ELSE 'FAIL' END FROM classes
UNION ALL SELECT 'subjects',    count(*)::text, '3', CASE WHEN count(*)=3 THEN 'PASS' ELSE 'FAIL' END FROM subjects
UNION ALL SELECT 'teacher assignments', count(*)::text, '3', CASE WHEN count(*)=3 THEN 'PASS' ELSE 'FAIL' END FROM teacher_assignments
UNION ALL SELECT 'enrollments', count(*)::text, '3', CASE WHEN count(*)=3 THEN 'PASS' ELSE 'FAIL' END FROM student_enrollments
UNION ALL SELECT 'published assignments', count(*)::text, '2', CASE WHEN count(*)=2 THEN 'PASS' ELSE 'FAIL' END FROM assignments WHERE "Status"='Published'
UNION ALL SELECT 'draft assignments',     count(*)::text, '1', CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM assignments WHERE "Status"='Draft'
UNION ALL SELECT 'graded submissions',    count(*)::text, '2', CASE WHEN count(*)=2 THEN 'PASS' ELSE 'FAIL' END FROM submissions WHERE "Status"='Graded'
UNION ALL SELECT 'pending submissions',   count(*)::text, '1', CASE WHEN count(*)=1 THEN 'PASS' ELSE 'FAIL' END FROM submissions WHERE "Marks" IS NULL;

\echo
\echo ===== 8. NO DUPLICATE SEED (idempotency evidence) =====
SELECT 'duplicate emails' AS check, count(*)::text AS actual,
       CASE WHEN count(*)=0 THEN 'PASS' ELSE 'FAIL - seeder ran twice' END AS status
FROM (SELECT "Email" FROM users GROUP BY "Email" HAVING count(*) > 1) d;

\echo
\echo ===== 9. MIGRATION HISTORY =====
SELECT "MigrationId", "ProductVersion",
       CASE WHEN "ProductVersion" LIKE '9.%' THEN 'PASS' ELSE 'FAIL - not EF 9' END AS status
FROM "__EFMigrationsHistory" ORDER BY "MigrationId";
