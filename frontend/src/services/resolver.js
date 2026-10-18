const registry = {
  CUSTOMERS: "/api/customers",
  CUSTOMER: "/api/customers/:id",
  ORDERS: "/api/customers/:id/orders",
  SUPPORT: "/api/customers/:id/support",
  ANALYTICS: "/api/customers/:id/analytics"
};


export function resolveEndpoint(stateId, customerId) {
  const route = registry[stateId];

  if (!route) {
    throw new Error("Unknown state: " + stateId);
  }

  if (route.includes(":id")) {
    if (customerId === undefined || customerId === null || customerId === "") {
      throw new Error("Customer ID is required");
    }

    return route.replace(":id", encodeURIComponent(customerId));
  }

  return route;
}


