import { useState, useEffect } from 'react';
import api from '../api';
import { Activity, Trash2 } from 'lucide-react';

function HistoryList({ entity }) {
    const [history, setHistory] = useState([]);

    useEffect(() => {
        fetchHistory();
    }, [entity]);

    const fetchHistory = async () => {
        try {
            const response = await api.get(`/history?entity=${entity}`);
            setHistory(response.data);
        } catch (error) {
            console.error('Error fetching history:', error);
        }
    };

    const handleClearHistory = async () => {
        if (!window.confirm('Czy na pewno chcesz wyczyścić całą historię zdarzeń?')) return;
        try {
            await api.delete(`/history?entity=${entity}`);
            fetchHistory();
        } catch (error) {
            console.error('Error clearing history:', error);
            alert('Błąd podczas czyszczenia historii.');
        }
    };

    return (
        <div className="glass-card rounded-2xl overflow-hidden border border-amber-200/50 shadow-lg bg-gradient-to-b from-white to-amber-50/30">
            <div className="p-6 border-b border-amber-100 bg-amber-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 rounded-lg">
                        <Activity className="text-amber-600" size={24} />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 font-serif">Dziennik Zdarzeń</h2>
                </div>
                {history.length > 0 && (
                    <button
                        onClick={handleClearHistory}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                    >
                        <Trash2 size={16} />
                        Wyczyść Historię
                    </button>
                )}
            </div>
            <ul className="divide-y divide-amber-100/50">
                {history.map((item) => (
                    <li key={item.id} className="p-6 hover:bg-amber-50/50 transition-colors group">
                        <div className="flex justify-between items-start">
                            <div>
                                <span className="inline-block px-2 py-1 bg-white border border-amber-100 rounded text-xs font-bold text-amber-600 mb-2 shadow-sm">
                                    {item.action}
                                </span>
                                <p className="text-gray-700 font-medium group-hover:text-gray-900 transition-colors">{item.description}</p>
                            </div>
                            <span className="text-xs text-gray-400 font-mono bg-white/50 px-2 py-1 rounded">
                                {new Date(item.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </li>
                ))}
                {history.length === 0 && (
                    <li className="p-12 text-center text-gray-400 flex flex-col items-center gap-3">
                        <Activity size={48} className="text-amber-100" />
                        <p>Brak historii operacji</p>
                    </li>
                )}
            </ul>
        </div>
    );
}

export default HistoryList;
