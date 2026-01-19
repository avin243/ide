const express = require('express');
const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const crypto = require('crypto');
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
const CACHE_DIR = path.join(__dirname, 'cache');
const CSHARP_TEMPLATE_DIR = path.join(__dirname, 'csharp_template');
const RUST_TEMPLATE_DIR = path.join(__dirname, 'rust_template');

// Ensure temp and cache directories exist
(async () => {
    try {
        await fs.mkdir(TEMP_DIR);
        await fs.mkdir(CACHE_DIR);
    } catch (err) {
        if (err.code !== 'EEXIST') throw err;
    }
})();

// Helper to create a hash of the code
function getCodeHash(code) {
    return crypto.createHash('sha256').update(code).digest('hex');
}

// Helper to check if a command exists
const commandExists = (command) => {
    return new Promise((resolve) => {
        exec(`${command} --version`, (error) => {
            resolve(!error);
        });
    });
};

// Generic helper function to create and execute a file
async function executeCode(code, extension, command, cleanup = true) {
    const hash = getCodeHash(code);
    const cachePath = path.join(CACHE_DIR, `${hash}${extension}.out`);

    try {
        // Check if the cached binary exists
        await fs.access(cachePath);
        // If it exists, execute it directly
        return new Promise((resolve) => {
            exec(cachePath, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    if (error.killed) {
                        return resolve({ error: 'Execution timed out after 120 seconds.' });
                    }
                    return resolve({ stdout, stderr: stderr || error.message });
                }
                resolve({ stdout, stderr });
            });
        });
    } catch (e) {
        // If the cached binary doesn't exist, compile and cache it
        const filename = `temp_${Date.now()}${extension}`;
        const filepath = path.join(TEMP_DIR, filename);

        try {
            await fs.writeFile(filepath, code);

            return new Promise((resolve) => {
                exec(command(filepath, cachePath), { timeout: 120000 }, (error, stdout, stderr) => {
                    // Always attempt to clean up the source file
                    if(cleanup) {
                        fs.unlink(filepath).catch(err => {
                            if (err.code !== 'ENOENT') console.error(`Failed to delete source file: ${filepath}`, err);
                        });
                    }

                    if (error) {
                        if (error.killed) {
                            return resolve({ error: 'Execution timed out after 120 seconds.' });
                        }
                        return resolve({ stdout, stderr: stderr || error.message });
                    }
                    resolve({ stdout, stderr });
                });
            });
        } catch (err) {
            return { error: `Server-side error during file operation: ${err.message}` };
        }
    }
}

// C# endpoint - uses a project template for faster execution
async function executeCSharp(code) {
    const hash = getCodeHash(code);
    const cachePath = path.join(CACHE_DIR, `${hash}.exe`);

    try {
        // Check if the cached binary exists
        await fs.access(cachePath);
        // If it exists, execute it directly
        return new Promise((resolve) => {
            exec(cachePath, { timeout: 120000 }, (error, stdout, stderr) => {
                if (error) {
                    if (error.killed) {
                        return resolve({ error: 'Execution timed out after 120 seconds.' });
                    }
                    return resolve({ stdout, stderr: stderr || error.message });
                }
                resolve({ stdout, stderr });
            });
        });
    } catch (e) {
        // If the cached binary doesn't exist, compile and cache it
        const projectDir = path.join(TEMP_DIR, `proj_${Date.now()}`);
        const programPath = path.join(projectDir, 'Program.cs');

        try {
            // Copy the template project to a new temporary directory
            await fs.cp(CSHARP_TEMPLATE_DIR, projectDir, { recursive: true });

            // Overwrite the Program.cs file with the user's code
            await fs.writeFile(programPath, code);

            return new Promise((resolve) => {
                const command = `dotnet publish -c Release -o "${path.dirname(cachePath)}" --project "${projectDir}" && mv "${path.dirname(cachePath)}/csharp_template.exe" "${cachePath}" && "${cachePath}"`;
                exec(command, { timeout: 120000 }, (error, stdout, stderr) => {
                    // Always attempt to clean up the project directory
                    fs.rm(projectDir, { recursive: true, force: true }).catch(err => {
                        console.error(`Failed to delete project directory: ${projectDir}`, err);
                    });

                    if (error) {
                        if (error.killed) {
                            return resolve({ error: 'Execution timed out after 120 seconds.' });
                        }
                        return resolve({ stdout, stderr: stderr || error.message });
                    }
                    resolve({ stdout, stderr });
                });
            });
        } catch (err) {
            return { error: `Server-side error: ${err.message}` };
        }
    }
}

