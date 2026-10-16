import { IMPORT_PLACEHOLDER_IMAGE } from './productImport.js'

/**
 * Datos recomendados que se pueden completar después.
 * No incluye código de barras: es opcional y no debe verse como deuda.
 * No hay costo ni SKU en el producto.
 * Nombre, precio y stock son los datos para operar: no se listan acá.
 */
const RECOMMENDED = [
  { key: 'image', label: 'Falta imagen' },
  { key: 'description', label: 'Falta descripción' },
  { key: 'category', label: 'Falta categoría' },
]

function clean(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function sameText(a, b) {
  return clean(a).toLocaleLowerCase('es') === clean(b).toLocaleLowerCase('es')
}

function productName(product) {
  return clean(product?.producto || product?.title)
}

function productImage(product) {
  return clean(product?.imagenUrl || product?.imageUrl)
}

function productDescription(product) {
  return clean(product?.descripcion || product?.description)
}

function productCategory(product) {
  return clean(product?.categoria || product?.category)
}

function missingKeys(product) {
  const missing = []
  const image = productImage(product)
  const name = productName(product)
  const description = productDescription(product)
  const category = productCategory(product)

  if (!image || image === IMPORT_PLACEHOLDER_IMAGE) missing.push('image')
  if (!description || sameText(description, 'Sin descripción') || (name && sameText(description, name))) {
    missing.push('description')
  }
  if (!category) missing.push('category')
  return missing
}

export function getProductCompletionStatus(product) {
  const missing = missingKeys(product)
  const items = RECOMMENDED.filter((field) => missing.includes(field.key))
  return {
    show: items.length > 0,
    count: items.length,
    missing: items,
  }
}
