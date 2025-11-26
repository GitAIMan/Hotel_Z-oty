import { useState, useEffect, useRef } from 'react';
import { Search, HelpCircle, ChevronDown, Check } from 'lucide-react';
import { getFlatCategories } from '../constants/categories';
import CategoryHelpModal from './CategoryHelpModal';

function CategorySelector({ value, onChange, className }) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [flatCategories, setFlatCategories] = useState([]);
    const wrapperRef = useRef(null);

    useEffect(() => {
        setFlatCategories(getFlatCategories());
    }, []);

    useEffect(() => {
        // Initialize search term if value exists
        if (value) {
            setSearchTerm(value);
        }
    }, [value]);

    useEffect(() => {
        // Close dropdown when clicking outside
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const filteredCategories = flatCategories.filter(cat =>
        cat.value.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cat.group.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSelect = (category) => {
        onChange(category.value);
        setSearchTerm(category.value);
        setIsOpen(false);
    };

    const handleInputChange = (e) => {
        setSearchTerm(e.target.value);
        setIsOpen(true);
        onChange(e.target.value); // Allow custom values or partial input
    };

    return (
        <div className="relative" ref={wrapperRef}>
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={handleInputChange}
                        onFocus={() => setIsOpen(true)}
                        placeholder="Wpisz kategorię (np. Uniformy)..."
                        className={`pl-10 pr-10 ${className}`}
                    />
                    <button
                        type="button"
                        onClick={() => setIsOpen(!isOpen)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gold-500 transition-colors"
                    >
                        <ChevronDown size={18} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
                <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="p-3 bg-gold-50 text-gold-600 rounded-xl hover:bg-gold-100 transition-colors border border-gold-200"
                    title="Pokaż strukturę kategorii"
                >
                    <HelpCircle size={20} />
                </button>
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute z-50 w-full mt-2 bg-white rounded-xl shadow-xl border border-gray-100 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95 duration-200">
                    {filteredCategories.length > 0 ? (
                        <ul className="py-2">
                            {filteredCategories.map((cat, index) => (
                                <li
                                    key={`${cat.group}-${cat.value}-${index}`}
                                    onClick={() => handleSelect(cat)}
                                    className="px-4 py-3 hover:bg-gold-50 cursor-pointer flex justify-between items-center group transition-colors"
                                >
                                    <div>
                                        <span className="font-medium text-gray-800 group-hover:text-gold-700 block">
                                            {cat.value}
                                        </span>
                                        <span className="text-xs text-gray-400 group-hover:text-gold-400">
                                            {cat.group}
                                        </span>
                                    </div>
                                    {value === cat.value && <Check size={16} className="text-gold-500" />}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="p-4 text-center text-gray-400 text-sm">
                            Brak pasujących kategorii
                        </div>
                    )}
                </div>
            )}

            <CategoryHelpModal
                isOpen={showHelpModal}
                onClose={() => setShowHelpModal(false)}
            />
        </div>
    );
}

export default CategorySelector;
