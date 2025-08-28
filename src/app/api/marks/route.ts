import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { marks, students, courses } from '@/db/schema';
import { eq, and, desc, asc } from 'drizzle-orm';

// Grade calculation helper function
function calculateGrade(totalMarks: number): string {
  if (totalMarks >= 90) return 'A';
  if (totalMarks >= 80) return 'B';
  if (totalMarks >= 70) return 'C';
  if (totalMarks >= 60) return 'D';
  return 'F';
}

// Calculate total marks from internal and external marks
function calculateTotalMarks(internalMarks: number, externalMarks: number): number {
  return (internalMarks || 0) + (externalMarks || 0);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const studentId = searchParams.get('student_id');
    const courseId = searchParams.get('course_id');
    const semester = searchParams.get('semester');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') || 'desc';

    // Single record by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const record = await db.select()
        .from(marks)
        .where(eq(marks.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ error: 'Marks record not found' }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with filtering
    let query = db.select().from(marks);
    const conditions: any[] = [];

    if (studentId) {
      if (isNaN(parseInt(studentId))) {
        return NextResponse.json({ 
          error: "Valid student_id is required",
          code: "INVALID_STUDENT_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(marks.studentId, parseInt(studentId)));
    }

    if (courseId) {
      if (isNaN(parseInt(courseId))) {
        return NextResponse.json({ 
          error: "Valid course_id is required",
          code: "INVALID_COURSE_ID" 
        }, { status: 400 });
      }
      conditions.push(eq(marks.courseId, parseInt(courseId)));
    }

    if (semester) {
      if (isNaN(parseInt(semester))) {
        return NextResponse.json({ 
          error: "Valid semester is required",
          code: "INVALID_SEMESTER" 
        }, { status: 400 });
      }
      conditions.push(eq(marks.semester, parseInt(semester)));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const orderBy = order === 'asc' ? asc : desc;
    const sortField = sort === 'totalMarks' ? marks.totalMarks :
                     sort === 'grade' ? marks.grade :
                     sort === 'semester' ? marks.semester :
                     marks.createdAt;
    
    query = query.orderBy(orderBy(sortField));

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
    const { studentId, courseId, semester, internalMarks, externalMarks } = requestBody;

    // Validate required fields
    if (!studentId) {
      return NextResponse.json({ 
        error: "student_id is required",
        code: "MISSING_STUDENT_ID" 
      }, { status: 400 });
    }

    if (!courseId) {
      return NextResponse.json({ 
        error: "course_id is required",
        code: "MISSING_COURSE_ID" 
      }, { status: 400 });
    }

    if (!semester) {
      return NextResponse.json({ 
        error: "semester is required",
        code: "MISSING_SEMESTER" 
      }, { status: 400 });
    }

    // Validate field types
    if (isNaN(parseInt(studentId))) {
      return NextResponse.json({ 
        error: "Valid student_id is required",
        code: "INVALID_STUDENT_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(courseId))) {
      return NextResponse.json({ 
        error: "Valid course_id is required",
        code: "INVALID_COURSE_ID" 
      }, { status: 400 });
    }

    if (isNaN(parseInt(semester))) {
      return NextResponse.json({ 
        error: "Valid semester is required",
        code: "INVALID_SEMESTER" 
      }, { status: 400 });
    }

    // Validate marks if provided
    if (internalMarks !== undefined && (isNaN(parseInt(internalMarks)) || parseInt(internalMarks) < 0 || parseInt(internalMarks) > 100)) {
      return NextResponse.json({ 
        error: "Internal marks must be a number between 0 and 100",
        code: "INVALID_INTERNAL_MARKS" 
      }, { status: 400 });
    }

    if (externalMarks !== undefined && (isNaN(parseInt(externalMarks)) || parseInt(externalMarks) < 0 || parseInt(externalMarks) > 100)) {
      return NextResponse.json({ 
        error: "External marks must be a number between 0 and 100",
        code: "INVALID_EXTERNAL_MARKS" 
      }, { status: 400 });
    }

    // Verify foreign key constraints
    const student = await db.select().from(students).where(eq(students.id, parseInt(studentId))).limit(1);
    if (student.length === 0) {
      return NextResponse.json({ 
        error: "Student not found",
        code: "STUDENT_NOT_FOUND" 
      }, { status: 400 });
    }

    const course = await db.select().from(courses).where(eq(courses.id, parseInt(courseId))).limit(1);
    if (course.length === 0) {
      return NextResponse.json({ 
        error: "Course not found",
        code: "COURSE_NOT_FOUND" 
      }, { status: 400 });
    }

    // Calculate total marks and grade
    const parsedInternalMarks = parseInt(internalMarks) || 0;
    const parsedExternalMarks = parseInt(externalMarks) || 0;
    const totalMarks = calculateTotalMarks(parsedInternalMarks, parsedExternalMarks);
    const grade = calculateGrade(totalMarks);

    const insertData = {
      studentId: parseInt(studentId),
      courseId: parseInt(courseId),
      semester: parseInt(semester),
      internalMarks: parsedInternalMarks,
      externalMarks: parsedExternalMarks,
      totalMarks,
      grade,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newRecord = await db.insert(marks)
      .values(insertData)
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
    const { studentId, courseId, semester, internalMarks, externalMarks } = requestBody;

    // Check if record exists
    const existingRecord = await db.select()
      .from(marks)
      .where(eq(marks.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Marks record not found' }, { status: 404 });
    }

    // Prepare update data
    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    // Validate and update fields if provided
    if (studentId !== undefined) {
      if (isNaN(parseInt(studentId))) {
        return NextResponse.json({ 
          error: "Valid student_id is required",
          code: "INVALID_STUDENT_ID" 
        }, { status: 400 });
      }

      const student = await db.select().from(students).where(eq(students.id, parseInt(studentId))).limit(1);
      if (student.length === 0) {
        return NextResponse.json({ 
          error: "Student not found",
          code: "STUDENT_NOT_FOUND" 
        }, { status: 400 });
      }

      updates.studentId = parseInt(studentId);
    }

    if (courseId !== undefined) {
      if (isNaN(parseInt(courseId))) {
        return NextResponse.json({ 
          error: "Valid course_id is required",
          code: "INVALID_COURSE_ID" 
        }, { status: 400 });
      }

      const course = await db.select().from(courses).where(eq(courses.id, parseInt(courseId))).limit(1);
      if (course.length === 0) {
        return NextResponse.json({ 
          error: "Course not found",
          code: "COURSE_NOT_FOUND" 
        }, { status: 400 });
      }

      updates.courseId = parseInt(courseId);
    }

    if (semester !== undefined) {
      if (isNaN(parseInt(semester))) {
        return NextResponse.json({ 
          error: "Valid semester is required",
          code: "INVALID_SEMESTER" 
        }, { status: 400 });
      }
      updates.semester = parseInt(semester);
    }

    if (internalMarks !== undefined) {
      if (isNaN(parseInt(internalMarks)) || parseInt(internalMarks) < 0 || parseInt(internalMarks) > 100) {
        return NextResponse.json({ 
          error: "Internal marks must be a number between 0 and 100",
          code: "INVALID_INTERNAL_MARKS" 
        }, { status: 400 });
      }
      updates.internalMarks = parseInt(internalMarks);
    }

    if (externalMarks !== undefined) {
      if (isNaN(parseInt(externalMarks)) || parseInt(externalMarks) < 0 || parseInt(externalMarks) > 100) {
        return NextResponse.json({ 
          error: "External marks must be a number between 0 and 100",
          code: "INVALID_EXTERNAL_MARKS" 
        }, { status: 400 });
      }
      updates.externalMarks = parseInt(externalMarks);
    }

    // Recalculate total marks and grade if marks are updated
    if (internalMarks !== undefined || externalMarks !== undefined) {
      const currentRecord = existingRecord[0];
      const newInternalMarks = updates.internalMarks !== undefined ? updates.internalMarks : currentRecord.internalMarks;
      const newExternalMarks = updates.externalMarks !== undefined ? updates.externalMarks : currentRecord.externalMarks;
      
      updates.totalMarks = calculateTotalMarks(newInternalMarks || 0, newExternalMarks || 0);
      updates.grade = calculateGrade(updates.totalMarks);
    }

    const updated = await db.update(marks)
      .set(updates)
      .where(eq(marks.id, parseInt(id)))
      .returning();

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
      .from(marks)
      .where(eq(marks.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Marks record not found' }, { status: 404 });
    }

    const deleted = await db.delete(marks)
      .where(eq(marks.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Marks record deleted successfully',
      record: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}