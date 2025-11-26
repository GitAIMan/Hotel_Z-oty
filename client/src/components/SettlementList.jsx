import { useState, useEffect } from 'react';
import api from '../api';
import { Upload, FileSpreadsheet, Trash2, Loader2, Eye } from 'lucide-react';
import SettlementVerificationModal from './SettlementVerificationModal';
import SettlementDetailsModal from './SettlementDetailsModal';

function SettlementList({ entity }) {
    const [settlements, setSettlements] = useState([]);
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Verification State
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationData, setVerificationData] = useState(null);
    const [tempFilePath, setTempFilePath] = useState(null);
    const [originalName, setOriginalName] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Details State
    const [selectedSettlement, setSelectedSettlement] = useState(null);

    useEffect(() => {
        fetchSettlements();
    }, [entity]);

    const fetchSettlements = async () => {
        try {
            const response = await api.get(`/settlements?entity=${entity}`);
            setSettlements(response.data);
        } catch (error) {
            console.error('Error fetching settlements:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Czy na pewno chcesz usunąć to rozliczenie?')) return;
        try {
            await api.delete(`/settlements/${id}`);
            fetchSettlements();
        } catch (error) {
            console.error('Error deleting settlement:', error);
            alert('Błąd podczas usuwania rozliczenia.');
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) {
            console.log("No file selected");
            return;
        }

        console.log("Starting settlement upload...");
        setIsAnalyzing(true);
        const data = new FormData();
        data.append('file', file);
        data.append('entity', entity);

        try {
            console.log("Sending request to /api/settlements/analyze...");
            // Step 1: Analyze
            const response = await api.post('/settlements/analyze', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            console.log("Analysis response received:", response.data);

            if (!response.data || !response.data.analysis) {
                console.error("Invalid response structure:", response.data);
                alert("Błąd: Otrzymano nieprawidłową odpowiedź z serwera.");
                return;
            }

            // Step 2: Open Verification Modal
            console.log("Opening verification modal with data:", response.data.analysis);
            setVerificationData(response.data.analysis);
            setTempFilePath(response.data.tempFilePath);
            setOriginalName(response.data.originalName);
            setShowVerificationModal(true);

        } catch (error) {
            console.error('Error analyzing settlement:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Nieznany błąd';
            alert(`Błąd podczas analizy pliku: ${errorMessage}`);
        } finally {
            console.log("Analysis process finished (finally block).");
            setIsAnalyzing(false);
        }
    };

    const handleConfirm = async (confirmedPayments) => {
        setIsSaving(true);
        try {
            await api.post('/settlements/confirm', {
                entity,
                payments: confirmedPayments,
                tempFilePath,
                originalName
            });

            setShowVerificationModal(false);
            setVerificationData(null);
            setTempFilePath(null);
            setFile(null);
            document.getElementById('settlement-file').value = '';
            await fetchSettlements();

        } catch (error) {
            console.error('Error saving settlement:', error);
            alert('Błąd podczas zapisywania rozliczenia.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-10">
            {/* Verification Modal */}
            <SettlementVerificationModal
                isOpen={showVerificationModal}
                onClose={() => setShowVerificationModal(false)}
                onConfirm={handleConfirm}
                initialData={verificationData}
                isSubmitting={isSaving}
            />

            {/* Details Modal */}
            <SettlementDetailsModal
                isOpen={!!selectedSettlement}
                onClose={() => setSelectedSettlement(null)}
                settlement={selectedSettlement}
            />

            <div className="glass-card p-10 rounded-3xl shadow-xl border border-amber-200/50 bg-gradient-to-b from-white to-amber-50/30">
                <h3 className="text-2xl font-bold font-serif mb-6 text-gray-800">Wgraj Wyciąg Bankowy</h3>
                <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row gap-4 lg:gap-6 items-stretch lg:items-center">
                    <div className="flex-1 relative">
                        <input
                            id="settlement-file"
                            type="file"
                            onChange={handleFileChange}
                            className="w-full p-4 border border-amber-100 rounded-2xl bg-white focus:outline-none focus:border-amber-400 transition-colors file:mr-4 lg:file:mr-6 file:py-2 lg:file:py-3 file:px-4 lg:file:px-6 file:rounded-xl file:border-0 file:text-sm lg:file:text-base file:font-semibold file:bg-amber-50 file:text-amber-700 hover:file:bg-amber-100 text-sm lg:text-lg shadow-sm"
                            accept=".csv,.xls,.xlsx,.pdf,.jpg,.png"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={!file || isAnalyzing}
                        className={`w-full lg:w-auto px-8 py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-3 transition-all duration-300 ${!file || isAnalyzing
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gold-gradient text-white shadow-xl shadow-gold-500/30 hover:shadow-gold-500/40 transform hover:-translate-y-1'
                            }`}
                    >
                        {isAnalyzing ? <Loader2 size={24} className="animate-spin" /> : <Upload size={24} />}
                        {isAnalyzing ? 'Analiza...' : 'Wgraj Plik'}
                    </button>
                </form>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-amber-200/50">
                <div className="p-8 border-b border-amber-100 flex justify-between items-center bg-amber-50/50">
                    <h2 className="text-2xl font-bold text-gray-800 font-serif">Historia Rozliczeń</h2>
                    <span className="bg-amber-100 text-amber-800 px-6 py-2 rounded-full text-sm font-bold tracking-wide uppercase border border-amber-200">
                        {entity === 'zloty_gron' ? 'Złoty Groń' : 'Srebrny Bucznik'}
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-amber-100/50 text-left border-b border-amber-100">
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm border-r border-amber-100 last:border-r-0">Plik</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm border-r border-amber-100 last:border-r-0">Data Wgrania</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm border-r border-amber-100 last:border-r-0">Status</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50/50">
                            {settlements.map((s) => (
                                <tr key={s.id} className="hover:bg-amber-50/50 transition-colors group border-b border-amber-50/30">
                                    <td className="py-6 px-8 border-r border-amber-50/30 last:border-r-0">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white border border-amber-100 rounded-xl text-amber-600 shadow-sm group-hover:border-amber-300 transition-colors">
                                                <FileSpreadsheet size={24} />
                                            </div>
                                            <span className="font-bold text-gray-900 text-lg">{s.fileName}</span>
                                        </div>
                                    </td>
                                    <td className="py-6 px-8 text-gray-600 font-medium border-r border-amber-50/30 last:border-r-0">
                                        {new Date(s.createdAt).toLocaleDateString('pl-PL')}
                                    </td>
                                    <td className="py-6 px-8 border-r border-amber-50/30 last:border-r-0">
                                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide border ${s.status === 'processed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                            {s.status === 'processed' ? 'Przetworzono' : 'W trakcie'}
                                        </span>
                                        {s.totalProcessed > 0 && (
                                            <span className="ml-2 text-sm font-medium text-gray-500">
                                                ({s.totalProcessed} sparowanych)
                                            </span>
                                        )}
                                    </td>
                                    <td className="py-6 px-8">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => setSelectedSettlement(s)}
                                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-full transition-colors border border-transparent hover:border-blue-100"
                                                title="Pokaż szczegóły"
                                            >
                                                <Eye size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(s.id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors border border-transparent hover:border-red-100"
                                                title="Usuń rozliczenie"
                                            >
                                                <Trash2 size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {settlements.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="py-24 text-center text-gray-400 bg-amber-50/10">
                                        <p className="text-xl">Brak wgranych rozliczeń.</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default SettlementList;
