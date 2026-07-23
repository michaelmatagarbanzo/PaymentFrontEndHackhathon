import type { Product } from '@/types'
import { getRandomProductIds } from '@/utils/currency'

const ALL_PRODUCTS: Omit<Product, 'cantidadPedido' | 'subTotal'>[] = [
  { id: 1, nombre: 'Audífonos',           descripcion: 'Audífonos inalámbricos',  valor: 1.02, cantidadDisponible: 10 },
  { id: 2, nombre: 'Laptop',              descripcion: 'Laptop ultrabook',         valor: 2.04, cantidadDisponible: 10 },
  { id: 3, nombre: 'Billetera',           descripcion: 'Billetera de cuero',       valor: 3.00, cantidadDisponible: 10 },
  { id: 4, nombre: 'Teléfono Celular',    descripcion: 'Smartphone Android',       valor: 4.00, cantidadDisponible: 10 },
  { id: 5, nombre: 'Mouse',               descripcion: 'Mouse óptico inalámbrico', valor: 5.00, cantidadDisponible: 10 },
  { id: 6, nombre: 'Memoria RAM',         descripcion: 'RAM DDR4 8GB',             valor: 1.06, cantidadDisponible: 10 },
  { id: 7, nombre: 'Monitor',             descripcion: 'Monitor Full HD 24"',      valor: 2.09, cantidadDisponible: 10 },
  { id: 8, nombre: 'Micro SD',            descripcion: 'Micro SD 64GB Class 10',   valor: 3.00, cantidadDisponible: 10 },
  { id: 9, nombre: 'Kingston A400 120GB', descripcion: 'SSD SATA 2.5"',            valor: 2.09, cantidadDisponible: 10 },
  { id: 10, nombre: 'Teamgroup T183 USB', descripcion: 'USB 3.1 128GB',            valor: 2.03, cantidadDisponible: 10 },
]

/**
 * Returns a random cart of products — mirrors ProductosDB.GetAll() filtered
 * by getListId() (which picks 3 random IDs from 1–3).
 */
export function getRandomCart(): Product[] {
  const ids = getRandomProductIds()

  return ALL_PRODUCTS.filter((p) => ids.includes(p.id)).map((p) => {
    const cantidadPedido = Math.floor(Math.random() * 3) + 1
    return {
      ...p,
      cantidadPedido,
      subTotal: cantidadPedido * p.valor,
    }
  })
}
