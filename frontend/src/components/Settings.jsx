import React, { useState, useEffect } from 'react';
import { checkAuth, syncGmail, getProfile, logout, getSettings } from '../api';
import { Mail, LogOut, CheckCircle, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import SyncStatus from './SyncStatus';

const Settings = () => {
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [gmailQuery, setGmailQuery] = useState('subject:"ERSTE Izvadak" has:attachment');
    const [syncing, setSyncing] = useState(false);
    const [showSyncStatus, setShowSyncStatus] = useState(false);
    const [credentialsPresent, setCredentialsPresent] = useState(false);

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        setLoading(true);
        try {
            const settings = await getSettings();
            setCredentialsPresent(settings.credentials_present);

            const userProfile = await getProfile();
            setProfile(userProfile);
        } catch (error) {
            console.error("Failed to load profile", error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogin = async () => {
        if (!credentialsPresent) {
            alert("Nedostaje credentials.json datoteka!");
            return;
        }
        try {
            await checkAuth();
            await loadProfile();
        } catch (error) {
            alert("Login failed: " + error.message);
        }
    };

    const handleLogout = async () => {
        if (!window.confirm("Jeste li sigurni da se želite odjaviti?")) return;
        try {
            await logout();
            await loadProfile();
        } catch (error) {
            alert("Logout failed: " + error.message);
        }
    };

    const handleGmailSync = async () => {
        if (!profile?.authenticated) {
            alert("Prvo se prijavite s Google računom.");
            return;
        }
        setSyncing(true);
        try {
            await syncGmail(gmailQuery);
            setShowSyncStatus(true);
        } catch (error) {
            alert('Greška: ' + (error.response?.data?.detail || error.message));
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Postavke</h1>

            {/* Google Account Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                    <Mail className="text-blue-500" />
                    Google Račun
                </h2>

                <div className="space-y-6">
                    {!credentialsPresent ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-4 rounded-xl flex items-start gap-3">
                            <AlertTriangle className="shrink-0 mt-0.5" size={20} />
                            <div>
                                <h3 className="font-semibold">Nedostaju vjerodajnice</h3>
                                <p className="text-sm mt-1 opacity-90">
                                    Datoteka <code>credentials.json</code> nije pronađena. Molimo dodajte je u root direktorij aplikacije za omogućavanje Gmail integracije.
                                </p>
                            </div>
                        </div>
                    ) : loading ? (
                        <div className="text-slate-500">Učitavanje podataka...</div>
                    ) : (
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold ${profile?.authenticated
                                    ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                                    : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                                    }`}>
                                    {profile?.authenticated ? profile.email[0].toUpperCase() : "?"}
                                </div>
                                <div>
                                    <div className="font-medium text-slate-900 dark:text-white">
                                        {profile?.authenticated ? profile.email : "Nije povezano"}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                                        {profile?.authenticated ? (
                                            <>
                                                <CheckCircle size={14} className="text-green-500" />
                                                Povezano
                                            </>
                                        ) : "Povežite svoj račun za sinkronizaciju"}
                                    </div>
                                </div>
                            </div>

                            {profile?.authenticated ? (
                                <button
                                    onClick={handleLogout}
                                    className="px-4 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg transition-colors font-medium flex items-center gap-2"
                                >
                                    <LogOut size={16} />
                                    Odjavi se
                                </button>
                            ) : (
                                <button
                                    onClick={handleLogin}
                                    className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm shadow-blue-200 dark:shadow-none"
                                >
                                    Prijavi se s Googleom
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Sync Section */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-6 relative overflow-hidden">
                <h2 className="text-xl font-semibold mb-6 flex items-center gap-2 text-slate-900 dark:text-white">
                    <RefreshCw className="text-indigo-500" />
                    Gmail Sinkronizacija
                </h2>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                            Gmail upit za pretragu
                        </label>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={gmailQuery}
                                onChange={(e) => setGmailQuery(e.target.value)}
                                disabled={!profile?.authenticated}
                                className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 dark:text-white outline-none transition disabled:opacity-60 disabled:cursor-not-allowed"
                                placeholder='subject:"ERSTE Izvadak" has:attachment'
                            />
                            <button
                                onClick={handleGmailSync}
                                disabled={syncing || !profile?.authenticated}
                                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors shadow-sm shadow-indigo-200 dark:shadow-none disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                            >
                                {syncing ? (
                                    <>
                                        <RefreshCw size={18} className="animate-spin" />
                                        Sinkronizacija...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw size={18} />
                                        Preuzmi izvode
                                    </>
                                )}
                            </button>
                        </div>
                        <p className="text-xs text-slate-500 mt-2">
                            Standardni Gmail operatori pretraživanja su podržani.
                        </p>
                    </div>
                </div>

                {!profile?.authenticated && (
                    <div className="absolute inset-0 bg-white/60 dark:bg-slate-800/60 backdrop-blur-[1px] flex items-center justify-center z-10">
                        <div className="bg-white dark:bg-slate-900 p-4 rounded-xl shadow-lg border border-slate-100 dark:border-slate-700 max-w-sm text-center">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Potrebna je prijava</h3>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                Za preuzimanje transakcija morate se prijaviti s Google računom.
                            </p>
                            <button
                                onClick={handleLogin}
                                className="px-4 py-2 text-sm text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-medium shadow-sm shadow-blue-200 dark:shadow-none"
                            >
                                Prijavi se
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {showSyncStatus && (
                <SyncStatus onClose={() => setShowSyncStatus(false)} />
            )}
        </div>
    );
};

export default Settings;
