import { config } from 'dotenv'
import { initializeApp } from 'firebase/app'
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth'
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  Timestamp,
  writeBatch,
} from 'firebase/firestore'

const requiredEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'SEED_FIREBASE_EMAIL',
  'SEED_FIREBASE_PASSWORD',
]

config({ path: '.env.local' })

for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Falta variable de entorno: ${key}`)
    process.exit(1)
  }
}

const app = initializeApp({
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
})

const auth = getAuth(app)
const db = getFirestore(app)

const businessId = 'demo-business'
const now = Timestamp.now()

const products = [
  {
    id: 'yerba-mate-tradicional',
    title: 'Yerba Mate Tradicional',
    category: 'Almacen',
    description: 'Paquete de 1kg de yerba mate sabor tradicional.',
    imageUrl:
      'https://images.unsplash.com/photo-1625943555404-b80e7f2f0e88?auto=format&fit=crop&w=300&q=80',
    price: 4500,
    stock: 12,
    lowStockThreshold: 10,
    active: true,
  },
  {
    id: 'aceite-oliva-extra-virgen',
    title: 'Aceite de Oliva Extra Virgen',
    category: 'Despensa',
    description: 'Botella de 500ml, primera prensada en frio.',
    imageUrl:
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
    price: 9800,
    stock: 8,
    lowStockThreshold: 10,
    active: true,
  },
  {
    id: 'arroz-largo-fino',
    title: 'Arroz Largo Fino',
    category: 'Almacen',
    description: 'Bolsa de 1kg, ideal para guarniciones y preparaciones diarias.',
    imageUrl:
      'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=300&q=80',
    price: 1900,
    stock: 0,
    lowStockThreshold: 10,
    active: true,
  },
]

const purchases = [
  {
    id: 'purchase-1',
    date: Timestamp.fromDate(new Date('2026-04-10')),
    productId: 'yerba-mate-tradicional',
    productTitleSnapshot: 'Yerba Mate Tradicional',
    quantity: 30,
    unitCost: 2800,
    totalCost: 84000,
    createdAt: now,
  },
  {
    id: 'purchase-2',
    date: Timestamp.fromDate(new Date('2026-04-11')),
    productId: 'aceite-oliva-extra-virgen',
    productTitleSnapshot: 'Aceite de Oliva Extra Virgen',
    quantity: 14,
    unitCost: 6200,
    totalCost: 86800,
    createdAt: now,
  },
  {
    id: 'purchase-3',
    date: Timestamp.fromDate(new Date('2026-04-12')),
    productId: 'arroz-largo-fino',
    productTitleSnapshot: 'Arroz Largo Fino',
    quantity: 20,
    unitCost: 1200,
    totalCost: 24000,
    createdAt: now,
  },
]

const sales = [
  {
    id: 'sale-1',
    date: now,
    productId: 'yerba-mate-tradicional',
    productTitleSnapshot: 'Yerba Mate Tradicional',
    quantity: 2,
    customerName: 'Cliente mostrador',
    unitPrice: 4500,
    totalPrice: 9000,
    createdAt: now,
  },
]

async function clearCollection(collectionRef) {
  const snap = await getDocs(collectionRef)
  if (snap.empty) return
  const batch = writeBatch(db)
  snap.forEach((item) => batch.delete(item.ref))
  await batch.commit()
}

async function seed() {
  await signInWithEmailAndPassword(
    auth,
    process.env.SEED_FIREBASE_EMAIL,
    process.env.SEED_FIREBASE_PASSWORD,
  )

  const businessRef = doc(db, 'businesses', businessId)
  const productsRef = collection(db, 'businesses', businessId, 'products')
  const salesRef = collection(db, 'businesses', businessId, 'sales')
  const purchasesRef = collection(db, 'businesses', businessId, 'purchases')

  await setDoc(
    businessRef,
    {
      name: 'Demo Business',
      ownerEmail: process.env.SEED_FIREBASE_EMAIL,
      createdAt: now,
      updatedAt: now,
    },
    { merge: true },
  )

  await clearCollection(productsRef)
  await clearCollection(salesRef)
  await clearCollection(purchasesRef)

  for (const product of products) {
    await setDoc(doc(productsRef, product.id), {
      ...product,
      createdAt: now,
      updatedAt: now,
    })
  }

  for (const sale of sales) {
    await setDoc(doc(salesRef, sale.id), sale)
  }

  for (const purchase of purchases) {
    await setDoc(doc(purchasesRef, purchase.id), purchase)
  }

  console.log('Seed completado: businesses/demo-business + products/sales/purchases')
}

seed().catch((error) => {
  console.error('Error ejecutando seed:', error.message)
  process.exit(1)
})
