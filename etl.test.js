const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeStudentRecords, normalizeStudentName, normalizeProgramCode } = require('./script.js');

test('normalizes student names and program codes consistently', () => {
  assert.equal(normalizeStudentName(' JUAN   dela CRUZ '), 'Juan Dela Cruz');
  assert.equal(normalizeProgramCode(' bsit '), 'BSIT');
});

test('merges SIS, LMS and accounting records without dropping SIS students', () => {
  const sis = [
    { student_id: '1001', student_name: 'JUAN dela CRUZ', program_code: 'bsit', email: 'JUAN.DC@EXAMPLE.COM' },
    { student_id: '1004', student_name: 'ANA GARCIA', program_code: 'BSIS', email: 'ana.garcia@example.com' },
    { student_id: '1006', student_name: 'Liza Mendoza', program_code: 'BSIT', email: 'liza.mendoza@example.com' },
  ];

  const lms = [
    { student_id: '1001', course_code: 'IT101', final_grade: '1.50', completion_status: 'Completed' },
    { student_id: '1006', course_code: 'IT101', final_grade: 'INC', completion_status: 'In Progress' },
  ];

  const accounting = [
    { student_id: '1001', account_balance: '0', currency: 'PHP' },
    { student_id: '1004', account_balance: '2500.50', currency: 'PHP' },
  ];

  const output = mergeStudentRecords(sis, lms, accounting);

  assert.deepEqual(output, [
    {
      studentId: 1001,
      studentName: 'Juan Dela Cruz',
      program: 'Bachelor of Science in Information Technology',
      emailAddress: 'juan.dc@example.com',
      courseCode: 'IT101',
      finalGrade: 1.5,
      completionStatus: 'Completed',
      outstandingBalance: 0,
      currency: 'PHP',
    },
    {
      studentId: 1004,
      studentName: 'Ana Garcia',
      program: 'Bachelor of Science in Information Systems',
      emailAddress: 'ana.garcia@example.com',
      courseCode: null,
      finalGrade: null,
      completionStatus: null,
      outstandingBalance: 2500.5,
      currency: 'PHP',
    },
    {
      studentId: 1006,
      studentName: 'Liza Mendoza',
      program: 'Bachelor of Science in Information Technology',
      emailAddress: 'liza.mendoza@example.com',
      courseCode: 'IT101',
      finalGrade: 'INC',
      completionStatus: 'In Progress',
      outstandingBalance: null,
      currency: null,
    },
  ]);
});
