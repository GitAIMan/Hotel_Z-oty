import { AlertTriangle, X, SkipForward, Check, XCircle } from 'lucide-react';

/**
 * Modal do obsługi duplikatów podczas importu z KSeF
 */
export default function KsefDuplicateModal({ isOpen, duplicates, newCount, onDecision }) {
    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]" onClick={() => onDecision('cancel')} />

            {/* Modal */}
            <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-lg bg-white rounded-2xl shadow-2xl z-[60] overflow-hidden">
                {/* Header */}
                <div className="p-6 bg-yellow-50 border-b border-yellow-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-yellow-500 flex items-center justify-center shadow-lg">
                        <AlertTriangle className="text-white" size={24} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Znaleziono duplikaty</h3>
                        <p className="text-sm text-gray-500">
                            {duplicates.length} faktur już istnieje w bazie
                        </p>
                    </div>
                    <button
                        onClick={() => onDecision('cancel')}
                        className="ml-auto p-2 hover:bg-yellow-100 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4 max-h-[400px] overflow-auto">
                    {duplicates.map((dup, idx) => (
                        <div key={idx} className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                            <div className="flex items-center justify-between mb-2">
                                <span className="font-bold text-gray-900">{dup.invoiceNumber}</span>
                                <span className="text-sm text-yellow-700 font-medium">Duplikat</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div>
                                    <span className="text-gray-400">Kontrahent:</span>
                                    <p className="text-gray-700">{dup.contractorName}</p>
                                </div>
                                <div>
                                    <span className="text-gray-400">Kwota:</span>
                                    <p className="text-gray-700 font-medium">{parseFloat(dup.grossAmount).toFixed(2)} PLN</p>
                                </div>
                            </div>
                            {dup.existingData && (
                                <div className="mt-3 pt-3 border-t border-yellow-200 text-xs text-gray-500">
                                    <span>Istniejąca faktura: </span>
                                    <span className="font-medium">ID #{dup.existingData.id}</span>
                                    <span> | Status: </span>
                                    <span className={`font-medium ${dup.existingData.status === 'paid' ? 'text-green-600' : 'text-red-500'}`}>
                                        {dup.existingData.status === 'paid' ? 'Opłacona' : 'Nieopłacona'}
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 space-y-3">
                    <p className="text-sm text-gray-600 mb-4">
                        {newCount > 0
                            ? `Pozostałe ${newCount} faktur można zaimportować bez konfliktów.`
                            : 'Wszystkie wybrane faktury już istnieją w bazie.'
                        }
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => onDecision('cancel')}
                            className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-300 transition-colors flex items-center justify-center gap-2"
                        >
                            <XCircle size={18} />
                            Anuluj
                        </button>
                        {newCount > 0 && (
                            <button
                                onClick={() => onDecision('skip')}
                                className="flex-1 px-4 py-3 bg-yellow-500 text-white font-medium rounded-xl hover:bg-yellow-600 transition-colors flex items-center justify-center gap-2"
                            >
                                <SkipForward size={18} />
                                Pomiń duplikaty ({newCount} nowych)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
