import React, { useEffect, useState, useRef } from 'react';
import { X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import clsx from 'clsx';

const SyncStatus = ({ onClose }) => {
    const [status, setStatus] = useState('connecting'); // connecting, running, completed, error
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState({ current: 0, total: 0 });
    const logsEndRef = useRef(null);

    useEffect(() => {
        const eventSource = new EventSource('http://localhost:8000/api/sync/events');

        eventSource.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setStatus(data.status);
                setLogs(data.logs);
                setProgress({ current: data.progress, total: data.total });

                if (data.status === 'completed' || data.status === 'error') {
                    // Optionally auto-close or keep open for review
                }
            } catch (err) {
                console.error("Error parsing sync event:", err);
            }
        };

        eventSource.onerror = (err) => {
            console.error("EventSource failed:", err);
            // eventSource.close(); // Don't close immediately on minor network blips, but maybe on fatal
        };

        return () => {
            eventSource.close();
        };
    }, []);

    // Auto-scroll to bottom of logs
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [logs]);

    const percentage = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                    <div>
                        <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            {status === 'running' && <Loader2 className="animate-spin text-indigo-600" size={20} />}
                            {status === 'completed' && <CheckCircle className="text-green-500" size={20} />}
                            {status === 'error' && <AlertCircle className="text-red-500" size={20} />}
                            {status === 'running' ? 'Gmail Sinkronizacija u tijeku...' :
                                status === 'completed' ? 'Sinkronizacija završena' :
                                    status === 'error' ? 'Greška u sinkronizaciji' : 'Povezivanje...'}
                        </h3>
                        {status === 'running' && (
                            <p className="text-sm text-slate-500 mt-1">
                                Obrađeno {progress.current} od {progress.total} privitaka ({percentage}%)
                            </p>
                        )}
                    </div>
                    {status !== 'running' && (
                        <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                            <X size={20} />
                        </button>
                    )}
                </div>

                {/* Progress Bar */}
                {status === 'running' && (
                    <div className="h-1 bg-slate-100 w-full">
                        <div
                            className="h-full bg-indigo-600 transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                        />
                    </div>
                )}

                {/* Logs */}
                <div className="flex-1 overflow-y-auto p-6 bg-slate-900 font-mono text-sm text-slate-300 space-y-2">
                    {logs.length === 0 && (
                        <div className="text-slate-500 italic">Čekanje logova...</div>
                    )}
                    {logs.map((log, index) => (
                        <div key={index} className="flex gap-4 border-b border-slate-800/50 pb-1 last:border-0 last:pb-0">
                            <span className="text-slate-600 shrink-0 text-xs mt-0.5">
                                {new Date(log.timestamp).toLocaleTimeString()}
                            </span>
                            <span className={clsx(
                                log.message.includes("Error") || log.message.includes("failed") ? "text-red-400" :
                                    log.message.includes("Success") ? "text-green-400" :
                                        "text-slate-300"
                            )}>
                                {log.message}
                            </span>
                        </div>
                    ))}
                    <div ref={logsEndRef} />
                </div>

                {/* Footer */}
                {status !== 'running' && (
                    <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-medium transition-colors shadow-sm shadow-indigo-200"
                        >
                            Zatvori
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SyncStatus;
