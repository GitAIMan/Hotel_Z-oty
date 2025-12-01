import { X, AlertTriangle, FileText, Calendar, CreditCard } from 'lucide-react';

function DuplicateInvoiceModal({ isOpen, onClose, duplicateData }) {
    if (!isOpen || !duplicateData) return null;

    const { existingInvoice } = duplicateData;
    const createdDate = new Date(existingInvoice.createdAt).toLocaleDateString('pl-PL');

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in duration-300 border-4 border-amber-100">

                {/* Header */}
                <div className="p-8 bg-amber-50 flex flex-col items-center text-center border-b border-amber-100">
                    <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mb-4 shadow-inner">
                        <AlertTriangle size={40} className="text-amber-600" />
                    </div>
                    <h2 className="text-2xl font-serif font-bold text-gray-800">Duplikat Faktury!</h2>
                    <p className="text-amber-700 font-medium mt-2">
                        Ta faktura znajduje się już w systemie.
                    </p>
                </div>

                {/* Content */}
                <div className="p-8 space-y-6">
                    <div className="bg-gray-50 rounded-2xl p-6 border border-gray-100 space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-blue-500">
                                <FileText size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Numer Faktury</p>
                                <p className="text-lg font-bold text-gray-900">{existingInvoice.invoiceNumber}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-4">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-purple-500">
                                <CreditCard size={24} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Kontrahent</p>
                                <p className="text-lg font-medium text-gray-800">{existingInvoice.contractorName}</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-2">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Kwota</p>
                                <p className="text-xl font-bold text-gray-900">{existingInvoice.grossAmount} <span className="text-sm font-normal text-gray-500">PLN</span></p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                                <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${existingInvoice.status === 'paid' ? 'bg-green-100 text-green-700' :
                                        existingInvoice.status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-red-50 text-red-600'
                                    }`}>
                                    {existingInvoice.status === 'paid' ? 'Opłacona' : existingInvoice.status === 'partial' ? 'Częściowo' : 'Nieopłacona'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-500 justify-center">
                        <Calendar size={16} />
                        <span>Dodano do systemu: {createdDate}</span>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-center">
                    <button
                        onClick={onClose}
                        className="w-full py-4 rounded-xl font-bold text-white bg-amber-500 hover:bg-amber-600 shadow-lg shadow-amber-200 transition-all transform hover:-translate-y-0.5"
                    >
                        Rozumiem, zamknij
                    </button>
                </div>
            </div>
        </div>
    );
}

export default DuplicateInvoiceModal;
