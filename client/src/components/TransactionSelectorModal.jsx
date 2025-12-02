import React, { useState, useEffect } from 'react';
import { X, Search, Check, DollarSign, Calendar, ArrowRight } from 'lucide-react';
import { getSettlements } from '../api';

const TransactionSelectorModal = ({ isOpen, onClose, onSelect, entity }) => {
    const [settlements, setSettlements] = useState([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [expandedSettlement, setExpandedSettlement] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchSettlements();
        }
    }, [isOpen, entity]);

    const fetchSettlements = async () => {
        setLoading(true);
        try {
            const data = await getSettlements(entity);
            // Filter only processed settlements with payments
            const validSettlements = data.filter(s => s.status === 'processed' && s.paymentsData && s.paymentsData.length > 0);
            setSettlements(validSettlements);
        } catch (error) {
            console.error("Failed to fetch settlements:", error);
        } finally {
            setLoading(false);
        }
    };

    const filteredSettlements = settlements.map(settlement => {
        const payments = settlement.paymentsData || [];
        const filteredPayments = payments.filter(p => {
            // Show only unmatched payments or all? User might want to correct a match.
            // Let's show all, but visually distinguish matched ones.
            const searchLower = searchTerm.toLowerCase();
            return (
                (p.contractor && p.contractor.toLowerCase().includes(searchLower)) ||
                (p.description && p.description.toLowerCase().includes(searchLower)) ||
                (p.amount && p.amount.toString().includes(searchLower))
            );
        });
        return { ...settlement, filteredPayments };
    }).filter(s => s.filteredPayments.length > 0);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden border border-gold-100">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gold-50/30">
                    <div>
                        <h2 className="text-2xl font-serif font-bold text-gray-800">Połącz z płatnością</h2>
                        <p className="text-sm text-gray-500 mt-1">Wybierz transakcję z rozliczeń, aby opłacić fakturę</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white rounded-full transition-colors text-gray-400 hover:text-gray-600">
                        <X size={24} />
                    </button>
                </div>

                {/* Search */}
                <div className="p-4 border-b border-gray-100 bg-white">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                        <input
                            type="text"
                            placeholder="Szukaj po kontrahencie, opisie lub kwocie..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:border-gold-400 focus:ring-2 focus:ring-gold-100 outline-none transition-all"
                        />
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold-500"></div>
                        </div>
                    ) : filteredSettlements.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <p>Brak pasujących transakcji.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {filteredSettlements.map((settlement) => (
                                <div key={settlement.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                                    {/* Settlement Header */}
                                    <div
                                        onClick={() => setExpandedSettlement(expandedSettlement === settlement.id ? null : settlement.id)}
                                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                                                <DollarSign size={20} />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-gray-900">{settlement.fileName}</h3>
                                                <p className="text-xs text-gray-500 flex items-center gap-2">
                                                    <Calendar size={12} />
                                                    {new Date(settlement.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <span className="text-sm text-gray-500">
                                                {settlement.filteredPayments.length} transakcji
                                            </span>
                                            <div className={`transition-transform duration-200 ${expandedSettlement === settlement.id ? 'rotate-90' : ''}`}>
                                                <ArrowRight size={16} className="text-gray-400" />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Transactions List */}
                                    {expandedSettlement === settlement.id && (
                                        <div className="border-t border-gray-100 bg-gray-50/50">
                                            {settlement.filteredPayments.map((payment, idx) => (
                                                <div key={payment.id || idx} className="p-4 border-b border-gray-100 last:border-0 flex items-center justify-between hover:bg-white transition-colors group">
                                                    <div className="flex-1 min-w-0 pr-4">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className={`text-sm font-bold ${payment.type === 'outgoing' ? 'text-red-600' : 'text-green-600'}`}>
                                                                {payment.type === 'outgoing' ? '-' : '+'}{payment.amount} PLN
                                                            </span>
                                                            <span className="text-xs text-gray-400">| {payment.date}</span>
                                                            {payment.matchStatus === 'matched' && (
                                                                <span className="text-[10px] bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                                                                    Już połączona
                                                                </span>
                                                            )}
                                                        </div>
                                                        <p className="text-sm font-medium text-gray-900 truncate">{payment.contractor}</p>
                                                        <p className="text-xs text-gray-500 truncate">{payment.description}</p>
                                                    </div>

                                                    <button
                                                        onClick={() => onSelect(settlement.id, payment.id)}
                                                        // disabled={payment.matchStatus === 'matched'} // Allow selection even if matched (to correct errors)
                                                        // Let's allow it but warn visually? For now, just standard button.
                                                        className="px-4 py-2 bg-white border border-gold-200 text-gold-700 rounded-lg text-sm font-medium hover:bg-gold-50 hover:border-gold-300 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                                    >
                                                        Wybierz
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default TransactionSelectorModal;
