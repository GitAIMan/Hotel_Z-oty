import { useState, useEffect } from 'react';
import api from '../api';
import { Search, Calendar, ArrowUpRight, ArrowDownLeft, Filter, Download } from 'lucide-react';

function TransactionHistory({ entity }) {
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('');
    const [dateRange, setDateRange] = useState({ start: '', end: '' });

    useEffect(() => {
        fetchHistory();
    }, [entity]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            // We need to fetch settlements and extract payments
            // Ideally backend should have a dedicated endpoint, but we can reuse settlements for now
            const response = await api.get(`/settlements?entity=${entity}`);
            const settlements = response.data;

            let allPayments = [];
            settlements.forEach(settlement => {
                if (settlement.paymentsData && Array.isArray(settlement.paymentsData)) {
                    const payments = settlement.paymentsData.map(p => ({
                        ...p,
                        sourceFile: settlement.fileName,
                        settlementId: settlement.id,
                        uploadDate: settlement.createdAt
                    }));
                    allPayments = [...allPayments, ...payments];
                }
            });

            // Sort by date desc
            allPayments.sort((a, b) => new Date(b.date) - new Date(a.date));
            setTransactions(allPayments);
        } catch (error) {
            console.error('Error fetching history:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredTransactions = transactions.filter(t => {
        const matchesText =
            (t.contractor && t.contractor.toLowerCase().includes(filter.toLowerCase())) ||
            (t.description && t.description.toLowerCase().includes(filter.toLowerCase())) ||
            (t.amount && t.amount.toString().includes(filter));

        const matchesDate =
            (!dateRange.start || new Date(t.date) >= new Date(dateRange.start)) &&
            (!dateRange.end || new Date(t.date) <= new Date(dateRange.end));

        return matchesText && matchesDate;
    });

    const totalIncoming = filteredTransactions
        .filter(t => t.type === 'incoming')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    const totalOutgoing = filteredTransactions
        .filter(t => t.type === 'outgoing')
        .reduce((sum, t) => sum + parseFloat(t.amount), 0);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            {/* Header Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-wide">Liczba Transakcji</p>
                    <p className="text-3xl font-serif font-bold text-gray-800 mt-2">{filteredTransactions.length}</p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-sm text-green-600 font-bold uppercase tracking-wide flex items-center gap-2">
                        <ArrowDownLeft size={16} /> Wpływy
                    </p>
                    <p className="text-3xl font-serif font-bold text-green-700 mt-2">
                        {totalIncoming.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                    </p>
                </div>
                <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
                    <p className="text-sm text-red-500 font-bold uppercase tracking-wide flex items-center gap-2">
                        <ArrowUpRight size={16} /> Wydatki
                    </p>
                    <p className="text-3xl font-serif font-bold text-red-700 mt-2">
                        {totalOutgoing.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} PLN
                    </p>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Szukaj kontrahenta, opisu, kwoty..."
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-400 outline-none transition-all"
                    />
                </div>
                <div className="flex gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:w-40">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="date"
                            value={dateRange.start}
                            onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                            className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-400 outline-none text-sm"
                        />
                    </div>
                    <span className="self-center text-gray-400">-</span>
                    <div className="relative flex-1 md:w-40">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="date"
                            value={dateRange.end}
                            onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                            className="w-full pl-10 pr-3 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:border-blue-400 outline-none text-sm"
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100">
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Kontrahent / Opis</th>
                                <th className="py-4 px-6 text-right text-xs font-bold text-gray-500 uppercase tracking-wider">Kwota</th>
                                <th className="py-4 px-6 text-center text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                                <th className="py-4 px-6 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Źródło</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-gray-400">Ładowanie historii...</td>
                                </tr>
                            ) : filteredTransactions.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="py-12 text-center text-gray-400">Brak transakcji spełniających kryteria.</td>
                                </tr>
                            ) : (
                                filteredTransactions.map((t, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                        <td className="py-4 px-6 text-sm font-medium text-gray-600 whitespace-nowrap">
                                            {t.date}
                                        </td>
                                        <td className="py-4 px-6">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-gray-800">{t.contractor || 'Nieznany'}</span>
                                                <span className="text-xs text-gray-500 truncate max-w-xs" title={t.description}>{t.description}</span>
                                            </div>
                                        </td>
                                        <td className={`py-4 px-6 text-right font-mono font-bold ${t.type === 'incoming' ? 'text-green-600' : 'text-red-600'}`}>
                                            {t.type === 'incoming' ? '+' : '-'}{parseFloat(t.amount).toFixed(2)}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${t.matchStatus === 'matched'
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}>
                                                {t.matchStatus === 'matched' ? 'Sparowano' : 'Nie sparowano'}
                                            </span>
                                            {t.matchedInvoiceNumber && (
                                                <div className="text-[10px] text-gray-400 mt-1">
                                                    FV: {t.matchedInvoiceNumber}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-4 px-6 text-xs text-gray-400">
                                            {t.sourceFile}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default TransactionHistory;
