"use client";

import { useState, useEffect, use } from "react";
import Header from "../../components/Header";
import ProductCard from "../../components/ProductCard";
import Pagination from "../../components/Pagination";

interface Product {
  modelId: string;
  price: number;
  category: string;
  description: string;
  group_name?: string;
  kind_name?: string;
  item_name?: string;
  master_code?: string;
  variants: Array<{
    id: string;
    color: string;
    imageUrl: string;
    sizes: string[];
    cur_qty?: number;
    stor_id?: number;
    sizeQuantities?: { [key: string]: number };
  }>;
  cur_qty?: number;
  stor_id?: number;
  item_code?: string;
  unique_id?: string;
}

interface Category {
  id: number;
  name: string;
  image: string;
  kind: string;
  sub?: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalProducts: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export default function CategoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [paginatedProducts, setPaginatedProducts] = useState<Product[]>([]);
  const [currentCategory, setCurrentCategory] = useState<Category | null>(null);
  const [subCategories, setSubCategories] = useState<Category[]>([]);
  const [selectedSubCategory, setSelectedSubCategory] = useState<string | null>(
    null
  );
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    limit: 12,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // ✅ التحقق من حالة المستخدم
  const checkUserType = () => {
    try {
      const employee = localStorage.getItem("employee");
      const employeeToken = localStorage.getItem("employeeToken");
      return !!(employee && employeeToken);
    } catch (error) {
      return false;
    }
  };

