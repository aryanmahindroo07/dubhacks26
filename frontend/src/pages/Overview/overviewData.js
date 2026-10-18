export const sampleMetrics = [
  {
    id: "calls",
    label: "API calls seen",
    value: "12,486",
    note: "Data requests in this sample period",
    icon: "activity",
  },
  {
    id: "predictions",
    label: "Likely next calls",
    value: "48",
    note: "87.2% average confidence in the sample",
    icon: "sparkles",
  },
  {
    id: "waiting",
    label: "Potential waiting reduced",
    value: "18.6",
    unit: "min",
    note: "Estimated from sample data, not measured live",
    icon: "timer",
  },
  {
    id: "response",
    label: "Typical response time",
    value: "184",
    unit: "ms",
    note: "Middle response time in the sample",
    icon: "gauge",
  },
];

export const sampleRequests = [
  {
    id: "search",
    time: "10:42:18",
    method: "GET",
    title: "Search the product catalog",
    path: "/api/search?q=linen",
    response: 184,
    result: "Received",
    app: "Northstar Storefront",
  },
  {
    id: "products",
    time: "10:42:18",
    method: "GET",
    title: "Show matching products",
    path: "/api/products?category=linen",
    response: 236,
    result: "Predicted next",
    app: "Northstar Storefront",
  },
  {
    id: "collections",
    time: "10:39:51",
    method: "GET",
    title: "Load collections",
    path: "/api/collections",
    response: 128,
    result: "Received",
    app: "Northstar Storefront",
  },
  {
    id: "product",
    time: "10:37:24",
    method: "GET",
    title: "Load product details",
    path: "/api/products/sku-842",
    response: 312,
    result: "Not predicted",
    app: "Northstar Storefront",
  },
  {
    id: "project",
    time: "10:35:02",
    method: "GET",
    title: "Open project details",
    path: "/api/projects/atlas",
    response: 176,
    result: "Received",
    app: "Atlas Projects",
  },
];

export const timeRanges = {
  "24h": {
    label: "24 hours",
    labels: ["00:00", "04:00", "08:00", "12:00", "16:00", "20:00", "NOW"],
  },
  "7d": {
    label: "7 days",
    labels: ["WED", "THU", "FRI", "SAT", "SUN", "MON", "TODAY"],
  },
  "30d": {
    label: "30 days",
    labels: [
      "15 APR",
      "20 APR",
      "25 APR",
      "30 APR",
      "05 MAY",
      "10 MAY",
      "TODAY",
    ],
  },
};

export const chartValues = {
  "24h": [
    28, 34, 49, 43, 38, 60, 56, 63, 53, 68, 61, 54, 81, 76, 82, 77, 90, 84, 95,
    90, 103, 99,
  ],
  "7d": [
    33, 42, 39, 53, 49, 57, 46, 56, 67, 61, 73, 69, 78, 70, 82, 79, 90, 84, 96,
    91, 105, 101,
  ],
  "30d": [
    22, 31, 27, 37, 44, 41, 54, 46, 61, 57, 70, 65, 73, 68, 86, 82, 92, 87, 96,
    94, 106, 102,
  ],
};

export function filterRequests(requests, query, app) {
  const search = query.trim().toLowerCase();
  return requests.filter(
    (request) =>
      (app === "all" || request.app === app) &&
      `${request.path} ${request.title}`.toLowerCase().includes(search),
  );
}

export function createDemoRequests(run, paused, time) {
  return [
    { ...sampleRequests[0], id: `demo-search-${run}`, time },
    {
      ...sampleRequests[1],
      id: `demo-products-${run}`,
      time,
      result: paused ? "Received" : "Predicted next",
    },
  ];
}
