import React, { useState, useEffect } from 'react';
import { createInvoice, downloadInvoicePdf } from '../api';
import ClientSelector from './ClientSelector';
import { Plus, Trash2, Download, Send, Save, Calendar, FileText, CreditCard, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';

const InvoiceGenerator = ({ onBack, onSuccess, initialData }) => {
    // State
    const [invoiceData, setInvoiceData] = useState({
        number: `R-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 100) + 1).padStart(2, '0')}`,
        issueDate: new Date().toISOString().split('T')[0],
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        client: null,
        items: [
            { id: 1, description: 'Consulting Services', quantity: 10, price: 70.00, discount: 0, tax: 25 },
        ],
        notes: 'Obveznik nije u sustavu PDV-a, PDV nije obračunat temeljem čl. 90. st. 1. Zakona o PDV-u. Hvala na poslovanju!',
        issuer: {
            name: '',
            address: '',
            oib: '',
            iban: '',
        }
    });

    const [qrCode, setQrCode] = useState(null);

    useEffect(() => {
        if (initialData) {
            // Populate form with existing data
            setInvoiceData({
                ...initialData,
                // Ensure dates are formatted for input (YYYY-MM-DD)
                issueDate: initialData.issue_date ? initialData.issue_date.split('T')[0] : new Date().toISOString().split('T')[0],
                dueDate: initialData.due_date ? initialData.due_date.split('T')[0] : new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                // Map fields
                client: initialData.client_name ? {
                    id: initialData.client_id,
                    name: initialData.client_name,
                    oib: initialData.client_oib,
                    address: initialData.client_address,
                    city: initialData.client_city,
                    zip: initialData.client_zip
                } : null,
                // Ensure items have necessary fields, especially tax which defaults to 25 if missing
                items: initialData.items.map(i => ({ ...i, tax: i.tax || 25 })),
                notes: initialData.notes || '',
                // Preserve issuer info if we already have it in state?
                // Actually initialData doesn't store issuer info in the Invoice model (it's global settings)
                // So we keep the fetched issuer info.
                issuer: invoiceData.issuer
            });
        } else {
            // Fetch issuer info from backend only if new
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
        }
    }, [initialData]);

    // Separate effect for fetching issuer if editing (since we skipped it above to avoid overwriting state too early, or maybe we just always fetch issuer?)
    // Actually, let's always fetch issuer for fresh global settings, but don't overwrite user changes if we were editing?
    // Simplified: Always fetch issuer on mount.
    useEffect(() => {
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
            .catch(() => { });
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

    // Generate Payment Reference
    const getPaymentReference = () => {
        // Simple model: HR01 Year-Month-Number or just Year-Number
        // Usually HR01 Year-InvoiceNumber
        // But InvoiceNumber includes "R-..." so let's strip it
        const cleanNumber = invoiceData.number.replace(/[^0-9]/g, '');
        return `HR01 ${cleanNumber}`;
    };

    // Auto-generate QR Code
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            if (totals.total > 0 && invoiceData.issuer.iban) {
                const ref = getPaymentReference();

                fetch('http://localhost:8000/api/utils/generate-payment-code', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        iban: invoiceData.issuer.iban,
                        amount: totals.total,
                        payee_name: invoiceData.issuer.name,
                        payment_reference: ref,
                        description: `Placanje racuna ${invoiceData.number}`,
                        purpose_code: "COST"
                    })
                })
                    .then(res => res.json())
                    .then(data => setQrCode(data.qr_code))
                    .catch(err => console.error(err));
            }
        }, 800); // Debounce 800ms

        return () => clearTimeout(timeoutId);
    }, [totals.total, invoiceData.issuer, invoiceData.number]);

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

    const getPayload = (status) => ({
        // Use existing ID if editing, otherwise let backend generate new
        id: (initialData && initialData.id && status !== 'open-from-template') ? initialData.id : null,
        number: invoiceData.number,
        issue_date: invoiceData.issueDate,
        due_date: invoiceData.dueDate,
        year: new Date(invoiceData.issueDate).getFullYear(),

        client_id: invoiceData.client.id || null,
        client_name: invoiceData.client.name,
        client_oib: invoiceData.client.oib,
        client_address: invoiceData.client.address || '',
        client_city: invoiceData.client.city || '',
        client_zip: invoiceData.client.zip || '',

        items: invoiceData.items.map(i => ({
            id: String(i.id),
            description: i.description,
            quantity: i.quantity,
            price: i.price,
            discount: i.discount || 0,
            tax: i.tax || 25
        })),
        notes: invoiceData.notes,

        subtotal: totals.subtotal,
        tax_total: totals.taxTotal,
        total_amount: totals.total,
        status: status === 'open-from-template' ? 'open' : status // 'open', 'draft', or 'template'
    });

    const handleSaveTemplate = async () => {
        // If editing a template, update it. If new, create new.
        // If editing an INVOICE but clicking Save Template, should we create a NEW template from it? Yes.
        // So always treat as new unless we are explicitly editing a template?
        // Let's simplify: "Save Template" updates the current record if it IS a template, otherwise creates a NEW template.
        let isUpdate = false;
        if (initialData && initialData.status === 'template') {
            isUpdate = true;
        }

        const payload = getPayload('template');

        // If we are NOT updating an existing template, remove ID to force creation
        if (!isUpdate) {
            payload.id = null;
        }

        try {
            await createInvoice(payload);
            alert("Predložak uspješno spremljen!");
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            alert("Greška: " + error.message);
        }
    };

    const handleIssueInvoice = async () => {
        if (!invoiceData.client) return alert("Molimo odaberite klijenta.");

        // If we are editing a Draft or Template, and now Issuing -> Update status to Open.
        // If Template -> We probably want to create a NEW invoice (copy) and leave template alone?
        // Decision: If sourced from Template -> Create New (ID=null).
        // If sourced from Draft/Open -> Update Existing (ID=id).

        let statusArg = 'open';
        if (initialData && initialData.status === 'template') {
            statusArg = 'open-from-template';
        }

        const invoicePayload = getPayload(statusArg);

        try {
            const savedInvoice = await createInvoice(invoicePayload);
            if (confirm("Račun uspješno izdan! Želite li preuzeti PDF?")) {
                try {
                    const blob = await downloadInvoicePdf(savedInvoice.id);
                    const url = window.URL.createObjectURL(blob);
                    const link = document.createElement('a');
                    link.href = url;

                    const safeClientName = (savedInvoice.client_name || 'Client').replace(/[^a-z0-9]/gi, '_');
                    const dateStr = savedInvoice.issue_date ? savedInvoice.issue_date.split('T')[0] : new Date().toISOString().split('T')[0];
                    const filename = `Racun_${savedInvoice.number}_${safeClientName}_${dateStr}.pdf`;

                    link.setAttribute('download', filename);
                    document.body.appendChild(link);
                    link.click();
                    link.remove();
                } catch (pdfErr) {
                    console.error("PDF download failed", pdfErr);
                    alert("Račun je izdan, ali preuzimanje PDF-a nije uspjelo.");
                }
            }
            if (onSuccess) onSuccess();
        } catch (error) {
            console.error(error);
            alert("Greška pri izdavanju računa: " + error.message);
        }
    };

    return (
        <div className="flex flex-col xl:flex-row gap-8 p-4 md:p-8 max-w-[1920px] mx-auto min-h-[calc(100vh-theme(spacing.20))] h-auto xl:h-[calc(100vh-theme(spacing.20))] overflow-y-auto xl:overflow-hidden">

            {/* LEFT COLUMN - EDITOR */}
            <div className="w-full xl:flex-1 flex flex-col gap-6 xl:overflow-y-auto pr-0 xl:pr-2 custom-scrollbar pb-20">

                {/* Header Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
                            {initialData ? (initialData.status === 'template' ? 'Uredi Predložak' : 'Uredi Račun') : 'Novi Račun'}
                        </h1>
                        <p className="text-slate-500 text-sm">Kreirajte i izdajte novi račun</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {onBack && (
                            <button onClick={onBack} className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                                <ArrowLeft size={20} />
                                <span className="hidden sm:inline">Natrag</span>
                            </button>
                        )}
                        <button
                            onClick={handleSaveTemplate}
                            className="flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition">
                            <Save size={18} />
                            <span className="hidden sm:inline">Spremi predložak</span>
                        </button>
                        <button
                            onClick={handleIssueInvoice}
                            disabled={!invoiceData.client}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg shadow-lg shadow-indigo-200 dark:shadow-none transition"
                        >
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
                    <div className="grid grid-cols-1 gap-6">
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

                        <div className="mt-4">
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Napomena</label>
                            <textarea
                                value={invoiceData.notes}
                                onChange={(e) => setInvoiceData({ ...invoiceData, notes: e.target.value })}
                                className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px] text-sm"
                                placeholder="Unesite napomenu..."
                            />
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
                            <div key={item.id} className="grid grid-cols-12 gap-3 items-end p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 group">
                                <div className="col-span-12">
                                    <label className="text-xs text-slate-500 mb-1 block">Opis usluge / proizvoda</label>
                                    <input
                                        type="text"
                                        value={item.description}
                                        onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                                        placeholder="npr. Konzultantske usluge"
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-xs text-slate-500 mb-1 block">Kol.</label>
                                    <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => handleItemChange(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                    />
                                </div>
                                <div className="col-span-3">
                                    <label className="text-xs text-slate-500 mb-1 block">Cijena (€)</label>
                                    <input
                                        type="number"
                                        value={item.price}
                                        onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value) || 0)}
                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none text-right"
                                    />
                                </div>
                                <div className="col-span-4">
                                    <label className="text-xs text-slate-500 mb-1 block">Ukupno</label>
                                    <div className="bg-slate-100 dark:bg-slate-700 rounded px-2 py-1.5 text-sm text-right font-mono text-slate-700 dark:text-slate-300 overflow-hidden text-ellipsis whitespace-nowrap">
                                        {formatCurrency(item.quantity * item.price)}
                                    </div>
                                </div>
                                <div className="col-span-2 flex justify-center pb-1">
                                    <button onClick={() => removeItem(item.id)} className="p-1 text-slate-400 hover:text-red-500 transition-colors" title="Obriši stavku">
                                        <Trash2 size={18} />
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
            <div className="w-full xl:w-[800px] bg-slate-100 dark:bg-slate-900/50 p-4 md:p-8 rounded-2xl xl:overflow-y-auto custom-scrollbar border border-slate-200 dark:border-slate-800 mt-8 xl:mt-0 pb-20">
                <div className="sticky top-0 mb-6 flex justify-between items-center bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-20 p-2">
                    <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300">Pregled Računa</h2>
                    <button className="text-xs font-medium text-indigo-600 bg-indigo-50 dark:bg-indigo-900/30 px-3 py-1.5 rounded-full hover:bg-indigo-100 transition">
                        Osvježi prikaz
                    </button>
                </div>

                {/* A4 Paper Simulation - Scaled for small screens */}
                <div className="bg-white text-slate-900 shadow-xl mx-auto min-h-[1050px] w-full max-w-[700px] p-8 md:p-12 relative flex flex-col font-sans transition-all duration-300 overflow-hidden">

                    {/* Paper Header */}
                    <div className="flex flex-col sm:flex-row justify-between items-start mb-12 sm:mb-16 gap-6 sm:gap-0">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                                P
                            </div>
                            <div className="text-xl font-bold tracking-tight text-slate-900">{invoiceData.issuer.name}</div>
                        </div>
                        <div className="text-left sm:text-right">
                            <h1 className="text-3xl sm:text-4xl font-light text-slate-300 tracking-widest uppercase mb-2">Račun</h1>
                            <div className="text-sm font-semibold text-slate-700">Broj: {invoiceData.number}</div>
                            <div className="text-xs text-slate-500 mt-1">Ref: {Math.random().toString(36).substring(7).toUpperCase()}</div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 mb-12 sm:mb-16">
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
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-12 border-t border-b border-slate-100 py-6">
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
                        <div className="hidden sm:block w-16 text-right">Kol.</div>
                        <div className="hidden sm:block w-20 text-right">Cijena</div>
                        <div className="hidden sm:block w-16 text-right">Popust</div>
                        <div className="w-24 text-right">Ukupno</div>
                    </div>

                    {/* Table Body */}
                    <div className="flex flex-col gap-2 mb-8 min-h-[200px]">
                        {invoiceData.items.map((item) => {
                            const total = item.quantity * item.price * (1 - (item.discount || 0) / 100);
                            return (
                                <div key={item.id} className="flex flex-col sm:flex-row sm:items-center items-start text-xs text-slate-600 py-3 border-b border-slate-50 px-2 last:border-0 hover:bg-slate-50 transition-colors gap-2 sm:gap-0">
                                    <div className="flex-1 font-medium text-slate-800 w-full sm:w-auto overflow-hidden text-ellipsis">{item.description || <span className="text-slate-300 italic">Nova stavka...</span>}</div>

                                    {/* Mobile detail view */}
                                    <div className="flex sm:hidden w-full justify-between text-[10px] text-slate-400 mb-1">
                                        <span>{item.quantity} x {formatCurrency(item.price)}</span>
                                        <span>{item.discount > 0 ? `-${item.discount}%` : ''}</span>
                                    </div>

                                    <div className="hidden sm:block w-16 text-right">{item.quantity}</div>
                                    <div className="hidden sm:block w-20 text-right">{formatCurrency(item.price)}</div>
                                    <div className="hidden sm:block w-16 text-right text-slate-400">{item.discount > 0 ? `${item.discount}%` : '-'}</div>
                                    <div className="w-full sm:w-24 text-right font-medium text-slate-800 self-end sm:self-auto">{formatCurrency(total)}</div>
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

                    {/* QR Code Section */}
                    {qrCode && (
                        <div className="absolute bottom-48 left-8 sm:left-12 p-2 border border-slate-200 rounded-lg bg-white hidden sm:block">
                            <div className="text-[10px] text-center text-slate-400 font-bold mb-1 uppercase tracking-wider">Slikaj i Plati</div>
                            <img src={qrCode} alt="Payment QR" className="w-32 h-32 object-contain mix-blend-multiply" />
                        </div>
                    )}

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