  // ✅ دالة واحدة لجلب كل المنتجات بغض النظر عن نوع المستخدم
  const fetchAllProducts = async () => {
    try {
      setLoading(true);
      const isEmployee = checkUserType();

      console.log(`👤 نوع المستخدم: ${isEmployee ? "موظف" : "عميل"}`);
      console.log("📥 جلب جميع المنتجات بدون قيود...");

      // ✅ استخدم نفس الـ API للجميع مع معامل لتحديد نوع العرض
      const response = await fetch("/api/getAllData");

      if (!response.ok) {
        throw new Error(`خطأ في جلب البيانات: ${response.status}`);
      }

      const data = await response.json();
      let productsList: Product[] = data.products || [];
      const categoriesList: Category[] = data.categories || [];

      console.log(`📦 المنتجات الأساسية: ${productsList.length} منتج`);

      // ✅ إذا كان المستخدم موظفاً، فلترنا فقط المنتجات المتوفرة في المخزن الرئيسي
      if (isEmployee) {
        console.log("🔍 فلترة المنتجات للموظف (المخزن الرئيسي فقط)...");

        // جلب بيانات المنتجات للموظفين (كميات المخزن)
        try {
          const employeeResponse = await fetch("/api/products/employee");
          if (employeeResponse.ok) {
            const employeeData = await employeeResponse.json();
            const employeeProducts: Product[] = employeeData.products || [];
            console.log(
              `🏪 منتجات الموظف (بكميات): ${employeeProducts.length} منتج`
            );

            // إنشاء خريطة للكميات
            const quantityMap = new Map();
            employeeProducts.forEach((product: Product) => {
              product.variants?.forEach((variant) => {
                // تخزين كمية اللون الإجمالية
                if (variant.cur_qty !== undefined) {
                  quantityMap.set(
                    `${product.modelId}-${variant.color}`,
                    variant.cur_qty
                  );
                }
                // تخزين كميات المقاسات إذا وجدت
                if (variant.sizeQuantities) {
                  Object.entries(variant.sizeQuantities).forEach(
                    ([size, qty]) => {
                      quantityMap.set(
                        `${product.modelId}-${variant.color}-${size}`,
                        qty
                      );
                    }
                  );
                }
              });
            });

            // إضافة الكميات للمنتجات الأساسية
            productsList = productsList.map((product) => {
              const updatedProduct = { ...product };
              updatedProduct.variants =
                product.variants?.map((variant) => {
                  const totalQty =
                    quantityMap.get(`${product.modelId}-${variant.color}`) || 0;
                  return {
                    ...variant,
                    cur_qty: totalQty,
                    stor_id: totalQty > 0 ? 0 : undefined,
                  };
                }) || [];
              return updatedProduct;
            });

            console.log("✅ تم تحديث كميات المنتجات للموظف");
          }
        } catch (employeeError) {
          console.warn(
            "⚠️ لا يمكن جلب كميات الموظف، استخدام البيانات الأساسية:",
            employeeError
          );
        }
      }

      console.log(`📊 إجمالي المنتجات بعد المعالجة: ${productsList.length}`);
      console.log(`📁 إجمالي التصنيفات: ${categoriesList.length}`);

      // ✅ حفظ البيانات
      setAllProducts(productsList);
      setCategories(categoriesList);

      // ✅ جلب التصنيف الحالي
      if (categoriesList && id) {
        const category = categoriesList.find(
          (cat: Category) => cat.id.toString() === id
        );
        setCurrentCategory(category || null);

        if (category) {
          const subs = categoriesList.filter(
            (cat: Category) => cat.sub === category.name && cat.image
          );
          setSubCategories(subs);
          console.log(`🔍 التصنيفات الفرعية: ${subs.length} تصنيف`);
        }
      }
    } catch (err: any) {
      console.error("❌ Error fetching products:", err);
      setError(`فشل في تحميل البيانات: ${err.message}`);

      // ✅ محاولة استخدام API بديل
      try {
        console.log("🔄 محاولة استخدام API بديل...");
        const fallbackResponse = await fetch("/api/products");
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setAllProducts(fallbackData.products || []);
          setCategories(fallbackData.categories || []);
          setError(null);
          console.log("✅ تم استرجاع البيانات باستخدام API بديل");
        }
      } catch (fallbackError) {
        console.error("❌ Fallback error:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة تطبيق الترقيم على المنتجات المفلترة
  const applyPagination = (
    productsList: Product[],
    page: number,
    limit: number
  ) => {
    if (productsList.length === 0) {
      setPaginatedProducts([]);
      setPagination({
        currentPage: 1,
        totalPages: 1,
        totalProducts: 0,
        limit,
        hasNextPage: false,
        hasPrevPage: false,
      });
      console.log("📭 لا توجد منتجات للتطبيق");
      return;
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginated = productsList.slice(startIndex, endIndex);

    const totalProducts = productsList.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    console.log(
      `📊 الترقيم: صفحة ${page}/${totalPages}, عرض ${paginated.length} منتج من أصل ${totalProducts}`
    );

    setPaginatedProducts(paginated);
    setPagination({
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      hasNextPage,
      hasPrevPage,
    });
  };

  // ✅ فلترة المنتجات حسب التصنيف والبحث والـ Sub Category
  const filterProducts = () => {
    if (allProducts.length === 0 || categories.length === 0) {
      console.log("⚠️ لا توجد منتجات للفلترة");
      return [];
    }

    const category = categories.find((cat) => cat.id.toString() === id);
    if (!category) {
      console.log("❌ التصنيف غير موجود");
      return [];
    }

    console.log(`🔍 فلترة المنتجات في: "${category.name}"`);
    console.log(`🔍 البحث: "${searchTerm}"`);
    console.log(`🔍 Sub Category: "${selectedSubCategory}"`);

    const filtered = allProducts.filter((product) => {
      // 1. فلترة حسب التصنيف الرئيسي
      const categoryName = category.name.toLowerCase();
      const categoryFields = [
        product.category,
        product.group_name,
        product.kind_name,
        product.item_name,
      ]
        .filter(Boolean)
        .map((field) => field?.toLowerCase());

      const matchesCategory = categoryFields.some((field) =>
        field?.includes(categoryName)
      );
      if (!matchesCategory) {
        return false;
      }

      // 2. فلترة حسب الـ Sub Category
      if (selectedSubCategory) {
        const subCategoryFields = [
          product.description,
          product.category,
          product.group_name,
          product.kind_name,
          product.item_name,
        ]
          .filter(Boolean)
          .map((field) => field?.toLowerCase());

        const matchesSubCategory = subCategoryFields.some((field) =>
          field?.includes(selectedSubCategory.toLowerCase())
        );
        if (!matchesSubCategory) {
          return false;
        }
      }

      // 3. فلترة حسب البحث
      if (searchTerm.trim() !== "") {
        const searchFields = [
          product.description,
          product.category,
          product.group_name,
          product.kind_name,
          product.item_name,
          product.master_code,
          ...(product.variants || []).map((v) => v.color),
        ]
          .filter(Boolean)
          .map((field) => field?.toLowerCase());

        const matchesSearch = searchFields.some((field) =>
          field?.includes(searchTerm.toLowerCase())
        );
        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    });

    console.log(`✅ المنتجات بعد الفلترة: ${filtered.length} منتج`);
    return filtered;
  };

  // ✅ جلب البيانات أول مرة
  useEffect(() => {
    fetchAllProducts();
  }, [id]);

  // ✅ تطبيق الفلترة والترقيم عند تغيير أي عامل
  useEffect(() => {
    if (!loading && allProducts.length > 0) {
      console.log("🔄 تطبيق الفلترة والترقيم...");
      const filteredProducts = filterProducts();
      applyPagination(
        filteredProducts,
        pagination.currentPage,
        pagination.limit
      );
    }
  }, [
    allProducts,
    id,
    searchTerm,
    selectedSubCategory,
    loading,
    pagination.currentPage,
    pagination.limit,
  ]);

  // ✅ دالة تغيير الصفحة
  const handlePageChange = (page: number) => {
    console.log(`🔄 تغيير الصفحة إلى: ${page}`);
    const filteredProducts = filterProducts();

    setPagination((prev) => ({
      ...prev,
      currentPage: page,
    }));

    applyPagination(filteredProducts, page, pagination.limit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ✅ دالة تغيير عدد المنتجات في الصفحة
  const handleLimitChange = (newLimit: number) => {
    console.log(`🔄 تغيير عدد المنتجات في الصفحة إلى: ${newLimit}`);

    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      limit: newLimit,
    }));

    const filteredProducts = filterProducts();
    applyPagination(filteredProducts, 1, newLimit);
  };

  const handleSubCategoryClick = (subCategoryName: string) => {
    const newSelected =
      selectedSubCategory === subCategoryName ? null : subCategoryName;

    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
    }));

    setSelectedSubCategory(newSelected);
    console.log(`🎯 تصنيف فرعي: ${newSelected || "الكل"}`);
  };

  // ✅ شريط البحث
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
    setSelectedSubCategory(null);

    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">جاري تحميل جميع المنتجات...</p>
              <p className="text-sm text-gray-500">قد يستغرق بضع ثوانٍ</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center items-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchAllProducts}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                حاول مرة أخرى
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const isEmployee = checkUserType();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <main className="max-w-7xl mx-auto py-4 sm:py-8 px-3 sm:px-6 lg:px-8">
        {/* زر العودة ومعلومات المستخدم */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 text-sm sm:text-base hover:bg-gray-100 px-3 py-2 rounded-lg transition-colors"
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 ml-1"
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
            العودة
          </button>

          <div className="flex items-center gap-3">
            <span
              className={`text-xs sm:text-sm px-3 py-1.5 rounded-full font-medium ${
                isEmployee
                  ? "bg-blue-100 text-blue-800 border border-blue-200"
                  : "bg-green-100 text-green-800 border border-green-200"
              }`}
            >
              {isEmployee ? "👔 وضع الموظف" : "👤 عميل"}
            </span>

            {/* ✅ معلومات إضافية */}
            {allProducts.length > 0 && (
              <div className="hidden sm:flex items-center gap-2 text-xs text-gray-600">
                <span className="bg-gray-100 px-2 py-1 rounded">
                  {allProducts.length} منتج متاح
                </span>
                {isEmployee && (
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded">
                    رؤية جميع المنتجات
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* عنوان التصنيف */}
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-2">
            {currentCategory?.name || `التصنيف ${id}`}
          </h1>
          <p className="text-gray-600 text-sm sm:text-base">
            {isEmployee
              ? "عرض وتحرير المنتجات المتاحة في المخزن"
              : "تصفح أحدث المنتجات في هذا التصنيف"}
          </p>
          {isEmployee && (
            <div className="mt-2 text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full inline-block">
              🔍 ترى جميع المنتجات وليس فقط المتوفرة في المخزن
            </div>
          )}
        </div>

        {/* ✅ شريط البحث وأدوات التصفية */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex flex-col lg:flex-row gap-4 items-center">
            {/* شريط البحث */}
            <div className="flex-1 w-full">
              <div className="relative">
                <input
                  type="text"
                  value={searchTerm}
                  onChange={handleSearch}
                  placeholder="ابحث في منتجات التصنيف..."
                  className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
                  <svg
                    className="w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                {(searchTerm || selectedSubCategory) && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute left-12 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 bg-white px-2"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* أدوات التصفية */}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  عرض
                </span>
                <select
                  onChange={(e) => handleLimitChange(parseInt(e.target.value))}
                  value={pagination.limit}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="12">12 منتج</option>
                  <option value="24">24 منتج</option>
                  <option value="36">36 منتج</option>
                  <option value="48">48 منتج</option>
                  <option value="100">100 منتج</option>
                </select>
              </div>

              {/* ✅ زر تحديث البيانات */}
              <button
                onClick={fetchAllProducts}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                تحديث
              </button>
            </div>
          </div>

          {/* ✅ معلومات البحث */}
          {(searchTerm || selectedSubCategory) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex flex-wrap items-center gap-2 text-sm text-blue-700">
                <span className="font-medium">بحث عن:</span>
                {searchTerm && (
                  <span className="bg-blue-100 px-3 py-1 rounded-full">
                    "{searchTerm}"
                  </span>
                )}
                {selectedSubCategory && (
                  <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    {selectedSubCategory}
                  </span>
                )}
                <button
                  onClick={handleClearSearch}
                  className="text-blue-600 hover:text-blue-800 text-xs font-medium"
                >
                  إلغاء الكل
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ✅ صور دائرية للـ Sub Categories */}
        {subCategories.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
                التصنيفات الفرعية
              </h2>
              <span className="text-sm text-gray-500">
                {subCategories.length} تصنيف
              </span>
            </div>

            <div className="flex overflow-x-auto pb-3 gap-4 sm:flex-wrap sm:justify-center sm:gap-6 hide-scrollbar">
              {subCategories.map((subCategory) => (
                <button
                  key={subCategory.id}
                  onClick={() => handleSubCategoryClick(subCategory.name)}
                  className={`flex flex-col items-center transition-all duration-300 flex-shrink-0 group ${
                    selectedSubCategory === subCategory.name
                      ? "transform -translate-y-2"
                      : "hover:transform hover:-translate-y-1"
                  }`}
                >
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 transition-all duration-300 ${
                      selectedSubCategory === subCategory.name
                        ? "border-blue-500 shadow-lg scale-110"
                        : "border-gray-200 group-hover:border-blue-300"
                    }`}
                  >
                    <img
                      src={
                        subCategory.image ||
                        "https://via.placeholder.com/100x100/EFEFEF/666666?text=No+Image"
                      }
                      alt={subCategory.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                      loading="lazy"
                    />
                  </div>

                  <span
                    className={`mt-2 text-sm font-medium transition-colors text-center max-w-20 sm:max-w-none ${
                      selectedSubCategory === subCategory.name
                        ? "text-blue-600 font-bold"
                        : "text-gray-700 group-hover:text-blue-500"
                    }`}
                  >
                    {subCategory.name}
                  </span>
                </button>
              ))}
            </div>

            {selectedSubCategory && (
              <div className="text-center mt-4">
                <button
                  onClick={() => setSelectedSubCategory(null)}
                  className="text-blue-600 hover:text-blue-700 text-sm font-medium bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-full transition-colors inline-flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                  إلغاء التصفية: {selectedSubCategory}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ✅ معلومات الترقيم */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="text-sm text-gray-700">
              <span className="font-medium">التصنيف:</span>{" "}
              {currentCategory?.name || id} •
              <span className="font-medium mx-2">المنتجات:</span>{" "}
              <span className="font-bold text-blue-600">
                {pagination.totalProducts}
              </span>{" "}
              منتج
            </div>

            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600 hidden sm:block">
                <span className="font-medium">الصفحة</span>{" "}
                <span className="font-bold">{pagination.currentPage}</span>{" "}
                <span className="font-medium">من</span>{" "}
                <span className="font-bold">{pagination.totalPages}</span>
              </div>

              {/* ✅ إحصائيات إضافية */}
              {pagination.totalProducts > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-xs text-gray-500 hidden md:flex items-center gap-1">
                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                    <span>عرض: {pagination.limit}/صفحة</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ✅ شريط تقدم الصفحات */}
          {pagination.totalPages > 1 && (
            <div className="mt-3">
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (pagination.currentPage / pagination.totalPages) * 100
                    }%`,
                  }}
                ></div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>الصفحة 1</span>
                <span>الصفحة {pagination.totalPages}</span>
              </div>
            </div>
          )}
        </div>

        {/* ✅ عرض المنتجات */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.modelId} product={product} />
              ))}
            </div>

            {/* ✅ مكون الترقيم */}
            {pagination.totalPages > 1 && (
              <div className="mt-8 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalProducts={pagination.totalProducts}
                  limit={pagination.limit}
                  hasNextPage={pagination.hasNextPage}
                  hasPrevPage={pagination.hasPrevPage}
                  onPageChange={handlePageChange}
                />
              </div>
            )}

            {/* ✅ معلومات إضافية */}
            <div className="mt-6 text-center text-sm text-gray-500">
              عرض{" "}
              <span className="font-medium">
                {Math.min(
                  (pagination.currentPage - 1) * pagination.limit + 1,
                  pagination.totalProducts
                )}
              </span>{" "}
              -{" "}
              <span className="font-medium">
                {Math.min(
                  pagination.currentPage * pagination.limit,
                  pagination.totalProducts
                )}
              </span>{" "}
              من {pagination.totalProducts} منتج
            </div>
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="text-gray-400 text-6xl mb-4">
              {isEmployee ? "📦" : "🔍"}
            </div>
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              لا توجد منتجات
            </h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              {currentCategory
                ? `لا توجد منتجات في تصنيف "${currentCategory.name}"`
                : "التصنيف غير موجود"}
              {selectedSubCategory && ` تحت "${selectedSubCategory}"`}
              {searchTerm && ` تطابق "${searchTerm}"`}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={handleClearSearch}
                className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                عرض جميع المنتجات
              </button>
              <button
                onClick={fetchAllProducts}
                className="bg-gray-200 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors font-medium"
              >
                تحديث البيانات
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ✅ CSS للـ scrollbar */}
      <style jsx>{`
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
