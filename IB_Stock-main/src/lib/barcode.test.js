import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBarcode,
  isValidBarcodeFormat,
  findProductByBarcode,
  findDuplicateBarcode,
  addProductToSaleItems,
  resolveSaleBarcodeScan,
} from "./barcode.js";

describe("normalizeBarcode", () => {
  it("trimea espacios", () => {
    assert.equal(normalizeBarcode("  779123  "), "779123");
  });
  it("vacío / null => string vacío", () => {
    assert.equal(normalizeBarcode(null), "");
    assert.equal(normalizeBarcode(undefined), "");
    assert.equal(normalizeBarcode(""), "");
  });
  it("no convierte a número (preserva ceros y alfanumérico)", () => {
    assert.equal(normalizeBarcode("000123"), "000123");
    assert.equal(normalizeBarcode("AB12-34"), "AB12-34");
  });
});

describe("isValidBarcodeFormat", () => {
  it("permite vacío", () => {
    assert.equal(isValidBarcodeFormat(""), true);
  });
  it("acepta EAN-13, EAN-8, Code128-ish", () => {
    assert.equal(isValidBarcodeFormat("7790001001234"), true);
    assert.equal(isValidBarcodeFormat("12345678"), true);
    assert.equal(isValidBarcodeFormat("SKU-ABC.1/2"), true);
  });
  it("rechaza espacios internos y símbolos raros", () => {
    assert.equal(isValidBarcodeFormat("12 34"), false);
    assert.equal(isValidBarcodeFormat("12@34"), false);
  });
});

const catalogA = [
  { id: "p1", producto: "Yerba", barcode: "779001", precio: 100, stock: 5 },
  { id: "p2", producto: "Aceite", barcode: null, precio: 200, stock: 3 },
];

const catalogB = [
  { id: "x1", producto: "Otro comercio", barcode: "779001", precio: 50, stock: 9 },
];

describe("findProductByBarcode", () => {
  it("encuentra por barcode", () => {
    const p = findProductByBarcode(catalogA, "779001");
    assert.equal(p.id, "p1");
  });
  it("inexistente => null", () => {
    assert.equal(findProductByBarcode(catalogA, "999"), null);
  });
});

describe("findDuplicateBarcode (mismo comercio)", () => {
  it("detecta duplicado", () => {
    const dup = findDuplicateBarcode(catalogA, "779001");
    assert.equal(dup.id, "p1");
  });
  it("permite mismo código al editar el mismo producto", () => {
    assert.equal(findDuplicateBarcode(catalogA, "779001", "p1"), null);
  });
  it("comercios distintos: no se cruzan (listas separadas)", () => {
    // Simula query ya filtrada por businessId
    assert.equal(findDuplicateBarcode(catalogA, "779001", "p1"), null);
    assert.ok(findProductByBarcode(catalogB, "779001"));
  });
});

describe("producto sin barcode", () => {
  it("crear/editar sin código no choca", () => {
    assert.equal(findDuplicateBarcode(catalogA, ""), null);
    assert.equal(isValidBarcodeFormat(""), true);
  });
});

describe("addProductToSaleItems / resolveSaleBarcodeScan", () => {
  it("agrega producto nuevo a la venta", () => {
    const items = [{ productoId: "", cantidad: "1", precioUnitario: "" }];
    const r = resolveSaleBarcodeScan(catalogA, items, "779001");
    assert.equal(r.ok, true);
    assert.equal(r.reason, "added");
    assert.equal(r.items[0].productoId, "p1");
    assert.equal(r.items[0].cantidad, "1");
  });

  it("segundo escaneo incrementa cantidad", () => {
    let items = [{ productoId: "", cantidad: "1", precioUnitario: "" }];
    items = resolveSaleBarcodeScan(catalogA, items, "779001").items;
    const r2 = resolveSaleBarcodeScan(catalogA, items, "779001");
    assert.equal(r2.ok, true);
    assert.equal(r2.reason, "incremented");
    assert.equal(r2.items[0].cantidad, "2");
  });

  it("barcode inexistente", () => {
    const r = resolveSaleBarcodeScan(catalogA, [], "000000");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "not_found");
  });

  it("respeta stock al incrementar", () => {
    const low = [{ id: "p1", barcode: "1", precio: 10, stock: 1 }];
    let items = addProductToSaleItems([], low[0]).items;
    const r = resolveSaleBarcodeScan(low, items, "1");
    assert.equal(r.ok, false);
    assert.equal(r.reason, "stock_limit");
  });
});
