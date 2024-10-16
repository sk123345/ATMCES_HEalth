const express = require('express'); 
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const session = require('express-session');

const app = express();
const PORT = 5000; // Set the port number

// Set view engine and views directory
app.set("view engine", "hbs");
app.set('views', path.join(__dirname, 'views'));

// Use CORS to allow cross-origin requests
app.use(cors());
app.use(bodyParser.json());

// Middleware for serving static files
app.use('/css', express.static(path.join(__dirname, 'css')));
app.use('/js', express.static(path.join(__dirname, 'js')));
app.use('/images', express.static(path.join(__dirname, 'images')));

// Session middleware for handling user sessions
app.use(session({
    secret: 'your-secret-key',  // Replace with a strong key from environment variables in production
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Built-in middleware for parsing form data
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/medDB', { useNewUrlParser: true, useUnifiedTopology: true });

// Updated User schema definition
const userSchema = new mongoose.Schema({
    role: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, unique: true, required: true },
    password: { type: String, required: true },
    gender: { type: String, required: true },
    phone: { type: String, required: true },
    dob: { type: Date, required: true }, // Date of Birth
    insurance: { type: String }, // Optional: Health insurance details
    medicalHistory: { type: String }, // Optional: Medical history details
    license: { type: String }, // Optional: For doctors, professional license number
    specialty: { type: String }, // Optional: For doctors, medical specialty
    hospital: { type: String }, // Optional: Hospital/clinic where the doctor works
    adminCode: { type: String }, // Optional: Special code for admin users
});

// Create User model
const User = mongoose.model('User', userSchema);

// Chatbot variables
let chatStarted = false; // Flag to check if the chat has started
let usedTips = []; // To store already used tips for better randomness

// List of health tips
const healthTips = [
    "Drink plenty of water throughout the day to stay hydrated.",
    "Get at least 7-8 hours of sleep every night for optimal health.",
    "Incorporate fruits and vegetables into your daily meals.",
    "Exercise for at least 30 minutes a day to stay fit.",
    "Take breaks from screen time to avoid eye strain.",
    "Practice mindfulness and stress-relieving activities.",
    "Avoid smoking and limit alcohol consumption for better health.",
    "Wash your hands regularly to prevent infections.",
    "Maintain a balanced diet with the right nutrients.",
    "Stay active and maintain a healthy weight."
];

// Dictionary for storing problem solutions and medicines
const problemDatabase = {
    "headache": {
        "solution": "You should take rest, avoid screen time, and stay hydrated.",
        "medicine": "You can take paracetamol or ibuprofen for relief."
    },
    "fever": {
        "solution": "Make sure to rest, drink plenty of fluids, and monitor your temperature.",
        "medicine": "You can take acetaminophen or ibuprofen to reduce fever."
    },
    "cough": {
        "solution": "Drink warm liquids, rest, and avoid cold environments.",
        "medicine": "You can take cough syrup or lozenges for relief."
    },
    "stomach ache": {
        "solution": "Rest, avoid spicy foods, and drink plenty of water.",
        "medicine": "You can take antacids or pain relievers like ibuprofen."
    },
    // Add more problems if needed
};

// Function to get random health tips without repetition
const getRandomHealthTip = () => {
    if (usedTips.length === 0) {
        usedTips = [...healthTips]; // Copy healthTips to usedTips when all tips are used
    }
    const randomIndex = Math.floor(Math.random() * usedTips.length);
    return usedTips.splice(randomIndex, 1)[0]; // Return and remove the tip
};

// Chatbot route
app.get('/chat',(req,res)=>{
    res.render('chat');
});
app.post('/chat', (req, res) => {
    const userMessage = req.body.message.toLowerCase();

    // If chat hasn't started, start with a greeting
    if (!chatStarted) {
        chatStarted = true;
        return res.json({ response: "Hi, I am your Virtual Doctor. Tell me your health problem?" });
    }

    // Check for "thank you" or "bye" messages
    if (userMessage.includes("thank") || userMessage.includes("thanks")) {
        return res.json({ response: "You're welcome!" });
    }
    if (userMessage.includes("bye")) {
        return res.json({ response: "Goodbye!" });
    }

    // Check if user asked for a health tip
    if (userMessage.includes("health tip")) {
        const tip = getRandomHealthTip();
        return res.json({ response: `Here is a health tip for you: ${tip}` });
    }

    // Check if any problem in the user's message matches the database
    for (let problem in problemDatabase) {
        if (userMessage.includes(problem)) {
            const solution = problemDatabase[problem].solution;
            const medicine = problemDatabase[problem].medicine;
            return res.json({ response: `Solution for ${problem}: ${solution}. Medicine: ${medicine}.` });
        }
    }

    // Default response if no match is found
    return res.json({ response: "Sorry, I don't have a solution for your problem." });
});

// User routes

// Signup GET route (renders the signup form)
app.get('/signup', (req, res) => {
    res.render('signup');  // Ensure you have 'signup.hbs' in the 'views' folder
});

// Signup POST route (handles the form submission)
app.post('/signup', async (req, res) => {
    try {
        const existingUser = await User.findOne({ email: req.body.email });
        if (existingUser) {
            return res.send('Email already in use.');
        }

        const hashedPassword = await bcrypt.hash(req.body.password, 10);
        const newUser = new User({
            role: req.body.role,
            name: req.body.name,
            email: req.body.email,
            password: hashedPassword,
            gender: req.body.gender,
            phone: req.body.phone,
            dob: req.body.dob, // Add DOB handling
            insurance: req.body.insurance || null,
            medicalHistory: req.body.medicalHistory || null,
            license: req.body.license || null,
            specialty: req.body.specialty || null,
            hospital: req.body.hospital || null,
            adminCode: req.body.adminCode || null
        });

        await newUser.save();
        res.redirect('/dashboard'); // Redirect to dashboard after signup
    } catch (error) {
        res.status(500).send('Error: ' + error.message);
    }
});

// Login page route
app.get('/login', (req, res) => {
    res.render("login");
});

// Login POST route (handles login form submission)
app.post('/login', async (req, res) => {
    try {
        const user = await User.findOne({ email: req.body.email });
        if (!user) {
            return res.send('No user found with this email.');
        }

        const isMatch = await bcrypt.compare(req.body.password, user.password);
        if (isMatch) {
            // Save user info in session
            req.session.user = {
                id: user._id,
                email: user.email,
                role: user.role
            };
            res.render('dashboard', { user: req.session.user });
        } else {
            res.send('Incorrect password.');
        }
    } catch (error) {
        res.send('Error: ' + error.message);
    }
});

// Dashboard page route (protected route, only accessible after login)
app.get('/dashboard', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("dashboard", { user: req.session.user });
});

// Logout route
app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.send('Failed to logout.');
        }
        res.redirect('/login');
    });
});

// Other static page routes
app.get('/', (req, res) => {
    res.render('index');
});
app.get('/index', (req, res) => {
    res.render('index');
});
app.get('/aindex', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('aindex');
});

app.get('/client', (req, res) => {
    res.render("client");
});

app.get('/health', (req, res) => {
    res.render("health");
});

app.get('/contact', (req, res) => {
    res.render("contact");
});

app.get('/medicine', (req, res) => {
    res.render("medicine");
});

app.get('/news', (req, res) => {
    res.render("news");
});

app.get('/widget', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("widget");
});

app.get('/typography', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("typography");
});

app.get('/table', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("table");
});

app.get('/form', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("form");
});

app.get('/element', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("element");
});

app.get('/chart', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("chart");
});

app.get('/button', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("button");
});

app.get('/blank', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("blank");
});

app.get('/404', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render("404");
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});