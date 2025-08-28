"use client";

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  GraduationCap, 
  PanelRightOpen, 
  NotebookTabs, 
  TableOfContents, 
  Component,
  Table as TableIcon,
  LayoutPanelTop,
  PanelRightDashed,
  PanelTop,
  PanelBottomOpen,
  TableRowsSplit,
  UnfoldHorizontal,
  SquareMenu
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';

interface Student {
  id: string;
  name: string;
  email: string;
  course: string;
  year: number;
  balance: number;
  phone?: string;
  address?: string;
  enrollmentDate?: string;
  status?: 'active' | 'inactive' | 'alumni';
}

interface Course {
  id: string;
  title: string;
  code: string;
  credits: number;
  department: string;
  syllabus?: string;
  enrolledCount?: number;
}

interface Fee {
  id: string;
  studentId: string;
  studentName: string;
  amount: number;
  dueDate: string;
  paidDate?: string;
  status: 'pending' | 'paid' | 'overdue';
  type: 'tuition' | 'lab' | 'library' | 'other';
}

interface Mark {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  semester: string;
  internal: number;
  external: number;
  total: number;
  grade: string;
}

interface Faculty {
  id: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  salary: number;
  lastPaymentDate?: string;
  assignedCourses?: string[];
}

interface Attendance {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseName: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  session: string;
}

interface AdminConsoleProps {
  userRole?: 'admin' | 'faculty';
  onSignOut?: () => void;
}

