import { sqliteTable, integer, text, real } from 'drizzle-orm/sqlite-core';

// Users table for authentication
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: text('role').notNull().default('student'), // student, faculty, admin
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Students table
export const students = sqliteTable('students', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  course: text('course').notNull(),
  year: integer('year').notNull(),
  balance: real('balance').default(0),
  phone: text('phone'),
  address: text('address'),
  enrollmentDate: text('enrollment_date').notNull(),
  status: text('status').notNull().default('active'), // active, inactive, graduated
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Courses table
export const courses = sqliteTable('courses', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  code: text('code').notNull().unique(),
  credits: integer('credits').notNull(),
  department: text('department').notNull(),
  syllabus: text('syllabus'),
  enrolledCount: integer('enrolled_count').default(0),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Faculty table
export const faculty = sqliteTable('faculty', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').references(() => users.id),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  department: text('department').notNull(),
  designation: text('designation').notNull(),
  salary: real('salary').notNull(),
  lastPaymentDate: text('last_payment_date'),
  assignedCourses: text('assigned_courses', { mode: 'json' }),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Fees table
export const fees = sqliteTable('fees', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id),
  amount: real('amount').notNull(),
  dueDate: text('due_date').notNull(),
  paidDate: text('paid_date'),
  status: text('status').notNull().default('pending'), // pending, paid, overdue
  type: text('type').notNull(), // tuition, exam, library, hostel
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Marks table
export const marks = sqliteTable('marks', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id),
  courseId: integer('course_id').references(() => courses.id),
  semester: integer('semester').notNull(),
  internalMarks: integer('internal_marks'),
  externalMarks: integer('external_marks'),
  totalMarks: integer('total_marks'),
  grade: text('grade'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Attendance table
export const attendance = sqliteTable('attendance', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id),
  courseId: integer('course_id').references(() => courses.id),
  date: text('date').notNull(),
  status: text('status').notNull(), // present, absent, late
  session: text('session').notNull(), // morning, afternoon, evening
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Enrollments table
export const enrollments = sqliteTable('enrollments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  studentId: integer('student_id').references(() => students.id),
  courseId: integer('course_id').references(() => courses.id),
  enrollmentDate: text('enrollment_date').notNull(),
  status: text('status').notNull().default('active'), // active, dropped, completed
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});