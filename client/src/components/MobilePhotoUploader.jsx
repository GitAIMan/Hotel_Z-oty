import { useState, useRef } from 'react';
import { Camera, X, Check, Image as ImageIcon, RotateCcw } from 'lucide-react';

function MobilePhotoUploader({ onUpload, isAnalyzing }) {
    const [isOpen, setIsOpen] = useState(false);
    const [photos, setPhotos] = useState([]);
    const fileInputRef = useRef(null);
    const [activeMode, setActiveMode] = useState(null); // 'front', 'back', 'camera'

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const newPhoto = {
                file: e.target.files[0],
                preview: URL.createObjectURL(e.target.files[0]),
                type: activeMode
            };
            setPhotos(prev => [...prev, newPhoto]);
        }
        // Reset input
        if (fileInputRef.current) fileInputRef.current.value = '';
        setActiveMode(null);
    };

    const triggerCamera = (mode) => {
        if (photos.length >= 3) {
            alert('Maksymalnie 3 zdjęcia.');
            return;
        }
        setActiveMode(mode);
        fileInputRef.current?.click();
    };

    const removePhoto = (index) => {
        setPhotos(prev => prev.filter((_, i) => i !== index));
    };

    const handleSubmit = () => {
        if (photos.length === 0) return;
        onUpload(photos.map(p => p.file));
        setPhotos([]);
        setIsOpen(false);
    };

    const getLabel = (type) => {
        switch (type) {
            case 'page1': return 'Strona 1';
            case 'page2': return 'Strona 2';
            case 'page3': return 'Strona 3';
            default: return 'Strona';
        }
    };

    return (
        <div className="md:hidden">
            {/* Floating Action Button */}
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-6 right-6 z-40 bg-gold-gradient text-white p-4 rounded-full shadow-xl shadow-gold-500/30 flex items-center gap-2 font-bold animate-bounce-slow"
            >
                <Camera size={24} />
                <span>Zrób Zdjęcie</span>
            </button>

            {/* Hidden Input */}
            <input
                type="file"
                accept="image/*"
                capture="environment"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Drawer / Modal */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full rounded-t-3xl p-6 pb-10 shadow-2xl animate-slide-up max-h-[90vh] overflow-y-auto">

                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold font-serif text-gray-800">Dodaj zdjęcia ({photos.length}/3)</h3>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 bg-gray-100 rounded-full text-gray-500 hover:bg-gray-200"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Photo List */}
                        {photos.length > 0 && (
                            <div className="flex gap-4 overflow-x-auto pb-4 mb-6">
                                {photos.map((photo, index) => (
                                    <div key={index} className="relative shrink-0 w-24 h-32 rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                                        <img src={photo.preview} alt={`Photo ${index}`} className="w-full h-full object-cover" />
                                        <div className="absolute bottom-0 inset-x-0 bg-black/50 text-white text-[10px] text-center py-1">
                                            {getLabel(photo.type)}
                                        </div>
                                        <button
                                            onClick={() => removePhoto(index)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full shadow-sm"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Action Buttons */}
                        <div className="grid grid-cols-3 gap-3 mb-8">
                            <button
                                onClick={() => triggerCamera('page1')}
                                disabled={photos.length >= 3}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 disabled:opacity-50 disabled:grayscale"
                            >
                                <div className="p-3 bg-white rounded-full shadow-sm">
                                    <FileText size={20} />
                                </div>
                                <span className="text-xs font-bold">Strona 1</span>
                            </button>

                            <button
                                onClick={() => triggerCamera('page2')}
                                disabled={photos.length >= 3}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 disabled:opacity-50 disabled:grayscale"
                            >
                                <div className="p-3 bg-white rounded-full shadow-sm">
                                    <FileText size={20} />
                                </div>
                                <span className="text-xs font-bold">Strona 2</span>
                            </button>

                            <button
                                onClick={() => triggerCamera('page3')}
                                disabled={photos.length >= 3}
                                className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100 disabled:opacity-50 disabled:grayscale"
                            >
                                <div className="p-3 bg-white rounded-full shadow-sm">
                                    <FileText size={20} />
                                </div>
                                <span className="text-xs font-bold">Strona 3</span>
                            </button>
                        </div>

                        {/* Submit Button */}
                        <button
                            onClick={handleSubmit}
                            disabled={photos.length === 0 || isAnalyzing}
                            className={`w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 shadow-lg ${photos.length === 0 || isAnalyzing
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                : 'bg-gold-gradient text-white shadow-gold-500/30'
                                }`}
                        >
                            {isAnalyzing ? <Loader2 className="animate-spin" /> : <Check />}
                            {isAnalyzing ? 'Przetwarzanie...' : `Wyślij ${photos.length} zdjęcia`}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper icons needed for this component
import { FileText, Loader2 } from 'lucide-react';

export default MobilePhotoUploader;
