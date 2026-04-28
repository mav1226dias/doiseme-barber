import { pgTable, text, integer, real, boolean, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const barbershops = pgTable('barbershops', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  address: text('address'),
  phone: text('phone'),
  instagram: text('instagram'),
  mapsUrl: text('maps_url'),
  logoUrl: text('logo_url'),
  primaryColor: text('primary_color').default('#000000'),
  secondaryColor: text('secondary_color').default('#ffffff'),
  bookingLayout: text('booking_layout').default('standard'), // standard, classic, modern
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'), // admin, barber
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const barbers = pgTable('barbers', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  userId: text('user_id').references(() => users.id), // Optional link to user account
  name: text('name').notNull(),
  commissionPercentage: real('commission_percentage').notNull().default(50), // Percentage for the barber
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const services = pgTable('services', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  name: text('name').notNull(),
  durationMinutes: integer('duration_minutes').notNull(),
  price: real('price').notNull(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clients = pgTable('clients', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  lastVisit: timestamp('last_visit', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const appointments = pgTable('appointments', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  barberId: text('barber_id').references(() => barbers.id).notNull(),
  serviceId: text('service_id').references(() => services.id).notNull(),
  clientId: text('client_id').references(() => clients.id).notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  startTime: text('start_time').notNull(), // HH:MM
  endTime: text('end_time').notNull(), // HH:MM
  status: text('status').notNull().default('scheduled'), // scheduled, completed, cancelled
  priceAtBooking: real('price_at_booking'), 
  commissionPercentageAtBooking: real('commission_percentage_at_booking'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const expenses = pgTable('expenses', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  description: text('description').notNull(),
  amount: real('amount').notNull(),
  category: text('category').notNull(), // rent, supplies, utilities, marketing, other, draw
  barberId: text('barber_id').references(() => barbers.id), // Link to barber for draws
  date: text('date').notNull(), // YYYY-MM-DD
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const clientPackages = pgTable('client_packages', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  clientName: text('client_name').notNull(),
  clientWhatsapp: text('client_whatsapp').notNull(),
  packageName: text('package_name').notNull(),
  totalQuantity: integer('total_quantity').notNull(),
  remainingQuantity: integer('remaining_quantity').notNull(),
  pricePaid: real('price_paid').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const notifications = pgTable('notifications', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull(),
  type: text('type').notNull(), // new_appointment, inactive_client
  title: text('title').notNull(),
  message: text('message').notNull(),
  read: boolean('read').notNull().default(false),
  actionUrl: text('action_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});

export const shopSettings = pgTable('shop_settings', {
  id: text('id').primaryKey(),
  barbershopId: text('barbershop_id').references(() => barbershops.id).notNull().unique(),
  config: text('config').notNull(), // JSON string
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
});
