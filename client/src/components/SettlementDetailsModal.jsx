import { X, FileSpreadsheet } from 'lucide-react';

function SettlementDetailsModal({ isOpen, onClose, settlement }) {
    if (!isOpen || !settlement) return null;

    const payments = settlement.paymentsData || [];
    const totalAmount = payments.reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300">

                {/* Header */}
                <div className="p-8 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                            <FileSpreadsheet size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-800 font-serif">Szczegóły Rozliczenia</h2>
                            <p className="text-gray-500">Plik: {settlement.fileName}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-8">
                    <div className="space-y-6">
                        <div className="overflow-x-auto rounded-xl border border-gray-200 shadow-sm">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider">
                                        <th className="p-4 font-semibold border-b">Data</th>
                                        <th className="p-4 font-semibold border-b">Kontrahent</th>
                                        <th className="p-4 font-semibold border-b">Opis</th>
                                        <th className="p-4 font-semibold border-b text-right">Kwota</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {payments.map((payment, index) => (
                                        <tr key={index} className="hover:bg-gray-50 transition-colors">
                                            <td className="p-4 text-gray-600">{payment.date}</td>
                                            <td className="p-4 font-medium text-gray-800">{payment.contractor}</td>
                                            <td className="p-4 text-sm text-gray-500">
                                                <div className="group relative">
                                                    <div className="line-clamp-2 group-hover:line-clamp-none transition-all duration-300 cursor-help" title="Najedź by rozwinąć">
                                                        {payment.description}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4 text-right font-mono font-medium">
                                                {parseFloat(payment.amount).toFixed(2)} PLN
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex justify-end items-center gap-4 text-xl font-bold text-gray-800">
                            <span>Suma całkowita:</span>
                            <span className="text-blue-600">{totalAmount.toFixed(2)} PLN</span>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-8 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        </div>
    );
}

export default SettlementDetailsModal;
