import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { fees, students } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/auth';

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { id } = params;
    
    // Validate ID parameter
    if (!id || isNaN(parseInt(id))) {
      return NextResponse.json({ 
        error: "Valid fee ID is required",
        code: "INVALID_ID" 
      }, { status: 400 });
    }

    const feeId = parseInt(id);
    const requestBody = await request.json();
    const { amount_paid, payment_method, transaction_id } = requestBody;

    // Security check: reject if userId provided in body
    if ('userId' in requestBody || 'user_id' in requestBody) {
      return NextResponse.json({ 
        error: "User ID cannot be provided in request body",
        code: "USER_ID_NOT_ALLOWED" 
      }, { status: 400 });
    }

    // Validate required fields
    if (amount_paid === undefined || amount_paid === null) {
      return NextResponse.json({ 
        error: "Amount paid is required",
        code: "MISSING_AMOUNT_PAID" 
      }, { status: 400 });
    }

    if (!payment_method || typeof payment_method !== 'string') {
      return NextResponse.json({ 
        error: "Payment method is required",
        code: "MISSING_PAYMENT_METHOD" 
      }, { status: 400 });
    }

    if (!transaction_id || typeof transaction_id !== 'string') {
      return NextResponse.json({ 
        error: "Transaction ID is required",
        code: "MISSING_TRANSACTION_ID" 
      }, { status: 400 });
    }

    // Validate amount_paid is a positive number
    if (typeof amount_paid !== 'number' || amount_paid <= 0) {
      return NextResponse.json({ 
        error: "Amount paid must be a positive number",
        code: "INVALID_AMOUNT" 
      }, { status: 400 });
    }

    // Check if fee exists and get student information
    const feeRecord = await db.select({
      fee: fees,
      student: students
    })
    .from(fees)
    .leftJoin(students, eq(fees.studentId, students.id))
    .where(eq(fees.id, feeId))
    .limit(1);

    if (feeRecord.length === 0) {
      return NextResponse.json({ 
        error: 'Fee record not found',
        code: "FEE_NOT_FOUND" 
      }, { status: 404 });
    }

    const { fee, student } = feeRecord[0];

    if (!student) {
      return NextResponse.json({ 
        error: 'Associated student not found',
        code: "STUDENT_NOT_FOUND" 
      }, { status: 404 });
    }

    // Check if fee is already paid
    if (fee.status === 'paid') {
      return NextResponse.json({ 
        error: 'Fee has already been paid',
        code: "FEE_ALREADY_PAID" 
      }, { status: 400 });
    }

    // Validate fee status (must be pending or overdue)
    if (fee.status !== 'pending' && fee.status !== 'overdue') {
      return NextResponse.json({ 
        error: 'Fee must be in pending or overdue status to process payment',
        code: "INVALID_FEE_STATUS" 
      }, { status: 400 });
    }

    // Validate amount matches
    if (Math.abs(amount_paid - fee.amount) > 0.01) { // Allow for small floating point differences
      return NextResponse.json({ 
        error: `Amount paid (${amount_paid}) does not match fee amount (${fee.amount})`,
        code: "AMOUNT_MISMATCH" 
      }, { status: 400 });
    }

    const currentTimestamp = new Date().toISOString();

    // Update fee record to paid status
    const updatedFee = await db.update(fees)
      .set({
        status: 'paid',
        paidDate: currentTimestamp,
        updatedAt: currentTimestamp
      })
      .where(eq(fees.id, feeId))
      .returning();

    if (updatedFee.length === 0) {
      return NextResponse.json({ 
        error: 'Failed to update fee record',
        code: "UPDATE_FAILED" 
      }, { status: 500 });
    }

    // Update student balance (reduce by the paid amount)
    const newBalance = (student.balance || 0) - amount_paid;
    await db.update(students)
      .set({
        balance: newBalance,
        updatedAt: currentTimestamp
      })
      .where(eq(students.id, student.id));

    // Create audit log entry (simple console log for now - in production you'd log to a proper audit table)
    console.log('PAYMENT_PROCESSED', {
      feeId: feeId,
      studentId: student.id,
      studentName: student.name,
      amount: amount_paid,
      paymentMethod: payment_method,
      transactionId: transaction_id,
      processedBy: user.id,
      processedAt: currentTimestamp,
      previousBalance: student.balance || 0,
      newBalance: newBalance
    });

    // Return the updated fee record with payment details
    const paymentResponse = {
      ...updatedFee[0],
      paymentDetails: {
        amount_paid,
        payment_method: payment_method.trim(),
        transaction_id: transaction_id.trim(),
        processed_by: user.id,
        processed_at: currentTimestamp
      },
      studentInfo: {
        id: student.id,
        name: student.name,
        previousBalance: student.balance || 0,
        newBalance: newBalance
      }
    };

    return NextResponse.json(paymentResponse, { status: 200 });

  } catch (error) {
    console.error('PUT /api/fees/[id]/payment error:', error);
    return NextResponse.json({ 
      error: 'Internal server error: ' + error 
    }, { status: 500 });
  }
}