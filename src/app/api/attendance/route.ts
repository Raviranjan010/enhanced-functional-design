import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { attendance, students, courses } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // Single record fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }
      
      const record = await db.select()
        .from(attendance)
        .where(eq(attendance.id, parseInt(id)))
        .limit(1);
      
      if (record.length === 0) {
        return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
      }
      
      return NextResponse.json(record[0]);
    }
    
    // List with pagination and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const studentId = searchParams.get('student_id');
    const courseId = searchParams.get('course_id');
    const date = searchParams.get('date');
    const status = searchParams.get('status');
    const session = searchParams.get('session');
    const sort = searchParams.get('sort') || 'date';
    const order = searchParams.get('order') || 'desc';
    
    let query = db.select().from(attendance);
    let conditions = [];
    
    // Filter by student_id
    if (studentId && !isNaN(parseInt(studentId))) {
      conditions.push(eq(attendance.studentId, parseInt(studentId)));
    }
    
    // Filter by course_id
    if (courseId && !isNaN(parseInt(courseId))) {
      conditions.push(eq(attendance.courseId, parseInt(courseId)));
    }
    
    // Filter by date
    if (date) {
      conditions.push(eq(attendance.date, date));
    }
    
    // Filter by status
    if (status && ['present', 'absent', 'late'].includes(status)) {
      conditions.push(eq(attendance.status, status));
    }
    
    // Filter by session
    if (session && ['morning', 'afternoon', 'evening'].includes(session)) {
      conditions.push(eq(attendance.session, session));
    }
    
    // Search functionality
    if (search) {
      const searchCondition = or(
        like(attendance.status, `%${search}%`),
        like(attendance.session, `%${search}%`),
        like(attendance.date, `%${search}%`)
      );
      conditions.push(searchCondition);
    }
    
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }
    
    // Sorting
    const sortColumn = sort === 'date' ? attendance.date : 
                      sort === 'status' ? attendance.status :
                      sort === 'session' ? attendance.session :
                      sort === 'createdAt' ? attendance.createdAt :
                      attendance.date;
    
    query = query.orderBy(order === 'asc' ? asc(sortColumn) : desc(sortColumn));
    
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
    const requestBody = await request.json();
    const { studentId, courseId, date, status, session } = requestBody;
    
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
    
    if (!date) {
      return NextResponse.json({ 
        error: "Date is required",
        code: "MISSING_DATE" 
      }, { status: 400 });
    }
    
    if (!status) {
      return NextResponse.json({ 
        error: "Status is required",
        code: "MISSING_STATUS" 
      }, { status: 400 });
    }
    
    if (!session) {
      return NextResponse.json({ 
        error: "Session is required",
        code: "MISSING_SESSION" 
      }, { status: 400 });
    }
    
    // Validate status values
    if (!['present', 'absent', 'late'].includes(status)) {
      return NextResponse.json({ 
        error: "Status must be one of: present, absent, late",
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }
    
    // Validate session values
    if (!['morning', 'afternoon', 'evening'].includes(session)) {
      return NextResponse.json({ 
        error: "Session must be one of: morning, afternoon, evening",
        code: "INVALID_SESSION" 
      }, { status: 400 });
    }
    
    // Validate ID formats
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
    
    // Validate date format (basic check)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return NextResponse.json({ 
        error: "Date must be in YYYY-MM-DD format",
        code: "INVALID_DATE_FORMAT" 
      }, { status: 400 });
    }
    
    // Check if student exists
    const studentExists = await db.select({ id: students.id })
      .from(students)
      .where(eq(students.id, parseInt(studentId)))
      .limit(1);
    
    if (studentExists.length === 0) {
      return NextResponse.json({ 
        error: "Student not found",
        code: "STUDENT_NOT_FOUND" 
      }, { status: 400 });
    }
    
    // Check if course exists
    const courseExists = await db.select({ id: courses.id })
      .from(courses)
      .where(eq(courses.id, parseInt(courseId)))
      .limit(1);
    
    if (courseExists.length === 0) {
      return NextResponse.json({ 
        error: "Course not found",
        code: "COURSE_NOT_FOUND" 
      }, { status: 400 });
    }
    
    const now = new Date().toISOString();
    
    const newRecord = await db.insert(attendance)
      .values({
        studentId: parseInt(studentId),
        courseId: parseInt(courseId),
        date,
        status,
        session,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    
    return NextResponse.json(newRecord[0], { status: 201 });
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
    
    const requestBody = await request.json();
    const { studentId, courseId, date, status, session } = requestBody;
    
    // Check if record exists
    const existingRecord = await db.select()
      .from(attendance)
      .where(eq(attendance.id, parseInt(id)))
      .limit(1);
    
    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }
    
    let updates: any = {};
    
    // Validate and update studentId if provided
    if (studentId !== undefined) {
      if (isNaN(parseInt(studentId))) {
        return NextResponse.json({ 
          error: "Valid student ID is required",
          code: "INVALID_STUDENT_ID" 
        }, { status: 400 });
      }
      
      // Check if student exists
      const studentExists = await db.select({ id: students.id })
        .from(students)
        .where(eq(students.id, parseInt(studentId)))
        .limit(1);
      
      if (studentExists.length === 0) {
        return NextResponse.json({ 
          error: "Student not found",
          code: "STUDENT_NOT_FOUND" 
        }, { status: 400 });
      }
      
      updates.studentId = parseInt(studentId);
    }
    
    // Validate and update courseId if provided
    if (courseId !== undefined) {
      if (isNaN(parseInt(courseId))) {
        return NextResponse.json({ 
          error: "Valid course ID is required",
          code: "INVALID_COURSE_ID" 
        }, { status: 400 });
      }
      
      // Check if course exists
      const courseExists = await db.select({ id: courses.id })
        .from(courses)
        .where(eq(courses.id, parseInt(courseId)))
        .limit(1);
      
      if (courseExists.length === 0) {
        return NextResponse.json({ 
          error: "Course not found",
          code: "COURSE_NOT_FOUND" 
        }, { status: 400 });
      }
      
      updates.courseId = parseInt(courseId);
    }
    
    // Validate and update date if provided
    if (date !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(date)) {
        return NextResponse.json({ 
          error: "Date must be in YYYY-MM-DD format",
          code: "INVALID_DATE_FORMAT" 
        }, { status: 400 });
      }
      updates.date = date;
    }
    
    // Validate and update status if provided
    if (status !== undefined) {
      if (!['present', 'absent', 'late'].includes(status)) {
        return NextResponse.json({ 
          error: "Status must be one of: present, absent, late",
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
      updates.status = status;
    }
    
    // Validate and update session if provided
    if (session !== undefined) {
      if (!['morning', 'afternoon', 'evening'].includes(session)) {
        return NextResponse.json({ 
          error: "Session must be one of: morning, afternoon, evening",
          code: "INVALID_SESSION" 
        }, { status: 400 });
      }
      updates.session = session;
    }
    
    // Always update timestamp
    updates.updatedAt = new Date().toISOString();
    
    const updated = await db.update(attendance)
      .set(updates)
      .where(eq(attendance.id, parseInt(id)))
      .returning();
    
    if (updated.length === 0) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
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
    
    // Check if record exists
    const existingRecord = await db.select()
      .from(attendance)
      .where(eq(attendance.id, parseInt(id)))
      .limit(1);
    
    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }
    
    const deleted = await db.delete(attendance)
      .where(eq(attendance.id, parseInt(id)))
      .returning();
    
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Attendance record not found' }, { status: 404 });
    }
    
    return NextResponse.json({
      message: 'Attendance record deleted successfully',
      deletedRecord: deleted[0]
    });
  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}