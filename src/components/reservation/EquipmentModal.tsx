import React, { useEffect, useRef } from 'react';
import { X, ShoppingCart, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Equipment {
  id: string;
  name: string;
  description: string;
  price: number;
  deposit: number;
  image: string;
  categories: string[];
  quantity: number;
}

interface EquipmentModalProps {
  equipment: Equipment | null;
  onClose: () => void;
  onAddToCart: (equipment: Equipment) => void;
  isInCart: boolean;
  onRemoveFromCart: (id: string) => void;
}

const EquipmentModal: React.FC<EquipmentModalProps> = ({ 
  equipment, 
  onClose, 
  onAddToCart,
  isInCart,
  onRemoveFromCart
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  useEffect(() => {
    if (modalRef.current && contentRef.current) {
      const updateMaxHeight = () => {
        const viewportHeight = window.innerHeight;
        const modalTop = modalRef.current?.getBoundingClientRect().top || 0;
        const maxHeight = viewportHeight - modalTop - 40; // 40px for padding
        contentRef.current!.style.maxHeight = `${maxHeight}px`;
      };

      updateMaxHeight();
      window.addEventListener('resize', updateMaxHeight);
      return () => window.removeEventListener('resize', updateMaxHeight);
    }
  }, []);

  if (!equipment) return null;

  return (
    <div className="fixed inset-0 modal-overlay flex items-center justify-center bg-black bg-opacity-75">
      <AnimatePresence>
        <motion.div
          ref={modalRef}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="bg-white w-[90%] max-h-[90vh] md:w-full md:h-auto rounded-lg shadow-xl md:max-w-5xl overflow-hidden relative mx-auto my-auto"
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-3 md:py-4 border-b bg-white">
            <h2 id="modal-title" className="text-xl md:text-2xl font-semibold text-gray-900">
              {equipment.name}
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 md:p-2 hover:bg-gray-100 rounded-full transition-colors active:bg-gray-200"
              aria-label="Zamknij"
            >
              <X className="w-5 h-5 md:w-6 md:h-6 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div
            ref={contentRef}
            className="overflow-y-auto max-h-[calc(90vh-4rem)] md:h-auto"
            style={{ scrollbarGutter: 'stable' }}
          >
            <div className="flex flex-col md:flex-row md:divide-x divide-gray-200">
              {/* Image Section */}
              <div className="md:w-1/2 p-3 md:p-6">
                <div className="bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center h-[200px] md:h-[300px]">
                  <img
                    src={equipment.image}
                    alt={equipment.name}
                    className="w-full h-full object-contain"
                    loading="lazy"
                  />
                </div>
              </div>

              {/* Details Section */}
              <div className="md:w-1/2 p-3 md:p-6">
                <div className="space-y-8">
                  {/* Price and Availability */}
                  <div className="bg-gray-50 p-4 md:p-6 rounded-lg">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xl md:text-2xl font-semibold text-solrent-orange">
                          {equipment.price} zł/dzień
                          {equipment.promotional_price && (
                            <div className="text-sm text-green-600 font-medium mt-1">
                              od 7 dni: {equipment.promotional_price} zł/dzień
                            </div>
                          )}
                        </div>
                        {equipment.deposit > 0 && (
                          <p className="text-sm text-orange-600 mt-2">
                            Kaucja: {equipment.deposit} zł
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-600 mb-1">
                          Dostępność:
                        </p>
                        <p className="font-medium text-green-600 text-lg">
                          {equipment.quantity} szt.
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Add to Cart Button */}
                  <button
                    onClick={() => {
                      if (isInCart && equipment) {
                        onRemoveFromCart(equipment.id);
                      } else if (equipment) {
                        onAddToCart({
                          ...equipment,
                          quantity: 1
                        });
                      }
                      onClose();
                    }}
                    className={`sticky bottom-0 left-0 right-0 w-full py-4 md:py-3 px-4 transition-colors flex items-center justify-center gap-2 md:rounded-lg shadow-lg md:shadow-none ${
                      isInCart 
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-solrent-orange hover:bg-orange-700 text-white'
                    }`}
                  >
                    {isInCart ? (
                      <>
                        <Trash2 className="w-5 h-5" />
                        Usuń z koszyka
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Dodaj do koszyka
                      </>
                    )}
                  </button>

                  {/* Description */}
                  <div className="text-sm md:text-base">
                    <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-3 md:mb-4">
                      Opis
                    </h3>
                    <div className="prose prose-sm max-w-none text-gray-600 leading-relaxed">
                      {equipment.description.split('\n').map((paragraph, index) => (
                        <p key={index} className="mb-4">{paragraph}</p>
                      ))}
                    </div>
                  </div>

                  {/* Categories */}
                  <div className="text-sm md:text-base">
                    <h3 className="text-lg md:text-xl font-medium text-gray-900 mb-3 md:mb-4">
                      Kategorie
                    </h3>
                    <div className="flex flex-wrap gap-2">
                      {equipment.categories.map((category, index) => (
                        <span
                          key={index}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                        >
                          {category === 'budowlany' ? 'Sprzęt budowlany' : 'Sprzęt ogrodniczy'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

export default EquipmentModal;