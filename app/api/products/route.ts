import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category");
    const sub = searchParams.get("sub");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "10000"); // ✅ جلب كل المنتجات مرة واحدة

    console.log("🔍 جلب المنتجات للعميل:", {
      category,
      sub,
      search,
      page,
      limit,
    });

    // ✅ البحث عن اسم التصنيف إذا كان ID رقمي
    let categoryName = category;

    if (category && !isNaN(parseInt(category))) {
      const cat = await prisma.categories.findUnique({
        where: { id: parseInt(category) },
      });
      if (cat) {
        categoryName = cat.name;
      }
    }

    console.log(`🔍 معايير البحث: 
      التصنيف: "${categoryName}" 
      Sub: "${sub}" 
      البحث: "${search}"
    `);

    // ✅ بناء شروط الفلترة الديناميكية
    const whereConditions: any = {
      cur_qty: { gt: 0 },
      // ✅ إضافة هذا الشرط المهم: جلب المنتجات من المخزن الرئيسي فقط
      stor_id: 0, // هذا يحل مشكلة الصور
    };

    // ✅ إضافة فلترة التصنيف
    if (categoryName) {
      whereConditions.OR = [
        { group_name: { contains: categoryName, mode: "insensitive" } },
        { kind_name: { contains: categoryName, mode: "insensitive" } },
        { item_name: { contains: categoryName, mode: "insensitive" } },
        { category: { contains: categoryName, mode: "insensitive" } },
      ];
    }

    // ✅ إضافة فلترة Sub Category
    if (sub) {
      if (whereConditions.OR) {
        // دمج مع شروط التصنيف
        whereConditions.OR.push(
          { description: { contains: sub, mode: "insensitive" } },
          { kind_name: { contains: sub, mode: "insensitive" } },
          { group_name: { contains: sub, mode: "insensitive" } }
        );
      } else {
        whereConditions.OR = [
          { description: { contains: sub, mode: "insensitive" } },
          { kind_name: { contains: sub, mode: "insensitive" } },
          { group_name: { contains: sub, mode: "insensitive" } },
        ];
      }
    }

    // ✅ إضافة فلترة البحث العام
    if (search) {
      if (whereConditions.OR) {
        whereConditions.OR.push(
          { item_name: { contains: search, mode: "insensitive" } },
          { item_code: { contains: search, mode: "insensitive" } },
          { master_code: { contains: search, mode: "insensitive" } },
          { color: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } }
        );
      } else {
        whereConditions.OR = [
          { item_name: { contains: search, mode: "insensitive" } },
          { item_code: { contains: search, mode: "insensitive" } },
          { master_code: { contains: search, mode: "insensitive" } },
          { color: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ];
      }
    }

    console.log(
      `📋 شروط الفلترة النهائية:`,
      JSON.stringify(whereConditions, null, 2)
    );

    // ✅ 1. جلب جميع المنتجات الخام مع الفلترة
    const allProductsRaw = await prisma.products.findMany({
      where: whereConditions,
      orderBy: {
        item_name: "asc",
      },
    });

    console.log(`📊 جميع المنتجات الخام من DB: ${allProductsRaw.length} منتج`);

    // ✅ تسجيل أول 5 منتجات للتحقق من الصور
    console.log("🖼️ عينة من الصور في قاعدة البيانات:");
    allProductsRaw.slice(0, 5).forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.item_code}: ${
          row.images ? row.images.substring(0, 50) + "..." : "لا توجد صورة"
        }`
      );
    });

    // ✅ 2. تجميع المنتجات حسب master_code
    const groupedByMasterCode: { [key: string]: any } = {};

    allProductsRaw.forEach((row) => {
      const masterCode = row.master_code;
      if (!masterCode) return;

      const color = row.color || "Default";
      const size = row.size || null;

      if (!groupedByMasterCode[masterCode]) {
        groupedByMasterCode[masterCode] = {
          modelId: masterCode,
          master_code: masterCode,
          price: row.out_price || 0,
          category: row.group_name || "",
          description: row.item_name || row.kind_name || "منتج بدون وصف",
          group_name: row.group_name || "",
          kind_name: row.kind_name || "",
          item_name: row.item_name || "",
          item_code: row.item_code || "",
          cur_qty: Number(row.cur_qty) || 0,
          variants: [],
        };
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v: any) => v.color === color
      );

      if (!variant) {
        // ✅ حل مشكلة الصور بشكل أفضل
        let imageUrl =
          "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500";

        if (row.images) {
          const img = row.images.trim();
          if (img !== "" && img !== "null" && img !== "NULL") {
            // ✅ التحقق من أن الصورة ليست base64 صغير
            if (img.startsWith("data:image") && img.length < 100) {
              console.warn(
                `⚠️ صورة base64 صغيرة جداً لـ ${row.item_code}: ${img.length} حرف`
              );
            } else {
              imageUrl = img;
            }
          }
        }

        console.log(
          `🖼️ المنتج ${row.item_code} - الصورة: ${imageUrl.substring(0, 80)}...`
        );

        variant = {
          id: row.unique_id,
          itemCode: row.item_code,
          color: color,
          imageUrl: imageUrl,
          sizes: [],
          cur_qty: Number(row.cur_qty) || 0,
          stor_id: row.stor_id || 0,
        };
        groupedByMasterCode[masterCode].variants.push(variant);
      }

      if (size && !variant.sizes.includes(size)) {
        variant.sizes.push(size);
      }
    });

    // ✅ 3. تحويل إلى مصفوفة وفلترة المنتجات التي لديها variants
    const allGroupedProducts = Object.values(groupedByMasterCode).filter(
      (product) => product.variants.length > 0
    );

    console.log(`🎯 المنتجات بعد التجميع: ${allGroupedProducts.length} موديل`);

    // ✅ حساب المنتجات التي لديها صور حقيقية
    const productsWithRealImages = allGroupedProducts.filter((product) => {
      return product.variants.some(
        (variant) =>
          !variant.imageUrl.includes("unsplash.com") &&
          !variant.imageUrl.includes("via.placeholder")
      );
    });
    console.log(
      `🖼️ المنتجات بصور حقيقية: ${productsWithRealImages.length}/${allGroupedProducts.length}`
    );

    // ✅ 4. حساب الترقيم على الموديلات المجمعة
    const totalProducts = allGroupedProducts.length;
    const totalPages = Math.ceil(totalProducts / 20); // ✅ 20 منتج لكل صفحة دائماً
    const skip = (page - 1) * 20; // ✅ استخدم 20 ثابتة للترقيم

    // ✅ 5. أخذ الجزء المطلوب فقط للصفحة الحالية
    const paginatedProducts = allGroupedProducts.slice(skip, skip + 20);

    console.log(
      `📄 الترقيم: صفحة ${page} من ${totalPages}, عرض ${paginatedProducts.length} موديل`
    );

    // ✅ 6. جلب الفئات مع Sub Categories
    const categories = await prisma.categories.findMany({
      orderBy: {
        name: "asc",
      },
    });

    // ✅ تجميع Sub Categories لكل تصنيف
    const categoriesWithSubs = categories.map((cat) => ({
      ...cat,
      sub_categories: categories.filter(
        (subCat) => (subCat as any).sub === cat.name
      ),
    }));

    // ✅ 7. إحصائيات الترقيم
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    // ✅ 8. إحصائيات إضافية للتصحيح
    const stats = {
      totalRawProducts: allProductsRaw.length,
      totalGroupedProducts: allGroupedProducts.length,
      productsWithRealImages: productsWithRealImages.length,
      filteredByCategory: categoryName ? "نعم" : "لا",
      filteredBySub: sub ? "نعم" : "لا",
      filteredBySearch: search ? "نعم" : "لا",
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        limit: 20, // ✅ ثابت
        hasNextPage,
        hasPrevPage,
        skip,
        take: 20,
      },
    };

    console.log("📈 إحصائيات الـ API:", stats);

    return NextResponse.json({
      success: true,
      products: paginatedProducts,
      categories: categoriesWithSubs,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalProducts: totalProducts,
        limit: 20, // ✅ ثابت
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
      stats: stats,
      filters: {
        category: categoryName,
        sub: sub,
        search: search,
      },
    });
  } catch (error) {
    console.error("❌ Error in products API:", error);

    return NextResponse.json({
      success: false,
      products: [],
      categories: [],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalProducts: 0,
        limit: 20,
        hasNextPage: false,
        hasPrevPage: false,
      },
      stats: {
        error: error.message,
      },
      error: "حدث خطأ في تحميل البيانات",
    });
  }
}
