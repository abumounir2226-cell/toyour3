"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Header from "@/app/components/Header";
import ProductCard from "@/app/components/ProductCard";
import { useCart } from "../../../context/CartContext";

interface Product {
  modelId: string;
  price: number;
  category: string;
  description: string;
  master_code?: string;
  item_code?: string;
  variants: Array<{
    id: string;
    color: string;
    imageUrl: string;
    sizes: string[];
    cur_qty?: number;
    stor_id?: number;
    itemCode?: string;
    sizeItemCodes?: { [size: string]: string };
    sizeQuantities?: { [size: string]: number };
    totalColorQuantity?: number;
  }>;
  cur_qty?: number;
  stor_id?: number;
}

interface QuantityData {
  [modelId: string]: {
    [color: string]: {
      totalQty: number;
      sizes: { [size: string]: number };
      itemCodes: { [size: string]: string };
    };
  };
}

export default function ProductDetail() {
  const params = useParams();
  const productId = params.id as string;
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("");
  const [selectedSize, setSelectedSize] = useState<string>("");
  const [quantity, setQuantity] = useState(1);
  const [similarProducts, setSimilarProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [employeeQuantities, setEmployeeQuantities] = useState<QuantityData>(
    {}
  );

  // ✅ التحقق من حالة الموظف
  const isEmployee = () => {
    try {
      const employee = localStorage.getItem("employee");
      const employeeToken = localStorage.getItem("employeeToken");
      return !!(employee && employeeToken);
    } catch (error) {
      return false;
    }
  };

  const employee = isEmployee();

  // ✅ دالة واحدة لجلب كل كميات الموظفين (بدون قيود)
  const fetchAllEmployeeQuantities = async () => {
    try {
      console.log("📥 جلب جميع كميات المخزن للموظف...");

      // ✅ محاولة جلب كل الصفحات
      let allProducts: Product[] = [];
      let page = 1;
      let hasMore = true;

      while (hasMore) {
        try {
          // ✅ إضافة معامل page أو offset إذا كان الـ API يدعمه
          const url = `/api/products/employee?page=${page}&limit=100`;
          console.log(`📄 جلب الصفحة ${page}...`);

          const response = await fetch(url);

          if (!response.ok) {
            console.warn(`⚠️ فشل جلب الصفحة ${page}: ${response.status}`);
            break;
          }

          const data = await response.json();
          const products = data.products || [];
          console.log(`📊 الصفحة ${page}: ${products.length} منتج`);

          if (products.length === 0) {
            hasMore = false;
          } else {
            allProducts = [...allProducts, ...products];
            page++;

            // ✅ إذا كنا نحصل على نفس البيانات، نتوقف
            if (products.length < 50) {
              hasMore = false;
            }
          }
        } catch (pageError) {
          console.error(`❌ خطأ في الصفحة ${page}:`, pageError);
          hasMore = false;
        }
      }

      console.log(`📦 إجمالي كميات الموظف: ${allProducts.length} منتج`);

      // ✅ إنشاء خريطة للكميات
      const quantityMap: QuantityData = {};

      allProducts.forEach((product: Product) => {
        if (!product.modelId) return;

        if (!quantityMap[product.modelId]) {
          quantityMap[product.modelId] = {};
        }

        product.variants?.forEach((variant) => {
          if (!variant.color) return;

          const colorKey = variant.color;
          if (!quantityMap[product.modelId][colorKey]) {
            quantityMap[product.modelId][colorKey] = {
              totalQty: 0,
              sizes: {},
              itemCodes: {},
            };
          }

          // تجميع الكميات
          quantityMap[product.modelId][colorKey].totalQty =
            variant.totalColorQuantity || variant.cur_qty || 0;

          // كميات المقاسات
          if (variant.sizeQuantities) {
            quantityMap[product.modelId][colorKey].sizes = {
              ...variant.sizeQuantities,
            };
          }

          // item codes للمقاسات
          if (variant.sizeItemCodes) {
            quantityMap[product.modelId][colorKey].itemCodes = {
              ...variant.sizeItemCodes,
            };
          }

          // item code عام
          if (
            variant.itemCode &&
            !quantityMap[product.modelId][colorKey].itemCodes["default"]
          ) {
            quantityMap[product.modelId][colorKey].itemCodes["default"] =
              variant.itemCode;
          }
        });
      });

      setEmployeeQuantities(quantityMap);
      console.log(
        "✅ تم تحميل جميع كميات الموظف:",
        Object.keys(quantityMap).length,
        "منتج"
      );

      return quantityMap;
    } catch (error) {
      console.error("❌ خطأ في جلب كميات الموظف:", error);

      // ✅ محاولة جلب مرة واحدة فقط
      try {
        const response = await fetch("/api/products/employee");
        if (response.ok) {
          const data = await response.json();
          const productsList = data.products || [];

          const quantityMap: QuantityData = {};

          productsList.forEach((product: Product) => {
            if (!product.modelId) return;

            if (!quantityMap[product.modelId]) {
              quantityMap[product.modelId] = {};
            }

            product.variants?.forEach((variant) => {
              if (!variant.color) return;

              const colorKey = variant.color;
              if (!quantityMap[product.modelId][colorKey]) {
                quantityMap[product.modelId][colorKey] = {
                  totalQty: 0,
                  sizes: {},
                  itemCodes: {},
                };
              }

              quantityMap[product.modelId][colorKey].totalQty =
                variant.totalColorQuantity || variant.cur_qty || 0;

              if (variant.sizeQuantities) {
                quantityMap[product.modelId][colorKey].sizes = {
                  ...variant.sizeQuantities,
                };
              }

              if (variant.sizeItemCodes) {
                quantityMap[product.modelId][colorKey].itemCodes = {
                  ...variant.sizeItemCodes,
                };
              }
            });
          });

          setEmployeeQuantities(quantityMap);
          console.log(
            "✅ تم تحميل كميات الموظف (محدودة):",
            Object.keys(quantityMap).length,
            "منتج"
          );
          return quantityMap;
        }
      } catch (fallbackError) {
        console.error("❌ فشل في جلب أي كميات:", fallbackError);
      }

      return {};
    }
  };

  // ✅ جلب تفاصيل المنتج
  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      console.log(`🔍 جلب تفاصيل المنتج: ${productId}`);
      console.log(`👤 حالة الموظف: ${employee}`);

      // ✅ إذا كان موظفاً، جلب جميع الكميات أولاً
      let quantityMap: QuantityData = {};
      if (employee) {
        console.log("👔 موظف - جلب كميات المخزن...");
        quantityMap = await fetchAllEmployeeQuantities();
      }

      // ✅ جلب كل المنتجات من getAllData
      const endpoint = "/api/getAllData";
      console.log(`🌐 جلب البيانات من: ${endpoint}`);

      const response = await fetch(endpoint);

      if (!response.ok) {
        throw new Error(`فشل في جلب البيانات: ${response.status}`);
      }

      const data = await response.json();
      const productsList: Product[] = data.products || [];
      console.log(`📦 المنتجات الأساسية: ${productsList.length} منتج`);

      // ✅ البحث عن المنتج الحالي
      let foundProduct: Product | undefined;

      // البحث بطرق مختلفة
      foundProduct = productsList.find((p) => p.modelId === productId);

      if (!foundProduct) {
        foundProduct = productsList.find((p) => p.master_code === productId);
      }

      if (!foundProduct) {
        foundProduct = productsList.find((p) => p.item_code === productId);
      }

      if (foundProduct) {
        console.log(`✅ وجدت المنتج: ${foundProduct.description}`);
        console.log(`🔍 البحث عن كميات للمنتج: ${foundProduct.modelId}`);

        // ✅ تطبيق كميات الموظف على المنتج
        let enhancedProduct = { ...foundProduct };

        if (employee && quantityMap[foundProduct.modelId]) {
          console.log("🎯 وجدت كميات الموظف لهذا المنتج");
          const productQuantities = quantityMap[foundProduct.modelId];

          enhancedProduct.variants =
            enhancedProduct.variants?.map((variant) => {
              const color = variant.color;
              const colorData = productQuantities[color];

              if (colorData) {
                return {
                  ...variant,
                  cur_qty: colorData.totalQty,
                  totalColorQuantity: colorData.totalQty,
                  sizeQuantities: { ...colorData.sizes },
                  sizeItemCodes: { ...colorData.itemCodes },
                  stor_id: colorData.totalQty > 0 ? 0 : undefined,
                };
              } else {
                console.log(`⚠️ لا توجد كميات للون: ${color}`);
                // ✅ إذا لم توجد كميات، نعرض المنتج بدون كمية
                return {
                  ...variant,
                  cur_qty: 0,
                  totalColorQuantity: 0,
                  stor_id: undefined,
                };
              }
            }) || [];
        } else if (employee) {
          console.log("⚠️ لا توجد كميات مخزن لهذا المنتج");
          // ✅ للموظفين: إذا لم توجد كميات، نعرض المنتج لكن غير متوفر
          enhancedProduct.variants =
            enhancedProduct.variants?.map((variant) => ({
              ...variant,
              cur_qty: 0,
              totalColorQuantity: 0,
              stor_id: undefined,
            })) || [];
        }

        setProduct(enhancedProduct);

        // ✅ البحث عن المنتجات المشابهة
        const similar = productsList
          .filter(
            (p) =>
              p.modelId !== enhancedProduct.modelId &&
              p.category === enhancedProduct.category
          )
          .slice(0, 4);

        // ✅ تطبيق كميات الموظف على المنتجات المشابهة
        let enhancedSimilar = similar;
        if (employee) {
          enhancedSimilar = similar.map((p) => {
            const similarQuantities = quantityMap[p.modelId];
            if (similarQuantities) {
              const enhanced = { ...p };
              enhanced.variants =
                enhanced.variants?.map((variant) => {
                  const colorData = similarQuantities[variant.color];
                  if (colorData) {
                    return {
                      ...variant,
                      cur_qty: colorData.totalQty,
                      totalColorQuantity: colorData.totalQty,
                      sizeQuantities: { ...colorData.sizes },
                      sizeItemCodes: { ...colorData.itemCodes },
                      stor_id: colorData.totalQty > 0 ? 0 : undefined,
                    };
                  }
                  return {
                    ...variant,
                    cur_qty: 0,
                    totalColorQuantity: 0,
                    stor_id: undefined,
                  };
                }) || [];
              return enhanced;
            }
            // ✅ إذا لم توجد كميات، نعرض المنتج لكن غير متوفر للموظف
            const noQtyProduct = { ...p };
            noQtyProduct.variants =
              noQtyProduct.variants?.map((variant) => ({
                ...variant,
                cur_qty: 0,
                totalColorQuantity: 0,
                stor_id: undefined,
              })) || [];
            return noQtyProduct;
          });
        }

        setSimilarProducts(enhancedSimilar);

        // ✅ تعيين القيم الافتراضية
        if (enhancedProduct.variants && enhancedProduct.variants.length > 0) {
          setSelectedColor(enhancedProduct.variants[0].color);
          if (
            enhancedProduct.variants[0].sizes &&
            enhancedProduct.variants[0].sizes.length > 0
          ) {
            setSelectedSize(enhancedProduct.variants[0].sizes[0]);
          }
        }
      } else {
        console.log(`❌ المنتج غير موجود: ${productId}`);
      }
    } catch (error) {
      console.error("❌ Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  const selectedVariant = product?.variants?.find(
    (v) => v.color === selectedColor
  );

  // ✅ الحصول على الكمية الإجمالية للون
  const getTotalColorQuantity = (color: string) => {
    if (!employee) return 999; // للعملاء: دائماً متوفر

    const variant = product?.variants?.find((v) => v.color === color);
    if (!variant) return 0;

    return variant.totalColorQuantity || variant.cur_qty || 0;
  };

  // ✅ الحصول على الكمية للمقاس المحدد
  const getSizeQuantity = () => {
    if (!employee) return 999; // للعملاء: دائماً متوفر

    if (!selectedVariant || !selectedSize) return 0;

    if (
      selectedVariant.sizeQuantities &&
      selectedVariant.sizeQuantities[selectedSize] !== undefined
    ) {
      return selectedVariant.sizeQuantities[selectedSize];
    }

    return selectedVariant.cur_qty || 0;
  };

  // ✅ الحصول على item_code الحالي
  const getCurrentItemCode = () => {
    if (!selectedVariant) return product?.item_code || "";

    let itemCode = "";

    if (
      selectedSize &&
      selectedVariant.sizeItemCodes &&
      selectedVariant.sizeItemCodes[selectedSize]
    ) {
      itemCode = selectedVariant.sizeItemCodes[selectedSize];
    }

    if (
      !itemCode &&
      selectedVariant.sizeItemCodes &&
      selectedVariant.sizeItemCodes["default"]
    ) {
      itemCode = selectedVariant.sizeItemCodes["default"];
    }

    if (!itemCode && selectedVariant.itemCode) {
      itemCode = selectedVariant.itemCode;
    }

    if (!itemCode && product?.item_code) {
      itemCode = product.item_code;
    }

    if (!itemCode && product?.master_code) {
      itemCode = product.master_code;
    }

    return itemCode || "غير محدد";
  };

  const currentSizeQuantity = getSizeQuantity();
  const currentItemCode = getCurrentItemCode();

  const handleAddToCart = () => {
    if (!product) return;

    if (employee && currentSizeQuantity === 0) {
      alert("⛔ هذا المنتج غير متوفر حالياً في المخزن");
      return;
    }

    const cartItemCode = `${
      product.master_code || product.modelId
    }-${selectedColor}-${selectedSize}`;

    addToCart(
      {
        ...product,
        item_code: currentItemCode,
        unique_id: cartItemCode,
      },
      selectedColor || "افتراضي",
      selectedSize || "ONE SIZE",
      quantity
    );
    alert(`✅ تم إضافة "${product.description}" إلى السلة`);
  };

  const handleWhatsApp = () => {
    if (!product) return;

    const productCode = product.master_code || product.modelId;
    const availability = employee
      ? currentSizeQuantity > 0
        ? `متوفر: ${currentSizeQuantity} قطعة`
        : "غير متوفر"
      : "متوفر";

    const message = `السلام عليكم\nأريد الاستفسار عن المنتج:\n${
      product.description
    }\n\n📦 **معلومات المنتج:**\n- الكود: ${productCode}\n- كود المنتج: ${
      currentItemCode || "غير محدد"
    }\n- اللون: ${selectedColor || "غير محدد"}\n- المقاس: ${
      selectedSize || "غير محدد"
    }\n- السعر: ${product.price} ج.م\n- الحالة: ${availability}`;

    const whatsappUrl = `https://wa.me/201234567890?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const newVariant = product?.variants?.find((v) => v.color === color);
    if (newVariant?.sizes && newVariant.sizes.length > 0) {
      setSelectedSize(newVariant.sizes[0]);
    } else {
      setSelectedSize("");
    }
  };

  const handleSizeSelect = (size: string) => {
    setSelectedSize(size);
  };

  // ✅ تحديد لون حالة الكمية
  const getQuantityColor = (qty: number) => {
    if (qty === 0) return "bg-red-100 text-red-800 border-red-200";
    if (qty <= 5) return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-green-100 text-green-800 border-green-200";
  };

  // ✅ تحديد نص حالة الكمية
  const getQuantityText = (qty: number, size?: string) => {
    if (!employee) return "✅ متوفر";

    if (qty === 0) return "⛔ غير متوفر";
    if (qty <= 5) return `⚠️ آخر ${qty}`;

    if (size) {
      return `✅ متوفر (${qty}) - ${size}`;
    }
    return `✅ متوفر (${qty})`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">جاري تحميل المنتج...</p>
              <p className="text-sm text-gray-500 mt-1">
                رقم المنتج: {productId}
              </p>
              {employee && (
                <p className="text-xs text-blue-600 mt-2">
                  🔍 جلب كميات المخزن للموظف...
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="text-red-500 text-6xl mb-4">❌</div>
              <h2 className="text-xl font-medium text-gray-900 mb-2">
                المنتج غير موجود
              </h2>
              <p className="text-gray-600 mb-2">رقم المنتج: {productId}</p>
              {employee && (
                <p className="text-sm text-blue-600 mb-4">👔 كنت تبحث كموظف</p>
              )}
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => window.history.back()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                >
                  العودة للمنتجات
                </button>
                <button
                  onClick={fetchProductDetails}
                  className="bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const mainImage =
    selectedVariant?.imageUrl || product.variants?.[0]?.imageUrl;

  const masterCode = product.master_code || product.modelId;

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <button
          onClick={() => window.history.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6 hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
        >
          <svg
            className="w-5 h-5 ml-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          العودة للمنتجات
        </button>

        {/* ✅ بادئة معلومات المستخدم */}
        <div className="mb-4 flex justify-end">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-full font-medium ${
                employee
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-green-100 text-green-800 border border-green-200"
              }`}
            >
              {employee ? "👔 وضع الموظف" : "👤 عميل"}
            </span>

            {employee && Object.keys(employeeQuantities).length > 0 && (
              <span className="text-xs text-gray-600 bg-gray-100 px-2 py-1 rounded">
                {Object.keys(employeeQuantities).length} منتج مع كميات ✓
              </span>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            {/* صور المنتج */}
            <div>
              <div className="aspect-[3/4] overflow-hidden rounded-lg bg-white border border-gray-200">
                <img
                  src={
                    mainImage ||
                    "https://via.placeholder.com/600x800/FFFFFF/666666?text=No+Image"
                  }
                  alt={product.description}
                  className="w-full h-full object-contain p-4"
                  onError={(e) => {
                    e.currentTarget.src =
                      "https://via.placeholder.com/600x800/EFEFEF/666666?text=No+Image";
                  }}
                />
              </div>

              {/* ✅ ملاحظة للموظف حول الكميات */}
              {employee && (
                <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-700">
                    <span className="font-medium">ملاحظة للموظف:</span>
                    {currentSizeQuantity > 0
                      ? ` هذا المنتج متوفر (${currentSizeQuantity} قطعة)`
                      : " هذا المنتج غير متوفر حالياً في المخزن"}
                  </p>
                </div>
              )}
            </div>

            {/* معلومات المنتج */}
            <div className="space-y-6">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {product.description}
                </h1>
                <p className="text-gray-600 mt-2">{product.category}</p>

                {/* ✅ عرض الأكواد */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">
                    الكود: {masterCode}
                  </span>

                  {employee && currentItemCode && (
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-mono">
                      كود المنتج: {currentItemCode}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-blue-600">
                  {product.price?.toLocaleString()} ج.م
                </span>

                {/* ✅ شارة الكمية */}
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${getQuantityColor(
                    currentSizeQuantity
                  )}`}
                >
                  {getQuantityText(currentSizeQuantity, selectedSize)}
                </span>
              </div>

              {/* اختيار اللون */}
              {product.variants && product.variants.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    اللون{" "}
                    {employee && (
                      <span className="text-sm text-gray-500">
                        (مع الكميات)
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {product.variants.map((variant) => {
                      const totalQty = getTotalColorQuantity(variant.color);
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleColorSelect(variant.color)}
                          className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center min-w-24 ${
                            selectedColor === variant.color
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-medium">{variant.color}</span>
                          {employee && (
                            <span
                              className={`text-xs mt-1 px-2 py-0.5 rounded-full ${getQuantityColor(
                                totalQty
                              )}`}
                            >
                              {totalQty} قطعة
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* اختيار المقاس */}
              {selectedVariant?.sizes && selectedVariant.sizes.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    المقاس{" "}
                    {employee && (
                      <span className="text-sm text-gray-500">
                        (مع الكميات)
                      </span>
                    )}
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedVariant.sizes.map((size) => {
                      const sizeQty =
                        selectedVariant.sizeQuantities?.[size] || 0;
                      const displayQty = employee ? sizeQty : 999;

                      return (
                        <button
                          key={size}
                          onClick={() => handleSizeSelect(size)}
                          className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center min-w-20 ${
                            selectedSize === size
                              ? "border-blue-600 bg-blue-50 text-blue-700 shadow-sm"
                              : "border-gray-300 text-gray-700 hover:border-gray-400 hover:bg-gray-50"
                          }`}
                        >
                          <span className="font-medium">{size}</span>
                          {employee && (
                            <span
                              className={`text-xs mt-1 px-2 py-0.5 rounded-full ${getQuantityColor(
                                displayQty
                              )}`}
                            >
                              {displayQty}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* الكمية */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  الكمية
                </h3>
                <div className="flex items-center border border-gray-300 rounded-lg w-fit overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors border-r border-gray-300"
                    disabled={employee && currentSizeQuantity === 0}
                  >
                    -
                  </button>
                  <span className="px-4 py-2 min-w-12 text-center font-medium">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors border-l border-gray-300"
                    disabled={employee && quantity >= currentSizeQuantity}
                  >
                    +
                  </button>
                </div>
                {employee && currentSizeQuantity > 0 && (
                  <p className="text-sm text-gray-600 mt-2">
                    متوفر: {currentSizeQuantity} قطعة
                  </p>
                )}
                {employee && currentSizeQuantity === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠️ غير متوفر حالياً في المخزن
                  </p>
                )}
              </div>

              {/* الأزرار جنباً إلى جنب */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={handleAddToCart}
                  disabled={employee && currentSizeQuantity === 0}
                  className={`py-3 px-6 rounded-lg transition-colors font-medium text-lg flex items-center justify-center space-x-2 space-x-reverse ${
                    employee && currentSizeQuantity === 0
                      ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                      : "bg-blue-600 text-white hover:bg-blue-700"
                  }`}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <span>
                    {employee && currentSizeQuantity === 0
                      ? "غير متوفر"
                      : "أضف إلى السلة"}
                  </span>
                </button>

                <button
                  onClick={handleWhatsApp}
                  className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 transition-colors font-medium text-lg flex items-center justify-center space-x-2 space-x-reverse"
                >
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893c0-3.189-1.248-6.189-3.515-8.464" />
                  </svg>
                  <span>استفسر عبر الواتساب</span>
                </button>
              </div>

              {/* معلومات إضافية */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  معلومات المنتج
                </h3>
                <ul className="space-y-2 text-gray-600">
                  <li>• ضمان 30 يوم</li>
                  <li>• شحن مجاني للطلبات فوق 200 ج.م</li>
                  <li>• إرجاع خلال 14 يوم</li>
                  {employee && (
                    <>
                      <li>• 👔 للموظفين: عرض كميات المخزن الحقيقية</li>
                      <li>
                        • 👔 للموظفين: كود المنتج الدقيق: {currentItemCode}
                      </li>
                    </>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* ✅ قسم المنتجات المشابهة */}
        {similarProducts.length > 0 && (
          <div className="bg-white rounded-lg shadow-lg overflow-hidden p-8">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                منتجات مشابهة
              </h2>
              <p className="text-gray-600 mt-1">
                اكتشف منتجات أخرى من نفس التصنيف
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {similarProducts.map((similarProduct) => (
                <ProductCard
                  key={similarProduct.modelId}
                  product={similarProduct}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
