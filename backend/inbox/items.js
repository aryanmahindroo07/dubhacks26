// Dummy inbox items with mock AI results for each action.
//
// Everything here is invented: businesses, people, emails (example.com) and
// order numbers. `imageHint` describes the photo or screenshot to use for the
// item once real Perceptron calls are wired in.
//
// An action missing from `outputs` falls back to a generic result (see
// getActionResult), so the UI never breaks if a user picks something unusual.

const items = [
  // ---- Receipts -----------------------------------------------------------
  {
    id: "r1",
    type: "RECEIPT",
    title: "Cedar & Steam Café receipt",
    imageHint: "Phone photo of a printed café receipt on a desk",
    outputs: {
      READ_TEXT: {
        text: "CEDAR & STEAM CAFE\n412 Pine St\n10/16/2026 08:42\n2x Oat latte 11.00\n1x Almond croissant 4.75\nSubtotal 15.75\nTax 1.61\nTotal 17.36\nVISA ****4821",
      },
      EXTRACT_FIELDS: {
        fields: { vendor: "Cedar & Steam Café", date: "2026-10-16", subtotal: 15.75, tax: 1.61, total: 17.36, category: "Meals", payment: "Visa ending 4821" },
      },
      SUMMARIZE: { summary: "Coffee and a pastry for $17.36 on Oct 16, paid by Visa." },
      DRAFT_REPLY: { message: "Expense note: team coffee before the 9 AM client call, $17.36 (receipt attached)." },
    },
  },
  {
    id: "r2",
    type: "RECEIPT",
    title: "Paper Trail Stationers receipt",
    imageHint: "Crumpled office-supply receipt, slightly angled",
    outputs: {
      READ_TEXT: {
        text: "PAPER TRAIL STATIONERS\n10/15/2026\nShipping labels (100) 18.99\nPacking tape x3 13.47\nBubble mailers (50) 24.50\nSubtotal 56.96\nTax 5.83\nTotal 62.79",
      },
      EXTRACT_FIELDS: {
        fields: { vendor: "Paper Trail Stationers", date: "2026-10-15", subtotal: 56.96, tax: 5.83, total: 62.79, category: "Shipping supplies", payment: "Card" },
      },
      SUMMARIZE: { summary: "Shipping supplies (labels, tape, mailers) for $62.79 on Oct 15." },
      DRAFT_REPLY: { message: "Logged $62.79 of shipping supplies under Operations for October." },
    },
  },
  {
    id: "r3",
    type: "RECEIPT",
    title: "Fremont Fix-It hardware receipt",
    imageHint: "Long thermal receipt from a hardware store",
    outputs: {
      READ_TEXT: {
        text: "FREMONT FIX-IT\n10/12/2026\nShelf brackets x4 23.96\nWood screws 6.49\nLED strip 3m 19.99\nSubtotal 50.44\nTax 5.16\nTotal 55.60",
      },
      EXTRACT_FIELDS: {
        fields: { vendor: "Fremont Fix-It", date: "2026-10-12", subtotal: 50.44, tax: 5.16, total: 55.6, category: "Studio equipment", payment: "Cash" },
      },
      SUMMARIZE: { summary: "Shelving and lighting parts for the studio, $55.60 cash on Oct 12." },
      DRAFT_REPLY: { message: "Reimbursement request: $55.60 for studio shelving (cash, receipt attached)." },
    },
  },
  {
    id: "r4",
    type: "RECEIPT",
    title: "Lakeview Noodle House receipt",
    imageHint: "Restaurant receipt with a handwritten tip line",
    outputs: {
      READ_TEXT: {
        text: "LAKEVIEW NOODLE HOUSE\n10/14/2026 12:31\nParty of 4\nFood 64.00\nTax 6.56\nTip 13.00\nTotal 83.56",
      },
      EXTRACT_FIELDS: {
        fields: { vendor: "Lakeview Noodle House", date: "2026-10-14", subtotal: 64.0, tax: 6.56, tip: 13.0, total: 83.56, category: "Team meals", payment: "Card" },
      },
      SUMMARIZE: { summary: "Team lunch for four, $83.56 including a $13 tip, on Oct 14." },
      DRAFT_REPLY: { message: "Team lunch Oct 14: 4 people, $83.56 total. Splitting evenly is $20.89 each." },
    },
  },

  // ---- Whiteboards --------------------------------------------------------
  {
    id: "w1",
    type: "WHITEBOARD",
    title: "Sprint planning whiteboard",
    imageHint: "Whiteboard with three columns of sticky notes",
    outputs: {
      READ_TEXT: {
        text: "SPRINT 12\nTODO: checkout bug, onboarding emails, price page\nDOING: dashboard charts\nDONE: login fix\nRisk: payments vendor slow to reply",
      },
      CAPTION: { caption: "A whiteboard split into To do, Doing and Done columns with sticky notes." },
      SUMMARIZE: { summary: "Sprint 12 has three items to start, one in progress and one done; the payments vendor is a risk." },
      MAKE_TASKS: {
        tasks: [
          { task: "Fix checkout bug", status: "To do" },
          { task: "Write onboarding emails", status: "To do" },
          { task: "Update pricing page", status: "To do" },
          { task: "Finish dashboard charts", status: "In progress" },
          { task: "Follow up with payments vendor", status: "To do" },
        ],
      },
      DRAFT_REPLY: { message: "Sprint 12 plan: 3 new items, dashboard charts in progress. Can someone chase the payments vendor today?" },
    },
  },
  {
    id: "w2",
    type: "WHITEBOARD",
    title: "Merch drop launch checklist",
    imageHint: "Handwritten checklist on a whiteboard with arrows",
    outputs: {
      READ_TEXT: {
        text: "DROP 3 - NOV 1\n- final photos\n- size chart\n- email list teaser (Oct 25)\n- restock mailers\n- post countdown",
      },
      CAPTION: { caption: "A handwritten launch checklist for a merch drop dated November 1." },
      SUMMARIZE: { summary: "Five tasks before the Nov 1 drop, with the email teaser due Oct 25." },
      MAKE_TASKS: {
        tasks: [
          { task: "Shoot final product photos", due: "2026-10-28" },
          { task: "Publish size chart", due: "2026-10-28" },
          { task: "Send email teaser", due: "2026-10-25" },
          { task: "Restock bubble mailers", due: "2026-10-30" },
          { task: "Post launch countdown", due: "2026-10-31" },
        ],
      },
      DRAFT_REPLY: { message: "Drop 3 checklist is up: teaser goes out Oct 25, photos and size chart by Oct 28." },
    },
  },
  {
    id: "w3",
    type: "WHITEBOARD",
    title: "Customer interview notes",
    imageHint: "Messy whiteboard with quotes and a few circled words",
    outputs: {
      READ_TEXT: {
        text: "INTERVIEWS (5)\n'shipping takes forever'\n'love the designs'\n'sizes run small' x3\nIDEA: size guide + faster label printing",
      },
      CAPTION: { caption: "Interview notes with customer quotes and two circled ideas." },
      SUMMARIZE: { summary: "Five interviews: customers like the designs; three say sizes run small and shipping feels slow." },
      MAKE_TASKS: {
        tasks: [
          { task: "Add a size guide to product pages" },
          { task: "Speed up label printing" },
          { task: "Re-interview the 3 customers about fit" },
        ],
      },
      DRAFT_REPLY: { message: "Interview takeaway: 3 of 5 said sizes run small. Proposing a size guide before Drop 3." },
    },
  },

  // ---- Product photos -----------------------------------------------------
  {
    id: "p1",
    type: "PRODUCT_PHOTO",
    title: "Speckled ceramic mug",
    imageHint: "A speckled mug on a wooden table in daylight",
    outputs: {
      CAPTION: { caption: "A cream ceramic mug with brown speckles on a wooden table, soft daylight." },
      FIND_OBJECTS: { objects: [{ label: "mug", box: [0.31, 0.22, 0.68, 0.81] }, { label: "table", box: [0.0, 0.62, 1.0, 1.0] }] },
      READ_TEXT: { text: "(no text found)" },
      DRAFT_REPLY: { message: "Listing: Speckled stoneware mug, 12 oz, hand-glazed. Dishwasher safe. Each one is a little different." },
    },
  },
  {
    id: "p2",
    type: "PRODUCT_PHOTO",
    title: "Canvas tote with logo",
    imageHint: "Tote bag hanging on a door, logo visible",
    outputs: {
      CAPTION: { caption: "A natural canvas tote bag with a small black logo, hanging on a door." },
      FIND_OBJECTS: { objects: [{ label: "tote bag", box: [0.2, 0.1, 0.8, 0.9] }, { label: "logo", box: [0.42, 0.38, 0.58, 0.5] }] },
      READ_TEXT: { text: "MAKE THINGS" },
      DRAFT_REPLY: { message: "Listing: Heavyweight canvas tote with 'Make Things' print. Fits a laptop and a lunch." },
    },
  },
  {
    id: "p3",
    type: "PRODUCT_PHOTO",
    title: "Brass desk lamp",
    imageHint: "Desk lamp switched on, next to a notebook",
    outputs: {
      CAPTION: { caption: "A brass desk lamp switched on beside an open notebook." },
      FIND_OBJECTS: { objects: [{ label: "lamp", box: [0.45, 0.05, 0.85, 0.78] }, { label: "notebook", box: [0.05, 0.55, 0.45, 0.95] }] },
      READ_TEXT: { text: "(no text found)" },
      DRAFT_REPLY: { message: "Listing: Brushed-brass desk lamp with warm LED bulb. Adjustable arm, 18 in tall." },
    },
  },

  // ---- Forms (fake personal data: useful for the VEYZL audit) ------------
  {
    id: "f1",
    type: "FORM",
    title: "Return request: order #1042",
    imageHint: "Screenshot of a filled-in web form",
    outputs: {
      READ_TEXT: {
        text: "RETURN REQUEST\nName: Jordan Example\nEmail: jordan@example.com\nOrder: #1042\nItem: Canvas tote (x1)\nReason: arrived with a torn handle\nPreferred: replacement",
      },
      EXTRACT_FIELDS: {
        fields: { name: "Jordan Example", email: "jordan@example.com", order: "1042", item: "Canvas tote", quantity: 1, reason: "Torn handle on arrival", resolution: "Replacement" },
      },
      SUMMARIZE: { summary: "Customer wants a replacement tote for order #1042; the handle arrived torn." },
      DRAFT_REPLY: { message: "Hi Jordan, sorry your tote arrived damaged. A replacement ships tomorrow; no need to send the old one back." },
    },
  },
  {
    id: "f2",
    type: "FORM",
    title: "Wholesale inquiry",
    imageHint: "Photo of a printed inquiry form with handwriting",
    outputs: {
      READ_TEXT: {
        text: "WHOLESALE INQUIRY\nShop: Northwind Gifts (example)\nContact: Sam Placeholder\nEmail: sam@example.com\nInterested in: mugs x48, totes x24\nNeeded by: Nov 20",
      },
      EXTRACT_FIELDS: {
        fields: { shop: "Northwind Gifts", contact: "Sam Placeholder", email: "sam@example.com", items: "48 mugs, 24 totes", neededBy: "2026-11-20" },
      },
      SUMMARIZE: { summary: "Northwind Gifts wants 48 mugs and 24 totes by Nov 20." },
      DRAFT_REPLY: { message: "Hi Sam, thanks for reaching out. 48 mugs and 24 totes by Nov 20 works; I'll send wholesale pricing today." },
    },
  },
];

function getItem(id) {
  return items.find((item) => item.id === id) || null;
}

// Result for one action on one item, with a generic fallback.
function getActionResult(item, action) {
  return item.outputs[action] || { note: `No ${action} result prepared for this demo item.` };
}

module.exports = { items, getItem, getActionResult };
