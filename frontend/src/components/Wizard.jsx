import React, { useEffect, useState } from 'react';
import { getStats, generateXml } from '../api';
import { Calculator, ArrowRight, CheckCircle, AlertCircle, User, FileText } from 'lucide-react';
import clsx from 'clsx';

const Wizard = () => {
    const [step, setStep] = useState(1);
    const [stats, setStats] = useState(null);
    const [year, setYear] = useState(new Date().getFullYear());

    // Form Inputs
    const [profile, setProfile] = useState({ oib: '', name: '', address: '' });
    const [taxes, setTaxes] = useState({ tax: 0, surtax: 0 });

    useEffect(() => {
        setStats(null);
        getStats(year).then(data => {
            setStats(data);
            setProfile({
                oib: data.oib || '',
                name: data.name || '',
                address: data.address || ''
            });
            setTaxes({
                tax: data.tax_paid || 0,
                surtax: data.surtax_paid || 0
            });
        });
    }, [year]);

    const handleGenerate = async () => {
        if (!stats) return;

        const posdData = {
            ...stats,
            oib: profile.oib,
            name: profile.name,
            address: profile.address,
            tax_paid: parseFloat(taxes.tax),
            surtax_paid: parseFloat(taxes.surtax)
        };

        try {
            await generateXml(posdData);
            alert("PO-SD obrazac je generiran!");
        } catch (e) {
            alert("Greška pri generiranju: " + e.message);
        }
    };

    if (!stats) return <div className="p-12 text-center text-slate-500">Učitavanje podataka...</div>;

    // Calculations
    const totalPaid = parseFloat(taxes.tax) + parseFloat(taxes.surtax);
    const taxObligation = stats.base_tax_liability || 0;
    const difference = taxObligation - totalPaid;

    const steps = [
        { id: 1, label: 'Osobni Podaci', icon: User },
        { id: 2, label: 'Poslovni Primici', icon: FileText },
        { id: 3, label: 'Uplaćeni Porezi', icon: Calculator },
        { id: 4, label: 'Završno Izvješće', icon: CheckCircle },
    ];

    return (
        <div className="max-w-5xl mx-auto p-4 md:p-8">
            <div className="bg-white dark:bg-slate-800 rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 flex flex-col md:flex-row min-h-[600px] overflow-hidden">

                {/* Sidebar */}
                <div className="w-full md:w-80 bg-slate-50 dark:bg-slate-900 p-6 md:p-8 border-r border-slate-100 dark:border-slate-700 flex flex-col">
                    <div className="mb-8">
                        <div className="flex items-center gap-3 mb-8">
                            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/40">
                                <Calculator size={20} />
                            </div>
                            <div>
                                <h2 className="font-bold text-slate-900 dark:text-white leading-tight">PO-SD<br />Čarobnjak</h2>
                            </div>
                        </div>

                        <div className="space-y-2">
                            {steps.map(s => (
                                <button
                                    key={s.id}
                                    onClick={() => setStep(s.id)}
                                    disabled={s.id > step}
                                    className={clsx(
                                        "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                                        step === s.id
                                            ? "bg-white dark:bg-slate-800 shadow-md text-blue-600 dark:text-blue-400 ring-1 ring-slate-100 dark:ring-slate-700"
                                            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                                    )}
                                >
                                    <div className={clsx(
                                        "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors",
                                        step === s.id ? "bg-blue-100 dark:bg-blue-900/30" : "bg-slate-200 dark:bg-slate-800"
                                    )}>
                                        {s.id}
                                    </div>
                                    <span className="font-medium text-sm">{s.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="mt-auto">
                        <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3 block">Porezna Godina</label>
                        <div className="flex gap-2 bg-slate-200 dark:bg-slate-800 p-1 rounded-xl w-fit">
                            {[2024, 2025, 2026].map(y => (
                                <button
                                    key={y}
                                    onClick={() => setYear(y)}
                                    className={clsx(
                                        "px-4 py-1.5 text-xs font-bold rounded-lg transition-all",
                                        year === y
                                            ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                            : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                                    )}
                                >
                                    {y}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 p-8 md:p-12 relative">

                    {/* Step 1: Profile */}
                    {step === 1 && (
                        <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Osobni Podaci</h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Provjerite podatke obveznika. Ovi podaci bit će upisani u XML obrazac.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Ime i Prezime</label>
                                    <input
                                        type="text"
                                        value={profile.name}
                                        onChange={e => setProfile({ ...profile, name: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">OIB</label>
                                    <input
                                        type="text"
                                        value={profile.oib}
                                        onChange={e => setProfile({ ...profile, oib: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition font-mono text-slate-900 dark:text-white"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Adresa Prebivališta</label>
                                    <input
                                        type="text"
                                        value={profile.address}
                                        onChange={e => setProfile({ ...profile, address: e.target.value })}
                                        className="w-full p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition text-slate-900 dark:text-white"
                                    />
                                </div>
                            </div>

                            <div className="pt-4">
                                <button onClick={() => setStep(2)} className="w-full md:w-auto flex items-center justify-center gap-2 bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-200 dark:shadow-blue-900/40">
                                    Spremi i Nastavi <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Receipts */}
                    {step === 2 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Poslovni Primici</h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Ukupni naplaćeni primici (uplate) po žiro računu.
                                </p>
                            </div>

                            <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800 p-8 rounded-3xl text-center">
                                <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-2">Ukupno Primitaka</div>
                                <div className="text-5xl font-mono font-bold text-emerald-700 dark:text-emerald-300 tracking-tight">
                                    {stats.total_receipts.toFixed(2)} €
                                </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-slate-900 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-start gap-4">
                                <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-slate-700 shadow-sm text-slate-400">
                                    <Calculator size={24} />
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white mb-1">Porezni Razred</div>
                                    <div className="text-slate-600 dark:text-slate-400 text-sm">
                                        Na temelju primitaka, spadate u: <br />
                                        <span className="font-bold text-blue-600 dark:text-blue-400 mt-1 block text-lg">{stats.tax_bracket}</span>
                                    </div>
                                    <div className="mt-2 text-xs text-slate-400">
                                        Godišnja obveza: {stats.base_tax_liability.toFixed(2)} €
                                    </div>
                                </div>
                            </div>

                            {/* visual Ladder of Tax Brackets */}
                            {stats.all_brackets && (
                                <div className="space-y-3 mt-8 animate-in fade-in slide-in-from-bottom-8 duration-500 delay-150">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <div className="w-1 h-6 bg-blue-500 rounded-full"></div>
                                        Ljestvica Poreznih Razreda
                                    </h4>

                                    <div className="space-y-2 relative">
                                        {/* Vertical connector line */}
                                        <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-slate-200 dark:bg-slate-700 z-0"></div>

                                        {stats.all_brackets.map((bracket, idx) => {
                                            const isCurrent = stats.tax_bracket === bracket.description;
                                            // Format max receipts nicely
                                            const maxAmount = bracket.max_receipts.toLocaleString('hr-HR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

                                            return (
                                                <div
                                                    key={idx}
                                                    className={clsx(
                                                        "relative z-10 flex items-center gap-4 p-4 rounded-xl border transition-all duration-300",
                                                        isCurrent
                                                            ? "bg-white dark:bg-slate-800 border-blue-500 dark:border-blue-400 shadow-md scale-105 opacity-100"
                                                            : "bg-slate-50 dark:bg-slate-900/50 border-transparent opacity-40 hover:opacity-80 scale-95 hover:scale-100 grayscale hover:grayscale-0"
                                                    )}
                                                >
                                                    {/* Indicator Dot */}
                                                    <div className={clsx(
                                                        "w-12 h-12 flex-shrink-0 rounded-full flex items-center justify-center font-bold text-sm border-4",
                                                        isCurrent
                                                            ? "bg-blue-600 border-blue-100 dark:border-blue-900 text-white"
                                                            : "bg-slate-200 dark:bg-slate-800 border-slate-100 dark:border-slate-700 text-slate-500"
                                                    )}>
                                                        {idx + 1}
                                                    </div>

                                                    <div className="flex-1">
                                                        <div className={clsx("font-bold", isCurrent ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                                                            {bracket.description}
                                                        </div>
                                                        <div className="text-xs text-slate-400">
                                                            Porez: <span className="font-mono">{bracket.base_tax_liability.toFixed(2)} €</span>
                                                            <span className="mx-2">•</span>
                                                            Limit: <span className="font-mono">{maxAmount} €</span>
                                                        </div>
                                                        {isCurrent && (
                                                            <div className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 py-1 px-3 rounded-lg inline-block">
                                                                Vaši primici vas svrstavaju u ovu razinu.
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}


                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setStep(1)} className="px-6 py-3 text-slate-400 hover:text-slate-600 font-medium">Natrag</button>
                                <button onClick={() => setStep(3)} className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-200 dark:shadow-blue-900/40 flex items-center gap-2">
                                    Potvrdi <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Taxes */}
                    {step === 3 && (
                        <div className="space-y-6 max-w-lg animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Uplaćeni Porezi</h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Unesite iznose poreza i prireza koje ste već uplatili tijekom godine.
                                    Sustav je automatski prepoznao neka plaćanja.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Uplaćeni Porez (€)</label>
                                    <input
                                        type="number"
                                        value={taxes.tax}
                                        onChange={e => setTaxes({ ...taxes, tax: e.target.value })}
                                        className="w-full text-lg p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    />
                                    <div className="text-xs text-slate-400 mt-1 text-right">Prepoznato iz transakcija</div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Uplaćeni Prirez (€)</label>
                                    <input
                                        type="number"
                                        value={taxes.surtax}
                                        onChange={e => setTaxes({ ...taxes, surtax: e.target.value })}
                                        className="w-full text-lg p-3 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-mono"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button onClick={() => setStep(2)} className="px-6 py-3 text-slate-400 hover:text-slate-600 font-medium">Natrag</button>
                                <button onClick={() => setStep(4)} className="bg-blue-600 text-white px-8 py-3 rounded-xl hover:bg-blue-700 transition font-medium shadow-lg shadow-blue-200 dark:shadow-blue-900/40 flex items-center gap-2">
                                    Dalje <ArrowRight size={18} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Summary */}
                    {step === 4 && (
                        <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div>
                                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Konačni Obračun</h3>
                                <p className="text-slate-500 dark:text-slate-400">
                                    Pregled obveza i uplata za {year}. godinu.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Obveza (Porez)</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{taxObligation.toFixed(2)} €</div>
                                    <div className="text-xs text-slate-400 mt-1">{stats.tax_bracket}</div>
                                </div>
                                <div className="p-5 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-700">
                                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Ukupno Uplaćeno</div>
                                    <div className="text-2xl font-bold text-slate-900 dark:text-white">{totalPaid.toFixed(2)} €</div>
                                    <div className="text-xs text-slate-400 mt-1">Porez + Prirez</div>
                                </div>
                            </div>

                            <div className={clsx(
                                "p-6 rounded-2xl border flex items-center gap-5",
                                difference > 0.01
                                    ? "bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 text-amber-900 dark:text-amber-400"
                                    : difference < -0.01
                                        ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800 text-emerald-900 dark:text-emerald-400"
                                        : "bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800 text-blue-900 dark:text-blue-400"
                            )}>
                                {difference > 0.01 ? <AlertCircle size={40} /> : <CheckCircle size={40} />}
                                <div>
                                    <div className="font-bold text-lg mb-1">
                                        {difference > 0.01 ? "Razlika za uplatu" : difference < -0.01 ? "Preplaćeni iznos" : "Sve je podmireno"}
                                    </div>
                                    <div className="text-3xl font-mono font-bold">
                                        {Math.abs(difference).toFixed(2)} €
                                    </div>
                                </div>
                            </div>

                            {/* Detailed Explanation / Breakdown */}
                            <div className="bg-slate-50 dark:bg-slate-900/50 p-6 rounded-2xl border border-slate-100 dark:border-slate-800">
                                <h4 className="font-bold text-slate-900 dark:text-white mb-4">Objašnjenje Izračuna</h4>
                                <ul className="space-y-3 text-sm text-slate-600 dark:text-slate-400">
                                    <li className="flex justify-between">
                                        <span>Ukupni primici (2025.):</span>
                                        <span className="font-mono font-medium text-slate-900 dark:text-white">{stats.total_receipts.toFixed(2)} €</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Vaš porezni razred:</span>
                                        <span className="font-medium text-blue-600 dark:text-blue-400">{stats.tax_bracket}</span>
                                    </li>
                                    <li className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                                        <span>Godišnja obveza (Fiksna):</span>
                                        <span className="font-mono font-bold text-slate-900 dark:text-white">{taxObligation.toFixed(2)} €</span>
                                    </li>
                                    <li className="flex justify-between">
                                        <span>Već uplaćeno (Porez + Prirez):</span>
                                        <span className="font-mono text-slate-500">- {totalPaid.toFixed(2)} €</span>
                                    </li>
                                    <li className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700 font-bold text-base">
                                        <span>{difference > 0 ? "Razlika za uplatu" : "Preplata"}:</span>
                                        <span className={clsx("font-mono", difference > 0 ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400")}>
                                            {Math.abs(difference).toFixed(2)} €
                                        </span>
                                    </li>
                                </ul>
                                <div className="mt-4 text-xs text-slate-500 dark:text-slate-500 italic bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                                    Budući da ste zaradili između 50.000 € i 60.000 €, spadate u najviši razred s fiksnom obvezom od 1080.00 €.
                                    Do sada ste uplatili {totalPaid.toFixed(2)} € (vjerojatno temeljem starih akontacija), stoga je potrebno uplatiti razliku.
                                </div>
                            </div>

                            {/* Payment Instructions - Only show if there is a difference to pay */}
                            {difference > 0.01 && (
                                <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-blue-200 dark:border-blue-800 shadow-lg shadow-blue-100 dark:shadow-blue-900/20">
                                    <h4 className="font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                                        <div className="p-1 bg-blue-100 dark:bg-blue-900 rounded text-blue-600 dark:text-blue-400">
                                            <FileText size={16} />
                                        </div>
                                        Podaci za uplatu
                                    </h4>

                                    <div className="grid md:grid-cols-2 gap-6">
                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Primatelj</div>
                                                <div className="font-medium text-slate-900 dark:text-white select-all">Porez na dohodak - Grad Varaždin</div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">IBAN</div>
                                                <div className="font-mono font-bold text-lg text-slate-900 dark:text-white select-all">
                                                    HR14 1001 0051 7472 1200 0
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3 text-sm">
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Model i Poziv na broj</div>
                                                <div className="font-mono font-bold text-slate-900 dark:text-white select-all">
                                                    HR68 1449-{profile.oib}
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-slate-500 text-xs uppercase font-bold tracking-wider mb-1">Iznos za uplatu</div>
                                                <div className="font-mono font-bold text-xl text-blue-600 dark:text-blue-400 select-all">
                                                    {Math.abs(difference).toFixed(2)} €
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="mt-4 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-800 pt-3">
                                        * Provjerite točnost IBAN-a za vašu općinu/grad ukoliko niste iz Varaždina. Ovo je IBAN za Grad Varaždin.
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handleGenerate}
                                className="w-full py-4 bg-slate-900 dark:bg-blue-600 text-white rounded-xl font-bold text-lg hover:bg-black dark:hover:bg-blue-700 transition shadow-xl hover:shadow-2xl flex items-center justify-center gap-2"
                            >
                                <FileText size={20} />
                                Generiraj PO-SD Obrazac (XML)
                            </button>

                            <button onClick={() => setStep(3)} className="w-full text-slate-400 hover:text-slate-600 text-sm font-medium">
                                Natrag na izmjene
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Wizard;
