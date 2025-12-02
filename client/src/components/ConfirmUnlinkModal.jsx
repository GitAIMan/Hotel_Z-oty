import { X, AlertTriangle, Info, Unlink } from 'lucide-react';

function ConfirmUnlinkModal({ isOpen, onClose, onConfirm, title, message, isInfoOnly = false, isSubmitting = false }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200 border border-gray-100">

                {/* Header */}
                <div className={`p-6 flex items-center gap-4 border-b ${isInfoOnly ? 'bg-blue-50 border-blue-100' : 'bg-amber-50 border-amber-100'}`}>
                    <div className={`p-3 rounded-xl ${isInfoOnly ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                        {isInfoOnly ? <Info size={24} /> : <Unlink size={24} />}
                    </div>
                    <h3 className={`text-xl font-bold font-serif ${isInfoOnly ? 'text-blue-900' : 'text-amber-900'}`}>
                        {title || (isInfoOnly ? 'Informacja' : 'Potwierdzenie')}
                    </h3>
                    <button
                        onClick={onClose}
                        className="ml-auto p-2 text-gray-400 hover:bg-white/50 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 text-center">
                    <p className="text-gray-600 text-lg leading-relaxed">
                        {message}
                    </p>
                </div>

                {/* Footer */}
                <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                    {isInfoOnly ? (
                        <button
                            onClick={onClose}
                            className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
                        >
                            Rozumiem
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm disabled:opacity-50"
                            >
                                Anuluj
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={isSubmitting}
                                className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-white font-bold rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-200 disabled:opacity-70 flex items-center gap-2"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        Przetwarzanie...
                                    </>
                                ) : (
                                    <>
                                        <Unlink size={18} />
                                        Odłącz
                                    </>
                                )}
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

export default ConfirmUnlinkModal;
