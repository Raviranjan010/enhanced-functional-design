import { db } from '@/db';
import { attendance, enrollments } from '@/db/schema';

async function main() {
    // First, get all active enrollments to create attendance records for
    const activeEnrollments = await db.select().from(enrollments).where(eq(enrollments.status, 'active'));
    
    if (activeEnrollments.length === 0) {
        console.log('⚠️ No active enrollments found. Please seed enrollments first.');
        return;
    }

    const sessions = ['morning', 'afternoon', 'evening'];
    const statuses = ['present', 'absent', 'late'];
    const statusDistribution = [
        ...Array(75).fill('present'),
        ...Array(20).fill('absent'),
        ...Array(5).fill('late')
    ];

    // Generate dates for the last 8 months (current academic year)
    const endDate = new Date();
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - 8);
    
    const attendanceRecords = [];

    // Student attendance patterns (some students have better attendance)
    const studentAttendanceProfiles = {};
    activeEnrollments.forEach(enrollment => {
        const profileType = Math.random();
        if (profileType < 0.3) {
            // Excellent students (90%+ attendance)
            studentAttendanceProfiles[enrollment.studentId] = {
                presentWeight: 90,
                absentWeight: 7,
                lateWeight: 3
            };
        } else if (profileType < 0.7) {
            // Average students (75-85% attendance)
            studentAttendanceProfiles[enrollment.studentId] = {
                presentWeight: 80,
                absentWeight: 15,
                lateWeight: 5
            };
        } else {
            // Poor attendance students (60-70% attendance)
            studentAttendanceProfiles[enrollment.studentId] = {
                presentWeight: 65,
                absentWeight: 30,
                lateWeight: 5
            };
        }
    });

    // Generate attendance records for each enrollment
    for (const enrollment of activeEnrollments) {
        const profile = studentAttendanceProfiles[enrollment.studentId];
        let consecutiveAbsences = 0;
        
        // Generate attendance for each day over the 8-month period
        for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
            // Skip weekends
            if (date.getDay() === 0 || date.getDay() === 6) continue;
            
            // More records for recent dates (higher probability)
            const daysSinceStart = (date - startDate) / (1000 * 60 * 60 * 24);
            const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
            const recentWeight = daysSinceStart / totalDays; // 0 to 1, higher for recent dates
            
            // Skip some early dates (lower probability for older dates)
            if (Math.random() > 0.4 + (recentWeight * 0.5)) continue;
            
            // Each day can have multiple sessions
            const sessionsForDay = Math.random() < 0.7 ? 
                [sessions[Math.floor(Math.random() * 3)]] : // Single session
                sessions.slice(0, Math.floor(Math.random() * 2) + 1); // Multiple sessions
            
            for (const session of sessionsForDay) {
                let status;
                
                // Prevent too many consecutive absences (realistic pattern)
                if (consecutiveAbsences >= 3) {
                    status = 'present';
                    consecutiveAbsences = 0;
                } else {
                    // Use weighted random selection based on student profile
                    const rand = Math.random() * 100;
                    if (rand < profile.presentWeight) {
                        status = 'present';
                        consecutiveAbsences = 0;
                    } else if (rand < profile.presentWeight + profile.absentWeight) {
                        status = 'absent';
                        consecutiveAbsences++;
                    } else {
                        status = 'late';
                        consecutiveAbsences = 0;
                    }
                }
                
                const recordDate = new Date(date);
                attendanceRecords.push({
                    studentId: enrollment.studentId,
                    courseId: enrollment.courseId,
                    date: recordDate.toISOString().split('T')[0], // YYYY-MM-DD format
                    status: status,
                    session: session,
                    createdAt: new Date(recordDate.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                    updatedAt: new Date(recordDate.getTime() + Math.random() * 24 * 60 * 60 * 1000).toISOString(),
                });
            }
        }
    }

    // Shuffle records to avoid patterns in insertion order
    for (let i = attendanceRecords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [attendanceRecords[i], attendanceRecords[j]] = [attendanceRecords[j], attendanceRecords[i]];
    }

    console.log(`Generated ${attendanceRecords.length} attendance records for ${activeEnrollments.length} enrollments`);
    
    // Insert in batches to handle large dataset
    const batchSize = 100;
    for (let i = 0; i < attendanceRecords.length; i += batchSize) {
        const batch = attendanceRecords.slice(i, i + batchSize);
        await db.insert(attendance).values(batch);
        console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(attendanceRecords.length / batchSize)}`);
    }
    
    console.log('✅ Attendance seeder completed successfully');
}

main().catch((error) => {
    console.error('❌ Seeder failed:', error);
});