export const BOOKING_STATUSES = ["requested", "confirmed", "cancelled", "completed"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

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
  teacherNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type LiveStoreData = {
  slots: LiveSlot[];
  bookings: LiveBooking[];
};
