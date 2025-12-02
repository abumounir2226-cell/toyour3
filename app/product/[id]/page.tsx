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

  // ✅ التحقق من حالة الموظف من localStorage مباشرة
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

  // ✅ جلب تفاصيل المنتج من الـ API مباشرة
  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      console.log(`🔍 جلب تفاصيل المنتج: ${productId}`);
      
      const isEmployeeUser = isEmployee();
      const endpoint = isEmployeeUser ? "/api/products/employee" : "/api/products";
      
      // ✅ جلب جميع المنتجات للبحث عن المنتج الحالي
      const url = `${endpoint}?limit=10000`;
      console.log(`🌐 جلب المنتجات من: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error("فشل في جلب البيانات");
      }

      const data = await response.json();
      console.log(`📦 المنتجات المستلمة: ${data.products?.length || 0} منتج`);

      // ✅ البحث عن المنتج الحالي
      const foundProduct = data.products?.find((p: Product) => p.modelId === productId);
      
      if (foundProduct) {
        console.log(`✅ وجدت المنتج: ${foundProduct.description}`);
        setProduct(foundProduct);

        // ✅ البحث عن المنتجات المشابهة (نفس التصنيف)
        const similar = data.products
          ?.filter(
            (p: Product) =>
              p.modelId !== productId && 
              p.category === foundProduct.category
          )
          .slice(0, 4);

        setSimilarProducts(similar || []);

        if (foundProduct.variants && foundProduct.variants.length > 0) {
          setSelectedColor(foundProduct.variants[0].color);
          if (foundProduct.variants[0].sizes && foundProduct.variants[0].sizes.length > 0) {
            setSelectedSize(foundProduct.variants[0].sizes[0]);
          }
        }
      } else {
        console.log(`❌ المنتج غير موجود: ${productId}`);
        
        // ✅ محاولة البحث بطرق أخرى (master_code)
        const foundByMasterCode = data.products?.find((p: Product) => 
          p.master_code === productId || p.item_code === productId
        );
        
        if (foundByMasterCode) {
          console.log(`✅ وجدت المنتج بالـ master_code: ${foundByMasterCode.description}`);
          setProduct(foundByMasterCode);
        }
      }
    } catch (error) {
      console.error("Error fetching product:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProductDetails();
  }, [productId]);

  // ✅ إعادة المحاولة إذا فشل التحميل
  useEffect(() => {
    if (!loading && !product) {
      const timer = setTimeout(() => {
        console.log("🔄 إعادة محاولة جلب المنتج...");
        fetchProductDetails();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [loading, product]);

  const selectedVariant = product?.variants?.find(
    (v) => v.color === selectedColor
  );

  // ✅ الحصول على الكمية الإجمالية للون
  const getTotalColorQuantity = (color: string) => {
    const variant = product?.variants?.find((v) => v.color === color);
    if (!variant) return 0;

    if (variant.totalColorQuantity !== undefined) {
      return variant.totalColorQuantity;
    }

    return variant.cur_qty || 0;
  };

  // ✅ الحصول على الكمية للمقاس المحدد
  const getSizeQuantity = () => {
    if (!selectedVariant || !selectedSize) return 0;

    if (selectedVariant.sizeQuantities) {
      return selectedVariant.sizeQuantities[selectedSize] || 0;
    }

    return selectedVariant.cur_qty || 0;
  };

  // ✅ الحصول على item_code الحالي
  const getCurrentItemCode = () => {
    if (!selectedVariant) return product?.item_code || "";

    if (
      selectedSize &&
      selectedVariant.sizeItemCodes &&
      selectedVariant.sizeItemCodes[selectedSize]
    ) {
      return selectedVariant.sizeItemCodes[selectedSize];
    }

    return selectedVariant.itemCode || product?.item_code || "";
  };

  const currentSizeQuantity = getSizeQuantity();
  const currentItemCode = getCurrentItemCode();

  const handleAddToCart = () => {
    if (!product) return;

    if (employee && currentSizeQuantity === 0) {
      alert("هذا المنتج غير متوفر حالياً");
      return;
    }

    addToCart(
      product,
      selectedColor || "افتراضي",
      selectedSize || "ONE SIZE",
      quantity
    );
    alert(`تم إضافة "${product.description}" إلى السلة`);
  };

  const handleWhatsApp = () => {
    if (!product) return;

    const productCode = product.master_code || product.modelId;
    const message = `السلام عليكم\nأريد الاستفسار عن المنتج:\n${
      product.description
    }\nالكود: ${productCode}\nكود المنتج: ${
      currentItemCode || "غير محدد"
    }\nاللون: ${selectedColor || "غير محدد"}\nالمقاس: ${
      selectedSize || "غير محدد"
    }\nالسعر: ${product.price} ج.م`;
    const whatsappUrl = `https://wa.me/201234567890?text=${encodeURIComponent(
      message
    )}`;
    window.open(whatsappUrl, "_blank");
  };

  // ✅ عند تغيير اللون، إعادة تعيين الحجم
  const handleColorSelect = (color: string) => {
    setSelectedColor(color);
    const newVariant = product?.variants?.find((v) => v.color === color);
    if (newVariant?.sizes && newVariant.sizes.length > 0) {
      setSelectedSize(newVariant.sizes[0]);
    } else {
      setSelectedSize("");
    }
  };

  // ✅ عند تغيير المقاس
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
              <p className="text-sm text-gray-500 mt-1">رقم المنتج: {productId}</p>
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
              <p className="text-gray-600 mb-6">رقم المنتج: {productId}</p>
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
          className="flex items-center text-gray-600 hover:text-gray-900 mb-6"
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

        <div className="bg-white rounded-lg shadow-lg overflow-hidden mb-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 p-8">
            {/* صور المنتج */}
            <div>
              <div className="aspect-[3/4] overflow-hidden rounded-lg bg-white">
                <img
                  src={
                    mainImage ||
                    "https://via.placeholder.com/600x800/FFFFFF/666666?text=No+Image"
                  }
                  alt={product.description}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* صور مصغرة */}
              {product.variants && product.variants.length > 1 && (
                <div className="grid grid-cols-4 gap-2 mt-4">
                  {product.variants.slice(0, 4).map((variant) => (
                    <button
                      key={variant.id}
                      onClick={() => handleColorSelect(variant.color)}
                      className={`aspect-[3/4] rounded border-2 overflow-hidden bg-white ${
                        selectedColor === variant.color
                          ? "border-blue-600"
                          : "border-gray-300"
                      }`}
                    >
                      <img
                        src={variant.imageUrl}
                        alt={variant.color}
                        className="w-full h-full object-contain"
                      />
                    </button>
                  ))}
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

                {/* ✅ عرض master_code */}
                {masterCode && (
                  <div className="mt-2">
                    <span className="text-sm bg-gray-100 text-gray-600 px-2 py-1 rounded-md font-mono">
                      الكود: {masterCode}
                    </span>
                  </div>
                )}

                {/* ✅ عرض item_code للموظفين فقط */}
                {employee && currentItemCode && (
                  <div className="mt-1">
                    <span className="text-sm bg-blue-100 text-blue-700 px-2 py-1 rounded-md font-mono">
                      كود المنتج: {currentItemCode}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-4">
                <span className="text-3xl font-bold text-blue-600">
                  {product.price?.toLocaleString()} ج.م
                </span>

                {/* ✅ شارة الكمية */}
                {employee ? (
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${getQuantityColor(
                      currentSizeQuantity
                    )}`}
                  >
                    {getQuantityText(currentSizeQuantity, selectedSize)}
                  </span>
                ) : (
                  <span className="text-green-600 bg-green-50 px-3 py-1 rounded-full text-sm">
                    متوفر
                  </span>
                )}
              </div>

              {/* اختيار اللون */}
              {product.variants && product.variants.length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-3">
                    اللون
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {product.variants.map((variant) => {
                      const totalQty = getTotalColorQuantity(variant.color);
                      return (
                        <button
                          key={variant.id}
                          onClick={() => handleColorSelect(variant.color)}
                          className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center ${
                            selectedColor === variant.color
                              ? "border-blue-600 bg-blue-50 text-blue-700"
                              : "border-gray-300 text-gray-700 hover:border-gray-400"
                          }`}
                        >
                          <span>{variant.color}</span>
                          {employee && (
                            <span className="text-xs text-gray-500 mt-1">
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
                    المقاس
                  </h3>
                  <div className="flex flex-wrap gap-3">
                    {selectedVariant.sizes.map((size) => (
                      <button
                        key={size}
                        onClick={() => handleSizeSelect(size)}
                        className={`px-4 py-2 border-2 rounded-lg transition-colors flex flex-col items-center ${
                          selectedSize === size
                            ? "border-blue-600 bg-blue-50 text-blue-700"
                            : "border-gray-300 text-gray-700 hover:border-gray-400"
                        }`}
                      >
                        <span>{size}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* الكمية */}
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-3">
                  الكمية
                </h3>
                <div className="flex items-center border border-gray-300 rounded-lg w-fit">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    -
                  </button>
                  <span className="px-4 py-2 border-l border-r border-gray-300 min-w-12 text-center">
                    {quantity}
                  </span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
                  >
                    +
                  </button>
                </div>
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