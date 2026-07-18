import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  updateDoc,
} from 'firebase/firestore'
import './App.css'
import { auth, db, firebaseConfigError } from './firebase'
import { getSubscriptionState, subscriptionCheckoutUrl } from './lib/billing'

const LANDING_URL = (import.meta.env.VITE_LANDING_APP_URL || '').replace(/\/$/, '')

const initialProducts = [
  {
    id: 1,
    producto: 'Yerba Mate Tradicional',
    ingreso: 30,
    egreso: 18,
    precio: 4500,
    categoria: 'Almacen',
    imagenUrl:
      'https://images.unsplash.com/photo-1625943555404-b80e7f2f0e88?auto=format&fit=crop&w=300&q=80',
    descripcion: 'Paquete de 1kg de yerba mate sabor tradicional.',
  },
  {
    id: 2,
    producto: 'Aceite de Oliva Extra Virgen',
    ingreso: 14,
    egreso: 6,
    precio: 9800,
    categoria: 'Despensa',
    imagenUrl:
      'https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?auto=format&fit=crop&w=300&q=80',
    descripcion: 'Botella de 500ml, primera prensada en frio.',
  },
  {
    id: 3,
    producto: 'Arroz Largo Fino',
    ingreso: 20,
    egreso: 20,
    precio: 1900,
    categoria: 'Almacen',
    imagenUrl:
      'https://images.unsplash.com/photo-1586201375761-83865001e31b?auto=format&fit=crop&w=300&q=80',
    descripcion: 'Bolsa de 1kg, ideal para guarniciones y preparaciones diarias.',
  },
]

const emptyForm = {
  producto: '',
  ingreso: '',
  egreso: '',
  precio: '',
  categoria: '',
  imagenUrl: '',
  descripcion: '',
}

const formatDate = (date = new Date()) => date.toISOString().split('T')[0]

const initialSales = []
const initialPurchases = []

const createSaleItem = () => ({
  productoId: '',
  cantidad: '1',
  precioUnitario: '',
})

const createPurchaseItem = () => ({
  productoId: '',
  cantidad: '1',
  costoUnitario: '',
})

const emptySaleForm = {
  cliente: '',
  items: [createSaleItem()],
}

const emptyPurchaseForm = {
  items: [createPurchaseItem()],
}

const getStock = (ingreso, egreso) => Math.max(0, Number(ingreso) - Number(egreso))

const getAnalisis = (stock) => {
  if (stock === 0) return 'Sin stock'
  if (stock < 10) return 'Poco stock'
  return 'Stock'
}

const formatCurrency = (value) => `$${Number(value || 0).toLocaleString('es-AR')}`

