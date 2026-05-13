// products/garden-wall-calendar-na.js (CommonJS)
// North America (US & Canada) variant of the garden wall calendar.
// Ledger size: 11 × 16.5 inches (279mm × 419mm), wire-bound with hook top.
//
// All layout, artwork, inspo, garden database, and generation logic is
// inherited from garden-wall-calendar.js — this file only overrides the
// product identity fields consumed by orderService.js and products/index.js.
//
// PDF page dimensions are controlled by calendarTemplate.js (.cal-sheet CSS).
// The NA sheet size requires a separate calendarTemplate variant or an
// override mechanism — see BACKLOG NA-1 for the dimension work still to do.
// This file is the product registry entry; dimension changes are a follow-on
// task in the same sprint once the Gelato test print confirms the spec.

var base = require('./garden-wall-calendar.js');

module.exports = Object.assign({}, base, {
  id:            'garden-wall-calendar-na',
  gelatoSku:     'wall_calendar_product_pf_xl11x16-5-inch_pt_100-lb-cover-coated-silk_cl_4-4_bt_wire-with-hook-top_ct_none_prt_none_ver',
  // formatOverride tells pdfService to use the 'na' FORMATS entry (287.4×427.1mm bleed sheet)
  // instead of the default 'a3' dimensions.
  formatOverride: 'na',
});
