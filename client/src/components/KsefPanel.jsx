import { useState, useEffect } from 'react';
import { Download, RefreshCw, CheckCircle, AlertCircle, Loader2, X, Calendar, Building2, FileText, Save, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../api';
import KsefDuplicateModal from './KsefDuplicateModal';

/**
 * KSeF Panel - Pobieranie faktur z Krajowego Systemu e-Faktur
 */
export default function KsefPanel({ isOpen, onClose, entity, onImportSuccess }) {
    // Date range state
    const [dateFrom, setDateFrom] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        return d.toISOString().split('T')[0];
    });
    const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

    // Status state
    const [status, setStatus] = useState({ connected: false, message: 'Sprawdzanie...' });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Invoices state
    const [invoices, setInvoices] = useState([]);
    const [selectedInvoices, setSelectedInvoices] = useState(new Set());
    const [showDetails, setShowDetails] = useState(new Set());

    // Import state
    const [isImporting, setIsImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);

    // Duplicate modal state
    const [duplicateModal, setDuplicateModal] = useState({ open: false, duplicates: [], newInvoices: [] });

    useEffect(() => {
        if (isOpen) {
            checkStatus();
        }
    }, [isOpen]);

    const checkStatus = async () => {
        try {
            const response = await api.get('/ksef/status');
            setStatus(response.data);
        } catch (err) {
            setStatus({ connected: false, message: 'Brak połączenia z serwerem' });
        }
    };

    const handleRefreshToken = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const response = await api.post('/ksef/refresh');
            setStatus({
                connected: true,
                message: response.data.message || `Token ważny do ${new Date(response.data.validUntil).toLocaleTimeString('pl-PL')}`
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Błąd odświeżania tokenu');
            setStatus({ connected: false, message: 'Błąd autoryzacji' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleFetchInvoices = async () => {
        setIsLoading(true);
        setError(null);
        setInvoices([]);
        setSelectedInvoices(new Set());
        setImportResult(null);

        try {
            const response = await api.post('/ksef/invoices', {
                from: dateFrom,
                to: dateTo
            });

            setInvoices(response.data.invoices || []);
            await checkStatus(); // Refresh token status

            if (response.data.invoices?.length === 0) {
                setError('Brak faktur w wybranym okresie');
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Błąd pobierania faktur z KSeF');
        } finally {
            setIsLoading(false);
        }
    };

    const toggleSelectInvoice = (ksefRef) => {
        setSelectedInvoices(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ksefRef)) {
                newSet.delete(ksefRef);
            } else {
                newSet.add(ksefRef);
            }
            return newSet;
        });
    };

    const toggleSelectAll = () => {
        if (selectedInvoices.size === invoices.length) {
            setSelectedInvoices(new Set());
        } else {
            setSelectedInvoices(new Set(invoices.map(inv => inv.ksefReferenceNumber)));
        }
    };

    const toggleDetails = (ksefRef) => {
        setShowDetails(prev => {
            const newSet = new Set(prev);
            if (newSet.has(ksefRef)) {
                newSet.delete(ksefRef);
            } else {
                newSet.add(ksefRef);
            }
            return newSet;
        });
    };

    const handleImport = async () => {
        if (selectedInvoices.size === 0) return;

        const selectedInvoiceData = invoices.filter(inv => selectedInvoices.has(inv.ksefReferenceNumber));

        setIsImporting(true);
        setError(null);

        try {
            // First check for duplicates
            const checkResponse = await api.post('/ksef/check-duplicates', {
                invoices: selectedInvoiceData,
                entity: entity
            });

            if (checkResponse.data.hasDuplicates) {
                // Show duplicate modal
                setDuplicateModal({
                    open: true,
                    duplicates: checkResponse.data.duplicates,
                    newInvoices: checkResponse.data.newInvoices
                });
                setIsImporting(false);
                return;
            }

            // No duplicates - proceed with import
            await performImport(selectedInvoiceData);

        } catch (err) {
            setError(err.response?.data?.error || 'Błąd importu faktur');
            setIsImporting(false);
        }
    };

    const performImport = async (invoicesToImport, skipDuplicates = false) => {
        setIsImporting(true);
        try {
            const response = await api.post('/ksef/import', {
                invoices: invoicesToImport,
                entity: entity,
                skipDuplicates: skipDuplicates
            });

            setImportResult(response.data);
            setSelectedInvoices(new Set());

            // Remove imported invoices from list
            const importedRefs = new Set(invoicesToImport.map(inv => inv.ksefReferenceNumber));
            setInvoices(prev => prev.filter(inv => !importedRefs.has(inv.ksefReferenceNumber)));

            // Notify parent about successful import
            if (onImportSuccess && response.data.imported > 0) {
                onImportSuccess();
            }

        } catch (err) {
            setError(err.response?.data?.error || 'Błąd importu faktur');
        } finally {
            setIsImporting(false);
        }
    };

    const handleDuplicateDecision = (decision) => {
        setDuplicateModal({ open: false, duplicates: [], newInvoices: [] });

        if (decision === 'cancel') {
            return;
        }

        if (decision === 'skip') {
            // Import only new invoices
            if (duplicateModal.newInvoices.length > 0) {
                performImport(duplicateModal.newInvoices, true);
            }
        }

        if (decision === 'all') {
            // Import all (including duplicates - will overwrite)
            const selectedInvoiceData = invoices.filter(inv => selectedInvoices.has(inv.ksefReferenceNumber));
            performImport(selectedInvoiceData, true);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50" onClick={onClose} />

            {/* Modal */}
            <div className="fixed inset-4 lg:inset-12 bg-white rounded-3xl shadow-2xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-amber-100 bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center shadow-lg">
                            <FileText className="text-white" size={24} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-900 font-serif">Pobierz z KSeF</h2>
                            <p className="text-sm text-gray-500">Krajowy System e-Faktur</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X size={24} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6 space-y-6">
                    {/* Status Bar */}
                    <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${status.connected ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {status.connected ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                            <span className="text-sm font-medium">{status.message}</span>
                        </div>
                        <button
                            onClick={handleRefreshToken}
                            disabled={isLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                            <span className="text-sm font-medium">Odśwież token</span>
                        </button>
                    </div>

                    {/* Date Range */}
                    <div className="flex flex-wrap items-end gap-4">
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <Calendar size={14} className="inline mr-2" />
                                Data od
                            </label>
                            <input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                            />
                        </div>
                        <div className="flex-1 min-w-[200px]">
                            <label className="block text-sm font-medium text-gray-600 mb-2">
                                <Calendar size={14} className="inline mr-2" />
                                Data do
                            </label>
                            <input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleFetchInvoices}
                            disabled={isLoading}
                            className="px-8 py-3 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-amber-500/20"
                        >
                            {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Download size={20} />}
                            <span>Pobierz faktury</span>
                        </button>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-3">
                            <AlertCircle size={20} />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Import Result */}
                    {importResult && (
                        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 flex items-center gap-3">
                            <CheckCircle size={20} />
                            <span>
                                Zaimportowano: <strong>{importResult.imported}</strong> faktur
                                {importResult.skipped > 0 && ` | Pominięto: ${importResult.skipped}`}
                                {importResult.errors > 0 && ` | Błędy: ${importResult.errors}`}
                            </span>
                        </div>
                    )}

                    {/* Invoices List */}
                    {invoices.length > 0 && (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            {/* List Header */}
                            <div className="p-4 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={selectedInvoices.size === invoices.length}
                                            onChange={toggleSelectAll}
                                            className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                        />
                                        <span className="text-sm font-medium text-gray-600">
                                            Zaznacz wszystkie ({invoices.length})
                                        </span>
                                    </label>
                                </div>
                                <span className="text-sm text-gray-500">
                                    Wybrano: <strong className="text-amber-600">{selectedInvoices.size}</strong>
                                </span>
                            </div>

                            {/* Invoice Items */}
                            <div className="divide-y divide-gray-100 max-h-[400px] overflow-auto">
                                {invoices.map((inv) => (
                                    <div key={inv.ksefReferenceNumber} className="hover:bg-amber-50/30 transition-colors">
                                        <div className="p-4 flex items-center gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedInvoices.has(inv.ksefReferenceNumber)}
                                                onChange={() => toggleSelectInvoice(inv.ksefReferenceNumber)}
                                                className="w-5 h-5 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                            />
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-3">
                                                    <span className="font-bold text-gray-900">{inv.invoiceNumber}</span>
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-md font-medium">
                                                        KSeF
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                                                    <span className="flex items-center gap-1">
                                                        <Building2 size={14} />
                                                        {inv.contractorName}
                                                    </span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} />
                                                        {inv.issueDate}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-gray-900 text-lg">
                                                    {parseFloat(inv.grossAmount).toFixed(2)} <span className="text-sm text-gray-400 font-normal">{inv.currency}</span>
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => toggleDetails(inv.ksefReferenceNumber)}
                                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                                            >
                                                {showDetails.has(inv.ksefReferenceNumber) ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                                            </button>
                                        </div>

                                        {/* Expanded Details */}
                                        {showDetails.has(inv.ksefReferenceNumber) && (
                                            <div className="px-4 pb-4 pl-14 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                                <div>
                                                    <span className="text-gray-400 block">Netto</span>
                                                    <span className="font-medium">{parseFloat(inv.netAmount || 0).toFixed(2)} {inv.currency}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400 block">VAT</span>
                                                    <span className="font-medium">{parseFloat(inv.vatAmount || 0).toFixed(2)} {inv.currency}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400 block">NIP</span>
                                                    <span className="font-medium">{inv.contractorNIP || '-'}</span>
                                                </div>
                                                <div>
                                                    <span className="text-gray-400 block">Ref. KSeF</span>
                                                    <span className="font-medium text-xs break-all">{inv.ksefReferenceNumber}</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-4">
                    <button
                        onClick={onClose}
                        className="px-6 py-3 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                        Zamknij
                    </button>
                    <button
                        onClick={handleImport}
                        disabled={selectedInvoices.size === 0 || isImporting}
                        className="px-8 py-3 bg-green-500 text-white font-bold rounded-xl hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shadow-green-500/20"
                    >
                        {isImporting ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                        <span>Zapisz wybrane ({selectedInvoices.size})</span>
                    </button>
                </div>
            </div>

            {/* Duplicate Modal */}
            <KsefDuplicateModal
                isOpen={duplicateModal.open}
                duplicates={duplicateModal.duplicates}
                newCount={duplicateModal.newInvoices.length}
                onDecision={handleDuplicateDecision}
            />
        </>
    );
}
