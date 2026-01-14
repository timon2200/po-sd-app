import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Download, RefreshCw, Eye, Save } from 'lucide-react';
import { generatePaymentCode, generateInvoicePdf, saveClient } from '../api';
import ClientSelector from './ClientSelector';
import { format } from 'date-fns';

const InvoiceGenerator = () => {
    // Default State
    const [invoice, setInvoice] = useState({
        number: `RAČUN-${new Date().getFullYear()}-001`,
        date: format(new Date(), 'yyyy-MM-dd'),
        dueDate: format(new Date(new Date().setDate(new Date().getDate() + 15)), 'yyyy-MM-dd'),
        place: 'Varaždin',
        operator: 'Timon Terzić',
        paymentMethod: 'Transakcijski račun',

        // Issuer Details (You)
        issuerName: 'MOJ OBRT',
        issuerAddress: 'Stanka Vraza 10',
        issuerCity: '42000 Varaždin',
        issuerOib: '12345678901',
        issuerIban: 'HR1234567890123456789',

        // Client Details
        clientName: '',
        clientAddress: '',
        clientCity: '',
        clientOib: '',

        // Items
        items: [
            { description: 'Usluga programiranja', quantity: 1, unit: 'h', price: 50.00 }
        ],

        // Payment Details for Barcode
        paymentModel: 'HR00',
        paymentReference: '',
        paymentDescription: 'Plaćanje po računu',
    });

    const [qrCode, setQrCode] = useState(null);
    const [loadingQr, setLoadingQr] = useState(false);
    const [total, setTotal] = useState(0);

    // Calculate total whenever items change
    useEffect(() => {
        const newTotal = invoice.items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
        setTotal(newTotal);
    }, [invoice.items]);

    // Generate QR Code when relevant fields change (debounced)
    useEffect(() => {
        const timer = setTimeout(async () => {
            if (invoice.issuerIban && total > 0) {
                setLoadingQr(true);
                try {
                    // Ref default if empty
                    const ref = invoice.paymentReference || invoice.number.replace(/[^0-9]/g, '');

                    const data = {
                        iban: invoice.issuerIban,
                        amount: total,
                        payee_name: invoice.issuerName,
                        payment_reference: `${invoice.paymentModel} ${ref}`,
                        description: invoice.paymentDescription,
                        purpose_code: "COST"
                    };
                    const res = await generatePaymentCode(data);
                    setQrCode(res.qr_code);
                } catch (error) {
                    console.error("Failed to generate QR", error);
                } finally {
                    setLoadingQr(false);
                }
            }
        }, 800);

        return () => clearTimeout(timer);
    }, [invoice.issuerIban, total, invoice.issuerName, invoice.paymentReference, invoice.paymentModel, invoice.paymentDescription, invoice.number]);


    const handleInputChange = (section, field, value) => {
        setInvoice(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...invoice.items];
        newItems[index][field] = value;
        setInvoice(prev => ({ ...prev, items: newItems }));
    };

    const addItem = () => {
        setInvoice(prev => ({
            ...prev,
            items: [...prev.items, { description: '', quantity: 1, unit: 'kom', price: 0 }]
        }));
    };

    const removeItem = (index) => {
        setInvoice(prev => ({
            ...prev,
            items: prev.items.filter((_, i) => i !== index)
        }));
    };

    const getInvoiceHtml = () => {
        // Simple HTML template for PDF generation
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                @page { size: A4; margin: 2cm; }
                body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10pt; color: #333; line-height: 1.5; }
                .header { width: 100%; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                .company-name { font-size: 18pt; font-weight: bold; color: #2563eb; }
                .invoice-title { font-size: 24pt; font-weight: bold; text-align: right; color: #1e293b; margin-top: -30px; }
                .meta-table { width: 100%; margin-top: 30px; }
                .meta-table td { vertical-align: top; }
                .client-box { background: #f8fafc; padding: 15px; border-radius: 5px; width: 45%; }
                .info-box { width: 45%; text-align: right; }
                
                .items-table { width: 100%; border-collapse: collapse; margin-top: 40px; }
                .items-table th { background: #1e293b; color: #fff; padding: 10px; text-align: left; }
                .items-table td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
                .total-row td { font-weight: bold; font-size: 12pt; border-top: 2px solid #1e293b; color: #1e293b; }
                
                .footer { margin-top: 50px; border-top: 1px solid #eee; padding-top: 20px; font-size: 8pt; color: #64748b; }
                .qr-section { margin-top: 30px; text-align: right; }
                .qr-img { width: 120px; height: 120px; }
                .payment-info { margin-top: 10px; font-size: 9pt; }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="company-name">${invoice.issuerName}</div>
                <div>${invoice.issuerAddress}, ${invoice.issuerCity}</div>
                <div>OIB: ${invoice.issuerOib}</div>
                <div class="invoice-title">RAČUN BR. ${invoice.number}</div>
            </div>
            
            <table class="meta-table">
                <tr>
                    <td width="50%">
                        <strong>ZA:</strong><br>
                        <div class="client-box">
                            <strong>${invoice.clientName}</strong><br>
                            ${invoice.clientAddress}<br>
                            ${invoice.clientCity}<br>
                            OIB: ${invoice.clientOib}
                        </div>
                    </td>
                    <td width="50%" align="right">
                        <strong>Detalji računa:</strong><br>
                        Datum računa: ${invoice.date}<br>
                        Datum dospijeća: ${invoice.dueDate}<br>
                        Mjesto izdavanja: ${invoice.place}<br>
                        Operater: ${invoice.operator}
                    </td>
                </tr>
            </table>
            
            <table class="items-table">
                <thead>
                    <tr>
                        <th width="5%">#</th>
                        <th width="45%">Opis</th>
                        <th width="10%">Kol.</th>
                        <th width="10%">J.mj.</th>
                        <th width="15%" align="right">Cijena</th>
                        <th width="15%" align="right">Ukupno</th>
                    </tr>
                </thead>
                <tbody>
                    ${invoice.items.map((item, i) => `
                    <tr>
                        <td>${i + 1}</td>
                        <td>${item.description}</td>
                        <td>${item.quantity}</td>
                        <td>${item.unit}</td>
                        <td align="right">${Number(item.price).toFixed(2)} €</td>
                        <td align="right">${(item.quantity * item.price).toFixed(2)} €</td>
                    </tr>
                    `).join('')}
                    <tr class="total-row">
                        <td colspan="4"></td>
                        <td align="right">UKUPNO:</td>
                        <td align="right">${total.toFixed(2)} €</td>
                    </tr>
                    <tr>
                        <td colspan="4"></td>
                        <td align="right" style="font-size: 9pt; font-weight: normal;">Oslobođeno PDV-a (čl. 90 st. 2)</td>
                        <td></td>
                    </tr>
                </tbody>
            </table>
            
            <div class="footer">
                <table width="100%">
                    <tr>
                        <td width="60%" valign="top">
                            <strong>Napomena:</strong><br>
                            ${invoice.paymentDescription}<br><br>
                            <strong>Podaci za plaćanje:</strong><br>
                            IBAN: ${invoice.issuerIban}<br>
                            Model: ${invoice.paymentModel} Poziv na broj: ${invoice.paymentReference || invoice.number}<br>
                            Usluga: ${invoice.paymentDescription}
                        </td>
                        <td width="40%" align="right" valign="top">
                            ${qrCode ? `<div class="qr-section"><img src="${qrCode}" class="qr-img" /></div>` : ''}
                            <div style="font-size: 8pt; margin-top: 5px;">Skeniraj i plati</div>
                        </td>
                    </tr>
                </table>
                <br><br>
                <div style="text-align: center; margin-top: 20px;">
                    Hvala na povjerenju!
                </div>
            </div>
        </body>
        </html>
        `;
    };

    const downloadPdf = async () => {
        try {
            const html = getInvoiceHtml();
            const blob = await generateInvoicePdf(html, `Racun-${invoice.number}`);

            // Create download link
            const url = window.URL.createObjectURL(new Blob([blob]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `Racun_${invoice.number}.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (e) {
            console.error(e);
            alert("Greška kod generiranja PDF-a");
        }
    };

    return (
        <div className="p-8 max-w-[1600px] mx-auto h-screen flex flex-col">
            <header className="mb-8 flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Izdavanje Računa</h1>
                    <p className="text-slate-500 dark:text-slate-400">Kreiraj i izdaj račun (Fiskalizacija 2.0 ready)</p>
                </div>
                <button
                    onClick={downloadPdf}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg transition-transform active:scale-95"
                >
                    <Download size={20} />
                    Preuzmi PDF
                </button>
            </header>

            <div className="flex gap-8 flex-1 overflow-hidden">
                {/* Editor Column */}
                <div className="w-1/2 overflow-y-auto pr-4 space-y-6 pb-20">

                    {/* Header Info */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-700">
                            Osnovni Podaci
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="Broj Računa" value={invoice.number} onChange={e => handleInputChange('header', 'number', e.target.value)} />
                            <Input label="Datum" type="date" value={invoice.date} onChange={e => handleInputChange('header', 'date', e.target.value)} />
                            <Input label="Datum Dospijeća" type="date" value={invoice.dueDate} onChange={e => handleInputChange('header', 'dueDate', e.target.value)} />
                            <Input label="Mjesto" value={invoice.place} onChange={e => handleInputChange('header', 'place', e.target.value)} />
                        </div>
                    </div>

                    {/* Client Info */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-700">
                            Podaci o Klijentu
                        </h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
                                    Pretraži ili Unesi Klijenta
                                </label>
                                <ClientSelector
                                    currentName={invoice.clientName}
                                    onSelect={async (client) => {
                                        setInvoice(prev => ({
                                            ...prev,
                                            clientName: client.name,
                                            clientAddress: client.address,
                                            clientCity: client.city + (client.postal_code ? ` ${client.postal_code}` : ''),
                                            clientOib: client.oib
                                        }));
                                        // Auto-save to local DB if valid OIB
                                        if (client.oib) {
                                            try {
                                                await saveClient(client);
                                            } catch (e) {
                                                console.error("Auto-save client failed", e);
                                            }
                                        }
                                    }}
                                />
                            </div>
                            {/* Hidden or read-only input for the name if desired, or let the inputs below handle manual edits */}

                            <Input label="Naziv / Ime" value={invoice.clientName} onChange={e => handleInputChange('client', 'clientName', e.target.value)} fullWidth />
                            <Input label="Adresa" value={invoice.clientAddress} onChange={e => handleInputChange('client', 'clientAddress', e.target.value)} />
                            <Input label="Grad/Mjesto" value={invoice.clientCity} onChange={e => handleInputChange('client', 'clientCity', e.target.value)} />
                            <Input label="OIB" value={invoice.clientOib} onChange={e => handleInputChange('client', 'clientOib', e.target.value)} />
                        </div>
                    </div>

                    {/* Items */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-4 border-b pb-2 border-slate-100 dark:border-slate-700">
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Stavke</h3>
                            <button onClick={addItem} className="text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-slate-700 p-1 rounded transition">
                                <Plus size={20} />
                            </button>
                        </div>
                        <div className="space-y-4">
                            {invoice.items.map((item, idx) => (
                                <div key={idx} className="flex gap-2 items-end bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg">
                                    <div className="flex-1">
                                        <label className="text-xs text-slate-500 mb-1 block">Opis</label>
                                        <input
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                            value={item.description}
                                            onChange={e => handleItemChange(idx, 'description', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <label className="text-xs text-slate-500 mb-1 block">Kol.</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none text-right"
                                            value={item.quantity}
                                            onChange={e => handleItemChange(idx, 'quantity', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <div className="w-20">
                                        <label className="text-xs text-slate-500 mb-1 block">Jed.</label>
                                        <input
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none text-center"
                                            value={item.unit}
                                            onChange={e => handleItemChange(idx, 'unit', e.target.value)}
                                        />
                                    </div>
                                    <div className="w-24">
                                        <label className="text-xs text-slate-500 mb-1 block">Cijena (€)</label>
                                        <input
                                            type="number"
                                            className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-3 py-2 text-sm outline-none text-right"
                                            value={item.price}
                                            onChange={e => handleItemChange(idx, 'price', parseFloat(e.target.value))}
                                        />
                                    </div>
                                    <button onClick={() => removeItem(idx)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded">
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex justify-end text-xl font-bold text-slate-800 dark:text-slate-100">
                            Ukupno: {total.toFixed(2)} €
                        </div>
                    </div>

                    {/* Payment Info */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
                        <h3 className="text-lg font-semibold mb-4 text-slate-800 dark:text-slate-200 border-b pb-2 border-slate-100 dark:border-slate-700">
                            Podaci za Plaćanje (Barkod)
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <Input label="IBAN Primatelja" value={invoice.issuerIban} onChange={e => handleInputChange('payment', 'issuerIban', e.target.value)} fullWidth />
                            <Input label="Model" value={invoice.paymentModel} onChange={e => handleInputChange('payment', 'paymentModel', e.target.value)} />
                            <Input label="Poziv na broj" value={invoice.paymentReference} placeholder="Ostaviti prazno za auto-gen" onChange={e => handleInputChange('payment', 'paymentReference', e.target.value)} />
                            <Input label="Opis plaćanja" value={invoice.paymentDescription} onChange={e => handleInputChange('payment', 'paymentDescription', e.target.value)} fullWidth />
                        </div>
                    </div>
                </div>

                {/* Preview Column */}
                <div className="w-1/2 bg-slate-200 dark:bg-slate-950 rounded-2xl p-8 overflow-hidden flex flex-col items-center">
                    <div className="bg-white shadow-2xl w-[210mm] h-[297mm] transform scale-[0.6] origin-top p-0 overflow-hidden relative text-black">
                        {/* We render interactive HTML inside the iframe or div? 
                           Using specific styles in a div might be easier but iframe guarantees isolation. 
                           Since we want to match PDF, let's use dangerouslySetInnerHTML with the same content as PDF 
                       */}
                        <div className="w-full h-full p-[2cm]" dangerouslySetInnerHTML={{ __html: getInvoiceHtml() }} />
                    </div>
                </div>
            </div>
        </div>
    );
};

const Input = ({ label, value, onChange, type = "text", placeholder, fullWidth }) => (
    <div className={fullWidth ? "col-span-2" : ""}>
        <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wide">
            {label}
        </label>
        <input
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
        />
    </div>
);

export default InvoiceGenerator;
