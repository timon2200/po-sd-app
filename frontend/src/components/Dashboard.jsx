import React, { useState, useEffect, useRef } from 'react';
import { fetchTransactions, uploadTransactions, mergeDocuments, getProfile, logout } from '../api';
import { RefreshCw, Upload, ArrowUpRight, ArrowDownLeft, Filter, Download, Moon, Sun, FileText, User, LogOut, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { hr } from 'date-fns/locale';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const StatCard = ({ title, value, type, data, color, onClick }) => {
    return (
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between overflow-hidden relative transition-colors h-48">
            <div className="flex justify-between items-start z-10">
                <div>
                    <h3 className="text-slate-500 dark:text-slate-400 font-medium mb-1">{title}</h3>
                    <p className={clsx("text-2xl font-bold", color === "emerald" ? "text-emerald-500" : "text-amber-500")}>
                        {value}
                    </p>
                </div>
                <div className={clsx("p-2 rounded-full", color === "emerald" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30" : "bg-amber-50 text-amber-600 dark:bg-amber-900/30")}>
                    {type === 'inflow' ? <ArrowDownLeft size={20} /> : <ArrowUpRight size={20} />}
                </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-24">
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                        data={data}
                        onClick={(data) => {
                            if (data && data.activeLabel && onClick) {
                                onClick(data.activeLabel);
                            }
                        }}
                        className="cursor-pointer"
                    >
                        <defs>
                            <linearGradient id={`gradient-${type}`} x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={color === "emerald" ? "#10b981" : "#f59e0b"} stopOpacity={0.3} />
                                <stop offset="95%" stopColor={color === "emerald" ? "#10b981" : "#f59e0b"} stopOpacity={0} />
                            </linearGradient>
                        </defs>
                        <XAxis
                            dataKey="date"
                            hide={false}
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fill: '#94a3b8' }}
                            tickFormatter={(str) => {
                                try {
                                    return format(new Date(str), 'MMM', { locale: hr });
                                } catch (e) {
                                    return '';
                                }
                            }}
                            minTickGap={30}
                            interval="preserveStartEnd"
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (active && payload && payload.length) {
                                    return (
                                        <div className="bg-white dark:bg-[#0f172a] p-2 rounded-lg shadow-lg border border-slate-100 dark:border-slate-700 text-xs">
                                            <p className="font-medium text-slate-700 dark:text-slate-200 mb-1">
                                                {format(new Date(label), 'd. MMM', { locale: hr })}
                                            </p>
                                            <p className={clsx("font-bold", color === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400")}>
                                                {payload[0].value.toFixed(2)} €
                                            </p>
                                        </div>
                                    );
                                }
                                return null;
                            }}
                        />
                        <Area
                            type="monotone"
                            dataKey="amount"
                            stroke={color === "emerald" ? "#10b981" : "#f59e0b"}
                            fillOpacity={1}
                            fill={`url(#gradient-${type})`}
                            strokeWidth={2}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};

const Dashboard = () => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [startDate, setStartDate] = useState('2025-01-01');
    const [endDate, setEndDate] = useState('2025-12-31');
    const [transactionType, setTransactionType] = useState(''); // '' | 'inflow' | 'outflow'

    // Advanced features state
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [lastSelectedId, setLastSelectedId] = useState(null);
    const [darkMode, setDarkMode] = useState(() => localStorage.getItem('theme') === 'dark');
    const [user, setUser] = useState(null);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [highlightedTx, setHighlightedTx] = useState(null);
    const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });

    const handleSort = (key) => {
        setSortConfig((current) => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    const sortedTransactions = React.useMemo(() => {
        let sortableItems = [...transactions];
        if (sortConfig.key !== null) {
            sortableItems.sort((a, b) => {
                if (sortConfig.key === 'date') {
                    const dateA = new Date(a.date);
                    const dateB = new Date(b.date);
                    return sortConfig.direction === 'asc' ? dateA - dateB : dateB - dateA;
                }
                if (sortConfig.key === 'amount') {
                    return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
                }
                if (sortConfig.key === 'type') {
                    return sortConfig.direction === 'asc'
                        ? a.type.localeCompare(b.type)
                        : b.type.localeCompare(a.type);
                }
                if (sortConfig.key === 'category') {
                    // Primary sort by category
                    const catCompare = a.category.localeCompare(b.category);
                    if (catCompare !== 0) {
                        return sortConfig.direction === 'asc' ? catCompare : -catCompare;
                    }
                    // Secondary sort by date (always desc for secondary)
                    return new Date(b.date) - new Date(a.date);
                }
                return 0;
            });
        }
        return sortableItems;
    }, [transactions, sortConfig]);

    // Fetch user profile
    useEffect(() => {
        getProfile().then(setUser).catch(console.error);
    }, []);

    const handleLogout = async () => {
        try {
            await logout();
            setUser(null);
            setShowUserMenu(false);
            // Optionally redirect or show generic state
        } catch (e) {
            console.error(e);
        }
    };

    // Dark mode effect
    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [darkMode]);

    // Selection logic
    const handleSelect = (id, e) => {
        e.stopPropagation();
        const newSelected = new Set(selectedIds);

        if (e.shiftKey && lastSelectedId) {
            const currentIndex = transactions.findIndex(t => t.id === id);
            const lastIndex = transactions.findIndex(t => t.id === lastSelectedId);

            const start = Math.min(currentIndex, lastIndex);
            const end = Math.max(currentIndex, lastIndex);

            // Select range
            for (let i = start; i <= end; i++) {
                newSelected.add(transactions[i].id);
            }
        } else {
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
        }

        setSelectedIds(newSelected);
        setLastSelectedId(id);
    };

    const handleSelectAll = () => {
        if (selectedIds.size === transactions.length && transactions.length > 0) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(transactions.map(t => t.id)));
        }
    };

    const handleBatchDownload = async () => {
        const ids = Array.from(selectedIds);
        const filesToMerge = [];

        // Find transactions with source_file
        transactions.forEach(t => {
            if (selectedIds.has(t.id) && t.source_file) {
                // Avoid duplicates if multiple transactions from same file? 
                // Actually maybe user wants pages repeated? Let's unique it.
                if (!filesToMerge.includes(t.source_file)) {
                    filesToMerge.push(t.source_file);
                }
            }
        });

        if (filesToMerge.length === 0) {
            alert("Niti jedna odabrana transakcija nema izvorni dokument.");
            return;
        }

        try {
            setLoading(true);
            const blob = await mergeDocuments(filesToMerge);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `merged_transactions_${filesToMerge.length}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert("Greška pri spajanju dokumenata: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            loadData(true);
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    // Check auth on load
    const fileInputRef = React.useRef(null);

    const loadData = async (reset = false) => {
        setLoading(true);
        console.log("Loading all data:", { startDate, endDate, transactionType, search });
        try {
            // Fetch all transactions (limit = -1)
            const result = await fetchTransactions(startDate, endDate, transactionType, 1, -1, search);
            console.log("fetchTransactions result:", result);

            // Robust checks for data structure
            let newData = [];
            let total = 0;

            if (result && result.data && Array.isArray(result.data)) {
                newData = result.data;
                total = result.total;
            } else if (Array.isArray(result)) {
                newData = result;
                total = result.length;
            }

            console.log(`Received ${newData.length} items.`);
            setTransactions(newData);

        } catch (error) {
            console.error("Failed to load transactions", error);
            alert("Greška pri učitavanju transakcija: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    // Calculate totals using a separate stats endpoint or aggregate if feasible (for now doing client side on loaded, which is imperfect but okay for lazy load start)
    // Ideally user wants totals of EVERYTHING. We should add a stats endpoint for accurate totals.
    // For now, let's keep it simple and just sum visible or we might need to update backend to return totals.
    // Backend upgrade for totals in metadata is better. Let's assume for now we only show totals of LOADED data or fetch stats separately.
    // For this step, I will calculate on loaded data to avoid breaking UI, but note it might be partial.

    const visibleInflow = transactions
        .filter(t => t.type === 'inflow')
        .reduce((sum, t) => sum + t.amount, 0);

    const visibleOutflow = transactions
        .filter(t => t.type === 'outflow')
        .reduce((sum, t) => sum + t.amount, 0);



    // Replace totals with calculated ones from partial data for now
    const totalInflow = visibleInflow;
    const totalOutflow = visibleOutflow;

    const generateChartData = (type) => {
        const filtered = transactions.filter(t => t.type === type);
        const grouped = filtered.reduce((acc, t) => {
            const d = t.date.split('T')[0];
            acc[d] = (acc[d] || 0) + t.amount;
            return acc;
        }, {});

        return Object.keys(grouped).sort().map(date => ({
            date,
            amount: grouped[date]
        }));
    };

    const handleChartClick = (date) => {
        // Find first transaction with this date
        const targetTx = transactions.find(t => t.date.startsWith(date));
        if (targetTx) {
            setHighlightedTx(targetTx.id);
            const el = document.getElementById(`tx-${targetTx.id}`);
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
            // Remove highlight after 2 seconds
            setTimeout(() => setHighlightedTx(null), 2000);
        }
    };

    useEffect(() => {
        loadData(true);
    }, [startDate, endDate, transactionType]);

    const handleSync = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0) return;

        const formData = new FormData();
        Array.from(files).forEach((file) => {
            formData.append('files', file);
        });

        try {
            setLoading(true);
            const response = await import('../api').then(mod => mod.uploadTransactions(formData));

            const summary = response.summary;
            let msg = `Sinkronizacija uspješna!\nDodano: ${summary.total_added}\nPronađeno: ${summary.total_found}`;

            // Check for individual errors
            const errors = response.details.filter(d => d.status === 'error');
            if (errors.length > 0) {
                msg += `\n\nGreške (${errors.length}):`;
                errors.forEach(e => msg += `\n- ${e.filename}: ${e.error}`);
            }

            alert(msg);
            await loadData();
        } catch (error) {
            console.error(error);
            alert('Greška pri uploadu datoteka: ' + (error.response?.data?.detail || error.message));
        } finally {
            setLoading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleDownloadXML = () => {
        let year = new Date().getFullYear();
        if (startDate) {
            try {
                const parsed = new Date(startDate);
                if (!isNaN(parsed.getTime())) {
                    year = parsed.getFullYear();
                }
            } catch (e) {
                console.error("Invalid date parsing", e);
            }
        }
        window.open(`http://localhost:8000/api/posd/xml?year=${year}`, '_blank');
    };

    const handleYearFilter = (year) => {
        setStartDate(`${year}-01-01`);
        setEndDate(`${year}-12-31`);
    };



    const handleSingleDownload = async (filename, e) => {
        e.stopPropagation();
        e.preventDefault();
        try {
            // reuse mergeDocuments for single file
            const blob = await mergeDocuments([filename]);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${filename.replace('.html', '')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download error:", error);
            alert("Greška pri preuzimanju dokumenta: " + error.message);
        }
    };


    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6 transition-colors duration-300 dark:bg-[#0f172a] min-h-screen font-sans">
            {/* Main Header Card */}
            <div className="bg-white dark:bg-[#1e293b] p-6 rounded-3xl shadow-sm border border-slate-100 dark:border-slate-700/50">
                {/* Top Row: Title & Top Controls */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-1">Transakcije</h1>
                        <p className="text-slate-500 dark:text-slate-400 text-sm">Upravljanje poslovnim financijama</p>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Dark Mode Toggle */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-full p-1 cursor-pointer" onClick={() => setDarkMode(!darkMode)}>
                            <div className={clsx("p-1.5 rounded-full transition-all", !darkMode ? "bg-white shadow-sm text-yellow-500" : "text-slate-400")}>
                                <Sun size={16} />
                            </div>
                            <div className={clsx("p-1.5 rounded-full transition-all", darkMode ? "bg-slate-600 text-white shadow-sm" : "text-slate-400")}>
                                <Moon size={16} />
                            </div>
                        </div>

                        {/* Transaction Type Filter (Segmented Control) */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                            {['', 'inflow', 'outflow'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setTransactionType(type)}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200",
                                        transactionType === type
                                            ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    )}
                                >
                                    {type === '' ? 'Sve' : type === 'inflow' ? 'Uplate' : 'Isplate'}
                                </button>
                            ))}
                        </div>

                        {/* Refresh Button */}
                        <button
                            onClick={() => loadData(true)}
                            className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 transition-colors"
                        >
                            <RefreshCw size={20} />
                        </button>
                    </div>
                </div>

                {/* Filters & Actions Row */}
                <div className="flex flex-col xl:flex-row gap-4 items-stretch xl:items-center justify-between">
                    <div className="flex flex-col sm:flex-row gap-3 items-center w-full xl:w-auto">
                        {/* Search Input */}
                        <div className="flex items-center gap-2 bg-[#0f172a] dark:bg-[#0B1120] border border-slate-800 dark:border-slate-800 rounded-lg px-3 py-2.5 w-full sm:w-64">
                            <span className="text-xs font-bold text-slate-500">Traži:</span>
                            <input
                                type="text"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="bg-transparent border-none outline-none text-sm text-slate-200 w-full placeholder-slate-600"
                                placeholder='npr. Konzum'
                            />
                        </div>

                        {/* Date Filter */}
                        <div className="flex items-center bg-[#1e293b] dark:bg-[#1e293b] border border-slate-700/50 rounded-lg p-1">
                            <div className="px-3 border-r border-slate-700/50 text-slate-400 flex items-center gap-2">
                                <Filter size={14} />
                                <span className="text-[10px] font-bold tracking-wider">DATUM</span>
                            </div>
                            <div className="flex items-center px-2 gap-2 text-slate-300">
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="bg-transparent outline-none text-xs w-36 [color-scheme:dark]"
                                />
                                <span className="text-slate-600">&rarr;</span>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="bg-transparent outline-none text-xs w-36 [color-scheme:dark]"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full xl:w-auto justify-between xl:justify-end">
                        {/* Year Selector */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 p-1 rounded-lg">
                            {[2024, 2025, 2026].map((year) => (
                                <button
                                    key={year}
                                    onClick={() => handleYearFilter(year)}
                                    className={clsx(
                                        "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                                        startDate.startsWith(year.toString())
                                            ? "bg-slate-500 text-white shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600"
                                    )}
                                >
                                    {year}
                                </button>
                            ))}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <button
                                onClick={handleSync}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <Upload size={14} />
                                Upload
                            </button>
                            <button
                                onClick={handleDownloadXML}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-medium text-slate-300 border border-slate-700 hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <Download size={14} />
                                XML
                            </button>
                            <input
                                type="file"
                                multiple
                                accept=".html"
                                ref={fileInputRef}
                                className="hidden"
                                onChange={handleFileChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Stat Cards - Moving them below the main header card */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                    title="Ukupno Primitaka"
                    value={`+${totalInflow.toFixed(2)} €`}
                    type="inflow"
                    color="emerald"
                    data={generateChartData('inflow')}
                    onClick={handleChartClick}
                />
                <StatCard
                    title="Ukupno Izdataka"
                    value={`-${totalOutflow.toFixed(2)} €`}
                    type="outflow"
                    color="amber"
                    data={generateChartData('outflow')}
                    onClick={handleChartClick}
                />
            </div>



            {/* Floating Batch Action Bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-4 animate-in fade-in slide-in-from-bottom-4">
                    <span className="font-semibold text-sm">{selectedIds.size} odabrano</span>
                    <div className="h-4 w-px bg-slate-700 dark:bg-slate-300"></div>
                    <button
                        onClick={handleBatchDownload}
                        className="flex items-center gap-2 text-sm font-medium hover:opacity-80 transition"
                    >
                        <FileText size={16} />
                        Preuzmi spojeni PDF
                    </button>
                    <button
                        onClick={() => setSelectedIds(new Set())}
                        className="ml-2 text-slate-400 dark:text-slate-500 hover:text-white dark:hover:text-slate-900 text-xs"
                    >
                        Poništi
                    </button>
                </div>
            )}

            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden transition-colors">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        className="rounded border-slate-300 dark:border-slate-600 cursor-pointer"
                                        checked={transactions.length > 0 && selectedIds.size === transactions.length}
                                        onChange={handleSelectAll}
                                    />
                                </th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors group select-none"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-1">
                                        Datum
                                        <span className={clsx("transition-opacity", sortConfig.key === 'date' ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
                                            {sortConfig.key === 'date' && sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </span>
                                    </div>
                                </th>
                                <th className="px-6 py-4">Opis</th>
                                <th
                                    className="px-6 py-4 cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors group select-none"
                                    onClick={() => handleSort('category')}
                                >
                                    <div className="flex items-center gap-1">
                                        Kategorija
                                        <span className={clsx("transition-opacity", sortConfig.key === 'category' ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
                                            {sortConfig.key === 'category' && sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-right cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors group select-none"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-1">
                                        Iznos
                                        <span className={clsx("transition-opacity", sortConfig.key === 'amount' ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
                                            {sortConfig.key === 'amount' && sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </span>
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 text-center cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 transition-colors group select-none"
                                    onClick={() => handleSort('type')}
                                >
                                    <div className="flex items-center justify-center gap-1">
                                        Tip
                                        <span className={clsx("transition-opacity", sortConfig.key === 'type' ? "opacity-100" : "opacity-0 group-hover:opacity-50")}>
                                            {sortConfig.key === 'type' && sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                        </span>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center">Učitavanje...</td></tr>
                            ) : transactions.length === 0 ? (
                                <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-400">Nema pronađenih transakcija.</td></tr>
                            ) : (
                                sortedTransactions.map((tx) => (
                                    <tr
                                        key={tx.id}
                                        id={`tx-${tx.id}`}
                                        className={clsx(
                                            "hover:bg-slate-50 dark:hover:bg-slate-700/50 transition duration-300 group cursor-pointer",
                                            selectedIds.has(tx.id) && "bg-blue-50 dark:bg-blue-900/20",
                                            highlightedTx === tx.id && "shadow-[0_0_20px_rgba(99,102,241,0.3)] bg-indigo-50 dark:bg-indigo-900/30 z-10 relative"
                                        )}
                                        onClick={(e) => handleSelect(tx.id, e)}
                                    >
                                        <td className="px-6 py-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(tx.id)}
                                                onChange={(e) => handleSelect(tx.id, e)}
                                                className="rounded border-slate-300 dark:border-slate-600 cursor-pointer"
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-900 dark:text-white border-b border-transparent">
                                            {format(new Date(tx.date), 'dd.MM.yyyy')}
                                        </td>
                                        <td className="px-6 py-4 max-w-md truncate relative" title={tx.description}>
                                            <div className="font-medium text-slate-800 dark:text-slate-200">{tx.description}</div>
                                            <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 flex items-center gap-2">
                                                {tx.raw_reference}
                                                {tx.source_file && (
                                                    <button
                                                        onClick={(e) => handleSingleDownload(tx.source_file, e)}
                                                        className="opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/40 px-1.5 py-0.5 rounded ml-2"
                                                    >
                                                        <span className="text-[10px] font-semibold">PDF</span>
                                                        <Download size={10} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-full text-xs font-medium border",
                                                tx.category === 'business_income' ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-100 dark:border-emerald-800" :
                                                    tx.category === 'business_expense' ? "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-800" :
                                                        "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-600"
                                            )}>
                                                {tx.category === 'business_income' ? 'Poslovni primitak' :
                                                    tx.category === 'business_expense' ? 'Poslovni izdatak' :
                                                        tx.category.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className={clsx(
                                            "px-6 py-4 text-right font-semibold font-mono",
                                            tx.type === 'inflow' ? "text-emerald-600 dark:text-emerald-400" : "text-slate-700 dark:text-slate-300"
                                        )}>
                                            {tx.type === 'inflow' ? '+' : '-'}{tx.amount.toFixed(2)} €
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {tx.type === 'inflow' ? (
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
                                                    <ArrowDownLeft size={16} />
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">
                                                    <ArrowUpRight size={16} />
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}

                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
