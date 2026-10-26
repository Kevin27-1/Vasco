import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const ones = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen ']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function convertToWords(num: number): string {
  if (num === 0) return 'Zero Only'
  
  const numStr = Math.floor(num).toString()
  if (numStr.length > 9) return 'Overflow'
  
  const n = ('000000000' + numStr).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/)
  if (!n) return ''
  
  let str = ''
  str += (Number(n[1]) !== 0) ? (ones[Number(n[1])] || tens[Number(n[1][0])] + ' ' + ones[Number(n[1][1])]) + 'Crore ' : ''
  str += (Number(n[2]) !== 0) ? (ones[Number(n[2])] || tens[Number(n[2][0])] + ' ' + ones[Number(n[2][1])]) + 'Lakh ' : ''
  str += (Number(n[3]) !== 0) ? (ones[Number(n[3])] || tens[Number(n[3][0])] + ' ' + ones[Number(n[3][1])]) + 'Thousand ' : ''
  str += (Number(n[4]) !== 0) ? (ones[Number(n[4])] || tens[Number(n[4][0])] + ' ' + ones[Number(n[4][1])]) + 'Hundred ' : ''
  str += (Number(n[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (ones[Number(n[5])] || tens[Number(n[5][0])] + ' ' + ones[Number(n[5][1])]) : ''
  
  return str.trim() + ' Only'
}

const styles = StyleSheet.create({
  page: {
    padding: 30,
    fontSize: 9,
    fontFamily: 'Helvetica',
    backgroundColor: '#ffffff'
  },
  container: {
    border: '1pt solid black',
    flexDirection: 'column',
    flex: 1
  },
  row: {
    flexDirection: 'row',
  },
  borderBottom: {
    borderBottom: '1pt solid black',
  },
  borderRight: {
    borderRight: '1pt solid black',
  },
  headerLeft: {
    width: '60%',
    padding: 5,
  },
  headerRight: {
    width: '40%',
  },
  brandTitle: {
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    color: '#d62828',
    marginBottom: 4,
  },
  text: {
    fontSize: 9,
    marginBottom: 2,
    fontFamily: 'Helvetica',
  },
  boldText: {
    fontSize: 9,
    fontFamily: 'Helvetica-Bold',
  },
  // Table styles
  tableHeader: {
    flexDirection: 'row',
    borderTop: '1pt solid black',
    borderBottom: '1pt solid black',
    backgroundColor: '#f9f9f9',
  },
  tableColSl: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColHSN: { width: '12%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColName: { width: '40%', borderRight: '1pt solid black', padding: 4 },
  tableColUOM: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColQty: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColRate: { width: '12%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColAmount: { width: '12%', padding: 4, textAlign: 'center' },
  
  tableRow: {
    flexDirection: 'row',
  },
  tableColSlBody: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColHSNBody: { width: '12%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColNameBody: { width: '40%', borderRight: '1pt solid black', padding: 4 },
  tableColUOMBody: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColQtyBody: { width: '8%', borderRight: '1pt solid black', padding: 4, textAlign: 'center' },
  tableColRateBody: { width: '12%', borderRight: '1pt solid black', padding: 4, textAlign: 'right' },
  tableColAmountBody: { width: '12%', padding: 4, textAlign: 'right' },

  tableContainer: {
    flex: 1, 
    flexDirection: 'column',
  },
  totalsContainer: {
    flexDirection: 'row',
    borderTop: '1pt solid black',
  },
  totalsLeft: {
    width: '76%',
    borderRight: '1pt solid black',
    flexDirection: 'column',
    justifyContent: 'flex-end',
  },
  totalsRight: {
    width: '24%',
    flexDirection: 'column',
  },
  totalRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid black',
    minHeight: 16,
  },
  totalLabel: {
    width: '50%',
    borderRight: '1pt solid black',
    padding: 4,
    textAlign: 'left',
  },
  totalValue: {
    width: '50%',
    padding: 4,
    textAlign: 'right',
  },
  wordsContainer: {
    padding: 5,
    borderBottom: '1pt solid black',
  },
  signContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 5,
    paddingTop: 20,
    paddingBottom: 20
  }
})

interface InvoiceProps {
  id?: string
  invoiceNumber?: string
  customerName: string
  customerPhone: string
  date: string
  items: {
    brand: string
    model: string
    size: string
    qty: number
    price: number
  }[]
}

export const InvoicePDF = ({ id, invoiceNumber, customerName, customerPhone, date, items }: InvoiceProps) => {
  const displayId = invoiceNumber || id || '1001';
  const totalWithTax = items.reduce((acc, curr) => acc + (curr.qty * curr.price), 0);
  const taxableValue = totalWithTax / 1.18;
  const cgst = taxableValue * 0.09;
  const sgst = taxableValue * 0.09;
  
  const totalAmountRounded = Math.round(totalWithTax);
  const roundOff = totalAmountRounded - totalWithTax;
  
  const words = convertToWords(totalAmountRounded);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.row}>
            <View style={[styles.headerLeft, styles.borderRight, styles.borderBottom]}>
              <Text style={styles.brandTitle}>VASCO TREADS</Text>
              <Text style={styles.text}>Variyatyak, Kunnamangalam</Text>
              <Text style={styles.text}>Opp. Milk Society - 673 571</Text>
              <Text style={styles.text}>Ph: 7907271835</Text>
            </View>
            <View style={[styles.headerRight, styles.borderBottom]}>
              <View style={[styles.row, styles.borderBottom]}>
                <View style={[{ width: '70%', padding: 4 }, styles.borderRight]}>
                  <Text style={styles.text}>GSTIN No : 32BKGPP1017F2ZN</Text>
                </View>
                <View style={{ width: '30%', padding: 4, justifyContent: 'center', alignItems: 'center' }}>
                  <Text style={styles.boldText}>INVOICE</Text>
                </View>
              </View>
              <View style={[styles.row, styles.borderBottom]}>
                <View style={[{ width: '50%', padding: 4 }, styles.borderRight]}>
                  <Text style={styles.text}>State : Kerala</Text>
                </View>
                <View style={{ width: '50%', padding: 4 }}>
                  <Text style={styles.text}>Code : 32</Text>
                </View>
              </View>
              <View style={[styles.borderBottom, { padding: 4 }]}>
                <Text style={styles.text}>Invoice No : B1 / {displayId} / 2026-27</Text>
              </View>
              <View style={{ padding: 4 }}>
                <Text style={styles.text}>Date : {date}</Text>
              </View>
            </View>
          </View>

          {/* To Section */}
          <View style={styles.row}>
            <View style={[styles.headerLeft, styles.borderRight, styles.borderBottom]}>
              <Text style={styles.text}>To</Text>
              <Text style={[styles.boldText, { marginLeft: 20 }]}>M/S {customerName}</Text>
            </View>
            <View style={[styles.headerRight, styles.borderBottom]}>
              <View style={[styles.borderBottom, { padding: 4 }]}>
                <Text style={styles.text}>Party GSTIN No : </Text>
              </View>
              <View style={{ padding: 4 }}>
                <Text style={styles.text}>Place of Supply</Text>
                <View style={styles.row}>
                  <Text style={[styles.text, { width: '50%' }]}>State :</Text>
                  <Text style={[styles.text, { width: '50%' }]}>Code :</Text>
                </View>
                <View style={styles.row}>
                  <Text style={[styles.text, { width: '50%' }]}>Ph : {customerPhone}</Text>
                  <Text style={[styles.text, { width: '50%' }]}>Date :</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Table Header */}
          <View style={styles.tableHeader}>
            <Text style={styles.tableColSl}>Sl No.</Text>
            <Text style={styles.tableColHSN}>HSN Code</Text>
            <Text style={styles.tableColName}>Name of Product/Service</Text>
            <Text style={styles.tableColUOM}>UOM</Text>
            <Text style={styles.tableColQty}>QTY.</Text>
            <Text style={styles.tableColRate}>RATE{'\n'}Per Unit</Text>
            <Text style={styles.tableColAmount}>AMOUNT{'\n'}Rs.    Ps.</Text>
          </View>

          {/* Table Body */}
          <View style={styles.tableContainer}>
            {items.map((item, index) => {
              const baseRate = item.price / 1.18;
              const amount = baseRate * item.qty;
              return (
                <View style={styles.tableRow} key={index}>
                  <Text style={styles.tableColSlBody}>{index + 1}</Text>
                  <Text style={styles.tableColHSNBody}></Text>
                  <Text style={styles.tableColNameBody}>{item.brand} {item.model} ({item.size})</Text>
                  <Text style={styles.tableColUOMBody}>NOS</Text>
                  <Text style={styles.tableColQtyBody}>{item.qty}</Text>
                  <Text style={styles.tableColRateBody}>{baseRate.toFixed(2)}</Text>
                  <Text style={styles.tableColAmountBody}>{amount.toFixed(2)}</Text>
                </View>
              )
            })}

            <View style={[styles.tableRow, { flex: 1 }]}>
              <View style={[styles.tableColSlBody]}></View>
              <View style={[styles.tableColHSNBody]}></View>
              <View style={[styles.tableColNameBody]}></View>
              <View style={[styles.tableColUOMBody]}></View>
              <View style={[styles.tableColQtyBody]}></View>
              <View style={[styles.tableColRateBody]}></View>
              <View style={styles.tableColAmountBody}></View>
            </View>
          </View>

          {/* Totals & Footer */}
          <View style={styles.totalsContainer}>
            <View style={styles.totalsLeft}>
              <View style={{ flex: 1 }}></View>
              <View style={styles.wordsContainer}>
                <Text style={styles.text}>Rupees in words:</Text>
                <Text style={[styles.boldText, { marginTop: 4 }]}>{words}</Text>
              </View>
              <View style={styles.signContainer}>
                <View>
                  <Text style={styles.text}>Certified that the above particulars are true & correct.</Text>
                </View>
                <View style={{ alignItems: 'center' }}>
                  <Text style={styles.boldText}>For VASCO TREADS</Text>
                  <Text style={[styles.text, { marginTop: 30 }]}>Authorised Signatory/Name:</Text>
                </View>
              </View>
            </View>

            <View style={styles.totalsRight}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{taxableValue.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Discount %</Text>
                <Text style={styles.totalValue}></Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Taxable Value</Text>
                <Text style={styles.totalValue}>{taxableValue.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>CGST. 9%</Text>
                <Text style={styles.totalValue}>{cgst.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>SGST. 9%</Text>
                <Text style={styles.totalValue}>{sgst.toFixed(2)}</Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>IGST 18%</Text>
                <Text style={styles.totalValue}></Text>
              </View>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Round of</Text>
                <Text style={styles.totalValue}>{roundOff !== 0 ? roundOff.toFixed(2) : ''}</Text>
              </View>
              <View style={[styles.totalRow, { borderBottom: 0 }]}>
                <Text style={[styles.totalLabel, styles.boldText]}>Invoice Total</Text>
                <Text style={[styles.totalValue, styles.boldText]}>{totalAmountRounded.toFixed(2)}</Text>
              </View>
            </View>
          </View>
        </View>
      </Page>
    </Document>
  )
}
