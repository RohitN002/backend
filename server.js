const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mysql = require('mysql');

const app = express();
const port = 3001;

// Setup MySQL connection
const db = mysql.createConnection({
  host:'bbkssccjpgavyhkzadz5-mysql.services.clever-cloud.com',
  user: 'uvowphq5sbwkptno',
  password: 'VTmyJShhWeEOECxM7vD4', // Replace with your MySQL password
  database: 'bbkssccjpgavyhkzadz5' // Replace with your database name
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    throw err;
  }
  console.log('Connected to MySQL database');
});

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

const upload = multer({ storage });

// Serve static files from the uploads directory
app.use('/uploads', express.static('uploads'));

// Register student endpoint with resume upload
app.post('/api/register', upload.single('resume'), (req, res) => {
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

  // Format array fields properly for SQL insertion
  const areasOfInterestStr = Array.isArray(areaOfInterest) ? areaOfInterest.join(',') : areaOfInterest;
  const programmingSkillsStr = Array.isArray(programmingSkills) ? programmingSkills.join(',') : programmingSkills;

  const registrationDate = new Date().toISOString().slice(0, 19).replace('T', ' ');

  const sql = 'INSERT INTO students SET ?';
  const studentData = {
    studentName,
    dob,
    fatherName,
    mobileNumber,
    countryCode,
    collegeName,
    courseDetails,
    areaOfInterest: areasOfInterestStr, // Use formatted string
    programmingSkills: programmingSkillsStr, // Use formatted string
    address,
    yearOfPassing,
    email,
    resume,
    gender,
    registrationDate,
  };

  db.query(sql, studentData, (err, result) => {
    if (err) {
      console.error('Error inserting student data:', err);
      return res.status(500).send('Registration failed');
    }
    res.send('Registered successfully');
  });
});

app.get('/api/export', async (req, res) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Students');

  worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'Student Name', key: 'studentName', width: 30 },
      { header: 'Date of Birth', key: 'dob', width: 15 },
      { header: 'Father Name', key: 'fatherName', width: 30 },
      { header: 'Mobile Number', key: 'mobileNumber', width: 20 },
      { header: 'Country Code', key: 'countryCode', width: 10 },
      { header: 'College Name', key: 'collegeName', width: 30 },
      { header: 'Course Details', key: 'courseDetails', width: 15 },
      { header: 'Area of Interest', key: 'areaOfInterest', width: 30 },
      { header: 'Programming Skills', key: 'programmingSkills', width: 30 },
      { header: 'Address', key: 'address', width: 50 },
      { header: 'Year of Passing', key: 'yearOfPassing', width: 15 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Resume', key: 'resume', width: 30 },
  ];

  const query = 'SELECT * FROM students';
  db.query(query, (err, results) => {
      if (err) throw err;

      results.forEach((row) => {
          worksheet.addRow(row);
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');

      workbook.xlsx.write(res)
          .then(() => {
              res.end();
          });
  });
});


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

app.get('/api/download/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // Ensure the file is already a PDF or provide an appropriate response
  if (path.extname(filePath) !== '.pdf') {
    // Placeholder for file conversion logic
    return res.status(400).send('The uploaded file is not a PDF and cannot be converted');
  } else {
    res.download(filePath);
  }
});

// View resume endpoint
app.get('/api/view/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'uploads', filename);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath);
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
