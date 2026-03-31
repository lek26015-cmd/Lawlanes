/**
 * Professional Invoice Template for LawsLane
 */
export function getInvoiceHtml(data: any) {
  const { 
    invoiceNumber, 
    date, 
    dueDate, 
    lawyerName, 
    lawyerTaxId, // Added
    lawyerAddress, // Added
    clientName, 
    clientTaxId, // Added
    clientAddress, // Added
    milestoneTitle, 
    amount, 
    includeVat = false, // Added
    currency = 'THB' 
  } = data;

  const vatRate = 0.07;
  const vatAmount = includeVat ? amount * vatRate : 0;
  const totalAmount = amount + vatAmount;

  const fmt = (val: number) => new Intl.NumberFormat('th-TH', { 
    style: 'currency', 
    currency 
  }).format(val);

  const title = includeVat ? "ใบกำกับภาษี/ใบเสร็จรับเงิน" : "ใบแจ้งหนี้ (Invoice)";

  return `
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; margin: 0; padding: 40px; }
        .header { display: flex; justify-content: space-between; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 30px; }
        .logo { font-size: 24px; font-weight: bold; color: #0B3979; }
        .invoice-title { font-size: 24px; font-weight: bold; color: #64748b; text-transform: uppercase; }
        
        .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
        .label { font-size: 11px; font-weight: bold; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; }
        .value { font-size: 14px; font-weight: 500; margin-bottom: 10px; }
        .tax-id { font-size: 12px; color: #64748b; font-weight: bold; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
        
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { background: #f8fafc; text-align: left; padding: 12px; border-bottom: 1px solid #e2e8f0; font-size: 14px; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
        
        .total-section { display: flex; justify-content: flex-end; }
        .total-table { width: 300px; }
        .total-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 14px; }
        .grand-total { border-top: 2px solid #0B3979; margin-top: 10px; padding-top: 10px; font-weight: bold; font-size: 18px; color: #0B3979; }
        
        .footer { margin-top: 60px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="logo">LawsLane Marketplace</div>
        <div class="invoice-title">${title}</div>
      </div>

      <div class="info-section">
        <div>
          <div class="label">ผู้ให้บริการ (Seller)</div>
          <div class="value">
            ${lawyerName}<br>
            <span style="font-size: 12px; color: #64748b;">${lawyerAddress || 'สำนักงานกฎหมายที่ได้รับอนุญาต'}</span><br>
            <span class="tax-id">TAX ID: ${lawyerTaxId || '---'}</span>
          </div>
          <div class="label">สำหรับลูกความ (Buyer)</div>
          <div class="value">
            ${clientName}<br>
            <span style="font-size: 12px; color: #64748b;">${clientAddress || 'ข้อมูลตามระบุในระบบ'}</span><br>
            <span class="tax-id">TAX ID: ${clientTaxId || '---'}</span>
          </div>
        </div>
        <div style="text-align: right;">
          <div class="label">หมายเลข (No.)</div>
          <div class="value">#${invoiceNumber}</div>
          <div class="label">วันที่ (Date)</div>
          <div class="value">${date}</div>
          <div class="label">ครบกำหนด (Due Date)</div>
          <div class="value">${dueDate}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>รายการ (Description)</th>
            <th style="text-align: right;">จำนวนเงิน (Amount)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ค่าบริการทางกฎหมาย: ${milestoneTitle}</td>
            <td style="text-align: right;">${fmt(amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="total-section">
        <div class="total-table">
          <div class="total-row">
            <span>มูลค่า (Subtotal):</span>
            <span>${fmt(amount)}</span>
          </div>
          ${includeVat ? `
          <div class="total-row">
            <span>ภาษีมูลค่าเพิ่ม (VAT 7%):</span>
            <span>${fmt(vatAmount)}</span>
          </div>
          ` : ''}
          <div class="total-row grand-total">
            <span>ยอดรวมทั้งสิ้น (Grand Total):</span>
            <span>${fmt(totalAmount)}</span>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>เอกสารฉบับนี้ถูกสร้างขึ้นอย่างเป็นทางการผ่านระบบ LawsLane Marketplace</p>
      </div>
    </body>
    </html>
  `;
}