export default function AdminConsole({ userRole = 'admin', onSignOut }: AdminConsoleProps) {
  const [activeTab, setActiveTab] = useState('students');
  const [globalSearch, setGlobalSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Data states
  const [students, setStudents] = useState<Student[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [faculty, setFaculty] = useState<Faculty[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  
  // UI states
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({});
  const [semesterFilter, setSemesterFilter] = useState('');
  
  // Forms
  const studentForm = useForm<Student>();
  const courseForm = useForm<Course>();
  const feeForm = useForm<Fee>();
  const markForm = useForm<Mark>();
  const facultyForm = useForm<Faculty>();
  const paymentForm = useForm<{ amount: number; date: string; method: string }>();

  // API configuration
  const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';
  const JWT_TOKEN = typeof window !== 'undefined' ? localStorage.getItem('jwt') : null;

  const apiHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    'Authorization': JWT_TOKEN ? `Bearer ${JWT_TOKEN}` : '',
    'X-API-Version': '1.0'
  }), [JWT_TOKEN]);

  // API functions
  const fetchData = useCallback(async (endpoint: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}${endpoint}`, { headers: apiHeaders });
      
      if (response.status === 401 || response.status === 403) {
        toast.error('Session expired. Please log in again.');
        if (onSignOut) onSignOut();
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error('API Error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
      toast.error('Failed to fetch data. Please try again.');
      return null;
    } finally {
      setLoading(false);
    }
  }, [API_BASE, apiHeaders, onSignOut]);

  const saveData = useCallback(async (endpoint: string, data: any, method = 'POST') => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method,
        headers: apiHeaders,
        body: JSON.stringify(data)
      });
      
      if (response.status === 401 || response.status === 403) {
        toast.error('Session expired. Please log in again.');
        if (onSignOut) onSignOut();
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (err) {
      console.error('Save Error:', err);
      toast.error('Failed to save data. Please try again.');
      return null;
    }
  }, [API_BASE, apiHeaders, onSignOut]);

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      switch (activeTab) {
        case 'students':
          const studentsData = await fetchData('/students');
          if (studentsData) setStudents(studentsData);
          break;
        case 'courses':
          const coursesData = await fetchData('/courses');
          if (coursesData) setCourses(coursesData);
          break;
        case 'fees':
          const feesData = await fetchData('/fees');
          if (feesData) setFees(feesData);
          break;
        case 'marks':
          const marksData = await fetchData('/marks');
          if (marksData) setMarks(marksData);
          break;
        case 'faculty':
          const facultyData = await fetchData('/faculty');
          if (facultyData) setFaculty(facultyData);
          break;
        case 'attendance':
          const attendanceData = await fetchData('/attendance');
          if (attendanceData) setAttendance(attendanceData);
          break;
      }
    };

    loadInitialData();
  }, [activeTab, fetchData]);

  // Filtered data
  const filteredStudents = useMemo(() => {
    return students.filter(student => 
      student.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
      student.email.toLowerCase().includes(globalSearch.toLowerCase()) ||
      student.course.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [students, globalSearch]);

  const filteredCourses = useMemo(() => {
    return courses.filter(course => 
      course.title.toLowerCase().includes(globalSearch.toLowerCase()) ||
      course.code.toLowerCase().includes(globalSearch.toLowerCase()) ||
      course.department.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [courses, globalSearch]);

  const filteredFees = useMemo(() => {
    return fees.filter(fee => 
      fee.studentName.toLowerCase().includes(globalSearch.toLowerCase()) ||
      fee.type.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [fees, globalSearch]);

  const filteredMarks = useMemo(() => {
    return marks.filter(mark => 
      mark.studentName.toLowerCase().includes(globalSearch.toLowerCase()) ||
      mark.courseName.toLowerCase().includes(globalSearch.toLowerCase()) ||
      (semesterFilter && mark.semester === semesterFilter)
    );
  }, [marks, globalSearch, semesterFilter]);

  const filteredFaculty = useMemo(() => {
    return faculty.filter(f => 
      f.name.toLowerCase().includes(globalSearch.toLowerCase()) ||
      f.department.toLowerCase().includes(globalSearch.toLowerCase()) ||
      f.designation.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [faculty, globalSearch]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter(a => 
      a.studentName.toLowerCase().includes(globalSearch.toLowerCase()) ||
      a.courseName.toLowerCase().includes(globalSearch.toLowerCase())
    );
  }, [attendance, globalSearch]);

  // Handle create/edit operations
  const handleSaveStudent = async (data: Student) => {
    const endpoint = editMode ? `/students/${selectedItem.id}` : '/students';
    const method = editMode ? 'PUT' : 'POST';
    
    const result = await saveData(endpoint, data, method);
    if (result) {
      if (editMode) {
        setStudents(prev => prev.map(s => s.id === selectedItem.id ? result : s));
        toast.success('Student updated successfully');
      } else {
        setStudents(prev => [result, ...prev]);
        toast.success('Student created successfully');
      }
      setDialogOpen(false);
      studentForm.reset();
    }
  };

  const handleSaveCourse = async (data: Course) => {
    const endpoint = editMode ? `/courses/${selectedItem.id}` : '/courses';
    const method = editMode ? 'PUT' : 'POST';
    
    const result = await saveData(endpoint, data, method);
    if (result) {
      if (editMode) {
        setCourses(prev => prev.map(c => c.id === selectedItem.id ? result : c));
        toast.success('Course updated successfully');
      } else {
        setCourses(prev => [result, ...prev]);
        toast.success('Course created successfully');
      }
      setDialogOpen(false);
      courseForm.reset();
    }
  };

  const handleSaveFaculty = async (data: Faculty) => {
    const endpoint = editMode ? `/faculty/${selectedItem.id}` : '/faculty';
    const method = editMode ? 'PUT' : 'POST';
    
    const result = await saveData(endpoint, data, method);
    if (result) {
      if (editMode) {
        setFaculty(prev => prev.map(f => f.id === selectedItem.id ? result : f));
        toast.success('Faculty updated successfully');
      } else {
        setFaculty(prev => [result, ...prev]);
        toast.success('Faculty created successfully');
      }
      setDialogOpen(false);
      facultyForm.reset();
    }
  };

  const handleRecordPayment = async (data: { amount: number; date: string; method: string }) => {
    const result = await saveData(`/fees/${selectedItem.id}/payment`, data, 'POST');
    if (result) {
      setFees(prev => prev.map(f => f.id === selectedItem.id ? { ...f, ...result } : f));
      toast.success('Payment recorded successfully');
      setDialogOpen(false);
      paymentForm.reset();
    }
  };

  const handleDelete = async (id: string, type: string) => {
    const result = await saveData(`/${type}/${id}`, {}, 'DELETE');
    if (result) {
      switch (type) {
        case 'students':
          setStudents(prev => prev.filter(s => s.id !== id));
          break;
        case 'courses':
          setCourses(prev => prev.filter(c => c.id !== id));
          break;
        case 'faculty':
          setFaculty(prev => prev.filter(f => f.id !== id));
          break;
      }
      toast.success(`${type.slice(0, -1)} deleted successfully`);
    }
  };

  const handleExport = async (type: string) => {
    try {
      const response = await fetch(`${API_BASE}/${type}/export`, { headers: apiHeaders });
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}-export.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        toast.success(`${type} exported successfully`);
      }
    } catch (err) {
      toast.error('Export failed');
    }
  };

  const openCreateDialog = (type: string) => {
    setSelectedItem(null);
    setEditMode(false);
    setDialogOpen(true);
  };

  const openEditDialog = (item: any) => {
    setSelectedItem(item);
    setEditMode(true);
    setDialogOpen(true);
    
    // Pre-populate form based on item type
    if (activeTab === 'students') studentForm.reset(item);
    else if (activeTab === 'courses') courseForm.reset(item);
    else if (activeTab === 'faculty') facultyForm.reset(item);
  };

  const openViewDrawer = (item: any) => {
    setSelectedItem(item);
    setDrawerOpen(true);
  };

  // Render loading skeleton
  const renderLoadingSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center space-x-4">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );

  // Render empty state
  const renderEmptyState = (type: string, action: () => void) => (
    <div className="text-center py-12">
      <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
        <GraduationCap className="w-8 h-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No {type} found</h3>
      <p className="text-muted-foreground mb-4">
        Get started by adding your first {type.slice(0, -1)}.
      </p>
      <Button onClick={action}>Add {type.slice(0, -1)}</Button>
    </div>
  );

  // Render error state
  const renderErrorState = () => (
    <div className="text-center py-12">
      <div className="mx-auto w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mb-4">
        <Component className="w-8 h-8 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Something went wrong</h3>
      <p className="text-muted-foreground mb-4">{error}</p>
      <Button onClick={() => window.location.reload()}>Try Again</Button>
    </div>
  );

  return (
    <div className="bg-card min-h-screen">
      {/* Top Toolbar */}
      <div className="border-b bg-card px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold">Admin Console</h1>
            <div className="relative">
              <Input
                placeholder="Search across all modules..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                className="w-80"
              />
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {activeTab === 'students' && (
              <>
                <Button onClick={() => openCreateDialog('students')}>
                  <GraduationCap className="w-4 h-4 mr-2" />
                  New Student
                </Button>
                <Button variant="outline" onClick={() => handleExport('students')}>
                  Export CSV
                </Button>
              </>
            )}
            
            {activeTab === 'courses' && (
              <>
                <Button onClick={() => openCreateDialog('courses')}>
                  <NotebookTabs className="w-4 h-4 mr-2" />
                  New Course
                </Button>
                <Button variant="outline" onClick={() => handleExport('courses')}>
                  Export CSV
                </Button>
              </>
            )}
            
            {activeTab === 'faculty' && (
              <>
                <Button onClick={() => openCreateDialog('faculty')}>
                  <Component className="w-4 h-4 mr-2" />
                  New Faculty
                </Button>
                <Button variant="outline" onClick={() => handleExport('faculty')}>
                  Export CSV
                </Button>
              </>
            )}
            
            <Select value={semesterFilter} onValueChange={setSemesterFilter}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Semester" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="fall2024">Fall 2024</SelectItem>
                <SelectItem value="spring2024">Spring 2024</SelectItem>
                <SelectItem value="summer2024">Summer 2024</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="students" className="flex items-center space-x-2">
              <GraduationCap className="w-4 h-4" />
              <span>Students</span>
            </TabsTrigger>
            <TabsTrigger value="courses" className="flex items-center space-x-2">
              <NotebookTabs className="w-4 h-4" />
              <span>Courses</span>
            </TabsTrigger>
            <TabsTrigger value="fees" className="flex items-center space-x-2">
              <TableOfContents className="w-4 h-4" />
              <span>Fees</span>
            </TabsTrigger>
            <TabsTrigger value="marks" className="flex items-center space-x-2">
              <PanelTop className="w-4 h-4" />
              <span>Marks</span>
            </TabsTrigger>
            <TabsTrigger value="faculty" className="flex items-center space-x-2">
              <Component className="w-4 h-4" />
              <span>Faculty</span>
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex items-center space-x-2">
              <TableRowsSplit className="w-4 h-4" />
              <span>Attendance</span>
            </TabsTrigger>
          </TabsList>

          {/* Students Tab */}
          <TabsContent value="students" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Students Management</CardTitle>
                <CardDescription>Manage student records, profiles, and academic information</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredStudents.length === 0 ? renderEmptyState('students', () => openCreateDialog('students')) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <Checkbox 
                          checked={selectedItems.size === filteredStudents.length}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedItems(new Set(filteredStudents.map(s => s.id)));
                            } else {
                              setSelectedItems(new Set());
                            }
                          }}
                        />
                        <Label>Select All ({selectedItems.size} selected)</Label>
                      </div>
                      {selectedItems.size > 0 && (
                        <Button variant="outline">Bulk Actions</Button>
                      )}
                    </div>
                    
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Select</TableHead>
                          <TableHead>ID</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Course</TableHead>
                          <TableHead>Year</TableHead>
                          <TableHead>Balance</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((student) => (
                          <TableRow key={student.id}>
                            <TableCell>
                              <Checkbox 
                                checked={selectedItems.has(student.id)}
                                onCheckedChange={(checked) => {
                                  const newSelected = new Set(selectedItems);
                                  if (checked) {
                                    newSelected.add(student.id);
                                  } else {
                                    newSelected.delete(student.id);
                                  }
                                  setSelectedItems(newSelected);
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono">{student.id}</TableCell>
                            <TableCell className="font-medium">{student.name}</TableCell>
                            <TableCell>{student.email}</TableCell>
                            <TableCell>{student.course}</TableCell>
                            <TableCell>{student.year}</TableCell>
                            <TableCell>
                              <Badge variant={student.balance > 0 ? "destructive" : "default"}>
                                ${student.balance.toFixed(2)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant={student.status === 'active' ? "default" : student.status === 'inactive' ? "secondary" : "outline"}>
                                {student.status || 'active'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <SquareMenu className="w-4 h-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onClick={() => openViewDrawer(student)}>
                                    View Details
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => openEditDialog(student)}>
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    View Payments
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {userRole === 'admin' && (
                                    <DropdownMenuItem 
                                      className="text-destructive"
                                      onClick={() => handleDelete(student.id, 'students')}
                                    >
                                      Delete
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Courses Tab */}
          <TabsContent value="courses" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Courses Management</CardTitle>
                <CardDescription>Manage course catalog, credits, and enrollment</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredCourses.length === 0 ? renderEmptyState('courses', () => openCreateDialog('courses')) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Code</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Enrolled</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCourses.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((course) => (
                        <TableRow key={course.id}>
                          <TableCell className="font-mono">{course.code}</TableCell>
                          <TableCell className="font-medium">{course.title}</TableCell>
                          <TableCell>{course.department}</TableCell>
                          <TableCell>{course.credits}</TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {course.enrolledCount || 0} students
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <SquareMenu className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => openViewDrawer(course)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(course)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {userRole === 'admin' && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDelete(course.id, 'courses')}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fees Tab */}
          <TabsContent value="fees" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Fees Management</CardTitle>
                <CardDescription>Track student fees, payments, and outstanding balances</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredFees.length === 0 ? renderEmptyState('fees', () => {}) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFees.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((fee) => (
                        <TableRow key={fee.id}>
                          <TableCell className="font-medium">{fee.studentName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{fee.type}</Badge>
                          </TableCell>
                          <TableCell>${fee.amount.toFixed(2)}</TableCell>
                          <TableCell>{format(new Date(fee.dueDate), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant={fee.status === 'paid' ? "default" : fee.status === 'overdue' ? "destructive" : "secondary"}>
                              {fee.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <SquareMenu className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => {
                                  setSelectedItem(fee);
                                  setDialogOpen(true);
                                }}>
                                  Record Payment
                                </DropdownMenuItem>
                                <DropdownMenuItem>
                                  View Receipt
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Marks Tab */}
          <TabsContent value="marks" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Marks Management</CardTitle>
                <CardDescription>Manage student grades and academic performance</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredMarks.length === 0 ? renderEmptyState('marks', () => {}) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Semester</TableHead>
                        <TableHead>Internal</TableHead>
                        <TableHead>External</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Grade</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMarks.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((mark) => (
                        <TableRow key={mark.id}>
                          <TableCell className="font-medium">{mark.studentName}</TableCell>
                          <TableCell>{mark.courseName}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{mark.semester}</Badge>
                          </TableCell>
                          <TableCell>{mark.internal}</TableCell>
                          <TableCell>{mark.external}</TableCell>
                          <TableCell className="font-bold">{mark.total}</TableCell>
                          <TableCell>
                            <Badge variant={mark.grade === 'A' ? "default" : mark.grade === 'F' ? "destructive" : "secondary"}>
                              {mark.grade}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <PanelRightOpen className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Faculty Tab */}
          <TabsContent value="faculty" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Faculty Management</CardTitle>
                <CardDescription>Manage faculty records, assignments, and payroll</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredFaculty.length === 0 ? renderEmptyState('faculty', () => openCreateDialog('faculty')) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Department</TableHead>
                        <TableHead>Designation</TableHead>
                        <TableHead>Salary</TableHead>
                        <TableHead>Last Payment</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFaculty.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((f) => (
                        <TableRow key={f.id}>
                          <TableCell className="font-medium">{f.name}</TableCell>
                          <TableCell>{f.email}</TableCell>
                          <TableCell>{f.department}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{f.designation}</Badge>
                          </TableCell>
                          <TableCell>${f.salary.toLocaleString()}</TableCell>
                          <TableCell>
                            {f.lastPaymentDate ? format(new Date(f.lastPaymentDate), 'MMM dd, yyyy') : 'N/A'}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <SquareMenu className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <DropdownMenuItem onClick={() => openViewDrawer(f)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEditDialog(f)}>
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                {userRole === 'admin' && (
                                  <DropdownMenuItem 
                                    className="text-destructive"
                                    onClick={() => handleDelete(f.id, 'faculty')}
                                  >
                                    Delete
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Attendance Management</CardTitle>
                <CardDescription>Track and manage student attendance records</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? renderLoadingSkeleton() : 
                 error ? renderErrorState() :
                 filteredAttendance.length === 0 ? renderEmptyState('attendance', () => {}) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Course</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Session</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendance.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((att) => (
                        <TableRow key={att.id}>
                          <TableCell className="font-medium">{att.studentName}</TableCell>
                          <TableCell>{att.courseName}</TableCell>
                          <TableCell>{format(new Date(att.date), 'MMM dd, yyyy')}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{att.session}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={att.status === 'present' ? "default" : att.status === 'absent' ? "destructive" : "secondary"}>
                              {att.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Button variant="ghost" size="sm">
                              <TableRowsSplit className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Student Form Dialog */}
      <Dialog open={dialogOpen && activeTab === 'students'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Student' : 'Add New Student'}</DialogTitle>
            <DialogDescription>
              {editMode ? 'Update student information' : 'Enter student details to create a new record'}
            </DialogDescription>
          </DialogHeader>
          <Form {...studentForm}>
            <form onSubmit={studentForm.handleSubmit(handleSaveStudent)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter student name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="student@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={studentForm.control}
                  name="course"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select course" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="computer-science">Computer Science</SelectItem>
                          <SelectItem value="mathematics">Mathematics</SelectItem>
                          <SelectItem value="physics">Physics</SelectItem>
                          <SelectItem value="chemistry">Chemistry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={studentForm.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select year" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="1">1st Year</SelectItem>
                          <SelectItem value="2">2nd Year</SelectItem>
                          <SelectItem value="3">3rd Year</SelectItem>
                          <SelectItem value="4">4th Year</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={studentForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter phone number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={studentForm.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Address</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Enter address" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editMode ? 'Update Student' : 'Add Student'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Course Form Dialog */}
      <Dialog open={dialogOpen && activeTab === 'courses'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Course' : 'Add New Course'}</DialogTitle>
            <DialogDescription>
              {editMode ? 'Update course information' : 'Enter course details to create a new record'}
            </DialogDescription>
          </DialogHeader>
          <Form {...courseForm}>
            <form onSubmit={courseForm.handleSubmit(handleSaveCourse)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={courseForm.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Course Code</FormLabel>
                      <FormControl>
                        <Input placeholder="CS101" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={courseForm.control}
                  name="credits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Credits</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="3" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={courseForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Course Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Introduction to Computer Science" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={courseForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Department</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="computer-science">Computer Science</SelectItem>
                        <SelectItem value="mathematics">Mathematics</SelectItem>
                        <SelectItem value="physics">Physics</SelectItem>
                        <SelectItem value="chemistry">Chemistry</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editMode ? 'Update Course' : 'Add Course'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Faculty Form Dialog */}
      <Dialog open={dialogOpen && activeTab === 'faculty'} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editMode ? 'Edit Faculty' : 'Add New Faculty'}</DialogTitle>
            <DialogDescription>
              {editMode ? 'Update faculty information' : 'Enter faculty details to create a new record'}
            </DialogDescription>
          </DialogHeader>
          <Form {...facultyForm}>
            <form onSubmit={facultyForm.handleSubmit(handleSaveFaculty)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={facultyForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter faculty name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={facultyForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="faculty@example.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={facultyForm.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select department" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="computer-science">Computer Science</SelectItem>
                          <SelectItem value="mathematics">Mathematics</SelectItem>
                          <SelectItem value="physics">Physics</SelectItem>
                          <SelectItem value="chemistry">Chemistry</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={facultyForm.control}
                  name="designation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Designation</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select designation" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="professor">Professor</SelectItem>
                          <SelectItem value="associate-professor">Associate Professor</SelectItem>
                          <SelectItem value="assistant-professor">Assistant Professor</SelectItem>
                          <SelectItem value="lecturer">Lecturer</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={facultyForm.control}
                name="salary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Salary</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="50000" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  {editMode ? 'Update Faculty' : 'Add Faculty'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Payment Form Dialog */}
      <Dialog open={dialogOpen && activeTab === 'fees'} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Record a payment for {selectedItem?.studentName}
            </DialogDescription>
          </DialogHeader>
          <Form {...paymentForm}>
            <form onSubmit={paymentForm.handleSubmit(handleRecordPayment)} className="space-y-4">
              <FormField
                control={paymentForm.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Amount</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" placeholder="0.00" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={paymentForm.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select payment method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Cash</SelectItem>
                        <SelectItem value="check">Check</SelectItem>
                        <SelectItem value="card">Credit/Debit Card</SelectItem>
                        <SelectItem value="bank-transfer">Bank Transfer</SelectItem>
                        <SelectItem value="online">Online Payment</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Record Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Detail View Drawer */}
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerContent className="max-w-2xl mx-auto">
          <DrawerHeader>
            <DrawerTitle>
              {activeTab === 'students' && selectedItem && `${selectedItem.name} - Student Profile`}
              {activeTab === 'courses' && selectedItem && `${selectedItem.title} - Course Details`}
              {activeTab === 'faculty' && selectedItem && `${selectedItem.name} - Faculty Profile`}
            </DrawerTitle>
            <DrawerDescription>
              Detailed information and quick actions
            </DrawerDescription>
          </DrawerHeader>
          
          <div className="p-6 space-y-6">
            {activeTab === 'students' && selectedItem && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Student ID</Label>
                    <p className="font-mono">{selectedItem.id}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p>{selectedItem.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Course</Label>
                    <p>{selectedItem.course}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Year</Label>
                    <p>{selectedItem.year}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Balance</Label>
                    <p className={selectedItem.balance > 0 ? 'text-destructive font-semibold' : 'text-green-600'}>
                      ${selectedItem.balance.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Status</Label>
                    <Badge variant={selectedItem.status === 'active' ? "default" : "secondary"}>
                      {selectedItem.status || 'active'}
                    </Badge>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Quick Actions</h4>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <PanelRightOpen className="w-4 h-4 mr-2" />
                      View Attendance
                    </Button>
                    <Button variant="outline" size="sm">
                      <TableOfContents className="w-4 h-4 mr-2" />
                      View Marks
                    </Button>
                    <Button variant="outline" size="sm">
                      <Component className="w-4 h-4 mr-2" />
                      Print Report Card
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'courses' && selectedItem && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Course Code</Label>
                    <p className="font-mono">{selectedItem.code}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Credits</Label>
                    <p>{selectedItem.credits}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                    <p>{selectedItem.department}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Enrolled Students</Label>
                    <p>{selectedItem.enrolledCount || 0}</p>
                  </div>
                </div>
                
                {selectedItem.syllabus && (
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Syllabus</Label>
                    <Button variant="link" className="p-0 h-auto">
                      View Syllabus
                    </Button>
                  </div>
                )}
              </div>
            )}
            
            {activeTab === 'faculty' && selectedItem && (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Email</Label>
                    <p>{selectedItem.email}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Department</Label>
                    <p>{selectedItem.department}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Designation</Label>
                    <p>{selectedItem.designation}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Salary</Label>
                    <p>${selectedItem.salary.toLocaleString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-muted-foreground">Last Payment</Label>
                    <p>{selectedItem.lastPaymentDate ? format(new Date(selectedItem.lastPaymentDate), 'MMM dd, yyyy') : 'N/A'}</p>
                  </div>
                </div>
                
                <Separator />
                
                <div className="space-y-4">
                  <h4 className="font-semibold">Assigned Courses</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedItem.assignedCourses?.map((course: string) => (
                      <Badge key={course} variant="outline">{course}</Badge>
                    )) || <p className="text-muted-foreground">No courses assigned</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DrawerFooter>
            <Button onClick={() => setDrawerOpen(false)}>Close</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}