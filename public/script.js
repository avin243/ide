
// Handle language switching
document.querySelectorAll('.language-select').forEach(button => {
    button.addEventListener('click', () => {
        // Update active button
        document.querySelector('.language-select.active').classList.remove('active');
        button.classList.add('active');

        // Hide all IDEs
        document.querySelectorAll('.ide-container').forEach(ide => {
            ide.style.display = 'none';
        });

        // Show selected IDE
        const selectedLang = button.getAttribute('data-lang');
        document.getElementById(`${selectedLang}-ide`).style.display = 'block';
    });
});

function runCode() {
    const html = document.getElementById('htmlEditor').value;
    const css = document.getElementById('cssEditor').value;
    const js = document.getElementById('jsEditor').value;
    
    // Clear console
    document.getElementById('consoleOutput').innerHTML = '';

    // Extract body content from HTML
    let bodyContent = html;
    bodyContent = bodyContent.replace(/<!DOCTYPE html>/gi, '');
    bodyContent = bodyContent.replace(/<html[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/html>/gi, '');
    bodyContent = bodyContent.replace(/<head[^>]*>[\s\S]*?<\/head>/gi, '');
    bodyContent = bodyContent.replace(/<body[^>]*>/gi, '');
    bodyContent = bodyContent.replace(/<\/body>/gi, '');

    // Create the complete HTML document
    const combinedCode = `<!DOCTYPE html>\n<html>\n<head>\n    <style>${css}</style>\n</head>\n<body>\n    ${bodyContent}\n    <script>\n        // Capture console.log\n        (function(){\n            const logs = [];\n            const originalLog = console.log;\n            console.log = function(...args) {\n                originalLog.apply(console, args);\n                logs.push(args.join(' '));\n                window.__logs = logs;\n            };\n        })();\n        ${js}\n    <\/script>\n</body>\n</html>`;

    // Update the iframe with the new code
    const iframe = document.getElementById('outputFrame');
    iframe.srcdoc = combinedCode;
    
    // Try to access logs from iframe after it loads
    iframe.onload = function() {
        try {
            const iframeWindow = iframe.contentWindow;
            if (iframeWindow.__logs && iframeWindow.__logs.length > 0) {
                const consoleOutput = document.getElementById('consoleOutput');
                iframeWindow.__logs.forEach(log => {
                    consoleOutput.innerHTML += log + '<br>';
                });
            }
        } catch (e) {
            // Cross-origin or security issue, silently fail
        }
    };
}

// Simple, safe HTML escaper to avoid injecting markup into the output area
function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function executeCode(language, code) {
    const loadingEl = document.getElementById(`${language}Loading`);
    const outputEl = document.getElementById(`${language}Output`);
    
    try {
        loadingEl.style.display = 'block';
        outputEl.innerHTML = '';
        
        const response = await fetch(`/run/${language}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code })
        });
        
        const result = await response.json();
        
        if (result.error) {
            const escaped = escapeHtml(result.error);
            outputEl.innerHTML += `<div class="error">${escaped}</div>`;
        } else {
            if (result.stdout) {
                const escapedOut = escapeHtml(result.stdout);
                outputEl.innerHTML += `<div class="success">${escapedOut}</div>`;
            }
            if (result.stderr) {
                const escapedErr = escapeHtml(result.stderr);
                outputEl.innerHTML += `<div class="error">${escapedErr}</div>`;
            }
        }
    } catch (err) {
        const escaped = escapeHtml(err && err.message ? err.message : String(err));
        outputEl.innerHTML += `<div class="error">Error: ${escaped}</div>`;
    } finally {
        loadingEl.style.display = 'none';
    }
}

// Python-only executor - preserves newlines in output using python-specific classes
async function executePython(code) {
    const language = 'python';
    const loadingEl = document.getElementById(`${language}Loading`);
    const outputEl = document.getElementById(`${language}Output`);
    try {
        loadingEl.style.display = 'block';
        outputEl.innerHTML = '';

        const response = await fetch(`/run/${language}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code })
        });

        const result = await response.json();

        if (result.error) {
            const escaped = escapeHtml(result.error);
            outputEl.innerHTML += `<div class="python-error"><pre>${escaped}</pre></div>`;
        } else {
            if (result.stdout) {
                const escapedOut = escapeHtml(result.stdout);
                outputEl.innerHTML += `<div class="python-success"><pre>${escapedOut}</pre></div>`;
            }
            if (result.stderr) {
                const escapedErr = escapeHtml(result.stderr);
                outputEl.innerHTML += `<div class="python-error"><pre>${escapedErr}</pre></div>`;
            }
        }
    } catch (err) {
        const escaped = escapeHtml(err && err.message ? err.message : String(err));
        outputEl.innerHTML += `<div class="python-error"><pre>Error: ${escaped}</pre></div>`;
    } finally {
        loadingEl.style.display = 'none';
    }
}

async function runPython() {
    const code = document.getElementById('pythonEditor').value;
    await executePython(code);
}

async function runJava() {
    const code = document.getElementById('javaEditor').value;
    await executeCode('java', code);
}

async function runCpp() {
    const code = document.getElementById('cppEditor').value;
    await executeCode('cpp', code);
}

async function runCSharp() {
    const code = document.getElementById('csharpEditor').value;
    await executeCode('csharp', code);
}

async function runRuby() {
    const code = document.getElementById('rubyEditor').value;
    await executeCode('ruby', code);
}

async function runGo() {
    const code = document.getElementById('goEditor').value;
    await executeCode('go', code);
}

async function runRust() {
    const code = document.getElementById('rustEditor').value;
    await executeCode('rust', code);
}

function clearOutput() {
    const activeLang = document.querySelector('.language-select.active').dataset.lang;
    if (activeLang === 'webdev') {
        document.getElementById('outputFrame').srcdoc = 'about:blank';
        document.getElementById('consoleOutput').innerHTML = '';
    } else {
        const outputEl = document.getElementById(`${activeLang}Output`);
        if (outputEl) {
            outputEl.innerHTML = '';
        }
    }
}

// Run the web code initially
runCode();

// Mobile sidebar toggle
(function(){
    const toggleBtn = document.getElementById('toggleSidebar');
    const sidebar = document.querySelector('.sidebar');
    if (toggleBtn && sidebar) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // Close sidebar after selecting a language (mobile)
    document.querySelectorAll('.language-select').forEach(btn => {
        btn.addEventListener('click', () => {
            if (sidebar && sidebar.classList.contains('open')) {
                sidebar.classList.remove('open');
            }
        });
    });
})();