// Rust endpoint - uses a cargo project for optimized builds
async function executeRust(code) {
    const hash = getCodeHash(code);
    const cachePath = path.join(CACHE_DIR, `${hash}.out`);

    try {
        // Check if the cached binary exists
        await fs.access(cachePath);
        // If it exists, execute it directly
        return new Promise((resolve) => {
            exec(cachePath, { timeout: 30000 }, (error, stdout, stderr) => {
                if (error) {
                    if (error.killed) {
                        return resolve({ error: 'Execution timed out after 30 seconds.' });
                    }
                    return resolve({ stdout, stderr: stderr || error.message });
                }
                resolve({ stdout, stderr });
            });
        });
    } catch (e) {
        // If the cached binary doesn't exist, compile and cache it
        const projectDir = path.join(TEMP_DIR, `proj_${Date.now()}`);
        const mainRsPath = path.join(projectDir, 'src/main.rs');

        try {
            // Copy the template project to a new temporary directory
            await fs.cp(RUST_TEMPLATE_DIR, projectDir, { recursive: true });

            // Overwrite the main.rs file with the user's code
            await fs.writeFile(mainRsPath, code);

            return new Promise((resolve) => {
                const command = `cargo build --release --quiet --manifest-path "${path.join(projectDir, 'Cargo.toml')}" && mv "${path.join(projectDir, 'target/release/rust_template')}" "${cachePath}" && "${cachePath}"`;
                exec(command, { timeout: 30000 }, (error, stdout, stderr) => {
                    // Always attempt to clean up the project directory
                    fs.rm(projectDir, { recursive: true, force: true }).catch(err => {
                        console.error(`Failed to delete project directory: ${projectDir}`, err);
                    });

                    if (error) {
                        if (error.killed) {
                            return resolve({ error: 'Execution timed out after 30 seconds.' });
                        }
                        return resolve({ stdout, stderr: stderr || error.message });
                    }
                    resolve({ stdout, stderr });
                });
            });
        } catch (err) {
            return { error: `Server-side error: ${err.message}` };
        }
    }
}

// Python endpoint
app.post('/run/python', async (req, res) => {
    const pyCmd = await commandExists('python3') ? 'python3' : 'python';
    const result = await executeCode(req.body.code, '.py', (filepath, cachePath) => `${pyCmd} "${filepath}"`, false);
    res.json(result);
});

// Java endpoint
app.post('/run/java', async (req, res) => {
    const className = req.body.code.match(/public\s+class\s+(\w+)/)?.[1] || 'Main';
    const result = await executeCode(req.body.code, '.java', (filepath, cachePath) => {
        const dir = path.dirname(filepath);
        return `javac "${filepath}" && java -cp "${dir}" ${className}`;
    });
    res.json(result);
});

// Java AOT endpoint
app.post('/run/java-aot', async (req, res) => {
    if (!await commandExists('native-image')) {
        return res.status(500).json({ error: 'GraalVM native-image not found on the server.' });
    }
    const className = req.body.code.match(/public\s+class\s+(\w+)/)?.[1] || 'Main';
    const result = await executeCode(req.body.code, '.java', (filepath, cachePath) => {
        const dir = path.dirname(filepath);
        const exepath = path.join(CACHE_DIR, `${getCodeHash(req.body.code)}.out`);
        return `javac "${filepath}" && native-image -cp "${dir}" ${className} -o "${exepath}" && "${exepath}"`;
    });
    res.json(result);
});

// C++ endpoint (with optimization)
app.post('/run/cpp', async (req, res) => {
    const result = await executeCode(req.body.code, '.cpp', (filepath, cachePath) => {
        return `g++ -O3 "${filepath}" -o "${cachePath}" && "${cachePath}"`;
    });
    res.json(result);
});

// C# endpoint
app.post('/run/csharp', async (req, res) => {
    if (!await commandExists('dotnet')) {
        return res.status(500).json({ error: '.NET SDK not found on the server.' });
    }
    const result = await executeCSharp(req.body.code);
    res.json(result);
});

// Ruby endpoint
app.post('/run/ruby', async (req, res) => {
    const result = await executeCode(req.body.code, '.rb', (filepath, cachePath) => `ruby "${filepath}"`, false);
    res.json(result);
});

// Go endpoint
app.post('/run/go', async (req, res) => {
    const result = await executeCode(req.body.code, '.go', (filepath, cachePath) => `go build -o "${cachePath}" "${filepath}" && "${cachePath}"`);
    res.json(result);
});

// Rust endpoint
app.post('/run/rust', async (req, res) => {
    if (!await commandExists('cargo')) {
        return res.status(500).json({ error: 'Rust (cargo) not found on the server.' });
    }
    const result = await executeRust(req.body.code);
    res.json(result);
});


app.listen(PORT, () => {
    console.log(`✨ Server running on http://localhost:${PORT}`);
    console.log(`🚀 Open http://localhost:${PORT}/ in your browser to start coding!`);
});
