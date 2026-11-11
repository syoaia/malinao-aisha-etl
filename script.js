(function (global) {
  const PROGRAM_MAP = {
    BSIT: 'Bachelor of Science in Information Technology',
    BSCS: 'Bachelor of Science in Computer Science',
    BSIS: 'Bachelor of Science in Information Systems',
  };

  const DATA_MAPPING = [
    { sourceSystem: 'SIS', sourceField: 'student_id', targetField: 'studentId', targetType: 'Integer', rule: 'Convert text to integer; preserve as identifier.' },
    { sourceSystem: 'SIS', sourceField: 'student_name', targetField: 'studentName', targetType: 'String', rule: 'Trim spaces; normalize to proper case.' },
    { sourceSystem: 'SIS', sourceField: 'program_code', targetField: 'program', targetType: 'String', rule: 'Trim and uppercase code; map to full program name.' },
    { sourceSystem: 'SIS', sourceField: 'email', targetField: 'emailAddress', targetType: 'String', rule: 'Trim spaces; convert to lowercase.' },
    { sourceSystem: 'LMS', sourceField: 'course_code', targetField: 'courseCode', targetType: 'String', rule: 'Trim and uppercase.' },
    { sourceSystem: 'LMS', sourceField: 'final_grade', targetField: 'finalGrade', targetType: 'Number or String', rule: 'Convert numeric grades to number; preserve non-numeric values such as INC.' },
    { sourceSystem: 'LMS', sourceField: 'completion_status', targetField: 'completionStatus', targetType: 'String', rule: 'Trim and normalize capitalization consistently.' },
    { sourceSystem: 'Accounting', sourceField: 'account_balance', targetField: 'outstandingBalance', targetType: 'Number', rule: 'Trim and convert to decimal number.' },
    { sourceSystem: 'Accounting', sourceField: 'currency', targetField: 'currency', targetType: 'String', rule: 'Trim and uppercase.' },
  ];

  function normalizeText(value) {
    return String(value ?? '')
      .trim()
      .replace(/\s+/g, ' ');
  }

  function normalizeStudentName(value) {
    const cleaned = normalizeText(value);
    if (!cleaned) {
      return '';
    }

    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  function normalizeProgramCode(value) {
    return normalizeText(value).toUpperCase();
  }

  function normalizeEmailAddress(value) {
    return normalizeText(value).toLowerCase();
  }

  function normalizeCompletionStatus(value) {
    const cleaned = normalizeText(value);
    if (!cleaned) {
      return null;
    }

    return cleaned
      .toLowerCase()
      .replace(/[_-]+/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  function normalizeCourseCode(value) {
    return normalizeText(value).toUpperCase() || null;
  }

  function parseInteger(value) {
    const cleaned = normalizeText(value);
    if (!cleaned) {
      return null;
    }

    const numeric = Number.parseInt(cleaned, 10);
    return Number.isFinite(numeric) ? numeric : null;
  }

  function parseDecimal(value) {
    const cleaned = normalizeText(value);
    if (!cleaned) {
      return null;
    }

    const numeric = Number.parseFloat(String(cleaned).replace(/[^0-9.-]/g, ''));
    return Number.isFinite(numeric) ? Number(numeric.toFixed(2)) : null;
  }

  function normalizeFinalGrade(value) {
    const cleaned = normalizeText(value);
    if (!cleaned) {
      return null;
    }

    if (/^(inc|incomplete|ip|in progress)$/i.test(cleaned)) {
      return cleaned.toUpperCase() === 'INC' ? 'INC' : cleaned;
    }

    const numeric = Number(cleaned);
    if (Number.isFinite(numeric)) {
      return numeric;
    }

    return cleaned;
  }

  function parseCSV(csvText) {
    const rows = [];
    let currentRow = [];
    let currentValue = '';
    let inQuotes = false;

    for (let i = 0; i < csvText.length; i += 1) {
      const char = csvText[i];
      const nextChar = csvText[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentValue += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        currentRow.push(currentValue);
        currentValue = '';
        continue;
      }

      if ((char === '\n' || char === '\r') && !inQuotes) {
        if (char === '\r' && nextChar === '\n') {
          i += 1;
        }

        currentRow.push(currentValue);
        const row = currentRow.filter((cell, index) => {
          if (index === currentRow.length - 1) {
            return cell !== '' || currentRow.some((entry) => entry !== '');
          }
          return true;
        });

        if (row.some((cell) => cell !== '')) {
          rows.push(row);
        }

        currentRow = [];
        currentValue = '';
        continue;
      }

      currentValue += char;
    }

    if (currentValue.length > 0 || currentRow.length > 0) {
      currentRow.push(currentValue);
      if (currentRow.some((cell) => cell !== '')) {
        rows.push(currentRow);
      }
    }

    if (!rows.length) {
      return [];
    }

    const [headers, ...dataRows] = rows;

    return dataRows.map((row) => {
      const record = {};
      headers.forEach((header, index) => {
        const key = header.trim();
        record[key] = (row[index] ?? '').trim();
      });
      return record;
    });
  }

  function mergeStudentRecords(sisRecords, lmsRecords, accountingRecords) {
    const lmsByStudent = new Map();
    const accountingByStudent = new Map();

    (lmsRecords || []).forEach((record) => {
      const studentId = parseInteger(record.student_id);
      if (studentId !== null) {
        lmsByStudent.set(studentId, record);
      }
    });

    (accountingRecords || []).forEach((record) => {
      const studentId = parseInteger(record.student_id);
      if (studentId !== null) {
        accountingByStudent.set(studentId, record);
      }
    });

    return (sisRecords || []).map((sisRecord) => {
      const studentId = parseInteger(sisRecord.student_id);
      const lmsRecord = studentId !== null ? lmsByStudent.get(studentId) : null;
      const accountingRecord = studentId !== null ? accountingByStudent.get(studentId) : null;
      const programCode = normalizeProgramCode(sisRecord.program_code);
      const programName = PROGRAM_MAP[programCode] || (programCode ? `Unknown Program (${programCode})` : null);

      return {
        studentId: studentId ?? null,
        studentName: normalizeStudentName(sisRecord.student_name),
        program: programName,
        emailAddress: normalizeEmailAddress(sisRecord.email),
        courseCode: lmsRecord ? normalizeCourseCode(lmsRecord.course_code) : null,
        finalGrade: lmsRecord ? normalizeFinalGrade(lmsRecord.final_grade) : null,
        completionStatus: lmsRecord ? normalizeCompletionStatus(lmsRecord.completion_status) : null,
        outstandingBalance: accountingRecord ? parseDecimal(accountingRecord.account_balance) : null,
        currency: accountingRecord ? normalizeText(accountingRecord.currency).toUpperCase() || null : null,
      };
    });
  }

  function runEtlFromStrings(sisCsvText, lmsCsvText, accountingCsvText) {
    return mergeStudentRecords(
      parseCSV(sisCsvText),
      parseCSV(lmsCsvText),
      parseCSV(accountingCsvText)
    );
  }

  function renderMappingTable() {
    const tableBody = document.getElementById('mappingTableBody');
    if (!tableBody) {
      return;
    }

    tableBody.innerHTML = DATA_MAPPING.map((row) => `
      <tr>
        <td>${row.sourceSystem}</td>
        <td>${row.sourceField}</td>
        <td>${row.targetField}</td>
        <td>${row.targetType}</td>
        <td>${row.rule}</td>
      </tr>
    `).join('');
  }

  function showJsonOutput(jsonText) {
    const outputElement = document.getElementById('jsonOutput');
    const statusElement = document.getElementById('status');

    if (!outputElement || !statusElement) {
      return;
    }

    outputElement.textContent = jsonText;
    statusElement.textContent = 'ETL transformation completed successfully.';
  }

  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => resolve(String(event.target?.result ?? ''));
      reader.onerror = () => reject(new Error(`Could not read ${file.name}.`));
      reader.readAsText(file);
    });
  }

  async function loadProvidedEtlData() {
    try {
      const [sisCsv, lmsCsv, accountingCsv] = await Promise.all([
        fetch('./source_A_SIS.csv').then((response) => {
          if (!response.ok) throw new Error('Could not read source_A_SIS.csv');
          return response.text();
        }),
        fetch('./source_B_LMS.csv').then((response) => {
          if (!response.ok) throw new Error('Could not read source_B_LMS.csv');
          return response.text();
        }),
        fetch('./source_C_Accounting.csv').then((response) => {
          if (!response.ok) throw new Error('Could not read source_C_Accounting.csv');
          return response.text();
        }),
      ]);

      const merged = runEtlFromStrings(sisCsv, lmsCsv, accountingCsv);
      showJsonOutput(JSON.stringify(merged, null, 2));
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = `Loaded ${merged.length} SIS student records and merged LMS and accounting data.`;
      }
    } catch (error) {
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = error.message;
      }
    }
  }

  async function handleRunEtl() {
    const sisInput = document.getElementById('sisFile');
    const lmsInput = document.getElementById('lmsFile');
    const accountingInput = document.getElementById('accountingFile');

    try {
      const sisCsv = sisInput && sisInput.files && sisInput.files[0]
        ? await readFileAsText(sisInput.files[0])
        : await fetch('./source_A_SIS.csv').then((response) => response.text());
      const lmsCsv = lmsInput && lmsInput.files && lmsInput.files[0]
        ? await readFileAsText(lmsInput.files[0])
        : await fetch('./source_B_LMS.csv').then((response) => response.text());
      const accountingCsv = accountingInput && accountingInput.files && accountingInput.files[0]
        ? await readFileAsText(accountingInput.files[0])
        : await fetch('./source_C_Accounting.csv').then((response) => response.text());

      const merged = runEtlFromStrings(sisCsv, lmsCsv, accountingCsv);
      showJsonOutput(JSON.stringify(merged, null, 2));
    } catch (error) {
      const statusElement = document.getElementById('status');
      if (statusElement) {
        statusElement.textContent = error.message;
      }
    }
  }

  function initializeApp() {
    renderMappingTable();

    const runEtlButton = document.getElementById('runEtlBtn');
    const loadSampleButton = document.getElementById('loadSampleBtn');
    const downloadButton = document.getElementById('downloadBtn');

    if (runEtlButton) {
      runEtlButton.addEventListener('click', handleRunEtl);
    }

    if (loadSampleButton) {
      loadSampleButton.addEventListener('click', loadProvidedEtlData);
    }

    if (downloadButton) {
      downloadButton.addEventListener('click', () => {
        const outputElement = document.getElementById('jsonOutput');
        if (!outputElement) {
          return;
        }

        const payload = outputElement.textContent;
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'integrated-student-data.json';
        anchor.click();
        URL.revokeObjectURL(url);
      });
    }

    loadProvidedEtlData();
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('DOMContentLoaded', initializeApp);
  }

  global.ETLApp = {
    parseCSV,
    mergeStudentRecords,
    normalizeStudentName,
    normalizeProgramCode,
    runEtlFromStrings,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      parseCSV,
      mergeStudentRecords,
      normalizeStudentName,
      normalizeProgramCode,
      runEtlFromStrings,
    };
  }
})(typeof window !== 'undefined' ? window : globalThis);
