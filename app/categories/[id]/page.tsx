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
  const [isEmployee, setIsEmployee] = useState<boolean>(false);

  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    totalPages: 1,
    totalProducts: 0,
    limit: 12,
    hasNextPage: false,
    hasPrevPage: false,
  });

  // ✅ التحقق من حالة المستخدم مرة واحدة فقط
  useEffect(() => {
    const checkUserType = () => {
      try {
        const employee = localStorage.getItem("employee");
        const employeeToken = localStorage.getItem("employeeToken");
        const isEmp = !!(employee && employeeToken);
        setIsEmployee(isEmp);
        return isEmp;
      } catch (error) {
        setIsEmployee(false);
        return false;
      }
    };

    checkUserType();
  }, []);

  // ✅ دالة محسنة لجلب البيانات مع معالجة الأخطاء
  const fetchAllProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log(
        `👤 نوع المستخدم في التصنيف: ${isEmployee ? "موظف" : "عميل"}`
      );
      console.log(`📥 جلب تصنيف ID: ${id}`);

      // ✅ استدعاء واحد فقط لجميع البيانات مع معلمات التحكم
      const response = await fetch(`/api/getAllData?categoryId=${id}`, {
        method: "GET",
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
        // إضافة timeout للاستدعاء
        signal: AbortSignal.timeout(30000), // 30 ثانية
      });

      if (!response.ok) {
        throw new Error(`خطأ في جلب البيانات: ${response.status}`);
      }

      const data = await response.json();
      let productsList: Product[] = data.products || [];
      const categoriesList: Category[] = data.categories || [];

      console.log(`📦 المنتجات المسترجعة: ${productsList.length} منتج`);
      console.log(`📁 التصنيفات المسترجعة: ${categoriesList.length} تصنيف`);

      // ✅ فلترة المنتجات حسب التصنيف الحالي أولاً
      if (id && categoriesList.length > 0) {
        const category = categoriesList.find(
          (cat: Category) => cat.id.toString() === id
        );
        setCurrentCategory(category || null);

        if (category) {
          // تصفية المنتجات حسب التصنيف فقط
          const categoryName = category.name.toLowerCase();
          const filteredProducts = productsList.filter((product) => {
            const categoryFields = [
              product.category,
              product.group_name,
              product.kind_name,
              product.item_name,
            ]
              .filter(Boolean)
              .map((field) => field?.toLowerCase());

            return categoryFields.some((field) =>
              field?.includes(categoryName)
            );
          });

          productsList = filteredProducts;
          console.log(
            `🎯 المنتجات بعد فلترة التصنيف: ${productsList.length} منتج`
          );

          // جلب التصنيفات الفرعية
          const subs = categoriesList.filter(
            (cat: Category) => cat.sub === category.name && cat.image
          );
          setSubCategories(subs);
          console.log(`🔍 التصنيفات الفرعية: ${subs.length} تصنيف`);
        }
      }

      // ✅ للموظفين: جلب الكميات بشكل منفصل لتجنب التعقيد
      if (isEmployee && productsList.length > 0) {
        console.log("🔍 جلب كميات الموظف...");
        try {
          // استدعاء مبسط للكميات - جلب فقط IDs المطلوبة
          const productIds = productsList
            .slice(0, 100)
            .map((p) => p.modelId)
            .join(",");
          const employeeResponse = await fetch(
            `/api/products/employee?ids=${productIds}&limit=100`,
            {
              headers: {
                "Cache-Control": "no-cache",
              },
            }
          );

          if (employeeResponse.ok) {
            const employeeData = await employeeResponse.json();
            const employeeProducts: Product[] = employeeData.products || [];
            console.log(
              `🏪 كميات الموظف المسترجعة: ${employeeProducts.length} منتج`
            );

            // إنشاء خريطة للكميات
            const quantityMap = new Map();
            employeeProducts.forEach((product: Product) => {
              product.variants?.forEach((variant) => {
                if (variant.cur_qty !== undefined) {
                  quantityMap.set(
                    `${product.modelId}-${variant.color}`,
                    variant.cur_qty
                  );
                }
              });
            });

            // تحديث كميات المنتجات المفلترة فقط
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

      // ✅ حفظ البيانات
      setAllProducts(productsList);
      setCategories(categoriesList);
    } catch (err: any) {
      console.error("❌ Error fetching products:", err);

      let errorMessage = `فشل في تحميل البيانات: ${err.message}`;

      // رسائل خطأ محددة
      if (err.name === "TimeoutError") {
        errorMessage = "انتهت مهلة الاتصال. يرجى المحاولة مرة أخرى.";
      } else if (err.message.includes("429")) {
        errorMessage =
          "تم تجاوز عدد الطلبات المسموح بها. يرجى الانتظار قليلاً.";
      } else if (err.message.includes("500")) {
        errorMessage = "خطأ في الخادم. يرجى المحاولة لاحقاً.";
      }

      setError(errorMessage);

      // ✅ محاولة استخدام API مبسط مع تقليل البيانات
      try {
        console.log("🔄 محاولة استخدام API مبسط...");
        const fallbackResponse = await fetch(
          `/api/products?category=${id}&limit=50`
        );
        if (fallbackResponse.ok) {
          const fallbackData = await fallbackResponse.json();
          setAllProducts(fallbackData.products || []);
          setCategories(fallbackData.categories || []);
          setError(null);
          console.log("✅ تم استرجاع البيانات باستخدام API مبسط");
        }
      } catch (fallbackError) {
        console.error("❌ Fallback error:", fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  // ✅ دالة تطبيق الترقيم مع تحسين الأداء
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
      return;
    }

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
    const paginated = productsList.slice(startIndex, endIndex);

    const totalProducts = productsList.length;
    const totalPages = Math.ceil(totalProducts / limit);

    setPaginatedProducts(paginated);
    setPagination({
      currentPage: page,
      totalPages,
      totalProducts,
      limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    });
  };

  // ✅ فلترة المنتجات مع تحسين الأداء
  const filterProducts = () => {
    if (allProducts.length === 0) {
      return [];
    }

    let filtered = [...allProducts];

    // فلترة حسب البحث
    if (searchTerm.trim() !== "") {
      const searchTermLower = searchTerm.toLowerCase();
      filtered = filtered.filter((product) => {
        const searchFields = [
          product.description,
          product.category,
          product.group_name,
          product.kind_name,
          product.item_name,
          product.master_code,
        ]
          .filter(Boolean)
          .map((field) => field?.toLowerCase());

        return searchFields.some((field) => field?.includes(searchTermLower));
      });
    }

    // فلترة حسب التصنيف الفرعي
    if (selectedSubCategory) {
      const subCategoryLower = selectedSubCategory.toLowerCase();
      filtered = filtered.filter((product) => {
        const subCategoryFields = [
          product.description,
          product.category,
          product.group_name,
          product.kind_name,
          product.item_name,
        ]
          .filter(Boolean)
          .map((field) => field?.toLowerCase());

        return subCategoryFields.some((field) =>
          field?.includes(subCategoryLower)
        );
      });
    }

    return filtered;
  };

  // ✅ جلب البيانات أول مرة
  useEffect(() => {
    fetchAllProducts();
  }, [id, isEmployee]);

  // ✅ تطبيق الفلترة والترقيم
  useEffect(() => {
    if (!loading && allProducts.length > 0) {
      const filteredProducts = filterProducts();
      applyPagination(
        filteredProducts,
        pagination.currentPage,
        pagination.limit
      );
    }
  }, [
    allProducts,
    searchTerm,
    selectedSubCategory,
    loading,
    pagination.currentPage,
    pagination.limit,
  ]);

  // ✅ دالة تغيير الصفحة
  const handlePageChange = (page: number) => {
    const filteredProducts = filterProducts();
    applyPagination(filteredProducts, page, pagination.limit);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // ✅ دالة تغيير عدد المنتجات في الصفحة
  const handleLimitChange = (newLimit: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
      limit: newLimit,
    }));
  };

  const handleSubCategoryClick = (subCategoryName: string) => {
    const newSelected =
      selectedSubCategory === subCategoryName ? null : subCategoryName;

    setSelectedSubCategory(newSelected);
    setPagination((prev) => ({
      ...prev,
      currentPage: 1,
    }));
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
              <p className="text-sm text-gray-500">التصنيف: {id}</p>
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
        </div>

        {/* شريط البحث */}
        <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
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
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                ✕ إلغاء
              </button>
            )}
          </div>
        </div>

        {/* صور دائرية للـ Sub Categories */}
        {subCategories.length > 0 && (
          <section className="bg-white rounded-xl shadow-sm p-4 sm:p-6 mb-6">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">
              التصنيفات الفرعية
            </h2>

            <div className="flex overflow-x-auto pb-3 gap-4">
              {subCategories.map((subCategory) => (
                <button
                  key={subCategory.id}
                  onClick={() => handleSubCategoryClick(subCategory.name)}
                  className={`flex flex-col items-center flex-shrink-0 ${
                    selectedSubCategory === subCategory.name
                      ? "transform -translate-y-2"
                      : ""
                  }`}
                >
                  <div
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-4 ${
                      selectedSubCategory === subCategory.name
                        ? "border-blue-500"
                        : "border-gray-200"
                    }`}
                  >
                    <img
                      src={subCategory.image}
                      alt={subCategory.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="mt-2 text-sm text-center max-w-20">
                    {subCategory.name}
                  </span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* معلومات الترقيم */}
        <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-700">
              <span className="font-medium">المنتجات:</span>{" "}
              <span className="font-bold text-blue-600">
                {pagination.totalProducts}
              </span>{" "}
              منتج
            </div>

            <select
              onChange={(e) => handleLimitChange(parseInt(e.target.value))}
              value={pagination.limit}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="12">12 منتج/صفحة</option>
              <option value="24">24 منتج/صفحة</option>
              <option value="36">36 منتج/صفحة</option>
            </select>
          </div>
        </div>

        {/* عرض المنتجات */}
        {paginatedProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {paginatedProducts.map((product) => (
                <ProductCard key={product.modelId} product={product} />
              ))}
            </div>

            {/* مكون الترقيم */}
            {pagination.totalPages > 1 && (
              <div className="mt-8">
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
          </>
        ) : (
          <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
            <h3 className="text-xl font-medium text-gray-900 mb-2">
              لا توجد منتجات
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm
                ? `لا توجد منتجات تطابق "${searchTerm}"`
                : "لا توجد منتجات في هذا التصنيف"}
            </p>
            <button
              onClick={handleClearSearch}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700"
            >
              عرض جميع المنتجات
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
