import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { faculty, users } from '@/db/schema';
import { eq, like, and, or, desc, asc } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Single faculty fetch
    if (id) {
      if (!id || isNaN(parseInt(id))) {
        return NextResponse.json({ 
          error: "Valid ID is required",
          code: "INVALID_ID" 
        }, { status: 400 });
      }

      const facultyRecord = await db.select()
        .from(faculty)
        .where(eq(faculty.id, parseInt(id)))
        .limit(1);

      if (facultyRecord.length === 0) {
        return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
      }

      return NextResponse.json(facultyRecord[0], { status: 200 });
    }

    // List faculty with pagination and filters
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const department = searchParams.get('department');
    const designation = searchParams.get('designation');
    const sort = searchParams.get('sort') || 'name';
    const order = searchParams.get('order') || 'asc';

    let query = db.select().from(faculty);

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(
        or(
          like(faculty.name, `%${search}%`),
          like(faculty.email, `%${search}%`),
          like(faculty.department, `%${search}%`)
        )
      );
    }

    if (department) {
      conditions.push(eq(faculty.department, department));
    }

    if (designation) {
      conditions.push(eq(faculty.designation, designation));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Add sorting
    const sortColumn = sort === 'name' ? faculty.name :
                      sort === 'department' ? faculty.department :
                      sort === 'designation' ? faculty.designation :
                      sort === 'salary' ? faculty.salary :
                      faculty.name;

    if (order === 'desc') {
      query = query.orderBy(desc(sortColumn));
    } else {
      query = query.orderBy(asc(sortColumn));
    }

    const results = await query.limit(limit).offset(offset);

    return NextResponse.json(results, { status: 200 });

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
    const { name, email, department, designation, salary, userId, lastPaymentDate, assignedCourses } = requestBody;

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

    if (!department) {
      return NextResponse.json({ 
        error: "Department is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!designation) {
      return NextResponse.json({ 
        error: "Designation is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    if (!salary || isNaN(parseFloat(salary))) {
      return NextResponse.json({ 
        error: "Valid salary is required",
        code: "MISSING_REQUIRED_FIELD" 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: "Invalid email format",
        code: "INVALID_EMAIL" 
      }, { status: 400 });
    }

    // Validate userId exists if provided
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

    // Prepare insert data
    const insertData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      department: department.trim(),
      designation: designation.trim(),
      salary: parseFloat(salary),
      userId: userId ? parseInt(userId) : null,
      lastPaymentDate: lastPaymentDate || null,
      assignedCourses: assignedCourses || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newFaculty = await db.insert(faculty)
      .values(insertData)
      .returning();

    return NextResponse.json(newFaculty[0], { status: 201 });

  } catch (error) {
    console.error('POST error:', error);
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: "Email already exists",
        code: "EMAIL_ALREADY_EXISTS" 
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
    const { name, email, department, designation, salary, userId, lastPaymentDate, assignedCourses } = requestBody;

    // Check if faculty exists
    const existingFaculty = await db.select()
      .from(faculty)
      .where(eq(faculty.id, parseInt(id)))
      .limit(1);

    if (existingFaculty.length === 0) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
    }

    // Validate email format if provided
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return NextResponse.json({ 
          error: "Invalid email format",
          code: "INVALID_EMAIL" 
        }, { status: 400 });
      }
    }

    // Validate salary if provided
    if (salary !== undefined && isNaN(parseFloat(salary))) {
      return NextResponse.json({ 
        error: "Invalid salary value",
        code: "INVALID_SALARY" 
      }, { status: 400 });
    }

    // Validate userId exists if provided
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

    // Prepare update data
    const updates = {
      updatedAt: new Date().toISOString()
    };

    if (name !== undefined) updates.name = name.trim();
    if (email !== undefined) updates.email = email.toLowerCase().trim();
    if (department !== undefined) updates.department = department.trim();
    if (designation !== undefined) updates.designation = designation.trim();
    if (salary !== undefined) updates.salary = parseFloat(salary);
    if (userId !== undefined) updates.userId = userId ? parseInt(userId) : null;
    if (lastPaymentDate !== undefined) updates.lastPaymentDate = lastPaymentDate;
    if (assignedCourses !== undefined) updates.assignedCourses = assignedCourses;

    const updated = await db.update(faculty)
      .set(updates)
      .where(eq(faculty.id, parseInt(id)))
      .returning();

    if (updated.length === 0) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
    }

    return NextResponse.json(updated[0], { status: 200 });

  } catch (error) {
    console.error('PUT error:', error);
    if (error.message && error.message.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: "Email already exists",
        code: "EMAIL_ALREADY_EXISTS" 
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

    // Check if faculty exists
    const existingFaculty = await db.select()
      .from(faculty)
      .where(eq(faculty.id, parseInt(id)))
      .limit(1);

    if (existingFaculty.length === 0) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
    }

    const deleted = await db.delete(faculty)
      .where(eq(faculty.id, parseInt(id)))
      .returning();

    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Faculty not found' }, { status: 404 });
    }

    return NextResponse.json({ 
      message: 'Faculty deleted successfully',
      deletedFaculty: deleted[0] 
    }, { status: 200 });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}