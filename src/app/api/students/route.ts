import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { students, users } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single student fetch by ID
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const student = await db.select()
        .from(students)
        .where(eq(students.id, parseInt(id)))
        .limit(1);

      if (student.length === 0) {
        return NextResponse.json({ 
          error: 'Student not found' 
        }, { status: 404 });
      }

      return NextResponse.json(student[0]);
    }

    // List students with pagination, search, filtering, and sorting
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const course = searchParams.get('course');
    const year = searchParams.get('year');
    const status = searchParams.get('status');
    const sort = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';

    let query = db.select().from(students);

    // Build where conditions
    const conditions = [];

    // Search across name, email, and course
    if (search) {
      conditions.push(
        or(
          like(students.name, `%${search}%`),
          like(students.email, `%${search}%`),
          like(students.course, `%${search}%`)
        )
      );
    }

    // Filter by course
    if (course) {
      conditions.push(eq(students.course, course));
    }

    // Filter by year
    if (year && !isNaN(parseInt(year))) {
      conditions.push(eq(students.year, parseInt(year)));
    }

    // Filter by status
    if (status) {
      conditions.push(eq(students.status, status));
    }

    // Apply conditions
    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Apply sorting
    const sortField = sort === 'name' ? students.name 
      : sort === 'enrollment_date' ? students.enrollmentDate
      : sort === 'year' ? students.year
      : students.name;

    query = order === 'desc' 
      ? query.orderBy(desc(sortField))
      : query.orderBy(asc(sortField));

    // Apply pagination
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
    const { name, email, course, year, userId, phone, address, balance } = requestBody;

    // Security check: reject if userId provided in body
    if ('userId' in requestBody || 'user_id' in requestBody) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate required fields
    if (!name) {
      return NextResponse.json({ 
        error: "Name is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!email) {
      return NextResponse.json({ 
        error: "Email is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!course) {
      return NextResponse.json({ 
        error: "Course is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!year || isNaN(parseInt(year))) {
      return NextResponse.json({ 
        error: "Valid year is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    // Validate userId reference if provided
    if (userId) {
      const userExists = await db.select()
        .from(users)
        .where(eq(users.id, parseInt(userId)))
        .limit(1);

      if (userExists.length === 0) {
        return NextResponse.json({ 
          error: "Referenced user does not exist",
          code: "INVALID_USER_REFERENCE" 
        }, { status: 400 });
      }
    }

    // Sanitize inputs
    const sanitizedEmail = email.toLowerCase().trim();
    const sanitizedName = name.trim();
    const currentTimestamp = new Date().toISOString();

    const newStudent = await db.insert(students)
      .values({
        userId: userId ? parseInt(userId) : null,
        name: sanitizedName,
        email: sanitizedEmail,
        course: course.trim(),
        year: parseInt(year),
        balance: balance ? parseFloat(balance) : 0,
        phone: phone?.trim() || null,
        address: address?.trim() || null,
        enrollmentDate: currentTimestamp,
        status: 'active',
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp
      })
      .returning();

    return NextResponse.json(newStudent[0], { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS' 
      }, { status: 400 });
    }
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

    // Security check: reject if userId provided in body
    if ('userId' in requestBody || 'user_id' in requestBody) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Check if student exists
    const existingStudent = await db.select()
      .from(students)
      .where(eq(students.id, parseInt(id)))
      .limit(1);

    if (existingStudent.length === 0) {
      return NextResponse.json({ 
        error: 'Student not found' 
      }, { status: 404 });
    }

    const { name, email, course, year, phone, address, balance, status } = requestBody;

    // Validate userId reference if provided
    if (requestBody.userId) {
      const userExists = await db.select()
        .from(users)
        .where(eq(users.id, parseInt(requestBody.userId)))
        .limit(1);

      if (userExists.length === 0) {
        return NextResponse.json({ 
          error: "Referenced user does not exist",
          code: "INVALID_USER_REFERENCE" 
        }, { status: 400 });
      }
    }

    // Build update object with only provided fields
    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (course !== undefined) updates.course = course.trim();
    if (year !== undefined) {
      if (isNaN(parseInt(year))) {
        return NextResponse.json({ 
          error: "Valid year is required",
          code: "INVALID_YEAR" 
        }, { status: 400 });
      }
      updates.year = parseInt(year);
    }
    if (phone !== undefined) updates.phone = phone?.trim() || null;
    if (address !== undefined) updates.address = address?.trim() || null;
    if (balance !== undefined) updates.balance = parseFloat(balance);
    if (status !== undefined) updates.status = status;

    const updatedStudent = await db.update(students)
      .set(updates)
      .where(eq(students.id, parseInt(id)))
      .returning();

    return NextResponse.json(updatedStudent[0]);

  } catch (error) {
    console.error('PUT error:', error);
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: 'Email already exists',
        code: 'EMAIL_ALREADY_EXISTS' 
      }, { status: 400 });
    }
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

    // Check if student exists
    const existingStudent = await db.select()
      .from(students)
      .where(eq(students.id, parseInt(id)))
      .limit(1);

    if (existingStudent.length === 0) {
      return NextResponse.json({ 
        error: 'Student not found' 
      }, { status: 404 });
    }

    const deletedStudent = await db.delete(students)
      .where(eq(students.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Student deleted successfully',
      deletedStudent: deletedStudent[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    if (error.message?.includes('FOREIGN KEY constraint failed')) {
      return NextResponse.json({ 
        error: 'Cannot delete student with associated records',
        code: 'FOREIGN_KEY_CONSTRAINT' 
      }, { status: 400 });
    }
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}