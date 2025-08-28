import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, courses, faculty, fees, marks, attendance, enrollments } from '@/db/schema';
import { eq, count, sum, sql, desc, and, gt, lt } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    // Calculate total counts
    const [
      totalStudents,
      totalCourses,
      totalFaculty,
      pendingFees,
      overdueFees
    ] = await Promise.all([
      db.select({ count: count() }).from(students).where(eq(students.status, 'active')),
      db.select({ count: count() }).from(courses),
      db.select({ count: count() }).from(faculty),
      db.select({ count: count() }).from(fees).where(eq(fees.status, 'pending')),
      db.select({ count: count() }).from(fees).where(eq(fees.status, 'overdue'))
    ]);

    // Student distribution by course
    const studentsByCourse = await db
      .select({
        course: students.course,
        count: count()
      })
      .from(students)
      .where(eq(students.status, 'active'))
      .groupBy(students.course);

    // Student distribution by year
    const studentsByYear = await db
      .select({
        year: students.year,
        count: count()
      })
      .from(students)
      .where(eq(students.status, 'active'))
      .groupBy(students.year);

    // Enrollment statistics
    const [totalEnrollments, activeEnrollments] = await Promise.all([
      db.select({ count: count() }).from(enrollments),
      db.select({ count: count() }).from(enrollments).where(eq(enrollments.status, 'active'))
    ]);

    // Faculty distribution by department
    const facultyByDepartment = await db
      .select({
        department: faculty.department,
        count: count()
      })
      .from(faculty)
      .groupBy(faculty.department);

    // Recent enrollments (last 10)
    const recentEnrollments = await db
      .select({
        id: enrollments.id,
        studentName: students.name,
        courseName: courses.title,
        enrollmentDate: enrollments.enrollmentDate,
        status: enrollments.status
      })
      .from(enrollments)
      .innerJoin(students, eq(enrollments.studentId, students.id))
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .orderBy(desc(enrollments.createdAt))
      .limit(10);

    // Recent fee payments (last 10)
    const recentFeePayments = await db
      .select({
        id: fees.id,
        studentName: students.name,
        amount: fees.amount,
        type: fees.type,
        paidDate: fees.paidDate,
        status: fees.status
      })
      .from(fees)
      .innerJoin(students, eq(fees.studentId, students.id))
      .where(eq(fees.status, 'paid'))
      .orderBy(desc(fees.paidDate))
      .limit(10);

    // Fee collection statistics
    const [totalCollected, pendingAmount] = await Promise.all([
      db
        .select({ total: sum(fees.amount) })
        .from(fees)
        .where(eq(fees.status, 'paid')),
      db
        .select({ total: sum(fees.amount) })
        .from(fees)
        .where(eq(fees.status, 'pending'))
    ]);

    // Attendance statistics
    const [totalAttendanceRecords, presentRecords] = await Promise.all([
      db.select({ count: count() }).from(attendance),
      db.select({ count: count() }).from(attendance).where(eq(attendance.status, 'present'))
    ]);

    const attendancePercentage = totalAttendanceRecords[0].count > 0 
      ? Math.round((presentRecords[0].count / totalAttendanceRecords[0].count) * 100)
      : 0;

    // Performance metrics - average grades by course
    const averageGradesByCourse = await db
      .select({
        courseName: courses.title,
        courseCode: courses.code,
        averageMarks: sql<number>`AVG(${marks.totalMarks})`,
        totalStudents: count(marks.id)
      })
      .from(marks)
      .innerJoin(courses, eq(marks.courseId, courses.id))
      .where(gt(marks.totalMarks, 0))
      .groupBy(courses.id, courses.title, courses.code);

    // Top performing courses
    const topPerformingCourses = await db
      .select({
        courseName: courses.title,
        courseCode: courses.code,
        averageMarks: sql<number>`AVG(${marks.totalMarks})`,
        enrolledCount: courses.enrolledCount
      })
      .from(courses)
      .leftJoin(marks, eq(courses.id, marks.courseId))
      .groupBy(courses.id, courses.title, courses.code, courses.enrolledCount)
      .orderBy(desc(sql<number>`AVG(${marks.totalMarks})`))
      .limit(5);

    // Monthly fee collection trend (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const monthlyFeeCollection = await db
      .select({
        month: sql<string>`strftime('%Y-%m', ${fees.paidDate})`,
        totalAmount: sum(fees.amount),
        transactionCount: count(fees.id)
      })
      .from(fees)
      .where(
        and(
          eq(fees.status, 'paid'),
          gt(fees.paidDate, sixMonthsAgo.toISOString())
        )
      )
      .groupBy(sql<string>`strftime('%Y-%m', ${fees.paidDate})`)
      .orderBy(sql<string>`strftime('%Y-%m', ${fees.paidDate})`);

    // Student status distribution
    const studentStatusDistribution = await db
      .select({
        status: students.status,
        count: count()
      })
      .from(students)
      .groupBy(students.status);

    // Overdue fees by type
    const overdueFeesByType = await db
      .select({
        type: fees.type,
        count: count(),
        totalAmount: sum(fees.amount)
      })
      .from(fees)
      .where(eq(fees.status, 'overdue'))
      .groupBy(fees.type);

    const dashboardStats = {
      overview: {
        totalStudents: totalStudents[0].count,
        totalCourses: totalCourses[0].count,
        totalFaculty: totalFaculty[0].count,
        pendingFees: pendingFees[0].count,
        overdueFees: overdueFees[0].count
      },
      studentDistribution: {
        byCourse: studentsByCourse,
        byYear: studentsByYear,
        byStatus: studentStatusDistribution
      },
      enrollmentStats: {
        total: totalEnrollments[0].count,
        active: activeEnrollments[0].count,
        completionRate: totalEnrollments[0].count > 0 
          ? Math.round((activeEnrollments[0].count / totalEnrollments[0].count) * 100)
          : 0
      },
      facultyDistribution: {
        byDepartment: facultyByDepartment
      },
      recentActivities: {
        enrollments: recentEnrollments,
        feePayments: recentFeePayments
      },
      feeStatistics: {
        totalCollected: totalCollected[0].total || 0,
        pendingAmount: pendingAmount[0].total || 0,
        monthlyTrend: monthlyFeeCollection,
        overdueFeesByType: overdueFeesByType
      },
      attendanceStats: {
        totalRecords: totalAttendanceRecords[0].count,
        presentRecords: presentRecords[0].count,
        overallPercentage: attendancePercentage
      },
      performanceMetrics: {
        averageGradesByCourse: averageGradesByCourse,
        topPerformingCourses: topPerformingCourses
      },
      generatedAt: new Date().toISOString()
    };

    return NextResponse.json(dashboardStats, { status: 200 });

  } catch (error) {
    console.error('Dashboard stats error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch dashboard statistics',
      code: 'DASHBOARD_STATS_ERROR'
    }, { status: 500 });
  }
}