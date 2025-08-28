import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fees, students } from '@/db/schema';
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
        .from(fees)
        .where(eq(fees.id, parseInt(id)))
        .limit(1);

      if (record.length === 0) {
        return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });
      }

      return NextResponse.json(record[0]);
    }

    // List with pagination, filtering, and sorting
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const search = searchParams.get('search');
    const studentId = searchParams.get('student_id');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const sort = searchParams.get('sort') || 'createdAt';
    const order = searchParams.get('order') === 'asc' ? asc : desc;

    let query = db.select().from(fees);

    // Build where conditions
    const conditions = [];

    if (search) {
      conditions.push(or(
        like(fees.type, `%${search}%`),
        like(fees.status, `%${search}%`)
      ));
    }

    if (studentId && !isNaN(parseInt(studentId))) {
      conditions.push(eq(fees.studentId, parseInt(studentId)));
    }

    if (status) {
      conditions.push(eq(fees.status, status));
    }

    if (type) {
      conditions.push(eq(fees.type, type));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions));
    }

    // Add sorting
    let orderByColumn;
    switch (sort) {
      case 'dueDate':
        orderByColumn = fees.dueDate;
        break;
      case 'amount':
        orderByColumn = fees.amount;
        break;
      case 'createdAt':
        orderByColumn = fees.createdAt;
        break;
      default:
        orderByColumn = fees.createdAt;
    }

    const results = await query
      .orderBy(order(orderByColumn))
      .limit(limit)
      .offset(offset);

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
    const { studentId, amount, dueDate, type, status, paidDate } = requestBody;

    // Validate required fields
    if (!studentId || typeof studentId !== 'number') {
      return NextResponse.json({ 
        error: "Student ID is required and must be a number",
        code: "MISSING_STUDENT_ID" 
      }, { status: 400 });
    }

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ 
        error: "Amount is required and must be a positive number",
        code: "INVALID_AMOUNT" 
      }, { status: 400 });
    }

    if (!dueDate || typeof dueDate !== 'string') {
      return NextResponse.json({ 
        error: "Due date is required",
        code: "MISSING_DUE_DATE" 
      }, { status: 400 });
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ 
        error: "Fee type is required",
        code: "MISSING_TYPE" 
      }, { status: 400 });
    }

    // Validate fee type
    const validTypes = ['tuition', 'exam', 'library', 'hostel'];
    if (!validTypes.includes(type)) {
      return NextResponse.json({ 
        error: "Invalid fee type. Must be one of: " + validTypes.join(', '),
        code: "INVALID_TYPE" 
      }, { status: 400 });
    }

    // Validate status if provided
    const validStatuses = ['pending', 'paid', 'overdue'];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ 
        error: "Invalid status. Must be one of: " + validStatuses.join(', '),
        code: "INVALID_STATUS" 
      }, { status: 400 });
    }

    // Validate due date format (basic ISO date check)
    if (isNaN(Date.parse(dueDate))) {
      return NextResponse.json({ 
        error: "Due date must be a valid date",
        code: "INVALID_DUE_DATE" 
      }, { status: 400 });
    }

    // Check if student exists
    const studentExists = await db.select()
      .from(students)
      .where(eq(students.id, studentId))
      .limit(1);

    if (studentExists.length === 0) {
      return NextResponse.json({ 
        error: "Student not found",
        code: "STUDENT_NOT_FOUND" 
      }, { status: 400 });
    }

    // Validate paid date if provided
    if (paidDate && isNaN(Date.parse(paidDate))) {
      return NextResponse.json({ 
        error: "Paid date must be a valid date",
        code: "INVALID_PAID_DATE" 
      }, { status: 400 });
    }

    // Create fee record
    const newFee = await db.insert(fees)
      .values({
        studentId,
        amount,
        dueDate,
        type,
        status: status || 'pending',
        paidDate: paidDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();

    return NextResponse.json(newFee[0], { status: 201 });

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
    const { studentId, amount, dueDate, type, status, paidDate } = requestBody;

    // Check if record exists
    const existingRecord = await db.select()
      .from(fees)
      .where(eq(fees.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });
    }

    // Validate fields if provided
    if (studentId !== undefined) {
      if (typeof studentId !== 'number') {
        return NextResponse.json({ 
          error: "Student ID must be a number",
          code: "INVALID_STUDENT_ID" 
        }, { status: 400 });
      }

      // Check if student exists
      const studentExists = await db.select()
        .from(students)
        .where(eq(students.id, studentId))
        .limit(1);

      if (studentExists.length === 0) {
        return NextResponse.json({ 
          error: "Student not found",
          code: "STUDENT_NOT_FOUND" 
        }, { status: 400 });
      }
    }

    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      return NextResponse.json({ 
        error: "Amount must be a positive number",
        code: "INVALID_AMOUNT" 
      }, { status: 400 });
    }

    if (dueDate !== undefined && isNaN(Date.parse(dueDate))) {
      return NextResponse.json({ 
        error: "Due date must be a valid date",
        code: "INVALID_DUE_DATE" 
      }, { status: 400 });
    }

    if (type !== undefined) {
      const validTypes = ['tuition', 'exam', 'library', 'hostel'];
      if (!validTypes.includes(type)) {
        return NextResponse.json({ 
          error: "Invalid fee type. Must be one of: " + validTypes.join(', '),
          code: "INVALID_TYPE" 
        }, { status: 400 });
      }
    }

    if (status !== undefined) {
      const validStatuses = ['pending', 'paid', 'overdue'];
      if (!validStatuses.includes(status)) {
        return NextResponse.json({ 
          error: "Invalid status. Must be one of: " + validStatuses.join(', '),
          code: "INVALID_STATUS" 
        }, { status: 400 });
      }
    }

    if (paidDate !== undefined && paidDate !== null && isNaN(Date.parse(paidDate))) {
      return NextResponse.json({ 
        error: "Paid date must be a valid date",
        code: "INVALID_PAID_DATE" 
      }, { status: 400 });
    }

    // Build update object with only provided fields
    const updates: any = {
      updatedAt: new Date().toISOString()
    };

    if (studentId !== undefined) updates.studentId = studentId;
    if (amount !== undefined) updates.amount = amount;
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (type !== undefined) updates.type = type;
    if (status !== undefined) updates.status = status;
    if (paidDate !== undefined) updates.paidDate = paidDate;

    const updated = await db.update(fees)
      .set(updates)
      .where(eq(fees.id, parseInt(id)))
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
      .from(fees)
      .where(eq(fees.id, parseInt(id)))
      .limit(1);

    if (existingRecord.length === 0) {
      return NextResponse.json({ error: 'Fee record not found' }, { status: 404 });
    }

    const deleted = await db.delete(fees)
      .where(eq(fees.id, parseInt(id)))
      .returning();

    return NextResponse.json({
      message: 'Fee record deleted successfully',
      deletedRecord: deleted[0]
    });

  } catch (error) {
    console.error('DELETE error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}