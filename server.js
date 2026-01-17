const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const app = express();

app.use(express.json());
app.use(cors());

const PORT = process.env.PORT || 3000;

// Serve static frontend files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve ide.html at the root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ide.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' });
});

// Temporary directory for code files
const TEMP_DIR = path.join(__dirname, 'temp');

// Ensure temp directory exists
(async () => {
    try {
        await fs.mkdir(TEMP_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
})();

// Helper to check if a command exists
const commandExists = (command) => {
    return new Promise((resolve) => {
        exec(`${command} --version`, (error) => {
            resolve(!error);
        });
    });
};

// Generic helper function to create and execute a file
async function executeCode(code, extension, command) {
    const filename = `temp_${Date.now()}${extension}`;
    const filepath = path.join(TEMP_DIR, filename);

    try {
        await fs.writeFile(filepath, code);

        return new Promise((resolve) => {
            exec(command(filepath), { timeout: 8000 }, (error, stdout, stderr) => {
                // Always attempt to clean up the source file
                fs.unlink(filepath).catch(err => {
                    if (err.code !== 'ENOENT') console.error(`Failed to delete source file: ${filepath}`, err);
                });

                if (error) {
                    if (error.killed) {
                        return resolve({ error: 'Execution timed out after 8 seconds.' });
                    }
                    // For many interpreted languages and compilers, the error message is in stderr
                    return resolve({ stdout, stderr: stderr || error.message });
                }
                resolve({ stdout, stderr });
            });
        });
    } catch (err) {
        return { error: `Server-side error during file operation: ${err.message}` };
    }
}

// Python endpoint
app.post('/run/python', async (req, res) => {
    const pyCmd = await commandExists('python3') ? 'python3' : 'python';
    const result = await executeCode(req.body.code, '.py', filepath => `${pyCmd} "${filepath}"`);
    res.json(result);
});

// Java endpoint
app.post('/run/java', async (req, res) => {
    const className = req.body.code.match(/public\s+class\s+(\w+)/)?.[1] || 'Main';
    const result = await executeCode(req.body.code, '.java', filepath => {
        const dir = path.dirname(filepath);
        const classfile = path.join(dir, `${className}.class`);
        return `javac "${filepath}" && java -cp "${dir}" ${className}; rm "${classfile}"`;
    });
    res.json(result);
});

// C++ endpoint
app.post('/run/cpp', async (req, res) => {
    const result = await executeCode(req.body.code, '.cpp', filepath => {
        const exepath = `${filepath}.out`;
        return `g++ "${filepath}" -o "${exepath}" && "${exepath}"; rm "${exepath}"`;
    });
    res.json(result);
});

// C# endpoint - uses dotnet-script
app.post('/run/csharp', async (req, res) => {
    if (!await commandExists('dotnet-script')) {
        return res.status(500).json({ error: 'C# scripting tool (dotnet-script) not found on the server.' });
    }
    const result = await executeCode(req.body.code, '.csx', filepath => `dotnet-script "${filepath}"`);
    res.json(result);
});

// Ruby endpoint
app.post('/run/ruby', async (req, res) => {
    const result = await executeCode(req.body.code, '.rb', filepath => `ruby "${filepath}"`);
    res.json(result);
});

// Go endpoint
app.post('/run/go', async (req, res) => {
    const result = await executeCode(req.body.code, '.go', filepath => `go run "${filepath}"`);
    res.json(result);
});

// Rust endpoint
app.post('/run/rust', async (req, res) => {
    const result = await executeCode(req.body.code, '.rs', filepath => {
        const exepath = `${filepath}.out`;
        return `rustc "${filepath}" -o "${exepath}" && "${exepath}"; rm "${exepath}"`;
    });
    res.json(result);
});


app.listen(PORT, () => {
    console.log(`✨ Server running on http://localhost:${PORT}`);
    console.log(`🚀 Open http://localhost:${PORT}/ in your browser to start coding!`);
});
