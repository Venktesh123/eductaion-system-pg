const User = require("./User");
const Teacher = require("./Teacher");
const Student = require("./Student");
const Course = require("./Course");
const Semester = require("./Semester");
const Lecture = require("./Lecture");
const Assignment = require("./Assignment");
const AssignmentAttachment = require("./AssignmentAttachment");
const Submission = require("./Submission");
const Event = require("./Event");
const EContent = require("./EContent");
const EContentModule = require("./EContentModule");
const EContentFile = require("./EContentFile");
const StudentCourse = require("./StudentCourse");

// User associations
User.hasOne(Teacher, { foreignKey: "userId", onDelete: "CASCADE" });
Teacher.belongsTo(User, { foreignKey: "userId" });

User.hasOne(Student, { foreignKey: "userId", onDelete: "CASCADE" });
Student.belongsTo(User, { foreignKey: "userId" });

// Teacher associations
Teacher.hasMany(Student, { foreignKey: "teacherId" });
Student.belongsTo(Teacher, { foreignKey: "teacherId" });

Teacher.hasMany(Course, { foreignKey: "teacherId" });
Course.belongsTo(Teacher, { foreignKey: "teacherId" });

// Semester associations
Semester.hasMany(Course, { foreignKey: "semesterId" });
Course.belongsTo(Semester, { foreignKey: "semesterId" });

// Course associations
Course.hasMany(Lecture, { foreignKey: "courseId", onDelete: "CASCADE" });
Lecture.belongsTo(Course, { foreignKey: "courseId" });

Course.hasMany(Assignment, { foreignKey: "courseId", onDelete: "CASCADE" });
Assignment.belongsTo(Course, { foreignKey: "courseId" });

// Student-Course many-to-many relationship
Student.belongsToMany(Course, {
  through: StudentCourse,
  foreignKey: "studentId",
});
Course.belongsToMany(Student, {
  through: StudentCourse,
  foreignKey: "courseId",
});

// Assignment associations
Assignment.hasMany(AssignmentAttachment, {
  foreignKey: "assignmentId",
  onDelete: "CASCADE",
});
AssignmentAttachment.belongsTo(Assignment, { foreignKey: "assignmentId" });

Assignment.hasMany(Submission, {
  foreignKey: "assignmentId",
  onDelete: "CASCADE",
});
Submission.belongsTo(Assignment, { foreignKey: "assignmentId" });

// Student-Submission association
Student.hasMany(Submission, { foreignKey: "studentId" });
Submission.belongsTo(Student, { foreignKey: "studentId" });

// EContent associations
Course.hasOne(EContent, { foreignKey: "courseId", onDelete: "CASCADE" });
EContent.belongsTo(Course, { foreignKey: "courseId" });

EContent.hasMany(EContentModule, {
  foreignKey: "eContentId",
  onDelete: "CASCADE",
});
EContentModule.belongsTo(EContent, { foreignKey: "eContentId" });

EContentModule.hasMany(EContentFile, {
  foreignKey: "moduleId",
  onDelete: "CASCADE",
});
EContentFile.belongsTo(EContentModule, { foreignKey: "moduleId" });

module.exports = {
  User,
  Teacher,
  Student,
  Course,
  Semester,
  Lecture,
  Assignment,
  AssignmentAttachment,
  Submission,
  Event,
  EContent,
  EContentModule,
  EContentFile,
  StudentCourse,
};
