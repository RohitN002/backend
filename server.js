const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');

const app = express();
const port = 3001;

// Setup MySQL connection
const db = mysql.createConnection({
  port :3306,
  host: 'bgkgqpzlmprakmflc0f6-mysql.services.clever-cloud.com',
  user: 'ulb0lc3arbvcl83e',
  password: 'xgFalOBMDYtiL5TlEHXL',
  database: 'bgkgqpzlmprakmflc0f6' 
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    throw err;
  }
  console.log('Connected to MySQL database');
});

// const createUsersTable = () => {
//   const sql = `
//     CREATE TABLE IF NOT EXISTS Students (
//       id INT AUTO_INCREMENT PRIMARY KEY,
//       studentName VARCHAR(100) NOT NULL,
//       dob DATE NOT NULL,
//       fatherName VARCHAR(100) NOT NULL,
//       mobileNumber VARCHAR(15) NOT NULL,
//       collegeName VARCHAR(100),
//       courseDetails VARCHAR(100),
//       areaOfInterest VARCHAR(100),
//       programmingSkills VARCHAR(100),
//       address VARCHAR(255),
//       yearOfPassingOut YEAR,
//       email VARCHAR(100),
//       registrationDate DATE NOT NULL,
//       registrationTime TIME NOT NULL,
//       countryCode VARCHAR(5),
//       resume BLOB,
//       gender ENUM('Male', 'Female', 'Other')
//     );
//   `;
//   db.query(sql, (err, result) => {
//     if (err) {
//       console.error('Error creating table:', err);
//     } else {
//       console.log('Students table created successfully.');
//     }
//   });
// };
// createUsersTable();


app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== '.pdf') {
      return cb(new Error('Only PDF files are allowed'));
    }
    cb(null, true);
  }
});

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Validation middleware for registration endpoint
const validateRegistration = [
  body('studentName').notEmpty().isLength({ max: 100 }),
  body('dob').isISO8601(),
  body('mobileNumber').notEmpty().isMobilePhone(),
  body('countryCode').isLength({ max: 5 }),
  body('email').isEmail().notEmpty(),
  body('gender').isIn(['Male', 'Female', 'Other']),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  }
];

// Registration endpoint
app.post('/api/register', upload.single('resume'), validateRegistration, (req, res) => {
  const {
    studentName,
    dob,
    fatherName,
    mobileNumber,
    countryCode,
    collegeName,
    courseDetails,
    areaOfInterest,
    programmingSkills,
    address,
    yearOfPassing,
    email,
    gender,
  } = req.body;

  const resume = req.file ? req.file.filename : null;

  const areasOfInterestStr = Array.isArray(areaOfInterest) ? areaOfInterest.join(',') : areaOfInterest;
  const programmingSkillsStr = Array.isArray(programmingSkills) ? programmingSkills.join(',') : programmingSkills;

  // const programmingSkillsStr = Array.isArray(programmingSkills) ? programmingSkills.join(',') : programmingSkills;

  const registrationDate = new Date().toISOString().slice(0, 10);
  const registrationTime = new Date().toLocaleTimeString([], { hour12: false });

  const sql = `
    INSERT INTO students 
    (studentName, dob, fatherName, mobileNumber, collegeName, courseDetails, areaOfInterest, programmingSkills, address, yearOfPassingOut, email, registrationDate, registrationTime, countryCode, resume, gender)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  const values = [
    studentName,
    dob,
    fatherName,
    mobileNumber,
    collegeName,
    courseDetails,
    areasOfInterestStr,
    programmingSkillsStr,
    address,
    yearOfPassing,
    email,
    registrationDate,
    registrationTime,
    countryCode,
    resume,
    gender
  ];

  db.query(sql, values, (err, result) => {
    if (err) {
      console.error('Error inserting student data:', err);
      return res.status(500).send('Registration failed');
    }
    res.send('Registered successfully');
  });
});

// Excel export endpoint
app.get('/api/export', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Student Name', key: 'studentName', width: 50 },
      { header: 'Date of Birth', key: 'dob', width: 30 },
      { header: 'Father Name', key: 'fatherName', width: 50 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 30 },
      { header: 'Country Code', key: 'countryCode', width: 10 },
      { header: 'College Name', key: 'collegeName', width: 50 },
      { header: 'Course Details', key: 'courseDetails', width: 30 },
      { header: 'Area of Interest', key: 'areaOfInterest', width: 70 },
      { header: 'Programming Skills', key: 'programmingSkills', width: 70 },
      { header: 'Address', key: 'address', width: 100 },
      { header: 'Year of Passing', key: 'yearOfPassing', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Resume', key: 'resume', width: 30 },
  ];

  const query = 'SELECT * FROM students';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching students:', err);
      return res.status(500).send('Server error');
    }

    results.forEach((row) => {
      worksheet.addRow(row);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');

    workbook.xlsx.write(res)
      .then(() => {
        res.end();
      })
      .catch((err) => {
        console.error('Error writing Excel:', err);
        res.status(500).send('Failed to export data');
      });
  });
});

// Fetch all students endpoint
app.get('/api/students', (req, res) => {
  const query = 'SELECT * FROM students';
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error fetching students:', err);
      res.status(500).send('Server error');
    } else {
      res.json(results);
    }
  });
});

// Download resume endpoint
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  if (path.extname(filePath) !== '.pdf') {
    return res.status(400).send('The uploaded file is not a PDF and cannot be downloaded');
  }

  res.download(filePath);
});

// View resume endpoint
app.get('/api/view/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
