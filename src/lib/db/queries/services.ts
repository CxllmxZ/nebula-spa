/**
 * Service queries
 *
 * All DB access related to services table.
 * Used by public routes (list active services) and admin CRUD actions.
 */

// ============================================
// Public queries
// ============================================
// TODO: getActiveServices() — SELECT WHERE is_active = true, ORDER BY display_order
// TODO: getServiceById(id: number) — for booking flow

// ============================================
// Admin queries (auth required at caller)
// ============================================
// TODO: getAllServices() — including inactive
// TODO: createService(input: NewService)
// TODO: updateService(id: number, input: Partial<NewService>)
// TODO: toggleServiceActive(id: number) — soft delete via is_active flag
// TODO: reorderServices(orderedIds: number[]) — update display_order

export {};
