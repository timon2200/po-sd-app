import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight, CheckCircle, XCircle, AlertCircle, FileText, Search, ArrowUp, ArrowDown } from 'lucide-react';
import clsx from 'clsx';
import { fetchTransactions } from '../../api';

const TransactionReview = ({ year, onNext, onBack }) => {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

    // Local state to track changes before saving
    // Map of transaction ID -> { is_excluded, note }
    const [changes, setChanges] = useState({});

    useEffect(() => {
        loadData();
    }, [year]);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch all transactions for the year, type inflow
            // Limit -1 to get all
            // Fetch all transactions for the year, type inflow
            // Signature: startDate, endDate, type, page, limit, search
            const data = await fetchTransactions(
                `${year}-01-01`,
                `${year}-12-31`,
                'inflow',
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

    const handleToggleExclude = (id, currentExcluded) => {
        const currentChange = changes[id] || {};
        // If not in changes, use current value from tx
        // Wait, better to just update change map

        // Find tx to get initial state if not in changes
        const tx = transactions.find(t => t.id === id);
        const initialExcluded = tx?.is_excluded_from_posd || false;

        // Determine new value
        // If we have a pending change, toggle that. If not, toggle initial.
        const effectiveExcluded = currentChange.hasOwnProperty('is_excluded') ? currentChange.is_excluded : initialExcluded;

        setChanges({
            ...changes,
            [id]: {
                ...currentChange,
                is_excluded: !effectiveExcluded
            }
        });
    };

    const handleNoteChange = (id, note) => {
        const currentChange = changes[id] || {};
        setChanges({
            ...changes,
            [id]: {
                ...currentChange,
                note: note
            }
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
            const tx = transactions.find(t => t.id === id);
            return {
                id: id,
                is_excluded: change.hasOwnProperty('is_excluded') ? change.is_excluded : (tx?.is_excluded_from_posd || false),
                note: change.hasOwnProperty('note') ? change.note : (tx?.posd_note || '')
            };
        });

        if (itemsToUpdate.length > 0) {
            try {
                // We need to implement this API call in api.js or directly here
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

    // Filter and Sort logic
    const sortedTxs = useMemo(() => {
        let filtered = transactions.filter(tx => {
            const s = search.toLowerCase();
            return tx.description.toLowerCase().includes(s) ||
                tx.amount.toString().includes(s) ||
                (tx.posd_note && tx.posd_note.toLowerCase().includes(s));
        });

        if (sortConfig.key) {
            filtered.sort((a, b) => {
                if (a[sortConfig.key] < b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? -1 : 1;
                }
                if (a[sortConfig.key] > b[sortConfig.key]) {
                    return sortConfig.direction === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }

        return filtered;
    }, [transactions, search, sortConfig]);

    // Stats for UI
    const totalAmount = transactions.reduce((acc, tx) => acc + tx.amount, 0);

    // Calculate excluded amount based on current local state
    const excludedAmount = transactions.reduce((acc, tx) => {
        const change = changes[tx.id];
        const isExcluded = change && change.hasOwnProperty('is_excluded')
            ? change.is_excluded
            : (tx.is_excluded_from_posd || false);

        return isExcluded ? acc + tx.amount : acc;
    }, 0);

    const posdBase = totalAmount - excludedAmount;

    if (loading) return <div className="p-12 text-center text-slate-500">Učitavanje prometa...</div>;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
            <div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Revizija Prometa</h3>
                <p className="text-slate-500 dark:text-slate-400">
                    Pregledajte sve priljeve. Isključite one koji nisu oporezivi poslovni primici (npr. povrati, osobne uplate).
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Ukupno Priljevi</div>
                    <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white whitespace-nowrap">{totalAmount.toFixed(2)} €</div>
                </div>
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-100 dark:border-amber-800">
                    <div className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Izuzeto</div>
                    <div className="text-2xl font-mono font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">{excludedAmount.toFixed(2)} €</div>
                </div>
                <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-100 dark:border-emerald-800">
                    <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1">PO-SD Osnovica</div>
                    <div className="text-2xl font-mono font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{posdBase.toFixed(2)} €</div>
                </div>
            </div>

            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                    type="text"
                    placeholder="Pretraži transakcije..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-10 p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
            </div>

            {/* List */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm text-left">
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
                            <th className="px-4 py-3 text-center">Uključi u PO-SD</th>
                            <th className="px-4 py-3">Napomena</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedTxs.map(tx => {
                            const change = changes[tx.id] || {};
                            const isExcluded = change.hasOwnProperty('is_excluded') ? change.is_excluded : (tx.is_excluded_from_posd || false);
                            const note = change.hasOwnProperty('note') ? change.note : (tx.posd_note || '');

                            // Visual hint for potential refunds
                            const isRefundHint = tx.description.toLowerCase().includes('povrat') || tx.description.toLowerCase().includes('refund');

                            return (
                                <tr key={tx.id} className={clsx("hover:bg-slate-50 dark:hover:bg-slate-800/50 transition", isExcluded && "bg-amber-50/50 dark:bg-amber-900/10")}>
                                    <td className="px-4 py-3 font-mono text-slate-500 whitespace-nowrap">{new Date(tx.date).toLocaleDateString('hr-HR')}</td>
                                    <td className="px-4 py-3 max-w-[200px] truncate" title={tx.description}>
                                        <div className="font-medium text-slate-900 dark:text-white">{tx.description}</div>
                                        {isRefundHint && !isExcluded && (
                                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded mt-1">
                                                <AlertCircle size={10} /> Mogući povrat?
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                                        {tx.amount.toFixed(2)}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <button
                                            onClick={() => handleToggleExclude(tx.id)}
                                            className={clsx(
                                                "p-2 rounded-lg transition-all",
                                                !isExcluded
                                                    ? "text-emerald-600 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:hover:bg-emerald-900/40"
                                                    : "text-slate-400 hover:text-slate-600"
                                            )}
                                        >
                                            {!isExcluded ? <CheckCircle size={20} className="fill-current" /> : <div className="w-5 h-5 rounded-full border-2 border-slate-300" />}
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <textarea
                                            rows="1"
                                            placeholder={isExcluded ? "Navedite razlog..." : "Dodaj napomenu..."}
                                            value={note}
                                            onChange={(e) => handleNoteChange(tx.id, e.target.value)}
                                            className={clsx(
                                                "w-full bg-transparent border-b border-transparent focus:border-blue-500 outline-none text-xs py-2 transition-all resize-none focus:min-h-[60px]",
                                                isExcluded && !note && "border-amber-300 placeholder:text-amber-400"
                                            )}
                                        />
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

export default TransactionReview;
