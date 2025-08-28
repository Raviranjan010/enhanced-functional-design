import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const VALID_ROLES = ['student', 'faculty', 'admin'];
const SALT_ROUNDS = 12;

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();
    const { email, password, name, role } = requestBody;

    // Validate all required fields are present
    if (!email) {
      return NextResponse.json({ 
        error: "Email is required",
        code: "MISSING_EMAIL" 
      }, { status: 400 });
    }

    if (!password) {
      return NextResponse.json({ 
        error: "Password is required",
        code: "MISSING_PASSWORD" 
      }, { status: 400 });
    }

    if (!name) {
      return NextResponse.json({ 
        error: "Name is required",
        code: "MISSING_NAME" 
      }, { status: 400 });
    }

    if (!role) {
      return NextResponse.json({ 
        error: "Role is required",
        code: "MISSING_ROLE" 
      }, { status: 400 });
    }

    // Validate role is one of the allowed values
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ 
        error: "Role must be one of: student, faculty, admin",
        code: "INVALID_ROLE" 
      }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ 
        error: "Invalid email format",
        code: "INVALID_EMAIL_FORMAT" 
      }, { status: 400 });
    }

    // Validate password strength (minimum 6 characters)
    if (password.length < 6) {
      return NextResponse.json({ 
        error: "Password must be at least 6 characters long",
        code: "WEAK_PASSWORD" 
      }, { status: 400 });
    }

    // Sanitize inputs
    const sanitizedEmail = email.trim().toLowerCase();
    const sanitizedName = name.trim();

    // Check if email is unique
    const existingUser = await db.select()
      .from(users)
      .where(eq(users.email, sanitizedEmail))
      .limit(1);

    if (existingUser.length > 0) {
      return NextResponse.json({ 
        error: "Email already exists",
        code: "DUPLICATE_EMAIL" 
      }, { status: 409 });
    }

    // Hash password with bcrypt
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    // Create user record with auto-generated timestamps
    const currentTimestamp = new Date().toISOString();
    
    const newUser = await db.insert(users)
      .values({
        email: sanitizedEmail,
        passwordHash,
        name: sanitizedName,
        role,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp
      })
      .returning();

    if (newUser.length === 0) {
      throw new Error('Failed to create user record');
    }

    // Return user object without password
    const { passwordHash: _, ...userWithoutPassword } = newUser[0];

    console.log(`New user registered: ${sanitizedEmail} with role ${role}`);

    return NextResponse.json({
      message: "User registered successfully",
      user: userWithoutPassword
    }, { status: 201 });

  } catch (error: any) {
    console.error('POST registration error:', error);
    
    // Handle specific database errors
    if (error.message?.includes('UNIQUE constraint failed')) {
      return NextResponse.json({ 
        error: "Email already exists",
        code: "DUPLICATE_EMAIL" 
      }, { status: 409 });
    }

    return NextResponse.json({ 
      error: 'Internal server error: ' + error.message 
    }, { status: 500 });
  }
}