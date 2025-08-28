import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { courses, enrollments } from '@/db/schema';
import { eq, like, and, or, desc, asc, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    // Single course by ID with enrollment details
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const course = await db.select()
        .from(courses)
        .where(eq(courses.id, parseInt(id)))
        .limit(1);

      if (course.length === 0) {
        return NextResponse.json({ 
          error: 'Course not found' 
        }, { status: 404 });
      }

      // Get enrollment count for this course
      const enrollmentCount = await db.select({ count: count() })
        .from(enrollments)
        .where(and(eq(enrollments.courseId, parseInt(id)), eq(enrollments.status, 'active')));

      const courseWithEnrollments = {
        ...course[0],
        activeEnrollments: enrollmentCount[0]?.count || 0
      };

      return NextResponse.json(courseWithEnrollments);
    }

    // List courses with pagination, search, and filtering
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const sort = searchParams.get('sort') || 'title';
    const order = searchParams.get('order') || 'asc';

    let query = db.select().from(courses);
    let conditions = [];

    // Search functionality
    if (search) {
      const searchCondition = or(
        like(courses.title, `%${search}%`),
        like(courses.code, `%${search}%`),
        like(courses.department, `%${search}%`)
      );
      conditions.push(searchCondition);
    }

    // Department filter
    if (department) {
      conditions.push(eq(courses.department, department));
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const validSortFields = ['title', 'code', 'credits', 'department', 'createdAt'];
    const sortField = validSortFields.includes(sort) ? sort : 'title';
    const sortOrder = order === 'desc' ? desc : asc;
    
    query = query.orderBy(sortOrder(courses[sortField as keyof typeof courses]));

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
    const { title, code, credits, department, syllabus } = body;

    // Validate required fields
    if (!title) {
      return NextResponse.json({ 
        error: "Title is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!code) {
      return NextResponse.json({ 
        error: "Course code is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!credits || isNaN(parseInt(credits))) {
      return NextResponse.json({ 
        error: "Valid credits value is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!department) {
      return NextResponse.json({ 
        error: "Department is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    // Check if course code is unique
    const existingCourse = await db.select()
      .from(courses)
      .where(eq(courses.code, code.trim()))
      .limit(1);

    if (existingCourse.length > 0) {
      return NextResponse.json({ 
        error: "Course code already exists",
        code: "DUPLICATE_CODE" 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedData = {
      title: title.trim(),
      code: code.trim().toUpperCase(),
      credits: parseInt(credits),
      department: department.trim(),
      syllabus: syllabus ? syllabus.trim() : null,
      enrolledCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newCourse = await db.insert(courses)
      .values(sanitizedData)
      .returning();

    return NextResponse.json(newCourse[0], { status: 201 });

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
    const { title, code, credits, department, syllabus } = body;

    // Check if course exists
    const existingCourse = await db.select()
      .from(courses)
      .where(eq(courses.id, parseInt(id)))
      .limit(1);

    if (existingCourse.length === 0) {
      return NextResponse.json({ 
        error: 'Course not found' 
      }, { status: 404 });
    }

    // Validate fields if provided
    if (credits && isNaN(parseInt(credits))) {
      return NextResponse.json({ 
        error: "Valid credits value is required",
        code: "INVALID_CREDITS" 
      }, { status: 400 });
    }

    // Check if course code is unique (if being updated)
    if (code && code.trim() !== existingCourse[0].code) {
      const duplicateCourse = await db.select()
        .from(courses)
        .where(eq(courses.code, code.trim().toUpperCase()))
        .limit(1);

      if (duplicateCourse.length > 0) {
        return NextResponse.json({ 
          error: "Course code already exists",
          code: "DUPLICATE_CODE" 
        }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (title) updateData.title = title.trim();
    if (code) updateData.code = code.trim().toUpperCase();
    if (credits) updateData.credits = parseInt(credits);
    if (department) updateData.department = department.trim();
    if (syllabus !== undefined) updateData.syllabus = syllabus ? syllabus.trim() : null;

    const updated = await db.update(courses)
      .set(updateData)
      .where(eq(courses.id, parseInt(id)))
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

    // Check if course exists
    const existingCourse = await db.select()
      .from(courses)
      .where(eq(courses.id, parseInt(id)))
      .limit(1);

    if (existingCourse.length === 0) {
      return NextResponse.json({ 
        error: 'Course not found' 
      }, { status: 404 });
    }

    // Check for existing enrollments
    const activeEnrollments = await db.select()
      .from(enrollments)
      .where(and(eq(enrollments.courseId, parseInt(id)), eq(enrollments.status, 'active')))
      .limit(1);

    if (activeEnrollments.length > 0) {
      return NextResponse.json({ 
        error: "Cannot delete course with active enrollments",
        code: "COURSE_HAS_ENROLLMENTS" 
      }, { status: 400 });
    }

    const deleted = await db.delete(courses)
      .where(eq(courses.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: "Course deleted successfully",
      deletedCourse: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}