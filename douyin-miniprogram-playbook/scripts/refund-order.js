// Operational template. Never execute against production without an approved order summary.
const reasonCodes = { unwanted: 101, merchant: 102, quality: 103, other: 999 };
function buildRefundRequest({ transactionOrderId, itemOrderId, amountFen, reason = "other" }) {
  if (!String(transactionOrderId).startsWith("motb")) throw new Error("order_id must be the motb transaction order id");
  return { order_id: transactionOrderId, item_order_detail: [{ item_order_id: itemOrderId, refund_amount: amountFen }], refund_reason: reasonCodes[reason] || reasonCodes.other };
}
module.exports = { buildRefundRequest, reasonCodes };
