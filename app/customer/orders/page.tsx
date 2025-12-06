"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Header from "@/app/components/Header";

interface Order {
  id: string;
  customer_name: string;
  phone: string;
  address: string;
  total_price: number;
  status: string;
  timestamp: string;
  items: Array<{
    product: string;
    quantity: number;
    price: number;
    color: string;
    item_code: string;
  }>;
}

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [showOrderDetails, setShowOrderDetails] = useState(false);

  useEffect(() => {
    const checkCustomer = () => {
      try {
        const customerData = localStorage.getItem("customer");
        const customerToken = localStorage.getItem("customerToken");

        if (!customerData || !customerToken) {
          router.push("/customer/login");
          return;
        }

        const userData = JSON.parse(customerData);
        setCustomer(userData);
        fetchCustomerOrders(userData.phone);
      } catch (error) {
        router.push("/customer/login");
      } finally {
        setLoading(false);
      }
    };

    checkCustomer();
  }, [router]);

  const fetchCustomerOrders = async (phone: string) => {
    try {
      const response = await fetch("/api/orders");
      const allOrders = await response.json();

      // تصفية الطلبات الخاصة بالعميل فقط
      const customerOrders = allOrders.filter(
        (order: Order) => order.phone === phone
      );
      setOrders(customerOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("customer");
    localStorage.removeItem("customerToken");
    router.push("/");
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("ar-EG", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("ar-EG", {
      style: "currency",
      currency: "EGP",
    }).format(amount);
  };

  // ✅ جديد: فتح تفاصيل الطلب
  const handleViewOrderDetails = (order: Order) => {
    setSelectedOrder(order);
    setShowOrderDetails(true);
  };

  // ✅ جديد: طباعة الفاتورة
  const handlePrintInvoice = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("يرجى السماح بالنوافذ المنبثقة للطباعة");
      return;
    }

    const printContent = generateInvoiceHTML(selectedOrder!);

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();

    setTimeout(() => {
      printWindow.print();
    }, 500);
  };

  // ✅ جديد: توليد HTML للفاتورة
  const generateInvoiceHTML = (order: Order) => {
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>فاتورة طلب - ${order.id}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700;800&display=swap');
          
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Tajawal', sans-serif;
            background: white;
            color: #1f2937;
            line-height: 1.6;
            padding: 0;
          }
          
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            margin: 0 auto;
            background: white;
            padding: 20mm;
          }
          
          .invoice-header {
            text-align: center;
            border-bottom: 3px solid #3b82f6;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          
          .invoice-header h1 {
            font-size: 28px;
            font-weight: 800;
            color: #1f2937;
            margin-bottom: 10px;
          }
          
          .order-info {
            display: flex;
            justify-content: space-between;
            font-size: 14px;
            color: #6b7280;
            margin-top: 10px;
          }
          
          .info-sections {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          
          .info-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 15px;
          }
          
          .info-card h3 {
            color: #3b82f6;
            font-size: 16px;
            font-weight: 700;
            margin-bottom: 12px;
            padding-bottom: 8px;
            border-bottom: 1px solid #e2e8f0;
          }
          
          .info-item {
            margin-bottom: 6px;
            display: flex;
            justify-content: space-between;
          }
          
          .info-item strong {
            color: #4b5563;
            min-width: 100px;
          }
          
          .status-badge {
            background: #f59e0b;
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
          }
          
          .status-completed {
            background: #10b981;
          }
          
          .price {
            color: #059669;
            font-weight: 600;
          }
          
          .products-section {
            margin-bottom: 25px;
          }
          
          .products-section h3 {
            color: #3b82f6;
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 12px;
            text-align: center;
          }
          
          .products-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
          }
          
          .products-table thead {
            background: #3b82f6;
            color: white;
          }
          
          .products-table th {
            padding: 10px 8px;
            text-align: center;
            font-weight: 600;
            border: 1px solid #2563eb;
          }
          
          .products-table td {
            padding: 8px 6px;
            text-align: center;
            border: 1px solid #d1d5db;
          }
          
          .products-table tbody tr:nth-child(even) {
            background: #f9fafb;
          }
          
          .product-name {
            font-weight: 500;
            text-align: right;
            padding: 8px 10px;
          }
          
          .total-row {
            background: #1f2937 !important;
            color: white;
            font-weight: 700;
          }
          
          .total-row td {
            border: 1px solid #374151;
            padding: 10px;
          }
          
          .notes-section {
            background: #fef3c7;
            border: 1px solid #f59e0b;
            border-radius: 6px;
            padding: 15px;
            margin-bottom: 20px;
          }
          
          .notes-section h4 {
            color: #92400e;
            font-size: 14px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          
          .notes-list {
            list-style: none;
            color: #92400e;
            font-size: 12px;
          }
          
          .notes-list li {
            margin-bottom: 4px;
            padding-right: 12px;
            position: relative;
          }
          
          .notes-list li:before {
            content: "•";
            color: #f59e0b;
            font-weight: bold;
            position: absolute;
            right: 0;
          }
          
          .invoice-footer {
            text-align: center;
            border-top: 1px solid #e5e7eb;
            padding-top: 15px;
            color: #6b7280;
            font-size: 11px;
          }
          
          .company-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 5px;
          }
          
          .thank-you {
            color: #3b82f6;
            font-weight: 600;
            margin-top: 5px;
          }
          
          @media print {
            body {
              padding: 0;
              margin: 0;
            }
            
            .invoice-container {
              box-shadow: none;
              padding: 15mm;
              margin: 0;
            }
            
            .no-print {
              display: none !important;
            }
          }
          
          @page {
            size: A4;
            margin: 0;
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <!-- الهيدر -->
          <div class="invoice-header">
            <h1>فاتورة طلب - عميل</h1>
            <div class="order-info">
              <div><strong>رقم الطلب:</strong> ${order.id}</div>
              <div><strong>التاريخ:</strong> ${formatDate(
                order.timestamp
              )}</div>
            </div>
          </div>

          <!-- معلومات العميل والطلب -->
          <div class="info-sections">
            <div class="info-card">
              <h3>معلومات العميل</h3>
              <div class="info-item">
                <strong>الاسم:</strong>
                <span>${order.customer_name}</span>
              </div>
              <div class="info-item">
                <strong>الهاتف:</strong>
                <span>${order.phone}</span>
              </div>
              <div class="info-item">
                <strong>العنوان:</strong>
                <span>${order.address}</span>
              </div>
            </div>

            <div class="info-card">
              <h3>معلومات الطلب</h3>
              <div class="info-item">
                <strong>الحالة:</strong>
                <span class="status-badge ${
                  order.status === "تم" ? "status-completed" : ""
                }">
                  ${order.status}
                </span>
              </div>
              <div class="info-item">
                <strong>المبلغ الإجمالي:</strong>
                <span class="price">${formatCurrency(order.total_price)}</span>
              </div>
            </div>
          </div>

          <!-- جدول المنتجات -->
          <div class="products-section">
            <h3>المنتجات المطلوبة</h3>
            <table class="products-table">
              <thead>
                <tr>
                  <th>اسم المنتج</th>
                  <th>الكمية</th>
                  <th>سعر الوحدة</th>
                  <th>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                ${order.items
                  .map(
                    (item) => `
                  <tr>
                    <td class="product-name">${item.product}</td>
                    <td>${item.quantity}</td>
                    <td class="price">${formatCurrency(item.price)}</td>
                    <td class="price">${formatCurrency(
                      item.quantity * item.price
                    )}</td>
                  </tr>
                `
                  )
                  .join("")}
              </tbody>
              <tfoot>
                <tr class="total-row">
                  <td colspan="3">الإجمالي النهائي</td>
                  <td>${formatCurrency(order.total_price)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <!-- الملاحظات -->
          <div class="notes-section">
            <h4>ملاحظات هامة</h4>
            <ul class="notes-list">
              <li>يرجى الاحتفاظ بهذه الفاتورة كإثبات للشراء</li>
              <li>للاستفسارات، يرجى الاتصال على رقم خدمة العملاء</li>
              <li>شكراً لثقتكم بمتجر أحلام للأطفال</li>
            </ul>
          </div>

          <!-- التذييل -->
          <div class="invoice-footer">
            <div class="company-info">
              <div>متجر أحلام للأطفال</div>
              <div>${new Date().getFullYear()} © جميع الحقوق محفوظة</div>
            </div>
            <div class="thank-you">شكراً لاختياركم متجرنا</div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">جاري التحميل...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">طلباتي</h1>
            <p className="text-gray-600 mt-2">عرض جميع طلباتك السابقة</p>
          </div>
          <div className="flex gap-4">
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              👤 {customer?.username}
            </div>
            <button
              onClick={handleLogout}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors text-sm"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>

        {/* ✅ جديد: إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <div className="text-2xl font-bold text-blue-600">
              {orders.length}
            </div>
            <div className="text-sm text-gray-600">إجمالي الطلبات</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <div className="text-2xl font-bold text-orange-600">
              {orders.filter((o) => o.status === "جاري").length}
            </div>
            <div className="text-sm text-gray-600">قيد التنفيذ</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <div className="text-2xl font-bold text-green-600">
              {orders.filter((o) => o.status === "تم").length}
            </div>
            <div className="text-sm text-gray-600">مكتملة</div>
          </div>
          <div className="bg-white rounded-lg p-4 border border-gray-200 text-center">
            <div className="text-2xl font-bold text-purple-600">
              {
                orders.filter((o) => o.status !== "جاري" && o.status !== "تم")
                  .length
              }
            </div>
            <div className="text-sm text-gray-600">حالات أخرى</div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    رقم الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    العنوان
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    المبلغ
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الحالة
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    تاريخ الطلب
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    الإجراءات
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders.map((order) => (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {order.id}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {order.address}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-green-600">
                      {formatCurrency(order.total_price)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          order.status === "تم"
                            ? "bg-green-100 text-green-800"
                            : order.status === "جاري"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDate(order.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => handleViewOrderDetails(order)}
                        className="bg-blue-600 text-white px-3 py-1 rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        تفاصيل
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {orders.length === 0 && (
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📦</span>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                لا توجد طلبات
              </h3>
              <p className="text-gray-600">لم تقم بإجراء أي طلبات حتى الآن</p>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-700 text-sm mt-2 inline-block"
              >
                ابدأ التسوق الآن
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ✅ جديد: نافذة تفاصيل الطلب */}
      {showOrderDetails && selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                تفاصيل الطلب - {selectedOrder.id}
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={handlePrintInvoice}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                >
                  🖨️ طباعة الفاتورة
                </button>
                <button
                  onClick={() => setShowOrderDetails(false)}
                  className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {/* معاينة الفاتورة */}
              <div className="bg-white p-6 border border-gray-200 rounded-lg">
                <div className="text-center mb-6 border-b pb-4">
                  <h1 className="text-2xl font-bold text-gray-900">
                    فاتورة طلب - {selectedOrder.id}
                  </h1>
                  <p className="text-gray-600 mt-2">معاينة قبل الطباعة</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-600 mb-3">
                      معلومات العميل
                    </h3>
                    <p>
                      <strong>الاسم:</strong> {selectedOrder.customer_name}
                    </p>
                    <p>
                      <strong>الهاتف:</strong> {selectedOrder.phone}
                    </p>
                    <p>
                      <strong>العنوان:</strong> {selectedOrder.address}
                    </p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="text-lg font-semibold text-blue-600 mb-3">
                      معلومات الطلب
                    </h3>
                    <p>
                      <strong>الحالة:</strong>
                      <span
                        className={`mr-2 px-2 py-1 rounded-full text-sm ${
                          selectedOrder.status === "جاري"
                            ? "bg-orange-100 text-orange-800"
                            : "bg-green-100 text-green-800"
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                    </p>
                    <p>
                      <strong>المبلغ الإجمالي:</strong>{" "}
                      {formatCurrency(selectedOrder.total_price)}
                    </p>
                  </div>
                </div>

                <div className="mb-6">
                  <h3 className="text-xl font-semibold text-blue-600 mb-4 text-center">
                    المنتجات المطلوبة
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse border border-gray-300 text-sm">
                      <thead>
                        <tr className="bg-blue-600 text-white">
                          <th className="border border-blue-700 px-3 py-2">
                            اسم المنتج
                          </th>
                          <th className="border border-blue-700 px-3 py-2">
                            الكمية
                          </th>
                          <th className="border border-blue-700 px-3 py-2">
                            سعر الوحدة
                          </th>
                          <th className="border border-blue-700 px-3 py-2">
                            الإجمالي
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrder.items?.map((item, index) => (
                          <tr
                            key={index}
                            className={
                              index % 2 === 0 ? "bg-gray-50" : "bg-white"
                            }
                          >
                            <td className="border border-gray-300 px-2 py-1 text-right">
                              {item.product}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-center">
                              {item.quantity}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-center">
                              {formatCurrency(item.price)}
                            </td>
                            <td className="border border-gray-300 px-2 py-1 text-center font-semibold text-green-600">
                              {formatCurrency(item.quantity * item.price)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="bg-gray-800 text-white font-bold">
                          <td
                            colSpan="3"
                            className="border border-gray-700 px-4 py-2 text-left"
                          >
                            الإجمالي النهائي
                          </td>
                          <td className="border border-gray-700 px-4 py-2 text-center">
                            {formatCurrency(selectedOrder.total_price)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ✅ جديد: إضافة import Link
import Link from "next/link";
