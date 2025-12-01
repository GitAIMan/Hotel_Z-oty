import { X, Check } from 'lucide-react';
import { useState, useEffect } from 'react';
import CategorySelector from './CategorySelector';

function InvoiceEditModal({ isOpen, onClose, onConfirm, invoice, isSubmitting }) {
    const [formData, setFormData] = useState({});

    useEffect(() => {
        if (invoice) {
            setFormData(invoice);
        }
    }, [invoice]);

    const handleChange = (field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    if (!isOpen || !invoice) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-800">Edytuj Fakturę</h2>
                        <p className="text-gray-500 mt-1">ID: {invoice.id}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Numer Faktury</label>
                            <input
                                type="text"
                                value={formData.invoiceNumber || ''}
                                onChange={(e) => handleChange('invoiceNumber', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">NIP</label>
                            <input
                                type="text"
                                value={formData.contractorNIP || ''}
                                onChange={(e) => handleChange('contractorNIP', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Kontrahent</label>
                        <input
                            type="text"
                            value={formData.contractorName || ''}
                            onChange={(e) => handleChange('contractorName', e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Numer Konta</label>
                        <input
                            type="text"
                            value={formData.accountNumber || ''}
                            onChange={(e) => handleChange('accountNumber', e.target.value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium font-mono"
                            placeholder="XX XXXX XXXX XXXX XXXX XXXX XXXX"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Kwota Netto</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.netAmount || ''}
                                    onChange={(e) => handleChange('netAmount', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium pr-12"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">PLN</span>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Kwota Brutto</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.grossAmount || ''}
                                    onChange={(e) => handleChange('grossAmount', e.target.value)}
                                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium pr-12"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">PLN</span>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Data Wystawienia</label>
                            <input
                                type="date"
                                value={formData.issueDate || ''}
                                onChange={(e) => handleChange('issueDate', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Termin Płatności</label>
                            <input
                                type="date"
                                value={formData.paymentDate || ''}
                                onChange={(e) => handleChange('paymentDate', e.target.value)}
                                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-gray-500 uppercase tracking-wider">Kategoria</label>
                        <CategorySelector
                            value={formData.category}
                            onChange={(value) => handleChange('category', value)}
                            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-gold-400 focus:bg-white transition-all font-medium"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-200 transition-colors"
                        disabled={isSubmitting}
                    >
                        Anuluj
                    </button>
                    <button
                        onClick={() => onConfirm(formData)}
                        disabled={isSubmitting}
                        className="px-8 py-3 rounded-xl font-bold text-white bg-gold-gradient shadow-lg shadow-gold-500/30 hover:shadow-gold-500/40 transform hover:-translate-y-0.5 transition-all flex items-center gap-2"
                    >
                        {isSubmitting ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                        {!isSubmitting && <Check size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InvoiceEditModal;
