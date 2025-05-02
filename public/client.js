// app.js

// ---------- Modal helpers ----------
function showModal(message) {
    const modal = document.getElementById('modal');
    const modalContent = document.getElementById('modalContent');
    modalContent.textContent = message;
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('modal');
    modal.style.display = 'none';
}

// ---------- Dark mode toggle ----------
function toggleDarkMode() {
    document.body.classList.toggle('dark-mode');
    if (document.body.classList.contains('dark-mode')) {
        localStorage.setItem('darkMode', 'enabled');
    } else {
        localStorage.setItem('darkMode', 'disabled');
    }
}

async function handleUpload(event) {
  event.preventDefault();
  const formData = new FormData();
  const fileInput = document.getElementById('fileInput');
  if (!fileInput || !fileInput.files.length) return;
  formData.append('document', fileInput.files[0]);

  try {
    const response = await fetch('/upload', {
      method: 'POST',
      body: formData,
    });

    if (response.ok) {
      alert('Upload successful!');
      loadFileList(); // ← Call this to update list immediately
    } else {
      alert('Upload failed.');
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    alert('Upload failed.');
  }
}

async function loadFileList() {
  try {
    const response = await fetch('/api/files');
    const files = await response.json();

    const fileList = document.getElementById('listFiles');
    fileList.innerHTML = ''; // Clear current list

    if (!Array.isArray(files) || files.length === 0) {
      fileList.innerHTML = '<li>No files uploaded yet.</li>';
      return;
    }

    files.forEach(file => {
      const li = document.createElement('li');
      li.textContent = file.filename || 'Unnamed file'; // Access filename field
      fileList.appendChild(li);
    });
  } catch (error) {
      console.error('Error loading files:', error);
  } 
}

window.onload = loadFileList;

// ---------- Register user ----------
function handleRegister(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    fetch('/register', {
        method: 'POST',
        body: new URLSearchParams(formData)
    })
    .then(response => {
        if (response.ok) {
            showModal('Registration successful!');
            setTimeout(() => {
                window.location.href = '/login.html';
            }, 2000);
        } else {
            return response.text().then(text => { throw new Error(text) });
        }
    })
    .catch(error => {
        showModal('Registration failed: ' + error.message);
    });
}

// ---------- Login user ----------
function handleLogin(event) {
    event.preventDefault();
    const formData = new FormData(event.target);

    fetch('/login', {
        method: 'POST',
        body: new URLSearchParams(formData)
    })
    .then(response => {
        if (response.ok) {
            formData.forEach((value, key) => {
                if (key === 'email') {
                    localStorage.setItem('userEmail', value);
                }
            });
            showModal('Login successful!');
            setTimeout(() => {
                window.location.href = '/documents.html';
            }, 2000);
        } else {
            return response.text().then(text => { throw new Error(text) });
        }
    })
    .catch(error => {
        showModal('Login failed: ' + error.message);
    });
}

window.addEventListener('load', () => {
    if (localStorage.getItem('darkMode') === 'enabled') {
        document.body.classList.add('dark-mode');
    }

    loadFileList();

    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) {
        uploadForm.addEventListener('submit', handleUpload);
    }
});


// ---------- Chat (socket.io) ----------
const socket = io();
let selectedDocument = null;

// Handle chat form submission
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');

form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (input.value) {
        let finalMessage = input.value;
        if (selectedDocument) {
            finalMessage = `[${selectedDocument}] ${finalMessage}`;
        }
        socket.emit('chat message', finalMessage);
        input.value = '';
    }
});

socket.on('chat message', (msg) => {
    const item = document.createElement('li');
    item.innerText = msg;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
});


