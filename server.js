const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const mongoose = require('mongoose');
const { body, validationResult } = require('express-validator');
const ExcelJS = require('exceljs');
const moment = require('moment-timezone');
const app = express();
const port = 3001;



// Setup MongoDB connection
mongoose.connect('mongodb+srv://rohitrandy002:BaR8eb6BIjbwKFvf@cluster0.tmrysuc.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0');

const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB database');
});

// Define student schema and model
const studentSchema = new mongoose.Schema({
  studentName: { type: String, required: true, maxlength: 100 },
  dob: { type: Date, required: true },
  fatherName: { type: String, required: true, maxlength: 100 },
  mobileNumber: { type: String, required: true, maxlength: 15 },
  collegeName: { type: String, maxlength: 100 },
  courseDetails: { type: String, maxlength: 100 },
  areaOfInterest: { type: String, maxlength: 100 },
  programmingSkills: { type: String, maxlength: 100 },
  address: { type: String, maxlength: 255 },
  yearOfPassingOut: { type: Number },
  email: { type: String, required: true, maxlength: 100 },
  registrationDate: { type: Date, required: true },
  registrationTime: { type: String, required: true },
  countryCode: { type: String, maxlength: 5 },
  resume: { type: String },
  gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true }
});

const Student = mongoose.model('Student', studentSchema);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // Specify your upload directory
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
  }
});

// File filter to accept all file types
const fileFilter = (req, file, cb) => {
  cb(null, true); // Accept all files
};

// Multer configuration
const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter
});

const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

app.use('/uploads', express.static(uploadDir));

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
app.post('/api/register', upload.single('resume'), validateRegistration, async (req, res) => {
  try {
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

    const registrationDate = new Date().toISOString().slice(0, 10);
    // const registrationTime = new Date().toLocaleTimeString([], { hour12: true });
const registrationTime = moment().tz('Asia/Kolkata').format('hh:mm A'); 
    const student = new Student({
      studentName,
      dob,
      fatherName,
      mobileNumber,
      collegeName,
      courseDetails,
      areaOfInterest: areasOfInterestStr,
      programmingSkills: programmingSkillsStr,
      address,
      yearOfPassingOut: yearOfPassing,
      email,
      registrationDate,
      registrationTime,
      countryCode,
      resume,
      gender
    });

    await student.save();
    res.send('Registered successfully');
  } catch (err) {
    console.error('Error inserting student data:', err);
    res.status(500).send(err);
  }
});

// Excel export endpoint
app.get('/api/export', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Students');

    worksheet.columns = [
      { header: 'ID', key: '_id', width: 10 },
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
      { header: 'Year of Passing', key: 'yearOfPassingOut', width: 30 },
      { header: 'Email', key: 'email', width: 30 },
      { header: 'Resume', key: 'resume', width: 30 },
    ];

    const students = await Student.find({});
    students.forEach((student) => {
      worksheet.addRow(student.toObject());
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=students.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error writing Excel:', err);
    res.status(500).send('Failed to export data');
  }
});

// Fetch all students endpoint
app.get('/api/students', async (req, res) => {
  try {
    const students = await Student.find({});
    res.json(students);
  } catch (err) {
    console.error('Error fetching students:', err);
    res.status(500).send('Server error');
  }
});

// Download resume endpoint
app.get('/api/download/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.resolve(uploadDir, filename);

  // Check if the file exists
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  // Set the Content-Disposition header to suggest a file download
  res.download(filePath, filename, (err) => {
    if (err) {
      console.error('Error downloading the file:', err);
      res.status(500).send('Error downloading the file');
    }
  });
});

// View resume endpoint
app.get('/api/view/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.resolve(uploadDir, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }

  res.sendFile(filePath, (err) => {
    if (err) {
      res.status(500).send('Error sending the file');
    }
  });
});


app.delete('/api/students/:id', async (req, res) => {
  const studentId = req.params.id;

  console.log('Student ID received for deletion:', studentId);

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID is required' });
  }

  try {
    const deletedStudent = await Student.findByIdAndDelete(studentId);

    if (!deletedStudent) {
      return res.status(404).json({ error: 'Student not found' });
    }

    res.status(200).json({ message: 'Student deleted successfully' });
  } catch (err) {
    console.error('Error deleting student:', err);
    res.status(500).json({ error: 'Error deleting student' });
  }
});




app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
