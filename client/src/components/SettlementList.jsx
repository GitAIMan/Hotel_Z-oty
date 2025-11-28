import { useState, useEffect } from 'react';
import api from '../api';
import { Upload, FileSpreadsheet, Trash2, Loader2, Eye } from 'lucide-react';
import SettlementVerificationModal from './SettlementVerificationModal';
import SettlementDetailsModal from './SettlementDetailsModal';
import MobilePhotoUploader from './MobilePhotoUploader';

function SettlementList({ entity }) {
    const [settlements, setSettlements] = useState([]);
    const [file, setFile] = useState(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

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

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleDirectUpload(files[0]);
        }
    };

    const handleDirectUpload = async (uploadedFile) => {
        if (!uploadedFile) return;

        console.log("Starting settlement upload...", uploadedFile.name);
        setIsAnalyzing(true);
        const data = new FormData();
        data.append('files', uploadedFile);
        data.append('entity', entity);

        try {
            console.log("Sending request to /api/settlements/analyze...");
            const response = await api.post('/settlements/analyze', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (!response.data || !response.data.analysis) {
                alert("Błąd: Otrzymano nieprawidłową odpowiedź z serwera.");
                return;
            }

            setVerificationData(response.data.analysis);
            setTempFilePath(response.data.tempFilePath);
            setOriginalName(response.data.originalName);
            setShowVerificationModal(true);

        } catch (error) {
            console.error('Error analyzing settlement:', error);
            const errorMessage = error.response?.data?.error || error.message || 'Nieznany błąd';
            alert(`Błąd podczas analizy pliku: ${errorMessage}`);
        } finally {
            setIsAnalyzing(false);
        }
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
        data.append('files', file); // Backend now expects 'files' array, but single file works too if we handle it right? 
        // Wait, multer.array('files') expects 'files' field. 
        // If we send 'file' field, it might fail.
        // Let's change this to 'files'.
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

            {/* Mobile Photo Uploader */}
            <MobilePhotoUploader
                onUpload={(files) => {
                    if (files.length > 0) {
                        // Create a synthetic event or call a new handler
                        // Let's create a dedicated handler for array upload
                        const handleMobileUpload = async (files) => {
                            console.log("Starting mobile settlement upload...", files.length);
                            setIsAnalyzing(true);
                            const data = new FormData();
                            files.forEach(file => {
                                data.append('files', file);
                            });
                            data.append('entity', entity);

                            try {
                                const response = await api.post('/settlements/analyze', data, {
                                    headers: { 'Content-Type': 'multipart/form-data' }
                                });

                                if (!response.data || !response.data.analysis) {
                                    alert("Błąd: Otrzymano nieprawidłową odpowiedź z serwera.");
                                    return;
                                }

                                setVerificationData(response.data.analysis);
                                setTempFilePath(response.data.tempFilePath);
                                setOriginalName(response.data.originalName);
                                setShowVerificationModal(true);

                            } catch (error) {
                                console.error('Error analyzing settlement:', error);
                                const errorMessage = error.response?.data?.error || error.message || 'Nieznany błąd';
                                alert(`Błąd podczas analizy pliku: ${errorMessage}`);
                            } finally {
                                setIsAnalyzing(false);
                            }
                        };
                        handleMobileUpload(files);
                    }
                }}
                isAnalyzing={isAnalyzing}
            />

            {/* Drag & Drop Zone - Consistent with InvoiceList */}
            <div
                className={`hidden md:block relative group cursor-pointer rounded-[2rem] border-4 border-dashed transition-all duration-500 p-8 lg:p-12 text-center
          ${isDragging
                        ? 'border-gold-500 bg-gold-50/50 scale-[1.01] shadow-2xl shadow-gold-100'
                        : 'border-gray-200 hover:border-gold-400 hover:bg-white bg-white/60'
                    }
        `}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => document.getElementById('settlement-file').click()}
            >
                <input
                    id="settlement-file"
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                        handleFileChange(e);
                        // Auto submit on selection
                        if (e.target.files[0]) {
                            // We need to wrap this in a synthetic event or modify handleSubmit
                            // Let's just call the logic directly
                            const syntheticEvent = { preventDefault: () => { } };
                            // We need to set file state first, but state updates are async.
                            // Better to pass the file directly to a new submit handler or modify existing one.
                            // For now, let's just trigger the existing flow but we need to be careful about state.
                            // Actually, let's create a direct upload function to avoid state race conditions.
                            handleDirectUpload(e.target.files[0]);
                        }
                    }}
                    accept=".csv,.xls,.xlsx,.pdf,.jpg,.png"
                />

                <div className="flex flex-col items-center gap-4 lg:gap-6 pointer-events-none">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${isDragging ? 'bg-gold-500 text-white rotate-12' : 'bg-white shadow-xl text-gold-500 group-hover:scale-110'}`}>
                        {isAnalyzing ? (
                            <Loader2 size={32} className="animate-spin" />
                        ) : (
                            <Upload size={32} />
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl lg:text-2xl font-serif font-bold text-gray-800 group-hover:text-gold-700 transition-colors">
                            {isAnalyzing ? 'Analiza...' : 'Wgraj Wyciąg Bankowy'}
                        </h3>
                        <p className="text-gray-400 text-sm lg:text-base font-medium">
                            {isAnalyzing ? 'Przetwarzanie...' : 'Kliknij lub upuść plik tutaj (CSV, Excel, PDF)'}
                        </p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-3xl overflow-hidden shadow-xl border border-amber-200/50">
                <div className="p-8 border-b border-amber-100 flex justify-between items-center bg-amber-50/50">
                    <h2 className="text-2xl font-bold text-gray-800 font-serif">Historia Rozliczeń</h2>
                    <span className="bg-amber-100 text-amber-800 px-6 py-2 rounded-full text-sm font-bold tracking-wide uppercase border border-amber-200">
                        {entity === 'zloty_gron' ? 'Złoty Groń' : 'Srebrny Bucznik'}
                    </span>
                </div>

                <div className="overflow-x-auto hidden md:block">
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

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-amber-100">
                    {settlements.map((s) => (
                        <div key={s.id} className="p-4 flex flex-col gap-3">
                            <div className="flex justify-between items-start gap-3">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-white border border-amber-100 rounded-lg text-amber-600 shadow-sm shrink-0">
                                        <FileSpreadsheet size={18} />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-bold text-gray-900 text-sm truncate">{s.fileName}</p>
                                        <p className="text-xs text-gray-500">{new Date(s.createdAt).toLocaleDateString('pl-PL')}</p>
                                    </div>
                                </div>
                                <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${s.status === 'processed' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-yellow-50 text-yellow-700 border-yellow-200'}`}>
                                    {s.status === 'processed' ? 'OK' : '...'}
                                </span>
                            </div>

                            <div className="flex items-center justify-between pt-2">
                                <div className="text-xs text-gray-500">
                                    {s.totalProcessed > 0 ? `${s.totalProcessed} sparowanych` : 'Brak par'}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setSelectedSettlement(s)}
                                        className="p-2 text-gray-500 hover:text-blue-600 bg-gray-50 rounded-full border border-gray-100"
                                        title="Pokaż szczegóły"
                                    >
                                        <Eye size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(s.id)}
                                        className="p-2 text-gray-500 hover:text-red-600 bg-gray-50 rounded-full border border-gray-100"
                                        title="Usuń rozliczenie"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {settlements.length === 0 && (
                        <div className="p-8 text-center text-gray-400 bg-amber-50/10">
                            <p className="text-sm">Brak wgranych rozliczeń.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default SettlementList;
