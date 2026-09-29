export const BOOKING_STATUSES = ["requested", "pending_payment", "confirmed", "cancelled", "completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = ["none", "pending", "paid", "failed"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** JS weekday: 0 = Sunday … 6 = Saturday. */
export type WeeklyWindow = {
  weekday: number;
  start: string;
  end: string;
};

export type TeacherAvailability = {
  timezone: string;
  windows: WeeklyWindow[];
  durationMinutes: number;
  horizonDays: number;
};

export type LiveSlot = {
  id: string;
  startsAt: string;
  durationMinutes: number;
  capacity: number;
  note?: string;
  createdAt: string;
};

export type LiveBooking = {
  id: string;
  slotId: string;
  startsAt: string;
  durationMinutes: number;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentPhone: string;
  status: BookingStatus;
  meetingLink?: string;
  meetingProvider?: string;
  classroomUrl?: string;
  classroomRoomId?: string;
  teacherNote?: string;
  reminderSentAt?: string;
  paymentStatus?: PaymentStatus;
  paymentProvider?: "whish" | "manual" | "demo" | "none";
  paymentExternalId?: number;
  paymentAmount?: number;
  paymentCurrency?: "USD" | "LBP";
  paymentCheckoutUrl?: string;
  /** Dual Whish pricing: member ($15) vs external/guest ($25). */
  pricingTier?: "member" | "external";
  paidAt?: string;
  creditDeducted?: boolean;
  studentMarkedPaidAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveStoreData = {
  slots: LiveSlot[];
  bookings: LiveBooking[];
  availability: TeacherAvailability;
};

export const DEFAULT_AVAILABILITY: TeacherAvailability = {
  timezone: "Asia/Beirut",
  durationMinutes: 45,
  horizonDays: 21,
  windows: [
    { weekday: 1, start: "16:00", end: "19:00" },
    { weekday: 3, start: "16:00", end: "19:00" },
  ],
};
