// client/src/components/Console.js
import React, { useState, useRef, useEffect } from 'react';
import ApiService from '../services/ApiService';

function Console() {
    const [output, setOutput] = useState([]);
    const [input, setInput] = useState('');
    const [consoleId, setConsoleId] = useState(null);
    const [busy, setBusy] = useState(false);
    const outputRef = useRef(null);

    useEffect(() => {
        createConsole();
        return () => {
            destroyConsole();
        };
    }, []);

    const createConsole = async () => {
        try {
            const response = await ApiService.call('console.create');
            if (response && response.id) {
                setConsoleId(response.id);
                setOutput(prev => [...prev, 'Console initialized. Ready for input...']);
                // Start reading output
                startReading(response.id);
            }
        } catch (error) {
            setOutput(prev => [...prev, 'Error creating console: ' + error.message]);
        }
    };

    const destroyConsole = async () => {
        if (consoleId) {
            try {
                await ApiService.call('console.destroy', [consoleId]);
            } catch (error) {
                console.error('Error destroying console:', error);
            }
        }
    };

    const startReading = (id) => {
        const readInterval = setInterval(async () => {
            if (!busy) {
                try {
                    const response = await ApiService.call('console.read', [id]);
                    if (response && response.data && response.data.length > 0) {
                        setOutput(prev => [...prev, response.data]);
                    }
                    setBusy(response.busy);
                } catch (error) {
                    console.error('Error reading console:', error);
                }
            }
        }, 1000);

        return () => clearInterval(readInterval);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!input.trim() || !consoleId) return;

        try {
            setBusy(true);
            setOutput(prev => [...prev, `msf > ${input}`]);
            await ApiService.call('console.write', [consoleId, input + '\n']);
            setInput('');
        } catch (error) {
            setOutput(prev => [...prev, 'Error: ' + error.message]);
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="console">
            <div className="console-output" ref={outputRef}>
                {output.map((line, index) => (
                    <pre key={index} className="console-line">{line}</pre>
                ))}
                {busy && <pre className="console-line">Processing...</pre>}
            </div>
            <form onSubmit={handleSubmit} className="console-input">
                <div className="input-wrapper">
                    <span className="prompt">msf &gt;</span>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Enter command..."
                        disabled={busy}
                    />
                </div>
                <button type="submit" disabled={busy || !input.trim()}>
                    Execute
                </button>
            </form>
        </div>
    );
}

export default Console;