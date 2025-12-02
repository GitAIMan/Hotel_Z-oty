import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { UploadCloud, FileText, CheckCircle, Loader2, AlertCircle, Calendar, CreditCard, Trash2, Edit2, DollarSign, Unlink } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import InvoiceVerificationModal from './InvoiceVerificationModal';
import InvoiceEditModal from './InvoiceEditModal';
import DuplicateInvoiceModal from './DuplicateInvoiceModal';

import MobilePhotoUploader from './MobilePhotoUploader';
import TransactionSelectorModal from './TransactionSelectorModal';
import ConfirmUnlinkModal from './ConfirmUnlinkModal';
import { linkInvoiceToTransaction, unlinkInvoiceFromTransaction } from '../api';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

function InvoiceList({ entity }) {
    const [invoices, setInvoices] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Verification State
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationData, setVerificationData] = useState(null);
    const [tempFilePath, setTempFilePath] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Duplicate State
    const [showDuplicateModal, setShowDuplicateModal] = useState(false);
    const [duplicateData, setDuplicateData] = useState(null);

    // Edit State
    const [editingInvoice, setEditingInvoice] = useState(null);

    // Manual Link State
    const [showLinkModal, setShowLinkModal] = useState(false);
    const [linkInvoiceId, setLinkInvoiceId] = useState(null);

    // Unlink State
    const [unlinkingInvoice, setUnlinkingInvoice] = useState(null);

    const fileInputRef = useRef(null);

    useEffect(() => {
        fetchInvoices();
    }, [entity]);

    const fetchInvoices = async () => {
        try {
            const response = await api.get(`/invoices?entity=${entity}`);
            setInvoices(response.data);
        } catch (error) {
            console.error('Error fetching invoices:', error);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Czy na pewno chcesz usunąć tę fakturę?')) return;
        try {
            await api.delete(`/invoices/${id}`);
            fetchInvoices();
        } catch (error) {
            console.error('Error deleting invoice:', error);
            alert('Błąd podczas usuwania faktury.');
        }
    };

    const handleEdit = (invoice) => {
        setEditingInvoice(invoice);
    };

    const handleUpdateInvoice = async (updatedData) => {
        setIsSaving(true);
        try {
            await api.put(`/invoices/${updatedData.id}`, updatedData);
            setEditingInvoice(null);
            fetchInvoices();
        } catch (error) {
            console.error('Error updating invoice:', error);
            alert('Błąd podczas aktualizacji faktury.');
        } finally {
            setIsSaving(false);
        }
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
            handleFileUpload(files[0]);
        }
    };

    const handleFileUpload = async (filesInput) => {
        const files = Array.isArray(filesInput) ? filesInput : [filesInput];

        // PDF Page Limit Check (only for single PDF upload scenario usually, but let's check all)
        for (const file of files) {
            if (file.type === 'application/pdf') {
                try {
                    const arrayBuffer = await file.arrayBuffer();
                    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
                    if (pdf.numPages > 3) {
                        alert(`Błąd: Plik ${file.name} ma ${pdf.numPages} stron. Maksymalna dozwolona liczba to 3.`);
                        return;
                    }
                } catch (error) {
                    console.error("Error checking PDF pages:", error);
                    alert("Błąd podczas weryfikacji pliku PDF. Upewnij się, że plik jest poprawny.");
                    return;
                }
            }
        }

        setIsAnalyzing(true);
        const data = new FormData();
        files.forEach(file => {
            data.append('files', file); // Use 'files' key for array
        });
        data.append('entity', entity);

        try {
            // Step 1: Analyze
            // Note: We changed endpoint to accept 'files' array in backend
            const response = await api.post('/invoices/analyze', data, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Step 2: Open Verification Modal
            setVerificationData(response.data.aiData);
            setTempFilePath(response.data.tempFilePath);
            setShowVerificationModal(true);

        } catch (error) {
            console.error('Error analyzing invoice:', error);
            const errorMessage = error.response?.data?.error || 'Błąd podczas analizy faktury. Sprawdź konsolę.';
            alert(`Błąd: ${errorMessage}`);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleConfirm = async (confirmedData) => {
        setIsSaving(true);
        try {
            await api.post('/invoices/confirm', {
                entity,
                invoiceData: confirmedData,
                tempFilePath
            });

            setShowVerificationModal(false);
            setVerificationData(null);
            setTempFilePath(null);
            await fetchInvoices();

        } catch (error) {
            console.error('Error saving invoice:', error);

            // Handle duplicate invoice error
            if (error.response?.status === 409 && error.response?.data?.error === 'DUPLICATE_INVOICE') {
                setDuplicateData({ existingInvoice: error.response.data.existingInvoice });
                setShowDuplicateModal(true);
            } else {
                alert('Błąd podczas zapisywania faktury.');
            }
        } finally {
            setIsSaving(false);
        }
    };



    const handleLinkClick = (invoice) => {
        setLinkInvoiceId(invoice.id);
        setShowLinkModal(true);
    };

    const handleLinkTransaction = async (settlementId, paymentId) => {
        if (!linkInvoiceId) return;
        setIsSaving(true);
        try {
            await linkInvoiceToTransaction(linkInvoiceId, { settlementId, paymentId });
            setShowLinkModal(false);
            setLinkInvoiceId(null);
            fetchInvoices();
            alert('Pomyślnie połączono fakturę z płatnością!');
        } catch (error) {
            console.error('Error linking transaction:', error);
            alert('Błąd podczas łączenia: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnlinkClick = (invoice) => {
        // Allow unlink if matchedSettlementFile exists OR if status is 'paid' (to reset ghost payments)
        if (!invoice.matchedSettlementFile && invoice.status !== 'paid') {
            setUnlinkingInvoice({
                ...invoice,
                isInfoOnly: true,
                title: 'Brak powiązania',
                message: 'Ta faktura nie jest połączona z żadnym rozliczeniem.'
            });
            return;
        }

        setUnlinkingInvoice({
            ...invoice,
            isInfoOnly: false,
            title: 'Potwierdzenie odłączenia',
            message: invoice.matchedSettlementFile
                ? `Czy na pewno chcesz odłączyć fakturę ${invoice.invoiceNumber} od rozliczenia?`
                : `Faktura ma status "Opłacona", ale brak powiązania z plikiem. Czy chcesz zmienić status na "Nieopłacona"?`
        });
    };

    const handleConfirmUnlink = async () => {
        if (!unlinkingInvoice || unlinkingInvoice.isInfoOnly) {
            setUnlinkingInvoice(null);
            return;
        }

        setIsSaving(true);
        try {
            await unlinkInvoiceFromTransaction(unlinkingInvoice.id);
            fetchInvoices();
            // Alert is handled by modal success state or just close
        } catch (error) {
            console.error('Error unlinking:', error);
            alert('Błąd podczas odłączania: ' + (error.response?.data?.error || error.message));
        } finally {
            setIsSaving(false);
            setUnlinkingInvoice(null);
        }
    };

    return (
        <div className="space-y-10">
            {/* Verification Modal */}
            <InvoiceVerificationModal
                isOpen={showVerificationModal}
                onClose={() => setShowVerificationModal(false)}
                onConfirm={handleConfirm}
                initialData={verificationData}
                isSubmitting={isSaving}
            />

            {/* Duplicate Modal */}
            <DuplicateInvoiceModal
                isOpen={showDuplicateModal}
                onClose={() => setShowDuplicateModal(false)}
                duplicateData={duplicateData}
            />

            {/* Edit Modal */}
            <InvoiceEditModal
                isOpen={!!editingInvoice}
                onClose={() => setEditingInvoice(null)}
                onConfirm={handleUpdateInvoice}
                invoice={editingInvoice}
                isSubmitting={isSaving}
            />

            {/* Link Transaction Modal */}
            <TransactionSelectorModal
                isOpen={showLinkModal}
                onClose={() => setShowLinkModal(false)}
                onSelect={handleLinkTransaction}
                entity={entity}
            />

            {/* Unlink Confirmation Modal */}
            <ConfirmUnlinkModal
                isOpen={!!unlinkingInvoice}
                onClose={() => setUnlinkingInvoice(null)}
                onConfirm={handleConfirmUnlink}
                title={unlinkingInvoice?.title}
                message={unlinkingInvoice?.message}
                isInfoOnly={unlinkingInvoice?.isInfoOnly}
                isSubmitting={isSaving}
            />

            {/* Mobile Photo Uploader */}
            <MobilePhotoUploader
                onUpload={(files) => {
                    // Handle array of files
                    // We need to modify handleFileUpload to accept array or single file
                    // But handleFileUpload expects a single file currently.
                    // Let's modify handleFileUpload to handle array.
                    if (files.length > 0) {
                        handleFileUpload(files);
                    }
                }}
                isAnalyzing={isAnalyzing}
            />

            {/* Drag & Drop Zone - Hidden on Mobile to prevent confusion with MobilePhotoUploader */}
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
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handleFileUpload(e.target.files[0])}
                    accept=".pdf,.jpg,.jpeg,.png"
                />

                <div className="flex flex-col items-center gap-4 lg:gap-6 pointer-events-none">
                    <div className={`w-16 h-16 lg:w-20 lg:h-20 rounded-2xl flex items-center justify-center transition-all duration-500 ${isDragging ? 'bg-gold-500 text-white rotate-12' : 'bg-white shadow-xl text-gold-500 group-hover:scale-110'}`}>
                        {isAnalyzing ? (
                            <Loader2 size={32} className="animate-spin" />
                        ) : (
                            <UploadCloud size={32} />
                        )}
                    </div>

                    <div className="space-y-2">
                        <h3 className="text-xl lg:text-2xl font-serif font-bold text-gray-800 group-hover:text-gold-700 transition-colors">
                            {isAnalyzing ? 'Analiza...' : 'Dodaj fakturę'}
                        </h3>
                        <p className="text-gray-400 text-sm lg:text-base font-medium">
                            {isAnalyzing ? 'Przetwarzanie...' : 'Kliknij lub upuść plik tutaj'}
                        </p>
                    </div>
                </div>
            </div>

            {/* Invoices List */}
            <div className="glass-card rounded-3xl overflow-hidden shadow-xl border border-amber-200/50 bg-gradient-to-b from-white to-amber-50/30">
                <div className="p-8 border-b border-amber-100 flex justify-between items-center bg-amber-50/50">
                    <h2 className="text-2xl font-bold text-gray-800 font-serif">Ostatnie Faktury</h2>
                    <span className="bg-amber-100 text-amber-800 px-6 py-2 rounded-full text-sm font-bold tracking-wide uppercase border border-amber-200">
                        {entity === 'zloty_gron' ? 'Złoty Groń' : 'Srebrny Bucznik'}
                    </span>
                </div>

                <div className="overflow-x-auto hidden md:block border border-gray-300 rounded-lg shadow-sm">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-amber-100/50 text-left border-b-2 border-amber-200">
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Dokument</th>
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Kontrahent</th>
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Kwota Brutto</th>
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Daty</th>
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Status</th>
                                <th className="py-3 px-4 font-bold text-amber-900/60 uppercase tracking-wider text-xs">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50/50">
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-amber-50/70 transition-colors group border-b border-gray-300">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-white border border-amber-100 rounded-lg text-amber-500 shadow-sm group-hover:border-amber-300 transition-colors">
                                                <FileText size={18} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-base">{inv.invoiceNumber}</p>
                                                <p className="text-xs text-gray-400">ID: {inv.id}</p>
                                                {inv.category && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-xs rounded-md">
                                                        {inv.category}
                                                    </span>
                                                )}

                                                {inv.matchedSettlementFile && (
                                                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                                                        <CheckCircle size={10} />
                                                        Opłacono: {inv.matchedSettlementFile}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="text-gray-800 font-medium text-base">{inv.contractorName}</p>
                                        {inv.contractorNIP && <p className="text-xs text-gray-400">NIP: {inv.contractorNIP}</p>}
                                    </td>
                                    <td className="py-4 px-4">
                                        <p className="font-bold text-gray-900 text-xl">{inv.grossAmount} <span className="text-sm text-gray-400 font-normal">PLN</span></p>
                                        {inv.netAmount && <p className="text-xs text-gray-400">Netto: {inv.netAmount}</p>}
                                    </td>
                                    <td className="py-6 px-4">
                                        <div className="flex flex-col gap-1 text-sm text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={16} className="text-amber-300" />
                                                <span>Wyst: {inv.issueDate || '-'}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-amber-600 font-medium">
                                                <CreditCard size={16} />
                                                <span>Płat: {inv.paymentDate || '-'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4">
                                        <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${inv.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' :
                                            inv.status === 'partial' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                                'bg-red-50 text-red-600 border border-red-100'
                                            }`}>
                                            {inv.status === 'paid' && <CheckCircle size={16} />}
                                            {inv.status === 'paid' ? 'Opłacona' : inv.status === 'partial' ? 'Częściowo' : 'Nieopłacona'}
                                        </span>
                                    </td>
                                    <td className="py-6 px-8">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEdit(inv)}
                                                className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-full transition-colors"
                                                title="Edytuj fakturę"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(inv.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                title="Usuń fakturę"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleLinkClick(inv)}
                                                className="p-2 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-full transition-colors"
                                                title="Połącz z płatnością"
                                            >
                                                <DollarSign size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleUnlinkClick(inv)}
                                                className={`p-2 rounded-full transition-all shadow-sm ${(inv.matchedSettlementFile || inv.status === 'paid')
                                                    ? 'text-orange-600 bg-orange-100 hover:bg-orange-200 hover:scale-105'
                                                    : 'text-gray-300 hover:text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                title={(inv.matchedSettlementFile || inv.status === 'paid') ? "Odłącz / Resetuj status" : "Brak powiązania"}
                                            >
                                                <Unlink size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {invoices.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-24 text-center text-gray-400">
                                        <div className="flex flex-col items-center gap-6">
                                            <div className="w-24 h-24 bg-amber-50 rounded-full flex items-center justify-center">
                                                <AlertCircle size={48} className="text-amber-200" />
                                            </div>
                                            <p className="text-xl">Brak faktur dla {entity === 'zloty_gron' ? 'Złoty Groń' : 'Srebrny Bucznik'}.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>

                </div>

                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-amber-100">
                    {invoices.map((inv) => (
                        <div key={inv.id} className="p-6 flex flex-col gap-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white border border-amber-100 rounded-lg text-amber-500 shadow-sm">
                                        <FileText size={20} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-gray-900">{inv.invoiceNumber}</p>
                                        <p className="text-xs text-gray-400">ID: {inv.id}</p>
                                    </div>
                                </div>
                                <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${inv.status === 'paid' ? 'bg-green-100 text-green-700 border border-green-200' :
                                    inv.status === 'partial' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                                        'bg-red-50 text-red-600 border border-red-100'
                                    }`}>
                                    {inv.status === 'paid' && <CheckCircle size={12} />}
                                    {inv.status === 'paid' ? 'Opłacona' : inv.status === 'partial' ? 'Częściowo' : 'Nieopłacona'}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Kontrahent</p>
                                    <p className="font-medium text-gray-800">{inv.contractorName}</p>
                                    {inv.contractorNIP && <p className="text-xs text-gray-400">{inv.contractorNIP}</p>}
                                </div>
                                <div className="text-right">
                                    <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Kwota Brutto</p>
                                    <p className="font-bold text-gray-900 text-xl">{inv.grossAmount} <span className="text-xs font-normal text-gray-400">PLN</span></p>
                                </div>
                            </div>

                            <div className="flex items-center justify-between pt-4 border-t border-amber-50/50">
                                <div className="flex gap-4 text-xs text-gray-500">
                                    <div className="flex items-center gap-1">
                                        <Calendar size={14} className="text-amber-300" />
                                        <span>{inv.issueDate || '-'}</span>
                                    </div>
                                    {inv.category && (
                                        <span className="px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 rounded-md">
                                            {inv.category}
                                        </span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => handleEdit(inv)}
                                        className="p-2 text-gray-400 hover:text-blue-500 bg-gray-50 rounded-full"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(inv.id)}
                                        className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 rounded-full"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleUnlinkClick(inv)}
                                        className={`p-2 rounded-full border ${(inv.matchedSettlementFile || inv.status === 'paid')
                                            ? 'text-orange-600 bg-orange-100 border-orange-200'
                                            : 'text-gray-300 hover:text-gray-500 bg-gray-50 border-gray-100'
                                            }`}
                                    >
                                        <Unlink size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    {invoices.length === 0 && (
                        <div className="p-12 text-center text-gray-400">
                            <div className="flex flex-col items-center gap-4">
                                <AlertCircle size={32} className="text-amber-200" />
                                <p>Brak faktur.</p>
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}

export default InvoiceList;
