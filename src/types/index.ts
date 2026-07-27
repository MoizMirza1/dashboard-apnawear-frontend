export type UserRole = "ADMIN" | "PARTNER";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
};

export type ManagedUser = SessionUser & {
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

export type BusinessSettings = {
  id: string;
  businessName: string;
  currency: "PKR";
  ownership: {
    partnerAPercent: number;
    partnerBPercent: number;
  };
  defaultCosts: {
    regularBlankCost: number;
    dropShoulderBlankCost: number;
    regularSellingPrice: number;
    dropShoulderSellingPrice: number;
    defaultPrintingCost?: number;
    courier: number;
    flyer: number;
    flyerLabel: number;
    printingPickup: number;
  };
  updatedAt: string;
};

export type AuditLog = {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  entityType: string;
  entityId: string | null;
  description: string;
  createdAt: string;
};

export type ProductDesign = {
  id: string;
  name: string;
  category: string;
  description: string;
  regularSellingPrice: number;
  dropShoulderSellingPrice: number;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type GarmentType = "REGULAR" | "DROP_SHOULDER";
export type GarmentSize = "XS" | "S" | "M" | "L" | "XL" | "XXL" | "3XL";

export type GarmentVariant = {
  id: string;
  sku: string;
  garmentType: GarmentType;
  color: string;
  size: GarmentSize;
  defaultUnitCost: number;
  lastPurchaseCost: number | null;
  effectiveUnitCost: number;
  availableQty: number;
  reservedQty: number;
  damagedQty: number;
  lowStockThreshold: number;
  isLowStock: boolean;
  estimatedValue: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type InventorySummary = {
  activeVariants: number;
  totalAvailableUnits: number;
  totalReservedUnits: number;
  totalDamagedUnits: number;
  estimatedStockValue: number;
  lowStockCount: number;
  lowStockVariants: GarmentVariant[];
};

export type PurchaseBatch = {
  id: string;
  purchaseNumber: string;
  batchNumber: string;
  supplier: { id: string | null; name: string; phone: string };
  variant: {
    id: string | null;
    sku: string;
    garmentType: string;
    color: string;
    size: string;
  };
  quantity: number;
  remainingQty: number;
  unitPurchaseCost: number;
  transportCost: number;
  otherCost: number;
  totalCost: number;
  landedUnitCost: number;
  receivedAt: string;
  invoiceReference: string;
  notes: string;
  createdAt: string;
};

export type StockMovement = {
  id: string;
  movementNumber: string;
  variant: {
    id: string | null;
    sku: string;
    garmentType: string;
    color: string;
    size: string;
  };
  purchaseBatch: { id: string; batchNumber: string } | null;
  type: "PURCHASE_IN" | "ADJUSTMENT_IN" | "ADJUSTMENT_OUT" | "DAMAGE_OUT" | "ORDER_RESERVE" | "ORDER_RELEASE" | "ORDER_CONSUME";
  quantity: number;
  quantityDelta: number;
  balanceAfter: number;
  unitCost: number | null;
  reason: string;
  createdAt: string;
};

export type OrderStatus = "DRAFT" | "CONFIRMED" | "STOCK_RESERVED" | "SENT_FOR_PRINTING" | "PRINTING_COMPLETED" | "READY_TO_PACK" | "SHIPPED" | "DELIVERED" | "COD_PENDING" | "COMPLETED" | "RTO" | "RETURNED" | "CANCELLED";
export type PaymentStatus = "UNPAID" | "ADVANCE_PAID" | "COD_PENDING" | "COD_RECEIVED" | "REFUNDED";

export type Order = {
  id: string;
  orderNumber: string;
  customer: { name: string; phone: string; whatsapp: string; city: string; address: string; instagramUsername: string; notes: string };
  source: string;
  adCampaign: { id: string; name: string; platform: string } | null;
  items: Array<{
    id: string;
    productDesignId: string | null;
    garmentVariantId: string | null;
    designName: string;
    sku: string;
    garmentType: string;
    color: string;
    size: string;
    quantity: number;
    unitSellingPrice: number;
    grossSellingPrice: number;
    inventoryUnitCost: number;
    inventoryCost: number;
    printingCost: number;
  }>;
  merchandiseTotal: number;
  deliveryCharged: number;
  discount: number;
  advancePayment: number;
  revenue: number;
  costs: { inventory: number; printing: number; printingPickup: number; flyer: number; label: number; courier: number; returnCost: number; other: number; adAllocation: number };
  directCost: number;
  profitBeforeAds: number;
  profitAfterAds: number;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  stockState: string;
  createdAt: string;
  updatedAt: string;
};

export type PrintingJob = {
  id: string;
  jobNumber: string;
  order: { id: string | null; orderNumber: string; customer: { name: string; phone: string }; status: string };
  printerName: string;
  status: "PENDING" | "SENT" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  printingCost: number;
  pickupCost: number;
  sentAt: string | null;
  dueAt: string | null;
  completedAt: string | null;
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type Shipment = {
  id: string;
  shipmentNumber: string;
  order: { id: string | null; orderNumber: string; customer: { name: string; phone: string }; status: string; revenue: number };
  courierCompany: string;
  trackingNumber: string;
  courierCharge: number;
  codAmount: number;
  status: "BOOKED" | "IN_TRANSIT" | "DELIVERED" | "RTO" | "CANCELLED";
  bookedAt: string;
  deliveredAt: string | null;
  rtoAt: string | null;
  settled: boolean;
  notes: string;
  createdAt: string;
};

export type CourierSettlement = {
  id: string;
  settlementNumber: string;
  courierCompany: string;
  shipmentIds: Array<string | null>;
  grossCod: number;
  courierDeductions: number;
  otherDeductions: number;
  netReceived: number;
  receivedInto: string;
  receivedAt: string;
  reference: string;
  notes: string;
  createdAt: string;
};

export type ReturnRecord = {
  id: string;
  returnNumber: string;
  order: { id: string | null; orderNumber: string; customer: { name: string; phone: string }; status: string };
  type: "CUSTOMER_RETURN" | "RTO";
  reason: string;
  outboundCourierCost: number;
  returnCourierCost: number;
  refundAmount: number;
  itemCondition: string;
  resellable: boolean;
  completedAt: string;
  notes: string;
  createdAt: string;
};

export type FinishedItem = {
  id: string;
  itemCode: string;
  sourceOrderId: string | null;
  designName: string;
  sku: string;
  garmentType: string;
  color: string;
  size: string;
  quantity: number;
  unitCost: number;
  status: "AVAILABLE" | "SOLD" | "DAMAGED";
  notes: string;
  createdAt: string;
};

export type Expense = {
  id: string;
  expenseNumber: string;
  expenseDate: string;
  category: string;
  scope: string;
  amount: number;
  description: string;
  paidFrom: string;
  orderId: string | null;
  receiptUrl: string;
  createdAt: string;
};

export type AdCampaign = {
  id: string;
  name: string;
  platform: string;
  spend: number;
  startDate: string;
  endDate: string | null;
  status: string;
  notes: string;
  metrics: null | { orders: number; delivered: number; revenue: number; profit: number; costPerDeliveredOrder: number | null; profitAfterAds: number; roas: number | null };
  createdAt: string;
  updatedAt: string;
};

export type PartnerSummary = {
  totalFunding: number;
  partnerA: { credits: number; debits: number; netFunding: number; requiredShare: number; settlementBalance: number };
  partnerB: { credits: number; debits: number; netFunding: number; requiredShare: number; settlementBalance: number };
};

export type LedgerTransaction = {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  partnerCode: "PARTNER_A" | "PARTNER_B";
  type: string;
  direction: "CREDIT" | "DEBIT";
  amount: number;
  signedAmount: number;
  description: string;
  createdAt: string;
};

export type CashBalance = { account: string; inflow: number; outflow: number; balance: number };
export type CashTransaction = { id: string; transactionNumber: string; transactionDate: string; account: string; direction: string; amount: number; signedAmount: number; sourceType: string; description: string; createdAt: string };
export type ProfitDistribution = { id: string; distributionNumber: string; periodStart: string; periodEnd: string; netProfit: number; reserveAmount: number; distributableProfit: number; partnerAPercent: number; partnerBPercent: number; partnerAShare: number; partnerBShare: number; notes: string; createdAt: string };

export type ProfitLossReport = {
  from: string;
  to: string;
  deliveredOrders: number;
  deliveredRevenue: number;
  directOrderCost: number;
  failedOrderCost: number;
  grossProfit: number;
  generalExpenses: number;
  advertisementSpend: number;
  returnOperationalCost: number;
  customerRefunds: number;
  returnCount: number;
  netProfit: number;
};
