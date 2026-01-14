import React, { useState, useEffect, useRef } from 'react';
import { Search, UserPlus, Database, Globe } from 'lucide-react';
import { getClients, searchSudreg, saveClient } from '../api';

const ClientSelector = ({ onSelect, onNewClient, currentName }) => {
    const [searchTerm, setSearchTerm] = useState(currentName || '');
    const [showDropdown, setShowDropdown] = useState(false);
    const [localClients, setLocalClients] = useState([]);
    const [sudregResults, setSudregResults] = useState([]);
    const [loadingLocal, setLoadingLocal] = useState(false);
    const [loadingSudreg, setLoadingSudreg] = useState(false);
    const dropdownRef = useRef(null);

    // Initial load of local clients
    useEffect(() => {
        loadLocalClients();
    }, []);

    // Handle outside click to close dropdown
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const loadLocalClients = async () => {
        setLoadingLocal(true);
        try {
            const data = await getClients();
            setLocalClients(data);
        } catch (error) {
            console.error("Error loading clients", error);
        } finally {
            setLoadingLocal(false);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
        setShowDropdown(true);

        // Debounced Sudreg Search
        if (e.target.value.length > 2) {
            // We could debounce here, but for simplicity let's rely on user triggering via button or lazy enter?
            // Actually, implementing debounce is better U.
        }
    };

    // Debounced effect for Sudreg
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchTerm.length >= 3 && showDropdown) {
                performSudregSearch(searchTerm);
            }
        }, 600);
        return () => clearTimeout(timer);
    }, [searchTerm, showDropdown]);

    const performSudregSearch = async (term) => {
        setLoadingSudreg(true);
        try {
            let results = [];

            // If term looks like OIB (11 digits), try direct details fetch (works with VIES)
            if (/^\d{11}$/.test(term)) {
                try {
                    const { getSudregDetails } = await import('../api');
                    const details = await getSudregDetails(term);
                    if (details) results = [details];
                } catch (e) {
                    console.log("OIB lookup failed", e);
                }
            } else {
                // Otherwise search by name
                results = await searchSudreg(term);
            }

            setSudregResults(results);
        } catch (e) {
            console.error("Sudreg API error", e);
        } finally {
            setLoadingSudreg(false);
        }
    };

    const handleSelect = (client, source) => {
        setSearchTerm(client.name);
        setShowDropdown(false);
        onSelect(client);

        if (source === 'sudreg') {
            // Optional: Ask to save to local? Or auto save?
            // The requirement says "client database", so auto-saving sounds useful.
            // Let's pass it up and let parent decide or auto-save here.
            // For now, let's just use it. Parent can call saveClient if needed.
        }
    };

    // Filter local clients based on search
    const filteredLocal = localClients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.oib.includes(searchTerm)
    );

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <div className="relative">
                <input
                    type="text"
                    value={searchTerm}
                    onChange={handleSearchChange}
                    onFocus={() => setShowDropdown(true)}
                    placeholder="Traži klijenta (ime ili OIB)..."
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
                <Search className="absolute left-3 top-2.5 text-slate-400" size={18} />
            </div>

            {showDropdown && (
                <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-96 overflow-y-auto">
                    {/* Local Clients Section */}
                    <div className="p-2">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 px-2 py-1 flex items-center gap-2">
                            <Database size={12} />
                            MOJI KLIJENTI
                        </div>
                        {loadingLocal ? (
                            <div className="p-2 text-center text-sm text-slate-400">Učitavanje...</div>
                        ) : filteredLocal.length > 0 ? (
                            filteredLocal.map(client => (
                                <div
                                    key={client.id || client.oib}
                                    onClick={() => handleSelect(client, 'local')}
                                    className="px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-pointer transition-colors"
                                >
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{client.name}</div>
                                    <div className="text-xs text-slate-500">OIB: {client.oib} | {client.city}</div>
                                </div>
                            ))
                        ) : (
                            <div className="p-2 text-center text-xs text-slate-400">Nema lokalnih rezultata</div>
                        )}
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-700 my-1"></div>

                    {/* Sudreg Section */}
                    <div className="p-2">
                        <div className="text-xs font-bold text-indigo-500 dark:text-indigo-400 px-2 py-1 flex items-center gap-2">
                            <Globe size={12} />
                            SUDSKI REGISTAR / VIES (EU)
                        </div>
                        {loadingSudreg ? (
                            <div className="p-2 text-center text-sm text-slate-400">Pretraživanje registra...</div>
                        ) : sudregResults.length > 0 ? (
                            sudregResults.map((client, idx) => (
                                <div
                                    key={`sudreg-${idx}`}
                                    onClick={() => handleSelect(client, 'sudreg')}
                                    className="px-3 py-2 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded cursor-pointer transition-colors border-l-2 border-transparent hover:border-indigo-500"
                                >
                                    <div className="font-medium text-slate-800 dark:text-slate-200">{client.name}</div>
                                    <div className="text-xs text-slate-500">OIB: {client.oib} | {client.address}, {client.city}</div>
                                </div>
                            ))
                        ) : (
                            <div className="p-2 text-center text-xs text-slate-400">
                                {searchTerm.length < 3 ? "Unesite 3+ znaka za pretragu registra" : "Nema rezultata u registru"}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClientSelector;
