
import React, { useState, useRef } from 'react';
import Card, { ScrollAnimator } from '../components/ui/Card';
import type { Product } from '../types';
import { ProductStatus } from '../types';
import AddItemModal, { NewProductData } from '../components/inventory/AddItemModal';
import EditItemModal from '../components/inventory/EditItemModal';
import { useAppContext } from '../hooks/useAppContext';
import InventoryStats from '../components/inventory/InventoryStats';
import AIAnalystModal from '../components/inventory/AIAnalystModal';
import { RobotIcon, UploadIcon } from '../components/icons/Icons';

const InventoryPage: React.FC = () => {
    const { products, setProducts, isSynced } = useAppContext();
    const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
    const [isAIModalOpen, setIsAIModalOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const getStatusColor = (status: ProductStatus) => {
        switch (status) {
            case ProductStatus.InStock:
                return 'bg-green-500/20 text-green-400 border border-green-500/30';
            case ProductStatus.LowStock:
                return 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
            case ProductStatus.OutOfStock:
                return 'bg-red-500/20 text-red-400 border border-red-500/30';
            default:
                return 'bg-gray-500/20 text-gray-400';
        }
    };

    const getStatusFromQuantity = (quantity: number): ProductStatus => {
        if (quantity === 0) return ProductStatus.OutOfStock;
        if (quantity <= 50) return ProductStatus.LowStock;
        return ProductStatus.InStock;
    };
    
    const handleAddItem = (newItemData: NewProductData) => {
        const existingIds = products.map(p => parseInt(p.id.split('-')[1], 10));
        const newIdNumber = (existingIds.length > 0 ? Math.max(...existingIds) : 0) + 1;
        const newId = `PID-${String(newIdNumber).padStart(3, '0')}`;

        const newProduct: Product = {
            id: newId,
            ...newItemData,
            status: getStatusFromQuantity(newItemData.quantity),
            dateAdded: new Date().toISOString().split('T')[0],
        };

        setProducts(prevProducts => [...prevProducts, newProduct].sort((a,b) => a.id.localeCompare(b.id)));
        setIsAddItemModalOpen(false);
    };

    const handleUpdateItem = (updatedProduct: Product) => {
        setProducts(prevProducts =>
            prevProducts.map(p =>
                p.id === updatedProduct.id
                    ? { ...updatedProduct, status: getStatusFromQuantity(updatedProduct.quantity) }
                    : p
            )
        );
        setEditingProduct(null);
    };

    const handleOpenEditModal = (product: Product) => {
        setEditingProduct(product);
    };

    const handleCloseEditModal = () => {
        setEditingProduct(null);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/inventory/upload', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Failed to upload file');
            }

            const result = await response.json();
            alert(result.message);
        } catch (err: any) {
            alert(`Error uploading file: ${err.message}`);
            console.error(err);
        } finally {
            e.target.value = '';
        }
    };

    return (
        <div className="space-y-6">
             <ScrollAnimator>
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">Inventory Overview</h3>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${isSynced ? 'bg-neon-green shadow-neon-green' : 'bg-red-500 shadow-red-500'}`}></div>
                        <span className="text-[10px] font-bold uppercase tracking-tighter text-gray-500">
                            {isSynced ? 'Live Sync Active' : 'Sync Offline'}
                        </span>
                    </div>
                </div>
                <InventoryStats products={products} />
            </ScrollAnimator>

            <ScrollAnimator delay={150}>
                <Card className="h-full flex flex-col">
                    <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
                        <h2 className="text-2xl font-bold w-full sm:w-auto">Inventory Management</h2>
                        <div className="flex flex-wrap gap-2 w-full sm:w-auto">
                            <input
                                type="file"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                                accept=".xlsx, .xls, .csv"
                                className="hidden"
                            />
                            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neon-blue/5 border border-neon-blue/20 text-neon-blue text-xs font-bold">
                                <div className="w-1.5 h-1.5 rounded-full bg-neon-blue animate-pulse"></div>
                                SYNCING: inventory.xlsx
                            </div>
                            <button 
                                onClick={() => window.location.href = '/api/download-template'} 
                                className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-lg bg-neon-blue/10 text-neon-blue font-semibold border border-neon-blue/20 hover:bg-neon-blue/20 transition-colors"
                                title="Download the Excel file currently being watched by the server"
                            >
                                <UploadIcon className="w-5 h-5 rotate-180" />
                                Download Template
                            </button>
                            <button 
                                onClick={handleImportClick} 
                                className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-lg bg-white/5 border border-white/20 text-gray-300 font-semibold hover:bg-white/10 hover:border-neon-blue/50 transition-all"
                                title="Upload your modified Excel file to sync with the server"
                            >
                                <UploadIcon className="w-5 h-5" />
                                Upload Excel
                            </button>
                           <button onClick={() => setIsAIModalOpen(true)} className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2 rounded-lg bg-neon-green/10 text-neon-green font-semibold border border-neon-green/20 hover:bg-neon-green/20 transition-colors">
                                <RobotIcon className="w-5 h-5" />
                                Ask AI
                            </button>
                            <button onClick={() => setIsAddItemModalOpen(true)} className="w-full sm:w-auto px-4 py-2 rounded-lg bg-neon-blue text-dark-bg font-semibold hover:shadow-neon-blue transition-shadow">
                                Add New Item
                            </button>
                        </div>
                    </div>

                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left min-w-[640px]">
                            <thead>
                                <tr className="border-b border-white/10 text-gray-500 uppercase text-[10px] tracking-wider font-bold">
                                    <th className="p-4">ID</th>
                                    <th className="p-4">Product Details</th>
                                    <th className="p-4">Category</th>
                                    <th className="p-4">Quantity</th>
                                    <th className="p-4">Pricing</th>
                                    <th className="p-4">Fulfillment</th>
                                    <th className="p-4">Status</th>
                                    <th className="p-4 text-center">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {products.map((product) => (
                                    <tr key={product.id} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                                        <td className="p-4 font-mono text-gray-500">{product.id}</td>
                                        <td className="p-4 font-semibold text-white">{product.name}</td>
                                        <td className="p-4 text-gray-400">{product.category}</td>
                                        <td className="p-4 font-mono text-white">{product.quantity}</td>
                                        <td className="p-4 font-mono text-white">
                                            {new Intl.NumberFormat('en-IN', {
                                                style: 'currency',
                                                currency: 'INR',
                                            }).format(product.price)}
                                        </td>
                                        <td className="p-4 text-gray-400">{product.supplier}</td>
                                        <td className="p-4">
                                            <span className={`px-2 py-0.5 text-[10px] uppercase tracking-tighter font-bold rounded-full ${getStatusColor(product.status)}`}>
                                                {product.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button 
                                                onClick={() => handleOpenEditModal(product)} 
                                                className="text-neon-blue hover:underline font-semibold"
                                            >
                                                Edit
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </ScrollAnimator>
            {isAddItemModalOpen && (
                <AddItemModal
                    onClose={() => setIsAddItemModalOpen(false)}
                    onAddItem={handleAddItem}
                />
            )}
            {editingProduct && (
                <EditItemModal
                    productToEdit={editingProduct}
                    onClose={handleCloseEditModal}
                    onUpdateItem={handleUpdateItem}
                />
            )}
            {isAIModalOpen && (
                <AIAnalystModal
                    onClose={() => setIsAIModalOpen(false)}
                />
            )}
        </div>
    );
};

export default InventoryPage;
