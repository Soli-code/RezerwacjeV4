export interface Equipment {
  id?: string;
  name: string;
  description: string;
  price: number;
  promotional_price?: number;
  deposit: number;
  image: string;
  categories: string[];
  quantity: number;
  purchase_date?: string;
  purchase_price?: number;
  specifications?: Array<{
    id: string;
    name: string;
    value: string;
    equipment_id: string;
  }>;
  features?: Array<{
    id: string;
    name: string;
    equipment_id: string;
  }>;
  variants?: Array<{
    id: string;
    name: string;
    equipment_id: string;
  }>;
}

export interface ProductFormProps {
  product?: Equipment;
  onSave: (product: Equipment) => void;
  onCancel: () => void;
} 