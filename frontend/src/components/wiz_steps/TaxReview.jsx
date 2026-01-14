import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, CheckCircle, XCircle, AlertCircle, Search, ArrowUp, ArrowDown, Ban } from 'lucide-react';
import clsx from 'clsx';
import { fetchTransactions } from '../../api';

const TaxReview = ({ year, onNext, onBack }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Local state to track changes before saving
    // Map of transaction ID -> { tax_type: 'tax' | 'surtax' | '' }
    const [changes, setChanges] = useState({});

    useEffect(() => {
        loadData();
    }, [year]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch all OUTFLOW transactions for the year
            const data = await fetchTransactions(
                `${year}-01-01`,
                `${year + 1}-01-15`, // Include grace period for tax payments
                'outflow',
                1,
                -1
            );

            setTransactions(data.data || []);
        } catch (e) {
            console.error("Failed to load transactions", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSetTaxType = (id, type) => {
        // type: 'tax', 'surtax', or '' (none)
        setChanges({
            ...changes,
            [id]: { tax_type: type }
        });
    };

    const toggleSort = (key) => {
        let direction = 'asc';
        if (sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const handleSaveAndNext = async () => {
        // Prepare bulk update payload
        const itemsToUpdate = Object.entries(changes).map(([id, change]) => {
            return {
                id: id,
                tax_type: change.tax_type
            };
        });

        if (itemsToUpdate.length > 0) {
            try {
                await fetch('http://localhost:8000/api/transactions/review', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ items: itemsToUpdate })
                });
            } catch (e) {
                alert("Greška pri spremanju promjena: " + e.message);
                return;
            }
        }

        onNext();
    };

    // Helper to determine effective tax type (DB or Heuristic or Local Change)
    const getEffectiveTaxType = (tx) => {
        // 1. Local Change
        if (changes[tx.id] && changes[tx.id].tax_type !== undefined) {
            return changes[tx.id].tax_type; // 'tax', 'surtax', or ''
        }

        // 2. DB Value
        if (tx.tax_type) {
            return tx.tax_type;
        }

        // 3. Heuristic
        // Match backend logic in posd_logic.py
        if (tx.raw_reference && tx.raw_reference.includes("HR68 1449")) return 'tax';

        const desc = tx.description.toUpperCase();
        if (desc.includes("PRIREZ")) return 'surtax';
        if (desc.includes("POREZ NA DOHODAK")) return 'tax';

        return ''; // Not a tax
    };

    // Filter and Sort logic
    const sortedTxs = useMemo(() => {
        let filtered = transactions.filter(tx => {
            const s = search.toLowerCase();
            return tx.description.toLowerCase().includes(s) ||
                tx.amount.toString().includes(s);
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                const valA = a[sortConfig.key];
                const valB = b[sortConfig.key];

                if (valA < valB) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [transactions, search, sortConfig]);

    // Stats
    const totalOutflow = transactions.reduce((acc, tx) => acc + tx.amount, 0);

    // Calculate tax/surtax from visible transactions (or all transactions? ideally all)
    // We should use 'transactions' array to calc stats, not filtered
    const { totalTax, totalSurtax } = useMemo(() => {
        let t = 0;
        let s = 0;
        transactions.forEach(tx => {
            const type = getEffectiveTaxType(tx);
            if (type === 'tax') t += tx.amount;
            if (type === 'surtax') s += tx.amount;
        });
        return { totalTax: t, totalSurtax: s };
    }, [transactions, changes]);

    if (loading) return <div className="p-12 text-center text-slate-500">Učitavanje isplata...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Uplaćeni Porezi</h3>
                <p className="text-slate-500 dark:text-slate-400">
                    Oznacite transakcije koje se odnose na uplatu paušalnog poreza i prireza.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ukupno Isplate</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{totalOutflow.toFixed(2)} €</div>
                </div>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-100 dark:border-blue-800">
                    <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-1">Porez</div>
                    <div className="text-2xl font-mono font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">{totalTax.toFixed(2)} €</div>
                </div>
                <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-800">
                    <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">Prirez</div>
                    <div className="text-2xl font-mono font-bold text-indigo-700 dark:text-indigo-400 whitespace-nowrap">{totalSurtax.toFixed(2)} €</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Pretraži isplate..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-auto max-h-[500px]">
                <table className="w-full text-sm text-left min-w-[600px]">
                    <thead className="bg-slate-50 dark:bg-slate-800 text-xs uppercase text-slate-500 sticky top-0 z-10">
                        <tr>
                            <th
                                className="px-4 py-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none group"
                                onClick={() => toggleSort('date')}
                            >
                                <div className="flex items-center gap-1">
                                    Datum
                                    {sortConfig.key === 'date' && (
                                        sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                    )}
                                </div>
                            </th>
                            <th className="px-4 py-3">Opis</th>
                            <th
                                className="px-4 py-3 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition select-none flex items-center justify-end gap-1"
                                onClick={() => toggleSort('amount')}
                            >
                                Iznos
                                {sortConfig.key === 'amount' && (
                                    sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                )}
                            </th>
                            <th className="px-4 py-3 text-center">Vrsta Uplate</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedTxs.map(tx => {
                            const effectiveType = getEffectiveTaxType(tx);
                            const isTax = effectiveType === 'tax';
                            const isSurtax = effectiveType === 'surtax';
                            const isOther = !isTax && !isSurtax;

                            return (
                                <tr key={tx.id} className={clsx("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition", (isTax || isSurtax) && "bg-blue-50/30 dark:bg-blue-900/10")}>
                                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('hr-HR')}</td>
                                    <td className="px-4 py-3 max-w-[200px] truncate" title={tx.description}>
                                        <div className="font-medium text-slate-900 dark:text-white">{tx.description}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        {tx.amount.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-center bg-slate-100 dark:bg-slate-800 rounded-lg p-1 w-fit mx-auto">
                                            <button
                                                onClick={() => handleSetTaxType(tx.id, '')}
                                                className={clsx(
                                                    "px-2 py-1 text-xs font-medium rounded-md transition-all",
                                                    isOther
                                                        ? "bg-white dark:bg-slate-700 text-slate-700 dark:text-white shadow-sm"
                                                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                                                )}
                                            >
                                                Ostalo
                                            </button>
                                            <button
                                                onClick={() => handleSetTaxType(tx.id, 'tax')}
                                                className={clsx(
                                                    "px-2 py-1 text-xs font-medium rounded-md transition-all",
                                                    isTax
                                                        ? "bg-blue-500 text-white shadow-sm"
                                                        : "text-slate-500 hover:text-blue-600 dark:hover:text-blue-400"
                                                )}
                                            >
                                                Porez
                                            </button>
                                            <button
                                                onClick={() => handleSetTaxType(tx.id, 'surtax')}
                                                className={clsx(
                                                    "px-2 py-1 text-xs font-medium rounded-md transition-all",
                                                    isSurtax
                                                        ? "bg-indigo-500 text-white shadow-sm"
                                                        : "text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400"
                                                )}
                                            >
                                                Prirez
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div className="flex gap-4 pt-4">
                <button onClick={onBack} className="px-6 py-3 text-slate-400 hover:text-slate-600 font-medium">Natrag</button>
                <button
                    onClick={handleSaveAndNext}
                    className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-200 dark:shadow-blue-900/40 flex items-center gap-2 ml-auto"
                >
                    Spremi i Nastavi <ArrowRight size={18} />
                </button>
            </div>
        </div>
    );
};

export default TaxReview;
