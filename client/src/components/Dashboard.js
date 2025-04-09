import React, { useState, useEffect } from 'react';
import Console from './Console';
import ApiService from '../services/ApiService';

function Dashboard({ token, onLogout }) {
    const [version, setVersion] = useState(null);
    const [modules, setModules] = useState([]);
    const [sessions, setSessions] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchData();
    }, [token]);

    const fetchData = async () => {
        setIsLoading(true);
        setError('');

        try {
            const [versionData, modulesData, sessionsData] = await Promise.all([
                ApiService.getVersion(),
                ApiService.listModules(),
                ApiService.listSessions()
            ]);

            // Handle version data
            setVersion({
                version: versionData.version || 'Unknown',
                ruby: versionData.ruby || 'Unknown',
                api: versionData.api || 'Unknown'
            });

            // Handle modules data
            setModules(Array.isArray(modulesData.modules) ? modulesData.modules : []);

            // Handle sessions data
            setSessions(sessionsData || {});
        } catch (err) {
            setError('Failed to fetch data: ' + (err.error_message || err.toString()));
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogout = () => {
        ApiService.call('auth.logout', token)
            .then(() => {
                onLogout();
            })
            .catch(err => {
                console.error('Logout error:', err);
                onLogout();
            });
    };

    return (
        <div className="dashboard">
            <h2>Metasploit RPC Dashboard</h2>
            <button onClick={handleLogout} className="logout-btn">Logout</button>

            {isLoading && <div>Loading...</div>}
            {error && <div className="error">{error}</div>}

            {version && (
                <div className="version-info">
                    <h3>Version Information</h3>
                    <p><strong>Metasploit Version:</strong> {String(version.version)}</p>
                    <p><strong>Ruby Version:</strong> {String(version.ruby)}</p>
                    <p><strong>API Version:</strong> {String(version.api)}</p>
                </div>
            )}
            <div className="console-section">
                <h3>Metasploit Console</h3>
                <Console />
            </div>
            <div className="modules-section">
                <h3>Exploit Modules ({modules.length})</h3>
                <ul>
                    {modules.slice(0, 10).map((module, index) => (
                        <li key={index}>
                            {typeof module === 'string' ? module : JSON.stringify(module)}
                        </li>
                    ))}
                    {modules.length > 10 && <li>...and {modules.length - 10} more</li>}
                </ul>
            </div>

            <div className="sessions-section">
                <h3>Active Sessions ({Object.keys(sessions).length})</h3>
                {Object.keys(sessions).length > 0 ? (
                    <ul>
                        {Object.entries(sessions).map(([id, session]) => (
                            <li key={id}>
                                <strong>Session {id}:</strong>{' '}
                                {typeof session === 'object'
                                    ? `${session.type || 'Unknown'} (${session.via_exploit || 'Unknown'})`
                                    : String(session)}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No active sessions</p>
                )}
            </div>
        </div>
    );
}

export default Dashboard;