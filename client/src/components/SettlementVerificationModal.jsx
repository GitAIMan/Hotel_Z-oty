import { X, Check, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

function SettlementVerificationModal({ isOpen, onClose, onConfirm, initialData, isSubmitting }) {
    const [payments, setPayments] = useState([]);

    useEffect(() => {
        if (initialData) {
            // Handle both array and object with payments key
            if (Array.isArray(initialData)) {
                setPayments(initialData);
            } else if (initialData.payments && Array.isArray(initialData.payments)) {
                setPayments(initialData.payments);
            } else {
                console.error('Invalid initialData structure:', initialData);
                setPayments([]);
            }
        }
    }, [initialData]);

    const handlePaymentChange = (index, field, value) => {
        const updatedPayments = [...payments];
        updatedPayments[index] = { ...updatedPayments[index], [field]: value };
        setPayments(updatedPayments);
    };

    const handleRemovePayment = (index) => {
        const updatedPayments = payments.filter((_, i) => i !== index);
        setPayments(updatedPayments);
    };

    if (!isOpen) return null;

    const totalAmount = Array.isArray(payments)
        ? payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0)
        : 0;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-3xl font-serif font-bold text-gray-800">Weryfikacja Rozliczenia</h2>
                        <p className="text-gray-500 mt-2">Sprawdź i zatwierdź transakcje wykryte przez AI</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    {payments.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <AlertCircle size={48} className="mx-auto mb-4 opacity-50" />
                            <p>Nie wykryto żadnych transakcji.</p>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                                            <th className="p-4 font-semibold border-b">Data</th>
                                            <th className="p-4 font-semibold border-b">Kontrahent</th>
                                            <th className="p-4 font-semibold border-b">Opis</th>
                                            <th className="p-4 font-semibold border-b text-right">Kwota</th>
                                            <th className="p-4 font-semibold border-b text-center">Akcje</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {payments.map((payment, index) => (
                                            <tr key={index} className="hover:bg-blue-50/30 transition-colors group">
                                                <td className="p-4">
                                                    <input
                                                        type="date"
                                                        value={payment.date || ''}
                                                        onChange={(e) => handlePaymentChange(index, 'date', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent focus:border-gold-400 focus:outline-none transition-colors"
                                                    />
                                                </td>
                                                <td className="p-4">
                                                    <input
                                                        type="text"
                                                        value={payment.contractor || ''}
                                                        onChange={(e) => handlePaymentChange(index, 'contractor', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent focus:border-gold-400 focus:outline-none transition-colors font-medium text-gray-800"
                                                        placeholder="Nazwa kontrahenta"
                                                    />
                                                </td>
                                                <td className="p-4 max-w-xs">
                                                    <input
                                                        type="text"
                                                        value={payment.description || ''}
                                                        onChange={(e) => handlePaymentChange(index, 'description', e.target.value)}
                                                        className="w-full bg-transparent border-b border-transparent focus:border-gold-400 focus:outline-none transition-colors text-sm text-gray-500 truncate focus:text-clip"
                                                        placeholder="Opis transakcji"
                                                        title={payment.description}
                                                    />
                                                </td>
                                                <td className="p-4 text-right font-mono font-medium">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        value={payment.amount || ''}
                                                        onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                                                        className="w-32 text-right bg-transparent border-b border-transparent focus:border-gold-400 focus:outline-none transition-colors"
                                                    /> PLN
                                                </td>
                                                <td className="p-4 text-center">
                                                    <button
                                                        onClick={() => handleRemovePayment(index)}
                                                        className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                        title="Usuń pozycję"
                                                    >
                                                        <X size={18} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end items-center gap-4 text-xl font-bold text-gray-800">
                                <span>Suma:</span>
                                <span className="text-gold-600">{totalAmount.toFixed(2)} PLN</span>
                            </div>
                        </div>
                    )}
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
                        onClick={() => onConfirm(payments)}
                        disabled={isSubmitting || payments.length === 0}
                        className="px-8 py-3 rounded-xl font-bold text-white bg-gold-gradient shadow-lg shadow-gold-500/30 hover:shadow-gold-500/40 transform hover:-translate-y-0.5 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? 'Zapisywanie...' : 'Zatwierdź i Paruj'}
                        {!isSubmitting && <Check size={20} />}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettlementVerificationModal;