function App() {
  const { slug: slugParam } = useParams()
  const [products, setProducts] = useState([])
  const [sales, setSales] = useState(initialSales)
  const [purchases, setPurchases] = useState(initialPurchases)
  const [form, setForm] = useState(emptyForm)
  const [saleForm, setSaleForm] = useState(emptySaleForm)
  const [purchaseForm, setPurchaseForm] = useState(emptyPurchaseForm)
  const [editingId, setEditingId] = useState(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaleFormOpen, setIsSaleFormOpen] = useState(false)
  const [isPurchaseFormOpen, setIsPurchaseFormOpen] = useState(false)
  const [isNavOpen, setIsNavOpen] = useState(false)
  const [activeView, setActiveView] = useState('stock')
  const [saleDate, setSaleDate] = useState(formatDate())
  const [purchaseDate, setPurchaseDate] = useState(formatDate())
  const [user, setUser] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authError, setAuthError] = useState('')
  const [businessId, setBusinessId] = useState(null)
  const [businessName, setBusinessName] = useState('')
  const [subscription, setSubscription] = useState({ active: true, label: '', status: 'trial' })
  const [tenantError, setTenantError] = useState('')
  const [tenantLoading, setTenantLoading] = useState(false)

  const title = editingId ? 'Editar producto' : 'Agregar producto'
  const buttonLabel = editingId ? 'Guardar cambios' : 'Agregar producto'

  const salesByProduct = useMemo(() => {
    const map = new Map()
    sales.forEach((sale) => map.set(sale.productoId, (map.get(sale.productoId) ?? 0) + sale.cantidad))
    return map
  }, [sales])

  const purchasesByProduct = useMemo(() => {
    const map = new Map()
    purchases.forEach((purchase) =>
      map.set(purchase.productoId, (map.get(purchase.productoId) ?? 0) + purchase.cantidad),
    )
    return map
  }, [purchases])

  const productsWithComputedFields = useMemo(() => {
    return products.map((product) => {
      const ingreso = product.ingreso ?? purchasesByProduct.get(product.id) ?? 0
      const egreso = product.egreso ?? salesByProduct.get(product.id) ?? 0
      const stock = product.stock ?? getStock(ingreso, egreso)
      return { ...product, ingreso, egreso, stock, analisis: getAnalisis(stock) }
    })
  }, [products, purchasesByProduct, salesByProduct])

  useEffect(() => {
    if (!auth) return undefined
    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      if (!nextUser) {
        setProducts([])
        setSales([])
        setPurchases([])
        setBusinessId(null)
        setBusinessName('')
        setTenantError('')
        setSubscription({ active: true, label: '', status: 'trial' })
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    if (!user || !db) return undefined
    let cancelled = false

    ;(async () => {
      setTenantLoading(true)
      setTenantError('')
      try {
        const userSnap = await getDoc(doc(db, 'users', user.uid))
        const profile = userSnap.exists() ? userSnap.data() : null
        let resolvedId = profile?.businessId || null

        if (slugParam) {
          if (resolvedId && resolvedId !== slugParam) {
            setTenantError('Ese link no pertenece a tu cuenta. Se cargó tu negocio.')
          } else if (!resolvedId) {
            // Legacy: allow demo-business for accounts without profile
            resolvedId = slugParam
          } else {
            resolvedId = slugParam
          }
        }

        if (!resolvedId) {
          // Compat: cuentas viejas del demo
          resolvedId = 'demo-business'
        }

        const bizSnap = await getDoc(doc(db, 'businesses', resolvedId))
        if (cancelled) return

        if (bizSnap.exists()) {
          const biz = { id: bizSnap.id, ...bizSnap.data() }
          if (biz.ownerId && biz.ownerId !== user.uid && profile?.businessId !== resolvedId) {
            setTenantError('No tenés acceso a este negocio.')
            setBusinessId(null)
            setTenantLoading(false)
            return
          }
          setBusinessName(biz.name || resolvedId)
          setSubscription(getSubscriptionState(biz))
        } else if (resolvedId === 'demo-business') {
          setBusinessName('Demo Business')
          setSubscription({ active: true, label: 'Demo', status: 'active' })
        } else {
          setTenantError('No encontramos tu negocio. Completá el onboarding en la landing.')
          setBusinessId(null)
          setTenantLoading(false)
          return
        }

        setBusinessId(resolvedId)
      } catch (e) {
        if (!cancelled) {
          setTenantError(e?.message || 'Error cargando tenant')
          setBusinessId(null)
        }
      } finally {
        if (!cancelled) setTenantLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user, slugParam])

  useEffect(() => {
    if (!user || !db || !businessId) return undefined

    const productsRef = collection(db, 'businesses', businessId, 'products')
    const salesRef = collection(db, 'businesses', businessId, 'sales')
    const purchasesRef = collection(db, 'businesses', businessId, 'purchases')

    const unsubProducts = onSnapshot(productsRef, (snapshot) => {
      const items = snapshot.docs.map((snap) => {
        const data = snap.data()
        return {
          id: snap.id,
          producto: data.title ?? '',
          categoria: data.category ?? '',
          descripcion: data.description ?? '',
          imagenUrl: data.imageUrl ?? '',
          precio: Number(data.price ?? 0),
          stock: Number(data.stock ?? 0),
          ingreso: data.ingreso != null ? Number(data.ingreso) : undefined,
          egreso: data.egreso != null ? Number(data.egreso) : undefined,
        }
      })
      setProducts(items)
    })

    const unsubSales = onSnapshot(salesRef, (snapshot) => {
      const items = snapshot.docs.map((snap) => {
        const data = snap.data()
        return {
          id: snap.id,
          fecha: data.date?.toDate ? formatDate(data.date.toDate()) : data.date ?? formatDate(),
          productoId: data.productId ?? '',
          producto: data.productTitleSnapshot ?? '',
          cantidad: Number(data.quantity ?? 0),
          cliente: data.customerName ?? '',
          precioUnitario: Number(data.unitPrice ?? 0),
          precio: Number(data.totalPrice ?? 0),
        }
      })
      setSales(items)
    })

    const unsubPurchases = onSnapshot(purchasesRef, (snapshot) => {
      const items = snapshot.docs.map((snap) => {
        const data = snap.data()
        return {
          id: snap.id,
          fecha: data.date?.toDate ? formatDate(data.date.toDate()) : data.date ?? formatDate(),
          productoId: data.productId ?? '',
          producto: data.productTitleSnapshot ?? '',
          cantidad: Number(data.quantity ?? 0),
          costoUnitario: Number(data.unitCost ?? 0),
          costo: Number(data.totalCost ?? 0),
        }
      })
      setPurchases(items)
    })

    return () => {
      unsubProducts()
      unsubSales()
      unsubPurchases()
    }
  }, [user, businessId])

  // Trial/plan vencido → suscripción (los datos en Firestore se conservan)
  useEffect(() => {
    if (!user || tenantLoading || !businessId) return
    if (subscription.active) return
    if (subscription.status === 'unknown') return

    const checkoutUrl = subscriptionCheckoutUrl(LANDING_URL)
    if (!checkoutUrl.startsWith('http')) return

    const url = `${checkoutUrl}?reason=trial_expired`
    window.location.replace(url)
  }, [user, tenantLoading, businessId, subscription.active, subscription.status])

  const assertCanWrite = () => {
    if (!subscription.active) {
      setAuthError(
        `Tu prueba terminó. Redirigiendo a suscripción… Tus datos se conservan.`,
      )
      const checkoutUrl = subscriptionCheckoutUrl(LANDING_URL)
      if (checkoutUrl.startsWith('http')) {
        window.location.replace(`${checkoutUrl}?reason=trial_expired`)
      }
      return false
    }
    if (!businessId) {
      setAuthError('No hay negocio cargado.')
      return false
    }
    return true
  }

  const dashboardMetrics = useMemo(() => {
    const totalProductos = productsWithComputedFields.length
    const stockTotal = productsWithComputedFields.reduce((acc, item) => acc + item.stock, 0)
    const productosConBajoStock = productsWithComputedFields.filter(
      (item) => item.analisis === 'Poco stock' || item.analisis === 'Sin stock',
    ).length
    const valorInventario = productsWithComputedFields.reduce(
      (acc, item) => acc + item.stock * item.precio,
      0,
    )

    return { totalProductos, stockTotal, productosConBajoStock, valorInventario }
  }, [productsWithComputedFields])

  const reportData = useMemo(() => {
    const purchaseCostByProduct = new Map()
    const purchaseQtyByProduct = new Map()
    const salesQtyByProduct = new Map()
    const revenueByProduct = new Map()

    purchases.forEach((purchase) => {
      purchaseCostByProduct.set(
        purchase.productoId,
        (purchaseCostByProduct.get(purchase.productoId) ?? 0) + purchase.costo,
      )
      purchaseQtyByProduct.set(
        purchase.productoId,
        (purchaseQtyByProduct.get(purchase.productoId) ?? 0) + purchase.cantidad,
      )
    })

    sales.forEach((sale) => {
      salesQtyByProduct.set(sale.productoId, (salesQtyByProduct.get(sale.productoId) ?? 0) + sale.cantidad)
      revenueByProduct.set(sale.productoId, (revenueByProduct.get(sale.productoId) ?? 0) + sale.precio)
    })

    const byProduct = productsWithComputedFields.map((product) => {
      const qtySold = salesQtyByProduct.get(product.id) ?? 0
      const revenue = revenueByProduct.get(product.id) ?? 0
      const purchaseQty = purchaseQtyByProduct.get(product.id) ?? 0
      const purchaseCost = purchaseCostByProduct.get(product.id) ?? 0
      const averageCost = purchaseQty > 0 ? purchaseCost / purchaseQty : 0
      const estimatedCostOfSales = averageCost * qtySold
      const estimatedProfit = revenue - estimatedCostOfSales

      return {
        ...product,
        qtySold,
        revenue,
        purchaseQty,
        purchaseCost,
        averageCost,
        estimatedProfit,
      }
    })

    const sortedBySales = [...byProduct].sort((a, b) => b.qtySold - a.qtySold)
    const sortedByProfit = [...byProduct].sort((a, b) => b.estimatedProfit - a.estimatedProfit)
    const totalRevenue = sales.reduce((acc, sale) => acc + sale.precio, 0)
    const totalCost = sales.reduce((acc, sale) => {
      const productData = byProduct.find((item) => item.id === sale.productoId)
      const averageCost = productData?.averageCost ?? 0
      return acc + averageCost * sale.cantidad
    }, 0)
    const totalEstimatedProfit = totalRevenue - totalCost
    const totalSalesCount = sales.length
    const totalUnitsSold = sales.reduce((acc, sale) => acc + sale.cantidad, 0)
    const averageTicket = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0
    const profitMargin = totalRevenue > 0 ? (totalEstimatedProfit / totalRevenue) * 100 : 0
    const inventoryCoverage =
      totalUnitsSold > 0
        ? productsWithComputedFields.reduce((acc, product) => acc + product.stock, 0) / totalUnitsSold
        : 0

    const topProduct = sortedBySales[0]
    const mostProfitableProduct = sortedByProfit[0]
    const lowStockProducts = byProduct.filter((product) => product.stock < 10)

    return {
      byProduct,
      totalRevenue,
      totalCost,
      totalEstimatedProfit,
      totalSalesCount,
      totalUnitsSold,
      averageTicket,
      profitMargin,
      inventoryCoverage,
      topProduct,
      mostProfitableProduct,
      lowStockProducts,
      topThreeSales: sortedBySales.slice(0, 3),
      topThreeProfit: sortedByProfit.slice(0, 3),
    }
  }, [productsWithComputedFields, purchases, sales])

  const resetForm = () => {
    setForm(emptyForm)
    setEditingId(null)
    setIsFormOpen(false)
  }

  const resetSaleForm = () => {
    setSaleForm(emptySaleForm)
    setSaleDate(formatDate())
    setIsSaleFormOpen(false)
  }

  const resetPurchaseForm = () => {
    setPurchaseForm(emptyPurchaseForm)
    setPurchaseDate(formatDate())
    setIsPurchaseFormOpen(false)
  }

  const handleInputChange = (event) => {
    const { name, value } = event.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!assertCanWrite()) return

    const ingreso = form.ingreso === '' ? 0 : Number(form.ingreso)
    const egreso = form.egreso === '' ? 0 : Number(form.egreso)
    const precio = Number(form.precio)

    if (
      !form.producto.trim() ||
      !form.categoria.trim() ||
      !form.descripcion.trim() ||
      !form.imagenUrl.trim() ||
      Number.isNaN(ingreso) ||
      Number.isNaN(egreso) ||
      Number.isNaN(precio) ||
      Number.isNaN(ingreso) ||
      Number.isNaN(egreso) ||
      ingreso < 0 ||
      egreso < 0 ||
      precio < 0
    ) {
      return
    }

    const normalizedProduct = {
      producto: form.producto.trim(),
      ingreso,
      egreso,
      precio,
      categoria: form.categoria.trim(),
      imagenUrl: form.imagenUrl.trim(),
      descripcion: form.descripcion.trim(),
    }

    const payload = {
      title: normalizedProduct.producto,
      category: normalizedProduct.categoria,
      description: normalizedProduct.descripcion,
      imageUrl: normalizedProduct.imagenUrl,
      price: normalizedProduct.precio,
      stock: getStock(normalizedProduct.ingreso, normalizedProduct.egreso),
      ingreso: normalizedProduct.ingreso,
      egreso: normalizedProduct.egreso,
      lowStockThreshold: 10,
      active: true,
      updatedAt: new Date(),
    }

    if (editingId) {
      await updateDoc(doc(db, 'businesses', businessId, 'products', editingId), payload)
    } else {
      await addDoc(collection(db, 'businesses', businessId, 'products'), {
        ...payload,
        createdAt: new Date(),
      })
    }

    resetForm()
  }

  const handleEdit = (product) => {
    setEditingId(product.id)
    setIsFormOpen(true)
    setForm({
      producto: product.producto,
      ingreso: String(product.ingreso),
      egreso: String(product.egreso),
      precio: String(product.precio),
      categoria: product.categoria,
      imagenUrl: product.imagenUrl,
      descripcion: product.descripcion,
    })
  }

  const handleDelete = async (id) => {
    if (!assertCanWrite()) return
    await deleteDoc(doc(db, 'businesses', businessId, 'products', id))
    if (editingId === id) {
      resetForm()
    }
  }

  const handleOpenCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setIsFormOpen(true)
  }

  const handleSaleChange = (event) => {
    const { name, value } = event.target
    setSaleForm((prev) => ({ ...prev, [name]: value }))
  }

  const handleSaleItemChange = (index, field, value) => {
    setSaleForm((prev) => {
      const nextItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item

        if (field === 'productoId') {
          const selected = productsWithComputedFields.find((product) => product.id === Number(value))
          return {
            ...item,
            productoId: value,
            precioUnitario: selected ? String(selected.precio) : '',
          }
        }

        return { ...item, [field]: value }
      })

      return { ...prev, items: nextItems }
    })
  }

  const handleAddSaleItem = () => {
    setSaleForm((prev) => ({ ...prev, items: [...prev.items, createSaleItem()] }))
  }

  const handleRemoveSaleItem = (index) => {
    setSaleForm((prev) => {
      if (prev.items.length === 1) return prev
      return { ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  const handleOpenSale = () => {
    setSaleDate(formatDate())
    setSaleForm(emptySaleForm)
    setIsSaleFormOpen(true)
  }

  const handlePurchaseItemChange = (index, field, value) => {
    setPurchaseForm((prev) => {
      const nextItems = prev.items.map((item, itemIndex) => {
        if (itemIndex !== index) return item
        return { ...item, [field]: value }
      })

      return { ...prev, items: nextItems }
    })
  }

  const handleAddPurchaseItem = () => {
    setPurchaseForm((prev) => ({ ...prev, items: [...prev.items, createPurchaseItem()] }))
  }

  const handleRemovePurchaseItem = (index) => {
    setPurchaseForm((prev) => {
      if (prev.items.length === 1) return prev
      return { ...prev, items: prev.items.filter((_, itemIndex) => itemIndex !== index) }
    })
  }

  const handleOpenPurchase = () => {
    setPurchaseDate(formatDate())
    setPurchaseForm(emptyPurchaseForm)
    setIsPurchaseFormOpen(true)
  }

  const handleSubmitSale = async (event) => {
    event.preventDefault()
    if (!assertCanWrite()) return

    if (!saleForm.cliente.trim()) return

    const stockByProductId = new Map(productsWithComputedFields.map((product) => [product.id, product.stock]))
    const quantityByProductId = new Map()
    const saleRecords = []

    for (const item of saleForm.items) {
      const selected = productsWithComputedFields.find((product) => product.id === item.productoId)
      const cantidad = Number(item.cantidad)
      if (!selected || Number.isNaN(cantidad) || cantidad <= 0) {
        return
      }

      const current = quantityByProductId.get(selected.id) ?? 0
      const nextRequested = current + cantidad
      if (nextRequested > (stockByProductId.get(selected.id) ?? 0)) {
        return
      }

      quantityByProductId.set(selected.id, nextRequested)
      saleRecords.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        fecha: saleDate,
        productoId: selected.id,
        producto: selected.producto,
        cantidad,
        cliente: saleForm.cliente.trim(),
        precioUnitario: selected.precio,
        precio: selected.precio * cantidad,
      })
    }

    await runTransaction(db, async (transaction) => {
      const salesRef = collection(db, 'businesses', businessId, 'sales')
      const uniqueProductIds = [...new Set(saleRecords.map((record) => record.productoId))]
      const productRefs = new Map(
        uniqueProductIds.map((productId) => [
          productId,
          doc(db, 'businesses', businessId, 'products', productId),
        ]),
      )

      const productSnapshots = await Promise.all(
        uniqueProductIds.map((productId) => transaction.get(productRefs.get(productId))),
      )

      const productDataById = new Map()
      productSnapshots.forEach((snap, index) => {
        if (!snap.exists()) throw new Error('Producto inexistente.')
        productDataById.set(uniqueProductIds[index], snap.data())
      })

      for (const record of saleRecords) {
        const current = productDataById.get(record.productoId)
        const newStock = Number(current.stock ?? 0) - record.cantidad
        if (newStock < 0) throw new Error('Stock insuficiente.')

        productDataById.set(record.productoId, {
          ...current,
          stock: newStock,
          egreso: Number(current.egreso ?? 0) + record.cantidad,
        })

        transaction.set(doc(salesRef), {
          date: new Date(record.fecha),
          productId: record.productoId,
          productTitleSnapshot: record.producto,
          quantity: record.cantidad,
          customerName: record.cliente,
          unitPrice: record.precioUnitario,
          totalPrice: record.precio,
          createdAt: new Date(),
          createdBy: user?.uid ?? null,
        })
      }

      uniqueProductIds.forEach((productId) => {
        const latest = productDataById.get(productId)
        transaction.update(productRefs.get(productId), {
          stock: Number(latest.stock ?? 0),
          egreso: Number(latest.egreso ?? 0),
          updatedAt: new Date(),
        })
      })
    })

    resetSaleForm()
  }

  const handleSubmitPurchase = async (event) => {
    event.preventDefault()
    if (!assertCanWrite()) return

    const quantityByProductId = new Map()
    const purchaseRecords = []

    for (const item of purchaseForm.items) {
      const selected = productsWithComputedFields.find((product) => product.id === item.productoId)
      const cantidad = Number(item.cantidad)
      const costoUnitario = Number(item.costoUnitario)

      if (
        !selected ||
        Number.isNaN(cantidad) ||
        Number.isNaN(costoUnitario) ||
        cantidad <= 0 ||
        costoUnitario <= 0
      ) {
        return
      }

      quantityByProductId.set(selected.id, (quantityByProductId.get(selected.id) ?? 0) + cantidad)
      purchaseRecords.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        fecha: purchaseDate,
        productoId: selected.id,
        producto: selected.producto,
        cantidad,
        costoUnitario,
        costo: costoUnitario * cantidad,
      })
    }

    await runTransaction(db, async (transaction) => {
      const purchasesRef = collection(db, 'businesses', businessId, 'purchases')
      const uniqueProductIds = [...new Set(purchaseRecords.map((record) => record.productoId))]
      const productRefs = new Map(
        uniqueProductIds.map((productId) => [
          productId,
          doc(db, 'businesses', businessId, 'products', productId),
        ]),
      )

      const productSnapshots = await Promise.all(
        uniqueProductIds.map((productId) => transaction.get(productRefs.get(productId))),
      )

      const productDataById = new Map()
      productSnapshots.forEach((snap, index) => {
        if (!snap.exists()) throw new Error('Producto inexistente.')
        productDataById.set(uniqueProductIds[index], snap.data())
      })

      for (const record of purchaseRecords) {
        const current = productDataById.get(record.productoId)
        const newStock = Number(current.stock ?? 0) + record.cantidad

        productDataById.set(record.productoId, {
          ...current,
          stock: newStock,
          ingreso: Number(current.ingreso ?? 0) + record.cantidad,
        })

        transaction.set(doc(purchasesRef), {
          date: new Date(record.fecha),
          productId: record.productoId,
          productTitleSnapshot: record.producto,
          quantity: record.cantidad,
          unitCost: record.costoUnitario,
          totalCost: record.costo,
          createdAt: new Date(),
          createdBy: user?.uid ?? null,
        })
      }

      uniqueProductIds.forEach((productId) => {
        const latest = productDataById.get(productId)
        transaction.update(productRefs.get(productId), {
          stock: Number(latest.stock ?? 0),
          ingreso: Number(latest.ingreso ?? 0),
          updatedAt: new Date(),
        })
      })
    })

    resetPurchaseForm()
  }

  const handleLogin = async (event) => {
    event.preventDefault()
    setAuthError('')
    if (!auth) {
      setAuthError('Firebase no esta configurado en este entorno.')
      return
    }
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (error) {
      setAuthError('No se pudo iniciar sesion. Revisa email y password.')
    }
  }

  return (
    <main className="page">
      {firebaseConfigError && (
        <section className="card auth-card">
          <h2>Falta configuracion de Firebase</h2>
          <p className="section-help">
            Esta app necesita variables de entorno en el hosting para funcionar.
          </p>
          <p className="stock-note">{firebaseConfigError}</p>
        </section>
      )}

      {firebaseConfigError ? null : (
        <>
      {!user && (
        <section className="card auth-card">
          <h2>Iniciar sesion</h2>
          <p className="section-help">
            Usá la misma cuenta que creaste en la landing Ordino.
            {LANDING_URL ? (
              <>
                {' '}
                <a href={`${LANDING_URL}/register`} target="_blank" rel="noreferrer">
                  Crear cuenta
                </a>
              </>
            ) : null}
          </p>
          <form className="product-form auth-form" onSubmit={handleLogin}>
            <label>
              Email
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            {authError && <p className="stock-note full-width">{authError}</p>}
            <div className="form-actions full-width">
              <button type="submit" className="btn btn-primary">
                Entrar
              </button>
            </div>
          </form>
        </section>
      )}

      {!user ? null : (
        <>
      {tenantLoading && (
        <section className="card">
          <p className="section-help">Cargando tu negocio…</p>
        </section>
      )}
      {tenantError && (
        <section className="card">
          <p className="stock-note">{tenantError}</p>
          {LANDING_URL ? (
            <p className="section-help">
              <a href={`${LANDING_URL}/onboarding`}>Completar onboarding</a>
            </p>
          ) : null}
        </section>
      )}
      {!subscription.active && !tenantLoading && businessId && (
        <section className="card">
          <p className="stock-note">
            Tu prueba terminó. Te estamos llevando a suscribirte. Tu stock y tu tienda se
            conservan.
          </p>
        </section>
      )}
      {subscription.active && subscription.status === 'trial' && subscription.daysLeft != null && (
        <section className="card trial-banner">
          <p className="section-help" style={{ margin: 0 }}>
            {subscription.daysLeft === 0
              ? 'Tu prueba termina hoy.'
              : subscription.daysLeft === 1
                ? 'Te queda 1 día de prueba.'
                : `Te quedan ${subscription.daysLeft} días de prueba.`}{' '}
            Después: USD 4.99 / mes.
            {LANDING_URL ? (
              <>
                {' '}
                <a href={`${LANDING_URL}/dashboard`}>Ver suscripción</a>
              </>
            ) : null}
          </p>
        </section>
      )}
      <nav className="top-nav" aria-label="Navegacion principal">
        <div className="brand">
          {businessName ? `Stock · ${businessName}` : 'Stock Ordino'}
          {subscription.active && subscription.status === 'trial' && subscription.daysLeft != null ? (
            <span className="trial-pill">
              {subscription.daysLeft}d prueba
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="menu-toggle"
          aria-label="Abrir menu de navegacion"
          onClick={() => setIsNavOpen((prev) => !prev)}
        >
          Menu
        </button>
        <div className={`nav-links ${isNavOpen ? 'open' : ''}`}>
          <button
            type="button"
            className={`nav-item ${activeView === 'stock' ? 'active' : ''}`}
            onClick={() => setActiveView('stock')}
          >
            Stock
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'ventas' ? 'active' : ''}`}
            onClick={() => setActiveView('ventas')}
          >
            Ventas
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'compras' ? 'active' : ''}`}
            onClick={() => setActiveView('compras')}
          >
            Compras
          </button>
          <button
            type="button"
            className={`nav-item ${activeView === 'reportes' ? 'active' : ''}`}
            onClick={() => setActiveView('reportes')}
          >
            Reportes
          </button>
        </div>
        <div className="nav-user">
          <span className="nav-user-email">{user.email}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => signOut(auth)}>
            Salir
          </button>
        </div>
      </nav>

      <header className="page-header">
        <h1>
          {activeView === 'ventas'
            ? 'Hoja de Ventas'
            : activeView === 'compras'
              ? 'Hoja de Compras'
              : activeView === 'reportes'
                ? 'Hoja de Reportes'
              : 'Hoja de Stock'}
        </h1>
        <p>
          {activeView === 'ventas'
            ? 'Registra ventas diarias y descuenta automaticamente el stock vendido.'
            : activeView === 'compras'
              ? 'Registra compras y aumenta automaticamente el stock de los productos.'
              : activeView === 'reportes'
                ? 'Resumen simple del negocio: ventas, ganancias estimadas y productos clave.'
            : 'Panel simple para controlar inventario, ventas y productos con reposicion pendiente.'}
        </p>
      </header>

      {activeView === 'stock' && (
        <section className="metrics-grid">
          <article className="metric-card">
            <span className="metric-label">Productos registrados</span>
            <strong>{dashboardMetrics.totalProductos}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">Unidades en stock</span>
            <strong>{dashboardMetrics.stockTotal}</strong>
          </article>
          <article className="metric-card warning">
            <span className="metric-label">Productos con alerta</span>
            <strong>{dashboardMetrics.productosConBajoStock}</strong>
          </article>
          <article className="metric-card">
            <span className="metric-label">Valor estimado del inventario</span>
            <strong>${dashboardMetrics.valorInventario.toLocaleString('es-AR')}</strong>
          </article>
        </section>
      )}

      {activeView === 'stock' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Stock de productos</h2>
              <p className="section-help">Vista general del inventario con acciones rapidas.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleOpenCreate}>
              Agregar producto
            </button>
          </div>
          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Imagen</th>
                  <th>Producto</th>
                  <th>Categoria</th>
                  <th>Stock</th>
                  <th>Precio</th>
                  <th>Analisis</th>
                  <th>Descripcion</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {productsWithComputedFields.length > 0 ? (
                  productsWithComputedFields.map((product) => (
                    <tr key={product.id}>
                      <td>
                        <img
                          className="product-image"
                          src={product.imagenUrl}
                          alt={product.producto}
                          loading="lazy"
                        />
                      </td>
                      <td>{product.producto}</td>
                      <td>{product.categoria}</td>
                      <td>{product.stock}</td>
                      <td>${product.precio.toLocaleString('es-AR')}</td>
                      <td>
                        <span className={`badge ${product.analisis.replace(' ', '-').toLowerCase()}`}>
                          {product.analisis}
                        </span>
                      </td>
                      <td className="description-cell">{product.descripcion}</td>
                      <td>
                        <div className="action-buttons">
                          <button type="button" className="btn btn-secondary" onClick={() => handleEdit(product)}>
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger"
                            onClick={() => handleDelete(product.id)}
                          >
                            Borrar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="8" className="empty-cell">
                      No hay productos cargados. Pulsa "Agregar producto" para comenzar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mobile-products">
            {productsWithComputedFields.length > 0 ? (
              productsWithComputedFields.map((product) => (
                <article key={product.id} className="mobile-product-card">
                  <div className="mobile-product-header">
                    <img className="product-image" src={product.imagenUrl} alt={product.producto} loading="lazy" />
                    <div>
                      <h3>{product.producto}</h3>
                      <p>{product.categoria}</p>
                    </div>
                  </div>
                  <p className="mobile-description description-cell">{product.descripcion}</p>
                  <div className="mobile-grid">
                    <span>Stock: {product.stock}</span>
                    <span>Precio: ${product.precio.toLocaleString('es-AR')}</span>
                  </div>
                  <div className="mobile-footer">
                    <span className={`badge ${product.analisis.replace(' ', '-').toLowerCase()}`}>
                      {product.analisis}
                    </span>
                    <div className="action-buttons">
                      <button type="button" className="btn btn-secondary" onClick={() => handleEdit(product)}>
                        Editar
                      </button>
                      <button type="button" className="btn btn-danger" onClick={() => handleDelete(product.id)}>
                        Borrar
                      </button>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-cell">No hay productos cargados. Pulsa "Agregar producto" para comenzar.</p>
            )}
          </div>
        </section>
      )}

      {activeView === 'ventas' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Registro de ventas</h2>
              <p className="section-help">Cada venta descuenta automaticamente el stock del producto.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleOpenSale}>
              Agregar venta
            </button>
          </div>
          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Cliente</th>
                  <th>Precio</th>
                </tr>
              </thead>
              <tbody>
                {sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>{sale.fecha}</td>
                      <td>{sale.producto}</td>
                      <td>{sale.cantidad}</td>
                      <td>{sale.cliente}</td>
                      <td>${sale.precio.toLocaleString('es-AR')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-cell">
                      No hay ventas registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mobile-products">
            {sales.length > 0 ? (
              sales.map((sale) => (
                <article key={sale.id} className="mobile-product-card">
                  <div className="mobile-product-header">
                    <div>
                      <h3>{sale.producto}</h3>
                      <p>{sale.fecha}</p>
                    </div>
                  </div>
                  <div className="mobile-grid">
                    <span>Cantidad: {sale.cantidad}</span>
                    <span>Cliente: {sale.cliente}</span>
                    <span>Precio: ${sale.precio.toLocaleString('es-AR')}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-cell">No hay ventas registradas.</p>
            )}
          </div>
        </section>
      )}

      {activeView === 'compras' && (
        <section className="card">
          <div className="card-header">
            <div>
              <h2>Registro de compras</h2>
              <p className="section-help">Cada compra suma stock al producto seleccionado.</p>
            </div>
            <button type="button" className="btn btn-primary" onClick={handleOpenPurchase}>
              Agregar compra
            </button>
          </div>
          <div className="table-wrap desktop-table">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Producto</th>
                  <th>Cantidad</th>
                  <th>Costo</th>
                </tr>
              </thead>
              <tbody>
                {purchases.length > 0 ? (
                  purchases.map((purchase) => (
                    <tr key={purchase.id}>
                      <td>{purchase.fecha}</td>
                      <td>{purchase.producto}</td>
                      <td>{purchase.cantidad}</td>
                      <td>${purchase.costo.toLocaleString('es-AR')}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="4" className="empty-cell">
                      No hay compras registradas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="mobile-products">
            {purchases.length > 0 ? (
              purchases.map((purchase) => (
                <article key={purchase.id} className="mobile-product-card">
                  <div className="mobile-product-header">
                    <div>
                      <h3>{purchase.producto}</h3>
                      <p>{purchase.fecha}</p>
                    </div>
                  </div>
                  <div className="mobile-grid">
                    <span>Cantidad: {purchase.cantidad}</span>
                    <span>Costo: ${purchase.costo.toLocaleString('es-AR')}</span>
                  </div>
                </article>
              ))
            ) : (
              <p className="empty-cell">No hay compras registradas.</p>
            )}
          </div>
        </section>
      )}

      {activeView === 'reportes' && (
        <>
          <section className="card">
            <h2>Resumen ejecutivo</h2>
            <p className="section-help">Los 4 numeros clave para saber si el negocio va bien.</p>
            <div className="report-kpi-grid">
              <article className="metric-card">
                <span className="metric-label">Ingresos por ventas</span>
                <strong>{formatCurrency(reportData.totalRevenue)}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">Ganancia estimada</span>
                <strong>{formatCurrency(reportData.totalEstimatedProfit)}</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">Margen estimado</span>
                <strong>{reportData.profitMargin.toFixed(1)}%</strong>
              </article>
              <article className="metric-card">
                <span className="metric-label">Ticket promedio</span>
                <strong>{formatCurrency(reportData.averageTicket)}</strong>
              </article>
            </div>
          </section>

          <section className="card">
            <h2>Ventas y clientes</h2>
            <p className="section-help">Cuanto vendiste, cuantos movimientos hubo y que producto lidera.</p>
            <div className="report-grid">
              <article className="report-box">
                <p className="report-box-title">Ventas registradas</p>
                <p className="report-main">{reportData.totalSalesCount}</p>
              </article>
              <article className="report-box">
                <p className="report-box-title">Unidades vendidas</p>
                <p className="report-main">{reportData.totalUnitsSold}</p>
              </article>
              <article className="report-box">
                <p className="report-box-title">Producto estrella</p>
                <p className="report-main">{reportData.topProduct ? reportData.topProduct.producto : 'Sin datos'}</p>
                {reportData.topProduct && (
                  <p className="section-help">{reportData.topProduct.qtySold} unidades vendidas.</p>
                )}
              </article>
            </div>
          </section>

          <section className="card">
            <h2>Rentabilidad por producto</h2>
            <p className="section-help">Que productos dejan mas ganancia para priorizar compras y promociones.</p>
            <div className="report-grid">
              <article>
                <h3 className="subsection-title">Top 3 por ganancia estimada</h3>
                <ul className="report-list">
                  {reportData.topThreeProfit.map((product) => (
                    <li key={`profit-${product.id}`}>
                      <span>{product.producto}</span>
                      <strong>{formatCurrency(product.estimatedProfit)}</strong>
                    </li>
                  ))}
                  {reportData.topThreeProfit.length === 0 && (
                    <li className="empty-cell">Sin datos de rentabilidad.</li>
                  )}
                </ul>
              </article>
              <article>
                <h3 className="subsection-title">Top 3 por ventas</h3>
                <ul className="report-list">
                  {reportData.topThreeSales.map((product) => (
                    <li key={`sales-${product.id}`}>
                      <span>{product.producto}</span>
                      <strong>{product.qtySold} uds</strong>
                    </li>
                  ))}
                  {reportData.topThreeSales.length === 0 && <li className="empty-cell">Sin datos de ventas.</li>}
                </ul>
              </article>
            </div>
          </section>

          <section className="card">
            <h2>Inventario y reposicion</h2>
            <p className="section-help">Controla riesgo de quiebre de stock y salud del inventario.</p>
            <div className="report-grid compact">
              <article className="report-box">
                <p className="report-box-title">Productos con alerta</p>
                <p className="report-main">{reportData.lowStockProducts.length}</p>
              </article>
              <article className="report-box">
                <p className="report-box-title">Cobertura de stock</p>
                <p className="report-main">
                  {reportData.inventoryCoverage > 0 ? reportData.inventoryCoverage.toFixed(1) : 0}x
                </p>
                <p className="section-help">Stock disponible vs unidades vendidas.</p>
              </article>
            </div>
            <div className="table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Stock actual</th>
                    <th>Estado</th>
                    <th>Sugerencia</th>
                  </tr>
                </thead>
                <tbody>
                  {reportData.lowStockProducts.length > 0 ? (
                    reportData.lowStockProducts.map((product) => (
                      <tr key={`low-${product.id}`}>
                        <td>{product.producto}</td>
                        <td>{product.stock}</td>
                        <td>
                          <span className={`badge ${product.analisis.replace(' ', '-').toLowerCase()}`}>
                            {product.analisis}
                          </span>
                        </td>
                        <td>{product.stock === 0 ? 'Comprar urgente' : 'Programar reposicion'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="empty-cell">
                        No hay alertas de stock. Excelente trabajo.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {isFormOpen && (
        <div className="modal-backdrop" onClick={resetForm} role="presentation">
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>{title}</h2>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Cerrar
              </button>
            </div>
            <form className="product-form" onSubmit={handleSubmit}>
              <label>
                Producto
                <input name="producto" value={form.producto} onChange={handleInputChange} required />
              </label>
              <label>
                Categoria
                <input name="categoria" value={form.categoria} onChange={handleInputChange} required />
              </label>
              <label>
                Ingreso (cantidad comprada)
                <input
                  name="ingreso"
                  type="number"
                  min="0"
                  value={form.ingreso}
                  onChange={handleInputChange}
                />
              </label>
              <label>
                Egreso (cantidad vendida)
                <input
                  name="egreso"
                  type="number"
                  min="0"
                  value={form.egreso}
                  onChange={handleInputChange}
                />
              </label>
              <label>
                Precio
                <input
                  name="precio"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.precio}
                  onChange={handleInputChange}
                  required
                />
              </label>
              <label className="full-width">
                ImagenURL
                <input name="imagenUrl" value={form.imagenUrl} onChange={handleInputChange} required />
              </label>
              <label className="full-width">
                Descripcion
                <textarea
                  name="descripcion"
                  value={form.descripcion}
                  onChange={handleInputChange}
                  rows="3"
                  required
                />
              </label>

              <div className="form-actions full-width">
                <button type="submit" className="btn btn-primary">
                  {buttonLabel}
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isSaleFormOpen && (
        <div className="modal-backdrop" onClick={resetSaleForm} role="presentation">
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Agregar venta</h2>
              <button type="button" className="btn btn-secondary" onClick={resetSaleForm}>
                Cerrar
              </button>
            </div>
            <form className="product-form" onSubmit={handleSubmitSale}>
              <label>
                Fecha
                <input value={saleDate} readOnly />
              </label>
              <label>
                Cliente
                <input name="cliente" value={saleForm.cliente} onChange={handleSaleChange} required />
              </label>
              <div className="full-width sale-items">
                {saleForm.items.map((item, index) => {
                  const selected = productsWithComputedFields.find((product) => product.id === item.productoId)
                  const unitPrice = selected ? selected.precio : 0
                  const quantity = Number(item.cantidad) || 0
                  const totalPrice = unitPrice * quantity

                  return (
                    <div key={`sale-item-${index}`} className="sale-item-row">
                      <label>
                        Producto
                        <select
                          value={item.productoId}
                          onChange={(event) =>
                            handleSaleItemChange(index, 'productoId', event.target.value)
                          }
                          required
                        >
                          <option value="">Seleccionar producto</option>
                          {productsWithComputedFields.map((product) => (
                            <option key={product.id} value={product.id} disabled={product.stock === 0}>
                              {product.producto} ({product.stock} disponibles)
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Cantidad
                        <input
                          type="number"
                          min="1"
                          max={selected ? selected.stock : undefined}
                          value={item.cantidad}
                          onChange={(event) => handleSaleItemChange(index, 'cantidad', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Precio unitario
                        <input value={unitPrice ? `$${unitPrice.toLocaleString('es-AR')}` : ''} readOnly />
                      </label>
                      <label>
                        Precio total
                        <input value={totalPrice ? `$${totalPrice.toLocaleString('es-AR')}` : ''} readOnly />
                      </label>
                      <div className="sale-item-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleRemoveSaleItem(index)}
                          disabled={saleForm.items.length === 1}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button type="button" className="btn btn-secondary add-line-btn" onClick={handleAddSaleItem}>
                  Agregar otro producto
                </button>
              </div>
              <div className="form-actions full-width">
                <button type="submit" className="btn btn-primary">
                  Guardar venta
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetSaleForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isPurchaseFormOpen && (
        <div className="modal-backdrop" onClick={resetPurchaseForm} role="presentation">
          <section className="modal-card" onClick={(event) => event.stopPropagation()}>
            <div className="card-header">
              <h2>Agregar compra</h2>
              <button type="button" className="btn btn-secondary" onClick={resetPurchaseForm}>
                Cerrar
              </button>
            </div>
            <form className="product-form" onSubmit={handleSubmitPurchase}>
              <label>
                Fecha
                <input value={purchaseDate} readOnly />
              </label>
              <div className="full-width sale-items">
                {purchaseForm.items.map((item, index) => {
                  const quantity = Number(item.cantidad) || 0
                  const unitCost = Number(item.costoUnitario) || 0
                  const totalCost = quantity * unitCost

                  return (
                    <div key={`purchase-item-${index}`} className="sale-item-row">
                      <label>
                        Producto
                        <select
                          value={item.productoId}
                          onChange={(event) =>
                            handlePurchaseItemChange(index, 'productoId', event.target.value)
                          }
                          required
                        >
                          <option value="">Seleccionar producto</option>
                          {productsWithComputedFields.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.producto}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Cantidad
                        <input
                          type="number"
                          min="1"
                          step="1"
                          value={item.cantidad}
                          onChange={(event) => handlePurchaseItemChange(index, 'cantidad', event.target.value)}
                          required
                        />
                      </label>
                      <label>
                        Costo unitario
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.costoUnitario}
                          onChange={(event) =>
                            handlePurchaseItemChange(index, 'costoUnitario', event.target.value)
                          }
                          required
                        />
                      </label>
                      <label>
                        Costo
                        <input value={totalCost ? `$${totalCost.toLocaleString('es-AR')}` : ''} readOnly />
                      </label>
                      <div className="sale-item-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => handleRemovePurchaseItem(index)}
                          disabled={purchaseForm.items.length === 1}
                        >
                          Quitar
                        </button>
                      </div>
                    </div>
                  )
                })}
                <button type="button" className="btn btn-secondary add-line-btn" onClick={handleAddPurchaseItem}>
                  Agregar otro producto
                </button>
              </div>
              <div className="form-actions full-width">
                <button type="submit" className="btn btn-primary">
                  Guardar compra
                </button>
                <button type="button" className="btn btn-secondary" onClick={resetPurchaseForm}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
        </>
      )}
        </>
      )}
    </main>
  )
}

export default App
