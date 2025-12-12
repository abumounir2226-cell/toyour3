import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const searchParams = url.searchParams;
    const category = searchParams.get("category");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    console.log("🔍 جلب المنتجات للموظفين:", { category, page, limit });

    // ✅ البحث عن التصنيف بالاسم
    let categoryName = category;

    if (category && !isNaN(parseInt(category))) {
      const cat = await prisma.categories.findUnique({
        where: { id: parseInt(category) },
      });
      if (cat) {
        categoryName = cat.name;
      }
    }

    console.log(`🔍 البحث عن المنتجات في تصنيف: "${categoryName}" للموظفين`);

    // ✅ 1. أولاً: جلب جميع المنتجات الخام مع فلترة
    const allProductsRaw = await prisma.products.findMany({
      where: {
        cur_qty: { gt: 0 },
        stor_id: 0,
        // ✅ فلترة حسب التصنيف
        ...(categoryName && {
          OR: [
            { group_name: { contains: categoryName, mode: "insensitive" } },
            { kind_name: { contains: categoryName, mode: "insensitive" } },
            { item_name: { contains: categoryName, mode: "insensitive" } },
          ],
        }),
      },
      select: {
        unique_id: true,
        master_code: true,
        item_code: true,
        item_name: true,
        color: true,
        size: true,
        out_price: true,
        images: true,
        cur_qty: true,
        stor_id: true,
        group_name: true,
        kind_name: true,
      },
      orderBy: {
        item_name: "asc",
      },
    });

    console.log(
      `📊 جميع المنتجات الخام للموظفين: ${allProductsRaw.length} منتج`
    );

    // ✅ 2. تجميع المنتجات حسب master_code
    const groupedByMasterCode = {};

    allProductsRaw.forEach((row) => {
      const masterCode = row.master_code;
      if (!masterCode) return;

      const color = row.color || "Default";
      const size = row.size || "ONE SIZE";
      const quantity = Number(row.cur_qty) || 0;

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
          item_code: row.item_code,
          variants: [],
        };
      }

      let variant = groupedByMasterCode[masterCode].variants.find(
        (v) => v.color === color
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
          sizeItemCodes: {},
          sizeQuantities: {},
          totalColorQuantity: 0,
          stor_id: row.stor_id || 0,
        };
        groupedByMasterCode[masterCode].variants.push(variant);
      }

      if (size && !variant.sizes.includes(size)) {
        variant.sizes.push(size);
      }

      if (size) {
        variant.sizeItemCodes[size] = row.item_code;
        const currentSizeQty = variant.sizeQuantities[size] || 0;
        variant.sizeQuantities[size] = currentSizeQty + quantity;
      }

      variant.totalColorQuantity += quantity;
    });

    Object.values(groupedByMasterCode).forEach((product) => {
      product.variants.forEach((variant) => {
        variant.cur_qty = variant.totalColorQuantity;
      });
    });

    const allGroupedProducts = Object.values(groupedByMasterCode).filter(
      (product) => product.variants.length > 0
    );

    console.log(
      `🎯 المنتجات بعد التجميع للموظفين: ${allGroupedProducts.length} موديل`
    );

    // ✅ 3. حساب الترقيم
    const totalProducts = allGroupedProducts.length;
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (page - 1) * limit;

    const paginatedProducts = allGroupedProducts.slice(skip, skip + limit);

    console.log(
      `📄 الترقيم للموظفين: صفحة ${page} من ${totalPages}, عرض ${paginatedProducts.length} موديل`
    );

    const categories = await prisma.categories.findMany();
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      products: paginatedProducts,
      categories: categories,
      pagination: {
        currentPage: page,
        totalPages: totalPages,
        totalProducts: totalProducts,
        limit: limit,
        hasNextPage: hasNextPage,
        hasPrevPage: hasPrevPage,
      },
    });
  } catch (error) {
    console.error("Error in employee products API:", error);

    return NextResponse.json({
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
      error: "فشل في جلب البيانات من قاعدة البيانات",
    });
  }
}
