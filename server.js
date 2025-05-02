import express from 'express';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import mongoose from 'mongoose';
import http from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import fs from 'fs';
import axios from 'axios';

import OpenAI from "openai";
import dotenv from 'dotenv';
import fetch from "node-fetch";
dotenv.config();
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Environment variable, don't paste the full key directly here
});


// Setup __dirname manually for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// MongoDB connection
mongoose.connect('mongodb+srv://hoamuser:test@cluster0.48rowfg.mongodb.net/hoam?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB Atlas!'))
.catch(err => console.error('MongoDB Atlas connection error:', err));

// User schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    address: String,
    password: String
});

const User = mongoose.model('User', userSchema);

// Multer config
const upload = multer({ storage: multer.memoryStorage() });

const FILE_API_URL = "https://67a08egpff.execute-api.us-east-2.amazonaws.com/test/upload";
const FILE_API_KEY = "N0I50xLGdz9LmOpHw32th8aN0nLnhhxW1vKLG5Q5";


// Middleware
app.use(cors());
app.use(express.static('public')); 
app.use(express.urlencoded({ extended: true }));
app.use(express.json());


// Pages
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload - Modified to use 'any()' to accept any field name
app.post('/upload', upload.any(), async (req, res) => {
    try {
        // Check if any files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileBuffer = req.files[0].buffer;
        const originalName = req.files[0].originalname;

        const headers = {
            'x-api-key': FILE_API_KEY,
            'Content-Type': 'application/pdf',
            'filename': originalName,
        };

        const response = await axios.post(`${FILE_API_URL}?action=upload`, fileBuffer, { headers });

        console.log('Uploaded:', originalName);
        res.status(200).json({ message: "File uploaded successfully", data: response.data });
    } catch (err) {
        console.error('Upload error:', err.response?.data || err.message);
        res.status(500).json({ error: 'Upload failed', detail: err.message });
    }
});

// List uploaded files
//app.get('/api/files', (req, res) => {
  //  fs.readdir('uploads', (err, files) => {
    //    if (err) {
      //      console.error('Failed to list uploaded files:', err);
        //    return res.status(500).json({ error: 'Failed to list files' });
        //}
        //const formattedFiles = files.map(filename => ({ filename }));
        //res.json(formattedFiles);
    //});
//});

app.get('/api/files', async (req, res) => {
  try {
    const response = await axios.post("https://67a08egpff.execute-api.us-east-2.amazonaws.com/test/upload?action=list", {}, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': FILE_API_KEY,
      },
    });

    const files = JSON.parse(response.data.body);
    res.json(files);
  } catch (error) {
    console.error('Error fetching files:', error);
  }
});


// Register
app.post('/register', async (req, res) => {
    const { name, email, address, password } = req.body;
    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).send('User already exists.');
        }

        const newUser = new User({ name, email, address, password });
        await newUser.save();

        console.log('New User Saved:', email);
        res.send('Success');
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).send('Registration failed.');
    }
});

// Login
app.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).send('User not found.');
        if (user.password !== password) return res.status(400).send('Incorrect password.');

        res.send('Success');
    } catch (error) {
        console.error(error);
        res.status(500).send('Login failed.');
    }
});

// Chat
io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('chat message', async (msg) => {
    const API_URL = "https://rgo89zwyke.execute-api.us-east-2.amazonaws.com/dev/ask";
    const CHAT_API_KEY = "MqwABFGNhC4FF1Kqu2otv7ElRos1DbuS1FCkfuJx";
    console.log('message:' + msg);
    io.emit('chat message', "Me: " + msg);

    try {
      //Get chunked document from AWS
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CHAT_API_KEY
        },
        body: JSON.stringify({query: msg})
      });

      const data = await response.json();
      console.log('API Response',data.results);

      // NOTE: Send chunked text to LLM
      const llm_response = await client.responses.create({
        model: 'gpt-4o-mini',
        input: "Provide a short, simple answer to: " + msg + data.results
      });

        if (response) {
          io.emit('chat message', "Hoam: " + llm_response.output_text); // Emit LLM's response

        } else {
          io.emit('chat message', "The AI didn't provide a valid text response.");
        }

      console.log('LLM response', llm_response.output_text)
      } catch (error) {
      console.error("Error generating content" + error);
    }
  });
  socket.on('disconnect', () => {
    console.log('user disconnected');
  })
});

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
