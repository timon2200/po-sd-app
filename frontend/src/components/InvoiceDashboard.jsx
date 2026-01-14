import React, { useState, useEffect } from 'react';
import { fetchInvoices, getInvoiceStats, deleteInvoice, downloadInvoicePdf } from '../api';
import { Plus, Search, Filter, FileText, CheckCircle, AlertCircle, Clock, MoreHorizontal, Trash2, Edit, Download } from 'lucide-react';
import clsx from 'clsx';
import { format } from 'date-fns';
import { hr } from 'date-fns/locale';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

const StatCard = ({ title, value, count, trend, trendValue, icon: Icon, color, data }) => {
    return (
        <div className="bg-white dark:bg-[#1e293b] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between overflow-hidden relative h-40">
            <div className="flex justify-between items-start z-10">
                <div>
                    <h3 className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">{title}</h3>
                    <div className="flex items-baseline gap-2">
                        <span className={clsx("text-2xl font-bold", `text-${color}-600 dark:text-${color}-400`)}>
                            {value}
                        </span>
                        {count !== undefined && (
                            <span className="text-xs text-slate-400 dark:text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                                {count}
                            </span>
                        )}
                    </div>
                </div>
                <div className={clsx("p-2 rounded-xl", `bg-${color}-50 text-${color}-600 dark:bg-${color}-900/30 dark:text-${color}-400`)}>
                    <Icon size={20} />
                </div>
            </div>

            {/* Mini Chart Background */}
            {data && data.length > 1 && (
                <div className="absolute bottom-0 left-0 right-0 h-16 opacity-30">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id={`gradient-${color}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={color === 'emerald' ? '#10b981' : color === 'indigo' ? '#6366f1' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#f43f5e' : '#64748b'} stopOpacity={0.8} />
                                    <stop offset="95%" stopColor={color === 'emerald' ? '#10b981' : color === 'indigo' ? '#6366f1' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#f43f5e' : '#64748b'} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <Area
                                type="monotone"
                                dataKey="amount"
                                stroke={color === 'emerald' ? '#10b981' : color === 'indigo' ? '#6366f1' : color === 'amber' ? '#f59e0b' : color === 'rose' ? '#f43f5e' : '#64748b'}
                                fill={`url(#gradient-${color})`}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    );
};

const InvoiceDashboard = ({ onCreateNew }) => {
    const [invoices, setInvoices] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());

    useEffect(() => {
        loadData();
    }, [statusFilter, year]);

    // Search debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            loadData();
        }, 500);
        return () => clearTimeout(timer);
    }, [search]);

    const loadData = async () => {
        setLoading(true);
        try {
            const [invRes, statsRes] = await Promise.all([
                fetchInvoices(1, -1, search, statusFilter), // Load all for now to generate charts locally
                getInvoiceStats(year)
            ]);

            setInvoices(invRes.data || []);
            setStats(statsRes);
        } catch (error) {
            console.error("Failed to load invoice data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id, e) => {
        e.stopPropagation();
        if (window.confirm("Jeste li sigurni da želite obrisati ovaj račun?")) {
            try {
                await deleteInvoice(id);
                loadData();
            } catch (error) {
                alert("Greška pri brisanju.");
            }
        }
    };

    const handleDownload = async (invoice, e) => {
        e.stopPropagation();
        try {
            const blob = await downloadInvoicePdf(invoice.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Racun_${invoice.number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            console.error(error);
            alert("Greška pri preuzimanju PDF-a.");
        }
    };

    const formatCurrency = (val) => new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(val);

    // Generate chart data from invoices
    const getChartData = (status) => {
        if (!invoices.length) return [];
        const filtered = status ? invoices.filter(i => i.status === status) : invoices;

        // Group by month for smoother mini-chart
        const grouped = filtered.reduce((acc, curr) => {
            const key = curr.issue_date.substring(0, 7); // YYYY-MM
            acc[key] = (acc[key] || 0) + curr.total_amount;
            return acc;
        }, {});

        return Object.entries(grouped)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([date, amount]) => ({ date, amount }));
    };

    return (
        <div className="p-6 max-w-[1920px] mx-auto space-y-8 font-sans transition-colors duration-300">

            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Izdavanje Računa</h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">Pregled svih izdanih računa i statistika (Godina {year})</p>
                </div>
                <div className="flex gap-3">
                    <select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                        {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                    </select>

                    <button
                        onClick={onCreateNew}
                        className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition-all font-medium"
                    >
                        <Plus size={18} />
                        Novi Račun
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard
                    title="Ukupno Izdano"
                    value={stats ? formatCurrency(stats.total_issued) : '0,00 €'}
                    count={stats?.count_all}
                    icon={FileText}
                    color="indigo"
                    data={getChartData()}
                />
                <StatCard
                    title="Plaćeno"
                    value={stats ? formatCurrency(stats.total_paid) : '0,00 €'}
                    count={stats?.count_paid}
                    icon={CheckCircle}
                    color="emerald"
                    data={getChartData('paid')}
                />
                <StatCard
                    title="Otvoreno"
                    value={stats ? formatCurrency(stats.total_issued - stats.total_paid - stats.total_draft) : '0,00 €'}
                    count={stats?.count_open}
                    icon={Clock}
                    color="amber"
                    data={getChartData('open')}
                />
                <StatCard
                    title="Dospjelo"
                    value={stats ? formatCurrency(stats.total_overdue) : '0,00 €'}
                    count={stats?.count_overdue}
                    icon={AlertCircle}
                    color="rose"
                    data={getChartData('overdue')}
                />
            </div>

            {/* Main Content Card */}
            <div className="bg-white dark:bg-[#1e293b] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden">

                {/* Filters Toolbar */}
                <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex flex-col sm:flex-row justify-between items-center gap-4">

                    {/* Search */}
                    <div className="relative w-full sm:w-72">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Pretraži klijenta, broj računa..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                        />
                    </div>

                    {/* Status Filters */}
                    <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                        {['', 'draft', 'open', 'paid', 'overdue'].map(status => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status)}
                                className={clsx(
                                    "px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize",
                                    statusFilter === status
                                        ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                                        : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                )}
                            >
                                {status === '' ? 'Svi' : status === 'open' ? 'Otvoreno' : status === 'paid' ? 'Plaćeno' : status === 'overdue' ? 'Dospjelo' : 'Nacrt'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto min-h-[400px]">
                    <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase font-semibold text-slate-500 dark:text-slate-400">
                            <tr>
                                <th className="px-6 py-4">Klijent</th>
                                <th className="px-6 py-4">Broj Računa</th>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4 text-right">Iznos</th>
                                <th className="px-6 py-4">Izdan</th>
                                <th className="px-6 py-4">Dospijeva</th>
                                <th className="px-6 py-4 text-center">Akcije</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {loading ? (
                                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">Učitavanje podataka...</td></tr>
                            ) : invoices.length === 0 ? (
                                <tr><td colSpan="7" className="px-6 py-12 text-center text-slate-400">Nema pronađenih računa.</td></tr>
                            ) : (
                                invoices.map((invoice) => (
                                    <tr key={invoice.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition duration-200 group">

                                        <td className="px-6 py-4">
                                            <div className="font-semibold text-slate-900 dark:text-white">{invoice.client_name}</div>
                                            <div className="text-xs text-slate-400">{invoice.client_city || 'HR'}</div>
                                        </td>

                                        <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400">
                                            {invoice.number}
                                        </td>

                                        <td className="px-6 py-4">
                                            <span className={clsx(
                                                "px-2.5 py-1 rounded-full text-xs font-bold border",
                                                invoice.status === 'paid' ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" :
                                                    invoice.status === 'overdue' ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400 dark:border-rose-800" :
                                                        invoice.status === 'draft' ? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700" :
                                                            "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                                            )}>
                                                {invoice.status === 'paid' ? 'PLAĆENO' :
                                                    invoice.status === 'overdue' ? 'DOSPJELO' :
                                                        invoice.status === 'draft' ? 'NACRT' : 'OTVORENO'}
                                            </span>
                                        </td>

                                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white">
                                            {formatCurrency(invoice.total_amount)}
                                        </td>

                                        <td className="px-6 py-4 text-slate-500">
                                            {format(new Date(invoice.issue_date), 'dd. MMM yyyy', { locale: hr })}
                                        </td>

                                        <td className="px-6 py-4 text-slate-500">
                                            {format(new Date(invoice.due_date), 'dd. MMM yyyy', { locale: hr })}
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleDownload(invoice, e)}
                                                    className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                                                    title="Preuzmi PDF"
                                                >
                                                    <Download size={16} />
                                                </button>
                                                <button className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => handleDelete(invoice.id, e)}
                                                    className="p-2 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination (Simple for now) */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-700 text-center text-xs text-slate-400">
                    Prikazano {invoices.length} računa
                </div>
            </div>
        </div>
    );
};

export default InvoiceDashboard;
