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
    const limit = parseInt(searchParams.get("limit") || "20");

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
        const imageUrl =
          row.images && row.images.trim() !== ""
            ? row.images
            : "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500";

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

    // ✅ 4. حساب الترقيم على الموديلات المجمعة
    const totalProducts = allGroupedProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (page - 1) * limit;

    // ✅ 5. أخذ الجزء المطلوب فقط للصفحة الحالية
    const paginatedProducts = allGroupedProducts.slice(skip, skip + limit);

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
      filteredByCategory: categoryName ? "نعم" : "لا",
      filteredBySub: sub ? "نعم" : "لا",
      filteredBySearch: search ? "نعم" : "لا",
      pagination: {
        currentPage: page,
        totalPages,
        totalProducts,
        limit,
        hasNextPage,
        hasPrevPage,
        skip,
        take: limit,
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
        limit: limit,
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

// ✅ POST: إضافة منتج جديد
export async function POST(request: Request) {
  try {
    const data = await request.json();

    console.log("📝 إنشاء منتج جديد:", data);

    // التحقق من البيانات المطلوبة
    if (!data.master_code || !data.item_name) {
      return NextResponse.json(
        {
          success: false,
          error: "master_code و item_name مطلوبان",
        },
        { status: 400 }
      );
    }

    // إنشاء unique_id
    const type_id = data.type_id || 0;
    const stor_id = data.stor_id || 0;
    const unique_id = `${data.master_code}-${type_id}-${stor_id}`;

    // التحقق من عدم وجود منتج بنفس unique_id
    const existingProduct = await prisma.products.findUnique({
      where: { unique_id: unique_id },
    });

    if (existingProduct) {
      return NextResponse.json(
        {
          success: false,
          error: "المنتج موجود مسبقاً",
        },
        { status: 400 }
      );
    }

    // إنشاء المنتج
    const newProduct = await prisma.products.create({
      data: {
        unique_id: unique_id,
        master_code: data.master_code,
        item_code: data.item_code || data.master_code,
        item_name: data.item_name,
        color: data.color || "افتراضي",
        size: data.size || "ONE SIZE",
        out_price: parseFloat(data.out_price) || 0,
        av_price: parseFloat(data.av_price) || parseFloat(data.out_price) || 0,
        cur_qty: parseInt(data.cur_qty) || 0,
        group_name: data.group_name || "عام",
        kind_name: data.kind_name || "عام",
        images: data.images || "",
        stor_id: stor_id,
        type_id: type_id,
        // الحقول الإضافية المطلوبة
        item_id: 0,
        unit_id: 0,
        unit_convert: 1.0,
        multi_unit: false,
        multi_type: false,
        unit_def1_id: 0,
        group_id: 0,
        class_id: 0,
        is_basic_unit: true,
        kind_id: 0,
        place_id: 0,
        unit_name_id: 0,
        unit_name: "قطعة",
        class_name: data.group_name || "عام",
        place_name: "المخزن الرئيسي",
      },
    });

    console.log("✅ تم إنشاء المنتج:", newProduct.unique_id);

    return NextResponse.json({
      success: true,
      message: "تم إنشاء المنتج بنجاح",
      product: newProduct,
    });
  } catch (error) {
    console.error("❌ Error creating product:", error);

    return NextResponse.json(
      {
        success: false,
        error: "فشل في إنشاء المنتج: " + error.message,
      },
      { status: 500 }
    );
  }
}
