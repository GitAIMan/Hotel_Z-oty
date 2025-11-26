import { useState, useEffect } from 'react';
import { X, Check, AlertTriangle, FileText, Calendar, DollarSign, Tag } from 'lucide-react';
import CategorySelector from './CategorySelector';

function InvoiceVerificationModal({ isOpen, onClose, onConfirm, initialData, isSubmitting }) {
    const [formData, setFormData] = useState(initialData || {});

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    if (!isOpen) return null;

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onConfirm(formData);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in duration-300">
                <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gold-50/30">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gold-100 text-gold-600 rounded-xl">
                            <FileText size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-serif font-bold text-gray-800">Weryfikacja Faktury</h2>
                            <p className="text-gray-500">Sprawdź dane odczytane przez AI</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={24} className="text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {/* Sekcja 1: Dane Podstawowe */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Numer Faktury</label>
                            <input
                                type="text"
                                name="invoiceNumber"
                                value={formData.invoiceNumber || ''}
                                onChange={handleChange}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none transition-all font-medium text-lg"
                            />
                        </div>
                        <div className="space-y-4">
                            <label className="block text-sm font-bold text-gray-700 uppercase tracking-wide">Kontrahent</label>
                            <input
                                type="text"
                                name="contractorName"
                                value={formData.contractorName || ''}
                                onChange={handleChange}
                                className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none transition-all font-medium text-lg"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">NIP</label>
                            <input
                                type="text"
                                name="contractorNIP"
                                value={formData.contractorNIP || ''}
                                onChange={handleChange}
                                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-gold-400 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Kategoria</label>
                            <div className="relative">
                                <CategorySelector
                                    value={formData.category}
                                    onChange={(value) => handleChange({ target: { name: 'category', value } })}
                                    className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-gold-400 outline-none"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-xs font-bold text-gray-500 uppercase">Metoda Płatności</label>
                            <input
                                type="text"
                                name="paymentMethod"
                                value={formData.paymentMethod || ''}
                                onChange={handleChange}
                                className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-gold-400 outline-none"
                            />
                        </div>
                    </div>

                    {/* Sekcja 2: Daty */}
                    <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-blue-800">
                                <Calendar size={16} /> Data Wystawienia
                            </label>
                            <input
                                type="date"
                                name="issueDate"
                                value={formData.issueDate || ''}
                                onChange={handleChange}
                                className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:border-blue-400 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-blue-800">
                                <Calendar size={16} /> Data Sprzedaży
                            </label>
                            <input
                                type="date"
                                name="saleDate"
                                value={formData.saleDate || ''}
                                onChange={handleChange}
                                className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:border-blue-400 outline-none"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="flex items-center gap-2 text-sm font-bold text-blue-800">
                                <Calendar size={16} /> Termin Płatności
                            </label>
                            <input
                                type="date"
                                name="paymentDate"
                                value={formData.paymentDate || ''}
                                onChange={handleChange}
                                className="w-full p-3 bg-white border border-blue-200 rounded-lg focus:border-blue-400 outline-none"
                            />
                        </div>
                    </div>

                    {/* Sekcja 3: Kwoty */}
                    <div className="p-6 bg-gold-50/50 rounded-2xl border border-gold-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gold-800">Netto</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gold-400 font-bold">PLN</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="netAmount"
                                    value={formData.netAmount || ''}
                                    onChange={handleChange}
                                    className="w-full p-3 pl-12 bg-white border border-gold-200 rounded-lg focus:border-gold-400 outline-none font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gold-800">VAT</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gold-400 font-bold">PLN</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="vatAmount"
                                    value={formData.vatAmount || ''}
                                    onChange={handleChange}
                                    className="w-full p-3 pl-12 bg-white border border-gold-200 rounded-lg focus:border-gold-400 outline-none font-mono"
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-bold text-gold-800">Brutto (Do Zapłaty)</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gold-600 font-bold">PLN</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    name="grossAmount"
                                    value={formData.grossAmount || ''}
                                    onChange={handleChange}
                                    className="w-full p-3 pl-12 bg-white border-2 border-gold-300 rounded-lg focus:border-gold-500 outline-none font-mono font-bold text-lg text-gold-900"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-gray-500 uppercase">Numer Konta</label>
                        <input
                            type="text"
                            name="accountNumber"
                            value={formData.accountNumber || ''}
                            onChange={handleChange}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-lg focus:border-gold-400 outline-none font-mono text-sm tracking-wide"
                        />
                    </div>

                    <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                        >
                            Anuluj
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-8 py-3 rounded-xl font-bold text-white bg-gold-gradient shadow-lg shadow-gold-500/30 hover:shadow-gold-500/40 transform hover:-translate-y-1 transition-all flex items-center gap-2"
                        >
                            {isSubmitting ? 'Zapisywanie...' : (
                                <>
                                    <Check size={20} />
                                    Zatwierdź i Zapisz
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default InvoiceVerificationModal;
