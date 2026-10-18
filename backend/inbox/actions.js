// The AI actions a user can run on an inbox item.
//
// latencyMs values are PLACEHOLDERS for the demo until real Perceptron and
// Gemini calls are wired in. Replace them with measured averages once you
// have them (the benchmark reads these numbers).

const ACTIONS = {
  READ_TEXT: {
    label: "Read text",
    model: "Perceptron",
    capability: "OCR",
    latencyMs: 2500,
  },
  FIND_OBJECTS: {
    label: "Find objects",
    model: "Perceptron",
    capability: "Object localization",
    latencyMs: 3000,
  },
  CAPTION: {
    label: "Caption",
    model: "Perceptron",
    capability: "Captioning",
    latencyMs: 2000,
  },
  EXTRACT_FIELDS: {
    label: "Extract fields",
    model: "Gemini",
    capability: "Structured extraction",
    latencyMs: 3500,
  },
  SUMMARIZE: {
    label: "Summarize",
    model: "Gemini",
    capability: "Summarization",
    latencyMs: 3000,
  },
  MAKE_TASKS: {
    label: "Turn into tasks",
    model: "Gemini",
    capability: "Task extraction",
    latencyMs: 4000,
  },
  DRAFT_REPLY: {
    label: "Draft a message",
    model: "Gemini",
    capability: "Writing",
    latencyMs: 3500,
  },
};

const ACTION_IDS = Object.keys(ACTIONS);

const ITEM_TYPES = {
  RECEIPT: "Receipt",
  WHITEBOARD: "Whiteboard",
  PRODUCT_PHOTO: "Product photo",
  FORM: "Form",
};

module.exports = { ACTIONS, ACTION_IDS, ITEM_TYPES };
