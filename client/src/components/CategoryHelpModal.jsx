import { X, Folder, FileText } from 'lucide-react';
import { CATEGORIES } from '../constants/categories';

function CategoryHelpModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-300">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 bg-gold-50/30 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gold-100 text-gold-600 rounded-lg">
                            <Folder size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-serif font-bold text-gray-800">Struktura Kategorii</h2>
                            <p className="text-sm text-gray-500">Pełna lista dostępnych kategorii kosztowych</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 overflow-y-auto bg-gray-50/30">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {Object.entries(CATEGORIES).map(([group, items]) => (
                            <div key={group} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow duration-300">
                                <div className="p-4 bg-gradient-to-r from-gold-50 to-white border-b border-gold-100">
                                    <h3 className="font-bold text-gold-800 flex items-center gap-2">
                                        <Folder size={18} className="text-gold-500" />
                                        {group}
                                    </h3>
                                </div>
                                <ul className="p-4 space-y-2">
                                    {items.map((item) => (
                                        <li key={item} className="flex items-start gap-2 text-sm text-gray-600 hover:text-gold-600 transition-colors cursor-default group">
                                            <FileText size={14} className="mt-0.5 text-gray-300 group-hover:text-gold-400" />
                                            <span>{item}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 rounded-xl font-bold text-gray-500 hover:bg-gray-100 transition-colors"
                    >
                        Zamknij
                    </button>
                </div>
            </div>
        </div>
    );
}

export default CategoryHelpModal;
