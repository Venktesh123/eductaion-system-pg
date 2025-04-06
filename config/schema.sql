-- DROP statements (to clean up if needed)
DROP TABLE IF EXISTS "EContentFiles";
DROP TABLE IF EXISTS "EContentModules";
DROP TABLE IF EXISTS "EContents";
DROP TABLE IF EXISTS "AssignmentAttachments";
DROP TABLE IF EXISTS "Submissions";
DROP TABLE IF EXISTS "Assignments";
DROP TABLE IF EXISTS "StudentCourses";
DROP TABLE IF EXISTS "Lectures";
DROP TABLE IF EXISTS "Courses";
DROP TABLE IF EXISTS "Students";
DROP TABLE IF EXISTS "Teachers";
DROP TABLE IF EXISTS "Events";
DROP TABLE IF EXISTS "Semesters";
DROP TABLE IF EXISTS "Users";

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create Users table
CREATE TABLE "Users" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255) UNIQUE NOT NULL,
  "password" VARCHAR(255) NOT NULL,
  "role" VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Teachers table
CREATE TABLE "Teachers" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
  "email" VARCHAR(255) NOT NULL UNIQUE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Semesters table
CREATE TABLE "Semesters" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "startDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "endDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Courses table
CREATE TABLE "Courses" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" VARCHAR(255) NOT NULL,
  "aboutCourse" TEXT NOT NULL,
  "semesterId" UUID NOT NULL REFERENCES "Semesters"("id") ON DELETE CASCADE,
  "teacherId" UUID NOT NULL REFERENCES "Teachers"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Students table
CREATE TABLE "Students" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "userId" UUID NOT NULL UNIQUE REFERENCES "Users"("id") ON DELETE CASCADE,
  "teacherId" UUID NOT NULL REFERENCES "Teachers"("id") ON DELETE CASCADE,
  "teacherEmail" VARCHAR(255) NOT NULL,
  "program" VARCHAR(255),
  "semester" VARCHAR(255),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Student-Course junction table
CREATE TABLE "StudentCourses" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "studentId" UUID NOT NULL REFERENCES "Students"("id") ON DELETE CASCADE,
  "courseId" UUID NOT NULL REFERENCES "Courses"("id") ON DELETE CASCADE,
  "enrollmentDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("studentId", "courseId")
);

-- Create Lectures table
CREATE TABLE "Lectures" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" VARCHAR(255) NOT NULL,
  "content" TEXT,
  "videoUrl" VARCHAR(1024),
  "videoKey" VARCHAR(1024),
  "courseId" UUID NOT NULL REFERENCES "Courses"("id") ON DELETE CASCADE,
  "isReviewed" BOOLEAN NOT NULL DEFAULT false,
  "reviewDeadline" TIMESTAMP WITH TIME ZONE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Assignments table
CREATE TABLE "Assignments" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "title" VARCHAR(255) NOT NULL,
  "description" TEXT NOT NULL,
  "courseId" UUID NOT NULL REFERENCES "Courses"("id") ON DELETE CASCADE,
  "dueDate" TIMESTAMP WITH TIME ZONE NOT NULL,
  "totalPoints" INTEGER NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create AssignmentAttachments table
CREATE TABLE "AssignmentAttachments" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "assignmentId" UUID NOT NULL REFERENCES "Assignments"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "url" VARCHAR(1024) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create Submissions table
CREATE TABLE "Submissions" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "assignmentId" UUID NOT NULL REFERENCES "Assignments"("id") ON DELETE CASCADE,
  "studentId" UUID NOT NULL REFERENCES "Students"("id") ON DELETE CASCADE,
  "submissionDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submissionFile" VARCHAR(1024) NOT NULL,
  "grade" FLOAT,
  "feedback" TEXT,
  "status" VARCHAR(50) NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'graded', 'returned')),
  "isLate" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("assignmentId", "studentId")
);

-- Create Events table
CREATE TABLE "Events" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "name" VARCHAR(255) NOT NULL,
  "description" TEXT,
  "date" TIMESTAMP WITH TIME ZONE NOT NULL,
  "time" VARCHAR(50) NOT NULL,
  "image" VARCHAR(1024) NOT NULL,
  "location" VARCHAR(255) NOT NULL,
  "link" VARCHAR(1024) NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create EContent tables
CREATE TABLE "EContents" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "courseId" UUID NOT NULL REFERENCES "Courses"("id") ON DELETE CASCADE,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("courseId")
);

CREATE TABLE "EContentModules" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "eContentId" UUID NOT NULL REFERENCES "EContents"("id") ON DELETE CASCADE,
  "moduleNumber" INTEGER NOT NULL,
  "moduleTitle" VARCHAR(255) NOT NULL,
  "link" VARCHAR(1024),
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "EContentFiles" (
  "id" UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  "moduleId" UUID NOT NULL REFERENCES "EContentModules"("id") ON DELETE CASCADE,
  "fileType" VARCHAR(50) NOT NULL CHECK (fileType IN ('pdf', 'ppt', 'pptx', 'other')),
  "fileUrl" VARCHAR(1024) NOT NULL,
  "fileKey" VARCHAR(1024) NOT NULL,
  "fileName" VARCHAR(255) NOT NULL,
  "uploadDate" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX "idx_users_email" ON "Users"("email");
CREATE INDEX "idx_teachers_email" ON "Teachers"("email");
CREATE INDEX "idx_students_teacherId" ON "Students"("teacherId");
CREATE INDEX "idx_courses_teacherId" ON "Courses"("teacherId");
CREATE INDEX "idx_courses_semesterId" ON "Courses"("semesterId");
CREATE INDEX "idx_lectures_courseId" ON "Lectures"("courseId");
CREATE INDEX "idx_assignments_courseId" ON "Assignments"("courseId");
CREATE INDEX "idx_submissions_assignmentId" ON "Submissions"("assignmentId");
CREATE INDEX "idx_submissions_studentId" ON "Submissions"("studentId");
CREATE INDEX "idx_studentcourses_studentId" ON "StudentCourses"("studentId");
CREATE INDEX "idx_studentcourses_courseId" ON "StudentCourses"("courseId");
CREATE INDEX "idx_econtentmodules_eContentId" ON "EContentModules"("eContentId");
CREATE INDEX "idx_econtentfiles_moduleId" ON "EContentFiles"("moduleId");