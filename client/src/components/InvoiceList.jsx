import { useState, useEffect, useRef } from 'react';
import api from '../api';
import { UploadCloud, FileText, CheckCircle, Loader2, AlertCircle, Calendar, CreditCard, Trash2, Edit2 } from 'lucide-react';
import InvoiceVerificationModal from './InvoiceVerificationModal';
import InvoiceEditModal from './InvoiceEditModal';

function InvoiceList({ entity }) {
    const [invoices, setInvoices] = useState([]);
    const [isDragging, setIsDragging] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    // Verification State
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [verificationData, setVerificationData] = useState(null);
    const [tempFilePath, setTempFilePath] = useState(null);
    const [isSaving, setIsSaving] = useState(false);

    // Edit State
    const [editingInvoice, setEditingInvoice] = useState(null);

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

    const handleFileUpload = async (file) => {
        setIsAnalyzing(true);
        const data = new FormData();
        data.append('file', file);
        data.append('entity', entity);

        try {
            // Step 1: Analyze
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
            alert('Błąd podczas zapisywania faktury.');
        } finally {
            setIsSaving(false);
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

            {/* Edit Modal */}
            <InvoiceEditModal
                isOpen={!!editingInvoice}
                onClose={() => setEditingInvoice(null)}
                onConfirm={handleUpdateInvoice}
                invoice={editingInvoice}
                isSubmitting={isSaving}
            />

            {/* Drag & Drop Zone */}
            <div
                className={`relative group cursor-pointer rounded-[2rem] border-4 border-dashed transition-all duration-500 p-8 lg:p-24 text-center
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

                <div className="flex flex-col items-center gap-8 pointer-events-none">
                    <div className={`w-32 h-32 rounded-3xl flex items-center justify-center transition-all duration-500 ${isDragging ? 'bg-gold-500 text-white rotate-12' : 'bg-white shadow-xl text-gold-500 group-hover:scale-110'}`}>
                        {isAnalyzing ? (
                            <Loader2 size={64} className="animate-spin" />
                        ) : (
                            <UploadCloud size={64} />
                        )}
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-4xl font-serif font-bold text-gray-800 group-hover:text-gold-700 transition-colors">
                            {isAnalyzing ? 'Claude 4.5 Analizuje...' : 'Przeciągnij fakturę'}
                        </h3>
                        <p className="text-gray-400 text-xl font-medium">
                            {isAnalyzing ? 'Weryfikacja danych...' : 'PDF, JPG lub PNG'}
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

                <div className="overflow-x-auto hidden md:block">
                    <table className="w-full">
                        <thead>
                            <tr className="bg-amber-100/50 text-left border-b border-amber-100">
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Dokument</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Kontrahent</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Kwota Brutto</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Daty</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Status</th>
                                <th className="py-6 px-8 font-bold text-amber-900/60 uppercase tracking-wider text-sm">Akcje</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-50/50">
                            {invoices.map((inv) => (
                                <tr key={inv.id} className="hover:bg-amber-50/50 transition-colors group border-b border-amber-50/30">
                                    <td className="py-6 px-8">
                                        <div className="flex items-center gap-4">
                                            <div className="p-3 bg-white border border-amber-100 rounded-xl text-amber-500 shadow-sm group-hover:border-amber-300 transition-colors">
                                                <FileText size={24} />
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-900 text-lg">{inv.invoiceNumber}</p>
                                                <p className="text-sm text-gray-400">ID: {inv.id}</p>
                                                {inv.category && (
                                                    <span className="inline-block mt-1 px-2 py-0.5 bg-amber-50 text-amber-600 border border-amber-100 text-xs rounded-md">
                                                        {inv.category}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-6 px-8">
                                        <p className="text-gray-800 font-medium text-lg">{inv.contractorName}</p>
                                        {inv.contractorNIP && <p className="text-sm text-gray-400">NIP: {inv.contractorNIP}</p>}
                                    </td>
                                    <td className="py-6 px-8">
                                        <p className="font-bold text-gray-900 text-2xl">{inv.grossAmount} <span className="text-base text-gray-400 font-normal">PLN</span></p>
                                        {inv.netAmount && <p className="text-sm text-gray-400">Netto: {inv.netAmount}</p>}
                                    </td>
                                    <td className="py-6 px-8">
                                        <div className="flex flex-col gap-2 text-base text-gray-500">
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
                                    <td className="py-6 px-8">
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
                                                <Edit2 size={20} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(inv.id)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                title="Usuń fakturę"
                                            >
                                                <Trash2 size={20} />
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
