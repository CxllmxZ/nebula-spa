"use server";

// TODO: all actions require admin auth check
//   - createService(input)
//   - updateService(id, input)
//   - toggleServiceActive(id): soft delete via is_active flag
//   - reorderServices(ids[]): update display_order

export async function createService() {
  throw new Error("Not implemented");
}

export async function updateService() {
  throw new Error("Not implemented");
}

export async function toggleServiceActive() {
  throw new Error("Not implemented");
}
