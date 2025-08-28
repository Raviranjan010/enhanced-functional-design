import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { enrollments, students, courses } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

const VALID_STATUS_VALUES = ['active', 'dropped', 'completed'];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single enrollment fetch with student and course details
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const enrollment = await db
        .select({
          id: enrollments.id,
          studentId: enrollments.studentId,
          courseId: enrollments.courseId,
          enrollmentDate: enrollments.enrollmentDate,
          status: enrollments.status,
          createdAt: enrollments.createdAt,
          updatedAt: enrollments.updatedAt,
          student: {
            id: students.id,
            name: students.name,
            email: students.email,
            course: students.course,
            year: students.year
          },
          course: {
            id: courses.id,
            title: courses.title,
            code: courses.code,
            credits: courses.credits,
            department: courses.department
          }
        })
        .from(enrollments)
        .leftJoin(students, eq(enrollments.studentId, students.id))
        .leftJoin(courses, eq(enrollments.courseId, courses.id))
        .where(eq(enrollments.id, parseInt(id)))
        .limit(1);

      if (enrollment.length === 0) {
        return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
      }

      return NextResponse.json(enrollment[0]);
    }

    // List enrollments with filtering and pagination
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const studentId = searchParams.get('student_id');
    const courseId = searchParams.get('course_id');
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    let query = db.select().from(enrollments);
    let conditions = [];

    // Apply filters
    if (studentId && !isNaN(parseInt(studentId))) {
      conditions.push(eq(enrollments.studentId, parseInt(studentId)));
    }
    
    if (courseId && !isNaN(parseInt(courseId))) {
      conditions.push(eq(enrollments.courseId, parseInt(courseId)));
    }
    
    if (status && VALID_STATUS_VALUES.includes(status)) {
      conditions.push(eq(enrollments.status, status));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const orderBy = order === 'asc' ? asc : desc;
    if (sort === 'enrollmentDate') {
      query = query.orderBy(orderBy(enrollments.enrollmentDate));
    } else if (sort === 'status') {
      query = query.orderBy(orderBy(enrollments.status));
    } else {
      query = query.orderBy(orderBy(enrollments.createdAt));
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { studentId, courseId, enrollmentDate, status } = body;

    // Validate required fields
    if (!studentId) {
      return NextResponse.json({ 
        error: "Student ID is required",
        code: "MISSING_STUDENT_ID" 
      }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ 
        error: "Course ID is required",
        code: "MISSING_COURSE_ID" 
      }, { status: 400 });
    }

    // Validate IDs are integers
    if (isNaN(parseInt(studentId))) {
      return NextResponse.json({ 
        error: "Valid student ID is required",
        code: "INVALID_STUDENT_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(courseId))) {
      return NextResponse.json({ 
        error: "Valid course ID is required",
        code: "INVALID_COURSE_ID" 
      }, { status: 400 });
    }

    // Validate status if provided
    if (status && !VALID_STATUS_VALUES.includes(status)) {
      return NextResponse.json({ 
        error: "Status must be one of: " + VALID_STATUS_VALUES.join(', '),
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }

    // Check if student exists
    const studentExists = await db.select().from(students).where(eq(students.id, parseInt(studentId))).limit(1);
    if (studentExists.length === 0) {
      return NextResponse.json({ 
        error: "Student not found",
        code: "STUDENT_NOT_FOUND" 
      }, { status: 400 });
    }

    // Check if course exists
    const courseExists = await db.select().from(courses).where(eq(courses.id, parseInt(courseId))).limit(1);
    if (courseExists.length === 0) {
      return NextResponse.json({ 
        error: "Course not found",
        code: "COURSE_NOT_FOUND" 
      }, { status: 400 });
    }

    // Check if enrollment already exists
    const existingEnrollment = await db.select()
      .from(enrollments)
      .where(and(
        eq(enrollments.studentId, parseInt(studentId)),
        eq(enrollments.courseId, parseInt(courseId))
      ))
      .limit(1);

    if (existingEnrollment.length > 0) {
      return NextResponse.json({ 
        error: "Student is already enrolled in this course",
        code: "ENROLLMENT_EXISTS" 
      }, { status: 400 });
    }

    const currentTimestamp = new Date().toISOString();
    
    const newEnrollment = await db.insert(enrollments)
      .values({
        studentId: parseInt(studentId),
        courseId: parseInt(courseId),
        enrollmentDate: enrollmentDate || currentTimestamp,
        status: status || 'active',
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp
      })
      .returning();

    return NextResponse.json(newEnrollment[0], { status: 201 });
  } catch (error) {
    console.error('POST error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const body = await request.json();
    const { studentId, courseId, enrollmentDate, status } = body;

    // Check if enrollment exists
    const existingEnrollment = await db.select()
      .from(enrollments)
      .where(eq(enrollments.id, parseInt(id)))
      .limit(1);

    if (existingEnrollment.length === 0) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    // Validate status if provided
    if (status && !VALID_STATUS_VALUES.includes(status)) {
      return NextResponse.json({ 
        error: "Status must be one of: " + VALID_STATUS_VALUES.join(', '),
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }

    // Validate foreign keys if being updated
    if (studentId !== undefined) {
      if (isNaN(parseInt(studentId))) {
        return NextResponse.json({ 
          error: "Valid student ID is required",
          code: "INVALID_STUDENT_ID" 
        }, { status: 400 });
      }

      const studentExists = await db.select().from(students).where(eq(students.id, parseInt(studentId))).limit(1);
      if (studentExists.length === 0) {
        return NextResponse.json({ 
          error: "Student not found",
          code: "STUDENT_NOT_FOUND" 
        }, { status: 400 });
      }
    }

    if (courseId !== undefined) {
      if (isNaN(parseInt(courseId))) {
        return NextResponse.json({ 
          error: "Valid course ID is required",
          code: "INVALID_COURSE_ID" 
        }, { status: 400 });
      }

      const courseExists = await db.select().from(courses).where(eq(courses.id, parseInt(courseId))).limit(1);
      if (courseExists.length === 0) {
        return NextResponse.json({ 
          error: "Course not found",
          code: "COURSE_NOT_FOUND" 
        }, { status: 400 });
      }
    }

    // Check for duplicate enrollment if student or course is being changed
    if ((studentId !== undefined || courseId !== undefined)) {
      const finalStudentId = studentId !== undefined ? parseInt(studentId) : existingEnrollment[0].studentId;
      const finalCourseId = courseId !== undefined ? parseInt(courseId) : existingEnrollment[0].courseId;

      const duplicateEnrollment = await db.select()
        .from(enrollments)
        .where(and(
          eq(enrollments.studentId, finalStudentId),
          eq(enrollments.courseId, finalCourseId),
          eq(enrollments.id, parseInt(id)) // Exclude current record
        ))
        .limit(1);

      if (duplicateEnrollment.length > 0 && duplicateEnrollment[0].id !== parseInt(id)) {
        return NextResponse.json({ 
          error: "Student is already enrolled in this course",
          code: "ENROLLMENT_EXISTS" 
        }, { status: 400 });
      }
    }

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (studentId !== undefined) updateData.studentId = parseInt(studentId);
    if (courseId !== undefined) updateData.courseId = parseInt(courseId);
    if (enrollmentDate !== undefined) updateData.enrollmentDate = enrollmentDate;
    if (status !== undefined) updateData.status = status;

    const updated = await db.update(enrollments)
      .set(updateData)
      .where(eq(enrollments.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0]);
  } catch (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    // Check if enrollment exists
    const existingEnrollment = await db.select()
      .from(enrollments)
      .where(eq(enrollments.id, parseInt(id)))
      .limit(1);

    if (existingEnrollment.length === 0) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    const deleted = await db.delete(enrollments)
      .where(eq(enrollments.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Enrollment not found' }, { status: 404 });
    }

    return NextResponse.json({
      message: 'Enrollment deleted successfully',
      deleted: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}