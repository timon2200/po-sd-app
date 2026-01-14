import React, { useState, useEffect } from 'react';
import ClientSelector from './ClientSelector';
import { Plus, Trash2, Download, Send, Save, Calendar, FileText, CreditCard } from 'lucide-react';
import clsx from 'clsx';

const InvoiceGenerator = () => {
    // State
    const [invoiceData, setInvoiceData] = useState({
        number: `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100) + 1).padStart(2, '0')}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        client: null,
        items: [
            { id: 1, description: 'Consulting Services', quantity: 10, price: 70.00, discount: 0, tax: 25 },
        ],
        notes: 'Hvala na poslovanju!',
        issuer: {
            name: '',
            address: '',
            oib: '',
            iban: '',
        }
    });

    useEffect(() => {
        // Fetch issuer info from backend
        fetch('http://localhost:8000/api/issuer')
            .then(res => res.json())
            .then(data => {
                setInvoiceData(prev => ({
                    ...prev,
                    issuer: {
                        name: data.name,
                        address: data.address,
                        oib: data.oib,
                        iban: data.iban
                    }
                }));
            })
            .catch(err => console.error("Failed to fetch issuer info:", err));
    }, []);

    // Calculations
    const calculateTotals = () => {
        let subtotal = 0;
        let taxTotal = 0;

        invoiceData.items.forEach(item => {
            const lineTotal = item.quantity * item.price;
            const discounted = lineTotal * (1 - (item.discount || 0) / 100);
            subtotal += discounted;
            taxTotal += discounted * ((item.tax || 0) / 100);
        });

        return {
            subtotal,
            taxTotal,
            total: subtotal + taxTotal
        };
    };

    const totals = calculateTotals();

    // Handlers
    const handleItemChange = (id, field, value) => {
        setInvoiceData(prev => ({
            ...prev,
            items: prev.items.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        }));
    };

    const addItem = () => {
        setInvoiceData(prev => ({
            ...prev,
            items: [...prev.items, {
                id: Date.now(),
                description: '',
                quantity: 1,
                price: 0,
                discount: 0,
                tax: 25 // Default VAT
            }]
        }));
    };

    const removeItem = (id) => {
        setInvoiceData(prev => ({
            ...prev,
            items: prev.items.filter(item => item.id !== id)
        }));
    };

    // Format helpers
    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('hr-HR', { style: 'currency', currency: 'EUR' }).format(amount);
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleDateString('hr-HR');
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 p-8 max-w-[1920px] mx-auto h-[calc(100vh-theme(spacing.20))] overflow-hidden">

            {/* LEFT COLUMN - EDITOR */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-2 custom-scrollbar">

                {/* Header Actions */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Novi Račun</h1>
                        <p className="text-slate-500 text-sm">Kreirajte i izdajte novi račun</p>
                    </div>
                    <div className="flex gap-3">
                        <button className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                            <Save size={18} />
                            <span className="hidden sm:inline">Spremi predložak</span>
                        </button>
                        <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition">
                            <Send size={18} />
                            <span>Izdaj račun</span>
                        </button>
                    </div>
                </div>

                {/* Invoice Metadata Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <FileText size={16} />
                        Osnovni Podaci
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Broj Računa</label>
                            <input
                                type="text"
                                value={invoiceData.number}
                                onChange={(e) => setInvoiceData({ ...invoiceData, number: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Datum Izdavanja</label>
                                <input
                                    type="date"
                                    value={invoiceData.issueDate}
                                    onChange={(e) => setInvoiceData({ ...invoiceData, issueDate: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Datum Dospijeća</label>
                                <input
                                    type="date"
                                    value={invoiceData.dueDate}
                                    onChange={(e) => setInvoiceData({ ...invoiceData, dueDate: e.target.value })}
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Client Selection Card */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                        <CreditCard size={16} />
                        Klijent
                    </h3>
                    <ClientSelector
                        onSelect={(c) => setInvoiceData({ ...invoiceData, client: c })}
                        currentName={invoiceData.client?.name}
                    />
                    {invoiceData.client && (
                        <div className="mt-4 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-100 dark:border-indigo-800/50 flex flex-col gap-1">
                            <div className="font-semibold text-indigo-900 dark:text-indigo-200">{invoiceData.client.name}</div>
                            <div className="text-sm text-indigo-700 dark:text-indigo-300">{invoiceData.client.address}, {invoiceData.client.city}</div>
                            <div className="text-sm text-indigo-600 dark:text-indigo-400 mt-1 font-mono">OIB: {invoiceData.client.oib}</div>
                        </div>
                    )}
                </div>

                {/* Items List */}
                <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-100 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                            <Calendar size={16} />
                            Stavke Računa
                        </h3>
                        <button onClick={addItem} className="text-indigo-600 hover:text-indigo-700 text-sm font-medium flex items-center gap-1">
                            <Plus size={16} /> Dodaj Stavku
                        </button>
                    </div>

                    <div className="flex flex-col gap-4">
                        {invoiceData.items.map((item, index) => (
                            <div key={item.id} className="grid grid-cols-12 gap-4 items-start p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 group">
                                <div className="col-span-12 sm:col-span-5">
                                    <label className="text-xs text-slate-500 mb-1 block">Opis usluge / proizvoda</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                        placeholder="npr. Konzultantske usluge"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="text-xs text-slate-500 mb-1 block">Kol.</label>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                    />
                                </div>
                                <div className="col-span-6 sm:col-span-2">
                                    <label className="text-xs text-slate-500 mb-1 block">Cijena (€)</label>
                                    <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                    />
                                </div>
                                <div className="col-span-11 sm:col-span-2">
                                    <label className="text-xs text-slate-500 mb-1 block">Ukupno</label>
                                    <div className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1.5 text-sm text-right font-mono text-slate-700 dark:text-slate-300">
                                        {formatCurrency(item.quantity * item.price)}
                                    </div>
                                </div>
                                <div className="col-span-1 flex items-end justify-center h-full pb-2">
                                    <button onClick={() => removeItem(item.id)} className="text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex flex-col items-end gap-2 text-slate-800 dark:text-slate-200">
                        <div className="flex justify-between w-full max-w-xs text-sm">
                            <span className="text-slate-500">Međuzbroj:</span>
                            <span>{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between w-full max-w-xs text-sm">
                            <span className="text-slate-500">PDV (25%):</span>
                            <span>{formatCurrency(totals.taxTotal)}</span>
                        </div>
                        <div className="flex justify-between w-full max-w-xs text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                            <span>Ukupno:</span>
                            <span>{formatCurrency(totals.total)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN - PREVIEW */}
            <div className="hidden xl:block w-[800px] bg-slate-100 dark:bg-slate-900/50 p-8 rounded-2xl overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800">
                <div className="sticky top-0 mb-6 flex justify-between items-center bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur pb-4 z-10 p-2">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Pregled Računa</h2>
                    <button className="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition">
                        Osvježi prikaz
                    </button>
                </div>

                {/* A4 Paper Simulation */}
                <div className="bg-white text-slate-900 shadow-2xl mx-auto min-h-[1050px] w-full max-w-[700px] p-12 relative flex flex-col font-sans transition-all duration-300">

                    {/* Paper Header */}
                    <div className="flex justify-between items-start mb-16">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                P
                            </div>
                            <div className="text-xl font-bold tracking-tight text-slate-900">{invoiceData.issuer.name}</div>
                        </div>
                        <div className="text-right">
                            <h1 className="text-4xl font-light text-slate-300 tracking-widest uppercase mb-2">Račun</h1>
                            <div className="text-sm font-semibold text-slate-700">Broj: {invoiceData.number}</div>
                            <div className="text-xs text-slate-500 mt-1">Ref: {Math.random().toString(36).substring(7).toUpperCase()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-12 mb-16">
                        {/* Issuer Info */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Izdavatelj</h3>
                            <div className="text-sm text-slate-800 font-bold mb-1">{invoiceData.issuer.name}</div>
                            <div className="text-xs text-slate-500 leading-relaxed">
                                {invoiceData.issuer.address}<br />
                                OIB: {invoiceData.issuer.oib}<br />
                                IBAN: {invoiceData.issuer.iban}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div>
                            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Za Korisnika</h3>
                            {invoiceData.client ? (
                                <>
                                    <div className="text-sm text-slate-800 font-bold mb-1">{invoiceData.client.name}</div>
                                    <div className="text-xs text-slate-500 leading-relaxed">
                                        {invoiceData.client.address}<br />
                                        {invoiceData.client.zip}, {invoiceData.client.city}<br />
                                        OIB: {invoiceData.client.oib}
                                    </div>
                                </>
                            ) : (
                                <div className="text-sm text-slate-300 italic">Molimo odaberite klijenta...</div>
                            )}
                        </div>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-4 gap-4 mb-12 border-t border-b border-slate-100 py-6">
                        <div>
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Datum Izdavanja</div>
                            <div className="text-sm font-medium">{formatDate(invoiceData.issueDate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Datum Dospijeća</div>
                            <div className="text-sm font-medium text-indigo-600">{formatDate(invoiceData.dueDate)}</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Način Plaćanja</div>
                            <div className="text-sm font-medium">Transakcijski račun</div>
                        </div>
                        <div>
                            <div className="text-[10px] uppercase text-slate-400 font-bold mb-1">Valuta</div>
                            <div className="text-sm font-medium">EUR</div>
                        </div>
                    </div>

                    {/* Table Header */}
                    <div className="flex items-center text-[10px] uppercase font-bold text-slate-400 mb-4 px-2">
                        <div className="flex-1">Opis Usluge / Proizvoda</div>
                        <div className="w-16 text-right">Kol.</div>
                        <div className="w-20 text-right">Cijena</div>
                        <div className="w-16 text-right">Popust</div>
                        <div className="w-24 text-right">Ukupno</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex flex-col gap-2 mb-8 min-h-[200px]">
                        {invoiceData.items.map((item) => {
                            const total = item.quantity * item.price * (1 - (item.discount || 0) / 100);
                            return (
                                <div key={item.id} className="flex items-start text-xs text-slate-600 py-3 border-b border-slate-50 px-2 last:border-0 hover:bg-slate-50 transition-colors">
                                    <div className="flex-1 font-medium text-slate-800">{item.description || <span className="text-slate-300 italic">Nova stavka...</span>}</div>
                                    <div className="w-16 text-right">{item.quantity}</div>
                                    <div className="w-20 text-right">{formatCurrency(item.price)}</div>
                                    <div className="w-16 text-right text-slate-400">{item.discount > 0 ? `${item.discount}%` : '-'}</div>
                                    <div className="w-24 text-right font-medium text-slate-800">{formatCurrency(total)}</div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Totals Section */}
                    <div className="flex flex-col items-end gap-2 mt-auto border-t-2 border-slate-100 pt-8">
                        <div className="flex justify-between w-64 text-sm">
                            <span className="text-slate-500">Iznos bez PDV-a:</span>
                            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between w-64 text-sm">
                            <span className="text-slate-500">PDV (25%):</span>
                            <span className="font-medium text-slate-600">{formatCurrency(totals.taxTotal)}</span>
                        </div>
                        <div className="flex justify-between w-64 text-lg font-bold text-slate-900 mt-4 pt-4 border-t border-slate-200">
                            <span>Za platiti:</span>
                            <span className="text-indigo-600">{formatCurrency(totals.total)}</span>
                        </div>
                    </div>

                    {/* Footer / Notes */}
                    <div className="mt-16 pt-8 border-t border-slate-100 text-xs text-slate-400">
                        <div className="font-bold mb-2 text-slate-500 uppercase">Napomena:</div>
                        <p>{invoiceData.notes}</p>
                        <div className="mt-8 flex justify-between items-end">
                            <div>
                                Generirano putem <strong className="text-indigo-600">PO-SD App</strong>
                            </div>
                            <div className="text-right">
                                Hvala na povjerenju!
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default InvoiceGenerator;
